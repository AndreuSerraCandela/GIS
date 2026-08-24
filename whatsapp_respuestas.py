"""
Almacén en memoria de respuestas WhatsApp recibidas vía webhook (PoC / doble auth).
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

_lock = threading.Lock()
_ultima_respuesta: dict[str, Any] | None = None
_por_id_registro: dict[str, dict[str, Any]] = {}
_por_telefono: dict[str, dict[str, Any]] = {}


def _ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def registrar_respuesta(payload: dict[str, Any]) -> dict[str, Any]:
    global _ultima_respuesta

    def _field(*keys: str) -> str:
        for key in keys:
            val = payload.get(key)
            if val is not None and str(val).strip():
                return str(val).strip()
        return ""

    telefono = _field("telefono", "Telefono", "from", "wa_id", "phone")
    texto = _field("texto", "Texto", "body", "mensaje", "Mensaje")
    id_registro = _field(
        "id_registro", "IdRegistro", "idRegistro", "identificador_registro"
    )
    registro = {
        "telefono": telefono,
        "texto": texto,
        "id_mensaje": payload.get("id_mensaje"),
        "id_registro": id_registro or None,
        "id_tabla": payload.get("id_tabla"),
        "enviado": payload.get("enviado"),
        "recibido_en": _ahora_iso(),
        "payload": payload,
    }
    with _lock:
        _ultima_respuesta = registro
        if telefono:
            _por_telefono[telefono] = registro
        if id_registro:
            _por_id_registro[id_registro] = registro
    return registro


def obtener_ultima_respuesta() -> dict[str, Any] | None:
    with _lock:
        return dict(_ultima_respuesta) if _ultima_respuesta else None


def obtener_respuesta_por_telefono(telefono: str) -> dict[str, Any] | None:
    digits = "".join(c for c in telefono if c.isdigit())
    with _lock:
        if digits in _por_telefono:
            return dict(_por_telefono[digits])
        if digits.startswith("34") and len(digits) > 2:
            short = digits[2:]
            for key, val in _por_telefono.items():
                if key.endswith(short) or short.endswith(key):
                    return dict(val)
    return None


def obtener_respuesta_por_id_registro(id_registro: str) -> dict[str, Any] | None:
    key = (id_registro or "").strip()
    if not key:
        return None
    with _lock:
        val = _por_id_registro.get(key)
        return dict(val) if val else None
