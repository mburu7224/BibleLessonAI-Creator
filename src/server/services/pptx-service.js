import fs from "node:fs/promises";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { env } from "../config/env.js";
import { buildCppExportPlan } from "./cpp-deck-service.js";

const generatedDir = path.resolve(process.cwd(), "generated");

export async function createPresentationFile(project) {
  await fs.mkdir(generatedDir, { recursive: true });
  const exportPlan = await buildCppExportPlan(project);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Lesson Slides Studio";
  pptx.company = "Lesson Slides Studio";
  pptx.subject = project.mainTopic;
  pptx.title = `${project.mainTopic} - Lesson Slides Studio`;
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US"
  };

  const palette = getPalette(project.themeId);

  for (const [index, slide] of project.slides.entries()) {
    const cppSlide = exportPlan.slides[index];
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: palette.background };
    pptSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.55,
      fill: { color: palette.accent }
    });

    pptSlide.addText(project.mainTopic, {
      x: 0.6,
      y: 0.35,
      w: 8.8,
      h: 0.4,
      fontFace: "Aptos Display",
      fontSize: 22,
      color: palette.heading,
      bold: true
    });

    pptSlide.addText(project.lessonDate, {
      x: 9.7,
      y: 0.38,
      w: 2.9,
      h: 0.3,
      fontSize: 10,
      color: palette.muted,
      align: "right"
    });

    if (slide.type === "title") {
      pptSlide.addText(cppSlide?.title || slide.question || project.mainTopic, {
        x: 1.0,
        y: 1.6,
        w: 11.2,
        h: 1.0,
        fontFace: "Aptos Display",
        fontSize: 26,
        bold: true,
        color: palette.heading,
        align: "center"
      });
      pptSlide.addText(cppSlide?.body || slide.answer || project.lessonDate, {
        x: 1.2,
        y: 3.0,
        w: 10.8,
        h: 0.6,
        fontSize: 18,
        color: palette.accent,
        bold: true,
        align: "center"
      });
      continue;
    }

    pptSlide.addText(cppSlide?.label || labelForSlide(slide), {
      x: 0.7,
      y: 1.1,
      w: 2.2,
      h: 0.35,
      fontSize: 10,
      color: "FFFFFF",
      bold: true,
      fill: { color: palette.accent },
      margin: 0.08
    });

    pptSlide.addText(cppSlide?.title || slide.question || "Untitled", {
      x: 0.8,
      y: 1.6,
      w: 11.7,
      h: 1.2,
      fontFace: "Aptos Display",
      fontSize: 22,
      bold: true,
      color: palette.heading
    });

    const bodyText =
      cppSlide?.body ||
      (slide.type === "note"
        ? slide.notes || ""
        : slide.type === "scriptureMemory"
          ? [project.scriptureReading, project.memoryVerse].filter(Boolean).join("\n\n")
          : slide.answer || "");

    pptSlide.addText(bodyText || " ", {
      x: 0.9,
      y: 3.0,
      w: 11.4,
      h: 2.8,
      fontSize: 18,
      color: palette.body,
      breakLine: false,
      valign: "mid",
      margin: 0.15,
      fill: { color: "FFFFFF", transparency: 4 },
      line: { color: palette.border, pt: 1.2 },
      radius: 0.08
    });
  }

  const safeFileName = `${slugify(project.mainTopic || "lesson")}-${exportPlan.fingerprint || Date.now()}.pptx`;
  const absolutePath = path.join(generatedDir, safeFileName);
  await pptx.writeFile({ fileName: absolutePath });

  return {
    absolutePath,
    publicUrl: `${env.apiBaseUrl}/generated/${safeFileName}`
  };
}

function labelForSlide(slide) {
  if (slide.type === "question") {
    return `QUESTION ${slide.questionNumber || ""}`.trim();
  }

  if (slide.type === "scriptureMemory") {
    return "SCRIPTURE + MEMORY";
  }

  return "NOTE";
}

function slugify(value) {
  return String(value || "lesson")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getPalette(themeId) {
  if (Number(themeId) === 2) {
    return {
      background: "FFF8E9",
      accent: "666666",
      heading: "1F1F1F",
      body: "404040",
      border: "CFCFCF",
      muted: "757575"
    };
  }

  if (Number(themeId) === 3) {
    return {
      background: "F3F4EE",
      accent: "595959",
      heading: "202020",
      body: "3E3E3E",
      border: "C7C7C7",
      muted: "6F6F6F"
    };
  }

  return {
    background: "F3F7FF",
    accent: "4D4D4D",
    heading: "1E1E1E",
    body: "3B3B3B",
    border: "C9C9C9",
    muted: "707070"
  };
}
