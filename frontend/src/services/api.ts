export interface HealthStatus {
  status: string;
  uptime_seconds?: number;
  environment?: string;
  version?: string;
  service?: string;
  latencyMs?: number;
}

export interface DemoItem {
  id: string;
  original_message: string;
  processed_message: string;
  tag: string;
  word_count: number;
  char_count: number;
  timestamp: string;
}

// Fallback logic for API URL
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // If it ends with trailing slash, remove it
    return envUrl.replace(/\/+$/, '');
  }
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

export async function checkBackendHealth(): Promise<HealthStatus> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      ...data,
      latencyMs,
      status: data.status || 'healthy',
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : 'Connection failed';
    return {
      status: 'unreachable',
      latencyMs,
      environment: message,
    };
  }
}

export async function getSampleItems(): Promise<DemoItem[]> {
  const res = await fetch(`${API_BASE_URL}/v1/demo/sample`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to load samples (${res.status})`);
  }
  return res.json();
}

export async function submitDemoMessage(message: string, tag: string = 'hackathon'): Promise<DemoItem> {
  const res = await fetch(`${API_BASE_URL}/v1/demo/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ message, tag }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}
