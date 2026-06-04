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
