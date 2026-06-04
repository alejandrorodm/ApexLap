// Selector modal con buscador, grupos opcionales y entrada personalizada.
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  SectionList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface PickerGroup {
  category: string;
  items: string[];
}

export function PickerModal({
  visible,
  title,
  groups,
  selected,
  onSelect,
  onClose,
  allowCustom = true,
}: {
  visible: boolean;
  title: string;
  groups: PickerGroup[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  allowCustom?: boolean;
}) {
  const [search, setSearch] = useState('');

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => ({
        title: g.category,
        data: q
          ? g.items.filter((i) => i.toLowerCase().includes(q))
          : g.items,
      }))
      .filter((s) => s.data.length > 0);
  }, [groups, search]);

  const trimmed = search.trim();
  const exactExists = useMemo(
    () =>
      groups.some((g) =>
        g.items.some((i) => i.toLowerCase() === trimmed.toLowerCase())
      ),
    [groups, trimmed]
  );

  function pick(value: string) {
    onSelect(value);
    setSearch('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar o escribir…"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCorrect={false}
          />

          {allowCustom && trimmed.length > 0 && !exactExists ? (
            <Pressable style={styles.customRow} onPress={() => pick(trimmed)}>
              <Text style={styles.customText}>＋ Usar "{trimmed}"</Text>
            </Pressable>
          ) : null}

          <SectionList
            sections={sections}
            keyExtractor={(item, i) => item + i}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={({ item }) => {
              const isSel = item === selected;
              return (
                <Pressable
                  style={[styles.row, isSel && styles.rowSel]}
                  onPress={() => pick(item)}
                >
                  <Text style={[styles.rowText, isSel && styles.rowTextSel]}>
                    {item}
                  </Text>
                  {isSel ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyList}>
                Sin resultados. {allowCustom ? 'Escribe para añadir uno nuevo.' : ''}
              </Text>
            }
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    height: '82%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  close: { color: colors.textDim, fontSize: 20, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  customRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  customText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  sectionHeader: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    backgroundColor: colors.bg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowSel: { backgroundColor: colors.surfaceAlt },
  rowText: { color: colors.text, fontSize: 16 },
  rowTextSel: { color: colors.accent, fontWeight: '700' },
  check: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  emptyList: {
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
