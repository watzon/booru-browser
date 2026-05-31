import { Alert, Platform } from 'react-native';

import * as Haptics from 'expo-haptics';

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Promise-based wrapper around Alert.alert with destructive styling defaults.
 * Resolves true on confirm, false on cancel/dismiss.
 */
export function confirm({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOpts): Promise<boolean> {
  if (destructive && Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Prompt for a single string. Resolves the entered value, or null on cancel.
 * On Android falls back to Alert.alert with no input (returns null).
 */
export function prompt(title: string, message?: string, defaultValue?: string): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    // Alert.prompt is iOS-only. Caller should fall back to a custom modal.
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    Alert.prompt(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'OK', onPress: (value?: string) => resolve(value ?? '') },
      ],
      'plain-text',
      defaultValue,
    );
  });
}
