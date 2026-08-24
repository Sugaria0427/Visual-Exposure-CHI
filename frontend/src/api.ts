import type {
  CompareResponse,
  ExposureResponse,
  MaterialsPayload,
  PlanningResponse,
  RoutePoint,
  Scenario,
  StudySessionInfo,
  StudyStepId,
  UserPreferences,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = `${API_BASE_URL}${url}`;
  const res = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail || errorText;
    } catch {
      // ignore
    }
    throw new Error(detail || `HTTP error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ==========================================
// Formal CHI-3 Study API
// ==========================================

export async function launchStudy(launchToken: string): Promise<StudySessionInfo> {
  return requestJson<StudySessionInfo>('/api/study/launch', {
    method: 'POST',
    body: JSON.stringify({
      launch_token: launchToken,
      environment: 'prod',
      material_mode: 'validated',
    }),
  });
}

export async function getSessionStatus(sessionId: string): Promise<StudySessionInfo> {
  return requestJson<StudySessionInfo>(`/api/study/session/${sessionId}`);
}

export async function confirmStart(sessionId: string): Promise<{ status: string; current_step: StudyStepId }> {
  return requestJson<{ status: string; current_step: StudyStepId }>(`/api/study/confirm-start?session_id=${sessionId}`, {
    method: 'POST',
  });
}

export async function getMaterials(sessionId: string, phase: 'pre' | 'post'): Promise<MaterialsPayload> {
  return requestJson<MaterialsPayload>(`/api/study/materials/${sessionId}?phase=${phase}`);
}

export async function submitResponse(payload: {
  session_id: string;
  phase: 'pre' | 'post';
  question_id: string;
  field_id?: string;
  response_value?: string;
  confidence?: number;
  q2_asked?: number;
  skip_reason?: string;
  response_time_ms?: number;
  reason_codes?: string[];
  requested_conditions?: string[];
  simulated_action?: string;
  action_feasibility?: number;
}): Promise<{ status: string; evaluation: any }> {
  return requestJson<{ status: string; evaluation: any }>('/api/study/response', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitBatchEvents(sessionId: string, events: Array<{
  event_seq: number;
  event_type: string;
  phase: string;
  payload?: any;
  client_timestamp?: string;
}>): Promise<{ status: string; count: number }> {
  return requestJson<{ status: string; count: number }>('/api/study/events', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      events,
    }),
  });
}

export async function advanceState(sessionId: string, nextStep: StudyStepId): Promise<{ status: string; current_step: StudyStepId }> {
  return requestJson<{ status: string; current_step: StudyStepId }>('/api/study/state', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      next_step: nextStep,
    }),
  });
}

export async function completeStudy(sessionId: string): Promise<{ session_id: string; completion_code: string; completed_at: string }> {
  return requestJson<{ session_id: string; completion_code: string; completed_at: string }>('/api/study/complete', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function verifyCompletionCode(code: string): Promise<{
  valid: boolean;
  status: string;
  session_id?: string;
  cell_id?: string;
  issued_at?: string;
  verified_at?: string;
}> {
  return requestJson('/api/study/verify-code', {
    method: 'POST',
    body: JSON.stringify({ completion_code: code }),
  });
}

export async function fetchParityCheck(): Promise<{ overall_status: string; details: any[] }> {
  return requestJson('/api/admin/parity-check');
}

// ==========================================
// Legacy API for Sandbox/Demo Isolation
// ==========================================

export async function loadScenario(scenarioId = 'hong_kong_mong_kok_01'): Promise<Scenario> {
  return requestJson<Scenario>(`/api/scenarios/${scenarioId}`);
}

export async function computeExposure(
  scenarioId: string,
  route: RoutePoint[],
  camera: any,
  userPreferences?: any,
): Promise<ExposureResponse> {
  return requestJson<ExposureResponse>('/api/exposure/compute', {
    method: 'POST',
    body: JSON.stringify({
      scenario_id: scenarioId,
      route,
      camera,
      user_preferences: userPreferences,
    }),
  });
}

export async function compareExposure(
  scenarioId: string,
  route: RoutePoint[],
  camera: any,
  userPreferences?: any,
): Promise<CompareResponse> {
  return requestJson<CompareResponse>('/api/exposure/compare', {
    method: 'POST',
    body: JSON.stringify({
      scenario_id: scenarioId,
      before: { scenario_id: scenarioId, route, camera, user_preferences: {} },
      after: { scenario_id: scenarioId, route, camera, user_preferences: userPreferences },
    }),
  });
}

export async function optimizePlanning(
  scenarioId: string,
  route: RoutePoint[],
  camera: any,
  userPreferences?: any,
  plannerConfig?: any,
): Promise<PlanningResponse> {
  return requestJson<PlanningResponse>('/api/planning/optimize', {
    method: 'POST',
    body: JSON.stringify({
      scenario_id: scenarioId,
      route,
      camera,
      user_preferences: userPreferences,
      planner_config: plannerConfig,
    }),
  });
}
