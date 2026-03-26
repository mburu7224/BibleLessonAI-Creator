import OpenAI from "openai";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { parseLessonToStructuredProject } from "../../shared/lesson-parser.js";
import {
  DEFAULT_THEME_ID,
  SLIDE_DECK_RESPONSE_SCHEMA,
  normalizeProject
} from "../../shared/slide-contract.js";

const client = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;

export async function generateSlideDeck(input = {}) {
  const lessonText = String(input.lessonText || "").trim();

  if (!lessonText) {
    throw new HttpError(400, "Lesson text is required.");
  }

  const themeId = Number(input.themeId || DEFAULT_THEME_ID);
  const tweakPrompt = String(input.tweakPrompt || "").trim();
  const meta = {
    mainTopic: String(input.meta?.mainTopic || "").trim(),
    subtopic: String(input.meta?.subtopic || "").trim(),
    scriptureReading: String(input.meta?.scriptureReading || "").trim(),
    memoryVerse: String(input.meta?.memoryVerse || "").trim(),
    lessonDate: String(input.meta?.lessonDate || "").trim()
  };

  if (!client) {
    return normalizeProject({
      ...parseLessonToStructuredProject({ lessonText, themeId, tweakPrompt, meta }),
      rawLessonText: lessonText
    });
  }

  const systemPrompt = [
    "You transform Bible lesson text into a production-ready slide deck JSON object.",
    "Return valid JSON only, matching the supplied schema exactly.",
    "Keep the slide order faithful to the lesson flow.",
    "Always include a title slide first.",
    "Use slide types only from: title, scriptureMemory, question, note.",
    "Question slides must preserve the question text and answer with Bible references only.",
    "Note slides should capture presenter commentary with no Bible references in the answer field.",
    "Theme ID must be echoed onto every slide.",
    "Suggestions must be short, practical editorial notes."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      instruction: "Generate a slide deck from this lesson.",
      themeId,
      tweakPrompt,
      meta,
      responseContract: {
        deckFields: [
          "mainTopic",
          "subtopic",
          "scriptureReading",
          "memoryVerse",
          "lessonDate",
          "themeId",
          "suggestions",
          "slides"
        ],
        slideFields: [
          "type",
          "question",
          "answer",
          "notes",
          "questionNumber",
          "scriptureReading",
          "memoryVerse",
          "themeId"
        ]
      },
      lessonText
    },
    null,
    2
  );

  const response = await client.responses.create({
    model: env.openAiModel,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "bible_lesson_slide_deck",
        schema: SLIDE_DECK_RESPONSE_SCHEMA,
        strict: true
      }
    }
  });

  const parsedJson = safeParseJson(response.output_text);
  if (!parsedJson) {
    throw new HttpError(502, "OpenAI returned an invalid slide deck payload.");
  }

  return normalizeProject({
    ...parsedJson,
    themeId,
    rawLessonText: lessonText
  });
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
