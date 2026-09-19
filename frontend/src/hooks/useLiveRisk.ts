import { useState, useEffect, useRef, useCallback } from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { getLiveRisk, isDegraded } from '../services/api';

export interface UseLiveRiskReturn {
  zones: ZoneRisk[];
  loading: boolean;
  degraded: boolean;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

export function useLiveRisk(pollIntervalMs: number = 3000): UseLiveRiskReturn {
  const [zones, setZones] = useState<ZoneRisk[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [degraded, setDegradedState] = useState<boolean>(isDegraded());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inFlightRef = useRef<boolean>(false);

  const fetchRisk = useCallback(async () => {
    if (inFlightRef.current) {
      return; // Skip poll if previous is still in flight
    }

    inFlightRef.current = true;
    try {
      const data = await getLiveRisk();
      setZones(data.zones);
      setLastUpdated(new Date());
      setDegradedState(isDegraded());
    } catch (err) {
      console.error('[useLiveRisk] Poll error:', err);
      setDegradedState(true);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Initial fetch
    fetchRisk();

    const intervalId = setInterval(() => {
      if (isMounted) {
        fetchRisk();
      }
    }, pollIntervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [fetchRisk, pollIntervalMs]);

  return {
    zones,
    loading,
    degraded,
    lastUpdated,
    refetch: fetchRisk,
  };
}
