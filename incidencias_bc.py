"""
Integración BC / GTask para incidencias en popups (misma lógica que Rutas).
"""
import json
import logging
import uuid
from urllib.parse import quote

import requests
from flask import request

from config.bc_incidencias import BC_CONFIG, get_bc_auth_header, get_bc_auth_credentials
from gtask_auth import GTaskAuth

_sessions = {}


def get_device_id():
    did = request.headers.get("X-Device-ID")
    if did:
        return did.strip()
    if request.is_json:
        did = (request.get_json() or {}).get("device_id")
        if did:
            return str(did)
    return str(uuid.uuid4())


def get_device_session():
    device_id = get_device_id()
    if device_id not in _sessions:
        _sessions[device_id] = {"user_data": None, "gtask_auth": GTaskAuth()}
    return _sessions[device_id]


def bc_post_json_text(endpoint_path: str, payload: dict, timeout=None):
    base_url = (BC_CONFIG.get("base_url") or "").rstrip("/")
    company = BC_CONFIG.get("company", "Malla Publicidad")
    url = f"{base_url}{endpoint_path}?company='{company}'"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    auth_header = get_bc_auth_header()
    auth_credentials = get_bc_auth_credentials() if not auth_header else None
    if auth_header:
        headers["Authorization"] = auth_header
    datos = {"jsonText": json.dumps(payload, ensure_ascii=False)}
    if timeout is None:
        timeout = BC_CONFIG.get("timeout", 120)
    response = requests.post(
        url,
        headers=headers,
        data=json.dumps(datos),
        auth=auth_credentials,
        timeout=timeout,
    )
    if response.status_code not in (200, 201):
        raise requests.HTTPError(
            f"BC {response.status_code}: {(response.text or '')[:500]}",
            response=response,
        )
    result_data = response.json()
    raw = result_data.get("value")
    if raw is None:
        return result_data if isinstance(result_data, dict) else {}
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return {}
        return json.loads(raw)
    if isinstance(raw, dict):
        return raw
    return {}


def bc_lista_incidencias_url():
    base_url = (BC_CONFIG.get("base_url") or "").rstrip("/")
    company = BC_CONFIG.get("company", "Malla Publicidad")
    entity = (BC_CONFIG.get("endpoint_lista_incidencias") or "ListaIncidencias").strip().lstrip("/")
    company_encoded = quote(company, safe="")
    if entity.lower().startswith("http"):
        return entity.rstrip("/")
    return f"{base_url}/ODataV4/Company('{company_encoded}')/{entity}"


def bc_document_no_from_lista_row(inc: dict) -> str:
    for key in ("No", "no", "No_", "DocumentNo", "documentNo", "noIncidencia"):
        val = inc.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


def get_gtask_user_id_from_session(sess) -> str:
    user = sess.get("user_data") or {}
    gtask_auth = sess.get("gtask_auth")
    if gtask_auth and gtask_auth.is_token_valid() and gtask_auth.current_user:
        user = gtask_auth.current_user
    uid = user.get("_id") or user.get("id")
    return str(uid).strip() if uid else ""


def get_open_incidences_for_resource(resource_id: str, gtask_user_id: str) -> list:
    if not resource_id or not gtask_user_id:
        return []

    lista_url = bc_lista_incidencias_url()
    headers = {"Accept": "application/json"}
    auth_header = get_bc_auth_header()
    auth_credentials = get_bc_auth_credentials() if not auth_header else None
    if auth_header:
        headers["Authorization"] = auth_header

    recurso_odata = str(resource_id).replace("'", "''")
    odata_filter = f"Estado eq 'Abierta' and Recurso eq '{recurso_odata}'"
    params = {"$filter": odata_filter}
    timeout = BC_CONFIG.get("timeout", 60)

    resp = requests.get(
        lista_url, headers=headers, params=params, auth=auth_credentials, timeout=timeout
    )
    if resp.status_code != 200:
        logging.warning(
            "ListaIncidencias %s para recurso %s: %s %s",
            lista_url,
            resource_id,
            resp.status_code,
            (resp.text or "")[:200],
        )
        return []

    incidencias = resp.json().get("value", [])
    user_id_str = str(gtask_user_id).strip()
    result = []
    for inc in incidencias:
        inc_user_id = str(
            inc.get("Id_Uduario_Gtask") or inc.get("Id_Usuario_Gtask") or ""
        ).strip()
        if inc_user_id != user_id_str:
            continue
        doc_no = bc_document_no_from_lista_row(inc)
        if not doc_no:
            continue
        result.append(
            {
                "documentNo": doc_no,
                "resource": str(inc.get("Recurso") or "").strip(),
                "description": (
                    inc.get("Descripcion")
                    or inc.get("descripcion")
                    or inc.get("Description")
                    or ""
                ),
                "fechaHora": inc.get("FechaHora")
                or inc.get("Fecha_Hora")
                or inc.get("fechaHora")
                or "",
            }
        )
    result.sort(key=lambda x: str(x.get("fechaHora") or ""), reverse=True)
    return result
