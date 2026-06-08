// "Récords": piques activos + récord (vuelta más rápida) por coche+circuito.
// El creador de un pique puede editarlo o borrarlo.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { EmptyState, Button, Chip, Label, ScreenHeader } from '../components/ui';
import { PickerModal, PickerGroup, PickerItem } from '../components/PickerModal';
import { useApp } from '../context/AppContext';
import { recordsByCombo } from '../utils/leaderboard';
import { formatTime, timeAgo } from '../utils/time';
import { shareCard } from '../utils/share';
import {
  subscribeChallenges,
  updateChallenge,
  deleteChallenge,
} from '../firebase/db';
import { confirmAction, notify } from '../utils/alerts';
import { CAR_GROUPS } from '../data/cars';
import { TRACKS, trackLabel } from '../data/tracks';
import { Challenge, Conditions, CatalogEntry } from '../types';
import { RootStackParamList } from '../navigation/types';

const COND_ICON: Record<string, string> = { dry: '☀', wet: '🌧', mixed: '🌦' };

const BASE_CAR_GROUPS: PickerGroup[] = CAR_GROUPS.map((g) => ({
  category: g.category,
  items: g.cars,
}));
const BASE_TRACK_GROUPS: PickerGroup[] = TRACKS.map((t) => ({
  category: t.name,
  items: t.layouts.map((l) => trackLabel(t.name, l)),
}));

function withCustom(base: PickerGroup[], custom: CatalogEntry[]): PickerGroup[] {
  if (custom.length === 0) return base;
  const items: PickerItem[] = custom.map((c) => ({
    value: c.name,
    kind: c.kind,
    url: c.url,
    id: c.id,
  }));
  return [{ category: 'Personalizados (mods/DLC)', items }, ...base];
}

export default function RecordsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { laps, league, userId, customCars, customTracks, addCustom, deleteCustom } =
    useApp();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const now = Date.now();
  // El anfitrión de la liga puede gestionar (editar/borrar) cualquier pique.
  const isHost = !!league && league.createdBy === userId;

  const carGroups = useMemo(
    () => withCustom(BASE_CAR_GROUPS, customCars),
    [customCars]
  );
  const trackGroups = useMemo(
    () => withCustom(BASE_TRACK_GROUPS, customTracks),
    [customTracks]
  );

  // Edición de un pique (solo del creador).
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [eCar, setECar] = useState('');
  const [eTrack, setETrack] = useState('');
  const [eCond, setECond] = useState<Conditions>('dry');
  const [ePicker, setEPicker] = useState<null | 'car' | 'track'>(null);
  const [eBusy, setEBusy] = useState(false);

  useEffect(() => {
    if (!league) return;
    return subscribeChallenges(league.id, setChallenges, () => {});
  }, [league?.id]);

  const records = useMemo(() => recordsByCombo(laps), [laps]);

  const sections = useMemo(
    () => [
      { title: '', kind: 'challenges' as const, data: ['_'] },
      {
        title: `Récords (${records.length})`,
        kind: 'records' as const,
        data: records.map((r) => r.key),
      },
    ],
    [records]
  );

  function openEdit(c: Challenge) {
    setEditing(c);
    setECar(c.car);
    setETrack(c.track);
    setECond(c.conditions);
  }

  function cancelEdit() {
    setEditing(null);
    setEPicker(null);
  }

  async function saveEdit() {
    if (!editing || !league) return;
    if (!eCar || !eTrack) {
      notify('Faltan datos', 'Elige coche y circuito.');
      return;
    }
    setEBusy(true);
    try {
      await updateChallenge(league.id, editing.id, {
        car: eCar,
        track: eTrack,
        conditions: eCond,
      });
      setEditing(null);
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo modificar el pique.');
    } finally {
      setEBusy(false);
    }
  }

  async function removeChallenge(c: Challenge) {
    if (!league) return;
    const ok = await confirmAction({
      title: 'Borrar pique',
      message: `${c.car}\n${c.track}\n\n¿Seguro que quieres eliminarlo?`,
      confirmText: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      if (editing?.id === c.id) cancelEdit();
      await deleteChallenge(league.id, c.id);
    } catch (e: any) {
      notify('Error', e?.message ?? 'No se pudo borrar el pique.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ScreenHeader title="Récords" subtitle={league?.name ?? ''} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, i) => item + i}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          editing ? (
            <View style={styles.editor}>
              <Text style={styles.editorTitle}>✏️ Modificar pique</Text>

              <Label>Coche</Label>
              <SelectField
                value={eCar}
                placeholder="Elegir coche"
                onPress={() => setEPicker('car')}
              />

              <Label>Circuito</Label>
              <SelectField
                value={eTrack}
                placeholder="Elegir circuito"
                onPress={() => setEPicker('track')}
              />

              <Label>Condiciones</Label>
              <View style={styles.rowChips}>
                <Chip label="☀ Seco" active={eCond === 'dry'} onPress={() => setECond('dry')} />
                <Chip label="🌧 Mojado" active={eCond === 'wet'} onPress={() => setECond('wet')} color={colors.blue} />
                <Chip label="🌦 Mixto" active={eCond === 'mixed'} onPress={() => setECond('mixed')} color={colors.blue} />
              </View>

              <Button
                title="Guardar cambios"
                onPress={saveEdit}
                loading={eBusy}
                style={{ marginTop: spacing.md }}
              />
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={cancelEdit}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) =>
          section.kind === 'records' && records.length ? (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          ) : null
        }
        renderItem={({ section, index }) => {
          if (section.kind === 'challenges') {
            return (
              <View>
                <View style={styles.challengesHead}>
                  <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>
                    🎰 Piques activos ({challenges.length})
                  </Text>
                  <Pressable
                    style={styles.newChallengeBtn}
                    onPress={() => navigation.navigate('NewChallenge', {})}
                    hitSlop={8}
                  >
                    <Text style={styles.newChallengeText}>+ Nuevo</Text>
                  </Pressable>
                </View>
                {challenges.length === 0 ? (
                  <Text style={styles.hint}>
                    Ninguno todavía. Usa "+ Nuevo" para convocar uno, o sortéalo
                    en la Ruleta.
                  </Text>
                ) : (
                  challenges.map((c) => {
                    const mine = c.createdBy === userId;
                    const closed = c.status === 'closed';
                    return (
                      <View
                        key={c.id}
                        style={[styles.challenge, closed && styles.challengeClosed]}
                        {...({ dataSet: { anim: 'rise' } } as any)}
                      >
                        <Pressable
                          style={styles.challengeMain}
                          onPress={() =>
                            navigation.navigate('Challenge', {
                              challengeId: c.id,
                            })
                          }
                        >
                          <View style={{ flex: 1 }}>
                            <View style={styles.chTitleRow}>
                              {!closed ? (
                                <View
                                  style={styles.liveDot}
                                  {...({ dataSet: { anim: 'blink' } } as any)}
                                />
                              ) : null}
                              <Text style={styles.chTitle} numberOfLines={1}>
                                {COND_ICON[c.conditions]} {c.car}
                              </Text>
                            </View>
                            <Text style={styles.chTrack}>{c.track}</Text>
                            <Text style={styles.chMeta}>
                              {closed && c.winnerName
                                ? `🏆 ${c.winnerName}`
                                : `por ${c.createdByName} · ${timeAgo(c.createdAt, now)}`}
                            </Text>
                          </View>
                          <Text style={styles.chCta}>
                            {closed ? 'Ver ›' : 'Apostar /\nvuelta ›'}
                          </Text>
                        </Pressable>

                        {mine || isHost ? (
                          <View style={styles.ownerRow}>
                            {!closed ? (
                              <Pressable onPress={() => openEdit(c)} hitSlop={8}>
                                <Text style={styles.ownerBtn}>✏️ Editar</Text>
                              </Pressable>
                            ) : null}
                            <Pressable onPress={() => removeChallenge(c)} hitSlop={8}>
                              <Text style={[styles.ownerBtn, styles.ownerBtnDanger]}>
                                🗑 Borrar
                              </Text>
                            </Pressable>
                            {isHost && !mine ? (
                              <Text style={styles.ownerTag}>admin</Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            );
          }

          // récords
          const rec = records[index];
          if (!rec) return null;
          return (
            <View style={styles.record} {...({ dataSet: { anim: 'rise' } } as any)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recCar}>🚗 {rec.car}</Text>
                <Text style={styles.recTrack}>📍 {rec.track}</Text>
                <Text style={styles.recHolder}>
                  👑 {rec.lap.driverName} · {rec.count}{' '}
                  {rec.count === 1 ? 'vuelta' : 'vueltas'}
                </Text>
              </View>
              <View style={styles.recRight}>
                <Text style={styles.recTime}>{formatTime(rec.lap.timeMs)}</Text>
                <Pressable
                  style={styles.shareBtn}
                  hitSlop={8}
                  onPress={() =>
                    shareCard({
                      badge: 'Récord',
                      car: rec.car,
                      track: rec.track,
                      timeMs: rec.lap.timeMs,
                      driverName: rec.lap.driverName || 'Anónimo',
                      note: `${rec.count} ${rec.count === 1 ? 'vuelta' : 'vueltas'} en la liga`,
                    })
                  }
                >
                  <Text style={styles.shareBtnText}>⤴ Compartir</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={null}
        ListFooterComponent={
          records.length === 0 ? (
            <EmptyState
              icon="👑"
              title="Sin récords todavía"
              subtitle="Cuando registréis vueltas, aquí verás quién manda en cada coche y circuito."
            />
          ) : null
        }
      />

      <PickerModal
        visible={ePicker === 'car'}
        title="Elegir coche"
        groups={carGroups}
        selected={eCar}
        onSelect={setECar}
        onClose={() => setEPicker(null)}
        onAdd={(e) => addCustom('cars', e)}
        onDelete={(it) => deleteCustom('cars', it.id)}
      />
      <PickerModal
        visible={ePicker === 'track'}
        title="Elegir circuito"
        groups={trackGroups}
        selected={eTrack}
        onSelect={setETrack}
        onClose={() => setEPicker(null)}
        onAdd={(e) => addCustom('tracks', e)}
        onDelete={(it) => deleteCustom('tracks', it.id)}
      />
    </SafeAreaView>
  );
}

function SelectField({
  value,
  placeholder,
  onPress,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.select} onPress={onPress}>
      <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>
        {value || placeholder}
      </Text>
      <Text style={styles.selectChevron}>▾</Text>
    </Pressable>
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
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  hint: { color: colors.textFaint, fontSize: 15, marginBottom: spacing.sm },
  challengesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  newChallengeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  newChallengeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  editor: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  editorTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    marginBottom: spacing.sm,
  },
  selectText: { color: colors.text, fontSize: 16 },
  selectPlaceholder: { color: colors.textFaint },
  selectChevron: { color: colors.textDim, fontSize: 14 },
  challenge: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  challengeClosed: { borderLeftColor: colors.border },
  challengeMain: { flexDirection: 'row', alignItems: 'center' },
  chTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  chTitle: { color: colors.text, fontSize: 20, fontWeight: '900', flex: 1 },
  chTrack: { color: colors.textDim, fontSize: 15, marginTop: 3, fontWeight: '600' },
  chMeta: { color: colors.textFaint, fontSize: 13, marginTop: 4 },
  chCta: { color: colors.accent, fontWeight: '900', fontSize: 14, textAlign: 'right' },
  ownerRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ownerBtn: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  ownerBtnDanger: { color: '#ef4444' },
  ownerTag: {
    marginLeft: 'auto',
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  recCar: { color: colors.text, fontSize: 20, fontWeight: '900' },
  recTrack: { color: colors.textDim, fontSize: 15, marginTop: 3, fontWeight: '600' },
  recHolder: { color: colors.gold, fontSize: 13, marginTop: 5, fontWeight: '700' },
  recRight: { alignItems: 'flex-end', gap: 6 },
  shareBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtnText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  recTime: {
    color: colors.accent,
    fontSize: 27,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
});
