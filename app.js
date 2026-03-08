import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  getDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { firebaseConfig, appSettings } from "./firebaseConfig.js";

const THEMES = {
  1: { id: 1, label: "Royal Blue", className: "theme-1" },
  2: { id: 2, label: "Sunrise Gold", className: "theme-2" },
  3: { id: 3, label: "Olive Stone", className: "theme-3" }
};
const TEST_ADMIN_KEY = "NewRuiruMediaKey2025!";

const sampleLessonText = [
  "Lesson for March 7, 2026 (18 Adar)",
  "TEACH YOUR CHILDREN",
  "Scripture Reading: Deuteronomy 6.",
  "Memory verse: Deuteronomy 6:7.",
  "What was said of Abraham? Genesis 18:19.",
  "What did Moses teach Israel to do? Deut. 6:4-5.",
  "In turn, what were the Israelites to do? Deuteronomy 6:6-9.",
  "What else is to be taught? Deuteronomy 6:20-23.",
  "NOTE: Remember, Egypt represents sin, and as such the Lord is willing to deliver us from the \"bonds of Egypt\" and allow us to enter the promised land, the New Jerusalem.",
  "In teaching our children, what should we tell them about sin? Romans 3:23.",
  "What was part of Yashua's mission? Luke 5:31-32.",
  "Who leads us to repentance? Romans 2:1-4; Philippians 2:13.",
  "After being called to repentance, what are we expected to do? Acts 2:37-39; Romans 2:11-13.",
  "How does Paul exhort the brethren? Rom. 12:1-2.",
  "What else are we to teach our children? 1 John 2:15-17."
].join("\n");

const state = {
  projectId: null,
  currentSlideIndex: 0,
  isGenerating: false,
  project: {
    mainTopic: "TEACH YOUR CHILDREN",
    subtopic: "",
    scriptureReading: "Deuteronomy 6.",
    memoryVerse: "Deuteronomy 6:7.",
    lessonDate: "March 7, 2026 (18 Adar)",
    themeId: 1,
    suggestions: [],
    pptxUrl: "",
    // Required normalized shape used in slide generation and Firebase saving.
    // slides = [{ type, question, answer, notes, themeId }, ...]
    slides: []
  }
};

const refs = {
  apiStatus: document.getElementById("apiStatus"),
  creatorStatus: document.getElementById("creatorStatus"),
  lessonTextInput: document.getElementById("lessonTextInput"),
  mainTopicInput: document.getElementById("mainTopicInput"),
  subtopicInput: document.getElementById("subtopicInput"),
  scriptureReadingInput: document.getElementById("scriptureReadingInput"),
  memoryVerseInput: document.getElementById("memoryVerseInput"),
  lessonDateInput: document.getElementById("lessonDateInput"),
  creatorIdInput: document.getElementById("creatorIdInput"),
  isPublicSelect: document.getElementById("isPublicSelect"),
  themeSelect: document.getElementById("themeSelect"),
  savedProjectsSelect: document.getElementById("savedProjectsSelect"),
  savedLessonsSection: document.getElementById("savedLessonsSection"),
  savedLessonsContainer: document.getElementById("savedLessonsContainer"),
  projectsSection: document.getElementById("projectsSection"),
  projectsListContainer: document.getElementById("projectsListContainer"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  generateBtn: document.getElementById("generateBtn"),
  redesignBtn: document.getElementById("redesignBtn"),
  saveBtn: document.getElementById("saveBtn"),
  refreshProjectsBtn: document.getElementById("refreshProjectsBtn"),
  generatedSlidesContainer: document.getElementById("generatedSlidesContainer"),
  prevSlideBtn: document.getElementById("prevSlideBtn"),
  nextSlideBtn: document.getElementById("nextSlideBtn"),
  sendLiveBtn: document.getElementById("sendLiveBtn"),
  generatePptxBtn: document.getElementById("generatePptxBtn"),
  tweakInput: document.getElementById("tweakInput"),
  suggestionsList: document.getElementById("suggestionsList"),
  slidesList: document.getElementById("slidesList"),
  thinkingWrap: document.getElementById("thinkingWrap"),
  thinkingOverlay: document.getElementById("thinkingOverlay"),
  // Modal elements
  editModal: document.getElementById("editModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  saveEditBtn: document.getElementById("saveEditBtn"),
  modalMainTopic: document.getElementById("modalMainTopic"),
  modalSubtopic: document.getElementById("modalSubtopic"),
  modalScriptureReading: document.getElementById("modalScriptureReading"),
  modalMemoryVerse: document.getElementById("modalMemoryVerse"),
  modalLessonDate: document.getElementById("modalLessonDate"),
  modalCreatorId: document.getElementById("modalCreatorId"),
  modalThemeSelect: document.getElementById("modalThemeSelect"),
  modalIsPublic: document.getElementById("modalIsPublic"),
  modalLessonContent: document.getElementById("modalLessonContent")
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

initialize();

async function initialize() {
  refs.lessonTextInput.value = sampleLessonText;
  bindEvents();
  loadSampleProject();
  await checkApiHealth();
  await refreshCreatorProjects();
  await renderSavedLessons();
}

function bindEvents() {
  refs.loadSampleBtn.addEventListener("click", loadSampleProject);
  refs.generateBtn.addEventListener("click", generateSlidesWithAi);
  refs.redesignBtn.addEventListener("click", applyThemeRedesign);
  refs.saveBtn.addEventListener("click", saveProject);
  refs.refreshProjectsBtn.addEventListener("click", () => {
    refreshCreatorProjects();
    renderSavedLessons();
  });
  refs.savedProjectsSelect.addEventListener("change", loadSelectedProject);
  refs.prevSlideBtn.addEventListener("click", () => moveSlide(-1));
  refs.nextSlideBtn.addEventListener("click", () => moveSlide(1));
  refs.sendLiveBtn.addEventListener("click", sendLiveIndex);
  refs.generatePptxBtn.addEventListener("click", generatePptx);

  // Modal event listeners
  refs.closeModalBtn.addEventListener("click", closeEditModal);
  refs.cancelEditBtn.addEventListener("click", closeEditModal);
  refs.saveEditBtn.addEventListener("click", saveLessonEdit);
  refs.editModal.addEventListener("click", (e) => {
    if (e.target === refs.editModal) {
      closeEditModal();
    }
  });

  refs.mainTopicInput.addEventListener("input", syncMetaFromInputsAndRender);
  refs.subtopicInput.addEventListener("input", syncMetaFromInputsAndRender);
  refs.scriptureReadingInput.addEventListener("input", syncMetaFromInputsAndRender);
  refs.memoryVerseInput.addEventListener("input", syncMetaFromInputsAndRender);
  refs.lessonDateInput.addEventListener("input", syncMetaFromInputsAndRender);
}

function loadSampleProject() {
  refs.lessonTextInput.value = sampleLessonText;
  refs.themeSelect.value = "1";
  refs.tweakInput.value = "";

  const parsed = parseLessonToStructuredProject({
    lessonText: sampleLessonText,
    themeId: 1,
    tweakPrompt: ""
  });

  hydrateProjectFromParsed(parsed);
  state.projectId = null;
  setStatus("Sample lesson loaded.");
}

async function generateSlidesWithAi() {
  const lessonText = refs.lessonTextInput.value.trim();
  if (!lessonText) {
    setStatus("Paste lesson text first.");
    return;
  }

  const themeId = Number(refs.themeSelect.value || appSettings.defaultThemeId);
  const tweakPrompt = refs.tweakInput.value.trim();

  setGenerating(true);
  try {
    // Placeholder for server-side AI integration:
    // Replace this call with an LLM API request and return the same object structure.
    const parsed = await runAiLessonParser({ lessonText, themeId, tweakPrompt });
    hydrateProjectFromParsed(parsed);
    setStatus(`Generated ${state.project.slides.length} slide(s) using parsing rules.`);
  } catch (error) {
    console.error(error);
    setStatus(`Generation failed: ${error.message}`);
  } finally {
    setGenerating(false);
  }
}

async function runAiLessonParser({ lessonText, themeId, tweakPrompt }) {
  await delay(850);
  return parseLessonToStructuredProject({ lessonText, themeId, tweakPrompt });
}

function parseLessonToStructuredProject({ lessonText, themeId, tweakPrompt }) {
  const lines = lessonText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Extract metadata using explicit markers first
  const explicitTopic = extractMetaValue(lines, /^(main\s*topic|topic)\s*:/i);
  const explicitDate = extractMetaValue(lines, /^(date|lesson\s*date)\s*:/i);
  const explicitSubtopic = extractMetaValue(lines, /^sub\s*topic\s*:/i);

  // Use explicit values, then try to extract from content, finally fall back to input fields
  // First extract date from content to use for topic detection (to skip date lines)
  const detectedDateFromContent = extractDateFromContent(lines);
  const mainTopic = explicitTopic || extractTopicFromContent(lines, null, detectedDateFromContent) || refs.mainTopicInput.value.trim();
  const lessonDate = explicitDate || detectedDateFromContent || refs.lessonDateInput.value.trim();
  const subtopic = explicitSubtopic || refs.subtopicInput.value.trim() || "";
  const scriptureReading = extractMetaValue(lines, /^(scripture\s*reading|reading|scripture)\s*:/i) || refs.scriptureReadingInput.value.trim() || "";
  const memoryVerse = extractMetaValue(lines, /^memory\s*verse\s*:/i) || refs.memoryVerseInput.value.trim() || "";

  if (!mainTopic || !lessonDate) {
    throw new Error("Main Topic and Date are compulsory for the cover slide.");
  }

  // Strip metadata lines from content body before Q/A + Note parsing.
  const contentLines = lines.filter(
    (line) => !/^(main\s*topic|topic|sub\s*topic|scripture\s*reading|reading|scripture|memory\s*verse|date|lesson\s*date)\s*:/i.test(line)
  );
  const contentScanLines = expandQuestionSegments(contentLines);

  const orderedSlides = [];
  const seenQuestions = new Set();
  const seenNotes = new Set();

  // Compulsory first slide: Date + Main Topic only.
  orderedSlides.push({
    type: "title",
    question: mainTopic,
    answer: lessonDate,
    notes: "",
    themeId
  });

  // Rule: Scripture Reading + Memory Verse are twins on one slide.
  // If one is missing, render only what exists.
  if (scriptureReading || memoryVerse) {
    orderedSlides.push({
      type: "scriptureMemory",
      question: "Scripture Reading + Memory Verse",
      answer: [scriptureReading, memoryVerse].filter(Boolean).join(" | "),
      notes: "",
      scriptureReading,
      memoryVerse,
      themeId
    });
  }

  // Process content sequentially to preserve order: Questions and Notes in original positions
  // We'll collect items and add them in order
  const contentItems = [];
  let questionIndex = 0;

  // Rule: Questions must end with '?'.
  // Rule: Everything after a question until next question or section break is answer.
  // Rule: Keep only Bible-reference-like content in answer output.
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
      while (j < contentScanLines.length && !isQuestionLine(contentScanLines[j]) && !isSectionBreak(contentScanLines[j])) {
        const candidate = contentScanLines[j];
        answerBucket.push(candidate);
        j += 1;
      }

      const answerRefs = extractBibleReferences(answerBucket.join(" "));
      const questionKey = question.toLowerCase();

      if (question && answerRefs.length && !seenQuestions.has(questionKey)) {
        seenQuestions.add(questionKey);
        questionIndex++;
        contentItems.push({
          type: "question",
          question,
          answer: answerRefs.join("; "),
          notes: "",
          questionNumber: questionIndex,
          themeId
        });
      }

      i = j;
      continue;
    }

    // Rule: Only detect notes when they explicitly start with NOTE:, NB:, or N.B.
    // Do NOT use isLikelyNoteLine as it's too aggressive
    if (isSectionBreak(line)) {
      const noteBlock = [cleanNoteText(line)];
      let j = i + 1;
      // Only continue collecting note lines if they also start with NB/NOTE
      while (
        j < contentScanLines.length &&
        !isQuestionLine(contentScanLines[j]) &&
        isSectionBreak(contentScanLines[j])
      ) {
        noteBlock.push(cleanNoteText(contentScanLines[j]));
        j += 1;
      }

      const noteText = noteBlock
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const noteKey = noteText.toLowerCase();

      if (noteText && !containsBibleReference(noteText) && !seenNotes.has(noteKey)) {
        seenNotes.add(noteKey);
        // Add note to content items in the exact position it appears in the lesson
        contentItems.push({
          type: "note",
          question: "Note",
          answer: "",
          notes: noteText,
          questionNumber: 0,
          themeId
        });
      }

      i = j;
      continue;
    }

    i += 1;
  }

  // Add all content items (questions and notes) in the order they appeared in the lesson
  // This preserves the note placement between questions
  for (const item of contentItems) {
    orderedSlides.push(item);
  }

  const slides = orderedSlides;

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

function hydrateProjectFromParsed(parsed) {
  state.project.mainTopic = parsed.mainTopic || "UNTITLED TOPIC";
  state.project.subtopic = parsed.subtopic || "";
  state.project.scriptureReading = parsed.scriptureReading || "";
  state.project.memoryVerse = parsed.memoryVerse || "";
  state.project.lessonDate = parsed.lessonDate || "No date";
  state.project.themeId = Number(parsed.themeId || appSettings.defaultThemeId);
  state.project.suggestions = parsed.suggestions || [];
  state.project.slides = ensureCompulsoryTitleSlide(
    (parsed.slides || []).map((slide) => normalizeSlide(slide, state.project.themeId)),
    {
      mainTopic: state.project.mainTopic,
      lessonDate: state.project.lessonDate,
      themeId: state.project.themeId
    }
  );
  state.currentSlideIndex = 0;

  refs.mainTopicInput.value = state.project.mainTopic;
  refs.subtopicInput.value = state.project.subtopic;
  refs.scriptureReadingInput.value = state.project.scriptureReading;
  refs.memoryVerseInput.value = state.project.memoryVerse;
  refs.lessonDateInput.value = state.project.lessonDate;
  refs.themeSelect.value = String(state.project.themeId);

  renderAll();
}

function normalizeSlide(slide, fallbackThemeId) {
  return {
    type: slide.type || "question",
    question: slide.question || "Untitled",
    answer: slide.answer || "",
    notes: slide.notes || "",
    questionNumber: Number(slide.questionNumber || 0),
    scriptureReading: slide.scriptureReading || "",
    memoryVerse: slide.memoryVerse || "",
    themeId: Number(slide.themeId || fallbackThemeId || appSettings.defaultThemeId)
  };
}

function ensureCompulsoryTitleSlide(slides, meta) {
  const titleSlide = {
    type: "title",
    question: meta.mainTopic || "UNTITLED TOPIC",
    answer: meta.lessonDate || "No date",
    notes: "",
    themeId: Number(meta.themeId || appSettings.defaultThemeId)
  };

  // Filter out any existing title slide to avoid duplicates
  const contentSlides = (slides || []).filter((slide) => slide.type !== "title");
  
  // Renumber questions while preserving their original order in the lesson flow
  let questionCounter = 0;
  const orderedContent = contentSlides.map((slide) => {
    if (slide.type === "question") {
      questionCounter++;
      return { ...slide, questionNumber: questionCounter };
    }
    return slide;
  });

  // PRESERVE the exact order from parsing - do NOT reorder!
  return [titleSlide, ...orderedContent];
}

function renderAll() {
  renderGeneratedSlides();
  renderSlidesList();
  renderSuggestions();
  setActiveGeneratedSlide(state.currentSlideIndex, { scroll: false });
}

function renderGeneratedSlides() {
  refs.generatedSlidesContainer.innerHTML = "";
  if (!state.project.slides.length) {
    const empty = document.createElement("div");
    empty.className = "empty-preview";
    empty.textContent = "No slides yet. Click Generate Slides.";
    refs.generatedSlidesContainer.appendChild(empty);
    return;
  }

  const total = state.project.slides.length;
  state.project.slides.forEach((slide, index) => {
    const slideEl = createLayeredSlideElement({
      slide,
      index,
      total,
      mainTopic: refs.mainTopicInput.value.trim() || state.project.mainTopic,
      subtopic: refs.subtopicInput.value.trim(),
      lessonDate: refs.lessonDateInput.value.trim() || state.project.lessonDate,
      scriptureReading: refs.scriptureReadingInput.value.trim() || state.project.scriptureReading,
      memoryVerse: refs.memoryVerseInput.value.trim() || state.project.memoryVerse
    });
    refs.generatedSlidesContainer.appendChild(slideEl);
  });
}

function createLayeredSlideElement({ slide, index, total, mainTopic, subtopic, lessonDate, scriptureReading, memoryVerse }) {
  const themeClass = THEMES[slide.themeId]?.className || THEMES[1].className;
  const wrapper = document.createElement("article");
  wrapper.className = `slide-stage ${themeClass} slide-enter`;
  wrapper.dataset.index = String(index);

  if (slide.type === "title") {
    wrapper.classList.add("title-slide");
    wrapper.innerHTML = `
      <div class="layer layer-base"></div>
      <div class="layer layer-content title-slide-content">
        <p class="title-slide-date">${escapeHtml(lessonDate)}</p>
        <h1 class="title-slide-topic">${escapeHtml(mainTopic)}</h1>
      </div>
    `;

    wrapper.addEventListener("click", () => {
      state.currentSlideIndex = index;
      renderSlidesList();
      setActiveGeneratedSlide(index, { scroll: false });
    });

    return wrapper;
  }

  const subtopicBlock = subtopic
    ? `
      <div>
        <p class="meta-label">Subtopic</p>
        <h4 class="slide-subtopic">${escapeHtml(subtopic)}</h4>
      </div>
    `
    : "";

  const contentMarkup = buildSlideContentMarkup({
    slide,
    index,
    scriptureReading,
    memoryVerse
  });

  wrapper.innerHTML = `
    <div class="layer layer-base"></div>
    <div class="layer layer-geometry">
      <div class="shape rect rect-top"></div>
      <div class="shape rect rect-bottom"></div>
      <div class="shape tri tri-left"></div>
      <div class="shape tri tri-right"></div>
      <div class="shape slash slash-a"></div>
      <div class="shape slash slash-b"></div>
    </div>
    <div class="layer layer-content">
      <header class="slide-meta ${subtopic ? "" : "slide-meta-no-subtopic"}">
        <div>
          <p class="meta-label">Main Topic</p>
          <h3 class="slide-main-topic">${escapeHtml(mainTopic)}</h3>
        </div>
        ${subtopicBlock}
        <div>
          <p class="meta-label">Date</p>
          <h4 class="slide-date">${escapeHtml(lessonDate)}</h4>
        </div>
      </header>
      ${contentMarkup}
    </div>
    <div class="layer layer-overlay">
      <div class="flourish flourish-1"></div>
      <div class="flourish flourish-2"></div>
      <p class="counter">Slide ${index + 1} / ${total}</p>
    </div>
  `;

  wrapper.addEventListener("click", () => {
    state.currentSlideIndex = index;
    renderSlidesList();
    setActiveGeneratedSlide(index, { scroll: false });
  });

  return wrapper;
}

function buildSlideContentMarkup({ slide, index, scriptureReading, memoryVerse }) {
  if (slide.type === "scriptureMemory") {
    const twinScripture = slide.scriptureReading || scriptureReading;
    const twinMemory = slide.memoryVerse || memoryVerse;
    const twinBoxes = [];
    if (twinScripture) {
      twinBoxes.push(`
        <div class="answer-box">
          <p class="box-title">Scripture Reading</p>
          <p class="slide-answer">${escapeHtml(twinScripture)}</p>
        </div>
      `);
    }
    if (twinMemory) {
      twinBoxes.push(`
        <div class="notes-box">
          <p class="box-title">Memory Verse</p>
          <p class="slide-notes">${escapeHtml(twinMemory)}</p>
        </div>
      `);
    }

    return `
      <div class="question-wrap">
        <div class="question-number">SM</div>
        <div class="question-box highlight-box">
          <p class="type-badge">SCRIPTURE + MEMORY</p>
          <h2 class="slide-question">Scripture Reading and Memory Verse</h2>
        </div>
      </div>
      <div class="twin-box-grid">
        ${twinBoxes.join("")}
      </div>
    `;
  }

  if (slide.type === "note") {
    return `
      <div class="note-slide-header">
        <p class="type-badge">NOTE</p>
        <h2 class="slide-question">Presenter Note</h2>
      </div>
      <div class="note-only-box">
        <p class="slide-notes">${escapeHtml(slide.notes || "")}</p>
      </div>
    `;
  }

  const qNumber = slide.questionNumber ? `Q${slide.questionNumber}` : `Q${index + 1}`;
  return `
    <div class="question-wrap">
      <div class="question-number">${escapeHtml(qNumber)}</div>
      <div class="question-box highlight-box">
        <p class="type-badge">QUESTION</p>
        <h2 class="slide-question">${escapeHtml(slide.question)}</h2>
      </div>
    </div>
    <div class="answer-box">
      <p class="box-title">Answer (Bible Reference)</p>
      <p class="slide-answer">${escapeHtml(slide.answer)}</p>
    </div>
  `;
}

function renderSlidesList() {
  refs.slidesList.innerHTML = "";
  state.project.slides.forEach((slide, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `slide-item ${index === state.currentSlideIndex ? "active" : ""}`;
    const leading = slide.type === "question" ? `Q${slide.questionNumber || "?"}` : `#${String(index + 1).padStart(2, "0")}`;
    item.innerHTML = `
      <strong>${escapeHtml(leading)} ${escapeHtml(slide.type.toUpperCase())}</strong>
      <p>${escapeHtml(slide.question || "Note")}</p>
      <small>${escapeHtml(slide.answer || slide.notes || "")}</small>
    `;
    item.addEventListener("click", () => {
      state.currentSlideIndex = index;
      renderSlidesList();
      setActiveGeneratedSlide(index, { scroll: true });
    });
    refs.slidesList.appendChild(item);
  });
}

function renderSuggestions() {
  refs.suggestionsList.innerHTML = "";
  (state.project.suggestions || []).forEach((suggestion) => {
    const li = document.createElement("li");
    li.textContent = suggestion;
    refs.suggestionsList.appendChild(li);
  });
}

function setActiveGeneratedSlide(index, { scroll }) {
  const slides = [...refs.generatedSlidesContainer.querySelectorAll(".slide-stage")];
  if (!slides.length) {
    refs.prevSlideBtn.disabled = true;
    refs.nextSlideBtn.disabled = true;
    return;
  }

  slides.forEach((slideEl, i) => slideEl.classList.toggle("active", i === index));
  if (scroll && slides[index]) {
    slides[index].scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  refs.prevSlideBtn.disabled = index <= 0;
  refs.nextSlideBtn.disabled = index >= slides.length - 1;
}

function moveSlide(delta) {
  const max = Math.max(0, state.project.slides.length - 1);
  const next = Math.max(0, Math.min(max, state.currentSlideIndex + delta));
  if (next === state.currentSlideIndex) {
    return;
  }
  state.currentSlideIndex = next;
  renderSlidesList();
  setActiveGeneratedSlide(next, { scroll: true });
}

function applyThemeRedesign() {
  const themeId = Number(refs.themeSelect.value || appSettings.defaultThemeId);
  state.project.themeId = themeId;
  state.project.slides = state.project.slides.map((slide) => ({ ...slide, themeId }));
  renderAll();
  setStatus(`Theme redesigned: ${THEMES[themeId]?.label || "Selected Theme"}`);
}

function syncMetaFromInputsAndRender() {
  state.project.mainTopic = refs.mainTopicInput.value.trim() || state.project.mainTopic;
  state.project.subtopic = refs.subtopicInput.value.trim();
  state.project.scriptureReading = refs.scriptureReadingInput.value.trim() || state.project.scriptureReading;
  state.project.memoryVerse = refs.memoryVerseInput.value.trim() || state.project.memoryVerse;
  state.project.lessonDate = refs.lessonDateInput.value.trim() || state.project.lessonDate;
  state.project.slides = ensureCompulsoryTitleSlide(state.project.slides, {
    mainTopic: state.project.mainTopic,
    lessonDate: state.project.lessonDate,
    themeId: Number(refs.themeSelect.value || state.project.themeId || appSettings.defaultThemeId)
  });
  renderGeneratedSlides();
  setActiveGeneratedSlide(state.currentSlideIndex, { scroll: false });
}

async function saveProject() {
  if (!state.project.slides.length) {
    setStatus("Generate slides first before saving.");
    return;
  }

  const payload = {
    adminKey: TEST_ADMIN_KEY,
    mainTopic: refs.mainTopicInput.value.trim() || "UNTITLED TOPIC",
    subtopic: refs.subtopicInput.value.trim() || "",
    scriptureReading: refs.scriptureReadingInput.value.trim() || "",
    memoryVerse: refs.memoryVerseInput.value.trim() || "",
    lessonDate: refs.lessonDateInput.value.trim() || "No date",
    slides: state.project.slides.map((slide) => ({
      type: slide.type,
      questionNumber: slide.questionNumber || 0,
      question: slide.question,
      answer: slide.answer,
      notes: slide.notes,
      scriptureReading: slide.scriptureReading || "",
      memoryVerse: slide.memoryVerse || "",
      themeId: slide.themeId
    })),
    themeId: Number(refs.themeSelect.value || appSettings.defaultThemeId),
    creatorId: refs.creatorIdInput.value.trim() || "user123",
    createdAt: serverTimestamp(),
    isPublic: refs.isPublicSelect.value === "true",
    pptxUrl: state.project.pptxUrl || "",
    suggestions: state.project.suggestions || []
  };

  try {
    // Always create a NEW entry - never overwrite existing
    const created = await addDoc(collection(db, appSettings.projectsCollection), payload);
    state.projectId = created.id;
    setStatus("New lesson saved successfully!");
    
    // Show projects list below confirmation
    await refreshCreatorProjects();
    await renderSavedLessons();
    refs.projectsSection.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    setStatus(`Save failed [${error?.code || "unknown"}]: ${error.message}`);
  }
}

async function refreshCreatorProjects() {
  refs.savedProjectsSelect.innerHTML = `<option value="">-- load existing --</option>`;
  const creatorId = refs.creatorIdInput.value.trim() || "user123";

  try {
    const q = query(collection(db, appSettings.projectsCollection), where("creatorId", "==", creatorId));
    const snapshot = await getDocs(q);
    
    // Populate dropdown
    snapshot.docs.forEach((projectDoc) => {
      const data = projectDoc.data();
      const option = document.createElement("option");
      option.value = projectDoc.id;
      option.textContent = `${data.mainTopic || "Untitled"} | ${data.lessonDate || "No date"}`;
      refs.savedProjectsSelect.appendChild(option);
    });
    
    // Populate cards list
    refs.projectsListContainer.innerHTML = "";
    if (snapshot.docs.length === 0) {
      refs.projectsListContainer.innerHTML = "<p class='muted'>No projects found.</p>";
    }
    
    snapshot.docs.forEach((projectDoc) => {
      const data = projectDoc.data();
      const projectCard = document.createElement("div");
      projectCard.className = `project-card ${state.projectId === projectDoc.id ? "active" : ""}`;
      projectCard.innerHTML = `
        <p class="project-card-topic">${escapeHtml(data.mainTopic || "Untitled")}</p>
        <p class="project-card-date">${escapeHtml(data.lessonDate || "No date")}</p>
        <div class="project-card-actions">
          <button class="edit-btn" data-id="${projectDoc.id}">Edit</button>
          <button class="delete-btn" data-id="${projectDoc.id}">Delete</button>
        </div>
      `;
      
      // Edit button
      projectCard.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        loadSelectedProjectById(projectDoc.id);
      });
      
      // Delete button
      projectCard.querySelector(".delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this project?")) {
          deleteProject(projectDoc.id);
        }
      });
      
      refs.projectsListContainer.appendChild(projectCard);
    });
    
    if (!snapshot.docs.length) {
      setStatus("No projects found for this creator yet.");
    }
  } catch (error) {
    console.error(error);
    setStatus(`Could not load projects: ${error.message}`);
  }
}

// Render Saved Bible Lessons - YouTube-style container
async function renderSavedLessons() {
  const creatorId = refs.creatorIdInput.value.trim() || "user123";
  
  try {
    const q = query(collection(db, appSettings.projectsCollection), where("creatorId", "==", creatorId));
    const snapshot = await getDocs(q);
    
    refs.savedLessonsContainer.innerHTML = "";
    
    if (snapshot.docs.length === 0) {
      refs.savedLessonsContainer.innerHTML = "<p class='muted'>No saved lessons yet.</p>";
      return;
    }
    
    // Helper function to parse date from lesson date string
    const parseLessonDate = (dateStr) => {
      if (!dateStr) return null;
      // Try parsing various date formats
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    };
    
    // Get today's date (normalized to midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Collect all lessons with their parsed dates
    const lessonsWithDates = snapshot.docs.map((projectDoc) => {
      const data = projectDoc.data();
      const lessonDate = parseLessonDate(data.lessonDate);
      return {
        doc: projectDoc,
        data: data,
        lessonDate: lessonDate,
        // Calculate days difference from today (if date exists)
        daysDiff: lessonDate ? Math.round((lessonDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
      };
    });
    
    // Sort lessons chronologically:
    // 1. Current/upcoming lesson (nearest to today) first
    // 2. Past lessons in descending order (most recent first)
    // 3. Future lessons in ascending order
    lessonsWithDates.sort((a, b) => {
      // Handle lessons without dates - put them at the end
      if (a.daysDiff === null && b.daysDiff === null) return 0;
      if (a.daysDiff === null) return 1;
      if (b.daysDiff === null) return -1;
      
      // Current/upcoming lesson (closest to today, including today) should be first
      // This means lessons with daysDiff >= 0 should come before lessons with daysDiff < 0
      if (a.daysDiff >= 0 && b.daysDiff < 0) return -1;
      if (a.daysDiff < 0 && b.daysDiff >= 0) return 1;
      
      // Both are upcoming or today - sort by ascending (nearest first)
      if (a.daysDiff >= 0 && b.daysDiff >= 0) {
        return a.daysDiff - b.daysDiff;
      }
      
      // Both are past - sort by descending (most recent first)
      return b.daysDiff - a.daysDiff;
    });
    
    lessonsWithDates.forEach(({ doc: projectDoc, data }) => {
      const slideCount = data.slides?.length || 0;
      const hasSuggestions = (data.suggestions?.length || 0) > 0;
      
      const lessonCard = document.createElement("div");
      lessonCard.className = `lesson-card ${state.projectId === projectDoc.id ? "active" : ""}`;
      lessonCard.dataset.id = projectDoc.id;
      
      lessonCard.innerHTML = `
        <div class="lesson-card-header">
          <h4 class="lesson-card-title">${escapeHtml(data.mainTopic || "Untitled Lesson")}</h4>
        </div>
        <div class="lesson-card-meta">
          <span class="lesson-card-meta-item">📖 ${escapeHtml(data.scriptureReading || "No scripture")}</span>
          <span class="lesson-card-meta-item">📅 ${escapeHtml(data.lessonDate || "No date")}</span>
          <span class="lesson-card-meta-item">👤 ${escapeHtml(data.creatorId || "Unknown")}</span>
        </div>
        <div class="lesson-card-badges">
          ${hasSuggestions ? '<span class="lesson-badge">💡 Suggestions</span>' : ''}
          <span class="lesson-badge">${slideCount} slides</span>
        </div>
        <div class="lesson-card-actions">
          <button class="edit-btn" data-id="${projectDoc.id}">Edit</button>
          <button class="delete-btn" data-id="${projectDoc.id}">Delete</button>
        </div>
      `;
      
      // Click on card to load lesson into viewer
      lessonCard.addEventListener("click", (e) => {
        if (e.target.classList.contains("edit-btn") || e.target.classList.contains("delete-btn")) {
          return; // Let button handlers deal with it
        }
        loadLessonIntoViewer(projectDoc.id);
      });
      
      // Edit button - open edit modal
      lessonCard.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openEditModal(projectDoc.id, data);
      });
      
      // Delete button - remove from storage
      lessonCard.querySelector(".delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this lesson?")) {
          deleteLesson(projectDoc.id);
        }
      });
      
      refs.savedLessonsContainer.appendChild(lessonCard);
    });
  } catch (error) {
    console.error(error);
    refs.savedLessonsContainer.innerHTML = "<p class='muted'>Error loading lessons.</p>";
  }
}

// Load lesson into viewer (without full editor)
async function loadLessonIntoViewer(projectId) {
  try {
    const snapshot = await getDoc(doc(db, appSettings.projectsCollection, projectId));
    if (!snapshot.exists()) {
      setStatus("Lesson not found.");
      return;
    }

    const data = snapshot.data();
    state.projectId = projectId;
    state.project = {
      mainTopic: data.mainTopic || "UNTITLED TOPIC",
      subtopic: data.subtopic || "",
      scriptureReading: data.scriptureReading || "",
      memoryVerse: data.memoryVerse || "",
      lessonDate: data.lessonDate || "No date",
      themeId: Number(data.themeId || appSettings.defaultThemeId),
      suggestions: data.suggestions || [],
      pptxUrl: data.pptxUrl || "",
      slides: ensureCompulsoryTitleSlide(
        (data.slides || []).map((slide) => normalizeSlide(slide, Number(data.themeId || appSettings.defaultThemeId))),
        {
          mainTopic: data.mainTopic || "UNTITLED TOPIC",
          lessonDate: data.lessonDate || "No date",
          themeId: Number(data.themeId || appSettings.defaultThemeId)
        }
      )
    };
    state.currentSlideIndex = 0;

    // Update inputs
    refs.mainTopicInput.value = state.project.mainTopic;
    refs.subtopicInput.value = state.project.subtopic;
    refs.scriptureReadingInput.value = state.project.scriptureReading;
    refs.memoryVerseInput.value = state.project.memoryVerse;
    refs.lessonDateInput.value = state.project.lessonDate;
    refs.themeSelect.value = String(state.project.themeId);
    refs.savedProjectsSelect.value = projectId;

    renderAll();
    renderSavedLessons(); // Update active state
    setStatus(`Loaded: ${data.mainTopic || "Untitled"}`);
  } catch (error) {
    console.error(error);
    setStatus(`Failed to load: ${error.message}`);
  }
}

// Delete lesson
async function deleteLesson(projectId) {
  try {
    await deleteDoc(doc(db, appSettings.projectsCollection, projectId));
    setStatus("Lesson deleted.");
    if (state.projectId === projectId) {
      state.projectId = null;
    }
    renderSavedLessons();
    refreshCreatorProjects();
  } catch (error) {
    console.error(error);
    setStatus(`Delete failed: ${error.message}`);
  }
}

// Modal functions for editing lessons
let currentEditingId = null;

function openEditModal(projectId, lessonData) {
  currentEditingId = projectId;
  refs.modalMainTopic.value = lessonData.mainTopic || "";
  refs.modalSubtopic.value = lessonData.subtopic || "";
  refs.modalScriptureReading.value = lessonData.scriptureReading || "";
  refs.modalMemoryVerse.value = lessonData.memoryVerse || "";
  refs.modalLessonDate.value = lessonData.lessonDate || "";
  refs.modalCreatorId.value = lessonData.creatorId || "";
  refs.modalThemeSelect.value = String(lessonData.themeId || 1);
  refs.modalIsPublic.value = String(lessonData.isPublic || false);
  refs.modalLessonContent.value = lessonData.lessonText || lessonData.rawLessonText || "";
  refs.editModal.classList.remove("hidden");
}

function closeEditModal() {
  refs.editModal.classList.add("hidden");
  currentEditingId = null;
}

async function saveLessonEdit() {
  if (!currentEditingId) return;
  
  try {
    const updatedData = {
      mainTopic: refs.modalMainTopic.value.trim() || "Untitled Lesson",
      subtopic: refs.modalSubtopic.value.trim(),
      scriptureReading: refs.modalScriptureReading.value.trim(),
      memoryVerse: refs.modalMemoryVerse.value.trim(),
      lessonDate: refs.modalLessonDate.value.trim() || "No date",
      creatorId: refs.modalCreatorId.value.trim(),
      themeId: Number(refs.modalThemeSelect.value),
      isPublic: refs.modalIsPublic.value === "true",
      lessonText: refs.modalLessonContent.value.trim(),
      rawLessonText: refs.modalLessonContent.value.trim()
    };
    
    await setDoc(doc(db, appSettings.projectsCollection, currentEditingId), updatedData, { merge: true });
    
    closeEditModal();
    renderSavedLessons();
    refreshCreatorProjects();
    setStatus("Lesson updated successfully!");
  } catch (error) {
    console.error(error);
    setStatus(`Update failed: ${error.message}`);
  }
}

async function loadSelectedProject() {
  const projectId = refs.savedProjectsSelect.value;
  if (!projectId) {
    return;
  }
  await loadSelectedProjectById(projectId);
}

async function loadSelectedProjectById(projectId) {
  try {
    const snapshot = await getDoc(doc(db, appSettings.projectsCollection, projectId));
    if (!snapshot.exists()) {
      setStatus("Selected project does not exist.");
      return;
    }

    const data = snapshot.data();
    state.projectId = projectId;
    state.project = {
      mainTopic: data.mainTopic || "UNTITLED TOPIC",
      subtopic: data.subtopic || "",
      scriptureReading: data.scriptureReading || "",
      memoryVerse: data.memoryVerse || "",
      lessonDate: data.lessonDate || "No date",
      themeId: Number(data.themeId || appSettings.defaultThemeId),
      suggestions: data.suggestions || [],
      pptxUrl: data.pptxUrl || "",
      slides: ensureCompulsoryTitleSlide(
        (data.slides || []).map((slide) => normalizeSlide(slide, Number(data.themeId || appSettings.defaultThemeId))),
        {
          mainTopic: data.mainTopic || "UNTITLED TOPIC",
          lessonDate: data.lessonDate || "No date",
          themeId: Number(data.themeId || appSettings.defaultThemeId)
        }
      )
    };
    state.currentSlideIndex = 0;

    refs.mainTopicInput.value = state.project.mainTopic;
    refs.subtopicInput.value = state.project.subtopic;
    refs.scriptureReadingInput.value = state.project.scriptureReading;
    refs.memoryVerseInput.value = state.project.memoryVerse;
    refs.lessonDateInput.value = state.project.lessonDate;
    refs.themeSelect.value = String(state.project.themeId);
    refs.isPublicSelect.value = String(Boolean(data.isPublic));
    refs.savedProjectsSelect.value = projectId;

    renderAll();
    refreshCreatorProjects();
    setStatus(`Loaded project ${projectId}.`);
  } catch (error) {
    console.error(error);
    setStatus(`Failed to load project: ${error.message}`);
  }
}

async function deleteProject(projectId) {
  try {
    await deleteDoc(doc(db, appSettings.projectsCollection, projectId));
    setStatus("Project deleted.");
    if (state.projectId === projectId) {
      state.projectId = null;
    }
    refreshCreatorProjects();
  } catch (error) {
    console.error(error);
    setStatus(`Delete failed: ${error.message}`);
  }
}


async function sendLiveIndex() {
  if (!state.projectId) {
    setStatus("Save project before sending live slide index.");
    return;
  }

  try {
    const response = await fetch(`${appSettings.backendApiBaseUrl}/api/live/${state.projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentSlideIndex: state.currentSlideIndex,
        presenterId: refs.creatorIdInput.value.trim() || "user123"
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    setStatus("Live index synced.");
  } catch (error) {
    console.error(error);
    setStatus(`Live sync failed: ${error.message}`);
  }
}

async function generatePptx() {
  if (!state.projectId) {
    setStatus("Save project before generating PPTX.");
    return;
  }

  try {
    const response = await fetch(`${appSettings.backendApiBaseUrl}/api/projects/${state.projectId}/pptx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    state.project.pptxUrl = result.pptxUrl || "";
    setStatus(`PPTX URL saved: ${state.project.pptxUrl}`);
  } catch (error) {
    console.error(error);
    setStatus(`PPTX generation failed: ${error.message}`);
  }
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${appSettings.backendApiBaseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    refs.apiStatus.textContent = "API: online";
  } catch {
    refs.apiStatus.textContent = "API: offline (Firestore-only mode is still available)";
  }
}

function setGenerating(isGenerating) {
  state.isGenerating = isGenerating;
  refs.thinkingWrap.classList.toggle("hidden", !isGenerating);
  refs.thinkingOverlay.classList.toggle("hidden", !isGenerating);
  refs.generateBtn.disabled = isGenerating;
}

function buildSuggestions(slides, tweakPrompt) {
  const items = [
    `Generated ${slides.length} slide(s) with strict Q&A filtering.`,
    "Questions without a valid Bible-reference answer were skipped."
  ];
  if (tweakPrompt) {
    items.push(`Tweak captured: "${tweakPrompt}".`);
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

    // Split lines containing multiple question marks into scan-friendly segments.
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

function isLikelyNoteLine(line) {
  const raw = line.trim();
  if (!raw) {
    return false;
  }
  if (/^(nb|note|n\/b)\s*[:\-]/i.test(raw)) {
    return true;
  }
  if (isQuestionLine(raw)) {
    return false;
  }
  if (containsBibleReference(raw)) {
    return false;
  }
  return true;
}

function cleanNoteText(line) {
  return line.replace(/^(nb|note|n\.?b\.?|n\/b)\s*[:\-]\s*/i, "").trim();
}

function extractBibleReferences(text) {
  const regex = /\b(?:[1-3]\s*)?[A-Za-z]+\s+\d+(?::\d+(?:-\d+)?)?\b/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches.map((item) => item.trim()))];
}

function containsBibleReference(text) {
  return extractBibleReferences(text).length > 0;
}

function extractMetaValue(lines, regex) {
  const line = lines.find((item) => regex.test(item));
  return line ? line.split(":").slice(1).join(":").trim() : "";
}

// Detect dates in natural format (e.g., "February 27, 2021", "27th January 2024", "2024-02-15")
function extractDateFromContent(lines) {
  // Common date patterns - try to match dates that may have additional text after (like "March 7, 2026 (18 Adar)")
  const datePatterns = [
    // Month DD, YYYY or Month DD YYYY (with optional text after like "(18 Adar)")
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}(?:\s*\([^)]*\))?/i,
    // DD Month YYYY
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b/i,
    // YYYY-MM-DD
    /\b\d{4}-\d{2}-\d{2}\b/,
    // DD/MM/YYYY or MM/DD/YYYY
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

// Extract topic from content - look for first significant line that could be a topic
function extractTopicFromContent(lines, existingTopic, detectedDate) {
  // If we already have a topic from explicit marker, use it
  if (existingTopic) {
    return existingTopic;
  }

  // Skip lines that are clearly not topics (dates, scripture references, questions, notes)
  // Also skip the detected date line
  const skipPatterns = [
    /^date\s*:/i,
    /^lesson\s*date\s*:/i,
    /^scripture\s*reading/i,
    /^memory\s*verse/i,
    /^reading/i,
    /\?$/,
    /^(nb|note|n\/b)\s*[:\-]/i,
    /^\d{1,2}:\d{1,2}/ // Bible chapter:verse
  ];

  // If we detected a date, also skip lines that contain that date
  // Use simple string includes for date matching (case-insensitive)
  const dateLower = detectedDate ? detectedDate.toLowerCase() : null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines
    if (!trimmed) continue;
    // Skip lines that match skip patterns
    if (skipPatterns.some(pattern => pattern.test(trimmed))) continue;
    // Skip lines that contain the detected date (like "Lesson for March 7, 2026")
    if (dateLower && trimmed.toLowerCase().includes(dateLower)) continue;
    // Skip lines that look like Bible references
    if (/^[1-3]\\s*[A-Za-z]+\\s+\\d+/.test(trimmed)) continue;

    // This could be the topic - return it if it looks substantial
    if (trimmed.length > 2 && trimmed.length < 100) {
      return trimmed;
    }
  }
  return "";
}
// Extract subtopic from content
function extractSubtopicFromContent(lines, existingSubtopic) {
  if (existingSubtopic) {
    return existingSubtopic;
  }
  return "";
}

function setStatus(message) {
  refs.creatorStatus.textContent = message;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}


