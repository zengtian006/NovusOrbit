"""
Feedback API Router
Handles user feedback submissions and email notifications
"""

import asyncio
import html
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from src.logging import get_logger
from src.services.user_context import USER_DATA_ROOT

logger = get_logger("API.Feedback")
router = APIRouter()

# Every submission is appended here (on the persistent data volume) before the
# email is attempted, so feedback is never lost if SMTP is down or unset.
FEEDBACK_LOG = USER_DATA_ROOT / "feedback.jsonl"


def _save_feedback(record: dict) -> None:
    try:
        FEEDBACK_LOG.parent.mkdir(parents=True, exist_ok=True)
        with FEEDBACK_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:  # pragma: no cover - disk errors
        logger.error(f"Could not save feedback to {FEEDBACK_LOG}: {e}")


class FeedbackRequest(BaseModel):
    name: str
    email: EmailStr
    message: str
    timestamp: str | None = None


class FeedbackResponse(BaseModel):
    success: bool
    message: str


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(feedback: FeedbackRequest):
    """
    Submit user feedback and send email notification
    
    Args:
        feedback: FeedbackRequest containing name, email, and message
        
    Returns:
        FeedbackResponse with success status and message
    """
    try:
        logger.info(f"Received feedback from {feedback.name} <{feedback.email}>")
        
        # Prepare email content
        timestamp = feedback.timestamp or datetime.now().isoformat()
        _save_feedback(
            {"name": feedback.name, "email": feedback.email, "message": feedback.message, "timestamp": timestamp}
        )

        # Header-safe and HTML-safe versions of user input
        safe_name_header = " ".join(feedback.name.split())[:100]
        name_html = html.escape(feedback.name)
        email_html = html.escape(feedback.email)
        message_html = html.escape(feedback.message)
        timestamp_html = html.escape(timestamp)

        # Create email message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"NovusOrbit Feedback from {safe_name_header}"
        msg["From"] = os.getenv("FEEDBACK_EMAIL_FROM") or os.getenv("SMTP_USER") or "noreply@novusorbit.com"
        msg["To"] = os.getenv("FEEDBACK_EMAIL_TO", "zengtian006@gmail.com")
        msg["Reply-To"] = feedback.email
        
        # Create plain text version
        text_content = f"""
New Feedback Received

From: {feedback.name}
Email: {feedback.email}
Time: {timestamp}

Message:
{feedback.message}

---
This is an automated message from NovusOrbit feedback system.
        """
        
        # Create HTML version
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }}
        .header h1 {{ margin: 0; font-size: 24px; }}
        .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }}
        .info-row {{ margin: 10px 0; }}
        .label {{ font-weight: 600; color: #667eea; display: inline-block; width: 80px; }}
        .message-box {{ background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📬 New Feedback Received</h1>
        </div>
        <div class="content">
            <div class="info-row">
                <span class="label">From:</span> {name_html}
            </div>
            <div class="info-row">
                <span class="label">Email:</span> <a href="mailto:{email_html}">{email_html}</a>
            </div>
            <div class="info-row">
                <span class="label">Time:</span> {timestamp_html}
            </div>
            
            <div class="message-box">
                <h3 style="margin-top: 0; color: #667eea;">Message:</h3>
                <p style="white-space: pre-wrap; margin: 0;">{message_html}</p>
            </div>
        </div>
        <div class="footer">
            This is an automated message from NovusOrbit feedback system.
        </div>
    </div>
</body>
</html>
        """
        
        # Attach both versions
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)
        
        # Try to send email via SMTP
        try:
            # Check if email credentials are configured
            smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER")
            smtp_password = os.getenv("SMTP_PASSWORD")
            
            if smtp_user and smtp_password:
                logger.info(f"Attempting to send email via {smtp_server}:{smtp_port}")
                
                def _send():
                    # 10-second timeout to prevent hanging
                    with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                        server.starttls()
                        server.login(smtp_user, smtp_password)
                        server.send_message(msg)

                # smtplib is blocking; keep it off the event loop
                await asyncio.to_thread(_send)
                    
                logger.info("Email sent successfully")
                return FeedbackResponse(
                    success=True,
                    message="Feedback sent successfully via email"
                )
            else:
                # Fallback: Just log the feedback if email is not configured
                logger.warning("SMTP credentials not configured, logging feedback instead")
                logger.info("=" * 50)
                logger.info("FEEDBACK RECEIVED")
                logger.info(f"From: {feedback.name} <{feedback.email}>")
                logger.info(f"Time: {timestamp}")
                logger.info(f"Message:\n{feedback.message}")
                logger.info("=" * 50)
                
                return FeedbackResponse(
                    success=True,
                    message="Feedback received and logged"
                )
                
        except Exception as email_error:
            logger.error(f"Failed to send email: {str(email_error)}")
            
            # Fallback: Log the feedback
            logger.info("=" * 50)
            logger.info("FEEDBACK RECEIVED (Email Send Failed)")
            logger.info(f"From: {feedback.name} <{feedback.email}>")
            logger.info(f"Time: {timestamp}")
            logger.info(f"Message:\n{feedback.message}")
            logger.info("=" * 50)
            
            return FeedbackResponse(
                success=True,
                message="Feedback received and logged"
            )
            
    except Exception as e:
        logger.error(f"Error processing feedback: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process feedback: {str(e)}"
        )


@router.get("/feedback/health")
async def feedback_health():
    """
    Health check endpoint for feedback system
    
    Returns:
        Dictionary with status and SMTP configuration info
    """
    smtp_configured = bool(os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))
    
    return {
        "status": "online",
        "smtp_configured": smtp_configured,
        "smtp_server": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
        "note": "Feedback will be logged if SMTP is not configured"
    }
