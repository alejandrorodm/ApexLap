// Google Sign-In NATIVO (Android/iOS). Solo se incluye en el bundle nativo;
// en web Metro resuelve `googleSignIn.web.ts` (un stub), así que la librería
// nativa no entra en la build web.
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID, isGoogleConfigured } from './googleConfig';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/**
 * Lanza el selector de cuenta de Google y devuelve el idToken para
 * `signInWithCredential` de Firebase. Devuelve null si el usuario cancela.
 * Traduce los errores nativos típicos a mensajes claros en español.
 */
export async function googleIdToken(): Promise<string | null> {
  if (!isGoogleConfigured) {
    throw new Error(
      'Falta configurar el Web client ID de Google (src/auth/googleConfig.ts) y recompilar.'
    );
  }
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res: any = await GoogleSignin.signIn();
    // v16: { type: 'success', data: { idToken, ... } } | { type: 'cancelled' }
    if (res?.type === 'cancelled') return null;
    const idToken = res?.data?.idToken ?? res?.idToken ?? null;
    if (!idToken) throw new Error('Google no devolvió el token de identidad.');
    return idToken;
  } catch (e: any) {
    const code = e?.code;
    // Cancelar / intento ya en curso: no es un error que mostrar.
    if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) {
      return null;
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error(
        'Necesitas Google Play Services actualizado para entrar con Google.'
      );
    }
    // DEVELOPER_ERROR (10): la huella SHA-1 de esta build no está registrada en
    // Firebase/Google Cloud. Es el fallo más típico al compilar con EAS.
    if (
      code === (statusCodes as any).DEVELOPER_ERROR ||
      code === 'DEVELOPER_ERROR' ||
      code === '10'
    ) {
      throw new Error(
        'Google no está configurado para esta versión de la app: falta registrar su huella SHA-1 en Firebase. Si compilas con EAS, añade el SHA-1 del keystore de EAS (eas credentials) en Firebase › Authentication › Google.'
      );
    }
    throw e;
  }
}
