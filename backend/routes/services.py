from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import datetime
from bson.objectid import ObjectId

services_bp = Blueprint("services", __name__)

def get_db():
    from app import db
    return db

@services_bp.route("/add", methods=["POST"])
@jwt_required()
def add_service():
    data = request.get_json()
    
    # Core Validation
    vehicle_id = data.get("vehicleId")
    service_date = data.get("serviceDate")
    odometer_km = data.get("odometerKm")
    service_category = data.get("serviceCategory")
    service_type = data.get("serviceType")
    
    if not all([vehicle_id, service_date, odometer_km is not None, service_category, service_type]):
        return jsonify({"msg": "Core details (vehicle, date, odometer, category, type) are required"}), 400
        
    try:
        odometer_km = int(odometer_km)
    except ValueError:
        return jsonify({"msg": "Odometer reading must be a valid number"}), 400
        
    db = get_db()
    services_collection = db["services"]
    vehicles_collection = db["vehicles"]
    owner_id = get_jwt_identity()
    
    # Verify the vehicle exists and belongs to the user
    try:
        vehicle = vehicles_collection.find_one({"_id": ObjectId(vehicle_id), "ownerId": owner_id})
        if not vehicle:
            return jsonify({"msg": "Vehicle not found or unauthorized"}), 404
    except Exception as e:
         return jsonify({"msg": "Invalid vehicle ID"}), 400
         
    # Data Integrity Rules
    # Check previous services
    previous_services = list(services_collection.find({"vehicleId": vehicle_id}).sort("odometerKm", -1).limit(1))
    flagged_abnormal_jump = False
    
    if previous_services:
        last_km = int(previous_services[0].get("odometerKm", 0))
        if odometer_km < last_km:
            return jsonify({"msg": f"Odometer reading ({odometer_km} km) cannot be less than previous record ({last_km} km)"}), 400
        if odometer_km - last_km > 40000:
            flagged_abnormal_jump = True

    # Financials Calculation
    parts_replaced = data.get("partsReplaced", [])
    labor_cost = data.get("laborCost", 0)
    
    total_parts_cost = 0
    if isinstance(parts_replaced, list):
        for part in parts_replaced:
            try:
                total_parts_cost += float(part.get("cost", 0))
            except (ValueError, TypeError):
                pass
                
    try:
        labor_cost = float(labor_cost)
    except (ValueError, TypeError):
        labor_cost = 0.0
        
    total_cost = total_parts_cost + labor_cost
    
    # Save the record
    new_service = {
        # Core info
        "vehicleId": vehicle_id,
        "serviceDate": service_date,
        "odometerKm": odometer_km,
        "serviceCategory": service_category,
        "serviceType": service_type,
        
        # Work specifics
        "partsReplaced": parts_replaced,
        "laborCost": labor_cost,
        "totalCost": total_cost,
        "warrantyMonths": data.get("warrantyMonths"),
        "mechanicNotes": data.get("mechanicNotes"),
        
        # Provider specifics
        "garageName": data.get("garageName"),
        "location": data.get("location"),
        "verifiedService": data.get("verifiedService", False),
        
        # Recommendations
        "recommendedKm": data.get("recommendedKm"),
        "recommendedDate": data.get("recommendedDate"),
        
        # Integrity metadata
        "abnormalKmJump": flagged_abnormal_jump,
        "confidenceScore": 80 if flagged_abnormal_jump else 100,
        "createdAt": datetime.datetime.utcnow(),
        "ownerId": owner_id
    }
    
    try:
        services_collection.insert_one(new_service)
        return jsonify({"msg": "Service record added successfully"}), 201
    except Exception as e:
        return jsonify({"msg": "Error adding service record", "error": str(e)}), 500


@services_bp.route("/<vehicle_id>", methods=["GET"])
@jwt_required()
def get_services(vehicle_id):
    db = get_db()
    services_collection = db["services"]
    vehicles_collection = db["vehicles"]
    
    owner_id = get_jwt_identity()
    
    # Verify the vehicle exists and belongs to the user
    try:
        vehicle = vehicles_collection.find_one({"_id": ObjectId(vehicle_id), "ownerId": owner_id})
        if not vehicle:
            return jsonify({"msg": "Vehicle not found or unauthorized"}), 404
    except Exception as e:
         return jsonify({"msg": "Invalid vehicle ID"}), 400
    
    # Get services sorted by latest date
    services_cursor = services_collection.find({"vehicleId": vehicle_id}).sort("serviceDate", -1)
    services = []
    
    for s in services_cursor:
        services.append({
            "id": str(s["_id"]),
            "vehicleId": s.get("vehicleId"),
            "serviceDate": s.get("serviceDate"),
            "odometerKm": s.get("odometerKm") or s.get("mileage"), # backward compat
            "serviceCategory": s.get("serviceCategory", "Periodic Maintenance"),
            "serviceType": s.get("serviceType"),
            "partsReplaced": s.get("partsReplaced", []),
            "laborCost": s.get("laborCost", 0),
            "totalCost": s.get("totalCost") or s.get("cost"), # backward compat
            "warrantyMonths": s.get("warrantyMonths"),
            "mechanicNotes": s.get("mechanicNotes"),
            "garageName": s.get("garageName"),
            "location": s.get("location"),
            "verifiedService": s.get("verifiedService", False),
            "recommendedKm": s.get("recommendedKm"),
            "recommendedDate": s.get("recommendedDate"),
            "abnormalKmJump": s.get("abnormalKmJump", False),
            "createdAt": s.get("createdAt").isoformat() if s.get("createdAt") else None
        })
        
    return jsonify(services), 200
