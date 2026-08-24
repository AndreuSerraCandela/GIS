#!/usr/bin/env python3
"""Prueba de envío WhatsApp vía Apiwhats (meta.malla.es)."""
import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

APIWHATS_BASE = os.getenv("APIWHATS_BASE_URL", "https://meta.malla.es").rstrip("/")
API_SECRET = (os.getenv("APIWHATS_SECRET_TOKEN") or "").strip()
TELEFONO = os.getenv("WHATSAPP_TEST_PHONE", "34651049109")
CALLBACK = (os.getenv("GIS_PUBLIC_URL") or "").rstrip("/") + "/api/whatsapp/respuesta"
USAR_WEBHOOK = os.getenv("WHATSAPP_TEST_USE_WEBHOOK", "1").lower() in ("1", "true", "yes")


def headers():
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if API_SECRET:
        h["Authorization"] = f"Bearer {API_SECRET}"
    return h


def main():
    mensaje = (
        "Prueba GIS: responde a este mensaje con cualquier texto "
        "para comprobar que recibimos tu respuesta."
    )
    if USAR_WEBHOOK and CALLBACK.startswith("http"):
        url = f"{APIWHATS_BASE}/enviar-webhook"
        payload = {
            "TelefonoDestino": TELEFONO,
            "Mensaje": mensaje,
            "WebhookRespuesta": CALLBACK,
            "IdRegistro": "GIS-TEST-001",
        }
        print(f"POST {url}")
        print(f"Callback: {CALLBACK}")
    else:
        url = f"{APIWHATS_BASE}/enviar"
        payload = {
            "TelefonoDestino": TELEFONO,
            "Mensaje": mensaje,
        }
        print(f"POST {url} (sin callback; respuestas solo en logs de Apiwhats)")

    print(f"Teléfono: {TELEFONO}")
    print(f"Payload: {json.dumps(payload, ensure_ascii=False)}")

    try:
        r = requests.post(url, json=payload, headers=headers(), timeout=60)
    except requests.RequestException as e:
        print(f"Error de red: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"HTTP {r.status_code}")
    try:
        print(json.dumps(r.json(), indent=2, ensure_ascii=False))
    except Exception:
        print(r.text[:2000])
    sys.exit(0 if r.ok else 1)


if __name__ == "__main__":
    main()
