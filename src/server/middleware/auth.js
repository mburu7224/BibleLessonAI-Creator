import { HttpError } from "../lib/http-error.js";

export function requireConfiguredAuth(authService) {
  return function configuredAuthMiddleware(_req, _res, next) {
    if (!authService.isConfigured()) {
      next(new HttpError(503, "Auth is not configured. Check Firebase Admin and Web API env values."));
      return;
    }

    next();
  };
}

export function requireAuth(authService) {
  return async function authMiddleware(req, _res, next) {
    try {
      const rawHeader = req.headers.authorization || "";
      const token = rawHeader.startsWith("Bearer ") ? rawHeader.slice(7) : "";
      if (!token) {
        throw new HttpError(401, "Unauthorized");
      }

      req.auth = await authService.verifyIdToken(token);
      next();
    } catch (error) {
      next(error instanceof HttpError ? error : new HttpError(401, "Unauthorized"));
    }
  };
}
