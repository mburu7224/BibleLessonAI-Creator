// Shared Firebase config for both mini-projects.
// Keep secrets in env variables for production deployments.
export const firebaseConfig = {
  apiKey: "AIzaSyD_AnGX-RO7zfM_rCBopJmdv3BOVE4V-_o",
  authDomain: "media-app-a702b.firebaseapp.com",
  projectId: "media-app-a702b",
  storageBucket: "media-app-a702b.firebasestorage.app",
  messagingSenderId: "60484045851",
  appId: "1:60484045851:web:f1bb588c2d5edc177ffcbe",
  measurementId: "G-LPBXF7MLWF"
};

export const appSettings = {
  // Keep both apps on the same Firestore collection allowed by your rules.
  projectsCollection: "BibleLessonSlides",
  // Live sync is stored on the same project document (currentSlideIndex field).
  liveCollection: "BibleLessonSlides",
  defaultThemeId: 1,
  backendApiBaseUrl: "http://localhost:8787"
};
