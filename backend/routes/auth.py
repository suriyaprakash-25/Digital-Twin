from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from bson.objectid import ObjectId
import datetime

# We will attach the db instance to our blueprint or import from app later.
# For simplicity and avoiding circular imports, we can pass db explicitly,
# or we can import the `db` instance from app.py. But since app.py imports auth.py
# it's better to get the db reference dynamically or from a separate db module.

# Let's create a db reference here by importing it from a shared module, or 
# we can just re-initialize the client or use current_app.
from flask import current_app

auth_bp = Blueprint("auth", __name__)

def get_db():
    from app import db
    return db

@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")
    
    if not all([name, email, password, role]):
        return jsonify({"msg": "All fields are required"}), 400
        
    db = get_db()
    users_collection = db["users"]
    
    # Check if user already exists
    if users_collection.find_one({"email": email}):
        return jsonify({"msg": "User already exists with this email"}), 400
        
    # Hash the password
    # we use bcrypt directly instead of werkzeug to match requirements exactly if needed, 
    # but werkzeug's generate_password_hash uses pbkdf2 by default. 
    # Let's use bcrypt specifically as per requirements
    import bcrypt
    
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    new_user = {
        "name": name,
        "email": email,
        "password": hashed_password.decode('utf-8'), # store as string
        "role": role,
        "createdAt": datetime.datetime.utcnow()
    }
    
    try:
        users_collection.insert_one(new_user)
        return jsonify({"msg": "User created successfully"}), 201
    except Exception as e:
        return jsonify({"msg": "Error creating user", "error": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    
    email = data.get("email")
    password = data.get("password")
    
    if not all([email, password]):
        return jsonify({"msg": "Email and password are required"}), 400
        
    db = get_db()
    users_collection = db["users"]
    
    user = users_collection.find_one({"email": email})
    
    if not user:
        return jsonify({"msg": "Invalid email or password"}), 401
        
    import bcrypt
    
    if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
        return jsonify({"msg": "Invalid email or password"}), 401
        
    # Create JWT token
    # We can store user role and id in the token
    additional_claims = {"role": user["role"]}
    access_token = create_access_token(identity=str(user["_id"]), additional_claims=additional_claims)
    
    return jsonify({
        "msg": "Login successful",
        "token": access_token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }), 200
