import type {
  Zone,
  ZoneRisk,
  RiskLiveResponse,
  Alert,
  AlertsResponse,
  ForecastPoint,
  ForecastResponse,
  EventItem,
  EventsResponse,
  VisionAnalyzeResponse,
} from '../types/crowdguard';

export const FIXTURE_ZONES: Zone[] = [
  {
    id: 'z1',
    name: 'Main Gate Plaza',
    capacity: 400,
    area_sqm: 500,
    lat: 30.7673,
    lon: 76.7821,
  },
  {
    id: 'z2',
    name: 'Metro Concourse',
    capacity: 600,
    area_sqm: 450,
    lat: 30.7681,
    lon: 76.7834,
  },
  {
    id: 'z3',
    name: 'Market Street',
    capacity: 900,
    area_sqm: 1200,
    lat: 30.7692,
    lon: 76.7845,
  },
  {
    id: 'z4',
    name: 'Food Court',
    capacity: 300,
    area_sqm: 350,
    lat: 30.7668,
    lon: 76.7812,
  },
];

let liveZonesState: ZoneRisk[] = [
  {
    zone_id: 'z3',
    zone_name: 'Market Street',
    timestamp: new Date().toISOString(),
    risk_score: 0.84,
    risk_tier: 'HIGH',
    fused_estimate: 782,
    capacity: 900,
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
    fused_estimate: 418,
    capacity: 600,
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
    fused_estimate: 142,
    capacity: 400,
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
    risk_score: 0.22,
    risk_tier: 'NORMAL',
    fused_estimate: 94,
    capacity: 300,
    vision: {
      zone_id: 'z4',
      timestamp: new Date().toISOString(),
      person_count: 94,
      density_per_sqm: 0.27,
      flow: { dx: 0.02, dy: -0.04, magnitude: 0.04 },
      confidence: 0.95,
    },
    beacon: {
      zone_id: 'z4',
      timestamp: new Date().toISOString(),
      unique_devices: 88,
      scanner_id: 'BLE-FCT-04',
    },
    forecast_pressure: 0.3,
    reasons: [
      'normal seated occupancy',
      'aisles clear with unimpeded egress',
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
];

/**
 * Nudges live mock data on each poll to simulate active sensor telemetry
 */
export function makeLiveTick(): RiskLiveResponse {
  const now = new Date();
  liveZonesState = liveZonesState.map((z) => {
    // Subtle realistic wobble
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
      venue: 'Market Street Corridor & Plaza',
      category: 'Festival & Procession',
      expected_attendance: 14000,
      source: 'City Municipality Permits',
      zone_id: 'z3',
      lat: 30.7692,
      lon: 76.7845,
    },
    {
      id: 'evt-02',
      title: 'Championship Football Derby Egress Surge',
      start_time: new Date(now + 6 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 9 * 3600 * 1000).toISOString(),
      venue: 'Metro Concourse Line 3 Hub',
      category: 'Sports Transit',
      expected_attendance: 8500,
      source: 'Transit Authority Feeds',
      zone_id: 'z2',
      lat: 30.7681,
      lon: 76.7834,
    },
    {
      id: 'evt-03',
      title: 'Weekend Organic Farmers Market',
      start_time: new Date(now + 21 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 26 * 3600 * 1000).toISOString(),
      venue: 'Main Gate Promenade',
      category: 'Public Market',
      expected_attendance: 3200,
      source: 'City Event Portal',
      zone_id: 'z1',
      lat: 30.7673,
      lon: 76.7821,
    },
    {
      id: 'evt-04',
      title: 'Acoustic Street Food & Music Evening',
      start_time: new Date(now + 7 * 3600 * 1000).toISOString(),
      end_time: new Date(now + 11 * 3600 * 1000).toISOString(),
      venue: 'Central Food Court Pavilion',
      category: 'Dining / Entertainment',
      expected_attendance: 1800,
      source: 'Commercial District Board',
      zone_id: 'z4',
      lat: 30.7668,
      lon: 76.7812,
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    count: events.length,
    events,
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
  liveZonesState.forEach((z) => {
    mockDeescalateZone(z.zone_id);
  });
  liveAlertsState = [];
}

