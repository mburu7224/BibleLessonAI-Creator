import { API_BASE_URL } from "./config.js";
import { state } from "./state.js";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (state.authToken) {
    headers.set("Authorization", `Bearer ${state.authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
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
  register({ email, password, displayName }) {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName })
    });
  },
  login({ email, password }) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  generateSlides(payload) {
    return request("/api/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listProjects() {
    return request("/api/projects", { method: "GET" });
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
