import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import os
import json
import ssl
import smtplib
from email.message import EmailMessage
from datetime import datetime

from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore

load_dotenv()

app = Flask(__name__)

# ----------------------------
# Firebase Admin initialization (robust)
# ----------------------------
def init_firebase():
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccount.json")
    try:
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"Missing service account file: {cred_path}")
        # Validate JSON before using it
        with open(cred_path, "r", encoding="utf-8") as f:
            json.load(f)
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print(f"[firebase] Initialized with service account at {cred_path}")
    except Exception as e:
        raise RuntimeError(
            "Firebase Admin initialization failed. "
            "Check GOOGLE_APPLICATION_CREDENTIALS in .env and verify serviceAccount.json exists and is valid."
        ) from e

if not firebase_admin._apps:
    init_firebase()

# Firestore client (uses FIREBASE_PROJECT_ID if provided)
db = firestore.Client(project=os.getenv("FIREBASE_PROJECT_ID"))

# ----------------------------
# SMTP / Email configuration
# ----------------------------
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
MAIL_FROM_ADDRESS = os.getenv("MAIL_FROM_ADDRESS") or SMTP_USER or "no-reply@example.com"
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "CS Room Reservations")
SITE_URL = os.getenv("SITE_URL", "http://localhost:3000")  # used to build manage links


def send_html_email(to_email: str, subject: str, html: str, text_fallback: str = "HTML email"):
    """Minimal SMTP sender over SSL."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{MAIL_FROM_NAME} <{MAIL_FROM_ADDRESS}>"
    msg["To"] = to_email
    msg.set_content(text_fallback)
    msg.add_alternative(html, subtype="html")

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
        if SMTP_USER and SMTP_PASS:
            server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)

# ----------------------------
# UI routes (preserved)
# ----------------------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/map")
def map_tab():
    return render_template("map.html")

@app.route("/calendar")
def calendar_tab():
    return render_template("calendar.html")

@app.route("/mybookings")
def bookings_tab():
    return render_template("mybookings.html")

# ----------------------------
# API: test + bookings (preserved)
# ----------------------------
@app.route("/api/test")
def api_test():
    return jsonify({"message": "Flask API working!"})

@app.route("/api/bookings", methods=["GET", "POST"])
def bookings():
    if request.method == "POST":
        data = request.json or {}
        # Add to Firestore (matches your schema)
        booking_ref = db.collection("bookings").add({
            "roomId": data.get("room"),
            "date": data.get("date"),
            "timeRange": data.get("timeRange"),
            "repeat": data.get("repeat"),
            "userId": data.get("name"),
            "purpose": data.get("purpose"),
            "status": "confirmed",
            "email": data.get("email", ""),
        })
        return jsonify({"success": True, "id": booking_ref[1].id})

    # GET all bookings
    items = []
    for doc in db.collection("bookings").stream():
        b = doc.to_dict()
        b["id"] = doc.id
        items.append(b)
    return jsonify({"bookings": items})

# ----------------------------
# NEW: Email confirmation endpoint
# ----------------------------
@app.post("/api/send-booking-confirmation")
def send_booking_confirmation():
    """
    Body: { "bookingId": "<document_id>" }
    Fetch booking from Firestore -> render Jinja template 'booking_confirmation_email.html'
    -> send via SMTP -> mark emailSentAt for idempotency.
    """
    payload = request.get_json(silent=True) or {}
    booking_id = payload.get("bookingId")
    if not booking_id:
        return jsonify({"error": "bookingId is required"}), 400

    doc_ref = db.collection("bookings").document(booking_id)
    snap = doc_ref.get()
    if not snap.exists:
        return jsonify({"error": f"Booking {booking_id} not found"}), 404

    booking = snap.to_dict() or {}

    # Idempotency: skip if already sent
    if booking.get("emailSentAt"):
        return jsonify({"ok": True, "skipped": "already_sent"}), 200

    # Map Firestore fields -> template variables
    to_email = booking.get("email") or booking.get("userEmail")
    user_name = booking.get("userId") or booking.get("displayName") or "Guest"
    room_name = booking.get("roomId") or booking.get("roomName") or "Unknown Room"
    date = booking.get("date") or ""
    time_range = booking.get("timeRange") or ""
    repeat_rule = booking.get("repeat") or None
    purpose = booking.get("purpose") or None

    if not to_email:
        doc_ref.update({"emailError": "Missing recipient email"})
        return jsonify({"error": "Missing recipient email on booking"}), 400

    manage_url = f"{SITE_URL}/mybookings?bookingId={booking_id}"
    site_url = SITE_URL
    current_year = datetime.now().year

    # Render your existing Jinja template
    html = render_template(
        "booking_confirmation_email.html",
        user_name=user_name,
        reservation_id=booking_id,
        room_name=room_name,
        date=date,
        time_range=time_range,
        repeat_rule=repeat_rule,
        purpose=purpose,
        manage_url=manage_url,
        site_url=site_url,
        current_year=current_year,
    )

    subject = f"Reservation Confirmed – {room_name} on {date}"
    text_fallback = (
        "Reservation confirmed.\n"
        f"Reservation ID: {booking_id}\n"
        f"Name: {user_name}\n"
        f"Room: {room_name}\n"
        f"Date: {date}\n"
        f"Time: {time_range}\n"
        f"Manage: {manage_url}\n"
    )

    try:
        send_html_email(to_email, subject, html, text_fallback=text_fallback)
        doc_ref.update({
            "emailSentAt": firestore.SERVER_TIMESTAMP,
            "emailError": firestore.DELETE_FIELD,
        })
        return jsonify({"ok": True})
    except Exception as e:
        doc_ref.update({"emailError": str(e)})
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route('/preview-email')
def preview_email():
    sample = {
        "user_name": "Test User",
        "reservation_id": "ABC123",
        "room_name": "Room 120",
        "date": "2025-11-01",
        "time_range": "10:00 AM - 11:00 AM",
        "repeat_rule": "Never",
        "purpose": "Study session",
        "manage_url": "http://127.0.0.1:5000/mybookings",
        "site_url": "http://127.0.0.1:5000/",
        "current_year": "2025",
    }
    return render_template('booking_confirmation_email.html', **sample)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
