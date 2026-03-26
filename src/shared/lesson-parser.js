import {
  DEFAULT_THEME_ID,
  ensureCompulsoryTitleSlide,
  normalizeSlide
} from "./slide-contract.js";

export function parseLessonToStructuredProject({
  lessonText,
  themeId = DEFAULT_THEME_ID,
  tweakPrompt = "",
  meta = {}
}) {
  const lines = String(lessonText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const explicitTopic = extractMetaValue(lines, /^(main\s*topic|topic)\s*:/i);
  const explicitDate = extractMetaValue(lines, /^(date|lesson\s*date)\s*:/i);
  const explicitSubtopic = extractMetaValue(lines, /^sub\s*topic\s*:/i);
  const detectedDateFromContent = extractDateFromContent(lines);

  const mainTopic =
    explicitTopic ||
    meta.mainTopic ||
    extractTopicFromContent(lines, null, detectedDateFromContent) ||
    "UNTITLED TOPIC";
  const lessonDate = explicitDate || meta.lessonDate || detectedDateFromContent || "No date";
  const subtopic = explicitSubtopic || meta.subtopic || "";
  const scriptureReading =
    extractMetaValue(lines, /^(scripture\s*reading|reading|scripture)\s*:/i) ||
    meta.scriptureReading ||
    "";
  const memoryVerse =
    extractMetaValue(lines, /^memory\s*verse\s*:/i) || meta.memoryVerse || "";

  const contentLines = lines.filter(
    (line) =>
      !/^(main\s*topic|topic|sub\s*topic|scripture\s*reading|reading|scripture|memory\s*verse|date|lesson\s*date)\s*:/i.test(
        line
      )
  );
  const contentScanLines = expandQuestionSegments(contentLines);

  const orderedSlides = [];
  const seenQuestions = new Set();
  const seenNotes = new Set();

  orderedSlides.push({
    type: "title",
    question: mainTopic,
    answer: lessonDate,
    notes: "",
    questionNumber: 0,
    scriptureReading: "",
    memoryVerse: "",
    themeId
  });

  if (scriptureReading || memoryVerse) {
    orderedSlides.push({
      type: "scriptureMemory",
      question: "Scripture Reading + Memory Verse",
      answer: [scriptureReading, memoryVerse].filter(Boolean).join(" | "),
      notes: "",
      questionNumber: 0,
      scriptureReading,
      memoryVerse,
      themeId
    });
  }

  const contentItems = [];
  let questionIndex = 0;
  let i = 0;

  while (i < contentScanLines.length) {
    const line = contentScanLines[i];

    if (isQuestionLine(line)) {
      const question = normalizeQuestion(line);
      const answerBucket = [];
      const inlineTail = extractTailAfterFirstQuestionMark(line);
      const immediateParts = line.split("|").map((part) => part.trim());

      if (inlineTail) {
        answerBucket.push(inlineTail);
      }

      if (immediateParts.length > 1 && !inlineTail) {
        answerBucket.push(immediateParts.slice(1).join(" "));
      }

      let j = i + 1;
      while (
        j < contentScanLines.length &&
        !isQuestionLine(contentScanLines[j]) &&
        !isSectionBreak(contentScanLines[j])
      ) {
        answerBucket.push(contentScanLines[j]);
        j += 1;
      }

      const answerRefs = extractBibleReferences(answerBucket.join(" "));
      const questionKey = question.toLowerCase();

      if (question && answerRefs.length && !seenQuestions.has(questionKey)) {
        seenQuestions.add(questionKey);
        questionIndex += 1;
        contentItems.push({
          type: "question",
          question,
          answer: answerRefs.join("; "),
          notes: "",
          questionNumber: questionIndex,
          scriptureReading: "",
          memoryVerse: "",
          themeId
        });
      }

      i = j;
      continue;
    }

    if (isSectionBreak(line)) {
      const noteBlock = [cleanNoteText(line)];
      let j = i + 1;

      while (
        j < contentScanLines.length &&
        !isQuestionLine(contentScanLines[j]) &&
        isSectionBreak(contentScanLines[j])
      ) {
        noteBlock.push(cleanNoteText(contentScanLines[j]));
        j += 1;
      }

      const noteText = noteBlock.join(" ").replace(/\s+/g, " ").trim();
      const noteKey = noteText.toLowerCase();

      if (noteText && !containsBibleReference(noteText) && !seenNotes.has(noteKey)) {
        seenNotes.add(noteKey);
        contentItems.push({
          type: "note",
          question: "Note",
          answer: "",
          notes: noteText,
          questionNumber: 0,
          scriptureReading: "",
          memoryVerse: "",
          themeId
        });
      }

      i = j;
      continue;
    }

    i += 1;
  }

  const slides = ensureCompulsoryTitleSlide(
    [...orderedSlides, ...contentItems].map((slide) => normalizeSlide(slide, themeId)),
    { mainTopic, lessonDate, themeId }
  );

  return {
    mainTopic,
    subtopic,
    scriptureReading,
    memoryVerse,
    lessonDate,
    themeId,
    suggestions: buildSuggestions(slides, tweakPrompt),
    slides
  };
}

export function buildSuggestions(slides, tweakPrompt) {
  const items = [
    `Prepared ${slides.length} slide(s) in the normalized deck format.`,
    "Items without a valid Bible reference were omitted from question slides."
  ];

  if (tweakPrompt) {
    items.push(`Editorial instruction applied: "${tweakPrompt}".`);
  }

  return items;
}

function isQuestionLine(line) {
  const raw = String(line || "").trim();
  if (!raw.includes("?")) {
    return false;
  }

  return raw.split("?")[0].trim().length > 0;
}

function isSectionBreak(line) {
  return /^(nb|note|n\.?b\.?|n\/b)\s*[:\-]/i.test(String(line || "").trim());
}

function normalizeQuestion(line) {
  const raw = String(line || "").trim();
  const idx = raw.indexOf("?");

  if (idx < 0) {
    return "";
  }

  const questionCandidate = raw.slice(0, idx).trim();
  return questionCandidate ? `${questionCandidate}?` : "";
}

function extractTailAfterFirstQuestionMark(line) {
  const raw = String(line || "");
  const idx = raw.indexOf("?");

  if (idx < 0) {
    return "";
  }

  return raw.slice(idx + 1).trim();
}

function expandQuestionSegments(lines) {
  const expanded = [];

  lines.forEach((inputLine) => {
    const line = String(inputLine || "").trim();
    if (!line) {
      return;
    }

    if (isSectionBreak(line) || !line.includes("?")) {
      expanded.push(line);
      return;
    }

    let remaining = line;
    let guard = 0;

    while (remaining.includes("?") && guard < 100) {
      const idx = remaining.indexOf("?");
      const questionPart = remaining.slice(0, idx + 1).trim();
      const tail = remaining.slice(idx + 1).trim();

      if (questionPart) {
        expanded.push(questionPart);
      }

      if (!tail) {
        break;
      }

      if (tail.includes("?")) {
        remaining = tail;
      } else {
        expanded.push(tail);
        break;
      }

      guard += 1;
    }
  });

  return expanded;
}

function cleanNoteText(line) {
  return String(line || "")
    .replace(/^(nb|note|n\.?b\.?|n\/b)\s*[:\-]\s*/i, "")
    .trim();
}

function extractBibleReferences(text) {
  const regex = /\b(?:[1-3]\s*)?[A-Za-z]+\s+\d+(?::\d+(?:-\d+)?)?\b/g;
  const matches = String(text || "").match(regex) || [];
  return [...new Set(matches.map((item) => item.trim()))];
}

function containsBibleReference(text) {
  return extractBibleReferences(text).length > 0;
}

function extractMetaValue(lines, regex) {
  const line = lines.find((item) => regex.test(item));
  return line ? line.split(":").slice(1).join(":").trim() : "";
}

function extractDateFromContent(lines) {
  const datePatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}(?:\s*\([^)]*\))?/i,
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b/i,
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        return match[0];
      }
    }
  }

  return null;
}

function extractTopicFromContent(lines, existingTopic, detectedDate) {
  if (existingTopic) {
    return existingTopic;
  }

  const skipPatterns = [
    /^date\s*:/i,
    /^lesson\s*date\s*:/i,
    /^scripture\s*reading/i,
    /^memory\s*verse/i,
    /^reading/i,
    /\?$/,
    /^(nb|note|n\/b)\s*[:\-]/i,
    /^\d{1,2}:\d{1,2}/
  ];
  const dateLower = detectedDate ? detectedDate.toLowerCase() : null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (skipPatterns.some((pattern) => pattern.test(trimmed))) {
      continue;
    }

    if (dateLower && trimmed.toLowerCase().includes(dateLower)) {
      continue;
    }

    if (/^[1-3]\s*[A-Za-z]+\s+\d+/.test(trimmed)) {
      continue;
    }

    if (trimmed.length > 2 && trimmed.length < 100) {
      return trimmed;
    }
  }

  return "";
}
