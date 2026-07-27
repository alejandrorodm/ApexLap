// Pantalla "Piques": permite convocar piques DIRECTOS (a mano) o mediante la RULETA aleatoria.
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { Button, Card, Chip, SectionTitle, ScreenHeader, Label } from '../components/ui';
import { PickerModal, PickerGroup, PickerItem } from '../components/PickerModal';
import { useApp } from '../context/AppContext';
import { ALL_CARS, CAR_GROUPS } from '../data/cars';
import { ALL_TRACKS, TRACKS, trackLabel } from '../data/tracks';
import { addChallenge } from '../firebase/db';
import { notifyLeague } from '../notifications';
import { confirmAction, notify } from '../utils/alerts';
import { tick as playTick, impact, win } from '../utils/feedback';
import Confetti from '../components/Confetti';
import { Conditions, CatalogEntry } from '../types';
import { RootStackParamList } from '../navigation/types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CONDITION_LABEL: Record<Conditions, string> = {
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

type PiqueMode = 'direct' | 'roulette';

export default function RouletteScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { league, userId, profile, customCars, customTracks, addCustom, deleteCustom } =
    useApp();

  const [mode, setMode] = useState<PiqueMode>('direct');

  // Estado del modo "Pique Directo"
  const [dCar, setDCar] = useState('');
  const [dTrack, setDTrack] = useState('');
  const [dCond, setDCond] = useState<Conditions>('dry');
  const [dPicker, setDPicker] = useState<null | 'car' | 'track'>(null);
  const [dBusy, setDBusy] = useState(false);

  // Estado del modo "Ruleta"
  const carPool = useMemo(
    () => [...ALL_CARS, ...customCars.map((c) => c.name)],
    [customCars]
  );
  const trackPool = useMemo(
    () => [...ALL_TRACKS, ...customTracks.map((t) => t.name)],
    [customTracks]
  );

  const [carText, setCarText] = useState('— — —');
  const [trackText, setTrackText] = useState('— — —');
  const [condText, setCondText] = useState('☀ Seco');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{
    car: string;
    track: string;
    conditions: Conditions;
  } | null>(null);

  const [lockCar, setLockCar] = useState(false);
  const [lockTrack, setLockTrack] = useState(false);
  const [randomCond, setRandomCond] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const carGroups = useMemo(
    () => withCustom(BASE_CAR_GROUPS, customCars),
    [customCars]
  );
  const trackGroups = useMemo(
    () => withCustom(BASE_TRACK_GROUPS, customTracks),
    [customTracks]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Convocar pique directo
  async function convokeDirect() {
    if (!league || !userId) return;
    if (!dCar || !dTrack) {
      notify('Faltan datos', 'Elige coche y circuito.');
      return;
    }
    setDBusy(true);
    try {
      await addChallenge(league.id, {
        car: dCar,
        track: dTrack,
        conditions: dCond,
        createdBy: userId,
        createdByName: profile?.driverName ?? 'Anónimo',
        status: 'open',
      });
      notifyLeague(
        league.id,
        userId,
        `🎰 Nuevo pique en ${league.name}`,
        `${profile?.driverName ?? 'Alguien'}: ${dCar} · ${dTrack}`
      );
      const go = await confirmAction({
        title: '¡Pique convocado! 🎯',
        message: `${dCar}\n${dTrack}\n${CONDITION_LABEL[dCond]}\n\nTus colegas podrán apostar por el ganador en la pestaña Liga. ¿Registrar tu vuelta ahora?`,
        confirmText: 'Registrar vuelta',
        cancelText: 'Luego',
      });
      if (go) {
        navigation.navigate('AddLap', {
          car: dCar,
          track: dTrack,
          conditions: dCond,
        });
      }
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo convocar el pique.');
    } finally {
      setDBusy(false);
    }
  }

  // Girar la ruleta
  function spin() {
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    glow.setValue(0);

    const finalCar = lockCar && result ? result.car : pick(carPool);
    const finalTrack = lockTrack && result ? result.track : pick(trackPool);
    const conds: Conditions[] = ['dry', 'wet', 'mixed'];
    const finalCond: Conditions = randomCond ? pick(conds) : 'dry';

    const totalTicks = 26;
    let tick = 0;

    const step = () => {
      tick += 1;
      if (tick >= totalTicks) {
        setCarText(finalCar);
        setTrackText(finalTrack);
        setCondText(CONDITION_LABEL[finalCond]);
        setResult({ car: finalCar, track: finalTrack, conditions: finalCond });
        setSpinning(false);
        impact();
        win();
        setConfetti((c) => c + 1);
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.06,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        Animated.timing(glow, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
        return;
      }
      playTick();
      setCarText(lockCar && result ? result.car : pick(carPool));
      setTrackText(lockTrack && result ? result.track : pick(trackPool));
      if (randomCond) setCondText(CONDITION_LABEL[pick(conds)]);
      const delay = 40 + Math.pow(tick / totalTicks, 3) * 320;
      timer.current = setTimeout(step, delay);
    };
    step();
  }

  // Convocar pique de ruleta
  async function convokeRoulette() {
    if (!result || !league || !userId) return;
    const convened = result;
    try {
      await addChallenge(league.id, {
        car: convened.car,
        track: convened.track,
        conditions: convened.conditions,
        createdBy: userId,
        createdByName: profile?.driverName ?? 'Anónimo',
        status: 'open',
      });
      notifyLeague(
        league.id,
        userId,
        `🎰 Nuevo pique en ${league.name}`,
        `${profile?.driverName ?? 'Alguien'}: ${convened.car} · ${convened.track}`
      );
      const go = await confirmAction({
        title: '¡Pique convocado! 🎰',
        message: `${convened.car}\n${convened.track}\n${CONDITION_LABEL[convened.conditions]}\n\nTus colegas podrán apostar por el ganador en la pestaña Liga. ¿Registrar tu vuelta ahora?`,
        confirmText: 'Registrar vuelta',
        cancelText: 'Luego',
      });
      if (go) {
        navigation.navigate('AddLap', {
          car: convened.car,
          track: convened.track,
          conditions: convened.conditions,
        });
      }
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo convocar el pique.');
    }
  }

  const glowBorder = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Confetti fire={confetti} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerWrap}>
          <ScreenHeader
            title="Piques"
            subtitle="Elige tu reto directamente o tira la ruleta 🏎️"
            subtitleColor={colors.textDim}
          />
        </View>

        {/* Conmutador de modo: Pique Directo vs Ruleta */}
        <View style={styles.modeToggle}>
          <Chip
            label="🎯 Elegir pique"
            active={mode === 'direct'}
            onPress={() => setMode('direct')}
            color={colors.accent}
          />
          <Chip
            label="🎰 Ruleta aleatoria"
            active={mode === 'roulette'}
            onPress={() => setMode('roulette')}
            color={colors.blue}
          />
        </View>

        {mode === 'direct' ? (
          <Card style={{ marginTop: spacing.md }}>
            <SectionTitle>Elige coche y circuito a mano</SectionTitle>

            <Label>Coche</Label>
            <SelectField
              value={dCar}
              placeholder="Elegir coche"
              onPress={() => setDPicker('car')}
            />

            <Label>Circuito</Label>
            <SelectField
              value={dTrack}
              placeholder="Elegir circuito"
              onPress={() => setDPicker('track')}
            />

            <Label>Condiciones</Label>
            <View style={styles.rowChips}>
              <Chip
                label="☀ Seco"
                active={dCond === 'dry'}
                onPress={() => setDCond('dry')}
              />
              <Chip
                label="🌧 Mojado"
                active={dCond === 'wet'}
                onPress={() => setDCond('wet')}
                color={colors.blue}
              />
              <Chip
                label="🌦 Mixto"
                active={dCond === 'mixed'}
                onPress={() => setDCond('mixed')}
                color={colors.blue}
              />
            </View>

            <Button
              title="📣 Convocar este pique"
              onPress={convokeDirect}
              loading={dBusy}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        ) : (
          <>
            <Animated.View style={{ transform: [{ scale }], marginTop: spacing.md }}>
              <Animated.View style={[styles.reels, { borderColor: glowBorder }]}>
                <Reel icon="🚗" label="Coche" value={carText} spinning={spinning} />
                <View style={styles.divider} />
                <Reel icon="📍" label="Circuito" value={trackText} spinning={spinning} />
                {randomCond ? (
                  <>
                    <View style={styles.divider} />
                    <Reel icon="🌤" label="Condiciones" value={condText} spinning={spinning} />
                  </>
                ) : null}
              </Animated.View>
            </Animated.View>

            <Button
              title={spinning ? 'Girando…' : result ? '🎰 Volver a tirar' : '🎰 ¡Tirar!'}
              onPress={spin}
              disabled={spinning}
              style={{ marginTop: spacing.lg }}
            />

            {result && !spinning ? (
              <Button
                title="📣 Convocar este pique"
                variant="secondary"
                onPress={convokeRoulette}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}

            <Card style={{ marginTop: spacing.xl }}>
              <SectionTitle>Opciones del sorteo</SectionTitle>
              <View style={styles.optsRow}>
                <Chip
                  label="🔒 Fijar coche"
                  active={lockCar}
                  onPress={() => setLockCar((v) => !v)}
                  color={colors.blue}
                />
                <Chip
                  label="🔒 Fijar circuito"
                  active={lockTrack}
                  onPress={() => setLockTrack((v) => !v)}
                  color={colors.blue}
                />
                <Chip
                  label="🌦 Condiciones al azar"
                  active={randomCond}
                  onPress={() => setRandomCond((v) => !v)}
                  color={colors.accent}
                />
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <PickerModal
        visible={dPicker === 'car'}
        title="Elegir coche"
        groups={carGroups}
        selected={dCar}
        onSelect={setDCar}
        onClose={() => setDPicker(null)}
        onAdd={(e) => addCustom('cars', e)}
        onDelete={(it) => deleteCustom('cars', it.id)}
      />
      <PickerModal
        visible={dPicker === 'track'}
        title="Elegir circuito"
        groups={trackGroups}
        selected={dTrack}
        onSelect={setDTrack}
        onClose={() => setDPicker(null)}
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

function Reel({
  icon,
  label,
  value,
  spinning,
}: {
  icon: string;
  label: string;
  value: string;
  spinning: boolean;
}) {
  return (
    <View style={styles.reel}>
      <Text style={styles.reelLabel}>
        {icon} {label}
      </Text>
      <Text
        style={[styles.reelValue, spinning && styles.reelValueSpin]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg },
  headerWrap: { marginBottom: spacing.sm },
  modeToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
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
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  reels: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.lg,
  },
  reel: { paddingVertical: spacing.md, alignItems: 'center' },
  reelLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  reelValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  reelValueSpin: { color: colors.textDim, opacity: 0.7 },
  divider: { height: 1, backgroundColor: colors.border },
  optsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
