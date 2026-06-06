// Tema visual "racing" oscuro, compartido por toda la app.

export const colors = {
  bgDeep: '#08090C', // fondo de la "página" web, a los lados del marco
  bg: '#0E0F13',
  surface: '#181A21',
  surfaceAlt: '#21242E',
  border: '#2C303B',
  primary: '#E10600', // rojo carrera
  primaryDim: '#7A0A06',
  accent: '#FFD60A', // amarillo bandera
  green: '#39D353',
  blue: '#3B82F6',
  text: '#F5F6FA',
  textDim: '#9AA0AE',
  textFaint: '#5C6373',
  gold: '#FFD700',
  silver: '#C0C6D4',
  bronze: '#CD7F32',
};

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
  pill: 999,
};

export const font = {
  // RN no permite fácilmente fuentes monoespaciadas custom sin cargarlas;
  // usamos la del sistema para los tiempos para que queden alineados.
  mono: undefined as string | undefined,
};
