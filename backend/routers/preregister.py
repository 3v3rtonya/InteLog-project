"""
preregister.py — Admin bulk pre-registration of students via CSV upload.

CSV columns (header row required, order flexible):
  full_name | student_id | email | phone | school | department
  | lecturer_name | lecturer_email | lecturer_phone

Logic per row:
  1. Lecturer — find by lecturer_email:
       - Exists (any status) → reuse
       - Not found → create with role=lecturer, status=active,
         temp password = first part of email before '@'
  2. Intern shell — find by student_id + role=intern:
       - Not found → create with status=shell (no password, placeholder email if missing)
       - Found with status=shell → update name/phone/school/dept if provided
       - Found with status=pending/active → skip (student already self-registered)
  3. LecturerInternAssignment — upsert (one intern → one lecturer)
"""
import csv
import io
import secrets
import string
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, LecturerInternAssignment, Notification
from backend.schemas import PreRegisterImportResponse, PreRegisterRowResult
from backend.services.auth_service import hash_password
from backend.services.email_service import send_lecturer_welcome_email
from backend.dependencies import get_current_admin

router = APIRouter(prefix="/admin/preregister", tags=["preregister"])

# Required CSV columns
REQUIRED_COLS = {
    "full_name", "student_id", "email", "phone",
    "school", "department",
    "lecturer_name", "lecturer_email", "lecturer_phone",
}


def _temp_password(email: str) -> str:
    """Derive a readable temp password from the email prefix."""
    prefix = email.split("@")[0]
    # Capitalise + append fixed suffix to meet password policy
    return f"{prefix.capitalize()}@Dkut1"


def _notify(db, user_id, ntype, title, body):
    db.add(Notification(user_id=user_id, type=ntype, title=title, body=body))


def _process_row(
    row_num: int,
    row: dict,
    db: Session,
    admin_id,
    lecturer_cache: dict,   # lecturer_email → User
) -> PreRegisterRowResult:
    """Process a single CSV row. Returns a result object."""

    # ── Normalise values ──────────────────────────────────────────────────
    def g(col): return row.get(col, "").strip()

    full_name      = g("full_name")
    student_id     = g("student_id").upper()
    email          = g("email").lower()
    phone          = g("phone")
    school         = g("school")
    department     = g("department")
    lecturer_name  = g("lecturer_name")
    lecturer_email = g("lecturer_email").lower()
    lecturer_phone = g("lecturer_phone")

    # Basic presence validation
    missing = [c for c in REQUIRED_COLS if not row.get(c, "").strip()]
    if missing:
        return PreRegisterRowResult(
            row=row_num, student_id=student_id or "?",
            intern_name=full_name or "?", lecturer_email=lecturer_email or "?",
            action="error", lecturer_action="error",
            message=f"Missing columns: {', '.join(missing)}",
        )

    # ── 1. Lecturer ───────────────────────────────────────────────────────
    lec_action = "existing_lecturer"
    if lecturer_email in lecturer_cache:
        lecturer = lecturer_cache[lecturer_email]
    else:
        lecturer = db.query(User).filter(
            User.email == lecturer_email,
            User.role == "lecturer",
        ).first()

        if not lecturer:
            # Check if email is taken by a non-lecturer account
            conflict = db.query(User).filter(User.email == lecturer_email).first()
            if conflict:
                return PreRegisterRowResult(
                    row=row_num, student_id=student_id,
                    intern_name=full_name, lecturer_email=lecturer_email,
                    action="error", lecturer_action="error",
                    message=f"Email {lecturer_email} is already registered as a non-lecturer account.",
                )

            temp_pw = _temp_password(lecturer_email)
            lecturer = User(
                email=lecturer_email,
                password_hash=hash_password(temp_pw),
                full_name=lecturer_name,
                phone=lecturer_phone or None,
                role="lecturer",
                status="active",
                school=school,
                department=department,
            )
            db.add(lecturer)
            db.flush()
            lec_action = "created_lecturer"

            # Email credentials to new lecturer (non-blocking)
            send_lecturer_welcome_email(
                user_email=lecturer_email,
                user_name=lecturer_name,
                school=school,
                department=department,
                temp_password=temp_pw,
            )

        lecturer_cache[lecturer_email] = lecturer

    # ── 2. Intern shell ───────────────────────────────────────────────────
    intern_action = "created_intern"
    existing = db.query(User).filter(
        User.student_id == student_id,
        User.role == "intern",
    ).first()

    if existing:
        if existing.status in ("pending", "active"):
            # Student already self-registered — honour their account, just ensure assignment
            intern = existing
            intern_action = "existing_active_intern"
        elif existing.status == "shell":
            # Update shell with any new details
            if full_name:  existing.full_name  = full_name
            if phone:      existing.phone      = phone
            if school:     existing.school     = school
            if department: existing.department = department
            if email and email != existing.email:
                # Only update email if not already taken
                if not db.query(User).filter(User.email == email, User.id != existing.id).first():
                    existing.email = email
            intern = existing
            intern_action = "merged_intern"
        else:
            intern = existing
            intern_action = "merged_intern"
    else:
        # Create a new shell account
        # Use email if provided, else generate a placeholder (student will update on signup)
        intern_email = email if email else f"{student_id.lower().replace('/', '_')}@shell.intelog.local"

        # Check email uniqueness
        if email and db.query(User).filter(User.email == email).first():
            return PreRegisterRowResult(
                row=row_num, student_id=student_id,
                intern_name=full_name, lecturer_email=lecturer_email,
                action="error", lecturer_action=lec_action,
                message=f"Email {email} is already registered.",
            )

        intern = User(
            email=intern_email,
            password_hash=None,       # no password until student self-registers
            full_name=full_name,
            phone=phone or None,
            role="intern",
            status="shell",
            student_id=student_id,
            student_id_status="unlinked",
            school=school,
            department=department,
        )
        db.add(intern)
        db.flush()

    # ── 3. Lecturer ↔ Intern assignment ───────────────────────────────────
    assignment_created = False
    existing_assignment = db.query(LecturerInternAssignment).filter(
        LecturerInternAssignment.intern_id == intern.id,
    ).first()

    if existing_assignment:
        if str(existing_assignment.lecturer_id) != str(lecturer.id):
            # Re-assign to new lecturer
            existing_assignment.lecturer_id = lecturer.id
            existing_assignment.assigned_by  = admin_id
            assignment_created = True
    else:
        db.add(LecturerInternAssignment(
            lecturer_id=lecturer.id,
            intern_id=intern.id,
            assigned_by=admin_id,
        ))
        assignment_created = True

    return PreRegisterRowResult(
        row=row_num,
        student_id=student_id,
        intern_name=full_name,
        lecturer_email=lecturer_email,
        action=intern_action,
        lecturer_action=lec_action,
        message=(
            "Assigned to lecturer."
            if assignment_created else
            "Assignment unchanged."
        ),
    )


# ── CSV template download ─────────────────────────────────────────────────────

@router.get("/template")
def download_template(_: User = Depends(get_current_admin)):
    """Returns a CSV template the admin can fill in and upload."""
    from fastapi.responses import Response as FastAPIResponse
    header = "full_name,student_id,email,phone,school,department,lecturer_name,lecturer_email,lecturer_phone\n"
    example = (
        "Jane Mwangi,C026-01-0001/2024,jane.mwangi@students.dkut.ac.ke,"
        "+254712000001,School of Computing & IT,Software Engineering,"
        "Dr. Alice Kimani,a.kimani@dkut.ac.ke,+254720000002\n"
        "John Kamau,C026-01-0002/2024,john.kamau@students.dkut.ac.ke,"
        "+254712000003,School of Computing & IT,Computer Science,"
        "Dr. Alice Kimani,a.kimani@dkut.ac.ke,+254720000002\n"
    )
    content = header + example
    return FastAPIResponse(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=intelog_student_template.csv"},
    )


# ── Bulk import ───────────────────────────────────────────────────────────────

@router.post("/upload", response_model=PreRegisterImportResponse)
async def bulk_preregister(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Upload a CSV file to pre-register students and auto-assign them to lecturers.

    - Creates lecturer accounts if they don't exist (emails credentials to lecturer)
    - Creates intern shell accounts (status=shell) linked to their student ID
    - Assigns each intern to their lecturer
    - Skips rows where the student has already self-registered (pending/active)
    - Returns a detailed per-row import report
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted. Download the template to get started.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM from Excel exports
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    # Validate header
    if not reader.fieldnames:
        raise HTTPException(400, "CSV file is empty or has no header row.")

    normalised_fields = {f.strip().lower() for f in reader.fieldnames}
    missing_cols = REQUIRED_COLS - normalised_fields
    if missing_cols:
        raise HTTPException(
            400,
            f"CSV is missing required columns: {', '.join(sorted(missing_cols))}. "
            "Download the template from the button above."
        )

    rows = list(reader)
    if not rows:
        raise HTTPException(400, "CSV has a header but no data rows.")
    if len(rows) > 500:
        raise HTTPException(400, "Maximum 500 rows per upload. Split into multiple files.")

    results: List[PreRegisterRowResult] = []
    lecturer_cache: dict = {}  # avoid re-querying same lecturer multiple times

    # Normalise dict keys to lowercase stripped
    for i, raw_row in enumerate(rows, start=2):
        norm_row = {k.strip().lower(): v for k, v in raw_row.items()}
        result = _process_row(
            row_num=i,
            row=norm_row,
            db=db,
            admin_id=admin.id,
            lecturer_cache=lecturer_cache,
        )
        results.append(result)

    # Commit everything in one transaction
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Database error during import: {str(e)}")

    # Tally results
    interns_created      = sum(1 for r in results if r.action == "created_intern")
    interns_merged       = sum(1 for r in results if r.action == "merged_intern")
    interns_skipped      = sum(1 for r in results if r.action in ("error", "existing_active_intern"))
    lecturers_created    = sum(1 for r in results if r.lecturer_action == "created_lecturer")
    assignments_created  = sum(1 for r in results if "Assigned" in r.message)

    return PreRegisterImportResponse(
        total_rows=len(rows),
        interns_created=interns_created,
        interns_merged=interns_merged,
        interns_skipped=interns_skipped,
        lecturers_created=lecturers_created,
        assignments_created=assignments_created,
        rows=results,
    )
