// Marco SOLO para web: encaja la app en una columna centrada (aspecto de app
// móvil) sobre un fondo inmersivo de carrera, añade una cabecera con el branding
// y aplica estilos globales (fuente, scrollbar oscura, hover/cursor, fundido).
// En nativo (iOS/Android) devuelve los hijos tal cual: no cambia nada.
import React, { useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import { useIsWideWeb } from '../responsive';

const COLUMN_NARROW = 560; // móvil / ventana estrecha (en ancho: pantalla completa)

const GLOBAL_CSS = `
:root { color-scheme: dark; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  background:
    radial-gradient(820px 460px at 50% -6%, rgba(255,30,20,0.14), transparent 60%),
    repeating-linear-gradient(115deg, rgba(255,255,255,0.016) 0 2px, transparent 2px 28px),
    radial-gradient(1200px 760px at 50% 0%, #14161E 0%, ${colors.bgDeep} 60%),
    ${colors.bgDeep};
  background-attachment: fixed;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: ${colors.borderHi}; background-clip: padding-box; }
::-webkit-scrollbar-track { background: transparent; }
/* Botones y pulsables: cursor, transición y feedback al pasar/pulsar. */
[role="button"] {
  cursor: pointer;
  transition: transform .12s ease, filter .12s ease, opacity .12s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease;
}
[role="button"]:hover { filter: brightness(1.11); transform: translateY(-1px); }
[role="button"]:active { transform: translateY(1px) scale(0.997); filter: brightness(1.02); }
/* Fundido de entrada del marco. */
@keyframes apexFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
[data-apexframe] { animation: apexFadeIn .35s ease both; }
/* Entrada de tarjetas/filas: suben y aparecen. */
@keyframes apexRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
[data-anim="rise"] { animation: apexRise .34s cubic-bezier(.2,.7,.3,1) both; }
/* Pulso de "en directo" para piques abiertos / elementos calientes. */
@keyframes apexPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,30,20,0.0); }
  50% { box-shadow: 0 0 16px 1px rgba(255,30,20,0.40); }
}
[data-anim="pulse"] { animation: apexPulse 1.8s ease-in-out infinite; }
/* Punto "live" parpadeante. */
@keyframes apexBlink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
[data-anim="blink"] { animation: apexBlink 1.3s ease-in-out infinite; }
/* Brillo que recorre el branding. */
@keyframes apexSheen { 0% { background-position: -120% 0; } 100% { background-position: 220% 0; } }
`;

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Orbitron:wght@600;700;800;900&display=swap';

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

function Stripes() {
  return (
    <View style={styles.stripes}>
      <View style={[styles.stripe, { width: 26, backgroundColor: colors.primary }]} />
      <View style={[styles.stripe, { width: 16, backgroundColor: colors.accent }]} />
      <View style={[styles.stripe, { width: 9, backgroundColor: colors.text }]} />
    </View>
  );
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
        style={[
          styles.column,
          // En portátil/escritorio: a PANTALLA COMPLETA (sin límite de ancho).
          // En ventana estrecha/móvil: columna centrada tipo app.
          { maxWidth: wide ? undefined : COLUMN_NARROW },
        ]}
        {...({ dataSet: { apexframe: '' } } as any)}
      >
        {/* Línea de acento superior (rojo→amarillo) tipo banda de meta. */}
        <View style={styles.accentLine}>
          <View style={[styles.accentSeg, { flex: 3, backgroundColor: colors.primary }]} />
          <View style={[styles.accentSeg, { flex: 1, backgroundColor: colors.accent }]} />
        </View>

        <View style={styles.brandBar}>
          <Stripes />
          <Text style={styles.brand}>
            <Text style={styles.flag}>🏁 </Text>
            <Text style={styles.brandApex}>APEX</Text>
            <Text style={styles.brandLap}>LAP</Text>
          </Text>
          <View style={styles.brandRight}>
            <Text style={styles.tagline}>LEAGUE · RACING</Text>
          </View>
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
    backgroundColor: 'transparent', // deja ver el fondo inmersivo del body
  },
  column: {
    flex: 1,
    width: '100%',
    // Transparente: el degradado inmersivo del body ocupa toda la pantalla y se
    // ve de forma continua detrás del contenido (no como una "caja" centrada).
    backgroundColor: 'transparent',
  },
  accentLine: { height: 3, flexDirection: 'row' },
  accentSeg: { height: 3 },
  body: { flex: 1 },
  brandBar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'transparent',
  },
  brand: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  flag: { fontSize: 16 },
  brandApex: { color: colors.text },
  brandLap: { color: colors.primary },
  brandRight: { minWidth: 70, alignItems: 'flex-end' },
  tagline: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: 'Orbitron, sans-serif',
  },
  stripes: { flexDirection: 'row', gap: 4, minWidth: 70, alignItems: 'center' },
  stripe: { height: 5, borderRadius: 2 },
});
