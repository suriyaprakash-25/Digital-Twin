import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

class Config:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/mobility_digital_twin")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-mobility-key-2026")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
