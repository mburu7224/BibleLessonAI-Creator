import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { appSettings } from "../../../firebaseConfig.js";
import { db } from "./firebase.js";

const projectsRef = collection(db, appSettings.projectsCollection);
const liveRef = collection(db, appSettings.liveCollection);

export async function listCreatorProjects(creatorId) {
  const snapshot = await getDocs(query(projectsRef, where("creatorId", "==", creatorId)));
  return snapshot.docs.map((projectDoc) => ({ id: projectDoc.id, ...projectDoc.data() }));
}

export async function listPublicProjects() {
  let snapshot;

  try {
    snapshot = await getDocs(query(projectsRef, where("isPublic", "==", true), orderBy("createdAt", "desc")));
  } catch {
    snapshot = await getDocs(query(projectsRef, where("isPublic", "==", true)));
  }

  return snapshot.docs.map((projectDoc) => ({ id: projectDoc.id, ...projectDoc.data() }));
}

export async function getProject(projectId) {
  const snapshot = await getDoc(doc(db, appSettings.projectsCollection, projectId));
  if (!snapshot.exists()) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() };
}

export async function createProject(project) {
  const payload = {
    ...project,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const created = await addDoc(projectsRef, payload);
  return created.id;
}

export async function updateProject(projectId, project) {
  await setDoc(
    doc(db, appSettings.projectsCollection, projectId),
    {
      ...project,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function deleteProject(projectId) {
  await deleteDoc(doc(db, appSettings.projectsCollection, projectId));
}

export async function updateProjectPptx(projectId, pptxUrl) {
  await updateDoc(doc(db, appSettings.projectsCollection, projectId), {
    pptxUrl,
    updatedAt: serverTimestamp()
  });
}

export async function getLiveState(projectId) {
  const snapshot = await getDoc(doc(liveRef, projectId));
  if (!snapshot.exists()) {
    return { projectId, currentSlideIndex: 0 };
  }

  return { projectId, ...snapshot.data() };
}

export async function setLiveState(projectId, payload) {
  await setDoc(
    doc(liveRef, projectId),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
