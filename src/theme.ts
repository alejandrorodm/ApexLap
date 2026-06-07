// Tema visual "racing" oscuro, compartido por toda la app.
import { Platform } from 'react-native';

export const colors = {
  bgDeep: '#06070A', // fondo de la "página" web, a los lados del marco
  bg: '#0B0D12',
  // Fondo de las pantallas: transparente en web para que el degradado inmersivo
  // del marco (WebFrame) ocupe toda la pantalla; sólido en nativo.
  bgScreen: (Platform.select({ web: 'transparent', default: '#0B0D12' }) ??
    '#0B0D12') as string,
  surface: '#14161E',
  surfaceAlt: '#1C2030',
  surfaceHi: '#262B3D', // superficie elevada (hover / destacados)
  border: '#2E3342',
  borderHi: '#3C4356',
  primary: '#FF1E14', // rojo carrera (vivo)
  primaryDim: '#7A0A06',
  primaryGlow: 'rgba(255,30,20,0.45)',
  accent: '#FFD60A', // amarillo bandera
  accentDim: '#6E5A00',
  green: '#39D353',
  blue: '#3B82F6',
  text: '#F6F7FB',
  textDim: '#9AA0AE',
  textFaint: '#5C6373',
  gold: '#FFD24A',
  silver: '#C8CEDA',
  bronze: '#E08A4B',
};

// Colores de podio por posición (1º, 2º, 3º). El resto usa textDim.
export const PODIUM = [colors.gold, colors.silver, colors.bronze];

// Color de texto legible (claro u oscuro) sobre un fondo dado. Sirve para que las
// letras de un botón/chip resalten también sobre fondos claros como el amarillo.
export function readableTextOn(bg: string): string {
  const hex = bg.replace('#', '');
  if (hex.length < 6) return colors.text;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Luminancia perceptual (0–1). Por encima del umbral, el fondo es claro.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? colors.bgDeep : colors.text;
}

// Resplandor de color (en web se traduce a box-shadow; en nativo a sombra/elevación).
// Aporta esa sensación de "neón / velocidad" a botones y elementos destacados.
export function glow(color: string, radius = 16, opacity = 0.55) {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const font = {
  // Tipografía "display" tecno para titulares, tiempos y posiciones. Orbitron se
  // carga en web (ver WebFrame); en nativo cae a la del sistema (undefined).
  display: Platform.select({
    web: 'Orbitron, Inter, sans-serif',
    default: undefined,
  }) as string | undefined,
  // RN no permite fácilmente fuentes monoespaciadas custom sin cargarlas;
  // usamos la del sistema para los tiempos para que queden alineados.
  mono: undefined as string | undefined,
};
