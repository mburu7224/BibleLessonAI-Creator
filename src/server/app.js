import cors from "cors";
import express from "express";
import path from "node:path";
import { buildProjectPayload, normalizeProject } from "../shared/slide-contract.js";
import { env, getServerConfigHealth } from "./config/env.js";
import { HttpError } from "./lib/http-error.js";
import {
  generateSchema,
  liveParamsSchema,
  liveStateSchema,
  loginSchema,
  projectIdParamsSchema,
  projectSchema,
  registerSchema
} from "./lib/request-schemas.js";
import { parseWithSchema } from "./lib/schema-utils.js";
import { sanitizeProjectInput } from "./lib/validation.js";
import { requireAuth, requireConfiguredAuth } from "./middleware/auth.js";
import { createRateLimit } from "./middleware/rate-limit.js";
import { createProjectsRepository } from "./repositories/projects-repository.js";
import { createFirebaseAuthService } from "./services/firebase-auth-service.js";
import { generateSlideDeck as defaultGenerateSlideDeck } from "./services/openai-slide-service.js";
import { createPresentationFile as defaultCreatePresentationFile } from "./services/pptx-service.js";

export function createApp(overrides = {}) {
  const authService = overrides.authService || createFirebaseAuthService();
  const projectsRepository = overrides.projectsRepository || createProjectsRepository();
  const generateSlideDeck = overrides.generateSlideDeck || defaultGenerateSlideDeck;
  const createPresentationFile = overrides.createPresentationFile || defaultCreatePresentationFile;

  const server = express();
  const configuredAuth = requireConfiguredAuth(authService);
  const authRequired = requireAuth(authService);
  const authRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 20 });
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
      config: getServerConfigHealth()
    });
  });

  server.post("/api/auth/register", configuredAuth, authRateLimit, async (req, res, next) => {
    try {
      const payload = parseWithSchema(registerSchema, req.body);
      const user = await authService.registerUser(payload);
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  });

  server.post("/api/auth/login", configuredAuth, authRateLimit, async (req, res, next) => {
    try {
      const payload = parseWithSchema(loginSchema, req.body);
      const session = await authService.loginUser(payload);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  server.post("/api/generate", authRequired, generationRateLimit, async (req, res, next) => {
    try {
      const payload = parseWithSchema(generateSchema, req.body);
      const deck = await generateSlideDeck(payload);
      res.json({ deck });
    } catch (error) {
      next(error);
    }
  });

  server.get("/api/projects/public", async (_req, res, next) => {
    try {
      const projects = (await projectsRepository.listPublicProjects()).map((project) => normalizeProject(project));
      res.json({ projects });
    } catch (error) {
      next(error);
    }
  });

  server.get("/api/projects", authRequired, async (req, res, next) => {
    try {
      const projects = (await projectsRepository.listCreatorProjects(req.auth.uid)).map((project) =>
        normalizeProject(project)
      );
      res.json({ projects });
    } catch (error) {
      next(error);
    }
  });

  server.get("/api/projects/:id", authRequired, async (req, res, next) => {
    try {
      const params = parseWithSchema(projectIdParamsSchema, req.params);
      const project = await projectsRepository.getProject(params.id);
      if (!project) {
        throw new HttpError(404, "Project not found.");
      }

      if (!project.isPublic && !projectBelongsToUser(project, req.auth)) {
        throw new HttpError(403, "You can only access your own projects.");
      }

      res.json({ project: normalizeProject(project) });
    } catch (error) {
      next(error);
    }
  });

  server.post("/api/projects", authRequired, async (req, res, next) => {
    try {
      const payload = sanitizeProjectInput(parseWithSchema(projectSchema, req.body));
      const projectId = await projectsRepository.createProject({
        ...buildProjectPayload(payload),
        ownerUid: req.auth.uid,
        creatorId: req.auth.displayName,
        creatorEmail: req.auth.email
      });

      res.status(201).json({ projectId });
    } catch (error) {
      next(error);
    }
  });

  server.put("/api/projects/:id", authRequired, async (req, res, next) => {
    try {
      const params = parseWithSchema(projectIdParamsSchema, req.params);
      const existing = await projectsRepository.getProject(params.id);
      if (!existing) {
        throw new HttpError(404, "Project not found.");
      }
      if (!projectBelongsToUser(existing, req.auth)) {
        throw new HttpError(403, "You can only update your own projects.");
      }

      const payload = sanitizeProjectInput(parseWithSchema(projectSchema, req.body));
      await projectsRepository.updateProject(params.id, {
        ...buildProjectPayload(payload),
        ownerUid: req.auth.uid,
        creatorId: req.auth.displayName,
        creatorEmail: req.auth.email
      });

      res.json({ ok: true, projectId: params.id });
    } catch (error) {
      next(error);
    }
  });

  server.delete("/api/projects/:id", authRequired, async (req, res, next) => {
    try {
      const params = parseWithSchema(projectIdParamsSchema, req.params);
      const existing = await projectsRepository.getProject(params.id);
      if (!existing) {
        throw new HttpError(404, "Project not found.");
      }
      if (!projectBelongsToUser(existing, req.auth)) {
        throw new HttpError(403, "You can only delete your own projects.");
      }

      await projectsRepository.deleteProject(params.id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  server.get("/api/live/:projectId", authRequired, async (req, res, next) => {
    try {
      const params = parseWithSchema(liveParamsSchema, req.params);
      res.json(await projectsRepository.getLiveState(params.projectId));
    } catch (error) {
      next(error);
    }
  });

  server.post("/api/live/:projectId", authRequired, async (req, res, next) => {
    try {
      const params = parseWithSchema(liveParamsSchema, req.params);
      const payload = parseWithSchema(liveStateSchema, req.body);
      await projectsRepository.setLiveState(params.projectId, {
        currentSlideIndex: payload.currentSlideIndex,
        presenterId: req.auth.displayName,
        presenterUid: req.auth.uid
      });
      res.json({
        ok: true,
        projectId: params.projectId,
        currentSlideIndex: payload.currentSlideIndex
      });
    } catch (error) {
      next(error);
    }
  });

  server.post("/api/projects/:id/pptx", authRequired, async (req, res, next) => {
    try {
      const params = parseWithSchema(projectIdParamsSchema, req.params);
      const project = await projectsRepository.getProject(params.id);
      if (!project) {
        throw new HttpError(404, "Project not found.");
      }
      if (!projectBelongsToUser(project, req.auth)) {
        throw new HttpError(403, "You can only export your own projects.");
      }

      const result = await createPresentationFile(normalizeProject(project));
      await projectsRepository.updateProjectPptx(params.id, result.publicUrl);
      res.json({
        ok: true,
        projectId: params.id,
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

  return server;
}

function projectBelongsToUser(project, auth) {
  return Boolean(
    (project.ownerUid && project.ownerUid === auth.uid) ||
      (project.creatorEmail && auth.email && project.creatorEmail === auth.email)
  );
}

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
