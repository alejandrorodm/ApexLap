// "Habilidad": ranking de pilotos por ELO. Cada pique cerrado actualiza el ELO
// según a quién superas (ganas más si bates a alguien mejor que tú).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { subscribeChallenges } from '../firebase/db';
import { eloTable, EloRow } from '../utils/leaderboard';
import { motesByDriver, aggregateDrivers } from '../utils/achievements';
import { shareTableCard } from '../utils/share';
import { Challenge } from '../types';
import { RootStackParamList } from '../navigation/types';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function SkillScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { league, userId, laps } = useApp();
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    if (!league) return;
    return subscribeChallenges(league.id, setChallenges, () => {}, 200);
  }, [league?.id]);

  const table = useMemo(() => eloTable(laps, challenges), [laps, challenges]);
  const motes = useMemo(
    () => motesByDriver(aggregateDrivers(laps, challenges)),
    [laps, challenges]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>🥇 Habilidad</Text>
        <Text style={styles.subtitle}>
          ELO por piques · ganas más batiendo a quien va por delante
        </Text>
      </View>

      {table.length === 0 ? (
        <EmptyState
          icon="🥇"
          title="Sin ranking todavía"
          subtitle="El ELO se calcula con los piques cerrados. Cerrad piques y la habilidad de cada uno irá tomando forma."
        />
      ) : (
        <FlatList
          data={table}
          keyExtractor={(r) => r.userId}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <Pressable
              style={styles.shareBtn}
              onPress={() =>
                shareTableCard({
                  title: 'Habilidad',
                  subtitle: league?.name,
                  valueLabel: 'ELO',
                  rows: table.map((r) => ({ name: r.driverName, value: String(r.elo) })),
                })
              }
            >
              <Text style={styles.shareText}>📊 Compartir ranking</Text>
            </Pressable>
          }
          renderItem={({ item, index }) => (
            <Row row={item} index={index} mine={item.userId === userId} moteIcon={motes.get(item.userId)?.icon} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Row({
  row,
  index,
  mine,
  moteIcon,
}: {
  row: EloRow;
  index: number;
  mine: boolean;
  moteIcon?: string;
}) {
  return (
    <View style={[styles.row, index < 3 && styles.rowTop, mine && styles.rowMine]}>
      <Text style={[styles.pos, index < 3 && styles.posMedal]}>
        {MEDAL[index] ?? `P${index + 1}`}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, mine && styles.nameMine]} numberOfLines={1}>
          {moteIcon ? `${moteIcon} ` : ''}
          {row.driverName}
          {mine ? ' · tú' : ''}
        </Text>
        <Text style={styles.meta}>
          {row.events} {row.events === 1 ? 'pique' : 'piques'} · {row.wins} 🥇
        </Text>
      </View>
      <Text style={[styles.elo, index < 3 && { color: colors.accent }]}>{row.elo}</Text>
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
  back: { color: colors.primary, fontSize: 15, fontWeight: '700', marginBottom: spacing.xs },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  subtitle: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  shareBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTop: { backgroundColor: colors.surfaceAlt, borderColor: colors.accentDim },
  rowMine: { borderColor: colors.primary, borderLeftWidth: 3 },
  pos: {
    width: 46,
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: font.display,
  },
  posMedal: { fontSize: 22 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  nameMine: { color: colors.primary },
  meta: { color: colors.textFaint, fontSize: 12, fontWeight: '600', marginTop: 1 },
  elo: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
  },
});
