import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { verifySessionToken } from "../services/token-service.js";

export function requireConfiguredAuth(_req, _res, next) {
  if (!env.adminPassword || !env.sessionSecret) {
    next(new HttpError(503, "Auth is not configured. Set ADMIN_PASSWORD and SESSION_SECRET."));
    return;
  }

  next();
}

export function requireAuth(req, _res, next) {
  const rawHeader = req.headers.authorization || "";
  const token = rawHeader.startsWith("Bearer ") ? rawHeader.slice(7) : "";
  const payload = verifySessionToken(token);

  if (!payload?.creatorId) {
    next(new HttpError(401, "Unauthorized"));
    return;
  }

  req.auth = payload;
  next();
}
