import { FieldValue } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { getAdminDb } from "./firebase.js";

function normalizeSnapshot(snapshot) {
  if (!snapshot.exists) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() };
}

export function createProjectsRepository(db = getAdminDb()) {
  const projects = db.collection(env.firebaseProjectsCollection);
  const live = db.collection(env.firebaseLiveCollection);

  return {
    async listCreatorProjects(ownerUid) {
      const snapshot = await projects.where("ownerUid", "==", ownerUid).get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async listPublicProjects() {
      const snapshot = await projects.where("isPublic", "==", true).get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async getProject(projectId) {
      const snapshot = await projects.doc(projectId).get();
      return normalizeSnapshot(snapshot);
    },

    async createProject(project) {
      const created = await projects.add({
        ...project,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      return created.id;
    },

    async updateProject(projectId, project) {
      await projects.doc(projectId).set(
        {
          ...project,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    },

    async deleteProject(projectId) {
      await projects.doc(projectId).delete();
    },

    async updateProjectPptx(projectId, pptxUrl) {
      await projects.doc(projectId).set(
        {
          pptxUrl,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    },

    async getLiveState(projectId) {
      const snapshot = await live.doc(projectId).get();
      if (!snapshot.exists) {
        return { projectId, currentSlideIndex: 0 };
      }

      return { projectId, ...snapshot.data() };
    },

    async setLiveState(projectId, payload) {
      await live.doc(projectId).set(
        {
          ...payload,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
  };
}
