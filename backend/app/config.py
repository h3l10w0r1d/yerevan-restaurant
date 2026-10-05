import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./yerevan.db")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
ORDERING_ENABLED = os.getenv("ORDERING_ENABLED", "false").lower() == "true"

# Seating capacity per time slot (number of guests).
SLOT_CAPACITY = int(os.getenv("SLOT_CAPACITY", "40"))
MAX_PARTY_SIZE = 12

# Opening hours, weekday 0 = Monday. None = closed.
OPENING_HOURS = {
    0: None,
    1: ("17:00", "22:00"),
    2: ("17:00", "22:00"),
    3: ("17:00", "22:00"),
    4: ("17:00", "23:00"),
    5: ("16:00", "23:00"),
    6: ("16:00", "22:00"),
}
# Last reservation this many minutes before closing.
LAST_SEATING_MINUTES = 90
SLOT_MINUTES = 30
