// Vigila la actividad de la liga y saca un aviso del navegador cuando pasa algo
// mientras tienes la pestaña detrás (jugando a AC, por ejemplo).
//
// No abre ninguna suscripción nueva: se cuelga del mismo feed que pinta el Muro,
// así que lo que avisa y lo que se lee ahí es exactamente lo mismo.
import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { buildFeed, FeedEvent } from './feed';
import {
  pageHidden,
  showWebNotification,
  webNotifyPermission,
  webNotifySupported,
} from './webNotify';

// Más de esto de golpe y se resume en un solo aviso, para no acribillar.
const MAX_INDIVIDUAL = 2;

function destinationOf(e: FeedEvent) {
  if (e.challengeId) {
    return { screen: 'Challenge', params: { challengeId: e.challengeId } };
  }
  if (e.track) return { screen: 'Track', params: { track: e.track } };
  return undefined;
}

export function useLeagueAlerts(): void {
  const { laps, challenges, userId } = useApp();
  // En nativo no hay avisos de navegador: ni se construye el feed (recorrer
  // todas las vueltas en cada snapshot sería trabajo tirado en el móvil).
  const supported = webNotifySupported();
  const feed = useMemo(
    () => (supported ? buildFeed(laps, challenges, userId) : []),
    [supported, laps, challenges, userId]
  );
  // null hasta la primera carga: al entrar, todo lo que ya había es "historia" y
  // no debe disparar veinte avisos de golpe.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!supported) return;

    if (seen.current === null) {
      seen.current = new Set(feed.map((e) => e.id));
      return;
    }

    const fresh = feed.filter((e) => !seen.current!.has(e.id));
    feed.forEach((e) => seen.current!.add(e.id));
    if (fresh.length === 0) return;

    // Con la app delante no hace falta: ya lo estás viendo.
    if (!pageHidden() || webNotifyPermission() !== 'granted') return;

    // Lo tuyo no se te notifica.
    const others = fresh.filter((e) => e.actorId !== userId);
    if (others.length === 0) return;

    if (others.length > MAX_INDIVIDUAL) {
      showWebNotification({
        title: `🏁 ${others.length} novedades en la liga`,
        body: others
          .slice(0, 3)
          .map((e) => e.text)
          .join(' · '),
        tag: 'apexlap-resumen',
        goTo: { screen: 'Muro' },
      });
      return;
    }

    others.forEach((e) => {
      showWebNotification({
        title: `${e.icon} ${e.text}`,
        body: e.sub,
        tag: e.id,
        goTo: destinationOf(e),
      });
    });
  }, [feed, userId, supported]);
}
