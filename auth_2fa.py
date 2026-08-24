"""

Doble autenticación GIS: código en pantalla + confirmación por WhatsApp (Apiwhats).

"""

from __future__ import annotations



import json

import os

import random

import threading

import uuid

from datetime import datetime, timedelta, timezone

from pathlib import Path

from typing import Any



import jwt

import requests



import whatsapp_client

from gtask_auth import GTaskAuth

from gtask_config import get_gtask_url, get_gtask_headers, GTASK_CONFIG



WHATSAPP_2FA_ENABLED = os.getenv("WHATSAPP_2FA_ENABLED", "true").lower() in (

    "1",

    "true",

    "yes",

)

PENDING_2FA_TTL_SECONDS = int(os.getenv("WHATSAPP_2FA_TTL_SECONDS", "600"))

PHONE_NOT_FOUND_ERROR = "Rellene telefono del usuario en gtask"

WHATSAPP_2FA_PROMPT_TEMPLATE = (

    os.getenv(

        "WHATSAPP_2FA_PROMPT_TEMPLATE",

        "GIS: Su codigo es {code}. Responda con este codigo para confirmar el acceso.",

    ).strip()

    or "GIS: Su codigo es {code}. Responda con este codigo para confirmar el acceso."

)

WHATSAPP_2FA_BUSINESS_PHONE = os.getenv("WHATSAPP_2FA_BUSINESS_PHONE", "").strip()

WHATSAPP_2FA_NOMBRE_OPERARIO = (

    os.getenv("WHATSAPP_2FA_NOMBRE_OPERARIO", "GIS").strip() or "GIS"

)



_STORE_PATH = Path(

    os.getenv(

        "WHATSAPP_2FA_STORE_PATH",

        str(Path(__file__).resolve().parent / "data" / "pending_2fa.json"),

    )

)



_PHONE_FIELD_NAMES = (

    "telefono",

    "Telefono",

    "phone",

    "Phone",

    "mobile",

    "Mobile",

    "movil",

    "Movil",

    "celular",

    "Celular",

    "whatsapp",

    "WhatsApp",

    "phoneNumber",

    "PhoneNumber",

    "numeroTelefono",

    "NumeroTelefono",

)



_lock = threading.Lock()





def is_2fa_enabled() -> bool:

    return WHATSAPP_2FA_ENABLED





def whatsapp_prompt_for_code(code: str) -> str:

    return WHATSAPP_2FA_PROMPT_TEMPLATE.format(code=str(code or "").strip())





def build_whatsapp_confirm_url(code: str) -> str | None:

    """Enlace wa.me para responder con el código prefilled (móvil)."""

    from urllib.parse import quote

    phone = normalize_phone(WHATSAPP_2FA_BUSINESS_PHONE)

    if not phone or not code:

        return None

    return f"https://wa.me/{phone}?text={quote(str(code).strip())}"





def normalize_phone(phone: str) -> str:

    digits = "".join(c for c in str(phone or "") if c.isdigit())

    if not digits:

        return ""

    if digits.startswith("00"):

        digits = digits[2:]

    return digits





def mask_phone(phone: str) -> str:

    digits = normalize_phone(phone)

    if len(digits) < 4:

        return "***"

    return f"***{digits[-4:]}"





def normalize_code(text: str) -> str:

    digits = "".join(c for c in str(text or "") if c.isdigit())

    return digits





def extract_phone_from_data(data: dict[str, Any] | None) -> str:

    if not data:

        return ""

    for key in _PHONE_FIELD_NAMES:

        val = data.get(key)

        if val is not None and str(val).strip():

            phone = normalize_phone(str(val))

            if len(phone) >= 9:

                return phone

    for val in data.values():

        if isinstance(val, dict):

            nested = extract_phone_from_data(val)

            if nested:

                return nested

    return ""





def _extract_phone_from_jwt(access_token: str) -> str:

    try:

        decoded = jwt.decode(access_token, options={"verify_signature": False})

        return extract_phone_from_data(decoded)

    except Exception:

        return ""





def fetch_gtask_user_profile(user_id: str, access_token: str) -> dict[str, Any] | None:

    if not user_id or not access_token:

        return None

    headers = get_gtask_headers(access_token)

    urls = [

        get_gtask_url("users", f"/{user_id}"),

        get_gtask_url("users"),

    ]

    for url in urls:

        try:

            response = requests.get(

                url, headers=headers, timeout=GTASK_CONFIG["timeout"]

            )

            if response.status_code != 200:

                continue

            data = response.json()

            if isinstance(data, dict):

                if data.get("_id") == user_id or str(data.get("_id")) == str(user_id):

                    return data

                for key in ("users", "Users", "data", "items", "results"):

                    items = data.get(key)

                    if isinstance(items, list):

                        for item in items:

                            if isinstance(item, dict) and str(item.get("_id")) == str(

                                user_id

                            ):

                                return item

                if any(k in data for k in ("username", "email", "telefono", "phone")):

                    return data

            elif isinstance(data, list):

                for item in data:

                    if isinstance(item, dict) and str(item.get("_id")) == str(user_id):

                        return item

        except Exception:

            continue

    return None





def resolve_user_phone(gtask_auth: GTaskAuth) -> str:

    user = gtask_auth.current_user or {}

    phone = extract_phone_from_data(user)

    if phone:

        return phone

    if gtask_auth.access_token:

        phone = _extract_phone_from_jwt(gtask_auth.access_token)

        if phone:

            return phone

    profile = fetch_gtask_user_profile(

        str(user.get("_id") or ""), gtask_auth.access_token or ""

    )

    return extract_phone_from_data(profile)





def _phones_match(expected: str, received: str) -> bool:

    a = normalize_phone(expected)

    b = normalize_phone(received)

    if not a or not b:

        return True

    if a == b:

        return True

    if a.endswith(b) or b.endswith(a):

        return True

    if len(a) > 2 and len(b) > 2 and (a[-9:] == b[-9:] or a[-8:] == b[-8:]):

        return True

    return False





def _now() -> datetime:

    return datetime.now(timezone.utc)





def _ensure_store_dir() -> None:

    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)





def _serialize_record(record: dict[str, Any]) -> dict[str, Any]:

    out = dict(record)

    for key in ("created_at", "verified_at"):

        val = out.get(key)

        if isinstance(val, datetime):

            out[key] = val.isoformat()

    return out





def _deserialize_record(data: dict[str, Any]) -> dict[str, Any]:

    out = dict(data)

    for key in ("created_at", "verified_at"):

        val = out.get(key)

        if isinstance(val, str):

            try:

                out[key] = datetime.fromisoformat(val)

            except Exception:

                pass

    return out





def _read_store_unlocked() -> dict[str, dict[str, Any]]:

    _ensure_store_dir()

    if not _STORE_PATH.exists():

        return {}

    try:

        raw = json.loads(_STORE_PATH.read_text(encoding="utf-8"))

        items = raw.get("challenges") if isinstance(raw, dict) else raw

        if not isinstance(items, dict):

            return {}

        return {

            str(k): _deserialize_record(v)

            for k, v in items.items()

            if isinstance(v, dict)

        }

    except Exception as exc:

        print(f"[2FA] Error leyendo almacen: {exc}")

        return {}





def _write_store_unlocked(store: dict[str, dict[str, Any]]) -> None:

    _ensure_store_dir()

    payload = {

        "version": 1,

        "challenges": {

            k: _serialize_record(v) for k, v in store.items()

        },

    }

    tmp = _STORE_PATH.with_suffix(".tmp")

    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    tmp.replace(_STORE_PATH)





def _purge_expired_unlocked(store: dict[str, dict[str, Any]]) -> None:

    cutoff = _now() - timedelta(seconds=PENDING_2FA_TTL_SECONDS)

    expired = [

        cid

        for cid, ch in store.items()

        if ch.get("created_at", cutoff) < cutoff

    ]

    for cid in expired:

        store.pop(cid, None)





def _generate_code() -> str:

    return f"{random.randint(0, 999999):06d}"





def _challenge_id() -> str:

    return f"GIS-2FA-{uuid.uuid4().hex[:12].upper()}"





def create_pending_2fa(

    gtask_auth: GTaskAuth, username: str

) -> tuple[dict[str, Any], str | None]:

    """

    Crea reto 2FA, envía WhatsApp y devuelve (info_para_cliente, error_whatsapp).

    """

    phone = resolve_user_phone(gtask_auth)

    if not phone:

        raise ValueError(PHONE_NOT_FOUND_ERROR)



    challenge_id = _challenge_id()

    code = _generate_code()

    token_expiry = None

    if gtask_auth.token_expiry:

        token_expiry = gtask_auth.token_expiry.isoformat()



    whatsapp_message = whatsapp_prompt_for_code(code)



    record = {

        "challenge_id": challenge_id,

        "code": code,

        "phone": phone,

        "username": username,

        "user_data": dict(gtask_auth.current_user or {}),

        "access_token": gtask_auth.access_token,

        "token_expiry": token_expiry,

        "created_at": _now(),

        "verified": False,

        "verified_at": None,

        "whatsapp_sent": False,

        "whatsapp_error": None,

    }



    whatsapp_error = None

    try:

        whatsapp_client.enviar_mensaje_con_webhook_adaptativo(

            phone,

            whatsapp_message,

            id_registro=challenge_id,

            nombre_operario=WHATSAPP_2FA_NOMBRE_OPERARIO,

        )

        record["whatsapp_sent"] = True

    except Exception as exc:

        whatsapp_error = str(exc)

        record["whatsapp_error"] = whatsapp_error

        print(f"[2FA] Error enviando WhatsApp a {mask_phone(phone)}: {exc}")



    with _lock:

        store = _read_store_unlocked()

        _purge_expired_unlocked(store)

        store[challenge_id] = record

        _write_store_unlocked(store)



    client_info = {

        "requires_2fa": True,

        "challenge_id": challenge_id,

        "verification_code": code,

        "masked_phone": mask_phone(phone),

        "whatsapp_sent": record["whatsapp_sent"],

        "whatsapp_error": whatsapp_error,

        "expires_in": PENDING_2FA_TTL_SECONDS,

        "whatsapp_confirm_url": build_whatsapp_confirm_url(code),

    }

    return client_info, whatsapp_error





def get_challenge(challenge_id: str) -> dict[str, Any] | None:

    key = (challenge_id or "").strip()

    if not key:

        return None

    with _lock:
        store = _read_store_unlocked()
        before = len(store)
        _purge_expired_unlocked(store)
        if len(store) != before:
            _write_store_unlocked(store)
        ch = store.get(key)
        return dict(ch) if ch else None





def _mark_verified(challenge_id: str) -> bool:

    with _lock:

        store = _read_store_unlocked()

        ch = store.get(challenge_id)

        if not ch or ch.get("verified"):

            return False

        ch["verified"] = True

        ch["verified_at"] = _now()

        store[challenge_id] = ch

        _write_store_unlocked(store)

        return True





def try_verify_code(

    challenge_id: str,

    code_input: str,

    telefono: str | None = None,

    *,

    require_phone_match: bool = True,

) -> bool:

    ch = get_challenge(challenge_id)

    if not ch or ch.get("verified"):

        return False

    expected = str(ch.get("code") or "")

    received = normalize_code(code_input)

    if not received or received != expected:

        return False

    if require_phone_match and telefono and not _phones_match(

        ch.get("phone", ""), telefono

    ):

        return False

    return _mark_verified(challenge_id)





def try_verify_by_phone(telefono: str, texto: str) -> str | None:

    """Busca reto pendiente por telefono+codigo. Devuelve challenge_id si verifica."""

    received = normalize_code(texto)

    if not received:

        return None

    with _lock:

        store = _read_store_unlocked()

        _purge_expired_unlocked(store)

        for cid, ch in store.items():

            if ch.get("verified"):

                continue

            if not _phones_match(ch.get("phone", ""), telefono):

                continue

            if str(ch.get("code") or "") != received:

                continue

            ch["verified"] = True

            ch["verified_at"] = _now()

            store[cid] = ch

            _write_store_unlocked(store)

            return cid

    return None





def try_verify_from_whatsapp(

    id_registro: str, telefono: str, texto: str

) -> str | None:

    """

    Verifica respuesta WhatsApp. Devuelve challenge_id verificado o None.

    """

    key = (id_registro or "").strip()

    if key and try_verify_code(

        key, texto, telefono, require_phone_match=False

    ):

        return key

    return try_verify_by_phone(telefono, texto)





def build_gtask_auth_from_challenge(challenge: dict[str, Any]) -> GTaskAuth:

    auth = GTaskAuth()

    auth.current_user = challenge.get("user_data")

    auth.access_token = challenge.get("access_token")

    expiry_raw = challenge.get("token_expiry")

    if expiry_raw:

        try:

            auth.token_expiry = datetime.fromisoformat(expiry_raw)

        except Exception:

            auth.token_expiry = datetime.now() + timedelta(hours=24)

    else:

        auth.token_expiry = datetime.now() + timedelta(hours=24)

    return auth





def clear_challenge(challenge_id: str) -> None:

    key = (challenge_id or "").strip()

    if not key:

        return

    with _lock:

        store = _read_store_unlocked()

        if key in store:

            store.pop(key, None)

            _write_store_unlocked(store)





def get_2fa_status(challenge_id: str) -> dict[str, Any]:

    ch = get_challenge(challenge_id)

    if not ch:

        return {

            "pending_2fa": False,

            "verified": False,

            "expired": True,

        }

    created = ch.get("created_at")

    remaining = 0

    if isinstance(created, datetime):

        expires_at = created + timedelta(seconds=PENDING_2FA_TTL_SECONDS)

        remaining = max(0, int((expires_at - _now()).total_seconds()))

    return {

        "pending_2fa": not ch.get("verified"),

        "verified": bool(ch.get("verified")),

        "expired": remaining <= 0 and not ch.get("verified"),

        "challenge_id": challenge_id,

        "verification_code": ch.get("code"),

        "masked_phone": mask_phone(ch.get("phone", "")),

        "whatsapp_sent": ch.get("whatsapp_sent"),

        "whatsapp_error": ch.get("whatsapp_error"),

        "expires_in": remaining,

        "whatsapp_confirm_url": build_whatsapp_confirm_url(str(ch.get("code") or "")),

    }





def resend_whatsapp(challenge_id: str) -> dict[str, Any]:

    ch = get_challenge(challenge_id)

    if not ch:

        raise ValueError("Reto de verificación expirado o no encontrado")

    if ch.get("verified"):

        raise ValueError("La verificación ya está completada")

    phone = ch.get("phone") or ""

    code = str(ch.get("code") or "")

    whatsapp_client.enviar_mensaje_con_webhook_adaptativo(

        phone,

        whatsapp_prompt_for_code(code),

        id_registro=challenge_id,

        nombre_operario=WHATSAPP_2FA_NOMBRE_OPERARIO,

    )

    with _lock:

        store = _read_store_unlocked()

        stored = store.get(challenge_id)

        if stored:

            stored["whatsapp_sent"] = True

            stored["whatsapp_error"] = None

            store[challenge_id] = stored

            _write_store_unlocked(store)

    return {

        "success": True,

        "masked_phone": mask_phone(phone),

        "whatsapp_sent": True,

        "whatsapp_confirm_url": build_whatsapp_confirm_url(code),

    }


