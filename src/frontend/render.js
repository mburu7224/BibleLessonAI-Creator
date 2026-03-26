import { THEMES } from "../shared/slide-contract.js";
import { state } from "./state.js";

export function renderSlides(refs) {
  refs.generatedSlidesContainer.innerHTML = "";

  if (!state.project.slides.length) {
    const empty = document.createElement("div");
    empty.className = "empty-preview";
    empty.textContent = "No slides available yet.";
    refs.generatedSlidesContainer.appendChild(empty);
    refs.prevSlideBtn.disabled = true;
    refs.nextSlideBtn.disabled = true;
    return;
  }

  const total = state.project.slides.length;
  state.project.slides.forEach((slide, index) => {
    const slideEl = createLayeredSlideElement({
      slide,
      index,
      total,
      mainTopic: state.project.mainTopic,
      subtopic: state.project.subtopic,
      lessonDate: state.project.lessonDate,
      scriptureReading: state.project.scriptureReading,
      memoryVerse: state.project.memoryVerse
    });

    slideEl.addEventListener("click", () => {
      state.currentSlideIndex = index;
      renderSlideList(refs);
      setActiveGeneratedSlide(refs, index, { scroll: false });
    });

    refs.generatedSlidesContainer.appendChild(slideEl);
  });

  setActiveGeneratedSlide(refs, state.currentSlideIndex, { scroll: false });
}

export function renderSlideList(refs) {
  refs.slidesList.innerHTML = "";

  state.project.slides.forEach((slide, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `slide-item ${index === state.currentSlideIndex ? "active" : ""}`;
    const leading =
      slide.type === "question" ? `Q${slide.questionNumber || "?"}` : `#${String(index + 1).padStart(2, "0")}`;
    item.innerHTML = `
      <strong>${escapeHtml(leading)} ${escapeHtml(slide.type.toUpperCase())}</strong>
      <p>${escapeHtml(slide.question || "Note")}</p>
      <small>${escapeHtml(slide.answer || slide.notes || "")}</small>
    `;
    item.addEventListener("click", () => {
      state.currentSlideIndex = index;
      renderSlideList(refs);
      setActiveGeneratedSlide(refs, index, { scroll: true });
    });
    refs.slidesList.appendChild(item);
  });
}

export function renderSuggestions(refs) {
  refs.suggestionsList.innerHTML = "";
  (state.project.suggestions || []).forEach((suggestion) => {
    const li = document.createElement("li");
    li.textContent = suggestion;
    refs.suggestionsList.appendChild(li);
  });
}

export function renderProjects(refs, projects) {
  refs.savedProjectsSelect.innerHTML = `<option value="">-- load existing --</option>`;
  refs.savedLessonsContainer.innerHTML = "";
  refs.projectsListContainer.innerHTML = "";

  if (!projects.length) {
    refs.savedLessonsContainer.innerHTML = "<p class='muted'>No saved lessons yet.</p>";
    refs.projectsListContainer.innerHTML = "<p class='muted'>No projects found.</p>";
    return;
  }

  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = `${project.mainTopic} | ${project.lessonDate}`;
    refs.savedProjectsSelect.appendChild(option);

    const lessonCard = document.createElement("div");
    lessonCard.className = `lesson-card ${state.projectId === project.id ? "active" : ""}`;
    lessonCard.innerHTML = `
      <div class="lesson-card-header">
        <h4 class="lesson-card-title">${escapeHtml(project.mainTopic)}</h4>
      </div>
      <div class="lesson-card-meta">
        <span class="lesson-card-meta-item">Reading: ${escapeHtml(project.scriptureReading || "None")}</span>
        <span class="lesson-card-meta-item">Date: ${escapeHtml(project.lessonDate)}</span>
        <span class="lesson-card-meta-item">Slides: ${project.slides.length}</span>
      </div>
      <div class="lesson-card-actions">
        <button class="edit-btn" data-id="${project.id}">Load</button>
        <button class="delete-btn" data-id="${project.id}">Delete</button>
      </div>
    `;

    lessonCard.querySelector(".edit-btn").addEventListener("click", () => {
      refs.savedProjectsSelect.value = project.id;
      refs.savedProjectsSelect.dispatchEvent(new Event("change"));
    });
    lessonCard.querySelector(".delete-btn").addEventListener("click", () => {
      refs.savedLessonsContainer.dispatchEvent(
        new CustomEvent("delete-project", { detail: { projectId: project.id } })
      );
    });
    refs.savedLessonsContainer.appendChild(lessonCard);

    const projectCard = document.createElement("div");
    projectCard.className = `project-card ${state.projectId === project.id ? "active" : ""}`;
    projectCard.innerHTML = `
      <p class="project-card-topic">${escapeHtml(project.mainTopic)}</p>
      <p class="project-card-date">${escapeHtml(project.lessonDate)}</p>
      <div class="project-card-actions">
        <button class="edit-btn" data-id="${project.id}">Load</button>
        <button class="delete-btn" data-id="${project.id}">Delete</button>
      </div>
    `;
    projectCard.querySelector(".edit-btn").addEventListener("click", () => {
      refs.savedProjectsSelect.value = project.id;
      refs.savedProjectsSelect.dispatchEvent(new Event("change"));
    });
    projectCard.querySelector(".delete-btn").addEventListener("click", () => {
      refs.savedLessonsContainer.dispatchEvent(
        new CustomEvent("delete-project", { detail: { projectId: project.id } })
      );
    });
    refs.projectsListContainer.appendChild(projectCard);
  });
}

export function setActiveGeneratedSlide(refs, index, { scroll }) {
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

function createLayeredSlideElement({
  slide,
  index,
  total,
  mainTopic,
  subtopic,
  lessonDate,
  scriptureReading,
  memoryVerse
}) {
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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
