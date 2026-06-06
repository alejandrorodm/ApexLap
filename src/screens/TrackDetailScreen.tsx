// "Detalle de circuito": leaderboard de un trazado concreto. Se llega tocando
// una tarjeta de "Tiempos · Por circuito". Aquí sí tiene sentido comparar
// tiempos (todos son del mismo trazado) y aquí es donde nace el pique.
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import { EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { lapsForTrack } from '../utils/leaderboard';
import { formatTime, formatDelta, timeAgo } from '../utils/time';
import { deleteLap } from '../firebase/db';
import { Lap } from '../types';
import { RootStackParamList } from '../navigation/types';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function TrackDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Track'>>();
  const { track } = route.params;
  const { laps, league, userId } = useApp();
  const now = Date.now();

  const trackLaps = useMemo(() => lapsForTrack(laps, track), [laps, track]);
  const leaderMs = trackLaps[0]?.timeMs ?? null;

  // Cuántos pilotos distintos han firmado vueltas en este trazado.
  const driversCount = useMemo(() => {
    const set = new Set<string>();
    for (const l of trackLaps) set.add(l.userId);
    return set.size;
  }, [trackLaps]);

  function confirmDelete(lap: Lap) {
    if (lap.userId !== userId || !league) return;
    Alert.alert('Borrar vuelta', `${lap.car} · ${formatTime(lap.timeMs)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => deleteLap(league.id, lap.id).catch(() => {}),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Cabecera con back y título grande */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>
          📍 {track}
        </Text>
        <Text style={styles.subtitle}>
          {trackLaps.length} {trackLaps.length === 1 ? 'vuelta' : 'vueltas'}
          {driversCount > 0
            ? ` · ${driversCount} ${driversCount === 1 ? 'piloto' : 'pilotos'}`
            : ''}
        </Text>
      </View>

      <FlatList
        data={trackLaps}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <LapRow
            lap={item}
            index={index}
            leaderMs={leaderMs}
            isMine={item.userId === userId}
            now={now}
            onLongPress={() => confirmDelete(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🏁"
            title="Sin vueltas aquí todavía"
            subtitle="Cuando alguien registre una vuelta en este trazado, aparecerá en esta clasificación."
          />
        }
      />
    </SafeAreaView>
  );
}

function LapRow({
  lap,
  index,
  leaderMs,
  isMine,
  now,
  onLongPress,
}: {
  lap: Lap;
  index: number;
  leaderMs: number | null;
  isMine: boolean;
  now: number;
  onLongPress: () => void;
}) {
  const medal = index < 3 ? MEDALS[index] : null;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.row, isMine && styles.rowMine]}
    >
      <View style={styles.rankBox}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={styles.rankNum}>{index + 1}</Text>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.driver} numberOfLines={1}>
            {lap.driverName || 'Anónimo'} {isMine ? '· tú' : ''}
          </Text>
          <Text style={styles.time}>{formatTime(lap.timeMs)}</Text>
        </View>
        <View style={styles.rowTop}>
          <Text style={styles.meta} numberOfLines={1}>
            🚗 {lap.car}
          </Text>
          {leaderMs != null && index > 0 ? (
            <Text style={styles.delta}>
              {formatDelta(lap.timeMs, leaderMs)}
            </Text>
          ) : null}
        </View>
        <View style={styles.badges}>
          {lap.assists ? (
            <Badge text="ayudas" color={colors.textFaint} />
          ) : (
            <Badge text="sin ayudas" color={colors.green} />
          )}
          {lap.conditions === 'wet' ? (
            <Badge text="mojado" color={colors.blue} />
          ) : lap.conditions === 'mixed' ? (
            <Badge text="mixto" color={colors.blue} />
          ) : null}
          {lap.challengeId ? (
            <Badge text="🎰 pique" color={colors.accent} />
          ) : null}
          <Text style={styles.ago}>{timeAgo(lap.createdAt, now)}</Text>
        </View>
        {lap.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            💬 {lap.notes}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  rowMine: {
    borderColor: colors.primaryDim,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  rankBox: { width: 36, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { color: colors.textDim, fontSize: 16, fontWeight: '800' },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driver: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  meta: { color: colors.textDim, fontSize: 13, flex: 1, marginRight: spacing.sm },
  delta: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  ago: { color: colors.textFaint, fontSize: 11, marginLeft: spacing.xs },
  notes: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    lineHeight: 16,
  },
});
