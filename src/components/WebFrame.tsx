// Marco SOLO para web: encaja la app en una columna centrada (aspecto de app
// móvil) sobre un fondo con degradado, añade una cabecera con el branding y
// aplica estilos globales (fuente, scrollbar oscura, hover/cursor, fundido).
// En nativo (iOS/Android) devuelve los hijos tal cual: no cambia nada.
import React, { useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { useIsWideWeb } from '../responsive';

const COLUMN_NARROW = 480; // móvil / ventana estrecha
const COLUMN_WIDE = 960; // portátil / escritorio

const GLOBAL_CSS = `
:root { color-scheme: dark; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  background: radial-gradient(1100px 620px at 50% -8%, #15171F 0%, ${colors.bgDeep} 62%) fixed;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: #3a3f4d; background-clip: padding-box; }
::-webkit-scrollbar-track { background: transparent; }
/* Botones y pulsables: cursor, transición y feedback al pasar/pulsar. */
[role="button"] {
  cursor: pointer;
  transition: transform .12s ease, filter .12s ease, opacity .12s ease, background-color .12s ease, border-color .12s ease;
}
[role="button"]:hover { filter: brightness(1.12); }
[role="button"]:active { transform: translateY(1px) scale(0.997); }
/* Fundido de entrada del marco. */
@keyframes apexFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
[data-apexframe] { animation: apexFadeIn .35s ease both; }
`;

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Orbitron:wght@700;800;900&display=swap';

let injected = false;
function injectWebStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;

  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://fonts.gstatic.com';
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = FONTS_HREF;
  document.head.appendChild(fonts);

  const style = document.createElement('style');
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
}

export default function WebFrame({ children }: { children: React.ReactNode }) {
  const isWeb = Platform.OS === 'web';
  const wide = useIsWideWeb();

  useEffect(() => {
    if (isWeb) injectWebStyles();
  }, [isWeb]);

  if (!isWeb) return <>{children}</>;

  return (
    <View style={styles.page}>
      <View
        style={[styles.column, { maxWidth: wide ? COLUMN_WIDE : COLUMN_NARROW }]}
        {...({ dataSet: { apexframe: '' } } as any)}
      >
        <View style={styles.brandBar}>
          <Text style={styles.brand}>
            <Text style={styles.flag}>🏁 </Text>
            <Text style={styles.brandApex}>Apex</Text>
            <Text style={styles.brandLap}>Lap</Text>
          </Text>
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
  },
  column: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bg,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    // En react-native-web estas props se traducen a box-shadow.
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  body: { flex: 1 },
  brandBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  brand: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  flag: { fontSize: 16 },
  brandApex: { color: colors.text },
  brandLap: { color: colors.primary },
});
