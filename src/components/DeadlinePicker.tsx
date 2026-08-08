// Elección de la fecha límite al convocar un pique. Se usa igual desde la
// ruleta y desde "nuevo pique", así que vive en un solo sitio.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { Chip } from './ui';

const HOUR = 60 * 60 * 1000;

export const DEADLINE_OPTIONS: { label: string; ms: number | null }[] = [
  { label: 'Sin límite', ms: null },
  { label: '1 h', ms: HOUR },
  { label: '6 h', ms: 6 * HOUR },
  { label: '24 h', ms: 24 * HOUR },
  { label: '3 días', ms: 72 * HOUR },
];

/** Convierte la duración elegida en la fecha límite que se guarda. */
export function deadlineFrom(durationMs: number | null): number | undefined {
  return durationMs === null ? undefined : Date.now() + durationMs;
}

export function DeadlinePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (ms: number | null) => void;
}) {
  return (
    <View style={styles.row}>
      {DEADLINE_OPTIONS.map((o) => (
        <Chip
          key={o.label}
          label={o.label}
          active={value === o.ms}
          onPress={() => onChange(o.ms)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
