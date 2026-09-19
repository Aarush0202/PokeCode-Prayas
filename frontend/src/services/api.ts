import type {
  Zone,
  RiskLiveResponse,
  AlertsResponse,
  ForecastResponse,
  EventsResponse,
  VisionAnalyzeResponse,
} from '../types/crowdguard';
import {
  FIXTURE_ZONES,
  getMockLiveRisk,
  getMockAlerts,
  getMockForecast,
  getMockEvents,
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
    return await res.json();
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
