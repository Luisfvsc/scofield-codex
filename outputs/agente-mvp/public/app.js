const fileList = document.querySelector("#fileList");
const projectCount = document.querySelector("#projectCount");
const rootLabel = document.querySelector("#rootLabel");
const taskInput = document.querySelector("#taskInput");
const runBtn = document.querySelector("#runBtn");
const reloadBtn = document.querySelector("#reloadBtn");
const steps = document.querySelector("#steps");
const diffBox = document.querySelector("#diffBox");
const riskLabel = document.querySelector("#riskLabel");
const planState = document.querySelector("#planState");
const providerLabel = document.querySelector("#providerLabel");
const proposalBtn = document.querySelector("#proposalBtn");
const applyBtn = document.querySelector("#applyBtn");
const proposalTarget = document.querySelector("#proposalTarget");
const proposalState = document.querySelector("#proposalState");
const targetInput = document.querySelector("#targetInput");
const suggestTargetBtn = document.querySelector("#suggestTargetBtn");
const historyList = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");
const tokenMetric = document.querySelector("#tokenMetric");
const costMetric = document.querySelector("#costMetric");
const modelMetric = document.querySelector("#modelMetric");
const policyState = document.querySelector("#policyState");
const allowAi = document.querySelector("#allowAi");
const allowProposals = document.querySelector("#allowProposals");
const allowApply = document.querySelector("#allowApply");
const maxCost = document.querySelector("#maxCost");
const blockedPaths = document.querySelector("#blockedPaths");
const savePolicyBtn = document.querySelector("#savePolicyBtn");
const includeRelated = document.querySelector("#includeRelated");
const gitState = document.querySelector("#gitState");
const gitBranch = document.querySelector("#gitBranch");
const gitStatus = document.querySelector("#gitStatus");
const gitDiffBox = document.querySelector("#gitDiffBox");
const refreshGitBtn = document.querySelector("#refreshGitBtn");

let currentTask = "";
let currentPlan = null;
let currentProposal = null;
let currentPolicy = null;

function formatSize(size) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  return `${Math.round(size / 1024)} KB`;
}

function renderFiles(files) {
  fileList.innerHTML = files.slice(0, 80).map((file) => `
    <button class="file-row" data-path="${escapeHtml(file.path)}" ${file.type === "folder" ? "disabled" : ""}>
      <span class="badge ${file.type}">${file.type === "folder" ? "pasta" : "arquivo"}</span>
      <span class="path" title="${file.path}">${file.path}${file.size ? ` · ${formatSize(file.size)}` : ""}</span>
    </button>
  `).join("");

  fileList.querySelectorAll(".file-row:not(:disabled)").forEach((row) => {
    row.addEventListener("click", () => {
      targetInput.value = row.dataset.path;
      proposalState.textContent = `Arquivo alvo selecionado: ${row.dataset.path}`;
    });
  });
}

function renderPlan(result) {
  currentPlan = result;
  currentProposal = null;
  proposalBtn.disabled = false;
  suggestTargetBtn.disabled = !result.suggestedTarget;
  applyBtn.disabled = true;
  proposalTarget.textContent = "Alteracao ainda nao preparada";
  proposalState.textContent = result.suggestedTarget
    ? `Sugestao de alvo: ${result.suggestedTarget}`
    : "Revise o plano e prepare uma proposta aplicavel.";

  steps.innerHTML = result.steps.map((step, index) => `
    <div class="step">
      <strong>${index + 1}. ${step.title}</strong>
      <span>${step.detail}</span>
    </div>
  `).join("");

  diffBox.innerHTML = result.diff.map((line) => {
    const cls = line.kind === "add" ? "add" : line.kind === "remove" ? "remove" : "";
    return `<span class="${cls}">${escapeHtml(line.text)}</span>`;
  }).join("\n");

  riskLabel.textContent = `Risco: ${result.risk}`;
  planState.textContent = result.mode === "openai" ? "IA conectada" : result.mode === "fallback" ? "Fallback local" : "Plano local";
}

function useSuggestedTarget() {
  if (!currentPlan?.suggestedTarget) return;
  targetInput.value = currentPlan.suggestedTarget;
  proposalState.textContent = `Arquivo alvo definido pela sugestao: ${currentPlan.suggestedTarget}`;
}

function renderProposal(proposal) {
  currentProposal = proposal;
  proposalTarget.textContent = proposal.targets?.join(", ") || proposal.target;
  proposalState.textContent = `Proposta pronta: ${proposal.fileCount || 1} arquivo(s), ${proposal.operation} (${proposal.anchor}). ${proposal.beforeLength} bytes -> ${proposal.afterLength} bytes.`;
  applyBtn.disabled = false;

  if (proposal.unifiedDiff) {
    diffBox.textContent = proposal.unifiedDiff;
    return;
  }

  diffBox.innerHTML = proposal.diff.map((line) => {
    const cls = line.kind === "add" ? "add" : line.kind === "remove" ? "remove" : "";
    return `<span class="${cls}">${escapeHtml(line.text)}</span>`;
  }).join("\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value) {
  return `US$ ${Number(value || 0).toFixed(6)}`;
}

function renderHistory(entries, totals) {
  historyCount.textContent = `${entries.length} evento${entries.length === 1 ? "" : "s"}`;
  tokenMetric.textContent = String(totals?.totalTokens || 0);
  costMetric.textContent = formatMoney(totals?.estimatedCost || 0);

  if (!entries.length) {
    historyList.innerHTML = '<p class="empty">Nenhuma tarefa registrada nesta sessao.</p>';
    return;
  }

  historyList.innerHTML = entries.map((entry) => `
    <div class="history-item">
      <div>
        <strong>${escapeHtml(entry.status || entry.type)}</strong>
        <span>${formatTime(entry.createdAt)} · ${escapeHtml(entry.mode || "local")} · ${formatMoney(entry.usage?.estimatedCost || 0)}</span>
      </div>
      <p>${escapeHtml(entry.task || "Sem descricao")}</p>
      <small>${escapeHtml(entry.target || "sem arquivo")}</small>
    </div>
  `).join("");
}

function renderGit(info) {
  if (!info.available) {
    gitState.textContent = "Indisponivel";
    gitBranch.textContent = "Sem repositorio Git";
    gitStatus.innerHTML = `<p class="empty">${escapeHtml(info.message || "Git nao disponivel.")}</p>`;
    gitDiffBox.textContent = "// Sem diff Git.";
    return;
  }

  gitState.textContent = `${info.status.length} arquivo${info.status.length === 1 ? "" : "s"}`;
  gitBranch.textContent = `Branch: ${info.branch}`;
  gitStatus.innerHTML = info.status.length
    ? info.status.map((line) => `<div class="git-line">${escapeHtml(line)}</div>`).join("")
    : '<p class="empty">Arvore limpa.</p>';
  gitDiffBox.textContent = info.diff || "// Nenhum diff local.";
}

async function loadGit() {
  gitState.textContent = "Verificando...";
  const response = await fetch("/api/git");
  const info = await response.json();
  renderGit(info);
}

async function loadHistory() {
  const response = await fetch("/api/history");
  const data = await response.json();
  renderHistory(data.entries || [], data.totals || {});
}

function renderPolicy(policy) {
  currentPolicy = policy;
  allowAi.checked = Boolean(policy.allowAi);
  allowProposals.checked = Boolean(policy.allowProposals);
  allowApply.checked = Boolean(policy.allowApply);
  maxCost.value = policy.maxEstimatedCostPerTask || 0;
  blockedPaths.value = (policy.blockedPaths || []).join(", ");
  policyState.textContent = "Ativas";
}

async function loadPolicy() {
  const response = await fetch("/api/policy");
  const policy = await response.json();
  renderPolicy(policy);
}

async function savePolicy() {
  savePolicyBtn.disabled = true;
  policyState.textContent = "Salvando...";
  const response = await fetch("/api/policy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      allowAi: allowAi.checked,
      allowProposals: allowProposals.checked,
      allowApply: allowApply.checked,
      maxEstimatedCostPerTask: Number(maxCost.value || 0),
      blockedPaths: blockedPaths.value.split(",").map((item) => item.trim()).filter(Boolean),
    }),
  });
  const policy = await response.json();
  if (!response.ok) {
    policyState.textContent = policy.error || "Falha";
  } else {
    renderPolicy(policy);
    await loadProject();
    await loadHistory();
  }
  savePolicyBtn.disabled = false;
}

async function loadProject() {
  projectCount.textContent = "Lendo projeto...";
  const response = await fetch("/api/project");
  const project = await response.json();
  rootLabel.textContent = project.root.split(/[\\\\/]/).slice(-1)[0];
  projectCount.textContent = `${project.fileCount} arquivos`;
  providerLabel.textContent = project.ai.configured
    ? `IA: ${project.ai.model}`
    : "IA local simulada";
  modelMetric.textContent = project.ai.model;
  renderPolicy(project.policy);
  renderFiles(project.files);
  await loadHistory();
  await loadGit();
}

async function runTask() {
  const task = taskInput.value.trim();
  if (!task) {
    planState.textContent = "Descreva uma tarefa";
    return;
  }

  runBtn.disabled = true;
  proposalBtn.disabled = true;
  applyBtn.disabled = true;
  suggestTargetBtn.disabled = true;
  currentTask = task;
  planState.textContent = "Analisando...";
  diffBox.textContent = "// Preparando proposta...";
  proposalTarget.textContent = "Nenhum arquivo preparado";
  proposalState.textContent = "Aguardando plano.";

  const response = await fetch("/api/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  const result = await response.json();

  if (!response.ok) {
    planState.textContent = "Erro";
    diffBox.textContent = result.error || "Falha ao gerar plano.";
  } else {
    renderPlan(result);
    await loadHistory();
  }

  runBtn.disabled = false;
}

async function prepareProposal() {
  if (!currentTask || !currentPlan) return;

  proposalBtn.disabled = true;
  applyBtn.disabled = true;
  proposalState.textContent = "Preparando proposta real...";

  const response = await fetch("/api/proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: currentTask,
      plan: currentPlan,
      target: targetInput.value.trim(),
      includeRelated: includeRelated.checked,
    }),
  });
  const proposal = await response.json();

  if (!response.ok) {
    proposalState.textContent = proposal.error || "Falha ao preparar proposta.";
    proposalBtn.disabled = false;
    return;
  }

  renderProposal(proposal);
  await loadHistory();
  proposalBtn.disabled = false;
}

async function applyProposal() {
  if (!currentProposal) return;

  applyBtn.disabled = true;
  proposalBtn.disabled = true;
  proposalState.textContent = "Salvando alteracao aprovada...";

  const response = await fetch("/api/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposalId: currentProposal.id }),
  });
  const result = await response.json();

  if (!response.ok) {
    proposalState.textContent = result.error || "Falha ao aplicar proposta.";
    proposalBtn.disabled = false;
    applyBtn.disabled = false;
    return;
  }

  proposalState.textContent = `Aplicado em ${(result.targets || [result.target]).join(", ")}.`;
  currentProposal = null;
  await loadProject();
  await loadHistory();
  await loadGit();
}

runBtn.addEventListener("click", runTask);
reloadBtn.addEventListener("click", loadProject);
proposalBtn.addEventListener("click", prepareProposal);
applyBtn.addEventListener("click", applyProposal);
suggestTargetBtn.addEventListener("click", useSuggestedTarget);
savePolicyBtn.addEventListener("click", savePolicy);
refreshGitBtn.addEventListener("click", loadGit);
loadProject().catch((error) => {
  projectCount.textContent = "Falha ao ler projeto";
  fileList.innerHTML = `<p class="empty">${error.message}</p>`;
  loadPolicy().catch(() => {
    policyState.textContent = "Falha";
  });
});
