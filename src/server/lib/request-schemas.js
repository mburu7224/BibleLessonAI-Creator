import { z } from "zod";

const booleanLikeSchema = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .transform((value) => value === true || value === "true");

const slideSchema = z.object({
  type: z.enum(["title", "scriptureMemory", "question", "note"]),
  question: z.string().max(500).default(""),
  answer: z.string().max(1000).default(""),
  notes: z.string().max(2000).default(""),
  questionNumber: z.coerce.number().int().min(0).default(0),
  scriptureReading: z.string().max(500).default(""),
  memoryVerse: z.string().max(500).default(""),
  themeId: z.coerce.number().int().min(1).max(3).default(1)
});

const projectBaseSchema = z.object({
  mainTopic: z.string().trim().min(1).max(200),
  subtopic: z.string().trim().max(200).default(""),
  scriptureReading: z.string().trim().max(300).default(""),
  memoryVerse: z.string().trim().max(300).default(""),
  lessonDate: z.string().trim().min(1).max(120),
  themeId: z.coerce.number().int().min(1).max(3).default(1),
  isPublic: booleanLikeSchema.default(true),
  rawLessonText: z.string().trim().max(25000).default(""),
  suggestions: z.array(z.string().max(300)).max(20).default([]),
  pptxUrl: z.string().trim().max(500).default(""),
  slides: z.array(slideSchema).min(1)
});

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(80)
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const generateSchema = z.object({
  lessonText: z.string().trim().min(1).max(25000),
  tweakPrompt: z.string().trim().max(500).default(""),
  themeId: z.coerce.number().int().min(1).max(3).default(1),
  meta: z
    .object({
      mainTopic: z.string().trim().max(200).default(""),
      subtopic: z.string().trim().max(200).default(""),
      scriptureReading: z.string().trim().max(300).default(""),
      memoryVerse: z.string().trim().max(300).default(""),
      lessonDate: z.string().trim().max(120).default("")
    })
    .default({})
});

export const projectSchema = projectBaseSchema;

export const liveStateSchema = z.object({
  currentSlideIndex: z.coerce.number().int().min(0)
});

export const projectIdParamsSchema = z.object({
  id: z.string().trim().min(1)
});

export const liveParamsSchema = z.object({
  projectId: z.string().trim().min(1)
});
