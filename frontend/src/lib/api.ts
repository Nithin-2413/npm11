
// In Vite, REACT_APP_* vars are accessible via import.meta.env
// Development: Use relative URLs (proxied through Vite)
// Production: Use the external backend URL
const _envUrl = (import.meta.env.REACT_APP_BACKEND_URL as string) || "";
const isDevelopment = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = isDevelopment ? "" : (_envUrl ? _envUrl.replace(/\/$/, "") : "");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─────────────── Execution ───────────────
export const executeCommand = (command: string, options: Record<string, unknown> = {}) =>
  request<{ execution_id: string; status: string; message: string }>("/api/execute", {
    method: "POST",
    body: JSON.stringify({ command, options }),
  });

export const executeBlueprint = (blueprint_id: string, variables: Record<string, string> = {}, options: Record<string, unknown> = {}) =>
  request<{ execution_id: string; status: string; message: string }>("/api/execute/blueprint", {
    method: "POST",
    body: JSON.stringify({ blueprint_id, variables, options }),
  });

export const getExecutionStatus = (execution_id: string) =>
  request<{
    execution_id: string;
    status: string;
    progress: number;
    current_action: string;
    actions_completed: number;
    actions_total: number;
  }>(`/api/execute/${execution_id}/status`);

export const cancelExecution = (execution_id: string) =>
  request<{ message: string }>(`/api/execute/${execution_id}/cancel`, { method: "POST" });

// ─────────────── Blueprints ───────────────
export const listBlueprints = (params?: { search?: string; tag?: string; sort?: string; page?: number; page_size?: number }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return request<{ blueprints: Blueprint[]; total: number }>(`/api/blueprints${qs ? "?" + qs : ""}`);
};

export const getBlueprint = (id: string) => request<Blueprint>(`/api/blueprints/${id}`);

export const createBlueprint = (data: Partial<Blueprint>) =>
  request<{ blueprint_id: string; message: string }>("/api/blueprints", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateBlueprint = (id: string, data: Partial<Blueprint>) =>
  request<{ message: string }>(`/api/blueprints/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteBlueprint = (id: string) =>
  request<{ message: string }>(`/api/blueprints/${id}`, { method: "DELETE" });

export const duplicateBlueprint = (id: string) =>
  request<{ blueprint_id: string; message: string }>(`/api/blueprints/${id}/duplicate`, { method: "POST" });

export const injectBlueprint = (id: string, variables: Record<string, string>) =>
  request<{ blueprint: Blueprint; ready_to_execute: boolean; missing_variables: string[] }>(
    `/api/blueprints/${id}/inject`,
    { method: "POST", body: JSON.stringify({ variables }) }
  );

export const getBlueprintExecutions = (id: string) =>
  request<{ executions: Execution[]; total: number }>(`/api/blueprints/${id}/executions`);

// ─────────────── Reports ───────────────
export const listReports = (params?: { status?: string; page?: number; page_size?: number }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return request<{ reports: Execution[]; total: number }>(`/api/reports${qs ? "?" + qs : ""}`);
};

export const getReport = (id: string) => request<Execution>(`/api/reports/${id}`);

export const deleteReport = (id: string) =>
  request<{ message: string }>(`/api/reports/${id}`, { method: "DELETE" });

export const getReportStats = () =>
  request<{
    total_executions: number;
    success_count: number;
    failure_count: number;
    partial_count: number;
    success_rate: number;
    avg_duration: number;
    total_blueprints: number;
    executions_today: number;
    executions_this_week: number;
    executions_this_month: number;
    top_blueprints: { blueprint_id: string; name: string; usage_count: number }[];
    recent_errors: { execution_id: string; error_message: string; timestamp: string; command: string }[];
  }>("/api/reports/stats");

export const exportReport = (id: string, format: "json" | "html") => {
  const url = `${BASE_URL}/api/reports/${id}/export?format=${format}`;
  window.open(url, "_blank");
};

// ─────────────── Network ───────────────
export const getNetworkLogs = (execution_id: string) =>
  request<{
    execution_id: string;
    total_requests: number;
    total_errors: number;
    requests: NetworkRequest[];
  }>(`/api/network/${execution_id}`);

// ─────────────── WebSocket ───────────────
export const createExecutionWS = (execution_id: string): WebSocket => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsBase = BASE_URL
    ? BASE_URL.replace(/^https?:/, protocol)
    : `${protocol}//${window.location.host}`;
  return new WebSocket(`${wsBase}/ws/execution/${execution_id}`);
};

// ─────────────── Types ───────────────
export interface BlueprintAction {
  id?: string;
  type: string;
  selector?: string;
  url?: string;
  value?: string;
  timeout?: number;
  optional?: boolean;
  description?: string;
}

export interface Blueprint {
  blueprint_id: string;
  name: string;
  description: string;
  version: string;
  created_at: string;
  updated_at: string;
  variables: { name: string; default_value: string; type: string; required?: boolean }[];
  actions: BlueprintAction[];
  success_criteria?: string;
  metadata: { tags: string[]; success_rate: number; usage_count: number; avg_duration?: number };
}

export interface ActionResult {
  action_index: number;
  action_type: string;
  selector?: string;
  value?: string;
  status: "success" | "failure" | "skipped";
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  error_message?: string;
  screenshot_path?: string;
  description?: string;
  confidence?: number;
  used_fallback?: boolean;
  was_refined?: boolean;
  ai_analysis?: {       // FIX 2: Per-action AI analysis
    root_cause: string;
    suggested_fix: string;
    error_type: string;
    impact_level?: string;
    confidence?: number;
  };
}

export interface Execution {
  execution_id: string;
  status: "RUNNING" | "SUCCESS" | "FAILURE" | "PARTIAL" | "CANCELLED";
  timestamp: string;
  completed_at?: string;
  duration_seconds: number;
  command?: string;
  blueprint_id?: string;
  blueprint_name?: string;
  total_actions: number;
  successful_actions: number;
  failed_actions: number;
  action_timeline: ActionResult[];
  network_logs: NetworkRequest[];
  console_logs: { type: string; text: string; timestamp: number }[];
  ai_analysis?: {       // FIX 2: Updated with all required fields
    root_cause: string;
    affected_component: string;
    suggested_fix: string;
    impact_level?: string;
    confidence: number;
    error_type: string;
    raw_error?: string;
    full_analysis?: string;
  };
  ai_summary?: string;
  performance?: {
    avg_action_duration_ms: number;
    slowest_action_ms: number;
    network_bandwidth_bytes: number;
    performance_score: number;
  };
  error_message?: string;
  screenshots: string[];
}

export interface NetworkRequest {
  request_id: string;
  url: string;
  method: string;
  status: number;
  content_type?: string;
  duration_ms: number;
  size_bytes: number;
  timestamp: number;
  is_error: boolean;
  response_body?: string;
  ai_analysis?: { root_cause: string; suggested_fix: string };
}


// ─────────────── Secrets (PART 2B) ───────────────
export interface Secret {
  secret_id: string;
  name: string;
  type: string;
  domain?: string;
  data: Record<string, string>;  // password always masked in UI
  tags: string[];
  created_at: string;
  last_used?: string;
}

export const listSecrets = () =>
  request<{ secrets: Secret[]; total: number }>("/api/secrets");

export const createSecret = (data: {
  name: string; type: string; domain?: string;
  data: Record<string, string>; tags?: string[];
}) => request<{ secret_id: string; message: string }>("/api/secrets", { method: "POST", body: JSON.stringify(data) });

export const updateSecret = (id: string, data: Partial<Secret>) =>
  request<{ message: string }>(`/api/secrets/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteSecret = (id: string) =>
  request<{ message: string }>(`/api/secrets/${id}`, { method: "DELETE" });

// ─────────────── Schedules (PART 3B) ───────────────
export interface Schedule {
  schedule_id: string;
  name: string;
  blueprint_id: string;
  blueprint_name?: string;
  variables: Record<string, string>;
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  is_paused: boolean;
  last_run?: string;
  last_status?: string;
  next_run?: string;
  notification_on_failure: boolean;
  created_at: string;
  run_count: number;
  success_count: number;
  failure_count: number;
}

export const listSchedules = () =>
  request<{ schedules: Schedule[]; total: number }>("/api/schedules");

export const createSchedule = (data: {
  name: string; blueprint_id: string; cron_expression: string;
  timezone?: string; variables?: Record<string, string>; notification_on_failure?: boolean;
}) => request<{ schedule_id: string; message: string }>("/api/schedules", { method: "POST", body: JSON.stringify(data) });

export const updateSchedule = (id: string, data: Partial<Schedule>) =>
  request<{ message: string }>(`/api/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteSchedule = (id: string) =>
  request<{ message: string }>(`/api/schedules/${id}`, { method: "DELETE" });

export const pauseSchedule = (id: string) =>
  request<{ message: string }>(`/api/schedules/${id}/pause`, { method: "POST" });

export const resumeSchedule = (id: string) =>
  request<{ message: string }>(`/api/schedules/${id}/resume`, { method: "POST" });

export const runScheduleNow = (id: string) =>
  request<{ execution_id: string; message: string }>(`/api/schedules/${id}/run-now`, { method: "POST" });

export const getScheduleHistory = (id: string) =>
  request<{ history: Execution[]; schedule_id: string }>(`/api/schedules/${id}/history`);

// ─────────────── Workspaces (PART 4B) ───────────────
export interface WorkspaceMember {
  user_id: string; email: string; name?: string; role: string; joined_at: string;
}
export interface Workspace {
  workspace_id: string; name: string; owner_id: string;
  members: WorkspaceMember[];
  settings: Record<string, boolean>;
  created_at: string;
}

export const listWorkspaces = () =>
  request<{ workspaces: Workspace[]; total: number }>("/api/workspaces");

export const createWorkspace = (data: { name: string }) =>
  request<{ workspace_id: string; message: string }>("/api/workspaces", { method: "POST", body: JSON.stringify(data) });

export const inviteMember = (workspace_id: string, data: { email: string; name?: string; role: string }) =>
  request<{ message: string; member: WorkspaceMember }>(`/api/workspaces/${workspace_id}/invite`, { method: "POST", body: JSON.stringify(data) });

export const updateMemberRole = (workspace_id: string, user_id: string, role: string) =>
  request<{ message: string }>(`/api/workspaces/${workspace_id}/members/${user_id}`, { method: "PUT", body: JSON.stringify({ role }) });

export const removeMember = (workspace_id: string, user_id: string) =>
  request<{ message: string }>(`/api/workspaces/${workspace_id}/members/${user_id}`, { method: "DELETE" });

export const getWorkspaceActivity = (workspace_id: string) =>
  request<{ activity: Execution[]; workspace_id: string }>(`/api/workspaces/${workspace_id}/activity`);

// ─────────────── Webhooks (PART 5A) ───────────────
export interface Webhook {
  webhook_id: string; name: string; secret_token?: string; secret_token_preview?: string;
  blueprint_id: string; blueprint_name?: string;
  variables: Record<string, string>;
  trigger_on: string[];
  branch_filter?: string;
  is_active: boolean;
  created_at: string;
  last_triggered?: string;
  trigger_count: number;
}

export const listWebhooks = () =>
  request<{ webhooks: Webhook[]; total: number }>("/api/webhooks");

export const createWebhook = (data: {
  name: string; blueprint_id: string; trigger_on?: string[];
  branch_filter?: string; variables?: Record<string, string>;
}) => request<{ webhook_id: string; secret_token: string; message: string }>("/api/webhooks", { method: "POST", body: JSON.stringify(data) });

export const deleteWebhook = (id: string) =>
  request<{ message: string }>(`/api/webhooks/${id}`, { method: "DELETE" });

// ─────────────── Analytics (PART 6) ───────────────
export interface TimeSeriesPoint {
  timestamp: string;
  total_executions: number;
  success_count: number;
  failure_count: number;
  partial_count: number;
  avg_duration_seconds: number;
  avg_performance_score: number;
}

export interface FlakyBlueprint {
  blueprint_id: string; name: string; failure_rate: number;
  total_runs: number; success_count: number; failure_count: number;
  last_failure_reason: string; failure_pattern: string; recommendation: string;
}

export interface Regression {
  blueprint_id: string; name: string;
  avg_duration_recent_s: number; avg_duration_prev_s: number;
  change_percent: number; severity: string; recommendation: string;
}

export const getTimeSeries = (period = "7d", granularity = "day") =>
  request<{ period: string; granularity: string; data: TimeSeriesPoint[] }>(
    `/api/analytics/timeseries?period=${period}&granularity=${granularity}`
  );

export const getFlakyBlueprints = () =>
  request<{ flaky_blueprints: FlakyBlueprint[]; total: number }>("/api/analytics/flaky");

export const getPerformanceRegressions = () =>
  request<{ regressions: Regression[]; total: number }>("/api/analytics/regressions");

export const getTopBlueprints = (limit = 5) =>
  request<{ blueprints: { blueprint_id: string; name: string; usage_count: number; success_rate: number }[] }>(
    `/api/analytics/top-blueprints?limit=${limit}`
  );
