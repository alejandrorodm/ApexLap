// "Mi progreso": evolución de tus tiempos por combo coche+circuito a lo largo
// del tiempo. Eliges un combo (de los que tienes 2+ vueltas) y ves la gráfica
// con tu mejor marca, la mejora total y cuántas vueltas llevas.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { Chip, EmptyState } from '../components/ui';
import ProgressChart from '../components/ProgressChart';
import { useApp } from '../context/AppContext';
import { driverProgress } from '../utils/leaderboard';
import { formatTime, formatDelta, timeAgo } from '../utils/time';
import { RootStackParamList } from '../navigation/types';

export default function ProgressScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Progress'>>();
  const { laps, userId } = useApp();
  const now = Date.now();
  const [chartW, setChartW] = useState(0);

  const combos = useMemo(
    () => (userId ? driverProgress(laps, userId) : []),
    [laps, userId]
  );

  // Combo inicial: el que venga por params (car+track) o el de más actividad.
  const initialKey = useMemo(() => {
    if (route.params?.car && route.params?.track) {
      const k = `${route.params.car}|${route.params.track}`;
      if (combos.some((c) => c.key === k)) return k;
    }
    return combos[0]?.key ?? null;
  }, [combos, route.params]);

  const [selKey, setSelKey] = useState<string | null>(initialKey);
  const key = selKey ?? initialKey;
  const combo = combos.find((c) => c.key === key) ?? null;

  const improvement = combo ? combo.first - combo.pb : 0; // cuánto has bajado

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>📈 Mi progreso</Text>
        <Text style={styles.subtitle}>Tu evolución por coche y circuito</Text>
      </View>

      {combos.length === 0 ? (
        <EmptyState
          icon="📈"
          title="Aún no hay progreso que mostrar"
          subtitle="Registra 2+ vueltas con un mismo coche en un mismo circuito y aquí verás cómo mejoras."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Selector de combo */}
          <View style={styles.chips}>
            {combos.map((c) => (
              <Chip
                key={c.key}
                label={`${shortCar(c.car)} · ${c.track}`}
                active={c.key === key}
                onPress={() => setSelKey(c.key)}
                color={colors.primary}
              />
            ))}
          </View>

          {combo ? (
            <>
              {/* Encabezado del combo */}
              <Text style={styles.comboTitle} numberOfLines={2}>
                🚗 {combo.car}
              </Text>
              <Text style={styles.comboTrack} numberOfLines={1}>
                📍 {combo.track}
              </Text>

              {/* Estadísticas */}
              <View style={styles.stats}>
                <Stat label="Mejor (PB)" value={formatTime(combo.pb)} highlight />
                <Stat
                  label="Mejora"
                  value={improvement > 0 ? `−${formatDelta(combo.pb, combo.first).replace('-', '')}` : '—'}
                  good={improvement > 0}
                />
                <Stat label="Vueltas" value={String(combo.count)} />
              </View>

              {/* Gráfica */}
              <View
                style={styles.chartCard}
                onLayout={(e) => setChartW(e.nativeEvent.layout.width - 24)}
              >
                <ProgressChart points={combo.points} width={chartW} />
              </View>

              <Text style={styles.legend}>
                🔴 cada vuelta · 🟡 mejor acumulado (PB). Más abajo = más rápido.
              </Text>

              {/* Resumen primera vs última */}
              <View style={styles.rangeRow}>
                <Text style={styles.rangeText}>
                  Primera: {formatTime(combo.first)} ·{' '}
                  {timeAgo(combo.points[0].at, now)}
                </Text>
                <Text style={styles.rangeText}>
                  Última: {formatTime(combo.points[combo.points.length - 1].timeMs)}{' '}
                  · {timeAgo(combo.points[combo.points.length - 1].at, now)}
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Recorta el nombre del coche para el chip (evita chips kilométricos).
function shortCar(car: string): string {
  return car.length > 18 ? `${car.slice(0, 17)}…` : car;
}

function Stat({
  label,
  value,
  highlight,
  good,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  good?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statValue,
          highlight && { color: colors.accent },
          good && { color: colors.green },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  subtitle: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  comboTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  comboTrack: { color: colors.textDim, fontSize: 15, fontWeight: '600', marginTop: 2 },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', marginTop: 3 },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  legend: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  rangeRow: {
    marginTop: spacing.lg,
    gap: 4,
  },
  rangeText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
});
