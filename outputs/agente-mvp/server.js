const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(__dirname, "public");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const COST_INPUT_PER_1K = Number(process.env.COST_INPUT_PER_1K || "0");
const COST_OUTPUT_PER_1K = Number(process.env.COST_OUTPUT_PER_1K || "0");
const proposals = new Map();
const DATA_DIR = path.join(__dirname, "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const POLICY_FILE = path.join(DATA_DIR, "policy.json");
const PROPOSALS_FILE = path.join(DATA_DIR, "proposals.json");
const history = loadHistory();
const policy = loadPolicy();
loadProposals();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body, null, 2));
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function loadHistory() {
  const data = readJsonFile(HISTORY_FILE, []);
  return Array.isArray(data) ? data.slice(0, 50) : [];
}

function defaultPolicy() {
  return {
    allowAi: true,
    allowProposals: true,
    allowApply: true,
    maxEstimatedCostPerTask: 0,
    blockedPaths: [".git", "node_modules", "data"],
  };
}

function normalizePolicy(value) {
  const base = defaultPolicy();
  return {
    allowAi: Boolean(value.allowAi ?? base.allowAi),
    allowProposals: Boolean(value.allowProposals ?? base.allowProposals),
    allowApply: Boolean(value.allowApply ?? base.allowApply),
    maxEstimatedCostPerTask: Number(value.maxEstimatedCostPerTask ?? base.maxEstimatedCostPerTask),
    blockedPaths: Array.isArray(value.blockedPaths)
      ? value.blockedPaths.map((item) => String(item).trim()).filter(Boolean)
      : base.blockedPaths,
  };
}

function loadPolicy() {
  return normalizePolicy(readJsonFile(POLICY_FILE, defaultPolicy()));
}

function savePolicy() {
  writeJsonFile(POLICY_FILE, policy);
}

function saveHistory() {
  writeJsonFile(HISTORY_FILE, history.slice(0, 50));
}

function loadProposals() {
  const data = readJsonFile(PROPOSALS_FILE, []);
  if (!Array.isArray(data)) return;
  for (const proposal of data) {
    if (proposal?.id) proposals.set(proposal.id, proposal);
  }
}

function saveProposals() {
  writeJsonFile(PROPOSALS_FILE, [...proposals.values()].slice(-50));
}

function publicProposal(proposal) {
  if (!proposal) return null;
  const { changes, plan, ...safe } = proposal;
  return safe;
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function estimateCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1000) * COST_INPUT_PER_1K;
  const outputCost = (outputTokens / 1000) * COST_OUTPUT_PER_1K;
  return Number((inputCost + outputCost).toFixed(6));
}

function usageFromText(inputText, outputText) {
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost: estimateCost(inputTokens, outputTokens),
    currency: "USD",
    estimated: true,
  };
}

function historyTotals() {
  return history.reduce((totals, entry) => {
    const usage = entry.usage || {};
    totals.inputTokens += Number(usage.inputTokens || 0);
    totals.outputTokens += Number(usage.outputTokens || 0);
    totals.totalTokens += Number(usage.totalTokens || 0);
    totals.estimatedCost += Number(usage.estimatedCost || 0);
    return totals;
  }, {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    currency: "USD",
    estimated: true,
  });
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, target || ".");
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("Caminho fora do projeto bloqueado.");
  }
  return resolved;
}

function readRequest(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Requisicao muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function execFileText(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd: ROOT,
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
        error: error ? error.message : "",
      });
    });
  });
}

async function gitInfo() {
  const root = await execFileText("git", ["rev-parse", "--show-toplevel"]);
  if (!root.ok) {
    return {
      available: false,
      message: "Esta pasta nao esta em um repositorio Git.",
      branch: "",
      status: [],
      diff: "",
    };
  }

  const branch = await execFileText("git", ["branch", "--show-current"]);
  const status = await execFileText("git", ["status", "--short"]);
  const diff = await execFileText("git", ["diff", "--", "."]);

  return {
    available: true,
    root: root.stdout.trim(),
    branch: branch.stdout.trim() || "detached",
    status: status.stdout.split(/\r?\n/).filter(Boolean).slice(0, 80),
    diff: diff.stdout.slice(0, 20000),
  };
}

function scanFiles(dir, depth = 0, prefix = "") {
  if (depth > 3) return [];
  const ignored = new Set([".git", "node_modules", "__pycache__", ".next", "dist", "build"]);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(prefix, entry.name).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      files.push({ path: rel, type: "folder" });
      files.push(...scanFiles(full, depth + 1, rel));
      continue;
    }

    const stat = fs.statSync(full);
    files.push({
      path: rel,
      type: "file",
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return files.slice(0, 200);
}

function pickRelevantFiles(task, files) {
  const text = task.toLowerCase();
  const preferred = files.filter((file) => {
    if (file.type !== "file") return false;
    const p = file.path.toLowerCase();
    return (
      p.endsWith(".html") ||
      p.endsWith(".js") ||
      p.endsWith(".css") ||
      p.endsWith(".md") ||
      p.includes("test") ||
      p.includes("spec") ||
      text.split(/\W+/).some((word) => word.length > 4 && p.includes(word))
    );
  });
  return preferred.slice(0, 8);
}

function chooseTargetFile(relevant) {
  const preferred = relevant.find((file) =>
    /\.(html|js|css|md|txt)$/i.test(file.path) &&
    !file.path.startsWith("work/")
  );
  return preferred?.path || relevant.find((file) => file.type === "file")?.path || "work/agente-ia/tarefas-aprovadas.md";
}

function buildTaskPlan(task, files) {
  const relevant = pickRelevantFiles(task, files);
  const hasFrontend = /tela|front|ui|pagina|page|form|html|css/i.test(task);
  const hasTests = /teste|test|spec|validar|validacao/i.test(task);
  const hasDocs = /doc|manual|readme|comercial|plano/i.test(task);

  const steps = [
    {
      title: "Analisar contexto",
      detail: `Ler ${Math.max(relevant.length, 1)} arquivo(s) provavel(is) e mapear dependencias diretas.`,
    },
    {
      title: "Desenhar mudanca",
      detail: hasFrontend
        ? "Definir componentes, estados de tela e comportamento responsivo."
        : "Definir pontos de alteracao e impacto esperado.",
    },
    {
      title: "Preparar diff",
      detail: "Gerar alteracoes em modo revisao, sem aplicar automaticamente no projeto.",
    },
    {
      title: "Verificar",
      detail: hasTests
        ? "Executar ou sugerir testes focados na mudanca."
        : "Checar consistencia, riscos e lacunas de teste.",
    },
    {
      title: "Entregar resumo",
      detail: hasDocs
        ? "Gerar resumo para decisao comercial e tecnica."
        : "Listar arquivos, riscos, verificacoes e proximas acoes.",
    },
  ];

  const diff = [
    { kind: "context", line: 1, text: "// Proposta de alteracao gerada pelo MVP local" },
    { kind: "add", line: 2, text: `+ tarefa: ${task}` },
    { kind: "add", line: 3, text: "+ modo: revisao supervisionada" },
    { kind: "add", line: 4, text: `+ arquivos sugeridos: ${relevant.map((file) => file.path).join(", ") || "nenhum arquivo especifico encontrado"}` },
    { kind: "remove", line: 5, text: "- aplicar mudancas sem aprovacao" },
    { kind: "add", line: 6, text: "+ gerar diff antes de escrever no projeto" },
  ];

  return {
    mode: "local",
    steps,
    relevantFiles: relevant,
    suggestedTarget: chooseTargetFile(relevant),
    diff,
    risk: hasFrontend || hasTests ? "Medio" : "Baixo",
    summary: "MVP local montou um plano, encontrou arquivos candidatos e preparou uma proposta de diff segura.",
  };
}

function projectSnapshot(files) {
  return files
    .filter((file) => file.type === "file")
    .slice(0, 80)
    .map((file) => `${file.path} (${file.size || 0} bytes)`)
    .join("\n");
}

function extractTextFromResponse(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

function parseJsonText(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function normalizeAiPlan(plan) {
  const steps = Array.isArray(plan.steps) ? plan.steps.slice(0, 7) : [];
  const relevantFiles = Array.isArray(plan.relevantFiles) ? plan.relevantFiles.slice(0, 10) : [];
  const diff = Array.isArray(plan.diff) ? plan.diff.slice(0, 24) : [];

  return {
    mode: "openai",
    steps: steps.map((step) => ({
      title: String(step.title || "Etapa"),
      detail: String(step.detail || ""),
    })),
    relevantFiles: relevantFiles.map((file) => ({
      path: String(file.path || file),
      type: "file",
      reason: file.reason ? String(file.reason) : "",
    })),
    suggestedTarget: String(plan.suggestedTarget || relevantFiles[0]?.path || "work/agente-ia/tarefas-aprovadas.md"),
    diff: diff.map((line, index) => ({
      kind: ["add", "remove", "context"].includes(line.kind) ? line.kind : "context",
      line: Number(line.line || index + 1),
      text: String(line.text || ""),
    })),
    risk: String(plan.risk || "Medio"),
    summary: String(plan.summary || "Plano gerado por IA."),
  };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function addHistory(event) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...event,
  };
  history.unshift(entry);
  history.splice(50);
  saveHistory();
  return entry;
}

function makeProposalMarkdown(task, plan) {
  const createdAt = new Date().toISOString();
  const steps = (plan.steps || [])
    .map((step, index) => `${index + 1}. ${step.title}: ${step.detail}`)
    .join("\n");
  const files = (plan.relevantFiles || [])
    .map((file) => `- ${file.path}${file.reason ? `: ${file.reason}` : ""}`)
    .join("\n");

  return [
    "",
    `## Tarefa aprovada - ${createdAt}`,
    "",
    `Objetivo: ${task}`,
    "",
    `Modo: ${plan.mode || "local"}`,
    `Risco: ${plan.risk || "Nao informado"}`,
    "",
    "### Plano",
    "",
    steps || "Sem etapas registradas.",
    "",
    "### Arquivos sugeridos",
    "",
    files || "Nenhum arquivo especifico sugerido.",
    "",
    "### Resumo",
    "",
    plan.summary || "Sem resumo.",
    "",
  ].join("\n");
}

function markerBlockFor(ext, text) {
  if (ext === ".html") {
    return [
      "",
      "<!-- ENGENHEIRO_IA_PATCH_START -->",
      text,
      "<!-- ENGENHEIRO_IA_PATCH_END -->",
      "",
    ].join("\n");
  }
  if (ext === ".css" || ext === ".js") {
    return [
      "",
      "/* ENGENHEIRO_IA_PATCH_START */",
      text,
      "/* ENGENHEIRO_IA_PATCH_END */",
      "",
    ].join("\n");
  }
  return [
    "",
    "<!-- ENGENHEIRO_IA_PATCH_START -->",
    text,
    "<!-- ENGENHEIRO_IA_PATCH_END -->",
    "",
  ].join("\n");
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function findMarkedRange(before) {
  const patterns = [
    {
      start: "<!-- ENGENHEIRO_IA_PATCH_START -->",
      end: "<!-- ENGENHEIRO_IA_PATCH_END -->",
    },
    {
      start: "/* ENGENHEIRO_IA_PATCH_START */",
      end: "/* ENGENHEIRO_IA_PATCH_END */",
    },
  ];

  for (const pattern of patterns) {
    const start = before.indexOf(pattern.start);
    if (start < 0) continue;
    const end = before.indexOf(pattern.end, start + pattern.start.length);
    if (end < 0) continue;
    return {
      start,
      end: end + pattern.end.length,
      operation: "substituir bloco marcado",
      anchor: "ENGENHEIRO_IA_PATCH_START",
    };
  }

  return null;
}

function findPatchLocation(before, ext) {
  if (!before) {
    return { index: 0, operation: "criar arquivo", anchor: "inicio do arquivo" };
  }

  const markedRange = findMarkedRange(before);
  if (markedRange) return markedRange;

  const anchorsByExt = {
    ".md": ["\n## Proxima evolucao", "\n## Como rodar", "\n# "],
    ".html": ["\n</body>", "\n</main>", "\n</html>"],
    ".css": ["\n@media", "\n:root", ""],
    ".js": ["\nrunBtn.addEventListener", "\nloadProject().catch", ""],
  };
  const anchors = anchorsByExt[ext] || [""];

  for (const anchor of anchors) {
    if (!anchor) {
      return { index: before.length, operation: "inserir no final", anchor: "fim do arquivo" };
    }
    const index = before.indexOf(anchor);
    if (index >= 0) {
      return {
        index,
        operation: "inserir antes da ancora",
        anchor: anchor.trim(),
      };
    }
  }

  return { index: before.length, operation: "inserir no final", anchor: "fim do arquivo" };
}

function makeStructuredDiff(target, before, addition, location) {
  const startIndex = location.start ?? location.index;
  const endIndex = location.end ?? location.index;
  const startLine = startIndex === 0 ? 1 : lineNumberAt(before, startIndex);
  const context = startIndex > 0
    ? before.slice(Math.max(0, startIndex - 120), startIndex).split(/\r?\n/).slice(-2)
    : [];
  const removed = location.end
    ? before.slice(startIndex, endIndex).split(/\r?\n/).slice(0, 24)
    : [];

  return [
    { kind: "context", line: 1, text: `Arquivo: ${target}` },
    { kind: "context", line: 2, text: `Operacao: ${location.operation}` },
    { kind: "context", line: 3, text: `Ancora: ${location.anchor}` },
    ...context.map((line, index) => ({
      kind: "context",
      line: Math.max(1, startLine - context.length + index),
      text: `  ${line}`,
    })),
    ...removed.map((line, index) => ({
      kind: "remove",
      line: startLine + index,
      text: `- ${line}`,
    })),
    ...addition.split(/\r?\n/).map((line, index) => ({
      kind: "add",
      line: startLine + index,
      text: `+ ${line}`,
    })),
  ];
}

function makeUnifiedDiff(target, before, after, location) {
  const startIndex = location.start ?? location.index;
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const startLine = startIndex === 0 ? 1 : lineNumberAt(before, startIndex);
  const oldSliceStart = Math.max(0, startLine - 4);
  const oldSliceEnd = Math.min(beforeLines.length, startLine + 18);
  const newSliceStart = Math.max(0, startLine - 4);
  const newSliceEnd = Math.min(afterLines.length, startLine + 24);
  const oldChunk = beforeLines.slice(oldSliceStart, oldSliceEnd);
  const newChunk = afterLines.slice(newSliceStart, newSliceEnd);

  return [
    `diff --git a/${target} b/${target}`,
    `--- a/${target}`,
    `+++ b/${target}`,
    `@@ -${oldSliceStart + 1},${oldChunk.length} +${newSliceStart + 1},${newChunk.length} @@`,
    ...oldChunk.map((line) => `-${line}`),
    ...newChunk.map((line) => `+${line}`),
  ].join("\n");
}

function normalizeTarget(target) {
  const fallback = "work/agente-ia/tarefas-aprovadas.md";
  const raw = String(target || fallback).trim().replaceAll("\\", "/");
  const blocked = policy.blockedPaths.some((blockedPath) => {
    const normalized = blockedPath.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    return raw === normalized || raw.startsWith(`${normalized}/`) || raw.includes(`/${normalized}/`);
  });
  if (blocked) throw new Error("Este caminho esta bloqueado pelas permissoes do projeto.");
  return raw || fallback;
}

function buildSingleChange(task, plan, requestedTarget) {
  const target = normalizeTarget(requestedTarget);
  const filePath = safeJoin(ROOT, target);
  const before = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (before.length > 250_000) {
    throw new Error("Arquivo grande demais para este MVP.");
  }

  const ext = path.extname(filePath).toLowerCase();
  const markdown = makeProposalMarkdown(task, plan);
  const location = findPatchLocation(before, ext);
  const addition = markerBlockFor(ext, markdown);
  const startIndex = location.start ?? location.index;
  const endIndex = location.end ?? location.index;
  const after = before.slice(0, startIndex) + addition + before.slice(endIndex);
  return {
    target,
    filePath,
    before,
    after,
    operation: location.operation,
    anchor: location.anchor,
    beforeLength: before.length,
    afterLength: after.length,
    diff: makeStructuredDiff(target, before, addition, location),
    unifiedDiff: makeUnifiedDiff(target, before, after, location),
  };
}

function proposalTargets(plan, requestedTarget, includeRelated) {
  const targets = [normalizeTarget(requestedTarget)];
  if (includeRelated) {
    for (const file of plan.relevantFiles || []) {
      if (targets.length >= 3) break;
      const candidate = normalizeTarget(file.path || file);
      if (!targets.includes(candidate)) targets.push(candidate);
    }
  }
  return targets;
}

function createFileProposal(task, plan, requestedTarget, includeRelated = false) {
  const changes = proposalTargets(plan, requestedTarget, includeRelated)
    .map((target) => buildSingleChange(task, plan, target));
  const primary = changes[0];
  const proposalId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const proposal = {
    id: proposalId,
    target: primary.target,
    targets: changes.map((change) => change.target),
    operation: primary.operation,
    anchor: primary.anchor,
    beforeLength: changes.reduce((total, change) => total + change.beforeLength, 0),
    afterLength: changes.reduce((total, change) => total + change.afterLength, 0),
    diff: changes.flatMap((change) => change.diff),
    unifiedDiff: changes.map((change) => change.unifiedDiff).join("\n\n"),
    fileCount: changes.length,
    requiresReview: true,
    review: {
      checks: [
        "Li o diff unificado.",
        "Conferi os arquivos alvo.",
        "Aceito aplicar esta proposta no workspace local.",
      ],
    },
    createdAt: new Date().toISOString(),
  };

  proposals.set(proposalId, {
    ...proposal,
    changes: changes.map((change) => ({
      filePath: change.filePath,
      target: change.target,
      after: change.after,
    })),
    task,
    plan,
  });
  saveProposals();

  return proposal;
}

async function buildOpenAiTaskPlan(task, files) {
  const prompt = `
Voce e o motor de planejamento do produto "Engenheiro IA", um agente comercial de engenharia de software.

Responda somente com JSON valido, sem markdown, no formato:
{
  "steps": [{"title": "string", "detail": "string"}],
  "relevantFiles": [{"path": "string", "reason": "string"}],
  "suggestedTarget": "string",
  "diff": [{"kind": "add|remove|context", "line": 1, "text": "string"}],
  "risk": "Baixo|Medio|Alto",
  "summary": "string"
}

Regras:
- Nao invente que alterou arquivos.
- Gere um plano pratico para o repositorio abaixo.
- O diff deve ser uma proposta textual curta, nao uma alteracao aplicada.
- suggestedTarget deve ser um dos arquivos visiveis mais adequado para a tarefa, ou work/agente-ia/tarefas-aprovadas.md se nao houver alvo seguro.
- Seja conservador com risco.
- Responda em portugues do Brasil.

Tarefa do usuario:
${task}

Arquivos visiveis do projeto:
${projectSnapshot(files)}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      max_output_tokens: 1800,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Falha ao chamar a OpenAI.");
  }

  const text = extractTextFromResponse(data);
  const plan = normalizeAiPlan(parseJsonText(text));
  plan.usage = usageFromText(prompt, text);
  return plan;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/project" && req.method === "GET") {
    const files = scanFiles(ROOT);
    return json(res, 200, {
      root: ROOT,
      ai: {
        provider: OPENAI_API_KEY && policy.allowAi ? "openai" : "local",
        model: OPENAI_API_KEY && policy.allowAi ? OPENAI_MODEL : "simulado",
        configured: Boolean(OPENAI_API_KEY && policy.allowAi),
        cost: {
          inputPer1K: COST_INPUT_PER_1K,
          outputPer1K: COST_OUTPUT_PER_1K,
          currency: "USD",
        },
      },
      policy,
      fileCount: files.filter((file) => file.type === "file").length,
      files,
    });
  }

  if (url.pathname === "/api/policy" && req.method === "GET") {
    return json(res, 200, policy);
  }

  if (url.pathname === "/api/policy" && req.method === "POST") {
    const raw = await readRequest(req);
    const body = raw ? JSON.parse(raw) : {};
    Object.assign(policy, normalizePolicy(body));
    savePolicy();
    addHistory({
      type: "policy",
      status: "permissoes atualizadas",
      task: "Politicas do projeto foram alteradas.",
      mode: "admin",
      risk: "Baixo",
      target: "data/policy.json",
    });
    return json(res, 200, policy);
  }

  if (url.pathname === "/api/history" && req.method === "GET") {
    return json(res, 200, {
      entries: history.slice(0, 30),
      totals: historyTotals(),
    });
  }

  if (url.pathname === "/api/proposals" && req.method === "GET") {
    return json(res, 200, {
      proposals: [...proposals.values()].map(publicProposal).reverse(),
    });
  }

  if (url.pathname.startsWith("/api/proposals/") && req.method === "GET") {
    const id = decodeURIComponent(url.pathname.replace("/api/proposals/", ""));
    const proposal = proposals.get(id);
    if (!proposal) return json(res, 404, { error: "Proposta nao encontrada." });
    return json(res, 200, publicProposal(proposal));
  }

  if (url.pathname === "/api/git" && req.method === "GET") {
    return json(res, 200, await gitInfo());
  }

  if (url.pathname === "/api/task" && req.method === "POST") {
    const raw = await readRequest(req);
    const body = raw ? JSON.parse(raw) : {};
    const task = String(body.task || "").trim();
    if (!task) return json(res, 400, { error: "Descreva uma tarefa." });

    const files = scanFiles(ROOT);
    if (!OPENAI_API_KEY || !policy.allowAi) {
      const plan = buildTaskPlan(task, files);
      plan.usage = usageFromText(task, JSON.stringify(plan));
      addHistory({
        type: "plan",
        status: "planejado",
        task,
        mode: plan.mode,
        risk: plan.risk,
        target: plan.suggestedTarget,
        usage: plan.usage,
      });
      return json(res, 200, plan);
    }

    try {
      const plan = await buildOpenAiTaskPlan(task, files);
      if (policy.maxEstimatedCostPerTask > 0 && plan.usage.estimatedCost > policy.maxEstimatedCostPerTask) {
        throw new Error("Custo estimado acima do limite configurado.");
      }
      addHistory({
        type: "plan",
        status: "planejado",
        task,
        mode: plan.mode,
        risk: plan.risk,
        target: plan.suggestedTarget,
        usage: plan.usage,
      });
      return json(res, 200, plan);
    } catch (error) {
      const fallback = buildTaskPlan(task, files);
      fallback.mode = "fallback";
      fallback.summary = `IA indisponivel: ${error.message}. Plano local usado como contingencia.`;
      fallback.usage = usageFromText(task, JSON.stringify(fallback));
      addHistory({
        type: "plan",
        status: "fallback",
        task,
        mode: fallback.mode,
        risk: fallback.risk,
        target: fallback.suggestedTarget,
        usage: fallback.usage,
      });
      return json(res, 200, fallback);
    }
  }

  if (url.pathname === "/api/proposal" && req.method === "POST") {
    if (!policy.allowProposals) return json(res, 403, { error: "Preparar alteracoes esta bloqueado pelas permissoes." });
    const raw = await readRequest(req);
    const body = raw ? JSON.parse(raw) : {};
    const task = String(body.task || "").trim();
    if (!task) return json(res, 400, { error: "Descreva uma tarefa." });

    const files = scanFiles(ROOT);
    const plan = body.plan && Array.isArray(body.plan.steps)
      ? body.plan
      : buildTaskPlan(task, files);
    const proposal = createFileProposal(task, plan, body.target, Boolean(body.includeRelated));
    addHistory({
      type: "proposal",
      status: "aguardando aprovacao",
      task,
      mode: plan.mode || "local",
      risk: plan.risk || "Nao informado",
      target: proposal.target,
      operation: proposal.operation,
      anchor: proposal.anchor,
    });
    return json(res, 200, proposal);
  }

  if (url.pathname === "/api/apply" && req.method === "POST") {
    if (!policy.allowApply) return json(res, 403, { error: "Aplicar alteracoes esta bloqueado pelas permissoes." });
    const raw = await readRequest(req);
    const body = raw ? JSON.parse(raw) : {};
    const proposal = proposals.get(String(body.proposalId || ""));
    if (!proposal) return json(res, 404, { error: "Proposta nao encontrada ou expirada." });
    if (proposal.requiresReview && body.reviewApproved !== true) {
      return json(res, 400, { error: "Revise e aprove a proposta antes de aplicar." });
    }

    for (const change of proposal.changes || []) {
      ensureParentDir(change.filePath);
      fs.writeFileSync(change.filePath, change.after, "utf8");
    }
    proposals.delete(proposal.id);
    saveProposals();
    addHistory({
      type: "apply",
      status: "aplicado",
      task: proposal.task,
      mode: proposal.plan?.mode || "local",
      risk: proposal.plan?.risk || "Nao informado",
      target: proposal.target,
      operation: proposal.operation,
      anchor: proposal.anchor,
    });

    return json(res, 200, {
      ok: true,
      target: proposal.target,
      targets: proposal.targets,
      bytes: (proposal.changes || []).reduce((total, change) => total + Buffer.byteLength(change.after, "utf8"), 0),
    });
  }

  return json(res, 404, { error: "Endpoint nao encontrado." });
}

function handleStatic(req, res, url) {
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  let filePath;

  try {
    filePath = safeJoin(PUBLIC, requested);
  } catch (error) {
    return send(res, 403, "Bloqueado.", "text/plain; charset=utf-8");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 404, "Nao encontrado.", "text/plain; charset=utf-8");
    const type = MIME[path.extname(filePath)] || "application/octet-stream";
    send(res, 200, data, type);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      handleStatic(req, res, url);
    }
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Engenheiro IA MVP rodando em http://localhost:${PORT}`);
  console.log(`Projeto analisado: ${ROOT}`);
});
