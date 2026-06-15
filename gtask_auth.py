"""
Autenticación GTask (igual que en Incidencias / Rutas).
"""
import requests
import jwt
from datetime import datetime, timedelta

from gtask_config import get_gtask_url, get_gtask_headers, GTASK_CONFIG


class GTaskAuth:
    def __init__(self):
        self.current_user = None
        self.access_token = None
        self.token_expiry = None

    def login(self, username, password):
        try:
            login_data = {"username": username, "password": password}
            url = get_gtask_url("login")
            headers = get_gtask_headers()
            response = requests.post(
                url, headers=headers, json=login_data, timeout=GTASK_CONFIG["timeout"]
            )
            if response.status_code == 200:
                login_response = response.json()
                self.current_user = {
                    "_id": login_response["_id"],
                    "username": login_response["username"],
                    "email": login_response.get("email", ""),
                }
                self.access_token = login_response["access_token"]
                try:
                    decoded = jwt.decode(
                        self.access_token, options={"verify_signature": False}
                    )
                    exp = decoded.get("exp")
                    self.token_expiry = (
                        datetime.fromtimestamp(exp)
                        if exp
                        else datetime.now() + timedelta(hours=24)
                    )
                except Exception:
                    self.token_expiry = datetime.now() + timedelta(hours=24)
                return {"success": True, "message": "Login exitoso", "user": self.current_user}
            err = f"Error en login: {response.status_code}"
            try:
                err = response.json().get("message", err)
            except Exception:
                pass
            return {"success": False, "error": err}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Timeout en la conexión con GTask"}
        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "Error de conexión con GTask"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def is_token_valid(self):
        if not self.access_token or not self.token_expiry:
            return False
        if datetime.now() >= self.token_expiry:
            return False
        if datetime.now() >= (self.token_expiry - timedelta(minutes=5)):
            return False
        return True

    def logout(self):
        self.current_user = None
        self.access_token = None
        self.token_expiry = None
