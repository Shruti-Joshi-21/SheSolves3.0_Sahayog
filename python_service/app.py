import os
import tempfile
import requests
import numpy as np
from io import BytesIO
from PIL import Image
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient

# Load .env from this file's directory (works even if cwd is project root)
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BASE_DIR, ".env"))

try:
    import face_recognition

    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    face_recognition = None  # noqa: F841
    FACE_RECOGNITION_AVAILABLE = False
    print("WARNING: face_recognition not installed.")
    print("Using mock verification (always match=True)")

app = Flask(__name__)
CORS(app)

_mongo_client = None


def get_mongo_db():
    """Shared MongoDB handle (same URI/DB as Node mongoose: dbName sevasetu, collection users)."""
    global _mongo_client
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI is not set")
    if _mongo_client is None:
        _mongo_client = MongoClient(uri)
    db_name = os.environ.get("MONGODB_DB_NAME", "sevasetu")
    return _mongo_client[db_name]


def _safe_unlink(path):
    if not path:
        return
    try:
        os.unlink(path)
    except OSError:
        pass


def load_image_from_url(url):
    """Fetch an image from a URL and return it as a numpy array for face_recognition."""
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    img_pil = Image.open(BytesIO(resp.content)).convert("RGB")
    return np.array(img_pil)


@app.route("/health", methods=["GET"])
def health():
    try:
        mode = "real" if FACE_RECOGNITION_AVAILABLE else "mock"
        return jsonify({"status": "ok", "mode": mode}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/register-face", methods=["POST"])
def register_face():
    """Compute face encoding from a Cloudinary image URL. Node passes imageUrl."""
    try:
        if not request.is_json:
            return jsonify({"success": False, "message": "JSON body required"}), 400

        data = request.get_json(silent=True) or {}
        image_url = data.get("imageUrl")
        if not image_url or not isinstance(image_url, str):
            return jsonify({"success": False, "message": "imageUrl is required"}), 400

        if not FACE_RECOGNITION_AVAILABLE:
            return jsonify({"success": True, "encoding": [0.1] * 128}), 200

        try:
            image = load_image_from_url(image_url)
        except Exception as fetch_err:
            return jsonify({"success": False, "message": f"Failed to fetch image: {fetch_err}"}), 400

        encodings = face_recognition.face_encodings(image)
        if len(encodings) == 0:
            return jsonify({"success": False, "message": "No face detected"}), 400

        encoding = encodings[0].astype(np.float64).tolist()
        return jsonify({"success": True, "encoding": encoding}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/verify-face", methods=["POST"])
def verify_face():
    temp_path = None
    try:
        if not FACE_RECOGNITION_AVAILABLE:
            return (
                jsonify(
                    {
                        "match": True,
                        "confidence": 1.0,
                        "mock": True,
                        "distance": 0.0,
                        "reason": "face_recognition library not available",
                    }
                ),
                200,
            )

        if "image" not in request.files or not request.files["image"]:
            return (
                jsonify(
                    {
                        "match": False,
                        "confidence": 0.0,
                        "distance": 0.0,
                        "reason": "No image file",
                    }
                ),
                200,
            )

        user_id = request.form.get("userId")
        if not user_id:
            return (
                jsonify(
                    {
                        "match": False,
                        "confidence": 0.0,
                        "distance": 0.0,
                        "reason": "userId required",
                    }
                ),
                200,
            )

        image_file = request.files["image"]
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        temp_path = tmp.name
        tmp.close()
        image_file.save(temp_path)

        try:
            oid = ObjectId(str(user_id))
        except InvalidId:
            _safe_unlink(temp_path)
            temp_path = None
            return (
                jsonify(
                    {
                        "match": False,
                        "confidence": 0.0,
                        "distance": 0.0,
                        "reason": "Invalid userId",
                    }
                ),
                200,
            )

        db = get_mongo_db()
        user = db.users.find_one({"_id": oid}, {"faceEncoding": 1})

        if not user or user.get("faceEncoding") is None:
            _safe_unlink(temp_path)
            temp_path = None
            return (
                jsonify(
                    {
                        "match": False,
                        "confidence": 0.0,
                        "distance": 0.0,
                        "reason": "No face registered for this user",
                    }
                ),
                200,
            )

        raw_enc = user["faceEncoding"]

        # Handle both list-of-floats (JSON array stored by register-face)
        # and legacy binary blobs
        if isinstance(raw_enc, list):
            stored_encoding = np.array(raw_enc, dtype=np.float64)
        else:
            stored_bytes = bytes(raw_enc)
            stored_encoding = np.frombuffer(stored_bytes, dtype=np.float32).astype(
                np.float64
            )

        if stored_encoding.size != 128:
            _safe_unlink(temp_path)
            temp_path = None
            return (
                jsonify(
                    {
                        "match": False,
                        "confidence": 0.0,
                        "distance": 0.0,
                        "reason": "Invalid stored encoding",
                    }
                ),
                200,
            )

        uploaded_image = face_recognition.load_image_file(temp_path)
        face_locations = face_recognition.face_locations(uploaded_image)

        if not face_locations:
            _safe_unlink(temp_path)
            temp_path = None
            return (
                jsonify(
                    {
                        "match": False,
                        "confidence": 0.0,
                        "distance": 0.0,
                        "reason": "No face detected in image",
                    }
                ),
                200,
            )

        live_encoding = face_recognition.face_encodings(uploaded_image, face_locations)[0]
        tolerance = float(os.environ.get("FACE_TOLERANCE", "0.5"))
        results = face_recognition.compare_faces(
            [stored_encoding], live_encoding, tolerance=tolerance
        )
        distance = float(
            face_recognition.face_distance([stored_encoding], live_encoding)[0]
        )
        match = bool(results[0])
        confidence = round(max(0.0, min(1.0, 1.0 - distance)), 3)

        _safe_unlink(temp_path)
        temp_path = None

        return (
            jsonify(
                {
                    "match": match,
                    "confidence": confidence,
                    "distance": round(distance, 3),
                    "reason": "",
                }
            ),
            200,
        )
    except Exception as e:
        _safe_unlink(temp_path)
        return (
            jsonify(
                {
                    "match": False,
                    "confidence": 0.0,
                    "distance": 0.0,
                    "reason": str(e),
                }
            ),
            200,
        )
    finally:
        _safe_unlink(temp_path)


if __name__ == "__main__":
    app.run(port=5001, debug=True)