// "Perfil": datos del piloto, código de liga para compartir y clasificación de pilotos.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { Button, Card, SectionTitle, Label, ScreenHeader, Field, Chip } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { driverStats } from '../utils/leaderboard';
import {
  aggregateDrivers,
  badgesFor,
  motesByDriver,
  Badge,
  Mote,
} from '../utils/achievements';
import { formatTime } from '../utils/time';
import { shareDriverCard } from '../utils/share';
import { subscribeChallenges } from '../firebase/db';
import { Challenge } from '../types';
import { confirmAction, notify } from '../utils/alerts';

// APK de Android (artefacto de EAS Build, alojado por Expo; descargable sin
// login). Firebase Hosting (plan Spark) PROHÍBE servir .apk, así que apuntamos
// al artefacto de EAS. Al recompilar, actualiza esta URL con la del nuevo build
// (o, para una URL fija, habilita Firebase Storage y súbelo allí).
const APK_URL = 'https://expo.dev/artifacts/eas/q3HANVGfPU8X9pAUmCNJVC.apk';

export default function ProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    profile,
    league,
    laps,
    userId,
    userEmail,
    isGuest,
    hasPassword,
    setDriverName,
    setDriverPrefs,
    leaveLeague,
    signOut,
    linkPassword,
  } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.driverName ?? '');
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);

  async function addPassword() {
    if (pass.length < 6) {
      notify('Contraseña', 'Mínimo 6 caracteres.');
      return;
    }
    setPassBusy(true);
    try {
      await linkPassword(pass);
      setPass('');
      notify(
        'Contraseña añadida ✓',
        'Ya puedes entrar en el mod y el subidor con tu email y esta contraseña.'
      );
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo añadir la contraseña.');
    } finally {
      setPassBusy(false);
    }
  }

  const stats = useMemo(() => driverStats(laps), [laps]);
  const myStats = stats.find((s) => s.userId === userId);

  // Logros y motes: necesitan los piques (cerrados) además de las vueltas.
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  useEffect(() => {
    if (!league) return;
    return subscribeChallenges(league.id, setChallenges, () => {});
  }, [league?.id]);

  const { myBadges, myMote, myWins } = useMemo(() => {
    const aggs = aggregateDrivers(laps, challenges);
    const mine = aggs.find((a) => a.userId === userId);
    return {
      myBadges: mine ? badgesFor(mine) : [],
      myMote: userId ? motesByDriver(aggs).get(userId) ?? null : null,
      myWins: mine?.wins ?? 0,
    };
  }, [laps, challenges, userId]);
  const unlockedCount = myBadges.filter((b) => b.unlocked).length;

  function shareMyCard() {
    shareDriverCard({
      name: profile?.driverName || 'Piloto',
      mote: myMote ? `${myMote.icon} ${myMote.title}` : undefined,
      laps: myStats?.totalLaps ?? 0,
      records: myStats?.records ?? 0,
      wins: myWins,
      badges: unlockedCount,
      bestLapMs: myStats?.bestLap?.timeMs,
      bestLapWhere: myStats?.bestLap
        ? `${myStats.bestLap.car} · ${myStats.bestLap.track}`
        : undefined,
    });
  }

  // Descarga del mod de Assetto Corsa (zip servido por la propia web).
  function downloadMod() {
    const base =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://apexlap.web.app';
    Linking.openURL(`${base}/ApexLap-mod.zip`).catch(() => {});
  }

  // Descarga de la app Android (APK alojado por EAS Build).
  function downloadApk() {
    Linking.openURL(APK_URL).catch(() => {});
  }

  async function shareCode() {
    if (!league) return;
    // Enlace que abre la web y rellena el código automáticamente (?join=CODE).
    const joinUrl = `https://apexlap.web.app/?join=${league.code}`;
    const message = `¡Únete a mi liga "${league.name}" en ApexLap! 🏁\nÁbrela aquí: ${joinUrl}\n(o mete el código ${league.code})`;
    // En web no hay diálogo nativo fiable: copiamos el enlace al portapapeles.
    if (Platform.OS === 'web') {
      try {
        // navigator.share existe en muchos móviles; si no, copiamos el enlace.
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.share) {
          await nav.share({ text: message, url: joinUrl });
        } else {
          await Clipboard.setStringAsync(joinUrl);
          Alert.alert('Enlace copiado', 'Pásaselo a tus colegas para que se unan.');
        }
      } catch {
        /* cancelado */
      }
      return;
    }
    try {
      await Share.share({ message });
    } catch {
      /* el usuario canceló */
    }
  }

  async function saveName() {
    if (name.trim().length < 2) {
      Alert.alert('Nombre muy corto', 'Pon al menos 2 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await setDriverName(name);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave() {
    Alert.alert(
      'Salir de la liga',
      'Dejarás de ver los tiempos de esta liga. Podrás volver con el código.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => leaveLeague() },
      ]
    );
  }

  async function confirmSignOut() {
    const ok = await confirmAction({
      title: 'Cerrar sesión',
      message: isGuest
        ? 'Eres invitado: si cierras sesión sin crear cuenta podrías perder el acceso a tus datos en este dispositivo. ¿Seguro?'
        : '¿Cerrar sesión en este dispositivo?',
      confirmText: 'Cerrar sesión',
      destructive: true,
    });
    if (!ok) return;
    try {
      await signOut();
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo cerrar sesión.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Perfil" />

        {/* Piloto */}
        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle>Piloto</SectionTitle>
          {editing ? (
            <>
              <Label>Nombre de piloto</Label>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                maxLength={24}
                autoFocus
              />
              <View style={styles.rowBtns}>
                <Button title="Guardar" onPress={saveName} loading={busy} style={{ flex: 1 }} />
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => {
                    setName(profile?.driverName ?? '');
                    setEditing(false);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <View style={styles.rowBetween}>
              <Text style={styles.driverName}>{profile?.driverName || 'Sin nombre'}</Text>
              <Pressable onPress={() => setEditing(true)} hitSlop={10}>
                <Text style={styles.edit}>Editar</Text>
              </Pressable>
            </View>
          )}
          {myStats ? (
            <View style={styles.myStats}>
              <Stat label="Vueltas" value={String(myStats.totalLaps)} />
              <Stat label="Récords" value={String(myStats.records)} />
              <Stat
                label="Mejor"
                value={myStats.bestLap ? formatTime(myStats.bestLap.timeMs) : '—'}
              />
            </View>
          ) : null}
          <Button
            title="📈 Mi progreso"
            variant="secondary"
            onPress={() => navigation.navigate('Progress')}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Mi setup: ayudas y caja declaradas, que el mod y el subidor aplican. */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>Mi setup</SectionTitle>
          <Text style={styles.setupHint}>
            Cómo conduces. El mod y el subidor aplican esto a las vueltas que
            suben solas (puedes editar vueltas sueltas después).
          </Text>
          <Label>Ayudas</Label>
          <View style={styles.rowChips}>
            <Chip
              label="🟢 Sin ayudas"
              active={!profile?.assists}
              onPress={() => setDriverPrefs({ assists: false })}
              color={colors.green}
            />
            <Chip
              label="🅰 Con ayudas"
              active={!!profile?.assists}
              onPress={() => setDriverPrefs({ assists: true })}
              color={colors.accent}
            />
          </View>
          <Label>Caja</Label>
          <View style={styles.rowChips}>
            <Chip
              label="Manual"
              active={(profile?.gearbox ?? 'manual') === 'manual'}
              onPress={() => setDriverPrefs({ gearbox: 'manual' })}
            />
            <Chip
              label="Manual + embrague"
              active={profile?.gearbox === 'manual-clutch'}
              onPress={() => setDriverPrefs({ gearbox: 'manual-clutch' })}
            />
            <Chip
              label="Automática"
              active={profile?.gearbox === 'auto'}
              onPress={() => setDriverPrefs({ gearbox: 'auto' })}
            />
          </View>
        </Card>

        {/* Logros y mote */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>
            Logros ({unlockedCount}/{myBadges.length})
          </SectionTitle>
          <MoteBanner mote={myMote} />
          <View style={styles.badgeGrid}>
            {myBadges.map((b) => (
              <BadgeView key={b.id} badge={b} />
            ))}
          </View>
          <Button
            title="🪪 Compartir mi tarjeta"
            variant="secondary"
            onPress={shareMyCard}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Liga */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>Liga</SectionTitle>
          <Text style={styles.leagueName}>{league?.name ?? '—'}</Text>
          <Label>Código para invitar</Label>
          <Pressable style={styles.codeBox} onPress={shareCode}>
            <Text style={styles.code}>{league?.code ?? '—'}</Text>
            <Text style={styles.codeShare}>Compartir ›</Text>
          </Pressable>
          <Button
            title="Ver participantes"
            variant="secondary"
            onPress={() => navigation.navigate('Participants')}
            style={{ marginTop: spacing.md }}
          />
          <Button
            title="Salir de la liga"
            variant="danger"
            onPress={confirmLeave}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Clasificación de pilotos */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>Clasificación de pilotos</SectionTitle>
          {stats.length === 0 ? (
            <Text style={styles.hint}>Sin datos todavía.</Text>
          ) : (
            stats.map((s, i) => (
              <View key={s.userId} style={styles.driverRow}>
                <Text style={styles.driverPos}>{i + 1}</Text>
                <Text style={[styles.driverCol, { flex: 1 }]} numberOfLines={1}>
                  {s.driverName}
                  {s.userId === userId ? ' · tú' : ''}
                </Text>
                <Text style={styles.driverCol}>👑 {s.records}</Text>
                <Text style={[styles.driverCol, styles.driverLaps]}>{s.totalLaps} v</Text>
              </View>
            ))
          )}
        </Card>

        {/* Mod de Assetto Corsa */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>Mod de Assetto Corsa</SectionTitle>
          <Text style={styles.hint}>
            Sube tus vueltas LIMPIAS solas mientras juegas. Descomprime la carpeta{' '}
            <Text style={{ color: colors.text, fontWeight: '800' }}>ApexLap</Text> en{' '}
            <Text style={{ color: colors.text }}>…/assettocorsa/apps/lua/</Text> y
            actívala en la barra lateral de CSP. La primera vez, entra con tu email
            y contraseña.
          </Text>
          <Button
            title="⬇ Descargar plugin (.zip)"
            variant="secondary"
            onPress={downloadMod}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* App de Android */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>App para Android</SectionTitle>
          <Text style={styles.hint}>
            Instala ApexLap en el móvil. Descarga el APK y, en Android, permite
            “instalar de fuentes desconocidas” al abrirlo.
          </Text>
          <Button
            title="⬇ Descargar app (.apk)"
            variant="secondary"
            onPress={downloadApk}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Cuenta */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>Cuenta</SectionTitle>
          <View style={styles.rowBetween}>
            <Text style={styles.accountLabel}>
              {isGuest ? 'Invitado' : 'Email'}
            </Text>
            <Text style={styles.accountValue} numberOfLines={1}>
              {isGuest ? 'sin cuenta' : userEmail ?? '—'}
            </Text>
          </View>
          {isGuest ? (
            <Text style={styles.accountHint}>
              Como invitado tus datos van solo en este dispositivo. Crea una
              cuenta (cierra sesión y pulsa “Crear cuenta”) para verte también en
              el móvil, la web y usar el subidor de Content Manager.
            </Text>
          ) : null}

          {/* Cuentas de Google: añadir contraseña para el mod / subidor. */}
          {!isGuest && !hasPassword ? (
            <View style={styles.passBox}>
              <Label>Añadir contraseña (para el mod y el subidor)</Label>
              <Text style={styles.accountHint}>
                Entraste con Google, que no funciona dentro del juego. Pon una
                contraseña a tu cuenta y úsala con tu email en el mod y el
                subidor (sigue siendo la misma cuenta).
              </Text>
              <Field
                value={pass}
                onChangeText={setPass}
                placeholder="Nueva contraseña (mín. 6)"
                style={styles.passInput}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                title="Guardar contraseña"
                variant="secondary"
                onPress={addPassword}
                loading={passBusy}
              />
            </View>
          ) : null}

          <Button
            title="Cerrar sesión"
            variant="ghost"
            onPress={confirmSignOut}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Text style={styles.footer}>ApexLap · Assetto Corsa 🏁</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MoteBanner({ mote }: { mote: Mote | null }) {
  return (
    <View style={[styles.mote, mote && styles.moteActive]}>
      <Text style={styles.moteIcon}>{mote ? mote.icon : '🏎️'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.moteLabel}>TU MOTE</Text>
        <Text style={[styles.moteTitle, mote && { color: colors.accent }]}>
          {mote ? mote.title : 'Piloto'}
        </Text>
      </View>
      {!mote ? (
        <Text style={styles.moteHint}>Lidera una categoría para ganarlo</Text>
      ) : null}
    </View>
  );
}

function BadgeView({ badge }: { badge: Badge }) {
  return (
    <View style={[styles.badge, !badge.unlocked && styles.badgeLocked]}>
      <Text style={[styles.badgeIcon, !badge.unlocked && styles.badgeIconLocked]}>
        {badge.icon}
      </Text>
      <Text style={styles.badgeName} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={styles.badgeDesc} numberOfLines={2}>
        {badge.desc}
      </Text>
      <Text style={[styles.badgeProgress, badge.unlocked && styles.badgeDone]}>
        {badge.unlocked ? '✓ Logrado' : `${Math.min(badge.value, badge.target)}/${badge.target}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  rowBtns: { flexDirection: 'row', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  edit: { color: colors.primary, fontWeight: '700' },
  myStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  // Mote
  mote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  moteActive: { borderColor: colors.accent },
  moteIcon: { fontSize: 34 },
  moteLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  moteTitle: {
    color: colors.textDim,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: font.display,
    marginTop: 1,
  },
  moteHint: { color: colors.textFaint, fontSize: 11, maxWidth: 96, textAlign: 'right' },
  // Insignias
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentDim,
    padding: spacing.sm,
    alignItems: 'center',
  },
  badgeLocked: { borderColor: colors.border, opacity: 0.55 },
  badgeIcon: { fontSize: 26 },
  badgeIconLocked: { opacity: 0.5 },
  badgeName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
  },
  badgeDesc: {
    color: colors.textFaint,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
    lineHeight: 13,
  },
  badgeProgress: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  badgeDone: { color: colors.green },
  setupHint: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  leagueName: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.md },
  codeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  code: { color: colors.accent, fontSize: 26, fontWeight: '900', letterSpacing: 6 },
  codeShare: { color: colors.primary, fontWeight: '700' },
  hint: { color: colors.textFaint, fontSize: 14 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  driverPos: { color: colors.textDim, fontWeight: '800', width: 22 },
  driverCol: { color: colors.text, fontSize: 14 },
  driverLaps: { color: colors.textDim, width: 44, textAlign: 'right' },
  accountLabel: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  accountValue: { color: colors.text, fontSize: 14, flex: 1, textAlign: 'right', marginLeft: spacing.md },
  accountHint: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  passBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  passInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 16,
    marginVertical: spacing.sm,
  },
  footer: {
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: 12,
  },
});
