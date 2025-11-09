import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

import os
import json
import ssl
import smtplib
from email.message import EmailMessage
from datetime import datetime, time

from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

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
        return cred  # return credentials for Firestore
    except Exception as e:
        raise RuntimeError(
            "Firebase Admin initialization failed. "
            "Check GOOGLE_APPLICATION_CREDENTIALS in .env and verify serviceAccount.json exists and is valid."
        ) from e

# Initialize Firebase Admin
if not firebase_admin._apps:
    # Ensure env var points to bundled serviceAccount.json if not already set
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(os.path.dirname(__file__), "serviceAccount.json")
    cred = init_firebase()

# ----------------------------
# Firestore client (robust initialization with fallback)
# ----------------------------
db = None
try:
    # Ensure firebase_admin app is initialized
    if not firebase_admin._apps:
        init_firebase()

    # Preferred: use firebase_admin's firestore client
    db = firestore.client()
    print("[firestore] Admin Firestore client initialized")
except Exception as e:
    print(f"[firestore] Admin client init failed: {e}")
    # Fallback: try google.cloud firestore client with service account credentials
    try:
        from google.cloud import firestore as gc_firestore
        from google.oauth2 import service_account as ga_service_account

        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccount.json")
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"Service account file not found: {cred_path}")

        sa_creds = ga_service_account.Credentials.from_service_account_file(cred_path)
        project_id = os.getenv("FIREBASE_PROJECT_ID") or None
        if project_id:
            db = gc_firestore.Client(project=project_id, credentials=sa_creds)
        else:
            db = gc_firestore.Client(credentials=sa_creds)
        print("[firestore] Fallback google.cloud Firestore client initialized")
    except Exception as e2:
        print(f"[firestore] Fallback initialization failed: {e2}")
        db = None

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
# UI routes
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

# My Bookings: dynamic Firestore data
@app.route("/mybookings")
def my_bookings():
    try:
        bookings_ref = db.collection("bookings")
        docs = bookings_ref.stream()

        bookings = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            bookings.append(data)

        return render_template("mybookings.html", bookings=bookings)
    except Exception as e:
        print(f"Error loading bookings: {e}")
        return render_template("mybookings.html", bookings=[])

# ----------------------------
# MyBookings DELETE endpoint (Esmé's addition)
# ----------------------------
@app.route("/delete_booking/<booking_id>", methods=["DELETE"])
def delete_booking(booking_id):
    try:
        db.collection("bookings").document(booking_id).delete()
        return jsonify({"success": True}), 200
    except Exception as e:
        print(e)
        return jsonify({"success": False, "error": str(e)}), 500

# ----------------------------
# Helper functions for time overlap checking
# ----------------------------
def parse_time_string(time_str):
    """Parse time string like '8:00 AM - 9:00 AM' into (start_time, end_time) tuples."""
    if ' - ' not in time_str:
        raise ValueError(f"Expected time range format 'HH:MM AM/PM - HH:MM AM/PM', got: {time_str}")
    
    parts = time_str.split(' - ')
    start_str = parts[0].strip()
    end_str = parts[1].strip()
    
    # Parse using datetime.strptime (simpler than regex)
    try:
        start_dt = datetime.strptime(start_str, "%I:%M %p")  # %I = 12-hour, %p = AM/PM
        end_dt = datetime.strptime(end_str, "%I:%M %p")
        return start_dt.time(), end_dt.time()
    except ValueError as e:
        raise ValueError(f"Invalid time format in '{time_str}': {e}")

def times_overlap(start1, end1, start2, end2):
    """Check if two time ranges overlap. Returns True if they overlap."""
    # Convert to minutes for easy comparison
    def to_minutes(t):
        return t.hour * 60 + t.minute
    
    s1, e1 = to_minutes(start1), to_minutes(end1)
    s2, e2 = to_minutes(start2), to_minutes(end2)
    
    # Overlap occurs when: start1 < end2 AND start2 < end1
    return s1 < e2 and s2 < e1

def check_booking_overlap(db, room_id, date, time_range_str):
    """Check if a new booking would overlap with existing bookings."""
    try:
        # Parse the new booking's time range
        new_start, new_end = parse_time_string(time_range_str)
        
        # Query existing bookings for the same room and date
        existing_bookings = db.collection("bookings").where("roomId", "==", room_id).where("date", "==", date).stream()
        
        for booking_doc in existing_bookings:
            booking = booking_doc.to_dict()
            existing_time_range = booking.get("timeRange", "")
            
            if not existing_time_range:
                continue
            
            try:
                existing_start, existing_end = parse_time_string(existing_time_range)
                
                # Check for overlap
                if times_overlap(new_start, new_end, existing_start, existing_end):
                    return {
                        "overlap": True,
                        "conflicting_booking_id": booking_doc.id,
                        "conflicting_time": existing_time_range
                    }
            except (ValueError, AttributeError) as e:
                print(f"[overlap] Error parsing existing booking time: {e}")
                continue
        
        return {"overlap": False}
    
    except Exception as e:
        print(f"[overlap] Error checking overlap: {e}")
        import traceback
        traceback.print_exc()
        # If we can't check, allow the booking (fail open)
        return {"overlap": False, "error": str(e)}

# ----------------------------
# API: test + bookings CRUD
# ----------------------------
@app.route("/api/test")
def api_test():
    return jsonify({"message": "Flask API working!"})

@app.route("/api/bookings", methods=["GET", "POST"])
def bookings():
    if request.method == "POST":
        try:
            data = request.json or {}
            print(f"[bookings] Received booking data: {data}")
            
            # Extract booking details
            room_id = data.get("room")
            date = data.get("date")
            time_range = data.get("timeRange")
            
            # Validate required fields
            if not room_id or not date or not time_range:
                return jsonify({
                    "success": False,
                    "error": "Missing required fields: room, date, or timeRange"
                }), 400
            
            # Check for overlapping bookings
            overlap_check = check_booking_overlap(db, room_id, date, time_range)
            if overlap_check.get("overlap"):
                conflicting_time = overlap_check.get("conflicting_time", "unknown time")
                return jsonify({
                    "success": False,
                    "error": f"This room is already booked for {conflicting_time} on {date}. Please choose a different time."
                }), 409  # 409 Conflict status code
            
            # Create the booking if no overlap
            booking_ref = db.collection("bookings").add({
                "roomId": room_id,
                "date": date,
                "timeRange": time_range,
                "repeat": data.get("repeat"),
                "userId": data.get("name"),
                "purpose": data.get("purpose"),
                "status": "confirmed",
                "email": data.get("email", ""),
            })
            booking_id = booking_ref[1].id
            print(f"[bookings] Successfully created booking with ID: {booking_id}")
            return jsonify({"success": True, "id": booking_id})
        except Exception as e:
            print(f"[bookings] Error creating booking: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500

    # GET all bookings
    try:
        items = []
        for doc in db.collection("bookings").stream():
            b = doc.to_dict()
            b["id"] = doc.id
            items.append(b)
        return jsonify({"bookings": items})
    except Exception as e:
        print(f"[bookings] Error fetching bookings: {e}")
        return jsonify({"bookings": [], "error": str(e)}), 500

# ----------------------------
# Email confirmation endpoint
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

# ----------------------------
# Email preview route (from Kate's version)
# ----------------------------
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

# ----------------------------
# Run app
# ----------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
