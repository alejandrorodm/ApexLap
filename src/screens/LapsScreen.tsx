// Pantalla "Tiempos": lista filtrable y ordenable de vueltas de la liga.
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { useGridColumns } from '../responsive';
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
  TrackRecord,
} from '../utils/leaderboard';
import { formatTime, formatDelta, timeAgo } from '../utils/time';
import { confirmAction, notify } from '../utils/alerts';
import { Lap, CatalogEntry } from '../types';
import { deleteLap } from '../firebase/db';
import { RootStackParamList } from '../navigation/types';
import TrackMap from '../components/TrackMap';
import { findCustomTrack, normTrackKey } from '../utils/trackMatching';

const MEDALS = ['🥇', '🥈', '🥉'];

// Modos de la lista. "byTrack" es el default: una fila por circuito con la
// mejor vuelta absoluta y el coche que la consiguió — los tiempos solo se
// comparan dentro del mismo trazado.
type ViewMode = 'byTrack' | 'bestPerDriver' | 'byTime' | 'recent';

export default function LapsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { laps, league, userId, lapsLoading, approveLap, rejectLap, customTracks } = useApp();
  const [filter, setFilter] = useState<LapFilter>({});
  const [mode, setMode] = useState<ViewMode>('byTrack');
  const [showPending, setShowPending] = useState(false);
  const [picker, setPicker] = useState<null | 'car' | 'track'>(null);
  const now = Date.now();
  const cols = useGridColumns();
  // La vista por circuito se muestra en rejilla (más columnas cuanto más ancho).
  const gridCols = mode === 'byTrack' && !showPending ? cols : 1;

  const isHost = !!league && league.createdBy === userId;
  const pendingCount = useMemo(
    () => laps.filter((l) => l.status === 'pending').length,
    [laps]
  );

  const present = useMemo(() => uniqueValues(laps), [laps]);

  const list = useMemo(() => {
    if (showPending) {
      return laps.filter(
        (l) =>
          l.status === 'pending' ||
          (l.status === 'rejected' && (isHost || l.userId === userId))
      );
    }
    const filtered = applyFilter(laps.filter(isCounted), filter);
    switch (mode) {
      case 'byTrack':
        return recordsByTrack(filtered);
      case 'bestPerDriver':
        return bestPerDriver(filtered);
      case 'byTime':
        return byTime(filtered);
      case 'recent':
        return filtered;
    }
  }, [laps, filter, mode, showPending, isHost, userId, customTracks]);

  // Para el delta vs leader: solo cuando hay un ranking real por tiempo dentro
  // del mismo "contexto" (mismo circuito). byTrack mezcla circuitos, así que no.
  const leaderMs =
    (mode === 'bestPerDriver' || mode === 'byTime') && !showPending && list.length
      ? (list[0] as Lap).timeMs
      : null;

  async function confirmDelete(lap: Lap) {
    if (lap.userId !== userId || !league) return;
    const ok = await confirmAction({
      title: 'Borrar vuelta',
      message: `${lap.car} · ${formatTime(lap.timeMs)}?`,
      confirmText: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteLap(league.id, lap.id);
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo borrar la vuelta.');
    }
  }

  async function confirmReject(lap: Lap) {
    if (!isHost || !league) return;
    const ok = await confirmAction({
      title: 'Rechazar vuelta',
      message: `${lap.driverName}: ${lap.car} · ${formatTime(lap.timeMs)}\nNo contará para la clasificación.`,
      confirmText: 'Rechazar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await rejectLap(lap.id);
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo rechazar la vuelta.');
    }
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
            label={filter.track ? `${filter.track}` : 'Circuito'}
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
            label="Sin ABS"
            active={!!filter.noAbs}
            onPress={() => toggle('noAbs', true)}
            color={colors.green}
          />
          <Chip
            label="Sin TC"
            active={!!filter.noTc}
            onPress={() => toggle('noTc', true)}
            color={colors.green}
          />
          <Chip
            label="🌧 Mojado"
            active={filter.conditions === 'wet'}
            onPress={() => toggle('conditions', 'wet')}
            color={colors.blue}
          />
          {(filter.car ||
            filter.track ||
            filter.noAssists ||
            filter.noAbs ||
            filter.noTc ||
            filter.conditions) && (
            <Chip label="✕ Limpiar" onPress={() => setFilter({})} />
          )}
        </View>
        <View style={styles.filterRow}>
          <Chip
            label="Por circuito"
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
        // La key fuerza remount al cambiar el nº de columnas (RN lo exige).
        key={`grid-${gridCols}`}
        data={list as any[]}
        numColumns={gridCols}
        columnWrapperStyle={gridCols > 1 ? styles.gridRow : undefined}
        keyExtractor={(item) =>
          // En modo byTrack cada item es un TrackRecord; en el resto, un Lap.
          mode === 'byTrack' && !showPending
            ? `t:${(item as TrackRecord).track}`
            : (item as Lap).id
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) =>
          mode === 'byTrack' && !showPending ? (
            <TrackRecordRow
              record={item as TrackRecord}
              grid={gridCols > 1}
              onPress={() =>
                navigation.navigate('Track', {
                  track: (item as TrackRecord).track,
                })
              }
              onLongPress={() => {
                const l = (item as TrackRecord).lap;
                if (l) confirmDelete(l);
              }}
            />
          ) : (
            <LapRow
              lap={item as Lap}
              index={index}
              showRank={mode === 'bestPerDriver' || mode === 'byTime'}
              leaderMs={leaderMs}
              isMine={(item as Lap).userId === userId}
              isHost={isHost}
              now={now}
              onLongPress={() => confirmDelete(item as Lap)}
              onApprove={() => approveLap((item as Lap).id).catch(() => {})}
              onReject={() => confirmReject(item as Lap)}
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
      style={[
        styles.row,
        showRank && index < 3 && styles.rowPodium,
        showRank && index === 3 && styles.rowAfterPodium,
        isMine && styles.rowMine,
      ]}
      {...({ dataSet: { anim: 'rise' } } as any)}
    >
      <View style={styles.rankBox}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : showRank ? (
          <Text style={styles.rankNum}>P{index + 1}</Text>
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
          <AbsTcBadges lap={lap} />
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
// logró y el piloto que lo firmó. Pulsable
function TrackRecordRow({
  record,
  grid,
  onPress,
  onLongPress,
}: {
  record: TrackRecord;
  grid?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { customTracks } = useApp();
  const { lap, count, track } = record;
  const trackName = track || lap?.track || 'Circuito';
  const customTrackObj = findCustomTrack(customTracks, trackName);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={lap ? onLongPress : undefined}
      delayLongPress={350}
      style={[styles.trackCard, grid && styles.trackCardGrid]}
      {...({ dataSet: { anim: 'rise' } } as any)}
    >
      {/* Silueta a la derecha y de fondo (sin caja) */}
      <View style={styles.trackBgMap} pointerEvents="none">
        <TrackMap
          track={trackName}
          imageUrl={customTrackObj?.url}
          size={grid ? 140 : 175}
        />
      </View>

      {/* Nombre grande arriba a la izquierda + tiempo y datos */}
      <View style={styles.trackCardLeft}>
        <Text style={styles.trackName} numberOfLines={2}>
          {trackName}
        </Text>

        {lap ? (
          <>
            <Text style={styles.trackRefTime}>
              ⏱️ {formatTime(lap.timeMs)}
            </Text>
            <Text style={styles.trackRefMeta} numberOfLines={1}>
              · {lap.driverName || 'Piloto'} ({lap.car})  {count} {count === 1 ? 'vuelta' : 'vueltas'} ›
            </Text>
          </>
        ) : (
          <Text style={styles.trackRefMeta}>Sin vueltas registradas aún</Text>
        )}
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

function AbsTcBadges({ lap }: { lap: Lap }) {
  if (lap.abs === undefined && lap.tc === undefined) return null;
  return (
    <>
      {lap.abs !== undefined ? (
        <Badge
          text={lap.abs ? 'ABS' : 'sin ABS'}
          color={lap.abs ? colors.textFaint : colors.green}
        />
      ) : null}
      {lap.tc !== undefined ? (
        <Badge
          text={lap.tc ? 'TC' : 'sin TC'}
          color={lap.tc ? colors.textFaint : colors.green}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
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
  rowPodium: {
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  rowAfterPodium: { marginTop: spacing.xl },
  rankBox: { width: 50, alignItems: 'center' },
  medal: { fontSize: 32 },
  rankNum: {
    color: colors.textDim,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  dot: { color: colors.textFaint, fontSize: 18 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driver: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  time: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
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
  gridRow: { gap: spacing.md, alignItems: 'stretch' },
  // Tarjeta del modo "Por circuito" alineada a la izquierda con silueta de fondo
  trackCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 125,
    justifyContent: 'center',
  },
  trackCardGrid: { flex: 1 },
  trackBgMap: {
    position: 'absolute',
    right: 12,
    top: 6,
    bottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  trackCardLeft: {
    maxWidth: '68%',
    zIndex: 2,
  },
  trackName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 26,
    marginBottom: 6,
  },
  trackRefTime: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  trackRefMeta: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  trackCount: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
  },
});
