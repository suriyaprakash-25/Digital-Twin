from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import datetime
from bson.objectid import ObjectId
from dateutil import parser

health_bp = Blueprint("health", __name__)

def get_db():
    from app import db
    return db

def calculate_vehicle_health(vehicle, services):
    score = 100
    behavior_notes = []
    
    # Current date for comparisons
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Expiries Analysis
    expired_count = 0
    for key, name in [("insuranceExpiry", "Insurance"), ("pucExpiry", "PUC"), ("rcExpiry", "RC"), ("fitnessExpiry", "Fitness")]:
        expiry_date_str = vehicle.get(key)
        if expiry_date_str:
            try:
                # Handle naive and aware datetimes gracefully
                parsed_date = parser.parse(expiry_date_str)
                if parsed_date.tzinfo is None:
                    parsed_date = parsed_date.replace(tzinfo=datetime.timezone.utc)
                    
                if parsed_date < now:
                    expired_count += 1
                    behavior_notes.append(f"{name} is expired.")
            except:
                pass
                
    if expired_count > 0:
        penalty = expired_count * 10
        score -= penalty
        
    # 2. Service Analysis
    if not services:
        score -= 20
        behavior_notes.append("No service records found.")
    else:
        # Sort by latest date
        services = sorted(services, key=lambda x: str(x.get("serviceDate", "")), reverse=True)
        latest_service = services[0]
        
        # Check if overdue
        try:
            latest_date_str = latest_service.get("serviceDate")
            latest_date = parser.parse(latest_date_str)
            if latest_date.tzinfo is None:
                latest_date = latest_date.replace(tzinfo=datetime.timezone.utc)
                
            months_since_service = (now - latest_date).days / 30.0
            if months_since_service > 6:
                score -= 15
                behavior_notes.append("Overdue for service (> 6 months).")
        except:
            pass
            
        # Check verified garage services
        verified_services = [s for s in services if s.get("verifiedService") is True]
        if len(verified_services) > 0:
            score += min(len(verified_services) * 5, 15) # Cap bonus at 15
            behavior_notes.append(f"Consistent verified maintenance ({len(verified_services)} records).")
            
        # Check for accidents/major repairs in notes or types
        major_issues = 0
        for s in services:
            notes = str(s.get("mechanicNotes", "")).lower()
            cat = str(s.get("serviceCategory", "")).lower()
            if "accident" in notes or "crash" in notes or "major" in cat:
                major_issues += 1
                
        if major_issues > 0:
            penalty = major_issues * 15
            score -= penalty
            behavior_notes.append(f"History of major accident/repair detected.")
            
        # Check for frequent repairs (e.g. 3 repairs within last 3 months)
        recent_services = 0
        for s in services:
            try:
                s_date = parser.parse(s.get("serviceDate"))
                if s_date.tzinfo is None:
                    s_date = s_date.replace(tzinfo=datetime.timezone.utc)
                if (now - s_date).days < 90 and str(s.get("serviceCategory", "")).lower() in ["repair", "breakdown"]:
                    recent_services += 1
            except:
                pass
                
        if recent_services >= 2:
            score -= 20
            behavior_notes.append("Frequent recent repairs detected indicating instability.")

    # Base score clamping
    score = max(0, min(100, score))
    
    # Condition Level
    if score >= 85:
        condition = "Excellent"
    elif score >= 70:
        condition = "Good"
    elif score >= 50:
        condition = "Fair"
    else:
        condition = "Poor"
        
    return {
        "healthScore": score,
        "conditionLevel": condition,
        "maintenanceBehavior": behavior_notes if len(behavior_notes) > 0 else ["Standard usage patterns."]
    }

@health_bp.route("/<vehicle_id>", methods=["GET"])
@jwt_required()
def get_vehicle_health(vehicle_id):
    db = get_db()
    vehicles_collection = db["vehicles"]
    services_collection = db["services"]
    owner_id = get_jwt_identity()
    
    try:
        vehicle = vehicles_collection.find_one({
            "_id": ObjectId(vehicle_id),
            "ownerId": owner_id,
            "isArchived": {"$ne": True}
        })
        
        if not vehicle:
            return jsonify({"msg": "Vehicle not found"}), 404
            
        services_cursor = services_collection.find({
            "vehicleId": vehicle_id,
            "isArchived": {"$ne": True}
        })
        services = list(services_cursor)
        
        # Calculate Health
        health_data = calculate_vehicle_health(vehicle, services)
        
        return jsonify(health_data), 200
        
    except Exception as e:
        return jsonify({"msg": "Error calculating vehicle health", "error": str(e)}), 500
