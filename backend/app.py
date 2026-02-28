from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from pymongo import MongoClient
from config import Config
import os

# Initialize Flask App
app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS
CORS(app)

# Configure Upload Folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize JWT
jwt = JWTManager(app)

# Initialize MongoDB
client = MongoClient(app.config["MONGO_URI"])
db = client.get_database() # Uses the database specified in the connection string

# Import and register blueprints
def register_blueprints(app):
    from routes.auth import auth_bp
    from routes.vehicles import vehicles_bp
    from routes.services import services_bp
    
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(vehicles_bp, url_prefix="/api/vehicles")
    app.register_blueprint(services_bp, url_prefix="/api/services")

# We register blueprints here once they are created
register_blueprints(app)

@app.route("/")
def index():
    return "Mobility Digital Twin API is running!"

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
