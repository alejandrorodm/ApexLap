// "Detalle de circuito": se llega tocando una tarjeta de "Tiempos · Por circuito".
//
// Vista por defecto ("Por coche"): una fila por coche con su mejor vuelta en el
// trazado (p.ej. "Porsche 911 · 7:32 · Alejandro R."), para ver de un vistazo en
// qué tiempo ronda cada coche. Al tocar un coche se abre su clasificación: todas
// las vueltas registradas con ese coche en esta pista. El toggle "Todas" muestra
// la clasificación bruta de todo el trazado (mezclando coches).
import React, { useMemo, useState } from 'react';
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
import { colors, spacing, radius, font } from '../theme';
import { useGridColumns } from '../responsive';
import { Chip, EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { lapsForTrack, bestPerCarOnTrack, CarRecord } from '../utils/leaderboard';
import { formatTime, formatDelta, formatSector, timeAgo } from '../utils/time';
import { deleteLap } from '../firebase/db';
import { Lap } from '../types';
import { RootStackParamList } from '../navigation/types';

const MEDALS = ['🥇', '🥈', '🥉'];

type DetailView = 'cars' | 'all';

export default function TrackDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Track'>>();
  const { track } = route.params;
  const { laps, league, userId } = useApp();
  const now = Date.now();
  const [view, setView] = useState<DetailView>('cars');
  const [selectedCar, setSelectedCar] = useState<string | null>(null);
  const cols = useGridColumns();

  const trackLaps = useMemo(() => lapsForTrack(laps, track), [laps, track]);

  // Mejor vuelta por coche en este trazado, de más rápido a más lento.
  const carRecords = useMemo(
    () => bestPerCarOnTrack(laps, track),
    [laps, track]
  );

  // Vueltas del coche seleccionado (ya vienen ordenadas por tiempo).
  const carLaps = useMemo(
    () => (selectedCar ? trackLaps.filter((l) => l.car === selectedCar) : []),
    [trackLaps, selectedCar]
  );

  // Cuántos pilotos distintos han firmado vueltas en el trazado.
  const driversCount = useMemo(() => {
    const set = new Set<string>();
    for (const l of trackLaps) set.add(l.userId);
    return set.size;
  }, [trackLaps]);

  function selectView(next: DetailView) {
    setView(next);
    setSelectedCar(null);
  }

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

  // Datos de la lista según la sub-vista activa.
  const showingCarList = view === 'cars' && !selectedCar;
  const lapList = view === 'all' ? trackLaps : carLaps;
  const leaderMs = lapList[0]?.timeMs ?? null;

  const header = (
    <>
      {/* Toggle de sub-vista: por coche (default) vs clasificación completa. */}
      <View style={styles.viewToggle}>
        <Chip
          label="🚗 Por coche"
          active={view === 'cars'}
          onPress={() => selectView('cars')}
          color={colors.accent}
        />
        <Chip
          label="📋 Todas las vueltas"
          active={view === 'all'}
          onPress={() => selectView('all')}
          color={colors.blue}
        />
      </View>

      {/* Cabecera del coche seleccionado: vuelta atrás a la lista de coches. */}
      {view === 'cars' && selectedCar ? (
        <Pressable
          style={styles.carSubHeader}
          onPress={() => setSelectedCar(null)}
          hitSlop={6}
        >
          <Text style={styles.carSubBack}>‹ Coches</Text>
          <Text style={styles.carSubTitle} numberOfLines={1}>
            🚗 {selectedCar}
          </Text>
          <Text style={styles.carSubCount}>
            {carLaps.length} {carLaps.length === 1 ? 'vuelta' : 'vueltas'}
          </Text>
        </Pressable>
      ) : null}
    </>
  );

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
        <View style={styles.headerFoot}>
          <Text style={styles.subtitle}>
            {trackLaps.length} {trackLaps.length === 1 ? 'vuelta' : 'vueltas'}
            {driversCount > 0
              ? ` · ${driversCount} ${driversCount === 1 ? 'piloto' : 'pilotos'}`
              : ''}
          </Text>
          <Pressable
            style={styles.challengeBtn}
            onPress={() => navigation.navigate('NewChallenge', { track })}
            hitSlop={6}
          >
            <Text style={styles.challengeBtnText}>🎰 Pique aquí</Text>
          </Pressable>
        </View>
      </View>

      {showingCarList ? (
        <FlatList
          key={`cars-${cols}`}
          // El podio (top-3) va en la cabecera; la lista son P4 en adelante,
          // así el resto SIEMPRE queda visualmente debajo del podio.
          data={carRecords.slice(3)}
          keyExtractor={(r) => r.car}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? styles.gridRow : undefined}
          ListHeaderComponent={
            <>
              {header}
              {carRecords.length > 0 ? (
                <View style={cols > 1 ? styles.podiumRow : undefined}>
                  {carRecords.slice(0, 3).map((item, i) => (
                    <CarSummaryRow
                      key={item.car}
                      record={item}
                      index={i}
                      grid={cols > 1}
                      isMine={item.lap.userId === userId}
                      onPress={() => setSelectedCar(item.car)}
                    />
                  ))}
                </View>
              ) : null}
              {carRecords.length > 3 ? (
                <Text style={styles.restLabel}>Resto</Text>
              ) : null}
            </>
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <CarSummaryRow
              record={item}
              index={index + 3}
              grid={cols > 1}
              isMine={item.lap.userId === userId}
              onPress={() => setSelectedCar(item.car)}
            />
          )}
          ListEmptyComponent={
            carRecords.length === 0 ? (
              <EmptyState
                icon="🏁"
                title="Sin vueltas aquí todavía"
                subtitle="Cuando alguien registre una vuelta en este trazado, aparecerá agrupada por coche."
              />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={lapList}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <LapRow
              lap={item}
              index={index}
              leaderMs={leaderMs}
              leaderSectors={lapList[0]?.sectors ?? null}
              isMine={item.userId === userId}
              now={now}
              onLongPress={() => confirmDelete(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="🚗"
              title={
                selectedCar
                  ? `Nadie ha rodado aquí con ${selectedCar}`
                  : 'Sin vueltas aquí todavía'
              }
              subtitle="Registra una vuelta para empezar la clasificación."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// Fila de la vista "Por coche": un coche con su mejor vuelta en el trazado.
// Pulsable: abre la clasificación de ese coche en esta pista.
function CarSummaryRow({
  record,
  index,
  isMine,
  grid,
  onPress,
}: {
  record: CarRecord;
  index: number;
  isMine: boolean;
  grid?: boolean;
  onPress: () => void;
}) {
  const { car, lap, count } = record;
  const medal = index < 3 ? MEDALS[index] : null;
  const podium = index < 3;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.carCard,
        grid && styles.carCardGrid,
        podium && styles.carCardPodium,
        index === 3 && !grid && styles.carCardAfterPodium,
        isMine && styles.rowMine,
      ]}
      {...({ dataSet: { anim: 'rise' } } as any)}
    >
      <View style={styles.carHeader}>
        <View style={styles.carNameWrap}>
          <Text style={[styles.carRank, podium && styles.carRankMedal]}>
            {medal ?? `P${index + 1}`}
          </Text>
          <Text style={styles.carName} numberOfLines={1}>
            🚗 {car}
          </Text>
        </View>
        <Text style={styles.carTime}>{formatTime(lap.timeMs)}</Text>
      </View>
      <View style={styles.carFoot}>
        <Text style={styles.carDriver} numberOfLines={1}>
          👑 {lap.driverName || 'Anónimo'}
          {isMine ? ' · tú' : ''}
        </Text>
        <Text style={styles.carCount}>
          {count} {count === 1 ? 'vuelta' : 'vueltas'} ›
        </Text>
      </View>
    </Pressable>
  );
}

function LapRow({
  lap,
  index,
  leaderMs,
  leaderSectors,
  isMine,
  now,
  onLongPress,
}: {
  lap: Lap;
  index: number;
  leaderMs: number | null;
  leaderSectors: number[] | null;
  isMine: boolean;
  now: number;
  onLongPress: () => void;
}) {
  const medal = index < 3 ? MEDALS[index] : null;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[
        styles.row,
        index < 3 && styles.rowPodium,
        index === 3 && styles.rowAfterPodium,
        isMine && styles.rowMine,
      ]}
      {...({ dataSet: { anim: 'rise' } } as any)}
    >
      <View style={styles.rankBox}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={styles.rankNum}>P{index + 1}</Text>
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
        {/* Sectores: solo si hay 2+ (en pistas de 1 solo sector el tiempo del
            sector coincide con el de la vuelta, así que no aporta nada). El
            delta se mide contra el sector del líder (P1), como el de la vuelta. */}
        {lap.sectors && lap.sectors.length >= 2 ? (
          <View style={styles.sectors}>
            {lap.sectors.map((s, i) => {
              const ref = leaderSectors?.[i];
              const showDelta = index > 0 && ref != null;
              const faster = showDelta && s < (ref as number);
              return (
                <View key={i} style={styles.sector}>
                  <Text style={styles.sectorLabel}>S{i + 1}</Text>
                  <Text style={styles.sectorTime}>{formatSector(s)}</Text>
                  {showDelta ? (
                    <Text
                      style={[
                        styles.sectorDelta,
                        { color: faster ? colors.green : colors.primary },
                      ]}
                    >
                      {formatDelta(s, ref as number)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
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
  safe: { flex: 1, backgroundColor: colors.bgScreen },
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
    fontSize: 25,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  headerFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: spacing.sm,
  },
  challengeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  challengeBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  carSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  carSubBack: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  carSubTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  carSubCount: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  gridRow: { gap: spacing.md, alignItems: 'stretch' },
  podiumRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  restLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  // Tarjeta de la vista "Por coche"
  carCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  carCardGrid: { flex: 1 },
  carCardPodium: {
    backgroundColor: colors.surfaceAlt,
    borderLeftColor: colors.gold,
  },
  // Separación clara entre el podio (top-3) y el resto de coches (P4 en adelante).
  carCardAfterPodium: { marginTop: spacing.xl },
  carHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  carNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
    gap: spacing.sm,
  },
  carRank: {
    color: colors.textDim,
    fontSize: 19,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
    minWidth: 38,
    textAlign: 'center',
  },
  carRankMedal: { fontSize: 28, minWidth: 38 },
  carName: {
    flex: 1,
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  carTime: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  carFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  carDriver: {
    flex: 1,
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  carCount: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  // Las 3 primeras (podio): fondo algo elevado y barra dorada.
  rowPodium: {
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  // La 4ª (P4) abre el "resto": separación clara del podio.
  rowAfterPodium: {
    marginTop: spacing.xl,
  },
  rankBox: { width: 50, alignItems: 'center' },
  medal: { fontSize: 32 },
  rankNum: {
    color: colors.textDim,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
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
    fontSize: 21,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
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
  sectors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sector: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  sectorLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sectorTime: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectorDelta: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  notes: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    lineHeight: 16,
  },
});
