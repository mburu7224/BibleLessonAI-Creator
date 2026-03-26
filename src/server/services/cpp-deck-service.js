import { spawn } from "node:child_process";
import path from "node:path";
import { HttpError } from "../lib/http-error.js";

const binaryPath = path.resolve(process.cwd(), "build", "deck_guard");

export async function buildCppExportPlan(project) {
  const payload = serializeProject(project);
  const stdout = await runCppBinary(payload);
  return parseCppResponse(stdout);
}

function runCppBinary(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, [], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new HttpError(500, "C++ export service is not built. Run `make cpp` first."));
        return;
      }

      reject(new HttpError(500, `Failed to start C++ export service: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0 && !stdout.includes("STATUS=ERROR")) {
        reject(new HttpError(500, `C++ export service failed${stderr ? `: ${stderr.trim()}` : "."}`));
        return;
      }

      resolve(stdout);
    });

    child.stdin.end(payload);
  });
}

function serializeProject(project) {
  const lines = [
    `PROJECT_MAIN_TOPIC=${hexEncode(project.mainTopic || "")}`,
    `PROJECT_LESSON_DATE=${hexEncode(project.lessonDate || "")}`,
    `PROJECT_SCRIPTURE_READING=${hexEncode(project.scriptureReading || "")}`,
    `PROJECT_MEMORY_VERSE=${hexEncode(project.memoryVerse || "")}`,
    `PROJECT_THEME_ID=${Number(project.themeId || 1)}`,
    "SLIDES_BEGIN"
  ];

  for (const slide of project.slides || []) {
    lines.push("SLIDE_BEGIN");
    lines.push(`TYPE=${String(slide.type || "question")}`);
    lines.push(`QUESTION_NUMBER=${Number(slide.questionNumber || 0)}`);
    lines.push(`THEME_ID=${Number(slide.themeId || project.themeId || 1)}`);
    lines.push(`QUESTION=${hexEncode(slide.question || "")}`);
    lines.push(`ANSWER=${hexEncode(slide.answer || "")}`);
    lines.push(`NOTES=${hexEncode(slide.notes || "")}`);
    lines.push(`SCRIPTURE=${hexEncode(slide.scriptureReading || "")}`);
    lines.push(`MEMORY=${hexEncode(slide.memoryVerse || "")}`);
    lines.push("SLIDE_END");
  }

  lines.push("END");
  return `${lines.join("\n")}\n`;
}

function parseCppResponse(output) {
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const statusLine = lines.find((line) => line.startsWith("STATUS="));
  if (statusLine !== "STATUS=OK") {
    const messageLine = lines.find((line) => line.startsWith("MESSAGE="));
    throw new HttpError(500, messageLine ? hexDecode(messageLine.slice(8)) : "C++ export service failed.");
  }

  const fingerprintLine = lines.find((line) => line.startsWith("FINGERPRINT="));
  const slides = [];
  let currentSlide = null;

  for (const line of lines) {
    if (line === "SLIDE_BEGIN") {
      currentSlide = {};
      continue;
    }

    if (line === "SLIDE_END") {
      if (currentSlide) {
        slides.push({
          type: currentSlide.TYPE || "question",
          questionNumber: Number(currentSlide.QUESTION_NUMBER || 0),
          label: hexDecode(currentSlide.LABEL || ""),
          title: hexDecode(currentSlide.TITLE || ""),
          body: hexDecode(currentSlide.BODY || "")
        });
      }
      currentSlide = null;
      continue;
    }

    if (!currentSlide) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator < 0) {
      continue;
    }
    currentSlide[line.slice(0, separator)] = line.slice(separator + 1);
  }

  return {
    fingerprint: fingerprintLine ? fingerprintLine.slice("FINGERPRINT=".length) : "",
    slides
  };
}

function hexEncode(value) {
  return Buffer.from(String(value), "utf8").toString("hex");
}

function hexDecode(value) {
  return Buffer.from(String(value), "hex").toString("utf8");
}
