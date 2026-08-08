// Avisos del navegador en la web.
//
// POR QUÉ NO ES "PUSH" DE VERDAD: mandar push con la pestaña cerrada exige FCM,
// y FCM solo acepta envíos firmados con una cuenta de servicio (la API antigua
// de `server_key` está apagada). Esa clave no puede ir en un cliente, así que
// haría falta un backend — Cloud Functions, que pide plan de pago.
//
// Lo que sí se puede sin servidor: mientras la app esté abierta en una pestaña
// —aunque esté detrás, que es el caso real cuando juegas a Assetto Corsa a
// pantalla completa— las suscripciones en tiempo real que ya tenemos disparan
// un aviso del sistema. Los avisos a móviles Android siguen saliendo por Expo
// (ver notifications.ts), y eso no cambia.
import { Platform } from 'react-native';
import { navigate } from '../navigation/ref';

type Permission = 'granted' | 'denied' | 'default' | 'unsupported';

function api(): typeof Notification | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return window.Notification;
}

export function webNotifySupported(): boolean {
  return api() !== null;
}

export function webNotifyPermission(): Permission {
  const N = api();
  return N ? (N.permission as Permission) : 'unsupported';
}

/** Pide permiso al usuario. Los navegadores lo exigen desde un gesto suyo. */
export async function askWebNotifyPermission(): Promise<Permission> {
  const N = api();
  if (!N) return 'unsupported';
  try {
    return (await N.requestPermission()) as Permission;
  } catch {
    return 'denied';
  }
}

/** ¿Está la pestaña en segundo plano? Solo avisamos entonces. */
export function pageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export function showWebNotification(opts: {
  title: string;
  body?: string;
  tag?: string;
  // Pantalla a la que saltar al pulsar el aviso.
  goTo?: { screen: string; params?: object };
}): void {
  const N = api();
  if (!N || N.permission !== 'granted') return;
  try {
    const n = new N(opts.title, {
      body: opts.body,
      tag: opts.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
    n.onclick = () => {
      window.focus();
      if (opts.goTo) navigate(opts.goTo.screen, opts.goTo.params);
      n.close();
    };
  } catch {
    /* un aviso que falla no puede tumbar la app */
  }
}
