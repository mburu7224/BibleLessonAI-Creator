import { DEFAULT_THEME_ID } from "../shared/slide-contract.js";

function getStoredValue(key, fallback = "") {
  if (typeof localStorage === "undefined") {
    return fallback;
  }

  return localStorage.getItem(key) || fallback;
}

export const state = {
  authToken: getStoredValue("bliauth_token", ""),
  creatorId: getStoredValue("bliauth_creator", "user123"),
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

export function setAuthSession({ token, creatorId }) {
  state.authToken = token || "";
  state.creatorId = creatorId || "";

  if (typeof localStorage === "undefined") {
    return;
  }

  if (token) {
    localStorage.setItem("bliauth_token", token);
  } else {
    localStorage.removeItem("bliauth_token");
  }

  if (creatorId) {
    localStorage.setItem("bliauth_creator", creatorId);
  } else {
    localStorage.removeItem("bliauth_creator");
  }
}
