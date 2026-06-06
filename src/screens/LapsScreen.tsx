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
import { Chip, EmptyState, ScreenHeader } from '../components/ui';
import { PickerModal } from '../components/PickerModal';
import { useApp } from '../context/AppContext';
import {
  applyFilter,
  byTime,
  bestPerDriver,
  recordsByTrack,
  uniqueValues,
  isCounted,
  LapFilter,
} from '../utils/leaderboard';
import { formatTime, formatDelta, timeAgo } from '../utils/time';
import { Lap } from '../types';
import { deleteLap } from '../firebase/db';
import { RootStackParamList } from '../navigation/types';

const MEDALS = ['🥇', '🥈', '🥉'];

// Modos de la lista. "byTrack" es el default: una fila por circuito con la
// mejor vuelta absoluta y el coche que la consiguió — los tiempos solo se
// comparan dentro del mismo trazado.
type ViewMode = 'byTrack' | 'bestPerDriver' | 'byTime' | 'recent';

export default function LapsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { laps, league, userId, lapsLoading, approveLap, rejectLap } = useApp();
  const [filter, setFilter] = useState<LapFilter>({});
  const [mode, setMode] = useState<ViewMode>('byTrack');
  const [showPending, setShowPending] = useState(false);
  const [picker, setPicker] = useState<null | 'car' | 'track'>(null);
  const now = Date.now();

  const isHost = !!league && league.createdBy === userId;
  const pendingCount = useMemo(
    () => laps.filter((l) => l.status === 'pending').length,
    [laps]
  );

  const present = useMemo(() => uniqueValues(laps), [laps]);

  const list = useMemo(() => {
    if (showPending) {
      // Cola de verificación: pendientes + rechazadas que su autor o el anfitrión
      // aún pueden ver (las rechazadas ajenas se ocultan al resto).
      return laps.filter(
        (l) =>
          l.status === 'pending' ||
          (l.status === 'rejected' && (isHost || l.userId === userId))
      );
    }
    // Vistas normales: solo vueltas que cuentan (verificadas o antiguas).
    const filtered = applyFilter(laps.filter(isCounted), filter);
    switch (mode) {
      case 'byTrack':
        return recordsByTrack(filtered);
      case 'bestPerDriver':
        return bestPerDriver(filtered);
      case 'byTime':
        return byTime(filtered);
      case 'recent':
        return filtered; // ya viene ordenado por fecha desc
    }
  }, [laps, filter, mode, showPending, isHost, userId]);

  // Para el delta vs leader: solo cuando hay un ranking real por tiempo dentro
  // del mismo "contexto" (mismo circuito). byTrack mezcla circuitos, así que no.
  const leaderMs =
    (mode === 'bestPerDriver' || mode === 'byTime') && !showPending && list.length
      ? list[0].timeMs
      : null;

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

  function confirmReject(lap: Lap) {
    if (!isHost || !league) return;
    Alert.alert(
      'Rechazar vuelta',
      `${lap.driverName}: ${lap.car} · ${formatTime(lap.timeMs)}\nNo contará para la clasificación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: () => rejectLap(lap.id).catch(() => {}),
        },
      ]
    );
  }

  function toggle<K extends keyof LapFilter>(key: K, value: LapFilter[K]) {
    setFilter((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ScreenHeader title="Tiempos" subtitle={league?.name ?? ''} />
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
            label="📍 Por circuito"
            active={mode === 'byTrack' && !showPending}
            onPress={() => {
              setMode('byTrack');
              setShowPending(false);
            }}
            color={colors.accent}
          />
          <Chip
            label="👤 Mejor por piloto"
            active={mode === 'bestPerDriver' && !showPending}
            onPress={() => {
              setMode('bestPerDriver');
              setShowPending(false);
            }}
            color={colors.accent}
          />
          <Chip
            label="⏱ Por tiempo"
            active={mode === 'byTime' && !showPending}
            onPress={() => {
              setMode('byTime');
              setShowPending(false);
            }}
            color={colors.blue}
          />
          <Chip
            label="🕒 Recientes"
            active={mode === 'recent' && !showPending}
            onPress={() => {
              setMode('recent');
              setShowPending(false);
            }}
            color={colors.blue}
          />
          {pendingCount > 0 ? (
            <Chip
              label={`⏳ Por verificar (${pendingCount})`}
              active={showPending}
              onPress={() => setShowPending((s) => !s)}
              color={colors.accent}
            />
          ) : null}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) =>
          mode === 'byTrack' && !showPending ? (
            <TrackRecordRow
              lap={item}
              isMine={item.userId === userId}
              onLongPress={() => confirmDelete(item)}
            />
          ) : (
            <LapRow
              lap={item}
              index={index}
              showRank={mode === 'bestPerDriver' || mode === 'byTime'}
              leaderMs={leaderMs}
              isMine={item.userId === userId}
              isHost={isHost}
              now={now}
              onLongPress={() => confirmDelete(item)}
              onApprove={() => approveLap(item.id).catch(() => {})}
              onReject={() => confirmReject(item)}
            />
          )
        }
        ListEmptyComponent={
          lapsLoading ? null : showPending ? (
            <EmptyState
              icon="✅"
              title="Nada por verificar"
              subtitle="Cuando alguien suba una vuelta a mano, aparecerá aquí para que la apruebes o la rechaces."
            />
          ) : (
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
  isHost,
  now,
  onLongPress,
  onApprove,
  onReject,
}: {
  lap: Lap;
  index: number;
  showRank: boolean;
  leaderMs: number | null;
  isMine: boolean;
  isHost: boolean;
  now: number;
  onLongPress: () => void;
  onApprove: () => void;
  onReject: () => void;
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
          {lap.status === 'pending' ? (
            <Badge text="⏳ por verificar" color={colors.accent} />
          ) : null}
          {lap.status === 'rejected' ? (
            <Badge text="❌ rechazada" color={colors.primary} />
          ) : null}
          <Text style={styles.ago}>{timeAgo(lap.createdAt, now)}</Text>
        </View>
        {lap.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            💬 {lap.notes}
          </Text>
        ) : null}
        {isHost && lap.status === 'pending' ? (
          <View style={styles.verifyRow}>
            <Pressable
              style={[styles.verifyBtn, styles.approveBtn]}
              onPress={onApprove}
            >
              <Text style={styles.approveText}>✓ Aprobar</Text>
            </Pressable>
            <Pressable
              style={[styles.verifyBtn, styles.rejectBtn]}
              onPress={onReject}
            >
              <Text style={styles.rejectText}>✕ Rechazar</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// Fila del modo "Por circuito": una tarjeta por trazado, con el circuito como
// protagonista, el mejor tiempo grande a la derecha y debajo el coche que lo
// logró y el piloto que lo firmó.
function TrackRecordRow({
  lap,
  isMine,
  onLongPress,
}: {
  lap: Lap;
  isMine: boolean;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.trackCard, isMine && styles.rowMine]}
    >
      <View style={styles.trackHeader}>
        <Text style={styles.trackName} numberOfLines={1}>
          📍 {lap.track}
        </Text>
        <Text style={styles.trackTime}>{formatTime(lap.timeMs)}</Text>
      </View>
      <View style={styles.trackFoot}>
        <Text style={styles.trackCar} numberOfLines={1}>
          🚗 {lap.car}
        </Text>
        <Text style={styles.trackDriver} numberOfLines={1}>
          👑 {lap.driverName || 'Anónimo'}
          {isMine ? ' · tú' : ''}
        </Text>
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
    paddingBottom: spacing.sm,
  },
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
  rowMine: {
    borderColor: colors.primaryDim,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
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
  verifyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  verifyBtn: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  approveBtn: { backgroundColor: colors.green, borderColor: colors.green },
  approveText: { color: '#04210C', fontWeight: '800', fontSize: 13 },
  rejectBtn: { backgroundColor: 'transparent', borderColor: colors.primary },
  rejectText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
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
  // Tarjeta del modo "Por circuito"
  trackCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  trackName: {
    flex: 1,
    marginRight: spacing.sm,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  trackTime: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  trackFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  trackCar: {
    flex: 1,
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  trackDriver: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
});
