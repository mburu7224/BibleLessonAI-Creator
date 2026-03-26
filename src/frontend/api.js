import { appSettings } from "../../firebaseConfig.js";
import { state } from "./state.js";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (state.authToken) {
    headers.set("Authorization", `Bearer ${state.authToken}`);
  }

  const response = await fetch(`${appSettings.backendApiBaseUrl}${path}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload?.error ? payload.error : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
}

export const api = {
  getHealth() {
    return request("/api/health", { method: "GET" });
  },
  createSession({ creatorId, password }) {
    return request("/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ creatorId, password })
    });
  },
  generateSlides(payload) {
    return request("/api/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listProjects(creatorId) {
    return request(`/api/projects?creatorId=${encodeURIComponent(creatorId)}`, { method: "GET" });
  },
  getProject(projectId) {
    return request(`/api/projects/${projectId}`, { method: "GET" });
  },
  createProject(payload) {
    return request("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateProject(projectId, payload) {
    return request(`/api/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteProject(projectId) {
    return request(`/api/projects/${projectId}`, {
      method: "DELETE"
    });
  },
  sendLiveIndex(projectId, currentSlideIndex) {
    return request(`/api/live/${projectId}`, {
      method: "POST",
      body: JSON.stringify({ currentSlideIndex })
    });
  },
  generatePptx(projectId) {
    return request(`/api/projects/${projectId}/pptx`, {
      method: "POST",
      body: JSON.stringify({})
    });
  }
};
