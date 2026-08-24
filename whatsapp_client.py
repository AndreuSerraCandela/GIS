"""
Cliente HTTP hacia Apiwhats (meta.malla.es) para envío y recepción vía webhook.
"""
from __future__ import annotations

import os
from typing import Any

import requests

APIWHATS_BASE_URL = os.getenv(
    "APIWHATS_BASE_URL", "https://meta.malla.es"
).rstrip("/")
APIWHATS_SECRET_TOKEN = (os.getenv("APIWHATS_SECRET_TOKEN") or "").strip()
GIS_PUBLIC_URL = (os.getenv("GIS_PUBLIC_URL") or "").rstrip("/")
WHATSAPP_WEBHOOK_API_KEY = (os.getenv("WHATSAPP_WEBHOOK_API_KEY") or "").strip()
WHATSAPP_REENGAGEMENT_NOMBRE = (
    os.getenv("WHATSAPP_2FA_NOMBRE_OPERARIO", "GIS").strip() or "GIS"
)
WHATSAPP_REENGAGEMENT_PLANTILLA = (
    os.getenv("WHATSAPP_2FA_PLANTILLA_REENGAGEMENT") or ""
).strip() or None


def _headers() -> dict[str, str]:
    h = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if APIWHATS_SECRET_TOKEN:
        h["Authorization"] = f"Bearer {APIWHATS_SECRET_TOKEN}"
    return h


def callback_respuesta_url() -> str:
    if not GIS_PUBLIC_URL:
        raise ValueError(
            "GIS_PUBLIC_URL no configurada; necesaria para recibir respuestas WhatsApp"
        )
    return f"{GIS_PUBLIC_URL}/api/whatsapp/respuesta"


def _build_payload(
    telefono: str,
    mensaje: str,
    *,
    plantilla_nombre: str | None = None,
    plantilla_idioma: str | None = None,
    plantilla_parametros_cuerpo: list[str] | None = None,
    nombre_operario: str | None = None,
    diferir_texto_tras_plantilla: bool | None = None,
    id_registro: str | None = None,
    webhook_url: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "TelefonoDestino": telefono,
        "Mensaje": mensaje,
    }
    if plantilla_nombre:
        payload["PlantillaNombre"] = plantilla_nombre
    if plantilla_idioma:
        payload["PlantillaIdioma"] = plantilla_idioma
    if plantilla_parametros_cuerpo:
        payload["PlantillaParametrosCuerpo"] = plantilla_parametros_cuerpo
    if nombre_operario:
        payload["NombreOperario"] = nombre_operario
    if diferir_texto_tras_plantilla is not None:
        payload["DiferirTextoTrasPlantilla"] = diferir_texto_tras_plantilla
    if id_registro:
        payload["IdRegistro"] = id_registro
    if webhook_url:
        payload["WebhookRespuesta"] = webhook_url
    return payload


def _post_json(url: str, payload: dict[str, Any]) -> tuple[dict[str, Any], requests.Response]:
    r = requests.post(url, json=payload, headers=_headers(), timeout=60)
    data = r.json() if r.content else {}
    return data, r


def _http_error(response: requests.Response, data: dict[str, Any]) -> requests.HTTPError:
    err = data.get("detail") or data.get("detalle") or response.text
    return requests.HTTPError(f"Apiwhats {response.status_code}: {err}", response=response)


def _is_reengagement_param_error(exc: BaseException) -> bool:
    text = str(exc)
    return any(
        marker in text
        for marker in (
            "132000",
            "Number of parameters does not match",
            "localizable_params",
        )
    )


def enviar_mensaje(
    telefono: str,
    mensaje: str,
    *,
    plantilla_nombre: str | None = None,
    plantilla_idioma: str | None = None,
    plantilla_parametros_cuerpo: list[str] | None = None,
    nombre_operario: str | None = None,
    diferir_texto_tras_plantilla: bool | None = None,
) -> dict[str, Any]:
    url = f"{APIWHATS_BASE_URL}/enviar"
    payload = _build_payload(
        telefono,
        mensaje,
        plantilla_nombre=plantilla_nombre,
        plantilla_idioma=plantilla_idioma,
        plantilla_parametros_cuerpo=plantilla_parametros_cuerpo,
        nombre_operario=nombre_operario,
        diferir_texto_tras_plantilla=diferir_texto_tras_plantilla,
    )
    r = requests.post(url, json=payload, headers=_headers(), timeout=60)
    data = r.json() if r.content else {}
    if not r.ok:
        raise _http_error(r, data)
    return data


def _enviar_webhook_payload(payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{APIWHATS_BASE_URL}/enviar-webhook"
    data, r = _post_json(url, payload)
    if not r.ok:
        raise _http_error(r, data)
    return data


def enviar_mensaje_con_webhook(
    telefono: str,
    mensaje: str,
    *,
    id_registro: str | None = None,
    webhook_url: str | None = None,
    plantilla_nombre: str | None = None,
    plantilla_idioma: str | None = None,
    plantilla_parametros_cuerpo: list[str] | None = None,
    nombre_operario: str | None = None,
    diferir_texto_tras_plantilla: bool | None = None,
) -> dict[str, Any]:
    """Envía mensaje y registra callback para leer la respuesta del usuario."""
    hook = (webhook_url or callback_respuesta_url()).strip()
    payload = _build_payload(
        telefono,
        mensaje,
        plantilla_nombre=plantilla_nombre,
        plantilla_idioma=plantilla_idioma,
        plantilla_parametros_cuerpo=plantilla_parametros_cuerpo,
        nombre_operario=nombre_operario,
        diferir_texto_tras_plantilla=diferir_texto_tras_plantilla,
        id_registro=id_registro,
        webhook_url=hook,
    )
    return _enviar_webhook_payload(payload)


def enviar_mensaje_con_webhook_adaptativo(
    telefono: str,
    mensaje: str,
    *,
    id_registro: str | None = None,
    webhook_url: str | None = None,
    nombre_operario: str | None = None,
    plantilla_reengagement: str | None = None,
) -> dict[str, Any]:
    """
    Intenta texto libre (ventana 24h abierta). Si Apiwhats exige plantilla de
    re-engagement (error 132000), envía plantilla con parámetro y deja el texto
    para cuando el usuario responda (DiferirTextoTrasPlantilla).
    """
    hook = (webhook_url or callback_respuesta_url()).strip()
    payload_texto = _build_payload(
        telefono,
        mensaje,
        id_registro=id_registro,
        webhook_url=hook,
    )
    try:
        return _enviar_webhook_payload(payload_texto)
    except requests.HTTPError as exc:
        if not _is_reengagement_param_error(exc):
            raise

    operario = (nombre_operario or WHATSAPP_REENGAGEMENT_NOMBRE).strip() or "GIS"
    plantilla = (plantilla_reengagement or WHATSAPP_REENGAGEMENT_PLANTILLA) or None
    print(
        f"[WhatsApp] Fuera de ventana 24h: plantilla re-engagement "
        f"({plantilla or 'auto'}) y texto diferido para ***{telefono[-4:]}"
    )
    payload_plantilla = _build_payload(
        telefono,
        mensaje,
        id_registro=id_registro,
        webhook_url=hook,
        nombre_operario=operario,
        plantilla_nombre=plantilla,
        diferir_texto_tras_plantilla=True,
    )
    return _enviar_webhook_payload(payload_plantilla)


def verificar_webhook_entrante(auth_header: str | None) -> bool:
    """Valida Bearer del callback saliente de Apiwhats (si está configurado)."""
    if not WHATSAPP_WEBHOOK_API_KEY:
        return True
    if not auth_header:
        return False
    token = auth_header.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token == WHATSAPP_WEBHOOK_API_KEY
