const APPLICATION_WEBHOOK_URL = "https://hook.us2.make.com/7c0gj3vqee7and2csx7nxwlft87b2z3w";
const START_ANALYSIS_WEBHOOK_URL = "https://hook.us2.make.com/ay3nde09oq5zpilowarq8y58k3ap8jf2";

const USE_DEMO_MODE = false;
const DEBUG_ALERT = false;

const MODE_LABELS = {
  case_multi_file: "案件モード（複数音声対応）",
  single_file_quick: "単独ファイル簡易モード（1音声のみ）"
};

const SPLIT_LABELS = {
  3: "3分（高精度検証用・解析件数大幅増）",
  5: "5分（詳細確認向け・解析件数増）",
  10: "10分（やや細かめ）",
  15: "15分（標準）",
  20: "20分（長時間向け）"
};

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
  analysisRequested: false
};

const panels = {
  1: document.getElementById("panel-step-1"),
  2: document.getElementById("panel-step-2"),
  3: document.getElementById("panel-step-3"),
  4: document.getElementById("panel-step-4")
};

const progressChips = {
  1: document.getElementById("progress-step-1"),
  2: document.getElementById("progress-step-2"),
  3: document.getElementById("progress-step-3"),
  4: document.getElementById("progress-step-4")
};

const globalMessage = document.getElementById("globalMessage");
const applicationForm = document.getElementById("applicationForm");
const actionPrimaryButton = document.getElementById("actionPrimaryButton");
const applicationSubmitButton = actionPrimaryButton;

const driveFolderLink = document.getElementById("driveFolderLink");
const analysisDriveLink = document.getElementById("analysisDriveLink");

const summaryCaseTitle = document.getElementById("summaryCaseTitle");
const summaryCaseId = document.getElementById("summaryCaseId");
const summaryMode = document.getElementById("summaryMode");
const summaryEmail = document.getElementById("summaryEmail");
const summaryGender = document.getElementById("summaryGender");
const summarySplit = document.getElementById("summarySplit");
const summaryPhrases = document.getElementById("summaryPhrases");
const summaryTechniques = document.getElementById("summaryTechniques");

const analysisCaseTitle = document.getElementById("analysisCaseTitle");
const analysisCaseId = document.getElementById("analysisCaseId");
const analysisModeText = document.getElementById("analysisMode");
const analysisEmail = document.getElementById("analysisEmail");

const doneCaseTitle = document.getElementById("doneCaseTitle");
const doneCaseId = document.getElementById("doneCaseId");
const doneMode = document.getElementById("doneMode");
const doneEmail = document.getElementById("doneEmail");
const doneStatusText = document.getElementById("doneStatusText");

const modeUploadHelp = document.getElementById("modeUploadHelp");
const modePill = document.getElementById("modePill");
const modeWarningPill = document.getElementById("modeWarningPill");
const step2GuideList = document.getElementById("step2GuideList");
const step3Checklist = document.getElementById("step3Checklist");
const uploadDoneCheck = document.getElementById("uploadDoneCheck");
const microStepUploadText = document.getElementById("microStepUploadText");

const actionBackButton = document.getElementById("actionBackButton");
const actionStatus = document.getElementById("actionStatus");

const modeCards = Array.from(document.querySelectorAll(".mode-card"));

function displayCaseTitle() {
  return state.caseTitle || "未入力";
}

function getSplitLabel(value) {
  return SPLIT_LABELS[value] || `${value}分`;
}

function parseSpecificPhrases(rawText) {
  return Array.from(
    new Set(
      String(rawText || "")
        .split(/[,\n、]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function formatSpecificPhrases(arr) {
  return Array.isArray(arr) && arr.length ? arr.join("、") : "なし";
}

function showMessage(text, type = "info") {
  globalMessage.textContent = text;
  globalMessage.className = `floating-message show ${type}`;
}

function clearMessage() {
  globalMessage.textContent = "";
  globalMessage.className = "floating-message info";
}

function getModeLabel(mode) {
  return MODE_LABELS[mode] || mode || "-";
}

function updateModeCards() {
  modeCards.forEach((card) => {
    const mode = card.dataset.mode;
    const isSelected = mode === state.analysisMode;
    card.classList.toggle("selected", isSelected);
    const input = card.querySelector('input[type="radio"]');
    if (input) input.checked = isSelected;
  });
}

function updateDriveLinks() {
  [driveFolderLink, analysisDriveLink].forEach((link) => {
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

function syncSummaries() {
  summaryCaseTitle.textContent = displayCaseTitle();
  summaryCaseId.textContent = state.caseId || "-";
  summaryMode.textContent = getModeLabel(state.analysisMode);
  summaryEmail.textContent = state.email || "-";
  summaryGender.textContent = state.gender || "-";
  summarySplit.textContent = getSplitLabel(state.splitMinutes);
  summaryPhrases.textContent = formatSpecificPhrases(state.specificPhrases);
  summaryTechniques.textContent = state.selectedTechniques.length
    ? state.selectedTechniques.join("、")
    : "未選択";

  analysisCaseTitle.textContent = displayCaseTitle();
  analysisCaseId.textContent = state.caseId || "-";
  analysisModeText.textContent = getModeLabel(state.analysisMode);
  analysisEmail.textContent = state.email || "-";

  doneCaseTitle.textContent = displayCaseTitle();
  doneCaseId.textContent = state.caseId || "-";
  doneMode.textContent = getModeLabel(state.analysisMode);
  doneEmail.textContent = state.email || "-";

  if (state.analysisMode === "case_multi_file") {
    modeUploadHelp.textContent =
      "案件モードです。複数の音声ファイルをアップロードできます。アップロード後はこのページへ戻り、完了チェックを入れて次へ進んでください。";
    modePill.textContent = "案件モード / 複数音声対応";
    modeWarningPill.textContent = "複数ファイルをアップロード可能";
    microStepUploadText.textContent = "複数の音声ファイルをアップロードできます。";
    step2GuideList.innerHTML = `
      <li>下の青いボタンから専用アップロード先を開いてください。</li>
      <li>確認対象の音声ファイルをアップロードしてください。</li>
      <li>アップロード後にこのページへ戻り、完了チェックを入れて次へ進んでください。</li>
    `;
    step3Checklist.innerHTML = `
      <li>音声ファイルのアップロードが完了していることを確認してください。</li>
      <li>案件モードでは、rawフォルダ内に複数ファイルがあっても開始できます。</li>
      <li>結果は案件単位で整理され、メールで通知されます。</li>
    `;
  } else {
    modeUploadHelp.textContent =
      "単独ファイル簡易モードです。音声ファイルは1件のみアップロードしてください。2件以上ある場合は開始できません。";
    modePill.textContent = "単独ファイル簡易モード / 1音声のみ";
    modeWarningPill.textContent = "音声は1件のみ";
    microStepUploadText.textContent = "音声ファイルを1件だけアップロードしてください。";
    step2GuideList.innerHTML = `
      <li>下の青いボタンから専用アップロード先を開いてください。</li>
      <li>確認対象の音声ファイルを1件だけアップロードしてください。</li>
      <li>アップロード後にこのページへ戻り、完了チェックを入れて次へ進んでください。</li>
    `;
    step3Checklist.innerHTML = `
      <li>音声ファイルが1件だけアップロードされていることを確認してください。</li>
      <li>単独ファイル簡易モードでは、2件以上あると開始できません。</li>
      <li>結果はメールで通知されます。</li>
    `;
  }

  updateDriveLinks();
  updateActionBar();
}

function renderStep(stepNumber) {
  state.currentStep = stepNumber;

  Object.entries(panels).forEach(([key, panel]) => {
    panel.hidden = Number(key) !== stepNumber;
  });

  Object.entries(progressChips).forEach(([key, chip]) => {
    const num = Number(key);
    chip.classList.remove("active", "done");

    if (stepNumber === 4) {
      if (num <= 4) chip.classList.add("done");
      return;
    }

    if (num < stepNumber) chip.classList.add("done");
    if (num === stepNumber) chip.classList.add("active");
  });

  syncSummaries();

  window.scrollTo({
    top: document.getElementById("apply").offsetTop - 16,
    behavior: "smooth"
  });
}

function updateActionBar() {
  const step = state.currentStep;
  actionBackButton.hidden = step === 1 || step === 4;

  if (step === 1) {
    actionBackButton.textContent = "戻る";
    actionStatus.textContent = "申込内容を入力してください。";
    applicationSubmitButton.textContent = "専用アップロード先を作成する";
    applicationSubmitButton.disabled = false;
  }

  if (step === 2) {
    actionBackButton.textContent = "入力内容を修正する";
    actionStatus.textContent =
      state.analysisMode === "case_multi_file"
        ? "アップロード先に音声を入れ、完了チェック後に次へ進んでください。"
        : "アップロード先に音声を1件入れ、完了チェック後に次へ進んでください。";
    applicationSubmitButton.textContent = "アップロード後、次へ進む";
    applicationSubmitButton.disabled = !uploadDoneCheck.checked;
  }

  if (step === 3) {
    actionBackButton.textContent = "アップロード画面へ戻る";
    actionStatus.textContent = "アップロード済みなら、そのまま開始依頼を送信できます。";
    applicationSubmitButton.textContent = "開始依頼を送信する";
    applicationSubmitButton.disabled = false;
  }

  if (step === 4) {
    actionStatus.textContent = "開始依頼を受け付けました。結果はメールで通知されます。";
    applicationSubmitButton.textContent = "別件を新しく申し込む";
    applicationSubmitButton.disabled = false;
  }
}

function collectSelectedTechniques() {
  return Array.from(
    document.querySelectorAll('input[name="technique"]:checked')
  ).map((el) => el.value);
}

function fillStateFromForm() {
  state.analysisMode =
    document.querySelector('input[name="analysisMode"]:checked')?.value ||
    "case_multi_file";
  state.caseTitle = document.getElementById("caseTitle").value.trim();
  state.email = document.getElementById("clientEmail").value.trim();
  state.gender = document.getElementById("clientGender").value;
  state.splitMinutes = Number(document.getElementById("splitMinutes").value);
  state.specificPhrases = parseSpecificPhrases(
    document.getElementById("specificPhrases").value
  );
  state.selectedTechniques = collectSelectedTechniques();
  state.inviteCode = document.getElementById("inviteCode").value.trim();
}

async function createApplication(payload) {
  if (USE_DEMO_MODE) {
    await delay(700);
    const safeName = encodeURIComponent(payload.client_email || "sample@example.com");
    const stamp = Date.now();

    return {
      ok: true,
      client_email: payload.client_email,
      case_title: payload.case_title || "",
      analysis_mode: payload.analysis_mode || "case_multi_file",
      case_id: `ALIS-DEMO-${stamp}`,
      drive_url: `https://drive.google.com/drive/folders/demo-raw-${safeName}`,
      folder_id: `demo-raw-folder-${stamp}`,
      result_folder_id: `demo-result-folder-${stamp}`,
      result_drive_url: `https://drive.google.com/drive/folders/demo-result-${safeName}`,
      case_folder_id: `demo-case-folder-${stamp}`,
      case_drive_url: `https://drive.google.com/drive/folders/demo-case-${safeName}`,
      raw_locked_folder_id: `demo-raw-locked-folder-${stamp}`,
      raw_locked_drive_url: `https://drive.google.com/drive/folders/demo-raw-locked-${safeName}`,
      message: "専用アップロード先を作成しました。"
    };
  }

  const response = await fetch(APPLICATION_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("申込受付APIの呼び出しに失敗しました。");
  }

  return response.json();
}

async function startAnalysis(payload) {
  if (USE_DEMO_MODE) {
    await delay(700);

    return {
      ok: true,
      status: "accepted",
      case_id: payload.case_id,
      case_title: payload.case_title || "",
      message:
        payload.analysis_mode === "single_file_quick"
          ? "単独ファイル簡易モードで開始依頼を受け付けました。結果はメールで通知されます。"
          : "案件モードで開始依頼を受け付けました。結果はメールで通知されます。"
    };
  }

  const response = await fetch(START_ANALYSIS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("開始依頼APIの呼び出しに失敗しました。");
  }

  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleApplicationSubmit() {
  clearMessage();
  fillStateFromForm();

  if (!state.email || !state.gender || !state.splitMinutes || !state.inviteCode) {
    showMessage("メールアドレス、依頼者の性別、分割単位、招待コードは必須です。", "error");
    return;
  }

  applicationSubmitButton.disabled = true;
  applicationSubmitButton.textContent = "専用アップロード先を作成しています...";
  actionStatus.textContent = "専用アップロード先を作成しています。";
  showMessage("専用アップロード先を作成しています。", "info");

  try {
    const payload = {
      case_title: state.caseTitle,
      client_email: state.email,
      client_gender: state.gender,
      split_minutes: state.splitMinutes,
      specific_phrases: state.specificPhrases,
      selected_techniques: state.selectedTechniques,
      analysis_mode: state.analysisMode,
      invite_code: state.inviteCode
    };

    const result = await createApplication(payload);

    if (DEBUG_ALERT) {
      alert(JSON.stringify(result, null, 2));
    }

    if (
      !result.ok ||
      !result.case_id ||
      !result.drive_url ||
      !result.folder_id ||
      !result.result_folder_id ||
      !result.result_drive_url ||
      !result.case_folder_id ||
      !result.case_drive_url ||
      !result.raw_locked_folder_id
    ) {
      throw new Error(result.message || "アップロード先の作成に失敗しました。");
    }

    state.caseTitle = result.case_title ?? state.caseTitle;
    state.caseId = result.case_id || "";
    state.driveUrl = result.drive_url || "";
    state.folderId = result.folder_id || "";
    state.resultFolderId = result.result_folder_id || "";
    state.resultDriveUrl = result.result_drive_url || "";
    state.caseFolderId = result.case_folder_id || "";
    state.caseDriveUrl = result.case_drive_url || "";
    state.rawLockedFolderId = result.raw_locked_folder_id || "";
    state.rawLockedDriveUrl = result.raw_locked_drive_url || "";
    state.applicationSubmitted = true;

    uploadDoneCheck.checked = false;

    syncSummaries();
    renderStep(2);
    showMessage(result.message || "専用アップロード先を作成しました。", "success");
  } catch (error) {
    showMessage(error.message || "アップロード先の作成に失敗しました。", "error");
  } finally {
    applicationSubmitButton.disabled = false;
    updateActionBar();
  }
}

function goBack() {
  clearMessage();

  if (state.currentStep === 2) {
    renderStep(1);
    return;
  }

  if (state.currentStep === 3) {
    renderStep(2);
  }
}

function goForwardFromStep2() {
  clearMessage();

  if (!uploadDoneCheck.checked) {
    showMessage("音声アップロード完了後にチェックを入れてから次へ進んでください。", "error");
    updateActionBar();
    return;
  }

  syncSummaries();
  renderStep(3);
  showMessage("アップロード済みなら開始ボタンを押してください。", "info");
}

async function handleStartAnalysis() {
  clearMessage();

  if (!state.applicationSubmitted || !state.caseId) {
    showMessage("先に申込内容を送信してください。", "error");
    renderStep(1);
    return;
  }

  applicationSubmitButton.disabled = true;
  applicationSubmitButton.textContent = "開始依頼を送信しています...";
  actionStatus.textContent = "アップロード内容を確認し、開始依頼を送信しています。";
  showMessage("アップロード内容を確認し、開始依頼を送信しています。", "info");

  try {
    const payload = {
      case_id: state.caseId,
      case_title: state.caseTitle,
      analysis_mode: state.analysisMode,
      client_email: state.email,
      client_gender: state.gender,
      split_minutes: state.splitMinutes,
      specific_phrases: state.specificPhrases,
      selected_techniques: state.selectedTechniques,
      invite_code: state.inviteCode,
      folder_id: state.folderId,
      drive_url: state.driveUrl,
      result_folder_id: state.resultFolderId,
      result_drive_url: state.resultDriveUrl,
      case_folder_id: state.caseFolderId,
      case_drive_url: state.caseDriveUrl,
      raw_locked_folder_id: state.rawLockedFolderId,
      raw_locked_drive_url: state.rawLockedDriveUrl
    };

    const result = await startAnalysis(payload);

    if (!result.ok) {
      const errorType = result.error_type || "";

      if (errorType === "no_audio") {
        throw new Error(result.message || "アップロード先に有効な音声ファイルがありません。");
      }

      if (errorType === "multiple_audio") {
        throw new Error(result.message || "単独ファイル簡易モードでは音声を1件にしてください。");
      }

      throw new Error(result.message || "開始依頼に失敗しました。アップロード内容を確認してください。");
    }

    state.caseTitle = result.case_title ?? state.caseTitle;
    state.analysisRequested = true;
    doneStatusText.textContent =
      result.message || "開始依頼を受け付けました。結果はメールで通知されます。";

    syncSummaries();
    renderStep(4);
    showMessage(result.message || "開始依頼を受け付けました。", "success");
  } catch (error) {
    showMessage(error.message || "開始依頼に失敗しました。", "error");
  } finally {
    applicationSubmitButton.disabled = false;
    updateActionBar();
  }
}

function restartFlow() {
  clearMessage();
  applicationForm.reset();

  document.querySelectorAll('input[name="technique"]').forEach((checkbox) => {
    checkbox.checked = false;
  });

  const defaultModeInput = document.querySelector(
    'input[name="analysisMode"][value="case_multi_file"]'
  );
  if (defaultModeInput) defaultModeInput.checked = true;

  uploadDoneCheck.checked = false;

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
    analysisRequested: false
  });

  doneStatusText.textContent = "開始依頼を受け付けました。結果はメールで通知されます。";

  updateModeCards();
  syncSummaries();
  renderStep(1);
  showMessage("新しい案件の申込を開始できます。", "info");
}

applicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleApplicationSubmit();
});

modeCards.forEach((card) => {
  const selectMode = () => {
    state.analysisMode = card.dataset.mode;
    updateModeCards();

    if (state.currentStep === 2) {
      uploadDoneCheck.checked = false;
    }

    syncSummaries();
  };

  card.addEventListener("click", selectMode);

  card.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      selectMode();
    }
  });
});

uploadDoneCheck.addEventListener("change", updateActionBar);
actionBackButton.addEventListener("click", goBack);

actionPrimaryButton.addEventListener("click", async () => {
  if (state.currentStep === 1) {
    if (applicationForm.requestSubmit) {
      applicationForm.requestSubmit();
    } else {
      applicationForm.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true })
      );
    }
    return;
  }

  if (state.currentStep === 2) {
    goForwardFromStep2();
    return;
  }

  if (state.currentStep === 3) {
    await handleStartAnalysis();
    return;
  }

  if (state.currentStep === 4) {
    restartFlow();
  }
});

syncSummaries();
updateModeCards();
renderStep(1);