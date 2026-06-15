"""
Configuración Business Central e Incidencias (misma lógica que la app Rutas).
"""
import os
import warnings
from dotenv import load_dotenv

load_dotenv()

BUSINESS_CENTRAL_BASE_URL = os.getenv(
    "BUSINESS_CENTRAL_BASE_URL", "https://bc220.malla.es/powerbi"
)
BUSINESS_CENTRAL_API_KEY = os.getenv("BUSINESS_CENTRAL_API_KEY", "")
BUSINESS_CENTRAL_COMPANY = os.getenv("BUSINESS_CENTRAL_COMPANY", "Malla Publicidad")
BUSINESS_CENTRAL_USERNAME = os.getenv("BUSINESS_CENTRAL_USERNAME", "")
BUSINESS_CENTRAL_PASSWORD = os.getenv("BUSINESS_CENTRAL_PASSWORD", "")


def _env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name, "").strip().lower()
    return v in ("1", "true", "yes", "on") if v else default


BUSINESS_CENTRAL_NTLM_AUTH = _env_bool("BUSINESS_CENTRAL_NTLM_AUTH", False)

BC_CONFIG = {
    "base_url": BUSINESS_CENTRAL_BASE_URL,
    "endpoint_incidencia_gtask": os.getenv(
        "BUSINESS_CENTRAL_ENDPOINT_INCIDENCIA_GTASK",
        "/ODataV4/GtaskMalla_GetIncidenciaTareaGtask",
    ),
    "endpoint_lista_incidencias": os.getenv(
        "BUSINESS_CENTRAL_ENDPOINT_LISTA_INCIDENCIAS", "ListaIncidencias"
    ),
    "company": BUSINESS_CENTRAL_COMPANY,
    "credentials": {
        "username": BUSINESS_CENTRAL_USERNAME,
        "password": BUSINESS_CENTRAL_PASSWORD,
    },
    "timeout": int(os.getenv("BUSINESS_CENTRAL_TIMEOUT", "120")),
}

INCIDENCIAS_URL = os.getenv("INCIDENCIAS_URL", "https://incidencias.malla.es").rstrip("/")
GTASK_API_URL = os.getenv("GTASK_API_URL", "https://gtasks-api.deploy.malla.es").rstrip("/")


def get_bc_auth_header() -> str:
    if BUSINESS_CENTRAL_API_KEY:
        return f"Bearer {BUSINESS_CENTRAL_API_KEY}"
    return ""


def get_bc_auth_credentials():
    credentials = BC_CONFIG.get("credentials", {})
    username = credentials.get("username", BUSINESS_CENTRAL_USERNAME)
    password = credentials.get("password", BUSINESS_CENTRAL_PASSWORD)
    if BUSINESS_CENTRAL_NTLM_AUTH and username and password:
        try:
            from requests_ntlm import HttpNtlmAuth

            return HttpNtlmAuth(username, password)
        except ImportError:
            warnings.warn(
                "BUSINESS_CENTRAL_NTLM_AUTH activo pero falta requests-ntlm. Usando Basic auth.",
                UserWarning,
                stacklevel=2,
            )
    return (username, password)
