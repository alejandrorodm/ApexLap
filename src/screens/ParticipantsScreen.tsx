// "Participantes": miembros de la liga (perfiles) con sus estadísticas de
// vueltas. Se entra desde el Perfil. El anfitrión (quien creó la liga) y tú
// salís marcados.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../theme';
import { Card, EmptyState, ScreenHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { getLeagueMembers } from '../firebase/db';
import { driverStats } from '../utils/leaderboard';
import { formatTime } from '../utils/time';
import { notify } from '../utils/alerts';
import { Profile } from '../types';

interface MemberRow {
  userId: string;
  driverName: string;
  isHost: boolean;
  isMe: boolean;
  totalLaps: number;
  records: number;
  bestLapMs?: number;
}

export default function ParticipantsScreen() {
  const { league, laps, userId } = useApp();
  const [members, setMembers] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!league) return;
    let cancelled = false;
    setMembers(null);
    setError(null);
    (async () => {
      try {
        const m = await getLeagueMembers(league.id);
        if (!cancelled) setMembers(m);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'No se pudieron cargar los participantes.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [league?.id]);

  // Cruza los perfiles (quién está en la liga) con las estadísticas de vueltas.
  const rows = useMemo<MemberRow[]>(() => {
    if (!members) return [];
    const stats = driverStats(laps);
    const statById = new Map(stats.map((s) => [s.userId, s]));
    return members
      .map((p) => {
        const s = statById.get(p.userId);
        return {
          userId: p.userId,
          driverName: p.driverName,
          isHost: league?.createdBy === p.userId,
          isMe: p.userId === userId,
          totalLaps: s?.totalLaps ?? 0,
          records: s?.records ?? 0,
          bestLapMs: s?.bestLap?.timeMs,
        };
      })
      .sort(
        (a, b) =>
          b.records - a.records ||
          b.totalLaps - a.totalLaps ||
          a.driverName.localeCompare(b.driverName)
      );
  }, [members, laps, league?.createdBy, userId]);

  async function copyCode() {
    if (!league) return;
    await Clipboard.setStringAsync(league.code);
    notify('Código copiado', `Pásaselo a tus colegas: ${league.code}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Participantes" subtitle={league?.name ?? ''} />

        <Pressable style={styles.codeBox} onPress={copyCode}>
          <View>
            <Text style={styles.codeLabel}>Invitar con el código</Text>
            <Text style={styles.code}>{league?.code ?? '—'}</Text>
          </View>
          <Text style={styles.codeCopy}>Copiar ›</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>
          🏎 Pilotos {members ? `(${members.length})` : ''}
        </Text>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !members ? (
          <Text style={styles.hint}>Cargando…</Text>
        ) : members.length === 0 ? (
          <EmptyState
            icon="🏎"
            title="Aún no hay pilotos"
            subtitle="Comparte el código para que tus colegas se unan a la liga."
          />
        ) : (
          <Card>
            {rows.map((r, i) => (
              <View
                key={r.userId}
                style={[styles.row, i === rows.length - 1 && styles.rowLast]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.driverName}
                    {r.isMe ? ' · tú' : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {r.isHost ? '👑 Anfitrión · ' : ''}
                    {r.totalLaps} {r.totalLaps === 1 ? 'vuelta' : 'vueltas'}
                    {r.records > 0 ? ` · ${r.records} récord${r.records === 1 ? '' : 's'}` : ''}
                  </Text>
                </View>
                <Text style={styles.best}>
                  {r.bestLapMs != null ? formatTime(r.bestLapMs) : '—'}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  codeBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  code: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 8,
    marginTop: 2,
  },
  codeCopy: { color: colors.primary, fontWeight: '900', fontSize: 14 },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  hint: { color: colors.textFaint, fontSize: 15 },
  error: { color: colors.primary, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.textFaint, fontSize: 13, marginTop: 3 },
  best: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    marginLeft: spacing.md,
  },
});
