const API_KEY = 'AIzaSyB-AKkJn0ZQ0jRn332Fx82g2X5KDwlV82k';
const PROJECT = 'apexlap';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE = 'https://firestore.googleapis.com/v1';
const FS_BASE = `projects/${PROJECT}/databases/(default)/documents`;

function normTrackKey(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^ks_|^rss_|^tatuus_|^abarth_/, '')
    .replace(/[^a-z0-9]+/g, '');
}

async function clean() {
  const email = process.argv[2];
  const password = process.argv[3];

  let idToken = null;

  if (email && password) {
    console.log(`Iniciando sesión como ${email}...`);
    const authRes = await fetch(`${IDENTITY}/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const authData = await authRes.json();
    if (authData.idToken) {
      idToken = authData.idToken;
      console.log('✓ Sesión iniciada');
    }
  }

  const headers = idToken ? { Authorization: `Bearer ${idToken}` } : {};

  console.log('Obteniendo ligas...');
  const leaguesRes = await fetch(`${FIRESTORE}/${FS_BASE}/leagues?key=${API_KEY}`, { headers });
  const leaguesData = await leaguesRes.json();
  const leagues = leaguesData.documents || [];

  console.log(`Ligas encontradas: ${leagues.length}`);

  for (const lgDoc of leagues) {
    const lgId = lgDoc.name.substring(lgDoc.name.lastIndexOf('/') + 1);
    console.log(`\nRevisando liga: ${lgId}...`);

    // 1. Obtener vueltas de la liga
    const lapsRes = await fetch(`${FIRESTORE}/${FS_BASE}/leagues/${lgId}/laps?pageSize=1000&key=${API_KEY}`, { headers });
    const lapsData = await lapsRes.json();
    const laps = lapsData.documents || [];

    const activeTrackKeys = new Set();
    laps.forEach(d => {
      const f = d.fields || {};
      const trackName = f.track?.stringValue || '';
      if (trackName) activeTrackKeys.add(normTrackKey(trackName));
    });

    console.log(`Vueltas encontradas: ${laps.length}. Circuitos con tiempo: ${activeTrackKeys.size}`);

    // 2. Obtener catálogo de circuitos de la liga
    const tracksRes = await fetch(`${FIRESTORE}/${FS_BASE}/leagues/${lgId}/tracks?pageSize=1000&key=${API_KEY}`, { headers });
    const tracksData = await tracksRes.json();
    const tracks = tracksData.documents || [];

    console.log(`Circuitos guardados en catálogo: ${tracks.length}`);

    const seenKeys = new Set();
    let deletedCount = 0;

    for (const tDoc of tracks) {
      const f = tDoc.fields || {};
      const tName = f.name?.stringValue || '';
      const key = normTrackKey(tName);

      const hasLaps = activeTrackKeys.has(key);
      const isDuplicate = seenKeys.has(key);

      if (!hasLaps || isDuplicate) {
        console.log(`Borrando circuito sin tiempo / duplicado: "${tName}" (${tDoc.name})`);
        await fetch(`${FIRESTORE}/${tDoc.name}?key=${API_KEY}`, { method: 'DELETE', headers });
        deletedCount++;
      } else {
        seenKeys.add(key);
      }
    }

    console.log(`✓ Eliminados ${deletedCount} circuitos sin tiempo/duplicados en la liga ${lgId}`);
  }
}

clean().catch(console.error);
