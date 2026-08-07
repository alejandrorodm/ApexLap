// "Cara a cara": marcador entre dos pilotos combo a combo. Solo cuentan los
// coche+circuito donde AMBOS han rodado, comparando la mejor vuelta de cada uno.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { headToHead, H2HCombo } from '../utils/leaderboard';
import { formatTime, formatDelta } from '../utils/time';
import { RootStackParamList } from '../navigation/types';

export default function H2HScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'H2H'>>();
  const { aId, aName, bId, bName } = route.params;
  const { laps } = useApp();

  const h2h = useMemo(() => headToHead(laps, aId, bId), [laps, aId, bId]);
  const { winsA, winsB, ties, combos } = h2h;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>🆚 Cara a cara</Text>
      </View>

      {combos.length === 0 ? (
        <EmptyState
          icon="🆚"
          title="Todavía no coincidís"
          subtitle={`${aName} y ${bName} no tenéis ningún coche+circuito en común. En cuanto los dos rodéis en el mismo combo, aparecerá aquí el marcador.`}
        />
      ) : (
        <FlatList
          data={combos}
          keyExtractor={(c) => c.key}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.scoreCard} {...({ dataSet: { anim: 'rise' } } as any)}>
              <View style={styles.namesRow}>
                <Text style={[styles.name, styles.nameA]} numberOfLines={1}>
                  {aName}
                </Text>
                <Text style={styles.vs}>🆚</Text>
                <Text style={[styles.name, styles.nameB]} numberOfLines={1}>
                  {bName}
                </Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={[styles.score, winsA > winsB && styles.scoreLead]}>
                  {winsA}
                </Text>
                <Text style={styles.dash}>–</Text>
                <Text style={[styles.score, winsB > winsA && styles.scoreLead]}>
                  {winsB}
                </Text>
              </View>
              <Text style={styles.scoreMeta}>
                {combos.length} {combos.length === 1 ? 'combo' : 'combos'} en común
                {ties > 0 ? ` · ${ties} en tablas` : ''}
              </Text>
              <Text style={styles.scoreHint}>
                {winsA === winsB
                  ? 'Empate técnico. A desempatar.'
                  : `Manda ${winsA > winsB ? aName : bName}.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ComboRow
              combo={item}
              onPress={() =>
                navigation.navigate('Compare', {
                  track: item.track,
                  car: item.car,
                })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// Una fila por combo: quién gana, ambos tiempos y la diferencia.
function ComboRow({ combo, onPress }: { combo: H2HCombo; onPress: () => void }) {
  const { car, track, aLap, bLap, winner } = combo;
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      {...({ dataSet: { anim: 'rise' } } as any)}
    >
      <View style={styles.rowHead}>
        <Text style={styles.rowTrack} numberOfLines={1}>
          {track}
        </Text>
        <Text style={styles.rowDelta}>
          {winner === 'tie' ? 'tablas' : formatDelta(aLap.timeMs, bLap.timeMs)}
        </Text>
      </View>
      <Text style={styles.rowCar} numberOfLines={1}>
        🚗 {car}
      </Text>
      <View style={styles.timesRow}>
        <Text
          style={[styles.time, winner === 'a' && styles.timeWin]}
          numberOfLines={1}
        >
          {winner === 'a' ? '🏆 ' : ''}
          {formatTime(aLap.timeMs)}
        </Text>
        <Text style={styles.timesSep}>vs</Text>
        <Text
          style={[styles.time, styles.timeRight, winner === 'b' && styles.timeWin]}
          numberOfLines={1}
        >
          {formatTime(bLap.timeMs)}
          {winner === 'b' ? ' 🏆' : ''}
        </Text>
      </View>
    </Pressable>
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
  back: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  title: {
    marginTop: 6,
    color: colors.text,
    fontFamily: font.display,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },

  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  namesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  name: { flex: 1, fontSize: 15, fontWeight: '900' },
  nameA: { color: colors.primary, textAlign: 'right' },
  nameB: { color: colors.blue, textAlign: 'left' },
  vs: { fontSize: 15 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  score: {
    color: colors.textDim,
    fontFamily: font.display,
    fontSize: 44,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreLead: { color: colors.text },
  dash: { color: colors.textFaint, fontSize: 28, fontWeight: '900' },
  scoreMeta: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  scoreHint: {
    marginTop: 2,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },

  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTrack: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  rowDelta: {
    color: colors.textDim,
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  rowCar: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginTop: 2 },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  time: {
    flex: 1,
    color: colors.textDim,
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timeRight: { textAlign: 'right' },
  timeWin: { color: colors.accent },
  timesSep: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
});
