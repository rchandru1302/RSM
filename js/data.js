// ──────────────────────────────────────────────
//  Class X Subject & Topic Data  (CBSE / ICSE)
// ──────────────────────────────────────────────

const SUBJECTS = {
  Math: {
    icon: "📐",
    color: "#5b8dee",
    topics: [
      "Real Numbers",
      "Polynomials",
      "Pair of Linear Equations in Two Variables",
      "Quadratic Equations",
      "Arithmetic Progressions",
      "Triangles & Similarity",
      "Coordinate Geometry",
      "Introduction to Trigonometry",
      "Some Applications of Trigonometry",
      "Circles",
      "Areas Related to Circles",
      "Surface Areas and Volumes",
      "Statistics",
      "Probability"
    ]
  },
  Physics: {
    icon: "⚡",
    color: "#f5a623",
    topics: [
      "Light – Reflection & Refraction",
      "Human Eye & Colourful World",
      "Electricity",
      "Magnetic Effects of Electric Current",
      "Sources of Energy",
      "Motion",
      "Force and Laws of Motion",
      "Gravitation",
      "Work, Energy and Power",
      "Sound"
    ]
  },
  Chemistry: {
    icon: "🧪",
    color: "#3ecf8e",
    topics: [
      "Chemical Reactions & Equations",
      "Acids, Bases & Salts",
      "Metals and Non-metals",
      "Carbon and its Compounds",
      "Periodic Classification of Elements",
      "Chemical Bonding",
      "Electrolysis",
      "Mole Concept",
      "Analytical Chemistry",
      "Organic Chemistry Basics"
    ]
  },
  Biology: {
    icon: "🌿",
    color: "#e8734a",
    topics: [
      "Life Processes",
      "Control and Coordination",
      "How do Organisms Reproduce?",
      "Heredity and Evolution",
      "Our Environment",
      "Management of Natural Resources",
      "Cell Biology",
      "Tissues",
      "Nutrition in Plants & Animals",
      "Transportation in Plants & Animals",
      "Excretion"
    ]
  }
};

const DIFFICULTY = {
  Easy: {
    label: "Easy",
    icon: "🌱",
    desc: "Fundamental concepts & definitions",
    color: "#3ecf8e"
  },
  Medium: {
    label: "Medium",
    icon: "🔥",
    desc: "Application-based questions",
    color: "#f5a623"
  },
  Hard: {
    label: "Hard",
    icon: "💎",
    desc: "Higher-order thinking (HOTS)",
    color: "#f87171"
  }
};

const BOARDS = ["CBSE", "ICSE"];

// Prompt template generator
// startId: the id number for the first question in this batch (default 1)
function buildPrompt(subject, topic, difficulty, board, count = 30, startId = 1) {
  const diffDesc =
    difficulty === "Easy"
      ? "focus on direct recall of definitions, formulas, and basic concepts. Keep language simple."
      : difficulty === "Medium"
      ? "focus on application of concepts, numerical problems, and multi-step reasoning."
      : "focus on HOTS (Higher Order Thinking Skills), tricky edge cases, assertion-reason, and analysis.";

  return `You are an expert ${board} Class X ${subject} teacher.
Generate exactly ${count} unique multiple-choice questions (MCQs) on the topic "${topic}" for Class X students.
Difficulty: ${difficulty} — ${diffDesc}
Board syllabus: ${board} Class X ${subject}.

Rules:
- Each question has exactly 4 options labeled A, B, C, D.
- Exactly one option is correct.
- Provide a thorough explanation for the correct answer (2–4 sentences).
- Vary question types: conceptual, numerical, fill-in-the-blank, assertion-reason, diagram-based.
- Number questions starting from ${startId}.
- Do NOT repeat questions from any prior batch.

Return ONLY a valid JSON array — no markdown fences, no preamble, no trailing text:
[
  {
    "id": ${startId},
    "question": "Question text here?",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correct": "A",
    "explanation": "Clear explanation of why A is correct and the others are not."
  }
]

Generate all ${count} questions now, starting at id ${startId}.`;
}
