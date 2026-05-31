import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: NetInfoState['type'] | 'unknown';
};

/**
 * Live network status. `isConnected` is the AND of NetInfo's `isConnected` and
 * a non-false `isInternetReachable` (null means undetermined — we treat that
 * as "probably online" to avoid false negatives).
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    type: 'unknown',
  });

  useEffect(() => {
    let mounted = true;
    const apply = (s: NetInfoState) => {
      if (!mounted) return;
      const reachable = s.isInternetReachable;
      const connected = !!s.isConnected && reachable !== false;
      setStatus({
        isConnected: connected,
        isInternetReachable: reachable,
        type: s.type ?? 'unknown',
      });
    };
    NetInfo.fetch().then(apply).catch(() => {});
    const unsub = NetInfo.addEventListener(apply);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return status;
}
