"""
main.py - FastAPI application entry point
"""
import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.config import settings
from backend.database import get_db_status
from backend.routers import auth, admin, supervisor, intern, geo
from backend.routers import notifications, geofence, lecturer, attendance, holidays, preregister, assess

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(
    title="InteLog MIS API",
    description="Intern Management Information System — DeKUT",
    version="2.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(supervisor.router)
app.include_router(intern.router)
app.include_router(geo.router)
app.include_router(notifications.router)
app.include_router(geofence.router)
app.include_router(lecturer.router)
app.include_router(attendance.router)
app.include_router(holidays.router)
app.include_router(preregister.router)
app.include_router(assess.router)

# Static file serving
upload_dir = settings.UPLOAD_DIR
os.makedirs(upload_dir, exist_ok=True)
os.makedirs(os.path.join(upload_dir, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


@app.get("/health")
def health_check():
    db_status = get_db_status()
    if db_status["available"]:
        return {"status": "ok", "version": "2.0.0", "database": db_status}
    return {"status": "degraded", "version": "2.0.0", "database": db_status}


@app.get("/")
def root():
    return {"message": "InteLog MIS API", "docs": "/docs"}


# ── 48-hour absence flagging background job ───────────────────────────────────

async def _flag_unexplained_absences():
    """
    Runs every 6 hours. Finds interns with no log AND no absence
    for working days that are past the 48-hour grace window,
    and sends a notification to intern + supervisor + lecturer.
    """
    from datetime import date, timedelta
    from sqlalchemy.orm import Session
    from backend.database import SessionLocal
    from backend.models import User, LogbookEntry, AbsenceRequest, Notification, LecturerInternAssignment
    from backend.routers.attendance import _is_non_working, _get_holiday_dates

    while True:
        try:
            await asyncio.sleep(6 * 3600)  # run every 6 hours
            db: Session = SessionLocal()
            today = date.today()
            grace_cutoff = today - timedelta(hours=48)

            active_interns = db.query(User).filter(
                User.role == "intern",
                User.status == "active",
                User.attachment_start.isnot(None),
                User.attachment_end.isnot(None),
                User.attachment_start <= today,
                User.attachment_end >= today,
            ).all()

            for intern in active_interns:
                holiday_dates = _get_holiday_dates(db, today.year)
                # Check the last 3 working days (covers 48h window)
                check_date = today - timedelta(days=1)
                for _ in range(5):
                    if check_date < intern.attachment_start:
                        break
                    if _is_non_working(check_date, holiday_dates):
                        check_date -= timedelta(days=1)
                        continue
                    if check_date > grace_cutoff:
                        check_date -= timedelta(days=1)
                        continue

                    # Working day, past grace window — check for log or absence
                    has_log = db.query(LogbookEntry).filter(
                        LogbookEntry.intern_id == intern.id,
                        LogbookEntry.entry_date == check_date,
                    ).first()
                    has_absence = db.query(AbsenceRequest).filter(
                        AbsenceRequest.intern_id == intern.id,
                        AbsenceRequest.date == check_date,
                    ).first()

                    if not has_log and not has_absence:
                        # Check we haven't already notified for this day
                        already = db.query(Notification).filter(
                            Notification.user_id == intern.id,
                            Notification.type == "unexplained_absence",
                            Notification.body.contains(str(check_date)),
                        ).first()
                        if not already:
                            msg = (
                                f"No logbook entry or absence request was found for "
                                f"{check_date} (a working day). Please submit your logbook "
                                f"entry or an absence request as soon as possible."
                            )
                            db.add(Notification(
                                user_id=intern.id, type="unexplained_absence",
                                title=f"Missing Log — {check_date}",
                                body=msg,
                            ))
                            if intern.supervisor_id:
                                db.add(Notification(
                                    user_id=intern.supervisor_id, type="unexplained_absence",
                                    title=f"Intern Missing Log — {intern.full_name} ({check_date})",
                                    body=f"{intern.full_name} has no logbook entry or absence "
                                         f"request for {check_date}.",
                                ))
                            assignment = db.query(LecturerInternAssignment).filter(
                                LecturerInternAssignment.intern_id == intern.id
                            ).first()
                            if assignment:
                                db.add(Notification(
                                    user_id=assignment.lecturer_id, type="unexplained_absence",
                                    title=f"Intern Missing Log — {intern.full_name} ({check_date})",
                                    body=f"{intern.full_name} ({intern.department}) has no logbook "
                                         f"entry or absence request for {check_date}.",
                                ))

                    check_date -= timedelta(days=1)

            db.commit()
            db.close()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Absence flagging job error: %s", e)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(_flag_unexplained_absences())
