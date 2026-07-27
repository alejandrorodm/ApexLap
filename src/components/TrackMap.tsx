// Componente de mapa de circuito: dibuja la silueta del trazado mediante SVG
// o muestra la foto/imagen asignada al trazado si es un mapa personalizado o subido.
import React from 'react';
import { View, Image, StyleSheet, Text, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import { colors, radius } from '../theme';

interface TrackMapProps {
  track: string; // Nombre completo ("Monza · GP", "Spa-Francorchamps · GP"...)
  imageUrl?: string; // URL opcional de imagen/foto subida para el trazado
  size?: number; // Tamaño base del contenedor (ancho/alto)
  strokeWidth?: number; // Grosor de la línea del trazado
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}

// Ruta SVG simplificada y fiel de siluetas de circuitos populares (viewBox: 0 0 200 150)
const SVG_PATHS: Record<string, { path: string; startPoint?: { x: number; y: number } }> = {
  Monza: {
    // Trazado Monza: Recta principal, Chicana 1, Curva Grande, Lesmos, Ascari, Parabolica
    path: 'M 40,125 L 160,125 C 185,125 190,105 185,85 C 175,55 170,45 160,45 L 125,45 C 120,45 115,50 110,45 L 100,30 L 75,30 C 65,30 60,40 65,55 L 75,70 C 80,80 75,90 65,95 L 45,95 C 25,95 20,110 40,125 Z',
    startPoint: { x: 90, y: 125 },
  },
  'Spa-Francorchamps': {
    // Spa: La Source, Eau Rouge, Kemmel, Les Combes, Pouhon, Blanchimont, Bus Stop
    path: 'M 40,110 L 55,120 L 70,100 L 110,40 L 140,30 C 160,25 175,40 160,60 L 130,80 C 120,90 130,110 155,100 L 170,95 C 185,90 185,125 160,125 L 80,125 C 60,125 50,115 40,110 Z',
    startPoint: { x: 50, y: 115 },
  },
  Nürburgring: {
    // Nürburgring GP: Mercedes Arena, Schumacher S, Chicane
    path: 'M 45,115 L 115,115 C 130,115 145,100 135,80 C 125,60 145,50 165,60 L 175,65 C 185,70 190,50 170,35 L 120,35 C 95,35 90,55 75,55 L 55,55 C 35,55 30,75 45,85 L 60,95 L 45,115 Z',
    startPoint: { x: 75, y: 115 },
  },
  Silverstone: {
    // Silverstone GP: Abbey, Loop, Wellington, Maggotts-Becketts, Hangar, Stowe, Vale, Club
    path: 'M 50,120 L 100,120 C 115,120 120,105 110,95 L 90,85 C 80,75 90,60 110,60 L 150,60 C 175,60 185,45 165,30 L 120,30 C 90,30 75,45 60,45 L 35,45 C 20,45 20,70 35,80 L 50,90 C 60,100 40,110 50,120 Z',
    startPoint: { x: 70, y: 120 },
  },
  'Brands Hatch': {
    // Brands Hatch: Paddock Hill, Druids, Graham Hill, Cooper, Surtees, McLaren, Clark
    path: 'M 40,110 L 140,110 C 170,110 180,85 160,65 L 140,45 C 125,30 95,30 80,45 L 55,70 C 40,85 25,95 40,110 Z',
    startPoint: { x: 80, y: 110 },
  },
  'Barcelona-Catalunya': {
    // Catalunya: Recta, Elf, Repsol, Seat, Campsa, La Caixa, Chicane
    path: 'M 35,125 L 155,125 C 175,125 180,105 165,90 L 145,75 C 135,65 145,45 165,45 C 180,45 175,25 150,25 L 100,25 C 75,25 70,45 80,60 L 90,70 C 95,80 80,95 60,95 L 35,95 C 20,95 20,110 35,125 Z',
    startPoint: { x: 85, y: 125 },
  },
  'Red Bull Ring': {
    // Red Bull Ring: T1, Remus Hairpin, Schlossgold, Rindt, Red Bull Mobile
    path: 'M 40,115 L 155,115 C 175,115 180,95 160,80 L 80,30 C 65,20 45,35 60,55 L 110,80 L 55,80 C 35,80 25,95 40,115 Z',
    startPoint: { x: 90, y: 115 },
  },
  Imola: {
    // Imola: Tamburello, Villeneuve, Tosa, Piratella, Acque Minerali, Alta, Rivazza
    path: 'M 40,120 L 130,120 C 150,120 170,110 160,85 L 140,60 C 130,45 145,30 165,30 C 180,30 175,15 145,15 L 90,15 C 65,15 60,40 75,55 L 85,65 C 90,75 70,90 50,90 C 30,90 25,105 40,120 Z',
    startPoint: { x: 75, y: 120 },
  },
  Mugello: {
    // Mugello: San Donato, Luco, Poggio, Arrabbiata 1 & 2, Biondetti, Bucine
    path: 'M 35,120 L 150,120 C 175,120 185,95 165,75 L 145,55 C 130,40 135,25 155,25 C 175,25 165,10 135,10 L 85,10 C 60,10 50,35 65,55 L 80,70 C 90,85 70,100 45,100 C 25,100 20,110 35,120 Z',
    startPoint: { x: 80, y: 120 },
  },
  'Laguna Seca': {
    // Laguna Seca: Andretti Hairpin, Corkscrew, Rainey Curve
    path: 'M 50,115 L 130,115 C 155,115 165,95 150,75 L 135,55 C 120,35 140,25 160,35 L 170,40 C 185,45 185,25 165,15 L 115,15 C 90,15 80,35 90,55 L 60,55 C 40,55 35,75 50,85 L 65,95 L 50,115 Z',
    startPoint: { x: 80, y: 115 },
  },
  Zandvoort: {
    // Zandvoort: Tarzan, Hugenholtz, Scheivlak, Luyendyk
    path: 'M 40,115 L 145,115 C 170,115 180,90 160,70 L 135,45 C 120,30 95,30 80,45 L 60,65 C 45,80 30,90 45,115 Z',
    startPoint: { x: 80, y: 115 },
  },
  Vallelunga: {
    // Vallelunga: Curva Grande, Cimini, Campagnano, Soratte, Roma
    path: 'M 40,120 L 140,120 C 165,120 175,95 155,75 L 135,55 C 120,40 130,25 150,25 C 170,25 160,10 130,10 L 80,10 C 55,10 45,35 60,55 L 75,70 C 85,85 65,100 40,120 Z',
    startPoint: { x: 80, y: 120 },
  },
};

export default function TrackMap({
  track,
  imageUrl,
  size = 180,
  strokeWidth = 3.5,
  style,
}: TrackMapProps) {
  // Extrae el nombre del circuito ignorando el trazado ("Monza · GP" -> "Monza")
  const baseName = track ? track.split(' · ')[0].trim() : '';
  const svgData = SVG_PATHS[baseName] || SVG_PATHS[track];

  if (imageUrl) {
    return (
      <View style={[styles.container, { width: size, height: size * 0.75 }, style]}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
      </View>
    );
  }

  if (!svgData) {
    // Si no hay SVG ni imagen personalizada, se muestra un gráfico por defecto generativo
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
            opacity={0.8}
          />
          <Circle cx="80" cy="110" r="4" fill={colors.primary} />
        </Svg>
        <Text style={styles.fallbackLabel}>{track}</Text>
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
    padding: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
  },
  fallbackLabel: {
    position: 'absolute',
    bottom: 6,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
