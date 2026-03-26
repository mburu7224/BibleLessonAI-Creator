import { api } from "./api.js";
import { SAMPLE_LESSON_TEXT } from "./config.js";
import { renderProjects, renderSlideList, renderSlides, renderSuggestions, setActiveGeneratedSlide } from "./render.js";
import { setAuthSession, state } from "./state.js";
import { DEFAULT_THEME_ID, normalizeProject } from "../shared/slide-contract.js";

const refs = {
  apiStatus: document.getElementById("apiStatus"),
  authStatus: document.getElementById("authStatus"),
  registerBtn: document.getElementById("registerBtn"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  displayNameInput: document.getElementById("displayNameInput"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  creatorStatus: document.getElementById("creatorStatus"),
  lessonTextInput: document.getElementById("lessonTextInput"),
  mainTopicInput: document.getElementById("mainTopicInput"),
  subtopicInput: document.getElementById("subtopicInput"),
  scriptureReadingInput: document.getElementById("scriptureReadingInput"),
  memoryVerseInput: document.getElementById("memoryVerseInput"),
  lessonDateInput: document.getElementById("lessonDateInput"),
  isPublicSelect: document.getElementById("isPublicSelect"),
  themeSelect: document.getElementById("themeSelect"),
  savedProjectsSelect: document.getElementById("savedProjectsSelect"),
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
  thinkingOverlay: document.getElementById("thinkingOverlay")
};

initialize();

async function initialize() {
  refs.lessonTextInput.value = SAMPLE_LESSON_TEXT;
  refs.emailInput.value = state.userEmail;
  refs.displayNameInput.value = state.displayName;
  bindEvents();
  loadSampleProject();
  await checkApiHealth();
  renderAuthState();

  if (state.authToken) {
    await refreshProjects();
  }
}

function bindEvents() {
  refs.registerBtn.addEventListener("click", register);
  refs.loginBtn.addEventListener("click", login);
  refs.logoutBtn.addEventListener("click", logout);
  refs.loadSampleBtn.addEventListener("click", loadSampleProject);
  refs.generateBtn.addEventListener("click", generateSlidesWithAi);
  refs.redesignBtn.addEventListener("click", applyThemeRedesign);
  refs.saveBtn.addEventListener("click", saveProject);
  refs.refreshProjectsBtn.addEventListener("click", refreshProjects);
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
  refs.savedLessonsContainer.addEventListener("delete-project", async (event) => {
    if (!confirm("Delete this project?")) {
      return;
    }
    await deleteProject(event.detail.projectId);
  });
}

function loadSampleProject() {
  hydrateProject(
    normalizeProject({
      mainTopic: "TEACH YOUR CHILDREN",
      subtopic: "",
      scriptureReading: "Deuteronomy 6.",
      memoryVerse: "Deuteronomy 6:7.",
      lessonDate: "March 7, 2026 (18 Adar)",
      themeId: DEFAULT_THEME_ID,
      rawLessonText: SAMPLE_LESSON_TEXT,
      isPublic: true,
      suggestions: ["Use Generate Slides to replace the sample with a generated deck."],
      slides: []
    })
  );
  refs.lessonTextInput.value = SAMPLE_LESSON_TEXT;
  refs.tweakInput.value = "";
  state.projectId = "";
  setStatus("Sample lesson loaded.");
}

async function login() {
  const email = refs.emailInput.value.trim();
  const password = refs.passwordInput.value;

  if (!email || !password) {
    setStatus("Enter both email and password.");
    return;
  }

  try {
    const result = await api.login({ email, password });
    setAuthSession({
      token: result.token,
      email: result.user.email,
      displayName: result.user.displayName
    });
    refs.passwordInput.value = "";
    refs.displayNameInput.value = result.user.displayName || refs.displayNameInput.value;
    renderAuthState();
    await refreshProjects();
    setStatus("Authenticated. Protected actions are enabled.");
  } catch (error) {
    setStatus(`Login failed: ${error.message}`);
  }
}

async function register() {
  const displayName = refs.displayNameInput.value.trim();
  const email = refs.emailInput.value.trim();
  const password = refs.passwordInput.value;

  if (!displayName || !email || !password) {
    setStatus("Enter display name, email, and password.");
    return;
  }

  try {
    await api.register({ displayName, email, password });
    setStatus("Account created. Signing in...");
    await login();
  } catch (error) {
    setStatus(`Registration failed: ${error.message}`);
  }
}

function logout() {
  setAuthSession({ token: "", email: refs.emailInput.value.trim() || "", displayName: refs.displayNameInput.value.trim() || "" });
  state.projectId = "";
  renderAuthState();
  refs.savedProjectsSelect.innerHTML = `<option value="">-- load existing --</option>`;
  refs.savedLessonsContainer.innerHTML = "<p class='muted'>Log in to load saved lessons.</p>";
  refs.projectsListContainer.innerHTML = "";
  setStatus("Logged out.");
}

async function generateSlidesWithAi() {
  if (!requireAuthSession("Log in before generating slides.")) {
    return;
  }

  const lessonText = refs.lessonTextInput.value.trim();
  if (!lessonText) {
    setStatus("Paste lesson text first.");
    return;
  }

  setGenerating(true);
  try {
    const result = await api.generateSlides({
      lessonText,
      tweakPrompt: refs.tweakInput.value.trim(),
      themeId: Number(refs.themeSelect.value || DEFAULT_THEME_ID),
      meta: gatherMeta()
    });
    hydrateProject({ ...result.deck, rawLessonText: lessonText, isPublic: refs.isPublicSelect.value === "true" });
    setStatus(`Prepared ${state.project.slides.length} slide(s).`);
  } catch (error) {
    setStatus(`Generation failed: ${error.message}`);
  } finally {
    setGenerating(false);
  }
}

async function saveProject() {
  if (!requireAuthSession("Log in before saving projects.")) {
    return;
  }

  if (!state.project.slides.length) {
    setStatus("Generate slides first before saving.");
    return;
  }

  const payload = buildEditableProjectPayload();

  try {
    if (state.projectId) {
      await api.updateProject(state.projectId, payload);
      setStatus("Project updated.");
    } else {
      const created = await api.createProject(payload);
      state.projectId = created.projectId;
      setStatus("Project saved.");
    }

    refs.projectsSection.classList.remove("hidden");
    await refreshProjects();
  } catch (error) {
    setStatus(`Save failed: ${error.message}`);
  }
}

async function refreshProjects() {
  if (!requireAuthSession("Log in to load your saved projects.")) {
    return;
  }

  try {
    const result = await api.listProjects();
    renderProjects(refs, result.projects);
    if (!result.projects.length) {
      setStatus("No projects found for this creator yet.");
    }
  } catch (error) {
    setStatus(`Could not load projects: ${error.message}`);
  }
}

async function loadSelectedProject() {
  const projectId = refs.savedProjectsSelect.value;
  if (!projectId) {
    return;
  }

  try {
    const result = await api.getProject(projectId);
    state.projectId = projectId;
    hydrateProject(result.project);
    setStatus(`Loaded project ${projectId}.`);
  } catch (error) {
    setStatus(`Failed to load project: ${error.message}`);
  }
}

async function deleteProject(projectId) {
  if (!requireAuthSession("Log in before deleting projects.")) {
    return;
  }

  try {
    await api.deleteProject(projectId);
    if (state.projectId === projectId) {
      state.projectId = "";
    }
    await refreshProjects();
    setStatus("Project deleted.");
  } catch (error) {
    setStatus(`Delete failed: ${error.message}`);
  }
}

async function sendLiveIndex() {
  if (!requireAuthSession("Log in before syncing live slide state.")) {
    return;
  }
  if (!state.projectId) {
    setStatus("Save project before sending live slide index.");
    return;
  }

  try {
    await api.sendLiveIndex(state.projectId, state.currentSlideIndex);
    setStatus("Live index synced.");
  } catch (error) {
    setStatus(`Live sync failed: ${error.message}`);
  }
}

async function generatePptx() {
  if (!requireAuthSession("Log in before exporting PPTX.")) {
    return;
  }
  if (!state.projectId) {
    setStatus("Save project before generating PPTX.");
    return;
  }

  try {
    const result = await api.generatePptx(state.projectId);
    state.project.pptxUrl = result.pptxUrl || "";
    setStatus(`Presentation ready: ${state.project.pptxUrl}`);
    if (state.project.pptxUrl) {
      window.open(state.project.pptxUrl, "_blank", "noopener");
    }
  } catch (error) {
    setStatus(`PPTX generation failed: ${error.message}`);
  }
}

async function checkApiHealth() {
  try {
    const health = await api.getHealth();
    state.health = health;
    refs.apiStatus.textContent = `Service online | Access ${health.config.authConfigured ? "configured" : "needs setup"} | Generation ${health.config.openAiConfigured ? "configured" : "parser mode"}`;
  } catch {
    refs.apiStatus.textContent = "Service offline";
  }
}

function hydrateProject(project) {
  state.project = normalizeProject({
    ...project,
    creatorId: state.displayName || state.userEmail
  });
  state.currentSlideIndex = 0;

  refs.mainTopicInput.value = state.project.mainTopic;
  refs.subtopicInput.value = state.project.subtopic;
  refs.scriptureReadingInput.value = state.project.scriptureReading;
  refs.memoryVerseInput.value = state.project.memoryVerse;
  refs.lessonDateInput.value = state.project.lessonDate;
  refs.themeSelect.value = String(state.project.themeId);
  refs.isPublicSelect.value = String(Boolean(state.project.isPublic));

  renderAll();
}

function renderAll() {
  renderSlides(refs);
  renderSlideList(refs);
  renderSuggestions(refs);
  setActiveGeneratedSlide(refs, state.currentSlideIndex, { scroll: false });
}

function applyThemeRedesign() {
  const themeId = Number(refs.themeSelect.value || DEFAULT_THEME_ID);
  state.project.themeId = themeId;
  state.project.slides = state.project.slides.map((slide) => ({ ...slide, themeId }));
  renderAll();
  setStatus("Theme updated across the current deck.");
}

function syncMetaFromInputsAndRender() {
  const meta = gatherMeta();
  state.project = normalizeProject({
    ...state.project,
    ...meta,
    themeId: Number(refs.themeSelect.value || state.project.themeId || DEFAULT_THEME_ID),
    isPublic: refs.isPublicSelect.value === "true",
    rawLessonText: refs.lessonTextInput.value.trim()
  });
  renderAll();
}

function gatherMeta() {
  return {
    mainTopic: refs.mainTopicInput.value.trim(),
    subtopic: refs.subtopicInput.value.trim(),
    scriptureReading: refs.scriptureReadingInput.value.trim(),
    memoryVerse: refs.memoryVerseInput.value.trim(),
    lessonDate: refs.lessonDateInput.value.trim()
  };
}

function buildEditableProjectPayload() {
  return {
    ...gatherMeta(),
    themeId: Number(refs.themeSelect.value || DEFAULT_THEME_ID),
    isPublic: refs.isPublicSelect.value === "true",
    rawLessonText: refs.lessonTextInput.value.trim(),
    suggestions: state.project.suggestions || [],
    pptxUrl: state.project.pptxUrl || "",
    slides: state.project.slides
  };
}

function renderAuthState() {
  const isLoggedIn = Boolean(state.authToken);
  refs.emailInput.value = state.userEmail;
  refs.displayNameInput.value = state.displayName;
  refs.emailInput.disabled = isLoggedIn;
  refs.loginBtn.disabled = isLoggedIn;
  refs.registerBtn.disabled = isLoggedIn;
  refs.logoutBtn.disabled = !isLoggedIn;
  refs.authStatus.textContent = isLoggedIn
    ? `Authenticated as ${state.displayName || state.userEmail}`
    : "Signed out";
}

function requireAuthSession(message) {
  if (!state.authToken) {
    setStatus(message);
    return false;
  }

  return true;
}

function moveSlide(delta) {
  const max = Math.max(0, state.project.slides.length - 1);
  const next = Math.max(0, Math.min(max, state.currentSlideIndex + delta));
  if (next === state.currentSlideIndex) {
    return;
  }
  state.currentSlideIndex = next;
  renderSlideList(refs);
  setActiveGeneratedSlide(refs, next, { scroll: true });
}

function setGenerating(isGenerating) {
  state.isGenerating = isGenerating;
  refs.thinkingWrap.classList.toggle("hidden", !isGenerating);
  refs.thinkingOverlay.classList.toggle("hidden", !isGenerating);
  refs.generateBtn.disabled = isGenerating;
}

function setStatus(message) {
  refs.creatorStatus.textContent = message;
}
