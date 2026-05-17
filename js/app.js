// ──────────────────────────────────────────────
//  MCQ App – Core Logic
// ──────────────────────────────────────────────

const App = (() => {
  // ── State ──────────────────────────────────
  const state = {
    apiKey: localStorage.getItem("mcq_api_key") || "",
    board: localStorage.getItem("mcq_board") || "CBSE",
    subject: null, topic: null, difficulty: null,
    timerEnabled: false, practiceMode: true,
    questions: [], currentIndex: 0,
    answers: {}, flagged: {},
    timeLeft: 0, timerInterval: null,
    quizStartTime: null, quizEndTime: null, totalSeconds: 0,
  };

  // ── Page management ────────────────────────
  function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) { el.classList.add("active"); window.scrollTo(0, 0); }
  }

  // ── Toast ──────────────────────────────────
  let toastTimer;
  function showToast(msg, type = "info", duration = 4000) {
    const t = document.getElementById("toast");
    t.textContent = "";
    const iconEl = document.createElement("span");
    iconEl.textContent = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
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
    const statusEl = document.getElementById("apiKeyStatus");
    const boardSel = document.getElementById("boardSelect");

    if (state.apiKey) { inp.value = state.apiKey; updateApiStatus(true); }
    boardSel.value = state.board;

    boardSel.addEventListener("change", () => {
      state.board = boardSel.value;
      localStorage.setItem("mcq_board", state.board);
    });

    document.getElementById("saveApiKey").addEventListener("click", () => {
      const key = inp.value.trim();
      if (!key) { showToast("Please enter your Gemini API key", "error"); return; }
      if (!key.startsWith("AIza")) { showToast("Key should start with 'AIza...'", "error"); return; }
      state.apiKey = key;
      localStorage.setItem("mcq_api_key", key);
      _workingModel = null;
      updateApiStatus(true);
      showToast("API key saved successfully", "success");
      setTimeout(() => showPage("page-setup"), 800);
    });

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
      card.innerHTML = `<span class="subject-icon">${data.icon}</span>
        <div class="subject-name">${name}</div>
        <div class="subject-count">${data.topics.length} topics</div>`;
      card.addEventListener("click", () => selectSubject(name));
      wrap.appendChild(card);
    });
  }

  function selectSubject(name) {
    state.subject = name; state.topic = null;
    document.querySelectorAll(".subject-card").forEach(c =>
      c.classList.toggle("selected", c.dataset.subject === name));
    const topicWrap = document.getElementById("topicSection");
    topicWrap.style.display = "block";
    const sel = document.getElementById("topicSelect");
    sel.innerHTML = '<option value="">— Select a topic —</option>';
    SUBJECTS[name].topics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = t; sel.appendChild(opt);
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
      btn.innerHTML = `<span class="diff-icon">${data.icon}</span>${data.label}<br>
        <small style="opacity:.6;font-size:11px">${data.desc}</small>`;
      btn.addEventListener("click", () => {
        state.difficulty = key;
        document.querySelectorAll(".difficulty-btn").forEach(b => { b.className = "difficulty-btn"; });
        btn.classList.add(`selected-${key.toLowerCase()}`);
      });
      wrap.appendChild(btn);
    });
  }

  function renderTimerToggle() {
    document.getElementById("timerToggle").addEventListener("change", e => { state.timerEnabled = e.target.checked; });
    document.getElementById("practiceModeToggle").addEventListener("change", e => { state.practiceMode = e.target.checked; });
  }

  // ── Start Quiz ─────────────────────────────
  async function startQuiz() {
    if (!state.apiKey) { showToast("Please set your Gemini API key first", "error"); showPage("page-apikey"); return; }
    if (!state.subject) { showToast("Please select a subject", "error"); return; }
    if (!state.topic)   { showToast("Please select a topic", "error"); return; }
    if (!state.difficulty) { showToast("Please select a difficulty level", "error"); return; }

    showPage("page-loading");
    setLoadingProgress(0, "Starting…");

    try {
      const questions = await fetchQuestions();
      if (!questions || questions.length === 0) throw new Error("No questions received from API");

      state.questions = questions.slice(0, 30);
      state.currentIndex = 0;
      state.answers = {}; state.flagged = {};
      state.quizStartTime = Date.now();
      if (state.timerEnabled) { state.timeLeft = 45 * 60; state.totalSeconds = state.timeLeft; }

      showPage("page-quiz");
      initQuizPage();
    } catch (err) {
      console.error("Quiz error:", err);
      showPage("page-setup");
      showToast(friendlyError(err.message), "error", 7000);
    }
  }

  function friendlyError(msg) {
    if (!msg) return "Something went wrong. Please try again.";
    const m = msg.toLowerCase();
    if (m.includes("api key") || (m.includes("invalid") && m.includes("key")))
      return "Invalid API key — please check it on the API Key page.";
    if (m.includes("quota") || m.includes("rate") || m.includes("429") || m.includes("resource exhausted"))
      return "Google API rate limit hit. Wait ~60 seconds then try again.";
    if (m.includes("truncat") || m.includes("max_tokens") || m.includes("output token"))
      return "AI response was cut off. Please tap 'Generate & Start Quiz' again — it usually succeeds on retry.";
    if (m.includes("parse") || m.includes("json"))
      return "Unexpected AI response format. Please try again.";
    if (m.includes("network") || m.includes("fetch"))
      return "Network error — check your internet connection.";
    if (m.includes("model not found") || m.includes("not supported"))
      return "No compatible Gemini model found. Try regenerating your key at aistudio.google.com.";
    if (m.includes("safety") || m.includes("blocked"))
      return "Request blocked by safety filters. Try a different topic.";
    return msg;
  }

  // ── Loading helpers ────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setLoadingProgress(pct, label) {
    const el = document.getElementById("loadingMsg");
    const bar = document.getElementById("loadingBatchBar");
    const lbl = document.getElementById("loadingBatchLabel");
    if (el) el.textContent = label;
    if (lbl) lbl.textContent = label;
    if (bar && pct !== null) bar.style.width = `${Math.min(100, Math.round(pct))}%`;
  }

  // ── Gemini API ─────────────────────────────
  const GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
    "gemini-pro"
  ];

  let _workingModel = null;

  async function resolveModel() {
    if (_workingModel) return _workingModel;
    setLoadingProgress(5, "Detecting best Gemini model…");

    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${state.apiKey}`;
      try {
        const r = await fetch(url);
        if (r.ok) { _workingModel = model; return model; }
        const d = await r.json().catch(() => ({}));
        const msg = (d?.error?.message || "").toLowerCase();
        if (r.status === 400 && !msg.includes("not found") && !msg.includes("not supported"))
          throw new Error("Invalid API key. Please check your key and try again.");
      } catch (e) {
        if (e.message.startsWith("Invalid API key")) throw e;
      }
    }
    _workingModel = GEMINI_MODELS[0];
    return _workingModel;
  }

  // ── KEY FIX: maxOutputTokens raised to 16384 ──
  // The original 8192 limit was the real cause of truncation errors.
  // 10 questions × ~500 tokens each ≈ 5k tokens; 16384 gives comfortable headroom.
  async function callGemini(model, prompt, attempt = 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,   // ← was 8192 — that was causing "token limit" truncation
        responseMimeType: "application/json"
      }
    };

    let res;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) { throw new Error("Network error: " + e.message); }

    if (res.status === 404) {
      const d = await res.json().catch(() => ({}));
      const err = new Error(d?.error?.message || "Model not found"); err.modelNotFound = true; throw err;
    }

    if (res.status === 400) {
      const d = await res.json().catch(() => ({}));
      const msg = d?.error?.message || "";
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("not supported")) {
        const err = new Error(msg); err.modelNotFound = true; throw err;
      }
      throw new Error("Invalid API key or bad request: " + msg);
    }

    // Rate limit / overload → exponential back-off
    if (res.status === 429 || res.status === 503) {
      if (attempt > 4) throw new Error("Google API rate limit reached after 4 retries. Wait ~60s then try again.");
      const waitSec = Math.min(12 * attempt, 40);
      setLoadingProgress(null, `Rate limited — waiting ${waitSec}s (retry ${attempt}/4)…`);
      await sleep(waitSec * 1000);
      return callGemini(model, prompt, attempt + 1);
    }

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];

    // Detect output truncation (finishReason MAX_TOKENS).
    // This is what the user was hitting — NOT their API quota.
    const truncated = candidate?.finishReason === "MAX_TOKENS";
    if (truncated) console.warn("Gemini truncated output (MAX_TOKENS). Attempting partial rescue.");

    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Request blocked by safety filters: ${blockReason}`);

    const text = candidate?.content?.parts?.[0]?.text || "";
    if (!text && !truncated) throw new Error("Empty response from Gemini API. Please try again.");

    return { text, truncated };
  }

  function rescueTruncatedJson(raw) {
    let clean = raw.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
    try { return JSON.parse(clean); } catch {}
    const lastComma = clean.lastIndexOf(",");
    if (lastComma > 0) { try { return JSON.parse(clean.slice(0, lastComma) + "]"); } catch {} }
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    return null;
  }

  function parseQuestions(text, truncated = false) {
    let clean = text.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      if (truncated) {
        parsed = rescueTruncatedJson(clean);
        if (!parsed) throw new Error("Response was truncated and could not be recovered. Please try again.");
      } else {
        const match = clean.match(/\[[\s\S]*\]/);
        if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
        if (!parsed) throw new Error("Could not parse question JSON. Please try again.");
      }
    }
    if (!Array.isArray(parsed)) throw new Error("Unexpected API response format. Please try again.");
    return parsed.filter(q => q && q.question && q.options && q.correct);
  }

  // Batched fetcher — 3 batches of 10 questions.
  // 10 Qs × ~500 tokens = ~5k tokens per batch → well within the 16384 limit.
  async function fetchQuestions() {
    const model = await resolveModel();
    setLoadingProgress(8, `Using ${model} — generating questions…`);

    const BATCH = 10;
    const NUM_BATCHES = 3; // 3 × 10 = 30
    let allQuestions = [];

    for (let b = 0; b < NUM_BATCHES; b++) {
      const start = b * BATCH + 1;
      const pct = 10 + (b / NUM_BATCHES) * 85;
      setLoadingProgress(pct, `Generating questions ${start}–${start + BATCH - 1} of 30…`);

      const prompt = buildPrompt(state.subject, state.topic, state.difficulty, state.board, BATCH, start);

      let result;
      try { result = await callGemini(model, prompt); }
      catch (err) {
        if (err.modelNotFound) { _workingModel = null; throw new Error("No supported Gemini model for your key."); }
        throw err;
      }

      const { text, truncated } = result;
      if (truncated) setLoadingProgress(pct, `Batch ${b + 1} truncated — salvaging partial response…`);

      const qs = parseQuestions(text, truncated);
      if (qs.length === 0 && b === 0) throw new Error("No valid questions in first batch. Please try again.");
      allQuestions = allQuestions.concat(qs);

      setLoadingProgress(10 + ((b + 1) / NUM_BATCHES) * 85, `${allQuestions.length} questions ready…`);

      if (b < NUM_BATCHES - 1) {
        setLoadingProgress(null, `Batch ${b + 1} done — pausing before batch ${b + 2}…`);
        await sleep(2000);
      }
    }

    setLoadingProgress(100, `All ${allQuestions.length} questions ready!`);
    return allQuestions.map((q, i) => ({ ...q, id: i + 1 }));
  }

  // ── Quiz page ──────────────────────────────
  function initQuizPage() {
    renderQuizHeader(); renderQMap(); renderQuestion(state.currentIndex);
    if (state.timerEnabled) startTimer();
  }

  function diffStyle() {
    if (state.difficulty === "Easy") return "";
    if (state.difficulty === "Medium") return "background:rgba(245,166,35,.15);color:var(--accent);border-color:rgba(245,166,35,.25)";
    return "background:rgba(248,113,113,.15);color:var(--red);border-color:rgba(248,113,113,.25)";
  }

  function renderQuizHeader() {
    document.getElementById("quizHeaderMeta").innerHTML = `
      <span class="badge badge-subject">${state.board} · Class X</span>
      <span class="badge badge-subject" style="background:rgba(255,255,255,.06);color:var(--text2);border-color:var(--border)">${SUBJECTS[state.subject].icon} ${state.subject}</span>
      <span class="badge badge-easy" style="${diffStyle()}">${DIFFICULTY[state.difficulty].icon} ${state.difficulty}</span>`;
    const timerWrap = document.getElementById("timerSection");
    timerWrap.style.display = state.timerEnabled ? "flex" : "none";
    if (state.timerEnabled) updateTimerDisplay();
  }

  function renderQMap() {
    const wrap = document.getElementById("qMapDots");
    wrap.innerHTML = "";
    state.questions.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "q-dot"; dot.textContent = i + 1; dot.id = `qdot-${i}`;
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

    document.getElementById("quizProgress").style.width = `${((idx + 1) / state.questions.length) * 100}%`;
    document.getElementById("qCounter").textContent = `Q${idx + 1} / ${state.questions.length}`;
    document.getElementById("qNumber").textContent = `Question ${idx + 1}`;
    document.getElementById("qText").textContent = q.question;

    const optsWrap = document.getElementById("optionsWrap");
    optsWrap.innerHTML = "";
    ["A","B","C","D"].forEach(letter => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.innerHTML = `<span class="option-letter">${letter}</span><span>${q.options[letter] || ""}</span>`;
      const chosen = state.answers[idx];
      const isCorrect = letter === q.correct;
      if (chosen !== undefined) {
        btn.disabled = true;
        if (letter === chosen && isCorrect) btn.classList.add("correct");
        else if (letter === chosen) btn.classList.add("incorrect");
        else if (isCorrect) btn.classList.add("correct");
      }
      btn.addEventListener("click", () => selectAnswer(idx, letter));
      optsWrap.appendChild(btn);
    });

    document.getElementById("flagBtn").classList.toggle("flagged", !!state.flagged[idx]);
    document.getElementById("prevBtn").disabled = idx === 0;
    const nextBtn = document.getElementById("nextBtn");
    const isLast = idx === state.questions.length - 1;
    nextBtn.textContent = isLast ? "Finish Quiz" : "Next →";
    nextBtn.className = isLast ? "btn btn-primary" : "btn btn-secondary";
    updateQMap();
  }

  function selectAnswer(idx, letter) {
    if (state.answers[idx] !== undefined) return;
    state.answers[idx] = letter;
    renderQuestion(idx);
    if (state.practiceMode) {
      const isCorrect = letter === state.questions[idx].correct;
      setTimeout(() => { if (idx < state.questions.length - 1) navigateToQuestion(idx + 1); },
        isCorrect ? 800 : 1200);
    }
  }

  function navigateToQuestion(idx) {
    if (idx < 0 || idx >= state.questions.length) return;
    state.currentIndex = idx; renderQuestion(idx);
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
    el.className = "timer-display" + (pct < 0.15 ? " danger" : pct < 0.3 ? " warning" : "");
  }

  // ── Results ────────────────────────────────
  function finishQuiz() {
    clearInterval(state.timerInterval);
    state.quizEndTime = Date.now();
    showPage("page-results"); renderResults();
  }

  function renderResults() {
    const total = state.questions.length;
    let correct = 0, wrong = 0, skipped = 0;
    state.questions.forEach((q, i) => {
      const a = state.answers[i];
      if (a === undefined) skipped++;
      else if (a === q.correct) correct++;
      else wrong++;
    });

    const pct = Math.round((correct / total) * 100);
    const timeTaken = state.quizEndTime - state.quizStartTime;
    const mins = Math.floor(timeTaken / 60000);
    const secs = Math.floor((timeTaken % 60000) / 1000);
    const circumference = 2 * Math.PI * 54;
    const filled = (correct / total) * circumference;
    const ringColor = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--accent)" : "var(--red)";
    const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D";

    document.getElementById("resultScoreRing").innerHTML = `
      <svg class="score-ring-svg" width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" fill="none" stroke="var(--border)" stroke-width="10"/>
        <circle cx="70" cy="70" r="54" fill="none" stroke="${ringColor}" stroke-width="10"
          stroke-dasharray="${filled} ${circumference}" stroke-linecap="round"
          style="transition:stroke-dasharray 1s ease"/>
        <text x="70" y="63" text-anchor="middle" dominant-baseline="middle"
          font-family="Playfair Display,serif" font-size="28" font-weight="700" fill="var(--text)">${pct}%</text>
        <text x="70" y="85" text-anchor="middle" font-family="DM Sans,sans-serif"
          font-size="13" fill="var(--text3)">Grade: ${grade}</text>
      </svg>`;

    document.getElementById("resultStats").innerHTML = `
      <div class="stat-box stat-correct"><div class="stat-val">${correct}</div><div class="stat-lbl">Correct ✓</div></div>
      <div class="stat-box stat-wrong"><div class="stat-val">${wrong}</div><div class="stat-lbl">Wrong ✕</div></div>
      <div class="stat-box stat-skip"><div class="stat-val">${skipped}</div><div class="stat-lbl">Skipped –</div></div>`;

    document.getElementById("resultMeta").innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center">
        <span class="badge badge-subject">${state.board} · ${state.subject} · ${state.topic}</span>
        <span class="badge" style="${diffStyle()}">${DIFFICULTY[state.difficulty].icon} ${state.difficulty}</span>
        <span style="font-size:13px;color:var(--text3)">⏱ ${mins}m ${secs}s</span>
      </div>`;

    const msgEl = document.getElementById("resultMessage");
    msgEl.textContent = pct >= 90 ? "🏆 Excellent! Outstanding performance!"
      : pct >= 75 ? "🌟 Great job! You have a strong grasp of the topic."
      : pct >= 50 ? "📚 Good effort! Review the explanations below to strengthen your understanding."
      : "💪 Keep practicing! Go through the explanations carefully and try again.";

    renderReview(correct, wrong, skipped);
  }

  function renderReview(correct, wrong, skipped) {
    const tabs = document.getElementById("reviewTabs");
    tabs.querySelectorAll("[data-filter]").forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.querySelectorAll("[data-filter]").forEach(t => t.classList.remove("active-tab"));
        tab.classList.add("active-tab");
        renderReviewCards(tab.dataset.filter);
      });
    });
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
          ${!isSkipped
            ? `<span class="answer-chip ${isCorrect ? "chip-correct" : "chip-wrong"}">Your answer: ${ans}. ${q.options[ans]}</span>`
            : `<span class="answer-chip chip-skip">Skipped</span>`}
          ${isWrong || isSkipped ? `<span class="answer-chip chip-correct">Correct: ${q.correct}. ${q.options[q.correct]}</span>` : ""}
        </div>
        <div class="explanation-box" style="display:none" id="exp-${i}">
          <div class="exp-label">💡 Explanation</div>${q.explanation || "No explanation provided."}
        </div>
        <button class="review-toggle" id="toggle-${i}" onclick="App.toggleExplanation(${i})">▶ Show Explanation</button>`;
      container.appendChild(card);
    });
    if (!container.innerHTML)
      container.innerHTML = `<div style="text-align:center;color:var(--text3);padding:30px">No questions in this category.</div>`;
  }

  function toggleExplanation(idx) {
    const expEl = document.getElementById(`exp-${idx}`);
    const btnEl = document.getElementById(`toggle-${idx}`);
    if (!expEl || !btnEl) return;
    const visible = expEl.style.display !== "none";
    expEl.style.display = visible ? "none" : "block";
    btnEl.textContent = visible ? "▶ Show Explanation" : "▼ Hide Explanation";
  }

  // ── Modal ──────────────────────────────────
  function confirmFinish() {
    const unanswered = state.questions.length - Object.keys(state.answers).length;
    if (unanswered > 0) {
      document.getElementById("confirmMsg").textContent =
        `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Are you sure you want to finish?`;
      document.getElementById("confirmModal").classList.add("open");
    } else { finishQuiz(); }
  }

  function closeModal() { document.getElementById("confirmModal").classList.remove("open"); }
  function confirmFinishYes() { closeModal(); finishQuiz(); }

  // ── Init ───────────────────────────────────
  function init() {
    document.getElementById("logoBtn").addEventListener("click", () => {
      if (state.questions.length > 0 && !document.getElementById("page-results").classList.contains("active")) {
        if (!confirm("Leave quiz? Your progress will be lost.")) return;
        clearInterval(state.timerInterval); state.questions = [];
      }
      showPage("page-setup");
    });

    initApiKeyPage();
    initSetupPage();

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
    document.getElementById("retryBtn").addEventListener("click", () => { state.questions = []; showPage("page-setup"); });
    document.getElementById("newTopicBtn").addEventListener("click", () => { state.questions = []; showPage("page-setup"); });
    document.getElementById("cancelFinish").addEventListener("click", closeModal);
    document.getElementById("confirmFinish").addEventListener("click", confirmFinishYes);

    if (!state.apiKey) showPage("page-apikey");
    else showPage("page-setup");
  }

  return { init, toggleExplanation };
})();

document.addEventListener("DOMContentLoaded", App.init);
