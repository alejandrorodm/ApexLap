// Ruleta tragaperras: sortea coche + circuito (+ condiciones) y convoca un pique.
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import { Button, Card, Chip, SectionTitle, ScreenHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { ALL_CARS } from '../data/cars';
import { ALL_TRACKS } from '../data/tracks';
import { addChallenge } from '../firebase/db';
import { confirmAction, notify } from '../utils/alerts';
import { Conditions } from '../types';
import { RootStackParamList } from '../navigation/types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CONDITION_LABEL: Record<Conditions, string> = {
  dry: '☀ Seco',
  wet: '🌧 Mojado',
  mixed: '🌦 Mixto',
};

export default function RouletteScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { league, userId, profile, customCars, customTracks } = useApp();

  // El sorteo incluye también los coches/circuitos personalizados de la liga.
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

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
        // animación de "golpe" al revelar
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
      // mientras gira, muestra valores aleatorios (respeta locks)
      setCarText(lockCar && result ? result.car : pick(carPool));
      setTrackText(lockTrack && result ? result.track : pick(trackPool));
      if (randomCond) setCondText(CONDITION_LABEL[pick(conds)]);
      // desaceleración: el intervalo crece con cada tick
      const delay = 40 + Math.pow(tick / totalTicks, 3) * 320;
      timer.current = setTimeout(step, delay);
    };
    step();
  }

  async function convoke() {
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerWrap}>
          <ScreenHeader
            title="Ruleta de piques"
            subtitle="Tira y que el destino decida coche y circuito 🎲"
            subtitleColor={colors.textDim}
          />
        </View>

        <Animated.View style={{ transform: [{ scale }] }}>
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
            onPress={convoke}
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
          <Text style={styles.optsHint}>
            Fija coche o circuito para sortear solo lo demás. Útil para hacer un
            torneo en el mismo trazado con coches distintos.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
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
  headerWrap: { marginBottom: spacing.lg },
  reels: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.lg,
  },
  reel: { paddingVertical: spacing.md, alignItems: 'center' },
  reelLabel: { color: colors.textDim, fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  reelValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  reelValueSpin: { color: colors.textDim, opacity: 0.7 },
  divider: { height: 1, backgroundColor: colors.border },
  optsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optsHint: { color: colors.textFaint, fontSize: 13, marginTop: spacing.md, lineHeight: 19 },
});
