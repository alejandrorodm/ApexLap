// Modelos de datos de la app.

export type Conditions = 'dry' | 'wet' | 'mixed';
export type Gearbox = 'auto' | 'manual' | 'manual-clutch';

export interface Lap {
  id: string;
  userId: string;
  driverName: string;
  car: string;
  track: string;
  timeMs: number; // tiempo de vuelta en milisegundos
  // Tiempos por sector en ms (S1, S2, S3…), tal y como los guarda AC/Content
  // Manager. Opcional: las vueltas manuales y las antiguas no lo traen.
  sectors?: number[];
  conditions: Conditions;
  assists: boolean; // true = con ayudas (ABS/TC/etc.)
  gearbox: Gearbox;
  notes?: string;
  challengeId?: string; // si la vuelta nace de un pique de la ruleta
  // Origen y verificación. Las manuales (app) entran 'pending' y el anfitrión las
  // aprueba/rechaza; las del mod/subidor entran 'verified'. Una vuelta SIN estado
  // es antigua (anterior a esta función) y se trata como verificada (cuenta igual).
  source?: 'auto' | 'manual';
  status?: 'verified' | 'pending' | 'rejected';
  photoUrl?: string; // captura de prueba (opcional); se borra al verificar/rechazar
  photoPath?: string; // ruta en Storage de esa captura (para poder borrarla)
  createdAt: number; // epoch ms
}

export interface Profile {
  userId: string;
  driverName: string;
  leagueId?: string;
  pushToken?: string; // Expo push token de este dispositivo (para notificaciones)
  // Ajustes de conducción declarados por el piloto. El mod y el subidor los
  // aplican a las vueltas que suben automáticamente (que si no irían con valores
  // neutros: sin ayudas / caja manual).
  assists?: boolean;
  gearbox?: Gearbox;
  createdAt: number;
}

export interface League {
  id: string;
  name: string;
  code: string; // código corto para que se unan los colegas
  createdBy: string;
  createdAt: number;
}

export type ChallengeStatus = 'open' | 'closed';

export interface Challenge {
  id: string;
  car: string;
  track: string;
  conditions: Conditions;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  title?: string;
  // Ciclo de vida del pique. Los piques antiguos sin este campo se tratan como 'open'.
  status?: ChallengeStatus;
  // Resultado, fijado al cerrarse el pique (mejor vuelta válida del pique).
  winnerId?: string;
  winnerName?: string;
  winnerTimeMs?: number;
  resolvedAt?: number;
}

// Apuesta: cada piloto predice quién ganará un pique (puede apostar por sí mismo
// o por otro). Vive en leagues/{id}/challenges/{cid}/bets/{userId} (1 por piloto).
export interface Bet {
  userId: string; // quién apuesta (= id del documento)
  userName: string;
  predictedUserId: string; // por quién apuesta (ganador previsto)
  predictedName: string;
  createdAt: number;
}

// Datos que se mandan a Firestore al crear una vuelta (sin id ni metadatos derivados).
export type NewLap = Omit<Lap, 'id' | 'createdAt'>;

// Objetivo personal: un tiempo a batir en un coche+circuito. Vive en
// profiles/{uid}/goals/{id}. "Logrado" se deriva de tus vueltas (no se guarda).
export interface Goal {
  id: string;
  car: string;
  track: string;
  targetMs: number;
  createdAt: number;
}

export type NewGoal = Omit<Goal, 'id' | 'createdAt'>;

// Comentario en un pique (la pulla del grupo). Vive en
// leagues/{id}/challenges/{cid}/comments/{id}.
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

// ── Catálogo de coches/circuitos personalizados ──────────────────────────────
// Cada liga guarda los coches y circuitos que sus miembros añaden a mano (mods,
// DLC…), con una etiqueta de origen y, para los mods, la URL de descarga.
// Viven en leagues/{id}/cars/{id} y leagues/{id}/tracks/{id}.

export type CatalogKind = 'mod' | 'kunos' | 'ac';

export interface CatalogEntry {
  id: string;
  name: string; // nombre del coche o "Circuito · Trazado"
  kind: CatalogKind; // MOD / KUNOS / AC Original
  url?: string; // origen del mod (descarga), opcional
  createdBy: string;
  createdByName?: string;
  createdAt: number;
}

export type NewCatalogEntry = Omit<CatalogEntry, 'id' | 'createdAt'>;

export const CATALOG_KIND_LABEL: Record<CatalogKind, string> = {
  mod: 'MOD',
  kunos: 'KUNOS',
  ac: 'AC Original',
};
