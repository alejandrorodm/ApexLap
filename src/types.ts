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
