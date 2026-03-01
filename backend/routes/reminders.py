from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import datetime
from bson.objectid import ObjectId
from dateutil import parser

reminders_bp = Blueprint("reminders", __name__)

def get_db():
    from app import db
    return db

def calculate_reminders_for_vehicle(vehicle, services):
    reminders = []
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Track items to calculate
    items = [
        {"key": "insuranceExpiry", "label": "Insurance Renewal"},
        {"key": "pucExpiry", "label": "PUC (Pollution) Renewal"},
        {"key": "rcExpiry", "label": "RC Expiry"},
        {"key": "fitnessExpiry", "label": "Fitness Certificate"}
    ]
    
    for item in items:
        expiry_date_str = vehicle.get(item["key"])
        if expiry_date_str:
            try:
                expiry_date = parser.parse(expiry_date_str)
                if expiry_date.tzinfo is None:
                    expiry_date = expiry_date.replace(tzinfo=datetime.timezone.utc)
                    
                days_remaining = (expiry_date - now).days
                
                status = "upcoming"
                priority = "low"
                
                if days_remaining < 0:
                    status = "overdue"
                    priority = "critical"
                elif days_remaining <= 15:
                    priority = "high"
                elif days_remaining <= 30:
                    priority = "medium"
                    
                # Only show reminders if they are overdue or within 60 days
                if days_remaining <= 60:
                    reminders.append({
                        "id": f"{vehicle['_id']}_{item['key']}",
                        "vehicleId": str(vehicle['_id']),
                        "vehicleName": f"{vehicle.get('brand')} {vehicle.get('model')}",
                        "vehicleNumber": vehicle.get('vehicleNumber'),
                        "title": item["label"],
                        "dueDate": expiry_date_str,
                        "daysRemaining": days_remaining,
                        "status": status,
                        "priority": priority,
                        "type": "legal"
                    })
            except Exception as e:
                print(f"Error parsing date {expiry_date_str}: {e}")
                pass
                
    # Check Service Recommendations
    latest_service_date = None
    recommended_date = None
    
    if services:
        services = sorted(services, key=lambda x: str(x.get("serviceDate", "")), reverse=True)
        latest_service = services[0]
        rec_date_str = latest_service.get("recommendedDate")
        
        if rec_date_str:
            recommended_date = rec_date_str
        else:
            try:
                # Fallback: 6 months from last service
                last_dt = parser.parse(latest_service.get("serviceDate"))
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=datetime.timezone.utc)
                next_dt = last_dt + datetime.timedelta(days=180)
                recommended_date = next_dt.strftime("%Y-%m-%d")
            except:
                pass
    else:
        # Fallback: 6 months from registration date or now
        try:
            reg_dt_str = vehicle.get("registrationDate")
            if reg_dt_str:
                reg_dt = parser.parse(reg_dt_str)
                if reg_dt.tzinfo is None:
                    reg_dt = reg_dt.replace(tzinfo=datetime.timezone.utc)
                next_dt = reg_dt + datetime.timedelta(days=180)
                recommended_date = next_dt.strftime("%Y-%m-%d")
            else:
                next_dt = now + datetime.timedelta(days=180)
                recommended_date = next_dt.strftime("%Y-%m-%d")
        except:
            pass
            
    if recommended_date:
        try:
            rec_dt = parser.parse(recommended_date)
            if rec_dt.tzinfo is None:
                rec_dt = rec_dt.replace(tzinfo=datetime.timezone.utc)
                
            days_remaining = (rec_dt - now).days
            status = "upcoming"
            priority = "low"
            
            if days_remaining < 0:
                status = "overdue"
                priority = "critical"
            elif days_remaining <= 15:
                priority = "high"
            elif days_remaining <= 30:
                priority = "medium"
                
            if days_remaining <= 60:
                reminders.append({
                    "id": f"{vehicle['_id']}_service",
                    "vehicleId": str(vehicle['_id']),
                    "vehicleName": f"{vehicle.get('brand')} {vehicle.get('model')}",
                    "vehicleNumber": vehicle.get('vehicleNumber'),
                    "title": "Scheduled Service Due",
                    "dueDate": recommended_date,
                    "daysRemaining": days_remaining,
                    "status": status,
                    "priority": priority,
                    "type": "service"
                })
        except:
            pass

    return reminders

@reminders_bp.route("", methods=["GET"])
@reminders_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_reminders():
    db = get_db()
    vehicles_collection = db["vehicles"]
    services_collection = db["services"]
    owner_id = get_jwt_identity()
    
    try:
        vehicles_cursor = vehicles_collection.find({
            "ownerId": owner_id,
            "isArchived": {"$ne": True}
        })
        
        all_reminders = []
        
        for vehicle in vehicles_cursor:
            services = list(services_collection.find({
                "vehicleId": str(vehicle["_id"]),
                "isArchived": {"$ne": True}
            }))
            
            vehicle_reminders = calculate_reminders_for_vehicle(vehicle, services)
            all_reminders.extend(vehicle_reminders)
            
        # Sort by days remaining (lowest first, means most urgent)
        all_reminders = sorted(all_reminders, key=lambda x: x["daysRemaining"])
        
        return jsonify(all_reminders), 200
        
    except Exception as e:
        return jsonify({"msg": "Error calculating reminders", "error": str(e)}), 500
