"""
schemas.py - Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, field_validator, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
import re

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_STUDENT_ID_RE = re.compile(r'^[A-Z0-9][A-Z0-9/\-_]{2,19}$', re.IGNORECASE)


def _norm_email(v: str) -> str:
    e = str(v).strip().lower()
    if not e:
        raise ValueError("Email is required")
    if not _EMAIL_RE.match(e):
        raise ValueError("Please enter a valid email address")
    return e


def _strong_password(v: str) -> str:
    p = str(v)
    if len(p) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", p):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"\d", p):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};':\"\\|,.<>/?`~]", p):
        raise ValueError("Password must contain at least one special character")
    return p


#  Auth 

class InternSignupRequest(BaseModel):
    """Intern registration  includes student_id, school, department, phone (required)."""
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str
    email: str
    phone: str          # compulsory for interns
    password: str
    student_id: str
    school: str
    department: str

    @field_validator("email", mode="before")
    @classmethod
    def v_email(cls, v): return _norm_email(v)

    @field_validator("full_name", mode="before")
    @classmethod
    def v_name(cls, v):
        s = str(v).strip()
        if len(s) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return s

    @field_validator("phone", mode="before")
    @classmethod
    def v_phone(cls, v):
        s = str(v).strip()
        if not s:
            raise ValueError("Phone number is required")
        import re
        if not re.match(r'^\+?\d{7,15}$', s):
            raise ValueError("Phone must be 715 digits, optionally starting with +")
        return s

    @field_validator("student_id", mode="before")
    @classmethod
    def v_student_id(cls, v):
        s = str(v).strip().upper()
        if not _STUDENT_ID_RE.match(s):
            raise ValueError(
                "Invalid Student ID. Must be 420 alphanumeric characters (letters, numbers, /, -, _)."
            )
        return s

    @field_validator("school", "department", mode="before")
    @classmethod
    def v_nonempty_str(cls, v):
        s = str(v).strip()
        if not s:
            raise ValueError("This field is required")
        return s

    @field_validator("password", mode="before")
    @classmethod
    def v_password(cls, v): return _strong_password(v)


class SupervisorSignupRequest(BaseModel):
    """Supervisor registration  includes student_id of intern they supervise, school, department."""
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str
    email: str
    phone: Optional[str] = None
    password: str
    student_id: str
    school: Optional[str] = None
    department: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def v_email(cls, v): return _norm_email(v)

    @field_validator("full_name", mode="before")
    @classmethod
    def v_name(cls, v):
        s = str(v).strip()
        if len(s) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return s

    @field_validator("student_id", mode="before")
    @classmethod
    def v_student_id(cls, v):
        s = str(v).strip().upper()
        if not _STUDENT_ID_RE.match(s):
            raise ValueError(
                "Invalid Student ID. Must be 420 alphanumeric characters (letters, numbers, /, -, _)."
            )
        return s


    @field_validator("password", mode="before")
    @classmethod
    def v_password(cls, v): return _strong_password(v)



class LecturerSignupRequest(BaseModel):
    """Lecturer self-registration - school and department required."""
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str
    email: str
    phone: Optional[str] = None
    password: str
    school: Optional[str] = None
    department: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def v_email(cls, v): return _norm_email(v)

    @field_validator("full_name", mode="before")
    @classmethod
    def v_name(cls, v):
        s = str(v).strip()
        if len(s) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return s


    @field_validator("password", mode="before")
    @classmethod
    def v_password(cls, v): return _strong_password(v)

class SignupRequest(BaseModel):
    """Generic signup  used for admin-created accounts."""
    model_config = ConfigDict(str_strip_whitespace=True)
    full_name: str
    email: str
    phone: Optional[str] = None
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def v_email(cls, v): return _norm_email(v)

    @field_validator("full_name", mode="before")
    @classmethod
    def v_name(cls, v):
        s = str(v).strip()
        if len(s) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return s

    @field_validator("password", mode="before")
    @classmethod
    def v_password(cls, v): return _strong_password(v)


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: str
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def v_email(cls, v):
        return str(v).strip().lower()


class GoogleAuthRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


#  Users 

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    status: str
    avatar_url: Optional[str] = None
    avatar_path: Optional[str] = None
    supervisor_id: Optional[UUID] = None
    student_id: Optional[str] = None
    student_id_status: Optional[str] = None
    school: Optional[str] = None
    department: Optional[str] = None
    is_coordinator: bool = False
    created_at: datetime


class UserCreateRequest(BaseModel):
    """Admin creates any account (lecturer, admin, supervisor)."""
    model_config = ConfigDict(str_strip_whitespace=True)
    full_name: str
    email: str
    phone: Optional[str] = None
    password: str
    role: str
    school: Optional[str] = None
    department: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def v_email(cls, v): return _norm_email(v)

    @field_validator("role", mode="before")
    @classmethod
    def v_role(cls, v):
        if str(v) not in ("supervisor", "admin", "lecturer"):
            raise ValueError("Role must be 'supervisor', 'lecturer', or 'admin'")
        return str(v)

    @field_validator("password", mode="before")
    @classmethod
    def v_password(cls, v):
        if len(str(v)) < 8:
            raise ValueError("Password must be at least 8 characters")
        return str(v)

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    supervisor_id: Optional[UUID] = None
    school: Optional[str] = None
    department: Optional[str] = None

    @field_validator("role", mode="before")
    @classmethod
    def v_role(cls, v):
        if v is not None and str(v) not in ("intern", "supervisor", "admin", "lecturer"):
            raise ValueError("Invalid role")
        return v

    @field_validator("status", mode="before")
    @classmethod
    def v_status(cls, v):
        if v is not None and str(v) not in ("pending", "active", "suspended", "waiting", "shell"):
            raise ValueError("Invalid status")
        return v


class ProfileUpdateRequest(BaseModel):
    """Self-service profile update."""
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def v_email(cls, v):
        if v is None:
            return v
        return _norm_email(v)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password", mode="before")
    @classmethod
    def v_password(cls, v): return _strong_password(v)


class RepairLinkRequest(BaseModel):
    intern_id: UUID
    supervisor_id: UUID


class ApproveInternRequest(BaseModel):
    """Used by lecturer to approve an intern/supervisor pairing."""
    intern_id: UUID
    supervisor_id: Optional[UUID] = None


class AssignInternRequest(BaseModel):
    """Admin assigns an intern to a lecturer."""
    intern_id: UUID
    lecturer_id: UUID


class BulkAssignInternRequest(BaseModel):
    """Admin bulk-assigns multiple interns to a lecturer."""
    intern_ids: List[UUID]
    lecturer_id: UUID


#  Logbook 

class LogbookBase(BaseModel):
    entry_date: date
    activities_performed: str = Field(..., min_length=10)
    solutions_offered: str = Field(..., min_length=10)
    problems_encountered: Optional[str] = None
    lessons_learned: Optional[str] = None

class LogbookCreate(LogbookBase):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    status: str = "draft"
    is_onsite: Optional[bool] = False
    ai_classification: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_feedback: Optional[str] = None

    @field_validator("activities_performed", "solutions_offered", mode="before")
    @classmethod
    def v_nonempty(cls, v):
        s = str(v).strip()
        if not s:
            raise ValueError("Field cannot be empty")
        return s

    @field_validator("status", mode="before")
    @classmethod
    def v_status(cls, v):
        if str(v) not in ("draft", "pending_approval"):
            raise ValueError("Status must be 'draft' or 'pending_approval'")
        return str(v)


class LogUpdateRequest(BaseModel):
    entry_date: Optional[date] = None
    activities_performed: Optional[str] = None
    solutions_offered: Optional[str] = None
    problems_encountered: Optional[str] = None
    lessons_learned: Optional[str] = None
    supervisor_comments: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    status: Optional[str] = None
    ai_classification: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_feedback: Optional[str] = None

    @field_validator("status", mode="before")
    @classmethod
    def v_status(cls, v):
        if v is not None and str(v) not in ("draft", "pending_approval"):
            raise ValueError("Status must be 'draft' or 'pending_approval'")
        return v


class ImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    log_id: UUID
    file_path: str
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: datetime


class LogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    intern_id: UUID
    supervisor_id: Optional[UUID] = None
    entry_date: date
    activities_performed: str
    solutions_offered: str
    problems_encountered: Optional[str] = None
    lessons_learned: Optional[str] = None
    supervisor_comments: Optional[str] = None
    solutions_scrubbed: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_onsite: bool
    status: str
    is_flagged: bool
    flag_reason: Optional[str] = None
    ai_classification: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    images: List[ImageResponse] = []
    intern: Optional[UserResponse] = None


class RejectLogRequest(BaseModel):
    reason: str

    @field_validator("reason", mode="before")
    @classmethod
    def v_reason(cls, v):
        s = str(v).strip()
        if not s:
            raise ValueError("Rejection reason cannot be empty")
        return s


#  Lecturer assignment response 

class LecturerInternAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    lecturer_id: UUID
    intern_id: UUID
    assigned_by: Optional[UUID] = None
    assigned_at: datetime
    intern: Optional[UserResponse] = None


#  Geofence 

class GeofencePinRequest(BaseModel):
    """Supervisor pins or re-pins their office location."""
    name: str
    latitude: float
    longitude: float
    radius_meters: int = 200
    reason: Optional[str] = None  # required only on re-pin


class GeofenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    supervisor_id: UUID
    name: str
    latitude: float
    longitude: float
    radius_meters: int
    is_active: bool
    pinned_at: datetime


class GeoValidateRequest(BaseModel):
    latitude: float
    longitude: float


class GeoValidateResponse(BaseModel):
    is_onsite: bool
    nearest_site: Optional[str] = None
    distance_m: Optional[float] = None
    message: str


#  Notifications 

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    type: str
    title: str
    body: str
    link_id: Optional[UUID] = None
    link_type: Optional[str] = None
    is_read: bool
    created_at: datetime


#  Pagination 

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


#  Attachment period 

class AttachmentDatesRequest(BaseModel):
    attachment_start: date
    attachment_end: date

    @field_validator("attachment_end", mode="after")
    @classmethod
    def v_end_after_start(cls, v, info):
        if hasattr(info, "data") and "attachment_start" in info.data:
            if v <= info.data["attachment_start"]:
                raise ValueError("End date must be after start date")
        return v


class AttachmentDatesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    attachment_start: Optional[date] = None
    attachment_end: Optional[date] = None
    date_change_count: int = 0
    changes_remaining: int = 3


#  Absence requests 

class AbsenceRequestCreate(BaseModel):
    date: date
    type: str
    reason: str

    @field_validator("type", mode="before")
    @classmethod
    def v_type(cls, v):
        allowed = {"sick", "day_off", "emergency", "half_day"}
        if str(v) not in allowed:
            raise ValueError(f"Type must be one of: {', '.join(allowed)}")
        return str(v)

    @field_validator("reason", mode="before")
    @classmethod
    def v_reason(cls, v):
        s = str(v).strip()
        if len(s) < 5:
            raise ValueError("Please provide a reason (at least 5 characters)")
        return s


class AbsenceRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    intern_id: UUID
    date: date
    type: str
    reason: str
    status: str
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime
    intern: Optional["UserResponse"] = None


#  Non-working days 

class NonWorkingDayCreate(BaseModel):
    date: date
    name: str
    type: str = "public_holiday"

    @field_validator("type", mode="before")
    @classmethod
    def v_type(cls, v):
        if str(v) not in ("public_holiday", "custom"):
            raise ValueError("Type must be 'public_holiday' or 'custom'")
        return str(v)

    @field_validator("name", mode="before")
    @classmethod
    def v_name(cls, v):
        s = str(v).strip()
        if not s:
            raise ValueError("Holiday name is required")
        return s


class NonWorkingDayRangeCreate(BaseModel):
    """Create a range of consecutive non-working days (e.g. Easter break)."""
    start_date: date
    end_date: date
    name: str
    type: str = "custom"

    @field_validator("end_date", mode="before")
    @classmethod
    def v_end(cls, v, info):
        if hasattr(info, "data") and "start_date" in info.data:
            if v < info.data["start_date"]:
                raise ValueError("End date must be on or after start date")
        return v


class NonWorkingDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    date: date
    type: str
    name: str
    year: int
    created_at: datetime


#  Attendance stats 

class DayStatus(BaseModel):
    """Status of a single calendar day for the heatmap."""
    date: date
    status: str   # present|approved|pending|absent_sick|absent_day_off|absent_emergency|absent_half_day|unexplained|holiday|weekend|future|outside_period

class AttendanceStats(BaseModel):
    attachment_start: Optional[date]
    attachment_end:   Optional[date]
    total_working_days: int
    present:           int   # log submitted (any status)
    approved:          int
    pending:           int
    absent_sick:       int
    absent_day_off:    int
    absent_emergency:  int
    absent_half_day:   int
    unexplained:       int   # working day, no log, no absence, past 48h grace
    within_grace:      int   # working day, no log, no absence, still within 48h
    non_working:       int   # weekends + holidays within period
    days_calendar: List[DayStatus] = []


#  Pre-registration (CSV bulk import) 

class PreRegisterRowResult(BaseModel):
    """Result for a single CSV row during bulk import."""
    row: int
    student_id: str
    intern_name: str
    lecturer_email: str
    action: str       # created_intern | merged_intern | skipped_intern | error
    lecturer_action: str  # created_lecturer | existing_lecturer | error
    message: str = ""


class PreRegisterImportResponse(BaseModel):
    """Full response from a bulk pre-registration import."""
    total_rows: int
    interns_created: int
    interns_merged: int    # shell accounts that already existed and were updated
    interns_skipped: int   # rows with errors or duplicate active accounts
    lecturers_created: int
    assignments_created: int
    rows: List[PreRegisterRowResult]


# -- Attendance (Clock In/Out) --------------------------------------------------

class ClockInRequest(BaseModel):
    latitude: float
    longitude: float

class AttendanceRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    intern_id: UUID
    date: date
    clock_in_time: Optional[datetime] = None
    clock_out_time: Optional[datetime] = None
    clock_in_location: Optional[str] = None
    clock_out_location: Optional[str] = None
    is_onsite: bool = False
    clock_in_count: int = 0
    created_at: datetime


# -- Weekly Summary -------------------------------------------------------------

class WeeklySummaryCreate(BaseModel):
    summary_text: str = Field(..., min_length=10)

class WeeklySummaryUpdate(BaseModel):
    summary_text: str = Field(..., min_length=10)

class WeeklySummaryReviewRequest(BaseModel):
    feedback: str
    decision: str  # "approved" or "rejected"
    grade: int     # 0–10 performance grade

    @field_validator("feedback", mode="before")
    @classmethod
    def v_feedback(cls, v):
        s = str(v).strip()
        if not s:
            raise ValueError("Feedback is required")
        return s

    @field_validator("grade", mode="before")
    @classmethod
    def v_grade(cls, v):
        try:
            n = int(v)
        except (TypeError, ValueError):
            raise ValueError("Grade must be an integer")
        if n < 0 or n > 10:
            raise ValueError("Grade must be between 0 and 10")
        return n

    @field_validator("decision", mode="before")
    @classmethod
    def v_decision(cls, v):
        if str(v) not in ("approved", "rejected"):
            raise ValueError("Decision must be 'approved' or 'rejected'")
        return str(v)

class WeeklySummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    intern_id: UUID
    supervisor_id: Optional[UUID] = None
    week_start_date: date
    week_end_date: date
    summary_text: str
    supervisor_feedback: Optional[str] = None
    supervisor_grade: Optional[int] = None
    status: str
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    intern: Optional["UserResponse"] = None
