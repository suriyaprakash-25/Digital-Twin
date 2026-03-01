from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import datetime
from bson.objectid import ObjectId
from dateutil import parser
from routes.health import calculate_vehicle_health

resale_bp = Blueprint("resale", __name__)

def get_db():
    from app import db
    return db

def calculate_resale_report(vehicle, services):
    # 1. Base the initial depreciation on age and original price
    try:
        purchase_price = float(vehicle.get("purchasePrice", 0))
    except (ValueError, TypeError):
        purchase_price = 0

    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Calculate age in years
    age_years = 0
    mfg_year = vehicle.get("manufacturingYear")
    if mfg_year:
        try:
            age_years = now.year - int(mfg_year)
        except:
            pass
            
    # Simple depreciation model: 15% first year, 10% subsequent years
    depreciation_factor = 1.0
    if age_years > 0:
        depreciation_factor *= 0.85
        if age_years > 1:
            depreciation_factor *= (0.90 ** (age_years - 1))
            
    base_value = purchase_price * depreciation_factor
    
    # 2. Trust Score Calculation (Starts at 100)
    trust_score = 100
    trust_factors = []
    
    # Check ownership
    try:
        owners = int(vehicle.get("ownershipCount", 1))
        if owners > 1:
            penalty = (owners - 1) * 5
            trust_score -= penalty
            trust_factors.append({ "type": "negative", "reason": f"Multiple owners ({owners})" })
    except:
        pass
        
    # Process Services for Trust & Value Impact
    verified_services_count = 0
    major_accidents_count = 0
    
    for s in services:
        if s.get("verifiedService"):
            verified_services_count += 1
            
        notes = str(s.get("mechanicNotes", "")).lower()
        cat = str(s.get("serviceCategory", "")).lower()
        if "accident" in notes or "crash" in notes or "major" in cat:
            major_accidents_count += 1
            
    # Apply service trust factors
    if verified_services_count > 0:
        trust_score += min(verified_services_count * 5, 15)
        trust_factors.append({ "type": "positive", "reason": f"Verified service history ({verified_services_count} records)" })
        
    if major_accidents_count > 0:
        trust_score -= (major_accidents_count * 15)
        base_value *= 0.8  # Further 20% depreciation for accidents
        trust_factors.append({ "type": "negative", "reason": f"Major accident/repair history" })
        
    if not services:
        trust_score -= 20
        trust_factors.append({ "type": "negative", "reason": "No service records available" })
        
    # Include Base Health Engine logic
    health_data = calculate_vehicle_health(vehicle, services)
    health_score = health_data.get("healthScore", 100)
    
    # Adjust value based on health
    if health_score >= 85:
        base_value *= 1.05 # 5% premium for excellent health
        trust_factors.append({ "type": "positive", "reason": "Excellent vehicle condition" })
    elif health_score < 70:
        base_value *= 0.9 # 10% penalty for poor health
        
    # Cap trust score
    trust_score = max(0, min(100, trust_score))
    
    # Output Range
    min_value = int(base_value * 0.95)
    max_value = int(base_value * 1.05)
    
    # Define Risk Level
    if trust_score >= 85:
        risk_level = "Low"
    elif trust_score >= 65:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "vehicleId": str(vehicle.get("_id")),
        "originalPrice": purchase_price,
        "estimatedValueRange": {
            "min": min_value,
            "max": max_value,
            "mean": int(base_value)
        },
        "trustScore": trust_score,
        "trustFactors": trust_factors,
        "maintenanceQuality": health_data.get("conditionLevel", "Good"),
        "riskLevel": risk_level,
        "ageYears": age_years
    }


@resale_bp.route("/<vehicle_id>", methods=["GET"])
@jwt_required()
def get_resale_report(vehicle_id):
    db = get_db()
    vehicles_collection = db["vehicles"]
    services_collection = db["services"]
    owner_id = get_jwt_identity()
    
    try:
        # Verify ownership
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
        
        # Calculate Resale Data
        report_data = calculate_resale_report(vehicle, services)
        
        return jsonify(report_data), 200
        
    except Exception as e:
        return jsonify({"msg": "Error generating resale report", "error": str(e)}), 500
