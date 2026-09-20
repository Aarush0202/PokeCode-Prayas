import type {
  Zone,
  ZoneRisk,
  RiskTier,
  RiskLiveResponse,
  Alert,
  AlertsResponse,
  ForecastPoint,
  ForecastResponse,
  EventItem,
  EventsResponse,
  VisionAnalyzeResponse,
  ForecastMetricsResponse,
  PlannerAssessRequest,
  PlannerAssessResponse,
  PlannerParseResponse,
  PlannerVerdict,
  PlannerEventType,
  PlannerDrawLevel,
  MetroForecastPoint,
  MetroPredictionResponse,
} from '../types/crowdguard';

export const FIXTURE_ZONES: Zone[] = [
  // 4 Core Instrumented Zones with physical sensors
  {
    id: 'z1',
    name: 'Main Gate Plaza',
    capacity: 400,
    area_sqm: 500,
    lat: 30.7673,
    lon: 76.7821,
    category: 'public_square',
    city: 'Gurugram',
  },
  {
    id: 'z2',
    name: 'Metro Concourse',
    capacity: 600,
    area_sqm: 450,
    lat: 30.7681,
    lon: 76.7834,
    category: 'transit_hub',
    city: 'Gurugram',
  },
  {
    id: 'z3',
    name: 'Market Street',
    capacity: 900,
    area_sqm: 1200,
    lat: 30.7692,
    lon: 76.7845,
    category: 'market',
    city: 'Gurugram',
  },
  {
    id: 'z4',
    name: 'Food Court',
    capacity: 300,
    area_sqm: 350,
    lat: 30.7668,
    lon: 76.7812,
    category: 'food_street',
    city: 'Gurugram',
  },

  // Held-Out Named Places (Forecast only, no physical sensors)
  {
    id: 'ch01',
    name: 'Sector 17 Plaza',
    capacity: 8000,
    area_sqm: 10000,
    lat: 30.7398,
    lon: 76.7827,
    category: 'public_square',
    city: 'Chandigarh',
  },
  {
    id: 'ch02',
    name: 'Sukhna Lake Promenade',
    capacity: 5000,
    area_sqm: 7500,
    lat: 30.7421,
    lon: 76.8178,
    category: 'campus_ground',
    city: 'Chandigarh',
  },
  {
    id: 'ch03',
    name: 'Elante Mall Courtyard',
    capacity: 4500,
    area_sqm: 5500,
    lat: 30.7055,
    lon: 76.8013,
    category: 'market',
    city: 'Chandigarh',
  },
  {
    id: 'ch04',
    name: 'ISBT Sector 43 Hub',
    capacity: 6000,
    area_sqm: 7000,
    lat: 30.7225,
    lon: 76.7465,
    category: 'transit_hub',
    city: 'Chandigarh',
  },
  {
    id: 'ch05',
    name: 'Rock Garden Amphitheatre',
    capacity: 2500,
    area_sqm: 3200,
    lat: 30.7525,
    lon: 76.8066,
    category: 'campus_ground',
    city: 'Chandigarh',
  },
  {
    id: 'ch06',
    name: 'Sector 22 Shastri Market',
    capacity: 3500,
    area_sqm: 4000,
    lat: 30.7333,
    lon: 76.7725,
    category: 'food_street',
    city: 'Chandigarh',
  },
  {
    id: 'mo01',
    name: 'PCA Cricket Stadium Concourse',
    capacity: 15000,
    area_sqm: 20000,
    lat: 30.6908,
    lon: 76.7371,
    category: 'campus_ground',
    city: 'Mohali',
  },
  {
    id: 'mo02',
    name: 'Phase 7 Market Street',
    capacity: 2800,
    area_sqm: 3500,
    lat: 30.7092,
    lon: 76.7214,
    category: 'food_street',
    city: 'Mohali',
  },
  {
    id: 'mo03',
    name: 'Gurdwara Amb Sahib Precinct',
    capacity: 7000,
    area_sqm: 9000,
    lat: 30.6985,
    lon: 76.7289,
    category: 'religious_site',
    city: 'Mohali',
  },
  {
    id: 'mo04',
    name: 'Mohali Railway Terminus',
    capacity: 4000,
    area_sqm: 5000,
    lat: 30.6728,
    lon: 76.7388,
    category: 'transit_hub',
    city: 'Mohali',
  },
  {
    id: 'rl01',
    name: 'Chhatbir Zoo Entrance Esplanade',
    capacity: 3000,
    area_sqm: 4200,
    lat: 30.6015,
    lon: 76.8042,
    category: 'public_square',
    city: 'Mohali',
  },
  {
    id: 'rl02',
    name: 'Nada Sahib Gurdwara Ghat',
    capacity: 6500,
    area_sqm: 8000,
    lat: 30.6918,
    lon: 76.8773,
    category: 'religious_site',
    city: 'Panchkula',
  },
  {
    id: 'fs01',
    name: 'Chandigarh Night Food Street',
    capacity: 1500,
    area_sqm: 1800,
    lat: 30.7588,
    lon: 76.7682,
    category: 'food_street',
    city: 'Chandigarh',
  },
  {
    id: 'fs02',
    name: 'Sector 35 Food Corridor',
    capacity: 2000,
    area_sqm: 2200,
    lat: 30.7258,
    lon: 76.7635,
    category: 'food_street',
    city: 'Chandigarh',
  },
];

let liveZonesState: ZoneRisk[] = [
  {
    zone_id: 'z3',
    zone_name: 'Market Street',
    timestamp: new Date().toISOString(),
    risk_score: 0.84,
    risk_tier: 'HIGH',
    level: 'HIGH',
    fused_estimate: 782,
    capacity: 900,
    has_live_signals: true,
    signal_status: 'ok',
    vision: {
      zone_id: 'z3',
      timestamp: new Date().toISOString(),
      person_count: 590,
      density_per_sqm: 0.49,
      flow: { dx: 0.35, dy: 0.12, magnitude: 0.37 },
      confidence: 0.91,
    },
    beacon: {
      zone_id: 'z3',
      timestamp: new Date().toISOString(),
      unique_devices: 782,
      scanner_id: 'BLE-MKT-03',
    },
    forecast_pressure: 0.76,
    reasons: [
      'camera and Bluetooth counts disagree, using the higher estimate',
      'crowd building rapidly',
      'narrow corridor creates compression risk near north arcade',
    ],
  },
  {
    zone_id: 'z2',
    zone_name: 'Metro Concourse',
    timestamp: new Date().toISOString(),
    risk_score: 0.58,
    risk_tier: 'ELEVATED',
    level: 'ELEVATED',
    fused_estimate: 418,
    capacity: 600,
    has_live_signals: true,
    signal_status: 'ok',
    vision: {
      zone_id: 'z2',
      timestamp: new Date().toISOString(),
      person_count: 410,
      density_per_sqm: 0.91,
      flow: { dx: -0.15, dy: 0.42, magnitude: 0.45 },
      confidence: 0.94,
    },
    beacon: {
      zone_id: 'z2',
      timestamp: new Date().toISOString(),
      unique_devices: 418,
      scanner_id: 'BLE-MTR-02',
    },
    forecast_pressure: 0.62,
    reasons: [
      'continuous train disembarkation flow',
      'turnstile throughput approaching optimal limit',
    ],
  },
  {
    zone_id: 'z1',
    zone_name: 'Main Gate Plaza',
    timestamp: new Date().toISOString(),
    risk_score: 0.28,
    risk_tier: 'NORMAL',
    level: 'NORMAL',
    fused_estimate: 142,
    capacity: 400,
    has_live_signals: true,
    signal_status: 'ok',
    vision: {
      zone_id: 'z1',
      timestamp: new Date().toISOString(),
      person_count: 140,
      density_per_sqm: 0.28,
      flow: { dx: 0.05, dy: 0.08, magnitude: 0.09 },
      confidence: 0.96,
    },
    beacon: {
      zone_id: 'z1',
      timestamp: new Date().toISOString(),
      unique_devices: 142,
      scanner_id: 'BLE-GT-01',
    },
    forecast_pressure: 0.25,
    reasons: [
      'open pedestrian dispersal geometry',
      'entry queues clearing under 30 seconds',
    ],
  },
  {
    zone_id: 'z4',
    zone_name: 'Food Court',
    timestamp: new Date().toISOString(),
    risk_score: 0.0,
    risk_tier: 'no_data',
    level: 'no_data',
    fused_estimate: 0,
    capacity: 300,
    has_live_signals: true,
    signal_status: 'stale',
    vision: null,
    beacon: null,
    forecast_pressure: 0.3,
    reasons: [
      'Sensors offline (>120s without live telemetry)',
      'Awaiting gateway telemetry heartbeat reconnection',
    ],
  },
  {
    zone_id: 'ch01',
    zone_name: 'Sector 17 Plaza',
    timestamp: new Date().toISOString(),
    risk_score: 0.0,
    risk_tier: 'no_data',
    level: 'no_data',
    fused_estimate: 0,
    capacity: 8000,
    has_live_signals: false,
    signal_status: 'none',
    vision: null,
    beacon: null,
    forecast_pressure: 0.42,
    reasons: [
      'Forecast only. No live sensors at this location.',
      'Crowd risk modeled purely from synthetic training calendar.',
    ],
  },
];

let liveAlertsState: Alert[] = [
  {
    id: 'alt-301',
    zone_id: 'z3',
    zone_name: 'Market Street',
    tier: 'HIGH',
    message: 'Camera blind spot detected: Bluetooth headcount (782) exceeds camera visual count (590). Applying conservative upper bound.',
    raised_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    risk_score: 0.84,
  },
  {
    id: 'alt-z4-stale',
    zone_id: 'z4',
    zone_name: 'Food Court',
    tier: 'no_data',
    message: 'Food Court sensor telemetry offline (>120s without live feed).',
    raised_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    risk_score: 0.0,
  },
];

/**
 * Nudges live mock data on each poll to simulate active sensor telemetry
 */
export function makeLiveTick(): RiskLiveResponse {
  const now = new Date();
  liveZonesState = liveZonesState.map((z) => {
    // Preserve no_data and forecast-only zones without numerical noise
    if (
      z.level === 'no_data' ||
      z.risk_tier === 'no_data' ||
      z.signal_status === 'stale' ||
      z.signal_status === 'none' ||
      z.has_live_signals === false
    ) {
      return {
        ...z,
        timestamp: now.toISOString(),
        fused_estimate: 0,
        risk_score: 0.0,
        risk_tier: 'no_data',
        level: 'no_data',
      };
    }

    // Subtle realistic wobble for instrumented active zones
    const deltaPersons = Math.floor(Math.random() * 7) - 3;
    const nextEstimate = Math.max(20, Math.min(z.capacity * 1.15, z.fused_estimate + deltaPersons));
    const occupancyRatio = nextEstimate / z.capacity;

    let tier: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'NORMAL';
    if (occupancyRatio >= 0.92) tier = 'CRITICAL';
    else if (occupancyRatio >= 0.72) tier = 'HIGH';
    else if (occupancyRatio >= 0.50) tier = 'ELEVATED';

    const baseScore = Math.min(0.98, Math.max(0.1, Number((occupancyRatio * 0.95).toFixed(2))));

    // For z3 preserve discrepancy demo story
    const cameraCount = z.zone_id === 'z3' ? Math.round(nextEstimate * 0.75) : nextEstimate;
    const bleCount = Math.round(nextEstimate);

    return {
      ...z,
      timestamp: now.toISOString(),
      fused_estimate: nextEstimate,
      risk_score: baseScore,
      risk_tier: tier,
      level: tier,
      vision: z.vision
        ? {
            ...z.vision,
            timestamp: now.toISOString(),
            person_count: cameraCount,
            density_per_sqm: Number((cameraCount / (z.capacity * 1.2)).toFixed(2)),
          }
        : null,
      beacon: z.beacon
        ? {
            ...z.beacon,
            timestamp: now.toISOString(),
            unique_devices: bleCount,
          }
        : null,
    };
  });

  // Sort by highest risk score descending
  liveZonesState.sort((a, b) => b.risk_score - a.risk_score);

  return {
    generated_at: now.toISOString(),
    zones: [...liveZonesState],
  };
}

export function getMockLiveRisk(): RiskLiveResponse {
  return makeLiveTick();
}

export function getMockAlerts(): AlertsResponse {
  return {
    generated_at: new Date().toISOString(),
    alerts: [...liveAlertsState],
  };
}

export function getMockEvents(_hours: number = 48): EventsResponse {
  const now = Date.now();
  const events: EventItem[] = [
    {
      id: 'evt-01',
      title: 'Grand Evening Light Parade & Carnival',
      start_time: new Date(now + 28 * 3600 * 1000).toISOString(), // Tomorrow ~7 PM
      end_time: new Date(now + 32 * 3600 * 1000).toISOString(),
      venue: 'Sector 17 Plaza',
      category: 'Festival & Procession',
      expected_attendance: 14000,
      source: 'seed',
      is_illustrative: false,
      zone_id: 'ch01',
      lat: 30.7398,
      lon: 76.7827,
    },
    {
      id: 'evt-02',
      title: 'Assumed Celebrity Album Launch Rush',
      start_time: new Date(now + 6 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 10 * 3600 * 1000).toISOString(),
      venue: 'Elante Mall Courtyard',
      category: 'Entertainment / Fan Meet',
      expected_attendance: 6500,
      source: 'assumed',
      is_illustrative: true,
      zone_id: 'ch03',
      lat: 30.7055,
      lon: 76.8013,
    },
    {
      id: 'evt-03',
      title: 'Simulated Weekend Shobha Yatra Transit Egress',
      start_time: new Date(now + 18 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 23 * 3600 * 1000).toISOString(),
      venue: 'Gurdwara Amb Sahib Precinct',
      category: 'Religious Gathering',
      expected_attendance: 8200,
      source: 'assumed',
      is_illustrative: true,
      zone_id: 'mo03',
      lat: 30.6985,
      lon: 76.7289,
    },
    {
      id: 'evt-04',
      title: 'Championship Football Derby Egress Surge',
      start_time: new Date(now + 9 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 12 * 3600 * 1000).toISOString(),
      venue: 'Metro Concourse Line 3 Hub',
      category: 'Sports Transit',
      expected_attendance: 8500,
      source: 'real',
      is_illustrative: false,
      zone_id: 'z2',
      lat: 30.7681,
      lon: 76.7834,
    },
    {
      id: 'evt-05',
      title: 'Organic Farmers Produce Market',
      start_time: new Date(now + 21 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 26 * 3600 * 1000).toISOString(),
      venue: 'Main Gate Promenade',
      category: 'Public Market',
      expected_attendance: 3200,
      source: 'synthetic',
      is_illustrative: false,
      zone_id: 'z1',
      lat: 30.7673,
      lon: 76.7821,
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    count: events.length,
    events,
  };
}

export function getMockForecastMetrics(): ForecastMetricsResponse {
  return {
    generated_at: new Date().toISOString(),
    n_train_venues: 100,
    evaluation: 'Group-split held-out cross-validation across real municipal venues',
    disclaimer: 'Forecasts come from a category-based model trained on synthetic data; illustrative events are marked.',
    overall_mae_pct_capacity: 4.8,
    baseline_mae_pct_capacity: {
      global_mean: 14.2,
      category_hour_mean: 8.6,
    },
    by_category: {
      market: { mae_pct_capacity: 5.1, n_places: 2 },
      transit_hub: { mae_pct_capacity: 4.2, n_places: 2 },
      religious_site: { mae_pct_capacity: 5.8, n_places: 2 },
      campus_ground: { mae_pct_capacity: 4.5, n_places: 3 },
      food_street: { mae_pct_capacity: 3.9, n_places: 3 },
      public_square: { mae_pct_capacity: 5.4, n_places: 2 },
    },
  };
}

export function getMockPlannerAssess(req: PlannerAssessRequest): PlannerAssessResponse {
  const zone = FIXTURE_ZONES.find((z) => z.id === req.zone_id) ?? FIXTURE_ZONES[4]; // Default ch01 Sector 17
  const cap = zone.capacity;
  const drawMultiplier = req.draw_level === 'very_high' ? 1.4 : req.draw_level === 'high' ? 1.2 : 1.0;
  const effectiveExpected = Math.round(req.expected_attendance * drawMultiplier);
  const baselineCount = Math.round(cap * 0.25);
  const peakTotal = baselineCount + effectiveExpected;
  const peakRatio = Number((peakTotal / cap).toFixed(2));
  const density = Number((peakTotal / Math.max(100, zone.area_sqm)).toFixed(2));

  let verdict: PlannerVerdict = 'feasible';
  if (peakRatio > 1.1) {
    verdict = 'not_recommended';
  } else if (peakRatio > 0.7) {
    verdict = 'feasible_with_mitigations';
  }

  const s1Ratio = Number((peakTotal / cap).toFixed(2));
  const s2Ratio = Number(((baselineCount + Math.round(effectiveExpected * 1.3)) / cap).toFixed(2));
  const s3Ratio = Number(((baselineCount + Math.round(effectiveExpected * 1.6)) / cap).toFixed(2));

  const sVerdict = (r: number): string =>
    r > 1.1 ? 'not_recommended' : r > 0.7 ? 'feasible_with_mitigations' : 'feasible';

  const scenarios = [
    { label: 'Expected Turnout', attendance: effectiveExpected, peak_ratio: s1Ratio, verdict: sVerdict(s1Ratio) },
    { label: '+30% Surge', attendance: Math.round(effectiveExpected * 1.3), peak_ratio: s2Ratio, verdict: sVerdict(s2Ratio) },
    { label: '+60% Surge', attendance: Math.round(effectiveExpected * 1.6), peak_ratio: s3Ratio, verdict: sVerdict(s3Ratio) },
  ];

  const startTimeDate = new Date(req.start_time || '2026-09-26T18:00:00+05:30');
  const dur = Math.max(1, Math.min(12, Math.round(req.duration_hours || 4)));
  const timeline = [];
  for (let i = 0; i <= dur + 1; i++) {
    const t = new Date(startTimeDate.getTime() + i * 3600 * 1000);
    const curveFactor = Math.sin((Math.PI * i) / (dur + 1));
    const evtPeople = Math.round(effectiveExpected * Math.max(0, curveFactor));
    const basePeople = Math.round(baselineCount * (0.8 + 0.3 * Math.sin(i / 2)));
    const total = evtPeople + basePeople;
    timeline.push({
      time: t.toISOString(),
      baseline: basePeople,
      event: evtPeople,
      total,
      ratio: Number((total / cap).toFixed(2)),
    });
  }

  const reasons: string[] = [];
  const mitigations: string[] = [];
  if (verdict === 'not_recommended') {
    reasons.push(
      `Projected peak occupancy of ${(peakRatio * 100).toFixed(0)}% exceeds safe venue capacity (${cap.toLocaleString()} persons).`
    );
    reasons.push(`Estimated density of ${density} persons/m² creates critical crowd compression at egress bottlenecks.`);
    mitigations.push('Mandate pre-registration ticketing caps or relocate to a higher-capacity open stadium.');
    mitigations.push('Enforce staggered entry slots over a minimum 3-hour arrival window.');
    mitigations.push('Pre-position dedicated rapid crowd-dispersal security teams.');
  } else if (verdict === 'feasible_with_mitigations') {
    reasons.push(`Expected crowd reaches ${(peakRatio * 100).toFixed(0)}% of capacity during peak hour.`);
    reasons.push('Pedestrian flow near perimeter corridors will experience moderate compression.');
    mitigations.push('Establish one-way directional pedestrian circulation.');
    mitigations.push('Activate auxiliary exit gates 45 minutes prior to event conclusion.');
    mitigations.push('Coordinate with transit authorities to boost bus/metro departure frequency.');
  } else {
    reasons.push(`Crowd density remains safe at ${(peakRatio * 100).toFixed(0)}% of maximum designated capacity.`);
    reasons.push('Standard egress corridors sufficient for unrestricted movement.');
    mitigations.push('Maintain regular safety monitoring and keep emergency vehicle access lanes clear.');
  }

  const altCandidates = FIXTURE_ZONES.filter((z) => z.id !== zone.id && z.capacity > cap);
  const alternatives = altCandidates.slice(0, 2).map((alt) => {
    const altRatio = Number(((alt.capacity * 0.2 + effectiveExpected) / alt.capacity).toFixed(2));
    return {
      zone_id: alt.id,
      name: alt.name,
      peak_ratio: altRatio,
      verdict: sVerdict(altRatio),
    };
  });

  return {
    zone: {
      id: zone.id,
      name: zone.name,
      city: zone.city || 'Chandigarh',
      category: zone.category || 'public_square',
      capacity: zone.capacity,
      area_sqm: zone.area_sqm,
    },
    verdict,
    peak: {
      time: new Date(startTimeDate.getTime() + Math.round(dur / 2) * 3600 * 1000).toISOString(),
      total_present: peakTotal,
      occupancy_ratio: peakRatio,
      density_per_sqm: density,
    },
    scenarios,
    timeline,
    reasons,
    mitigations,
    alternatives,
    assumptions: [
      `Turnout scaled by ${drawMultiplier}x based on '${req.draw_level || 'normal'}' VIP/celebrity draw assumption.`,
      `Baseline ambient footfall modelled at ~25% of venue design capacity.`,
      `Arrivals follow bell-curve distribution over ${dur} hours duration.`,
    ],
    disclaimer: 'Decision support only. Not a safety approval; real events need police, fire and local-authority clearance.',
  };
}

export function getMockPlannerParse(text: string): PlannerParseResponse {
  const lower = text.toLowerCase();
  let zone_id: string | null = null;
  if (lower.includes('sector 17') || lower.includes('ch01')) zone_id = 'ch01';
  else if (lower.includes('sukhna') || lower.includes('lake') || lower.includes('ch02')) zone_id = 'ch02';
  else if (lower.includes('elante') || lower.includes('ch03')) zone_id = 'ch03';
  else if (lower.includes('market') || lower.includes('z3')) zone_id = 'z3';
  else if (lower.includes('metro') || lower.includes('z2')) zone_id = 'z2';
  else if (lower.includes('gate') || lower.includes('z1')) zone_id = 'z1';
  else if (lower.includes('pca') || lower.includes('stadium') || lower.includes('mo01')) zone_id = 'mo01';

  let event_type: PlannerEventType = 'other';
  if (lower.includes('concert') || lower.includes('singer') || lower.includes('music')) event_type = 'concert';
  else if (lower.includes('match') || lower.includes('cricket') || lower.includes('football')) event_type = 'sports_match';
  else if (lower.includes('rally') || lower.includes('speech')) event_type = 'rally';
  else if (lower.includes('festival') || lower.includes('mela') || lower.includes('carnival')) event_type = 'festival';
  else if (lower.includes('puja') || lower.includes('shobha') || lower.includes('religious')) event_type = 'religious_gathering';

  let expected_attendance: number | null = null;
  const numMatch = lower.match(/(\d+[\d,]*)\s*(people|attendees|crowd|fans|persons)?/);
  if (numMatch) {
    const rawNum = parseInt(numMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(rawNum) && rawNum > 0) expected_attendance = rawNum;
  }
  if (!expected_attendance && lower.includes('5000')) expected_attendance = 5000;
  if (!expected_attendance && lower.includes('10000')) expected_attendance = 10000;

  let draw_level: PlannerDrawLevel = 'normal';
  if (lower.includes('bollywood') || lower.includes('celebrity') || lower.includes('star') || lower.includes('vip')) {
    draw_level = 'high';
  }

  let duration_hours: number | null = null;
  const durMatch = lower.match(/(\d+)\s*(hour|hr|hours|hrs)/);
  if (durMatch) {
    duration_hours = parseFloat(durMatch[1]);
  }

  const start_time = '2026-09-26T19:00:00+05:30';

  const missing: string[] = [];
  if (!zone_id) missing.push('zone_id');
  if (!duration_hours) missing.push('duration_hours');
  if (!expected_attendance) missing.push('expected_attendance');

  return {
    fields: {
      zone_id,
      start_time,
      duration_hours,
      event_type,
      expected_attendance,
      draw_level,
    },
    missing,
    matched_by: 'rules',
    note: 'Review and confirm every field before assessing.',
  };
}

export function getMockForecast(zoneId: string, hours: number = 48): ForecastResponse {
  const zone = FIXTURE_ZONES.find((z) => z.id === zoneId) ?? FIXTURE_ZONES[2]; // Default z3 Market Street
  const points: ForecastPoint[] = [];
  const now = Date.now();

  for (let i = 0; i < hours; i++) {
    const pointTime = new Date(now + i * 3600 * 1000);
    const hourOfDay = pointTime.getHours();

    // Baseline diurnal cycle
    let baseMultiplier = 0.25;
    if (hourOfDay >= 11 && hourOfDay <= 14) baseMultiplier = 0.55;
    else if (hourOfDay >= 17 && hourOfDay <= 21) baseMultiplier = 0.70;
    else if (hourOfDay >= 1 && hourOfDay <= 6) baseMultiplier = 0.08;

    let drivers: string[] = ['Diurnal commuter baseline'];
    let spikeMultiplier = 1.0;

    // Pronounced spike tomorrow at 7 PM (hour index ~28-31)
    if (zone.id === 'z3' && i >= 27 && i <= 32) {
      spikeMultiplier = 1.65;
      drivers = ['Grand Evening Light Parade & Carnival procession', 'Narrow choke point at North Arcade'];
    } else if (zone.id === 'z2' && i >= 6 && i <= 9) {
      spikeMultiplier = 1.45;
      drivers = ['Championship Football Derby stadium transit transfer'];
    }

    const predicted_count = Math.round(zone.capacity * baseMultiplier * spikeMultiplier);
    const density = Number((predicted_count / zone.area_sqm).toFixed(2));
    const ratio = predicted_count / zone.capacity;

    let risk_tier: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'NORMAL';
    if (ratio >= 0.90) risk_tier = 'CRITICAL';
    else if (ratio >= 0.70) risk_tier = 'HIGH';
    else if (ratio >= 0.48) risk_tier = 'ELEVATED';

    points.push({
      timestamp: pointTime.toISOString(),
      predicted_count,
      predicted_density: density,
      risk_tier,
      drivers,
    });
  }

  return {
    zone_id: zone.id,
    zone_name: zone.name,
    generated_at: new Date().toISOString(),
    horizon_hours: hours,
    points,
  };
}

export function mockAnalyzeFrame(zoneId: string, _file: File): VisionAnalyzeResponse {
  const zone = FIXTURE_ZONES.find((z) => z.id === zoneId) ?? FIXTURE_ZONES[0];
  const detectedCount = Math.floor(zone.capacity * (0.65 + Math.random() * 0.25));

  // Update live state for demo
  const target = liveZonesState.find((z) => z.zone_id === zoneId);
  if (target) {
    target.fused_estimate = Math.max(target.fused_estimate, detectedCount);
    target.vision = {
      zone_id: zoneId,
      timestamp: new Date().toISOString(),
      person_count: detectedCount,
      density_per_sqm: Number((detectedCount / zone.area_sqm).toFixed(2)),
      flow: { dx: 0.22, dy: 0.15, magnitude: 0.27 },
      confidence: 0.94,
    };
    if (target.fused_estimate / target.capacity >= 0.7) {
      target.risk_tier = 'HIGH';
      target.risk_score = 0.82;
    } else if (target.fused_estimate / target.capacity >= 0.5) {
      target.risk_tier = 'ELEVATED';
      target.risk_score = 0.61;
    }
  }

  return {
    zone_id: zoneId,
    timestamp: new Date().toISOString(),
    person_count: detectedCount,
    density_per_sqm: Number((detectedCount / zone.area_sqm).toFixed(2)),
    flow: { dx: 0.22, dy: 0.15, magnitude: 0.27 },
    confidence: 0.94,
    model_name: 'YOLOv11x-CrowdGuard',
    mocked: true,
    annotated_image_b64: null,
  };
}

export function mockSimulateVision(zoneId: string, personCount: number): void {
  const target = liveZonesState.find((z) => z.zone_id === zoneId);
  if (target) {
    // If user manually set a lower headcount, also adjust beacon if it was holding fused estimate high
    if (personCount < target.fused_estimate && target.beacon) {
      target.beacon.unique_devices = Math.min(target.beacon.unique_devices, Math.round(personCount * 1.05));
    }
    target.fused_estimate = personCount;

    const ratio = target.fused_estimate / target.capacity;
    target.risk_score = Number(Math.min(0.99, ratio * 0.95).toFixed(2));
    if (ratio >= 0.92) target.risk_tier = 'CRITICAL';
    else if (ratio >= 0.70) target.risk_tier = 'HIGH';
    else if (ratio >= 0.48) target.risk_tier = 'ELEVATED';
    else target.risk_tier = 'NORMAL';

    if (target.vision) {
      target.vision.person_count = personCount;
      target.vision.density_per_sqm = Number((personCount / (target.capacity * 1.2)).toFixed(2));
      target.vision.timestamp = new Date().toISOString();
    }

    if (target.risk_tier === 'NORMAL') {
      target.reasons = [
        'pedestrian dispersal flow steady',
        'safe egress corridor clear',
      ];
      // Clean up alerts for this zone if normal
      liveAlertsState = liveAlertsState.filter((a) => a.zone_id !== zoneId);
    }
  }
}

export function mockIngestBeacon(zoneId: string, devices: number): void {
  const target = liveZonesState.find((z) => z.zone_id === zoneId);
  if (target) {
    // If decreasing beacon count, scale down vision count if it was holding it up
    if (devices < target.fused_estimate && target.vision) {
      target.vision.person_count = Math.min(target.vision.person_count, devices);
    }
    target.fused_estimate = devices;

    const ratio = target.fused_estimate / target.capacity;
    target.risk_score = Number(Math.min(0.99, ratio * 0.96).toFixed(2));
    if (ratio >= 0.92) target.risk_tier = 'CRITICAL';
    else if (ratio >= 0.70) target.risk_tier = 'HIGH';
    else if (ratio >= 0.48) target.risk_tier = 'ELEVATED';
    else target.risk_tier = 'NORMAL';

    if (target.beacon) {
      target.beacon.unique_devices = devices;
      target.beacon.timestamp = new Date().toISOString();
    }

    if (target.risk_tier === 'NORMAL') {
      target.reasons = [
        'RF telemetry within nominal threshold',
        'no density pinch point detected',
      ];
      liveAlertsState = liveAlertsState.filter((a) => a.zone_id !== zoneId);
    } else if (target.vision && devices > target.vision.person_count * 1.15) {
      if (!target.reasons.some((r) => r.includes('Bluetooth counts disagree'))) {
        target.reasons.unshift('camera and Bluetooth counts disagree, using the higher estimate');
      }
    }
  }
}

export function mockDeescalateZone(zoneId: string, targetCount?: number): void {
  const target = liveZonesState.find((z) => z.zone_id === zoneId);
  if (target) {
    const normalCount = targetCount ?? Math.round(target.capacity * 0.28);
    target.fused_estimate = normalCount;
    target.risk_tier = 'NORMAL';
    target.risk_score = 0.24;
    if (target.vision) {
      target.vision.person_count = normalCount;
      target.vision.density_per_sqm = Number((normalCount / target.capacity).toFixed(2));
      target.vision.timestamp = new Date().toISOString();
    }
    if (target.beacon) {
      target.beacon.unique_devices = normalCount;
      target.beacon.timestamp = new Date().toISOString();
    }
    target.reasons = [
      'traffic normalized after controlled dispersal',
      'unimpeded egress throughout sector',
    ];
    liveAlertsState = liveAlertsState.filter((a) => a.zone_id !== zoneId);
  }
}

export function mockResetAllZones(): void {
  for (const z of liveZonesState) {
    mockDeescalateZone(z.zone_id);
  }
}

export function getMockMetroStatus() {
  return {
    system_name: 'Delhi Metro Rail Corporation (DMRC)',
    network_status: 'ELEVATED_PEAK',
    total_daily_ridership_calibration: 5065000,
    active_train_count: 342,
    lines: [
      {
        id: 'yellow',
        name: 'Yellow Line (Samaypur Badli - Millennium City Centre)',
        color: '#eab308',
        status: 'CONGESTED' as const,
        ridership_daily: 1420000,
        train_frequency_mins: 2.5,
        interchange_pressure: 0.84,
        active_advisories: [
          'High transfer surge at Rajiv Chowk & Hauz Khas',
          'Gate throttling active at Gate 2 Rajiv Chowk',
        ],
      },
      {
        id: 'blue',
        name: 'Blue Line (Dwarka Sec 21 - Noida Electronic City)',
        color: '#3b82f6',
        status: 'ELEVATED' as const,
        ridership_daily: 1380000,
        train_frequency_mins: 2.8,
        interchange_pressure: 0.72,
        active_advisories: ['Peak hour ingress regulation at Botanical Garden'],
      },
      {
        id: 'violet',
        name: 'Violet Line (Kashmere Gate - Raja Nahar Singh)',
        color: '#8b5cf6',
        status: 'NOMINAL' as const,
        ridership_daily: 840000,
        train_frequency_mins: 3.5,
        interchange_pressure: 0.48,
        active_advisories: [],
      },
      {
        id: 'magenta',
        name: 'Magenta Line (Janakpuri West - Botanical Garden)',
        color: '#ec4899',
        status: 'ELEVATED' as const,
        ridership_daily: 710000,
        train_frequency_mins: 3.8,
        interchange_pressure: 0.65,
        active_advisories: ['Hauz Khas underground walkway crowd buildup'],
      },
    ],
    stations: [
      {
        station_id: 'dm_z1',
        station_name: 'Rajiv Chowk Interchange',
        line_intersections: ['Yellow Line', 'Blue Line'],
        current_occupancy: 2080,
        max_capacity: 2500,
        turnstile_throughput_ppm: 340,
        platform_1_density: 1.65,
        platform_2_density: 1.42,
        esc_speed_regulation: 'REDUCED_0.50M_S',
        risk_score: 0.83,
        risk_tier: 'HIGH' as const,
        dmrc_forecast_pressure: 0.88,
      },
      {
        station_id: 'dm_z2',
        station_name: 'Kashmere Gate Hub',
        line_intersections: ['Red Line', 'Yellow Line', 'Violet Line'],
        current_occupancy: 1920,
        max_capacity: 2800,
        turnstile_throughput_ppm: 285,
        platform_1_density: 1.2,
        platform_2_density: 1.15,
        esc_speed_regulation: 'NORMAL_0.75M_S',
        risk_score: 0.68,
        risk_tier: 'HIGH' as const,
        dmrc_forecast_pressure: 0.71,
      },
      {
        station_id: 'dm_z3',
        station_name: 'Hauz Khas Junction',
        line_intersections: ['Yellow Line', 'Magenta Line'],
        current_occupancy: 1240,
        max_capacity: 1800,
        turnstile_throughput_ppm: 210,
        platform_1_density: 1.05,
        platform_2_density: 0.98,
        esc_speed_regulation: 'NORMAL_0.75M_S',
        risk_score: 0.62,
        risk_tier: 'ELEVATED' as const,
        dmrc_forecast_pressure: 0.65,
      },
      {
        station_id: 'dm_z4',
        station_name: 'Millennium City Centre',
        line_intersections: ['Yellow Line'],
        current_occupancy: 780,
        max_capacity: 1500,
        turnstile_throughput_ppm: 140,
        platform_1_density: 0.65,
        platform_2_density: 0.55,
        esc_speed_regulation: 'NORMAL_0.75M_S',
        risk_score: 0.35,
        risk_tier: 'NORMAL' as const,
        dmrc_forecast_pressure: 0.42,
      },
      {
        station_id: 'dm_z5',
        station_name: 'Botanical Garden',
        line_intersections: ['Blue Line', 'Magenta Line'],
        current_occupancy: 980,
        max_capacity: 1600,
        turnstile_throughput_ppm: 180,
        platform_1_density: 0.82,
        platform_2_density: 0.78,
        esc_speed_regulation: 'NORMAL_0.75M_S',
        risk_score: 0.58,
        risk_tier: 'ELEVATED' as const,
        dmrc_forecast_pressure: 0.6,
      },
      {
        station_id: 'dm_z6',
        station_name: 'Central Secretariat',
        line_intersections: ['Yellow Line', 'Violet Line'],
        current_occupancy: 650,
        max_capacity: 1400,
        turnstile_throughput_ppm: 120,
        platform_1_density: 0.5,
        platform_2_density: 0.48,
        esc_speed_regulation: 'NORMAL_0.75M_S',
        risk_score: 0.28,
        risk_tier: 'NORMAL' as const,
        dmrc_forecast_pressure: 0.32,
      },
    ],
  };
}

export function getMockMetroPrediction(stationId: string = 'dm_z1', hours: number = 24): MetroPredictionResponse {
  const points: MetroForecastPoint[] = [];
  const now = new Date();
  const capacity = stationId === 'dm_z2' ? 2800 : stationId === 'dm_z1' ? 2500 : 1800;

  let maxOcc = 0;
  let maxTime = '';
  let maxTier: RiskTier = 'NORMAL';

  for (let i = 0; i < hours; i++) {
    const t = new Date(now.getTime() + i * 3600 * 1000);
    const hourIST = (t.getUTCHours() + 5 + Math.floor((t.getUTCMinutes() + 30) / 60)) % 24;

    // Diurnal commute pattern with 9 AM & 6 PM peaks
    let factor = 0.3;
    if (hourIST >= 8 && hourIST <= 10) factor = 0.82;
    else if (hourIST >= 17 && hourIST <= 20) factor = 0.88;
    else if (hourIST >= 11 && hourIST <= 16) factor = 0.55;

    const estOcc = Math.round(capacity * factor);
    const ratio = Number((estOcc / capacity).toFixed(2));

    let tier: RiskTier = 'NORMAL';
    if (ratio >= 0.85) tier = 'HIGH';
    else if (ratio >= 0.65) tier = 'ELEVATED';

    if (estOcc > maxOcc) {
      maxOcc = estOcc;
      maxTime = t.toISOString();
      maxTier = tier;
    }

    points.push({
      timestamp: t.toISOString(),
      predicted_occupancy: estOcc,
      max_capacity: capacity,
      predicted_ratio: ratio,
      risk_tier: tier,
      risk_score: ratio,
      primary_driver: hourIST >= 17 && hourIST <= 20 ? 'Evening Commute & Yellow Line Transfer Peak' : 'Diurnal Base Transit Flow',
    });
  }

  const nameMap: Record<string, string> = {
    dm_z1: 'Rajiv Chowk Interchange',
    dm_z2: 'Kashmere Gate Hub',
    dm_z3: 'Hauz Khas Junction',
    dm_z4: 'Millennium City Centre',
    dm_z5: 'Botanical Garden',
    dm_z6: 'Central Secretariat',
  };

  return {
    station_id: stationId,
    station_name: nameMap[stationId] || 'Delhi Metro Hub',
    forecast_horizon_hours: hours,
    predicted_peak_time: maxTime,
    predicted_peak_occupancy: maxOcc,
    predicted_peak_tier: maxTier,
    recommended_mitigation: maxTier === 'HIGH'
      ? 'Inject 3 empty rakes on Yellow Line from Samaypur Badli during 17:00-19:00 peak surge.'
      : 'Maintain standard 2.5 min train headway; regulate Gate 2 turnstiles if platform density > 1.2 p/m².',
    points,
  };
}


