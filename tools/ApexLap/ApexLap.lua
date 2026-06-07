-- ApexLap Uploader — app de Custom Shaders Patch (CSP) para Assetto Corsa.
-- Detecta tus vueltas LIMPIAS en tiempo real y las sube a tu liga de ApexLap.
--
-- Requiere CSP (Custom Shaders Patch) con soporte de apps Lua y acceso a web.
-- La detección y el auto-login viven en script.update → corren mientras la app
-- esté ACTIVA en la barra lateral, AUNQUE LA VENTANA ESTÉ CERRADA. No hace falta
-- abrirla cada vez (solo para escribir email/contraseña la primera vez).

-- ── Configuración fija (valores PÚBLICOS de cliente de Firebase) ─────────────
local API_KEY = 'AIzaSyD262ll4I_E9lfN7DU82c7AjFpV_S6B-cI'
local PROJECT = 'laptimersaver'
local IDENTITY = 'https://identitytoolkit.googleapis.com/v1'
local SECURETOKEN = 'https://securetoken.googleapis.com/v1'
local FIRESTORE = 'https://firestore.googleapis.com/v1'

ac.log('[ApexLap] script cargado') -- si ves esto en el log, el .lua se cargó bien

-- ── Estado persistente (se recuerda entre sesiones, solo en tu PC) ───────────
-- onlyBest = true → MENOS ESCRITURAS: solo sube cuando mejoras tu mejor tiempo
-- de ese coche+circuito (lo único que cuenta para récords y clasificación).
local cfg = ac.storage{
  email = '', password = '', onlyBest = true,
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
  -- true en cuanto se ha intentado el auto-login de esta sesión (con éxito o no),
  -- para no reintentar en bucle ni re-entrar si el usuario cerró sesión a mano.
  autoLoginTried = false,
}

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

local lastLapCount = -1
local lapInvalidated = false
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

-- Convierte (trackId, trackCfg) en el nombre para mostrar/guardar, con " · ".
local function trackDisplayName(trackId, trackCfg)
  if trackCfg and trackCfg ~= '' then
    return prettify(trackId) .. ' · ' .. prettify(trackCfg)
  end
  return prettify(trackId)
end

-- ── Firebase: login, refresco, perfil, subida ────────────────────────────────
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
      if not S.leagueId then
        S.status = 'Tu perfil no tiene liga. Únete a una desde la app ApexLap.'
        return
      end
      S.status = 'Listo ✓ Pilotando como ' .. (S.driverName or '?')
        .. '. Da vueltas limpias y se subirán solas.'
      log('perfil OK, liga ' .. S.leagueId)
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
    -- Sin botones de UI: marcamos las vueltas con valores neutros. Si quieres
    -- ayudas/caja distintas, edítalas en la app (móvil/web) tras la subida.
    assists = { booleanValue = false },
    gearbox = { stringValue = 'manual' },
    -- Subida automática del mod: validada en el juego, entra ya verificada.
    source = { stringValue = 'auto' },
    status = { stringValue = 'verified' },
    createdAt = { integerValue = tostring(nowMs()) },
  }
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
      bestByCombo[lap.combo] = lap.timeMs -- nuevo PB de ese combo
      saveBest()
      S.uploadedCount = S.uploadedCount + 1
      S.status = 'Subida ✓ ' .. fmt(lap.timeMs) .. ' — ' .. lap.car .. ' @ ' .. lap.track
      log('subida: ' .. lap.key)
      -- Mete el coche/circuito en el catálogo de la liga (etiqueta MOD) si no
      -- son vanilla. Idempotente: se cachea en disco para no repetir POSTs.
      ensureCatalogEntry('cars', lap.car, false)
      ensureCatalogEntry('tracks', lap.track, false)
    end)
end

-- ── Detección de vueltas completadas ─────────────────────────────────────────
local function detectLaps()
  local sim = ac.getSim()
  local car = ac.getCar(0) -- jugador local
  if not car then return end

  -- ¿se invalidó la vuelta en curso? (cortes / fuera de pista). En esta versión
  -- de CSP, `car.isLapValid` no existe y leerlo directo lanza error → safeGet.
  local valid = safeGet(car, 'isLapValid')
  if valid == nil then valid = safeGet(car, 'lapValid') end
  if valid == false then lapInvalidated = true end

  local lapCount = safeGet(car, 'lapCount')
  if not lapCount then return end
  if lastLapCount < 0 then lastLapCount = lapCount; return end
  if lapCount <= lastLapCount then return end

  -- acabamos de cerrar una vuelta
  local t = safeGet(car, 'previousLapTimeMs') or safeGet(car, 'lastLapTimeMs')
  local wasValid = not lapInvalidated
  lastLapCount = lapCount
  lapInvalidated = false

  if not (wasValid and t and t > 0 and t < 3600000) then
    log('vuelta descartada (inválida o tiempo no válido)')
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
  local trackFull = trackCfg and (trackId .. ' ' .. trackCfg) or trackId
  local combo = trackFull .. '|' .. tostring(carId)
  local key = combo .. '|' .. tostring(t)

  if seen[key] then return end -- misma vuelta exacta ya tratada

  -- MENOS ESCRITURAS: en modo "solo mejores", descarta si no mejora tu PB.
  if cfg.onlyBest then
    local best = bestByCombo[combo]
    if best and t >= best then
      S.status = 'Vuelta ' .. fmt(t) .. ' — no mejora tu PB (' .. fmt(best) .. ').'
      log('descartada (no PB): ' .. key)
      return
    end
  end

  -- condiciones: seco por defecto; mojado si hay lluvia (CSP).
  local conditions = 'dry'
  local rain = safeGet(sim, 'rainIntensity')
  if rain and rain > 0.02 then conditions = 'wet' end

  seen[key] = true -- marca ya para no duplicar mientras sube
  log('vuelta limpia ' .. fmt(t) .. ' (' .. tostring(carId) .. ')')
  uploadLap({
    timeMs = t,
    car = prettify(carId),
    track = trackDisplayName(trackId, trackCfg),
    conditions = conditions,
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
  local trackFull = trackCfg and (trackId .. ' ' .. trackCfg) or trackId
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
    if best and t >= best then return end -- ya tenemos ese tiempo (o mejor)
  end

  local conditions = 'dry'
  local rain = safeGet(sim, 'rainIntensity')
  if rain and rain > 0.02 then conditions = 'wet' end

  seen[key] = true
  S.status = 'Subiendo tu mejor ya registrado (' .. fmt(t) .. ')…'
  log('scan combo ' .. combo .. ' best ' .. fmt(t))
  uploadLap({
    timeMs = t,
    car = prettify(carId),
    track = trackDisplayName(trackId, trackCfg),
    conditions = conditions,
    key = key,
    combo = combo,
  }, false)
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
  gap(8)

  ui.textColored('La app sigue vigilando aunque cierres esta ventana, mientras '
    .. 'esté activa en la barra lateral.', FAINT)
  gap(10)

  if ghostButton('Cerrar sesión', 150) then
    S.loggedIn = false
    S.token = nil; S.uid = nil; S.leagueId = nil
    S.autoLoginTried = true -- evita que vuelva a entrar solo hasta que pulses Entrar
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
