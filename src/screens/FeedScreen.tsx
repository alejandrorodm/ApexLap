// "Muro": feed de rivalidad en vivo de la liga (vueltas, récords, piques).
// Se alimenta de las vueltas en tiempo real del contexto + los piques.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { EmptyState, ScreenHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { subscribeChallenges } from '../firebase/db';
import { buildFeed, FeedEvent, FeedTone } from '../utils/feed';
import { timeAgo } from '../utils/time';
import { Challenge } from '../types';

const TONE_COLOR: Record<FeedTone, string> = {
  normal: colors.border,
  record: colors.gold,
  against: colors.primary,
  win: colors.green,
  challenge: colors.accent,
};

export default function FeedScreen() {
  const { laps, league, userId } = useApp();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const now = Date.now();

  useEffect(() => {
    if (!league) return;
    return subscribeChallenges(league.id, setChallenges, () => {});
  }, [league?.id]);

  const feed = useMemo(
    () => buildFeed(laps, challenges, userId),
    [laps, challenges, userId]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ScreenHeader
          title="Muro"
          subtitle={league ? `🔥 ${league.name} en vivo` : ''}
        />
      </View>

      <FlatList
        data={feed}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <Row event={item} now={now} />}
        ListEmptyComponent={
          <EmptyState
            icon="🔥"
            title="Todo en calma… de momento"
            subtitle="Cuando alguien marque una vuelta, bata un récord o convoque un pique, lo verás aquí al instante."
          />
        }
      />
    </SafeAreaView>
  );
}

function Row({ event, now }: { event: FeedEvent; now: number }) {
  return (
    <View
      style={[styles.row, { borderLeftColor: TONE_COLOR[event.tone] }]}
      {...({ dataSet: { anim: 'rise' } } as any)}
    >
      <Text style={styles.icon}>{event.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.text} numberOfLines={2}>
          {event.text}
        </Text>
        {event.sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {event.sub}
          </Text>
        ) : null}
      </View>
      <Text style={styles.ago}>{timeAgo(event.at, now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  icon: { fontSize: 22 },
  text: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2, fontWeight: '600' },
  ago: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
});
