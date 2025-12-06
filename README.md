# Descutes Hall Room Reservation Website

🎉 Our deployed project can be found here:  [CS Room Reservation System](https://uocs-room-reservation-769919579184.us-west1.run.app/#) 🎉

## Project Description

For faculty, professors, club leadership, GEs, LAs, and students, room reservation systems are incredibly important. Whether a room is needed for a class, business meeting, or club meeting, it is important that each event is able to have a room with no overlaps, interruptions, or confusion. When reserving a room, sometimes more information than just the date and time is needed. It is helpful to have the exact location of the room, as well as a description of what the room has (whiteboard, TV, webcam, number of chairs, etc.). Overall, this project aims to make booking meeting rooms, classrooms, and study rooms easy and accessible for CS faculty and CS/CYBER/MACS/DSCI graduate and undergraduate students. 

---
### Contributors

Esmé Nadaeu<br>
Kate Spencer<br>
Katie Trinh <br>
Lily Spurgat<br>

---

### Technologies Used

Frontend: HTML, CSS, Javascript, Bootstrap<br>
Backend: Python, Flask<br>
Database/Hosting: Firebase, Google Cloud, and Gunicorn<br>

&nbsp;
# How the project works
## User Modes
The application supports four distinct user roles, each with specific permissions and corresponding navigation options.

- Guest (Not Logged In):
    - May browse room availability in a read-only mode.
    - Has access to the All Bookings, Map, and Calendar pages but CANNOT create a booking.

- Student:
    - May view All Bookings in a read-only mode and can only see booking times and room information.
    - May create, edit, and manage their own bookings.
    - Has access to the All Bookings, Map, Calendar, and My Bookings pages.

- Faculty:
    - May view All Bookings in a read-only mode, with additional visibility into the purpose of all bookings.
    - May create, edit, and manage their own bookings.
    - Has access to the All Bookings, Map, Calendar, and My Bookings pages.

- Admin:
    - Has full access to view, modify, and delete any booking in the system.
    - May create and manage their own bookings.
    - Has access to all available pages: All Bookings, Map, Calendar, My Bookings, and Admin Tools.
    - Additional administrative capabilities include:
        - Reviewing and approving/denying pending bookings.
        - Viewing the full booking database.
        - Adding, modifying, or removing users.
        - Adding, modifying, or removing rooms.
        - Creating building closures (e.g., holidays).
        - Removing bookings and pending bookings older than 30 days.

## Pages in the System
The application consists of five main screens:
- **All Bookings** - View bookings across all rooms.
- **Map View** – Browse room availability through a clickable map.
- **Calendar View** – See weekly schedules in a calendar layout (inspired by the old system).
- **My Bookings** – View, edit, or delete personal reservations.
- **Admin Tools** – Administrative interfaces for managing the system.
	

## Page Access by User Mode
| Page / Role      | Guest            | Student                      | Faculty                      | Admin |
|------------------|:----------------:|:----------------------------:|:----------------------------:|:-----:|
| **All Bookings** | ✓ (read-only)    | ✓ (view all, edit own)       | ✓ (view all, edit own)       | ✓     |
| **Map View**     | ✓ (read-only)    | ✓                            | ✓                            | ✓     |
| **Calendar**     | ✓ (read-only)    | ✓                            | ✓                            | ✓     |
| **My Bookings**  | ✗                | ✓                            | ✓                            | ✓     |
| **Admin Tools**  | ✗                | ✗                            | ✗                            | ✓     |

&nbsp;

# Common User Tasks

## User Authentication
### Logging In
1. Click **Login** at the top right-hand side of the page. This will redirect you to the Login page.
2. Enter your **uoregon.edu** email and click **Send Code**.
   - An authentication code will be sent to your email inbox (this may take a few minutes).
   - The code expires after 10 minutes; you will need to request a new one after that time.
3. Enter the verification code into the **Verification Code** field.
4. Click **Verify Code** to complete the login process.

### Logging Out
- Click the **Logout** button at the top right of the screen.

## Create a Booking
1. Log in and authenticate with your uoregon.edu account.
2. Navigate either to the **Map** or **Calendar** page.
3. Select the desired room and date.
4. Complete all required fields; if you are logged in, your name and email will autofill.
5. For more detailed guidance, click the **Instructions** button in the upper-right corner for a step-by-step walkthrough.
6. Click **Book Room**:
	- If no conflicts exist, a confirmation email will be sent verifying your booking.
	- If a conflict exists, you will receive a prompt suggesting the next available time.  
	  If no suitable slots are available, you will be directed to select a different room or date.
	- If you are a student, your booking will be sent to **pending bookings**, and an administrator must approve it.

## Modify or Delete a Booking
If you want to modify or delete your booking:
- Navigate to the **My Bookings** page.
- Select the booking you wish to modify or delete.
- To edit: Click **Edit Reservation**, modify the fields, and click **Save**. You will receive an email confirming the booking changes.
- To delete: Click **Cancel Reservation** and **Ok** to confirm. You will receive an email confirming the booking deletion.

## View All Bookings
- Navigate to the **All Bookings** tab (default on first visit/refresh).
- Use the arrows at the top of the calendar widget to navigate dates, or click **Today** to jump to the current week.
- On your desired date, click the grey cells to view booking information.
  - Logged-out and student users can only see date, time, and room information.
  - Faculty users can see all booking information.
  - Admin users can see all booking information *and* edit bookings (see Admin Tools > Search & Manage All Bookings).

## Administrator Tools

### Approve or Deny Bookings
- While logged in as an admin, navigate to the **Admin Tools** page.
- Go to the **Approve Bookings** card.
    - If no bookings exist, the card will show *"No bookings to approve."*
- Select the booking you wish to approve or deny.
- Click **Approve Reservation** or **Deny Reservation**.  
  The student user will receive an email notification.

### Search and Manage All Bookings

#### From the All Bookings Tab:
- While logged in as an admin, navigate to the **All Bookings** tab.
- Navigate to the **All Bookings** card.
- Use the search bar to search by name, email, time, date, and/or room.
- Select the booking you wish to view.
- To edit: Click **Edit Reservation**, modify fields, and **Save**.
- To delete: Click **Cancel Reservation** and **Ok**.

#### From the Admin Tools Tab:
- Navigate to the **Admin Tools** page.
- Go to the **All Bookings** card.
- Search for bookings via name, email, time, date, and/or room.
- Select the booking you wish to view.
- To edit: Click **Edit Reservation**, modify fields, and **Save**.
- To delete: Click **Cancel Reservation** and **Ok**.

### Manage Users and Rooms
- While logged in as an admin, navigate to the **Admin Tools** page.
- Go to the **Users** card or the **Room Management** card.
- To manage, click the **Edit** button on the right-hand side.
- A pop-up will open; modify the fields and click **Save**.
- To delete a user or room: Click **Delete** within the pop-up, then click **Confirm**.

### Manage Closures
- While logged in as an admin, navigate to the **Admin Tools** page.
- Go to the **Closures** card.
- To add: Click **Add a closure**, set a date duration and display name, and click **Save**.
- To delete: Click **Delete** to the right of the closure name, then **Confirm**.

<!-- ## Misc Notes: -->

&nbsp;
# How to install
1. Clone the repository
    ```bash
	>>> git clone git@github.com:esme-nadeau/422-Price-Girls.git
    ```
	

2. Open the repo, and navigate to the /backend folder
    ```bash
    >>> cd 422-Price-Girls
	>>> cd backend
    ```

3. Run the python app using flask
	a. Make sure flask is installed:
    ```bash
    >>> pip install flask
    ```
	b. Run app.py with flask
    ```bash
    >>> python app.py
    ```

4. Once flask runs, click the LocalHost link (in the form: http://127.0.0.1:5000)

## How to use Firebase with Flask
1. Install firebase-admin with pip
    ```bash
    >>> pip install firebase-admin
    ```
2. Navigate to Firebase -> Project Settings -> Service Accounts -> "Generate New Private Key"

3. Create in /backend "serviceAccount.json"
    ```bash
    >>> cd backend
    >>> touch serviceAccount.json
    ```
4. Paste private key information into serviceAccount.json

## How to set up .env file
In the backend directory create a file called .env and add the following (you will have to add the SMTP password from the deschutesroomreservation@gmail.com settings):

	# ----------------------------
	# Flask environment config
	# ----------------------------
	FLASK_ENV=development
	FLASK_APP=app.py
	
	# ----------------------------
	# Firebase Admin credentials
	# ----------------------------
	GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json
	FIREBASE_PROJECT_ID=deschutes-room-reservation
	
	# ----------------------------
	# Email / SMTP settings (Gmail)
	# ----------------------------
	SMTP_HOST=smtp.gmail.com
	SMTP_PORT=465
	SMTP_USER=Deschutesroomreservation@gmail.com
	SMTP_PASS=     				# 16-character Gmail App Password (Not the login password, get the password from settings)
	MAIL_FROM_ADDRESS=Deschutesroomreservation@gmail.com
	MAIL_FROM_NAME=Deschutes Hall Reservations
	
	# ----------------------------
	# Optional logging/debug
	# ----------------------------
	LOG_LEVEL=INFO
	FIREBASE_CONFIG=

## How to deploy to hosting
This project is deployed to Google Cloud Run, with automatic builds triggered whenever changes are pushed to the main branch on GitHub. Below are the steps for future maintainers to redeploy, manage secrets, and add new project owners.

---
### Automatic Deployment (recommended)
Whenever code is merged into the main branch:
- GitHub triggers Cloud Build.
- Cloud Build creates a new container image.
- Cloud Run deploys the updated service.
- Traffic automatically switches to the new revision (if healthy).
No manual steps are required unless:
- Secrets are updated
- New Python dependencies are added
- Service accounts or permissions are changed
- Cloud Build fails

---
### Manual Deployment (if needed)
Redeployment can usually be done directly from the Services tab in Cloud Run by clicking "Edit & Deploy New Version."
If you need to force a redeployment, you can do it from the command line:
```bash
>>> pip install firebase-admin
>>> gcloud run deploy uocs-room-reservation --source .
```

Cloud Run will use the Procfile
```bash
>>> web: gunicorn -b 0.0.0.0:$PORT backend.app:app
```

---
### Secrets and Environment Variables
All production secrets are stored in Google Secret Manager and mounted into Cloud Run.

Updating a Secret:
- Go to Google Cloud Console → Security → Secret Manager.
- Click the secret.
- Add a New Version with updated content.
- Redeploy service (automatic if pushing to main, manual otherwise).

Cloud Run loads secrets via environment variables, which you can edit at:
- Cloud Run → uocs-room-reservation → Edit & Deploy → Variables & Secrets

---
### Managing Owners and Permissions

Add a New Owner:
1. Go to Google Cloud Console → IAM
2. Add their email
3. Grant:
	- Owner (recommended for simplicity)
	- OR Cloud Run Admin, Cloud Build Editor, Secret Manager Admin, Service Account User

---
### Redeployment Checklist

If you modify:
- Secrets → update in Secret Manager → redeploy
- Dependencies → update requirements.txt → push to main
- Start command → update Procfile → redeploy

&nbsp;

# Project directory structure
```text
├── .gitignore
├── README.md
├── backend/
│   ├── app.py
│   ├── auth_guard.py
│   ├── mailer_smtp.py
│   ├── serviceAccount.json
│   ├── config.py
│   │
│   ├── templates/
│   │   ├── index.html
│   │   ├── admin.html
│   │   ├── allbookings.html
│   │   ├── booking_confirmation_email.html
│   │   ├── calendar.html
│   │   ├── login.html
│   │   ├── map.html
│   │   ├── mybookings.html
│   │   └── _repeat_modal.html
│   │
│   ├── static/
│   │   ├── css/
│   │   │   ├── admin.css
│   │   │   ├── calendar.css
│   │   │   ├── login.css
│   │   │   ├── map.css
│   │   │   ├── mybookings.css
│   │   │   └── style.css
│   │   │
│   │   ├── js/
│   │   │   ├── admin.js
│   │   │   ├── allbookings.js
│   │   │   ├── bookings.js
│   │   │   ├── calendar.js
│   │   │   ├── esme_auth.js
│   │   │   ├── map.js
│   │   │   ├── mybookings.js
│   │   │   ├── repeat.js
│   │   │   ├── rooms.js
│   │   │   ├── script.js
│   │   │   ├── session-debug.js
│   │   │   └── timeSelect.js
│   │   │
│   │   ├── map_images/
│   │   │   ├── DESC_1.svg
│   │   │   ├── DESC_2.svg
│   │   │   └── DESC_3.svg
│   │   │
│   │   └── room_images/
│   │       ├── 127.JPG
│   │       ├── 160.JPG
│   │       ├── 200.JPG
│   │       ├── 220.JPG
│   │       ├── 258.JPG
│   │       ├── 260.JPG
│   │       └── 360.JPG
└── 
```
