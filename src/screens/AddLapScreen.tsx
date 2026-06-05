// Formulario para registrar una vuelta nueva.
import React, { useMemo, useState } from 'react';
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
import { colors, spacing, radius } from '../theme';
import { Button, Card, Label, Chip } from '../components/ui';
import { PickerModal, PickerGroup } from '../components/PickerModal';
import { useApp } from '../context/AppContext';
import { CAR_GROUPS } from '../data/cars';
import { TRACKS, trackLabel } from '../data/tracks';
import { parseTime, formatTime } from '../utils/time';
import { addLap, getLeagueMemberTokens } from '../firebase/db';
import { sendPushToTokens } from '../notifications';
import { notify } from '../utils/alerts';
import { Conditions, Gearbox } from '../types';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddLap'>;

const CAR_PICKER: PickerGroup[] = CAR_GROUPS.map((g) => ({
  category: g.category,
  items: g.cars,
}));
const TRACK_PICKER: PickerGroup[] = TRACKS.map((t) => ({
  category: t.name,
  items: t.layouts.map((l) => trackLabel(t.name, l)),
}));

export default function AddLapScreen({ navigation, route }: Props) {
  const { userId, profile, league } = useApp();
  const params = route.params ?? {};

  const [car, setCar] = useState(params.car ?? '');
  const [track, setTrack] = useState(params.track ?? '');
  const [timeStr, setTimeStr] = useState('');
  const [conditions, setConditions] = useState<Conditions>(params.conditions ?? 'dry');
  const [assists, setAssists] = useState(false);
  const [gearbox, setGearbox] = useState<Gearbox>('manual');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<null | 'car' | 'track'>(null);
  const [busy, setBusy] = useState(false);

  const parsedMs = useMemo(() => parseTime(timeStr), [timeStr]);
  const canSave = !!car && !!track && parsedMs != null && parsedMs > 0;

  async function save() {
    if (!canSave || !userId || !league) return;
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
      navigation.goBack();
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
            <View style={styles.challengeBanner}>
              <Text style={styles.challengeText}>🎰 Registrando vuelta de un pique</Text>
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
          <Text style={styles.hint}>
            {parsedMs != null
              ? `✓ ${formatTime(parsedMs)}`
              : 'Formato: m:ss.mmm  (también valen "102.356" o ms sueltos)'}
          </Text>

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

          <Button
            title="Guardar vuelta"
            onPress={save}
            disabled={!canSave}
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
        groups={CAR_PICKER}
        selected={car}
        onSelect={setCar}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'track'}
        title="Elegir circuito"
        groups={TRACK_PICKER}
        selected={track}
        onSelect={setTrack}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  challengeBanner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  challengeText: { color: colors.accent, fontWeight: '700', textAlign: 'center' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  timeInput: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  notes: { height: 80, paddingTop: spacing.md, textAlignVertical: 'top' },
  hint: { color: colors.textFaint, fontSize: 13, marginBottom: spacing.lg },
  select: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 50,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  selectText: { color: colors.text, fontSize: 16, flex: 1 },
  selectPlaceholder: { color: colors.textFaint },
  chevron: { color: colors.textDim, fontSize: 16 },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
});
