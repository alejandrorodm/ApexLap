// Limita el ancho del contenido y lo centra. En un monitor, sin esto, las filas
// de las listas se estiran de borde a borde y cuesta seguirlas; el fondo
// inmersivo sigue ocupando toda la pantalla por detrás.
//
// En móvil no hace nada: `maxWidth` nunca llega a activarse a esos anchos.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CONTENT_MAX_WIDTH } from '../responsive';

export function ContentWidth({ children }: { children: React.ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

/** Envuelve una pantalla para registrarla en el navegador ya acotada. */
export function withContentWidth<P extends object>(
  Screen: React.ComponentType<P>
): React.ComponentType<P> {
  function Bounded(props: P) {
    return (
      <View style={styles.wrap}>
        <Screen {...props} />
      </View>
    );
  }
  Bounded.displayName = `withContentWidth(${
    Screen.displayName || Screen.name || 'Screen'
  })`;
  return Bounded;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
