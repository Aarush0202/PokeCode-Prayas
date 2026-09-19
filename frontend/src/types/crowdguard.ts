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
