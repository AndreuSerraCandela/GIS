"""Verificación de tokens SSO emitidos por appdesktop."""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any

import jwt

from gtask_auth import GTaskAuth

SSO_ISSUER = "appdesktop"
SSO_AUDIENCE = "gis"
MALLA_SSO_SECRET = (os.getenv("MALLA_SSO_SECRET") or "").strip()
SSO_LOGIN_ENABLED = os.getenv("SSO_LOGIN_ENABLED", "true").lower() in (
    "1",
    "true",
    "yes",
)
APPDESKTOP_URL = (os.getenv("APPDESKTOP_URL") or "https://apps.malla.es").strip().rstrip("/")


def is_sso_enabled() -> bool:
    return SSO_LOGIN_ENABLED and bool(MALLA_SSO_SECRET)


def sso_launch_url() -> str:
    return f"{APPDESKTOP_URL}/api/auth/sso/launch?app=gis"


def verify_exchange_token(token: str) -> dict[str, Any]:
    if not MALLA_SSO_SECRET:
        raise ValueError("SSO no configurado en GIS (MALLA_SSO_SECRET)")
    raw = (token or "").strip()
    if not raw:
        raise ValueError("Token SSO requerido")
    payload = jwt.decode(
        raw,
        MALLA_SSO_SECRET,
        algorithms=["HS256"],
        audience=SSO_AUDIENCE,
        issuer=SSO_ISSUER,
    )
    username = (payload.get("gtask_username") or "").strip()
    access_token = (payload.get("access_token") or "").strip()
    if not username or not access_token:
        raise ValueError("Token SSO incompleto")
    return payload


def build_gtask_auth_from_sso(payload: dict[str, Any]) -> GTaskAuth:
    auth = GTaskAuth()
    auth.access_token = payload.get("access_token")
    user_id = str(payload.get("sub") or "").strip()
    username = (payload.get("gtask_username") or "").strip()
    auth.current_user = {
        "_id": user_id or username,
        "username": username,
    }
    try:
        decoded = jwt.decode(
            auth.access_token,
            options={"verify_signature": False},
        )
        exp = decoded.get("exp")
        auth.token_expiry = (
            datetime.fromtimestamp(exp)
            if exp
            else datetime.now() + timedelta(hours=24)
        )
    except Exception:
        auth.token_expiry = datetime.now() + timedelta(hours=24)
    return auth
