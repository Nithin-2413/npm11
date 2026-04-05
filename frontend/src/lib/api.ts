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

export const cancelExecution = (execution_id: string) =>
  api.post(`/api/execute/${execution_id}/cancel`).then((r) => r.data);

// NEW: Save execution as blueprint
export const saveExecutionAsBlueprint = (execution_id: string, blueprint_name: string) =>
  api.post(`/api/executions/${execution_id}/save-as-blueprint`, null, {
    params: { blueprint_name }
  }).then((r) => r.data);

// Reports
export const listReports = (params: any) =>
  api.get("/api/reports", { params }).then((r) => r.data);

export const getReport = (execution_id: string) =>
  api.get(`/api/reports/${execution_id}`).then((r) => r.data);

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

// NEW: Run blueprint
export const runBlueprint = (blueprint_id: string, variables: any = {}) =>
  api.post(`/api/blueprints/${blueprint_id}/run`, { variables }).then((r) => r.data);

// Network
export const getNetworkLogs = (execution_id: string) =>
  api.get(`/api/network/${execution_id}`).then((r) => r.data);

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
