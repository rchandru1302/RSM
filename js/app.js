// ──────────────────────────────────────────────
//  MCQ App – Core Logic
// ──────────────────────────────────────────────

const App = (() => {
  // ── State ──────────────────────────────────
  const state = {
    apiKey: localStorage.getItem("mcq_api_key") || "",
    board: localStorage.getItem("mcq_board") || "CBSE",
    subject: null,
    topic: null,
    difficulty: null,
    timerEnabled: false,
    practiceMode: true,
    // Quiz runtime
    questions: [],
    currentIndex: 0,
    answers: {},      // { qIndex: "A" | "B" | "C" | "D" | null }
    flagged: {},      // { qIndex: true }
    timeLeft: 0,
    timerInterval: null,
    quizStartTime: null,
    quizEndTime: null,
    totalSeconds: 0,
  };

  // ── Page management ────────────────────────
  function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) { el.classList.add("active"); window.scrollTo(0, 0); }
  }

  // ── Toast ──────────────────────────────────
  let toastTimer;
  function showToast(msg, type = "info", duration = 3000) {
    const t = document.getElementById("toast");
    t.textContent = "";
    const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
    const iconEl = document.createElement("span");
    iconEl.textContent = icon;
    t.appendChild(iconEl);
    const txt = document.createElement("span");
    txt.textContent = msg;
    t.appendChild(txt);
    t.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), duration);
  }

  // ── API Key page ───────────────────────────
  function initApiKeyPage() {
    const inp = document.getElementById("apiKeyInput");
    const saveBtn = document.getElementById("saveApiKey");
    const statusEl = document.getElementById("apiKeyStatus");
    const boardSel = document.getElementById("boardSelect");

    // Pre-fill
    if (state.apiKey) {
      inp.value = state.apiKey;
      updateApiStatus(true);
    }
    boardSel.value = state.board;

    boardSel.addEventListener("change", () => {
      state.board = boardSel.value;
      localStorage.setItem("mcq_board", state.board);
    });

    saveBtn.addEventListener("click", () => {
      const key = inp.value.trim();
      if (!key) { showToast("Please enter your Gemini API key", "error"); return; }
      if (!key.startsWith("AIza")) { showToast("Key should start with 'AIza...'", "error"); return; }
      state.apiKey = key;
      localStorage.setItem("mcq_api_key", key);
      updateApiStatus(true);
      showToast("API key saved successfully", "success");
      setTimeout(() => showPage("page-setup"), 800);
    });

    // Toggle visibility
    document.getElementById("toggleKeyVisibility").addEventListener("click", function () {
      inp.type = inp.type === "password" ? "text" : "password";
      this.textContent = inp.type === "password" ? "👁" : "🙈";
    });

    function updateApiStatus(valid) {
      statusEl.className = `api-status ${valid ? "valid" : "invalid"}`;
      statusEl.innerHTML = `<span class="api-status-dot"></span>${valid ? "Key Saved" : "Not Set"}`;
    }
  }

  // ── Setup page ─────────────────────────────
  function initSetupPage() {
    renderSubjectCards();
    renderDifficultyBtns();
    renderTimerToggle();

    document.getElementById("startQuizBtn").addEventListener("click", startQuiz);
    document.getElementById("changeApiKeyBtn").addEventListener("click", () => showPage("page-apikey"));
  }

  function renderSubjectCards() {
    const wrap = document.getElementById("subjectGrid");
    wrap.innerHTML = "";
    Object.entries(SUBJECTS).forEach(([name, data]) => {
      const card = document.createElement("div");
      card.className = "subject-card";
      card.dataset.subject = name;
      card.innerHTML = `
        <span class="subject-icon">${data.icon}</span>
        <div class="subject-name">${name}</div>
        <div class="subject-count">${data.topics.length} topics</div>`;
      card.addEventListener("click", () => selectSubject(name));
      wrap.appendChild(card);
    });
  }

  function selectSubject(name) {
    state.subject = name;
    state.topic = null;
    document.querySelectorAll(".subject-card").forEach(c =>
      c.classList.toggle("selected", c.dataset.subject === name)
    );
    // Render topics
    const topicWrap = document.getElementById("topicSection");
    topicWrap.style.display = "block";
    const sel = document.getElementById("topicSelect");
    sel.innerHTML = '<option value="">— Select a topic —</option>';
    SUBJECTS[name].topics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
    sel.value = "";
    sel.onchange = () => { state.topic = sel.value || null; };
  }

  function renderDifficultyBtns() {
    const wrap = document.getElementById("difficultyGrid");
    wrap.innerHTML = "";
    Object.entries(DIFFICULTY).forEach(([key, data]) => {
      const btn = document.createElement("button");
      btn.className = "difficulty-btn";
      btn.dataset.diff = key;
      btn.innerHTML = `<span class="diff-icon">${data.icon}</span>${data.label}<br><small style="opacity:.6;font-size:11px">${data.desc}</small>`;
      btn.addEventListener("click", () => {
        state.difficulty = key;
        document.querySelectorAll(".difficulty-btn").forEach(b => {
          b.className = "difficulty-btn";
        });
        btn.classList.add(`selected-${key.toLowerCase()}`);
      });
      wrap.appendChild(btn);
    });
  }

  function renderTimerToggle() {
    const toggle = document.getElementById("timerToggle");
    const practiceToggle = document.getElementById("practiceModeToggle");
    toggle.addEventListener("change", () => { state.timerEnabled = toggle.checked; });
    practiceToggle.addEventListener("change", () => { state.practiceMode = practiceToggle.checked; });
  }

  // ── Start Quiz ─────────────────────────────
  async function startQuiz() {
    if (!state.apiKey) { showToast("Please set your Gemini API key first", "error"); showPage("page-apikey"); return; }
    if (!state.subject) { showToast("Please select a subject", "error"); return; }
    if (!state.topic) { showToast("Please select a topic", "error"); return; }
    if (!state.difficulty) { showToast("Please select a difficulty level", "error"); return; }

    showPage("page-loading");
    renderLoadingState();

    try {
      const questions = await fetchQuestions();
      if (!questions || questions.length === 0) throw new Error("No questions received");
      state.questions = questions.slice(0, 30);
      state.currentIndex = 0;
      state.answers = {};
      state.flagged = {};
      state.quizStartTime = Date.now();

      if (state.timerEnabled) {
        state.timeLeft = 30 * 90; // 90 sec per question default
        state.totalSeconds = state.timeLeft;
      }

      showPage("page-quiz");
      initQuizPage();
    } catch (err) {
      console.error(err);
      showPage("page-setup");
      showToast("Failed to generate questions: " + err.message, "error", 5000);
    }
  }

  function renderLoadingState() {
    const msgs = [
      "Consulting the syllabus...",
      "Crafting your questions...",
      "Applying difficulty settings...",
      "Almost ready..."
    ];
    let i = 0;
    const el = document.getElementById("loadingMsg");
    if (el) el.textContent = msgs[0];
    const iv = setInterval(() => {
      i = (i + 1) % msgs.length;
      if (el) el.textContent = msgs[i];
    }, 1800);
    window._loadingInterval = iv;
  }

  // ── Gemini API call ────────────────────────
  // Models tried in order until one succeeds
  const GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
    "gemini-pro"
  ];

  // Resolved working model cached for the session
  let _workingModel = null;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setLoadingMsg(text) {
    const el = document.getElementById("loadingMsg");
    if (el) el.textContent = text;
  }

  // Single API call with exponential back-off on 429
  async function callGemini(model, prompt, attempt = 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: "application/json" }
    };

    let res;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) { throw e; }

    // Model not available → signal caller to try next model
    if (res.status === 404 || res.status === 400) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || "";
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("not supported")) {
        const err = new Error(msg); err.modelNotFound = true; throw err;
      }
      throw new Error("Invalid API key or request. " + msg);
    }

    // Rate limited → back-off and retry (up to 4 times)
    if (res.status === 429) {
      if (attempt > 4) throw new Error("Still rate-limited after several retries. Please wait 60 seconds and try again.");
      const waitSec = Math.min(8 * attempt, 30); // 8s, 16s, 24s, 30s
      setLoadingMsg(`Rate limit hit — waiting ${waitSec}s before retry ${attempt}/4…`);
      await sleep(waitSec * 1000);
      setLoadingMsg("Retrying…");
      return callGemini(model, prompt, attempt + 1);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from API");
    return text;
  }

  // Parse raw text from Gemini into a JSON array
  function parseQuestions(raw) {
    let clean = raw.trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse question JSON — please try again.");
    }
    if (!Array.isArray(parsed)) throw new Error("Unexpected response format from API.");
    return parsed;
  }

  // Resolve which model works for this key (cached per session)
  async function resolveModel() {
    if (_workingModel) return _workingModel;
    for (const model of GEMINI_MODELS) {
      // Tiny probe to check the model exists without burning quota
      const probeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${state.apiKey}`;
      try {
        const r = await fetch(probeUrl);
        if (r.ok) { _workingModel = model; return model; }
        const d = await r.json().catch(() => ({}));
        const msg = (d?.error?.message || "").toLowerCase();
        if (r.status === 400 && !msg.includes("not found") && !msg.includes("not supported")) {
          // Bad key
          throw new Error("Invalid API key. " + (d?.error?.message || ""));
        }
      } catch (e) {
        if (e.message.startsWith("Invalid API key")) throw e;
      }
    }
    // Couldn't probe — just use first and let real call surface error
    _workingModel = GEMINI_MODELS[0];
    return _workingModel;
  }

  // Main entry: fetch all 30 questions, split into 2 batches of 15 to stay within token/rate limits
  async function fetchQuestions() {
    clearInterval(window._loadingInterval);

    setLoadingMsg("Detecting best Gemini model…");
    const model = await resolveModel();
    setLoadingMsg(`Using ${model} — generating questions…`);

    const BATCH = 15; // 15 Qs per request keeps output tokens low & avoids 429s
    const batches = [
      { start: 1,  count: BATCH },
      { start: BATCH + 1, count: BATCH }
    ];
    let allQuestions = [];

    for (let b = 0; b < batches.length; b++) {
      const { start, count } = batches[b];
      setLoadingMsg(`Generating questions ${start}–${start + count - 1} of 30…`);
      // Update progress bar
      const barEl = document.getElementById("loadingBatchBar");
      const lblEl = document.getElementById("loadingBatchLabel");
      if (barEl) barEl.style.width = `${(b / batches.length) * 100}%`;
      if (lblEl) lblEl.textContent = `${b * BATCH} / 30 questions`;

      const prompt = buildPrompt(state.subject, state.topic, state.difficulty, state.board, count, start);

      let raw;
      try {
        raw = await callGemini(model, prompt);
      } catch (err) {
        if (err.modelNotFound) throw new Error("No supported Gemini model found for your API key.");
        throw err;
      }

      const questions = parseQuestions(raw);
      allQuestions = allQuestions.concat(questions);

      // Small gap between batches to respect per-minute quota
      if (b < batches.length - 1) {
        setLoadingMsg("Batch 1 done — preparing batch 2…");
        const barEl = document.getElementById("loadingBatchBar");
        const lblEl = document.getElementById("loadingBatchLabel");
        if (barEl) barEl.style.width = "50%";
        if (lblEl) lblEl.textContent = "15 / 30 questions";
        await sleep(3000);
      }
    }

    // Complete
    const barEl = document.getElementById("loadingBatchBar");
    const lblEl = document.getElementById("loadingBatchLabel");
    if (barEl) barEl.style.width = "100%";
    if (lblEl) lblEl.textContent = "30 / 30 questions";

    // Re-number IDs sequentially in case model restarted numbering
    allQuestions = allQuestions.map((q, i) => ({ ...q, id: i + 1 }));
    return allQuestions;
  }

  // ── Quiz page ──────────────────────────────
  function initQuizPage() {
    renderQuizHeader();
    renderQMap();
    renderQuestion(state.currentIndex);
    if (state.timerEnabled) startTimer();
  }

  function renderQuizHeader() {
    const h = document.getElementById("quizHeaderMeta");
    h.innerHTML = `
      <span class="badge badge-subject">${state.board} · Class X</span>
      <span class="badge badge-subject" style="background:rgba(255,255,255,.06);color:var(--text2);border-color:var(--border)">${SUBJECTS[state.subject].icon} ${state.subject}</span>
      <span class="badge badge-easy" style="${diffStyle()}">${DIFFICULTY[state.difficulty].icon} ${state.difficulty}</span>`;

    const timerWrap = document.getElementById("timerSection");
    if (state.timerEnabled) {
      timerWrap.style.display = "flex";
      updateTimerDisplay();
    } else {
      timerWrap.style.display = "none";
    }
  }

  function diffStyle() {
    if (state.difficulty === "Easy") return "";
    if (state.difficulty === "Medium") return "background:rgba(245,166,35,.15);color:var(--accent);border-color:rgba(245,166,35,.25)";
    return "background:rgba(248,113,113,.15);color:var(--red);border-color:rgba(248,113,113,.25)";
  }

  function renderQMap() {
    const wrap = document.getElementById("qMapDots");
    wrap.innerHTML = "";
    state.questions.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "q-dot";
      dot.textContent = i + 1;
      dot.id = `qdot-${i}`;
      dot.addEventListener("click", () => navigateToQuestion(i));
      wrap.appendChild(dot);
    });
    updateQMap();
  }

  function updateQMap() {
    state.questions.forEach((_, i) => {
      const dot = document.getElementById(`qdot-${i}`);
      if (!dot) return;
      dot.className = "q-dot";
      if (i === state.currentIndex) dot.classList.add("current");
      else if (state.flagged[i]) dot.classList.add("flagged");
      else if (state.answers[i] !== undefined) dot.classList.add("answered");
    });
  }

  function renderQuestion(idx) {
    const q = state.questions[idx];
    if (!q) return;

    // Progress
    const prog = document.getElementById("quizProgress");
    prog.style.width = `${((idx + 1) / state.questions.length) * 100}%`;

    // Counter
    document.getElementById("qCounter").textContent = `Q${idx + 1} / ${state.questions.length}`;

    // Question text
    document.getElementById("qNumber").textContent = `Question ${idx + 1}`;
    document.getElementById("qText").textContent = q.question;

    // Options
    const optsWrap = document.getElementById("optionsWrap");
    optsWrap.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    letters.forEach(letter => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.innerHTML = `<span class="option-letter">${letter}</span><span>${q.options[letter]}</span>`;

      const chosen = state.answers[idx];
      const isCorrect = letter === q.correct;

      if (chosen !== undefined) {
        btn.disabled = true;
        if (letter === chosen && isCorrect) btn.classList.add("correct");
        else if (letter === chosen && !isCorrect) btn.classList.add("incorrect");
        else if (isCorrect && !state.practiceMode) btn.classList.add("correct");
        else if (isCorrect) btn.classList.add("correct");
      }

      btn.addEventListener("click", () => selectAnswer(idx, letter));
      optsWrap.appendChild(btn);
    });

    // Flag button
    const flagBtn = document.getElementById("flagBtn");
    flagBtn.classList.toggle("flagged", !!state.flagged[idx]);

    // Nav buttons
    document.getElementById("prevBtn").disabled = idx === 0;
    const nextBtn = document.getElementById("nextBtn");
    const isLast = idx === state.questions.length - 1;
    nextBtn.textContent = isLast ? "Finish Quiz" : "Next →";
    nextBtn.className = isLast ? "btn btn-primary" : "btn btn-secondary";

    updateQMap();
  }

  function selectAnswer(idx, letter) {
    if (state.answers[idx] !== undefined) return; // already answered
    state.answers[idx] = letter;
    renderQuestion(idx);

    const q = state.questions[idx];
    const isCorrect = letter === q.correct;

    if (state.practiceMode) {
      // Auto-advance after short delay
      setTimeout(() => {
        if (idx < state.questions.length - 1) navigateToQuestion(idx + 1);
      }, isCorrect ? 800 : 1200);
    }
  }

  function navigateToQuestion(idx) {
    if (idx < 0 || idx >= state.questions.length) return;
    state.currentIndex = idx;
    renderQuestion(idx);
  }

  // ── Timer ──────────────────────────────────
  function startTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      updateTimerDisplay();
      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        showToast("Time's up! Submitting quiz...", "error", 3000);
        setTimeout(finishQuiz, 1000);
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const el = document.getElementById("timerDisplay");
    if (!el) return;
    const m = Math.floor(state.timeLeft / 60).toString().padStart(2, "0");
    const s = (state.timeLeft % 60).toString().padStart(2, "0");
    el.textContent = `${m}:${s}`;

    const pct = state.timeLeft / state.totalSeconds;
    el.className = "timer-display";
    if (pct < 0.15) el.classList.add("danger");
    else if (pct < 0.3) el.classList.add("warning");
  }

  // ── Finish quiz ────────────────────────────
  function finishQuiz() {
    clearInterval(state.timerInterval);
    state.quizEndTime = Date.now();
    showPage("page-results");
    renderResults();
  }

  // ── Results page ───────────────────────────
  function renderResults() {
    const total = state.questions.length;
    let correct = 0, wrong = 0, skipped = 0;

    state.questions.forEach((q, i) => {
      const ans = state.answers[i];
      if (ans === undefined) skipped++;
      else if (ans === q.correct) correct++;
      else wrong++;
    });

    const pct = Math.round((correct / total) * 100);
    const timeTaken = state.quizEndTime - state.quizStartTime;
    const mins = Math.floor(timeTaken / 60000);
    const secs = Math.floor((timeTaken % 60000) / 1000);

    // Score ring
    const circumference = 2 * Math.PI * 54;
    const filled = (correct / total) * circumference;
    const ringColor = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--accent)" : "var(--red)";
    const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D";

    document.getElementById("resultScoreRing").innerHTML = `
      <svg class="score-ring-svg" width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" fill="none" stroke="var(--border)" stroke-width="10"/>
        <circle cx="70" cy="70" r="54" fill="none" stroke="${ringColor}" stroke-width="10"
          stroke-dasharray="${filled} ${circumference}" stroke-linecap="round"
          style="transition: stroke-dasharray 1s ease"/>
        <text x="70" y="63" text-anchor="middle" dominant-baseline="middle"
          font-family="Playfair Display, serif" font-size="28" font-weight="700" fill="var(--text)">${pct}%</text>
        <text x="70" y="85" text-anchor="middle" font-family="DM Sans, sans-serif"
          font-size="13" fill="var(--text3)">Grade: ${grade}</text>
      </svg>`;

    // Stats
    document.getElementById("resultStats").innerHTML = `
      <div class="stat-box stat-correct">
        <div class="stat-val">${correct}</div>
        <div class="stat-lbl">Correct ✓</div>
      </div>
      <div class="stat-box stat-wrong">
        <div class="stat-val">${wrong}</div>
        <div class="stat-lbl">Wrong ✕</div>
      </div>
      <div class="stat-box stat-skip">
        <div class="stat-val">${skipped}</div>
        <div class="stat-lbl">Skipped –</div>
      </div>`;

    // Meta info
    document.getElementById("resultMeta").innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center">
        <span class="badge badge-subject">${state.board} · ${state.subject} · ${state.topic}</span>
        <span class="badge" style="${diffStyle()}">${DIFFICULTY[state.difficulty].icon} ${state.difficulty}</span>
        <span style="font-size:13px;color:var(--text3)">⏱ ${mins}m ${secs}s</span>
      </div>`;

    // Encouragement message
    const msgEl = document.getElementById("resultMessage");
    if (pct >= 90) msgEl.textContent = "🏆 Excellent! Outstanding performance!";
    else if (pct >= 75) msgEl.textContent = "🌟 Great job! You have a strong grasp of the topic.";
    else if (pct >= 50) msgEl.textContent = "📚 Good effort! Review the explanations below to strengthen your understanding.";
    else msgEl.textContent = "💪 Keep practicing! Go through the explanations carefully and try again.";

    // Review section
    renderReview(correct, wrong, skipped);
  }

  function renderReview(correct, wrong, skipped) {
    const container = document.getElementById("reviewContainer");
    container.innerHTML = "";

    // Tabs
    const tabs = document.getElementById("reviewTabs");
    let activeFilter = "all";
    tabs.querySelectorAll("[data-filter]").forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.querySelectorAll("[data-filter]").forEach(t => t.classList.remove("active-tab"));
        tab.classList.add("active-tab");
        activeFilter = tab.dataset.filter;
        renderReviewCards(activeFilter);
      });
    });
    // Set counts
    document.querySelector('[data-filter="all"]').textContent = `All (${state.questions.length})`;
    document.querySelector('[data-filter="wrong"]').textContent = `Wrong (${wrong})`;
    document.querySelector('[data-filter="correct"]').textContent = `Correct (${correct})`;
    document.querySelector('[data-filter="skipped"]').textContent = `Skipped (${skipped})`;

    renderReviewCards("all");
  }

  function renderReviewCards(filter) {
    const container = document.getElementById("reviewContainer");
    container.innerHTML = "";

    state.questions.forEach((q, i) => {
      const ans = state.answers[i];
      const isSkipped = ans === undefined;
      const isCorrect = !isSkipped && ans === q.correct;
      const isWrong = !isSkipped && !isCorrect;

      if (filter === "wrong" && !isWrong) return;
      if (filter === "correct" && !isCorrect) return;
      if (filter === "skipped" && !isSkipped) return;

      const card = document.createElement("div");
      card.className = `review-card ${isCorrect ? "correct-card" : isWrong ? "wrong-card" : "skip-card"}`;

      const statusIcon = isCorrect ? "✓" : isWrong ? "✕" : "–";
      const statusColor = isCorrect ? "var(--green)" : isWrong ? "var(--red)" : "var(--text3)";

      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
          <span style="font-size:12px;color:var(--text3);font-family:'DM Mono',monospace">Q${i + 1}</span>
          <span style="font-size:13px;font-weight:600;color:${statusColor}">${statusIcon}</span>
        </div>
        <div class="review-q">${q.question}</div>
        <div class="review-answer-row">
          ${!isSkipped ? `<span class="answer-chip ${isCorrect ? "chip-correct" : "chip-wrong"}">Your answer: ${ans}. ${q.options[ans]}</span>` : `<span class="answer-chip chip-skip">Skipped</span>`}
          ${isWrong || isSkipped ? `<span class="answer-chip chip-correct">Correct: ${q.correct}. ${q.options[q.correct]}</span>` : ""}
        </div>
        <div class="explanation-box" style="display:none" id="exp-${i}">
          <div class="exp-label">💡 Explanation</div>
          ${q.explanation}
        </div>
        <button class="review-toggle" id="toggle-${i}" onclick="App.toggleExplanation(${i})">
          ▶ Show Explanation
        </button>`;

      container.appendChild(card);
    });

    if (container.innerHTML === "") {
      container.innerHTML = `<div style="text-align:center;color:var(--text3);padding:30px">No questions in this category.</div>`;
    }
  }

  function toggleExplanation(idx) {
    const expEl = document.getElementById(`exp-${idx}`);
    const btnEl = document.getElementById(`toggle-${idx}`);
    if (!expEl || !btnEl) return;
    const visible = expEl.style.display !== "none";
    expEl.style.display = visible ? "none" : "block";
    btnEl.textContent = visible ? "▶ Show Explanation" : "▼ Hide Explanation";
  }

  // ── Confirm modal ──────────────────────────
  function confirmFinish() {
    const answered = Object.keys(state.answers).length;
    const total = state.questions.length;
    const unanswered = total - answered;
    if (unanswered > 0) {
      document.getElementById("confirmMsg").textContent =
        `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Are you sure you want to finish?`;
      document.getElementById("confirmModal").classList.add("open");
    } else {
      finishQuiz();
    }
  }

  function closeModal() { document.getElementById("confirmModal").classList.remove("open"); }
  function confirmFinishYes() { closeModal(); finishQuiz(); }

  // ── Init ───────────────────────────────────
  function init() {
    // Setup page nav
    document.getElementById("logoBtn").addEventListener("click", () => {
      if (state.questions.length > 0) {
        // Warn if mid-quiz
        if (!document.getElementById("page-results").classList.contains("active")) {
          if (!confirm("Leave quiz? Your progress will be lost.")) return;
          clearInterval(state.timerInterval);
          state.questions = [];
        }
      }
      showPage("page-setup");
    });

    initApiKeyPage();
    initSetupPage();

    // Nav buttons wired in HTML; also wire quiz nav here
    document.getElementById("prevBtn").addEventListener("click", () => navigateToQuestion(state.currentIndex - 1));
    document.getElementById("nextBtn").addEventListener("click", () => {
      if (state.currentIndex < state.questions.length - 1) navigateToQuestion(state.currentIndex + 1);
      else confirmFinish();
    });
    document.getElementById("flagBtn").addEventListener("click", () => {
      state.flagged[state.currentIndex] = !state.flagged[state.currentIndex];
      document.getElementById("flagBtn").classList.toggle("flagged");
      updateQMap();
    });
    document.getElementById("finishBtn").addEventListener("click", confirmFinish);

    // Result page buttons
    document.getElementById("retryBtn").addEventListener("click", () => {
      state.questions = []; showPage("page-setup");
    });
    document.getElementById("newTopicBtn").addEventListener("click", () => {
      state.questions = []; showPage("page-setup");
    });

    // Modal
    document.getElementById("cancelFinish").addEventListener("click", closeModal);
    document.getElementById("confirmFinish").addEventListener("click", confirmFinishYes);

    // Show correct starting page
    if (!state.apiKey) showPage("page-apikey");
    else showPage("page-setup");
  }

  return {
    init,
    toggleExplanation
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
