// Componentes de UI reutilizables con el tema "racing".
import React, { useState } from 'react';
import {
  Text,
  View,
  Pressable,
  TextInput,
  TextInputProps,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { colors, radius, spacing, readableTextOn, font, glow } from '../theme';

// Input de texto que resalta el borde en rojo al enfocarlo. Reenvía todas las
// props de TextInput y respeta el `style` que le pases (el foco va por encima).
export function Field({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[style, focused && { borderColor: colors.primary }]}
    />
  );
}

// Rayas de velocidad (rojo/amarillo/blanco) como motivo de marca.
export function SpeedStripes({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stripes, style]}>
      <View style={[styles.stripe, { width: 28, backgroundColor: colors.primary }]} />
      <View style={[styles.stripe, { width: 18, backgroundColor: colors.accent }]} />
      <View style={[styles.stripe, { width: 10, backgroundColor: colors.text }]} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
      ? colors.primaryDim
      : variant === 'secondary'
      ? colors.surfaceAlt
      : 'transparent';
  const fg = variant === 'ghost' ? colors.textDim : colors.text;
  const isDisabled = disabled || loading;
  const isLoud = variant === 'primary' || variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1 },
        variant === 'ghost' && styles.btnGhost,
        variant === 'primary' && styles.btnPrimary,
        isLoud && !isDisabled && glow(bg, 14, 0.45),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title.toUpperCase()}</Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }, style]}
        {...({ dataSet: { anim: 'rise' } } as any)}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]} {...({ dataSet: { anim: 'rise' } } as any)}>
      {children}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const bg = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? bg : colors.surfaceAlt,
          borderColor: active ? bg : colors.border,
        },
        active && glow(bg, 10, 0.5),
      ]}
    >
      <Text
        style={[
          styles.chipText,
          // Texto legible según el fondo activo (oscuro sobre amarillo/verde claros).
          { color: active ? readableTextOn(bg) : colors.textDim },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

// Cabecera de pantalla unificada: franja de acento + título + subtítulo.
export function ScreenHeader({
  title,
  subtitle,
  subtitleColor,
  right,
}: {
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerStripe} />
      <View style={styles.headerTexts}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.headerSubtitle, subtitleColor ? { color: subtitleColor } : null]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnGhost: { borderWidth: 1, borderColor: colors.borderHi },
  btnPrimary: {},
  btnText: { fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  section: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  headerStripe: {
    width: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginVertical: 2,
    ...glow(colors.primary, 8, 0.5),
  },
  stripes: { flexDirection: 'row', gap: 5, alignSelf: 'center' },
  stripe: { height: 4, borderRadius: 2 },
  headerTexts: { flex: 1, justifyContent: 'center' },
  headerTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  label: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 1.6 },
  emptyIcon: { fontSize: 60, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  emptySub: {
    color: colors.textFaint,
    fontSize: 14,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
