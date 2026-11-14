"""
models.py - SQLAlchemy ORM models
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Text,
    DateTime, Date, ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.database import Base


def _now():
    return datetime.now(timezone.utc)


# ── Institutions ───────────────────────────────────────────────────────────────

class Institution(Base):
    __tablename__ = "institutions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), default=_now)


# ── Users ──────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email            = Column(String(255), unique=True, nullable=False, index=True)
    password_hash    = Column(String(255), nullable=True)
    full_name        = Column(String(255), nullable=False)
    phone            = Column(String(20), nullable=True)
    role             = Column(String(20), nullable=False, default="intern")   # super_admin|system_admin|admin|lecturer|supervisor|intern
    status           = Column(String(20), nullable=False, default="pending")  # pending|active|suspended|waiting
    google_id        = Column(String(255), unique=True, nullable=True)
    avatar_url       = Column(Text, nullable=True)
    avatar_path      = Column(Text, nullable=True)
    supervisor_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    student_id       = Column(String(50), nullable=True, index=True)
    student_id_status= Column(String(20), default="unlinked")  # unlinked|linked|waiting
    school           = Column(String(100), nullable=True)
    department       = Column(String(100), nullable=True)
    is_coordinator   = Column(Boolean, default=False, nullable=False)
    institution_id   = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True)

    # ── Attachment period (interns only) ─────────────────────────
    attachment_start   = Column(Date, nullable=True)
    attachment_end     = Column(Date, nullable=True)
    date_change_count  = Column(Integer, nullable=False, default=0)  # max 3 self-changes

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    # Relationships
    institution      = relationship("Institution")
    supervisor       = relationship("User", remote_side="User.id", foreign_keys=[supervisor_id])
    logbook_entries  = relationship("LogbookEntry", back_populates="intern",  foreign_keys="LogbookEntry.intern_id")
    supervised_logs  = relationship("LogbookEntry", back_populates="supervisor", foreign_keys="LogbookEntry.supervisor_id")
    geofence         = relationship("SupervisorGeofence", back_populates="supervisor", uselist=False, cascade="all, delete-orphan")
    geofence_repin_logs = relationship("GeofenceRepinLog", back_populates="supervisor", cascade="all, delete-orphan")
    notifications    = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    absence_requests = relationship("AbsenceRequest", back_populates="intern",
                                    foreign_keys="AbsenceRequest.intern_id", cascade="all, delete-orphan")
    assigned_interns = relationship("LecturerInternAssignment", back_populates="lecturer",
                                    foreign_keys="LecturerInternAssignment.lecturer_id", cascade="all, delete-orphan")
    lecturer_assignment = relationship("LecturerInternAssignment", back_populates="intern",
                                       foreign_keys="LecturerInternAssignment.intern_id", uselist=False)
    attendance_records = relationship("AttendanceRecord", back_populates="intern",
                                      foreign_keys="AttendanceRecord.intern_id", cascade="all, delete-orphan")
    weekly_summaries   = relationship("WeeklySummary", back_populates="intern",
                                      foreign_keys="WeeklySummary.intern_id", cascade="all, delete-orphan")


# ── Lecturer ↔ Intern assignment ───────────────────────────────────────────────

class LecturerInternAssignment(Base):
    __tablename__ = "lecturer_intern_assignments"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecturer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    intern_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), default=_now)

    lecturer        = relationship("User", back_populates="assigned_interns", foreign_keys=[lecturer_id])
    intern          = relationship("User", back_populates="lecturer_assignment", foreign_keys=[intern_id])
    assigned_by_user= relationship("User", foreign_keys=[assigned_by])


# ── Logbook ────────────────────────────────────────────────────────────────────

class LogbookEntry(Base):
    __tablename__ = "logbook_entries"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_id            = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    supervisor_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entry_date           = Column(Date, nullable=False)
    activities_performed = Column(Text, nullable=False)
    solutions_offered    = Column(Text, nullable=False)
    problems_encountered = Column(Text, nullable=True)
    lessons_learned      = Column(Text, nullable=True)
    supervisor_comments  = Column(Text, nullable=True)
    solutions_scrubbed   = Column(Text, nullable=True)
    latitude             = Column(Float, nullable=True)
    longitude            = Column(Float, nullable=True)
    is_onsite            = Column(Boolean, default=False)
    submitted_on_non_working_day = Column(Boolean, default=False)
    status               = Column(String(20), nullable=False, default="draft")  # draft|pending_approval|approved|rejected
    is_flagged           = Column(Boolean, default=False)
    flag_reason          = Column(Text, nullable=True)
    # ML Classification
    ai_classification    = Column(String(50), nullable=True)
    ai_confidence        = Column(Float, nullable=True)
    ai_feedback          = Column(Text, nullable=True)

    submitted_at         = Column(DateTime(timezone=True), nullable=True)
    approved_at          = Column(DateTime(timezone=True), nullable=True)
    created_at           = Column(DateTime(timezone=True), default=_now)

    intern     = relationship("User", back_populates="logbook_entries", foreign_keys=[intern_id])
    supervisor = relationship("User", back_populates="supervised_logs",  foreign_keys=[supervisor_id])
    images     = relationship("LogImage", back_populates="log_entry", cascade="all, delete-orphan")


class LogImage(Base):
    __tablename__ = "log_images"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    log_id            = Column(UUID(as_uuid=True), ForeignKey("logbook_entries.id", ondelete="CASCADE"), nullable=False)
    file_path         = Column(Text, nullable=False)
    original_filename = Column(String(255), nullable=True)
    file_size         = Column(Integer, nullable=True)
    uploaded_at       = Column(DateTime(timezone=True), default=_now)

    log_entry = relationship("LogbookEntry", back_populates="images")


# ── Absence Requests ───────────────────────────────────────────────────────────

class AbsenceRequest(Base):
    __tablename__ = "absence_requests"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date            = Column(Date, nullable=False)
    type            = Column(String(20), nullable=False)   # sick|day_off|emergency|half_day
    reason          = Column(Text, nullable=False)
    status          = Column(String(20), nullable=False, default="pending")  # pending|acknowledged|rejected
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (UniqueConstraint("intern_id", "date", name="uq_absence_intern_date"),)

    intern          = relationship("User", back_populates="absence_requests", foreign_keys=[intern_id])
    acknowledged_by_user = relationship("User", foreign_keys=[acknowledged_by])


# ── Non-Working Days ───────────────────────────────────────────────────────────

class NonWorkingDay(Base):
    __tablename__ = "non_working_days"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date       = Column(Date, nullable=False, unique=True)
    type       = Column(String(20), nullable=False, default="public_holiday")  # public_holiday|custom
    name       = Column(String(255), nullable=False)
    year       = Column(Integer, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)


# ── Geofence ───────────────────────────────────────────────────────────────────

class SupervisorGeofence(Base):
    __tablename__ = "supervisor_geofences"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    name          = Column(String(255), nullable=False)
    latitude      = Column(Float, nullable=False)
    longitude     = Column(Float, nullable=False)
    radius_meters = Column(Integer, nullable=False, default=200)
    is_active     = Column(Boolean, default=True)
    pinned_at     = Column(DateTime(timezone=True), default=_now)

    supervisor = relationship("User", back_populates="geofence")


class GeofenceRepinLog(Base):
    __tablename__ = "geofence_repin_logs"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    old_latitude  = Column(Float, nullable=True)
    old_longitude = Column(Float, nullable=True)
    new_latitude  = Column(Float, nullable=False)
    new_longitude = Column(Float, nullable=False)
    reason        = Column(Text, nullable=False)
    created_at    = Column(DateTime(timezone=True), default=_now)

    supervisor = relationship("User", back_populates="geofence_repin_logs")


# ── Notifications ──────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type      = Column(String(50), nullable=False)
    title     = Column(String(255), nullable=False)
    body      = Column(Text, nullable=False)
    link_id   = Column(UUID(as_uuid=True), nullable=True)
    link_type = Column(String(50), nullable=True)
    is_read   = Column(Boolean, default=False)
    created_at= Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="notifications")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token      = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_now)

# ── Weekly Summary ─────────────────────────────────────────────────────────────

class WeeklySummary(Base):
    __tablename__ = "weekly_summaries"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_id           = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    supervisor_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    week_start_date     = Column(Date, nullable=False)
    week_end_date       = Column(Date, nullable=False)
    summary_text        = Column(Text, nullable=False)
    supervisor_feedback = Column(Text, nullable=True)
    supervisor_grade    = Column(Integer, nullable=True)
    status              = Column(String(20), nullable=False, default="draft")  # draft|pending|approved|rejected
    
    submitted_at        = Column(DateTime(timezone=True), nullable=True)
    reviewed_at         = Column(DateTime(timezone=True), nullable=True)
    created_at          = Column(DateTime(timezone=True), default=_now)

    intern     = relationship("User", back_populates="weekly_summaries", foreign_keys=[intern_id])
    supervisor = relationship("User", foreign_keys=[supervisor_id])

# ── Attendance (Clock In/Out) ──────────────────────────────────────────────────

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intern_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date               = Column(Date, nullable=False)
    clock_in_time      = Column(DateTime(timezone=True), nullable=True)
    clock_out_time     = Column(DateTime(timezone=True), nullable=True)
    clock_in_location  = Column(Text, nullable=True) # json string of lat/long
    clock_out_location = Column(Text, nullable=True) # json string of lat/long
    clock_in_count     = Column(Integer, default=0, nullable=False)  # max 3 clock-ins per day
    is_onsite          = Column(Boolean, default=False, nullable=False)
    created_at         = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (UniqueConstraint("intern_id", "date", name="uq_attendance_intern_date"),)

    intern = relationship("User", back_populates="attendance_records", foreign_keys=[intern_id])
