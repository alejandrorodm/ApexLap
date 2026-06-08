// Vista de la "share card" para CAPTURA NATIVA (react-native-view-shot). Es la
// versión RN de la tarjeta que en web se dibuja con canvas. Tamaño fijo para que
// la captura salga consistente.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font } from '../theme';
import { formatTime } from '../utils/time';
import { APP_URL, ShareCard } from '../utils/shareTypes';

export const CARD_W = 360;
export const CARD_H = 450;

export default function ShareCardView({ card }: { card: ShareCard }) {
  return (
    <View style={styles.card}>
      <View style={styles.topStripe} />
      <View style={styles.inner}>
        <Text style={styles.brand}>
          <Text style={styles.brandApex}>APEX</Text>
          <Text style={styles.brandLap}>LAP</Text>
        </Text>
        <Text style={styles.badge}>{card.badge.toUpperCase()}</Text>

        <Text style={styles.car} numberOfLines={1}>
          🚗 {card.car}
        </Text>
        <Text style={styles.track} numberOfLines={1}>
          📍 {card.track}
        </Text>

        <Text style={styles.time}>{formatTime(card.timeMs)}</Text>
        <Text style={styles.driver} numberOfLines={1}>
          👑 {card.driverName}
        </Text>
        {card.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {card.note}
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />
        <Text style={styles.footer}>{APP_URL.replace('https://', '')}</Text>
      </View>
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
  topStripe: { height: 6, backgroundColor: colors.primary },
  inner: { flex: 1, padding: 26 },
  brand: {
    fontFamily: font.display,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandApex: { color: colors.text },
  brandLap: { color: colors.primary },
  badge: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  car: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 34,
  },
  track: { color: colors.textDim, fontSize: 16, fontWeight: '700', marginTop: 6 },
  time: {
    color: colors.accent,
    fontSize: 72,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    marginTop: 24,
  },
  driver: { color: colors.gold, fontSize: 20, fontWeight: '900', marginTop: 6 },
  note: { color: colors.textDim, fontSize: 14, fontWeight: '600', marginTop: 8 },
  footer: {
    color: colors.textFaint,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
