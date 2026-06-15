# Configuración para la API de GTask (igual que en Incidencias / Rutas)
from config.bc_incidencias import GTASK_API_URL

GTASK_CONFIG = {
    "base_url": GTASK_API_URL,
    "endpoints": {
        "login": "/user/login",
        "users": "/Users",
        "task": "/task",
    },
    "timeout": 30,
}


def get_gtask_url(endpoint, path_suffix=""):
    base = f"{GTASK_CONFIG['base_url']}{GTASK_CONFIG['endpoints'][endpoint]}"
    return base.rstrip("/") + path_suffix


def get_gtask_headers(access_token=None):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers
