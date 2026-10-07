"""
Feedback API Router
Handles user feedback submissions and email notifications
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from src.logging import get_logger

logger = get_logger("API.Feedback")
router = APIRouter()


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
        
        # Create email message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"NovusOrbit Feedback from {feedback.name}"
        msg["From"] = os.getenv("FEEDBACK_EMAIL_FROM", "noreply@novusorbit.com")
        msg["To"] = "zengtian006@gmail.com"
        
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
                <span class="label">From:</span> {feedback.name}
            </div>
            <div class="info-row">
                <span class="label">Email:</span> <a href="mailto:{feedback.email}">{feedback.email}</a>
            </div>
            <div class="info-row">
                <span class="label">Time:</span> {timestamp}
            </div>
            
            <div class="message-box">
                <h3 style="margin-top: 0; color: #667eea;">Message:</h3>
                <p style="white-space: pre-wrap; margin: 0;">{feedback.message}</p>
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
                
                # Set a 10-second timeout to prevent hanging
                with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)
                    
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
