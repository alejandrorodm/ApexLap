// Tema visual "racing" oscuro, compartido por toda la app.
import { Platform } from 'react-native';

export const colors = {
  bgDeep: '#06070A', // fondo de la "página" web, a los lados del marco
  bg: '#0B0D12',
  // Fondo de las pantallas. OPACO (no transparente): si fuera transparente, al
  // cambiar de pantalla se verían solapadas durante la transición. El "fondo a
  // pantalla completa" se logra con el marco a pantalla completa (WebFrame), no
  // con transparencia.
  bgScreen: '#0B0D12',
  surface: '#14161E',
  surfaceAlt: '#1C2030',
  surfaceHi: '#262B3D', // superficie elevada (hover / destacados)
  border: '#2E3342',
  borderHi: '#3C4356',
  primary: '#FF1E14', // rojo carrera (vivo): acentos, brillos, texto sobre oscuro
  // Rojo de RELLENO para superficies grandes con texto blanco encima. El
  // primario vivo solo da 3,6:1 con blanco y no pasa AA; este da 4,95:1 y a
  // simple vista es el mismo rojo.
  primaryFill: '#D6140D',
  primaryDim: '#7A0A06',
  primaryGlow: 'rgba(255,30,20,0.45)',
  accent: '#FFD60A', // amarillo bandera
  accentDim: '#6E5A00',
  green: '#39D353',
  blue: '#3B82F6',
  text: '#F6F7FB',
  textDim: '#9AA0AE',
  // Antes #5C6373: daba 3,0:1 sobre las tarjetas y se usa para TODOS los
  // placeholders y las pestañas inactivas. Este llega a 4,9:1 (AA).
  textFaint: '#858DA0',
  gold: '#FFD24A',
  silver: '#C8CEDA',
  bronze: '#E08A4B',
};

// Colores de podio por posición (1º, 2º, 3º). El resto usa textDim.
export const PODIUM = [colors.gold, colors.silver, colors.bronze];

// Luminancia relativa WCAG de un color '#rrggbb' (0 = negro, 1 = blanco).
function luminance(hex: string): number | null {
  const h = hex.replace('#', '');
  if (h.length < 6) return null;
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Contraste WCAG entre dos colores (1 = ninguno, 21 = negro sobre blanco). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Color de texto legible (claro u oscuro) sobre un fondo dado. Elige el que MÁS
// contraste da, no el que sugiere el "brillo" del fondo: sobre el rojo vivo el
// blanco se queda en 3,6:1 mientras que el oscuro llega a 5,2:1.
export function readableTextOn(bg: string): string {
  return contrastRatio(colors.text, bg) >= contrastRatio(colors.bgDeep, bg)
    ? colors.text
    : colors.bgDeep;
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
  // Tipografía "display" tecno para titulares, tiempos y posiciones. En web se
  // sirve por Google Fonts (ver WebFrame); en nativo se empaqueta con expo-font
  // (ver App.tsx, familia 'Orbitron'). Misma fuente en todas las plataformas.
  display: Platform.select({
    web: 'Orbitron, Inter, sans-serif',
    default: 'Orbitron',
  }) as string | undefined,
  // RN no permite fácilmente fuentes monoespaciadas custom sin cargarlas;
  // usamos la del sistema para los tiempos para que queden alineados.
  mono: undefined as string | undefined,
};
