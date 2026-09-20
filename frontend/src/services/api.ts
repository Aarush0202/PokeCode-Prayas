import type {
  Zone,
  RiskLiveResponse,
  AlertsResponse,
  ForecastResponse,
  EventsResponse,
  VisionAnalyzeResponse,
  ForecastMetricsResponse,
  PlannerAssessRequest,
  PlannerAssessResponse,
  PlannerParseResponse,
  BeaconSignal,
  VisionSignal,
  MetroOverviewResponse,
} from '../types/crowdguard';
import {
  FIXTURE_ZONES,
  getMockLiveRisk,
  getMockAlerts,
  getMockForecast,
  getMockEvents,
  getMockForecastMetrics,
  getMockPlannerAssess,
  getMockPlannerParse,
  getMockMetroStatus,
  mockAnalyzeFrame,
  mockSimulateVision,
  mockIngestBeacon,
  mockDeescalateZone,
  mockResetAllZones,
} from '../mocks/fixtures';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
export const MOCK = import.meta.env.VITE_MOCK === '1';

let degradedMode = MOCK;

export function isDegraded(): boolean {
  return degradedMode;
}

export function setDegraded(val: boolean): void {
  degradedMode = val;
}

const DEFAULT_TIMEOUT_MS = 6000;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function getZones(): Promise<Zone[]> {
  if (MOCK) {
    await delay(120);
    return FIXTURE_ZONES;
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/zones`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.zones)) return data.zones;
    return FIXTURE_ZONES;
  } catch (err) {
    console.warn('[CrowdGuard API] getZones failed, falling back to fixtures:', err);
    degradedMode = true;
    return FIXTURE_ZONES;
  }
}

export async function getLiveRisk(): Promise<RiskLiveResponse> {
  if (MOCK) {
    await delay(150);
    return getMockLiveRisk();
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/risk/live`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] getLiveRisk failed, falling back to mock tick:', err);
    degradedMode = true;
    return getMockLiveRisk();
  }
}

export async function getAlerts(): Promise<AlertsResponse> {
  if (MOCK) {
    await delay(100);
    return getMockAlerts();
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/risk/alerts`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] getAlerts failed, falling back to fixtures:', err);
    degradedMode = true;
    return getMockAlerts();
  }
}

export async function getForecast(zoneId: string, hours: number = 48): Promise<ForecastResponse> {
  if (MOCK) {
    await delay(150);
    return getMockForecast(zoneId, hours);
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/forecast/${zoneId}?hours=${hours}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    return await res.json();
  } catch (err) {
    console.warn(`[CrowdGuard API] getForecast(${zoneId}) failed, falling back to fixtures:`, err);
    degradedMode = true;
    return getMockForecast(zoneId, hours);
  }
}

export async function getEvents(hours: number = 48): Promise<EventsResponse> {
  if (MOCK) {
    await delay(120);
    return getMockEvents(hours);
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/events/nearby?hours=${hours}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] getEvents failed, falling back to fixtures:', err);
    degradedMode = true;
    return getMockEvents(hours);
  }
}

export async function analyzeFrame(file: File, zoneId: string): Promise<VisionAnalyzeResponse> {
  if (MOCK) {
    await delay(350);
    return mockAnalyzeFrame(zoneId, file);
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('zone_id', zoneId);

    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/vision/analyze`, {
      method: 'POST',
      body: formData,
    }, 12000); // Allow slightly more timeout for model inference

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] analyzeFrame failed, using local mock response:', err);
    degradedMode = true;
    return mockAnalyzeFrame(zoneId, file);
  }
}

export async function simulateVision(zoneId: string, count: number): Promise<{ success: boolean }> {
  if (MOCK) {
    await delay(100);
    mockSimulateVision(zoneId, count);
    return { success: true };
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/vision/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: zoneId, person_count: count }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] simulateVision failed, applying to local mock state:', err);
    mockSimulateVision(zoneId, count);
    return { success: true };
  }
}

export async function ingestBeacon(zoneId: string, devices: number): Promise<{ success: boolean }> {
  if (MOCK) {
    await delay(100);
    mockIngestBeacon(zoneId, devices);
    return { success: true };
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/beacons/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: zoneId, unique_devices: devices }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] ingestBeacon failed, applying to local mock state:', err);
    mockIngestBeacon(zoneId, devices);
    return { success: true };
  }
}

export async function deescalateZone(zoneId: string, count?: number): Promise<{ success: boolean }> {
  mockDeescalateZone(zoneId, count);
  return { success: true };
}

export async function resetAllZones(): Promise<{ success: boolean }> {
  mockResetAllZones();
  return { success: true };
}

export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'unreachable';
  latencyMs: number;
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  if (MOCK) {
    return { status: 'healthy', latencyMs: 14 };
  }

  const start = performance.now();
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/health`, {}, 3000);
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      return { status: degradedMode ? 'degraded' : 'healthy', latencyMs };
    }
    return { status: 'degraded', latencyMs };
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return { status: 'unreachable', latencyMs };
  }
}

export async function getForecastMetrics(): Promise<ForecastMetricsResponse | null> {
  if (MOCK) {
    await delay(120);
    return getMockForecastMetrics();
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/forecast/metrics`);
    if (!res.ok) {
      return getMockForecastMetrics();
    }
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] getForecastMetrics failed, falling back to mock metrics:', err);
    return getMockForecastMetrics();
  }
}

export async function assessEvent(req: PlannerAssessRequest): Promise<PlannerAssessResponse> {
  if (MOCK) {
    await delay(250);
    return getMockPlannerAssess(req);
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/planner/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] assessEvent failed, using mock engine:', err);
    degradedMode = true;
    return getMockPlannerAssess(req);
  }
}

export async function parseEventText(text: string): Promise<PlannerParseResponse> {
  if (MOCK) {
    await delay(300);
    return getMockPlannerParse(text);
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/planner/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    degradedMode = false;
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] parseEventText failed, using local parser:', err);
    return getMockPlannerParse(text);
  }
}

export async function getLatestBeacon(zoneId: string): Promise<BeaconSignal | null> {
  if (MOCK) return null;
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/beacons/latest/${zoneId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getBeaconHistory(zoneId: string, limit: number = 50): Promise<BeaconSignal[]> {
  if (MOCK) return [];
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/beacons/history/${zoneId}?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.readings || [];
  } catch {
    return [];
  }
}

export async function getLatestVision(zoneId: string): Promise<VisionSignal | null> {
  if (MOCK) return null;
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/vision/latest/${zoneId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getVisionHistory(zoneId: string, limit: number = 50): Promise<VisionSignal[]> {
  if (MOCK) return [];
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/vision/history/${zoneId}?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.readings || [];
  } catch {
    return [];
  }
}

export async function getZonePressure(zoneId: string, windowHours: number = 3): Promise<{ pressure: number } | null> {
  if (MOCK) return { pressure: 0.35 };
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/forecast/${zoneId}/pressure?window_hours=${windowHours}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function refreshEvents(): Promise<{ success: boolean; refreshed: number }> {
  if (MOCK) return { success: true, refreshed: 4 };
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/events/refresh`, { method: 'POST' });
    if (!res.ok) return { success: false, refreshed: 0 };
    return await res.json();
  } catch {
    return { success: false, refreshed: 0 };
  }
}

export async function getMetroStatus(): Promise<MetroOverviewResponse> {
  if (MOCK) {
    await delay(150);
    return getMockMetroStatus();
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/metro/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[CrowdGuard API] getMetroStatus failed, falling back to mock fixtures:', err);
    return getMockMetroStatus();
  }
}



