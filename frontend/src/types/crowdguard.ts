export type RiskTier = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface Zone {
  id: string;
  name: string;
  capacity: number;
  area_sqm: number;
  lat: number;
  lon: number;
}

export interface Flow {
  dx: number;
  dy: number;
  magnitude: number;
}

export interface VisionSignal {
  zone_id: string;
  timestamp: string;
  person_count: number;
  density_per_sqm: number;
  flow: Flow;
  confidence: number;
}

export interface VisionAnalyzeResponse extends VisionSignal {
  annotated_image_b64?: string | null;
  model_name: string;
  mocked: boolean;
}

export interface BeaconSignal {
  zone_id: string;
  timestamp: string;
  unique_devices: number;
  scanner_id: string;
}

export interface ZoneRisk {
  zone_id: string;
  zone_name: string;
  timestamp: string;
  risk_score: number;
  risk_tier: RiskTier;
  fused_estimate: number;
  capacity: number;
  vision: VisionSignal | null;
  beacon: BeaconSignal | null;
  forecast_pressure: number;
  reasons: string[];
}

export interface RiskLiveResponse {
  generated_at: string;
  zones: ZoneRisk[];
}

export interface Alert {
  id: string;
  zone_id: string;
  zone_name: string;
  tier: RiskTier;
  message: string;
  raised_at: string;
  risk_score: number;
}

export interface AlertsResponse {
  generated_at: string;
  alerts: Alert[];
}

export interface ForecastPoint {
  timestamp: string;
  predicted_count: number;
  predicted_density: number;
  risk_tier: RiskTier;
  drivers: string[];
}

export interface ForecastResponse {
  zone_id: string;
  zone_name: string;
  generated_at: string;
  horizon_hours: number;
  points: ForecastPoint[];
}

export interface EventItem {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  venue: string;
  lat?: number | null;
  lon?: number | null;
  category: string;
  expected_attendance: number;
  source: string;
  zone_id?: string | null;
}

export interface EventsResponse {
  generated_at: string;
  count: number;
  events: EventItem[];
}

export interface IncidentLogEntry {
  id: string;
  timestamp: string;
  zone_id: string;
  zone_name: string;
  tier: RiskTier;
  previous_tier?: RiskTier;
  driver: string;
  message?: string;
  risk_score: number;
}

export interface RiskScoreBreakdown {
  densityScore: number;
  densityWeight: number;
  densityContribution: number;
  divergenceScore: number;
  divergenceWeight: number;
  divergenceContribution: number;
  forecastScore: number;
  forecastWeight: number;
  forecastContribution: number;
  totalScore: number;
}

export function calculateRiskBreakdown(zone: ZoneRisk): RiskScoreBreakdown {
  const occRatio = Math.min(1.2, zone.fused_estimate / Math.max(1, zone.capacity));
  const densityNormalized = Math.round(Math.min(100, occRatio * 100));

  const cameraCount = zone.vision?.person_count ?? zone.fused_estimate;
  const bleCount = zone.beacon?.unique_devices ?? zone.fused_estimate;
  const discrepancy = Math.abs(bleCount - cameraCount);
  const discrepancyRatio = Math.min(1, discrepancy / Math.max(1, zone.capacity * 0.4));
  const divergenceNormalized = Math.round(discrepancyRatio * 100);

  const forecastNormalized = Math.round(Math.min(100, (zone.forecast_pressure || 0.25) * 100));

  // Weights: 50% density + 30% BLE delta + 20% forecast proximity
  const densityContribution = Math.round(densityNormalized * 0.50);
  const divergenceContribution = Math.round(divergenceNormalized * 0.30);
  const forecastContribution = Math.round(forecastNormalized * 0.20);
  const totalScore = Math.min(100, densityContribution + divergenceContribution + forecastContribution);

  return {
    densityScore: densityNormalized,
    densityWeight: 0.50,
    densityContribution,
    divergenceScore: divergenceNormalized,
    divergenceWeight: 0.30,
    divergenceContribution,
    forecastScore: forecastNormalized,
    forecastWeight: 0.20,
    forecastContribution,
    totalScore,
  };
}
