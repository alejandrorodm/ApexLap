-- ApexLap Uploader — app de Custom Shaders Patch (CSP) para Assetto Corsa.
-- Detecta tus vueltas LIMPIAS en tiempo real y las sube a tu liga de ApexLap.
--
-- Requiere CSP (Custom Shaders Patch) con soporte de apps Lua y acceso a web.
-- La detección y el auto-login viven en script.update → corren mientras la app
-- esté ACTIVA en la barra lateral, AUNQUE LA VENTANA ESTÉ CERRADA. No hace falta
-- abrirla cada vez (solo para escribir email/contraseña la primera vez).

-- ── Configuración fija (valores PÚBLICOS de cliente de Firebase) ─────────────
local API_KEY = 'AIzaSyB-AKkJn0ZQ0jRn332Fx82g2X5KDwlV82k'
local PROJECT = 'apexlap'
local IDENTITY = 'https://identitytoolkit.googleapis.com/v1'
local SECURETOKEN = 'https://securetoken.googleapis.com/v1'
local FIRESTORE = 'https://firestore.googleapis.com/v1'

ac.log('[ApexLap] script cargado') -- si ves esto en el log, el .lua se cargó bien

-- ── Estado persistente (se recuerda entre sesiones, solo en tu PC) ───────────
-- onlyBest = true → MENOS ESCRITURAS: solo sube cuando mejoras tu mejor tiempo
-- de ese coche+circuito (lo único que cuenta para récords y clasificación).
local cfg = ac.storage{
  email = '', password = '', onlyBest = true,
  -- Opción A: al arrancar, leer los JSON de sesión de Content Manager para
  -- añadir los tiempos por sector (S1/S2/S3) a las vueltas. Ver scanSectorsFromCM.
  readSectors = true,
  -- Modo CALIBRACIÓN: vuelca al log de CSP el estado completo de coche/sim al
  -- cerrar cada vuelta (y con el botón manual), para descubrir qué campos expone
  -- TU versión de CSP (tiempos, ayudas, pista). Déjalo en NO para uso normal:
  -- genera mucho log. Ver dumpState().
  calib = false,
}
local uploadedStore = ac.storage{ keys = '' } -- claves exactas ya subidas (';')
local bestStore = ac.storage{ best = '' }      -- mejor tiempo por combo
-- Entradas de catálogo (coche/circuito) ya creadas en Firestore, para no
-- repetir POSTs. Formato: "cars\tnombre" / "tracks\tnombre", separadas por '\n'.
local catalogStore = ac.storage{ catalog = '' }

-- ── Estado en memoria ────────────────────────────────────────────────────────
local S = {
  loggedIn = false,
  busy = false,
  token = nil,
  refresh = nil,
  uid = nil,
  leagueId = nil,
  driverName = nil,
  status = 'Introduce tu email y contraseña de ApexLap.',
  uploadedCount = 0,
  sectorsCount = 0,        -- vueltas a las que hemos añadido sectores esta sesión
  sectorsScanned = false,  -- ya se hizo el escaneo de JSON de esta sesión (una vez)
  -- true en cuanto se ha intentado el auto-login de esta sesión (con éxito o no),
  -- para no reintentar en bucle ni re-entrar si el usuario cerró sesión a mano.
  autoLoginTried = false,
  -- Piques ABIERTOS de la liga (cache). Si subes una vuelta cuyo coche+pista
  -- coincide con uno, se asocia a él (cuenta para ese pique). Se refresca tras
  -- el login y cada pocos segundos en script.update.
  challenges = {},
}

local challengeTimer = 999 -- fuerza un primer fetch en cuanto haya sesión
local recordTimer = 999 -- récord de la liga del combo actual (battle the ghost)

-- claves exactas ya subidas (anti-duplicado de la MISMA vuelta)
local seen = {}
for k in (uploadedStore.keys or ''):gmatch('[^;]+') do seen[k] = true end

-- mejor tiempo (ms) por combo "circuito|coche", para subir solo PBs
local bestByCombo = {}
for line in (bestStore.best or ''):gmatch('[^\n]+') do
  local combo, ms = line:match('^(.-)\t(%d+)$')
  if combo then bestByCombo[combo] = tonumber(ms) end
end
local function saveBest()
  local parts = {}
  for k, v in pairs(bestByCombo) do parts[#parts + 1] = k .. '\t' .. tostring(v) end
  bestStore.best = table.concat(parts, '\n')
end

-- ── Sectores (Opción A) ──────────────────────────────────────────────────────
-- Content Manager escribe el resultado de cada sesión en
-- %LOCALAPPDATA%\AcTools Content Manager\Progress\Sessions\*.json, y cada vuelta
-- de ese JSON trae `sectors` (S1/S2/S3 en ms). Como CM escribe ese fichero al
-- TERMINAR la sesión (no durante), no podemos leerlo en vivo: lo escaneamos al
-- arrancar y añadimos los sectores a las vueltas ya subidas con un PATCH (sin
-- duplicar). Para eso guardamos el doc ID de Firestore de cada vuelta subida.

-- key "combo|ms" -> docId de Firestore, para poder parchear sectores luego.
local docStore = ac.storage{ ids = '' }
local docByKey = {}
for line in (docStore.ids or ''):gmatch('[^\n]+') do
  local k, id = line:match('^(.-)\t(.+)$')
  if k then docByKey[k] = id end
end
local function rememberDoc(key, docId)
  if not key or not docId or docByKey[key] == docId then return end
  docByKey[key] = docId
  docStore.ids = (docStore.ids == '' and (key .. '\t' .. docId))
    or (docStore.ids .. '\n' .. key .. '\t' .. docId)
end

-- Marca de agua del escaneo de sectores: lastWriteTime (en s) del fichero de
-- sesión más reciente ya procesado. En cada arranque solo miramos los JSON MÁS
-- NUEVOS que esto, así no reprocesamos (ni re-subimos) todo el historial cada
-- vez: solo las ÚLTIMAS sesiones. 0 = primer arranque (ver SECTORS_FIRST_RUN_S).
local scanStore = ac.storage{ lastMs = 0 }

-- Claves cuyas vueltas YA tienen sectores en Firestore, para no repetir PATCH.
local sectorsDoneStore = ac.storage{ done = '' }
local sectorsDone = {}
for k in (sectorsDoneStore.done or ''):gmatch('[^;]+') do sectorsDone[k] = true end
local function markSectorsDone(key)
  if not key or sectorsDone[key] then return end
  sectorsDone[key] = true
  sectorsDoneStore.done = (sectorsDoneStore.done == '' and key)
    or (sectorsDoneStore.done .. ';' .. key)
end

-- Codifica un array de sectores (ms) como arrayValue de Firestore.
local function encodeSectors(sectors)
  local vals = {}
  for i = 1, #sectors do vals[i] = { integerValue = tostring(sectors[i]) } end
  return { arrayValue = { values = vals } }
end

local lastLapCount = -1
local lastScanCombo = nil -- último combo escaneado al iniciar / cambiar de coche-pista

-- ── Catálogo vanilla (para no marcar como MOD lo que ya viene con el juego) ──
-- Las claves están NORMALIZADAS (lower, sin separador "·") para tolerar la
-- diferencia entre lo que escribe el mod ("Silverstone · Gp") y el nombre
-- vanilla ("Silverstone · GP"). Si añades coches/circuitos al catálogo base
-- (src/data/*.ts), recuerda actualizar también estas listas.
local function normName(s)
  s = (s or ''):lower()
  s = s:gsub('%s*·%s*', ' ')
  s = s:gsub('%s+', ' ')
  s = s:gsub('^%s+', ''):gsub('%s+$', '')
  return s
end

local VANILLA_CARS_NORM = {}
do
  local list = {
    'Abarth 500 EsseEsse', 'Abarth 500 EsseEsse Step 1',
    'Alfa Romeo Giulietta QV', 'Alfa Romeo MiTo QV', 'Audi R8 V10 plus',
    'BMW 1M', 'BMW 1M Stage 3', 'BMW M3 E92', 'BMW Z4',
    'Ferrari 458 Italia', 'Ferrari F40', 'KTM X-Bow R',
    'Lotus Elise SC', 'Lotus Evora S', 'Lotus Exige S', 'Lotus Exige S Roadster',
    'McLaren MP4-12C', 'Mercedes-Benz SLS AMG', 'Shelby Cobra 427 S/C', 'Toyota GT86',
    'Ferrari LaFerrari', 'Ferrari 599XX EVO', 'McLaren P1', 'Pagani Huayra', 'Pagani Zonda R',
    'BMW M3 GT2', 'BMW Z4 GT3', 'Ferrari 458 Italia GT2', 'Lotus Evora GTC', 'Lotus Evora GTE',
    'McLaren MP4-12C GT3', 'Mercedes-Benz SLS AMG GT3',
    'Lotus 2-Eleven', 'Lotus 2-Eleven GT4', 'Lotus Evora GX', 'Lotus Evora GT4',
    'Lotus Exige 240R', 'Lotus Exige Scura', 'Lotus Exige V6 Cup',
    'BMW M3 E30', 'BMW M3 E30 Group A', 'BMW M3 E30 Drift',
    'Classic Team Lotus Type 49', 'Lotus 98T',
    'Lotus Exos 125', 'Lotus Exos 125 S1', 'Tatuus FA01 (Formula Abarth)',
  }
  for _, n in ipairs(list) do VANILLA_CARS_NORM[normName(n)] = true end
end

local VANILLA_TRACKS_NORM = {}
do
  local list = {
    'Monza · GP', 'Monza · Junior', 'Monza · 1966 (sin chicanes)',
    'Spa-Francorchamps · GP', 'Nürburgring · GP', 'Nürburgring · Sprint',
    'Silverstone · GP', 'Silverstone · International', 'Silverstone · National', 'Silverstone · 1967',
    'Brands Hatch · GP', 'Brands Hatch · Indy',
    'Barcelona-Catalunya · GP', 'Barcelona-Catalunya · Moto',
    'Red Bull Ring · GP', 'Red Bull Ring · National',
    'Imola · GP', 'Mugello · GP',
    'Vallelunga · GP', 'Vallelunga · Club', 'Vallelunga · Sin chicane',
    'Magione · Full', 'Zandvoort · GP', 'Laguna Seca · Full',
    'Highlands · Long', 'Highlands · Short', 'Highlands · Drift',
    'Black Cat County · Long', 'Black Cat County · Short',
    'Trento-Bondone · Hillclimb', 'Drift · Track', 'Fiorano · Full',
  }
  for _, n in ipairs(list) do VANILLA_TRACKS_NORM[normName(n)] = true end
end

-- Entradas de catálogo ya creadas en Firestore por este PC, en memoria.
local catalogSeen = {}
for line in (catalogStore.catalog or ''):gmatch('[^\n]+') do
  catalogSeen[line] = true
end
local function rememberCatalog(kind, name)
  local k = kind .. '\t' .. name
  if catalogSeen[k] then return end
  catalogSeen[k] = true
  catalogStore.catalog = (catalogStore.catalog == '' and k)
    or (catalogStore.catalog .. '\n' .. k)
end

-- ── Utilidades ───────────────────────────────────────────────────────────────
local function log(msg)
  ac.log('[ApexLap] ' .. tostring(msg))
end

local function nowMs()
  local ok, t = pcall(function() return os.time() end)
  return (ok and t or 0) * 1000
end

-- Lee un campo de un struct/userdata de CSP sin caer si no existe. En CSP, los
-- campos inexistentes de `state_car` LANZAN error (no devuelven nil), así que
-- hay que envolverlos en pcall.
local function safeGet(obj, field)
  if obj == nil then return nil end
  local ok, val = pcall(function() return obj[field] end)
  if ok then return val end
  return nil
end

-- Condiciones según la lluvia del juego: seco / mixto (lluvia ligera) / mojado.
local function drivingConditions(sim)
  local rain = safeGet(sim, 'rainIntensity')
  if type(rain) ~= 'number' then return 'dry' end
  if rain > 0.35 then return 'wet' end
  if rain > 0.02 then return 'mixed' end
  return 'dry'
end

-- Flag binario "ayuda" (lo que la app muestra como "Sin/Con ayudas"): SE RESPETA
-- el ajuste DECLARADO del piloto en su perfil (S.assists). La calibración con logs
-- reales mostró que autodetectarlo daba falsos positivos: autoembrague/autocambio
-- dependen del HARDWARE (volante vs mando) y ABS/TC son DESCRIPTIVOS, no una ayuda
-- de pilotaje como tal. Por eso aquí ya no se "añade" nada: solo se loguea el estado
-- real (para depurar) y se devuelve lo declarado. `declared` = S.assists.
local function detectAssists(car, declared)
  local cands = {
    'absMode', 'tractionControlMode', 'absInAction', 'tractionControlInAction',
    'autoShift', 'autoClutch', 'autoBlip', 'stabilityControl', 'drivingAssistance',
  }
  local parts = {}
  for _, n in ipairs(cands) do
    local v = safeGet(car, n)
    if v ~= nil then parts[#parts + 1] = n .. '=' .. tostring(v) end
  end
  if #parts > 0 then log('ayudas-candidatos: ' .. table.concat(parts, ' ')) end
  return declared == true
end

-- Estado DESCRIPTIVO de ABS y TC (NO cuenta como "ayuda"): true si su modo > 0,
-- false si está a 0. Devuelve nil para el que no exista en esta versión de CSP
-- (entonces no se sube ese campo). Confirmado en CSP: car.absMode /
-- car.tractionControlMode son números (0 = desactivado).
local function detectAbsTc(car)
  local abs, tc
  local am = safeGet(car, 'absMode')
  if type(am) == 'number' then abs = am > 0 end
  local tm = safeGet(car, 'tractionControlMode')
  if type(tm) == 'number' then tc = tm > 0 end
  return abs, tc
end

local PREFIXES = { 'ks_', 'rss_', 'tatuusfa1_', 'abarth500_' }
local function prettify(raw)
  if not raw or raw == '' then return 'Desconocido' end
  local name = raw
  for _, p in ipairs(PREFIXES) do
    if name:sub(1, #p) == p then name = name:sub(#p + 1); break end
  end
  name = name:gsub('[_%-]', ' ')
  name = name:gsub('(%a)([%w]*)', function(a, b) return a:upper() .. b end)
  return name
end

local function remember(key)
  seen[key] = true
  uploadedStore.keys = (uploadedStore.keys == '' and key)
    or (uploadedStore.keys .. ';' .. key)
end

local function fmt(ms)
  local m = math.floor(ms / 60000)
  local s = math.floor((ms % 60000) / 1000)
  local mil = ms % 1000
  return string.format('%d:%02d.%03d', m, s, mil)
end

-- Resuelve el ID interno de pista y su layout. CSP moderno expone funciones
-- globales (`ac.getTrackID`/`ac.getTrackLayout`); en versiones antiguas se
-- leían como campos de `sim`. Si no hay ID, devolvemos nil para descartar la
-- subida en vez de meter un nombre basura ("Circuito").
local function resolveTrack(sim)
  local trackId, trackCfg
  if ac.getTrackID then
    local ok, v = pcall(ac.getTrackID)
    if ok then trackId = v end
  end
  if not trackId or trackId == '' then
    trackId = safeGet(sim, 'trackId') or safeGet(sim, 'track')
  end
  if ac.getTrackLayout then
    local ok, v = pcall(ac.getTrackLayout)
    if ok then trackCfg = v end
  end
  if not trackCfg then trackCfg = safeGet(sim, 'trackConfig') end
  if trackId == '' then trackId = nil end
  if trackCfg == '' then trackCfg = nil end
  return trackId, trackCfg
end

-- Clave interna de pista para el `combo`. Content Manager identifica el layout
-- como un único id con guion (p.ej. "ks_silverstone-gp"); CSP en vivo lo separa
-- en trackId + layout. Normalizamos SIEMPRE al formato con guion para que la
-- ruta en vivo y el escaneo del JSON de CM generen exactamente la misma combo.
local function trackKey(trackId, trackCfg)
  if trackCfg and trackCfg ~= '' then
    return trackId .. '-' .. trackCfg
  end
  return trackId
end

-- Override EXACTO por id combinado completo (clave = `trackKey`). Imprescindible
-- para: (a) pistas de un solo trazado cuyo id NO trae layout pero la app sí lo
-- quiere ("imola" -> "Imola · GP"); (b) ids con guion en el propio NOMBRE, que el
-- split partiría mal ("trento-bondone" -> "Trento · Bondone"). Ids reales sacados
-- del diagnóstico "DUMP" del log de CSP; amplíalo con tus circuitos.
local TRACK_LABELS = {
  ['ks_silverstone-gp'] = 'Silverstone · GP',
  ['imola']             = 'Imola · GP',
  ['spa']               = 'Spa-Francorchamps · GP',
  ['trento-bondone']    = 'Trento-Bondone · Hillclimb',
  ['ks_laguna_seca']    = 'Laguna Seca · Full',
  ['drift']             = 'Drift · Track',
}
-- Nombre base de AC -> nombre de la app, cuando difieren del prettify (acentos,
-- nombres compuestos). Solo aplica al patrón normal "base-layout".
local NAME_ALIAS = {
  ['ks_barcelona']   = 'Barcelona-Catalunya',
  ['ks_nurburgring'] = 'Nürburgring',
}
-- Layouts cuyo casing canónico de la app no sale del prettify (acrónimos).
local LAYOUT_CASE = { gp = 'GP' }

-- Nombre para mostrar/guardar. Se deriva de la MISMA clave normalizada con guion
-- (`trackKey`) para que la ruta en vivo y la de CM produzcan el mismo string, y
-- se alinea con la etiqueta de la app ("Nombre · Layout"): la app agrupa por
-- este campo y `getTrackImage()` depende del " · ", así que hay que respetarlo.
local function trackDisplayName(trackId, trackCfg)
  local k = trackKey(trackId, trackCfg)
  if TRACK_LABELS[k] then return TRACK_LABELS[k] end
  -- El layout es el sufijo tras el ÚLTIMO guion (los ids base usan underscores).
  local base, layout = k:match('^(.*)%-([^%-]+)$')
  if not base then base, layout = k, nil end
  local name = NAME_ALIAS[base] or prettify(base)
  if layout and layout ~= '' then
    layout = layout:gsub('^layout_', '') -- AC nombra muchos configs "layout_gp", etc.
    return name .. ' · ' .. (LAYOUT_CASE[layout] or prettify(layout))
  end
  return name
end

-- ── Firebase: login, refresco, perfil, subida ────────────────────────────────

-- Lee los piques ABIERTOS de la liga y los cachea en S.challenges. Un pique sin
-- campo `status` se trata como abierto (compatibilidad con piques antiguos).
local function fetchChallenges()
  if not S.leagueId or not S.token then return end
  local url = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/leagues/' .. S.leagueId
    .. '/challenges?pageSize=100'
  web.request('GET', url, { ['Authorization'] = 'Bearer ' .. S.token }, '',
    function(err, res)
      if err or (res and res.status >= 400) then
        log('challenges error: ' .. tostring(err or (res and res.body)))
        return
      end
      local d = JSON.parse(res.body)
      local list = {}
      for _, docu in ipairs((d and d.documents) or {}) do
        local f = docu.fields or {}
        local status = f.status and f.status.stringValue or 'open'
        if status ~= 'closed' then
          list[#list + 1] = {
            id = tostring(docu.name):match('([^/]+)$'),
            car = f.car and f.car.stringValue or '',
            track = f.track and f.track.stringValue or '',
            createdAt = tonumber(f.createdAt and f.createdAt.integerValue or '0') or 0,
          }
        end
      end
      S.challenges = list
      log('piques activos: ' .. tostring(#list))
    end)
end

-- Récord de la liga (vuelta verificada más rápida) para el coche+pista ACTUAL.
-- GET de las vueltas + filtro en cliente (sin índices). Best-effort: si falla,
-- simplemente no se muestra el "ghost". Alimenta el delta en vivo y el aviso de
-- récord arrebatado.
local function fetchRecord()
  if not S.leagueId or not S.token then return end
  local sim = ac.getSim()
  local carId = ac.getCarID(0)
  local trackId, trackCfg = resolveTrack(sim)
  if not carId or not trackId then return end
  local carName = prettify(carId)
  local trackName = trackDisplayName(trackId, trackCfg)
  local cn, tn = normName(carName), normName(trackName)
  local url = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/leagues/' .. S.leagueId .. '/laps?pageSize=300'
  web.request('GET', url, { ['Authorization'] = 'Bearer ' .. S.token }, '',
    function(err, res)
      if err or (res and res.status >= 400) then return end
      local ok, d = pcall(JSON.parse, res.body)
      if not ok then return end
      local bestMs, bestBy, bestUid
      for _, docu in ipairs((d and d.documents) or {}) do
        local f = docu.fields or {}
        local st = f.status and f.status.stringValue or nil
        if st == nil or st == 'verified' then
          local c = f.car and f.car.stringValue or ''
          local t = f.track and f.track.stringValue or ''
          if normName(c) == cn and normName(t) == tn then
            local ms = tonumber(f.timeMs and f.timeMs.integerValue or '0') or 0
            if ms > 0 and (not bestMs or ms < bestMs) then
              bestMs = ms
              bestBy = f.driverName and f.driverName.stringValue or '?'
              bestUid = f.userId and f.userId.stringValue or nil
            end
          end
        end
      end
      S.recordMs = bestMs
      S.recordBy = bestBy
      S.recordUid = bestUid
    end)
end

-- Aviso push a un piloto concreto (vía su perfil → pushToken). Best-effort.
local function pushToUser(uid, title, body)
  if not uid or uid == S.uid then return end
  local purl = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/profiles/' .. uid
  web.request('GET', purl, { ['Authorization'] = 'Bearer ' .. S.token }, '',
    function(err, res)
      if err or (res and res.status >= 400) then return end
      local ok, d = pcall(JSON.parse, res.body)
      if not ok then return end
      local tok = d and d.fields and d.fields.pushToken and d.fields.pushToken.stringValue
      if not tok or tok:sub(1, 17) ~= 'ExponentPushToken' then return end
      web.request('POST', 'https://exp.host/--/api/v2/push/send',
        { ['Content-Type'] = 'application/json' },
        JSON.stringify{ to = tok, title = title, body = body, sound = 'default' },
        function() end)
    end)
end

-- ID del pique abierto que casa con este coche+pista (el más reciente si hay
-- varios). Match tolerante con normName, igual que el catálogo. nil si ninguno.
local function findOpenChallenge(car, track)
  local cn, tn = normName(car), normName(track)
  local bestId, bestAt = nil, -1
  for _, c in ipairs(S.challenges or {}) do
    if normName(c.car) == cn and normName(c.track) == tn and c.createdAt > bestAt then
      bestId, bestAt = c.id, c.createdAt
    end
  end
  return bestId
end

local function fetchProfile()
  local url = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/profiles/' .. S.uid
  web.request('GET', url, { ['Authorization'] = 'Bearer ' .. S.token }, '',
    function(err, res)
      if err or (res and res.status >= 400) then
        S.status = 'No se pudo leer tu perfil.'
        log('perfil error: ' .. tostring(err or (res and res.body)))
        return
      end
      local d = JSON.parse(res.body)
      local f = (d and d.fields) or {}
      S.leagueId = f.leagueId and f.leagueId.stringValue or nil
      S.driverName = f.driverName and f.driverName.stringValue or nil
      -- Ajuste declarado de conducción (lo edita el piloto en la app).
      S.assists = f.assists and f.assists.booleanValue == true or false
      S.gearbox = f.gearbox and f.gearbox.stringValue or 'manual'
      if not S.leagueId then
        S.status = 'Tu perfil no tiene liga. Únete a una desde la app ApexLap.'
        return
      end
      S.status = 'Listo ✓ Pilotando como ' .. (S.driverName or '?')
        .. '. Da vueltas limpias y se subirán solas.'
      log('perfil OK, liga ' .. S.leagueId)
      challengeTimer = 0
      fetchChallenges() -- carga inicial de piques abiertos
    end)
end

local function login()
  if S.busy then return end
  if cfg.email == '' or cfg.password == '' then
    S.status = 'Pon tu email y contraseña.'
    return
  end
  S.busy = true
  S.status = 'Iniciando sesión…'
  local body = JSON.stringify{
    email = cfg.email, password = cfg.password, returnSecureToken = true,
  }
  web.request('POST',
    IDENTITY .. '/accounts:signInWithPassword?key=' .. API_KEY,
    { ['Content-Type'] = 'application/json' }, body,
    function(err, res)
      S.busy = false
      if err or (res and res.status >= 400) then
        S.status = 'Error de login. Revisa email/contraseña (y que Email/Password '
          .. 'esté habilitado en Firebase).'
        log('login error: ' .. tostring(err or (res and res.body)))
        return
      end
      local d = JSON.parse(res.body)
      S.token = d.idToken
      S.refresh = d.refreshToken
      S.uid = d.localId
      S.loggedIn = true
      S.status = 'Sesión iniciada. Cargando perfil…'
      fetchProfile()
    end)
end

local function refreshToken(after)
  local body = 'grant_type=refresh_token&refresh_token=' .. S.refresh
  web.request('POST', SECURETOKEN .. '/token?key=' .. API_KEY,
    { ['Content-Type'] = 'application/x-www-form-urlencoded' }, body,
    function(err, res)
      if err or (res and res.status >= 400) then
        log('refresh error: ' .. tostring(err or (res and res.body)))
        return
      end
      local d = JSON.parse(res.body)
      S.token = d.id_token
      S.refresh = d.refresh_token
      if after then after() end
    end)
end

-- Garantiza que `name` (coche o circuito) está en el catálogo de la liga.
-- - Si es un nombre vanilla, no crea nada (la app ya lo lista).
-- - Si ya lo hemos creado desde este PC, tampoco.
-- - El resto: POST a leagues/{id}/{kind} con kind:'mod'. Si falla por 401,
--   refresca el token y reintenta una vez (igual que uploadLap).
local function ensureCatalogEntry(kind, name, isRetry)
  if not name or name == '' then return end
  if not S.uid or not S.leagueId or not S.token then return end
  local vanilla = (kind == 'cars') and VANILLA_CARS_NORM or VANILLA_TRACKS_NORM
  if vanilla[normName(name)] then return end
  local key = kind .. '\t' .. name
  if catalogSeen[key] then return end

  local fields = {
    name = { stringValue = name },
    kind = { stringValue = 'mod' },
    createdBy = { stringValue = S.uid },
    createdAt = { integerValue = tostring(nowMs()) },
  }
  if S.driverName and S.driverName ~= '' then
    fields.createdByName = { stringValue = S.driverName }
  end
  local url = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/leagues/' .. S.leagueId .. '/' .. kind
  web.request('POST', url,
    { ['Authorization'] = 'Bearer ' .. S.token, ['Content-Type'] = 'application/json' },
    JSON.stringify{ fields = fields },
    function(err, res)
      if res and res.status == 401 and not isRetry then
        refreshToken(function() ensureCatalogEntry(kind, name, true) end)
        return
      end
      if err or (res and res.status >= 400) then
        log('catalog error (' .. kind .. ' ' .. name .. '): '
          .. tostring(err or (res and res.body)))
        return
      end
      rememberCatalog(kind, name)
      log('catalog +' .. kind .. ' ' .. name)
    end)
end

local function uploadLap(lap, isRetry)
  local fields = {
    userId = { stringValue = S.uid },
    driverName = { stringValue = S.driverName or 'Piloto' },
    car = { stringValue = lap.car },
    track = { stringValue = lap.track },
    timeMs = { integerValue = tostring(lap.timeMs) },
    conditions = { stringValue = lap.conditions or 'dry' },
    -- Ayudas/caja: el ajuste DECLARADO del piloto en su perfil (S.assists/S.gearbox).
    -- Editable en la app después.
    assists = { booleanValue = lap.assists == true },
    gearbox = { stringValue = lap.gearbox or 'manual' },
    -- Subida automática del mod: validada en el juego, entra ya verificada.
    source = { stringValue = 'auto' },
    status = { stringValue = 'verified' },
    createdAt = { integerValue = tostring(nowMs()) },
  }
  -- Si la vuelta llega con sectores (vía escaneo de JSON), súbelos ya.
  if lap.sectors and #lap.sectors > 0 then
    fields.sectors = encodeSectors(lap.sectors)
  end
  -- ABS/TC descriptivos (no son "ayuda"): solo si el juego los reportó en vivo.
  if lap.abs ~= nil then fields.abs = { booleanValue = lap.abs } end
  if lap.tc ~= nil then fields.tc = { booleanValue = lap.tc } end
  -- ¿Hay un pique abierto con este coche+pista? Si lo hay, la vuelta cuenta para él.
  local cid = findOpenChallenge(lap.car, lap.track)
  if cid then
    fields.challengeId = { stringValue = cid }
    log('vuelta asociada al pique ' .. cid)
  end
  local url = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/leagues/' .. S.leagueId .. '/laps'
  web.request('POST', url,
    { ['Authorization'] = 'Bearer ' .. S.token, ['Content-Type'] = 'application/json' },
    JSON.stringify{ fields = fields },
    function(err, res)
      if res and res.status == 401 and not isRetry then
        refreshToken(function() uploadLap(lap, true) end) -- token caducado: 1 reintento
        return
      end
      if err or (res and res.status >= 400) then
        S.status = 'Error subiendo la vuelta (se reintentará en la próxima).'
        log('upload error: ' .. tostring(err or (res and res.body)))
        seen[lap.key] = nil -- permite reintentar
        return
      end
      remember(lap.key)
      -- Récord arrebatado: si esta vuelta bate el récord de la liga del combo y
      -- lo tenía OTRO piloto, avísale por push y actualiza el récord local.
      if S.recordMs and lap.timeMs < S.recordMs and S.recordUid and S.recordUid ~= S.uid then
        pcall(pushToUser, S.recordUid,
          '👑 Te han quitado el récord',
          (S.driverName or 'Alguien') .. ' bajó a ' .. fmt(lap.timeMs)
            .. ' · ' .. lap.car .. ' · ' .. lap.track)
      end
      if not S.recordMs or lap.timeMs < S.recordMs then
        S.recordMs = lap.timeMs
        S.recordBy = S.driverName
        S.recordUid = S.uid
      end
      -- Guarda el doc ID para poder parchear sectores más adelante (Opción A).
      local okp, d = pcall(JSON.parse, res.body)
      local docId = okp and d and d.name and tostring(d.name):match('([^/]+)$') or nil
      if docId then rememberDoc(lap.key, docId) end
      if lap.sectors and #lap.sectors > 0 then markSectorsDone(lap.key) end
      -- Mantén como PB local solo el más rápido: una vuelta de pique puede ser
      -- más lenta que tu mejor histórico y no debe pisarlo.
      if not bestByCombo[lap.combo] or lap.timeMs < bestByCombo[lap.combo] then
        bestByCombo[lap.combo] = lap.timeMs
        saveBest()
      end
      S.uploadedCount = S.uploadedCount + 1
      S.status = 'Subida ✓ ' .. fmt(lap.timeMs) .. ' — ' .. lap.car .. ' @ ' .. lap.track
      log('subida: ' .. lap.key)
      -- Mete el coche/circuito en el catálogo de la liga (etiqueta MOD) si no
      -- son vanilla. Idempotente: se cachea en disco para no repetir POSTs.
      ensureCatalogEntry('cars', lap.car, false)
      ensureCatalogEntry('tracks', lap.track, false)
    end)
end

-- ── Calibración: volcado de estado de coche/sim ──────────────────────────────
-- Sondea una lista amplia de campos candidatos de CSP y loguea SOLO los que
-- existen, con su valor y tipo. Como los nombres cambian entre versiones de CSP,
-- esto revela empíricamente qué expone TU build: tiempos de vuelta (para afinar
-- detectLaps), ayudas (para calibrar detectAssists) y resolución de pista. Se
-- dispara al cerrar cada vuelta con el modo calib ON, y con el botón manual.
local CALIB_CAR_FIELDS = {
  -- tiempos / estado de vuelta
  'lapCount', 'lapTimeMs', 'bestLapTimeMs', 'previousLapTimeMs', 'lastLapTimeMs',
  'splitTimeMs', 'isLapValid', 'lapInvalidated', 'personalBestLapMs',
  -- ayudas (lo que queremos calibrar)
  'absMode', 'absInAction', 'tractionControlMode', 'tractionControlMode2',
  'tractionControlInAction', 'autoShift', 'autoClutch', 'autoBlip', 'autoBrake',
  'stabilityControl', 'drivingAssistance', 'gearGrinding', 'autoShifter',
}
local CALIB_SIM_FIELDS = {
  'rainIntensity', 'roadTemperature', 'ambientTemperature',
  'trackId', 'track', 'trackConfig', 'bestLapTimeMs',
}

local function dumpState(reason)
  local sim = ac.getSim()
  local car = ac.getCar(0)
  log('=== CALIB (' .. tostring(reason) .. ') ===')
  -- Resolución de pista: ¿existen las funciones globales o hay que ir a sim?
  if ac.getTrackID then
    local ok, v = pcall(ac.getTrackID)
    log('getTrackID() -> ' .. (ok and tostring(v) or 'ERROR'))
  else
    log('getTrackID: la función NO existe en este CSP')
  end
  if ac.getTrackLayout then
    local ok, v = pcall(ac.getTrackLayout)
    log('getTrackLayout() -> ' .. (ok and tostring(v) or 'ERROR'))
  else
    log('getTrackLayout: la función NO existe en este CSP')
  end
  local okc, cid = pcall(function() return ac.getCarID(0) end)
  log('getCarID(0) -> ' .. (okc and tostring(cid) or 'ERROR'))
  -- Campos del coche y de la sim que SÍ existen (los inexistentes se omiten).
  for _, n in ipairs(CALIB_CAR_FIELDS) do
    local v = safeGet(car, n)
    if v ~= nil then log('car.' .. n .. ' = ' .. tostring(v) .. ' (' .. type(v) .. ')') end
  end
  for _, n in ipairs(CALIB_SIM_FIELDS) do
    local v = safeGet(sim, n)
    if v ~= nil then log('sim.' .. n .. ' = ' .. tostring(v) .. ' (' .. type(v) .. ')') end
  end
  log('=== fin CALIB ===')
end

-- ── Detección de vueltas completadas ─────────────────────────────────────────
local function detectLaps()
  local sim = ac.getSim()
  local car = ac.getCar(0) -- jugador local
  if not car then return end

  local lapCount = safeGet(car, 'lapCount')
  if not lapCount then return end
  if lastLapCount < 0 then lastLapCount = lapCount; return end
  if lapCount <= lastLapCount then return end
  lastLapCount = lapCount

  -- CALIBRACIÓN: vuelca el estado AHORA, justo al cerrar la vuelta (antes de
  -- cualquier validación/descarte). Es el instante exacto en que leemos tiempos
  -- y ayudas para subir, así que es la foto más útil para afinar los campos.
  if cfg.calib then pcall(dumpState, 'vuelta cerrada') end

  -- Tiempo de la vuelta recién cerrada. El nombre del campo varía entre
  -- versiones de CSP; probamos varios y nos quedamos con el primero plausible.
  local cand = {
    previousLapTimeMs = safeGet(car, 'previousLapTimeMs'),
    lastLapTimeMs = safeGet(car, 'lastLapTimeMs'),
    lapTimeMs = safeGet(car, 'lapTimeMs'),
    bestLapTimeMs = safeGet(car, 'bestLapTimeMs'),
  }
  local t = nil
  for _, name in ipairs({ 'previousLapTimeMs', 'lastLapTimeMs' }) do
    local v = cand[name]
    if type(v) == 'number' and v > 5000 and v < 3600000 then t = math.floor(v); break end
  end

  -- VALIDEZ fiable entre versiones de CSP: `isLapValid` daba falsos negativos
  -- (descartaba vueltas que AC sí daba por buenas). En su lugar usamos que AC
  -- solo registra `bestLapTimeMs` en vueltas VÁLIDAS: si la recién cerrada es la
  -- mejor de la sesión (prev == best), es válida y además PB de la sesión. El
  -- escaneo de JSON (con `cuts`) es la red de seguridad para el resto de vueltas.
  local best = cand.bestLapTimeMs
  local validBest = type(t) == 'number' and type(best) == 'number'
    and math.abs(t - best) <= 2

  if not (t and validBest) then
    log(string.format(
      'descartada (no es mejor válida de sesión): t=%s bestMs=%s prevMs=%s lastMs=%s lapMs=%s',
      tostring(t), tostring(cand.bestLapTimeMs), tostring(cand.previousLapTimeMs),
      tostring(cand.lastLapTimeMs), tostring(cand.lapTimeMs)))
    return
  end

  local carId = ac.getCarID(0)
  local trackId, trackCfg = resolveTrack(sim)
  if not trackId then
    -- Sin ID de pista preferimos abortar antes que subir "Circuito" como nombre.
    -- Pasa típicamente si la API de CSP cambia o la sesión todavía no ha cargado.
    log('vuelta descartada: sin ID de pista (ac.getTrackID no disponible)')
    return
  end
  local trackFull = trackKey(trackId, trackCfg)
  local combo = trackFull .. '|' .. tostring(carId)
  local key = combo .. '|' .. tostring(t)

  if seen[key] then return end -- misma vuelta exacta ya tratada

  -- MENOS ESCRITURAS: en modo "solo mejores", descarta si no mejora tu PB.
  -- EXCEPCIÓN: si hay un pique abierto con este coche+pista, la subimos igual
  -- aunque no sea tu mejor, para que cuente en ese pique.
  if cfg.onlyBest then
    local best = bestByCombo[combo]
    if best and t >= best
       and not findOpenChallenge(prettify(carId), trackDisplayName(trackId, trackCfg)) then
      S.status = 'Vuelta ' .. fmt(t) .. ' — no mejora tu PB (' .. fmt(best) .. ').'
      log('descartada (no PB): ' .. key)
      return
    end
  end

  -- condiciones reales (seco/mixto/mojado), ayuda declarada y ABS/TC descriptivos.
  local conditions = drivingConditions(sim)
  local assists = detectAssists(car, S.assists)
  local abs, tc = detectAbsTc(car)

  -- Tu mejor de la sesión (para el delta vs récord de la liga).
  if not S.sessionBestMs or t < S.sessionBestMs then S.sessionBestMs = t end

  seen[key] = true -- marca ya para no duplicar mientras sube
  log('vuelta limpia ' .. fmt(t) .. ' (' .. tostring(carId)
    .. ', ' .. conditions .. ', ayudas=' .. tostring(assists)
    .. ', abs=' .. tostring(abs) .. ', tc=' .. tostring(tc) .. ')')
  -- DEBUG sectores: la clave EN VIVO. Debe coincidir con la que calcula el
  -- escaneo del JSON de CM (línea "JSON key=…") para que el PATCH la encuentre.
  log('LIVE key=' .. key)
  uploadLap({
    timeMs = t,
    car = prettify(carId),
    track = trackDisplayName(trackId, trackCfg),
    conditions = conditions,
    assists = assists,
    abs = abs,
    tc = tc,
    gearbox = S.gearbox or 'manual',
    key = key,
    combo = combo,
  }, false)
end

-- ── Escaneo al iniciar / cambiar de coche-pista ──────────────────────────────
-- Sube el MEJOR tiempo que el juego ya conoce para el coche+circuito cargado,
-- por si hiciste vueltas antes de abrir la app (o de una sesión anterior que el
-- juego mantenga como referencia). Se ejecuta una vez por combo.
local function scanExistingBest()
  local sim = ac.getSim()
  local car = ac.getCar(0)
  if not car then return end
  local carId = ac.getCarID(0)
  if not carId then return end
  local trackId, trackCfg = resolveTrack(sim)
  if not trackId then return end -- sin ID claro, esperar al siguiente tick
  local trackFull = trackKey(trackId, trackCfg)
  local combo = trackFull .. '|' .. tostring(carId)
  if combo == lastScanCombo then return end -- ya escaneado este combo
  lastScanCombo = combo

  -- mejor vuelta conocida por el juego para este coche+circuito.
  local t = safeGet(car, 'bestLapTimeMs')
    or safeGet(sim, 'bestLapTimeMs')
    or safeGet(car, 'personalBestLapMs')
  if not t or t <= 0 or t >= 3600000 then return end

  local key = combo .. '|' .. tostring(t)
  if seen[key] then return end
  if cfg.onlyBest then
    local best = bestByCombo[combo]
    if best and t >= best
       and not findOpenChallenge(prettify(carId), trackDisplayName(trackId, trackCfg)) then
      return -- ya tenemos ese tiempo (o mejor) y no hay pique que lo reclame
    end
  end

  local conditions = drivingConditions(sim)
  local assists = detectAssists(car, S.assists)
  local abs, tc = detectAbsTc(car)

  seen[key] = true
  S.status = 'Subiendo tu mejor ya registrado (' .. fmt(t) .. ')…'
  log('scan combo ' .. combo .. ' best ' .. fmt(t))
  uploadLap({
    timeMs = t,
    car = prettify(carId),
    track = trackDisplayName(trackId, trackCfg),
    conditions = conditions,
    assists = assists,
    abs = abs,
    tc = tc,
    gearbox = S.gearbox or 'manual',
    key = key,
    combo = combo,
  }, false)
end

-- ── Sectores: PATCH a una vuelta ya subida ──────────────────────────────────
-- Añade el campo `sectors` a un documento existente sin tocar el resto (gracias
-- a updateMask.fieldPaths=sectors), así no duplicamos la vuelta.
local function patchSectors(key, docId, sectors, isRetry)
  if not S.token or not S.leagueId then return end
  local url = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/leagues/' .. S.leagueId
    .. '/laps/' .. docId .. '?updateMask.fieldPaths=sectors'
  web.request('PATCH', url,
    { ['Authorization'] = 'Bearer ' .. S.token, ['Content-Type'] = 'application/json' },
    JSON.stringify{ fields = { sectors = encodeSectors(sectors) } },
    function(err, res)
      if res and res.status == 401 and not isRetry then
        refreshToken(function() patchSectors(key, docId, sectors, true) end)
        return
      end
      if err or (res and res.status >= 400) then
        log('patch sectores error (' .. key .. '): ' .. tostring(err or (res and res.body)))
        return
      end
      markSectorsDone(key)
      S.sectorsCount = S.sectorsCount + 1
      log('sectores añadidos a ' .. key)
    end)
end

-- ── Escaneo de los JSON de Content Manager para extraer sectores ─────────────
local SECTORS_MIN_MS = 15000     -- descarta out/in laps ridículamente cortas
local SECTORS_MAX_MS = 3600000   -- tope del juego (1 h)
local SECTORS_MAX_FILES = 150    -- cota dura por si acaso (el filtro incremental ya acota)
local SECTORS_FIRST_RUN_S = 21600 -- 1er arranque: solo sesiones de las últimas 6 h

-- Procesa un fichero de sesión y vuelca el mejor lap por combo (con sectores)
-- en `agg`. Solo cuenta laps LIMPIAS (cuts==0) del jugador local.
local function parseSessionFile(path, myNameLower, agg)
  local okl, body = pcall(io.load, path)
  if not okl or not body or body == '' then return end
  local okj, data = pcall(JSON.parse, body)
  if not okj or type(data) ~= 'table' then return end

  local players = data.players or {}
  local trackId = data.track or data.trackName or ''
  local trackCfg = data.trackConfig or data.track_config or ''
  if trackId == '' then return end
  local trackFull = trackKey(trackId, trackCfg)
  -- En hotlap/práctica suele haber un solo jugador: ese eres tú aunque el
  -- nombre del perfil ApexLap no coincida con el nombre de Assetto Corsa.
  local solo = (#players == 1)

  for _, sess in ipairs(data.sessions or {}) do
    for _, lap in ipairs(sess.laps or {}) do
      local cuts = tonumber(lap.cuts) or 0
      local t = tonumber(lap.time) or 0
      if cuts == 0 and t >= SECTORS_MIN_MS and t < SECTORS_MAX_MS
         and type(lap.sectors) == 'table' then
        local idx = tonumber(lap.car) or -1
        local p = players[idx + 1] -- los índices del JSON son base 0
        local pname = p and tostring(p.name or ''):lower() or ''
        if p and (solo or (myNameLower ~= '' and pname == myNameLower)) then
          local carId = p.car or ''
          local secs = {}
          for _, s in ipairs(lap.sectors) do
            local v = tonumber(s)
            if v and v > 0 then secs[#secs + 1] = math.floor(v) end
          end
          -- 1 solo sector == la vuelta entera, no aporta: requiere 2+.
          if carId ~= '' and #secs >= 2 then
            local combo = trackFull .. '|' .. carId
            local cur = agg[combo]
            if not cur or t < cur.timeMs then
              agg[combo] = {
                timeMs = t, sectors = secs,
                carId = carId, trackId = trackId,
                trackCfg = (trackCfg ~= '') and trackCfg or nil,
              }
            end
          end
        end
      end
    end
  end
end

-- Escanea la carpeta de sesiones de CM y, por cada mejor vuelta con sectores:
--  · si ya la subimos (tenemos su doc ID) → PATCH para añadir sectores;
--  · si el modo en vivo no la pilló (jugaste con la app cerrada) → la sube
--    con sectores, respetando "solo mejores" salvo que haya un pique abierto.
local function scanSectorsFromCM()
  local base = ac.getFolder(ac.FolderID.AppDataLocal)
  if not base or base == '' then log('sectores: sin AppDataLocal'); return end
  local dir = base .. '\\AcTools Content Manager\\Progress\\Sessions'

  local files = {}
  pcall(function()
    io.scanDir(dir, '*.json', function(name, attr)
      files[#files + 1] = { name = name, mtime = tonumber(attr.lastWriteTime) or 0 }
    end)
  end)
  if #files == 0 then log('sectores: 0 ficheros en ' .. dir); return end

  -- Más recientes primero.
  table.sort(files, function(a, b) return a.mtime > b.mtime end)
  local total = #files
  local newest = files[1].mtime

  -- INCREMENTAL: solo procesamos los JSON MÁS NUEVOS que la última marca de agua,
  -- así no reprocesamos todo el historial cada arranque. En el primer arranque
  -- (sin marca) miramos solo las sesiones de las últimas SECTORS_FIRST_RUN_S.
  local lastMs = tonumber(scanStore.lastMs) or 0
  local cutoff = (lastMs > 0) and lastMs or (newest - SECTORS_FIRST_RUN_S)

  local myName = ''
  local okn, n = pcall(function() return ac.getDriverName(0) end)
  if okn and n then myName = tostring(n):lower() end

  local agg = {}
  local scanned = 0
  for i = 1, total do
    if files[i].mtime <= cutoff then break end -- ordenados desc: el resto es más viejo
    if scanned >= SECTORS_MAX_FILES then break end
    pcall(parseSessionFile, dir .. '\\' .. files[i].name, myName, agg)
    scanned = scanned + 1
  end
  -- Avanza la marca de agua al fichero más nuevo: la próxima vez, solo lo posterior.
  scanStore.lastMs = newest
  log('sectores: ' .. scanned .. ' sesiones nuevas (de ' .. total
    .. ', desde ' .. (lastMs > 0 and 'última marca' or 'últimas 6 h') .. ')')

  local patched, uploaded, dbg = 0, 0, 0
  for combo, best in pairs(agg) do
    local key = combo .. '|' .. tostring(best.timeMs)
    -- DEBUG sectores: muestra las primeras claves del JSON y su veredicto, para
    -- compararlas con las "LIVE key=…" y ver si el emparejamiento cuadra.
    if dbg < 5 then
      dbg = dbg + 1
      local why = sectorsDone[key] and 'ya tiene sectores'
        or (docByKey[key] and 'PATCH (doc ' .. docByKey[key] .. ')')
        or (seen[key] and 'subida sin docId: no se puede parchear')
        or 'nueva con sectores'
      log('JSON key=' .. key .. ' sec=' .. #best.sectors .. ' -> ' .. why)
    end
    if not sectorsDone[key] then
      local docId = docByKey[key]
      if docId then
        patchSectors(key, docId, best.sectors, false)
        patched = patched + 1
      elseif not seen[key] then
        local car = prettify(best.carId)
        local track = trackDisplayName(best.trackId, best.trackCfg)
        local pb = bestByCombo[combo]
        if (not cfg.onlyBest) or (not pb or best.timeMs < pb)
           or findOpenChallenge(car, track) then
          seen[key] = true
          uploadLap({
            timeMs = best.timeMs, car = car, track = track,
            conditions = 'dry', key = key, combo = combo, sectors = best.sectors,
          }, false)
          uploaded = uploaded + 1
        end
      end
    end
  end
  if patched + uploaded > 0 then
    S.status = 'Sectores: ' .. patched .. ' al día, ' .. uploaded .. ' nuevas.'
  end
  log('sectores: patched=' .. patched .. ' uploaded=' .. uploaded
    .. ' (de ' .. total .. ' ficheros)')
end

-- ── Diagnóstico: vuelca TODOS los ids de pista que CM conoce ─────────────────
-- Recorre TODAS las sesiones de Content Manager (sin filtro incremental ni de
-- vueltas limpias) y registra cada id de pista distinto con la clave y el nombre
-- que el mod genera ahora. Sirve para completar TRACK_LABELS / NAME_ALIAS sin
-- rodar pista por pista: en el log de CSP, copia las líneas "[ApexLap] DUMP".
local function dumpTrackIds()
  local base = ac.getFolder(ac.FolderID.AppDataLocal)
  if not base or base == '' then log('DUMP: sin AppDataLocal'); return end
  local dir = base .. '\\AcTools Content Manager\\Progress\\Sessions'
  local files = {}
  pcall(function()
    io.scanDir(dir, '*.json', function(name) files[#files + 1] = name end)
  end)
  if #files == 0 then log('DUMP: 0 ficheros en ' .. dir); return end

  local seenKey, n = {}, 0
  for _, name in ipairs(files) do
    pcall(function()
      local okl, body = pcall(io.load, dir .. '\\' .. name)
      if not okl or not body or body == '' then return end
      local okj, data = pcall(JSON.parse, body)
      if not okj or type(data) ~= 'table' then return end
      local trackId = data.track or data.trackName or ''
      local trackCfg = data.trackConfig or data.track_config or ''
      if trackId == '' then return end
      local k = trackKey(trackId, trackCfg)
      if seenKey[k] then return end
      seenKey[k] = true
      n = n + 1
      log(string.format('DUMP id=%s cfg=%s -> key=%s | label=%s',
        tostring(trackId), (trackCfg ~= '' and tostring(trackCfg) or '-'),
        k, trackDisplayName(trackId, trackCfg)))
    end)
  end
  log('DUMP: ' .. n .. ' pistas distintas (de ' .. #files .. ' sesiones)')
  S.status = 'Volcadas ' .. n .. ' pistas al log de CSP (busca "DUMP").'
end

-- ── Tick global: corre con la app ACTIVA aunque la ventana esté cerrada ──────
-- script.update es invocado por CSP en cada frame mientras la app esté activa
-- en la barra lateral. Aquí dentro hacemos auto-login + detección de vueltas,
-- de modo que NO hace falta tener la ventana desplegada para que funcione.
function script.update(dt)
  -- Auto-login con credenciales guardadas (una vez por sesión).
  if not S.loggedIn and not S.busy and not S.autoLoginTried
     and cfg.email ~= '' and cfg.password ~= '' then
    S.autoLoginTried = true
    login()
  end

  if not S.loggedIn or not S.leagueId then return end

  -- Una vez por sesión: lee los JSON de Content Manager y añade sectores a las
  -- vueltas (PATCH a las ya subidas, o subida nueva con sectores). Síncrono, así
  -- que solo corre cuando ya hay perfil/liga, y una sola vez.
  if cfg.readSectors and not S.sectorsScanned then
    S.sectorsScanned = true
    local oks = pcall(scanSectorsFromCM)
    if not oks then log('scanSectorsFromCM error') end
  end

  -- Refresca la lista de piques abiertos cada ~20 s (por si se crea/cierra uno
  -- mientras juegas), para asociar bien las vueltas nuevas.
  challengeTimer = challengeTimer + (dt or 0)
  if challengeTimer >= 20 then
    challengeTimer = 0
    pcall(fetchChallenges)
  end

  -- Récord de la liga del coche+pista actual (battle the ghost), cada ~25 s.
  recordTimer = recordTimer + (dt or 0)
  if recordTimer >= 25 then
    recordTimer = 0
    pcall(fetchRecord)
  end

  local okS = pcall(scanExistingBest)
  if not okS then log('scanExistingBest error') end
  local ok, e = pcall(detectLaps)
  if not ok then log('detectLaps error: ' .. tostring(e)) end
end

-- ── Estilo / colores de marca ────────────────────────────────────────────────
-- Se crean de forma perezosa (dentro del render protegido) por si rgbm fallara.
local RED, RED_H, RED_A, YEL, WHITE, DIM, FAINT, GREEN, SURF, SURF_H
local function ensureColors()
  if RED then return end
  RED = rgbm(0.882, 0.024, 0, 1)
  RED_H = rgbm(1, 0.12, 0.06, 1)
  RED_A = rgbm(0.70, 0.02, 0, 1)
  YEL = rgbm(1, 0.839, 0.039, 1)
  WHITE = rgbm(0.96, 0.97, 0.98, 1)
  DIM = rgbm(0.60, 0.63, 0.68, 1)
  FAINT = rgbm(0.42, 0.45, 0.51, 1)
  GREEN = rgbm(0.22, 0.83, 0.33, 1)
  SURF = rgbm(0.16, 0.17, 0.22, 1)
  SURF_H = rgbm(0.22, 0.23, 0.28, 1)
end

local function gap(px) ui.dummy(vec2(0, px)) end

local function primaryButton(label, w)
  ui.pushStyleColor(ui.StyleColor.Button, RED)
  ui.pushStyleColor(ui.StyleColor.ButtonHovered, RED_H)
  ui.pushStyleColor(ui.StyleColor.ButtonActive, RED_A)
  ui.pushStyleColor(ui.StyleColor.Text, WHITE)
  local r = ui.button(label, vec2(w, 34))
  ui.popStyleColor(4)
  return r
end

local function ghostButton(label, w)
  ui.pushStyleColor(ui.StyleColor.Button, SURF)
  ui.pushStyleColor(ui.StyleColor.ButtonHovered, SURF_H)
  ui.pushStyleColor(ui.StyleColor.ButtonActive, SURF)
  ui.pushStyleColor(ui.StyleColor.Text, DIM)
  local r = ui.button(label, vec2(w, 30))
  ui.popStyleColor(4)
  return r
end

local function statusLine()
  local s = S.status or ''
  local c = DIM
  if s:find('✓') or s:find('Listo') or s:find('Subida') then c = GREEN
  elseif s:find('Error') or s:find('error') or s:find('No se') or s:find('no ') then c = RED end
  ui.pushStyleColor(ui.StyleColor.Text, c)
  ui.textWrapped(s)
  ui.popStyleColor(1)
end

local function header()
  ui.pushFont(ui.Font.Title)
  ui.text('🏁 ')
  ui.sameLine(0, 0)
  ui.textColored('Apex', WHITE)
  ui.sameLine(0, 0)
  ui.textColored('Lap', RED)
  ui.popFont()
  -- rayas de velocidad rojo/amarillo/blanco
  ui.textColored('▬▬', RED); ui.sameLine(0, 5)
  ui.textColored('▬', YEL); ui.sameLine(0, 5)
  ui.textColored('▬', WHITE)
  gap(4); ui.separator(); gap(4)
end

local function labeled(label, value, valueColor)
  ui.textColored(label, FAINT)
  ui.sameLine()
  ui.textColored(value, valueColor or WHITE)
end

-- ── Ventana de la app ────────────────────────────────────────────────────────
-- Solo PINTA estado. La lógica vive en script.update para que siga corriendo
-- con la ventana cerrada (basta con que la app esté activa en la barra).
local function renderMain(dt)
  ensureColors()
  header()

  if not S.loggedIn then
    ui.textColored('Inicia sesión con tu cuenta de ApexLap', DIM)
    gap(4)
    ui.setNextItemWidth(320)
    cfg.email = ui.inputText('Email', cfg.email) or cfg.email
    ui.setNextItemWidth(320)
    cfg.password = ui.inputText('Contraseña', cfg.password, ui.InputTextFlags.Password)
      or cfg.password
    gap(6)
    if primaryButton(S.busy and 'Entrando…' or 'Entrar', 320) then login() end
    gap(6)
    ui.textColored('La próxima vez entrará sola al activar la app (no hace falta '
      .. 'abrir esta ventana).', FAINT)
    gap(6)
    statusLine()
    return
  end

  -- Logueado
  labeled('PILOTO', S.driverName or '?')
  labeled('LIGA', tostring(S.leagueId), DIM)
  gap(4); ui.separator(); gap(4)

  statusLine()
  gap(8)

  -- Contador grande de vueltas subidas
  ui.pushFont(ui.Font.Title)
  ui.textColored(tostring(S.uploadedCount), YEL)
  ui.popFont()
  ui.sameLine()
  ui.textColored('subidas esta sesión', DIM)
  gap(4)

  -- Battle the ghost: récord de la liga para el coche+pista actual + tu delta.
  if S.recordMs then
    labeled('👑 RÉCORD LIGA', fmt(S.recordMs) .. '  ' .. (S.recordBy or ''), YEL)
    if S.sessionBestMs then
      local d = S.sessionBestMs - S.recordMs
      if d <= 0 then
        labeled('TU DELTA', '¡lo tienes tú! ' .. fmt(S.sessionBestMs), GREEN)
      else
        labeled('TU DELTA', string.format('+%.3f s (tu mejor %s)', d / 1000, fmt(S.sessionBestMs)), DIM)
      end
    end
    gap(6)
  end

  -- Sectores (Opción A): contador + toggle de lectura desde Content Manager.
  if S.sectorsCount > 0 then
    labeled('SECTORES', '+' .. tostring(S.sectorsCount) .. ' vueltas al día', GREEN)
    gap(4)
  end
  if ghostButton(cfg.readSectors and 'Leer sectores de CM: SÍ'
      or 'Leer sectores de CM: NO', 230) then
    cfg.readSectors = not cfg.readSectors
    if cfg.readSectors then S.sectorsScanned = false end -- re-escanea al activar
  end
  gap(8)

  -- Diagnóstico: vuelca al log de CSP todos los ids de pista que CM conoce, para
  -- completar las tablas de alias del mod sin tener que rodar pista por pista.
  if ghostButton('Volcar IDs de pista (diagnóstico)', 260) then
    S.status = 'Volcando ids de pista al log…'
    pcall(dumpTrackIds)
  end
  gap(8)

  -- CALIBRACIÓN: modo que vuelca el estado de coche/sim al cerrar cada vuelta,
  -- para descubrir los campos de tiempos/ayudas/pista de esta versión de CSP.
  if ghostButton(cfg.calib and 'Modo calibración: SÍ (logs extra)'
      or 'Modo calibración: NO', 280) then
    cfg.calib = not cfg.calib
    S.status = cfg.calib
      and 'Calibración ON: rueda y mira el log de CSP ("CALIB").'
      or 'Calibración OFF.'
  end
  -- Volcado inmediato (sin esperar a cerrar vuelta): útil parado en boxes para
  -- ver el estado de las ayudas con distintos ajustes activados.
  if ghostButton('Volcar estado ahora (calibración)', 280) then
    S.status = 'Estado volcado al log de CSP (busca "CALIB").'
    pcall(dumpState, 'botón manual')
  end
  gap(8)

  ui.textColored('La app sigue vigilando aunque cierres esta ventana, mientras '
    .. 'esté activa en la barra lateral.', FAINT)
  gap(10)

  if ghostButton('Cerrar sesión', 150) then
    S.loggedIn = false
    S.token = nil; S.uid = nil; S.leagueId = nil
    S.autoLoginTried = true -- evita que vuelva a entrar solo hasta que pulses Entrar
    S.sectorsScanned = false -- re-escanea sectores en el próximo login
    S.status = 'Sesión cerrada.'
  end
end

-- Punto de entrada de la ventana: si el render falla, muestra el error EN la
-- ventana (en vez de quedarse en blanco) y lo manda al log de CSP.
function script.windowMain(dt)
  local ok, err = pcall(renderMain, dt)
  if not ok then
    ui.text('ApexLap - error de interfaz:')
    ui.text(tostring(err))
    ac.log('[ApexLap] UI error: ' .. tostring(err))
  end
end
