// Estado global de la app: sesión (cuenta real o invitado), perfil, liga y vueltas.
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as fbUpdateProfile,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
import { getAppAuth, isFirebaseConfigured } from '../firebase/config';
import {
  getProfile,
  saveProfile,
  getLeague,
  subscribeLaps,
  updateLap,
  createLeague as dbCreateLeague,
  joinLeagueByCode as dbJoinLeague,
  subscribeCatalog,
  addCatalogEntry as dbAddCatalogEntry,
  deleteCatalogEntry as dbDeleteCatalogEntry,
  CatalogKindCollection,
} from '../firebase/db';
import { registerForPushNotifications } from '../notifications';
import { googleIdToken } from '../auth/googleSignIn';
import { Lap, Profile, League, CatalogEntry, CatalogKind } from '../types';

interface AppState {
  ready: boolean; // se conoce el estado de auth (haya usuario o no)
  userId: string | null;
  userEmail: string | null;
  isGuest: boolean; // true si la sesión es anónima (invitado)
  hasPassword: boolean; // true si la cuenta ya tiene método email+contraseña
  profile: Profile | null;
  league: League | null;
  // true solo mientras se descarga la liga del perfil. Distinguirlo de
  // `league === null` evita quedarse en la pantalla de carga para siempre.
  leagueLoading: boolean;
  laps: Lap[];
  lapsLoading: boolean;
  // Catálogo de coches/circuitos añadidos a mano en la liga (mods, DLC…).
  customCars: CatalogEntry[];
  customTracks: CatalogEntry[];
  error: string | null;
  // Descarta el error y relanza la carga de la liga y sus suscripciones.
  retry: () => void;
  // sesión
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  // añade una contraseña a la cuenta actual (p.ej. cuenta de Google) para poder
  // usar el mod / subidor, que solo entran con email+contraseña.
  linkPassword: (password: string) => Promise<void>;
  // acciones de la app
  setDriverName: (name: string) => Promise<void>;
  setDriverPrefs: (prefs: { assists?: boolean; gearbox?: Profile['gearbox'] }) => Promise<void>;
  createLeague: (name: string) => Promise<void>;
  joinLeague: (code: string) => Promise<void>;
  leaveLeague: () => Promise<void>;
  refreshLeague: () => Promise<void>;
  // catálogo (coches/circuitos personalizados de la liga)
  addCustom: (
    kind: CatalogKindCollection,
    entry: { name: string; kind: CatalogKind; url?: string }
  ) => Promise<void>;
  deleteCustom: (
    kind: CatalogKindCollection,
    entryId: string
  ) => Promise<void>;
  // verificación de vueltas (solo el anfitrión las usa de verdad)
  approveLap: (lapId: string) => Promise<void>;
  rejectLap: (lapId: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  // Id de la liga cuya descarga ya terminó (con o sin éxito). Comparándolo con
  // el leagueId del perfil sabemos si estamos cargando SIN un frame de retraso:
  // un booleano puesto desde un efecto llegaría un render tarde y haría
  // parpadear el onboarding.
  const [leagueResolvedFor, setLeagueResolvedFor] = useState<string | null>(null);
  // Lo incrementa `retry` para volver a lanzar la carga de la liga y las
  // suscripciones tras un fallo de red.
  const [reloadKey, setReloadKey] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [lapsLoading, setLapsLoading] = useState(false);
  const [customCars, setCustomCars] = useState<CatalogEntry[]>([]);
  const [customTracks, setCustomTracks] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unsubLaps = useRef<(() => void) | null>(null);
  const unsubCatalog = useRef<(() => void)[]>([]);

  // 1) Observa la sesión. NO inicia sesión solo: si no hay usuario, se muestra
  //    la pantalla de login (con opción "entrar como invitado").
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setReady(true);
      return;
    }
    const auth = getAppAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        setIsGuest(user.isAnonymous);
        setHasPassword(
          user.providerData.some((p) => p.providerId === 'password')
        );
        // el efecto de perfil marcará ready cuando cargue
      } else {
        setUserId(null);
        setUserEmail(null);
        setIsGuest(false);
        setHasPassword(false);
        setProfile(null);
        setReady(true);
      }
    });
    return unsub;
  }, []);

  // 2) Cargar perfil cuando hay userId.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getProfile(userId);
        if (!cancelled)
          setProfile(p ?? { userId, driverName: '', createdAt: Date.now() });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando el perfil.');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 2b) Registrar el dispositivo para push y guardar su token en el perfil.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const token = await registerForPushNotifications();
      if (cancelled || !token) return;
      try {
        await saveProfile(userId, { pushToken: token });
        setProfile((p) => (p ? { ...p, pushToken: token } : p));
      } catch {
        /* el push es opcional: si falla, la app sigue igual */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 3) Cargar liga + suscribirse a vueltas y al catálogo cuando cambia leagueId.
  useEffect(() => {
    unsubLaps.current?.();
    unsubLaps.current = null;
    unsubCatalog.current.forEach((u) => u());
    unsubCatalog.current = [];
    setLaps([]);
    setCustomCars([]);
    setCustomTracks([]);

    const leagueId = profile?.leagueId;
    if (!leagueId) {
      setLeague(null);
      setLeagueResolvedFor(null);
      return;
    }
    setLapsLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const lg = await getLeague(leagueId);
        if (cancelled) return;
        setLeague(lg);
        // La liga del perfil ya no existe (borrada o id huérfano). Si no lo
        // limpiásemos, el gate de App.tsx se quedaría en "Cargando tu liga…"
        // para siempre: soltamos el id para caer en el onboarding.
        if (!lg && userId) {
          await saveProfile(userId, { leagueId: '' });
          if (!cancelled) setProfile((p) => (p ? { ...p, leagueId: undefined } : p));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Error cargando la liga.');
      } finally {
        if (!cancelled) setLeagueResolvedFor(leagueId);
      }
    })();
    unsubLaps.current = subscribeLaps(
      leagueId,
      (l) => {
        setLaps(l);
        setLapsLoading(false);
      },
      (e) => {
        setError(e.message);
        setLapsLoading(false);
      }
    );
    unsubCatalog.current = [
      subscribeCatalog(leagueId, 'cars', setCustomCars, () => {}),
      subscribeCatalog(leagueId, 'tracks', setCustomTracks, () => {}),
    ];
    return () => {
      cancelled = true;
    };
  }, [profile?.leagueId, userId, reloadKey]);

  useEffect(
    () => () => {
      unsubLaps.current?.();
      unsubCatalog.current.forEach((u) => u());
    },
    []
  );

  // ── Sesión ────────────────────────────────────────────────────────────────

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getAppAuth(), email.trim(), password);
  }, []);

  const signUpEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const auth = getAppAuth();
      const current = auth.currentUser;
      let uid: string;
      // Si ya estaba como invitado, "subimos" esa cuenta para conservar sus datos.
      if (current && current.isAnonymous) {
        const credential = EmailAuthProvider.credential(email.trim(), password);
        const res = await linkWithCredential(current, credential);
        uid = res.user.uid;
        await fbUpdateProfile(res.user, { displayName: name.trim() });
      } else {
        const res = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        uid = res.user.uid;
        await fbUpdateProfile(res.user, { displayName: name.trim() });
      }
      if (name.trim()) {
        await saveProfile(uid, { driverName: name.trim() });
        setProfile((p) => ({
          userId: uid,
          createdAt: p?.createdAt ?? Date.now(),
          ...(p ?? {}),
          driverName: name.trim(),
        }));
      }
    },
    []
  );

  const signInGoogle = useCallback(async () => {
    // Web: popup de Firebase. Nativo: selector de Google (id_token) + credencial.
    if (Platform.OS === 'web') {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(getAppAuth(), provider);
      return;
    }
    const idToken = await googleIdToken();
    if (!idToken) return; // el usuario canceló el selector
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(getAppAuth(), credential);
  }, []);

  const signInGuest = useCallback(async () => {
    await signInAnonymously(getAppAuth());
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getAppAuth());
  }, []);

  const linkPassword = useCallback(async (password: string) => {
    const auth = getAppAuth();
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('Tu cuenta no tiene email asociado.');
    }
    const credential = EmailAuthProvider.credential(user.email, password);
    await linkWithCredential(user, credential);
    setHasPassword(true);
  }, []);

  // ── Acciones de la app ──────────────────────────────────────────────────────

  const setDriverName = useCallback(
    async (name: string) => {
      if (!userId) return;
      await saveProfile(userId, { driverName: name.trim() });
      setProfile((p) => ({
        userId,
        createdAt: p?.createdAt ?? Date.now(),
        ...p,
        driverName: name.trim(),
      }));
    },
    [userId]
  );

  // Ajustes de conducción del piloto (ayudas / caja) que usan el mod y el subidor.
  const setDriverPrefs = useCallback(
    async (prefs: { assists?: boolean; gearbox?: Profile['gearbox'] }) => {
      if (!userId) return;
      await saveProfile(userId, prefs);
      setProfile((p) => (p ? { ...p, ...prefs } : p));
    },
    [userId]
  );

  const createLeague = useCallback(
    async (name: string) => {
      if (!userId) return;
      const lg = await dbCreateLeague(name, userId);
      setLeague(lg);
      setProfile((p) => (p ? { ...p, leagueId: lg.id } : p));
    },
    [userId]
  );

  const joinLeague = useCallback(
    async (code: string) => {
      if (!userId) return;
      const lg = await dbJoinLeague(code, userId);
      setLeague(lg);
      setProfile((p) => (p ? { ...p, leagueId: lg.id } : p));
    },
    [userId]
  );

  const leaveLeague = useCallback(async () => {
    if (!userId) return;
    await saveProfile(userId, { leagueId: '' });
    setProfile((p) => (p ? { ...p, leagueId: undefined } : p));
    setLeague(null);
  }, [userId]);

  const refreshLeague = useCallback(async () => {
    if (!profile?.leagueId) return;
    const lg = await getLeague(profile.leagueId);
    setLeague(lg);
  }, [profile?.leagueId]);

  const retry = useCallback(() => {
    setError(null);
    setLeagueResolvedFor(null);
    setReloadKey((k) => k + 1);
  }, []);

  // Cargando = el perfil apunta a una liga que ni tenemos ya cargada ni hemos
  // terminado de pedir. La comprobación de `league.id` evita el parpadeo al
  // crear o unirse a una liga, que la dejan puesta antes de que corra el efecto.
  const leagueLoading =
    !!profile?.leagueId &&
    leagueResolvedFor !== profile.leagueId &&
    league?.id !== profile.leagueId;

  // ── Catálogo (coches/circuitos personalizados de la liga) ──────────────────
  const addCustom = useCallback(
    async (
      kind: CatalogKindCollection,
      entry: { name: string; kind: CatalogKind; url?: string }
    ) => {
      if (!userId || !league) return;
      await dbAddCatalogEntry(league.id, kind, {
        name: entry.name.trim(),
        kind: entry.kind,
        // Se conserva la cadena vacía: es la señal de "quitar el mapa".
        url: entry.url === undefined ? undefined : entry.url.trim(),
        createdBy: userId,
        createdByName: profile?.driverName || undefined,
      });
    },
    [userId, league, profile?.driverName]
  );

  const deleteCustom = useCallback(
    async (kind: CatalogKindCollection, entryId: string) => {
      if (!league) return;
      await dbDeleteCatalogEntry(league.id, kind, entryId);
    },
    [league]
  );

  // Verificar/rechazar una vuelta manual (lo permite el anfitrión por reglas).
  const approveLap = useCallback(
    async (lapId: string) => {
      if (!league) return;
      await updateLap(league.id, lapId, { status: 'verified' });
    },
    [league]
  );

  const rejectLap = useCallback(
    async (lapId: string) => {
      if (!league) return;
      await updateLap(league.id, lapId, { status: 'rejected' });
    },
    [league]
  );

  return (
    <Ctx.Provider
      value={{
        ready,
        userId,
        userEmail,
        isGuest,
        hasPassword,
        profile,
        league,
        leagueLoading,
        laps,
        lapsLoading,
        customCars,
        customTracks,
        error,
        retry,
        signInEmail,
        signUpEmail,
        signInGoogle,
        signInGuest,
        signOut,
        linkPassword,
        setDriverName,
        setDriverPrefs,
        createLeague,
        joinLeague,
        leaveLeague,
        refreshLeague,
        addCustom,
        deleteCustom,
        approveLap,
        rejectLap,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
