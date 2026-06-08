// Gráfica de evolución de tiempos de un combo coche+circuito. Línea de tiempos
// por vuelta (cronológica) + línea escalonada del mejor acumulado (PB), con el
// PB resaltado. Funciona en web y nativo vía react-native-svg.
import React from 'react';
import { View } from 'react-native';
import Svg, {
  Polyline,
  Line,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../theme';
import { formatTime } from '../utils/time';
import { ProgressPoint } from '../utils/leaderboard';

const PADL = 16; // margen izq
const PADR = 16; // margen dcho
const PADT = 18; // margen sup
const PADB = 26; // margen inf (fechas/etiquetas)

export default function ProgressChart({
  points,
  width,
  height = 230,
}: {
  points: ProgressPoint[];
  width: number;
  height?: number;
}) {
  if (width <= 0 || points.length < 2) return <View style={{ height }} />;

  const innerW = width - PADL - PADR;
  const innerH = height - PADT - PADB;

  const times = points.map((p) => p.timeMs);
  let minT = Math.min(...times);
  let maxT = Math.max(...times);
  if (maxT === minT) {
    // Todas iguales: abre un pequeño rango para que se vea la línea centrada.
    maxT = minT + 1000;
    minT = minT - 1000;
  }
  const range = maxT - minT;

  // Más rápido (menor tiempo) ABAJO → la línea baja según mejoras.
  const x = (i: number) => PADL + (i / (points.length - 1)) * innerW;
  const y = (t: number) => PADT + ((maxT - t) / range) * innerH;

  const lineCoords = points.map((p, i) => `${x(i)},${y(p.timeMs)}`).join(' ');
  const bestCoords = points.map((p, i) => `${x(i)},${y(p.runningBest)}`).join(' ');

  const pbY = y(Math.min(...points.map((p) => p.runningBest)));

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Rejilla horizontal sutil (3 líneas) */}
        {[0, 0.5, 1].map((f) => {
          const gy = PADT + f * innerH;
          return (
            <Line
              key={f}
              x1={PADL}
              y1={gy}
              x2={PADL + innerW}
              y2={gy}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}

        {/* Línea del PB (mejor absoluto) */}
        <Line
          x1={PADL}
          y1={pbY}
          x2={PADL + innerW}
          y2={pbY}
          stroke={colors.gold}
          strokeWidth={1}
          strokeDasharray="5 5"
          opacity={0.7}
        />

        {/* Mejor acumulado (escalón descendente) */}
        <Polyline
          points={bestCoords}
          fill="none"
          stroke={colors.gold}
          strokeWidth={2}
          strokeOpacity={0.5}
        />

        {/* Tiempos por vuelta */}
        <Polyline
          points={lineCoords}
          fill="none"
          stroke={colors.primary}
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {/* Puntos: PB en oro, resto en rojo */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={x(i)}
            cy={y(p.timeMs)}
            r={p.isPB ? 5 : 3.5}
            fill={p.isPB ? colors.gold : colors.primary}
            stroke={colors.bgScreen}
            strokeWidth={1.5}
          />
        ))}

        {/* Etiquetas de tiempo: más rápido (abajo) y más lento (arriba) */}
        <SvgText x={PADL} y={PADT - 4} fill={colors.textFaint} fontSize={11} fontWeight="700">
          {formatTime(maxT)}
        </SvgText>
        <SvgText x={PADL} y={PADT + innerH + 14} fill={colors.gold} fontSize={11} fontWeight="800">
          PB {formatTime(Math.min(...points.map((p) => p.runningBest)))}
        </SvgText>
      </Svg>
    </View>
  );
}
