// Vista de la "share card" para CAPTURA NATIVA (react-native-view-shot). Es la
// versión RN de la tarjeta que en web se dibuja con canvas (mismo look "racing":
// cabecera con marca, etiquetas, tiempo héroe y bandera de cuadros al pie).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font } from '../theme';
import { formatTime } from '../utils/time';
import { APP_URL, ShareCard } from '../utils/shareTypes';

export const CARD_W = 380;
export const CARD_H = 475;

// Bandera de cuadros (2 filas) hecha con Views.
function CheckerStrip({ square = 19, rows = 2 }: { square?: number; rows?: number }) {
  const cols = Math.ceil(CARD_W / square);
  return (
    <View>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <View
              key={c}
              style={{
                width: square,
                height: square,
                backgroundColor: (r + c) % 2 === 0 ? colors.text : colors.bgDeep,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export default function ShareCardView({ card }: { card: ShareCard }) {
  return (
    <View style={styles.card}>
      {/* Franja roja→amarillo superior */}
      <View style={styles.topStripe}>
        <View style={{ flex: 72, backgroundColor: colors.primary }} />
        <View style={{ flex: 28, backgroundColor: colors.accent }} />
      </View>

      <View style={styles.inner}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>
            <Text style={styles.brandApex}>APEX</Text>
            <Text style={styles.brandLap}>LAP</Text>
          </Text>
          <Text style={styles.tagline}>LEAGUE · RACING</Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{card.badge.toUpperCase()}</Text>
        </View>

        <Label>COCHE</Label>
        <Text style={styles.car} numberOfLines={1}>
          {card.car}
        </Text>

        <Label>CIRCUITO</Label>
        <Text style={styles.track} numberOfLines={1}>
          {card.track}
        </Text>

        <Label>TIEMPO</Label>
        <Text style={styles.time}>{formatTime(card.timeMs)}</Text>

        <Label>PILOTO</Label>
        <Text style={styles.driver} numberOfLines={1}>
          {card.driverName}
        </Text>
        {card.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {card.note}
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />
      </View>

      <CheckerStrip />
      <Text style={styles.footer}>{APP_URL.replace('https://', '')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  topStripe: { height: 6, flexDirection: 'row' },
  inner: { flex: 1, paddingHorizontal: 26, paddingTop: 20 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  brand: { fontFamily: font.display, fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  brandApex: { color: colors.text },
  brandLap: { color: colors.primary },
  tagline: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: font.display,
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  badgeText: {
    color: colors.bgDeep,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: font.display,
  },
  label: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    fontFamily: font.display,
    marginTop: 16,
  },
  car: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 2 },
  track: { color: colors.textDim, fontSize: 16, fontWeight: '700', marginTop: 2 },
  time: {
    color: colors.accent,
    fontSize: 60,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    marginTop: 2,
  },
  driver: { color: colors.gold, fontSize: 20, fontWeight: '900', marginTop: 2 },
  note: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 4 },
  footer: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: font.display,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
