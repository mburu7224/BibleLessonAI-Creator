import { HttpError } from "./http-error.js";

export function assertNonEmptyString(value, message) {
  if (!String(value || "").trim()) {
    throw new HttpError(400, message);
  }
}

export function parseBoolean(value) {
  return value === true || value === "true";
}

export function sanitizeProjectInput(input = {}) {
  return {
    mainTopic: String(input.mainTopic || "").trim() || "UNTITLED TOPIC",
    subtopic: String(input.subtopic || "").trim(),
    scriptureReading: String(input.scriptureReading || "").trim(),
    memoryVerse: String(input.memoryVerse || "").trim(),
    lessonDate: String(input.lessonDate || "").trim() || "No date",
    themeId: Number(input.themeId || 1),
    isPublic: parseBoolean(input.isPublic),
    rawLessonText: String(input.rawLessonText || "").trim(),
    suggestions: Array.isArray(input.suggestions)
      ? input.suggestions.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    pptxUrl: String(input.pptxUrl || "").trim(),
    slides: Array.isArray(input.slides)
      ? input.slides.map((slide) => ({
          type: String(slide?.type || "question"),
          question: String(slide?.question || "").trim(),
          answer: String(slide?.answer || "").trim(),
          notes: String(slide?.notes || "").trim(),
          questionNumber: Number(slide?.questionNumber || 0),
          scriptureReading: String(slide?.scriptureReading || "").trim(),
          memoryVerse: String(slide?.memoryVerse || "").trim(),
          themeId: Number(slide?.themeId || input.themeId || 1)
        }))
      : []
  };
}
