// Se muestra cuando Firebase aún no está configurado (placeholders sin rellenar).
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { Card } from '../components/ui';

const STEPS = [
  'Entra en console.firebase.google.com y crea un proyecto (gratis).',
  'En Build › Firestore Database, pulsa "Create database" (modo test para empezar).',
  'En Build › Authentication › Sign-in method, habilita el proveedor "Anonymous".',
  'En ⚙ Project settings › Tus apps, añade una app Web (</>) y copia el objeto firebaseConfig.',
  'Pega esos valores en src/firebase/config.ts y recarga la app.',
];

export default function SetupScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>🏁 ApexLap</Text>
        <Text style={styles.h1}>Conecta Firebase</Text>
        <Text style={styles.sub}>
          Para compartir tiempos con tus colegas necesitas un proyecto Firebase
          (es gratis y se hace en unos minutos).
        </Text>

        <Card style={{ marginTop: spacing.lg }}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.file}>src/firebase/config.ts</Text>
        <Text style={styles.note}>
          Mientras tanto la app no puede guardar datos. En cuanto pegues la
          configuración, esta pantalla desaparece sola.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  logo: { color: colors.primary, fontSize: 16, fontWeight: '800', marginBottom: spacing.xl },
  h1: { color: colors.text, fontSize: 28, fontWeight: '900' },
  sub: { color: colors.textDim, fontSize: 15, marginTop: spacing.sm, lineHeight: 21 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  numText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  stepText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
  file: {
    color: colors.accent,
    fontWeight: '700',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  note: {
    color: colors.textFaint,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
});
