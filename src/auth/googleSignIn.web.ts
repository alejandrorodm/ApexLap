// Stub web: en web el login con Google usa el popup de Firebase
// (signInWithPopup), no la librería nativa. Este fichero evita que
// @react-native-google-signin entre en el bundle web.
export async function googleIdToken(): Promise<string | null> {
  throw new Error('En web el login con Google usa el popup del navegador.');
}
