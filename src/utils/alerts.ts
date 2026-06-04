// Alertas multiplataforma.
// OJO: en react-native-web `Alert.alert` NO hace nada (no está implementado),
// así que en web caemos a window.alert / window.confirm.
import { Alert, Platform } from 'react-native';

/** Mensaje informativo simple. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/** Confirmación sí/no. Devuelve true si el usuario acepta. */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const {
    title,
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    destructive,
  } = opts;

  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
