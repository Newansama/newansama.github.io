const POINTS_PER_QUESTION = 2;

const WRONG_CHOICE_MALUS_FACTOR = 0.5;

const SINGLE_UI_MULTIPICK_CHANCE = 0.5;

const SINGLE_WRONG_CHOICE_MALUS_PER_WRONG = 0.5;

const feedbackMSG = "<strong>Une mauvaise réponse à une question à choix multiple entraîne une perte de points.</strong>"

const startScreen = document.getElementById("startScreen");
const quizScreen = document.getElementById("quizScreen");
const resultScreen = document.getElementById("resultScreen");

const progressText = document.getElementById("progressText");
const scoreLive = document.getElementById("scoreLive");

const questSub = document.getElementById("questSub");
const feedback = document.getElementById("feedback");

const categoryTag = document.getElementById("categoryTag");
const questionCount = document.getElementById("questionCount");
const questionText = document.getElementById("questionText");

const answerForm = document.getElementById("answerForm");
const btnValidate = document.getElementById("btnValidate");
const btnBack = document.getElementById("btnBack");
const btnNext = document.getElementById("btnNext");
const btnRestart = document.getElementById("btnRestart");
const btnReturn = document.getElementById("btnReturn");

const resultsList = document.getElementById("resultsList");
const finalScoreEl = document.getElementById("finalScore");
const totalQuestionsEl = document.getElementById("totalQuestions");

const questionLimitSelect = document.getElementById("questionLimitSelect");

const sideFrame = document.getElementById("sideFrame");
const questionFrame = document.getElementById("questionFrame");

let questions = [];
let shuffledChoicesByQIndex = [];
let currentIndex = 0;

let uiMode = "single";

let playerAnswers = [];

function setScreen(which) {
    startScreen.hidden = which !== "start";
    quizScreen.hidden = which !== "quiz";
    resultScreen.hidden = which !== "results";
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeCorrect(correct) {
    if (Array.isArray(correct)) return correct;
    return [correct];
}

function isMultiCorrect(q) {
    return Array.isArray(q.correct_answer);
}

function getChoiceInputs() {
    return Array.from(answerForm.querySelectorAll("input[name='choice']"));
}

function getSelectedValues() {
    const inputs = getChoiceInputs();
    return inputs.filter(i => i.checked).map(i => i.value);
}

function setSelectedValuesOnUI(selectedValues) {
    const inputs = getChoiceInputs();
    inputs.forEach(inp => {
        inp.checked = selectedValues.includes(inp.value);
    });
}

function buildQuestionFrame() {
    if (!questionFrame) return;

    questionFrame.innerHTML = "";

    questions.forEach((_, idx) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "qChip pending";
        chip.dataset.qindex = idx;
        chip.textContent = idx + 1;

        chip.addEventListener("click", () => {
            const selected = getSelectedValues();

            if (selected.length > 0) {
                playerAnswers[currentIndex].selected = selected;
                playerAnswers[currentIndex].uiMode = uiMode; // garde le mode UI courant
                updateQuestionFrame();
            }

            currentIndex = idx;
            renderCurrentQuestion();
            updateProgressLive();
            updateQuestionFrame();
        });

        questionFrame.appendChild(chip);
    });

    if (sideFrame) {
        sideFrame.classList.remove("hidden");
    }

    updateQuestionFrame();
}

function updateQuestionFrame() {
    if (!questionFrame) return;

    const chips = questionFrame.querySelectorAll(".qChip");
    chips.forEach(chip => {
        const idx = Number(chip.dataset.qindex);
        const ans = playerAnswers[idx];

        const hasAnswer = ans && Array.isArray(ans.selected) && ans.selected.length > 0;

        chip.classList.toggle("answered", hasAnswer);
        chip.classList.toggle("pending", !hasAnswer);
    });
}


function saveCurrentAnswer() {
    const selected = getSelectedValues();

    const isMultiUI = uiMode === "multi";

    if (isMultiUI) {
        if (selected.length < 1) return false;
    } else {
        if (selected.length !== 1) return false;
    }

    playerAnswers[currentIndex].selected = selected;
    playerAnswers[currentIndex].uiMode = uiMode;
    return true;
}

function shuffleArrayInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function fetchQuestJson() {
    const res = await fetch("./asset/quest.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

function pickRandomQuestions(allQuestions, limitValue) {
    const total = allQuestions.length;
    if (!total) return [];

    let n = Number(limitValue);
    if (!Number.isFinite(n) || n <= 0) n = total;

    const copy = [...allQuestions];
    shuffleArrayInPlace(copy);

    if (n >= total) return copy;
    return copy.slice(0, n);
}

function loadQuestions(data) {
    const all = data.questions || [];
    const selectedLimit = questionLimitSelect ? questionLimitSelect.value : "10";

    questions = pickRandomQuestions(all, selectedLimit);
    currentIndex = 0;

    /*playerAnswers = new Array(questions.length).fill(null).map(() => ({
        selected: [],
        uiMode: "single"
    }));*/

    playerAnswers = new Array(questions.length).fill(null).map((_, idx) => {
        const q = questions[idx];
        const isSingleLogical = !isMultiCorrect(q);

        if (!isSingleLogical) {
            return { selected: [], uiMode: "multi" };
        }

        const ui = shouldUseMultiUIForSingle(q) ? "multi" : "single";
        return { selected: [], uiMode: ui };
    });

    shuffledChoicesByQIndex = questions.map((q) => {
        const choices = [...(q.choices || [])];
        shuffleArrayInPlace(choices);
        return choices;
    });

    resultsList.innerHTML = "";
    btnNext.hidden = true;
    btnValidate.hidden = false;

    if (!questions.length) throw new Error("Aucune question à afficher (JSON vide ou limit trop petit).");

    setScreen("quiz");
    renderCurrentQuestion();
    updateProgressLive();
    buildQuestionFrame();
}

function updateProgressLive() {
    const total = questions.length;
    questionCount.textContent = `Question ${currentIndex + 1}/${total}`;
}


function shouldUseMultiUIForSingle(q) {
    if (Array.isArray(q.correct_answer)) return false;
    return Math.random() < SINGLE_UI_MULTIPICK_CHANCE;
}

function renderCurrentQuestion() {
    const q = questions[currentIndex];
    answerForm.innerHTML = "";

    uiMode = playerAnswers[currentIndex]?.uiMode || (isMultiCorrect(q) ? "multi" : "single");

    questionText.textContent = q.question;

    const choices = shuffledChoicesByQIndex[currentIndex] || [];
    if (!choices.length) return;

    const useMultiUI = uiMode === "multi";

    choices.forEach((choice, idx) => {
        const id = `q_${currentIndex}_c_${idx}`;

        const wrapper = document.createElement("label");
        wrapper.className = "choice";

        const input = document.createElement("input");
        input.type = useMultiUI ? "checkbox" : "radio";
        input.name = "choice";
        input.value = choice;
        input.id = id;
        input.checked = false;

        feedback.innerHTML = useMultiUI ? feedbackMSG : "";

        if (useMultiUI) {
            questSub.classList.remove("hidden");
        } else {
            questSub.classList.add("hidden");
        }

        const span = document.createElement("span");
        span.className = "choiceText";
        span.textContent = choice;

        wrapper.appendChild(input);
        wrapper.appendChild(span);
        answerForm.appendChild(wrapper);
    });

    const isLast = currentIndex === questions.length - 1;


    btnNext.hidden = false;
    btnNext.textContent = isLast ? "Finir" : "Suivant";
    btnValidate.hidden = true;

    const prevSelected = playerAnswers[currentIndex]?.selected || [];
    setSelectedValuesOnUI(prevSelected);
    if (btnBack) btnBack.hidden = (currentIndex === 0);
}

function finalizeCurrentQuestion() {
    const selected = getSelectedValues();

    playerAnswers[currentIndex].selected = selected;
    playerAnswers[currentIndex].uiMode = uiMode;

    updateQuestionFrame();

    if (currentIndex === questions.length - 1) {
        computeAndRenderResults();
        setScreen("results");
    } else {
        currentIndex++;
        renderCurrentQuestion();
        updateProgressLive();
    }
}

function computeScoreForQuestion(q, selected, uiModeForThisQuestion) {
    const correctList = normalizeCorrect(q.correct_answer);
    const correctSet = new Set(correctList);
    const selectedSet = new Set(selected);

    const goodChosen = Array.from(selectedSet).filter(x => correctSet.has(x)).length;
    const totalCorrect = correctList.length;
    const wrongChosen = Array.from(selectedSet).filter(x => !correctSet.has(x)).length;

    const isJsonSingle = !Array.isArray(q.correct_answer);
    const uiIsMulti = uiModeForThisQuestion === "multi";

    if (!isJsonSingle) {
        const base = totalCorrect > 0 ? POINTS_PER_QUESTION * (goodChosen / totalCorrect) : 0;

        let malus = 0;
        if (wrongChosen > 0) {
            malus =
                base *
                WRONG_CHOICE_MALUS_FACTOR *
                Math.min(1, wrongChosen / (choicesCount(q) || 1));
        }

        const points = Math.max(0, base - malus);
        return { points, goodChosen, totalCorrect, wrongChosen, correctList };
    }

    const correctValue = correctList[0];

    if (!uiIsMulti) {
        const isCorrect = (selected.length === 1 && selected[0] === correctValue);
        const points = isCorrect ? POINTS_PER_QUESTION : 0;
        return { points, goodChosen, totalCorrect, wrongChosen, correctList };
    }

    const didChooseCorrect = selectedSet.has(correctValue);

    if (!didChooseCorrect) {
        return { points: 0, goodChosen, totalCorrect, wrongChosen, correctList };
    }

    const base = POINTS_PER_QUESTION;
    const malus = base * SINGLE_WRONG_CHOICE_MALUS_PER_WRONG * wrongChosen;
    const points = Math.max(0, base - malus);

    return { points, goodChosen, totalCorrect, wrongChosen, correctList };
}

function choicesCount(q) {
    return (q.choices || []).length;
}

function renderChoiceList(arr) {
    if (!arr || arr.length === 0) return "—";
    return arr.map(x => `<li>${escapeHtml(x)}</li>`).join("");
}

function computeAndRenderResults() {
    let totalScore = 0;

    const maxScoreEl = document.getElementById("maxScore");
    if (maxScoreEl) {
        maxScoreEl.textContent = `${(questions.length * POINTS_PER_QUESTION).toFixed(1)} (théorique)`;
    }

    resultScreen.hidden = false;
    resultsList.innerHTML = "";

    questions.forEach((q, idx) => {
        const selected = (playerAnswers[idx]?.selected || []);
        const uiModeForThisQuestion = playerAnswers[idx]?.uiMode || (isMultiCorrect(q) ? "multi" : "single");

        const correctList = normalizeCorrect(q.correct_answer);
        const scoreObj = computeScoreForQuestion(q, selected, uiModeForThisQuestion);
        totalScore += scoreObj.points;

        const li = document.createElement("li");
        li.className = "resultItem";

        const title = document.createElement("div");
        title.className = "resultTitle";
        title.innerHTML = `
      <div><strong>Q${idx + 1}.</strong> ${escapeHtml(q.question)}</div>
      <div class="mini">Catégorie: <span class="code">${escapeHtml(q.category || "—")}</span></div>
    `;

        const yourAnswerEl = document.createElement("div");
        yourAnswerEl.className = "resultBlock";
        const yourList = selected.length ? selected : [];
        yourAnswerEl.innerHTML = `
      <div><strong>Ton choix :</strong></div>
      <ul>${renderChoiceList(yourList)}</ul><br />
    `;

        const correctAnswerEl = document.createElement("div");
        correctAnswerEl.className = "resultBlock";
        correctAnswerEl.innerHTML = `
      <div><strong>Bonne(s) réponse(s) :</strong></div>
      <ul>${renderChoiceList(correctList)}</ul><br />
    `;

        let isWrong = false;
        const isMulti = isMultiCorrect(q);

        if (!isMulti) {
            isWrong = !(selected.length === 1 && selected[0] === correctList[0]);
        } else {
            const correctSet = new Set(correctList);
            const selectedSet = new Set(selected);

            const allCorrectChosen = correctList.every(c => selectedSet.has(c));
            const noWrongChosen = selected.every(s => correctSet.has(s));
            isWrong = !(allCorrectChosen && noWrongChosen);
        }

        const reviewEl = document.createElement("div");
        reviewEl.className = "resultBlock";
        if (isWrong) {
            reviewEl.innerHTML = `
        <div><strong>PDF à revoir :</strong> <span class="code">${escapeHtml(q.category || "—")}</span></div>
      `;
        } else {
            reviewEl.innerHTML = `<div class="correctRow">✅ Question maîtrisée</div>`;
        }

        const scoreEl = document.createElement("div");
        scoreEl.className = "resultScore";
        scoreEl.textContent = `Points obtenus : ${scoreObj.points.toFixed(1)}`;

        if (isWrong) li.classList.add("wrongCard");
        else li.classList.add("correctCard");

        li.appendChild(title);
        li.appendChild(yourAnswerEl);
        li.appendChild(correctAnswerEl);
        li.appendChild(reviewEl);

        resultsList.appendChild(li);
    });

    const maxScoreTheorique = questions.length * POINTS_PER_QUESTION;
    const scoreSur20 = maxScoreTheorique > 0 ? (totalScore / maxScoreTheorique) * 20 : 0;

    finalScoreEl.textContent = scoreSur20.toFixed(1) + "/20";

    const maxScoreText = 20;
    if (maxScoreEl) maxScoreEl.textContent = ``;

}


document.getElementById("btnStart").addEventListener("click", async () => {
    try {
        const data = await fetchQuestJson();
        loadQuestions(data);
    } catch (e) {
        console.warn("quest.json introuvable/erreur:", e);
        alert("Impossible de charger quest.json. Vérifie le nom du fichier et qu'il est dans le même dossier.");
    }
});

btnNext.addEventListener("click", (e) => {
    e.preventDefault();
    finalizeCurrentQuestion();
});

btnRestart.addEventListener("click", async () => {
    try {
        const data = await fetchQuestJson();
        loadQuestions(data);
    } catch (e) {
        alert("Impossible de recharger quest.json.");
    }
});

btnReturn.addEventListener("click", async () => {
    location.reload();
});

btnBack.addEventListener("click", (e) => {
    e.preventDefault();

    saveCurrentAnswer();
    updateQuestionFrame();

    if (currentIndex > 0) {
        currentIndex--;
        renderCurrentQuestion();
        updateProgressLive();

        btnValidate.textContent = (currentIndex === questions.length - 1) ? "Finir" : "Valider";
        if (btnBack) btnBack.hidden = (currentIndex === 0);
    }
});

setScreen("start");
