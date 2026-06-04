// Punto único de verdad para el breakpoint "ancho" en web (portátil/escritorio).
// En nativo (móvil) siempre es false: el móvil mantiene su layout.
import { Platform, useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 840;

export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}
