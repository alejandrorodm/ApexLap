// Detalle de un pique: clasificación de vueltas, apuestas (predecir ganador) y
// cierre con reparto de puntos. Solo el creador puede cerrarlo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { Button, Card, Field } from '../components/ui';
import { useApp } from '../context/AppContext';
import {
  subscribeChallenge,
  subscribeBets,
  getLeagueMembers,
  placeBet,
  closeChallenge,
  subscribeComments,
  addComment,
  deleteComment,
} from '../firebase/db';
import { bestPerDriver, lapsForChallenge, POINTS } from '../utils/leaderboard';
import { formatTime, timeAgo } from '../utils/time';
import { shareCard } from '../utils/share';
import { win } from '../utils/feedback';
import Confetti from '../components/Confetti';
import { confirmAction, notify } from '../utils/alerts';
import { Challenge, Bet, Profile, Comment } from '../types';
import { RootStackParamList } from '../navigation/types';

const COND_ICON: Record<string, string> = { dry: '☀', wet: '🌧', mixed: '🌦' };
const COND_LABEL: Record<string, string> = {
  dry: 'Seco',
  wet: 'Mojado',
  mixed: 'Mixto',
};

export default function ChallengeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Challenge'>>();
  const { challengeId } = route.params;
  const { league, laps, userId, profile } = useApp();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [pickingBet, setPickingBet] = useState(false);
  const [betBusy, setBetBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  const now = Date.now();
  const isHost = league?.createdBy === userId;

  useEffect(() => {
    if (!league) return;
    return subscribeChallenge(league.id, challengeId, setChallenge, () => {});
  }, [league?.id, challengeId]);

  useEffect(() => {
    if (!league) return;
    return subscribeBets(league.id, challengeId, setBets, () => {});
  }, [league?.id, challengeId]);

  useEffect(() => {
    if (!league) return;
    getLeagueMembers(league.id).then(setMembers).catch(() => {});
  }, [league?.id]);

  useEffect(() => {
    if (!league) return;
    return subscribeComments(league.id, challengeId, setComments, () => {});
  }, [league?.id, challengeId]);

  async function sendComment() {
    const text = commentText.trim();
    if (!text || !league || !userId) return;
    setCommentBusy(true);
    try {
      await addComment(league.id, challengeId, {
        userId,
        userName: profile?.driverName ?? 'Anónimo',
        text: text.slice(0, 280),
      });
      setCommentText('');
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo enviar el comentario.');
    } finally {
      setCommentBusy(false);
    }
  }

  function removeComment(c: Comment) {
    if (!league) return;
    deleteComment(league.id, challengeId, c.id).catch(() => {});
  }

  const isClosed = challenge?.status === 'closed';
  const isOwner = challenge?.createdBy === userId;

  // Celebración: confeti + fanfarria cuando el pique se cierra MIENTRAS lo miras
  // (transición abierto→cerrado). Abrir uno ya cerrado no la dispara.
  const [confetti, setConfetti] = useState(0);
  const prevClosed = useRef(isClosed);
  useEffect(() => {
    if (!prevClosed.current && isClosed && challenge?.winnerId) {
      win();
      setConfetti((c) => c + 1);
    }
    prevClosed.current = isClosed;
  }, [isClosed, challenge?.winnerId]);

  // Clasificación de vueltas del pique (mejor por piloto, más rápida primero).
  const ranking = useMemo(
    () => bestPerDriver(lapsForChallenge(laps, challengeId)),
    [laps, challengeId]
  );

  const myBet = bets.find((b) => b.userId === userId) ?? null;

  // Candidatos para apostar: miembros de la liga + quien ya tiene vuelta en el
  // pique (por si algún perfil no apareciera en la consulta).
  const candidates = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.userId, m.driverName));
    ranking.forEach((l) => map.set(l.userId, l.driverName));
    if (userId && profile?.driverName) map.set(userId, profile.driverName);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, ranking, userId, profile?.driverName]);

  async function chooseBet(id: string, name: string) {
    if (!league || !userId) return;
    setPickingBet(false);
    setBetBusy(true);
    try {
      await placeBet(league.id, challengeId, {
        userId,
        userName: profile?.driverName ?? 'Anónimo',
        predictedUserId: id,
        predictedName: name,
      });
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo guardar la apuesta.');
    } finally {
      setBetBusy(false);
    }
  }

  async function close() {
    if (!league || !challenge) return;
    const winner = ranking[0];
    if (!winner) {
      notify(
        'Sin vueltas',
        'Nadie ha registrado una vuelta en este pique todavía.'
      );
      return;
    }
    const correct = bets.filter(
      (b) => b.predictedUserId === winner.userId
    ).length;
    const ok = await confirmAction({
      title: 'Cerrar pique y repartir puntos',
      message: `Ganador: ${winner.driverName} (${formatTime(
        winner.timeMs
      )}).\n\n+${POINTS.win} puntos para el ganador y +${
        POINTS.correctBet
      } para quien lo acertó (${correct} ${
        correct === 1 ? 'acierto' : 'aciertos'
      }).\n\nUna vez cerrado no se puede reabrir.`,
      confirmText: 'Cerrar y repartir',
    });
    if (!ok) return;
    setCloseBusy(true);
    try {
      await closeChallenge(league.id, challengeId, {
        winnerId: winner.userId,
        winnerName: winner.driverName,
        winnerTimeMs: winner.timeMs,
      });
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo cerrar el pique.');
    } finally {
      setCloseBusy(false);
    }
  }

  if (!challenge) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Confetti fire={confetti} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>

        {/* Cabecera del pique */}
        <Card style={{ marginTop: spacing.sm }}>
          <View style={styles.headRow}>
            <Text style={styles.car}>
              {COND_ICON[challenge.conditions]} {challenge.car}
            </Text>
            <View
              style={[
                styles.badge,
                isClosed ? styles.badgeClosed : styles.badgeOpen,
              ]}
            >
              {!isClosed ? (
                <View
                  style={styles.badgeDot}
                  {...({ dataSet: { anim: 'blink' } } as any)}
                />
              ) : null}
              <Text style={styles.badgeText}>
                {isClosed ? 'CERRADO' : 'EN JUEGO'}
              </Text>
            </View>
          </View>
          <Text style={styles.track}>{challenge.track}</Text>
          <Text style={styles.meta}>
            {COND_LABEL[challenge.conditions]} · por {challenge.createdByName} ·{' '}
            {timeAgo(challenge.createdAt, now)}
          </Text>

          {isClosed && challenge.winnerId ? (
            <View style={styles.winnerBox}>
              <Text style={styles.winnerText}>
                🏆 Ganó {challenge.winnerName}
                {challenge.winnerTimeMs
                  ? ` · ${formatTime(challenge.winnerTimeMs)}`
                  : ''}
              </Text>
              <Text style={styles.winnerPts}>
                +{POINTS.win} pts al ganador · +{POINTS.correctBet} a cada acierto
              </Text>
              <Pressable
                style={styles.shareBtn}
                hitSlop={8}
                onPress={() =>
                  shareCard({
                    badge: 'Pique ganado',
                    car: challenge.car,
                    track: challenge.track,
                    timeMs: challenge.winnerTimeMs ?? 0,
                    driverName: challenge.winnerName || 'Anónimo',
                    note: challenge.title || undefined,
                  })
                }
              >
                <Text style={styles.shareBtnText}>⤴ Compartir resultado</Text>
              </Pressable>
            </View>
          ) : null}

          {!isClosed ? (
            <Button
              title="🏁 Registrar mi vuelta"
              onPress={() =>
                navigation.navigate('AddLap', {
                  car: challenge.car,
                  track: challenge.track,
                  conditions: challenge.conditions,
                  challengeId: challenge.id,
                })
              }
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </Card>

        {/* Apuestas: predecir ganador */}
        <Text style={styles.sectionTitle}>🎯 Apuestas — ¿quién ganará?</Text>
        <Card>
          {isClosed ? (
            <Text style={styles.hint}>
              El pique está cerrado: ya no se admiten apuestas.
            </Text>
          ) : (
            <>
              <Text style={styles.hint}>
                Predice el ganador (puedes apostar por ti). Si aciertas ganas +
                {POINTS.correctBet} puntos.
              </Text>
              {myBet ? (
                <Text style={styles.myBet}>
                  Tu apuesta: <Text style={styles.myBetName}>{myBet.predictedName}</Text>
                </Text>
              ) : null}
              <Button
                title={myBet ? 'Cambiar apuesta' : 'Apostar'}
                variant="secondary"
                loading={betBusy}
                onPress={() => setPickingBet((v) => !v)}
                style={{ marginTop: spacing.sm }}
              />
              {pickingBet ? (
                <View style={styles.picker}>
                  {candidates.length === 0 ? (
                    <Text style={styles.hint}>
                      Aún no hay pilotos en la liga para apostar.
                    </Text>
                  ) : (
                    candidates.map((c) => {
                      const sel = myBet?.predictedUserId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.option, sel && styles.optionSel]}
                          onPress={() => chooseBet(c.id, c.name)}
                        >
                          <Text style={styles.optionText}>
                            {c.name}
                            {c.id === userId ? ' · tú' : ''}
                          </Text>
                          {sel ? <Text style={styles.optionCheck}>✓</Text> : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}
            </>
          )}

          {bets.length > 0 ? (
            <View style={styles.betList}>
              {bets.map((b) => {
                const hit =
                  isClosed && b.predictedUserId === challenge.winnerId;
                return (
                  <View key={b.userId} style={styles.betRow}>
                    <Text style={styles.betWho} numberOfLines={1}>
                      {b.userName}
                    </Text>
                    <Text style={styles.betArrow}>apostó por</Text>
                    <Text
                      style={[styles.betPick, hit && styles.betHit]}
                      numberOfLines={1}
                    >
                      {b.predictedName} {hit ? '✓' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </Card>

        {/* Clasificación de vueltas del pique */}
        <Text style={styles.sectionTitle}>⏱ Tiempos del pique</Text>
        <Card>
          {ranking.length === 0 ? (
            <Text style={styles.hint}>Todavía no hay vueltas registradas.</Text>
          ) : (
            ranking.map((l, i) => (
              <View key={l.id} style={styles.lapRow}>
                <Text style={[styles.lapPos, i === 0 && styles.lapPosWin]}>
                  {i === 0 ? '🏆' : `P${i + 1}`}
                </Text>
                <Text
                  style={[
                    styles.lapName,
                    { flex: 1 },
                    i === 0 && styles.lapNameWin,
                  ]}
                  numberOfLines={1}
                >
                  {l.driverName}
                  {l.userId === userId ? ' · tú' : ''}
                </Text>
                <Text style={styles.lapTime}>{formatTime(l.timeMs)}</Text>
              </View>
            ))
          )}
        </Card>

        {/* Cierre (solo creador) */}
        {isOwner && !isClosed ? (
          <Button
            title="🏁 Cerrar pique y repartir puntos"
            loading={closeBusy}
            onPress={close}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}

        {/* Comentarios (la pulla) */}
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionTitle}>
            💬 Pulla ({comments.length})
          </Text>
          {comments.length === 0 ? (
            <Text style={styles.commentEmpty}>
              Aún no ha hablado nadie. Estrena la pulla 😏
            </Text>
          ) : (
            comments.map((c) => {
              const mine = c.userId === userId;
              return (
                <View key={c.id} style={styles.comment}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentHead}>
                      <Text style={[styles.commentName, mine && { color: colors.primary }]}>
                        {c.userName}
                        {mine ? ' · tú' : ''}
                      </Text>
                      <Text style={styles.commentAgo}> · {timeAgo(c.createdAt, now)}</Text>
                    </Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                  {mine || isHost ? (
                    <Pressable onPress={() => removeComment(c)} hitSlop={8}>
                      <Text style={styles.commentDel}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
          <View style={styles.commentInputRow}>
            <Field
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Suelta tu pulla…"
              style={styles.commentInput}
              maxLength={280}
              onSubmitEditing={sendComment}
              returnKeyType="send"
            />
            <Button
              title="Enviar"
              onPress={sendComment}
              loading={commentBusy}
              disabled={!commentText.trim()}
              style={styles.commentSend}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  back: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  car: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
    flex: 1,
  },
  track: { color: colors.textDim, fontSize: 16, marginTop: 4, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: 13, marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeOpen: { borderColor: colors.green, backgroundColor: '#0f2417' },
  badgeClosed: { borderColor: colors.textFaint, backgroundColor: colors.surfaceAlt },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  winnerBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.gold,
  },
  winnerText: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: font.display,
  },
  winnerPts: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  shareBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  shareBtnText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  hint: { color: colors.textFaint, fontSize: 15, lineHeight: 21 },
  commentEmpty: { color: colors.textFaint, fontSize: 14, marginBottom: spacing.sm },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  commentHead: { marginBottom: 2 },
  commentName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  commentAgo: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  commentText: { color: colors.textDim, fontSize: 15, lineHeight: 20 },
  commentDel: { color: colors.textFaint, fontSize: 16, fontWeight: '900', paddingHorizontal: 4 },
  commentInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: 15,
  },
  commentSend: { paddingHorizontal: spacing.lg },
  myBet: { color: colors.text, fontSize: 16, marginTop: spacing.sm },
  myBetName: { color: colors.accent, fontWeight: '900' },
  picker: { marginTop: spacing.sm, gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  optionSel: { borderColor: colors.accent },
  optionText: { color: colors.text, fontSize: 15 },
  optionCheck: { color: colors.accent, fontWeight: '900', fontSize: 16 },
  betList: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  betRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  betWho: { color: colors.text, fontSize: 13, fontWeight: '700', maxWidth: '38%' },
  betArrow: { color: colors.textFaint, fontSize: 12 },
  betPick: { color: colors.textDim, fontSize: 13, flex: 1 },
  betHit: { color: colors.green, fontWeight: '800' },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  lapPos: {
    color: colors.textDim,
    fontWeight: '900',
    fontSize: 15,
    fontFamily: font.display,
    width: 34,
    textAlign: 'center',
  },
  lapPosWin: { fontSize: 20 },
  lapName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  lapNameWin: { color: colors.gold, fontWeight: '900' },
  lapTime: {
    color: colors.accent,
    fontSize: 21,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
});
