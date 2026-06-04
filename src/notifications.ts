// Notificaciones push con Expo, SIN servidor propio.
//
// Cómo funciona:
//   1) Cada dispositivo se registra y obtiene un "Expo push token". Lo guardamos
//      en su perfil de Firestore (profiles/{uid}.pushToken).
//   2) Cuando alguien registra una vuelta, la app lee los tokens de los demás
//      miembros de la liga y los avisa llamando a la API pública de Expo.
//
// Limitaciones:
//   - Solo Android/iOS nativo (la web no soporta push remoto: se ignora).
//   - El push de Android necesita credenciales FCM configuradas en EAS al
//     compilar (`eas credentials`). En el primer `eas build` Expo guía el paso.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Cómo se muestran las notificaciones con la app en primer plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Pide permiso y devuelve el Expo push token de este dispositivo (o null si no
 * procede: web, emulador sin servicios, permiso denegado o falta projectId).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // La web no soporta push remoto en Expo.
  if (Platform.OS === 'web') return null;
  // En emuladores/dispositivos sin hardware real no hay push fiable.
  if (!Device.isDevice) return null;

  try {
    // Canal por defecto (obligatorio en Android 8+).
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Vueltas y piques',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    // projectId: lo inyecta EAS Build; lo leemos de la config por seguridad.
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    if (!projectId) return null; // aún no enlazado a EAS (p.ej. en dev local)

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Envía una notificación a varios Expo push tokens vía la API pública de Expo.
 * Best-effort: ignora errores (no debe bloquear el guardado de la vuelta).
 */
export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string
): Promise<void> {
  const valid = tokens.filter((t) => t && t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    channelId: 'default',
  }));

  try {
    await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch {
    /* sin conexión o API caída: lo dejamos pasar */
  }
}
