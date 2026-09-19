export type RiskTier = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'no_data' | 'NO_DATA';

export type VenueCategory =
  | 'market'
  | 'transit_hub'
  | 'religious_site'
  | 'campus_ground'
  | 'food_street'
  | 'public_square';

export interface Zone {
  id: string;
  name: string;
  capacity: number;
  area_sqm: number;
  lat: number;
  lon: number;
  category?: VenueCategory | string;
  city?: string;
}

export interface ZonesResponse {
  count: number;
  zones: Zone[];
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
  level?: RiskTier;
  fused_estimate: number;
  occupancy?: number;
  capacity: number;
  vision: VisionSignal | null;
  beacon: BeaconSignal | null;
  forecast_pressure: number;
  reasons: string[];
  has_live_signals?: boolean;
  signal_status?: 'ok' | 'stale' | 'none';
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

export interface CategoryMetric {
  mae_pct_capacity: number;
  n_places: number;
}

export interface ForecastMetricsResponse {
  generated_at: string;
  n_train_venues: number;
  evaluation: string;
  disclaimer: string;
  overall_mae_pct_capacity: number;
  baseline_mae_pct_capacity: {
    global_mean: number;
    category_hour_mean: number;
  };
  by_category: Record<string, CategoryMetric>;
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
  source: 'seed' | 'assumed' | 'synthetic' | 'real' | string;
  zone_id?: string | null;
  is_illustrative?: boolean;
}

export type PlannerEventType =
  | 'concert'
  | 'sports_match'
  | 'rally'
  | 'festival'
  | 'religious_gathering'
  | 'other';

export type PlannerDrawLevel = 'normal' | 'high' | 'very_high';

export type PlannerVerdict = 'feasible' | 'feasible_with_mitigations' | 'not_recommended';

export interface PlannerAssessRequest {
  zone_id: string;
  start_time: string;
  duration_hours: number;
  event_type: PlannerEventType | string;
  expected_attendance: number;
  draw_level?: PlannerDrawLevel | string;
}

export interface PlannerAssessResponse {
  zone: {
    id: string;
    name: string;
    city: string;
    category: string;
    capacity: number;
    area_sqm: number;
  };
  verdict: PlannerVerdict;
  peak: {
    time: string;
    total_present: number;
    occupancy_ratio: number;
    density_per_sqm: number;
  };
  scenarios: Array<{
    label: string;
    attendance: number;
    peak_ratio: number;
    verdict: string;
  }>;
  timeline: Array<{
    time: string;
    baseline: number;
    event: number;
    total: number;
    ratio: number;
  }>;
  reasons: string[];
  mitigations: string[];
  alternatives: Array<{
    zone_id: string;
    name: string;
    peak_ratio: number;
    verdict: string;
  }>;
  assumptions: string[];
  disclaimer: string;
}

export interface PlannerParseRequest {
  text: string;
}

export interface PlannerParseResponse {
  fields: {
    zone_id?: string | null;
    start_time?: string | null;
    duration_hours?: number | null;
    event_type?: string | null;
    expected_attendance?: number | null;
    draw_level?: string | null;
  };
  missing: string[];
  matched_by: 'llm' | 'rules' | string;
  note: string;
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
