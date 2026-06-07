// Punto único de verdad para el breakpoint "ancho" en web (portátil/escritorio).
// En nativo (móvil) siempre es false: el móvil mantiene su layout.
import { Platform, useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 840;

export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}

// Nº de columnas para rejillas de tarjetas (circuitos / coches), según el ancho
// real de la ventana. En móvil/estrecho siempre 1. Aprovecha el portátil/escritorio.
export function useGridColumns(): number {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return 1;
  if (width >= 1500) return 4;
  if (width >= 1080) return 3;
  if (width >= WIDE_BREAKPOINT) return 2;
  return 1;
}
