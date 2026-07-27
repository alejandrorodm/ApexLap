// Componente de zona de carga de imagen de trazado/circuito:
// Permite:
// 1) Arrastrar y soltar una foto (Drag & Drop)
// 2) Pegar directamente de portapapeles (Ctrl + V)
// 3) Seleccionar un archivo del ordenador (File Picker)
// 4) Introducir una URL directa
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

interface ImageDropzoneProps {
  value: string;
  onChange: (dataUrlOrUrl: string) => void;
  placeholder?: string;
}

export function ImageDropzone({
  value,
  onChange,
  placeholder = 'https://... o pega/arrastra una imagen',
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Escuchar pegar (Ctrl + V) globalmente cuando el componente está montado
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  function processFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      // Optimiza la imagen en canvas a máximo 600px para que el DataURL sea ligero
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const img = new (window as any).Image();
        img.src = result;
        img.onload = () => {
          const canvas = window.document.createElement('canvas');
          const maxW = 600;
          let w = img.width;
          let h = img.height;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          onChange(canvas.toDataURL('image/png'));
        };
        img.onerror = () => onChange(result);
      } else {
        onChange(result);
      }
    };
    reader.readAsDataURL(file);
  }

  // Manejadores Web de Drag & Drop
  const webProps =
    Platform.OS === 'web'
      ? ({
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(true);
          },
          onDragLeave: (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) processFile(file);
          },
        } as any)
      : {};

  function handleFilePick() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!fileInputRef.current) {
        const input = window.document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) processFile(file);
        };
        fileInputRef.current = input;
      }
      fileInputRef.current.click();
    }
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.dropArea,
          isDragging && styles.dropAreaActive,
          !!value && styles.dropAreaHasValue,
        ]}
        {...webProps}
      >
        {value ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: value }} style={styles.previewImage} resizeMode="contain" />
            <Pressable style={styles.removeBtn} onPress={() => onChange('')}>
              <Text style={styles.removeBtnText}>✕ Quitar foto</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.dropInner} onPress={handleFilePick}>
            <Text style={styles.dropIcon}>📥</Text>

            <Text style={styles.dropTitle}>
              Arrastra una foto aquí o haz clic para buscar
            </Text>

            <View style={styles.pasteBadge}>
              <Text style={styles.pasteBadgeText}>
                📋 O pega directamente con Ctrl + V
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      <Text style={styles.urlLabel}>O pega la URL de la imagen:</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.urlInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  dropArea: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    marginBottom: spacing.sm,
  },
  dropAreaActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 214, 10, 0.08)',
  },
  dropAreaHasValue: {
    borderStyle: 'solid',
    borderColor: colors.accent,
    padding: spacing.xs,
  },
  dropInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  dropIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  dropTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  pasteBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pasteBadgeText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  previewWrap: {
    width: '100%',
    height: 110,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  urlLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  urlInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 40,
    fontSize: 13,
  },
});
