import crypto from "node:crypto";
import { env } from "../config/env.js";

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createSessionToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, exp: Date.now() + env.sessionTtlMs };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedBody = toBase64Url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", env.sessionSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || !env.sessionSecret) {
    return null;
  }

  const [encodedHeader, encodedBody, signature] = token.split(".");
  if (!encodedHeader || !encodedBody || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.sessionSecret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  if (expectedSignature !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedBody));
    if (!payload?.exp || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
