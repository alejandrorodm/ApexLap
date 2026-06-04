// Pantalla "Tiempos": lista filtrable y ordenable de vueltas de la liga.
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import { Chip, EmptyState } from '../components/ui';
import { PickerModal } from '../components/PickerModal';
import { useApp } from '../context/AppContext';
import {
  applyFilter,
  byTime,
  bestPerDriver,
  uniqueValues,
  LapFilter,
} from '../utils/leaderboard';
import { formatTime, formatDelta, timeAgo } from '../utils/time';
import { Lap } from '../types';
import { deleteLap } from '../firebase/db';
import { RootStackParamList } from '../navigation/types';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LapsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { laps, league, userId, lapsLoading } = useApp();
  const [filter, setFilter] = useState<LapFilter>({});
  const [bestOnly, setBestOnly] = useState(true);
  const [sortRecent, setSortRecent] = useState(false);
  const [picker, setPicker] = useState<null | 'car' | 'track'>(null);
  const now = Date.now();

  const present = useMemo(() => uniqueValues(laps), [laps]);

  const list = useMemo(() => {
    const filtered = applyFilter(laps, filter);
    if (sortRecent) return filtered; // ya viene ordenado por fecha desc
    const ranked = bestOnly ? bestPerDriver(filtered) : byTime(filtered);
    return ranked;
  }, [laps, filter, bestOnly, sortRecent]);

  const leaderMs = !sortRecent && list.length ? list[0].timeMs : null;

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

  function toggle<K extends keyof LapFilter>(key: K, value: LapFilter[K]) {
    setFilter((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tiempos</Text>
          <Text style={styles.subtitle}>{league?.name ?? ''}</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <Chip
            label={filter.car ? `🚗 ${filter.car}` : '🚗 Coche'}
            active={!!filter.car}
            onPress={() => setPicker('car')}
          />
          <Chip
            label={filter.track ? `📍 ${filter.track}` : '📍 Circuito'}
            active={!!filter.track}
            onPress={() => setPicker('track')}
          />
          <Chip
            label="Sin ayudas"
            active={!!filter.noAssists}
            onPress={() => toggle('noAssists', true)}
            color={colors.green}
          />
          <Chip
            label="🌧 Mojado"
            active={filter.conditions === 'wet'}
            onPress={() => toggle('conditions', 'wet')}
            color={colors.blue}
          />
          {(filter.car || filter.track || filter.noAssists || filter.conditions) && (
            <Chip label="✕ Limpiar" onPress={() => setFilter({})} />
          )}
        </View>
        <View style={styles.filterRow}>
          <Chip
            label="Mejor de cada piloto"
            active={bestOnly && !sortRecent}
            onPress={() => {
              setBestOnly((b) => !b);
              setSortRecent(false);
            }}
            color={colors.accent}
          />
          <Chip
            label={sortRecent ? '🕒 Recientes' : '⏱ Por tiempo'}
            active={sortRecent}
            onPress={() => setSortRecent((s) => !s)}
            color={colors.blue}
          />
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <LapRow
            lap={item}
            index={index}
            showRank={!sortRecent}
            leaderMs={leaderMs}
            isMine={item.userId === userId}
            now={now}
            onLongPress={() => confirmDelete(item)}
          />
        )}
        ListEmptyComponent={
          lapsLoading ? null : (
            <EmptyState
              icon="🏁"
              title="Aún no hay vueltas"
              subtitle="Pulsa el botón + para registrar tu primer tiempo y empezar a picaros."
            />
          )
        }
      />

      {/* Botón flotante para añadir vuelta */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('AddLap', {})}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <PickerModal
        visible={picker === 'car'}
        title="Filtrar por coche"
        groups={[{ category: 'Coches con vueltas', items: present.cars }]}
        selected={filter.car}
        allowCustom={false}
        onSelect={(v) => setFilter((f) => ({ ...f, car: v }))}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'track'}
        title="Filtrar por circuito"
        groups={[{ category: 'Circuitos con vueltas', items: present.tracks }]}
        selected={filter.track}
        allowCustom={false}
        onSelect={(v) => setFilter((f) => ({ ...f, track: v }))}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

function LapRow({
  lap,
  index,
  showRank,
  leaderMs,
  isMine,
  now,
  onLongPress,
}: {
  lap: Lap;
  index: number;
  showRank: boolean;
  leaderMs: number | null;
  isMine: boolean;
  now: number;
  onLongPress: () => void;
}) {
  const medal = showRank && index < 3 ? MEDALS[index] : null;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.row, isMine && styles.rowMine]}
    >
      <View style={styles.rankBox}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : showRank ? (
          <Text style={styles.rankNum}>{index + 1}</Text>
        ) : (
          <Text style={styles.dot}>•</Text>
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
            {lap.car} · {lap.track}
          </Text>
          {showRank && leaderMs != null && index > 0 ? (
            <Text style={styles.delta}>{formatDelta(lap.timeMs, leaderMs)}</Text>
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
          {lap.challengeId ? <Badge text="🎰 pique" color={colors.accent} /> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
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
  rowMine: { borderColor: colors.primaryDim },
  rankBox: { width: 34, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { color: colors.textDim, fontSize: 16, fontWeight: '800' },
  dot: { color: colors.textFaint, fontSize: 18 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driver: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  time: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  meta: { color: colors.textDim, fontSize: 13, flex: 1, marginRight: spacing.sm },
  delta: { color: colors.primary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
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
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: colors.text, fontSize: 32, fontWeight: '300', marginTop: -2 },
});
