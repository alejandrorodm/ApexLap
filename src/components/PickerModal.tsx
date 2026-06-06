// Selector modal con buscador, grupos opcionales y alta de entradas personalizadas
// (coches/circuitos con etiqueta MOD/KUNOS/AC Original y, para mods, URL de origen).
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
  Linking,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { CatalogKind, CATALOG_KIND_LABEL } from '../types';
import { confirmAction } from '../utils/alerts';

// Un item del selector: o un texto suelto, o un coche/circuito con metadatos.
export type PickerItem =
  | string
  | { value: string; kind?: CatalogKind; url?: string; id?: string };

export interface PickerGroup {
  category: string;
  items: PickerItem[];
}

interface NormItem {
  value: string;
  kind?: CatalogKind;
  url?: string;
  id?: string;
}

function norm(it: PickerItem): NormItem {
  return typeof it === 'string' ? { value: it } : it;
}

const KIND_COLOR: Record<CatalogKind, string> = {
  mod: colors.accent,
  kunos: colors.blue,
  ac: colors.green,
};

const KIND_OPTIONS: CatalogKind[] = ['mod', 'kunos', 'ac'];

export function PickerModal({
  visible,
  title,
  groups,
  selected,
  onSelect,
  onClose,
  allowCustom = true,
  onAdd,
  onDelete,
}: {
  visible: boolean;
  title: string;
  groups: PickerGroup[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  allowCustom?: boolean;
  // Si se pasa, al añadir uno nuevo se pide etiqueta y URL y se guarda en la liga.
  onAdd?: (entry: { name: string; kind: CatalogKind; url?: string }) => Promise<void> | void;
  // Si se pasa, los items con `id` (personalizados) se pueden borrar (pulsación larga).
  onDelete?: (item: { id: string; value: string }) => Promise<void> | void;
}) {
  const [search, setSearch] = useState('');
  const [addKind, setAddKind] = useState<CatalogKind>('mod');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => ({
        title: g.category,
        data: (q
          ? g.items.filter((i) => norm(i).value.toLowerCase().includes(q))
          : g.items
        ).map(norm),
      }))
      .filter((s) => s.data.length > 0);
  }, [groups, search]);

  const trimmed = search.trim();
  const exactExists = useMemo(
    () =>
      groups.some((g) =>
        g.items.some((i) => norm(i).value.toLowerCase() === trimmed.toLowerCase())
      ),
    [groups, trimmed]
  );

  function reset() {
    setSearch('');
    setAddKind('mod');
    setAddUrl('');
  }

  function pick(value: string) {
    onSelect(value);
    reset();
    onClose();
  }

  async function saveNew() {
    if (!onAdd || !trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd({
        name: trimmed,
        kind: addKind,
        url: addKind === 'mod' ? addUrl.trim() || undefined : undefined,
      });
      pick(trimmed);
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete(item: NormItem) {
    if (!onDelete || !item.id) return;
    const ok = await confirmAction({
      title: 'Borrar de la lista',
      message: `¿Quitar "${item.value}" del catálogo de la liga?`,
      confirmText: 'Borrar',
      cancelText: 'Cancelar',
    });
    if (ok) await onDelete({ id: item.id, value: item.value });
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Mostrar el bloque de alta cuando hay texto nuevo que no existe ya.
  const showAddBlock = allowCustom && trimmed.length > 0 && !exactExists;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
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

          {showAddBlock && onAdd ? (
            // Alta con etiqueta de origen y URL (para mods).
            <View style={styles.addCard}>
              <Text style={styles.addTitle}>Añadir "{trimmed}"</Text>
              <View style={styles.kindRow}>
                {KIND_OPTIONS.map((k) => {
                  const active = addKind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setAddKind(k)}
                      style={[
                        styles.kindChip,
                        {
                          backgroundColor: active ? KIND_COLOR[k] : colors.surface,
                          borderColor: active ? KIND_COLOR[k] : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.kindChipText,
                          { color: active ? colors.bgDeep : colors.textDim },
                        ]}
                      >
                        {CATALOG_KIND_LABEL[k]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {addKind === 'mod' ? (
                <TextInput
                  value={addUrl}
                  onChangeText={setAddUrl}
                  placeholder="URL del mod (opcional)"
                  placeholderTextColor={colors.textFaint}
                  style={styles.urlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              ) : null}
              <Pressable
                style={[styles.addBtn, adding && { opacity: 0.6 }]}
                onPress={saveNew}
                disabled={adding}
              >
                <Text style={styles.addBtnText}>
                  ＋ Guardar y usar "{trimmed}"
                </Text>
              </Pressable>
            </View>
          ) : showAddBlock ? (
            // Sin persistencia (p. ej. filtros): solo usar el texto tal cual.
            <Pressable style={styles.customRow} onPress={() => pick(trimmed)}>
              <Text style={styles.customText}>＋ Usar "{trimmed}"</Text>
            </Pressable>
          ) : null}

          <SectionList
            sections={sections}
            keyExtractor={(item, i) => item.value + i}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={({ item }) => {
              const isSel = item.value === selected;
              const canDelete = !!onDelete && !!item.id;
              return (
                <Pressable
                  style={[styles.row, isSel && styles.rowSel]}
                  onPress={() => pick(item.value)}
                  onLongPress={canDelete ? () => confirmDelete(item) : undefined}
                  delayLongPress={350}
                >
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowText, isSel && styles.rowTextSel]}>
                      {item.value}
                    </Text>
                    <View style={styles.rowMeta}>
                      {item.kind ? (
                        <View
                          style={[styles.kindBadge, { borderColor: KIND_COLOR[item.kind] }]}
                        >
                          <Text
                            style={[styles.kindBadgeText, { color: KIND_COLOR[item.kind] }]}
                          >
                            {CATALOG_KIND_LABEL[item.kind]}
                          </Text>
                        </View>
                      ) : null}
                      {item.url ? (
                        <Pressable
                          hitSlop={8}
                          onPress={() => Linking.openURL(item.url!).catch(() => {})}
                        >
                          <Text style={styles.linkText}>↗ origen</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
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
  // Tarjeta de alta de coche/circuito personalizado.
  addCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  addTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },
  kindRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kindChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  kindChipText: { fontSize: 12, fontWeight: '800' },
  urlInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addBtnText: { color: colors.bgDeep, fontSize: 14, fontWeight: '800' },
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
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { color: colors.text, fontSize: 16 },
  rowTextSel: { color: colors.accent, fontWeight: '700' },
  kindBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  kindBadgeText: { fontSize: 10, fontWeight: '800' },
  linkText: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  check: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  emptyList: {
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
