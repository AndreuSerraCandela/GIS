"""
Dispositivo de confianza (solo móvil): tras un 2FA WhatsApp completo, omitir 2FA
en logins posteriores en el mismo navegador/dispositivo durante TRUSTED_DEVICE_DAYS.
"""
from __future__ import annotations

import os
import re
from typing import Any

from flask import Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

COOKIE_NAME = "gis_trusted_device"

TRUSTED_DEVICE_ENABLED = os.getenv("TRUSTED_DEVICE_ENABLED", "true").lower() in (
    "1",
    "true",
    "yes",
)
TRUSTED_DEVICE_DAYS = int(os.getenv("TRUSTED_DEVICE_DAYS", "90"))
TRUSTED_DEVICE_MOBILE_ONLY = os.getenv("TRUSTED_DEVICE_MOBILE_ONLY", "true").lower() in (
    "1",
    "true",
    "yes",
)

_MOBILE_UA_RE = re.compile(
    r"android|webos|iphone|ipod|ipad|blackberry|iemobile|opera mini|mobile",
    re.I,
)


def is_mobile_user_agent(user_agent: str | None) -> bool:
    return bool(_MOBILE_UA_RE.search(user_agent or ""))


def is_mobile_request(req: Request) -> bool:
    if (req.headers.get("X-Client-Mobile") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return True
    return is_mobile_user_agent(req.headers.get("User-Agent"))


def is_trusted_device_enabled() -> bool:
    return TRUSTED_DEVICE_ENABLED


def should_register_trusted_device(req: Request) -> bool:
    if not is_trusted_device_enabled():
        return False
    if TRUSTED_DEVICE_MOBILE_ONLY and not is_mobile_request(req):
        return False
    return True


def _serializer(secret_key: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret_key, salt="gis-trusted-device-v1")


def issue_trusted_token(
    secret_key: str,
    user_id: str,
    username: str,
    device_id: str,
) -> str:
    payload = {
        "uid": str(user_id or "").strip(),
        "usr": str(username or "").strip(),
        "did": str(device_id or "").strip(),
    }
    return _serializer(secret_key).dumps(payload)


def verify_trusted_token(
    secret_key: str,
    token: str | None,
    user_id: str,
    username: str,
    device_id: str,
) -> bool:
    if not token or not user_id or not username or not device_id:
        return False
    max_age = max(1, TRUSTED_DEVICE_DAYS) * 86400
    try:
        data: dict[str, Any] = _serializer(secret_key).loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return False
    return (
        str(data.get("uid") or "") == str(user_id)
        and str(data.get("usr") or "") == str(username)
        and str(data.get("did") or "") == str(device_id)
    )


def get_trusted_cookie(req: Request) -> str | None:
    return req.cookies.get(COOKIE_NAME)


def can_skip_2fa(
    req: Request,
    secret_key: str,
    user_id: str,
    username: str,
    device_id: str,
) -> bool:
    if not should_register_trusted_device(req):
        return False
    token = get_trusted_cookie(req)
    return verify_trusted_token(secret_key, token, user_id, username, device_id)


def attach_trusted_device_cookie(
    response: Response,
    secret_key: str,
    user_id: str,
    username: str,
    device_id: str,
) -> Response:
    if not user_id or not username or not device_id:
        return response
    from flask import has_request_context, request

    token = issue_trusted_token(secret_key, user_id, username, device_id)
    max_age = max(1, TRUSTED_DEVICE_DAYS) * 86400
    secure = False
    if has_request_context():
        secure = bool(
            request.is_secure
            or (request.headers.get("X-Forwarded-Proto") or "").lower() == "https"
        )
    if not secure:
        secure = os.getenv("GIS_COOKIE_SECURE", "").lower() in ("1", "true", "yes")
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=max_age,
        httponly=True,
        samesite="Lax",
        secure=secure,
    )
    return response


def clear_trusted_device_cookie(response: Response) -> Response:
    response.delete_cookie(COOKIE_NAME, samesite="Lax")
    return response
