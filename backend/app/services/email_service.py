"""
app/services/email_service.py
SMTP email service using Python's smtplib.
Sends HTML-formatted alert notification emails with retry logic and delivery logging.
"""
from __future__ import annotations
import smtplib
import ssl
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

SEVERITY_COLORS = {
    "critical": "#DC2626",
    "warning":  "#D97706",
    "info":     "#2563EB",
}
SEVERITY_ICONS = {
    "critical": "🔴",
    "warning":  "⚠️",
    "info":     "ℹ️",
}

_config_warn_logged = False


class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.sender_name = "Enterprise Ops Intelligence"
        self.logger = get_logger(__name__)
        self._is_configured = all([self.smtp_host, self.smtp_user, self.smtp_password])

    def _is_email_configured(self) -> bool:
        global _config_warn_logged
        if not self._is_configured and not _config_warn_logged:
            logger.warning("Email not configured — set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env")
            _config_warn_logged = True
        return self._is_configured

    def _build_alert_html(
        self,
        title: str,
        message: str,
        severity: str,
        alert_type: str,
        metric_value: float | None,
        threshold_value: float | None,
        triggered_at: datetime,
        platform_url: str = "http://localhost:5173",
    ) -> str:
        color = SEVERITY_COLORS.get(severity, "#2563EB")
        icon = SEVERITY_ICONS.get(severity, "ℹ️")
        label = severity.upper()
        ts = triggered_at.strftime("%B %d, %Y at %I:%M %p UTC")

        metric_html = ""
        if metric_value is not None:
            metric_html = f"""
            <tr>
              <td style="padding:12px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%" style="font-size:12px;color:#64748B;font-family:Arial,sans-serif;">Measured Value</td>
                    <td width="50%" style="font-size:12px;color:#64748B;font-family:Arial,sans-serif;">Threshold</td>
                  </tr>
                  <tr>
                    <td style="font-size:22px;font-weight:bold;color:{color};font-family:Arial,sans-serif;">{metric_value}</td>
                    <td style="font-size:22px;font-weight:bold;color:#94A3B8;font-family:Arial,sans-serif;">{threshold_value}</td>
                  </tr>
                </table>
              </td>
            </tr>"""

        return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#FFFFFF;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:{color};padding:20px 24px;">
            <table width="100%"><tr>
              <td><span style="font-size:22px;">{icon}</span>
                <span style="color:white;font-size:18px;font-weight:bold;margin-left:8px;">{label} ALERT</span></td>
              <td align="right"><span style="color:rgba(255,255,255,0.8);font-size:12px;">Enterprise Ops Intelligence</span></td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:24px 24px 16px;">
          <h2 style="margin:0;font-size:20px;color:#0F172A;font-family:Arial,sans-serif;">{title}</h2>
          <p style="margin:8px 0 0;font-size:14px;color:#64748B;font-family:Arial,sans-serif;">{ts}</p>
        </td></tr>
        <tr><td style="padding:0 24px 16px;">
          <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;font-family:Arial,sans-serif;">{message}</p>
        </td></tr>
        {metric_html}
        <tr><td style="padding:20px 24px;">
          <a href="{platform_url}/alerts" style="display:inline-block;background:{color};color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;">
            View Alert in Platform →
          </a>
        </td></tr>
        <tr><td style="padding:0 24px;"><hr style="border:none;border-top:1px solid #E2E8F0;margin:0;"></td></tr>
        <tr><td style="padding:16px 24px;background:#F8FAFC;">
          <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;font-family:Arial,sans-serif;">
            This alert was sent by the Enterprise Operations Intelligence Platform.<br>
            Alert Type: {alert_type} | You are receiving this because of your role.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    def _send_smtp(self, to_email: str, to_name: str, subject: str, html_body: str, priority: str = "3") -> bool:
        if not self._is_email_configured():
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = formataddr((self.sender_name, self.smtp_user))
            msg["To"] = formataddr((to_name or to_email, to_email))
            msg["X-Priority"] = priority
            text_body = f"{subject}\n\nPlease view this email in an HTML-capable client.\n"
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_host, int(self.smtp_port), timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.smtp_user, to_email, msg.as_string())
            logger.info("Email sent to %s: %s", to_email, subject)
            return True
        except smtplib.SMTPAuthenticationError:
            logger.error("SMTP auth failed — check SMTP_USER / SMTP_PASSWORD")
            return False
        except smtplib.SMTPConnectError:
            logger.error("Cannot connect to SMTP %s:%s", self.smtp_host, self.smtp_port)
            return False
        except Exception as exc:
            logger.error("Email send failed to %s: %s", to_email, exc)
            return False

    def send_alert_email(self, db: Session, alert, recipients: list[tuple[str, str]]) -> list:
        from app.models.alert import NotificationLog
        html_body = self._build_alert_html(
            title=alert.title, message=alert.message, severity=alert.severity,
            alert_type=alert.alert_type,
            metric_value=float(alert.metric_value) if alert.metric_value is not None else None,
            threshold_value=float(alert.threshold_value) if alert.threshold_value is not None else None,
            triggered_at=alert.triggered_at or datetime.utcnow(),
        )
        subject = f"[{alert.severity.upper()}] {alert.title}"[:255]
        priority = "1" if alert.severity == "critical" else "3"
        log_records = []
        for email, name in recipients:
            log = NotificationLog(
                alert_id=alert.id, recipient_email=email,
                recipient_name=name, subject=subject, delivery_status="pending",
            )
            db.add(log)
            db.flush()
            success = False
            for attempt in range(2):
                success = self._send_smtp(email, name, subject, html_body, priority)
                if success:
                    break
                if not success and attempt == 0:
                    time.sleep(1)
            if success:
                log.delivery_status = "sent"
                log.sent_at = datetime.utcnow()
            else:
                log.delivery_status = "failed"
                log.error_message = "Failed after 2 attempts"
            log_records.append(log)
        alert.email_sent = any(l.delivery_status == "sent" for l in log_records)
        alert.email_sent_at = datetime.utcnow() if alert.email_sent else None
        alert.notified_emails = [r[0] for r in recipients]
        db.commit()
        return log_records

    def send_report_email(self, db: Session, recipients: list[str], subject: str, report_id: str, report_name: str) -> None:
        platform_url = "http://localhost:5173"
        html_body = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#2563EB;padding:20px 24px;">
          <h2 style="margin:0;color:white;font-family:Arial,sans-serif;">📊 Scheduled Report Ready</h2></td></tr>
        <tr><td style="padding:24px;">
          <h3 style="font-family:Arial,sans-serif;color:#0F172A;">{report_name}</h3>
          <p style="font-family:Arial,sans-serif;color:#334155;">Your scheduled report has been generated and is ready for download.</p>
          <a href="{platform_url}/reports" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;">Download Report →</a>
          <p style="color:#94A3B8;font-size:12px;font-family:Arial,sans-serif;">This report will expire in 7 days.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
        for email in recipients:
            self._send_smtp(email, email, subject, html_body)

    def send_test_email(self, recipient_email: str) -> bool:
        html = self._build_alert_html(
            title="Test Alert — Configuration Verified",
            message="This is a test notification from your Enterprise Ops Intelligence Platform. If you received this, your email notifications are working correctly.",
            severity="info", alert_type="system_event",
            metric_value=None, threshold_value=None,
            triggered_at=datetime.utcnow(),
        )
        return self._send_smtp(
            recipient_email, "Platform Administrator",
            "✅ Test Alert — Enterprise Ops Intelligence", html,
        )


email_service = EmailService()
