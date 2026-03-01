from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import datetime
from bson.objectid import ObjectId
from collections import defaultdict
from dateutil import parser

analytics_bp = Blueprint("analytics", __name__)

def get_db():
    from app import db
    return db

@analytics_bp.route("", methods=["GET"])
@analytics_bp.route("/", methods=["GET"])
@jwt_required()
def get_dashboard_analytics():
    db = get_db()
    vehicles_collection = db["vehicles"]
    services_collection = db["services"]
    owner_id = get_jwt_identity()
    
    try:
        vehicles = list(vehicles_collection.find({
            "ownerId": owner_id,
            "isArchived": {"$ne": True}
        }))
        
        vehicle_ids = [str(v["_id"]) for v in vehicles]
        
        services = list(services_collection.find({
            "vehicleId": {"$in": vehicle_ids},
            "isArchived": {"$ne": True}
        }))
        
        # 1. Total Expenses Over Time (Monthly)
        expenses_by_month = defaultdict(float)
        
        # 2. Maintenance Frequency by Category
        category_counts = defaultdict(int)
        
        # 3. Accumulated Odometer Logic (Max reading per vehicle)
        total_fleet_km = 0
        fleet_km_by_vehicle = {}
        
        for v in vehicles:
            try:
                max_km = int(v.get("currentOdometerKm", 0) or 0)
            except (ValueError, TypeError):
                max_km = 0
                
            fleet_km_by_vehicle[str(v["_id"])] = {
                "name": f"{v.get('brand', '')} {v.get('variant', '')}".strip() or "Unknown Vehicle",
                "maxKm": max_km
            }
            
        for s in services:
            # Monthly Expenses
            try:
                s_date = parser.parse(s.get("serviceDate"))
                month_key = s_date.strftime("%Y-%m")
                cost = float(s.get("totalCost", 0) or 0)
                expenses_by_month[month_key] += cost
            except:
                pass
                
            # Categories
            cat = s.get("serviceCategory", "Other")
            category_counts[cat] += 1
            
            # Fleet Km check
            try:
                s_km = int(s.get("odometerKm", 0) or 0)
                v_id = s.get("vehicleId")
                if v_id in fleet_km_by_vehicle:
                    if s_km > fleet_km_by_vehicle[v_id]["maxKm"]:
                        fleet_km_by_vehicle[v_id]["maxKm"] = s_km
            except:
                pass
                
        # Format expense data for charts (sort chronologically)
        sorted_months = sorted(expenses_by_month.keys())
        expense_trend = [{"month": m, "cost": expenses_by_month[m]} for m in sorted_months]
        
        # Format category data for pie/bar chart
        category_distribution = [{"name": k, "value": v} for k, v in category_counts.items()]
        
        # Format Fleet Km
        total_fleet_km = sum(item["maxKm"] for item in fleet_km_by_vehicle.values())
        usage_distribution = [{"name": v["name"] or "Unknown", "km": v["maxKm"]} for v in fleet_km_by_vehicle.values() if v["maxKm"] > 0]
        
        return jsonify({
            "expenseTrend": expense_trend,
            "categoryDistribution": category_distribution,
            "totalFleetKm": total_fleet_km,
            "usageDistribution": usage_distribution,
            "totalVehicles": len(vehicles),
            "totalServices": len(services)
        }), 200

    except Exception as e:
        return jsonify({"msg": "Error generating analytics", "error": str(e)}), 500
