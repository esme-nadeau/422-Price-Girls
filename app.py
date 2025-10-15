from flask import Flask, render_template


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

if __name__ == "__main__":
    app.run(debug=True)