import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./yerevan.db")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# The first owner account is created from these on startup when no users exist.
# ADMIN_TOKEN is accepted as the password for deployments made before accounts existed.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@yerevanrestaurant.nl").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD") or os.getenv("ADMIN_TOKEN") or "change-me"
ADMIN_NAME = os.getenv("ADMIN_NAME", "Owner")

SESSION_DAYS = int(os.getenv("SESSION_DAYS", "14"))
MAX_IMAGE_BYTES = 3 * 1024 * 1024

# Defaults for settings editable in the admin panel (stored in the database).
DEFAULT_SETTINGS = {
    "restaurant": {
        "name": "Yerevan",
        "address": "Kampstraat 22",
        "city": "Hilversum",
        "email": "info@yerevanrestaurant.nl",
        "phone": "",
    },
    # Weekday 0 = Monday. null = closed.
    "hours": [
        None,
        ["17:00", "22:00"],
        ["17:00", "22:00"],
        ["17:00", "22:00"],
        ["17:00", "23:00"],
        ["16:00", "23:00"],
        ["16:00", "22:00"],
    ],
    "slot_capacity": int(os.getenv("SLOT_CAPACITY", "40")),
    "slot_minutes": 30,
    "last_seating_minutes": 90,
    "max_party_size": 12,
    "booking_window_days": 90,
    "ordering_enabled": os.getenv("ORDERING_ENABLED", "false").lower() == "true",
}
