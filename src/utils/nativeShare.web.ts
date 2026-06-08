// Stub web: en web la share card se genera con canvas (ver share.ts), así que
// react-native-view-shot / expo-sharing NO entran en el bundle web.
import { ShareCard } from './shareTypes';

// Host vacío: en web no se monta nada.
export function ShareCardHost(): null {
  return null;
}

export async function shareCardNative(_c: ShareCard): Promise<void> {
  // No debería llamarse en web; shareCard() usa el canvas.
}
