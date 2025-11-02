import os, ssl, smtplib
from email.message import EmailMessage

class SMTPMailer:
    def __init__(self):
        self.host = os.getenv("SMTP_HOST")
        self.port = int(os.getenv("SMTP_PORT", "465"))
        self.user = os.getenv("SMTP_USER")
        self.password = os.getenv("SMTP_PASS")
        self.from_addr = os.getenv("MAIL_FROM_ADDRESS")
        self.from_name = os.getenv("MAIL_FROM_NAME", "")

    def send_html(self, to_email: str, subject: str, html: str, text_fallback: str = "HTML mail"):
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_addr}>" if self.from_name else self.from_addr
        msg["To"] = to_email
        msg.set_content(text_fallback)
        msg.add_alternative(html, subtype="html")

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(self.host, self.port, context=context) as server:
            if self.user and self.password:
                server.login(self.user, self.password)
            server.send_message(msg)
