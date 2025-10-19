from flask import Flask, render_template, jsonify, send_from_directory
import os

app = Flask(__name__)

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

@app.route('/api/bookings')
def get_bookings():
    return jsonify({"bookings": []}) # bookings logic

if __name__ == "__main__":
    app.run(debug=True, port=5000)

# # Optional: Serve React app on a different route
# @app.route('/react')
# @app.route('/react/<path:path>')
# def serve_react(path=''):
#     react_build_path = '../react/build'
#     if path != "" and os.path.exists(os.path.join(react_build_path, path)):
#         return send_from_directory(react_build_path, path)
#     else:
#         return send_from_directory(react_build_path, 'index.html')

