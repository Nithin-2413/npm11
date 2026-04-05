import axios from "axios";

// CRITICAL FIX: Always use relative URLs to avoid CORS issues
// The Kubernetes ingress/proxy handles routing to backend
const BASE_URL = "";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth
export const login = (email: string, password: string) =>
  api.post("/api/auth/login", { email, password }).then((r) => r.data);

export const register = (email: string, password: string) =>
  api.post("/api/auth/register", { email, password }).then((r) => r.data);

// Executions
export const executeCommand = (command: string, options: any = {}) =>
  api.post("/api/execute", { command, ...options }).then((r) => r.data);

export const executeBlueprint = (blueprint_id: string, variables: any = {}) =>
  api.post(`/api/blueprints/${blueprint_id}/execute`, { variables }).then((r) => r.data);

export const cancelExecution = (execution_id: string) =>
  api.post(`/api/execute/${execution_id}/cancel`).then((r) => r.data);

export const createExecutionWS = (execution_id: string) => {
  // This is handled by getWebSocketUrl, keeping for compatibility
  return Promise.resolve({ ws_url: getWebSocketUrl(execution_id) });
};

// NEW: Save execution as blueprint
export const saveExecutionAsBlueprint = (execution_id: string, blueprint_name: string) =>
  api.post(`/api/executions/${execution_id}/save-as-blueprint`, null, {
    params: { blueprint_name }
  }).then((r) => r.data);

// Workspace member invite (stub - backend endpoint may not exist yet)
export const inviteMember = (workspace_id: string, data: any) =>
  api.post(`/api/workspaces/${workspace_id}/invite`, data).then((r) => r.data);

// Reports
export const listReports = (params: any) =>
  api.get("/api/reports", { params }).then((r) => r.data);

export const getReport = (execution_id: string) =>
  api.get(`/api/reports/${execution_id}`).then((r) => r.data);

export const getReportStats = () =>
  api.get("/api/reports/stats").then((r) => r.data);

export const deleteReport = (execution_id: string) =>
  api.delete(`/api/reports/${execution_id}`).then((r) => r.data);

export const exportReport = (execution_id: string, format: string = "json") =>
  api.get(`/api/reports/${execution_id}/export?format=${format}`).then((r) => r.data);

// Blueprints
export const listBlueprints = (params: any) =>
  api.get("/api/blueprints", { params }).then((r) => r.data);

export const getBlueprint = (blueprint_id: string) =>
  api.get(`/api/blueprints/${blueprint_id}`).then((r) => r.data);

export const createBlueprint = (data: any) =>
  api.post("/api/blueprints", data).then((r) => r.data);

export const updateBlueprint = (blueprint_id: string, data: any) =>
  api.put(`/api/blueprints/${blueprint_id}`, data).then((r) => r.data);

export const deleteBlueprint = (blueprint_id: string) =>
  api.delete(`/api/blueprints/${blueprint_id}`).then((r) => r.data);

export const duplicateBlueprint = (blueprint_id: string) =>
  api.post(`/api/blueprints/${blueprint_id}/duplicate`).then((r) => r.data);

// NEW: Run blueprint
export const runBlueprint = (blueprint_id: string, variables: any = {}) =>
  api.post(`/api/blueprints/${blueprint_id}/run`, { variables }).then((r) => r.data);

// Network
export const getNetworkLogs = (execution_id: string) =>
  api.get(`/api/network/${execution_id}`).then((r) => r.data);

// Schedules
export const listSchedules = (params?: any) =>
  api.get("/api/schedules", { params }).then((r) => r.data);

// Secrets
export const listSecrets = (params?: any) =>
  api.get("/api/secrets", { params }).then((r) => r.data);

export const createSecret = (data: any) =>
  api.post("/api/secrets", data).then((r) => r.data);

export const deleteSecret = (secret_id: string) =>
  api.delete(`/api/secrets/${secret_id}`).then((r) => r.data);

// Webhooks  
export const listWebhooks = (params?: any) =>
  api.get("/api/webhooks", { params }).then((r) => r.data);

export const createWebhook = (data: any) =>
  api.post("/api/webhooks", data).then((r) => r.data);

export const deleteWebhook = (webhook_id: string) =>
  api.delete(`/api/webhooks/${webhook_id}`).then((r) => r.data);

// Workspaces
export const listWorkspaces = (params?: any) =>
  api.get("/api/workspaces", { params }).then((r) => r.data);

export const createWorkspace = (data: any) =>
  api.post("/api/workspaces", data).then((r) => r.data);

// Analytics
export const getFlakyBlueprints = (params?: any) =>
  api.get("/api/analytics/flaky", { params }).then((r) => r.data);

export const getRegressions = (params?: any) =>
  api.get("/api/analytics/regressions", { params }).then((r) => r.data);

export const getPerformanceRegressions = (params?: any) =>
  api.get("/api/analytics/performance-regressions", { params }).then((r) => r.data);

export const getTimeseries = (period: string = "7d") =>
  api.get(`/api/analytics/timeseries?period=${period}`).then((r) => r.data);

// Alias for backward compatibility
export const getTimeSeries = getTimeseries;

export const getTopBlueprints = (params?: any) =>
  api.get("/api/analytics/top-blueprints", { params }).then((r) => r.data);

export const runBlueprint = (blueprint_id: string, variables?: any) =>
  api.post(`/api/blueprints/${blueprint_id}/run`, { variables }).then((r) => r.data);

// Types
export interface Execution {
  execution_id: string;
  command?: string;
  blueprint_id?: string;
  blueprint_name?: string;
  status: string;
  timestamp: string;
  duration_seconds: number;
  total_actions: number;
  successful_actions: number;
  failed_actions: number;
  action_timeline?: any[];
  network_logs?: any[];
}

export interface Blueprint {
  blueprint_id: string;
  name: string;
  description?: string;
  version?: string;
  actions?: any[];
  variables?: any[];
  metadata?: any;
}

export interface NetworkRequest {
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  timestamp: string;
}

export interface Schedule {
  schedule_id: string;
  name: string;
  blueprint_id: string;
  cron_expression: string;
  enabled: boolean;
}

export interface ActionResult {
  action_type: string;
  status: string;
  duration_ms: number;
  error_message?: string;
}

export interface Secret {
  secret_id: string;
  name: string;
  data: any;
  created_at: string;
}

export interface Webhook {
  webhook_id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
}

export interface Workspace {
  workspace_id: string;
  name: string;
  members?: any[];
}

// WebSocket URL helper
export const getWebSocketUrl = (execution_id: string) => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl =
    BASE_URL
      ? `${protocol}//${new URL(BASE_URL).host}`
      : `${protocol}//${window.location.host}`;
  return `${wsUrl}/ws/execution/${execution_id}`;
};

export default api;
