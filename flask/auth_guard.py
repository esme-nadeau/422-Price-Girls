import os
from functools import wraps
from flask import request, jsonify
import firebase_admin
from firebase_admin import credentials, auth

# Initialize Admin SDK once
if not firebase_admin._apps:
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccount.json")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        "projectId": os.getenv("FIREBASE_PROJECT_ID")
    })

def require_firebase_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"error": "Missing Bearer token"}), 401
        token = header.split(" ", 1)[1]
        try:
            decoded = auth.verify_id_token(token)
            request.user = decoded
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return fn(*args, **kwargs)
    return wrapper
