-- ApexLap Uploader — app de Custom Shaders Patch (CSP) para Assetto Corsa.
-- Detecta tus vueltas LIMPIAS en tiempo real y las sube a tu liga de ApexLap.
--
-- Requiere CSP (Custom Shaders Patch) con soporte de apps Lua y acceso a web.
-- Mantén la ventana de la app abierta mientras juegas para que funcione.
--
-- NOTA: como no se puede probar fuera del juego, algunos nombres de la API de
-- CSP podrían variar según versión. Los puntos a verificar están marcados con
-- "VERIFICAR". Si algo no sube, revisa el log de CSP (icono de CSP → Logs, o
-- Documents/Assetto Corsa/logs/) buscando "ApexLap".

-- ── Configuración fija (valores PÚBLICOS de cliente de Firebase) ─────────────
local API_KEY = 'AIzaSyD262ll4I_E9lfN7DU82c7AjFpV_S6B-cI'
local PROJECT = 'laptimersaver'
local IDENTITY = 'https://identitytoolkit.googleapis.com/v1'
local SECURETOKEN = 'https://securetoken.googleapis.com/v1'
local FIRESTORE = 'https://firestore.googleapis.com/v1'

-- ── Estado persistente (email/contraseña se recuerdan entre sesiones) ────────
local cfg = ac.storage{ email = '', password = '' }
local uploadedStore = ac.storage{ keys = '' } -- claves ya subidas, separadas por ';'

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
}

-- claves ya subidas, en un set para deduplicar rápido
local seen = {}
do
  for k in (uploadedStore.keys or ''):gmatch('[^;]+') do seen[k] = true end
end

local lastLapCount = -1
local lapInvalidated = false

-- ── Utilidades ───────────────────────────────────────────────────────────────
local function log(msg)
  ac.log('[ApexLap] ' .. tostring(msg))
end

local function nowMs()
  -- os.time da segundos; si no estuviera disponible, 0 (la app ordena por esto
  -- pero la vuelta se guarda igual).
  local ok, t = pcall(function() return os.time() end)
  return (ok and t or 0) * 1000
end

local PREFIXES = { 'ks_', 'rss_', 'tatuusfa1_', 'abarth500_' }
local function prettify(raw)
  if not raw or raw == '' then return 'Desconocido' end
  local name = raw
  for _, p in ipairs(PREFIXES) do
    if name:sub(1, #p) == p then name = name:sub(#p + 1); break end
  end
  name = name:gsub('[_%-]', ' ')
  -- capitaliza cada palabra
  name = name:gsub('(%a)([%w]*)', function(a, b) return a:upper() .. b end)
  return name
end

local function remember(key)
  seen[key] = true
  uploadedStore.keys = (uploadedStore.keys == '' and key)
    or (uploadedStore.keys .. ';' .. key)
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

local function uploadLap(timeMs, carName, trackName, key, isRetry)
  local fields = {
    userId = { stringValue = S.uid },
    driverName = { stringValue = S.driverName or 'Piloto' },
    car = { stringValue = carName },
    track = { stringValue = trackName },
    timeMs = { integerValue = tostring(timeMs) },
    conditions = { stringValue = 'dry' },
    assists = { booleanValue = false },
    gearbox = { stringValue = 'manual' },
    createdAt = { integerValue = tostring(nowMs()) },
  }
  local url = FIRESTORE .. '/projects/' .. PROJECT
    .. '/databases/(default)/documents/leagues/' .. S.leagueId .. '/laps'
  web.request('POST', url,
    { ['Authorization'] = 'Bearer ' .. S.token, ['Content-Type'] = 'application/json' },
    JSON.stringify{ fields = fields },
    function(err, res)
      if res and res.status == 401 and not isRetry then
        -- token caducado: refresca y reintenta una vez
        refreshToken(function() uploadLap(timeMs, carName, trackName, key, true) end)
        return
      end
      if err or (res and res.status >= 400) then
        S.status = 'Error subiendo la vuelta (se reintentará en la próxima).'
        log('upload error: ' .. tostring(err or (res and res.body)))
        seen[key] = nil -- permite reintentar
        return
      end
      remember(key)
      S.uploadedCount = S.uploadedCount + 1
      S.status = 'Subida ✓ ' .. carName .. ' — ' .. trackName
      log('subida: ' .. key)
    end)
end

-- ── Detección de vueltas completadas ─────────────────────────────────────────
local function fmt(ms)
  local m = math.floor(ms / 60000)
  local s = math.floor((ms % 60000) / 1000)
  local mil = ms % 1000
  return string.format('%d:%02d.%03d', m, s, mil)
end

local function detectLaps()
  local sim = ac.getSim()
  local car = ac.getCar(0) -- VERIFICAR: jugador local
  if not car then return end

  -- ¿se invalidó la vuelta en curso? (cortes / fuera de pista)
  -- VERIFICAR: campo de validez (isLapValid). Alternativas posibles según
  -- versión: car.lapValid, car.isLapValid.
  local valid = car.isLapValid
  if valid == nil then valid = car.lapValid end
  if valid == false then lapInvalidated = true end

  local lapCount = car.lapCount -- VERIFICAR: contador de vueltas
  if lastLapCount < 0 then lastLapCount = lapCount; return end

  if lapCount > lastLapCount then
    -- VERIFICAR: tiempo de la vuelta recién terminada (previousLapTimeMs)
    local t = car.previousLapTimeMs or car.lastLapTimeMs
    local wasValid = not lapInvalidated
    lastLapCount = lapCount
    lapInvalidated = false

    if wasValid and t and t > 0 and t < 3600000 then
      local carId = ac.getCarID(0) -- VERIFICAR
      local trackId = sim.trackId or sim.track or 'circuito'
      local trackCfg = sim.trackConfig or ''
      local trackFull = (#trackCfg > 0) and (trackId .. ' ' .. trackCfg) or trackId
      local key = trackFull .. '|' .. tostring(carId) .. '|' .. tostring(t)
      if not seen[key] then
        seen[key] = true -- marca ya para no duplicar mientras sube
        log('vuelta limpia ' .. fmt(t) .. ' (' .. tostring(carId) .. ')')
        uploadLap(t, prettify(carId), prettify(trackFull), key)
      end
    else
      log('vuelta descartada (inválida o tiempo no válido)')
    end
  end
end

-- ── Ventana de la app ────────────────────────────────────────────────────────
function script.windowMain(dt)
  ui.pushFont(ui.Font.Title)
  ui.text('🏁 ApexLap')
  ui.popFont()

  if not S.loggedIn then
    ui.text('Inicia sesión con tu cuenta de ApexLap:')
    ui.setNextItemWidth(320)
    cfg.email = ui.inputText('Email', cfg.email) or cfg.email
    ui.setNextItemWidth(320)
    cfg.password = ui.inputText('Contraseña', cfg.password, ui.InputTextFlags.Password)
      or cfg.password
    if ui.button(S.busy and 'Entrando…' or 'Entrar') then login() end
    ui.text(S.status)
    return
  end

  ui.text('Liga: ' .. tostring(S.leagueId))
  ui.text('Piloto: ' .. tostring(S.driverName or '?'))
  ui.separator()
  ui.textWrapped(S.status)
  ui.text('Vueltas subidas esta sesión: ' .. S.uploadedCount)
  ui.separator()
  if ui.button('Cerrar sesión') then
    S.loggedIn = false
    S.token = nil; S.uid = nil; S.leagueId = nil
    S.status = 'Sesión cerrada.'
  end

  -- detección continua mientras la ventana esté abierta
  if S.leagueId then
    local ok, e = pcall(detectLaps)
    if not ok then log('detectLaps error: ' .. tostring(e)) end
  end
end
