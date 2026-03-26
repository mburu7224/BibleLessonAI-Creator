const DEFAULT_API_BASE = "http://localhost:8787";
const DEFAULT_ALLOWED_ORIGIN = "http://localhost:4173";

function requireEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8787),
  apiBaseUrl: process.env.API_BASE_URL || DEFAULT_API_BASE,
  allowedOrigin: process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN,
  cspConnectSrc: process.env.CSP_CONNECT_SRC || DEFAULT_API_BASE,
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  firebaseAdminProjectId: requireEnv("FIREBASE_ADMIN_PROJECT_ID"),
  firebaseAdminClientEmail: requireEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
  firebaseAdminPrivateKey: requireEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
  firebaseWebApiKey: requireEnv("FIREBASE_WEB_API_KEY"),
  firebaseAuthDomain: requireEnv("FIREBASE_AUTH_DOMAIN"),
  firebaseStorageBucket: requireEnv("FIREBASE_STORAGE_BUCKET"),
  firebaseMessagingSenderId: requireEnv("FIREBASE_MESSAGING_SENDER_ID"),
  firebaseAppId: requireEnv("FIREBASE_APP_ID"),
  firebaseMeasurementId: requireEnv("FIREBASE_MEASUREMENT_ID"),
  firebaseProjectsCollection: process.env.FIREBASE_PROJECTS_COLLECTION || "BibleLessonSlides",
  firebaseLiveCollection: process.env.FIREBASE_LIVE_COLLECTION || "BibleLessonLive",
  allowPublicRegistration: process.env.ALLOW_PUBLIC_REGISTRATION !== "false"
};

export function getServerConfigHealth() {
  return {
    authConfigured: Boolean(
      env.firebaseAdminProjectId &&
        env.firebaseAdminClientEmail &&
        env.firebaseAdminPrivateKey &&
        env.firebaseWebApiKey
    ),
    openAiConfigured: Boolean(env.openAiApiKey),
    allowedOrigin: env.allowedOrigin,
    collections: {
      projects: env.firebaseProjectsCollection,
      live: env.firebaseLiveCollection
    }
  };
}

export function getFirebaseAdminConfig() {
  return {
    projectId: env.firebaseAdminProjectId,
    clientEmail: env.firebaseAdminClientEmail,
    privateKey: env.firebaseAdminPrivateKey
  };
}
