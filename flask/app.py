import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
from flask import Flask, render_template, request, jsonify, redirect, url_for, session

import os
import json
import ssl
import smtplib
from email.message import EmailMessage
from datetime import datetime, time, timedelta
import random

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
@app.route("/login", methods=["GET"])
def login_page():
    # If you want to redirect logged-in users away from the login page later, you can check session here.
    return render_template("login.html")

@app.route("/")
def index():
    """Main SPA shell.

    We also inject the current user's role/login status so front-end JS (e.g. All Bookings)
    can render role-aware views without extra round-trips.
    """
    session_data = get_current_session_data()
    is_logged_in = bool(session_data)
    if session_data:
        user_role = (session_data.get("role") or "student").strip().lower()
    else:
        user_role = "student"
    return render_template("index.html", user_role=user_role, is_logged_in=is_logged_in)

@app.route("/admin")
def admin():
    # Check if user is an admin
    session_data = get_current_session_data()
    if not session_data:
        # Not logged in - redirect to login or show error
        return render_template("admin.html", bookings=[], rooms=[], users=[], error_message="You must be logged in to access admin tools."), 403
    
    user_role = (session_data.get("role") or "student").strip().lower()
    if user_role != "admin":
        # Not an admin - deny access
        return render_template("admin.html", bookings=[], rooms=[], users=[], error_message="Access denied. Administrator role required."), 403
    
    error_message = None
    bookings = []
    rooms = []
    users = []
    closures = []
    try:
        if db is None:
            error_message = "Firestore is not initialized. Please check your service account and environment variables."
            print(f"[admin] {error_message}")
        else:
            bookings_ref = db.collection("pending_bookings")
            docs = bookings_ref.stream()
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                bookings.append(data)
            if not bookings:
                error_message = "No bookings to approve."
                print(f"[admin] {error_message}")
            # Load rooms for admin page (server-side render before JS mounts)
            try:
                rooms_ref = db.collection("rooms")
                room_docs = rooms_ref.stream()
                for rdoc in room_docs:
                    r = rdoc.to_dict() or {}
                    r["id"] = rdoc.id
                    rooms.append(r)
            except Exception as re:
                print(f"[admin] Error loading rooms: {re}")
            # Load users for Pending Accounts
            try:
                users_ref = db.collection('users')
                for udoc in users_ref.stream():
                    u = udoc.to_dict() or {}
                    # ensure expected keys
                    u.setdefault('email', udoc.id)
                    u.setdefault('name', '')
                    u.setdefault('role', 'student')
                    users.append(u)
            except Exception as ue:
                print(f"[admin] Error loading users: {ue}")
            # Load closures for Building Closures card
            try:
                closures_ref = db.collection('closures')
                for cdoc in closures_ref.stream():
                    c = cdoc.to_dict() or {}
                    c["id"] = cdoc.id
                    closures.append(c)
            except Exception as ce:
                print(f"[admin] Error loading closures: {ce}")
    except Exception as e:
        error_message = f"Error loading bookings: {e}"
        print(f"[admin] {error_message}")
    return render_template("admin.html", bookings=bookings, rooms=rooms, users=users, closures=closures, error_message=error_message)

@app.route("/map")
def map_tab():
    return render_template("map.html")

@app.route("/calendar")
def calendar_tab():
    return render_template("calendar.html")

# My Bookings: dynamic Firestore data
@app.route("/mybookings")
def my_bookings():
    error_message = None
    bookings = []
    try:
        if db is None:
            error_message = "Firestore is not initialized. Please check your service account and environment variables."
            print(f"[mybookings] {error_message}")
        else:
            # Get user's email from session
            session_id = request.cookies.get("sessionId")
            user_email = None
            
            if session_id:
                try:
                    session_doc = db.collection("sessions").document(session_id).get()
                    if session_doc.exists:
                        session_data = session_doc.to_dict()
                        user_email = session_data.get("email")
                except Exception as e:
                    print(f"[mybookings] Error retrieving session: {e}")
            
            # If no session, return empty bookings list (user not logged in)
            if not user_email:
                print(f"[mybookings] No session found, returning empty bookings list")
                return render_template("mybookings.html", bookings=[], error_message=None)
            
            # Filter bookings by user's email
            bookings_ref = db.collection("bookings")
            docs = bookings_ref.stream()
            for doc in docs:
                data = doc.to_dict()
                # Check if booking email matches user's email
                booking_email = data.get("email") or data.get("userEmail", "")
                if booking_email.lower() == user_email.lower():
                    data["id"] = doc.id
                    bookings.append(data)
            
            if not bookings:
                error_message = "No bookings found for your account."
                print(f"[mybookings] No bookings found for {user_email}")
    except Exception as e:
        error_message = f"Error loading bookings: {e}"
        print(f"[mybookings] {error_message}")
    return render_template("mybookings.html", bookings=bookings, error_message=error_message)

# All Bookings: admin/faculty view of current and upcoming bookings
@app.route("/allbookings")
def all_bookings():
    error_message = None
    bookings = []
    # Default everyone to "student" unless we can prove otherwise from the Firestore session.
    user_role = "student"
    try:
        session_data = get_current_session_data()
        is_logged_in = bool(session_data)
        if session_data:
            # Normalize whitespace/casing so "Admin ", "ADMIN", etc. are treated as "admin".
            user_role = (session_data.get("role") or "student").strip().lower()
        else:
            user_role = "student"

        if db is None:
            error_message = "Firestore is not initialized. Please check your service account and environment variables."
            print(f"[allbookings] {error_message}")
        else:
            bookings_ref = db.collection("bookings")
            docs = bookings_ref.stream()
            today = datetime.utcnow().date()
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                # Parse date field (stored as YYYY-MM-DD string)
                date_str = data.get("date")
                parsed_date = None
                if isinstance(date_str, str) and date_str:
                    try:
                        parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    except ValueError:
                        parsed_date = None
                data["_parsed_date"] = parsed_date
                bookings.append(data)

            # Keep only current and future bookings with valid dates
            current_bookings = [
                b for b in bookings
                if b.get("_parsed_date") is not None and b["_parsed_date"] >= today
            ]

            # Sort by date then start time
            def sort_key(b):
                d = b.get("_parsed_date") or today
                time_range = b.get("timeRange", "") or ""
                try:
                    start_t, _ = parse_time_string(time_range)
                except Exception:
                    start_t = time(0, 0)
                return (d, start_t)

            current_bookings.sort(key=sort_key)
            bookings = current_bookings

            if not bookings:
                error_message = "No current or upcoming bookings found in Firestore."
                print(f"[allbookings] {error_message}")
    except Exception as e:
        error_message = f"Error loading all bookings: {e}"
        print(f"[allbookings] {error_message}")
    # Pass both role and login status so the template/JS can show the right guidance.
    return render_template(
        "allbookings.html",
        bookings=bookings,
        error_message=error_message,
        user_role=user_role,
        is_logged_in=is_logged_in,
    )

@app.post("/api/pending-bookings/<booking_id>/approve")
def api_approve_pending_booking(booking_id):
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500

    # Only admins may approve
    session_data = get_current_session_data()
    role = (session_data.get("role") if session_data else "student") or "student"
    role = str(role).strip().lower()
    if role != "admin":
        return jsonify({"success": False, "error": "forbidden"}), 403

    try:
        pending_ref = db.collection("pending_bookings").document(booking_id)
        snap = pending_ref.get()
        if not snap.exists:
            return jsonify({"success": False, "error": "pending_booking_not_found"}), 404

        pending = snap.to_dict() or {}

        # Build confirmed booking document
        confirmed = {
            "roomId": pending.get("roomId") or pending.get("room"),
            "date": pending.get("date"),
            "timeRange": pending.get("timeRange") or pending.get("time"),
            "repeat": pending.get("repeat") or "Never",
            "userId": pending.get("userId") or pending.get("name"),
            "purpose": pending.get("purpose"),
            "email": pending.get("email") or pending.get("userEmail"),
            "status": "confirmed",
        }

        bookings_ref = db.collection("bookings").document(booking_id)
        bookings_ref.set(confirmed)

        # Remove from pending queue
        pending_ref.delete()

        # --- Send confirmation email (best-effort) ---
        try:
            to_email = confirmed.get("email")
            if to_email:
                booking_id_str = booking_id
                manage_url = f"{SITE_URL}/mybookings?bookingId={booking_id_str}"
                user_name = confirmed.get("userId") or "Guest"
                room_name = confirmed.get("roomId") or "Unknown Room"
                date = confirmed.get("date") or ""
                time_range = confirmed.get("timeRange") or ""
                repeat_rule = confirmed.get("repeat") or None
                purpose = confirmed.get("purpose") or None
                current_year = datetime.now().year

                html = render_template(
                    "booking_confirmation_email.html",
                    user_name=user_name,
                    reservation_id=booking_id_str,
                    room_name=room_name,
                    date=date,
                    time_range=time_range,
                    repeat_rule=repeat_rule,
                    purpose=purpose,
                    manage_url=manage_url,
                    site_url=SITE_URL,
                    current_year=current_year,
                )

                subject = f"Reservation Confirmed – {room_name} on {date}"
                text_fallback = (
                    "Reservation confirmed.\n"
                    f"Reservation ID: {booking_id_str}\n"
                    f"Name: {user_name}\n"
                    f"Room: {room_name}\n"
                    f"Date: {date}\n"
                    f"Time: {time_range}\n"
                    f"Manage: {manage_url}\n"
                )

                send_html_email(to_email, subject, html, text_fallback=text_fallback)
                bookings_ref.update({
                    "emailSentAt": firestore.SERVER_TIMESTAMP,
                    "emailError": firestore.DELETE_FIELD,
                })
        except Exception as e:
            print(f"[pending_approve] Email send failed for {booking_id}: {e}")
            bookings_ref.update({"emailError": str(e)})

        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[pending_approve] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    
@app.post("/api/pending-bookings/<booking_id>/deny")
def api_deny_pending_booking(booking_id):
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500

    # Only admins may deny
    session_data = get_current_session_data()
    role = (session_data.get("role") if session_data else "student") or "student"
    role = str(role).strip().lower()
    if role != "admin":
        return jsonify({"success": False, "error": "forbidden"}), 403

    try:
        pending_ref = db.collection("pending_bookings").document(booking_id)
        snap = pending_ref.get()
        if not snap.exists:
            return jsonify({"success": False, "error": "pending_booking_not_found"}), 404

        data = snap.to_dict() or {}
        data["status"] = "denied"
        data["deniedAt"] = firestore.SERVER_TIMESTAMP

        # Optional: archive denied bookings
        db.collection("denied_bookings").document(booking_id).set(data)

        pending_ref.delete()
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[pending_deny] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ----------------------------
# MyBookings DELETE endpoint (Esmé's addition)
# ----------------------------
@app.route("/delete_booking/<booking_id>", methods=["DELETE"])
def delete_booking(booking_id):
    try:
        if db is None:
            return jsonify({"success": False, "error": "firestore_unavailable"}), 500

        session_data = get_current_session_data()
        if not session_data:
            return jsonify({"success": False, "error": "unauthenticated"}), 401

        user_email = (session_data.get("email") or "").strip().lower()
        user_role = (session_data.get("role") or "student").strip().lower()

        doc_ref = db.collection("bookings").document(booking_id)
        snap = doc_ref.get()
        if not snap.exists:
            return jsonify({"success": False, "error": "booking_not_found"}), 404

        booking = snap.to_dict() or {}
        booking_email = (booking.get("email") or booking.get("userEmail") or "").strip().lower()

        # Admins may delete any booking; other users may only delete their own bookings.
        if user_role != "admin" and (not user_email or user_email != booking_email):
            return jsonify({"success": False, "error": "forbidden"}), 403

        doc_ref.delete()
        return jsonify({"success": True}), 200
    except Exception as e:
        print(e)
        return jsonify({"success": False, "error": str(e)}), 500

# ----------------------------
# MyBookings UPDATE endpoint (for Save functionality)
# ----------------------------
@app.route("/update_booking/<booking_id>", methods=["POST"])
def update_booking(booking_id):
    try:
        if db is None:
            return jsonify({"success": False, "error": "firestore_unavailable"}), 500

        session_data = get_current_session_data()
        if not session_data:
            return jsonify({"success": False, "error": "unauthenticated"}), 401

        user_email = (session_data.get("email") or "").strip().lower()
        user_role = (session_data.get("role") or "student").strip().lower()

        # Load existing booking so we can enforce ownership / admin permissions
        doc_ref = db.collection("bookings").document(booking_id)
        existing_snap = doc_ref.get()
        if not existing_snap.exists:
            return jsonify({"success": False, "error": "booking_not_found"}), 404

        existing_booking = existing_snap.to_dict() or {}
        booking_email = (existing_booking.get("email") or existing_booking.get("userEmail") or "").strip().lower()

        # Admins may edit any booking; other users may only edit their own bookings.
        if user_role != "admin" and (not user_email or user_email != booking_email):
            return jsonify({"success": False, "error": "forbidden"}), 403

        data = request.get_json(force=True) or {}
        
        # Extract fields for overlap checking
        room_id = data.get("roomId", "")
        date = data.get("date", "")
        time_range = data.get("timeRange", "")
        
        # Validate required fields for overlap check
        if room_id and date and time_range:
            # Check for overlapping bookings (excluding the current booking being updated)
            overlap_check = check_booking_overlap(db, room_id, date, time_range, exclude_booking_id=booking_id)
            if overlap_check.get("overlap"):
                conflicting_time = overlap_check.get("conflicting_time", "unknown time")
                return jsonify({
                    "success": False,
                    "error": f"This room is already booked for {conflicting_time} on {date}."
                }), 409  # 409 Conflict status code
        
        # Only allow updating editable fields
        update_fields = {
            "date": data.get("date", ""),
            "timeRange": data.get("timeRange", ""),
            "repeat": data.get("repeat", "Never"),
            "userId": data.get("userId", ""),
            "email": data.get("email", ""),
            "purpose": data.get("purpose", ""),
            # roomId is included for completeness, but you may want to restrict editing this
            "roomId": data.get("roomId", "")
        }
        doc_ref.update(update_fields)
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[update_booking] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ----------------------------
# API endpoint to get available rooms for dropdown
# ----------------------------
@app.route("/api/rooms")
def api_rooms():
    try:
        rooms_ref = db.collection("rooms")
        docs = rooms_ref.stream()
        rooms = []
        for doc in docs:
            r = doc.to_dict()
            r["id"] = doc.id
            rooms.append(r)
        return jsonify({"rooms": rooms})
    except Exception as e:
        print(f"[api_rooms] Error: {e}")
        return jsonify({"rooms": [], "error": str(e)}), 500


@app.route("/api/users")
def api_users():
    try:
        users_ref = db.collection("users")
        docs = users_ref.stream()
        users = []
        for doc in docs:
            u = doc.to_dict() or {}
            u.setdefault('email', doc.id)
            u.setdefault('name', '')
            u.setdefault('role', 'student')
            users.append(u)
        return jsonify({"users": users})
    except Exception as e:
        print(f"[api_users] Error: {e}")
        return jsonify({"users": [], "error": str(e)}), 500


@app.route("/api/rooms", methods=["POST"])
def api_create_room():
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or data.get('room') or '').strip()
        desc = data.get('room_description', '') or data.get('description', '') or ''
        active = bool(data.get('active', False))
        if not name:
            return jsonify({"success": False, "error": "name_required"}), 400
        
        # Check for duplicate room name
        rooms_ref = db.collection('rooms')
        existing_rooms = rooms_ref.where('name', '==', name).stream()
        if any(existing_rooms):
            return jsonify({"success": False, "error": "ERROR: A room with this name already exists"}), 409
        
        # Split description by commas and store as a list
        desc_list = []
        if desc:
            desc_list = [item.strip() for item in desc.split(',') if item.strip()]
        
        doc_ref = db.collection('rooms').add({
            'name': name,
            'room_description': desc_list,
            'active': active,
        })
        new_id = doc_ref[1].id
        return jsonify({"success": True, "id": new_id}), 201
    except Exception as e:
        print(f"[api_create_room] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/rooms/<room_id>', methods=['DELETE'])
def api_delete_room(room_id):
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500
    try:
        db.collection('rooms').document(room_id).delete()
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[api_delete_room] Error deleting {room_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/rooms/<room_id>', methods=['PUT'])
def api_update_room(room_id):
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        desc = data.get('room_description', '') or ''
        active = bool(data.get('active', False))
        
        if not name:
            return jsonify({"success": False, "error": "name_required"}), 400
        
        # Check for duplicate room name (excluding current room)
        rooms_ref = db.collection('rooms')
        existing_rooms = rooms_ref.where('name', '==', name).stream()
        for existing_room in existing_rooms:
            if existing_room.id != room_id:
                return jsonify({"success": False, "error": "A room with this name already exists"}), 409
        
        # Split description by commas and store as a list
        desc_list = []
        if desc:
            desc_list = [item.strip() for item in desc.split(',') if item.strip()]
        
        update_data = {
            'name': name,
            'room_description': desc_list,
            'active': active,
        }
        
        db.collection('rooms').document(room_id).update(update_data)
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[api_update_room] Error updating {room_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ----------------------------
# Closures API endpoints
# ----------------------------
@app.route("/api/closures")
def api_closures():
    try:
        if db is None:
            return jsonify({"closures": [], "error": "firestore_unavailable"}), 500
        closures_ref = db.collection("closures")
        docs = closures_ref.stream()
        closures = []
        for doc in docs:
            c = doc.to_dict() or {}
            c["id"] = doc.id
            closures.append(c)
        return jsonify({"closures": closures})
    except Exception as e:
        print(f"[api_closures] Error: {e}")
        return jsonify({"closures": [], "error": str(e)}), 500

@app.route("/api/closures", methods=["POST"])
def api_create_closure():
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        start_date = (data.get('startDate') or '').strip()
        end_date = (data.get('endDate') or '').strip()
        description = (data.get('description') or '').strip()
        
        if not name:
            return jsonify({"success": False, "error": "Closure name is required"}), 400
        if not start_date:
            return jsonify({"success": False, "error": "Start date is required"}), 400
        if not end_date:
            return jsonify({"success": False, "error": "End date is required"}), 400
        
        # Validate that end date is not before start date
        try:
            from datetime import datetime
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            if end_dt < start_dt:
                return jsonify({"success": False, "error": "End date cannot be before start date"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Invalid date format. Please use YYYY-MM-DD format"}), 400
        
        doc_ref = db.collection('closures').add({
            'name': name,
            'startDate': start_date,
            'endDate': end_date,
            'description': description,
        })
        new_id = doc_ref[1].id
        return jsonify({"success": True, "id": new_id}), 201
    except Exception as e:
        print(f"[api_create_closure] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/closures/<closure_id>', methods=['DELETE'])
def api_delete_closure(closure_id):
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500
    try:
        db.collection('closures').document(closure_id).delete()
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[api_delete_closure] Error deleting {closure_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/closures/<closure_id>', methods=['PUT'])
def api_update_closure(closure_id):
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        start_date = (data.get('startDate') or '').strip()
        end_date = (data.get('endDate') or '').strip()
        description = (data.get('description') or '').strip()
        
        if not name:
            return jsonify({"success": False, "error": "Closure name is required"}), 400
        if not start_date:
            return jsonify({"success": False, "error": "Start date is required"}), 400
        if not end_date:
            return jsonify({"success": False, "error": "End date is required"}), 400
        
        # Validate that end date is not before start date
        try:
            from datetime import datetime
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            if end_dt < start_dt:
                return jsonify({"success": False, "error": "End date cannot be before start date"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Invalid date format. Please use YYYY-MM-DD format"}), 400
        
        update_data = {
            'name': name,
            'startDate': start_date,
            'endDate': end_date,
            'description': description,
        }
        
        db.collection('closures').document(closure_id).update(update_data)
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[api_update_closure] Error updating {closure_id}: {e}")
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

def check_booking_overlap(db, room_id, date, time_range_str, exclude_booking_id=None):
    """Check if a new booking would overlap with existing bookings.
    
    Args:
        db: Firestore client
        room_id: Room ID to check (may be a human-friendly label like "Room 120")
        date: Date string (YYYY-MM-DD)
        time_range_str: Time range string (e.g., "8:00 AM - 9:00 AM")
        exclude_booking_id: Optional booking ID to exclude from overlap check (for updates)
    """
    try:
        # Parse the new booking's time range
        new_start, new_end = parse_time_string(time_range_str)

        # Extract digits from a room identifier like "Room 120" so that we
        # can match bookings even if older records used a slightly different
        # naming convention (e.g., just "120").
        def extract_digits(val: str) -> str | None:
            if not val:
                return None
            import re
            m = re.search(r"(\d{2,4})", str(val))
            return m.group(1) if m else None

        requested_digits = extract_digits(room_id)

        # Query existing bookings for the same date, then filter by room match
        existing_bookings = db.collection("bookings").where("date", "==", date).stream()

        for booking_doc in existing_bookings:
            # Skip the booking being updated
            if exclude_booking_id and booking_doc.id == exclude_booking_id:
                continue

            booking = booking_doc.to_dict() or {}

            # Room matching: prefer exact roomId match, but also fall back to
            # digit-based comparison so "Room 120" matches "120".
            existing_room = booking.get("roomId") or booking.get("room") or ""
            room_matches = False
            if existing_room == room_id:
                room_matches = True
            else:
                if requested_digits:
                    existing_digits = extract_digits(existing_room)
                    if existing_digits and existing_digits == requested_digits:
                        room_matches = True
            if not room_matches:
                continue

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
                        "conflicting_time": existing_time_range,
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
    # -------------------------
    # POST: Create a booking
    # -------------------------
    if request.method == "POST":
        try:
            # Require authentication
            session_data = get_current_session_data()
            if not session_data:
                return jsonify({"success": False, "error": "unauthenticated"}), 401

            if db is None:
                return jsonify({"success": False, "error": "firestore_unavailable"}), 500

            # Determine role (admin, faculty, student)
            role = (session_data.get("role") or "student").strip().lower()

            data = request.get_json(silent=True) or {}
            print(f"[bookings] Received booking data: {data}")

            # Extract booking fields
            room_id = data.get("room")
            date = data.get("date")
            time_range = data.get("timeRange")

            # Validate required fields
            if not room_id or not date or not time_range:
                return jsonify({
                    "success": False,
                    "error": "Missing required fields: room, date, timeRange"
                }), 400

            # Check overlap ONLY against confirmed bookings
            overlap = check_booking_overlap(db, room_id, date, time_range)
            if overlap.get("overlap"):
                conflicting_time = overlap.get("conflicting_time", "unknown time")
                return jsonify({
                    "success": False,
                    "error": f"This room is already booked for {conflicting_time} on {date}."
                }), 409

            # Decide if booking is pending or confirmed
            if role == "student":
                collection_name = "pending_bookings"
                status = "pending"
            else:
                collection_name = "bookings"
                status = "confirmed"

            # Build the Firestore document
            booking_doc = {
                "roomId": room_id,
                "date": date,
                "timeRange": time_range,
                "repeat": data.get("repeat"),
                "userId": data.get("name"),
                "purpose": data.get("purpose"),
                "status": status,
                "email": data.get("email", ""),
                "createdAt": firestore.SERVER_TIMESTAMP,
                "createdByRole": role,
                "createdByEmail": session_data.get("email", ""),
            }

            # Create in Firestore
            doc_ref = db.collection(collection_name).add(booking_doc)
            booking_id = doc_ref[1].id

            print(f"[bookings] Created {status} booking in {collection_name} with ID: {booking_id}")

            return jsonify({
                "success": True,
                "id": booking_id,
                "status": status,
                "collection": collection_name
            })

        except Exception as e:
            print(f"[bookings] Error creating booking: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500

    # -------------------------
    # GET: Return bookings (role-aware)
    # -------------------------
    try:
        if db is None:
            return jsonify({"bookings": [], "error": "firestore_unavailable"}), 500

        session_data = get_current_session_data()
        role = (session_data.get("role") if session_data else "student") or "student"
        role = str(role).strip().lower()

        bookings_list = []

        for doc in db.collection("bookings").stream():
            raw = doc.to_dict() or {}
            raw["id"] = doc.id

            if role == "student":
                # Students see bookings but without personal details
                safe = {
                    "id": raw["id"],
                    "date": raw.get("date"),
                    "timeRange": raw.get("timeRange"),
                    "roomId": raw.get("roomId"),
                    "repeat": raw.get("repeat"),
                }
                bookings_list.append(safe)
            else:
                # Faculty/Admin see full info
                bookings_list.append(raw)

        return jsonify({"bookings": bookings_list})

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

    For confirmed bookings:
      - Look in 'bookings'
      - Send "Reservation Confirmed" email

    For pending bookings (students):
      - Look in 'pending_bookings'
      - Send "Booking Pending" email using email_status="pending"
    """
    payload = request.get_json(silent=True) or {}
    booking_id = payload.get("bookingId")
    if not booking_id:
        return jsonify({"error": "bookingId is required"}), 400

    if db is None:
        return jsonify({"error": "firestore_unavailable"}), 500

    # 1) Try confirmed bookings first
    collection_name = "bookings"
    doc_ref = db.collection(collection_name).document(booking_id)
    snap = doc_ref.get()

    # 2) If not there, try pending_bookings
    if not snap.exists:
        collection_name = "pending_bookings"
        doc_ref = db.collection(collection_name).document(booking_id)
        snap = doc_ref.get()

        if not snap.exists:
            return jsonify({"error": f"Booking {booking_id} not found"}), 404

    booking = snap.to_dict() or {}
    status = str(booking.get("status") or "confirmed").lower()

    # Idempotency: skip if already sent
    if booking.get("emailSentAt"):
        return jsonify({"ok": True, "skipped": "already_sent"}), 200

    # Determine recipient email
    to_email = booking.get("email") or booking.get("userEmail")
    if not to_email:
        # Record the error on the document
        try:
            doc_ref.update({"emailError": "no_email"})
        except Exception:
            pass
        return jsonify({"error": "Booking has no email address"}), 400

    # Extract booking details
    user_name = booking.get("userId") or booking.get("name") or "Guest"
    room_name = booking.get("roomId") or "Unknown Room"
    date = booking.get("date") or ""
    time_range = booking.get("timeRange") or booking.get("time") or ""
    repeat_rule = booking.get("repeat") or None
    purpose = booking.get("purpose") or None

    site_url = SITE_URL
    manage_url = f"{SITE_URL}/mybookings?bookingId={booking_id}"

    # Use template flag for pending vs confirmed
    email_status = "pending" if status == "pending" else "confirmed"

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
        current_year=datetime.now().year,
        email_status=email_status,
    )

    if email_status == "pending":
        subject = f"Booking Request Received – {room_name} on {date}"
        text_fallback = (
            "We've received your booking request and it is pending approval.\n"
            f"Reservation ID: {booking_id}\n"
            f"Name: {user_name}\n"
            f"Room: {room_name}\n"
            f"Date: {date}\n"
            f"Time: {time_range}\n"
            "You'll receive another email once your reservation is confirmed.\n"
        )
    else:
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
        doc_ref.update(
            {
                "emailSentAt": firestore.SERVER_TIMESTAMP,
                "emailError": firestore.DELETE_FIELD,
            }
        )
        return jsonify({"ok": True})
    except Exception as e:
        print(f"[send_booking_confirmation] Error sending email for {booking_id}: {e}")
        try:
            doc_ref.update({"emailError": str(e)})
        except Exception:
            pass
        return jsonify({"error": str(e)}), 500


# ----------------------------
# Email preview route (from Katie's version)
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
# Add User (Call this when admin adds a new user or a new user signs up)
# ----------------------------

def add_user(email: str, name: str, role: str = "student"):
    """
    Create or update a user in Firestore under users/{email}

    Args:
        email (str): The user's email (used as document ID)
        name (str): Full name of the user
        role (str): "student", "faculty", or "admin"
    """

    # Validate role
    role = role.lower()
    valid_roles = {"student", "faculty", "admin"}
    if role not in valid_roles:
        raise ValueError(f"Invalid role '{role}'. Must be one of {valid_roles}")

    # Ensure Firestore client is initialized
    if db is None:
        raise RuntimeError("Firestore DB is not initialized.")

    # Write to Firestore
    doc_ref = db.collection("users").document(email)
    user_data = {
        "email": email,
        "name": name,
        "role": role,
    }

    doc_ref.set(user_data)

    print(f"[users] Upserted user: {email} ({role})")
    return True

# ----------------------------
# Flask route for Admin adding a user (Currently not in use)
# ----------------------------


@app.route("/api/add-user", methods=["POST"])
def api_add_user():
    data = request.json
    if not data:
        return {"ok": False, "error": "No JSON body"}, 400

    required = ["email", "name", "role"]
    if not all(k in data for k in required):
        return {"ok": False, "error": "Missing fields"}, 400

    try:
        add_user(data["email"], data["name"], data["role"])
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}, 400


@app.route('/api/users/<user_email>', methods=['PUT', 'DELETE'])
def api_update_or_delete_user(user_email):
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500
    
    if request.method == 'DELETE':
        try:
            db.collection('users').document(user_email).delete()
            return jsonify({"success": True}), 200
        except Exception as e:
            print(f"[api_delete_user] Error deleting {user_email}: {e}")
            return jsonify({"success": False, "error": str(e)}), 500
    
    # PUT method - update user
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        role = (data.get('role') or 'student').strip().lower()
        
        if not name:
            return jsonify({"success": False, "error": "Name is required"}), 400
        
        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400
        
        if not email.endswith("@uoregon.edu"):
            return jsonify({"success": False, "error": "Email must end with @uoregon.edu"}), 400
        
        # Validate role
        valid_roles = {"student", "faculty", "admin"}
        if role not in valid_roles:
            return jsonify({"success": False, "error": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}), 400
        
        # If email changed, we need to create new document and delete old one
        if email != user_email:
            # Check if new email already exists
            new_user_ref = db.collection('users').document(email)
            if new_user_ref.get().exists:
                return jsonify({"success": False, "error": "A user with this email already exists"}), 409
            
            # Create new document with new email
            new_user_ref.set({
                "email": email,
                "name": name,
                "role": role,
            })
            
            # Delete old document
            db.collection('users').document(user_email).delete()
        else:
            # Just update the existing document
            db.collection('users').document(user_email).update({
                "name": name,
                "role": role,
            })
        
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"[api_update_user] Error updating {user_email}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.post("/auth/request-code")
def auth_request_code():
    payload = request.get_json(silent=True) or {}
    raw_email = payload.get("email") or ""
    email = raw_email.strip().lower()

    if not email:
        return jsonify({"error": "Email is required."}), 400
    if not email.endswith("@uoregon.edu"):
        return jsonify({"error": "Email must end with @uoregon.edu."}), 400
    if db is None:
        return jsonify({"error": "Firestore is not initialized."}), 500

    code = f"{random.randint(0, 999999):06d}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    try:
        doc_ref = db.collection("authCodes").document(email)
        doc_ref.set(
            {
                "code": code,
                "expiresAt": expires_at,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
        )
        print(f"Auth code generated for {email}")
    except Exception as e:
        return jsonify({"error": f"Failed to store auth code: {e}"}), 500

    subject = "Your verification code"
    html = (
        f"<p>Your verification code is <strong>{code}</strong>.</p>"
        "<p>This code expires in 10 minutes.</p>"
    )
    text_fallback = f"Your verification code is {code}. It expires in 10 minutes."

    try:
        send_html_email(email, subject, html, text_fallback=text_fallback)
        print(f"Auth code email sent to {email}")
    except Exception as e:
        return jsonify({"error": f"Failed to send email: {e}"}), 500

    return jsonify({"success": True})


@app.post("/auth/verify-code")
def auth_verify_code():
    payload = request.get_json(silent=True) or {}
    raw_email = payload.get("email") or ""
    raw_code = payload.get("code") or ""
    email = raw_email.strip().lower()
    code = raw_code.strip()

    if not email or not code:
        return jsonify({"success": False, "error": "invalid_or_expired_code"}), 400
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500

    doc_ref = db.collection("authCodes").document(email)
    snap = doc_ref.get()
    if not snap.exists:
        return jsonify({"success": False, "error": "invalid_or_expired_code"}), 400

    data = snap.to_dict() or {}
    stored_code = (data.get("code") or "").strip()
    expires_at = data.get("expiresAt")
    expires_dt = None

    if isinstance(expires_at, datetime):
        expires_dt = expires_at
    if expires_dt and getattr(expires_dt, "tzinfo", None):
        expires_dt = expires_dt.replace(tzinfo=None)

    now = datetime.utcnow()
    if not (stored_code and stored_code == code and expires_dt and expires_dt > now):
        return jsonify({"success": False, "error": "invalid_or_expired_code"}), 400

    doc_ref.delete()
    print(f"Code verified for {email}")

    user_doc = db.collection("users").document(email)
    user_snap = user_doc.get()
    user_data = user_snap.to_dict() if user_snap.exists else None

    if not user_data:
        user_data = {"email": email, "name": "", "role": "student"}
        user_doc.set(user_data)
    else:
        user_data.setdefault("name", "")
        user_data.setdefault("role", "student")

    forwarded_for = request.headers.get("X-Forwarded-For", "")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.remote_addr or "unknown")
    session_id = f"{ip}-{int(datetime.utcnow().timestamp() * 1000)}"

    db.collection("sessions").document(session_id).set(
        {
            "email": email,
            "role": user_data.get("role", "student"),
            "name": user_data.get("name", ""),
            "ip": ip,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )
    print(f"User session created for {email} with role {user_data.get('role', 'student')}")

    response = jsonify(
        {
            "success": True,
            "email": email,
            "role": user_data.get("role", "student"),
            "name": user_data.get("name", ""),
            "sessionId": session_id,
        }
    )
    response.set_cookie(
        "sessionId",
        session_id,
        max_age=60 * 60 * 24 * 7,
        secure=False,
        httponly=False,
        samesite="Lax",
    )
    return response


@app.get("/auth/session")
def auth_session_info():
    """Return the current session plus canonical user info.

    The *only* source of truth for a user's name/role is the users collection
    in Firestore. Older sessions may have an empty or outdated name field, so
    we backfill from users/{email} on every request.
    """
    if db is None:
        return jsonify({"success": False, "error": "firestore_unavailable"}), 500

    session_id = request.cookies.get("sessionId")
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.remote_addr or "unknown")

    session_data = None
    session_doc_ref = None

    # First try cookie-based session lookup
    if session_id:
        session_doc_ref = db.collection("sessions").document(session_id)
        snap = session_doc_ref.get()
        if snap.exists:
            session_data = snap.to_dict()

    # Fallback: look up most recent session for this IP
    if session_data is None:
        try:
            query = (
                db.collection("sessions")
                .where("ip", "==", ip)
                .order_by("createdAt", direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
            )
            for doc in query:
                session_data = doc.to_dict()
                session_doc_ref = doc.reference
                break
        except Exception as e:
            print(f"[auth_session] Failed to load session for IP {ip}: {e}")

    if session_data is None:
        return jsonify({"success": False, "error": "session_not_found"}), 404

    # Backfill name/role from canonical users collection if missing or blank
    email = (session_data.get("email") or "").strip().lower()
    if email:
        try:
            user_doc = db.collection("users").document(email).get()
            if user_doc.exists:
                user = user_doc.to_dict() or {}
                user_name = (user.get("name") or "").strip()
                user_role = (user.get("role") or session_data.get("role") or "student").strip()

                # Only overwrite if we actually have values
                if user_name:
                    session_data["name"] = user_name
                if user_role:
                    session_data["role"] = user_role

                # Persist the backfilled values onto the session document so
                # subsequent lookups don't need to re-query users.
                if session_doc_ref is not None:
                    update_payload = {}
                    if user_name:
                        update_payload["name"] = user_name
                    if user_role:
                        update_payload["role"] = user_role
                    if update_payload:
                        try:
                            session_doc_ref.update(update_payload)
                        except Exception as e:
                            print(f"[auth_session] Failed to update session doc for {email}: {e}")
        except Exception as e:
            print(f"[auth_session] Failed to backfill user info for {email}: {e}")

    created_at = session_data.get("createdAt")
    if hasattr(created_at, "isoformat"):
        created_at_value = created_at.isoformat()
    elif isinstance(created_at, datetime):
        created_at_value = created_at.isoformat()
    else:
        created_at_value = created_at

    session_payload = {
        "email": session_data.get("email"),
        "role": session_data.get("role"),
        "name": session_data.get("name"),
        "ip": session_data.get("ip"),
        "createdAt": created_at_value,
    }

    return jsonify({"success": True, "session": session_payload})


@app.post("/auth/logout")
def auth_logout():
    session_id = request.cookies.get("sessionId")
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.remote_addr or "unknown")

    if db is not None:
        if session_id:
            db.collection("sessions").document(session_id).delete()
        else:
            try:
                query = (
                    db.collection("sessions")
                    .where("ip", "==", ip)
                    .order_by("createdAt", direction=firestore.Query.DESCENDING)
                    .limit(1)
                    .stream()
                )
                for doc in query:
                    doc.reference.delete()
                    break
            except Exception as e:
                print(f"[auth_logout] Failed to delete session for IP {ip}: {e}")

    resp = jsonify({"success": True})
    resp.delete_cookie("sessionId")
    return resp


def cleanup_sessions_older_than(days=30):
    if db is None:
        raise RuntimeError("Firestore is not initialized.")

    cutoff = datetime.utcnow() - timedelta(days=days)
    deleted = 0

    try:
        query = db.collection("sessions").where("createdAt", "<", cutoff)
        for doc in query.stream():
            doc.reference.delete()
            deleted += 1
    except Exception as e:
        print(f"[session_cleanup] Query by createdAt failed: {e}")
        fallback_docs = db.collection("sessions").stream()
        for doc in fallback_docs:
            data = doc.to_dict() or {}
            created_at = data.get("createdAt")
            created_dt = None
            if hasattr(created_at, "to_datetime"):
                created_dt = created_at.to_datetime()
            elif isinstance(created_at, datetime):
                created_dt = created_at
            if created_dt and created_dt < cutoff:
                doc.reference.delete()
                deleted += 1

    print(f"[session_cleanup] Deleted {deleted} sessions older than {days} days.")
    return deleted


def get_current_session_data():
    """Return the current session document from Firestore, or None.

    The document contains at least email, role, and name keys when available.
    Roles are stored in the users collection (admin, faculty, student) and
    copied into sessions when a user logs in.
    """
    if db is None:
        return None

    session_id = request.cookies.get("sessionId")
    if not session_id:
        return None

    try:
        snap = db.collection("sessions").document(session_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data.setdefault("email", "")
        data.setdefault("role", "student")
        data.setdefault("name", "")
        return data
    except Exception as e:
        print(f"[session_helper] Failed to load session: {e}")
        return None


@app.post("/auth/cleanup-sessions")
def auth_cleanup_sessions():
    try:
        deleted = cleanup_sessions_older_than(30)
        return jsonify({"success": True, "deleted": deleted})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



# ----------------------------
# Run app
# ----------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)