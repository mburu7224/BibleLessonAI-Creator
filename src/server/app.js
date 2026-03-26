import cors from "cors";
import express from "express";
import path from "node:path";
import { appSettings } from "../../firebaseConfig.js";
import { buildProjectPayload, normalizeProject } from "../shared/slide-contract.js";
import { env, getServerConfigHealth } from "./config/env.js";
import { HttpError } from "./lib/http-error.js";
import { assertNonEmptyString, sanitizeProjectInput } from "./lib/validation.js";
import { requireAuth, requireConfiguredAuth } from "./middleware/auth.js";
import { createRateLimit } from "./middleware/rate-limit.js";
import {
  createProject,
  deleteProject,
  getLiveState,
  getProject,
  listCreatorProjects,
  listPublicProjects,
  setLiveState,
  updateProject,
  updateProjectPptx
} from "./repositories/projects-repository.js";
import { generateSlideDeck } from "./services/openai-slide-service.js";
import { createPresentationFile } from "./services/pptx-service.js";
import { createSessionToken, verifySessionToken } from "./services/token-service.js";

const server = express();
const authRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10 });
const generationRateLimit = createRateLimit({ windowMs: 60 * 1000, maxRequests: 20 });

server.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.allowedOrigin === "*" || origin === env.allowedOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error("Blocked by CORS policy"));
    }
  })
);
server.use(express.json({ limit: "1mb" }));
server.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy());
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});
server.use("/generated", express.static(path.resolve(process.cwd(), "generated")));

server.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "lesson-slides-service",
    timestamp: new Date().toISOString(),
    config: getServerConfigHealth(),
    collections: {
      projects: appSettings.projectsCollection,
      live: appSettings.liveCollection
    }
  });
});

server.post("/api/auth/session", requireConfiguredAuth, authRateLimit, (req, res, next) => {
  try {
    const creatorId = String(req.body?.creatorId || "").trim();
    const password = String(req.body?.password || "");

    assertNonEmptyString(creatorId, "Creator ID is required.");
    assertNonEmptyString(password, "Password is required.");

    if (password !== env.adminPassword) {
      throw new HttpError(401, "Invalid password.");
    }

    const token = createSessionToken({ creatorId });
    res.json({
      token,
      user: { creatorId }
    });
  } catch (error) {
    next(error);
  }
});

server.post("/api/generate", requireAuth, generationRateLimit, async (req, res, next) => {
  try {
    const deck = await generateSlideDeck(req.body || {});
    res.json({ deck });
  } catch (error) {
    next(error);
  }
});

server.get("/api/projects/public", async (_req, res, next) => {
  try {
    const projects = (await listPublicProjects()).map((project) => normalizeProject(project));
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

server.get("/api/projects", requireAuth, async (req, res, next) => {
  try {
    const creatorId = String(req.query.creatorId || req.auth.creatorId || "").trim();
    if (creatorId !== req.auth.creatorId) {
      throw new HttpError(403, "You can only access your own projects.");
    }

    const projects = (await listCreatorProjects(creatorId)).map((project) => normalizeProject(project));
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

server.get("/api/projects/:id", async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) {
      throw new HttpError(404, "Project not found.");
    }

    if (!project.isPublic) {
      const rawHeader = req.headers.authorization || "";
      const token = rawHeader.startsWith("Bearer ") ? rawHeader.slice(7) : "";
      const session = verifySessionToken(token);
      if (!session?.creatorId || session.creatorId !== project.creatorId) {
        throw new HttpError(401, "Unauthorized");
      }
    }

    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});

server.post("/api/projects", requireAuth, async (req, res, next) => {
  try {
    const payload = sanitizeProjectInput(req.body);
    const projectId = await createProject({
      ...buildProjectPayload(payload),
      creatorId: req.auth.creatorId
    });

    res.status(201).json({ projectId });
  } catch (error) {
    next(error);
  }
});

server.put("/api/projects/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await getProject(req.params.id);
    if (!existing) {
      throw new HttpError(404, "Project not found.");
    }
    if (existing.creatorId !== req.auth.creatorId) {
      throw new HttpError(403, "You can only update your own projects.");
    }

    const payload = sanitizeProjectInput(req.body);
    await updateProject(req.params.id, {
      ...buildProjectPayload(payload),
      creatorId: req.auth.creatorId
    });

    res.json({ ok: true, projectId: req.params.id });
  } catch (error) {
    next(error);
  }
});

server.delete("/api/projects/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await getProject(req.params.id);
    if (!existing) {
      throw new HttpError(404, "Project not found.");
    }
    if (existing.creatorId !== req.auth.creatorId) {
      throw new HttpError(403, "You can only delete your own projects.");
    }

    await deleteProject(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

server.get("/api/live/:projectId", requireAuth, async (req, res, next) => {
  try {
    res.json(await getLiveState(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

server.post("/api/live/:projectId", requireAuth, async (req, res, next) => {
  try {
    await setLiveState(req.params.projectId, {
      currentSlideIndex: Number(req.body?.currentSlideIndex || 0),
      presenterId: req.auth.creatorId
    });
    res.json({
      ok: true,
      projectId: req.params.projectId,
      currentSlideIndex: Number(req.body?.currentSlideIndex || 0)
    });
  } catch (error) {
    next(error);
  }
});

server.post("/api/projects/:id/pptx", requireAuth, async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) {
      throw new HttpError(404, "Project not found.");
    }
    if (project.creatorId !== req.auth.creatorId) {
      throw new HttpError(403, "You can only export your own projects.");
    }

    const result = await createPresentationFile(normalizeProject(project));
    await updateProjectPptx(req.params.id, result.publicUrl);

    res.json({
      ok: true,
      projectId: req.params.id,
      pptxUrl: result.publicUrl
    });
  } catch (error) {
    next(error);
  }
});

server.use((error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.status : 500;
  res.status(status).json({
    error: error.message || "Internal Server Error",
    details: error.details || undefined
  });
});

export { server };

function buildContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://cdn.jsdelivr.net",
    `connect-src 'self' ${env.cspConnectSrc}`,
    "font-src 'self' data:"
  ].join("; ");
}
