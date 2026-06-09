// "Comparar 1 vs 1": enfrenta dos vueltas (mismo circuito, idealmente mismo
// coche) y muestra el tiempo total, el delta y el desglose por sector con el
// delta acumulado — para ver exactamente dónde se gana o se pierde el pique.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { Chip, EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { lapsForTrack } from '../utils/leaderboard';
import { formatTime, formatSector, formatDelta } from '../utils/time';
import { Lap } from '../types';
import { RootStackParamList } from '../navigation/types';

type Slot = 'A' | 'B';

export default function CompareScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Compare'>>();
  const { track, car } = route.params;
  const { laps, userId } = useApp();

  // Vueltas elegibles: las del trazado (y coche, si vino) ya ordenadas por tiempo.
  const eligible = useMemo(() => {
    const base = lapsForTrack(laps, track);
    return car ? base.filter((l) => l.car === car) : base;
  }, [laps, track, car]);

  // Selección inicial: A = mi mejor vuelta; B = la mejor de otro piloto.
  const initial = useMemo(() => {
    const mine = eligible.find((l) => l.userId === userId);
    const other = eligible.find((l) => l.userId !== (mine?.userId ?? userId));
    const a = mine ?? eligible[0];
    const b = other ?? eligible.find((l) => l.id !== a?.id) ?? null;
    return { a: a?.id ?? null, b: b?.id ?? null };
  }, [eligible, userId]);

  const [aId, setAId] = useState<string | null>(initial.a);
  const [bId, setBId] = useState<string | null>(initial.b);
  const [selecting, setSelecting] = useState<Slot>('B');

  const lapA = eligible.find((l) => l.id === aId) ?? null;
  const lapB = eligible.find((l) => l.id === bId) ?? null;

  function assign(lap: Lap) {
    if (selecting === 'A') {
      setAId(lap.id);
      if (lap.id === bId) setBId(null);
      setSelecting('B');
    } else {
      setBId(lap.id);
      if (lap.id === aId) setAId(null);
      setSelecting('A');
    }
  }

  function slotOf(id: string): Slot | null {
    if (id === aId) return 'A';
    if (id === bId) return 'B';
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>
          🆚 Comparar
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          📍 {track}
          {car ? ` · 🚗 ${car}` : ''}
        </Text>
      </View>

      {eligible.length < 2 ? (
        <EmptyState
          icon="🆚"
          title="Hacen falta 2 vueltas"
          subtitle="Cuando haya al menos dos vueltas registradas aquí podrás compararlas cara a cara."
        />
      ) : (
        <FlatList
          data={eligible}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <ComparePanel lapA={lapA} lapB={lapB} sameCar={!!car} />
              <View style={styles.pickHint}>
                <Text style={styles.pickHintText}>
                  Toca una vuelta para asignarla a
                </Text>
                <Chip
                  label="🅰 Vuelta A"
                  active={selecting === 'A'}
                  onPress={() => setSelecting('A')}
                  color={colors.primary}
                />
                <Chip
                  label="🅱 Vuelta B"
                  active={selecting === 'B'}
                  onPress={() => setSelecting('B')}
                  color={colors.blue}
                />
              </View>
            </>
          }
          renderItem={({ item, index }) => {
            const slot = slotOf(item.id);
            return (
              <Pressable
                style={[
                  styles.lapRow,
                  slot === 'A' && styles.lapRowA,
                  slot === 'B' && styles.lapRowB,
                ]}
                onPress={() => assign(item)}
              >
                <Text style={styles.lapRank}>P{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lapDriver} numberOfLines={1}>
                    {item.driverName || 'Anónimo'}
                    {item.userId === userId ? ' · tú' : ''}
                  </Text>
                  {!car ? (
                    <Text style={styles.lapCar} numberOfLines={1}>
                      🚗 {item.car}
                    </Text>
                  ) : null}
                </View>
                {slot ? (
                  <View
                    style={[
                      styles.slotTag,
                      { borderColor: slot === 'A' ? colors.primary : colors.blue },
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotTagText,
                        { color: slot === 'A' ? colors.primary : colors.blue },
                      ]}
                    >
                      {slot}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.lapTime}>{formatTime(item.timeMs)}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Panel cara a cara: cabeceras A/B, tiempo total + delta y desglose por sector.
function ComparePanel({
  lapA,
  lapB,
  sameCar,
}: {
  lapA: Lap | null;
  lapB: Lap | null;
  sameCar: boolean;
}) {
  if (!lapA || !lapB) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelHint}>
          Elige dos vueltas de la lista para compararlas.
        </Text>
      </View>
    );
  }

  const totalDelta = lapB.timeMs - lapA.timeMs; // <0 => B más rápida
  const aWins = totalDelta > 0;

  // Sectores comparables solo si ambas los traen (y, en rigor, mismo coche).
  const sa = lapA.sectors ?? [];
  const sb = lapB.sectors ?? [];
  const n = Math.min(sa.length, sb.length);
  const sectorRows: {
    i: number;
    a: number;
    b: number;
    cumDelta: number; // cumB - cumA tras este sector (<0 => B por delante)
  }[] = [];
  let cumA = 0;
  let cumB = 0;
  for (let i = 0; i < n; i++) {
    cumA += sa[i];
    cumB += sb[i];
    sectorRows.push({ i, a: sa[i], b: sb[i], cumDelta: cumB - cumA });
  }

  return (
    <View style={styles.panel}>
      {/* Cabeceras de cada vuelta */}
      <View style={styles.heads}>
        <DriverHead lap={lapA} slot="A" color={colors.primary} winner={aWins} />
        <Text style={styles.vs}>VS</Text>
        <DriverHead lap={lapB} slot="B" color={colors.blue} winner={!aWins} />
      </View>

      {/* Delta total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Diferencia total</Text>
        <Text
          style={[
            styles.totalDelta,
            { color: aWins ? colors.blue : colors.primary },
          ]}
        >
          {aWins ? '🅰' : '🅱'} gana por{' '}
          {formatDelta(Math.max(lapA.timeMs, lapB.timeMs), Math.min(lapA.timeMs, lapB.timeMs)).replace(
            '+',
            ''
          )}
        </Text>
      </View>

      {/* Desglose por sector */}
      {n >= 2 ? (
        <View style={styles.sectorTable}>
          <View style={styles.sectorHeadRow}>
            <Text style={[styles.sCell, styles.sLabelCell]}>SECTOR</Text>
            <Text style={[styles.sCell, { color: colors.primary }]}>🅰</Text>
            <Text style={[styles.sCell, { color: colors.blue }]}>🅱</Text>
            <Text style={[styles.sCell, styles.sCumCell]}>ACUM.</Text>
          </View>
          {sectorRows.map((r) => {
            const bFaster = r.b < r.a;
            const leadB = r.cumDelta < 0;
            return (
              <View key={r.i} style={styles.sectorRow}>
                <Text style={[styles.sCell, styles.sLabelCell]}>S{r.i + 1}</Text>
                <Text
                  style={[
                    styles.sCell,
                    styles.sTime,
                    !bFaster && styles.sFaster,
                  ]}
                >
                  {formatSector(r.a)}
                </Text>
                <Text
                  style={[styles.sCell, styles.sTime, bFaster && styles.sFaster]}
                >
                  {formatSector(r.b)}
                </Text>
                <Text
                  style={[
                    styles.sCell,
                    styles.sCumCell,
                    { color: leadB ? colors.blue : colors.primary },
                  ]}
                >
                  {leadB ? '🅱' : '🅰'} {formatDelta(Math.max(r.cumDelta, -r.cumDelta), 0).replace('+', '')}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.noSectors}>
          {sameCar
            ? 'Sin sectores en estas vueltas: solo se compara el tiempo total. (Las vueltas importadas del juego sí traen sectores.)'
            : 'Compara vueltas del mismo coche para ver el desglose por sector.'}
        </Text>
      )}
    </View>
  );
}

function DriverHead({
  lap,
  slot,
  color,
  winner,
}: {
  lap: Lap;
  slot: Slot;
  color: string;
  winner: boolean;
}) {
  return (
    <View style={styles.head}>
      <View style={[styles.headBadge, { borderColor: color }]}>
        <Text style={[styles.headBadgeText, { color }]}>{slot}</Text>
      </View>
      <Text style={styles.headDriver} numberOfLines={1}>
        {lap.driverName || 'Anónimo'}
      </Text>
      <Text style={[styles.headTime, winner && { color }]}>
        {formatTime(lap.timeMs)}
      </Text>
      {winner ? <Text style={styles.headWin}>🏆 más rápida</Text> : null}
      <LapTags lap={lap} />
    </View>
  );
}

// Tags descriptivos de la vuelta (ayudas declaradas + ABS/TC reales del juego).
// ABS/TC solo se pintan si la vuelta trae el dato (vueltas del mod v1.2+).
function LapTags({ lap }: { lap: Lap }) {
  return (
    <View style={styles.tags}>
      <Tag
        text={lap.assists ? 'ayudas' : 'sin ayudas'}
        color={lap.assists ? colors.textFaint : colors.green}
      />
      {lap.conditions === 'wet' ? (
        <Tag text="mojado" color={colors.blue} />
      ) : lap.conditions === 'mixed' ? (
        <Tag text="mixto" color={colors.blue} />
      ) : null}
      {lap.abs === false ? (
        <Tag text="sin ABS" color={colors.green} />
      ) : lap.abs === true ? (
        <Tag text="ABS" color={colors.textFaint} />
      ) : null}
      {lap.tc === false ? (
        <Tag text="sin TC" color={colors.green} />
      ) : lap.tc === true ? (
        <Tag text="TC" color={colors.textFaint} />
      ) : null}
    </View>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
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
  subtitle: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 2 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  // Panel de comparación
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  panelHint: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  heads: { flexDirection: 'row', alignItems: 'center' },
  head: { flex: 1, alignItems: 'center', gap: 2 },
  vs: {
    color: colors.textFaint,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: font.display,
    marginHorizontal: spacing.sm,
  },
  headBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headBadgeText: { fontSize: 13, fontWeight: '900' },
  headDriver: { color: colors.text, fontSize: 14, fontWeight: '800', maxWidth: 130 },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagText: { fontSize: 9, fontWeight: '700' },
  headTime: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  headWin: { color: colors.gold, fontSize: 11, fontWeight: '800' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  totalLabel: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  totalDelta: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sectorTable: { marginTop: spacing.md },
  sectorHeadRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: colors.textDim,
  },
  sLabelCell: { flex: 0.7, textAlign: 'left', color: colors.textFaint },
  sCumCell: { flex: 1.2, textAlign: 'right' },
  sTime: { color: colors.text, fontVariant: ['tabular-nums'] },
  sFaster: { color: colors.green },
  noSectors: {
    color: colors.textFaint,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.md,
    lineHeight: 17,
  },
  // Selector de vueltas
  pickHint: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickHintText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  lapRow: {
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
  lapRowA: { borderColor: colors.primary, backgroundColor: 'rgba(255,30,20,0.07)' },
  lapRowB: { borderColor: colors.blue, backgroundColor: 'rgba(59,130,246,0.08)' },
  lapRank: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: font.display,
    minWidth: 32,
  },
  lapDriver: { color: colors.text, fontSize: 15, fontWeight: '700' },
  lapCar: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  slotTag: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotTagText: { fontSize: 12, fontWeight: '900' },
  lapTime: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
  },
});
