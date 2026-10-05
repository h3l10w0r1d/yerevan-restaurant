import json
from pathlib import Path
from typing import Dict

MENU_PATH = Path(__file__).parent / "data" / "menu.json"


def load_menu() -> dict:
    with MENU_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def item_index() -> Dict[str, dict]:
    return {item["id"]: item for cat in load_menu()["categories"] for item in cat["items"]}
