#!/usr/bin/env python3
"""
ApexLap · Subidor de Content Manager / Assetto Corsa
====================================================

Script de escritorio (Windows/Mac/Linux) que vigila la carpeta de resultados de
Assetto Corsa y sube automáticamente tus vueltas limpias a tu liga de ApexLap.

No necesita instalar nada: usa solo la librería estándar de Python 3.
Configúralo copiando `config.example.json` a `config.json` y rellenándolo.

Uso:
    python cm_uploader.py            # vigila la carpeta y sube según juegas
    python cm_uploader.py --once     # escanea una vez, sube y sale (para probar)
    python cm_uploader.py --config otra_ruta.json

Cómo funciona:
    1. Inicia sesión en Firebase con tu email+contraseña (REST, signInWithPassword).
    2. Lee tu perfil (profiles/{uid}) para saber tu liga y tu nombre de piloto.
    3. Vigila la carpeta `out` de Assetto Corsa (race_out.json y demás *.json).
    4. De cada sesión coge tus vueltas VÁLIDAS (cuts == 0) y las sube a
       leagues/{leagueId}/laps vía Firestore REST con tu idToken.
    5. Recuerda lo ya subido en `state.json` para no duplicar.
"""

import argparse
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request

# ── Endpoints REST de Google ────────────────────────────────────────────────
IDENTITY = "https://identitytoolkit.googleapis.com/v1"
SECURETOKEN = "https://securetoken.googleapis.com/v1"
FIRESTORE = "https://firestore.googleapis.com/v1"

HERE = os.path.dirname(os.path.abspath(__file__))


# ── Utilidades HTTP ──────────────────────────────────────────────────────────
def _post_json(url, payload, headers=None):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} en {url}\n{body}") from None


def _get_json(url, headers=None):
    req = urllib.request.Request(url, method="GET")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} en {url}\n{body}") from None


# ── Sesión de Firebase (login + refresco de token) ──────────────────────────
class FirebaseSession:
    def __init__(self, api_key, email, password):
        self.api_key = api_key
        self.email = email
        self.password = password
        self.id_token = None
        self.refresh_token = None
        self.uid = None
        self.expires_at = 0  # epoch segundos

    def login(self):
        res = _post_json(
            f"{IDENTITY}/accounts:signInWithPassword?key={self.api_key}",
            {"email": self.email, "password": self.password, "returnSecureToken": True},
        )
        self.id_token = res["idToken"]
        self.refresh_token = res["refreshToken"]
        self.uid = res["localId"]
        self.expires_at = time.time() + int(res.get("expiresIn", "3600"))
        return self.uid

    def _refresh(self):
        res = _post_json(
            f"{SECURETOKEN}/token?key={self.api_key}",
            {"grant_type": "refresh_token", "refresh_token": self.refresh_token},
        )
        self.id_token = res["id_token"]
        self.refresh_token = res["refresh_token"]
        self.uid = res["user_id"]
        self.expires_at = time.time() + int(res.get("expires_in", "3600"))

    def token(self):
        # Refresca proactivamente cuando quedan menos de 5 minutos.
        if time.time() > self.expires_at - 300:
            self._refresh()
        return self.id_token

    def auth_header(self):
        return {"Authorization": f"Bearer {self.token()}"}


# ── Firestore REST ───────────────────────────────────────────────────────────
def fs_doc_url(project_id, path):
    return f"{FIRESTORE}/projects/{project_id}/databases/(default)/documents/{path}"


def get_profile(session, project_id):
    """Devuelve (leagueId, driverName, assists, gearbox) leyendo profiles/{uid}.

    `assists`/`gearbox` son el ajuste de conducción declarado por el piloto en la
    app; pueden venir vacíos (None) si nunca los tocó.
    """
    url = fs_doc_url(project_id, f"profiles/{session.uid}")
    doc = _get_json(url, session.auth_header())
    fields = doc.get("fields", {})
    league_id = fields.get("leagueId", {}).get("stringValue")
    driver_name = fields.get("driverName", {}).get("stringValue")
    assists = fields.get("assists", {}).get("booleanValue")
    gearbox = fields.get("gearbox", {}).get("stringValue")
    return league_id, driver_name, assists, gearbox


def encode_fields(lap):
    """Convierte un dict de vuelta a `fields` tipados de Firestore."""
    return {
        "userId": {"stringValue": lap["userId"]},
        "driverName": {"stringValue": lap["driverName"]},
        "car": {"stringValue": lap["car"]},
        "track": {"stringValue": lap["track"]},
        "timeMs": {"integerValue": str(lap["timeMs"])},
        "conditions": {"stringValue": lap["conditions"]},
        "assists": {"booleanValue": bool(lap["assists"])},
        "gearbox": {"stringValue": lap["gearbox"]},
        # Subida automática del subidor: entra ya verificada.
        "source": {"stringValue": "auto"},
        "status": {"stringValue": "verified"},
        "createdAt": {"integerValue": str(lap["createdAt"])},
    }


# IDs de documento estilo Firestore (auto-id de 20 caracteres alfanuméricos).
_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"


def gen_doc_id():
    return "".join(secrets.choice(_ID_ALPHABET) for _ in range(20))


def commit_laps(session, project_id, league_id, laps):
    """Sube TODAS las vueltas en UNA sola llamada (Firestore :commit), en vez de
    un POST por vuelta. Cada vuelta lleva un id de documento generado en cliente."""
    base = f"projects/{project_id}/databases/(default)/documents"
    writes = [
        {
            "update": {
                "name": f"{base}/leagues/{league_id}/laps/{gen_doc_id()}",
                "fields": encode_fields(lap),
            }
        }
        for lap in laps
    ]
    url = f"{FIRESTORE}/{base}:commit"
    _post_json(url, {"writes": writes}, session.auth_header())


# ── Parseo de resultados de Assetto Corsa ────────────────────────────────────
PREFIXES = ("ks_", "rss_", "tatuusfa1_", "abarth500_", "abarth500s_")


def prettify(raw, aliases):
    """Convierte un id interno de AC (ks_mazda_mx5_cup) en un nombre legible,
    salvo que haya un alias exacto definido en la config."""
    if not raw:
        return "Desconocido"
    if raw in aliases:
        return aliases[raw]
    name = raw
    for p in PREFIXES:
        if name.startswith(p):
            name = name[len(p):]
            break
    name = name.replace("_", " ").replace("-", " ").strip()
    return " ".join(w.capitalize() for w in name.split())


def parse_results(data, cfg):
    """De un race_out.json saca las vueltas válidas del jugador local.

    Devuelve lista de dicts {carId, trackId, driverName, timeMs}.
    """
    players = data.get("players") or []
    if not players:
        return []

    track_id = data.get("track") or data.get("trackName") or ""
    track_cfg = data.get("trackConfig") or data.get("track_config") or ""
    if track_cfg and track_cfg not in track_id:
        track_id = f"{track_id} {track_cfg}".strip()

    # Por defecto solo el jugador 0 (tú, en una sesión individual). Se puede
    # filtrar por nombre con cfg["playerName"].
    wanted_name = (cfg.get("playerName") or "").strip().lower()
    min_ms = int(cfg.get("minLapTimeMs", 15000))

    out = []
    for sess in data.get("sessions") or []:
        for lap in sess.get("laps") or []:
            if int(lap.get("cuts", 0)) != 0:
                continue  # vuelta con cortes => inválida
            t = int(lap.get("time", 0))
            if t <= 0 or t >= 3_600_000 or t < min_ms:
                continue
            car_idx = int(lap.get("car", 0))
            if car_idx < 0 or car_idx >= len(players):
                continue
            player = players[car_idx]
            if wanted_name and player.get("name", "").strip().lower() != wanted_name:
                continue
            if not wanted_name and car_idx != 0:
                continue  # sin filtro de nombre => solo el jugador 0
            out.append(
                {
                    "carId": player.get("car", ""),
                    "trackId": track_id,
                    "driverNameAc": player.get("name", ""),
                    "timeMs": t,
                }
            )
    return out


def best_per_combo(laps):
    """Deja solo la vuelta más rápida por (coche, circuito)."""
    best = {}
    for l in laps:
        key = (l["carId"], l["trackId"])
        if key not in best or l["timeMs"] < best[key]["timeMs"]:
            best[key] = l
    return list(best.values())


# ── Estado (anti-duplicados) ─────────────────────────────────────────────────
def load_state(path):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return set(json.load(f).get("uploaded", []))
        except Exception:
            return set()
    return set()


def save_state(path, uploaded):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"uploaded": sorted(uploaded)}, f, indent=2)


def lap_key(lap):
    return f"{lap['trackId']}|{lap['carId']}|{lap['timeMs']}"


# ── Núcleo ───────────────────────────────────────────────────────────────────
def now_ms():
    return int(time.time() * 1000)


def process_file(path, session, cfg, project_id, league_id, driver_name, uploaded,
                 state_path, prof_assists=None, prof_gearbox=None):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ! No se pudo leer {os.path.basename(path)}: {e}")
        return 0

    laps = parse_results(data, cfg)
    if cfg.get("onlyBest", True):
        laps = best_per_combo(laps)

    # Junta en un array todas las vueltas nuevas (las ya subidas se saltan) y las
    # manda en una sola llamada, en vez de una petición por vuelta.
    defaults = cfg.get("defaults", {})
    # Ayudas/caja: lo declarado en el perfil manda; si no, el default de config.
    assists = prof_assists if prof_assists is not None else defaults.get("assists", False)
    gearbox = prof_gearbox or defaults.get("gearbox", "manual")
    pending = []  # (key, lap_doc, etiqueta)
    for l in laps:
        key = lap_key(l)
        if key in uploaded:
            continue
        car = prettify(l["carId"], cfg.get("carAliases", {}))
        track = prettify(l["trackId"], cfg.get("trackAliases", {}))
        lap_doc = {
            "userId": session.uid,
            "driverName": driver_name or l["driverNameAc"] or "Piloto",
            "car": car,
            "track": track,
            "timeMs": l["timeMs"],
            "conditions": defaults.get("conditions", "dry"),
            "assists": assists,
            "gearbox": gearbox,
            "createdAt": now_ms(),
        }
        pending.append((key, lap_doc, f"{fmt_time(l['timeMs'])}  {car} @ {track}"))

    if not pending:
        return 0

    try:
        commit_laps(session, project_id, league_id, [p[1] for p in pending])
    except Exception as e:
        print(f"  ! Error subiendo {len(pending)} vuelta(s): {e}")
        return 0

    for key, _doc, label in pending:
        uploaded.add(key)
        print(f"  ↑ {label}")
    save_state(state_path, uploaded)
    return len(pending)


def fmt_time(ms):
    m, ms = divmod(int(ms), 60000)
    s, ms = divmod(ms, 1000)
    return f"{m}:{s:02d}.{ms:03d}"


def find_json_files(folder):
    try:
        names = os.listdir(folder)
    except FileNotFoundError:
        return []
    return [os.path.join(folder, n) for n in names if n.lower().endswith(".json")]


def main():
    ap = argparse.ArgumentParser(description="Subidor de vueltas de AC a ApexLap")
    ap.add_argument("--config", default=os.path.join(HERE, "config.json"))
    ap.add_argument("--once", action="store_true", help="escanea una vez y sale")
    args = ap.parse_args()

    if not os.path.exists(args.config):
        print(f"No encuentro {args.config}.")
        print("Copia config.example.json a config.json y rellénalo.")
        sys.exit(1)

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    required = ["email", "password", "firebaseApiKey", "projectId", "acResultsPath"]
    missing = [k for k in required if not cfg.get(k)]
    if missing:
        print(f"Faltan campos en config.json: {', '.join(missing)}")
        sys.exit(1)

    folder = os.path.expanduser(os.path.expandvars(cfg["acResultsPath"]))
    state_path = os.path.join(HERE, "state.json")
    uploaded = load_state(state_path)

    print("ApexLap · Subidor de Content Manager")
    print(f"  Carpeta AC: {folder}")
    print("  Iniciando sesión en Firebase…")

    session = FirebaseSession(cfg["firebaseApiKey"], cfg["email"], cfg["password"])
    try:
        session.login()
    except Exception as e:
        print(f"  ! No se pudo iniciar sesión: {e}")
        print("    Revisa email/contraseña y que Email/Password esté habilitado")
        print("    en Firebase Console › Authentication › Sign-in method.")
        sys.exit(1)

    try:
        league_id, driver_name, prof_assists, prof_gearbox = get_profile(
            session, cfg["projectId"]
        )
    except Exception as e:
        print(f"  ! No se pudo leer tu perfil: {e}")
        sys.exit(1)

    if not league_id:
        print("  ! Tu perfil no tiene liga. Únete a una desde la app primero.")
        sys.exit(1)

    asist_txt = "con ayudas" if prof_assists else "sin ayudas"
    print(f"  Piloto: {driver_name or '(sin nombre)'}  ·  Liga: {league_id}")
    print(f"  Setup: {asist_txt} · caja {prof_gearbox or 'manual'}")
    print(f"  Vueltas ya registradas localmente: {len(uploaded)}")

    if args.once:
        total = 0
        for path in find_json_files(folder):
            total += process_file(
                path, session, cfg, cfg["projectId"], league_id, driver_name,
                uploaded, state_path, prof_assists, prof_gearbox,
            )
        print(f"Hecho. Subidas {total} vueltas nuevas.")
        return

    poll = float(cfg.get("pollSeconds", 5))
    # Espera a que el fichero deje de cambiar este tiempo antes de procesarlo:
    # AC va escribiendo el resultado durante la sesión, así subimos UNA vez al
    # terminar la carrera entera (no vuelta a vuelta).
    settle = float(cfg.get("settleSeconds", 8))
    print(
        f"  Vigilando… (Ctrl+C para salir). Subo tus vueltas limpias al terminar\n"
        f"  cada sesión (espero {settle:.0f}s a que AC acabe de guardar).\n"
    )

    # Estado al arrancar: marcamos los ficheros actuales como "ya vistos" para no
    # resubir el histórico (el anti-duplicados también protege, pero evita ruido).
    last_mt = {}
    for p in find_json_files(folder):
        try:
            last_mt[p] = os.path.getmtime(p)
        except OSError:
            pass
    last_change = {}  # path -> instante del último cambio detectado (pendiente)

    try:
        while True:
            now = time.time()
            for path in find_json_files(folder):
                try:
                    mt = os.path.getmtime(path)
                except OSError:
                    continue
                if last_mt.get(path) != mt:
                    last_mt[path] = mt
                    last_change[path] = now  # sigue cambiando: reinicia el reloj

            # Procesa solo los que llevan `settle` segundos sin cambiar (sesión
            # ya cerrada y volcada por completo).
            for path in list(last_change.keys()):
                if now - last_change[path] >= settle:
                    name = os.path.basename(path)
                    print(f"[{time.strftime('%H:%M:%S')}] sesión cerrada: {name}")
                    process_file(
                        path, session, cfg, cfg["projectId"], league_id,
                        driver_name, uploaded, state_path, prof_assists, prof_gearbox,
                    )
                    del last_change[path]
            time.sleep(poll)
    except KeyboardInterrupt:
        print("\nAdiós 🏁")


if __name__ == "__main__":
    main()
