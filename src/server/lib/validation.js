export function sanitizeProjectInput(input = {}) {
  return {
    mainTopic: String(input.mainTopic || "").trim(),
    subtopic: String(input.subtopic || "").trim(),
    scriptureReading: String(input.scriptureReading || "").trim(),
    memoryVerse: String(input.memoryVerse || "").trim(),
    lessonDate: String(input.lessonDate || "").trim(),
    themeId: Number(input.themeId || 1),
    isPublic: Boolean(input.isPublic),
    rawLessonText: String(input.rawLessonText || "").trim(),
    suggestions: Array.isArray(input.suggestions) ? input.suggestions : [],
    pptxUrl: String(input.pptxUrl || "").trim(),
    slides: Array.isArray(input.slides) ? input.slides : []
  };
}
