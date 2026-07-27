// Componente de mapa de circuito: dibuja la silueta fiel del trazado mediante SVG
// o muestra la foto/imagen asignada al trazado si es un mapa personalizado o subido.
import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Text, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import { colors, radius } from '../theme';

interface TrackMapProps {
  track: string; // Nombre completo ("Monza · GP", "Silverstone · GP", "Nordschleife..."...)
  imageUrl?: string; // URL opcional de imagen/foto subida para el trazado
  size?: number; // Tamaño base del contenedor (ancho/alto)
  strokeWidth?: number; // Grosor de la línea del trazado
  style?: StyleProp<ViewStyle>;
}

interface SvgLayout {
  path: string;
  startPoint?: { x: number; y: number };
}

// Mapas vectoriales precisos de los circuitos (viewBox: 0 0 200 150)
const SVG_CATALOG: { keywords: string[]; layout: SvgLayout }[] = [
  {
    // Monza
    keywords: ['monza'],
    layout: {
      path: 'M 40,125 L 165,125 C 185,125 190,105 180,85 L 165,50 L 140,50 L 135,58 L 125,58 L 120,40 L 95,40 C 85,40 80,55 90,70 L 95,78 L 75,82 C 60,85 45,95 40,125 Z',
      startPoint: { x: 95, y: 125 },
    },
  },
  {
    // Spa-Francorchamps
    keywords: ['spa', 'francorchamps'],
    layout: {
      path: 'M 45,115 L 58,125 L 72,100 L 105,45 C 115,30 135,25 155,35 C 170,45 160,65 140,75 L 125,85 C 115,95 125,115 150,105 L 168,98 C 185,92 185,122 160,122 L 85,122 C 65,122 55,110 45,115 Z',
      startPoint: { x: 52, y: 120 },
    },
  },
  {
    // Nürburgring Nordschleife & GP
    keywords: ['nurburgring', 'nordschleife', 'touristenfahrten', 'green hell'],
    layout: {
      path: 'M 45,115 L 105,115 C 120,115 135,100 130,75 L 145,45 C 160,25 180,30 185,55 C 190,80 170,95 160,100 L 140,105 C 125,110 110,95 95,95 L 75,95 C 55,95 35,80 30,55 C 25,30 50,25 75,25 C 95,25 110,40 100,55 L 70,55 C 50,55 45,75 55,85 L 68,95 L 45,115 Z',
      startPoint: { x: 75, y: 115 },
    },
  },
  {
    // Silverstone
    keywords: ['silverstone'],
    layout: {
      path: 'M 50,125 L 110,125 C 125,125 135,110 120,95 L 100,80 C 90,70 100,55 120,55 L 155,55 C 175,55 185,38 165,25 L 115,25 C 85,25 70,42 55,42 L 32,42 C 15,42 15,68 32,78 L 50,88 C 62,98 42,112 50,125 Z',
      startPoint: { x: 75, y: 125 },
    },
  },
  {
    // Brands Hatch
    keywords: ['brands', 'hatch'],
    layout: {
      path: 'M 40,110 L 145,110 C 175,110 185,85 165,60 L 145,40 C 125,25 90,25 75,40 L 52,65 C 38,80 25,95 40,110 Z',
      startPoint: { x: 85, y: 110 },
    },
  },
  {
    // Barcelona-Catalunya
    keywords: ['barcelona', 'catalunya'],
    layout: {
      path: 'M 35,125 L 155,125 C 175,125 180,105 165,90 L 145,75 C 135,65 145,45 165,45 C 180,45 175,25 150,25 L 100,25 C 75,25 70,45 80,60 L 90,70 C 95,80 80,95 60,95 L 35,95 C 20,95 20,110 35,125 Z',
      startPoint: { x: 85, y: 125 },
    },
  },
  {
    // Red Bull Ring
    keywords: ['red bull', 'spielberg', 'oesterreichring'],
    layout: {
      path: 'M 40,118 L 158,118 C 178,118 182,98 162,82 L 82,28 C 66,18 45,34 60,54 L 112,80 L 58,80 C 38,80 26,96 40,118 Z',
      startPoint: { x: 92, y: 118 },
    },
  },
  {
    // Imola
    keywords: ['imola'],
    layout: {
      path: 'M 40,120 L 130,120 C 150,120 170,110 160,85 L 140,60 C 130,45 145,30 165,30 C 180,30 175,15 145,15 L 90,15 C 65,15 60,40 75,55 L 85,65 C 90,75 70,90 50,90 C 30,90 25,105 40,120 Z',
      startPoint: { x: 75, y: 120 },
    },
  },
  {
    // Mugello
    keywords: ['mugello'],
    layout: {
      path: 'M 35,120 L 150,120 C 175,120 185,95 165,75 L 145,55 C 130,40 135,25 155,25 C 175,25 165,10 135,10 L 85,10 C 60,10 50,35 65,55 L 80,70 C 90,85 70,100 45,100 C 25,100 20,110 35,120 Z',
      startPoint: { x: 80, y: 120 },
    },
  },
  {
    // Laguna Seca
    keywords: ['laguna', 'seca'],
    layout: {
      path: 'M 50,115 L 130,115 C 155,115 165,95 150,75 L 135,55 C 120,35 140,25 160,35 L 170,40 C 185,45 185,25 165,15 L 115,15 C 90,15 80,35 90,55 L 60,55 C 40,55 35,75 50,85 L 65,95 L 50,115 Z',
      startPoint: { x: 80, y: 115 },
    },
  },
  {
    // Zandvoort
    keywords: ['zandvoort'],
    layout: {
      path: 'M 40,115 L 145,115 C 170,115 180,90 160,70 L 135,45 C 120,30 95,30 80,45 L 60,65 C 45,80 30,90 45,115 Z',
      startPoint: { x: 80, y: 115 },
    },
  },
  {
    // Vallelunga
    keywords: ['vallelunga'],
    layout: {
      path: 'M 40,120 L 140,120 C 165,120 175,95 155,75 L 135,55 C 120,40 130,25 150,25 C 170,25 160,10 130,10 L 80,10 C 55,10 45,35 60,55 L 75,70 C 85,85 65,100 40,120 Z',
      startPoint: { x: 80, y: 120 },
    },
  },
  {
    // Drift Track / Donut
    keywords: ['drift', 'playground'],
    layout: {
      path: 'M 100,30 C 145,30 170,55 170,75 C 170,100 145,120 100,120 C 55,120 30,100 30,75 C 30,55 55,30 100,30 Z M 100,55 C 75,55 60,65 60,75 C 60,85 75,95 100,95 C 125,95 140,85 140,75 C 140,65 125,55 100,55 Z',
      startPoint: { x: 100, y: 120 },
    },
  },
  {
    // Mount Akina / Tajo / Hillclimb / Mountain
    keywords: ['akina', 'tajo', 'mount', 'hillclimb', 'touge', 'trento'],
    layout: {
      path: 'M 35,25 L 165,25 L 165,45 L 35,45 L 35,65 L 165,65 L 165,85 L 35,85 L 35,105 L 165,105 L 165,125 L 35,125',
      startPoint: { x: 35, y: 25 },
    },
  },
];

function findLayout(trackName: string): SvgLayout | undefined {
  if (!trackName) return undefined;
  const norm = trackName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const item of SVG_CATALOG) {
    if (item.keywords.some((kw) => norm.includes(kw))) {
      return item.layout;
    }
  }
  return undefined;
}

export default function TrackMap({
  track,
  imageUrl,
  size = 180,
  strokeWidth = 3.5,
  style,
}: TrackMapProps) {
  const svgData = useMemo(() => findLayout(track), [track]);

  if (imageUrl) {
    return (
      <View style={[styles.container, { width: size, height: size * 0.75 }, style]}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
      </View>
    );
  }

  if (!svgData) {
    // Si no hay SVG específico ni foto subida, dibujamos un circuito dinámico estilizado
    return (
      <View style={[styles.container, { width: size, height: size * 0.75 }, style]}>
        <Svg width="100%" height="100%" viewBox="0 0 200 150">
          <Path
            d="M 40,110 L 150,110 C 175,110 180,85 160,65 L 130,45 C 110,30 90,30 75,45 L 50,70 C 35,85 25,95 40,110 Z"
            fill="none"
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
          <Circle cx="80" cy="110" r="4.5" fill={colors.primary} />
        </Svg>
        <Text style={styles.fallbackLabel} numberOfLines={1}>{track}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size * 0.75 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 200 150">
        <G>
          {/* Brillo exterior de la pista */}
          <Path
            d={svgData.path}
            fill="none"
            stroke={colors.accent}
            strokeWidth={strokeWidth + 4}
            opacity={0.15}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Trazo principal del circuito */}
          <Path
            d={svgData.path}
            fill="none"
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Línea de Meta / Salida */}
          {svgData.startPoint && (
            <>
              <Circle
                cx={svgData.startPoint.x}
                cy={svgData.startPoint.y}
                r="4.5"
                fill={colors.primary}
              />
              <Line
                x1={svgData.startPoint.x}
                y1={svgData.startPoint.y - 6}
                x2={svgData.startPoint.x}
                y2={svgData.startPoint.y + 6}
                stroke={colors.text}
                strokeWidth="2"
              />
            </>
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 24, 33, 0.6)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
  },
  fallbackLabel: {
    position: 'absolute',
    bottom: 4,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
});
