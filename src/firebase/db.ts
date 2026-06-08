// Servicio de datos sobre Firestore.
// Estructura:
//   profiles/{userId}                      -> Profile
//   leagues/{leagueId}                     -> League
//   leagues/{leagueId}/laps/{lapId}        -> Lap
//   leagues/{leagueId}/challenges/{id}     -> Challenge

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getDb } from './config';
import {
  Lap,
  NewLap,
  Profile,
  League,
  Challenge,
  Bet,
  CatalogEntry,
  NewCatalogEntry,
  Goal,
  NewGoal,
} from '../types';

// ── Perfiles ───────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const snap = await getDoc(doc(getDb(), 'profiles', userId));
  return snap.exists() ? (snap.data() as Profile) : null;
}

export async function saveProfile(
  userId: string,
  data: Partial<Profile>
): Promise<void> {
  await setDoc(
    doc(getDb(), 'profiles', userId),
    { userId, createdAt: Date.now(), ...data },
    { merge: true }
  );
}

// ── Ligas ──────────────────────────────────────────────────────────────────

function makeCode(): string {
  // Código de 5 caracteres, sin caracteres ambiguos (0/O, 1/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function createLeague(
  name: string,
  userId: string
): Promise<League> {
  const db = getDb();
  // Reintenta si el código ya existe (muy improbable).
  let code = makeCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDocs(
      query(collection(db, 'leagues'), where('code', '==', code), limit(1))
    );
    if (existing.empty) break;
    code = makeCode();
  }
  const ref = doc(collection(db, 'leagues'));
  const league: League = {
    id: ref.id,
    name: name.trim(),
    code,
    createdBy: userId,
    createdAt: Date.now(),
  };
  await setDoc(ref, league);
  await saveProfile(userId, { leagueId: ref.id });
  return league;
}

export async function joinLeagueByCode(
  code: string,
  userId: string
): Promise<League> {
  const db = getDb();
  const snap = await getDocs(
    query(
      collection(db, 'leagues'),
      where('code', '==', code.trim().toUpperCase()),
      limit(1)
    )
  );
  if (snap.empty) {
    throw new Error('No existe ninguna liga con ese código.');
  }
  const league = snap.docs[0].data() as League;
  await saveProfile(userId, { leagueId: league.id });
  return league;
}

export async function getLeague(leagueId: string): Promise<League | null> {
  const snap = await getDoc(doc(getDb(), 'leagues', leagueId));
  return snap.exists() ? (snap.data() as League) : null;
}

/** Push tokens de los miembros de una liga, excluyendo a uno (normalmente uno mismo). */
export async function getLeagueMemberTokens(
  leagueId: string,
  excludeUserId: string
): Promise<string[]> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'profiles'), where('leagueId', '==', leagueId))
  );
  return snap.docs
    .map((d) => d.data() as Profile)
    .filter((p) => p.userId !== excludeUserId && !!p.pushToken)
    .map((p) => p.pushToken as string);
}

/** Miembros (perfiles) de una liga, ordenados por nombre. Para el selector de apuestas. */
export async function getLeagueMembers(leagueId: string): Promise<Profile[]> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'profiles'), where('leagueId', '==', leagueId))
  );
  return snap.docs
    .map((d) => d.data() as Profile)
    .filter((p) => (p.driverName ?? '').trim().length > 0)
    .sort((a, b) => a.driverName.localeCompare(b.driverName));
}

// ── Vueltas ────────────────────────────────────────────────────────────────

export function subscribeLaps(
  leagueId: string,
  onChange: (laps: Lap[]) => void,
  onError?: (e: Error) => void
): () => void {
  const db = getDb();
  const q = query(
    collection(db, 'leagues', leagueId, 'laps'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const laps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lap));
      onChange(laps);
    },
    (err) => onError?.(err as Error)
  );
}

export async function addLap(leagueId: string, lap: NewLap): Promise<string> {
  const db = getDb();
  const ref = await addDoc(collection(db, 'leagues', leagueId, 'laps'), {
    ...lap,
    createdAt: Date.now(),
  });
  return ref.id;
}

/** Actualiza campos de una vuelta (estado de verificación, foto…). */
export async function updateLap(
  leagueId: string,
  lapId: string,
  data: Partial<Lap>
): Promise<void> {
  await setDoc(doc(getDb(), 'leagues', leagueId, 'laps', lapId), data, {
    merge: true,
  });
}

export async function deleteLap(leagueId: string, lapId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'leagues', leagueId, 'laps', lapId));
}

// ── Piques (challenges) ─────────────────────────────────────────────────────

export function subscribeChallenges(
  leagueId: string,
  onChange: (challenges: Challenge[]) => void,
  onError?: (e: Error) => void,
  max = 20
): () => void {
  const db = getDb();
  const q = query(
    collection(db, 'leagues', leagueId, 'challenges'),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Challenge)
      );
      onChange(items);
    },
    (err) => onError?.(err as Error)
  );
}

/** Suscripción a un único pique (para su pantalla de detalle). */
export function subscribeChallenge(
  leagueId: string,
  challengeId: string,
  onChange: (challenge: Challenge | null) => void,
  onError?: (e: Error) => void
): () => void {
  return onSnapshot(
    doc(getDb(), 'leagues', leagueId, 'challenges', challengeId),
    (snap) =>
      onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as Challenge) : null),
    (err) => onError?.(err as Error)
  );
}

export async function addChallenge(
  leagueId: string,
  challenge: Omit<Challenge, 'id' | 'createdAt'>
): Promise<void> {
  const db = getDb();
  await addDoc(collection(db, 'leagues', leagueId, 'challenges'), {
    ...challenge,
    createdAt: Date.now(),
  });
}

/** Modifica un pique (solo lo permite quien lo creó, según las reglas). */
export async function updateChallenge(
  leagueId: string,
  challengeId: string,
  data: Partial<Pick<Challenge, 'car' | 'track' | 'conditions' | 'title'>>
): Promise<void> {
  await setDoc(
    doc(getDb(), 'leagues', leagueId, 'challenges', challengeId),
    data,
    { merge: true }
  );
}

/** Elimina un pique (solo lo permite quien lo creó, según las reglas). */
export async function deleteChallenge(
  leagueId: string,
  challengeId: string
): Promise<void> {
  await deleteDoc(doc(getDb(), 'leagues', leagueId, 'challenges', challengeId));
}

/**
 * Cierra un pique y fija su ganador (solo el creador, según las reglas).
 * El ganador se calcula fuera (mejor vuelta válida del pique) y se pasa aquí.
 */
export async function closeChallenge(
  leagueId: string,
  challengeId: string,
  winner: { winnerId: string; winnerName: string; winnerTimeMs: number }
): Promise<void> {
  await setDoc(
    doc(getDb(), 'leagues', leagueId, 'challenges', challengeId),
    {
      status: 'closed',
      resolvedAt: Date.now(),
      ...winner,
    },
    { merge: true }
  );
}

// ── Catálogo de coches / circuitos personalizados ────────────────────────────
// leagues/{leagueId}/cars/{id}  y  leagues/{leagueId}/tracks/{id}

export type CatalogKindCollection = 'cars' | 'tracks';

export function subscribeCatalog(
  leagueId: string,
  kind: CatalogKindCollection,
  onChange: (entries: CatalogEntry[]) => void,
  onError?: (e: Error) => void
): () => void {
  const db = getDb();
  const q = query(
    collection(db, 'leagues', leagueId, kind),
    orderBy('name')
  );
  return onSnapshot(
    q,
    (snap) =>
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CatalogEntry))),
    (err) => onError?.(err as Error)
  );
}

export async function addCatalogEntry(
  leagueId: string,
  kind: CatalogKindCollection,
  entry: NewCatalogEntry
): Promise<string> {
  const db = getDb();
  // Limpia campos undefined (Firestore no los acepta) y normaliza la URL.
  const data: Record<string, unknown> = {
    name: entry.name,
    kind: entry.kind,
    createdBy: entry.createdBy,
    createdAt: Date.now(),
  };
  if (entry.url) data.url = entry.url;
  if (entry.createdByName) data.createdByName = entry.createdByName;
  const ref = await addDoc(collection(db, 'leagues', leagueId, kind), data);
  return ref.id;
}

export async function deleteCatalogEntry(
  leagueId: string,
  kind: CatalogKindCollection,
  entryId: string
): Promise<void> {
  await deleteDoc(doc(getDb(), 'leagues', leagueId, kind, entryId));
}

// ── Apuestas (bets) ──────────────────────────────────────────────────────────
// leagues/{leagueId}/challenges/{challengeId}/bets/{userId}

export function subscribeBets(
  leagueId: string,
  challengeId: string,
  onChange: (bets: Bet[]) => void,
  onError?: (e: Error) => void
): () => void {
  const db = getDb();
  const q = collection(
    db,
    'leagues',
    leagueId,
    'challenges',
    challengeId,
    'bets'
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as Bet)),
    (err) => onError?.(err as Error)
  );
}

/** Lee las apuestas de un pique de una vez (para calcular la clasificación). */
export async function getChallengeBets(
  leagueId: string,
  challengeId: string
): Promise<Bet[]> {
  const snap = await getDocs(
    collection(getDb(), 'leagues', leagueId, 'challenges', challengeId, 'bets')
  );
  return snap.docs.map((d) => d.data() as Bet);
}

/** Crea o cambia la apuesta del usuario para un pique (1 por piloto, id = userId). */
export async function placeBet(
  leagueId: string,
  challengeId: string,
  bet: Omit<Bet, 'createdAt'>
): Promise<void> {
  await setDoc(
    doc(
      getDb(),
      'leagues',
      leagueId,
      'challenges',
      challengeId,
      'bets',
      bet.userId
    ),
    { ...bet, createdAt: Date.now() }
  );
}

// ── Objetivos personales (profiles/{uid}/goals) ──────────────────────────────

export function subscribeGoals(
  userId: string,
  onData: (goals: Goal[]) => void,
  onError: (e: unknown) => void
): () => void {
  return onSnapshot(
    collection(getDb(), 'profiles', userId, 'goals'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Goal, 'id'>) }))),
    onError
  );
}

export async function addGoal(userId: string, goal: NewGoal): Promise<string> {
  const ref = await addDoc(collection(getDb(), 'profiles', userId, 'goals'), {
    ...goal,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'profiles', userId, 'goals', goalId));
}
