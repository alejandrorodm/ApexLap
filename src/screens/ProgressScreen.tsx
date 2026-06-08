// "Mi progreso": evolución de tus tiempos por combo coche+circuito a lo largo
// del tiempo. Eliges un combo (de los que tienes 2+ vueltas) y ves la gráfica
// con tu mejor marca, la mejora total y cuántas vueltas llevas.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { Chip, EmptyState, Button, Field } from '../components/ui';
import ProgressChart from '../components/ProgressChart';
import { useApp } from '../context/AppContext';
import { driverProgress } from '../utils/leaderboard';
import { formatTime, formatDelta, timeAgo, parseTime } from '../utils/time';
import { subscribeGoals, addGoal, deleteGoal } from '../firebase/db';
import { notify } from '../utils/alerts';
import { Goal } from '../types';
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

  // Objetivos personales del piloto.
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalText, setGoalText] = useState('');
  const [goalBusy, setGoalBusy] = useState(false);
  useEffect(() => {
    if (!userId) return;
    return subscribeGoals(userId, setGoals, () => {});
  }, [userId]);

  const comboGoal = combo
    ? goals.find((g) => g.car === combo.car && g.track === combo.track) ?? null
    : null;

  async function setGoal() {
    if (!userId || !combo) return;
    const ms = parseTime(goalText);
    if (ms == null) {
      notify('Tiempo no válido', 'Escribe el objetivo como m:ss.mmm (p. ej. 1:42.000).');
      return;
    }
    setGoalBusy(true);
    try {
      await addGoal(userId, { car: combo.car, track: combo.track, targetMs: ms });
      setGoalText('');
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo guardar el objetivo.');
    } finally {
      setGoalBusy(false);
    }
  }

  async function removeGoal() {
    if (!userId || !comboGoal) return;
    try {
      await deleteGoal(userId, comboGoal.id);
    } catch {
      /* da igual */
    }
  }

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

              {/* Objetivo personal para este combo */}
              <View style={styles.goalCard}>
                <Text style={styles.goalTitle}>🎯 Objetivo</Text>
                {comboGoal ? (
                  (() => {
                    const done = combo.pb <= comboGoal.targetMs;
                    return (
                      <>
                        <View style={styles.goalRow}>
                          <Text style={styles.goalTarget}>
                            {formatTime(comboGoal.targetMs)}
                          </Text>
                          <Text
                            style={[
                              styles.goalState,
                              { color: done ? colors.green : colors.textDim },
                            ]}
                          >
                            {done
                              ? '✓ ¡Logrado!'
                              : `te faltan ${formatDelta(combo.pb, comboGoal.targetMs).replace('+', '')}`}
                          </Text>
                        </View>
                        <Button
                          title="Quitar objetivo"
                          variant="ghost"
                          onPress={removeGoal}
                          style={{ marginTop: spacing.xs }}
                        />
                      </>
                    );
                  })()
                ) : (
                  <>
                    <Text style={styles.goalHint}>
                      Fija un tiempo a batir con este coche aquí. Tu mejor:{' '}
                      {formatTime(combo.pb)}.
                    </Text>
                    <Field
                      value={goalText}
                      onChangeText={setGoalText}
                      placeholder="m:ss.mmm (p. ej. 1:42.000)"
                      keyboardType="numbers-and-punctuation"
                      style={styles.goalInput}
                    />
                    <Button
                      title="🎯 Fijar objetivo"
                      onPress={setGoal}
                      loading={goalBusy}
                      style={{ marginTop: spacing.xs }}
                    />
                  </>
                )}
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
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentDim,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  goalTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: spacing.sm },
  goalHint: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalTarget: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
  },
  goalState: { fontSize: 14, fontWeight: '800' },
  goalInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 16,
  },
});
