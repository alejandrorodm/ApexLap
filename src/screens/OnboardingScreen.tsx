// Onboarding: nombre de piloto + crear o unirse a una liga.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { Button, Card, SectionTitle, Label } from '../components/ui';
import { useApp } from '../context/AppContext';

export default function OnboardingScreen() {
  const { profile, setDriverName, createLeague, joinLeague } = useApp();
  const [name, setName] = useState(profile?.driverName ?? '');
  const [leagueName, setLeagueName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const hasName = (profile?.driverName ?? '').trim().length > 0;

  // Si llegan desde un enlace compartido (…/?join=CODE), rellenamos el código.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const j = new URLSearchParams(window.location.search).get('join');
      if (j) setCode(j.trim().toUpperCase());
    } catch {
      /* sin parámetros */
    }
  }, []);

  async function saveName() {
    if (name.trim().length < 2) {
      Alert.alert('Nombre muy corto', 'Pon al menos 2 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await setDriverName(name);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function doCreate() {
    if (leagueName.trim().length < 2) {
      Alert.alert('Nombre de liga', 'Ponle un nombre a tu liga.');
      return;
    }
    setBusy(true);
    try {
      await createLeague(leagueName);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo crear la liga.');
    } finally {
      setBusy(false);
    }
  }

  async function doJoin() {
    if (code.trim().length < 4) {
      Alert.alert('Código', 'Introduce el código que te pasó tu colega.');
      return;
    }
    setBusy(true);
    try {
      await joinLeague(code);
    } catch (e: any) {
      Alert.alert('No se pudo unir', e?.message ?? 'Código incorrecto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🏁 ApexLap</Text>

          {!hasName ? (
            <>
              <Text style={styles.h1}>¿Cómo te llamas, piloto?</Text>
              <Text style={styles.sub}>
                Este nombre saldrá en el ranking junto a tus vueltas.
              </Text>
              <Card style={{ marginTop: spacing.lg }}>
                <Label>Nombre de piloto</Label>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="p.ej. Carlos Sainz"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  autoFocus
                  maxLength={24}
                />
                <Button
                  title="Continuar"
                  onPress={saveName}
                  loading={busy}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            </>
          ) : (
            <>
              <Text style={styles.h1}>Tu liga</Text>
              <Text style={styles.sub}>
                Crea una liga y pasa el código a tus colegas, o únete a una con
                el código que te hayan dado.
              </Text>

              <Card style={{ marginTop: spacing.lg }}>
                <SectionTitle>Crear liga nueva</SectionTitle>
                <Label>Nombre de la liga</Label>
                <TextInput
                  value={leagueName}
                  onChangeText={setLeagueName}
                  placeholder="p.ej. Piques del finde"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  maxLength={30}
                />
                <Button
                  title="Crear liga"
                  onPress={doCreate}
                  loading={busy}
                  style={{ marginTop: spacing.md }}
                />
              </Card>

              <View style={styles.orRow}>
                <View style={styles.line} />
                <Text style={styles.or}>o</Text>
                <View style={styles.line} />
              </View>

              <Card>
                <SectionTitle>Unirme con código</SectionTitle>
                <Label>Código de la liga</Label>
                <TextInput
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  placeholder="p.ej. K7M2P"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, styles.code]}
                  autoCapitalize="characters"
                  maxLength={6}
                />
                <Button
                  title="Unirme"
                  onPress={doJoin}
                  variant="secondary"
                  loading={busy}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  logo: { color: colors.primary, fontSize: 16, fontWeight: '800', marginBottom: spacing.xl },
  h1: { color: colors.text, fontSize: 26, fontWeight: '900' },
  sub: { color: colors.textDim, fontSize: 15, marginTop: spacing.sm, lineHeight: 21 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 16,
  },
  code: { letterSpacing: 4, fontWeight: '800', fontSize: 22, textAlign: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.textFaint, marginHorizontal: spacing.md, fontWeight: '700' },
});
