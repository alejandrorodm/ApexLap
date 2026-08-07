// Formulario para registrar una vuelta nueva.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { Button, Card, Label, Chip } from '../components/ui';
import { PickerModal, PickerGroup, PickerItem } from '../components/PickerModal';
import { useApp } from '../context/AppContext';
import { CAR_GROUPS } from '../data/cars';
import { TRACKS, trackLabel } from '../data/tracks';
import { CatalogEntry } from '../types';
import { parseTime, formatTime, formatDelta } from '../utils/time';
import {
  comboBenchmark,
  classifyTime,
  ComboBenchmark,
  LapFeat,
} from '../utils/leaderboard';
import { addLap, getLeagueMemberTokens } from '../firebase/db';
import { sendPushToTokens } from '../notifications';
import { notify } from '../utils/alerts';
import { win } from '../utils/feedback';
import Confetti from '../components/Confetti';
import { Conditions, Gearbox } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddLap'>;

const BASE_CAR_GROUPS: PickerGroup[] = CAR_GROUPS.map((g) => ({
  category: g.category,
  items: g.cars,
}));
const BASE_TRACK_GROUPS: PickerGroup[] = TRACKS.map((t) => ({
  category: t.name,
  items: t.layouts.map((l) => trackLabel(t.name, l)),
}));

// Añade un grupo "Personalizados (mods/DLC)" con las entradas del catálogo de la liga.
function withCustom(
  base: PickerGroup[],
  custom: CatalogEntry[]
): PickerGroup[] {
  if (custom.length === 0) return base;
  const items: PickerItem[] = custom.map((c) => ({
    value: c.name,
    kind: c.kind,
    url: c.url,
    id: c.id,
  }));
  return [{ category: 'Personalizados (mods/DLC)', items }, ...base];
}

export default function AddLapScreen({ navigation, route }: Props) {
  const {
    userId,
    profile,
    league,
    laps,
    customCars,
    customTracks,
    addCustom,
    deleteCustom,
  } = useApp();
  const params = route.params ?? {};

  const carGroups = useMemo(
    () => withCustom(BASE_CAR_GROUPS, customCars),
    [customCars]
  );
  const trackGroups = useMemo(
    () => withCustom(BASE_TRACK_GROUPS, customTracks),
    [customTracks]
  );

  const [car, setCar] = useState(params.car ?? '');
  const [track, setTrack] = useState(params.track ?? '');
  const [timeStr, setTimeStr] = useState('');
  const [conditions, setConditions] = useState<Conditions>(params.conditions ?? 'dry');
  const [assists, setAssists] = useState(false);
  // ABS/TC opcionales (descriptivos): undefined = sin especificar. Cada chip
  // alterna; volver a pulsar el activo lo deja de nuevo sin especificar.
  const [abs, setAbs] = useState<boolean | undefined>(undefined);
  const [tc, setTc] = useState<boolean | undefined>(undefined);
  const [gearbox, setGearbox] = useState<Gearbox>('manual');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<null | 'car' | 'track'>(null);
  const [busy, setBusy] = useState(false);

  const parsedMs = useMemo(() => parseTime(timeStr), [timeStr]);
  const canSave = !!car && !!track && parsedMs != null && parsedMs > 0;

  // Referencia del combo para decir, mientras escribes, si el tiempo vale algo.
  const bench = useMemo(
    () => (car && track ? comboBenchmark(laps, car, track, userId) : null),
    [laps, car, track, userId]
  );
  const feat: LapFeat | null =
    bench && parsedMs != null && parsedMs > 0 ? classifyTime(parsedMs, bench) : null;

  // Celebración antes de volver: confeti + fanfarria si la vuelta es récord o PB.
  const [confetti, setConfetti] = useState(0);
  const [celebrating, setCelebrating] = useState<LapFeat | null>(null);
  const goBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (goBackTimer.current) clearTimeout(goBackTimer.current);
    },
    []
  );

  async function save() {
    if (!canSave || !userId || !league || busy || celebrating) return;
    setBusy(true);
    try {
      const driverName = profile?.driverName ?? 'Anónimo';
      await addLap(league.id, {
        userId,
        driverName,
        car,
        track,
        timeMs: parsedMs!,
        conditions,
        assists,
        abs, // undefined si no se especifica (ignoreUndefinedProperties lo descarta)
        tc,
        gearbox,
        notes: notes.trim() || undefined,
        challengeId: params.challengeId,
        // Alta manual: entra pendiente de que el anfitrión la verifique.
        source: 'manual',
        status: 'pending',
      });
      // Avisar al resto de la liga (best-effort, no bloquea el guardado).
      try {
        const tokens = await getLeagueMemberTokens(league.id, userId);
        await sendPushToTokens(
          tokens,
          `🏁 Nueva vuelta en ${league.name}`,
          `${driverName}: ${formatTime(parsedMs!)} · ${car} · ${track}`
        );
      } catch {
        /* notificar es opcional */
      }
      // Nunca se vuelve en seco: siempre hay acuse de recibo, y si la vuelta
      // vale algo, además confeti y fanfarria.
      const achieved = feat ?? 'none';
      setCelebrating(achieved);
      if (achieved !== 'none') {
        setConfetti((c) => c + 1);
        win();
      }
      goBackTimer.current = setTimeout(
        () => navigation.goBack(),
        achieved === 'none' ? 1100 : 1800
      );
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo guardar la vuelta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {params.challengeId ? (
            <View
              style={styles.challengeBanner}
              {...({ dataSet: { anim: 'rise' } } as any)}
            >
              <View
                style={styles.bannerDot}
                {...({ dataSet: { anim: 'blink' } } as any)}
              />
              <Text style={styles.challengeText}>
                🎰 Registrando vuelta de un pique
              </Text>
            </View>
          ) : null}

          <Label>Coche</Label>
          <SelectField
            value={car}
            placeholder="Elegir coche"
            onPress={() => setPicker('car')}
          />

          <Label>Circuito</Label>
          <SelectField
            value={track}
            placeholder="Elegir circuito"
            onPress={() => setPicker('track')}
          />

          <Label>Tiempo de vuelta</Label>
          <TextInput
            value={timeStr}
            onChangeText={setTimeStr}
            placeholder="1:42.356"
            placeholderTextColor={colors.textFaint}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, styles.timeInput]}
          />
          <Text style={[styles.hint, parsedMs != null && styles.hintOk]}>
            {parsedMs != null
              ? `✓ ${formatTime(parsedMs)}`
              : 'Formato: m:ss.mmm  (también valen "102.356" o ms sueltos)'}
          </Text>
          <PaceLine parsedMs={parsedMs} bench={bench} feat={feat} />

          <Label>Condiciones</Label>
          <View style={styles.rowChips}>
            <Chip label="☀ Seco" active={conditions === 'dry'} onPress={() => setConditions('dry')} />
            <Chip label="🌧 Mojado" active={conditions === 'wet'} onPress={() => setConditions('wet')} color={colors.blue} />
            <Chip label="🌦 Mixto" active={conditions === 'mixed'} onPress={() => setConditions('mixed')} color={colors.blue} />
          </View>

          <Label>Ayudas</Label>
          <View style={styles.rowChips}>
            <Chip label="Sin ayudas" active={!assists} onPress={() => setAssists(false)} color={colors.green} />
            <Chip label="Con ayudas" active={assists} onPress={() => setAssists(true)} />
          </View>

          <Label>ABS / TC (opcional)</Label>
          <View style={styles.rowChips}>
            <Chip label="Sin ABS" active={abs === false} onPress={() => setAbs(abs === false ? undefined : false)} color={colors.green} />
            <Chip label="Con ABS" active={abs === true} onPress={() => setAbs(abs === true ? undefined : true)} />
            <Chip label="Sin TC" active={tc === false} onPress={() => setTc(tc === false ? undefined : false)} color={colors.green} />
            <Chip label="Con TC" active={tc === true} onPress={() => setTc(tc === true ? undefined : true)} />
          </View>

          <Label>Caja de cambios</Label>
          <View style={styles.rowChips}>
            <Chip label="Manual" active={gearbox === 'manual'} onPress={() => setGearbox('manual')} />
            <Chip label="Manual + embrague" active={gearbox === 'manual-clutch'} onPress={() => setGearbox('manual-clutch')} />
            <Chip label="Automática" active={gearbox === 'auto'} onPress={() => setGearbox('auto')} />
          </View>

          <Label>Notas (opcional)</Label>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Setup, reglajes, comentarios…"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.notes]}
            multiline
            maxLength={200}
          />

          {celebrating ? (
            <View
              style={[
                styles.celebration,
                celebrating === 'record' && styles.celebrationRecord,
                celebrating === 'none' && styles.celebrationPlain,
              ]}
            >
              <Text style={styles.celebrationTitle}>
                {celebrating === 'record'
                  ? '🏆 ¡RÉCORD DE LA LIGA!'
                  : celebrating === 'pb'
                    ? '⚡ ¡TU MEJOR MARCA!'
                    : '✓ Vuelta guardada'}
              </Text>
              <Text style={styles.celebrationSub}>
                {formatTime(parsedMs!)} · {car} · {track}
              </Text>
              {/* El alta manual entra pendiente: no contará hasta que la validen. */}
              <Text style={styles.celebrationNote}>
                Pendiente de que la valide el anfitrión
              </Text>
            </View>
          ) : null}

          <Button
            title="Guardar vuelta"
            onPress={save}
            disabled={!canSave || !!celebrating}
            loading={busy}
            style={{ marginTop: spacing.lg }}
          />
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={picker === 'car'}
        title="Elegir coche"
        groups={carGroups}
        selected={car}
        onSelect={setCar}
        onClose={() => setPicker(null)}
        onAdd={(e) => addCustom('cars', e)}
        onDelete={(it) => deleteCustom('cars', it.id)}
      />
      <PickerModal
        visible={picker === 'track'}
        title="Elegir circuito"
        groups={trackGroups}
        selected={track}
        onSelect={setTrack}
        onClose={() => setPicker(null)}
        onAdd={(e) => addCustom('tracks', e)}
        onDelete={(it) => deleteCustom('tracks', it.id)}
      />
      <Confetti fire={confetti} />
    </SafeAreaView>
  );
}

/**
 * Lo que vale el tiempo que estás escribiendo: cuánto te falta para el récord
 * de la liga en ese coche+circuito y para tu propia marca. Es el "pique" en
 * vivo del formulario; sin esto tecleas un número a ciegas.
 */
function PaceLine({
  parsedMs,
  bench,
  feat,
}: {
  parsedMs: number | null;
  bench: ComboBenchmark | null;
  feat: LapFeat | null;
}) {
  if (!bench || parsedMs == null || parsedMs <= 0) return null;
  const { record, myBest } = bench;
  if (!record) {
    return (
      <Text style={[styles.pace, styles.paceRecord]}>
        🏆 Primera vuelta de la liga en este combo
      </Text>
    );
  }

  const vsRecord = formatDelta(parsedMs, record.timeMs);
  const recordLine =
    feat === 'record'
      ? `🏆 Récord de la liga · ${vsRecord} a ${record.driverName || 'la marca'}`
      : `🥇 ${record.driverName || 'Récord'} ${formatTime(record.timeMs)} · ${vsRecord}`;

  return (
    <View style={styles.paceWrap}>
      <Text style={[styles.pace, feat === 'record' && styles.paceRecord]}>
        {recordLine}
      </Text>
      {myBest && myBest.id !== record.id ? (
        <Text style={[styles.pace, feat === 'pb' && styles.pacePb]}>
          {feat === 'pb'
            ? `⚡ Tu mejor marca · ${formatDelta(parsedMs, myBest.timeMs)}`
            : `👤 Tu mejor ${formatTime(myBest.timeMs)} · ${formatDelta(parsedMs, myBest.timeMs)}`}
        </Text>
      ) : null}
    </View>
  );
}

function SelectField({
  value,
  placeholder,
  onPress,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.select} onPress={onPress}>
      <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>
        {value || placeholder}
      </Text>
      <Text style={styles.chevron}>▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  challengeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  challengeText: { color: colors.accent, fontWeight: '900', fontSize: 15 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 54,
    fontSize: 17,
    marginBottom: spacing.xs,
  },
  timeInput: {
    height: 76,
    fontSize: 40,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    color: colors.accent,
    textAlign: 'center',
  },
  notes: { height: 88, paddingTop: spacing.md, fontSize: 16, textAlignVertical: 'top' },
  hint: { color: colors.textFaint, fontSize: 13, marginBottom: spacing.lg },
  hintOk: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  // Sube para quedar pegado al "✓ tiempo", que arrastra el margen de `hint`.
  paceWrap: { marginTop: -spacing.md, marginBottom: spacing.lg, gap: 2 },
  pace: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  paceRecord: { color: colors.accent, fontWeight: '900' },
  pacePb: { color: colors.green, fontWeight: '900' },
  celebration: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: 'rgba(57,211,83,0.12)',
    alignItems: 'center',
  },
  celebrationRecord: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,214,10,0.12)',
  },
  celebrationPlain: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  celebrationTitle: {
    color: colors.text,
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  celebrationSub: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  celebrationNote: {
    marginTop: 6,
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  select: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 54,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  selectText: { color: colors.text, fontSize: 17, fontWeight: '600', flex: 1 },
  selectPlaceholder: { color: colors.textFaint, fontWeight: '400' },
  chevron: { color: colors.textDim, fontSize: 16 },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
});
