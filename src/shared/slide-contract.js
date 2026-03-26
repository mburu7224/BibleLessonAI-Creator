export const THEMES = {
  1: { id: 1, label: "Standard", className: "theme-1" },
  2: { id: 2, label: "Slate", className: "theme-2" },
  3: { id: 3, label: "Stone", className: "theme-3" }
};

export const DEFAULT_THEME_ID = 1;

export const SLIDE_DECK_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "mainTopic",
    "subtopic",
    "scriptureReading",
    "memoryVerse",
    "lessonDate",
    "themeId",
    "suggestions",
    "slides"
  ],
  properties: {
    mainTopic: { type: "string" },
    subtopic: { type: "string" },
    scriptureReading: { type: "string" },
    memoryVerse: { type: "string" },
    lessonDate: { type: "string" },
    themeId: { type: "integer" },
    suggestions: {
      type: "array",
      items: { type: "string" }
    },
    slides: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "question",
          "answer",
          "notes",
          "questionNumber",
          "scriptureReading",
          "memoryVerse",
          "themeId"
        ],
        properties: {
          type: {
            type: "string",
            enum: ["title", "scriptureMemory", "question", "note"]
          },
          question: { type: "string" },
          answer: { type: "string" },
          notes: { type: "string" },
          questionNumber: { type: "integer" },
          scriptureReading: { type: "string" },
          memoryVerse: { type: "string" },
          themeId: { type: "integer" }
        }
      }
    }
  }
};

export function normalizeSlide(slide, fallbackThemeId = DEFAULT_THEME_ID) {
  return {
    type: slide?.type || "question",
    question: slide?.question || "",
    answer: slide?.answer || "",
    notes: slide?.notes || "",
    questionNumber: Number(slide?.questionNumber || 0),
    scriptureReading: slide?.scriptureReading || "",
    memoryVerse: slide?.memoryVerse || "",
    themeId: Number(slide?.themeId || fallbackThemeId || DEFAULT_THEME_ID)
  };
}

export function ensureCompulsoryTitleSlide(slides, meta) {
  const titleSlide = {
    type: "title",
    question: meta?.mainTopic || "UNTITLED TOPIC",
    answer: meta?.lessonDate || "No date",
    notes: "",
    questionNumber: 0,
    scriptureReading: "",
    memoryVerse: "",
    themeId: Number(meta?.themeId || DEFAULT_THEME_ID)
  };

  const contentSlides = (slides || []).filter((slide) => slide.type !== "title");
  let questionCounter = 0;

  return [
    titleSlide,
    ...contentSlides.map((slide) => {
      if (slide.type === "question") {
        questionCounter += 1;
        return { ...slide, questionNumber: questionCounter };
      }

      return slide;
    })
  ];
}

export function normalizeProject(project = {}) {
  const themeId = Number(project.themeId || DEFAULT_THEME_ID);

  return {
    id: project.id || "",
    mainTopic: project.mainTopic || "UNTITLED TOPIC",
    subtopic: project.subtopic || "",
    scriptureReading: project.scriptureReading || "",
    memoryVerse: project.memoryVerse || "",
    lessonDate: project.lessonDate || "No date",
    themeId,
    creatorId: project.creatorId || "",
    isPublic: Boolean(project.isPublic),
    rawLessonText: project.rawLessonText || project.lessonText || "",
    suggestions: Array.isArray(project.suggestions) ? project.suggestions.filter(Boolean) : [],
    pptxUrl: project.pptxUrl || "",
    slides: ensureCompulsoryTitleSlide(
      (project.slides || []).map((slide) => normalizeSlide(slide, themeId)),
      {
        mainTopic: project.mainTopic || "UNTITLED TOPIC",
        lessonDate: project.lessonDate || "No date",
        themeId
      }
    )
  };
}

export function buildProjectPayload(project = {}) {
  const normalized = normalizeProject(project);

  return {
    mainTopic: normalized.mainTopic,
    subtopic: normalized.subtopic,
    scriptureReading: normalized.scriptureReading,
    memoryVerse: normalized.memoryVerse,
    lessonDate: normalized.lessonDate,
    themeId: normalized.themeId,
    isPublic: normalized.isPublic,
    rawLessonText: normalized.rawLessonText,
    suggestions: normalized.suggestions,
    pptxUrl: normalized.pptxUrl,
    slides: normalized.slides.map((slide) => normalizeSlide(slide, normalized.themeId))
  };
}
