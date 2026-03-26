import { HttpError } from "../lib/http-error.js";
import { env } from "../config/env.js";
import { getAdminAuth } from "../repositories/firebase.js";

const FIREBASE_AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";

export function createFirebaseAuthService(adminAuth = getAdminAuth()) {
  return {
    isConfigured() {
      return Boolean(
        env.firebaseAdminProjectId &&
          env.firebaseAdminClientEmail &&
          env.firebaseAdminPrivateKey &&
          env.firebaseWebApiKey
      );
    },

    async registerUser({ email, password, displayName }) {
      if (!env.allowPublicRegistration) {
        throw new HttpError(403, "Public registration is disabled.");
      }

      const user = await adminAuth.createUser({
        email,
        password,
        displayName
      });

      return {
        uid: user.uid,
        email: user.email || email,
        displayName: user.displayName || displayName
      };
    },

    async loginUser({ email, password }) {
      if (!env.firebaseWebApiKey) {
        throw new HttpError(503, "Firebase Web API key is not configured.");
      }

      const response = await fetch(
        `${FIREBASE_AUTH_BASE}/accounts:signInWithPassword?key=${encodeURIComponent(env.firebaseWebApiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true
          })
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new HttpError(401, "Invalid email or password.", payload);
      }

      const decoded = await adminAuth.verifyIdToken(payload.idToken);
      return {
        token: payload.idToken,
        refreshToken: payload.refreshToken,
        user: mapDecodedToken(decoded)
      };
    },

    async verifyIdToken(token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        return mapDecodedToken(decoded);
      } catch {
        throw new HttpError(401, "Unauthorized");
      }
    }
  };
}

function mapDecodedToken(decoded) {
  return {
    uid: decoded.uid,
    email: decoded.email || "",
    displayName: decoded.name || decoded.email || decoded.uid
  };
}
