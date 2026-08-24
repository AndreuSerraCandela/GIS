# Gis - app

AutoCodex debe leer este fichero antes de tocar este repositorio.

## Objetivo del repositorio
Aplicacion web GIS interna de Malla. Permite consultar recursos y mobiliario de
SQL Server, representarlos en Leaflet, filtrar campanas, buscar elementos por
proximidad o direccion, consultar incidencias y exportar resultados. El acceso
se autentica contra GTask y admite SSO, segundo factor por WhatsApp y dispositivos
moviles de confianza.

## Arquitectura y estructura
- Es un monolito Python/Flask: `main.py` crea la aplicacion, renderiza la interfaz
  y expone la API REST. No hay un frontend Node/Vite separado.
- `templates/index.html`: unica plantilla principal; carga Leaflet desde CDN y
  los recursos estaticos locales.
- `static/js/app.js`: logica del mapa, filtros, busquedas, popups, exportacion y
  flujos de autenticacion. Consume la API con rutas relativas `/api/...`.
- `static/css/style.css` y `static/images/`: estilos y recursos visuales.
- `config/config.py` y `config/database.py`: configuracion Flask y conexion ODBC
  a SQL Server. `config/api_keys.py` configura geocodificacion y
  `config/bc_incidencias.py` las integraciones de incidencias/Business Central.
- `gtask_auth.py`, `gtask_service.py` e `incidencias_bc.py`: autenticacion GTask,
  sesion del backend e integracion con incidencias.
- `auth_2fa.py`, `whatsapp_client.py`, `whatsapp_respuestas.py`,
  `trusted_device.py` y `sso_auth.py`: SSO, 2FA WhatsApp y dispositivo de
  confianza.
- `wsgi.py` y `web.config`: entrada de produccion para IIS mediante
  HttpPlatformHandler y Waitress.
- `convertir_coordenadas.py` y los ficheros `Coordenadas*`: utilidad y datos de
  conversion de coordenadas; no forman parte del arranque web.
- `IIS_SETUP.md`, `IIS_TROUBLESHOOTING.md`, `INSTRUCCIONES_SERVIDOR.md`,
  `GEOCODING_SETUP.md` y `VISTAS_README.md`: documentacion operativa adicional.

## Rutas importantes
- `/`: interfaz principal.
- `/api/login`, `/api/logout`, `/api/auth-status`, `/api/auth/sso/*` y
  `/api/auth/2fa/*`: autenticacion, SSO y segundo factor.
- `/api/recursos`, `/api/mobiliario`, `/api/campanas`, `/api/empresas`,
  `/api/familias` y `/api/tipos-recurso`: datos y filtros principales.
- `/api/recursos-cerca*`, `/api/mobiliario-cerca*`,
  `/api/geocodificar-*`, `/api/parada` y `/api/tipos-lugares`: proximidad y
  geocodificacion.
- `/api/incidencias*`, `/api/incidencia-gtask` y rutas de detalle de recursos o
  mobiliario: integracion operativa con incidencias y GTask.
- `/api/exportar-excel`: genera la descarga Excel; `/api/health` comprueba que
  Flask responde.
- Casi toda la API requiere una sesion autenticada. Antes de modificar una ruta,
  revisar `PUBLIC_ROUTES`, `PUBLIC_ROUTE_PREFIXES` y `verificar_autenticacion()`
  en `main.py`.

## Instalacion, scripts y verificacion
- Crear y activar un entorno virtual e instalar dependencias con
  `python -m pip install -r requirements.txt`.
- Copiar `.env.example` a `.env` y configurar SQL Server, Flask, GTask, SSO,
  Apiwhats/WhatsApp, Business Central y geocodificacion segun el entorno. No
  versionar `.env` ni credenciales nuevas.
- Arranque heredado: `python main.py` levanta Flask en `0.0.0.0:5016`; el puerto
  esta fijado en el bloque principal y no usa actualmente `Config.PORT`.
- Arranque manual de la API en el puerto requerido por AutoCodex, fuera de su
  modo desarrollo gestionado:
  `python -m flask --app main run --host 0.0.0.0 --port 5174`.
- Comprobaciones sin servicios externos: `python -m compileall -q .` y revision
  de las rutas Flask. `test_connection.py`, `test_wsgi.py`, `test_iis.py` y
  `scripts/test_whatsapp_envio.py` son comprobaciones manuales, no una suite
  aislada; algunas acceden a SQL Server, IIS o servicios externos.
- `pytest`, `black` y `flake8` se mencionan en el README, pero no estan declarados
  como dependencias activas ni hay configuracion de esas herramientas.

## Desarrollo local: app 5173 y API 5174
- AutoCodex debe mantener la API Flask en `0.0.0.0:5174` y publicar la app en
  `0.0.0.0:5173`.
- Como este repositorio es monolitico y el frontend usa `/api/...`, el endpoint
  de la app en `5173` debe actuar como proxy hacia Flask en `5174`, incluyendo
  tanto `/` y `/static/*` como `/api/*`. El repositorio no incluye todavia ese
  proxy ni un servidor frontend independiente.
- Si en el futuro se separa el frontend con Vite, arrancarlo explicitamente con
  `--host 0.0.0.0 --port 5173`, configurar el proxy de `/api` hacia
  `http://127.0.0.1:5174` o definir `VITE_API_URL` con la direccion publica
  correcta de la API, y adaptar las llamadas del cliente para usarla.
- En CapRover/Docker comprobar que estan publicados host `5173` -> contenedor
  `5173` y host `5174` -> contenedor `5174`. Una URL accesible desde el navegador
  no debe apuntar a `127.0.0.1` salvo que el navegador este dentro del mismo
  contenedor.
- Verificar desde el contenedor con `curl -i http://127.0.0.1:5174/api/health`
  (sin sesion puede responder `401`, porque no es una ruta publica) y, cuando
  exista el proxy, `curl http://127.0.0.1:5173/`; despues probar ambas direcciones
  publicadas.
- En modo desarrollo administrado por AutoCodex no sustituir sus procesos por
  servidores lanzados desde una sesion temporal ni ejecutar el despliegue.

## Despliegue
- No existe `package.json`, script `npm run deploy`, Dockerfile ni configuracion
  de CapRover en este repositorio.
- El despliegue existente es para Windows/IIS. `web.config` inicia `wsgi.py` con
  HttpPlatformHandler; `wsgi.py` expone `main.app` con Waitress en el puerto
  asignado por `HTTP_PLATFORM_PORT`.
- En el servidor: instalar `requirements.txt` con el mismo Python configurado en
  `web.config`, crear el `.env`, dar permisos de escritura a `logs/`, revisar la
  ruta absoluta de Python y reiniciar el sitio/IIS. Consultar
  `INSTRUCCIONES_SERVIDOR.md` e `IIS_SETUP.md` antes de operar.
- Si se incorpora CapRover/Docker, documentar y versionar primero el mecanismo de
  build/arranque y el proxy 5173 -> 5174; no asumir que ya existe.

## Datos y servicios externos
- La base principal de este proyecto es SQL Server mediante `pyodbc`. Las vistas
  y tablas esperadas estan descritas en `VISTAS_README.md` y en las consultas de
  `main.py`.
- Regla obligatoria aunque MongoDB no sea la base actual: no manipular MongoDB
  directamente. Si hay que leer, corregir o migrar datos en MongoDB, crear un
  endpoint temporal en la API, desplegar, ejecutarlo, borrar el endpoint y volver
  a desplegar.
- Aplicar el mismo nivel de cautela a escrituras en SQL Server. Existen rutas de
  prueba capaces de actualizar coordenadas; no ejecutarlas como simple prueba de
  salud y validar siempre el entorno y el objetivo antes de usarlas.
- El import de `main.py` inicia el login de servicio GTask, por lo que incluso
  algunas comprobaciones de carga pueden hacer llamadas externas.

## Notas importantes
- Mantener este contexto centrado en este repositorio concreto y actualizarlo si
  cambia la arquitectura, el arranque o el despliegue.
- La interfaz depende de Leaflet cargado desde CDN y de servicios externos de
  geocodificacion, GTask, Business Central y Apiwhats; los fallos de red pueden
  producir resultados parciales aunque Flask siga sano.
- Hay valores sensibles o con aspecto de credencial en ficheros de configuracion
  ya versionados. No copiarlos a documentacion ni a respuestas; para cambios
  futuros, mover secretos a variables de entorno y rotarlos mediante el canal
  operativo correspondiente.
- El repositorio contiene `__pycache__` y logs versionados y no tiene
  `.gitignore`; evitar ampliar ese ruido en cambios futuros.

## Desarrollo local con AutoCodex
<!-- autocodex-development-mode-guidance -->
- El modo desarrollo debe arrancar la app en el puerto `5173` y la API en el puerto `5174`.
- Al iniciar el modo desarrollo, la API cierra primero cualquier proceso que escuche en los puertos `5173` o `5174` para evitar choques de arranque.
- AutoCodex gestiona y mantiene vivos los procesos del modo desarrollo. No sustituirlos por procesos lanzados desde una sesion temporal de Codex; en Vite hay que usar explicitamente `--host 0.0.0.0 --port 5173` porque la variable `HOST` no cambia su interfaz de escucha.
- Antes de probar desde fuera, comprobar que CapRover/Docker publica los puertos correctos hacia el contenedor donde AutoCodex ejecuta los comandos: host `5173` -> container `5173` y host `5174` -> container `5174`.
- En la app/frontend, comprobar que la URL de API en desarrollo apunta a `http://<host>:5174` o queda configurada con `VITE_API_URL` si se usa otro dominio/proxy.
- Verificar el arranque con `curl http://127.0.0.1:5173/`, `curl http://127.0.0.1:5174/` y despues con la URL publica `http://<host>:5173/`.
- Mientras el modo desarrollo este activo no se debe ejecutar `npm run deploy`; el deploy queda reservado para el boton `Finalizar` de AutoCodex.

## Comandos de AutoCodex
<!-- autocodex-commands-guidance -->
- Los comandos de AutoCodex no son exclusivos del usuario: Codex o Claude deben reconocerlos, inferirlos de lenguaje natural cuando la intencion sea clara y ejecutar el flujo correspondiente si esta disponible.
- Si el usuario describe una accion que encaja claramente con un comando documentado, tratarla como ese comando aunque no haya escrito la barra inicial. Ejemplo: crear un objeto/CRUD completo con campos equivale a `/jopal-crud`.
- No inventar comandos nuevos. Si la intencion no encaja claramente, continuar con el flujo normal o preguntar lo minimo necesario.
- Comandos actuales: `/plan` divide una peticion grande en tareas; `/browser` abre un Chromium remoto y permite que Codex pruebe una web visualmente; `/jopal-crud` y `/jopal` crean un objeto completo con modelo, controlador, rutas, pagina, formulario, Redux y selectores; `/crear-modelo` prepara el contexto privado de modelos IA; `/UI` delega una mejora visual en Claude; `/skills` muestra, configura e invoca skills de Codex con credenciales aisladas por proyecto; `/import-chat` importa contexto de otro chat; `/proyectos` vincula proyectos; `/goal` gestiona un objetivo persistente de Codex.
- Para `/jopal-crud` o `/jopal`, primero proponer nombre tecnico, traduccion, icono y campos en texto claro. Cuando el usuario confirme o ya haya dado una aprobacion explicita, guardar el JSON en `.autocodex/jopal-crud.json` y ejecutar `node .autocodex/tools/jopal-crud.mjs .autocodex/jopal-crud.json --project-root <raiz del proyecto AutoCodex>`, ajustando rutas si se esta dentro de un repo.
- Tras ejecutar una herramienta de comando, revisar el diff, hacer solo los ajustes manuales necesarios y verificar lo posible antes de responder.
