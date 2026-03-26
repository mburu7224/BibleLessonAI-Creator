import { DEFAULT_THEME_ID } from "../shared/slide-contract.js";

function getStoredValue(key, fallback = "") {
  if (typeof localStorage === "undefined") {
    return fallback;
  }

  return localStorage.getItem(key) || fallback;
}

export const state = {
  authToken: getStoredValue("bliauth_token", ""),
  userEmail: getStoredValue("bliauth_email", ""),
  displayName: getStoredValue("bliauth_display_name", ""),
  projectId: "",
  currentSlideIndex: 0,
  isGenerating: false,
  health: null,
  project: {
    mainTopic: "TEACH YOUR CHILDREN",
    subtopic: "",
    scriptureReading: "Deuteronomy 6.",
    memoryVerse: "Deuteronomy 6:7.",
    lessonDate: "March 7, 2026 (18 Adar)",
    themeId: DEFAULT_THEME_ID,
    suggestions: [],
    pptxUrl: "",
    rawLessonText: "",
    isPublic: true,
    slides: []
  }
};

export function setAuthSession({ token, email, displayName }) {
  state.authToken = token || "";
  state.userEmail = email || "";
  state.displayName = displayName || "";

  if (typeof localStorage === "undefined") {
    return;
  }

  if (token) {
    localStorage.setItem("bliauth_token", token);
  } else {
    localStorage.removeItem("bliauth_token");
  }

  if (email) {
    localStorage.setItem("bliauth_email", email);
  } else {
    localStorage.removeItem("bliauth_email");
  }

  if (displayName) {
    localStorage.setItem("bliauth_display_name", displayName);
  } else {
    localStorage.removeItem("bliauth_display_name");
  }
}
