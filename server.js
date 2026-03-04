import express from "express";
import cors from "cors";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { firebaseConfig, appSettings } from "./firebaseConfig.js";

const server = express();
const port = Number(process.env.PORT || 8787);
const TEST_ADMIN_KEY = "NewRuiruMediaKey2025!";

server.use(cors());
server.use(express.json());

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

server.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "BibleLessonAI backend", timestamp: new Date().toISOString() });
});

server.get("/api/projects/public", async (_req, res) => {
  try {
    const projectsRef = collection(db, appSettings.projectsCollection);
    let snapshot;

    try {
      snapshot = await getDocs(query(projectsRef, where("isPublic", "==", true), orderBy("createdAt", "desc")));
    } catch {
      snapshot = await getDocs(query(projectsRef, where("isPublic", "==", true)));
    }

    const projects = snapshot.docs.map((projectDoc) => ({
      id: projectDoc.id,
      ...projectDoc.data()
    }));

    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: "Failed to load public projects", details: error.message });
  }
});

server.get("/api/projects/:id", async (req, res) => {
  try {
    const projectRef = doc(db, appSettings.projectsCollection, req.params.id);
    const projectSnapshot = await getDoc(projectRef);

    if (!projectSnapshot.exists()) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({ id: projectSnapshot.id, ...projectSnapshot.data() });
  } catch (error) {
    res.status(500).json({ error: "Failed to load project", details: error.message });
  }
});

server.post("/api/projects", async (req, res) => {
  const project = req.body || {};

  try {
    const payload = {
      adminKey: project.adminKey || TEST_ADMIN_KEY,
      mainTopic: project.mainTopic || "Untitled Topic",
      lessonDate: project.lessonDate || "No date",
      slides: Array.isArray(project.slides) ? project.slides : [],
      creatorId: project.creatorId || "unknown",
      isPublic: Boolean(project.isPublic),
      pptxUrl: project.pptxUrl || "",
      themeId: Number(project.themeId || appSettings.defaultThemeId),
      createdAt: serverTimestamp()
    };

    const created = await addDoc(collection(db, appSettings.projectsCollection), payload);
    res.status(201).json({ projectId: created.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to save project", details: error.message });
  }
});

server.put("/api/projects/:id", async (req, res) => {
  const projectId = req.params.id;
  const project = req.body || {};

  try {
    await setDoc(
      doc(db, appSettings.projectsCollection, projectId),
      {
        adminKey: project.adminKey || TEST_ADMIN_KEY,
        ...project,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    res.json({ ok: true, projectId });
  } catch (error) {
    res.status(500).json({ error: "Failed to update project", details: error.message });
  }
});

server.get("/api/live/:projectId", async (req, res) => {
  try {
    const liveSnapshot = await getDoc(doc(db, appSettings.liveCollection, req.params.projectId));
    if (!liveSnapshot.exists()) {
      res.json({ projectId: req.params.projectId, currentSlideIndex: 0 });
      return;
    }

    res.json({ projectId: req.params.projectId, ...liveSnapshot.data() });
  } catch (error) {
    res.status(500).json({ error: "Failed to load live state", details: error.message });
  }
});

server.post("/api/live/:projectId", async (req, res) => {
  const { currentSlideIndex = 0, presenterId = "unknown" } = req.body || {};

  try {
    await setDoc(
      doc(db, appSettings.liveCollection, req.params.projectId),
      {
        adminKey: TEST_ADMIN_KEY,
        currentSlideIndex: Number(currentSlideIndex),
        presenterId,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    res.json({ ok: true, projectId: req.params.projectId, currentSlideIndex: Number(currentSlideIndex) });
  } catch (error) {
    res.status(500).json({ error: "Failed to update live state", details: error.message });
  }
});

server.post("/api/projects/:id/pptx", async (req, res) => {
  const projectId = req.params.id;

  try {
    // Placeholder:
    // Replace this section with real generation logic (python-pptx or PptxGenJS).
    const pptxUrl = `https://example.com/pptx/${projectId}.pptx`;

    await updateDoc(doc(db, appSettings.projectsCollection, projectId), {
      pptxUrl,
      updatedAt: serverTimestamp()
    });

    res.json({ ok: true, projectId, pptxUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate PPTX", details: error.message });
  }
});

server.listen(port, () => {
  console.log(`BibleLessonAI backend running on http://localhost:${port}`);
});
