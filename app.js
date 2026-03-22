/**
 * ALIS — app.js
 *
 * セキュリティ上の注意:
 * -----------------------------------------------------------------
 * APPLICATION_WEBHOOK_URL と START_ANALYSIS_WEBHOOK_URL は
 * フロントエンドのJSに書くと誰でも閲覧・悪用できます。
 *
 * 本番運用では:
 *   1. 独自バックエンド（Node.js/Cloud Functions等）のエンドポイントを用意し
 *      そこに向けてリクエストを送る。
 *   2. バックエンド側で招待コード検証・レート制限・ログ収集を行う。
 *   3. Make.comのWebhookURLはバックエンドの環境変数に入れ、
 *      フロントエンドには一切露出させない。
 *
 * 以下は開発・PoC用の実装です。本番化の際は上記構成に差し替えてください。
 * -----------------------------------------------------------------
 */

// ── 設定（本番前に必ず確認） ──────────────────────────────────────
const CONFIG = {
  APPLICATION_WEBHOOK_URL:    "https://wandering-rain-07a9.evifrom20220523.workers.dev/apply",
  START_ANALYSIS_WEBHOOK_URL: "https://wandering-rain-07a9.evifrom20220523.workers.dev/start",
  USE_DEMO_MODE: false,
  DEBUG_ALERT: false,
};

// ── ラベル定数 ──────────────────────────────────────────────────
const MODE_LABELS = {
  case_multi_file:    "案件モード（複数音声対応）",
  single_file_quick:  "単独ファイル簡易モード（1音声のみ）",
};

const SPLIT_LABELS = {
  3:  "3分（高精度検証用・解析件数大幅増）",
  5:  "5分（詳細確認向け・解析件数増）",
  10: "10分（やや細かめ）",
  15: "15分（標準）",
  20: "20分（長時間向け）",
};

// ── アプリケーション状態 ─────────────────────────────────────────
const state = {
  currentStep: 1,
  analysisMode: "case_multi_file",
  caseTitle: "",
  caseId: "",
  email: "",
  gender: "",
  splitMinutes: 15,
  specificPhrases: [],
  selectedTechniques: [],
  inviteCode: "",
  driveUrl: "",
  folderId: "",
  resultFolderId: "",
  resultDriveUrl: "",
  caseFolderId: "",
  caseDriveUrl: "",
  rawLockedFolderId: "",
  rawLockedDriveUrl: "",
  applicationSubmitted: false,
  analysisRequested: false,
};

// ── DOM参照 ──────────────────────────────────────────────────────
const panels = {
  1: document.getElementById("panel-step-1"),
  2: document.getElementById("panel-step-2"),
  3: document.getElementById("panel-step-3"),
  4: document.getElementById("panel-step-4"),
};

const progressChips = {
  1: document.getElementById("progress-step-1"),
  2: document.getElementById("progress-step-2"),
  3: document.getElementById("progress-step-3"),
  4: document.getElementById("progress-step-4"),
};

const globalMessage        = document.getElementById("globalMessage");
const applicationForm      = document.getElementById("applicationForm");
const actionPrimaryButton  = document.getElementById("actionPrimaryButton");
const actionBackButton     = document.getElementById("actionBackButton");
const actionStatus         = document.getElementById("actionStatus");
const driveFolderLink      = document.getElementById("driveFolderLink");
const analysisDriveLink    = document.getElementById("analysisDriveLink");
const uploadDoneCheck      = document.getElementById("uploadDoneCheck");
const microStepUploadText  = document.getElementById("microStepUploadText");
const modeUploadHelp       = document.getElementById("modeUploadHelp");
const modePill             = document.getElementById("modePill");
const modeWarningPill      = document.getElementById("modeWarningPill");
const step2GuideList       = document.getElementById("step2GuideList");
const step3Checklist       = document.getElementById("step3Checklist");
const doneStatusText       = document.getElementById("doneStatusText");
const modeCards            = Array.from(document.querySelectorAll(".mode-card"));
const hamburger            = document.getElementById("hamburger");
const navLinks             = document.getElementById("navLinks");

// サマリー DOM
const summaryFields = {
  caseTitle:  document.getElementById("summaryCaseTitle"),
  caseId:     document.getElementById("summaryCaseId"),
  mode:       document.getElementById("summaryMode"),
  email:      document.getElementById("summaryEmail"),
  gender:     document.getElementById("summaryGender"),
  split:      document.getElementById("summarySplit"),
  phrases:    document.getElementById("summaryPhrases"),
  techniques: document.getElementById("summaryTechniques"),
};

const analysisFields = {
  caseTitle: document.getElementById("analysisCaseTitle"),
  caseId:    document.getElementById("analysisCaseId"),
  mode:      document.getElementById("analysisMode"),
  email:     document.getElementById("analysisEmail"),
};

const doneFields = {
  caseTitle: document.getElementById("doneCaseTitle"),
  caseId:    document.getElementById("doneCaseId"),
  mode:      document.getElementById("doneMode"),
  email:     document.getElementById("doneEmail"),
};

// ── ユーティリティ ───────────────────────────────────────────────
function getModeLabel(mode) {
  return MODE_LABELS[mode] || mode || "-";
}

function getSplitLabel(value) {
  return SPLIT_LABELS[value] || `${value}分`;
}

function displayCaseTitle() {
  return state.caseTitle || "未入力";
}

function parseSpecificPhrases(rawText) {
  return Array.from(
    new Set(
      String(rawText || "")
        .split(/[,\n、]+/)
        .map(s => s.trim())
        .filter(Boolean)
    )
  );
}

function formatSpecificPhrases(arr) {
  return Array.isArray(arr) && arr.length ? arr.join("、") : "なし";
}

function sanitize(str) {
  const el = document.createElement("div");
  el.textContent = String(str || "");
  return el.innerHTML;
}

// ── メッセージ表示 ─────────────────────────────────────────────
let messageTimer = null;

function showMessage(text, type = "info", autoClear = false) {
  if (!globalMessage) return;
  globalMessage.textContent = text;
  globalMessage.className = `floating-message show ${type}`;
  if (messageTimer) clearTimeout(messageTimer);
  if (autoClear) {
    messageTimer = setTimeout(clearMessage, 5000);
  }
}

function clearMessage() {
  if (!globalMessage) return;
  globalMessage.textContent = "";
  globalMessage.className = "floating-message info";
}

// ── バリデーション ─────────────────────────────────────────────
function validateStep1() {
  let valid = true;

  const emailInput  = document.getElementById("clientEmail");
  const inviteInput = document.getElementById("inviteCode");
  const genderInput = document.getElementById("clientGender");
  const emailError  = document.getElementById("emailError");
  const inviteError = document.getElementById("inviteError");
  const genderError = document.getElementById("genderError");

  // 初期化
  [emailInput, inviteInput, genderInput].forEach(el => el?.classList.remove("invalid"));
  if (emailError)  emailError.textContent  = "";
  if (inviteError) inviteError.textContent = "";
  if (genderError) genderError.textContent = "";

  // メール
  const emailVal = emailInput?.value.trim() || "";
  const emailRe  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailVal) {
    if (emailInput) emailInput.classList.add("invalid");
    if (emailError) emailError.textContent = "メールアドレスを入力してください。";
    valid = false;
  } else if (!emailRe.test(emailVal)) {
    if (emailInput) emailInput.classList.add("invalid");
    if (emailError) emailError.textContent = "有効なメールアドレスを入力してください。";
    valid = false;
  }

  // 招待コード
  const inviteVal = inviteInput?.value.trim() || "";
  if (!inviteVal) {
    if (inviteInput) inviteInput.classList.add("invalid");
    if (inviteError) inviteError.textContent = "招待コードを入力してください。";
    valid = false;
  }

  // 性別
  const genderVal = genderInput?.value || "";
  if (!genderVal) {
    if (genderInput) genderInput.classList.add("invalid");
    if (genderError) genderError.textContent = "依頼者の性別を選択してください。";
    valid = false;
  }

  return valid;
}

// ── Mode cards ────────────────────────────────────────────────
function updateModeCards() {
  modeCards.forEach(card => {
    const mode = card.dataset.mode;
    const isSelected = mode === state.analysisMode;
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-checked", isSelected ? "true" : "false");
    const input = card.querySelector("input[type='radio']");
    if (input) input.checked = isSelected;
  });
}

// ── Drive links ───────────────────────────────────────────────
function updateDriveLinks() {
  [driveFolderLink, analysisDriveLink].forEach(link => {
    if (!link) return;
    if (state.driveUrl) {
      link.href = state.driveUrl;
      link.classList.remove("empty-link");
    } else {
      link.href = "#";
      link.classList.add("empty-link");
    }
  });
}

// ── サマリー同期 ──────────────────────────────────────────────
function syncSummaries() {
  if (summaryFields.caseTitle)  summaryFields.caseTitle.textContent  = displayCaseTitle();
  if (summaryFields.caseId)     summaryFields.caseId.textContent     = state.caseId || "-";
  if (summaryFields.mode)       summaryFields.mode.textContent       = getModeLabel(state.analysisMode);
  if (summaryFields.email)      summaryFields.email.textContent      = state.email || "-";
  if (summaryFields.gender)     summaryFields.gender.textContent     = state.gender || "-";
  if (summaryFields.split)      summaryFields.split.textContent      = getSplitLabel(state.splitMinutes);
  if (summaryFields.phrases)    summaryFields.phrases.textContent    = formatSpecificPhrases(state.specificPhrases);
  if (summaryFields.techniques) summaryFields.techniques.textContent = state.selectedTechniques.length ? state.selectedTechniques.join("、") : "未選択";

  if (analysisFields.caseTitle) analysisFields.caseTitle.textContent = displayCaseTitle();
  if (analysisFields.caseId)    analysisFields.caseId.textContent    = state.caseId || "-";
  if (analysisFields.mode)      analysisFields.mode.textContent      = getModeLabel(state.analysisMode);
  if (analysisFields.email)     analysisFields.email.textContent     = state.email || "-";

  if (doneFields.caseTitle) doneFields.caseTitle.textContent = displayCaseTitle();
  if (doneFields.caseId)    doneFields.caseId.textContent    = state.caseId || "-";
  if (doneFields.mode)      doneFields.mode.textContent      = getModeLabel(state.analysisMode);
  if (doneFields.email)     doneFields.email.textContent     = state.email || "-";

  // モード別テキスト
  const isMulti = state.analysisMode === "case_multi_file";
  if (modeUploadHelp) {
    modeUploadHelp.textContent = isMulti
      ? "案件モードです。複数の音声ファイルをアップロードできます。アップロード後はこのページへ戻り、完了チェックを入れて次へ進んでください。"
      : "単独ファイル簡易モードです。音声ファイルは1件のみアップロードしてください。2件以上ある場合は開始できません。";
  }

  if (modePill) {
    modePill.textContent = isMulti ? "案件モード / 複数音声対応" : "単独ファイル簡易モード / 1音声のみ";
  }

  if (modeWarningPill) {
    modeWarningPill.textContent = isMulti ? "複数ファイルをアップロード可能" : "音声は1件のみ";
  }

  if (microStepUploadText) {
    microStepUploadText.textContent = isMulti
      ? "複数の音声ファイルをアップロードできます。"
      : "音声ファイルを1件だけアップロードしてください。";
  }

  if (step2GuideList) {
    step2GuideList.innerHTML = isMulti
      ? "<li>下の青いボタンから専用アップロード先を開いてください。</li><li>確認対象の音声ファイルをアップロードしてください。</li><li>アップロード後にこのページへ戻り、完了チェックを入れて次へ進んでください。</li>"
      : "<li>下の青いボタンから専用アップロード先を開いてください。</li><li>確認対象の音声ファイルを1件だけアップロードしてください。</li><li>アップロード後にこのページへ戻り、完了チェックを入れて次へ進んでください。</li>";
  }

  if (step3Checklist) {
    step3Checklist.innerHTML = isMulti
      ? "<li>音声ファイルのアップロードが完了していることを確認してください。</li><li>案件モードでは、複数ファイルがあっても開始できます。</li><li>結果は案件単位で整理され、メールで通知されます。</li>"
      : "<li>音声ファイルが1件だけアップロードされていることを確認してください。</li><li>単独ファイル簡易モードでは、2件以上あると開始できません。</li><li>結果はメールで通知されます。</li>";
  }

  updateDriveLinks();
  updateActionBar();
}

// ── アクションバー ────────────────────────────────────────────
function updateActionBar() {
  const step = state.currentStep;

  if (actionBackButton) {
    actionBackButton.hidden = step === 1 || step === 4;
  }

  if (!actionPrimaryButton) return;

  if (step === 1) {
    if (actionStatus) actionStatus.textContent = "申込内容を入力してください。";
    actionPrimaryButton.textContent = "専用アップロード先を作成する";
    actionPrimaryButton.disabled = false;
  } else if (step === 2) {
    if (actionBackButton) actionBackButton.textContent = "入力内容を修正する";
    if (actionStatus) actionStatus.textContent = state.analysisMode === "case_multi_file"
      ? "アップロード先に音声を入れ、完了チェック後に次へ進んでください。"
      : "アップロード先に音声を1件入れ、完了チェック後に次へ進んでください。";
    actionPrimaryButton.textContent = "アップロード後、次へ進む";
    actionPrimaryButton.disabled = !(uploadDoneCheck?.checked);
  } else if (step === 3) {
    if (actionBackButton) actionBackButton.textContent = "アップロード手順に戻る";
    if (actionStatus) actionStatus.textContent = "アップロード済みなら開始依頼を送信してください。";
    actionPrimaryButton.textContent = "解析を開始する";
    actionPrimaryButton.disabled = false;
  } else if (step === 4) {
    if (actionStatus) actionStatus.textContent = "受付完了です。結果メールをお待ちください。";
    actionPrimaryButton.textContent = "新しい案件を申込む";
    actionPrimaryButton.disabled = false;
  }
}

// ── ステップ描画 ──────────────────────────────────────────────
function renderStep(stepNumber) {
  state.currentStep = stepNumber;

  Object.entries(panels).forEach(([key, panel]) => {
    if (panel) panel.hidden = Number(key) !== stepNumber;
  });

  Object.entries(progressChips).forEach(([key, chip]) => {
    if (!chip) return;
    const num = Number(key);
    chip.classList.remove("active", "done");
    if (stepNumber === 4) {
      chip.classList.add("done");
      return;
    }
    if (num < stepNumber) chip.classList.add("done");
    if (num === stepNumber) chip.classList.add("active");
  });

  syncSummaries();

  const applySection = document.getElementById("apply");
  if (applySection) {
    window.scrollTo({
      top: applySection.offsetTop - 80,
      behavior: "smooth",
    });
  }
}

// ── API呼び出し ───────────────────────────────────────────────
async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `サーバーエラー (HTTP ${res.status})`;
    try {
      const data = await res.json();
      msg = data.message || msg;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }

  return res.json();
}

// デモモード用ダミーレスポンス
function demoApplicationResponse(payload) {
  const caseId = `DEMO-${Date.now()}`;
  return {
    ok: true,
    case_id: caseId,
    case_title: payload.case_title || "デモ案件",
    drive_url: "https://drive.google.com/drive/folders/demo",
    folder_id: "demo_folder_id",
    result_folder_id: "demo_result_folder_id",
    result_drive_url: "https://drive.google.com/drive/folders/demo_result",
    case_folder_id: "demo_case_folder_id",
    case_drive_url: "https://drive.google.com/drive/folders/demo_case",
    raw_locked_folder_id: "demo_raw_locked_folder_id",
    raw_locked_drive_url: "https://drive.google.com/drive/folders/demo_raw",
    message: "【デモモード】専用アップロード先を作成しました。",
  };
}

function demoStartAnalysisResponse() {
  return {
    ok: true,
    case_title: state.caseTitle,
    message: "【デモモード】開始依頼を受け付けました。",
  };
}

async function createApplication(payload) {
  if (CONFIG.USE_DEMO_MODE) {
    await new Promise(r => setTimeout(r, 900));
    return demoApplicationResponse(payload);
  }
  return postJSON(CONFIG.APPLICATION_WEBHOOK_URL, payload);
}

async function startAnalysis(payload) {
  if (CONFIG.USE_DEMO_MODE) {
    await new Promise(r => setTimeout(r, 900));
    return demoStartAnalysisResponse();
  }
  return postJSON(CONFIG.START_ANALYSIS_WEBHOOK_URL, payload);
}

// ── フォーム送信（Step 1 → Step 2） ──────────────────────────
async function handleApplicationSubmit() {
  clearMessage();

  if (!validateStep1()) {
    showMessage("入力内容を確認してください。", "error");
    return;
  }

  // 状態収集
  const caseTitleInput  = document.getElementById("caseTitle");
  const emailInput      = document.getElementById("clientEmail");
  const inviteInput     = document.getElementById("inviteCode");
  const genderInput     = document.getElementById("clientGender");
  const splitInput      = document.getElementById("splitMinutes");
  const phrasesInput    = document.getElementById("specificPhrases");

  state.caseTitle       = caseTitleInput?.value.trim() || "";
  state.email           = emailInput?.value.trim() || "";
  state.inviteCode      = inviteInput?.value.trim() || "";
  state.gender          = genderInput?.value || "";
  state.splitMinutes    = parseInt(splitInput?.value || "15", 10);
  state.specificPhrases = parseSpecificPhrases(phrasesInput?.value || "");
  state.selectedTechniques = Array.from(
    document.querySelectorAll('input[name="technique"]:checked')
  ).map(cb => cb.value);

  actionPrimaryButton.disabled = true;
  actionPrimaryButton.textContent = "専用アップロード先を作成しています...";
  if (actionStatus) actionStatus.textContent = "専用アップロード先を作成しています。";
  showMessage("専用アップロード先を作成しています。", "info");

  try {
    const payload = {
      case_title:          state.caseTitle,
      client_email:        state.email,
      client_gender:       state.gender,
      split_minutes:       state.splitMinutes,
      specific_phrases:    state.specificPhrases,
      selected_techniques: state.selectedTechniques,
      analysis_mode:       state.analysisMode,
      invite_code:         state.inviteCode,
    };

    const result = await createApplication(payload);

    if (CONFIG.DEBUG_ALERT) {
      alert(JSON.stringify(result, null, 2));
    }

    if (
      !result.ok             ||
      !result.case_id        ||
      !result.drive_url      ||
      !result.folder_id      ||
      !result.result_folder_id ||
      !result.result_drive_url ||
      !result.case_folder_id   ||
      !result.case_drive_url   ||
      !result.raw_locked_folder_id
    ) {
      throw new Error(result.message || "アップロード先の作成に失敗しました。");
    }

    state.caseTitle          = result.case_title ?? state.caseTitle;
    state.caseId             = result.case_id || "";
    state.driveUrl           = result.drive_url || "";
    state.folderId           = result.folder_id || "";
    state.resultFolderId     = result.result_folder_id || "";
    state.resultDriveUrl     = result.result_drive_url || "";
    state.caseFolderId       = result.case_folder_id || "";
    state.caseDriveUrl       = result.case_drive_url || "";
    state.rawLockedFolderId  = result.raw_locked_folder_id || "";
    state.rawLockedDriveUrl  = result.raw_locked_drive_url || "";
    state.applicationSubmitted = true;

    if (uploadDoneCheck) uploadDoneCheck.checked = false;

    syncSummaries();
    renderStep(2);
    showMessage(result.message || "専用アップロード先を作成しました。", "success", true);

  } catch (error) {
    showMessage(error.message || "アップロード先の作成に失敗しました。時間をおいて再度お試しください。", "error");
    console.error("[ALIS] createApplication error:", error);
  } finally {
    actionPrimaryButton.disabled = false;
    updateActionBar();
  }
}

// ── Step 2 → Step 3 ───────────────────────────────────────────
function goForwardFromStep2() {
  clearMessage();

  if (!uploadDoneCheck?.checked) {
    showMessage("音声アップロード完了後にチェックを入れてから次へ進んでください。", "error");
    updateActionBar();
    return;
  }

  syncSummaries();
  renderStep(3);
  showMessage("アップロード済みなら開始ボタンを押してください。", "info");
}

// ── Step 3 → Step 4（解析開始） ───────────────────────────────
async function handleStartAnalysis() {
  clearMessage();

  if (!state.applicationSubmitted || !state.caseId) {
    showMessage("先に申込内容を送信してください。", "error");
    renderStep(1);
    return;
  }

  actionPrimaryButton.disabled = true;
  actionPrimaryButton.textContent = "開始依頼を送信しています...";
  if (actionStatus) actionStatus.textContent = "アップロード内容を確認し、開始依頼を送信しています。";
  showMessage("アップロード内容を確認し、開始依頼を送信しています。", "info");

  try {
    const payload = {
      case_id:             state.caseId,
      case_title:          state.caseTitle,
      analysis_mode:       state.analysisMode,
      client_email:        state.email,
      client_gender:       state.gender,
      split_minutes:       state.splitMinutes,
      specific_phrases:    state.specificPhrases,
      selected_techniques: state.selectedTechniques,
      invite_code:         state.inviteCode,
      folder_id:           state.folderId,
      drive_url:           state.driveUrl,
      result_folder_id:    state.resultFolderId,
      result_drive_url:    state.resultDriveUrl,
      case_folder_id:      state.caseFolderId,
      case_drive_url:      state.caseDriveUrl,
      raw_locked_folder_id: state.rawLockedFolderId,
      raw_locked_drive_url: state.rawLockedDriveUrl,
    };

    const result = await startAnalysis(payload);

    if (!result.ok) {
      const errorType = result.error_type || "";
      if (errorType === "no_audio") {
        throw new Error(result.message || "アップロード先に有効な音声ファイルがありません。ファイルをアップロードしてから再度お試しください。");
      }
      if (errorType === "multiple_audio") {
        throw new Error(result.message || "単独ファイル簡易モードでは音声を1件にしてください。");
      }
      throw new Error(result.message || "開始依頼に失敗しました。アップロード内容を確認してください。");
    }

    state.caseTitle       = result.case_title ?? state.caseTitle;
    state.analysisRequested = true;

    if (doneStatusText) {
      doneStatusText.textContent = result.message || "開始依頼を受け付けました。結果はメールで通知されます。";
    }

    syncSummaries();
    renderStep(4);
    showMessage(result.message || "開始依頼を受け付けました。", "success");

  } catch (error) {
    showMessage(error.message || "開始依頼に失敗しました。", "error");
    console.error("[ALIS] startAnalysis error:", error);
  } finally {
    actionPrimaryButton.disabled = false;
    updateActionBar();
  }
}

// ── 戻る ─────────────────────────────────────────────────────
function goBack() {
  clearMessage();
  if (state.currentStep === 2) {
    renderStep(1);
  } else if (state.currentStep === 3) {
    renderStep(2);
  }
}

// ── リスタート ────────────────────────────────────────────────
function restartFlow() {
  clearMessage();
  if (applicationForm) applicationForm.reset();

  document.querySelectorAll('input[name="technique"]').forEach(cb => {
    cb.checked = false;
  });

  if (uploadDoneCheck) uploadDoneCheck.checked = false;

  const defaultModeInput = document.querySelector('input[name="analysisMode"][value="case_multi_file"]');
  if (defaultModeInput) defaultModeInput.checked = true;

  Object.assign(state, {
    currentStep: 1,
    analysisMode: "case_multi_file",
    caseTitle: "",
    caseId: "",
    email: "",
    gender: "",
    splitMinutes: 15,
    specificPhrases: [],
    selectedTechniques: [],
    inviteCode: "",
    driveUrl: "",
    folderId: "",
    resultFolderId: "",
    resultDriveUrl: "",
    caseFolderId: "",
    caseDriveUrl: "",
    rawLockedFolderId: "",
    rawLockedDriveUrl: "",
    applicationSubmitted: false,
    analysisRequested: false,
  });

  if (doneStatusText) {
    doneStatusText.textContent = "開始依頼を受け付けました。結果はメールで通知されます。";
  }

  updateModeCards();
  syncSummaries();
  renderStep(1);
  showMessage("新しい案件の申込を開始できます。", "info", true);
}

// ── イベントリスナー ──────────────────────────────────────────

// フォーム送信
if (applicationForm) {
  applicationForm.addEventListener("submit", async e => {
    e.preventDefault();
    await handleApplicationSubmit();
  });
}

// プライマリボタン
if (actionPrimaryButton) {
  actionPrimaryButton.addEventListener("click", async () => {
    if (state.currentStep === 1) {
      if (applicationForm.requestSubmit) {
        applicationForm.requestSubmit();
      } else {
        applicationForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    } else if (state.currentStep === 2) {
      goForwardFromStep2();
    } else if (state.currentStep === 3) {
      await handleStartAnalysis();
    } else if (state.currentStep === 4) {
      restartFlow();
    }
  });
}

// 戻るボタン
if (actionBackButton) {
  actionBackButton.addEventListener("click", goBack);
}

// アップロード完了チェック
if (uploadDoneCheck) {
  uploadDoneCheck.addEventListener("change", updateActionBar);
}

// モードカード
modeCards.forEach(card => {
  const selectMode = () => {
    state.analysisMode = card.dataset.mode;
    updateModeCards();
    if (state.currentStep === 2 && uploadDoneCheck) {
      uploadDoneCheck.checked = false;
    }
    syncSummaries();
  };

  card.addEventListener("click", selectMode);
  card.addEventListener("keydown", e => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      selectMode();
    }
  });
});

// ハンバーガーメニュー
if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  // メニュー外クリックで閉じる
  document.addEventListener("click", e => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    }
  });

  // ナビリンククリックで閉じる
  navLinks.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });
}

// ── 初期化 ────────────────────────────────────────────────────
updateModeCards();
syncSummaries();
renderStep(1);
