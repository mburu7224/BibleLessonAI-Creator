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
  getDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { firebaseConfig, appSettings } from "./firebaseConfig.js";

const THEMES = {
  1: { id: 1, label: "Royal Blue", className: "theme-1" },
  2: { id: 2, label: "Sunrise Gold", className: "theme-2" },
  3: { id: 3, label: "Olive Stone", className: "theme-3" }
};
const TEST_ADMIN_KEY = "NewRuiruMediaKey2025!";

const sampleLessonText = [
  "Main Topic: TRIALS",
  "Subtopic: Endurance in Faith",
  "Scripture Reading: John 16:33",
  "Memory Verse: James 1:12",
  "Date: February 27, 2021",
  "What may the followers of Yahshua expect in this world?",
  "John 16:33",
  "How should believers respond to hardship?",
  "James 1:2-4",
  "NB: Trials reveal faith depth and spiritual maturity."
].join("\n");

const state = {
  projectId: null,
  currentSlideIndex: 0,
  isGenerating: false,
  project: {
    mainTopic: "TRIALS",
    subtopic: "Endurance in Faith",
    scriptureReading: "John 16:33",
    memoryVerse: "James 1:12",
    lessonDate: "February 27, 2021",
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
  thinkingOverlay: document.getElementById("thinkingOverlay")
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
}

function bindEvents() {
  refs.loadSampleBtn.addEventListener("click", loadSampleProject);
  refs.generateBtn.addEventListener("click", generateSlidesWithAi);
  refs.redesignBtn.addEventListener("click", applyThemeRedesign);
  refs.saveBtn.addEventListener("click", saveProject);
  refs.refreshProjectsBtn.addEventListener("click", refreshCreatorProjects);
  refs.savedProjectsSelect.addEventListener("change", loadSelectedProject);
  refs.prevSlideBtn.addEventListener("click", () => moveSlide(-1));
  refs.nextSlideBtn.addEventListener("click", () => moveSlide(1));
  refs.sendLiveBtn.addEventListener("click", sendLiveIndex);
  refs.generatePptxBtn.addEventListener("click", generatePptx);

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

  const mainTopic = extractMetaValue(lines, /^(main\s*topic|topic)\s*:/i) || refs.mainTopicInput.value.trim();
  const lessonDate = extractMetaValue(lines, /^(date|lesson\s*date)\s*:/i) || refs.lessonDateInput.value.trim();
  const subtopic = extractMetaValue(lines, /^sub\s*topic\s*:/i) || refs.subtopicInput.value.trim() || "";
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
  const questionSlides = [];
  const noteSlides = [];
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
        questionSlides.push({
          type: "question",
          question,
          answer: answerRefs.join("; "),
          notes: "",
          themeId
        });
      }

      i = j;
      continue;
    }

    // Rule: Notes should not include questions or answers.
    if (isLikelyNoteLine(line) || isSectionBreak(line)) {
      const noteBlock = [cleanNoteText(line)];
      let j = i + 1;
      while (
        j < contentScanLines.length &&
        !isQuestionLine(contentScanLines[j]) &&
        (isLikelyNoteLine(contentScanLines[j]) || isSectionBreak(contentScanLines[j]))
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
        noteSlides.push({
          type: "note",
          question: "Note",
          answer: "",
          notes: noteText,
          themeId
        });
      }

      i = j;
      continue;
    }

    i += 1;
  }

  // Slide order hierarchy:
  // 1) Cover, 2) Scripture/Memory twin (if any), 3) All Q&A, 4) Notes.
  const numberedQuestionSlides = questionSlides.map((slide, idx) => ({
    ...slide,
    questionNumber: idx + 1
  }));

  const slides = [...orderedSlides, ...numberedQuestionSlides, ...noteSlides];

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

  const nonTitleSlides = (slides || []).filter((slide) => slide.type !== "title");
  const questionSlides = nonTitleSlides
    .filter((slide) => slide.type === "question")
    .map((slide, idx) => ({ ...slide, questionNumber: idx + 1 }));
  const nonQuestionSlides = nonTitleSlides.filter((slide) => slide.type !== "question");
  const scriptureSlides = nonQuestionSlides.filter((slide) => slide.type === "scriptureMemory");
  const noteSlides = nonQuestionSlides.filter((slide) => slide.type === "note");
  const otherSlides = nonQuestionSlides.filter((slide) => !["scriptureMemory", "note"].includes(slide.type));

  // Keep hierarchy stable on load/edit.
  return [titleSlide, ...scriptureSlides, ...questionSlides, ...noteSlides, ...otherSlides];
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
    if (state.projectId) {
      await setDoc(doc(db, appSettings.projectsCollection, state.projectId), payload, { merge: true });
      setStatus(`Project updated: ${state.projectId}`);
    } else {
      const created = await addDoc(collection(db, appSettings.projectsCollection), payload);
      state.projectId = created.id;
      setStatus(`Project saved: ${state.projectId}`);
    }
    await refreshCreatorProjects();
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
    snapshot.docs.forEach((projectDoc) => {
      const data = projectDoc.data();
      const option = document.createElement("option");
      option.value = projectDoc.id;
      option.textContent = `${data.mainTopic || "Untitled"} | ${data.lessonDate || "No date"}`;
      refs.savedProjectsSelect.appendChild(option);
    });
    if (!snapshot.docs.length) {
      setStatus("No projects found for this creator yet.");
    }
  } catch (error) {
    console.error(error);
    setStatus(`Could not load projects: ${error.message}`);
  }
}

async function loadSelectedProject() {
  const projectId = refs.savedProjectsSelect.value;
  if (!projectId) {
    return;
  }

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

    renderAll();
    setStatus(`Loaded project ${projectId}.`);
  } catch (error) {
    console.error(error);
    setStatus(`Failed to load project: ${error.message}`);
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
  return /^(nb|note|n\/b)\s*[:\-]/i.test(String(line || "").trim());
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
  return line.replace(/^(nb|note|n\/b)\s*[:\-]\s*/i, "").trim();
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
