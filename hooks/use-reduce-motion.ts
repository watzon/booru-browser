import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Live-tracking subscription to the system Reduce Motion setting.
 * Hooks into AccessibilityInfo and updates on change.
 */
export function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setEnabled(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
