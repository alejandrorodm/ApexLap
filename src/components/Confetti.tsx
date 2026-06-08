// Confeti de celebración, sin dependencias: una ráfaga de piezas de colores que
// caen girando. Se dispara incrementando la prop `fire` (cada cambio = nueva
// ráfaga). Overlay a pantalla completa que no intercepta toques.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors } from '../theme';

const PALETTE = [
  colors.primary,
  colors.accent,
  colors.blue,
  colors.green,
  colors.gold,
  colors.text,
];
const PIECES = 30;
const DURATION = 1800;

export default function Confetti({ fire }: { fire: number }) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  // Parámetros aleatorios por pieza; se rebarajan en cada ráfaga (`fire`).
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, () => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 140,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        size: 7 + Math.random() * 9,
        spins: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3),
        round: Math.random() > 0.6,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, fire]
  );

  useEffect(() => {
    if (fire === 0) return;
    setVisible(true);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.linear,
      // react-native-web ignora el native driver; en nativo sí lo usamos.
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => setVisible(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-40, height + 60],
        });
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.drift],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spins * 360}deg`],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.82, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.4,
              backgroundColor: p.color,
              borderRadius: p.round ? p.size : 2,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
