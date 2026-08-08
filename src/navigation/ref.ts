// Referencia al contenedor de navegación, para poder navegar desde fuera de un
// componente (p.ej. al pulsar un aviso del navegador).
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(screen: string, params?: object): void {
  if (navigationRef.isReady()) {
    // El tipado de navigate() con nombres dinámicos no aporta aquí: quien llama
    // viene de un aviso, no del árbol de rutas.
    (navigationRef.navigate as any)(screen, params);
  }
}
