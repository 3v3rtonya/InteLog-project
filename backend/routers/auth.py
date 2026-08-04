"""
auth.py - Authentication routes including intern/supervisor signup with
Student ID auto-linking, profile management, and password change.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, Request, UploadFile, File, status
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
from uuid import UUID
import secrets, os, uuid as _uuid

from backend.database import get_db, get_db_status
from backend.models import User, Notification, PasswordResetToken
from backend.schemas import (
    InternSignupRequest, SupervisorSignupRequest,
    LoginRequest, TokenResponse, UserResponse, GoogleAuthRequest,
    ProfileUpdateRequest, PasswordChangeRequest,
)
from backend.services.auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    exchange_google_code,
)
from backend.services.email_service import send_email, send_welcome_email
from backend.dependencies import get_current_user
from backend.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
REFRESH_COOKIE_NAME = "refresh_token"
AVATAR_DIR = os.path.join(settings.UPLOAD_DIR, "avatars")


def _set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        key=REFRESH_COOKIE_NAME, value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )


def _notify(db: Session, user_id, ntype: str, title: str, body: str,
            link_id=None, link_type: str = None):
    n = Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link_id=link_id, link_type=link_type,
    )
    db.add(n)


def _notify_all_admins(db: Session, ntype: str, title: str, body: str,
                       link_id=None, link_type: str = None):
    """Notify all active admins."""
    admins = db.query(User).filter(User.role == "admin", User.status == "active").all()
    for admin in admins:
        _notify(db, admin.id, ntype, title, body, link_id, link_type)


def _notify_lecturers_for_intern(db: Session, intern: User, ntype: str,
                                  title: str, body: str, link_id=None, link_type: str = None):
    """
    Notify lecturers in the same school as the intern.
    Used when a new intern registers so the admin (and eventually assigned lecturer)
    is aware of unassigned pending interns.
    """
    lecturers = db.query(User).filter(
        User.role == "lecturer",
        User.status == "active",
        User.school == intern.school,
    ).all()
    for lec in lecturers:
        _notify(db, lec.id, ntype, title, body, link_id, link_type)


# ── Intern Signup ─────────────────────────────────────────────────────────────

@router.post("/signup/intern", response_model=UserResponse, status_code=201)
def signup_intern(payload: InternSignupRequest, db: Session = Depends(get_db)):
    """
    Intern self-registers.

    Two paths:
    A) Shell account exists for this student_id (pre-registered by admin):
       - Merge: apply password, phone, email, school, dept to the shell account
       - Status: shell → pending
       - Lecturer assignment already set by admin — no queue step needed
       - Notify assigned lecturer that the student has registered

    B) No shell account (student not pre-registered):
       - Create new intern account as before (status=pending)
       - Admin assigns to lecturer from unassigned queue
    """
    # ── Email uniqueness check ────────────────────────────────────────────
    existing_email = db.query(User).filter(User.email == payload.email).first()

    # ── Look for a shell account by student_id ────────────────────────────
    shell = db.query(User).filter(
        User.student_id == payload.student_id,
        User.role == "intern",
        User.status == "shell",
    ).first()

    if shell:
        # ── PATH A: Merge with shell ──────────────────────────────────────
        # Email check: if payload email differs from shell placeholder, verify unique
        if payload.email != shell.email:
            if existing_email and existing_email.id != shell.id:
                raise HTTPException(409, "An account with this email already exists")

        shell.email          = payload.email
        shell.password_hash  = hash_password(payload.password)
        shell.full_name      = payload.full_name
        shell.phone          = payload.phone
        shell.school         = payload.school or shell.school
        shell.department     = payload.department or shell.department
        shell.status         = "pending"
        shell.student_id_status = "unlinked"
        intern = shell

    else:
        # ── PATH B: Fresh registration ────────────────────────────────────
        if existing_email:
            raise HTTPException(409, "An account with this email already exists")

        active_intern = db.query(User).filter(
            User.student_id == payload.student_id,
            User.role == "intern",
        ).first()
        if active_intern:
            raise HTTPException(409, "An intern has already registered with this Student ID")

        intern = User(
            email=payload.email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
            phone=payload.phone,
            role="intern",
            status="pending",
            student_id=payload.student_id,
            student_id_status="unlinked",
            school=payload.school,
            department=payload.department,
        )
        db.add(intern)

    db.flush()

    # ── Supervisor auto-link (same for both paths) ────────────────────────
    waiting_supervisor = db.query(User).filter(
        User.role == "supervisor",
        User.student_id == payload.student_id,
        User.status == "waiting",
    ).first()

    if waiting_supervisor:
        intern.supervisor_id     = waiting_supervisor.id
        intern.student_id_status = "linked"
        waiting_supervisor.student_id_status = "linked"

    # ── Notifications ─────────────────────────────────────────────────────
    if shell and intern.lecturer_assignment:
        # Pre-registered: notify the already-assigned lecturer
        lec_id = intern.lecturer_assignment.lecturer_id
        if waiting_supervisor:
            _notify(
                db, lec_id, "new_signup",
                f"Student Registered & Supervisor Linked — {payload.student_id}",
                f"{intern.full_name} ({intern.school} / {intern.department}) has registered "
                f"and been auto-linked to supervisor {waiting_supervisor.full_name}. "
                f"Pending your approval.",
                link_id=intern.id, link_type="user",
            )
        else:
            _notify(
                db, lec_id, "new_signup",
                f"Student Registered — {intern.full_name}",
                f"{intern.full_name} ({intern.school} / {intern.department}) has registered "
                f"on the system. Their supervisor has not linked yet.",
                link_id=intern.id, link_type="user",
            )
        # Also notify admins
        if waiting_supervisor:
            _notify_all_admins(
                db, "new_signup",
                f"Intern & Supervisor Linked — {payload.student_id}",
                f"{intern.full_name} and {waiting_supervisor.full_name} are linked. "
                f"Assigned to lecturer for approval.",
                link_id=intern.id, link_type="user",
            )
    else:
        # Not pre-registered — notify admins to queue for assignment
        if waiting_supervisor:
            _notify_all_admins(
                db, "new_signup",
                f"New Intern & Supervisor Linked — {payload.student_id}",
                f"Intern {intern.full_name} ({intern.school} / {intern.department}) and "
                f"Supervisor {waiting_supervisor.full_name} have been auto-linked via "
                f"Student ID {payload.student_id}. Assign to a lecturer and approve.",
                link_id=intern.id, link_type="user",
            )
        else:
            _notify_all_admins(
                db, "new_signup",
                f"New Intern Registered — {payload.student_id}",
                f"{intern.full_name} ({intern.school} / {intern.department}) has registered "
                f"as an intern. Assign to a lecturer once their supervisor links up.",
                link_id=intern.id, link_type="user",
            )

    db.commit()
    db.refresh(intern)

    send_welcome_email(intern.email, intern.full_name, "intern")
    return intern


# ── Supervisor Signup ─────────────────────────────────────────────────────────

@router.post("/signup/supervisor", response_model=UserResponse, status_code=201)
def signup_supervisor(payload: SupervisorSignupRequest, db: Session = Depends(get_db)):
    """
    Supervisor registers with the intern's Student ID.
    If intern already exists they are auto-linked; otherwise supervisor waits.
    """
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "An account with this email already exists")

    existing_sup = db.query(User).filter(
        User.role == "supervisor",
        User.student_id == payload.student_id,
    ).first()
    if existing_sup:
        raise HTTPException(409, "Another supervisor has already registered with this Student ID")

    supervisor = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role="supervisor",
        status="waiting",
        student_id=payload.student_id,
        student_id_status="waiting",
        school=payload.school,
        department=payload.department,
    )
    db.add(supervisor)
    db.flush()

    intern = db.query(User).filter(
        User.role == "intern",
        User.student_id == payload.student_id,
    ).first()

    if intern:
        intern.supervisor_id = supervisor.id
        intern.student_id_status = "linked"
        supervisor.student_id_status = "linked"
        _notify_all_admins(
            db, "new_signup",
            f"New Intern & Supervisor Linked — {payload.student_id}",
            f"Supervisor {supervisor.full_name} has been auto-linked to intern "
            f"{intern.full_name} ({intern.school} / {intern.department}) via "
            f"Student ID {payload.student_id}. Assign to a lecturer and approve.",
            link_id=supervisor.id, link_type="user",
        )
        # Notify assigned lecturer (if already assigned)
        if intern.lecturer_assignment:
            _notify(
                db, intern.lecturer_assignment.lecturer_id, "new_signup",
                f"Supervisor Linked — {intern.full_name}",
                f"A supervisor ({supervisor.full_name}) has been linked to your intern "
                f"{intern.full_name}. Pending your approval.",
                link_id=intern.id, link_type="user",
            )
    else:
        _notify_all_admins(
            db, "new_signup",
            f"New Supervisor Registered — {payload.student_id}",
            f"{supervisor.full_name} registered as supervisor for Student ID "
            f"{payload.student_id}. Awaiting intern registration.",
            link_id=supervisor.id, link_type="user",
        )

    db.commit()
    db.refresh(supervisor)

    # Fire-and-forget welcome email — non-blocking
    send_welcome_email(supervisor.email, supervisor.full_name, "supervisor")

    return supervisor


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    db_status = get_db_status()
    if not db_status["available"]:
        raise HTTPException(status_code=503, detail="Authentication service unavailable: database is not reachable")

    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    if user.status == "suspended":
        raise HTTPException(403, "Account suspended. Please contact an administrator.")

    if user.status == "shell":
        raise HTTPException(
            403,
            "Your account has been pre-registered by the university. "
            "Please sign up on the registration page to set your password and activate your account."
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token, user=UserResponse.model_validate(user))


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest, response: Response, db: Session = Depends(get_db)):
    db_status = get_db_status()
    if not db_status["available"]:
        raise HTTPException(status_code=503, detail="Authentication service unavailable: database is not reachable")

    if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID == "GOOGLE_CLIENT_ID":
        raise HTTPException(400, "Google OAuth is not configured on this server.")
    try:
        user_info = await exchange_google_code(payload.code)
    except Exception as e:
        raise HTTPException(400, f"Google authentication failed: {e}")

    google_id = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name", email)
    avatar = user_info.get("picture")

    if not email:
        raise HTTPException(400, "Could not retrieve email from Google")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        if not user.google_id:
            user.google_id = google_id
        if avatar and not user.avatar_url:
            user.avatar_url = avatar
        db.commit()
        db.refresh(user)
    else:
        user = User(
            email=email, full_name=name, google_id=google_id,
            avatar_url=avatar, role="intern", status="pending",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if user.status == "suspended":
        raise HTTPException(403, "Account suspended")

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token, user=UserResponse.model_validate(user))


# ── Logout / Me / Refresh ─────────────────────────────────────────────────────

@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user)):
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    db_status = get_db_status()
    if not db_status["available"]:
        raise HTTPException(status_code=503, detail="Authentication service unavailable: database is not reachable")

    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid or expired refresh token")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user or user.status == "suspended":
        raise HTTPException(401, "User not found or suspended")

    new_access = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    _set_refresh_cookie(response, new_refresh)
    return TokenResponse(access_token=new_access, user=UserResponse.model_validate(user))


# ── Profile Management ────────────────────────────────────────────────────────

@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.email and payload.email != current_user.email:
        if db.query(User).filter(User.email == payload.email, User.id != current_user.id).first():
            raise HTTPException(409, "Email already in use by another account")
        current_user.email = payload.email
    if payload.full_name:
        current_user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        current_user.phone = payload.phone.strip() or None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/profile/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(400, "Only JPEG, PNG, or WebP images are allowed")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Avatar must be ≤ 5MB")

    os.makedirs(AVATAR_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{_uuid.uuid4()}.{ext}"
    file_path = os.path.join(AVATAR_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    if current_user.avatar_path and os.path.exists(current_user.avatar_path):
        try:
            os.remove(current_user.avatar_path)
        except Exception:
            pass

    current_user.avatar_path = file_path
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/profile/change-password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.password_hash:
        raise HTTPException(400, "Password change is not available for Google-only accounts")
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ── Password Reset ────────────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(request: Request, db: Session = Depends(get_db)):
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    email = body.get("email", "").strip().lower()
    if not email:
        return {"message": "If that email is registered, a reset link has been sent."}

    user = db.query(User).filter(User.email == email).first()
    if user and user.password_hash:
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
        ).update({"used": True})

        token_value = secrets.token_urlsafe(32)
        reset_record = PasswordResetToken(
            user_id=user.id,
            token=token_value,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        db.add(reset_record)
        db.commit()

        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token_value}"
        send_email(
            to_email=user.email,
            subject="Reset Your InteLog Password",
            html_body=f"""<html><body style="font-family:Arial,sans-serif">
              <h2>Password Reset</h2><p>Hi {user.full_name},</p>
              <p>Click below to reset your password (expires in 30 minutes):</p>
              <a href="{reset_url}" style="background:#2E7D32;color:white;padding:12px 24px;
                 text-decoration:none;border-radius:6px;display:inline-block">Reset Password</a>
              <p style="color:#999;font-size:12px;margin-top:16px">{reset_url}</p>
            </body></html>""",
            text_body=f"Hi {user.full_name},\n\nReset link (30 min):\n{reset_url}",
        )
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: Request, db: Session = Depends(get_db)):
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    token_value = body.get("token", "").strip()
    new_password = body.get("new_password", "")

    if not token_value or not new_password:
        raise HTTPException(400, "Token and new password are required")

    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token_value,
        PasswordResetToken.used == False,
    ).first()

    if not record:
        raise HTTPException(400, "Invalid or expired reset link")

    if datetime.now(timezone.utc) > record.expires_at:
        record.used = True
        db.commit()
        raise HTTPException(400, "Reset link has expired. Please request a new one.")

    import re
    if len(new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not re.search(r"[A-Z]", new_password):
        raise HTTPException(400, "Password must contain at least one uppercase letter")
    if not re.search(r"\d", new_password):
        raise HTTPException(400, "Password must contain at least one number")
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};':\"\\|,.<>/?`~]", new_password):
        raise HTTPException(400, "Password must contain at least one special character")

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.password_hash = hash_password(new_password)
    record.used = True
    db.commit()
    return {"message": "Password reset successfully. You can now log in."}
