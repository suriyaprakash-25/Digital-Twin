import os
import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
from bson.objectid import ObjectId

garage_bp = Blueprint("garage", __name__)

def get_db():
    from app import db
    return db

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@garage_bp.route("/verify/<service_id>", methods=["POST"])
@jwt_required()
def verify_service(service_id):
    jwt_data = get_jwt()
    
    # Ideally, only users with 'Garage' role or specific permissions can do this
    # For now, we will allow it but log the user who verified it.
    verifier_id = get_jwt_identity()
    verifier_role = jwt_data.get("role", "Garage")
    
    db = get_db()
    services_collection = db["services"]
    vehicles_collection = db["vehicles"]
    
    try:
        service = services_collection.find_one({
            "_id": ObjectId(service_id),
            "isArchived": {"$ne": True}
        })
        
        if not service:
            return jsonify({"msg": "Service record not found"}), 404
            
        garage_reported_km = request.form.get("garageReportedKm")
        repair_severity = request.form.get("repairSeverity", "Normal")
        garage_notes = request.form.get("garageNotes", "")
        
        tamper_flag = False
        tamper_reasons = []
        
        if garage_reported_km:
            try:
                g_km = int(garage_reported_km)
                o_km = int(service.get("odometerKm", 0))
                # If there's a mismatch of more than 50km, flag it
                if abs(g_km - o_km) > 50:
                    tamper_flag = True
                    tamper_reasons.append(f"Odometer Mismatch: Owner reported {o_km}km, Garage reported {g_km}km")
            except ValueError:
                pass

        # Handle bill upload
        bill_url = service.get("billUrl")
        if 'billFile' in request.files:
            file = request.files['billFile']
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(f"bill_{service_id}_{file.filename}")
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                bill_url = f"/uploads/{filename}"

        # Update the service record
        update_data = {
            "verifiedService": True,
            "verificationStatus": "Verified" if not tamper_flag else "Flagged",
            "verifierId": verifier_id,
            "verifierRole": verifier_role,
            "garageReportedKm": garage_reported_km,
            "repairSeverity": repair_severity,
            "garageVerificationNotes": garage_notes,
            "tamperFlag": tamper_flag,
            "tamperReasons": tamper_reasons,
            "billUrl": bill_url,
            "verifiedAt": datetime.datetime.utcnow()
        }
        
        services_collection.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": update_data}
        )
        
        # Also mark the vehicle as having flagged records if tampering detected
        if tamper_flag:
            vehicles_collection.update_one(
                {"_id": ObjectId(service.get("vehicleId"))},
                {"$set": {"hasTamperFlags": True}}
            )

        return jsonify({
            "msg": "Service verified successfully", 
            "tamperDetected": tamper_flag,
            "tamperReasons": tamper_reasons
        }), 200

    except Exception as e:
        return jsonify({"msg": "Error verifying service", "error": str(e)}), 500


@garage_bp.route("/pending", methods=["GET"])
@jwt_required()
def get_pending_verifications():
    # In a real app, this would filter by the current Garage's ID
    # For demo purposes, we return all unverified services
    db = get_db()
    services_collection = db["services"]
    vehicles_collection = db["vehicles"]
    
    try:
        # Find unverified services
        pending_cursor = services_collection.find({
            "verifiedService": {"$ne": True},
            "isArchived": {"$ne": True}
        }).sort("serviceDate", -1)
        
        results = []
        for s in pending_cursor:
            # Need vehicle details for context
            vehicle = vehicles_collection.find_one({"_id": ObjectId(s.get("vehicleId"))})
            vehicle_info = "Unknown Vehicle"
            if vehicle:
                vehicle_info = f"{vehicle.get('brand')} {vehicle.get('model')} ({vehicle.get('vehicleNumber')})"
                
            results.append({
                "id": str(s["_id"]),
                "vehicleId": s.get("vehicleId"),
                "vehicleInfo": vehicle_info,
                "serviceDate": s.get("serviceDate"),
                "odometerKm": s.get("odometerKm"),
                "serviceCategory": s.get("serviceCategory"),
                "garageName": s.get("garageName"),
                "ownerId": s.get("ownerId")
            })
            
        return jsonify(results), 200
        
    except Exception as e:
        return jsonify({"msg": "Error fetching pending verifications", "error": str(e)}), 500
