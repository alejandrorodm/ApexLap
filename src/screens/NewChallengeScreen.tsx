// "Nuevo pique" sin pasar por la ruleta: eliges coche, circuito y condiciones a
// dedo. Se llega desde Récords (botón + arriba del listado de piques) y desde
// el detalle de un circuito (con el trazado ya rellenado).
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import { Button, Chip, Label, ScreenHeader } from '../components/ui';
import { PickerModal, PickerGroup, PickerItem } from '../components/PickerModal';
import { useApp } from '../context/AppContext';
import { addChallenge } from '../firebase/db';
import { confirmAction, notify } from '../utils/alerts';
import { CAR_GROUPS } from '../data/cars';
import { TRACKS, trackLabel } from '../data/tracks';
import { Conditions, CatalogEntry } from '../types';
import { RootStackParamList } from '../navigation/types';

const COND_LABEL: Record<Conditions, string> = {
  dry: '☀ Seco',
  wet: '🌧 Mojado',
  mixed: '🌦 Mixto',
};

const BASE_CAR_GROUPS: PickerGroup[] = CAR_GROUPS.map((g) => ({
  category: g.category,
  items: g.cars,
}));
const BASE_TRACK_GROUPS: PickerGroup[] = TRACKS.map((t) => ({
  category: t.name,
  items: t.layouts.map((l) => trackLabel(t.name, l)),
}));

function withCustom(base: PickerGroup[], custom: CatalogEntry[]): PickerGroup[] {
  if (custom.length === 0) return base;
  const items: PickerItem[] = custom.map((c) => ({
    value: c.name,
    kind: c.kind,
    url: c.url,
    id: c.id,
  }));
  return [{ category: 'Personalizados (mods/DLC)', items }, ...base];
}

export default function NewChallengeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'NewChallenge'>>();
  const preTrack = route.params?.track;
  const {
    league,
    userId,
    profile,
    customCars,
    customTracks,
    addCustom,
    deleteCustom,
  } = useApp();

  const [car, setCar] = useState('');
  const [track, setTrack] = useState(preTrack ?? '');
  const [conditions, setConditions] = useState<Conditions>('dry');
  const [picker, setPicker] = useState<null | 'car' | 'track'>(null);
  const [busy, setBusy] = useState(false);

  const carGroups = useMemo(
    () => withCustom(BASE_CAR_GROUPS, customCars),
    [customCars]
  );
  const trackGroups = useMemo(
    () => withCustom(BASE_TRACK_GROUPS, customTracks),
    [customTracks]
  );

  async function convoke() {
    if (!league || !userId) return;
    if (!car || !track) {
      notify('Faltan datos', 'Elige coche y circuito.');
      return;
    }
    setBusy(true);
    try {
      await addChallenge(league.id, {
        car,
        track,
        conditions,
        createdBy: userId,
        createdByName: profile?.driverName ?? 'Anónimo',
        status: 'open',
      });
      const go = await confirmAction({
        title: '¡Pique convocado! 🎰',
        message: `${car}\n${track}\n${COND_LABEL[conditions]}\n\nTus colegas podrán apostar por el ganador en la pestaña Liga. ¿Registrar tu vuelta ahora?`,
        confirmText: 'Registrar vuelta',
        cancelText: 'Luego',
      });
      // En cualquier caso, volvemos atrás antes de saltar a AddLap para no
      // dejar el modal de "nuevo pique" apilado.
      navigation.goBack();
      if (go) {
        navigation.navigate('AddLap', { car, track, conditions });
      }
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo convocar el pique.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Nuevo pique" subtitle="Elige el reto a dedo" />

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

        <Label>Condiciones</Label>
        <View style={styles.rowChips}>
          <Chip
            label="☀ Seco"
            active={conditions === 'dry'}
            onPress={() => setConditions('dry')}
          />
          <Chip
            label="🌧 Mojado"
            active={conditions === 'wet'}
            onPress={() => setConditions('wet')}
            color={colors.blue}
          />
          <Chip
            label="🌦 Mixto"
            active={conditions === 'mixed'}
            onPress={() => setConditions('mixed')}
            color={colors.blue}
          />
        </View>

        <Button
          title="🎰 Convocar pique"
          onPress={convoke}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Cancelar"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.xs }}
        />

        <Text style={styles.hint}>
          Tus colegas verán el pique en la pestaña Liga y podrán apostar por
          quién creen que será el más rápido.
        </Text>
      </ScrollView>

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
      <Text style={styles.selectChevron}>▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    marginBottom: spacing.sm,
  },
  selectText: { color: colors.text, fontSize: 16 },
  selectPlaceholder: { color: colors.textFaint },
  selectChevron: { color: colors.textDim, fontSize: 14 },
  hint: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
