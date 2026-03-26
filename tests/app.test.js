import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/server/app.js";

function createTestApp() {
  const projects = new Map();

  const authUsers = {
    "token-user-1": { uid: "user-1", email: "owner@example.com", displayName: "Owner One" },
    "token-user-2": { uid: "user-2", email: "other@example.com", displayName: "Other User" }
  };

  const authService = {
    isConfigured: () => true,
    registerUser: vi.fn(async ({ email, displayName }) => ({
      uid: "new-user",
      email,
      displayName
    })),
    loginUser: vi.fn(async ({ email }) => ({
      token: "token-user-1",
      refreshToken: "refresh-token",
      user: { uid: "user-1", email, displayName: "Owner One" }
    })),
    verifyIdToken: vi.fn(async (token) => {
      if (!authUsers[token]) {
        throw new Error("bad token");
      }

      return authUsers[token];
    })
  };

  const projectsRepository = {
    listPublicProjects: vi.fn(async () => [...projects.values()].filter((project) => project.isPublic)),
    listCreatorProjects: vi.fn(async (ownerUid) =>
      [...projects.values()].filter((project) => project.ownerUid === ownerUid)
    ),
    getProject: vi.fn(async (id) => projects.get(id) || null),
    createProject: vi.fn(async (project) => {
      const id = `project-${projects.size + 1}`;
      projects.set(id, { id, ...project });
      return id;
    }),
    updateProject: vi.fn(async (id, project) => {
      projects.set(id, { ...(projects.get(id) || { id }), ...project, id });
    }),
    deleteProject: vi.fn(async (id) => {
      projects.delete(id);
    }),
    updateProjectPptx: vi.fn(async (id, pptxUrl) => {
      projects.set(id, { ...projects.get(id), id, pptxUrl });
    }),
    getLiveState: vi.fn(async (projectId) => ({ projectId, currentSlideIndex: 0 })),
    setLiveState: vi.fn(async () => {})
  };

  const generateSlideDeck = vi.fn(async () => ({
    mainTopic: "Generated Topic",
    subtopic: "",
    scriptureReading: "John 3:16",
    memoryVerse: "Psalm 119:105",
    lessonDate: "March 26, 2026",
    themeId: 1,
    suggestions: ["Prepared 2 slide(s)."],
    slides: [
      {
        type: "title",
        question: "Generated Topic",
        answer: "March 26, 2026",
        notes: "",
        questionNumber: 0,
        scriptureReading: "",
        memoryVerse: "",
        themeId: 1
      },
      {
        type: "question",
        question: "What was said of Abraham?",
        answer: "Genesis 18:19",
        notes: "",
        questionNumber: 1,
        scriptureReading: "",
        memoryVerse: "",
        themeId: 1
      }
    ]
  }));

  const createPresentationFile = vi.fn(async () => ({
    absolutePath: "/tmp/test.pptx",
    publicUrl: "http://localhost:8787/generated/test.pptx"
  }));

  return {
    app: createApp({
      authService,
      projectsRepository,
      generateSlideDeck,
      createPresentationFile
    }),
    projectsRepository,
    generateSlideDeck,
    createPresentationFile
  };
}

const sampleProjectPayload = {
  mainTopic: "Prepared Topic",
  subtopic: "",
  scriptureReading: "John 3:16",
  memoryVerse: "Psalm 119:105",
  lessonDate: "March 26, 2026",
  themeId: 1,
  isPublic: true,
  rawLessonText: "Lesson text",
  suggestions: ["Prepared 1 slide(s)."],
  pptxUrl: "",
  slides: [
    {
      type: "title",
      question: "Prepared Topic",
      answer: "March 26, 2026",
      notes: "",
      questionNumber: 0,
      scriptureReading: "",
      memoryVerse: "",
      themeId: 1
    }
  ]
};

describe("server app", () => {
  it("registers a real user account payload", async () => {
    const { app } = createTestApp();

    const response = await request(app).post("/api/auth/register").send({
      email: "owner@example.com",
      password: "strong-pass-123",
      displayName: "Owner One"
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("owner@example.com");
  });

  it("logs in and returns an id token payload", async () => {
    const { app } = createTestApp();

    const response = await request(app).post("/api/auth/login").send({
      email: "owner@example.com",
      password: "strong-pass-123"
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe("token-user-1");
    expect(response.body.user.displayName).toBe("Owner One");
  });

  it("rejects protected routes without a verified user token", async () => {
    const { app } = createTestApp();

    const response = await request(app).post("/api/generate").send({
      lessonText: "Lesson text",
      themeId: 1,
      meta: {}
    });

    expect(response.status).toBe(401);
  });

  it("creates and lists user-owned projects with validated payloads", async () => {
    const { app } = createTestApp();

    const createResponse = await request(app)
      .post("/api/projects")
      .set("Authorization", "Bearer token-user-1")
      .send(sampleProjectPayload);

    expect(createResponse.status).toBe(201);

    const listResponse = await request(app)
      .get("/api/projects")
      .set("Authorization", "Bearer token-user-1");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.projects).toHaveLength(1);
    expect(listResponse.body.projects[0].mainTopic).toBe("Prepared Topic");
  });

  it("runs generation flow for authenticated users", async () => {
    const { app, generateSlideDeck } = createTestApp();

    const response = await request(app)
      .post("/api/generate")
      .set("Authorization", "Bearer token-user-1")
      .send({
        lessonText: "Lesson text",
        tweakPrompt: "",
        themeId: 1,
        meta: {}
      });

    expect(response.status).toBe(200);
    expect(generateSlideDeck).toHaveBeenCalledTimes(1);
    expect(response.body.deck.mainTopic).toBe("Generated Topic");
  });

  it("runs export flow and persists the pptx url", async () => {
    const { app, createPresentationFile, projectsRepository } = createTestApp();

    const createResponse = await request(app)
      .post("/api/projects")
      .set("Authorization", "Bearer token-user-1")
      .send(sampleProjectPayload);

    const projectId = createResponse.body.projectId;

    const exportResponse = await request(app)
      .post(`/api/projects/${projectId}/pptx`)
      .set("Authorization", "Bearer token-user-1")
      .send({});

    expect(exportResponse.status).toBe(200);
    expect(createPresentationFile).toHaveBeenCalledTimes(1);
    expect(projectsRepository.updateProjectPptx).toHaveBeenCalledWith(
      projectId,
      "http://localhost:8787/generated/test.pptx"
    );
  });
});
