// URLs de la web. Sin esto la barra de direcciones nunca cambiaba: no se podía
// compartir un pique concreto, el botón Atrás del navegador se salía de la app y
// recargar te devolvía al inicio.
//
// Solo se activa en web. En nativo la navegación se queda como estaba (los
// enlaces profundos de Android/iOS necesitarían un `scheme` y una prueba en
// dispositivo que aquí no se puede hacer).
//
// Ojo: las rutas llevan el id del pique o el nombre del circuito, pero NO la
// liga: cada uno ve los suyos dentro de la liga en la que está. Un enlace es
// útil entre miembros de la misma liga, que es justo el caso de uso.
import { Platform } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';
import { ROUTE_CONFIG } from './routes';

export const linking: LinkingOptions<RootStackParamList> = {
  enabled: Platform.OS === 'web',
  prefixes: ['https://apexlap.web.app', 'https://apexlap.firebaseapp.com'],
  config: ROUTE_CONFIG as LinkingOptions<RootStackParamList>['config'],
};
