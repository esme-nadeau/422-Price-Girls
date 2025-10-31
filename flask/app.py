from flask import Flask, render_template, jsonify, request
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)

# Initialize Firebase Admin
cred = credentials.Certificate('firebase-credentials.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/map')
def map_tab():
    return render_template('map.html')  # Only the map content

@app.route('/calendar')
def calendar_tab():
    return render_template('calendar.html')  # Only the calendar content

@app.route('/mybookings')
def bookings_tab():
    return render_template('mybookings.html')  # Only the bookings content

# API routes for React to communicate with
@app.route('/api/test')
def api_test():
    return jsonify({"message": "Flask API working!"})

@app.route('/api/bookings', methods=['GET', 'POST'])
def bookings():
    if request.method == 'POST':
        data = request.json
        # Add to Firebase
        booking_ref = db.collection('bookings').add({
            'roomId': data['room'],
            'date': data['date'],
            'timeRange': data['timeRange'],
            'repeat': data['repeat'],
            'userId': data['name'],
            'purpose': data['purpose'],
            'status': 'confirmed',
            'email': '',  # Add if you collect email
        })
        return jsonify({'success': True, 'id': booking_ref[1].id})
    else:
        # GET - return all bookings
        bookings_ref = db.collection('bookings')
        bookings = []
        for doc in bookings_ref.stream():
            booking = doc.to_dict()
            booking['id'] = doc.id
            bookings.append(booking)
        return jsonify({'bookings': bookings})

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
