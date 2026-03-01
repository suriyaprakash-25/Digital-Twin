from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import datetime
import os
from bson.objectid import ObjectId
from werkzeug.utils import secure_filename
from dateutil import parser

vehicles_bp = Blueprint("vehicles", __name__)

def get_db():
    from app import db
    return db

@vehicles_bp.route("/add", methods=["POST"])
@jwt_required()
def add_vehicle():
    data = request.form
    
    # Core/Identity
    vehicle_number = data.get("vehicleNumber")
    model = data.get("model")
    year = data.get("year")
    fuel_type = data.get("fuelType")
    brand = data.get("brand")
    variant = data.get("variant")
    vehicle_type = data.get("vehicleType")
    color = data.get("color")
    registration_date = data.get("registrationDate")
    registered_rto = data.get("registeredRTO")
    
    # Ownership
    owner_name = data.get("ownerName")
    phone = data.get("phone")
    ownership_count = data.get("ownershipCount")
    purchase_date = data.get("purchaseDate")
    purchase_price = data.get("purchasePrice")
    
    # Legal
    insurance_provider = data.get("insuranceProvider")
    insurance_expiry = data.get("insuranceExpiry")
    puc_expiry = data.get("pucExpiry")
    rc_expiry = data.get("rcExpiry")
    road_tax_valid_till = data.get("roadTaxValidTill")
    fitness_expiry = data.get("fitnessExpiry")
    
    # Verification
    chassis_number = data.get("chassisNumber")
    engine_number = data.get("engineNumber")
    
    # Usage
    current_odometer_km = data.get("currentOdometerKm")
    average_monthly_km = data.get("averageMonthlyKm", 0)
    
    if not all([vehicle_number, model, year, fuel_type]):
        return jsonify({"msg": "Vehicle number, model, year, and fuel type are required"}), 400
        
    # Validations
    try:
        if year:
            year_int = int(year)
            current_year = datetime.datetime.now().year
            if year_int < 1900 or year_int > current_year + 1:
                return jsonify({"msg": "Manufacturing year must be a valid year"}), 400
        
        # Expiry Date validations
        now = datetime.datetime.now()
        for date_str, name in [
            (insurance_expiry, "Insurance Expiry"), 
            (puc_expiry, "PUC Expiry"), 
            (rc_expiry, "RC Expiry"), 
            (road_tax_valid_till, "Road Tax Valid Till"), 
            (fitness_expiry, "Fitness Expiry")
        ]:
            if date_str:
                parsed_date = parser.parse(date_str)
                # Compare only dates
                if parsed_date.date() < now.date():
                    return jsonify({"msg": f"{name} must be a future date"}), 400
    except ValueError:
        return jsonify({"msg": "Invalid date or number format"}), 400
        
    db = get_db()
    vehicles_collection = db["vehicles"]
    
    # Check if vehicle already exists
    if vehicles_collection.find_one({"vehicleNumber": vehicle_number}):
        return jsonify({"msg": "Vehicle with this number already exists"}), 400
        
    owner_id = get_jwt_identity()
    
    # Handle File Upload
    rc_book_filename = None
    if 'rcBook' in request.files:
        file = request.files['rcBook']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            # Create a unique filename using timestamp
            unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            rc_book_filename = unique_filename
    
    new_vehicle = {
        # Identity
        "vehicleNumber": vehicle_number,
        "brand": brand,
        "model": model,
        "variant": variant,
        "vehicleType": vehicle_type,
        "fuelType": fuel_type,
        "color": color,
        "manufacturingYear": year_int if year else None,
        "registrationDate": registration_date,
        "registeredRTO": registered_rto,
        
        # Ownership
        "ownerName": owner_name,
        "phone": phone,
        "ownershipCount": int(ownership_count) if ownership_count else 1,
        "purchaseDate": purchase_date,
        "purchasePrice": float(purchase_price) if purchase_price else None,
        
        # Legal
        "insuranceProvider": insurance_provider,
        "insuranceExpiry": insurance_expiry,
        "pucExpiry": puc_expiry,
        "rcExpiry": rc_expiry,
        "roadTaxValidTill": road_tax_valid_till,
        "fitnessExpiry": fitness_expiry,
        
        # Verification
        "chassisNumber": chassis_number,
        "engineNumber": engine_number,
        "rcBookUrl": f"/uploads/{rc_book_filename}" if rc_book_filename else None,
        
        # Usage
        "currentOdometerKm": int(current_odometer_km) if current_odometer_km else 0,
        "averageMonthlyKm": int(average_monthly_km) if average_monthly_km else 0,
        
        # Audit & Data Integrity
        "ownerId": owner_id,
        "createdBy": owner_id,
        "role": get_jwt().get("role", "Vehicle Owner"),
        "verificationStatus": "Pending",
        "isArchived": False,
        "createdAt": datetime.datetime.utcnow()
    }
    
    try:
        vehicles_collection.insert_one(new_vehicle)
        return jsonify({"msg": "Vehicle added successfully"}), 201
    except Exception as e:
        return jsonify({"msg": "Error adding vehicle", "error": str(e)}), 500


@vehicles_bp.route("/myvehicles", methods=["GET"])
@jwt_required()
def get_my_vehicles():
    db = get_db()
    vehicles_collection = db["vehicles"]
    
    owner_id = get_jwt_identity()
    
    # Filter out soft-deleted (archived) vehicles
    vehicles_cursor = vehicles_collection.find({"ownerId": owner_id, "isArchived": {"$ne": True}})
    vehicles = []
    
    for v in vehicles_cursor:
        vehicles.append({
            "id": str(v["_id"]),
            "vehicleNumber": v.get("vehicleNumber"),
            "brand": v.get("brand"),
            "model": v.get("model"),
            "variant": v.get("variant"),
            "vehicleType": v.get("vehicleType"),
            "year": v.get("manufacturingYear") or v.get("year"), # Backward compatibility
            "fuelType": v.get("fuelType"),
            "color": v.get("color"),
            "registrationDate": v.get("registrationDate"),
            "registeredRTO": v.get("registeredRTO"),
            "ownerName": v.get("ownerName"),
            "phone": v.get("phone"),
            "ownershipCount": v.get("ownershipCount"),
            "purchaseDate": v.get("purchaseDate"),
            "purchasePrice": v.get("purchasePrice"),
            "insuranceProvider": v.get("insuranceProvider"),
            "insuranceExpiry": v.get("insuranceExpiry"),
            "pucExpiry": v.get("pucExpiry"),
            "rcExpiry": v.get("rcExpiry"),
            "roadTaxValidTill": v.get("roadTaxValidTill"),
            "fitnessExpiry": v.get("fitnessExpiry"),
            "chassisNumber": v.get("chassisNumber"),
            "engineNumber": v.get("engineNumber"),
            "currentOdometerKm": v.get("currentOdometerKm"),
            "averageMonthlyKm": v.get("averageMonthlyKm"),
            "ownerId": v.get("ownerId"),
            "rcBookUrl": v.get("rcBookUrl"),
            "verificationStatus": v.get("verificationStatus", "Pending"),
            "isArchived": v.get("isArchived", False),
            "createdAt": v.get("createdAt").isoformat() if v.get("createdAt") else None
        })
        
    return jsonify(vehicles), 200

@vehicles_bp.route("/<vehicle_id>", methods=["PUT"])
@jwt_required()
def edit_vehicle(vehicle_id):
    try:
        data = request.form
        # Extract all fields similar to add_vehicle
        update_data = {}
        for key in ["vehicleNumber", "brand", "model", "variant", "vehicleType", 
                    "fuelType", "color", "registrationDate", "registeredRTO", 
                    "ownerName", "phone", "purchaseDate", "insuranceProvider", 
                    "insuranceExpiry", "pucExpiry", "rcExpiry", "roadTaxValidTill", 
                    "fitnessExpiry", "chassisNumber", "engineNumber"]:
            if key in data:
                update_data[key] = data.get(key)
                
        # Handle int/float specific fields
        if "year" in data and data.get("year"): update_data["manufacturingYear"] = int(data.get("year"))
        if "ownershipCount" in data and data.get("ownershipCount"): update_data["ownershipCount"] = int(data.get("ownershipCount"))
        if "purchasePrice" in data and data.get("purchasePrice"): update_data["purchasePrice"] = float(data.get("purchasePrice"))
        if "currentOdometerKm" in data and data.get("currentOdometerKm"): update_data["currentOdometerKm"] = int(data.get("currentOdometerKm"))
        if "averageMonthlyKm" in data and data.get("averageMonthlyKm"): update_data["averageMonthlyKm"] = int(data.get("averageMonthlyKm"))

        
        db = get_db()
        vehicles_collection = db["vehicles"]
        owner_id = get_jwt_identity()
        
        # Verify ownership and not archived
        vehicle = vehicles_collection.find_one({
            "_id": ObjectId(vehicle_id), 
            "ownerId": owner_id,
            "isArchived": {"$ne": True}
        })
        if not vehicle:
            return jsonify({"msg": "Vehicle not found or unauthorized"}), 404
            
        vehicle_number = update_data.get("vehicleNumber")
        
        # Check if new vehicle number conflicts with another vehicle
        if vehicle_number and vehicle_number != vehicle.get("vehicleNumber"):
            if vehicles_collection.find_one({"vehicleNumber": vehicle_number}):
                return jsonify({"msg": "Vehicle with this number already exists"}), 400
        
        # Handle File Upload for RC Book Update
        if 'rcBook' in request.files:
            file = request.files['rcBook']
            if file and file.filename != '':
                # Delete old file if exists
                old_rc_url = vehicle.get("rcBookUrl")
                if old_rc_url:
                    old_filename = old_rc_url.split("/")[-1]
                    old_path = os.path.join(current_app.config['UPLOAD_FOLDER'], old_filename)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                
                filename = secure_filename(file.filename)
                unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(filepath)
                update_data["rcBookUrl"] = f"/uploads/{unique_filename}"
                
        if update_data:
            vehicles_collection.update_one(
                {"_id": ObjectId(vehicle_id)},
                {"$set": update_data}
            )
            
        return jsonify({"msg": "Vehicle updated successfully"}), 200
    except Exception as e:
        return jsonify({"msg": "Error updating vehicle", "error": str(e)}), 500

@vehicles_bp.route("/<vehicle_id>", methods=["DELETE"])
@jwt_required()
def delete_vehicle(vehicle_id):
    try:
        db = get_db()
        vehicles_collection = db["vehicles"]
        services_collection = db["services"]
        owner_id = get_jwt_identity()
        
        # Verify ownership
        vehicle = vehicles_collection.find_one({"_id": ObjectId(vehicle_id), "ownerId": owner_id})
        if not vehicle:
            return jsonify({"msg": "Vehicle not found or unauthorized"}), 404
            
        # Soft delete related services
        services_collection.update_many(
            {"vehicleId": vehicle_id},
            {"$set": {"isArchived": True}}
        )
        
        # Soft delete vehicle
        vehicles_collection.update_one(
            {"_id": ObjectId(vehicle_id)},
            {"$set": {"isArchived": True}}
        )
        
        return jsonify({"msg": "Vehicle archived successfully"}), 200
    except Exception as e:
        return jsonify({"msg": "Error archiving vehicle", "error": str(e)}), 500
