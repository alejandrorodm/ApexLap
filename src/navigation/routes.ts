// Mapa de rutas ↔ pantallas de la web. Vive aparte de `linking.ts` (que importa
// react-native) para poder comprobarlo con Node: ver tools/check-routes.js.
export const ROUTE_CONFIG = {
  screens: {
    Tabs: {
      screens: {
        // La portada ('') es la lista de tiempos: al entrar en la raíz no hace
        // falta redirigir a ningún sitio.
        Tiempos: '',
        Records: 'records',
        Ruleta: 'piques',
        Muro: 'muro',
        Liga: 'liga',
        Perfil: 'perfil',
      },
    },
    AddLap: 'nueva-vuelta',
    Challenge: 'pique/:challengeId',
    Participants: 'pilotos',
    Track: 'circuito/:track',
    NewChallenge: 'nuevo-pique',
    Compare: 'comparar/:track',
    H2H: 'cara-a-cara/:aId/:bId',
    Progress: 'progreso',
    Season: 'temporada',
    Skill: 'habilidad',
  },
} as const;
