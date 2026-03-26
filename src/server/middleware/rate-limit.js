import { HttpError } from "../lib/http-error.js";

const buckets = new Map();

export function createRateLimit({ windowMs, maxRequests }) {
  return function rateLimit(req, _res, next) {
    const key = `${req.ip || "unknown"}:${req.path}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || now - existing.startedAt > windowMs) {
      buckets.set(key, { count: 1, startedAt: now });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > maxRequests) {
      next(new HttpError(429, "Too many requests. Please wait and try again."));
      return;
    }

    next();
  };
}
