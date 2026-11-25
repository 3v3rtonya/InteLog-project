"""
email_service.py - SMTP email sender with background thread dispatch.

- All sends run in a daemon thread (fire-and-forget) so the API never
  blocks waiting for the mail server. Typical Gmail delivery is 2-10s.
- Falls back to console print when SMTP credentials are not configured.
"""
import smtplib
import logging
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from backend.config import settings

logger = logging.getLogger(__name__)

#  DeKUT brand colours 
_RED   = '#CC0000'
_GOLD  = '#FFD700'
_GREEN = '#006633'
_BG    = '#f9f9f9'


# ==============================================================================
# Layout helpers
# ==============================================================================

def _header() -> str:
    return f"""
    <div style="background:linear-gradient(135deg,{_GREEN} 0%,{_RED} 60%,{_GOLD} 100%);
                padding:24px 20px;border-radius:8px 8px 0 0;text-align:center">
      <h1 style="color:white;margin:0;font-size:22px;letter-spacing:1px">InteLog MIS</h1>
      <p style="color:#FFE680;margin:4px 0 0;font-size:13px">
        Intern Management Information System &nbsp;|&nbsp;
        Dedan Kimathi University of Technology
      </p>
    </div>
    """


def _footer() -> str:
    return f"""
    <div style="background:#222;color:#aaa;padding:14px 20px;border-radius:0 0 8px 8px;
                text-align:center;font-size:12px">
      This is an automated message from InteLog MIS -- do not reply.<br>
      (c) Dedan Kimathi University of Technology &nbsp;.&nbsp;
      <a href="{settings.FRONTEND_URL}" style="color:{_GOLD}">InteLog Portal</a>
    </div>
    """


def _wrap(body_html: str) -> str:
    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;
                 background:#e8e8e8;padding:20px">
      <div style="border-radius:8px;overflow:hidden;
                  box-shadow:0 4px 16px rgba(0,0,0,0.15)">
        {_header()}
        <div style="padding:30px 28px;background:{_BG}">
          {body_html}
        </div>
        {_footer()}
      </div>
    </body>
    </html>
    """


# ==============================================================================
# Core send -- synchronous (called from background thread)
# ==============================================================================

def _console_fallback(to_email: str, subject: str, text_body: str) -> None:
    sep = "=" * 65
    print(f"\n{sep}")
    print(f"  EMAIL  (SMTP not configured -- console fallback)")
    print(f"  To      : {to_email}")
    print(f"  Subject : {subject}")
    print(f"  Body    :\n{text_body}")
    print(f"{sep}\n")


def _send_sync(to_email: str, subject: str, html_body: str,
               text_body: Optional[str] = None) -> bool:
    """
    Synchronous send -- executed inside a daemon thread.
    Do NOT call this directly from a request handler.
    """
    smtp_user = (settings.SMTP_USER or "").strip()
    smtp_pass = (settings.SMTP_PASSWORD or "").strip()

    if not smtp_user or not smtp_pass or smtp_user == "your-email@gmail.com":
        _console_fallback(to_email, subject, text_body or html_body)
        return True

    from_addr = settings.SMTP_FROM if settings.SMTP_FROM != "noreply@mis.local" else smtp_user

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"InteLog MIS <{from_addr}>"
        msg["To"]      = to_email

        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_addr, [to_email], msg.as_string())

        logger.info("Email sent  to=%s  subject=%s", to_email, subject)
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "SMTP auth failed for %s. "
            "Use a Gmail App Password from https://myaccount.google.com/apppasswords",
            smtp_user,
        )
        _console_fallback(to_email, subject, text_body or html_body)
        return False
    except Exception as exc:
        logger.error("Email send failed  to=%s  error=%s", to_email, exc)
        _console_fallback(to_email, subject, text_body or html_body)
        return False


def send_email(to_email: str, subject: str, html_body: str,
               text_body: Optional[str] = None) -> None:
    """
    Fire-and-forget email dispatch via a daemon thread.
    Returns immediately -- the API response is never held up by SMTP.
    """
    t = threading.Thread(
        target=_send_sync,
        args=(to_email, subject, html_body, text_body),
        daemon=True,
        name=f"email-{to_email[:20]}",
    )
    t.start()


# ==============================================================================
# Email templates
# ==============================================================================

def send_welcome_email(user_email: str, user_name: str, role: str) -> None:
    """
    Sent immediately when an intern or supervisor self-registers.
    Tells them their account is pending approval.
    """
    role_label = {"intern": "Intern", "supervisor": "Industry Supervisor", "lecturer": "Lecturer"}.get(role, role.capitalize())
    html = _wrap(f"""
        <h2 style="color:{_GREEN};margin-top:0">Welcome to InteLog MIS, {user_name}! </h2>
        <p>Your <strong>{role_label}</strong> account has been successfully created.</p>

        <div style="background:#FFF8CC;padding:14px 16px;border-left:4px solid {_GOLD};
                    border-radius:4px;margin:16px 0">
           Your account is currently <strong>pending approval</strong> from the
          university administrator. You will receive a separate email once your
          account is activated.
        </div>

        <p style="color:#555">While you wait:</p>
        <ul style="color:#555;line-height:1.8">
          <li>Confirm that the <strong>Student ID</strong> you registered with is correct.</li>
          <li>Make sure your industry supervisor (or intern) registers with the same Student ID
              so the system can link your accounts automatically.</li>
        </ul>

        <a href="{settings.FRONTEND_URL}/login"
           style="background:{_RED};color:white;padding:12px 28px;text-decoration:none;
                  border-radius:6px;display:inline-block;margin-top:12px;font-weight:bold">
          Go to Login 
        </a>
    """)
    text = (
        f"Welcome to InteLog MIS, {user_name}!\n\n"
        f"Your {role_label} account has been created and is pending approval.\n"
        f"You will receive another email once your account is activated.\n\n"
        f"Login: {settings.FRONTEND_URL}/login"
    )
    send_email(user_email, "Welcome to InteLog MIS - Account Created", html, text)

def send_approval_email(user_email: str, user_name: str,
                        role: str = "intern") -> None:
    """Sent when a lecturer approves an intern/supervisor pairing."""
    role_label = {"intern": "Intern", "supervisor": "Industry Supervisor", "lecturer": "Lecturer"}.get(role, role.capitalize())
    html = _wrap(f"""
        <h2 style="color:{_GREEN};margin-top:0">Account Approved! </h2>
        <p>Dear <strong>{user_name}</strong>,</p>
        <p>Your <strong>{role_label}</strong> account on InteLog MIS has been
        <strong style="color:{_GREEN}">approved and activated</strong>
        by the university lecturer.</p>
        <p>You can now log in and access your dashboard:</p>
        <ul style="color:#555;line-height:1.8">
          <li><strong>Interns:</strong> Start submitting your daily logbook entries</li>
          <li><strong>Supervisors:</strong> Review and approve your intern's logs</li>
        </ul>
        <a href="{settings.FRONTEND_URL}/login"
           style="background:{_GREEN};color:white;padding:12px 28px;text-decoration:none;
                  border-radius:6px;display:inline-block;margin-top:12px;font-weight:bold">
          Log In Now 
        </a>
    """)
    text = (
        f"Hi {user_name},\n\n"
        f"Your {role_label} account has been approved and activated!\n"
        f"Log in at: {settings.FRONTEND_URL}/login"
    )
    send_email(user_email, "InteLog MIS - Your Account is Now Active", html, text)


def send_login_notification(user_email: str, user_name: str,
                             role: str, login_time: str) -> None:
    """Security login alert -- not currently wired (optional)."""
    role_label = role.capitalize()
    html = _wrap(f"""
        <h2 style="color:{_RED};margin-top:0">New Login Detected </h2>
        <p>Dear <strong>{user_name}</strong>,</p>
        <p>A new login was detected on your <strong>{role_label}</strong> account:</p>
        <table style="background:#fff;border:1px solid #ddd;border-radius:6px;
                      width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 14px;font-weight:bold;color:#555">Time</td>
            <td style="padding:8px 14px;color:#222">{login_time}</td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:8px 14px;font-weight:bold;color:#555">Account</td>
            <td style="padding:8px 14px;color:#222">{user_email}</td>
          </tr>
        </table>
        <div style="background:#FFEBEE;padding:12px 16px;border-left:4px solid {_RED};
                    border-radius:4px;margin-top:16px;color:#555">
           If this wasn't you, reset your password immediately using the
          <a href="{settings.FRONTEND_URL}/login" style="color:{_RED}">Forgot Password</a> link.
        </div>
    """)
    text = (
        f"Hi {user_name},\n\n"
        f"New login detected on your {role_label} account at {login_time}.\n"
        f"If this wasn't you, reset your password at: {settings.FRONTEND_URL}/login"
    )
    send_email(user_email, "InteLog MIS - New Login to Your Account", html, text)


def send_otp_email(supervisor_email: str, supervisor_name: str,
                   otp: str, log_date: str) -> None:
    """Legacy -- not used in v2.0."""
    pass
