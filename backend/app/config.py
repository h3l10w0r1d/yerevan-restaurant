import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./yerevan.db")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# The first owner account is created from these on startup when no users exist.
# ADMIN_TOKEN is accepted as the password for deployments made before accounts existed.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@yerevanrestaurant.nl").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD") or os.getenv("ADMIN_TOKEN") or "change-me"
ADMIN_NAME = os.getenv("ADMIN_NAME", "Owner")

SESSION_DAYS = int(os.getenv("SESSION_DAYS", "14"))

# Email via Resend (https://resend.com). Without RESEND_API_KEY nothing is sent:
# emails are written to the email log as "skipped" so the rest of the app works unchanged.
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
EMAIL_FROM = os.getenv("EMAIL_FROM", "Yerevan Restaurant <reserveringen@yerevanrestaurant.nl>")
EMAIL_REPLY_TO = os.getenv("EMAIL_REPLY_TO", "")  # defaults to the restaurant email in Settings
SITE_URL = os.getenv("SITE_URL", "https://yerevan-restaurant.vercel.app").rstrip("/")
PASSWORD_LINK_HOURS = 72
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
    # Pre-opening: the site is live but the restaurant isn't open yet. The public menu is
    # hidden ("coming soon") and website reservations / orders are politely refused.
    "prelaunch": os.getenv("PRELAUNCH", "false").lower() == "true",
    "opening_date": "",  # optional YYYY-MM-DD, shown as "Opening on …"
    "notifications": {
        "guest_emails": True,  # booking received / confirmed / cancelled, order updates
        "staff_emails": True,  # alert the team about new web bookings and orders
        "staff_email": "",  # where staff alerts go; empty = restaurant email
    },
}
