// Cuenta atrás de un pique con fecha límite. En la última hora late (el
// `apexPulse` del marco web) y baja a segundos: es cuando el pique se decide.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { formatCountdown } from '../utils/time';

// Por debajo de esto el pique entra en "última hora".
const URGENT_MS = 60 * 60 * 1000;

/**
 * Reloj que se ajusta solo: cada segundo en la última hora (que es cuando se
 * ven los segundos) y cada medio minuto el resto del tiempo. Al encadenar el
 * temporizador con el propio `now`, el ritmo cambia solo al entrar en la
 * última hora, sin tener que vigilarlo aparte.
 */
function useNow(deadline: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const left = deadline - now;
    if (left <= 0) return; // plazo cumplido: ya no hay nada que refrescar
    const every = left <= URGENT_MS ? 1000 : 30_000;
    const id = setTimeout(() => setNow(Date.now()), every);
    return () => clearTimeout(id);
  }, [now, deadline]);
  return now;
}

export function Countdown({
  deadline,
  compact,
}: {
  deadline: number;
  compact?: boolean;
}) {
  const now = useNow(deadline);
  const left = deadline - now;
  const text = formatCountdown(deadline, now);
  const urgent = left > 0 && left <= URGENT_MS;

  if (!text) {
    return (
      <View style={[styles.pill, styles.pillOver, compact && styles.pillSm]}>
        <Text style={[styles.text, styles.textOver, compact && styles.textSm]}>
          ⏱ TIEMPO CUMPLIDO
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.pill,
        urgent && styles.pillUrgent,
        compact && styles.pillSm,
      ]}
      {...(urgent ? ({ dataSet: { anim: 'pulse' } } as any) : {})}
    >
      <Text
        style={[styles.text, urgent && styles.textUrgent, compact && styles.textSm]}
      >
        {urgent ? '🔥' : '⏳'} {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  pillSm: { paddingVertical: 2 },
  pillUrgent: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,30,20,0.14)',
  },
  pillOver: { borderColor: colors.borderHi, backgroundColor: colors.surfaceAlt },
  text: {
    color: colors.textDim,
    fontFamily: font.display,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  textSm: { fontSize: 11 },
  textUrgent: { color: colors.primary },
  textOver: { color: colors.textDim },
});
