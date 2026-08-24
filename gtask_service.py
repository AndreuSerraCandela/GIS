"""
Cliente GTask del backend (login automático con GTASK_USERNAME / GTASK_PASSWORD).

Separado del login de usuarios en el navegador: el singleton de este módulo no se
modifica cuando un usuario inicia o cierra sesión en la app.
"""
from config.config import Config
from gtask_auth import GTaskAuth

_backend_auth = GTaskAuth()
_backend_initialized = False


def init_backend_gtask_login() -> GTaskAuth:
    """Login automático al arrancar el servidor (credenciales en .env)."""
    global _backend_initialized
    if _backend_initialized:
        return _backend_auth

    username = (Config.GTASK_USERNAME or "").strip()
    password = Config.GTASK_PASSWORD or ""

    if username and password:
        result = _backend_auth.login(username, password)
        if result.get("success"):
            print(f"[GTask] Login automatico backend OK: {username}")
        else:
            print(
                f"[GTask] Login automatico backend fallo: "
                f"{result.get('error', 'Error desconocido')}"
            )
    else:
        print(
            "[GTask] GTASK_USERNAME / GTASK_PASSWORD no configurados; "
            "sin login automatico de backend"
        )

    _backend_initialized = True
    return _backend_auth


def get_backend_gtask_auth() -> GTaskAuth:
    if not _backend_initialized:
        init_backend_gtask_login()
    return _backend_auth


def ensure_backend_gtask_token() -> GTaskAuth:
    """Renueva el token del backend si ha caducado."""
    auth = get_backend_gtask_auth()
    if auth.is_token_valid():
        return auth

    username = (Config.GTASK_USERNAME or "").strip()
    password = Config.GTASK_PASSWORD or ""
    if username and password:
        result = auth.login(username, password)
        if not result.get("success"):
            print(
                f"[GTask] Re-login backend fallo: "
                f"{result.get('error', 'Error desconocido')}"
            )
    return auth


def backend_gtask_is_authenticated() -> bool:
    auth = ensure_backend_gtask_token()
    return auth.is_token_valid()


def get_backend_gtask_access_token() -> str:
    auth = ensure_backend_gtask_token()
    return auth.access_token or ""


def get_backend_gtask_user_id() -> str:
    auth = ensure_backend_gtask_token()
    if not auth.is_token_valid() or not auth.current_user:
        return ""
    uid = auth.current_user.get("_id") or auth.current_user.get("id")
    return str(uid).strip() if uid else ""
