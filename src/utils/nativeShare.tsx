// Compartir la share card como IMAGEN en nativo (Android/iOS).
//   1) Un host invisible (ShareCardHost) montado en la app guarda la tarjeta a
//      compartir y la renderiza fuera de pantalla.
//   2) shareCardNative pide al host que pinte la tarjeta, la captura con
//      react-native-view-shot y la comparte con expo-sharing.
// Si la captura o el compartir fallan, cae a compartir texto.
import React, { useEffect, useRef, useState } from 'react';
import { View, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import ShareCardView, { CARD_W, CARD_H } from '../components/ShareCardView';
import { ShareCard, shareCardText } from './shareTypes';

// Puente entre la función imperativa y el componente montado.
let setHostCard: ((c: ShareCard | null) => void) | null = null;
let captureHost: (() => Promise<string | null>) | null = null;

export function ShareCardHost() {
  const [card, setCard] = useState<ShareCard | null>(null);
  const ref = useRef<View>(null);

  useEffect(() => {
    setHostCard = setCard;
    captureHost = async () => {
      if (!ref.current) return null;
      try {
        return await captureRef(ref, { format: 'png', quality: 1 });
      } catch {
        return null;
      }
    };
    return () => {
      setHostCard = null;
      captureHost = null;
    };
  }, []);

  if (!card) return null;
  // Fuera de pantalla pero renderizado y medido: view-shot puede capturarlo.
  return (
    <View
      style={{ position: 'absolute', left: -9999, top: 0, width: CARD_W, height: CARD_H }}
      collapsable={false}
      pointerEvents="none"
    >
      <View ref={ref} collapsable={false}>
        <ShareCardView card={card} />
      </View>
    </View>
  );
}

async function shareText(c: ShareCard) {
  try {
    await Share.share({ message: shareCardText(c) });
  } catch {
    /* cancelado */
  }
}

export async function shareCardNative(c: ShareCard): Promise<void> {
  if (!setHostCard || !captureHost) {
    await shareText(c);
    return;
  }
  setHostCard(c);
  // Deja un frame para que monte y mida antes de capturar.
  await new Promise((r) => setTimeout(r, 90));
  const uri = await captureHost();
  setHostCard(null);

  if (!uri) {
    await shareText(c);
    return;
  }
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir tarjeta',
      });
    } else {
      await shareText(c);
    }
  } catch {
    /* el usuario canceló la hoja de compartir */
  }
}
