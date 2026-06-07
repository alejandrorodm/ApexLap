// "Perfil": datos del piloto, código de liga para compartir y clasificación de pilotos.
import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import { Button, Card, SectionTitle, Label, ScreenHeader, Field } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';
import { driverStats } from '../utils/leaderboard';
import { formatTime } from '../utils/time';
import { confirmAction, notify } from '../utils/alerts';

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

  async function shareCode() {
    if (!league) return;
    // Enlace que abre la web y rellena el código automáticamente (?join=CODE).
    const joinUrl = `https://laptimersaver.web.app/?join=${league.code}`;
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
  driverName: { color: colors.text, fontSize: 22, fontWeight: '900' },
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
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statLabel: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
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
