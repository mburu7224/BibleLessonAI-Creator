const DEFAULT_API_BASE = "http://localhost:8787";
const DEFAULT_ALLOWED_ORIGIN = "http://localhost:8787";

export const env = {
  port: Number(process.env.PORT || 8787),
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  apiBaseUrl: process.env.API_BASE_URL || DEFAULT_API_BASE,
  allowedOrigin: process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN,
  sessionTtlMs: Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 12),
  cspConnectSrc: process.env.CSP_CONNECT_SRC || DEFAULT_API_BASE
};

export function getServerConfigHealth() {
  return {
    authConfigured: Boolean(env.adminPassword && env.sessionSecret),
    openAiConfigured: Boolean(env.openAiApiKey),
    allowedOrigin: env.allowedOrigin
  };
}
