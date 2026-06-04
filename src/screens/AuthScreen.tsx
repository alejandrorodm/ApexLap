// Pantalla de inicio de sesión: crear cuenta / entrar (email+contraseña),
// "Entrar con Google" (solo web por ahora) y "Entrar como invitado".
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { Button } from '../components/ui';
import { useApp } from '../context/AppContext';
import { notify } from '../utils/alerts';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const { signInEmail, signUpEmail, signInGoogle, signInGuest } = useApp();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  async function submit() {
    const mail = email.trim();
    if (!mail || !mail.includes('@')) {
      notify('Email', 'Escribe un email válido.');
      return;
    }
    if (password.length < 6) {
      notify('Contraseña', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (isSignup && name.trim().length < 2) {
      notify('Nombre', 'Pon tu nombre de piloto (mín. 2 caracteres).');
      return;
    }
    setBusy(true);
    try {
      if (isSignup) await signUpEmail(name, mail, password);
      else await signInEmail(mail, password);
    } catch (e: any) {
      notify('No se pudo entrar', friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      await signInGoogle();
    } catch (e: any) {
      notify('Google', friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function guest() {
    setBusy(true);
    try {
      await signInGuest();
    } catch (e: any) {
      notify('Invitado', friendlyAuthError(e));
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>🏁 ApexLap</Text>
          <Text style={styles.tagline}>
            Tus tiempos de Assetto Corsa, con tus colegas.
          </Text>

          <View style={styles.switcher}>
            <Pressable
              style={[styles.switchBtn, isSignup && styles.switchBtnActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.switchText, isSignup && styles.switchTextActive]}>
                Crear cuenta
              </Text>
            </Pressable>
            <Pressable
              style={[styles.switchBtn, !isSignup && styles.switchBtnActive]}
              onPress={() => setMode('signin')}
            >
              <Text style={[styles.switchText, !isSignup && styles.switchTextActive]}>
                Entrar
              </Text>
            </Pressable>
          </View>

          {isSignup ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nombre de piloto"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              autoCapitalize="words"
            />
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />

          <Button
            title={isSignup ? 'Crear cuenta' : 'Entrar'}
            onPress={submit}
            loading={busy}
            style={{ marginTop: spacing.sm }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>o</Text>
            <View style={styles.divLine} />
          </View>

          {Platform.OS === 'web' ? (
            <Button title="Entrar con Google" variant="secondary" onPress={google} />
          ) : null}

          <Button
            title="Entrar como invitado"
            variant="ghost"
            onPress={guest}
            style={{ marginTop: spacing.sm }}
          />
          <Text style={styles.guestHint}>
            Como invitado tus datos van solo en este dispositivo. Crea una cuenta
            para verte también en otros (móvil, web…) y usar el subidor de
            Content Manager.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Traduce los códigos de error de Firebase a algo legible.
function friendlyAuthError(e: any): string {
  const code = e?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ese email ya tiene cuenta. Pulsa "Entrar".';
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil (mín. 6 caracteres).';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o contraseña incorrectos.';
    case 'auth/operation-not-allowed':
      return 'Este método de login no está habilitado en Firebase todavía.';
    case 'auth/popup-closed-by-user':
      return 'Cerraste la ventana de Google antes de terminar.';
    case 'auth/network-request-failed':
      return 'Problema de red. Revisa tu conexión.';
    default:
      return e?.message ?? 'Algo falló. Inténtalo de nuevo.';
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xxl, flexGrow: 1, justifyContent: 'center' },
  logo: { color: colors.text, fontSize: 34, fontWeight: '900', textAlign: 'center' },
  tagline: {
    color: colors.textDim,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.lg,
  },
  switchBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  switchBtnActive: { backgroundColor: colors.primary },
  switchText: { color: colors.textDim, fontWeight: '700', fontSize: 14 },
  switchTextActive: { color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divText: { color: colors.textFaint, marginHorizontal: spacing.md, fontSize: 13 },
  guestHint: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
