/*
Paper_Talk Worker v88 GPT-4o semantic intent + clean related-paper titles + no keyword-only code-first routing
- Long version history comments removed to reduce file size.
- LLM-based intent/domain planning for literature trend vs research idea vs method/package extraction routing.
- User-first answer behavior: answer the scientific question first. If the user asks for tools, software, packages, methods, or analysis options, answer with a practical tool list first before literature trends. If the user asks for a pipeline/workflow, first search/retrieve papers matching the user's keyword/domain and extract the workflows used in those papers; only then synthesize a practical paper-grounded workflow. Never answer pipeline/workflow questions with a generic protocol before showing the relevant paper workflow evidence. For scRNA-seq and scATAC-seq integration, always include LIGER/iNMF, Seurat/Signac WNN, ArchR, GLUE, MultiVI/scvi-tools, SnapATAC2, Harmony, and MOFA+ when relevant.
- Practical tool questions: if the user asks for tools/software/packages/methods/analysis options, answer with a practical tool list first. If the user asks for pipeline/workflow, use a paper-grounded domain-specific workflow. For scRNA-seq + scATAC-seq integration, include LIGER/iNMF, Seurat/Signac WNN, ArchR, GLUE, MultiVI/scvi-tools, SnapATAC2, Harmony, and MOFA+ when relevant.
- Multilingual behavior: detect and preserve the user's language across the entire answer.
- Do not start with DB retrieval failure messages unless user explicitly asks for sources/evidence.
- Literature/trend questions still show DB paper titles when requested.
- Chat cancellation: /api/gpt/chat accepts cancelId; /api/gpt/cancel marks the request canceled; OpenAI calls are linked to the browser request signal and cancelId polling so Cancel can stop generation and avoid quota charging.
- Related-paper follow-up patch: short requests such as "이거랑 비슷한 논문은" inherit the active paper, retrieve other DB papers, and return exact titles instead of a generic trend answer.
- One-line highlight patch: "한줄만/one line" requests return one clean sentence without forcing bullet formatting.
- v87 semantic code-first gate: runnable code mode is activated only by LLM intent field wants_executable_code, not by keyword matching. Literature/recommendation/follow-up questions cannot be hijacked into CODE-FIRST mode.
*/

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
        return new Response(null, {
          status: 204,
          headers: corsHeaders()
        });
      }

      if (pathname === "/api/test-secret") {
        return json({
          hasKey: !!env.OPENAI_API_KEY,
          hasModel: !!env.OPENAI_MODEL,
          model: "gpt-4o"
        });
      }

      if (pathname === "/api/test-openai") {
        return testOpenAI(env);
      }

      if (pathname === "/auth/google") return googleLogin(request, env);
      if (pathname === "/auth/google/callback") return googleCallback(request, env);
      if (pathname === "/auth/logout") return logout();
      if (pathname === "/api/me") return apiMe(request, env);
      if (pathname === "/api/neuro-gpt/access" && request.method === "POST") return neuroGptAccessCheck(request, env);

      if (pathname === "/api/delete-account" && request.method === "POST") return deleteAccount(request, env);

      if (pathname === "/api/my/posts" && request.method === "GET") return myPosts(request, env);
      if (pathname === "/api/my/update" && request.method === "POST") return updateMyPost(request, env);
      if (pathname === "/api/my/delete" && request.method === "POST") return deleteMyPost(request, env);

      if (pathname === "/api/posts" && request.method === "GET") return listPosts(request, env);
      if (pathname === "/api/posts" && request.method === "POST") return createPost(request, env);

      if (pathname === "/api/gpt/threads" && request.method === "GET") return listGptThreads(request, env);
      if (pathname === "/api/gpt/threads" && request.method === "POST") return createGptThread(request, env);
      if (pathname.startsWith("/api/gpt/threads/") && request.method === "DELETE") return deleteGptThread(request, env);
      if (pathname === "/api/gpt/messages" && request.method === "GET") return listGptMessages(request, env);
      if (pathname === "/api/gpt/chat" && request.method === "POST") return gptChat(request, env);
      if (pathname === "/api/gpt/cancel" && request.method === "POST") return cancelGptRequest(request, env);

      if (pathname === "/api/admin/gpt/threads" && request.method === "GET") return adminListGptThreads(request, env);
      if (pathname === "/api/admin/gpt/messages" && request.method === "GET") return adminListGptMessages(request, env);

      if (pathname === "/api/admin/check" && (request.method === "GET" || request.method === "POST")) return adminCheck(request, env);
      if (pathname === "/api/admin/debug/visitor" && request.method === "GET") return adminDebugVisitor(request, env);
      if (pathname === "/api/admin/posts" && request.method === "GET") return adminListPosts(request, env);
      if (pathname === "/api/admin/users/count" && request.method === "GET") return adminUserCount(request, env);
      if (pathname === "/api/admin/users/active" && request.method === "GET") return adminActiveUsers(request, env);
      if (pathname === "/api/public/active/heartbeat" && request.method === "POST") return publicActiveHeartbeat(request, env);
      if (pathname === "/api/public/visits/today" && request.method === "GET") return publicTodayVisitCount(request, env);
      if (pathname === "/api/admin/approve" && request.method === "POST") return adminApprovePost(request, env);
      if (pathname === "/api/admin/delete" && request.method === "POST") return adminDeletePost(request, env);
      if (pathname === "/api/admin/post/update" && request.method === "POST") return adminUpdatePost(request, env);

      // Specialist GPT Admin API routes.
      // These use X-Specialist-Admin-Key and keep each GPT knowledge base separated by gpt_key.
      if (pathname === "/api/admin/specialist/check" && (request.method === "GET" || request.method === "POST")) {
        return specialistAdminCheck(request, env);
      }

      if (pathname === "/api/admin/specialist/fulltext/import" && request.method === "POST") {
        return specialistAdminImportFullText(request, env);
      }

      if (pathname === "/api/admin/specialist/fulltext/list" && request.method === "GET") {
        return specialistAdminListFullText(request, env);
      }

      if (pathname === "/api/admin/specialist/fulltext/delete" && request.method === "POST") {
        return specialistAdminDeleteFullText(request, env);
      }

      if (pathname === "/api/admin/research/import-linkedin-csv" && request.method === "POST") {
        return adminImportLinkedInCsv(request, env);
      }

      if (pathname === "/api/admin/research/fulltext/import" && request.method === "POST") {
        return adminImportResearchFullText(request, env);
      }

      if (pathname === "/api/admin/research/fulltext/list" && request.method === "GET") {
        return adminListResearchFullText(request, env);
      }

      if (pathname === "/api/admin/research/fulltext/delete" && request.method === "POST") {
        return adminDeleteResearchFullText(request, env);
      }

      if (pathname === "/api/admin/thinking-logic/import" && request.method === "POST") {
        return adminImportThinkingLogic(request, env);
      }

      if (pathname === "/api/admin/thinking-logic/delete" && request.method === "POST") {
        return adminDeleteThinkingLogic(request, env);
      }

      if (pathname === "/api/admin/research/reindex" && request.method === "POST") {
        return adminReindexResearchPapers(request, env);
      }

      if (pathname === "/api/admin/research/create" && request.method === "POST") {
        return adminCreateResearchPaper(request, env);
      }

      if (pathname === "/api/admin/study/create" && request.method === "POST") {
        return adminCreateStudyPost(request, env);
      }

      if (pathname === "/api/admin/methodology/save" && request.method === "POST") {
        return adminSaveMethodologyPage(request, env);
      }

      if (pathname === "/api/admin/blog/create" && request.method === "POST") {
        return adminCreateBlogPost(request, env);
      }

      if (pathname === "/admin") {
        return redirect(new URL("/admin.html", request.url).toString());
      }

      if (pathname === "/admin-gpt") {
        return redirect(new URL("/admin-gpt.html", request.url).toString());
      }

      if (pathname === "/admin-specialist-gpts" || pathname === "/specialist-admin") {
        return redirect(new URL("/admin-specialist-gpts.html", request.url).toString());
      }

      if (pathname === "/research") {
        return redirect(new URL("/research.html", request.url).toString());
      }

      if (pathname === "/study") {
        return redirect(new URL("/study.html", request.url).toString());
      }

      // Public Specialist GPT shortcuts should open the real static specialist-gpts.html asset.
      // Do not intercept /specialist-gpts.html here, because that file exists separately in ASSETS.
      if (pathname === "/research-gpts" || pathname === "/specialist-gpts") {
        return redirect(new URL("/specialist-gpts.html", request.url).toString());
      }

      const specialistGptKeyFromRoute = getSpecialistGptKeyFromPathname(pathname);
      if (specialistGptKeyFromRoute) {
        return redirect(new URL(`/visium-gpt.html?gpt=${encodeURIComponent(specialistGptKeyFromRoute)}`, request.url).toString());
      }

      if (pathname === "/visium-gpt" || pathname === "/visium-gpt.html") {
        return specialistGptChatPage(request);
      }

      if (pathname === "/community") {
        return redirect(new URL("/community.html", request.url).toString());
      }

      if (pathname === "/career") {
        return redirect(new URL("/career.html", request.url).toString());
      }

      if (pathname.startsWith("/api/")) {
        return json({
          ok: false,
          error: `API route not found: ${pathname}`
        }, 404);
      }

      if (env.ASSETS) return env.ASSETS.fetch(request);

      return new Response("Not found", { status: 404 });
    } catch (error) {
      if (pathname.startsWith("/api/")) {
        return json({
          ok: false,
          error: error?.message || "Worker server error"
        }, 500);
      }

      return new Response(error?.message || "Worker server error", { status: 500 });
    }
  }
};

function fetchAsset(env, request, assetPath) {
  if (!env.ASSETS) {
    return new Response("ASSETS binding is missing. Check wrangler.toml [assets] binding = \"ASSETS\".", { status: 500 });
  }

  return env.ASSETS.fetch(new Request(new URL(assetPath, request.url)));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key, X-Specialist-Admin-Key"
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      ...corsHeaders(),
      ...headers
    }
  });
}

function normalizeChatInputNoise(value) {
  let text = String(value || "").normalize("NFKC");
  if (!text) return "";

  // Remove invisible characters and normalize common mobile/IME spacing noise.
  text = text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]{2,}/g, " ");

  // Common mobile/IME typo: Korean polite ending is split into final syllable + jamo.
  // Example: "이 논문 요약해주세ㅇ ㅛ" -> "이 논문 요약해주세요".
  // Keep this conservative so scientific symbols and gene names are not damaged.
  text = text
    .replace(/해\s*주\s*세\s*ㅇ\s*ㅛ/g, "해주세요")
    .replace(/해\s*주\s*세\s*요/g, "해주세요")
    .replace(/주\s*세\s*ㅇ\s*ㅛ/g, "주세요")
    .replace(/주\s*세\s*요/g, "주세요")
    .replace(/하\s*세\s*ㅇ\s*ㅛ/g, "하세요")
    .replace(/세\s*ㅇ\s*ㅛ/g, "세요")
    .replace(/줘\s*ㅇ\s*ㅛ/g, "줘요")
    .replace(/([가-힣])\s*ㅇ\s*ㅛ(?=$|[\s?.!,。！？])/g, "$1요");

  // A few high-frequency request words often arrive with accidental spaces.
  // These are examples only. The language-agnostic fallback below handles other languages.
  // Keep this conservative so scientific terms, gene symbols, and paper titles are not damaged.
  text = text
    .replace(/\bsummari\s*([sz])\s*e\b/gi, "summari$1e")
    .replace(/\bsum\s*mar\s*y\b/gi, "summary")
    .replace(/\bhigh\s*light(s)?\b/gi, "highlight$1")
    .replace(/\bplea\s*se\b/gi, "please")
    .replace(/\barti\s*cle\b/gi, "article")
    .replace(/\bpape\s*r\b/gi, "paper")
    .replace(/\br[ée]\s*sum[ée]\b/gi, "résumé")
    .replace(/\br[ée]\s*sumer\b/gi, "résumer")
    .replace(/\bresu\s*men\b/gi, "resumen")
    .replace(/\bresu\s*mir\b/gi, "resumir")
    .replace(/\bzusammen\s*fassung\b/gi, "zusammenfassung")
    .replace(/\bri\s*assunto\b/gi, "riassunto");

  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function makeLanguageAgnosticIntentKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function hasAnyLanguageAgnosticIntentTerm(value, terms) {
  const key = makeLanguageAgnosticIntentKey(value);
  if (!key) return false;

  return (terms || []).some(term => {
    const termKey = makeLanguageAgnosticIntentKey(term);
    return termKey && key.includes(termKey);
  });
}

function isSafeUniversalShortFollowUpShape(value) {
  const text = normalizeChatInputNoise(value);
  if (!text) return false;

  // Language-agnostic fallback:
  // If a user sends a very short message after a paper/topic was discussed, it is often a
  // continuation such as "summarize", "shorter", "again", "translate", "explain", etc.
  // We avoid code-like or admin-like strings so this does not hijack programming requests.
  if (text.length > 80) return false;
  if (/```|[{}`;$<>]|=>|<-|==|!=|\/api\/|SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+/i.test(text)) return false;
  if (/^(hi|hello|hey|thanks|thank you|test|테스트|안녕|안녕하세요)$/i.test(text.trim())) return false;

  const nonSpaceChars = text.replace(/\s+/g, "");
  if (nonSpaceChars.length < 2) return false;

  // Works for any script because it relies on length/shape, not a language-specific dictionary.
  return text.split(/\s+/).filter(Boolean).length <= 10;
}


// ======================================
// Cancelable GPT request support
// ======================================
const USER_CANCELED_MESSAGE = "USER_CANCELED: Request canceled by user.";

class UserCanceledError extends Error {
  constructor(message = "Request canceled by user.") {
    super(message);
    this.name = "UserCanceledError";
    this.canceled = true;
  }
}

function isUserCanceledError(error) {
  return Boolean(error && (error.canceled || error.name === "UserCanceledError"));
}

function isUserCanceledText(value) {
  return /^USER_CANCELED:/i.test(String(value || ""));
}

function normalizeGptCancelId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,120}$/.test(id) ? id : "";
}

async function getGuestGptIdentityKey(request, env) {
  const todayKey = getTodayKey(new Date());
  const visitorIp = getVisitorIp(request);
  const ipHash = await sha256Hex(`${todayKey}:${visitorIp}:${env.SESSION_SECRET || "paper-talk"}:guest-gpt`);
  return `guest:${todayKey}:${ipHash}`;
}

async function getGptCancelOwnerKey(request, env, user = null) {
  return user?.id ? `user:${user.id}` : await getGuestGptIdentityKey(request, env);
}

async function ensureGptCancellationTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS gpt_request_cancellations (
      cancel_id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      gpt_key TEXT DEFAULT 'paper_talk',
      status TEXT NOT NULL DEFAULT 'running',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      canceled_at TEXT,
      finished_at TEXT
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_gpt_request_cancellations_owner
    ON gpt_request_cancellations(owner_key, created_at)
  `).run();
}

async function registerGptCancellableRequest({ env, cancelId, ownerKey, gptKey }) {
  const id = normalizeGptCancelId(cancelId);
  if (!id || !ownerKey) return;

  await ensureGptCancellationTable(env);

  // If the user hits Cancel before the chat route finishes registering the request,
  // preserve the already-canceled state instead of resetting it back to running.
  await env.DB.prepare(`
    INSERT INTO gpt_request_cancellations (
      cancel_id,
      owner_key,
      gpt_key,
      status,
      created_at,
      canceled_at,
      finished_at
    )
    VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP, NULL, NULL)
    ON CONFLICT(cancel_id) DO UPDATE SET
      owner_key = excluded.owner_key,
      gpt_key = excluded.gpt_key,
      status = CASE
        WHEN gpt_request_cancellations.status = 'canceled' THEN 'canceled'
        ELSE 'running'
      END,
      created_at = CURRENT_TIMESTAMP,
      finished_at = NULL
  `).bind(id, ownerKey, normalizeGptKey(gptKey)).run();
}

async function markGptCancellableRequestFinished({ env, cancelId, ownerKey }) {
  const id = normalizeGptCancelId(cancelId);
  if (!id || !ownerKey) return;

  await ensureGptCancellationTable(env);
  await env.DB.prepare(`
    UPDATE gpt_request_cancellations
    SET status = CASE WHEN status = 'canceled' THEN 'canceled' ELSE 'finished' END,
        finished_at = CURRENT_TIMESTAMP
    WHERE cancel_id = ? AND owner_key = ?
  `).bind(id, ownerKey).run();
}

async function isGptRequestCanceled({ env, cancelId, ownerKey }) {
  const id = normalizeGptCancelId(cancelId);
  if (!id || !ownerKey) return false;

  await ensureGptCancellationTable(env);
  const row = await env.DB.prepare(`
    SELECT status
    FROM gpt_request_cancellations
    WHERE cancel_id = ? AND owner_key = ?
    LIMIT 1
  `).bind(id, ownerKey).first();

  return String(row?.status || "").toLowerCase() === "canceled";
}

function makeGptCancelRuntime({ request, env, cancelId, ownerKey }) {
  const normalizedCancelId = normalizeGptCancelId(cancelId);
  let cachedCanceled = false;

  async function isCanceled() {
    if (cachedCanceled) return true;

    if (request?.signal?.aborted) {
      cachedCanceled = true;
      return true;
    }

    if (normalizedCancelId && ownerKey) {
      try {
        cachedCanceled = await isGptRequestCanceled({ env, cancelId: normalizedCancelId, ownerKey });
      } catch {
        // A cancellation check failure should not break a valid chat request.
        cachedCanceled = false;
      }
    }

    return cachedCanceled;
  }

  return {
    cancelId: normalizedCancelId,
    ownerKey,
    signal: request?.signal || null,
    async isCanceled() {
      return isCanceled();
    },
    async throwIfCanceled() {
      if (await isCanceled()) throw new UserCanceledError();
    }
  };
}

async function isGptRuntimeCanceledNoThrow(cancelRuntime) {
  if (!cancelRuntime?.isCanceled) return false;
  try {
    return await cancelRuntime.isCanceled();
  } catch (error) {
    return isUserCanceledError(error);
  }
}

function createLinkedAbortController(cancelRuntime, timeoutMs = 70000) {
  const controller = new AbortController();
  let stopped = false;
  let pollTimer = null;

  const abortAsCanceled = () => {
    if (!controller.signal.aborted) {
      try {
        controller.abort(new UserCanceledError());
      } catch {
        controller.abort();
      }
    }
  };

  const abortAsTimeout = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  const timeout = setTimeout(abortAsTimeout, timeoutMs);

  const clientSignal = cancelRuntime?.signal || null;
  if (clientSignal) {
    if (clientSignal.aborted) {
      abortAsCanceled();
    } else {
      clientSignal.addEventListener("abort", abortAsCanceled, { once: true });
    }
  }

  const poll = async () => {
    if (stopped || controller.signal.aborted) return;

    if (await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
      abortAsCanceled();
      return;
    }

    if (!stopped && !controller.signal.aborted) {
      pollTimer = setTimeout(poll, 800);
    }
  };

  if (cancelRuntime?.isCanceled) {
    pollTimer = setTimeout(poll, 800);
  }

  return {
    signal: controller.signal,
    cleanup() {
      stopped = true;
      clearTimeout(timeout);
      if (pollTimer) clearTimeout(pollTimer);
      if (clientSignal) clientSignal.removeEventListener("abort", abortAsCanceled);
    }
  };
}

async function cancelGptRequest(request, env) {
  const user = await getSession(request, env).catch(() => null);
  const body = await request.json().catch(() => ({}));
  const cancelId = normalizeGptCancelId(body.cancelId || body.requestId || body.chatRequestId);
  const gptKey = getGptKeyFromRequestData(body);

  if (!cancelId) {
    return json({ ok: false, error: "cancelId is required." }, 400);
  }

  const ownerKey = await getGptCancelOwnerKey(request, env, user);
  await ensureGptCancellationTable(env);

  await env.DB.prepare(`
    INSERT INTO gpt_request_cancellations (
      cancel_id,
      owner_key,
      gpt_key,
      status,
      created_at,
      canceled_at,
      finished_at
    )
    VALUES (?, ?, ?, 'canceled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT(cancel_id) DO UPDATE SET
      owner_key = excluded.owner_key,
      gpt_key = excluded.gpt_key,
      status = 'canceled',
      canceled_at = CURRENT_TIMESTAMP
  `).bind(cancelId, ownerKey, normalizeGptKey(gptKey)).run();

  return json({ ok: true, canceled: true, cancelId });
}

function canceledChatJson() {
  return json({
    ok: false,
    canceled: true,
    error: "Canceled by user. No quota was charged for the canceled generation."
  });
}


// ======================================
// Specialist GPT data isolation
// ======================================
const DEFAULT_GPT_KEY = "paper_talk";

// Practical tool-list routing rule:
// If the user asks for tools, software, packages, pipelines, methods, workflows,
// or analysis options, answer with a practical tool list first.
// For scRNA-seq + scATAC-seq integration, always include LIGER/iNMF,
// Seurat/Signac WNN, ArchR, GLUE, MultiVI/scvi-tools, SnapATAC2, Harmony, and MOFA+ when relevant.


// Monthly GPT quota is shared across all GPT modes for each signed-in user.
// Paper_Talk Vision GPT + Neuroscience GPT + any future Specialist GPTs = 50 total / month.
const SIGNED_IN_TOTAL_GPT_MONTHLY_LIMIT = 50;
const GUEST_GPT_DAILY_LIMIT = 3;

// Private access key for Neuroscience GPT.
// Users reach it from the Specialist GPT page with password "engram".
// For stronger security, set NEURO_GPT_PASSWORD as a Cloudflare secret.
const DEFAULT_NEURO_GPT_PASSWORD = "engram";
const NEURO_GPT_ACCESS_COOKIE = "pt_neuro_gpt_access";

const ALLOWED_GPT_KEYS = new Set([
  "paper_talk",
  "neuroscience",
  "mitochondria",
  "single_cell",
  "spatial_biology",
  "cancer_genomics"
]);

function normalizeGptKey(value) {
  const raw = String(value || DEFAULT_GPT_KEY)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const aliases = {
    paper: "paper_talk",
    paper_talk: "paper_talk",
    vision: "paper_talk",
    vision_gpt: "paper_talk",
    neuroscience: "neuroscience",
    neuro: "neuroscience",
    brain: "neuroscience",
    mitochondria: "mitochondria",
    mitochondrial: "mitochondria",
    singlecell: "single_cell",
    single_cell: "single_cell",
    single_cell_gpt: "single_cell",
    spatial: "spatial_biology",
    spatial_biology: "spatial_biology",
    cancer: "cancer_genomics",
    cancer_genomics: "cancer_genomics"
  };

  const key = aliases[raw] || raw;
  return ALLOWED_GPT_KEYS.has(key) ? key : DEFAULT_GPT_KEY;
}

function getGptProfile(gptKey) {
  const key = normalizeGptKey(gptKey);

  const profiles = {
    paper_talk: {
      key,
      title: "Paper_Talk Vision GPT",
      knowledgeLabel: "Paper_Talk general research knowledge"
    },
    neuroscience: {
      key,
      title: "Neuroscience GPT",
      knowledgeLabel: "curated neuroscience knowledge"
    },
    mitochondria: {
      key,
      title: "Mitochondria GPT",
      knowledgeLabel: "curated mitochondria knowledge"
    },
    single_cell: {
      key,
      title: "Single-cell GPT",
      knowledgeLabel: "curated single-cell knowledge"
    },
    spatial_biology: {
      key,
      title: "Spatial Biology GPT",
      knowledgeLabel: "curated spatial biology knowledge"
    },
    cancer_genomics: {
      key,
      title: "Cancer Genomics GPT",
      knowledgeLabel: "curated cancer genomics knowledge"
    }
  };

  return profiles[key] || profiles.paper_talk;
}

function getGptKeyFromRequestData(data) {
  return normalizeGptKey(
    data?.gptKey ||
    data?.gpt ||
    data?.domain ||
    data?.category ||
    data?.specialist ||
    DEFAULT_GPT_KEY
  );
}

async function ensureSpecialistGptTables(env) {
  // These ALTER statements are intentionally safe to run repeatedly.
  // Existing rows without gpt_key are treated as Paper_Talk Vision GPT data.
  const statements = [
    "ALTER TABLE research_knowledge ADD COLUMN gpt_key TEXT DEFAULT 'paper_talk'",
    "ALTER TABLE paper_fulltext_chunks ADD COLUMN gpt_key TEXT DEFAULT 'paper_talk'",
    "ALTER TABLE gpt_threads ADD COLUMN gpt_key TEXT DEFAULT 'paper_talk'",
    "ALTER TABLE gpt_messages ADD COLUMN gpt_key TEXT DEFAULT 'paper_talk'",
    "ALTER TABLE gpt_supporting_papers ADD COLUMN gpt_key TEXT DEFAULT 'paper_talk'"
  ];

  for (const sql of statements) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
      // Column/table may already exist or optional table may not exist yet.
    }
  }

  const indexStatements = [
    "CREATE INDEX IF NOT EXISTS idx_research_knowledge_gpt_key ON research_knowledge(gpt_key)",
    "CREATE INDEX IF NOT EXISTS idx_fulltext_chunks_gpt_key ON paper_fulltext_chunks(gpt_key)",
    "CREATE INDEX IF NOT EXISTS idx_gpt_threads_user_gpt_key ON gpt_threads(user_id, gpt_key)",
    "CREATE INDEX IF NOT EXISTS idx_gpt_messages_thread_gpt_key ON gpt_messages(thread_id, gpt_key)"
  ];

  for (const sql of indexStatements) {
    try {
      await env.DB.prepare(sql).run();
    } catch {}
  }
}

async function readJsonResponseSafely(response, label = "HTTP request") {
  const contentType = response.headers.get("Content-Type") || "";
  const rawText = await response.text();

  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    const preview = rawText
      .replace(/\s+/g, " ")
      .slice(0, 700);

    throw new Error(
      `${label} returned non-JSON response. HTTP ${response.status}. Content-Type: ${contentType || "unknown"}. Preview: ${preview}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${label} failed. HTTP ${response.status}. ${data?.error?.message || JSON.stringify(data).slice(0, 700)}`
    );
  }

  return data;
}


function extractOpenAIText(data) {
  if (!data) return "";

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const choiceMessage = data?.choices?.[0]?.message;

  if (typeof choiceMessage?.content === "string" && choiceMessage.content.trim()) {
    return choiceMessage.content.trim();
  }

  if (Array.isArray(choiceMessage?.content)) {
    const text = choiceMessage.content
      .map(part => {
        if (!part) return "";
        if (typeof part === "string") return part;
        if (typeof part.text === "string") return part.text;
        if (typeof part?.text?.value === "string") return part.text.value;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();

    if (text) return text;
  }

  if (Array.isArray(data.output)) {
    const text = data.output
      .flatMap(item => Array.isArray(item?.content) ? item.content : [])
      .map(part => {
        if (!part) return "";
        if (typeof part.text === "string") return part.text;
        if (typeof part?.text?.value === "string") return part.text.value;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();

    if (text) return text;
  }

  return "";
}

function getOpenAIErrorMessage(data, fallback = "OpenAI API returned no answer.") {
  const text = extractOpenAIText(data);
  if (text) return text;

  if (data?.error?.message) return data.error.message;

  const finishReason = data?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    return "The model stopped because the token limit was reached. Please try again with a narrower question.";
  }

  if (finishReason) return `OpenAI finish_reason: ${finishReason}`;

  return fallback;
}

async function testOpenAI(env) {
  if (!env.OPENAI_API_KEY) {
    return json({ ok: false, error: "OPENAI_API_KEY is missing." }, 500);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "user", content: "Say hello in one short sentence." }
        ],
        temperature: 0,
        max_completion_tokens: 30
      })
    });

    const data = await readJsonResponseSafely(response, "OpenAI test request");
    return json({
      ok: true,
      model: "gpt-4o",
      answer: extractOpenAIText(data) || "No answer returned."
    });
  } catch (error) {
    return json({
      ok: false,
      model: "gpt-4o",
      error: error?.message || "Unknown OpenAI test error"
    }, 500);
  }
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...headers
    }
  });
}


// ======================================
// Built-in public Specialist GPT pages
// ======================================
// These pages intentionally live inside the Worker. If specialist-gpts.html or
// visium-gpt.html is missing from the ASSETS binding, clicking a Specialist GPT
// should still show a safe UI instead of a raw Worker source file.
const SPECIALIST_GPT_ROUTE_ALIASES = {
  "/neuroscience-gpt": "neuroscience",
  "/mitochondria-gpt": "mitochondria",
  "/single-cell-gpt": "single_cell",
  "/singlecell-gpt": "single_cell",
  "/spatial-biology-gpt": "spatial_biology",
  "/spatial-gpt": "spatial_biology",
  "/cancer-genomics-gpt": "cancer_genomics",
  "/cancer-gpt": "cancer_genomics"
};

function getSpecialistGptKeyFromPathname(pathname) {
  const cleanPath = String(pathname || "").replace(/\/+$/, "") || "/";
  return SPECIALIST_GPT_ROUTE_ALIASES[cleanPath] || "";
}

function html(data, status = 200, headers = {}) {
  return new Response(String(data || ""), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      ...corsHeaders(),
      ...headers
    }
  });
}

function specialistGptsLandingPage(request) {
  return html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">

<script async src="https://www.googletagmanager.com/gtag/js?id=G-WWSD3F58L6"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-WWSD3F58L6');
</script>

<title>Specialist GPTs - Paper_Talk</title>
<link rel="stylesheet" href="/style.css">

<style>
.auth-box {
  text-align: right;
  margin-bottom: 20px;
}

.auth-box #userText,
.auth-box #guestInfo {
  margin-right: 8px;
}

.specialist-intro {
  max-width: 820px;
  line-height: 1.7;
}

.gpt-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(260px, 1fr));
  gap: 22px;
  margin-top: 24px;
}

.gpt-card {
  min-height: 190px;
  background: white;
  border: 1px solid #b9c7ff;
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 18px 40px rgba(0,0,0,0.04);
}

.gpt-card h2 {
  margin-top: 0;
  margin-bottom: 12px;
  color: #1428a0;
  font-size: 24px;
}

.gpt-card p {
  line-height: 1.6;
  margin-bottom: 0;
}

.tag {
  display: inline-block;
  margin-bottom: 14px;
  padding: 6px 12px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 13px;
  font-weight: 700;
}

.clickable-card {
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.clickable-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 48px rgba(0,0,0,0.08);
}

.coming-card {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: #f8fafc;
}

.coming-card h2 {
  margin: 0;
  color: #64748b;
}

.password-overlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  z-index: 9999;
  padding: 20px;
}

.password-modal {
  width: min(460px, 100%);
  background: #ffffff;
  border-radius: 24px;
  border: 1px solid #b9c7ff;
  padding: 28px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.22);
}

.password-modal h2 {
  margin: 0 0 10px;
  color: #1428a0;
}

.password-modal input {
  width: 100%;
  box-sizing: border-box;
  padding: 13px 14px;
  border: 1px solid #b9c7ff;
  border-radius: 14px;
  font-size: 16px;
  margin-bottom: 12px;
}

.password-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.password-actions button {
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  font-weight: 800;
  cursor: pointer;
}

.password-submit {
  background: #1428a0;
  color: #ffffff;
}

.password-cancel {
  background: #e2e8f0;
  color: #0f172a;
}

.password-error {
  margin-top: 12px;
  color: #dc2626;
  font-weight: 700;
  min-height: 20px;
}

@media (max-width: 1100px) {
  .gpt-grid {
    grid-template-columns: repeat(2, minmax(260px, 1fr));
  }
}

@media (max-width: 720px) {
  .gpt-grid {
    grid-template-columns: 1fr;
  }

  .gpt-card {
    padding: 22px;
  }
}
</style>
</head>

<body>
<header class="header">
 <nav class="nav">
  <a href="/" class="logo">Paper_Talk</a>
  <a href="/">Home</a>
  <a href="/research.html">Research Paper</a>
  <a href="/study.html">Study Materials</a>
  <a href="/visium-gpt.html">Paper_Talk Vision GPT</a>
  <a href="/specialist-gpts.html">Specialist GPTs</a>
  <a href="/community.html">Community</a>
  <a href="/career.html">Career</a>
</nav>
</header>

<main class="container">

  <div id="topLoginArea" class="auth-box" style="display:none;">
    <span id="guestInfo">Sign in for free to use Specialist GPTs. </span>
    <a id="loginBtn" class="btn" href="/auth/google">Sign in with Google</a>
  </div>

  <div id="topLogoutArea" class="auth-box" style="display:none;">
    <span id="userText"></span>
    <a id="logoutBtn" class="btn danger-btn" href="/auth/logout">Logout</a>
    <button id="deleteAccountBtn" class="btn danger-btn" type="button" onclick="deleteAccount()">Delete Account</button>
  </div>

  <h1>Specialist GPTs</h1>

  <p class="specialist-intro">
    Private specialist GPT workspaces built on curated scientific knowledge.
    Each GPT is designed around a specific research theme so researchers can ask focused scientific questions,
    explore literature-based directions, and generate testable ideas.
  </p>

  <section>
    <div class="gpt-grid">

      <article
        class="gpt-card clickable-card"
        onclick="openPrivateNeuroGpt()"
      >
        <span class="tag">Private</span>
        <h2>&#129504; Neuro-GPT</h2>
        <p>from Sungmo Park</p>
      </article>

      <article class="gpt-card coming-card">
        <h2>&#128640; Coming Soon</h2>
      </article>

      <article class="gpt-card coming-card">
        <h2>&#128640; Coming Soon</h2>
      </article>

      <article class="gpt-card coming-card">
        <h2>&#128640; Coming Soon</h2>
      </article>

      <article class="gpt-card coming-card">
        <h2>&#128640; Coming Soon</h2>
      </article>

      <article class="gpt-card coming-card">
        <h2>&#128640; Coming Soon</h2>
      </article>

      <article class="gpt-card coming-card">
        <h2>&#128640; Coming Soon</h2>
      </article>

      <article class="gpt-card coming-card">
        <h2>&#128640; Coming Soon</h2>
      </article>

    </div>
  </section>

</main>

<div id="neuroPasswordOverlay" class="password-overlay">
  <div class="password-modal">
    <h2>Private Neuro-GPT</h2>
    <p>Please enter the password to access Neuro-GPT.</p>

    <input
      id="neuroPasswordInput"
      type="password"
      placeholder="Enter password"
      autocomplete="off"
    >

    <div class="password-actions">
      <button class="password-submit" type="button" onclick="submitNeuroPassword()">Enter</button>
      <button class="password-cancel" type="button" onclick="closeNeuroPassword()">Cancel</button>
    </div>

    <div id="neuroPasswordError" class="password-error"></div>
  </div>
</div>

<script>
function openPrivateNeuroGpt() {
  const overlay = document.getElementById("neuroPasswordOverlay");
  const input = document.getElementById("neuroPasswordInput");
  const error = document.getElementById("neuroPasswordError");

  error.textContent = "";
  input.value = "";
  overlay.style.display = "flex";

  setTimeout(function() { input.focus(); }, 50);
}

function closeNeuroPassword() {
  document.getElementById("neuroPasswordOverlay").style.display = "none";
}

async function submitNeuroPassword() {
  const input = document.getElementById("neuroPasswordInput");
  const error = document.getElementById("neuroPasswordError");
  const password = input.value.trim();

  error.textContent = "";

  if (!password) {
    error.textContent = "Please enter the password.";
    input.focus();
    return;
  }

  try {
    const res = await fetch("/api/neuro-gpt/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: password })
    });

    const data = await res.json().catch(function() { return {}; });

    if (res.ok && data && data.ok && data.authenticated) {
      location.href = "/visium-gpt.html?gpt=neuroscience";
      return;
    }

    error.textContent = data.error || "Incorrect password.";
    input.value = "";
    input.focus();
  } catch {
    error.textContent = "Password check failed. Please try again.";
    input.focus();
  }
}

document.addEventListener("keydown", function(event) {
  const overlay = document.getElementById("neuroPasswordOverlay");
  const isOpen = overlay && overlay.style.display === "flex";

  if (!isOpen) return;

  if (event.key === "Enter") {
    submitNeuroPassword();
  }

  if (event.key === "Escape") {
    closeNeuroPassword();
  }
});

async function initAuthBox() {
  const topLoginArea = document.getElementById("topLoginArea");
  const topLogoutArea = document.getElementById("topLogoutArea");
  const userText = document.getElementById("userText");

  try {
    const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
    const data = await res.json();

    if (data && data.ok && data.user) {
      topLoginArea.style.display = "none";
      topLogoutArea.style.display = "block";
      userText.textContent = "Signed in as " + (data.user.name || data.user.email || "Paper_Talk user");
    } else {
      topLoginArea.style.display = "block";
      topLogoutArea.style.display = "none";
    }
  } catch {
    topLoginArea.style.display = "block";
    topLogoutArea.style.display = "none";
  }
}

async function deleteAccount() {
  if (!confirm("Delete your Paper_Talk account? This will remove your account and GPT chat history.")) {
    return;
  }

  try {
    const res = await fetch("/api/delete-account", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await res.json().catch(function() { return {}; });

    if (!res.ok || !data.ok) {
      alert(data.error || "Account deletion failed.");
      return;
    }

    localStorage.removeItem("pt_guest_gpt_usage");
    localStorage.removeItem("paperTalkAdminKey");
    localStorage.removeItem("paperTalkAdminKeyExpires");

    alert("Your account has been deleted.");
    location.href = "/";
  } catch {
    alert("Account deletion failed. Please try again.");
  }
}

document.addEventListener("DOMContentLoaded", initAuthBox);
</script>

</body>
</html>
`);
}


function specialistGptChatPage(request) {
  const url = new URL(request.url);
  const routeKey = getSpecialistGptKeyFromPathname(url.pathname);
  const gptKey = normalizeGptKey(routeKey || url.searchParams.get("gpt") || url.searchParams.get("gptKey") || url.searchParams.get("domain") || "neuroscience");
  const profile = getGptProfile(gptKey);
  const initialData = JSON.stringify({
    gptKey,
    title: profile.title,
    knowledgeLabel: profile.knowledgeLabel,
    isNeuroPrivate: gptKey === "neuroscience"
  }).replace(/</g, "\\u003c");

  return html(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${profile.title} | Paper_Talk</title>
  <style>
    :root { color-scheme: light; --bg:#f8fafc; --panel:#ffffff; --ink:#111827; --muted:#64748b; --line:#e5e7eb; --brand:#2563eb; --danger:#dc2626; --soft:#eff6ff; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--ink); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color:var(--brand); text-decoration:none; }
    .layout { display:grid; grid-template-columns:300px minmax(0,1fr); min-height:100vh; }
    aside { border-right:1px solid var(--line); background:#fff; padding:20px; }
    main { display:flex; flex-direction:column; min-width:0; }
    .brand { display:flex; gap:10px; align-items:center; font-weight:900; letter-spacing:-0.02em; }
    .dot { width:12px; height:12px; border-radius:50%; background:var(--brand); box-shadow:0 0 0 6px var(--soft); }
    .side-title { margin:26px 0 6px; font-size:13px; color:var(--muted); font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
    .gpt-list { display:grid; gap:8px; }
    .gpt-link { padding:11px 12px; border:1px solid var(--line); border-radius:14px; color:#334155; font-weight:700; }
    .gpt-link.active { color:var(--brand); border-color:#bfdbfe; background:var(--soft); }
    .quota { margin-top:18px; padding:13px; border:1px solid var(--line); border-radius:16px; color:#475569; background:#f8fafc; font-size:13px; line-height:1.5; }
    .auth { margin-top:14px; display:flex; gap:8px; flex-wrap:wrap; }
    .btn, button { border:0; border-radius:14px; padding:11px 14px; background:var(--brand); color:#fff; font-weight:800; cursor:pointer; }
    .btn.secondary, button.secondary { background:#e2e8f0; color:#0f172a; }
    .btn.danger, button.danger { background:var(--danger); }
    .topbar { border-bottom:1px solid var(--line); background:rgba(255,255,255,.86); backdrop-filter:blur(10px); padding:18px 22px; display:flex; justify-content:space-between; align-items:center; gap:14px; }
    h1 { margin:0; font-size:22px; letter-spacing:-0.03em; }
    .subtitle { margin:4px 0 0; color:var(--muted); font-size:13px; }
    .messages { flex:1; overflow:auto; padding:24px; display:flex; flex-direction:column; gap:16px; }
    .msg { max-width:880px; width:fit-content; padding:15px 17px; border-radius:18px; border:1px solid var(--line); line-height:1.62; white-space:pre-wrap; word-break:break-word; background:#fff; box-shadow:0 10px 30px rgba(15,23,42,.04); }
    .msg.user { margin-left:auto; color:#fff; background:var(--brand); border-color:var(--brand); }
    .msg.system { width:auto; max-width:none; background:#fff7ed; border-color:#fed7aa; color:#9a3412; }
    .composer { border-top:1px solid var(--line); background:#fff; padding:16px 22px; }
    .composer form { display:flex; gap:10px; align-items:flex-end; }
    textarea { flex:1; min-height:54px; max-height:180px; resize:vertical; border:1px solid var(--line); border-radius:16px; padding:14px 15px; font:inherit; line-height:1.5; outline:none; }
    textarea:focus { border-color:#93c5fd; box-shadow:0 0 0 4px var(--soft); }
    .password-panel { display:none; margin:14px 22px 0; padding:14px; border:1px solid #fed7aa; border-radius:16px; background:#fff7ed; color:#9a3412; }
    .password-panel.show { display:block; }
    .password-row { display:flex; gap:8px; margin-top:10px; }
    .password-row input { flex:1; border:1px solid #fdba74; border-radius:12px; padding:11px 12px; font:inherit; }
    .small { color:var(--muted); font-size:12px; line-height:1.5; }
    @media (max-width: 860px) { .layout { grid-template-columns:1fr; } aside { border-right:0; border-bottom:1px solid var(--line); } .gpt-list { grid-template-columns:repeat(2, minmax(0,1fr)); } .composer form { flex-direction:column; align-items:stretch; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="brand"><span class="dot"></span><span>Paper_Talk</span></div>
      <p class="side-title">Specialist GPTs</p>
      <nav class="gpt-list" id="gptList"></nav>
      <div class="quota" id="quotaBox">Quota 확인 중...</div>
      <div class="auth"><a class="btn secondary" href="/specialist-gpts">GPT 목록</a><a class="btn" href="/auth/google">Google 로그인</a></div>
      <p class="small">정적 HTML 파일이 없거나 잘못 올라가도 이 내장 페이지가 우선 표시됩니다.</p>
    </aside>
    <main>
      <div class="topbar">
        <div><h1 id="pageTitle">${profile.title}</h1><p class="subtitle" id="pageSubtitle">${profile.knowledgeLabel}</p></div>
        <button class="secondary" id="newChatBtn" type="button">새 대화</button>
      </div>
      <section class="password-panel" id="passwordPanel">
        <strong>Neuroscience GPT private access</strong>
        <div>비밀번호를 입력하면 24시간 동안 접속할 수 있습니다.</div>
        <div class="password-row"><input id="neuroPassword" type="password" placeholder="Password"><button type="button" id="passwordBtn">인증</button></div>
        <div class="small" id="passwordStatus"></div>
      </section>
      <section class="messages" id="messages" aria-live="polite"></section>
      <section class="composer">
        <form id="chatForm">
          <textarea id="messageInput" placeholder="질문을 입력하세요. 예: EGFR-mutant lung cancer에서 resistance mechanism 정리해줘" required></textarea>
          <button id="sendBtn" type="submit">Send</button>
          <button id="cancelBtn" class="danger" type="button" style="display:none">Cancel</button>
        </form>
      </section>
    </main>
  </div>
  <script>
    var INITIAL = ${initialData};
    var GPTS = [
      { key:'neuroscience', path:'/neuroscience-gpt', title:'Neuroscience GPT' },
      { key:'mitochondria', path:'/mitochondria-gpt', title:'Mitochondria GPT' },
      { key:'single_cell', path:'/single-cell-gpt', title:'Single-cell GPT' },
      { key:'spatial_biology', path:'/spatial-biology-gpt', title:'Spatial Biology GPT' },
      { key:'cancer_genomics', path:'/cancer-genomics-gpt', title:'Cancer Genomics GPT' }
    ];
    var state = { gptKey: INITIAL.gptKey, threadId: '', pendingCancelId: '', isSending: false };
    var el = function(id) { return document.getElementById(id); };
    var messages = el('messages');

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, function(ch) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
      });
    }

    function addMessage(role, text) {
      var div = document.createElement('div');
      div.className = 'msg ' + role;
      div.innerHTML = escapeHtml(text);
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      return div;
    }

    function setSending(sending) {
      state.isSending = sending;
      el('sendBtn').disabled = sending;
      el('messageInput').disabled = sending;
      el('cancelBtn').style.display = sending ? 'inline-block' : 'none';
    }

    function renderGptList() {
      el('gptList').innerHTML = GPTS.map(function(g) {
        var cls = g.key === state.gptKey ? 'gpt-link active' : 'gpt-link';
        return '<a class="' + cls + '" href="' + g.path + '">' + escapeHtml(g.title) + '</a>';
      }).join('');
    }

    async function fetchJson(url, options) {
      var res = await fetch(url, options || {});
      var data = await res.json().catch(function() { return { ok:false, error:'Non-JSON response from server.' }; });
      if (!res.ok && data && data.private) showPasswordPanel();
      return data;
    }

    function showPasswordPanel() { el('passwordPanel').classList.add('show'); }

    async function loadMe() {
      var data = await fetchJson('/api/me');
      if (!data.ok) {
        el('quotaBox').textContent = data.error || 'Quota 정보를 불러오지 못했습니다.';
        return;
      }
      var q = data.quota || {};
      var who = data.user ? (data.user.name || data.user.email || 'Signed-in user') : 'Guest';
      el('quotaBox').innerHTML = '<strong>' + escapeHtml(who) + '</strong><br>사용량: ' + (q.used || 0) + ' / ' + (q.limit || '-') + '<br>남은 횟수: ' + (q.remaining == null ? '-' : q.remaining);
    }

    async function submitPassword() {
      var password = el('neuroPassword').value.trim();
      if (!password) return;
      el('passwordStatus').textContent = '확인 중...';
      var data = await fetchJson('/api/neuro-gpt/access', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ password: password })
      });
      if (data.ok) {
        el('passwordStatus').textContent = '인증되었습니다. 이제 질문할 수 있습니다.';
        setTimeout(function() { el('passwordPanel').classList.remove('show'); }, 700);
      } else {
        el('passwordStatus').textContent = data.error || '인증 실패';
      }
    }

    function makeCancelId() {
      var random = Math.random().toString(36).slice(2);
      return 'web_' + Date.now().toString(36) + '_' + random;
    }

    async function sendMessage(evt) {
      evt.preventDefault();
      if (state.isSending) return;
      var input = el('messageInput');
      var message = input.value.trim();
      if (!message) return;
      input.value = '';
      addMessage('user', message);
      var placeholder = addMessage('assistant', '생각 중...');
      state.pendingCancelId = makeCancelId();
      setSending(true);
      try {
        var data = await fetchJson('/api/gpt/chat', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ message: message, threadId: state.threadId, gptKey: state.gptKey, cancelId: state.pendingCancelId })
        });
        if (data.ok) {
          state.threadId = data.threadId || state.threadId;
          placeholder.innerHTML = escapeHtml(data.answer || 'No answer returned.');
          if (data.quota) loadMe();
        } else if (data.canceled) {
          placeholder.className = 'msg system';
          placeholder.innerHTML = escapeHtml(data.error || 'Canceled.');
        } else {
          placeholder.className = 'msg system';
          placeholder.innerHTML = escapeHtml(data.error || 'Request failed.');
        }
      } catch (err) {
        placeholder.className = 'msg system';
        placeholder.innerHTML = escapeHtml(err && err.message ? err.message : err);
      } finally {
        setSending(false);
        state.pendingCancelId = '';
      }
    }

    async function cancelRequest() {
      if (!state.pendingCancelId) return;
      await fetchJson('/api/gpt/cancel', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ cancelId: state.pendingCancelId, gptKey: state.gptKey })
      });
    }

    function newChat() {
      state.threadId = '';
      messages.innerHTML = '';
      addMessage('assistant', INITIAL.title + '입니다. 질문을 입력해 주세요.');
    }

    el('chatForm').addEventListener('submit', sendMessage);
    el('cancelBtn').addEventListener('click', cancelRequest);
    el('newChatBtn').addEventListener('click', newChat);
    el('passwordBtn').addEventListener('click', submitPassword);
    el('neuroPassword').addEventListener('keydown', function(evt) { if (evt.key === 'Enter') submitPassword(); });

    renderGptList();
    loadMe();
    if (INITIAL.isNeuroPrivate) showPasswordPanel();
    newChat();
  </script>
</body>
</html>`);
}

function isBlockedAI(request) {
  const ua = request.headers.get("User-Agent") || "";

  const blocked = [
    "GPTBot",
    "ChatGPT-User",
    "Google-Extended",
    "CCBot",
    "ClaudeBot",
    "PerplexityBot",
    "anthropic-ai",
    "Bytespider",
    "Amazonbot",
    "Applebot-Extended",
    "Meta-ExternalAgent",
    "FacebookBot",
    "Diffbot",
    "cohere-ai",
    "omgili",
    "YouBot"
  ];

  return blocked.some(bot => ua.toLowerCase().includes(bot.toLowerCase()));
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";").map(v => v.trim());

  for (const part of parts) {
    if (part.startsWith(name + "=")) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }

  return "";
}

function getNeuroGptPassword(env) {
  return String(env.NEURO_GPT_PASSWORD || DEFAULT_NEURO_GPT_PASSWORD || "").trim();
}

function createNeuroGptAccessCookie() {
  return `${NEURO_GPT_ACCESS_COOKIE}=ok; Path=/; Secure; SameSite=Lax; Max-Age=86400`;
}

function clearNeuroGptAccessCookie() {
  return `${NEURO_GPT_ACCESS_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`;
}

function hasNeuroGptAccess(request, env) {
  const expected = getNeuroGptPassword(env);
  if (!expected) return false;

  const url = new URL(request.url);
  const headerKey = String(request.headers.get("X-Neuro-GPT-Key") || "").trim();
  const queryKey = String(url.searchParams.get("neuroKey") || "").trim();
  const cookieValue = getCookie(request, NEURO_GPT_ACCESS_COOKIE);

  return (
    cookieValue === "ok" ||
    headerKey === expected ||
    queryKey === expected
  );
}

async function neuroGptAccessCheck(request, env) {
  const data = await request.json().catch(() => ({}));
  const password = String(data.password || data.key || "").trim();
  const expected = getNeuroGptPassword(env);

  if (!expected) {
    return json({ ok: false, error: "NEURO_GPT_PASSWORD is not configured." }, 500);
  }

  if (password !== expected) {
    return json(
      { ok: false, authenticated: false, error: "Incorrect Neuro-GPT password." },
      401,
      { "Set-Cookie": clearNeuroGptAccessCookie() }
    );
  }

  return json(
    { ok: true, authenticated: true },
    200,
    { "Set-Cookie": createNeuroGptAccessCookie() }
  );
}

function requireNeuroGptAccessIfNeeded(request, env, gptKey) {
  const key = normalizeGptKey(gptKey);

  if (key !== "neuroscience") {
    return null;
  }

  if (hasNeuroGptAccess(request, env)) {
    return null;
  }

  return json({
    ok: false,
    private: true,
    error: "Neuro-GPT is private. Please enter the Neuro-GPT password first."
  }, 401);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function createSessionCookie(user, env) {
  const payload = btoa(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture || "",
    createdAt: Date.now()
  }));

  const signature = await sign(payload, env.SESSION_SECRET);
  const value = `${payload}.${signature}`;

  return `pt_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

async function getSession(request, env) {
  const cookie = getCookie(request, "pt_session");
  if (!cookie || !cookie.includes(".")) return null;

  const [payload, signature] = cookie.split(".");
  const expected = await sign(payload, env.SESSION_SECRET);

  if (signature !== expected) return null;

  try {
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

async function googleLogin(request, env) {
  if (!env.GOOGLE_CLIENT_ID) {
    return json({ ok: false, error: "GOOGLE_CLIENT_ID is missing." }, 500);
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account"
  });

  return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
}

async function googleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) return new Response("Missing code", { status: 400 });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({
      ok: false,
      error: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing."
    }, 500);
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const token = await tokenRes.json();

  if (!token.access_token) {
    return json({
      ok: false,
      error: "Google token exchange failed",
      token
    }, 400);
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });

  const googleUser = await userRes.json();

  const user = {
    id: googleUser.id,
    name: googleUser.name || googleUser.email,
    email: googleUser.email,
    picture: googleUser.picture || ""
  };

  await env.DB.prepare(`
    INSERT INTO users (id, name, email, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email
  `).bind(user.id, user.name, user.email).run();

  const cookie = await createSessionCookie(user, env);

  return redirect("/", {
    "Set-Cookie": cookie
  });
}

function logout() {
  return redirect("/", {
    "Set-Cookie": "pt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  });
}

async function apiMe(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    const guestQuota = await getGuestGptQuota(request, env);

    return json({
      ok: true,
      user: null,
      guest: true,
      quota: {
        used: guestQuota.used,
        limit: guestQuota.limit,
        remaining: guestQuota.remaining,
        date: guestQuota.todayKey,
        resetsAt: guestQuota.resetsAt
      },
      message: "You can try Paper_Talk Vision GPT 3 times per day without signing in."
    });
  }

  const quota = await getMonthlyGptQuota(user.id, env, user);

  return json({
    ok: true,
    user,
    guest: false,
    quota: {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      monthKey: quota.monthKey,
      resetsAt: quota.resetsAt
    }
  });
}

async function deleteAccount(request, env) {
  const user = await getSession(request, env);

  if (!user || !user.id) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const userId = String(user.id || "");
  let userEmail = String(user.email || "").trim();

  try {
    const row = await env.DB.prepare(`
      SELECT email
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(userId).first();

    if (row && row.email) {
      userEmail = String(row.email || "").trim();
    }
  } catch {
    // Continue with the email stored in the signed session.
  }

  async function safeDelete(sql, bindings = []) {
    try {
      let statement = env.DB.prepare(sql);
      if (bindings.length) statement = statement.bind(...bindings);
      await statement.run();
    } catch {
      // Some older deployments may not have every optional table/column yet.
      // Account deletion should still clear the main user record and session.
    }
  }

  // Remove the user's GPT chat data first, then the thread rows.
  await safeDelete(`
    DELETE FROM gpt_messages
    WHERE user_id = ?
  `, [userId]);

  await safeDelete(`
    DELETE FROM gpt_threads
    WHERE user_id = ?
  `, [userId]);

  // Remove quota/cancel/active-user records tied to this account.
  await safeDelete(`
    DELETE FROM gpt_monthly_usage
    WHERE user_id = ?
  `, [userId]);

  await safeDelete(`
    DELETE FROM gpt_request_cancellations
    WHERE owner_key = ?
  `, [`user:${userId}`]);

  await safeDelete(`
    DELETE FROM active_users
    WHERE user_id = ?
  `, [userId]);

  if (userEmail) {
    await safeDelete(`
      DELETE FROM active_users
      WHERE email = ?
    `, [userEmail]);

    // Remove user-submitted posts. Admin-created posts use blank/admin emails and are not affected.
    await safeDelete(`
      DELETE FROM posts
      WHERE author_email = ?
    `, [userEmail]);
  }

  // Finally remove the user account row.
  await safeDelete(`
    DELETE FROM users
    WHERE id = ?
  `, [userId]);

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    ...corsHeaders()
  });

  headers.append("Set-Cookie", "pt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  headers.append("Set-Cookie", "pt_neuro_gpt_access=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");

  return new Response(JSON.stringify({ ok: true, deleted: true }, null, 2), {
    status: 200,
    headers
  });
}

async function listPosts(request, env) {
  const url = new URL(request.url);
  const section = url.searchParams.get("section") || "research";
  const type = url.searchParams.get("type") || "";

  const user = await getSession(request, env);
  const isLoggedIn = !!user;

  let page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const limit = 10;

  if (!isLoggedIn && (section === "research" || section === "study")) {
    page = 1;
  }

  const offset = (page - 1) * limit;

  if (section === "research" && isBlockedAI(request)) {
    return json({ ok: false, error: "Access denied." }, 403);
  }

  let where = "WHERE section = ? AND status = 'published'";
  const params = [section];

  if (type) {
    if (section === "study" && type === "study") {
      where += " AND type IN ('study', 'study_post', 'methodology_page', 'blog')";
    } else {
      where += " AND type = ?";
      params.push(type);
    }
  }

  const count = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM posts
    ${where}
  `).bind(...params).first();

  const realTotal = count ? count.total : 0;
  const visibleTotal =
    !isLoggedIn && (section === "research" || section === "study")
      ? Math.min(realTotal, 10)
      : realTotal;

  const posts = await env.DB.prepare(`
    SELECT *
    FROM posts
    ${where}
    ORDER BY datetime(created_at) DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();

  return json({
    ok: true,
    posts: posts.results,
    page,
    perPage: limit,
    total: visibleTotal,
    totalPages: Math.max(Math.ceil(visibleTotal / limit), 1),
    isLoggedIn
  });
}

async function createPost(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({
      ok: false,
      error: "Please sign in with Google before writing a post."
    }, 401);
  }

  const data = await request.json().catch(() => ({}));

  const section = String(data.section || "").trim();
  const type = String(data.type || "").trim();
  const title = String(data.title || "").trim();

  if (!section || !type || !title) {
    return json({
      ok: false,
      error: "section, type, and title are required."
    }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO posts (
      id,
      section,
      type,
      title,
      body,
      link,
      author_name,
      author_email,
      linkedin_url,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    crypto.randomUUID(),
    section,
    type,
    title,
    data.body || "",
    data.link || "",
    user.name,
    user.email,
    data.linkedinUrl || ""
  ).run();

  return json({
    ok: true,
    message: "Submitted. Your post will be published after admin approval."
  });
}

async function myPosts(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const posts = await env.DB.prepare(`
    SELECT *
    FROM posts
    WHERE author_email = ?
    ORDER BY datetime(created_at) DESC
  `).bind(user.email).all();

  return json({
    ok: true,
    posts: posts.results
  });
}

async function updateMyPost(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "").trim();

  if (!data.id || !title) {
    return json({
      ok: false,
      error: "Post ID and title are required."
    }, 400);
  }

  await env.DB.prepare(`
    UPDATE posts
    SET title = ?,
        body = ?,
        link = ?,
        linkedin_url = ?,
        status = 'pending'
    WHERE id = ?
      AND author_email = ?
  `).bind(
    title,
    data.body || "",
    data.link || "",
    data.linkedinUrl || "",
    data.id,
    user.email
  ).run();

  return json({
    ok: true,
    message: "Updated. Your post needs admin approval again."
  });
}

async function deleteMyPost(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const data = await request.json().catch(() => ({}));

  if (!data.id) {
    return json({ ok: false, error: "Post ID is required." }, 400);
  }

  await env.DB.prepare(`
    DELETE FROM posts
    WHERE id = ?
      AND author_email = ?
  `).bind(data.id, user.email).run();

  return json({ ok: true });
}

function getAdminKeyFromRequest(request) {
  const url = new URL(request.url);
  return String(request.headers.get("X-Admin-Key") || url.searchParams.get("key") || "").trim();
}

function isAdmin(request, env) {
  const key = getAdminKeyFromRequest(request);
  const expectedKey = String(env.ADMIN_KEY || "").trim();

  return Boolean(key && expectedKey && key === expectedKey);
}


function getSpecialistAdminKeyFromRequest(request) {
  const url = new URL(request.url);
  return String(
    request.headers.get("X-Specialist-Admin-Key") ||
    request.headers.get("X-Admin-Key") ||
    url.searchParams.get("specialistKey") ||
    url.searchParams.get("key") ||
    ""
  ).trim();
}

function isSpecialistAdmin(request, env) {
  const key = getSpecialistAdminKeyFromRequest(request);
  const expectedSpecialistKey = String(env.SPECIALIST_ADMIN_KEY || "").trim();
  const fallbackAdminKey = String(env.ADMIN_KEY || "").trim();

  return Boolean(
    key &&
    (
      (expectedSpecialistKey && key === expectedSpecialistKey) ||
      (!expectedSpecialistKey && fallbackAdminKey && key === fallbackAdminKey)
    )
  );
}

async function specialistAdminCheck(request, env) {
  if (!String(env.SPECIALIST_ADMIN_KEY || env.ADMIN_KEY || "").trim()) {
    return json({
      ok: false,
      error: "SPECIALIST_ADMIN_KEY or ADMIN_KEY is not configured in Worker secrets."
    }, 500);
  }

  if (!isSpecialistAdmin(request, env)) {
    return json({
      ok: false,
      error: "Unauthorized"
    }, 401);
  }

  return json({
    ok: true,
    authenticated: true,
    message: "Specialist admin key is valid."
  });
}

function createSpecialistForwardRequest(request, env) {
  const headers = new Headers(request.headers);
  const specialistKey = getSpecialistAdminKeyFromRequest(request);

  // Forward to existing admin full-text handlers, which already isolate data by gptKey.
  // If SPECIALIST_ADMIN_KEY is configured, specialist routes accept that key.
  // Existing handlers expect X-Admin-Key, so we pass through ADMIN_KEY internally when available.
  headers.set("X-Admin-Key", String(env.ADMIN_KEY || specialistKey || "").trim());

  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: request.redirect
  });
}

async function specialistAdminImportFullText(request, env) {
  if (!isSpecialistAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  return adminImportResearchFullText(createSpecialistForwardRequest(request, env), env);
}

async function specialistAdminListFullText(request, env) {
  if (!isSpecialistAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  return adminListResearchFullText(createSpecialistForwardRequest(request, env), env);
}

async function specialistAdminDeleteFullText(request, env) {
  if (!isSpecialistAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  return adminDeleteResearchFullText(createSpecialistForwardRequest(request, env), env);
}


async function adminCheck(request, env) {
  if (!String(env.ADMIN_KEY || "").trim()) {
    return json({
      ok: false,
      error: "ADMIN_KEY is not configured in Worker secrets."
    }, 500);
  }

  if (!isAdmin(request, env)) {
    return json({
      ok: false,
      error: "Unauthorized"
    }, 401);
  }

  return json({
    ok: true,
    authenticated: true,
    message: "Admin key is valid."
  });
}

async function adminDebugVisitor(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const todayKey = getTodayKey();
  const visitorIp = getVisitorIp(request);
  const guestHash = await sha256Hex(`${todayKey}:${visitorIp}:${env.SESSION_SECRET || "paper-talk"}:guest-gpt`);

  return json({
    ok: true,
    visitorIp,
    todayKey,
    guestHashPreview: guestHash.slice(0, 12),
    note: "Use this only for admin debugging. If visitorIp does not change, Cloudflare is still seeing the same IP even if your local IP/VPN appears changed."
  });
}

async function adminUserCount(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const result = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM users
  `).first();

  return json({
    ok: true,
    total: result ? result.total : 0
  });
}


async function ensureActiveUsersTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS active_users (
      visitor_key TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      email TEXT,
      is_logged_in INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function publicActiveHeartbeat(request, env) {
  await ensureActiveUsersTable(env);

  let data = {};
  try {
    data = await request.json();
  } catch {
    data = {};
  }

  const forceGuest = Boolean(data.forceGuest || data.adminPage);
  const user = forceGuest ? null : await getSession(request, env);

  const visitorIp = getVisitorIp(request);

  // Important:
  // Active visitors are counted by IP hash only, so the same IP is counted once.
  // This prevents one person/browser from being counted separately as guest + signed-in.
  const visitorKey = "ip:" + await sha256Hex(`${visitorIp}:${env.SESSION_SECRET || "paper-talk"}:active-user`);

  await env.DB.prepare(`
    INSERT INTO active_users (
      visitor_key,
      user_id,
      name,
      email,
      is_logged_in,
      last_seen
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(visitor_key) DO UPDATE SET
      user_id = excluded.user_id,
      name = excluded.name,
      email = excluded.email,
      is_logged_in = excluded.is_logged_in,
      last_seen = CURRENT_TIMESTAMP
  `).bind(
    visitorKey,
    user ? user.id : "",
    user ? (user.name || "") : "Guest",
    user ? (user.email || "") : "",
    user ? 1 : 0
  ).run();

  return json({
    ok: true,
    loggedIn: Boolean(user),
    countedBy: "ip"
  });
}

async function adminActiveUsers(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  await ensureActiveUsersTable(env);

  const rows = await env.DB.prepare(`
    SELECT
      visitor_key,
      user_id,
      name,
      email,
      is_logged_in,
      last_seen
    FROM active_users
    WHERE datetime(last_seen) >= datetime('now', '-5 minutes')
    ORDER BY datetime(last_seen) DESC
  `).all();

  const active = rows.results || [];
  const signedIn = active.filter(row => Number(row.is_logged_in || 0) === 1);
  const guests = active.filter(row => Number(row.is_logged_in || 0) !== 1);

  return json({
    ok: true,
    totalActive: active.length,
    signedInActive: signedIn.length,
    guestActive: guests.length,
    users: signedIn.map(row => ({
      name: row.name || "",
      email: row.email || "",
      last_seen: row.last_seen || ""
    }))
  });
}


function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getVisitorIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "unknown"
  );
}

async function ensureDailyVisitsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS daily_visits (
      visit_date TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS daily_visit_ips (
      visit_date TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (visit_date, ip_hash)
    )
  `).run();
}

async function publicTodayVisitCount(request, env) {
  const todayKey = getTodayKey();
  const visitorIp = getVisitorIp(request);
  const ipHash = await sha256Hex(`${todayKey}:${visitorIp}:${env.SESSION_SECRET || "paper-talk"}`);

  await ensureDailyVisitsTable(env);

  const insertIpResult = await env.DB.prepare(`
    INSERT OR IGNORE INTO daily_visit_ips (
      visit_date,
      ip_hash,
      created_at
    )
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(todayKey, ipHash).run();

  const isNewVisitor =
    Number(insertIpResult?.meta?.changes || 0) > 0;

  if (isNewVisitor) {
    await env.DB.prepare(`
      INSERT INTO daily_visits (
        visit_date,
        count,
        updated_at
      )
      VALUES (?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(visit_date) DO UPDATE SET
        count = count + 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(todayKey).run();
  } else {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO daily_visits (
        visit_date,
        count,
        updated_at
      )
      VALUES (?, 0, CURRENT_TIMESTAMP)
    `).bind(todayKey).run();
  }

  const result = await env.DB.prepare(`
    SELECT count
    FROM daily_visits
    WHERE visit_date = ?
  `).bind(todayKey).first();

  return json({
    ok: true,
    date: todayKey,
    total: result ? Number(result.count || 0) : 0,
    counted: isNewVisitor
  });
}

async function adminListPosts(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const section = url.searchParams.get("section") || "";
  const type = url.searchParams.get("type") || "";
  const status = url.searchParams.get("status") || "";

  let where = "WHERE 1=1";
  const params = [];

  if (section) {
    where += " AND section = ?";
    params.push(section);
  }

  if (type) {
    if (section === "study" && type === "study") {
      where += " AND type IN ('study', 'study_post', 'methodology_page', 'blog')";
    } else {
      where += " AND type = ?";
      params.push(type);
    }
  }

  if (status) {
    where += " AND status = ?";
    params.push(status);
  }

  const posts = await env.DB.prepare(`
    SELECT *
    FROM posts
    ${where}
    ORDER BY datetime(created_at) DESC
  `).bind(...params).all();

  return json({
    ok: true,
    posts: posts.results
  });
}

async function adminApprovePost(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));

  if (!data.id) {
    return json({ ok: false, error: "Post ID is required." }, 400);
  }

  await env.DB.prepare(`
    UPDATE posts
    SET status = 'published'
    WHERE id = ?
  `).bind(data.id).run();

  const post = await env.DB.prepare(`
    SELECT *
    FROM posts
    WHERE id = ?
  `).bind(data.id).first();

  if (post && post.section === "research" && post.type === "paper") {
    await indexResearchPaperPost(post, env);
  }

  return json({ ok: true });
}

async function adminDeletePost(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));

  if (!data.id) {
    return json({ ok: false, error: "Post ID is required." }, 400);
  }

  // Delete chunked full-text evidence first.
  try {
    await ensurePaperFullTextTables(env);
    await ensureSpecialistGptTables(env);

    const fullTextRows = await env.DB.prepare(`
      SELECT vector_id, chunk_index, content_hash
      FROM paper_fulltext_chunks
      WHERE post_id = ?
    `).bind(data.id).all();

    await env.DB.prepare(`
      DELETE FROM paper_fulltext_chunks
      WHERE post_id = ?
    `).bind(data.id).run();

    if (env.VECTORIZE) {
      const ids = (fullTextRows.results || [])
        .map(row => row.vector_id || `${data.id}:fulltext:${String(row.content_hash || "").slice(0, 16)}:${row.chunk_index}`)
        .filter(Boolean);

      if (ids.length) {
        try {
          await env.VECTORIZE.deleteByIds(ids);
        } catch {}
      }
    }
  } catch {
    // Continue deleting the post and old research_knowledge row.
  }

  await env.DB.prepare(`
    DELETE FROM research_knowledge
    WHERE post_id = ?
  `).bind(data.id).run();

  if (env.VECTORIZE) {
    try {
      const ids = Array.from({ length: 24 }, (_, index) => `${data.id}:${index}`);
      await env.VECTORIZE.deleteByIds(ids);
    } catch {
      // Ignore Vectorize delete errors so post deletion still works.
    }
  }

  await env.DB.prepare(`
    DELETE FROM posts
    WHERE id = ?
  `).bind(data.id).run();

  return json({ ok: true });
}


async function adminUpdatePost(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));

  const id = String(data.id || "").trim();
  const section = String(data.section || "").trim();
  const type = String(data.type || "").trim();
  const status = String(data.status || "published").trim();
  const title = String(data.title || "").trim();
  const body = String(data.body || "");
  const link = String(data.link || "").trim();

  if (!id || !section || !type || !title) {
    return json({
      ok: false,
      error: "id, section, type, and title are required."
    }, 400);
  }

  await env.DB.prepare(`
    UPDATE posts
    SET section = ?,
        type = ?,
        title = ?,
        body = ?,
        link = ?,
        status = ?
    WHERE id = ?
  `).bind(
    section,
    type,
    title,
    body,
    link,
    status,
    id
  ).run();

  if (section === "research" && type === "paper" && status === "published") {
    const post = await env.DB.prepare(`
      SELECT *
      FROM posts
      WHERE id = ?
    `).bind(id).first();

    if (post) {
      await indexResearchPaperPost(post, env);
    }
  } else {
    await env.DB.prepare(`
      DELETE FROM research_knowledge
      WHERE post_id = ?
    `).bind(id).run();

    if (env.VECTORIZE) {
      try {
        const ids = Array.from({ length: 24 }, (_, index) => `${id}:${index}`);
        await env.VECTORIZE.deleteByIds(ids);
      } catch {
        // Ignore Vectorize cleanup errors.
      }
    }
  }

  return json({
    ok: true,
    message: "Post updated."
  });
}

async function adminCreateResearchPaper(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "").trim();

  if (!title) {
    return json({ ok: false, error: "Title is required." }, 400);
  }

  const postId = crypto.randomUUID();

  // v44:
  // New Research Paper metadata is intentionally compact.
  // Removed admin-only fields: figures, description, note.
  // Full-text PDF/TXT evidence is stored separately in paper_fulltext_chunks.
  const researchData = {
    year: data.year || "",
    authors: data.authors || "",
    journal: data.journal || "",
    abstract: data.abstract || "",
    category: data.category || "",
    pdfLink: data.pdfLink || "",
    tags: data.tags || ""
  };

  await env.DB.prepare(`
    INSERT INTO posts (
      id,
      section,
      type,
      title,
      body,
      link,
      author_name,
      author_email,
      linkedin_url,
      status
    )
    VALUES (?, 'research', 'paper', ?, ?, ?, 'Admin', '', '', 'published')
  `).bind(
    postId,
    title,
    JSON.stringify(researchData),
    data.articleLink || ""
  ).run();

  await indexResearchPaperData({
    postId,
    title,
    sourceUrl: data.articleLink || "",
    pdfLink: data.pdfLink || "",
    researchData
  }, env);

  return json({
    ok: true,
    postId,
    message: "Research paper saved and added to Paper_Talk GPT knowledge base."
  });
}


async function ensurePaperFullTextTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS paper_fulltext_chunks (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source_url TEXT,
      pdf_link TEXT,
      file_name TEXT,
      source_type TEXT,
      gpt_key TEXT DEFAULT 'paper_talk',
      content_hash TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      vector_id TEXT,
      text TEXT NOT NULL,
      text_length INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_paper_fulltext_chunks_post_id
    ON paper_fulltext_chunks(post_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_paper_fulltext_chunks_hash
    ON paper_fulltext_chunks(content_hash)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_paper_fulltext_chunks_title
    ON paper_fulltext_chunks(title)
  `).run();

  try {
    await env.DB.prepare(`
      ALTER TABLE paper_fulltext_chunks ADD COLUMN vector_id TEXT
    `).run();
  } catch {
    // Column already exists.
  }

  try {
    await env.DB.prepare(`
      ALTER TABLE paper_fulltext_chunks ADD COLUMN gpt_key TEXT DEFAULT 'paper_talk'
    `).run();
  } catch {
    // Column already exists.
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_paper_fulltext_chunks_gpt_key
      ON paper_fulltext_chunks(gpt_key)
    `).run();
  } catch {}
}

function chunkFullTextForStorage(text, chunkSize = 3500, overlap = 250) {
  const clean = String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    let chunk = clean.slice(start, end).trim();

    // Try not to end in the middle of a sentence when possible.
    if (end < clean.length) {
      const lastStop = Math.max(
        chunk.lastIndexOf(". "),
        chunk.lastIndexOf("\n"),
        chunk.lastIndexOf("; ")
      );

      if (lastStop > Math.floor(chunk.length * 0.55)) {
        chunk = chunk.slice(0, lastStop + 1).trim();
      }
    }

    if (chunk.length >= 120) chunks.push(chunk);

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  // Safety cap:
  // 160 chunks x ~2.8k chars is enough for most biomedical full texts
  // and prevents Cloudflare Worker / D1 / Vectorize burst failures.
  return chunks.slice(0, PAPER_TALK_MAX_IMPORTED_FULLTEXT_CHUNKS);
}

async function upsertFullTextChunkVectors({ postId, title, sourceUrl, pdfLink, fileName, contentHash, chunks }, env) {
  // v49 ultra-safe mode:
  // Do not create embeddings during admin PDF batch upload. Large batches of PDFs can easily
  // exceed Cloudflare CPU/subrequest limits and return HTML 500/503 pages. The text is still
  // stored in D1 chunks and can be retrieved by title/keyword. Reindex/repair can be used later
  // if you want to build vectors in a controlled small batch.
  return false;
}

async function findResearchKnowledgeMatchForFullText({ titleInput, sourceUrlInput, pdfLinkInput, env }) {
  const normalizedSourceUrl = normalizeUrlForMatch(sourceUrlInput);
  const normalizedPdfLink = normalizeUrlForMatch(pdfLinkInput);

  // v49 ultra-safe mode:
  // During large PDF batch import, do only cheap exact/LIKE matching. Avoid scanning 500
  // research_knowledge rows and scoring every row for every PDF; that caused Worker 500/503
  // HTML responses when importing dozens of PDFs.
  if (sourceUrlInput || pdfLinkInput) {
    const matchedByUrl = await env.DB.prepare(`
      SELECT id, post_id, title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE status = 'indexed'
        AND post_id NOT LIKE 'thinking_logic_%'
        AND title NOT LIKE '[Thinking Logic]%'
        AND content NOT LIKE '%Knowledge role: THINKING_FRAMEWORK_ONLY%'
        AND (
          source_url = ?
          OR pdf_link = ?
          OR source_url = ?
          OR pdf_link = ?
        )
      ORDER BY datetime(updated_at) DESC
      LIMIT 1
    `).bind(
      sourceUrlInput,
      pdfLinkInput,
      normalizedSourceUrl,
      normalizedPdfLink
    ).first();

    if (matchedByUrl) return matchedByUrl;
  }

  if (titleInput) {
    const exact = await env.DB.prepare(`
      SELECT id, post_id, title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE status = 'indexed'
        AND post_id NOT LIKE 'thinking_logic_%'
        AND title NOT LIKE '[Thinking Logic]%'
        AND content NOT LIKE '%Knowledge role: THINKING_FRAMEWORK_ONLY%'
        AND lower(title) = lower(?)
      ORDER BY datetime(updated_at) DESC
      LIMIT 1
    `).bind(titleInput).first();

    if (exact) return exact;

    const safeLikeTitle = titleInput.slice(0, 90).replace(/[%_]/g, ' ').trim();
    if (safeLikeTitle.length >= 18) {
      const like = await env.DB.prepare(`
        SELECT id, post_id, title, source_url, pdf_link, content
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND content NOT LIKE '%Knowledge role: THINKING_FRAMEWORK_ONLY%'
          AND title LIKE ?
        ORDER BY datetime(updated_at) DESC
        LIMIT 1
      `).bind(`%${safeLikeTitle}%`).first();

      if (like) return like;
    }
  }

  return null;
}

async function ensureMinimalResearchKnowledgeForFullText({ postId, title, sourceUrl, pdfLink, fileName, contentHash, gptKey = DEFAULT_GPT_KEY, env }) {
  gptKey = normalizeGptKey(gptKey);
  await ensureSpecialistGptTables(env);
  const existing = await env.DB.prepare(`
    SELECT post_id
    FROM research_knowledge
    WHERE post_id = ?
    LIMIT 1
  `).bind(postId).first();

  if (existing) return;

  const content = [
    "Paper_Talk DB Research Paper",
    "Knowledge source: FULL_TEXT_CHUNKED_UPLOAD",
    "Important: Full text is stored separately in paper_fulltext_chunks. Retrieve chunks by post_id when answering.",
    `Title: ${title}`,
    sourceUrl ? `Article link: ${sourceUrl}` : "",
    pdfLink ? `PDF link: ${pdfLink}` : "",
    fileName ? `Full text file: ${fileName}` : "",
    contentHash ? `Full text content hash: ${contentHash}` : ""
  ].filter(Boolean).join("\n");

  await env.DB.prepare(`
    INSERT INTO research_knowledge (
      id,
      post_id,
      title,
      source_url,
      pdf_link,
      content,
      gpt_key,
      status,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'indexed', CURRENT_TIMESTAMP)
    ON CONFLICT(post_id) DO UPDATE SET
      title = excluded.title,
      source_url = excluded.source_url,
      pdf_link = excluded.pdf_link,
      content = excluded.content,
      gpt_key = excluded.gpt_key,
      status = 'indexed',
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    crypto.randomUUID(),
    postId,
    title,
    sourceUrl || "",
    pdfLink || "",
    content,
    gptKey
  ).run();
}

async function adminImportResearchFullText(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  await ensurePaperFullTextTables(env);
  await ensureSpecialistGptTables(env);

  const data = await request.json().catch(() => ({}));
  const gptKey = getGptKeyFromRequestData(data);

  const titleInput = String(data.title || "").trim();
  const sourceUrlInput = String(data.sourceUrl || data.articleLink || "").trim();
  const pdfLinkInput = String(data.pdfLink || "").trim();
  const fileName = String(data.fileName || "full-text-file").trim();
  const sourceType = String(data.sourceType || "full_text_pdf_or_txt").trim();
  const rawText = String(data.text || data.extractedText || "").trim();

  if (!titleInput && !sourceUrlInput && !pdfLinkInput) {
    return json({
      ok: false,
      error: "Please provide at least a paper title, article URL, or PDF link so I can connect the full text to the correct paper."
    }, 400);
  }

  if (!rawText || rawText.length < PAPER_TALK_MIN_FULLTEXT_CHARS) {
    return json({
      ok: false,
      error: "Full text is too short. If this PDF is scanned images, use a text-based PDF or OCR it first. Extracted characters: " + rawText.length
    }, 400);
  }

  // v51 queue-safe mode:
  // Do not run DB matching during high-volume PDF import. Each import should be a
  // cheap write-only operation. This avoids Cloudflare 500/503 HTML errors caused
  // by repeated D1 lookups while uploading many files. Matching/reindexing can be
  // repaired later by metadata title.
  const matched = null;

  const finalTitle = titleInput || fileName.replace(/\.[^.]+$/, "");
  const finalSourceUrl = matched?.source_url || sourceUrlInput || "";
  const finalPdfLink = matched?.pdf_link || pdfLinkInput || "";
  const postId = matched?.post_id || `${gptKey}_fulltext_` + await sha256Hex(`${finalTitle}:${finalSourceUrl}:${fileName}`);

  const cleanedFullText = cleanUploadedFullText(rawText);
  const fullTextHash = await sha256Hex(cleanedFullText.replace(/\s+/g, " "));

  // Important DB isolation fix:
  // Duplicate checks must be scoped to the selected GPT DB. Otherwise a PDF
  // already uploaded to Paper_Talk Vision GPT can incorrectly block a Neuro-GPT
  // upload because both currently live in the same D1 database with gpt_key labels.
  const duplicateRow = await env.DB.prepare(`
    SELECT post_id, title, file_name, content_hash, COALESCE(gpt_key, 'paper_talk') AS gpt_key
    FROM paper_fulltext_chunks
    WHERE content_hash = ?
      AND COALESCE(gpt_key, 'paper_talk') = ?
    LIMIT 1
  `).bind(fullTextHash, gptKey).first();

  if (duplicateRow) {
    return json({
      ok: true,
      duplicate: true,
      duplicatePostId: duplicateRow.post_id || "",
      duplicateTitle: duplicateRow.title || "",
      title: duplicateRow.title || finalTitle,
      fileName: duplicateRow.file_name || fileName,
      fullTextCharacters: cleanedFullText.length,
      message: "This exact PDF/TXT full text was already imported, so it was skipped."
    });
  }

  let chunks = chunkFullTextForStorage(cleanedFullText);

  if (!chunks.length) {
    const metadataChunk = [
      "Paper_Talk DB Research Paper",
      "Knowledge source: PDF_METADATA_ONLY_OR_LOW_TEXT_UPLOAD",
      `Title: ${finalTitle}`,
      finalSourceUrl ? `Article link: ${finalSourceUrl}` : "",
      finalPdfLink ? `PDF link: ${finalPdfLink}` : "",
      fileName ? `Imported file: ${fileName}` : "",
      `Extracted characters: ${cleanedFullText.length}`,
      cleanedFullText ? `Extracted text preview: ${cleanedFullText.slice(0, 1200)}` : ""
    ].filter(Boolean).join("\n");
    chunks = [metadataChunk];
  }

  await ensureMinimalResearchKnowledgeForFullText({
    postId,
    title: finalTitle,
    sourceUrl: finalSourceUrl,
    pdfLink: finalPdfLink,
    fileName,
    contentHash: fullTextHash,
    gptKey,
    env
  });

  const vectorIds = chunks.map((_, index) => `${postId}:fulltext:${fullTextHash.slice(0, 16)}:${index}`);

  const insertStatements = chunks.map((chunk, i) => env.DB.prepare(`
    INSERT OR REPLACE INTO paper_fulltext_chunks (
      id,
      post_id,
      title,
      source_url,
      pdf_link,
      file_name,
      source_type,
      gpt_key,
      content_hash,
      chunk_index,
      vector_id,
      text,
      text_length
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `${postId}:fulltext:${fullTextHash.slice(0, 16)}:${i}`,
    postId,
    finalTitle,
    finalSourceUrl,
    finalPdfLink,
    fileName,
    cleanedFullText.length < 500 ? `${sourceType}_low_text` : sourceType,
    gptKey,
    fullTextHash,
    i,
    vectorIds[i],
    chunk,
    chunk.length
  ));

  for (let i = 0; i < insertStatements.length; i += 24) {
    await env.DB.batch(insertStatements.slice(i, i + 24));
  }

  let vectorIndexed = false;
  try {
    vectorIndexed = await upsertFullTextChunkVectors({
      postId,
      title: finalTitle,
      sourceUrl: finalSourceUrl,
      pdfLink: finalPdfLink,
      fileName,
      contentHash: fullTextHash,
      chunks
    }, env);
  } catch (error) {
    // D1 chunk storage should still succeed even if Vectorize temporarily fails.
    vectorIndexed = false;
  }

  return json({
    ok: true,
    matchedExistingPaper: Boolean(matched),
    postId,
    title: finalTitle,
    fileName,
    fullTextCharacters: cleanedFullText.length,
    chunks: chunks.length,
    fullTextHash,
    duplicate: false,
    vectorIndexed,
    message: vectorIndexed
      ? "Full text PDF/TXT was stored as searchable chunks and indexed in Vectorize."
      : "Full text PDF/TXT was stored as safe D1 chunks. Vectorize indexing is intentionally skipped during batch upload to prevent Worker 500/503 errors."
  });
}


async function adminListResearchFullText(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  await ensurePaperFullTextTables(env);
  await ensureSpecialistGptTables(env);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const gptKey = normalizeGptKey(url.searchParams.get("gptKey") || url.searchParams.get("gpt") || DEFAULT_GPT_KEY);

  let rows;

  if (q) {
    rows = await env.DB.prepare(`
      SELECT
        post_id,
        title,
        file_name,
        source_url,
        pdf_link,
        COALESCE(gpt_key, 'paper_talk') AS gpt_key,
        content_hash,
        COUNT(*) AS chunks,
        SUM(text_length) AS characters,
        MAX(created_at) AS created_at
      FROM paper_fulltext_chunks
      WHERE COALESCE(gpt_key, 'paper_talk') = ?
        AND (
          LOWER(title) LIKE ?
          OR LOWER(file_name) LIKE ?
          OR LOWER(text) LIKE ?
        )
      GROUP BY post_id, file_name, content_hash, COALESCE(gpt_key, 'paper_talk')
      ORDER BY datetime(created_at) DESC
      LIMIT 300
    `).bind(gptKey, `%${q}%`, `%${q}%`, `%${q}%`).all();
  } else {
    rows = await env.DB.prepare(`
      SELECT
        post_id,
        title,
        file_name,
        source_url,
        pdf_link,
        COALESCE(gpt_key, 'paper_talk') AS gpt_key,
        content_hash,
        COUNT(*) AS chunks,
        SUM(text_length) AS characters,
        MAX(created_at) AS created_at
      FROM paper_fulltext_chunks
      WHERE COALESCE(gpt_key, 'paper_talk') = ?
      GROUP BY post_id, file_name, content_hash, COALESCE(gpt_key, 'paper_talk')
      ORDER BY datetime(created_at) DESC
      LIMIT 300
    `).bind(gptKey).all();
  }

  return json({
    ok: true,
    gptKey,
    files: rows.results || []
  });
}
async function adminDeleteResearchFullText(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  await ensurePaperFullTextTables(env);
  await ensureSpecialistGptTables(env);

  const data = await request.json().catch(() => ({}));
  const postId = String(data.postId || "").trim();
  const contentHash = String(data.contentHash || "").trim();
  const fileName = String(data.fileName || "").trim();
  const gptKey = getGptKeyFromRequestData(data);

  if (!postId || !contentHash) {
    return json({
      ok: false,
      error: "postId and contentHash are required."
    }, 400);
  }

  const chunkRows = await env.DB.prepare(`
    SELECT vector_id, chunk_index
    FROM paper_fulltext_chunks
    WHERE post_id = ?
      AND content_hash = ?
      AND COALESCE(gpt_key, 'paper_talk') = ?
  `).bind(postId, contentHash, gptKey).all();

  await env.DB.prepare(`
    DELETE FROM paper_fulltext_chunks
    WHERE post_id = ?
      AND content_hash = ?
      AND COALESCE(gpt_key, 'paper_talk') = ?
  `).bind(postId, contentHash, gptKey).run();

  if (env.VECTORIZE) {
    try {
      const ids = (chunkRows.results || [])
        .map(row => row.vector_id || `${postId}:fulltext:${contentHash.slice(0, 16)}:${row.chunk_index}`)
        .filter(Boolean);

      if (ids.length) {
        await env.VECTORIZE.deleteByIds(ids);
      }
    } catch {
      // Ignore Vectorize cleanup errors so D1 deletion still succeeds.
    }
  }

  return json({
    ok: true,
    deleted: true,
    postId,
    fileName,
    contentHash,
    gptKey,
    deletedChunks: chunkRows.results?.length || 0,
    message: "Stored full text PDF/TXT chunks were deleted."
  });
}


function normalizeTextForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrlForMatch(value) {
  return String(value || "")
    .trim()
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/\/$/, "");
}

function cleanUploadedFullText(text) {
  const cleaned = String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  // Keep enough full text for retrieval while avoiding D1/Worker prompt and CPU failures.
  // For very large PDFs, the first 350k characters usually preserves abstract, intro,
  // methods, results, discussion, figure legends, and references.
  return cleaned.slice(0, PAPER_TALK_MAX_IMPORTED_FULLTEXT_CHARS);
}

function makeFullTextPreferredExcerpt(content) {
  const text = cleanBibtexText(content || "");
  const marker = "Knowledge source: FULL_TEXT_PDF_UPLOAD";
  const idx = text.indexOf(marker);

  if (idx < 0) return "";

  const fullTextStart = text.indexOf("Uploaded full text:", idx);
  const start = fullTextStart >= 0 ? fullTextStart : idx;
  const section = text.slice(start);

  const usefulMarkers = [
    "Abstract", "Introduction", "Results", "Discussion", "Conclusion", "Methods", "Materials and methods", "Figure", "Fig."
  ];

  const lower = section.toLowerCase();
  for (const m of usefulMarkers) {
    const j = lower.indexOf(m.toLowerCase());
    if (j >= 0) {
      return section.slice(Math.max(0, j - 200), Math.min(section.length, j + 3200));
    }
  }

  return section.slice(0, 3200);
}

function mergeFullTextIntoKnowledge(existingContent, fullTextBlock) {
  const base = String(existingContent || "").trim();
  const marker = "Knowledge source: FULL_TEXT_PDF_UPLOAD";

  if (base.includes(marker)) {
    const before = base.split("Paper_Talk DB Research Paper\nKnowledge source: FULL_TEXT_PDF_UPLOAD")[0].trim();
    return [before, fullTextBlock].filter(Boolean).join("\n\n---\n\n");
  }

  return [base, fullTextBlock].filter(Boolean).join("\n\n---\n\n");
}


async function adminImportLinkedInCsv(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const rawText = String(data.csvText || data.bibText || data.text || "").trim();

  if (!rawText) {
    return json({ ok: false, error: "CSV or BibTeX text is required." }, 400);
  }

  // v22: same endpoint supports both LinkedIn CSV and BibTeX.
  // BibTeX must be parsed by entry, not by line.
  if (looksLikeBibtex(rawText)) {
    return adminImportBibtexText(rawText, env);
  }

  return adminImportLinkedInCsvText(rawText, env);
}


async function adminImportThinkingLogic(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || data.fileName || "Scientific Thinking Logic").trim();
  const fileName = String(data.fileName || "").trim();
  const sourceType = String(data.sourceType || "thinking_logic_pdf_or_text").trim();
  const rawText = String(data.text || data.extractedText || "").trim();

  if (!rawText || rawText.length < 200) {
    return json({
      ok: false,
      error: "Thinking logic text is too short. If this was a PDF, make sure the browser finished extracting the PDF text before importing."
    }, 400);
  }

  const safeTitle = cleanBibtexText(title || fileName || "Scientific Thinking Logic").slice(0, 220);
  const fingerprint = `${safeTitle}:${fileName}:${rawText.slice(0, 2000)}`;
  const postId = "thinking_logic_" + await sha256Hex(fingerprint);

  // Important change:
  // Do NOT store the whole PDF as GPT context.
  // First compress/distill the PDF into a short scientific reasoning framework.
  // This keeps Paper_Talk's warm research-mentor answer style and prevents huge prompts / 503 errors.
  const distilledLogic = await distillThinkingLogicForPaperTalk({
    title: safeTitle,
    fileName,
    rawText,
    env
  });

  // Keep multiple distilled thinking-logic imports so different books/frameworks can be combined.
  // Only remove legacy thinking-logic rows that do not use the safe compact post_id pattern.
  await env.DB.prepare(`
    DELETE FROM research_knowledge
    WHERE post_id NOT LIKE 'thinking_logic_%'
      AND (
        title LIKE '[Thinking Logic]%'
        OR content LIKE '%Knowledge role: THINKING_FRAMEWORK_ONLY%'
        OR content LIKE '%Paper_Talk Scientific Thinking Logic%'
      )
  `).run();

  const content = [
    "Paper_Talk Scientific Thinking Logic",
    "Knowledge role: THINKING_FRAMEWORK_ONLY",
    "Important: Use this as silent reasoning guidance only. Do not summarize this framework to the user. Do not use it as biological research evidence.",
    "Important: Final answers must keep the normal Paper_Talk warm Korean research-mentor style. The framework should improve judgment, not change the surface style into a textbook summary.",
    `Title: ${safeTitle}`,
    fileName ? `Imported file: ${fileName}` : "",
    sourceType ? `Imported source type: ${sourceType}` : "",
    `Original extracted characters: ${rawText.length}`,
    `Distilled framework characters: ${distilledLogic.length}`,
    "",
    "Distilled scientific reasoning framework:",
    distilledLogic
  ].filter(Boolean).join("\n");

  await env.DB.prepare(`
    INSERT INTO research_knowledge (
      id,
      post_id,
      title,
      source_url,
      pdf_link,
      content,
      status,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'indexed', CURRENT_TIMESTAMP)
    ON CONFLICT(post_id) DO UPDATE SET
      title = excluded.title,
      source_url = excluded.source_url,
      pdf_link = excluded.pdf_link,
      content = excluded.content,
      status = 'indexed',
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    crypto.randomUUID(),
    postId,
    `[Thinking Logic] ${safeTitle}`,
    "",
    "",
    content
  ).run();

  await upsertResearchKnowledgeVectors({
    postId,
    title: `[Thinking Logic] ${safeTitle}`,
    sourceUrl: "",
    pdfLink: "",
    content
  }, env);

  return json({
    ok: true,
    imported: 1,
    sourceType: "thinking_logic",
    title: safeTitle,
    rawCharacters: rawText.length,
    characters: distilledLogic.length,
    learnedCharacters: distilledLogic.length,
    compressionRatio: Number((distilledLogic.length / Math.max(rawText.length, 1)).toFixed(4)),
    message: "Thinking logic file was distilled into a compact reasoning framework and indexed. It will guide GPT silently without changing the normal Paper_Talk answer style."
  });
}

function splitTextForThinkingDistillation(text, chunkSize = 18000, maxChunks = 12) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const chunks = [];

  for (let i = 0; i < value.length && chunks.length < maxChunks; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize));
  }

  return chunks;
}

function fallbackDistillThinkingLogic(rawText, title = "") {
  const text = String(rawText || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const importantPatterns = [
    /data science process/i,
    /data preparation/i,
    /preprocessing/i,
    /exploratory data analysis|EDA/i,
    /feature/i,
    /dimensionality/i,
    /model/i,
    /algorithm/i,
    /validation/i,
    /evaluation/i,
    /performance/i,
    /hyper-parameter|hyperparameter/i,
    /workflow/i,
    /limitations?|advantages?|disadvantages?/i
  ];

  const lines = text
    .split(/\n+/)
    .map(v => v.trim())
    .filter(v => v.length >= 40 && v.length <= 600);

  const selected = [];
  for (const line of lines) {
    if (selected.length >= 80) break;
    if (importantPatterns.some(pattern => pattern.test(line))) {
      selected.push(line);
    }
  }

  const evidence = selected.length ? selected.join("\n") : text.slice(0, 22000);

  return `
SCIENTIFIC REASONING FRAMEWORK DISTILLED FROM: ${title || "uploaded thinking logic"}

Use this silently as a paper-reading and research-design checklist.

Core principles:
1. Clarify the biological or analytical question before judging any method.
2. Identify the data type first: bulk RNA-seq, single-cell, spatial, image, clinical cohort, or multi-omics.
3. Check whether preprocessing, quality control, missing-value handling, scaling, and normalization are appropriate for that data type.
4. Look for exploratory data analysis before trusting conclusions: distributions, outliers, batch effects, confounders, cohort composition, and feature behavior.
5. Distinguish feature selection, feature engineering, and dimensionality reduction. Ask whether the chosen features are biologically meaningful and technically reliable.
6. Match the model or statistical method to the actual task: regression, classification, clustering, trajectory, spatial structure, image analysis, or text analysis.
7. Evaluate whether the paper uses appropriate validation: held-out data, external cohort, perturbation experiment, functional assay, spatial validation, or clinical association.
8. Separate observed result, statistical association, biological interpretation, and mechanistic claim.
9. Treat unsupported mechanism, over-generalization, and weak validation as limitations.
10. When suggesting research ideas, connect data type, biological question, method, feasibility, novelty, and validation.

Relevant extracted notes:
${evidence.slice(0, 18000)}
`.trim();
}

async function callOpenAIThinkingDistiller(prompt, env, maxTokens = 1800) {
  if (!env.OPENAI_API_KEY) {
    return "";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You distill long scientific/data-science books into compact internal reasoning rules for a cancer genomics research assistant. Output concise English/Korean mixed rules. Do not write a textbook summary. Extract reusable thinking principles only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0,
        max_completion_tokens: maxTokens
      })
    });

    const raw = await res.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return "";
    }

    if (!res.ok) return "";
    return extractOpenAIText(data);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function distillThinkingLogicForPaperTalk({ title, fileName, rawText, env }) {
  const chunks = splitTextForThinkingDistillation(rawText, 18000, 12);
  const partials = [];

  for (let i = 0; i < chunks.length; i++) {
    const partial = await callOpenAIThinkingDistiller(`
Uploaded thinking-logic source: ${title || fileName || "Scientific Thinking Logic"}
Chunk ${i + 1} of ${chunks.length}

Task:
Extract only reusable reasoning principles useful for reading biomedical/cancer genomics papers.
Focus on:
- data quality
- preprocessing
- EDA
- feature engineering
- model/method selection
- validation
- limitations
- uncertainty
- how to turn evidence into research ideas

Do NOT summarize chapter content.
Do NOT create final user-facing answer style.
Return compact bullet-like rules.

TEXT:
${chunks[i]}
`, env, 1000);

    if (partial) partials.push(partial);
    await sleep(80);
  }

  if (!partials.length) {
    return fallbackDistillThinkingLogic(rawText, title || fileName);
  }

  const finalDistilled = await callOpenAIThinkingDistiller(`
Source title: ${title || fileName || "Scientific Thinking Logic"}

Below are partial extracted reasoning rules from a long PDF/book.
Compress them into one final internal Paper_Talk reasoning framework.

Critical constraints:
- 4,000 to 8,000 characters preferred.
- This must be used silently by GPT.
- It must NOT change the final answer into a textbook summary.
- It must preserve Paper_Talk's warm senior-researcher explanation style in the user's language.
- It should help the GPT read papers, evaluate methods, suggest research ideas, and identify validation/limitations.
- Separate "research evidence" from "reasoning framework".

PARTIAL RULES:
${partials.join("\n\n---\n\n").slice(0, 50000)}
`, env, 2200);

  const result = finalDistilled || partials.join("\n\n").slice(0, 12000);

  return `
PAPER_TALK DISTILLED SCIENTIFIC THINKING LOGIC

Use silently. Do not explain this framework to the user unless explicitly asked.
Do not cite this framework as paper evidence.
Do not let this framework change the final answer into a dry textbook summary.
Keep the existing Paper_Talk answer style: warm, calm, multilingual research mentor, practical research suggestions.

${result}

Final-answer behavior:
- For research ideas, answer like: background → why this direction is promising → what Paper_Talk DB suggests → concrete research questions → validation cautions.
- Use the framework only to improve judgment about data, methods, validation, and uncertainty.
- Never output the framework itself as the answer.
`.trim().slice(0, 14000);
}


async function adminDeleteThinkingLogic(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  // Find all rows imported as Scientific Thinking Logic.
  // These rows are reasoning frameworks only, stored in research_knowledge with post_id starting "thinking_logic_".
  const rows = await env.DB.prepare(`
    SELECT post_id
    FROM research_knowledge
    WHERE post_id LIKE 'thinking_logic_%'
       OR title LIKE '[Thinking Logic]%'
       OR content LIKE '%Knowledge role: THINKING_FRAMEWORK_ONLY%'
       OR content LIKE '%Paper_Talk Scientific Thinking Logic%'
  `).all();

  const postIds = [...new Set((rows.results || [])
    .map(row => String(row.post_id || "").trim())
    .filter(Boolean)
  )];

  await env.DB.prepare(`
    DELETE FROM research_knowledge
    WHERE post_id LIKE 'thinking_logic_%'
       OR title LIKE '[Thinking Logic]%'
       OR content LIKE '%Knowledge role: THINKING_FRAMEWORK_ONLY%'
       OR content LIKE '%Paper_Talk Scientific Thinking Logic%'
  `).run();

  // Clean Vectorize chunks too. Each knowledge row can create up to 24 vector IDs: postId:0 ... postId:23.
  let vectorDeleted = 0;
  if (env.VECTORIZE && postIds.length) {
    for (const postId of postIds) {
      try {
        const ids = Array.from({ length: 24 }, (_, index) => `${postId}:${index}`);
        await env.VECTORIZE.deleteByIds(ids);
        vectorDeleted += ids.length;
      } catch {
        // Ignore Vectorize cleanup errors so DB deletion still succeeds.
      }
    }
  }

  return json({
    ok: true,
    deleted: postIds.length,
    vectorDeleted,
    message: postIds.length
      ? `Deleted ${postIds.length} thinking logic file(s).`
      : "No thinking logic files were found."
  });
}

async function adminImportLinkedInCsvText(csvText, env) {
  const rows = parseCsv(csvText);

  if (!rows.length) {
    return json({ ok: false, error: "No CSV rows found." }, 400);
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const normalized = normalizeLinkedInRow(row);

      if (!normalized.content || normalized.content.length < 20) {
        skipped++;
        continue;
      }

      const title = cleanBibtexText(normalized.title || makeTitleFromText(normalized.content)).trim();

      if (!title || isMetadataOnlyTitle(title)) {
        skipped++;
        continue;
      }

      const fingerprint = normalized.sourceUrl || `${title}:${normalized.content.slice(0, 300)}`;
      const postId = "linkedin_" + await sha256Hex(fingerprint);

      const content = [
        `Source: LinkedIn post by SEO YOUNG Lee`,
        normalized.date ? `Date: ${normalized.date}` : "",
        title ? `Title: ${title}` : "",
        normalized.sourceUrl ? `LinkedIn URL: ${normalized.sourceUrl}` : "",
        "",
        normalized.content
      ].filter(v => v !== "").join("\n");

      await env.DB.prepare(`
        INSERT INTO research_knowledge (
          id,
          post_id,
          title,
          source_url,
          pdf_link,
          content,
          status,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'indexed', CURRENT_TIMESTAMP)
        ON CONFLICT(post_id) DO UPDATE SET
          title = excluded.title,
          source_url = excluded.source_url,
          pdf_link = excluded.pdf_link,
          content = excluded.content,
          status = 'indexed',
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        crypto.randomUUID(),
        postId,
        title,
        normalized.sourceUrl || "",
        normalized.pdfLink || "",
        content
      ).run();

      await upsertResearchKnowledgeVectors({
        postId,
        title,
        sourceUrl: normalized.sourceUrl || "",
        pdfLink: normalized.pdfLink || "",
        content
      }, env);

      imported++;
    } catch (error) {
      skipped++;
      errors.push(error?.message || "Unknown CSV import error");
    }
  }

  return json({
    ok: true,
    imported,
    skipped,
    sourceType: "linkedin_csv",
    errors: errors.slice(0, 10),
    message: `Imported ${imported} LinkedIn CSV rows. Skipped: ${skipped}`
  });
}

async function adminImportBibtexText(bibText, env) {
  const entries = parseBibtexEntries(bibText);

  if (!entries.length) {
    return json({ ok: false, error: "No BibTeX entries found." }, 400);
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const entry of entries) {
    try {
      const title = cleanBibtexText(entry.fields.title || "").trim();

      if (!title || isMetadataOnlyTitle(title)) {
        skipped++;
        continue;
      }

      const authors = cleanBibtexText(entry.fields.author || "");
      const journal = cleanBibtexText(entry.fields.journal || entry.fields.booktitle || entry.fields.publisher || "");
      const year = cleanBibtexText(entry.fields.year || "");
      const abstract = cleanBibtexText(entry.fields.abstract || "");
      const keywords = cleanBibtexText(entry.fields.keywords || entry.fields.keyword || "");
      const doi = cleanDoi(entry.fields.doi || extractDoiFromTextOrUrl(entry.raw || ""));

      const sourceUrl =
        String(entry.fields.url || "").trim() ||
        (doi ? `https://doi.org/${doi}` : "") ||
        extractFirstUrl(entry.raw || "");

      const pdfLink =
        String(entry.fields.pdf || entry.fields.file || "").trim() ||
        extractDoiOrPdfLink(entry.raw || "");

      const fingerprint = doi || sourceUrl || `${title}:${authors}:${journal}:${year}`;
      const postId = "bibtex_" + await sha256Hex(fingerprint);

      const adminText = [
        title,
        authors,
        journal,
        year,
        abstract,
        keywords,
        doi,
        sourceUrl,
        pdfLink
      ].filter(Boolean).join("\n");

      const fetchedArticle = await fetchArticleKnowledgeText({
        title,
        sourceUrl,
        pdfLink,
        adminText,
        includeAdminFallback: false
      });

      const hasExternalEvidence = containsExternalArticleData(fetchedArticle);
      const hasAdminAbstract = abstract.length >= 80;

      const content = [
        `Paper_Talk DB Research Paper`,
        `Reindex checked version: v22`,
        `Imported source: LinkedIn/BibTeX`,
        `BibTeX parsed import: true`,
        `Title: ${title}`,
        doi ? `DOI: ${doi}` : "",
        hasExternalEvidence
          ? `External article learning status: found`
          : hasAdminAbstract
            ? `External article learning status: admin_abstract_found`
            : `External article learning status: not_found`,
        authors ? `Authors: ${authors}` : "",
        journal ? `Journal: ${journal}` : "",
        year ? `Year: ${year}` : "",
        keywords ? `Keywords: ${keywords}` : "",
        hasAdminAbstract ? `Paper_Talk admin-curated knowledge:\nAdmin-curated abstract:\n${abstract}` : "",
        hasExternalEvidence ? `DOI / title / article-link learned text:\n${fetchedArticle}` : "",
        !hasExternalEvidence && hasAdminAbstract
          ? `DOI / title lookup note: No external abstract was found, so Paper_Talk uses the BibTeX/admin abstract as the primary evidence.`
          : "",
        !hasExternalEvidence && !hasAdminAbstract
          ? `Clean title-only fallback: No external abstract was found from DOI/title APIs. This row can still be used as a bibliographic hit, but should not be treated as abstract/full-text evidence.`
          : "",
        sourceUrl ? `Article link: ${sourceUrl}` : "",
        pdfLink ? `PDF link: ${pdfLink}` : "",
        `Clean imported source text:\n${buildCleanBibtexSourceText(entry)}`
      ].filter(Boolean).join("\n\n");

      await env.DB.prepare(`
        INSERT INTO research_knowledge (
          id,
          post_id,
          title,
          source_url,
          pdf_link,
          content,
          status,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'indexed', CURRENT_TIMESTAMP)
        ON CONFLICT(post_id) DO UPDATE SET
          title = excluded.title,
          source_url = excluded.source_url,
          pdf_link = excluded.pdf_link,
          content = excluded.content,
          status = 'indexed',
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        crypto.randomUUID(),
        postId,
        title,
        sourceUrl || "",
        pdfLink || "",
        content
      ).run();

      await upsertResearchKnowledgeVectors({
        postId,
        title,
        sourceUrl: sourceUrl || "",
        pdfLink: pdfLink || "",
        content
      }, env);

      imported++;
      await sleep(50);
    } catch (error) {
      skipped++;
      errors.push(error?.message || "Unknown BibTeX import error");
    }
  }

  return json({
    ok: true,
    imported,
    skipped,
    sourceType: "bibtex",
    errors: errors.slice(0, 10),
    message: `Imported ${imported} BibTeX papers. Skipped: ${skipped}`
  });
}

function looksLikeBibtex(text) {
  return /@(?:article|book|inproceedings|proceedings|misc|preprint|dataset|phdthesis|mastersthesis)\s*\{/i.test(String(text || ""));
}

function parseBibtexEntries(bibText) {
  const text = String(bibText || "").replace(/^\uFEFF/, "");
  const entries = [];
  let i = 0;

  while (i < text.length) {
    const relativeAt = text.slice(i).search(/@[A-Za-z]+\s*\{/);
    if (relativeAt < 0) break;

    const start = i + relativeAt;
    const open = text.indexOf("{", start);
    if (open < 0) break;

    let depth = 0;
    let inQuote = false;
    let escaped = false;
    let end = -1;

    for (let j = open; j < text.length; j++) {
      const ch = text[j];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === '"' && depth > 0) {
        inQuote = !inQuote;
      }

      if (!inQuote) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;

        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end < 0) break;

    const raw = text.slice(start, end + 1);
    const typeMatch = raw.match(/^@([A-Za-z]+)\s*\{/);
    const body = raw.slice(raw.indexOf("{") + 1, -1);
    const comma = body.indexOf(",");
    const key = comma >= 0 ? body.slice(0, comma).trim() : "";
    const fieldsText = comma >= 0 ? body.slice(comma + 1) : body;

    entries.push({
      raw,
      type: typeMatch ? typeMatch[1].toLowerCase() : "",
      key,
      fields: parseBibtexFields(fieldsText)
    });

    i = end + 1;
  }

  return entries;
}

function parseBibtexFields(fieldsText) {
  const fields = {};
  const text = String(fieldsText || "");
  let i = 0;

  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++;

    const nameMatch = text.slice(i).match(/^([A-Za-z][A-Za-z0-9_\-]*)\s*=/);
    if (!nameMatch) {
      i++;
      continue;
    }

    const name = nameMatch[1].toLowerCase();
    i += nameMatch[0].length;

    while (i < text.length && /\s/.test(text[i])) i++;

    let value = "";

    if (text[i] === "{") {
      const parsed = readBalancedBibtexValue(text, i, "{", "}");
      value = parsed.value;
      i = parsed.end + 1;
    } else if (text[i] === '"') {
      const parsed = readBalancedBibtexValue(text, i, '"', '"');
      value = parsed.value;
      i = parsed.end + 1;
    } else {
      const start = i;
      while (i < text.length && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") i++;
      value = text.slice(start, i).trim();
    }

    fields[name] = cleanBibtexText(value);
  }

  return fields;
}

function readBalancedBibtexValue(text, start, openChar, closeChar) {
  let i = start + 1;
  let depth = openChar === "{" ? 1 : 0;
  let escaped = false;
  let value = "";

  for (; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      value += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (openChar === "{") {
      if (ch === "{") {
        depth++;
        value += ch;
        continue;
      }

      if (ch === "}") {
        depth--;
        if (depth === 0) break;
        value += ch;
        continue;
      }

      value += ch;
      continue;
    }

    if (ch === closeChar) break;
    value += ch;
  }

  return {
    value,
    end: i
  };
}

function buildCleanBibtexSourceText(entry) {
  const f = entry?.fields || {};
  return [
    f.title ? `Title: ${cleanBibtexText(f.title)}` : "",
    f.author ? `Authors: ${cleanBibtexText(f.author)}` : "",
    f.journal || f.booktitle ? `Journal: ${cleanBibtexText(f.journal || f.booktitle)}` : "",
    f.year ? `Year: ${cleanBibtexText(f.year)}` : "",
    f.doi ? `DOI: ${cleanDoi(f.doi)}` : "",
    f.url ? `URL: ${String(f.url).trim()}` : "",
    f.abstract ? `Abstract: ${cleanBibtexText(f.abstract)}` : "",
    f.keywords || f.keyword ? `Keywords: ${cleanBibtexText(f.keywords || f.keyword)}` : ""
  ].filter(Boolean).join("\n").slice(0, 8000);
}


function parseCsv(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  rows.push(row);

  const nonEmptyRows = rows.filter(r =>
    r.some(cell => String(cell || "").trim())
  );

  if (nonEmptyRows.length < 2) return [];

  const headers = nonEmptyRows[0].map(h => String(h || "").trim());

  return nonEmptyRows.slice(1).map(cells => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header || `column_${index}`] = String(cells[index] || "").trim();
    });
    return obj;
  });
}

function normalizeLinkedInRow(row) {
  const keys = Object.keys(row || {});
  const lowerMap = {};

  for (const key of keys) {
    lowerMap[key.toLowerCase().replace(/[\s_\-]/g, "")] = key;
  }

  function pick(possibleNames) {
    for (const name of possibleNames) {
      const normalized = name.toLowerCase().replace(/[\s_\-]/g, "");
      const realKey = lowerMap[normalized];

      if (realKey && String(row[realKey] || "").trim()) {
        return String(row[realKey]).trim();
      }
    }

    return "";
  }

  const commentary = pick([
    "ShareCommentary",
    "Share Commentary",
    "Commentary",
    "Text",
    "Content",
    "Post",
    "Post Text",
    "Update Text",
    "Body",
    "Description"
  ]);

  const title = pick([
    "Title",
    "Article Title",
    "Post Title",
    "Headline"
  ]);

  const date = pick([
    "Date",
    "Created Date",
    "Creation Date",
    "Created At",
    "Time"
  ]);

  const sourceUrl = pick([
    "ShareLink",
    "Share Link",
    "URL",
    "Url",
    "Post URL",
    "Post Url",
    "Link",
    "Permalink"
  ]) || extractFirstUrl(commentary);

  const pdfLink = extractDoiOrPdfLink(commentary + "\n" + sourceUrl);

  const allText = keys
    .map(key => String(row[key] || "").trim())
    .filter(Boolean)
    .join("\n");

  const content = commentary || allText;

  return {
    title: title || makeTitleFromText(content),
    date,
    sourceUrl,
    pdfLink,
    content
  };
}

function makeTitleFromText(text) {
  const cleaned = String(text || "")
    .replace(/https?:\/\/\S+/g, "")
    .split(/\n+/)
    .map(v => v.trim())
    .filter(Boolean)[0] || "LinkedIn research post";

  return cleaned.length > 120 ? cleaned.slice(0, 117) + "..." : cleaned;
}

function extractFirstUrl(text) {
  const match = String(text || "").match(/https?:\/\/[^\s)"'>]+/);
  return match ? match[0] : "";
}

function extractDoiOrPdfLink(text) {
  const value = String(text || "");

  const doiUrl = value.match(/https?:\/\/(dx\.)?doi\.org\/[^\s)"'>]+/i);
  if (doiUrl) return doiUrl[0];

  const doi = value.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  if (doi) return `https://doi.org/${doi[0]}`;

  const pdf = value.match(/https?:\/\/[^\s)"'>]+\.pdf\b[^\s)"'>]*/i);
  if (pdf) return pdf[0];

  return "";
}

async function sha256Hex(value) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value || ""))
  );

  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function adminReindexResearchPapers(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const batchLimit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 50);
  const reindexMarker = "Reindex checked version: v22";

  let indexed = 0;
  let legacyIndexed = 0;
  let failed = 0;
  const errors = [];

  // v17:
  // Reindex in small batches. A single Cloudflare Worker invocation has a limited
  // number of subrequests. DOI/title learning may call Crossref, Europe PMC,
  // Semantic Scholar, or OpenAlex, so processing hundreds of papers in one click
  // causes "Too many subrequests".
  //
  // Repeated clicks continue because already-processed rows contain the v17 marker.

  const posts = await env.DB.prepare(`
    SELECT p.*
    FROM posts p
    LEFT JOIN research_knowledge rk ON rk.post_id = p.id
    WHERE p.section = 'research'
      AND p.type = 'paper'
      AND p.status = 'published'
      AND (
        rk.post_id IS NULL
        OR rk.content IS NULL
        OR rk.content NOT LIKE ?
      )
    ORDER BY datetime(p.created_at) ASC
    LIMIT ?
  `).bind(`%${reindexMarker}%`, batchLimit).all();

  for (const post of posts.results || []) {
    try {
      await indexResearchPaperPost(post, env);
      indexed++;
      await sleep(50);
    } catch (error) {
      failed++;
      errors.push({
        id: post.id,
        title: post.title,
        source: "posts",
        error: error?.message || "Unknown error"
      });
    }
  }

  const legacyRows = await env.DB.prepare(`
    SELECT id, post_id, title, source_url, pdf_link, content
    FROM research_knowledge
    WHERE status = 'indexed'
      AND content NOT LIKE ?
      AND (
        post_id LIKE 'linkedin_%'
        OR content LIKE '%Source: LinkedIn post%'
        OR content LIKE '%title = {%'
        OR content LIKE '%title={%'
        OR content LIKE '%Imported source: LinkedIn/BibTeX%'
      )
    ORDER BY datetime(updated_at) ASC
    LIMIT ?
  `).bind(`%${reindexMarker}%`, batchLimit).all();

  for (const row of legacyRows.results || []) {
    try {
      const didUpdate = await reindexLegacyLinkedInOrBibtexKnowledgeRow(row, env);
      if (didUpdate) legacyIndexed++;
      await sleep(50);
    } catch (error) {
      failed++;
      errors.push({
        id: row.id,
        postId: row.post_id,
        title: row.title,
        source: "legacy_research_knowledge",
        error: error?.message || "Unknown error"
      });
    }
  }

  const remainingPosts = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM posts p
    LEFT JOIN research_knowledge rk ON rk.post_id = p.id
    WHERE p.section = 'research'
      AND p.type = 'paper'
      AND p.status = 'published'
      AND (
        rk.post_id IS NULL
        OR rk.content IS NULL
        OR rk.content NOT LIKE ?
      )
  `).bind(`%${reindexMarker}%`).first();

  const remainingLegacy = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM research_knowledge
    WHERE status = 'indexed'
      AND content NOT LIKE ?
      AND (
        post_id LIKE 'linkedin_%'
        OR content LIKE '%Source: LinkedIn post%'
        OR content LIKE '%title = {%'
        OR content LIKE '%title={%'
        OR content LIKE '%Imported source: LinkedIn/BibTeX%'
      )
  `).bind(`%${reindexMarker}%`).first();

  const remaining =
    Number(remainingPosts?.total || 0) +
    Number(remainingLegacy?.total || 0);

  return json({
    ok: true,
    batchLimit,
    indexed,
    legacyIndexed,
    failed,
    remaining,
    remainingPosts: Number(remainingPosts?.total || 0),
    remainingLegacy: Number(remainingLegacy?.total || 0),
    errors: errors.slice(0, 20),
    message: remaining > 0
      ? `Batch reindex complete. Reindexed ${indexed} research papers and ${legacyIndexed} LinkedIn/BibTeX rows. Remaining: ${remaining}. Frontend can auto-continue until Remaining becomes 0. Failed: ${failed}`
      : `Reindex complete. Reindexed ${indexed} research papers and ${legacyIndexed} LinkedIn/BibTeX rows. Failed: ${failed}`
  });
}


async function reindexLegacyLinkedInOrBibtexKnowledgeRow(row, env) {
  const rowId = String(row?.id || "").trim();
  const postId = String(row?.post_id || rowId || crypto.randomUUID()).trim();

  const rawTitle = String(row?.title || "");
  const rawContent = String(row?.content || "");

  const extractedTitle =
    extractTitleFromKnowledgeContent(rawContent) ||
    extractTitleFromKnowledgeContent(rawTitle) ||
    rawTitle;

  const safeTitle = cleanBibtexText(extractedTitle || "").trim();

  if (!safeTitle || isMetadataOnlyTitle(safeTitle)) {
    return false;
  }

  // v15 important fix:
  // Never feed a previously reindexed content blob back into the next reindex.
  // Older versions kept nesting "Original imported content" inside itself.
  const cleanLegacySource = buildCleanLegacySourceText({
    title: safeTitle,
    content: rawContent,
    sourceUrl: row?.source_url || "",
    pdfLink: row?.pdf_link || ""
  });

  const sourceUrl = String(
    row?.source_url ||
    extractFirstUrl(cleanLegacySource) ||
    extractFirstUrl(rawContent) ||
    ""
  ).trim();

  const pdfLink = String(
    row?.pdf_link ||
    extractDoiOrPdfLink(cleanLegacySource + "\n" + rawContent + "\n" + sourceUrl) ||
    ""
  ).trim();

  const adminText = [
    `Legacy LinkedIn/BibTeX title-only Paper_Talk row`,
    `Title: ${safeTitle}`,
    sourceUrl ? `Source URL: ${sourceUrl}` : "",
    pdfLink ? `PDF/DOI Link: ${pdfLink}` : ""
  ].filter(Boolean).join("\n");

  const fetchedArticle = await fetchArticleKnowledgeText({
    title: safeTitle,
    sourceUrl,
    pdfLink,
    adminText,
    includeAdminFallback: false
  });

  const hasExternalEvidence = containsExternalArticleData(fetchedArticle);
  const doi = extractDoiFromTextOrUrl([safeTitle, sourceUrl, pdfLink, cleanLegacySource, fetchedArticle].join("\n"));

  const learnedContent = [
    `Paper_Talk DB Research Paper`,
    `Reindex checked version: v22`,
    `Imported source: LinkedIn/BibTeX`,
    `Title: ${safeTitle}`,
    doi ? `DOI: ${doi}` : "",
    hasExternalEvidence ? `External article learning status: found` : `External article learning status: not_found`,
    hasExternalEvidence ? `DOI / title / article-link learned text: ${fetchedArticle}` : "",
    !hasExternalEvidence ? `Clean title-only fallback: No external abstract was found from DOI/title APIs. This row can still be used as a bibliographic hit, but should not be treated as abstract/full-text evidence.` : "",
    cleanLegacySource ? `Clean imported source text: ${cleanLegacySource}` : "",
    sourceUrl ? `Article link: ${sourceUrl}` : "",
    pdfLink ? `PDF link: ${pdfLink}` : ""
  ].filter(Boolean).join("\n\n");

  if (rowId) {
    await env.DB.prepare(`
      UPDATE research_knowledge
      SET title = ?,
          source_url = ?,
          pdf_link = ?,
          content = ?,
          status = 'indexed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      safeTitle,
      sourceUrl,
      pdfLink,
      learnedContent,
      rowId
    ).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO research_knowledge (
        id,
        post_id,
        title,
        source_url,
        pdf_link,
        content,
        status,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'indexed', CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      postId,
      safeTitle,
      sourceUrl,
      pdfLink,
      learnedContent
    ).run();
  }

  await upsertResearchKnowledgeVectors({
    postId,
    title: safeTitle,
    sourceUrl,
    pdfLink,
    content: learnedContent
  }, env);

  return true;
}

async function adminCreateStudyPost(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "").trim();

  if (!title) {
    return json({ ok: false, error: "Title is required." }, 400);
  }

  const studyData = {
    category: data.category || "",
    tags: data.tags || "",
    body: data.body || "",
    note: data.note || "",
    link: data.link || ""
  };

  await env.DB.prepare(`
    INSERT INTO posts (
      id,
      section,
      type,
      title,
      body,
      link,
      author_name,
      author_email,
      linkedin_url,
      status
    )
    VALUES (?, 'study', 'study', ?, ?, ?, 'Admin', '', '', 'published')
  `).bind(
    crypto.randomUUID(),
    title,
    JSON.stringify(studyData),
    data.link || ""
  ).run();

  return json({
    ok: true,
    message: "Study material saved."
  });
}

async function adminSaveMethodologyPage(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "").trim();

  if (!title) {
    return json({ ok: false, error: "Title is required." }, 400);
  }

  const methodologyData = {
    category: data.category || "",
    tags: data.tags || "",
    body: data.body || "",
    note: data.note || "",
    link: data.link || ""
  };

  await env.DB.prepare(`
    INSERT INTO posts (
      id,
      section,
      type,
      title,
      body,
      link,
      author_name,
      author_email,
      linkedin_url,
      status
    )
    VALUES (?, 'study', 'methodology_page', ?, ?, ?, 'Admin', '', '', 'published')
  `).bind(
    crypto.randomUUID(),
    title,
    JSON.stringify(methodologyData),
    data.link || ""
  ).run();

  return json({
    ok: true,
    message: "Methodology post saved."
  });
}

async function adminCreateBlogPost(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "").trim();

  if (!title) {
    return json({ ok: false, error: "Title is required." }, 400);
  }

  const blogData = {
    websiteName: data.websiteName || "",
    author: data.author || "",
    summary: data.summary || "",
    tags: data.tags || "",
    note: data.note || ""
  };

  await env.DB.prepare(`
    INSERT INTO posts (
      id,
      section,
      type,
      title,
      body,
      link,
      author_name,
      author_email,
      linkedin_url,
      status
    )
    VALUES (?, 'study', 'blog', ?, ?, ?, 'Admin', '', '', 'published')
  `).bind(
    crypto.randomUUID(),
    title,
    JSON.stringify(blogData),
    data.sourceUrl || ""
  ).run();

  return json({
    ok: true,
    message: "Blog post saved."
  });
}

/* =========================
   Paper_Talk GPT Functions
========================= */

async function indexResearchPaperPost(post, env) {
  let researchData = {};

  try {
    researchData = JSON.parse(post.body || "{}");
  } catch {
    researchData = {};
  }

  return indexResearchPaperData({
    postId: post.id,
    title: post.title,
    sourceUrl: post.link || "",
    pdfLink: researchData.pdfLink || "",
    researchData
  }, env);
}

async function indexResearchPaperData({ postId, title, sourceUrl, pdfLink, researchData }, env) {
  const safeTitle = String(title || "").trim();
  const safeSourceUrl = String(sourceUrl || "").trim();
  const safePdfLink = String(pdfLink || "").trim();

  const adminAbstract = String(researchData?.abstract || "").trim();
  const adminDescription = String(researchData?.description || "").trim();
  const adminNote = String(researchData?.note || "").trim();
  const adminAuthors = String(researchData?.authors || "").trim();
  const adminJournal = String(researchData?.journal || "").trim();
  const adminYear = String(researchData?.year || "").trim();
  const adminCategory = String(researchData?.category || "").trim();
  const adminTags = String(researchData?.tags || "").trim();

  const hasAdminAbstract = adminAbstract.length >= 80;
  const hasAdminCuratedText =
    hasAdminAbstract ||
    adminDescription.length >= 80 ||
    adminNote.length >= 80;

  const adminText = [
    safeTitle,
    adminYear,
    adminAuthors,
    adminJournal,
    adminCategory,
    adminTags,
    adminAbstract,
    adminDescription,
    adminNote,
    safeSourceUrl,
    safePdfLink
  ].filter(Boolean).join("\n");

  const fetchedArticle = await fetchArticleKnowledgeText({
    title: safeTitle,
    sourceUrl: safeSourceUrl,
    pdfLink: safePdfLink,
    adminText,
    includeAdminFallback: false
  });

  const hasExternalEvidence = containsExternalArticleData(fetchedArticle);

  const doi = extractDoiFromTextOrUrl([
    safeTitle,
    safeSourceUrl,
    safePdfLink,
    adminText,
    fetchedArticle
  ].join("\n"));

  // v20:
  // Admin-entered abstract/description/note must be treated as trusted Paper_Talk DB knowledge.
  // DOI/title lookup is useful, but it must not be required. If DOI lookup fails, the manually
  // saved abstract is still indexed and used by GPT.
  const adminCuratedKnowledge = [
    hasAdminAbstract ? `Admin-curated abstract:\n${adminAbstract}` : "",
    !hasAdminAbstract && adminDescription ? `Admin-curated description:\n${adminDescription}` : "",
    adminNote ? `Admin-curated note:\n${adminNote}` : ""
  ].filter(Boolean).join("\n\n");

  const knowledgeSource = hasExternalEvidence && hasAdminCuratedText
    ? "Admin Abstract + External DOI/Title Metadata"
    : hasExternalEvidence
      ? "External DOI/Title Metadata"
      : hasAdminCuratedText
        ? "Admin Abstract"
        : "Basic Admin Metadata";

  const learningStatus = hasExternalEvidence
    ? "external_found"
    : hasAdminCuratedText
      ? "admin_abstract_found"
      : "metadata_only";

  const content = [
    `Paper_Talk DB Research Paper`,
    `Reindex checked version: v22`,
    `Title: ${safeTitle}`,
    `Knowledge source: ${knowledgeSource}`,
    `External article learning status: ${learningStatus}`,
    doi ? `DOI: ${doi}` : "",
    adminYear ? `Year: ${adminYear}` : "",
    adminAuthors ? `Authors: ${adminAuthors}` : "",
    adminJournal ? `Journal: ${adminJournal}` : "",
    adminCategory ? `Category: ${adminCategory}` : "",
    adminTags ? `Tags: ${adminTags}` : "",
    adminCuratedKnowledge ? `Paper_Talk admin-curated knowledge:\n${adminCuratedKnowledge}` : "",
    hasExternalEvidence ? `DOI / article-link learned text:\n${fetchedArticle}` : "",
    !hasExternalEvidence && hasAdminCuratedText
      ? `DOI / title lookup note: No external abstract was found, so Paper_Talk uses the admin-entered abstract/description/note as the primary evidence.`
      : "",
    !hasExternalEvidence && !hasAdminCuratedText
      ? `Evidence note: No external abstract and no admin abstract were available. Use this row only as bibliographic metadata.`
      : "",
    researchData?.figures ? `Figures: ${researchData.figures}` : "",
    safeSourceUrl ? `Article link: ${safeSourceUrl}` : "",
    safePdfLink ? `PDF link: ${safePdfLink}` : ""
  ].filter(Boolean).join("\n\n");

  await env.DB.prepare(`
    INSERT INTO research_knowledge (
      id,
      post_id,
      title,
      source_url,
      pdf_link,
      content,
      status,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'indexed', CURRENT_TIMESTAMP)
    ON CONFLICT(post_id) DO UPDATE SET
      title = excluded.title,
      source_url = excluded.source_url,
      pdf_link = excluded.pdf_link,
      content = excluded.content,
      status = 'indexed',
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    crypto.randomUUID(),
    postId,
    safeTitle,
    safeSourceUrl,
    safePdfLink,
    content
  ).run();

  await upsertResearchKnowledgeVectors({
    postId,
    title: safeTitle,
    sourceUrl: safeSourceUrl,
    pdfLink: safePdfLink,
    content
  }, env);

  return true;
}

async function fetchArticleKnowledgeText({ title, sourceUrl, pdfLink, adminText = "", includeAdminFallback = true }) {
  const normalizedTitle = cleanFetchedArticleText(title || "");

  const allText = [
    title || "",
    sourceUrl || "",
    pdfLink || "",
    adminText || ""
  ].join("\n");

  const doi = extractDoiFromTextOrUrl(allText);

  const urls = [sourceUrl, pdfLink]
    .map(v => String(v || "").trim())
    .filter(Boolean)
    .slice(0, 1);

  const collected = [];

  async function tryAdd(label, fn) {
    if (collected.length > 0) return true;

    try {
      const value = await fn();
      if (value && containsExternalArticleData(value)) {
        collected.push(value);
        return true;
      }
    } catch (error) {
      // Do not store lookup errors in research_knowledge.
      // Otherwise the DB becomes noisy and repeated reindexing embeds failure text.
    }

    await sleep(80);
    return false;
  }

  // v17 subrequest-safe rule:
  // Query external scholarly APIs sequentially and stop immediately after
  // the first useful external metadata/abstract source is found.
  // This prevents Cloudflare "Too many subrequests" during batch reindex.

  if (doi) {
    if (await tryAdd(`Crossref DOI lookup for ${doi}`, () =>
      fetchCrossrefKnowledge({ doi, title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`PubMed DOI lookup for ${doi}`, () =>
      fetchPubMedKnowledge({ doi, title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`Europe PMC DOI lookup for ${doi}`, () =>
      fetchEuropePmcKnowledge({ doi, title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`Semantic Scholar DOI lookup for ${doi}`, () =>
      fetchSemanticScholarKnowledge({ doi, title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`OpenAlex DOI lookup for ${doi}`, () =>
      fetchOpenAlexKnowledge({ doi, title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);
  }

  if (normalizedTitle) {
    if (await tryAdd(`Crossref title lookup for ${normalizedTitle}`, () =>
      fetchCrossrefKnowledge({ doi: "", title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`PubMed title lookup for ${normalizedTitle}`, () =>
      fetchPubMedKnowledge({ doi: "", title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`Europe PMC title lookup for ${normalizedTitle}`, () =>
      fetchEuropePmcKnowledge({ doi: "", title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`Semantic Scholar title lookup for ${normalizedTitle}`, () =>
      fetchSemanticScholarKnowledge({ doi: "", title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);

    if (await tryAdd(`OpenAlex title lookup for ${normalizedTitle}`, () =>
      fetchOpenAlexKnowledge({ doi: "", title: normalizedTitle })
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);
  }

  for (const url of urls) {
    if (await tryAdd(`Direct article-link fetch for ${url}`, () =>
      fetchReadableArticleText(url, normalizedTitle)
    )) return cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n")).slice(0, 52000);
  }

  if (includeAdminFallback && adminText) {
    collected.push(`Admin-provided research metadata, abstract, description, and note fallback:\n${adminText}`);
  }

  const finalText = cleanFetchedArticleText(dedupeTextBlocks(collected).join("\n\n"));
  return finalText.slice(0, 52000);
}

function dedupeTextBlocks(items) {
  const seen = new Set();
  const output = [];

  for (const item of items || []) {
    const cleaned = cleanFetchedArticleText(item || "");
    if (!cleaned) continue;

    const key = cleaned.toLowerCase().slice(0, 500);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }

  return output;
}

function containsExternalArticleData(value) {
  const text = String(value || "");
  if (!text.trim()) return false;

  // These labels are produced only by public scholarly APIs / direct article fetchers,
  // not by the admin fallback. This prevents fallback-only content from being treated
  // as learned abstract evidence.
  return /Crossref metadata from DOI\/title search:/i.test(text) ||
    /PubMed article data from DOI\/title search:/i.test(text) ||
    /Europe PMC \/ PubMed-indexed article data:/i.test(text) ||
    /Semantic Scholar article data from DOI\/title search:/i.test(text) ||
    /OpenAlex article data from DOI\/title search:/i.test(text) ||
    /Abstract section from source link:/i.test(text) ||
    /Direct source-link page text:/i.test(text) ||
    /PMC full text extracted sections:/i.test(text) ||
    /Abstract:\s*.{80,}/i.test(text);
}

function buildCleanLegacySourceText({ title, content, sourceUrl, pdfLink }) {
  const safeTitle = cleanBibtexText(title || "");
  const raw = String(content || "");

  const usefulLines = [];
  if (safeTitle) usefulLines.push(`Title: ${safeTitle}`);

  // Keep explicit identifiers/links from the original import, but drop previous reindex output.
  const lines = raw
    .split(/\n+/)
    .map(line => cleanBibtexText(line))
    .filter(Boolean);

  for (const line of lines) {
    if (/^(Paper_Talk DB Research Paper|Imported source:|DOI \/ title \/ article-link learned text:|Admin-provided research metadata|Legacy LinkedIn\/BibTeX|Original imported content|Original imported content fallback|Clean title-only fallback|External article learning status|Clean imported source text)/i.test(line)) {
      continue;
    }
    if (/^Title:\s*/i.test(line)) {
      const t = cleanBibtexText(line.replace(/^Title:\s*/i, ""));
      if (t && t.toLowerCase() !== safeTitle.toLowerCase()) usefulLines.push(`Alternative title: ${t}`);
      continue;
    }
    if (/^(Source: LinkedIn post|LinkedIn URL:|Date:|DOI:|PMID:|PMCID:|arXiv:|URL:|Article link:|PDF link:)/i.test(line)) {
      usefulLines.push(line);
      continue;
    }
    if (/https?:\/\/|\b10\.\d{4,9}\//i.test(line)) {
      usefulLines.push(line);
      continue;
    }
  }

  if (sourceUrl) usefulLines.push(`Source URL: ${sourceUrl}`);
  if (pdfLink) usefulLines.push(`PDF/DOI Link: ${pdfLink}`);

  return dedupeTextBlocks(usefulLines).join("\n").slice(0, 4000);
}


function normalizeTitleForMatching(value) {
  return normalizeSearchText(
    String(value || "")
      .replace(/^title\s*=\s*/i, "")
      .replace(/[{}]/g, " ")
      .replace(/\b(article|paper|preprint|protocol|review)\b/gi, " ")
  );
}

function titleTokenSet(value) {
  const stop = new Set([
    "the", "and", "for", "with", "from", "into", "using", "based", "study",
    "analysis", "single", "cell", "cells", "rna", "seq", "sequencing"
  ]);

  return normalizeTitleForMatching(value)
    .split(/\s+/)
    .map(v => v.trim())
    .filter(v => v.length >= 3 && !stop.has(v));
}

function titleSimilarityScore(a, b) {
  const aNorm = normalizeTitleForMatching(a);
  const bNorm = normalizeTitleForMatching(b);

  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.92;

  const aTokens = new Set(titleTokenSet(aNorm));
  const bTokens = new Set(titleTokenSet(bNorm));

  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }

  const precision = overlap / aTokens.size;
  const recall = overlap / bTokens.size;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return f1;
}

function bestCandidateByTitle(items, wantedTitle, getTitle) {
  const candidates = Array.isArray(items) ? items : [];
  let best = null;
  let bestScore = 0;

  for (const item of candidates) {
    const itemTitle = getTitle(item);
    const score = titleSimilarityScore(wantedTitle, itemTitle);

    const hasAbstract =
      Boolean(item?.abstract || item?.abstractText || item?.abstract_inverted_index);

    const adjustedScore = score + (hasAbstract ? 0.08 : 0);

    if (adjustedScore > bestScore) {
      best = item;
      bestScore = adjustedScore;
    }
  }

  // Use a moderate threshold because many imported BibTeX/LinkedIn titles are slightly normalized.
  if (best && bestScore >= 0.38) return best;

  // If no fuzzy match passes, prefer a result with an abstract, otherwise the first result.
  return candidates.find(item => item?.abstract || item?.abstractText) || candidates[0] || null;
}

function getCrossrefItemTitle(item) {
  return Array.isArray(item?.title) ? item.title.join(" ") : String(item?.title || "");
}

function buildTitleSearchVariants(title) {
  const clean = cleanBibtexText(title || "");
  const normalized = normalizeTitleForMatching(clean);

  const tokens = normalized
    .split(/\s+/)
    .filter(v => v.length >= 4);

  const variants = [
    clean,
    normalized,
    tokens.slice(0, 8).join(" "),
    tokens.filter(v => !["single", "cell", "cells", "using", "based"].includes(v)).slice(0, 8).join(" ")
  ];

  return [...new Set(variants.map(v => cleanFetchedArticleText(v)).filter(v => v.length >= 6))].slice(0, 2);
}

async function fetchCrossrefKnowledge({ doi, title }) {
  const wantedTitle = cleanBibtexText(title || "");
  let item = null;

  if (doi) {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const data = await fetchJsonWithTimeout(url, 20000);
    item = data?.message || null;
  } else if (wantedTitle) {
    const variants = buildTitleSearchVariants(wantedTitle);

    for (const variant of variants) {
      const url =
        `https://api.crossref.org/works?rows=10&query.title=${encodeURIComponent(variant)}&select=DOI,title,author,container-title,published-print,published-online,published,URL,abstract,type`;

      const data = await fetchJsonWithTimeout(url, 20000);
      const items = data?.message?.items || [];

      item = bestCandidateByTitle(items, wantedTitle, getCrossrefItemTitle);

      if (item) break;
    }
  } else {
    return "";
  }

  if (!item) return "";

  const titleText = getCrossrefItemTitle(item);
  const abstract = item.abstract ? cleanCrossrefAbstract(item.abstract) : "";
  const container = Array.isArray(item["container-title"]) ? item["container-title"].join(" ") : "";
  const published =
    item.published?.["date-parts"]?.[0]?.join("-") ||
    item["published-print"]?.["date-parts"]?.[0]?.join("-") ||
    item["published-online"]?.["date-parts"]?.[0]?.join("-") ||
    "";
  const authors = Array.isArray(item.author)
    ? item.author.slice(0, 20).map(a => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", ")
    : "";
  const doiText = item.DOI || doi || "";
  const urlText = item.URL || "";
  const matchScore = wantedTitle ? titleSimilarityScore(wantedTitle, titleText).toFixed(2) : "1.00";

  const pieces = [
    "Crossref metadata from DOI/title search:",
    titleText ? `Title: ${titleText}` : "",
    wantedTitle ? `Title match score: ${matchScore}` : "",
    authors ? `Authors: ${authors}` : "",
    container ? `Journal: ${container}` : "",
    published ? `Published: ${published}` : "",
    doiText ? `DOI: ${doiText}` : "",
    urlText ? `URL: ${urlText}` : "",
    abstract ? `Abstract: ${abstract}` : ""
  ].filter(Boolean);

  return pieces.join("\n");
}


async function fetchPubMedKnowledge({ doi, title }) {
  const wantedTitle = cleanBibtexText(title || "");
  const searchTerms = [];

  if (doi) {
    searchTerms.push(`${doi}[DOI]`);
  }

  for (const variant of buildTitleSearchVariants(wantedTitle)) {
    searchTerms.push(`"${variant.replace(/"/g, " ")}"[Title]`);
    searchTerms.push(variant.replace(/"/g, " "));
  }

  for (const term of searchTerms.filter(Boolean)) {
    const searchUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=10&term=${encodeURIComponent(term)}`;

    const searchData = await fetchJsonWithTimeout(searchUrl, 20000);
    const ids = searchData?.esearchresult?.idlist || [];
    if (!ids.length) continue;

    const summaryUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${encodeURIComponent(ids.join(","))}`;

    const summaryData = await fetchJsonWithTimeout(summaryUrl, 20000);
    const resultMap = summaryData?.result || {};
    const summaries = ids
      .map(id => resultMap[id])
      .filter(Boolean);

    const summary = bestCandidateByTitle(
      summaries,
      wantedTitle,
      item => String(item?.title || "")
    );

    if (!summary) continue;

    const pmid = String(summary.uid || summary.articleids?.find(x => x.idtype === "pubmed")?.value || "").trim();
    if (!pmid) continue;

    const abstractUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${encodeURIComponent(pmid)}`;

    const xml = await fetchTextWithTimeout(abstractUrl, 20000);
    const abstractParts = [...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi)]
      .map(match => stripHtmlEntities(match[1]).replace(/<[^>]+>/g, " "))
      .map(v => cleanFetchedArticleText(v))
      .filter(Boolean);

    const articleTitle =
      cleanFetchedArticleText(
        stripHtmlEntities(
          (xml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i) || [])[1] || summary.title || ""
        ).replace(/<[^>]+>/g, " ")
      );

    const journal =
      cleanFetchedArticleText(
        stripHtmlEntities(
          (xml.match(/<Title>([\s\S]*?)<\/Title>/i) || [])[1] || summary.fulljournalname || summary.source || ""
        ).replace(/<[^>]+>/g, " ")
      );

    const year =
      (xml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>[\s\S]*?<\/PubDate>/i) || [])[1] ||
      String(summary.pubdate || "").match(/\d{4}/)?.[0] ||
      "";

    const doiText =
      cleanDoi(
        stripHtmlEntities(
          (xml.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/i) || [])[1] || doi || ""
        )
      );

    const authors = Array.isArray(summary.authors)
      ? summary.authors.slice(0, 20).map(a => a.name).filter(Boolean).join(", ")
      : "";

    const titleForScore = articleTitle || summary.title || "";
    const matchScore = wantedTitle ? titleSimilarityScore(wantedTitle, titleForScore).toFixed(2) : "1.00";
    const abstract = abstractParts.join(" ");

    const pieces = [
      "PubMed article data from DOI/title search:",
      titleForScore ? `Title: ${titleForScore}` : "",
      wantedTitle ? `Title match score: ${matchScore}` : "",
      authors ? `Authors: ${authors}` : "",
      journal ? `Journal: ${journal}` : "",
      year ? `Year: ${year}` : "",
      pmid ? `PMID: ${pmid}` : "",
      doiText ? `DOI: ${doiText}` : "",
      abstract ? `Abstract: ${abstract}` : ""
    ].filter(Boolean);

    const text = pieces.join("\n");
    if (containsExternalArticleData(text)) return text;
  }

  return "";
}


async function fetchEuropePmcKnowledge({ doi, title }) {
  const wantedTitle = cleanBibtexText(title || "");
  const queries = [];

  if (doi) queries.push(`DOI:"${doi}"`);

  for (const variant of buildTitleSearchVariants(wantedTitle)) {
    queries.push(`TITLE:"${variant.replace(/"/g, " ")}"`);
    queries.push(variant.replace(/"/g, " "));
  }

  for (const query of queries.filter(Boolean)) {
    const searchUrl =
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=10`;

    const data = await fetchJsonWithTimeout(searchUrl, 20000);
    const results = data?.resultList?.result || [];

    const result = doi
      ? (results.find(r => String(r?.doi || "").toLowerCase() === String(doi || "").toLowerCase()) || results[0])
      : bestCandidateByTitle(results, wantedTitle, item => String(item?.title || ""));

    if (!result) continue;

    const matchScore = wantedTitle ? titleSimilarityScore(wantedTitle, result.title || "").toFixed(2) : "1.00";

    const pieces = [];

    pieces.push("Europe PMC / PubMed-indexed article data:");
    if (result.title) pieces.push(`Title: ${result.title}`);
    if (wantedTitle) pieces.push(`Title match score: ${matchScore}`);
    if (result.authorString) pieces.push(`Authors: ${result.authorString}`);
    if (result.journalTitle) pieces.push(`Journal: ${result.journalTitle}`);
    if (result.pubYear) pieces.push(`Year: ${result.pubYear}`);
    if (result.doi) pieces.push(`DOI: ${result.doi}`);
    if (result.pmid) pieces.push(`PMID: ${result.pmid}`);
    if (result.pmcid) pieces.push(`PMCID: ${result.pmcid}`);
    if (result.abstractText) pieces.push(`Abstract: ${cleanFetchedArticleText(stripHtmlEntities(result.abstractText))}`);

    if (result.pmcid) {
      try {
        const fullText = await fetchPmcFullText(result.pmcid);
        if (fullText) pieces.push(`PMC full text extracted sections: ${fullText}`);
      } catch {
        // Open access full text may be unavailable.
      }
    }

    return pieces.filter(Boolean).join("\n");
  }

  return "";
}


async function fetchSemanticScholarKnowledge({ doi, title }) {
  const wantedTitle = cleanBibtexText(title || "");
  let paper = null;

  if (doi) {
    const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=title,abstract,year,authors,venue,url,externalIds`;
    const data = await fetchJsonWithTimeout(url, 20000);
    if (data && data.title) paper = data;
  }

  if (!paper && wantedTitle) {
    for (const variant of buildTitleSearchVariants(wantedTitle)) {
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(variant)}&limit=10&fields=title,abstract,year,authors,venue,url,externalIds`;
      const data = await fetchJsonWithTimeout(url, 20000);
      const items = data?.data || [];
      paper = bestCandidateByTitle(items, wantedTitle, item => String(item?.title || ""));
      if (paper && (paper.abstract || titleSimilarityScore(wantedTitle, paper.title || "") >= 0.55)) break;
    }
  }

  if (!paper) return "";

  const authors = Array.isArray(paper.authors)
    ? paper.authors.slice(0, 20).map(a => a.name).filter(Boolean).join(", ")
    : "";
  const externalIds = paper.externalIds || {};
  const doiText = externalIds.DOI || doi || "";
  const pmid = externalIds.PubMed || "";
  const arxiv = externalIds.ArXiv || "";
  const matchScore = wantedTitle ? titleSimilarityScore(wantedTitle, paper.title || "").toFixed(2) : "1.00";

  const pieces = [
    "Semantic Scholar article data from DOI/title search:",
    paper.title ? `Title: ${paper.title}` : "",
    wantedTitle ? `Title match score: ${matchScore}` : "",
    authors ? `Authors: ${authors}` : "",
    paper.venue ? `Venue: ${paper.venue}` : "",
    paper.year ? `Year: ${paper.year}` : "",
    doiText ? `DOI: ${doiText}` : "",
    pmid ? `PMID: ${pmid}` : "",
    arxiv ? `arXiv: ${arxiv}` : "",
    paper.url ? `URL: ${paper.url}` : "",
    paper.abstract ? `Abstract: ${cleanFetchedArticleText(paper.abstract)}` : ""
  ].filter(Boolean);

  return pieces.join("\n");
}

async function fetchOpenAlexKnowledge({ doi, title }) {
  const wantedTitle = cleanBibtexText(title || "");
  let work = null;

  if (doi) {
    const clean = cleanDoi(doi);
    const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(clean)}`;
    const data = await fetchJsonWithTimeout(url, 20000);
    if (data && data.display_name) work = data;
  }

  if (!work && wantedTitle) {
    for (const variant of buildTitleSearchVariants(wantedTitle)) {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(variant)}&per-page=10`;
      const data = await fetchJsonWithTimeout(url, 20000);
      const items = data?.results || [];
      work = bestCandidateByTitle(items, wantedTitle, item => String(item?.display_name || item?.title || ""));
      if (work && (work.abstract_inverted_index || titleSimilarityScore(wantedTitle, work.display_name || "") >= 0.55)) break;
    }
  }

  if (!work) return "";

  const abstract = decodeOpenAlexAbstract(work.abstract_inverted_index);
  const authors = Array.isArray(work.authorships)
    ? work.authorships.slice(0, 20).map(a => a.author?.display_name).filter(Boolean).join(", ")
    : "";
  const venue = work.primary_location?.source?.display_name || work.host_venue?.display_name || "";
  const doiText = work.doi ? cleanDoi(work.doi) : (doi || "");
  const matchScore = wantedTitle ? titleSimilarityScore(wantedTitle, work.display_name || "").toFixed(2) : "1.00";

  const pieces = [
    "OpenAlex article data from DOI/title search:",
    work.display_name ? `Title: ${work.display_name}` : "",
    wantedTitle ? `Title match score: ${matchScore}` : "",
    authors ? `Authors: ${authors}` : "",
    venue ? `Journal/Venue: ${venue}` : "",
    work.publication_year ? `Year: ${work.publication_year}` : "",
    doiText ? `DOI: ${doiText}` : "",
    work.id ? `OpenAlex ID: ${work.id}` : "",
    work.landing_page_url ? `URL: ${work.landing_page_url}` : "",
    abstract ? `Abstract: ${abstract}` : ""
  ].filter(Boolean);

  return pieces.join("\n");
}

function decodeOpenAlexAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return "";

  const positions = [];
  for (const [word, indexes] of Object.entries(invertedIndex)) {
    if (!Array.isArray(indexes)) continue;
    for (const index of indexes) {
      positions.push([Number(index), word]);
    }
  }

  if (!positions.length) return "";

  positions.sort((a, b) => a[0] - b[0]);
  return cleanFetchedArticleText(positions.map(item => item[1]).join(" "));
}

async function fetchPmcFullText(pmcid) {
  const cleanPmcid = String(pmcid || "").trim();
  if (!cleanPmcid) return "";

  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/${encodeURIComponent(cleanPmcid)}/fullTextXML`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "User-Agent": "Paper_Talk_Bot/1.0; research indexing",
      "Accept": "application/xml,text/xml,text/plain,*/*"
    },
    redirect: "follow"
  }, 30000);

  if (!response.ok) return "";

  const xml = await response.text();
  if (!xml || xml.length < 300) return "";

  const extracted = extractUsefulTextFromJatsXml(xml);
  return extracted.slice(0, 24000);
}

function extractUsefulTextFromJatsXml(xml) {
  const value = String(xml || "");

  const pieces = [];

  const titleMatch = value.match(/<article-title[^>]*>([\s\S]*?)<\/article-title>/i);
  if (titleMatch) pieces.push(`Title: ${xmlToPlainText(titleMatch[1])}`);

  const abstractMatch = value.match(/<abstract[^>]*>([\s\S]*?)<\/abstract>/i);
  if (abstractMatch) pieces.push(`Abstract: ${xmlToPlainText(abstractMatch[1])}`);

  const sectionNames = [
    "introduction",
    "background",
    "methods",
    "materials and methods",
    "results",
    "discussion",
    "conclusion",
    "conclusions"
  ];

  for (const sectionName of sectionNames) {
    const section = extractJatsSection(value, sectionName);
    if (section) pieces.push(`${sectionName} section: ${section}`);
  }

  if (pieces.length <= 2) {
    const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      pieces.push(`Body text: ${xmlToPlainText(bodyMatch[1]).slice(0, 20000)}`);
    }
  }

  return cleanFetchedArticleText(pieces.filter(Boolean).join("\n\n"));
}

function extractJatsSection(xml, wantedTitle) {
  const sections = [...String(xml || "").matchAll(/<sec[^>]*>([\s\S]*?)<\/sec>/gi)];

  for (const match of sections) {
    const block = match[1] || "";
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const sectionTitle = titleMatch ? normalizeSearchText(xmlToPlainText(titleMatch[1])) : "";

    if (!sectionTitle) continue;

    const wanted = normalizeSearchText(wantedTitle);
    if (sectionTitle === wanted || sectionTitle.includes(wanted) || wanted.includes(sectionTitle)) {
      return xmlToPlainText(block).slice(0, 8000);
    }
  }

  return "";
}

function xmlToPlainText(value) {
  return cleanFetchedArticleText(
    stripHtmlEntities(
      String(value || "")
        .replace(/<xref[\s\S]*?<\/xref>/gi, " ")
        .replace(/<table-wrap[\s\S]*?<\/table-wrap>/gi, " ")
        .replace(/<fig[\s\S]*?<\/fig>/gi, " ")
        .replace(/<disp-formula[\s\S]*?<\/disp-formula>/gi, " ")
        .replace(/<\/(p|sec|title|abstract|body|list-item)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  );
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url, timeoutMs = 12000) {
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "User-Agent": "Paper_Talk_Bot/1.0; research indexing",
      "Accept": "application/json,text/plain,*/*"
    },
    redirect: "follow"
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchReadableArticleText(url, title = "") {
  const normalizedUrl = normalizeArticleUrl(url);
  if (!normalizedUrl) return "";

  const response = await fetchWithTimeout(normalizedUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 Paper_Talk_Bot/1.0; research indexing",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,text/plain;q=0.7,*/*;q=0.5",
      "Accept-Language": "en-US,en;q=0.9"
    },
    redirect: "follow"
  }, 30000);

  const contentType = response.headers.get("Content-Type") || "";

  if (!response.ok) {
    return `Direct source-link fetch status for ${normalizedUrl}: HTTP ${response.status}. The publisher page may block automated access. The system also tried DOI/Crossref/Europe PMC metadata.`;
  }

  if (contentType.includes("application/pdf")) {
    return `PDF detected at ${normalizedUrl}. The PDF link is stored for retrieval context. Native Cloudflare Worker PDF text extraction is limited without an external PDF parsing service, so the system will still learn from article metadata, HTML abstract, admin abstract, admin description, and any readable page text.`;
  }

  const raw = await response.text();
  const limitedRaw = raw.slice(0, 700000);

  if (contentType.includes("application/json") || looksLikeJson(limitedRaw)) {
    return extractTextFromJson(limitedRaw, normalizedUrl);
  }

  return extractTextFromHtml(limitedRaw, normalizedUrl, title);
}

function normalizeArticleUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  if (/^10\.\d{4,9}\//i.test(value)) {
    return `https://doi.org/${value}`;
  }

  if (/^doi:/i.test(value)) {
    return `https://doi.org/${value.replace(/^doi:/i, "").trim()}`;
  }

  if (/^https?:\/\//i.test(value)) return value;

  return "";
}

function extractDoiFromTextOrUrl(value) {
  const text = String(value || "");

  const doiUrl = text.match(/https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/[^\s)"'<>]+)/i);
  if (doiUrl) return cleanDoi(doiUrl[1]);

  const doiLabel = text.match(/(?:doi|DOI)\s*[:=]\s*(10\.\d{4,9}\/[^\s)"'<>]+)/i);
  if (doiLabel) return cleanDoi(doiLabel[1]);

  const doiParam = text.match(/[?&](?:doi|DOI)=([^&\s]+)/);
  if (doiParam) return cleanDoi(decodeURIComponent(doiParam[1]));

  const rawDoi = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  if (rawDoi) return cleanDoi(rawDoi[0]);

  return "";
}

function cleanDoi(value) {
  return String(value || "")
    .replace(/^doi:/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/[\s"'<>]+$/g, "")
    .replace(/[.,;:)\]}]+$/g, "")
    .trim();
}

function cleanCrossrefAbstract(value) {
  return cleanFetchedArticleText(
    stripHtmlEntities(
      String(value || "")
        .replace(/<jats:[^>]+>/g, " ")
        .replace(/<\/jats:[^>]+>/g, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function looksLikeJson(text) {
  const value = String(text || "").trim();
  return value.startsWith("{") || value.startsWith("[");
}

function extractTextFromJson(text, sourceUrl) {
  try {
    const data = JSON.parse(text);
    const pieces = [];

    function walk(value, key = "") {
      if (pieces.join(" ").length > 25000) return;
      if (typeof value === "string") {
        const cleaned = cleanFetchedArticleText(value);
        if (cleaned.length >= 80 && /title|abstract|summary|description|article|paper|result|method|conclusion|background|objective/i.test(key + " " + cleaned)) {
          pieces.push(cleaned);
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item, key);
        return;
      }
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, k);
      }
    }

    walk(data);
    return [`Direct source JSON URL: ${sourceUrl}`, ...pieces].join("\n");
  } catch {
    return `Direct source URL: ${sourceUrl}\n${cleanFetchedArticleText(text).slice(0, 12000)}`;
  }
}

function extractTextFromHtml(html, sourceUrl, fallbackTitle = "") {
  const pieces = [];

  const jsonLdBlocks = [...String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => stripHtmlEntities(match[1] || ""));

  for (const block of jsonLdBlocks.slice(0, 5)) {
    const extracted = extractTextFromJson(block, sourceUrl);
    if (extracted) pieces.push(extracted);
  }

  const metaNames = [
    "citation_title",
    "dc.title",
    "og:title",
    "twitter:title",
    "citation_author",
    "citation_journal_title",
    "citation_publication_date",
    "citation_doi",
    "citation_abstract",
    "description",
    "dc.description",
    "og:description",
    "twitter:description"
  ];

  for (const name of metaNames) {
    const values = extractMetaContent(html, name);
    for (const value of values) {
      if (value) pieces.push(`${name}: ${value}`);
    }
  }

  const abstract = extractSectionByHeading(html, ["abstract", "summary"]);
  if (abstract) pieces.push(`Abstract section from source link: ${abstract}`);

  const introduction = extractSectionByHeading(html, ["introduction", "background"]);
  if (introduction) pieces.push(`Introduction/background section from source link: ${introduction}`);

  const results = extractSectionByHeading(html, ["results", "findings"]);
  if (results) pieces.push(`Results/findings section from source link: ${results}`);

  const discussion = extractSectionByHeading(html, ["discussion", "conclusion", "conclusions"]);
  if (discussion) pieces.push(`Discussion/conclusion section from source link: ${discussion}`);

  let readable = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<(p|div|section|article|h1|h2|h3|li|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  readable = cleanFetchedArticleText(stripHtmlEntities(readable));

  const keywordWindow = extractKeywordWindow(readable, fallbackTitle);
  if (keywordWindow) pieces.push(`Relevant source-link page text: ${keywordWindow}`);
  else if (readable.length > 500) pieces.push(`Direct source-link page text: ${readable.slice(0, 16000)}`);

  const unique = [...new Set(
    pieces
      .map(v => cleanFetchedArticleText(v))
      .filter(v => v.length >= 40)
  )];

  if (!unique.length) {
    return `Direct source URL: ${sourceUrl}\nThe page was fetched, but readable article text could not be extracted. The publisher may require JavaScript, institutional access, or block automated access.`;
  }

  return [`Direct source URL: ${sourceUrl}`, ...unique].join("\n\n");
}

function extractMetaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "gi"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "gi")
  ];

  const values = [];
  for (const pattern of patterns) {
    for (const match of String(html).matchAll(pattern)) {
      const value = cleanFetchedArticleText(stripHtmlEntities(match[1] || ""));
      if (value) values.push(value);
    }
  }
  return values;
}

function extractSectionByHeading(html, headings) {
  const text = String(html || "");
  for (const heading of headings) {
    const pattern = new RegExp(`<h[1-4][^>]*>\\s*${heading}\\s*<\\/h[1-4]>([\\s\\S]{0,12000}?)(?=<h[1-4][^>]*>|$)`, "i");
    const match = text.match(pattern);
    if (match) {
      return cleanFetchedArticleText(stripHtmlEntities(
        match[1]
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
      )).slice(0, 8000);
    }
  }
  return "";
}

function extractKeywordWindow(text, title) {
  const clean = cleanFetchedArticleText(text);
  const titleWords = normalizeSearchText(title)
    .split(/\s+/)
    .filter(v => v.length >= 5)
    .slice(0, 6);

  const keywords = ["abstract", "introduction", "results", "discussion", "conclusion", ...titleWords];
  const lower = clean.toLowerCase();

  let bestIndex = -1;
  for (const keyword of keywords) {
    const index = lower.indexOf(keyword.toLowerCase());
    if (index >= 0) {
      bestIndex = index;
      break;
    }
  }

  if (bestIndex < 0) return "";

  const start = Math.max(0, bestIndex - 2000);
  const end = Math.min(clean.length, bestIndex + 16000);
  return clean.slice(start, end);
}

function stripHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, code) => {
      try { return String.fromCharCode(Number(code)); } catch { return " "; }
    });
}

function cleanFetchedArticleText(value) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

async function upsertResearchKnowledgeVectors({ postId, title, sourceUrl, pdfLink, content }, env) {
  if (!env.AI || !env.VECTORIZE) {
    return false;
  }

  const chunks = chunkTextForEmbedding(content, 1800).slice(0, 24);

  if (chunks.length === 0) {
    return false;
  }

  const vectors = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await createEmbedding(chunk, env);

    vectors.push({
      id: `${postId}:${i}`,
      values: embedding,
      metadata: {
        post_id: postId,
        chunk_index: i,
        title,
        source_url: sourceUrl || "",
        pdf_link: pdfLink || "",
        text: chunk
      }
    });
  }

  await env.VECTORIZE.upsert(vectors);
  return true;
}

async function listGptThreads(request, env) {
  const url = new URL(request.url);
  const gptKeyForAccess = getGptKeyFromRequestData(Object.fromEntries(url.searchParams.entries()));
  const neuroAccessError = requireNeuroGptAccessIfNeeded(request, env, gptKeyForAccess);
  if (neuroAccessError) return neuroAccessError;

  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  await ensureSpecialistGptTables(env);

  const gptKey = normalizeGptKey(url.searchParams.get("gptKey") || url.searchParams.get("gpt") || url.searchParams.get("domain"));

  const threads = await env.DB.prepare(`
    SELECT *
    FROM gpt_threads
    WHERE user_id = ?
      AND COALESCE(gpt_key, 'paper_talk') = ?
    ORDER BY datetime(updated_at) DESC
  `).bind(user.id, gptKey).all();

  return json({
    ok: true,
    threads: threads.results || []
  });
}

async function createGptThread(request, env) {
  const bodyForAccess = await request.clone().json().catch(() => ({}));
  const gptKeyForAccess = getGptKeyFromRequestData(bodyForAccess);
  const neuroAccessError = requireNeuroGptAccessIfNeeded(request, env, gptKeyForAccess);
  if (neuroAccessError) return neuroAccessError;

  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  await ensureSpecialistGptTables(env);

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "New chat").trim() || "New chat";
  const gptKey = getGptKeyFromRequestData(data);
  const threadId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO gpt_threads (
      id,
      user_id,
      title,
      gpt_key,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(threadId, user.id, title, gptKey).run();

  return json({
    ok: true,
    thread: {
      id: threadId,
      user_id: user.id,
      title,
      gpt_key: gptKey
    }
  });
}

async function listGptMessages(request, env) {
  const url = new URL(request.url);
  const gptKeyForAccess = getGptKeyFromRequestData(Object.fromEntries(url.searchParams.entries()));
  const neuroAccessError = requireNeuroGptAccessIfNeeded(request, env, gptKeyForAccess);
  if (neuroAccessError) return neuroAccessError;

  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  await ensureSpecialistGptTables(env);

  const threadId = url.searchParams.get("threadId");
  const gptKey = normalizeGptKey(url.searchParams.get("gptKey") || url.searchParams.get("gpt") || url.searchParams.get("domain"));

  if (!threadId) {
    return json({ ok: false, error: "threadId is required." }, 400);
  }

  const thread = await env.DB.prepare(`
    SELECT *
    FROM gpt_threads
    WHERE id = ?
      AND user_id = ?
      AND COALESCE(gpt_key, 'paper_talk') = ?
  `).bind(threadId, user.id, gptKey).first();

  if (!thread) {
    return json({ ok: false, error: "Thread not found." }, 404);
  }

  const messages = await env.DB.prepare(`
    SELECT role, content, created_at
    FROM gpt_messages
    WHERE thread_id = ?
      AND user_id = ?
      AND COALESCE(gpt_key, 'paper_talk') = ?
    ORDER BY datetime(created_at) ASC
  `).bind(threadId, user.id, gptKey).all();

  return json({
    ok: true,
    messages: messages.results || []
  });
}


function getFriendlyKoreanAnswerStyleRules(mode = "general") {
  return `
Paper_Talk Vision GPT answer style rules:
- 기본 답변 언어는 사용자가 쓴 언어를 따르세요. 한국어 질문에는 자연스러운 한국어로 답하세요.
- 답변 스타일은 "연구실 선배가 차분하게 설명해주는 느낌"으로 작성하세요.
- 너무 딱딱한 보고서체도 피하고, "음...", "저는요"처럼 너무 수다스러운 대화체도 피하세요.
- 사용자가 원하는 스타일은 다음과 같습니다:
  Spatial 연구를 새로 시작한다면, 단순히 세포의 위치를 설명하는 연구보다는 공간 정보와 세포 상태 변화를 연결하는 방향이 더 흥미로워 보입니다.
  최근 spatial transcriptomics 연구들을 보면 조직 내 세포 분포나 niche 구조를 정교하게 설명하는 연구는 상당히 많이 축적되어 있습니다. 반면, 세포가 특정 공간에서 어떤 방향으로 분화하거나 상태 전이를 겪는지까지 설명하는 연구는 상대적으로 적습니다.
  그래서 Spatial + RNA velocity, 또는 Spatial + longitudinal sample 분석 같은 접근이 좋은 연구 주제가 될 수 있습니다.
- 위 예시처럼 자연스러운 설명문 형태로 답하세요. 기본은 짧은 문단 중심입니다. 사용자가 표나 목록을 명시적으로 요청하지 않는 한, 논문 목록형 답변을 만들지 마세요.
- 다음과 같은 섹션명은 절대 사용하지 마세요: "Direct answer", "Relevant papers", "Retrieved papers", "Paper-by-paper findings", "Agreements", "Contradictions", "Knowledge gaps", "Paper_Talk research interpretation", "Suggested next study or validation".
- 논문 제목을 목록처럼 나열하지 마세요. Paper_Talk DB 논문은 설명을 뒷받침하는 근거로 자연스럽게 녹여 쓰세요.
- 예: "Paper_Talk DB에 저장된 spatial 논문들을 보면 공간 구조 자체를 분석하는 연구는 많지만, 시간적 변화나 cell fate까지 연결하는 사례는 상대적으로 적습니다."처럼 쓰세요.
- 질문 의도에 따라 형식을 자동으로 고르되, 사용자가 명시적으로 표/목록/비교표를 요청하지 않으면 논문 리스트를 만들지 마세요.
- 전문용어가 나오면 바로 쉬운 말로 풀어주세요. 예: "RNA velocity는 세포가 현재 어떤 상태에 있는지보다 앞으로 어느 방향으로 변할지를 추정하려는 접근입니다."

- 알고리즘/방법론 질문(예: pseudotime, clustering, trajectory, normalization, GNN, transformer 등)은 "무엇인지 → 대표 방법들 → 각각 언제 쓰는지 → 장단점 → 연구에서 어떻게 고를지" 순서로 설명하세요.
- 방법론 질문에서 DB context가 없다는 말은 맨 앞에 쓰지 마세요. 사용자는 먼저 개념과 선택 기준을 알고 싶어합니다.
- 자세히 설명하되, 너무 항목화하지 말고 문단 사이의 흐름이 자연스럽게 이어지게 하세요.
- 연구 아이디어를 물으면 배경 → 왜 중요한지 → Paper_Talk DB에서 보이는 흐름 → 가능한 연구 질문 → 주의할 점 순서로 자연스럽게 설명하세요.
- Paper_Talk DB context에 없는 논문 제목, 저자, 연도, 저널, 샘플 수, 데이터셋, 결과를 새로 만들지 마세요.
- DB excerpt가 부족해도 답변 첫 문장을 DB 검색 실패로 시작하지 마세요. 먼저 사용자의 과학적 질문 자체에 친절하게 답하세요.
- 사용자가 "근거 논문", "출처", "Paper_Talk DB", "어떤 논문 기반"처럼 명시적으로 물어본 경우에만 DB 검색 상태를 설명하세요.
- 일반 개념 질문, 알고리즘 질문, 연구 아이디어 질문에서는 "현재 검색에서는...", "강하게 매칭되는 논문을 찾지 못했습니다", "관련 논문이 없습니다" 같은 문장으로 시작하지 마세요.
- DB context가 없더라도, 안전한 범위에서 일반적인 과학/방법론 설명을 먼저 제공하세요. 단, 논문 제목·저자·연도·저널·샘플 수·데이터셋 등은 DB에 없으면 새로 만들지 마세요.
- 마지막에 필요하면 아주 짧게 "원하시면 관련 Paper_Talk DB 논문도 따로 정리해드릴 수 있습니다" 정도로만 안내하세요.
- 사용자가 연구 아이디어를 물으면 마지막에는 새로운 연구 질문이나 실제 프로젝트로 발전시킬 수 있는 방향을 차분하게 제안하세요.
`;
}

function appendFriendlyStyleToSystemPrompt(systemPrompt, mode = "general") {
  const base = String(systemPrompt || "");
  const style = getFriendlyKoreanAnswerStyleRules(mode);
  if (base.includes("Answer style rules for Paper_Talk Vision GPT")) return base;
  return `${base}\n\n${style}`;
}


function getPaperTalkScientificThinkingLogic() {
  return `
PAPER_TALK SCIENTIFIC THINKING LOGIC

This is an internal scientific reasoning framework for Paper_Talk Vision GPT.
Use it silently to evaluate papers and research questions before answering.
Do not reveal chain-of-thought. Do not print this workflow unless the user explicitly asks for a brief explanation of the evaluation criteria.

Source separation:
- Paper_Talk Research DB = factual scientific evidence.
- Scientific Thinking Logic = reasoning framework only.
- Do not cite the thinking framework as biological, clinical, or experimental evidence.
- Do not use the framework to invent facts that are not present in retrieved DB excerpts.

For every scientific, paper-reading, literature, validation, bioinformatics, cancer genomics, single-cell, spatial, or data-analysis question, silently follow this order:

1. Clarify the real research question.
- What biological, clinical, computational, or methodological claim is being asked?
- Is the user asking for a concept, paper interpretation, comparison, validation plan, research idea, or critique?

2. Identify the data type and study setting.
- Bulk RNA-seq, single-cell RNA-seq, spatial transcriptomics, WES/WGS, proteomics, methylation, clinical cohort, imaging, experimental assay, multi-omics, or text/data-science workflow.
- Ask whether the method fits the data type.

3. Check data preparation and quality.
- Missing values, duplicate records, outliers, scaling/normalization, batch effects, confounders, sample composition, cohort imbalance, and data leakage.
- For text/image/high-dimensional data, consider whether preprocessing and feature representation are appropriate.

4. Check exploratory data analysis.
- Look for distribution, variance, correlation, cluster structure, outliers, subgroup composition, and possible hidden confounders.
- Do not accept a model conclusion before asking whether the data structure supports it.

5. Check feature logic.
- What variables, genes, cell states, regions, pathways, or image/text features drive the conclusion?
- Were irrelevant, redundant, low-variance, or highly correlated features handled properly?
- Could omitted biological or clinical variables explain the result?

6. Check model or statistical method choice.
- Is the task classification, regression, clustering, survival analysis, trajectory inference, spatial neighborhood analysis, differential expression, causal hypothesis generation, or biomarker discovery?
- Was the selected algorithm/statistical test suitable for that task?
- Were assumptions, hyperparameters, dimensionality reduction, and validation strategy handled carefully?

7. Separate evidence levels.
Classify each claim internally as:
- Directly supported by retrieved evidence.
- Reasonable interpretation from retrieved evidence.
- Speculative hypothesis that requires validation.
- Unknown because current retrieved evidence is insufficient.

8. Separate observed result, interpretation, and mechanism.
- Observed result: what the data directly shows.
- Interpretation: what the result may mean.
- Mechanistic hypothesis: what biological process might explain it.
Never present interpretation or mechanism as proven fact unless the retrieved evidence directly supports it.

9. Check validation strength.
- Internal validation, external cohort validation, cross-validation, independent dataset validation, experimental validation, functional validation, clinical validation, perturbation, or orthogonal assay.
- If validation is missing, explain that the conclusion should remain cautious.

10. Synthesize like a senior cancer genomics reviewer.
- Start with the most useful answer.
- Explain what the evidence supports.
- Explain what is uncertain.
- Suggest the next analysis or validation only when useful.
- Keep the tone calm, precise, and research-mentor-like.

Hard safety rules:
- Never invent papers, authors, journals, years, datasets, sample sizes, p-values, hazard ratios, biomarkers, mechanisms, or conclusions.
- Never pretend that general knowledge came from Paper_Talk DB.
- If Paper_Talk DB evidence is not retrieved or is thin, say so clearly and gently.
- Prefer cautious scientific interpretation over confident-sounding speculation.
- Use the user's language.
`.trim();
}


async function getRecentUserMessagesForRetrieval(threadId, userId, env, limit = 8) {
  if (!threadId || !userId) return [];

  try {
    const rows = await env.DB.prepare(`
      SELECT role, content, created_at
      FROM gpt_messages
      WHERE thread_id = ?
        AND user_id = ?
        AND role = 'user'
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `).bind(threadId, userId, limit).all();

    return (rows.results || [])
      .reverse()
      .map(row => ({
        role: row.role || 'user',
        content: String(row.content || '').trim()
      }))
      .filter(row => row.content);
  } catch {
    return [];
  }
}

function buildThreadRetrievalAnchor(recentMessages, currentMessage) {
  const current = String(currentMessage || '').trim();

  // If the current message already contains a paper URL/DOI/title, use that directly.
  // No thread anchor is needed.
  if (extractUrlsFromQuestion(current).length || extractDoiFromTextOrUrl(current)) {
    return '';
  }

  const currentTitles = extractLikelyPaperTitlesFromQuestion(current);
  if (currentTitles.length) return '';

  const priorTexts = (recentMessages || [])
    .map(m => String(m.content || '').trim())
    .filter(Boolean)
    .reverse();

  let previousExplicitPaper = '';

  for (const text of priorTexts) {
    const urls = extractUrlsFromQuestion(text);
    const doi = extractDoiFromTextOrUrl(text);
    const titles = extractLikelyPaperTitlesFromQuestion(text);

    if (urls.length || doi || titles.length) {
      previousExplicitPaper = [
        'Previous explicit paper reference from this thread:',
        urls.join('\n'),
        doi ? `DOI: ${doi}` : '',
        titles.join('\n')
      ].filter(Boolean).join('\n');
      break;
    }
  }

  if (!previousExplicitPaper) return '';

  // v39 automatic follow-up detection:
  // Do not maintain a fragile list of phrases such as "key takeaway" or "전체 논문".
  // Instead, if the user does not provide a new explicit URL/DOI/title and the message is
  // short enough to be a follow-up/instruction, keep the previous explicit paper as context.
  // Long standalone research questions still perform normal DB retrieval.
  const compactCurrent = current.replace(/\s+/g, ' ');
  const koreanChars = (compactCurrent.match(/[가-힣]/g) || []).length;
  const latinWords = (compactCurrent.match(/[A-Za-z][A-Za-z0-9_-]*/g) || []).length;
  const hasManyStandaloneTerms = latinWords >= 18 || koreanChars >= 180;
  const isShortInstructionLike = compactCurrent.length <= 280 && !hasManyStandaloneTerms;

  if (isShortInstructionLike) {
    return previousExplicitPaper;
  }

  return '';
}


function scoreExplicitPaperForActiveLock(item, explicitText) {
  const source = normalizeSearchText(`${item?.source_url || ""} ${item?.pdf_link || ""}`);
  const title = normalizeSearchText(item?.title || "");
  const content = normalizeSearchText(item?.content || "");
  const query = String(explicitText || "");
  const urls = extractUrlsFromQuestion(query).flatMap(makeUrlSearchVariants).map(normalizeSearchText).filter(Boolean);
  const doi = normalizeSearchText(extractDoiFromTextOrUrl(query) || "");
  const titles = extractLikelyPaperTitlesFromQuestion(query).map(normalizeSearchText).filter(Boolean);
  const tokens = getImportantSearchTokens(query).slice(0, 10).map(normalizeSearchText).filter(Boolean);

  let score = 0;
  for (const url of urls) {
    if (url && source.includes(url)) score += 240;
    else if (url && content.includes(url)) score += 100;
    const compactUrl = url.replace(/[^a-z0-9]/g, "");
    if (compactUrl.length >= 12) {
      const compactSource = source.replace(/[^a-z0-9]/g, "");
      const compactContent = content.replace(/[^a-z0-9]/g, "");
      if (compactSource.includes(compactUrl.slice(-18))) score += 260;
      else if (compactContent.includes(compactUrl.slice(-18))) score += 120;
    }
  }
  if (doi) {
    if (source.includes(doi)) score += 220;
    else if (content.includes(doi)) score += 120;
  }
  for (const t of titles) {
    if (t && title.includes(t.slice(0, 80))) score += 180;
    else if (t && content.includes(t.slice(0, 80))) score += 80;
  }
  const tokenHitsInTitle = tokens.filter(t => t.length >= 4 && title.includes(t)).length;
  const tokenHitsInContent = tokens.filter(t => t.length >= 4 && content.includes(t)).length;
  score += tokenHitsInTitle * 18 + Math.min(tokenHitsInContent * 4, 40);
  if (item?.from_explicit_url_or_identifier_search) score += 100;
  if (item?.from_explicit_title_search) score += 70;
  if (item?.from_explicit_title_token_search) score += 45;
  if (item?.from_user_provided_url_fetch) score += 30;
  if (item?.from_stored_url_live_fetch) score += 12;
  return score;
}

async function getStrictActivePaperContext({ message, recentMessages, env }) {
  const current = String(message || "").trim();
  const currentHasExplicitPaper =
    extractUrlsFromQuestion(current).length > 0 ||
    Boolean(extractDoiFromTextOrUrl(current)) ||
    extractLikelyPaperTitlesFromQuestion(current).length > 0;

  const anchor = buildThreadRetrievalAnchor(recentMessages || [], current);
  const explicitText = currentHasExplicitPaper ? current : anchor;
  if (!explicitText) return { activePaperContext: [], activePaperQuery: "", activePaperLocked: false };

  let matches = [];
  try { matches = await findExplicitPaperMatchesFromQuestion(explicitText, env); } catch { matches = []; }
  if (!matches.length) return { activePaperContext: [], activePaperQuery: explicitText, activePaperLocked: false };

  const ranked = matches
    .filter(item => !isThinkingLogicKnowledgeItem(item))
    .map(item => ({ item, score: scoreExplicitPaperForActiveLock(item, explicitText) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 60) return { activePaperContext: [], activePaperQuery: explicitText, activePaperLocked: false };

  let enriched = [best.item];
  try { enriched = await enrichExplicitPaperMatchesWithStoredUrls([best.item], env); } catch { enriched = [best.item]; }

  try {
    enriched = await enrichKnowledgeItemsWithFullTextChunks(enriched, explicitText, env);
  } catch {
    // Keep stored metadata if full-text chunk retrieval fails.
  }

  const locked = mergeKnowledgeResults(enriched).slice(0, 3);
  return { activePaperContext: locked, activePaperQuery: explicitText, activePaperLocked: locked.length > 0 };
}


function isRelatedPaperDiscoveryRequest(message, autoIntent = {}) {
  const semanticIntent = normalizePaperTalkIntentLabel(
    autoIntent?.paper_talk_intent || autoIntent?.question_type || ""
  );
  const answerStyle = String(autoIntent?.answer_style || "").toLowerCase();
  const interpretedIntent = String(autoIntent?.interpreted_intent || "").toLowerCase();

  // Primary route: semantic planner output.
  // This avoids forcing related-paper routing only by a fixed keyword list.
  if (toSemanticBoolean(autoIntent?.is_related_paper_request)) return true;

  if (
    semanticIntent === "LITERATURE_REVIEW" &&
    /similar|related|comparable|follow[-\s]?up|recommend|reference|citation|비슷|유사|관련|후속|추천|참고/.test(
      `${answerStyle} ${interpretedIntent}`
    )
  ) {
    return true;
  }

  // Safety fallback only when the planner is unavailable or returns incomplete JSON.
  // Do not use this for code-first routing.
  const text = String(message || "").toLowerCase();
  return /비슷한\s*논문|유사한\s*논문|관련\s*논문|다른\s*논문|또\s*(뭐|무엇)|같은\s*주제|후속\s*연구|비슷한\s*연구|관련\s*연구|similar\s+papers?|related\s+papers?|other\s+papers?|more\s+papers?|follow[-\s]?up\s+stud/i.test(text);
}

function buildRelatedPaperDiscoveryQuery(activePaperContext, message, autoIntent = {}) {
  const active = Array.isArray(activePaperContext) && activePaperContext.length
    ? activePaperContext[0]
    : null;

  const activeTitle = String(active?.title || "").trim();
  const activeContent = String(active?.content || "").replace(/\s+/g, " ").slice(0, 2500);

  return [
    "Find Paper_Talk DB papers related to the active paper. Use the active paper as a seed, but retrieve OTHER related papers if available.",
    activeTitle ? `Active paper title: ${activeTitle}` : "",
    activeContent ? `Active paper excerpt: ${activeContent}` : "",
    autoIntent?.retrieval_query ? `Auto retrieval query: ${autoIntent.retrieval_query}` : "",
    `User request: ${message}`,
    "Search concepts: disease, model system, method, gene/program, microenvironment, mechanism, validation, clinical implication."
  ].filter(Boolean).join("\n\n");
}

function cleanUserFacingPaperTitleForLanguage(title, language = "English") {
  let value = stripUserRequestTailFromPaperTitle(title || "");
  if (!value) return "";

  // If the user asked for English, never expose the Korean follow-up instruction
  // that may have been appended to the active-paper title by the chat state.
  // Example bad state:
  // "ecPICK: ... histopathology 논문이랑 비슷한 논문이나 ... 영어로"
  if (language === "English" && /[가-힣]/.test(value)) {
    value = value.split(/[가-힣]/)[0].trim();
  }

  value = value
    .replace(/\s+(?:please|pls)?\s*(?:give|recommend|show|list|find)\s+(?:me\s+)?(?:similar|related|follow[-\s]?up)[\s\S]*$/i, "")
    .replace(/\s+(?:in\s+english|answer\s+in\s+english|english\s+only)[\s\S]*$/i, "")
    .replace(/["“”'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return value;
}

function getRelatedPaperUserFacingTopic(activePaperContext, userMessage, language = "English") {
  const active = Array.isArray(activePaperContext) && activePaperContext.length
    ? activePaperContext[0]
    : null;

  const title = cleanUserFacingPaperTitleForLanguage(active?.title || "", language);
  if (!isLowInformationPaperTitle(title)) return title;

  const extracted = cleanUserFacingPaperTitleForLanguage(
    extractLikelyPaperTitleForSafeLookup(String(userMessage || "")),
    language
  );

  return isLowInformationPaperTitle(extracted) ? "" : extracted;
}

function buildRelatedPaperWhyLine(item, activePaperContext, userMessage, isKo) {
  const hay = cleanBibtexText([
    item?.matched_chunk || "",
    item?.content || ""
  ].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();

  const activeHay = cleanBibtexText((activePaperContext || [])
    .map(p => `${p?.title || ""} ${p?.matched_chunk || ""} ${p?.content || ""}`)
    .join(" ")).toLowerCase();

  const queryHay = String(userMessage || "").toLowerCase();
  const combined = `${activeHay} ${queryHay} ${hay.toLowerCase()}`;

  const tags = [];
  if (/multiplex|mibi|codex|imaging|image|phenotyp|phenotyping|cell phenotyp|histolog|imc|cycif|spatial proteomic/i.test(combined)) {
    tags.push(isKo ? "multiplexed imaging / cell phenotyping" : "multiplexed imaging and cell phenotyping");
  }
  if (/spatial|neighborhood|neighbourhood|niche|architecture|organization|microenvironment|tme|cell[-\s]?cell|cellular interaction/i.test(combined)) {
    tags.push(isKo ? "spatial organization / tumor microenvironment" : "spatial organization and tumor microenvironment structure");
  }
  if (/tumou?r|cancer|carcinoma|adenocarcinoma|tracerx|lung|breast|colon|melanoma|immune|immuno/i.test(combined)) {
    tags.push(isKo ? "tumor heterogeneity / immune microenvironment" : "tumor heterogeneity and immune microenvironment biology");
  }
  if (/single[-\s]?cell|cell state|cellular state|atlas|deep learning|machine learning|segmentation|classification|clustering/i.test(combined)) {
    tags.push(isKo ? "single-cell level state classification" : "single-cell-level state classification");
  }

  const uniqueTags = [...new Set(tags)].slice(0, 3);
  if (uniqueTags.length) {
    return isKo
      ? `활성 논문과 ${uniqueTags.join(", ")} 축이 겹칩니다.`
      : `It overlaps with the active paper through ${uniqueTags.join(", ")}.`;
  }

  const excerpt = hay
    .replace(/^(title|abstract|summary|content)\s*[:：]\s*/i, "")
    .slice(0, 220)
    .trim();

  if (excerpt) {
    return isKo
      ? `검색된 excerpt에서 유사한 연구 맥락이 보입니다: ${excerpt}`
      : `The retrieved excerpt suggests a related research context: ${excerpt}`;
  }

  return isKo
    ? "활성 논문과 주제 또는 방법론이 가까운 Paper_Talk DB 논문입니다."
    : "This is a Paper_Talk DB paper with a related topic or methodological angle.";
}

function buildRelatedPaperAnswerFromContext({ context, activePaperContext = [], userMessage = "" }) {
  const language = detectUserLanguage(userMessage);
  const isKo = language === "Korean";
  const activeTitle = getRelatedPaperUserFacingTopic(activePaperContext, userMessage, language);

  const activeItems = Array.isArray(activePaperContext) ? activePaperContext : [];
  const candidates = selectTopSupportingPapersForAnswer(
    (Array.isArray(context) ? context : [])
      .filter(item => !activeItems.some(active => isSameKnowledgePaper(item, active))),
    6,
    "LITERATURE_REVIEW"
  );

  if (!candidates.length) {
    return isKo
      ? [
          activeTitle
            ? `현재 Paper_Talk DB에서 "${activeTitle}"와 직접 비교할 만한 다른 유사 논문을 충분히 찾지 못했습니다.`
            : "현재 Paper_Talk DB에서 이 논문과 직접 비교할 만한 다른 유사 논문을 충분히 찾지 못했습니다.",
          "검색어를 multiplexed imaging, spatial tumor microenvironment, cell phenotyping, immune neighborhood처럼 조금 더 넓혀서 다시 찾으면 더 잘 잡힐 수 있습니다."
        ].join("\n")
      : [
          activeTitle
            ? `I could not find enough other directly comparable papers in the current Paper_Talk DB for "${activeTitle}."`
            : "I could not find enough other directly comparable papers in the current Paper_Talk DB for this active paper.",
          "Try broadening the query with terms such as multiplexed imaging, spatial tumor microenvironment, cell phenotyping, or immune neighborhood."
        ].join("\n");
  }

  const intro = isKo
    ? (activeTitle
      ? `"${activeTitle}"와 비슷한 논문은 아래처럼 보면 좋습니다.`
      : "이 논문과 비슷한 논문은 아래처럼 보면 좋습니다.")
    : (activeTitle
      ? `Here are papers that may be useful as related or follow-up references for "${activeTitle}."`
      : "Here are papers that may be useful as related or follow-up references.");

  const lines = candidates.map((item, index) => {
    const title = cleanBibtexText(item?.title || "Untitled Paper").trim() || "Untitled Paper";
    const why = buildRelatedPaperWhyLine(item, activePaperContext, userMessage, isKo);
    return `${index + 1}. ${title}\n   ${isKo ? "왜 비슷한가" : "Why similar"}: ${why}`;
  });

  const closing = isKo
    ? "정리하면, 이 주제는 단순한 image analysis라기보다 multiplexed single-cell phenotyping과 spatial neighborhood/TME 해석을 함께 보는 논문들로 묶어 읽는 것이 좋습니다."
    : "In short, this topic is best read through papers that combine multiplexed single-cell phenotyping with spatial neighborhood or tumor-microenvironment interpretation.";

  return [intro, "", ...lines, "", closing].join("\n");
}

function isSameKnowledgePaper(a, b) {
  const ap = String(a?.post_id || "").trim();
  const bp = String(b?.post_id || "").trim();
  if (ap && bp && ap === bp) return true;

  const at = normalizeSearchText(a?.title || "");
  const bt = normalizeSearchText(b?.title || "");
  if (at && bt && at === bt) return true;

  const au = normalizeSearchText(`${a?.source_url || ""} ${a?.pdf_link || ""}`);
  const bu = normalizeSearchText(`${b?.source_url || ""} ${b?.pdf_link || ""}`);
  if (au && bu && (au.includes(bu) || bu.includes(au))) return true;

  return false;
}


const PAPER_TALK_MAX_IMPORTED_FULLTEXT_CHUNKS = 4;
const PAPER_TALK_MAX_VECTOR_INDEX_CHUNKS_PER_IMPORT = 0;
const PAPER_TALK_MAX_CHAT_CONTEXT_ITEMS = 5;
const PAPER_TALK_MAX_CHAT_CONTEXT_TEXT = 7000;
const PAPER_TALK_MAX_FULLTEXT_EXCERPT_PER_ITEM = 2200;
const PAPER_TALK_MAX_THINKING_LOGIC_CHAT_CHARS = 6000;
const PAPER_TALK_MIN_FULLTEXT_CHARS = 20;
const PAPER_TALK_MAX_IMPORTED_FULLTEXT_CHARS = 12000;
const PAPER_TALK_SKIP_VECTORIZE_DURING_IMPORT = true;

function isLikelyGeneralQuestionFast(message) {
  const text = String(message || '').trim();
  if (!text) return false;

  const lower = text.toLowerCase();

  // v54: If the message contains a paper-title-like scientific span, never route it
  // to the no-retrieval/general path. This catches multilingual instructions such as
  // "<English title> 을 읽고 요약해줘", "résume cet article: <title>", etc.
  try {
    const titleLike = extractLikelyPaperTitleForSafeLookup(text);
    const sciTokens = String(titleLike || "").match(/[A-Za-z0-9]+(?:[-+][A-Za-z0-9]+)*/g) || [];
    if (titleLike.length >= 18 && sciTokens.length >= 3) return false;
  } catch {}

  const explicitResearchSignal = /paper_talk|db|논문|연구|literature|paper|papers|abstract|doi|pubmed|pmid|reindex|full\s*text|pdf|암|cancer|tumou?r|genomics|single[-\s]?cell|spatial|rna[-\s]?seq|scrna|transcriptomics|proteomics|multi[-\s]?omics|trajectory|velocity|scvelo|velocyto|visium|xenium|cosmx|mutation|variant|biomarker|immunotherapy|checkpoint|t\s*cell|b\s*cell|myeloid|macrophage|fibroblast|pancreatic|melanoma|glioma|breast|lung|colon|metastasis|organoid|crispr|sequencing/i;
  if (explicitResearchSignal.test(text)) return false;

  const casualOrUtility = /^(hi|hello|hey|thanks|thank you|고마워|안녕|안녕하세요|테스트|test|오늘 날씨|몇 시|who are you|너 누구|help|도움말|뭐 할 수 있어|무엇을 할 수)/i;
  if (casualOrUtility.test(lower)) return true;

  if (text.length <= 80 && !/[?？].*(논문|연구|paper|cancer|omics)/i.test(text)) {
    return true;
  }

  return false;
}


function isBroadResearchAdviceQuestionFast(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  const lower = text.toLowerCase();

  // Recommendation requests for specific papers should still use the lightweight DB lookup.
  if (/(recommend|추천).{0,30}(paper|papers|논문)|(?:paper|papers|논문).{0,30}(recommend|추천)/i.test(text)) return false;

  // These are broad brainstorming / career / direction questions. Searching hundreds of
  // PDF chunks for them is expensive and caused Cloudflare 500/503 HTML responses after
  // many full-text uploads. Answer them directly, without DB/Vectorize retrieval.
  if (/(뭘|뭐|무엇|어떤|어떻게).{0,20}(하면|할까|좋을까|좋을지|추천|아이디어|방향|주제)/.test(text)) return true;
  if (/(연구|spatial|single.?cell|genomics|cancer).{0,30}(아이디어|방향|추천|주제|하면 좋|할까)/i.test(text)) return true;
  if (/research\s+(idea|ideas|direction|topic|proposal|plan|recommend)/i.test(lower)) return true;
  if (/what\s+(spatial|single[-\s]?cell|genomics|cancer).{0,40}(study|project|research)/i.test(lower)) return true;

  return false;
}

function makeEmptyStrictActivePaperContext() {
  return {
    activePaperLocked: false,
    activePaperQuery: '',
    activePaperContext: []
  };
}

function trimKnowledgeItemForChat(item) {
  if (!item) return item;
  const content = String(item.content || '').slice(0, PAPER_TALK_MAX_FULLTEXT_EXCERPT_PER_ITEM + 1200);
  const matched = String(item.matched_chunk || makeBestEvidenceExcerpt(item.content || '') || '').slice(0, PAPER_TALK_MAX_FULLTEXT_EXCERPT_PER_ITEM);
  return {
    ...item,
    content,
    matched_chunk: matched
  };
}

function trimContextForChat(context) {
  return mergeKnowledgeResults(Array.isArray(context) ? context : [])
    .filter(item => !isThinkingLogicKnowledgeItem(item))
    .slice(0, PAPER_TALK_MAX_CHAT_CONTEXT_ITEMS)
    .map(trimKnowledgeItemForChat);
}


function extractLikelyPaperTitleForSafeLookup(message) {
  // v53 multilingual automatic title/snippet detector.
  // Do not hardcode one language's request words. Instead:
  // - Prefer quoted text.
  // - Prefer long scientific Latin/digit spans, which cover most paper titles.
  // - Fall back to the longest line after removing URLs/PDF suffixes.
  const raw = String(message || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\.pdf\b/gi, " ")
    .replace(/[_]+/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "";

  const quoted = raw.match(/["“”'`「『《](.{8,220}?)[“”"'`」』》]/);
  if (quoted && quoted[1]) {
    return quoted[1].replace(/\s+/g, " ").trim().slice(0, 180);
  }

  const lines = String(message || "")
    .split(/\n+/)
    .map(v => v.replace(/https?:\/\/\S+/gi, " ").replace(/\.pdf\b/gi, " ").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const candidates = [];

  for (const line of [raw, ...lines]) {
    // Long title-like scientific span. This naturally stops before/after Korean,
    // Japanese, Chinese, French, Spanish, etc. instruction words when the paper
    // title itself is in English, without needing language-specific stopwords.
    const spans = line.match(/[A-Za-z0-9][A-Za-z0-9+\-:;,/() ]{10,220}[A-Za-z0-9)]/g) || [];
    for (const span of spans) {
      const cleaned = span
        .replace(/\b(?:pdf|txt)\b/ig, " ")
        .replace(/\s+/g, " ")
        .trim();

      const scientificTokens = cleaned.match(/[A-Za-z0-9]+(?:[-+][A-Za-z0-9]+)*/g) || [];
      if (scientificTokens.length >= 3 && cleaned.length >= 12) candidates.push(cleaned);
    }

    if (line.length >= 8) candidates.push(line.slice(0, 220));
  }

  if (!candidates.length) return raw.slice(0, 180);

  candidates.sort((a, b) => {
    const sciA = (a.match(/[A-Za-z0-9]+(?:[-+][A-Za-z0-9]+)*/g) || []).length;
    const sciB = (b.match(/[A-Za-z0-9]+(?:[-+][A-Za-z0-9]+)*/g) || []).length;
    const scoreA = sciA * 20 + Math.min(a.length, 180);
    const scoreB = sciB * 20 + Math.min(b.length, 180);
    return scoreB - scoreA;
  });

  return candidates[0].replace(/\s+/g, " ").trim().slice(0, 180);
}


function makeSafeLikePattern(value, maxLen = 70) {
  const safe = String(value || '')
    .toLowerCase()
    .replace(/[%_]/g, ' ')
    .replace(/[^a-z0-9가-힣\s\-–:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim();
  return safe ? `%${safe}%` : '';
}


async function safeRetrievePaperContextForChat(message, env, gptKey = DEFAULT_GPT_KEY) {
  gptKey = normalizeGptKey(gptKey);
  await ensureSpecialistGptTables(env);
  // v52 robust bounded D1 retrieval:
  // - title, file name, keyword, and pasted full-text snippets should all retrieve papers.
  // - no broad full-table scan
  // - no Vectorize during chat
  // - bounded rows and bounded context to avoid Cloudflare 500/503
  const userQuery = String(message || "").trim();
  if (!userQuery) return [];

  const allItems = [];

  // Exact paper/title/DOI/URL lookup must run before fuzzy keyword retrieval.
  // Otherwise a real stored paper can be missed when the user adds multilingual
  // instructions after the title, e.g. "<title> 논문에서 하이라이트를 한줄로 줘".
  try {
    const explicitMatches = await findExplicitPaperMatchesFromQuestion(userQuery, env, gptKey);
    if (Array.isArray(explicitMatches) && explicitMatches.length) {
      const enriched = await enrichKnowledgeItemsWithFullTextChunks(explicitMatches, userQuery, env, gptKey);
      allItems.push(...enriched);
    }
  } catch {
    // Continue to fuzzy retrieval.
  }

  try {
    allItems.push(...await searchPaperFullTextChunks(userQuery, env, 6, gptKey));
  } catch {
    // Continue to metadata fallback.
  }

  const terms = buildRobustFullTextSearchTerms(userQuery).slice(0, 8);

  if (terms.length) {
    const clauses = [];
    const params = [];

    for (const term of terms) {
      clauses.push(`(
        LOWER(title) LIKE ?
        OR LOWER(content) LIKE ?
        OR LOWER(source_url) LIKE ?
        OR LOWER(pdf_link) LIKE ?
      )`);
      const like = `%${String(term || "").toLowerCase()}%`;
      params.push(like, like, like, like);
    }

    try {
      const rows = await env.DB.prepare(`
        SELECT post_id, title, source_url, pdf_link, content, updated_at
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND content NOT LIKE '%Knowledge role: THINKING_FRAMEWORK_ONLY%'
          AND COALESCE(gpt_key, 'paper_talk') = ?
          AND (${clauses.join(" OR ")})
        ORDER BY datetime(updated_at) DESC
        LIMIT 20
      `).bind(gptKey, ...params).all();

      const scored = (rows.results || [])
        .map(row => {
          const hay = `${row.title || ""}\n${row.content || ""}\n${row.source_url || ""}\n${row.pdf_link || ""}`.toLowerCase();
          const score = terms.reduce((sum, term) => sum + (hay.includes(String(term || "").toLowerCase()) ? Math.min(80, 12 + String(term).length) : 0), 0);
          return { row, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      for (const { row, score } of scored.slice(0, 4)) {
        allItems.push({
          post_id: row.post_id || "",
          title: cleanBibtexText(row.title || ""),
          source_url: row.source_url || "",
          pdf_link: row.pdf_link || "",
          content: String(row.content || "").slice(0, 3000),
          matched_chunk: makeBestEvidenceExcerpt(row.content || "").slice(0, 1600),
          similarity_score: score,
          from_research_knowledge_search: true
        });
      }
    } catch {
      // Continue.
    }
  }

  const merged = mergeKnowledgeResults(allItems)
    .filter(item => !isThinkingLogicKnowledgeItem(item))
    .slice(0, PAPER_TALK_MAX_CHAT_CONTEXT_ITEMS)
    .map(trimKnowledgeItemForChat);

  return merged;
}


async function callOpenAIGeneralNoRetrieval(userMessage, env, cancelRuntime = null) {
  if (!env.OPENAI_API_KEY) return "OPENAI_API_KEY is missing.";

  await cancelRuntime?.throwIfCanceled?.();
  const abortable = createLinkedAbortController(cancelRuntime, 45000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: abortable.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are Paper_Talk Vision GPT, a warm senior cancer genomics and bioinformatics research mentor.

Answer in the user's language.
Do not give a short generic answer unless the user explicitly asks for a short answer.
For broad research-idea, planning, or recommendation-style questions, answer like an experienced mentor helping the user think through the problem.

Style requirements:
- Start with the core intuition in plain language.
- Then explain why the direction matters biologically or analytically.
- Give concrete research angles, feasible datasets/assays, and validation ideas when useful.
- Use 4 to 7 natural paragraphs for research-direction questions unless the user asks for brevity.
- Avoid rigid report headings and avoid one-line answers.
- Do not claim that the answer came from Paper_Talk DB unless specific DB context is provided.
Plain text only.`
          },
          {
            role: "user",
            content: String(userMessage || "").slice(0, 1200)
          }
        ],
        temperature: 0.2,
        max_completion_tokens: 1800
      })
    });

    const raw = await res.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return `OpenAI general request returned non-JSON response. HTTP ${res.status}. ${raw.slice(0, 300)}`;
    }

    if (!res.ok) {
      return `OpenAI general request failed. HTTP ${res.status}. ${data?.error?.message || JSON.stringify(data).slice(0, 300)}`;
    }

    return extractOpenAIText(data) || "No answer returned.";
  } catch (error) {
    if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
      return USER_CANCELED_MESSAGE;
    }
    if (error && error.name === "AbortError") {
      return "OpenAI general request timeout after 45 seconds. Please try a narrower question.";
    }
    return `OpenAI general request failed safely: ${error?.message || error}`;
  } finally {
    abortable.cleanup();
  }
}


// =============================
// Paper_Talk v72 semantic routing helpers
// =============================

function normalizePaperTalkIntentLabel(value) {
  const v = String(value || "").trim().toUpperCase().replace(/[^A-Z_]/g, "");

  if ([
    "LITERATURE_REVIEW",
    "RESEARCH_IDEA",
    "METHOD_EXTRACTION",
    "PIPELINE_WORKFLOW",
    "CONCEPT",
    "VALIDATION",
    "COMPARISON",
    "PAPER_SUMMARY",
    "SOURCE_TRACE",
    "GENERAL"
  ].includes(v)) return v;

  if (v === "LITERATURE" || v === "REVIEW" || v === "TREND" || v === "TRENDS") return "LITERATURE_REVIEW";
  if (v === "RESEARCH" || v === "RESEARCH_DIRECTION" || v === "RESEARCH_INSIGHT" || v === "IDEA" || v === "PROJECT_IDEA") return "RESEARCH_IDEA";

  // v82: distinguish tool/method extraction from end-to-end workflow requests.
  if ([
    "PIPELINE",
    "WORKFLOW",
    "PIPELINE_WORKFLOW",
    "ANALYSIS_PIPELINE",
    "ANALYSIS_WORKFLOW",
    "END_TO_END_PIPELINE",
    "STEP_BY_STEP_WORKFLOW",
    "PIPELINE_EXTRACTION",
    "WORKFLOW_EXTRACTION"
  ].includes(v)) return "PIPELINE_WORKFLOW";

  if ([
    "METHOD",
    "METHODS",
    "METHODOLOGY",
    "ANALYSIS_METHOD",
    "ANALYSIS_METHODS",
    "PRACTICAL_METHOD",
    "PRACTICAL_METHODS",
    "METHOD_EXTRACTION",
    "TOOL_EXTRACTION",
    "PACKAGE_EXTRACTION",
    "SOFTWARE_EXTRACTION"
  ].includes(v)) return "METHOD_EXTRACTION";

  if (v === "EXPLANATION") return "CONCEPT";
  return "GENERAL";
}

function normalizePaperTalkDomainLabel(value) {
  const v = String(value || "").trim().toUpperCase().replace(/[^A-Z_]/g, "");
  if (["SPATIAL_BIOLOGY", "CANCER_GENOMICS", "SINGLE_CELL", "IMMUNOLOGY", "AGING", "MULTIOMICS", "AI_METHOD", "GENERAL"].includes(v)) return v;
  if (v.includes("SPATIAL")) return "SPATIAL_BIOLOGY";
  if (v.includes("CANCER") || v.includes("TUMOR") || v.includes("ONCO")) return "CANCER_GENOMICS";
  if (v.includes("SINGLE")) return "SINGLE_CELL";
  if (v.includes("IMMUNE") || v.includes("IMMUNO")) return "IMMUNOLOGY";
  if (v.includes("OMICS")) return "MULTIOMICS";
  if (v.includes("AI") || v.includes("DEEP") || v.includes("MODEL")) return "AI_METHOD";
  return "GENERAL";
}

function toSemanticBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const v = String(value || "").trim().toLowerCase();
  return ["true", "yes", "y", "1"].includes(v);
}

function normalizeSemanticAnswerStyle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function shouldUseCodeFirstMode({
  inferredIntent,
  forcedOutputStyle,
  relatedPaperMode,
  strictActivePaperState
} = {}) {
  const semanticIntent = normalizePaperTalkIntentLabel(
    inferredIntent?.paper_talk_intent || inferredIntent?.question_type || ""
  );

  const answerStyle = normalizeSemanticAnswerStyle(inferredIntent?.answer_style || "");

  // Only the semantic planner can turn this on. Do not use keyword matching here.
  const wantsExecutableCode =
    toSemanticBoolean(inferredIntent?.wants_executable_code) ||
    answerStyle === "executable_code" ||
    answerStyle === "runnable_code" ||
    answerStyle === "script_generation" ||
    answerStyle === "code_generation";

  const literatureOrResearchIntent = [
    "LITERATURE_REVIEW",
    "RESEARCH_IDEA",
    "VALIDATION",
    "COMPARISON",
    "PAPER_SUMMARY",
    "SOURCE_TRACE",
    "CONCEPT"
  ].includes(semanticIntent);

  const nonCodeContinuationStyle = [
    "LITERATURE_REVIEW",
    "RESEARCH_INSIGHT",
    "RESEARCH_SYNTHESIS",
    "VALIDATION_PLAN",
    "COMPARISON",
    "PAPER_SUMMARY",
    "SOURCE_TRACE",
    "CONCEPT_EXPLANATION",
    "FOLLOW_UP_MORE"
  ].includes(String(forcedOutputStyle || ""));

  if (relatedPaperMode) return false;
  if (strictActivePaperState?.activePaperLocked && forcedOutputStyle === "PAPER_SUMMARY") return false;
  if (literatureOrResearchIntent) return false;
  if (nonCodeContinuationStyle) return false;

  return wantsExecutableCode;
}

function heuristicPaperTalkPlanner(message) {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();

  let literatureScore = 0;
  let ideaScore = 0;
  let methodScore = 0;
  let pipelineScore = 0;
  let validationScore = 0;
  let comparisonScore = 0;
  let conceptScore = 0;

  const add = (regex, score, bucket) => { if (regex.test(text)) bucket(score); };
  add(/(trend|trendy|hot|latest|recent|emerging|state of the art|sota|요즘|최근|최신|트렌드|트렌디|핫한|뜨는|유행|동향|읽어볼|볼 만한|중요한 연구|대표 논문|논문 추천|literature|papers? to read|recommend.*papers?)/i, 3, s => literatureScore += s);
  add(/(what research|project idea|research idea|future direction|promising|hypothesis|뭘 연구|어떤 연구|연구.*아이디어|연구.*주제|연구.*방향|앞으로|향후|유망|가설|할 수 있을까|하면 좋을까|접목)/i, 3, s => ideaScore += s);

  // Fallback only. Primary routing is done by the LLM planner below.
  // Pipeline/workflow requests should produce a step-by-step workflow, not just a tool list.
  add(/(pipeline|workflow|end[-\s]?to[-\s]?end|step[-\s]?by[-\s]?step|analysis\s+order|procedure|파이프라인|워크플로우|분석\s*순서|분석\s*단계|단계별|전체\s*분석|처음부터|raw\s*data\s*to|FASTQ.*interpretation)/i, 6, s => pipelineScore += s);

  // This catches obvious package/tool/method questions when OpenAI intent inference is unavailable.
  add(/(package|packages|software|tool|tools|library|libraries|method|methods|methodology|algorithm|implementation|code|model|models|패키지|툴|도구|소프트웨어|방법론|분석법|분석 방법|알고리즘|구현|모델)/i, 4, s => methodScore += s);
  add(/(논문|paper|papers|study|studies).{0,60}(썼|사용|used|applied|implemented|분석|방법|패키지|도구|툴|software|method|package|tool|algorithm|model)/i, 5, s => methodScore += s);

  add(/(validate|validation|experiment|검증|실험 설계|확인하려면|어떻게 증명)/i, 3, s => validationScore += s);
  add(/(compare|comparison|versus| vs |차이|비교|다른 점)/i, 3, s => comparisonScore += s);
  add(/(what is|explain|definition|개념|설명|무엇|뭐야|정의)/i, 2, s => conceptScore += s);

  // Restore older Paper_Talk behavior for broad biological association/crosstalk questions:
  // these should be answered as evidence-grounded field insight, not as a generic concept answer.
  if (isEvidenceStyleAssociationQuestion(text)) {
    literatureScore += 5;
  }

  let paperTalkIntent = "GENERAL";
  const best = Math.max(literatureScore, ideaScore, methodScore, pipelineScore, validationScore, comparisonScore, conceptScore);
  if (best > 0) {
    // Tie-breaker: workflow wins over method list; method extraction wins over literature/trend.
    if (pipelineScore === best) paperTalkIntent = "PIPELINE_WORKFLOW";
    else if (methodScore === best) paperTalkIntent = "METHOD_EXTRACTION";
    else if (literatureScore === best) paperTalkIntent = "LITERATURE_REVIEW";
    else if (ideaScore === best) paperTalkIntent = "RESEARCH_IDEA";
    else if (validationScore === best) paperTalkIntent = "VALIDATION";
    else if (comparisonScore === best) paperTalkIntent = "COMPARISON";
    else if (conceptScore === best) paperTalkIntent = "CONCEPT";
  }

  let primaryDomain = "GENERAL";
  const hasScRnaSignal = /(scrna|sc\s*rna|single[-\s]?cell\s+rna|single[-\s]?cell|싱글셀|단일세포|rna[-\s]?seq|전사체)/i.test(text);
  const hasScAtacSignal = /(scatac|sc\s*atac|single[-\s]?cell\s+atac|atac[-\s]?seq|chromatin|크로마틴|accessibility|접근성|epigenomic|epigenomics|후성유전체)/i.test(text);

  if (hasScRnaSignal && hasScAtacSignal) primaryDomain = "MULTIOMICS";
  else if (hasScAtacSignal) primaryDomain = "MULTIOMICS";
  else if (/(spatial|visium|xenium|cosmx|merfish|spatial transcriptomics|공간|공간 전사체|공간전사체)/i.test(text)) primaryDomain = "SPATIAL_BIOLOGY";
  else if (/(cancer|tumou?r|oncology|clone|clonal|암|종양|항암|전이)/i.test(text)) primaryDomain = "CANCER_GENOMICS";
  else if (hasScRnaSignal) primaryDomain = "SINGLE_CELL";
  else if (/(immune|immunology|t cell|b cell|myeloid|면역)/i.test(text)) primaryDomain = "IMMUNOLOGY";
  else if (/(multiomics|multi-omics|proteomics|epigenomics|멀티오믹스)/i.test(text)) primaryDomain = "MULTIOMICS";
  else if (/(deep learning|machine learning|foundation model|transformer|gnn|diffusion|딥러닝|머신러닝|파운데이션|트랜스포머)/i.test(text)) primaryDomain = "AI_METHOD";

  return { paperTalkIntent, primaryDomain };
}


function buildPaperTalkKeywordAnchor(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  const cleaned = raw
    .replace(/(분석\s*)?(파이프라인|워크플로우|workflow|pipeline|work\s*flow|pipe\s*line|analysis\s*workflow|analysis\s*pipeline|end[-\s]?to[-\s]?end|step[-\s]?by[-\s]?step)/ig, " ")
    .replace(/(논문|paper|papers|study|studies|관련|맞는|찾아|찾아서|읽고|참고|기반|기준|줘|주세요|달라고|알려줘|보여줘|정리해줘|어떤|무슨|뭐|뭘|키워드)/ig, " ")
    .replace(/[?？!！]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Preserve user-provided scientific keywords whenever possible. If cleaning removes too much, fall back to raw query.
  const anchor = cleaned.length >= 3 ? cleaned : raw;
  return anchor.slice(0, 220);
}

function buildPaperTalkRetrievalQueries(text, primaryDomain, paperTalkIntent) {
  const q = String(text || "").trim();
  const queries = [q];
  const t = q.toLowerCase();

  if (primaryDomain === "SPATIAL_BIOLOGY" || /spatial|visium|xenium|cosmx|공간/i.test(t)) {
    queries.push(
      "spatial transcriptomics tumor microenvironment deep learning",
      "spatial biology foundation model histology transcriptomics",
      "spatial multiomics cell cell interaction graph neural network"
    );
  }

  if (primaryDomain === "CANCER_GENOMICS" || /cancer|tumor|암|종양/i.test(t)) {
    queries.push(
      "cancer genomics tumor evolution immune escape spatial",
      "drug response prediction tumor microenvironment multiomics"
    );
  }

  if (paperTalkIntent === "LITERATURE_REVIEW") {
    queries.push("recent review trend state of the art important papers");
  }

  if (isEvidenceStyleAssociationQuestion(q)) {
    queries.unshift(
      "CAF macrophage immunosuppression immune exclusion tumor microenvironment",
      "cancer associated fibroblast macrophage crosstalk CSF1 CSF1R cancer",
      "fibroblast macrophage reciprocal interaction cancer fibrosis immune suppression"
    );
  }

  if (paperTalkIntent === "PIPELINE_WORKFLOW") {
    // v84: workflow/pipeline questions must first retrieve keyword-matched papers and extract their methods/workflow.
    // The model should synthesize workflows used in relevant papers, not give a generic protocol first.
    const keywordAnchor = buildPaperTalkKeywordAnchor(q);
    if (keywordAnchor) {
      queries.push(
        `${keywordAnchor} paper workflow pipeline methods used preprocessing QC downstream analysis`,
        `${keywordAnchor} analysis pipeline workflow paper methods supplementary methods`,
        `${keywordAnchor} used workflow used methods pipeline papers`
      );
    }

    const asksSpatialWorkflow =
      primaryDomain === "SPATIAL_BIOLOGY" ||
      /(spatial|visium|xenium|cosmx|merfish|slide[-\s]?seq|seq[-\s]?fish|spatial transcriptomics|공간|공간전사체|공간 전사체)/i.test(t);

    const asksSingleCellWorkflow =
      primaryDomain === "SINGLE_CELL" ||
      primaryDomain === "MULTIOMICS" ||
      /(scrna|sc\s*rna|single[-\s]?cell|싱글셀|단일세포|scatac|sc\s*atac|atac[-\s]?seq|chromatin|크로마틴|multi[-\s]?omics|멀티오믹스)/i.test(t);

    if (asksSpatialWorkflow) {
      queries.push(
        `${keywordAnchor || "spatial transcriptomics"} spatial transcriptomics paper workflow preprocessing QC normalization spatial domains deconvolution cell cell interaction`,
        `${keywordAnchor || "spatial transcriptomics"} Visium Xenium CosMx MERFISH spatial transcriptomics analysis pipeline used methods papers Seurat Scanpy Squidpy Giotto BayesSpace SpaGCN STAGATE cell2location Tangram`,
        `${keywordAnchor || "spatial omics"} spatial omics workflow histology image segmentation deconvolution niche analysis ligand receptor analysis papers`
      );
    }

    if (asksSingleCellWorkflow) {
      queries.push(
        `${keywordAnchor || "single cell"} single cell paper workflow scRNA scATAC multiome preprocessing QC integration downstream analysis used methods`,
        `${keywordAnchor || "scRNA scATAC multiome"} scRNA scATAC multiome workflow papers FASTQ Cell Ranger ARC Seurat Signac WNN ArchR SnapATAC2 LIGER iNMF GLUE MultiVI`,
        `${keywordAnchor || "single cell chromatin accessibility"} single cell chromatin accessibility workflow gene activity peak calling LSI motif TF activity SCENIC SCENIC+ chromVAR Cicero papers`
      );
    }

    queries.push(
      "methods workflow used in paper analysis pipeline QC preprocessing downstream interpretation",
      "end to end analysis workflow paper methods raw data QC preprocessing integration interpretation"
    );
  }

  if (paperTalkIntent === "METHOD_EXTRACTION") {
    const asksSingleCellChromatin =
      primaryDomain === "SINGLE_CELL" ||
      primaryDomain === "MULTIOMICS" ||
      /(scrna|sc\s*rna|single[-\s]?cell|싱글셀|단일세포|scatac|sc\s*atac|atac[-\s]?seq|chromatin|크로마틴|multi[-\s]?omics|멀티오믹스)/i.test(t);

    if (asksSingleCellChromatin) {
      // Put the standard method catalog query before generic method queries so it is not dropped by the retrieval-query cap.
      queries.push(
        "LIGER iNMF Seurat Signac WNN ArchR GLUE MultiVI scvi-tools SnapATAC2 Harmony MOFA+ SCENIC SCENIC+ pySCENIC chromVAR Cicero cisTopic Cell Ranger RNA ATAC",
        "scRNA scATAC multiome integration LIGER Seurat WNN Signac ArchR GLUE MultiVI SnapATAC2 Harmony MOFA SCENIC"
      );
    }

    queries.push(
      "analysis method package software tool algorithm implementation benchmark",
      "single cell spatial transcriptomics scRNA scATAC integration package method tool",
      "used methods software packages tools models algorithms in papers"
    );
  }

  if (paperTalkIntent === "RESEARCH_IDEA") {
    queries.push("research gap future direction hypothesis validation project idea");
  }

  const queryLimit = paperTalkIntent === "PIPELINE_WORKFLOW" ? 8 : (paperTalkIntent === "METHOD_EXTRACTION" ? 6 : 4);
  return [...new Set(queries.filter(Boolean))].slice(0, queryLimit);
}
async function inferPaperTalkResearchIntentForChat(userMessage, env, cancelRuntime = null) {
  const text = String(userMessage || "").trim();
  const heuristic = heuristicPaperTalkPlanner(text);
  const heuristicQueries = buildPaperTalkRetrievalQueries(text, heuristic.primaryDomain, heuristic.paperTalkIntent);

  const fallback = {
    is_research_related: !isLikelyGeneralQuestionFast(text) || heuristic.paperTalkIntent !== "GENERAL",
    question_type:
      heuristic.paperTalkIntent === "LITERATURE_REVIEW" ? "LITERATURE" :
      heuristic.paperTalkIntent === "RESEARCH_IDEA" ? "RESEARCH" :
      heuristic.paperTalkIntent === "PIPELINE_WORKFLOW" ? "PIPELINE" :
      heuristic.paperTalkIntent === "METHOD_EXTRACTION" ? "METHOD" :
      heuristic.paperTalkIntent === "VALIDATION" ? "VALIDATION" :
      heuristic.paperTalkIntent === "COMPARISON" ? "COMPARISON" :
      heuristic.paperTalkIntent === "CONCEPT" ? "CONCEPT" :
      (isLikelyGeneralQuestionFast(text) ? "GENERAL" : "RESEARCH"),
    paper_talk_intent: heuristic.paperTalkIntent,
    primary_domain: heuristic.primaryDomain,
    answer_style:
      heuristic.paperTalkIntent === "LITERATURE_REVIEW" ? "paper_recommendation_by_theme" :
      heuristic.paperTalkIntent === "RESEARCH_IDEA" ? "actionable_project_ideas" :
      heuristic.paperTalkIntent === "PIPELINE_WORKFLOW" ? "end_to_end_workflow" :
      heuristic.paperTalkIntent === "METHOD_EXTRACTION" ? "practical_method_table" :
      "calm_research_mentor",
    // Conservative fallback: do not enter code-first mode without an explicit semantic planner decision.
    // This prevents paper-recommendation/literature questions from being hijacked by old keyword routing.
    wants_executable_code: false,
    should_generate_hypotheses: heuristic.paperTalkIntent === "RESEARCH_IDEA" || (!["METHOD_EXTRACTION", "PIPELINE_WORKFLOW"].includes(heuristic.paperTalkIntent) && /idea|ideas|아이디어|방향|주제|유망|promising|hypothesis|가설|validation|검증/i.test(text)),
    should_use_db_evidence: !isLikelyGeneralQuestionFast(text) || heuristic.paperTalkIntent !== "GENERAL",
    interpreted_intent: text.slice(0, 500),
    key_entities: [],
    retrieval_queries: heuristicQueries,
    retrieval_query: heuristicQueries.join(", "),
    gap_axes: [],
    hypothesis_angle: "",
    validation_angle: ""
  };

  if (!text || !env.OPENAI_API_KEY) return fallback;

  await cancelRuntime?.throwIfCanceled?.();
  const abortable = createLinkedAbortController(cancelRuntime, 9000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: abortable.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: [
              "You are the semantic intent, domain, and retrieval planner for Paper_Talk, a DB-grounded biomedical research GPT.",
              "Do not rely on fixed keywords. Infer the user's real task from the whole sentence and conversation context.",
              "Return strict JSON only.",
              "paper_talk_intent must be one of: LITERATURE_REVIEW, RESEARCH_IDEA, METHOD_EXTRACTION, PIPELINE_WORKFLOW, CONCEPT, VALIDATION, COMPARISON, PAPER_SUMMARY, SOURCE_TRACE, GENERAL.",
              "Use LITERATURE_REVIEW only when the user wants papers to read, recent trends, hot topics, representative studies, paper recommendations, or field overview.",
              "Use PIPELINE_WORKFLOW when the user wants an actual analysis pipeline, workflow, step-by-step procedure, analysis order, or end-to-end process. This must be paper-grounded: infer the user's keyword/entities and assay/domain, retrieve papers matching that keyword/domain, then extract workflows used in those papers.",
              "Use METHOD_EXTRACTION when the user wants practical analysis methods, packages, software, tools, algorithms, models, or wants to know what methods were actually used in papers.",
              "Important: if the user asks for a workflow/pipeline/analysis order, choose PIPELINE_WORKFLOW, not METHOD_EXTRACTION and not LITERATURE_REVIEW. A workflow request should first find relevant papers for the provided keyword/domain and then synthesize the workflow used in those papers; do not list generic tools only.",
              "Important: if the user asks what papers used, what researchers used, what analysis was done, which package/method/tool is used, or what can be used for actual data analysis, choose METHOD_EXTRACTION, not LITERATURE_REVIEW.",
              "Important: a question can mention papers, 논문, literature, or studies and still be METHOD_EXTRACTION if the goal is extracting methods/tools rather than recommending papers.",
              "Use RESEARCH_IDEA when the user asks what research can be done, project ideas, future directions, hypotheses, grant ideas, or actionable research topics.",
              "primary_domain must be one of: SPATIAL_BIOLOGY, CANCER_GENOMICS, SINGLE_CELL, IMMUNOLOGY, AGING, MULTIOMICS, AI_METHOD, GENERAL.",
              "If spatial/deep learning/cancer genomics appears, infer adjacent concepts such as spatial transcriptomics, histology, tumor microenvironment, multimodal AI, GNN, transformer, foundation model, immune niche, tumor evolution, and drug response.",
              "Create 3-4 concise English biomedical retrieval_queries for Paper_Talk DB.",
              "For PIPELINE_WORKFLOW, retrieval_queries must be keyword-anchored, domain-specific, and paper-grounded. Start from the exact user keyword/entities, then add workflow/pipeline/used methods/preprocessing/QC/downstream analysis terms. For spatial questions include Visium/Xenium/CosMx/MERFISH, spatial domains, deconvolution, cell-cell interaction, histology/image analysis. For single-cell or multiome questions include scRNA, scATAC, multiome, Seurat/Signac WNN, ArchR, LIGER, GLUE, MultiVI, SnapATAC2, SCENIC/SCENIC+ when relevant.",
              "For METHOD_EXTRACTION, retrieval_queries should include method-oriented terms such as analysis method, package, software, algorithm, model, implementation, benchmark, and the relevant assay/domain.",
              "Semantic code-routing rule: set wants_executable_code=true only when the user explicitly wants runnable code, a script, debugging, implementation, or executable commands. Do not set it true merely because the question mentions pipeline, workflow, spatial, Visium, package, or method.",
              "For literature recommendation, related-paper, follow-up-study, paper-summary, validation, comparison, concept, or research-idea questions, wants_executable_code must be false even if the topic includes computational terms.",
              "If the user is asking for papers similar to the active paper, related papers, papers to cite for follow-up research, or comparable studies, set is_related_paper_request=true. This must be semantic, not keyword-based.",
              "If the user wants an analysis workflow explained in prose from papers, choose PIPELINE_WORKFLOW but keep wants_executable_code=false unless they specifically ask for executable code.",
              "Return keys: is_research_related, question_type, paper_talk_intent, primary_domain, answer_style, wants_executable_code, is_related_paper_request, should_generate_hypotheses, should_use_db_evidence, interpreted_intent, key_entities, retrieval_queries, gap_axes, hypothesis_angle, validation_angle."
            ].join(" ")
          },
          { role: "user", content: text.slice(0, 1200) }
        ],
        temperature: 0,
        max_completion_tokens: 520
      })
    });

    const data = await readJsonResponseSafely(res, "OpenAI research intent inference request");
    let raw = extractOpenAIText(data);
    raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

    const parsed = JSON.parse(raw);
    const associationEvidenceStyle = isEvidenceStyleAssociationQuestion(text);
    const paperTalkIntent = associationEvidenceStyle
      ? "LITERATURE_REVIEW"
      : normalizePaperTalkIntentLabel(parsed.paper_talk_intent || parsed.question_type || fallback.paper_talk_intent);
    const primaryDomain = normalizePaperTalkDomainLabel(parsed.primary_domain || fallback.primary_domain);
    const queries = Array.isArray(parsed.retrieval_queries)
      ? parsed.retrieval_queries.map(v => String(v || "").trim()).filter(Boolean)
      : [];
    const retrievalQueryLimit = paperTalkIntent === "PIPELINE_WORKFLOW" ? 8 : (paperTalkIntent === "METHOD_EXTRACTION" ? 6 : 4);

    const inferred = {
      ...fallback,
      ...parsed,
      paper_talk_intent: paperTalkIntent,
      primary_domain: primaryDomain,
      is_research_related: Boolean(parsed.is_research_related) || paperTalkIntent !== "GENERAL",
      should_use_db_evidence: Boolean(parsed.should_use_db_evidence || parsed.is_research_related || paperTalkIntent !== "GENERAL"),
      wants_executable_code: toSemanticBoolean(parsed.wants_executable_code),
      is_related_paper_request: toSemanticBoolean(parsed.is_related_paper_request),
      should_generate_hypotheses: Boolean(parsed.should_generate_hypotheses || paperTalkIntent === "RESEARCH_IDEA") && !["METHOD_EXTRACTION", "PIPELINE_WORKFLOW"].includes(paperTalkIntent),
      question_type:
        paperTalkIntent === "LITERATURE_REVIEW" ? "LITERATURE" :
        paperTalkIntent === "RESEARCH_IDEA" ? "RESEARCH" :
        paperTalkIntent === "PIPELINE_WORKFLOW" ? "PIPELINE" :
        paperTalkIntent === "METHOD_EXTRACTION" ? "METHOD" :
        paperTalkIntent === "VALIDATION" ? "VALIDATION" :
        paperTalkIntent === "COMPARISON" ? "COMPARISON" :
        paperTalkIntent === "CONCEPT" ? "CONCEPT" :
        (parsed.question_type || fallback.question_type),
      answer_style: paperTalkIntent === "PIPELINE_WORKFLOW" ? "end_to_end_workflow" : (paperTalkIntent === "METHOD_EXTRACTION" ? "practical_method_table" : (parsed.answer_style || fallback.answer_style)),
      key_entities: Array.isArray(parsed.key_entities) ? parsed.key_entities.map(v => String(v || "").trim()).filter(Boolean).slice(0, 12) : [],
      retrieval_queries: queries.length ? queries.slice(0, retrievalQueryLimit) : buildPaperTalkRetrievalQueries(text, primaryDomain, paperTalkIntent),
      gap_axes: Array.isArray(parsed.gap_axes) ? parsed.gap_axes.map(v => String(v || "").trim()).filter(Boolean).slice(0, 8) : [],
      interpreted_intent: String(parsed.interpreted_intent || fallback.interpreted_intent).slice(0, 500),
      hypothesis_angle: String(parsed.hypothesis_angle || "").slice(0, 500),
      validation_angle: String(parsed.validation_angle || "").slice(0, 500)
    };

    if (inferred.is_research_related) {
      inferred.should_use_db_evidence = true;
      if (!inferred.retrieval_queries.includes(text)) inferred.retrieval_queries.unshift(text);
      inferred.retrieval_queries = [...new Set(inferred.retrieval_queries)].slice(0, retrievalQueryLimit);
    }
    inferred.retrieval_query = inferred.retrieval_queries.join(", ");

    return inferred;
  } catch (error) {
    if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
      throw new UserCanceledError();
    }
    return fallback;
  } finally {
    abortable.cleanup();
  }
}


/* v60: persistent supporting-paper memory for follow-up evidence questions */
async function ensureGptMessageSourcesTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS gpt_message_sources (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rank_index INTEGER NOT NULL,
      paper_label TEXT,
      post_id TEXT,
      title TEXT NOT NULL,
      source_url TEXT,
      pdf_link TEXT,
      similarity_score REAL,
      evidence_excerpt TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_gpt_message_sources_thread
    ON gpt_message_sources(thread_id, created_at)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_gpt_message_sources_message
    ON gpt_message_sources(message_id)
  `).run();
}


function estimateAdaptiveSupportingPaperLimit(context, outputStyle = "STANDARD") {
  const items = Array.isArray(context) ? context : [];
  if (!items.length) return 0;

  // Source/literature modes can use more papers because the user asked for papers.
  const maxLimit = outputStyle === "SOURCE_TRACE" || outputStyle === "LITERATURE_REVIEW" ? 10 : 8;

  const scores = items
    .map(item => Number(item?.similarity_score || 0))
    .filter(score => Number.isFinite(score) && score > 0);

  const topScores = scores.slice(0, Math.min(scores.length, 10));
  const best = topScores.length ? Math.max(...topScores) : 0;
  const average = topScores.length
    ? topScores.reduce((a, b) => a + b, 0) / topScores.length
    : 0;

  // Adaptive N:
  // - Narrow/focused evidence: 3~4 papers
  // - Moderately broad evidence: 5~6 papers
  // - Broad/diffuse research-direction questions: 7~10 papers
  if (items.length <= 3) return items.length;
  if (best >= 0.88 || average >= 0.76) return Math.min(4, items.length, maxLimit);
  if (best >= 0.72 || average >= 0.58) return Math.min(6, items.length, maxLimit);
  if (items.length >= 10) return Math.min(10, items.length, maxLimit);
  return Math.min(items.length, maxLimit);
}

function selectTopSupportingPapersForAnswer(context, limit = null, outputStyle = "STANDARD") {
  const seen = new Set();
  const selected = [];
  const adaptiveLimit = limit || estimateAdaptiveSupportingPaperLimit(context, outputStyle) || 0;

  for (const item of Array.isArray(context) ? context : []) {
    const normalized = normalizeKnowledgeItem(item) || item;
    const title = bestDisplayPaperTitleFromItem(normalized);
    if (!title) continue;

    const key = normalizeSearchText(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    selected.push({ ...normalized, title });
    if (selected.length >= adaptiveLimit) break;
  }

  return selected;
}

function isSupportingPaperFollowUp(message) {
  return isExplicitSourceTraceRequest(message);
}

function getRequestedPaperOrdinal(message) {
  const text = String(message || "").toLowerCase();

  const letter = text.match(/(?:논문|paper)\s*([a-e])/i);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;

  const digit = text.match(/(?:논문|paper)?\s*([1-5])\s*(?:번째|번|paper|논문)?/i);
  if (digit) return Number(digit[1]) - 1;

  if (/첫\s*번째/.test(text)) return 0;
  if (/두\s*번째/.test(text)) return 1;
  if (/세\s*번째/.test(text)) return 2;
  if (/네\s*번째/.test(text)) return 3;
  if (/다섯\s*번째/.test(text)) return 4;

  return null;
}


function isPaperRecommendationRequest(message) {
  return heuristicPaperTalkPlanner(message).paperTalkIntent === "LITERATURE_REVIEW";
}

function isEvidenceStyleAssociationQuestion(message) {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Broad biological association / crosstalk questions should behave like the
  // older Paper_Talk style: answer the biology first, then show a few retrieved
  // DB paper titles as supporting context. This preserves the preferred answer
  // style for questions such as CAF-macrophage immune exclusion.
  const asksAssociation = /(association|associated|relationship|relation|correlation|correlated|link|linked|crosstalk|cross-talk|interaction|interact|connected|connection|관련|연관|관계|상관|상호작용)/i.test(text);
  const hasCancerImmuneContext = /(caf|fibroblast|fibroblasts|macrophage|macrophages|tam|tams|immune|immuno|immunosuppression|immunosuppressive|suppression|excluded|exclusion|tme|tumou?r microenvironment|cancer|tumou?r|면역|면역억제|면역배제|대식세포|섬유아세포|종양미세환경|암)/i.test(text);
  const notMethodOrPipeline = !/(pipeline|workflow|package|software|tool|method|algorithm|파이프라인|워크플로우|패키지|툴|도구|방법론|분석법)/i.test(text);

  return asksAssociation && hasCancerImmuneContext && notMethodOrPipeline;
}

function isResearchDirectionRequest(message) {
  return heuristicPaperTalkPlanner(message).paperTalkIntent === "RESEARCH_IDEA";
}


function isContinuationMoreRequest(message) {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();

  return (
    /(더\s*주세요|더\s*줘|더\s*알려|추가로|추가\s*추천|다른\s*것도|다른\s*논문|비슷한\s*논문|유사한\s*논문|관련\s*논문|같은\s*주제|후속\s*연구|비슷한\s*연구|관련\s*연구|더\s*많이|몇\s*개\s*더|[0-9]+\s*개\s*더|끝인가요|끝이야|더\s*있|more|more papers|similar papers?|related papers?|other papers?|give me more|another|additional)/i.test(text)
  );
}

function isPaperHighlightOrShortSummaryFollowUp(message) {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return false;

  // Short follow-ups such as "하이라이트를 줘", "한줄로", "영어로 줘",
  // "아니 앞에는 논문 하이라이트를 한줄만 달라고" must keep the previous
  // paper/topic context instead of being treated as a brand-new generic question.
  const shortEnough = text.length <= 260;
  const hasFollowUpTask = /(?:하이라이트|highlight|핵심|중요\s*부분|중요한\s*부분|takeaway|key\s*point|main\s*finding|summary|summari[sz]e|résumé|résume|résumer|resumen|resumir|sumario|zusammenfassung|riassunto|sintesi|要約|总结|總結|摘要|요약|한\s*줄|한줄|1\s*줄|one[-\s]?line|one\s*sentence|짧게|간단히|영어로|한국어로|한글로|번역|다시|rewrite|rephrase|앞에는|위에는|방금|아까|이\s*논문|그\s*논문|this\s+paper|that\s+paper|previous\s+paper|above)/i.test(text);
  const hasLooseRequestIntent = hasAnyLanguageAgnosticIntentTerm(text, [
    "summary", "summarize", "summarise", "highlight", "takeaway", "translate", "shorter", "longer", "again",
    "요약", "정리", "하이라이트", "핵심", "번역", "짧게", "다시",
    "résumé", "résumer", "resumen", "resumir", "sumario",
    "zusammenfassung", "riassunto", "sintesi", "要約", "总结", "總結", "摘要"
  ]);
  const hasNewLongScientificTitle = /[A-Za-z0-9][A-Za-z0-9:+,()\/[\] ._-]{45,}/.test(text);

  return shortEnough && (hasFollowUpTask || hasLooseRequestIntent || isSafeUniversalShortFollowUpShape(text)) && !hasNewLongScientificTitle;
}

function isAutomaticPreviousContextFollowUp(message) {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return false;

  // Very short follow-ups in any language should automatically inherit the previous
  // paper/topic context. The user should not have to repeat the paper title.
  // Examples: "하이라이트를 줘", "한줄로", "영어로", "좀 더 자세히",
  // "앞에는 논문 하이라이트를 한줄만 달라고", "translate", "make it shorter",
  // or short typo/noisy messages in other scripts.
  const shortEnough = text.length <= 320;

  const explicitFollowUpTask = /(하이라이트|highlight|highlights|핵심|중요\s*부분|중요한\s*부분|takeaway|takeaways|key\s*point|key\s*points|main\s*finding|main\s*findings|요약|summary|summari[sz]e|resumen|resumir|résumé|résume|résumer|sumario|zusammenfassung|riassunto|sintesi|要約|总结|總結|摘要|한\s*줄|한줄|1\s*줄|one[-\s]?line|one\s*sentence|짧게|간단히|briefly|shortly|concise|좀\s*더|더\s*자세히|자세히|풀어서|영어로|한국어로|한글로|일본어로|중국어로|다국어|multilingual|multi[-\s]?language|번역|translate|translation|다시|rewrite|rephrase|paraphrase|앞에는|위에는|방금|아까|이\s*논문|그\s*논문|this\s+paper|that\s+paper|previous\s+paper|above|it|this|that)/i.test(text);

  const isJustFormatInstruction = /^(하이라이트(를)?\s*줘|하이라이트만|핵심만|요약해줘|요약|한\s*줄로?|한줄로?|1\s*줄로?|영어로(\s*줘)?|한국어로(\s*줘)?|한글로(\s*줘)?|짧게|간단히|다시|more|shorter|longer|translate|summari[sz]e|summary|résumé|résume|résumer|resumen|resumir|sumario|zusammenfassung|riassunto|sintesi|要約|总结|總結|摘要|highlight)$/i.test(text);
  const hasLooseRequestIntent = hasAnyLanguageAgnosticIntentTerm(text, [
    "summary", "summarize", "summarise", "highlight", "takeaway", "translate", "shorter", "longer", "again", "more",
    "요약", "정리", "하이라이트", "핵심", "번역", "짧게", "다시", "자세히",
    "résumé", "résumer", "resumen", "resumir", "sumario",
    "zusammenfassung", "riassunto", "sintesi", "要約", "总结", "總結", "摘要"
  ]);
  const universalShortFollowUp = isSafeUniversalShortFollowUpShape(text);

  // If the user pasted a new long scientific title, treat it as a new paper query,
  // not as a follow-up. Otherwise inherit the previous context.
  const hasNewLongScientificTitle = /[A-Za-z0-9][A-Za-z0-9:+,()\/[\] ._-]{55,}/.test(text) && !/(이\s*논문|그\s*논문|this\s+paper|that\s+paper|앞에는|위에는|방금|아까)/i.test(text);

  return shortEnough && (explicitFollowUpTask || isJustFormatInstruction || hasLooseRequestIntent || universalShortFollowUp) && !hasNewLongScientificTitle;
}

function isContextualThreadFollowUpRequest(message) {
  return (
    isContinuationMoreRequest(message) ||
    isPaperHighlightOrShortSummaryFollowUp(message) ||
    isAutomaticPreviousContextFollowUp(message)
  );
}

function isExplicitSourceTraceRequest(message) {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Only explicit evidence/source tracing should enter SOURCE_TRACE.
  // "더 주세요", "다른 논문", "추가 추천" should NOT match this.
  return (
    /(어떤\s*논문\s*기반|무슨\s*논문\s*기반|어떤\s*논문을\s*기반|근거\s*논문|참고\s*논문|사용한\s*논문|기반으로\s*한\s*논문|출처|레퍼런스|reference|references|source|sources|citation|cite|based on which papers|which papers did you use)/i.test(text)
  );
}

async function getRecentThreadMessagesForContinuation({ threadId, userId, env, limit = 8 }) {
  if (!threadId || !userId || threadId === "guest") return [];

  const rows = await env.DB.prepare(`
    SELECT role, content, created_at
    FROM gpt_messages
    WHERE thread_id = ?
      AND user_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT ?
  `).bind(threadId, userId, limit).all();

  return (rows.results || []).reverse();
}


function getFollowUpAnswerLanguageOverride(message) {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Explicit target language should override the language of older context.
  // This prevents a short follow-up such as "in English" from being answered in Korean
  // only because the previous message/context was Korean.
  if (/(영어로|영문으로|english|in english|to english)/i.test(text)) return "English";
  if (/(한국어로|한글로|한글|korean|in korean|to korean)/i.test(text)) return "Korean";
  if (/(일본어로|일어로|japanese|in japanese|to japanese)/i.test(text)) return "Japanese";
  if (/(중국어로|중문으로|chinese|in chinese|to chinese)/i.test(text)) return "Chinese";

  // Language-neutral multilingual request. Use English as the safe fallback unless
  // the user names exact target languages in the same request.
  if (/(다국어|여러\s*언어|multilingual|multi[-\s]?language|several languages|multiple languages)/i.test(text)) {
    return "Multilingual";
  }

  return "";
}

function buildContinuationQuestionFromHistory({ currentMessage, recentMessages }) {
  const current = String(currentMessage || "").trim();
  const messages = Array.isArray(recentMessages) ? recentMessages : [];

  const previousUserMessages = messages
    .filter(m => m.role === "user")
    .map(m => String(m.content || "").trim())
    .filter(v => v && v !== current);

  const previousAssistantMessages = messages
    .filter(m => m.role === "assistant")
    .map(m => String(m.content || "").trim())
    .filter(Boolean);

  const lastUser = previousUserMessages.length
    ? previousUserMessages[previousUserMessages.length - 1]
    : "";

  // Use the previous substantial user question as the topic.
  const topicUser = [...previousUserMessages].reverse().find(v =>
    v.length >= 8 &&
    !isContinuationMoreRequest(v) &&
    !isExplicitSourceTraceRequest(v)
  ) || lastUser;

  const lastAssistant = previousAssistantMessages.length
    ? previousAssistantMessages[previousAssistantMessages.length - 1].slice(0, 1800)
    : "";

  const languageOverride = getFollowUpAnswerLanguageOverride(current);

  return [
    "AUTO-CONTEXT FOLLOW-UP MODE",
    "The current user message is a short follow-up. Automatically inherit the previous paper/topic context.",
    "Do NOT ask the user what topic or paper they mean.",
    "Do NOT answer generically.",
    languageOverride ? `ANSWER_LANGUAGE_OVERRIDE: ${languageOverride}` : "",
    "LANGUAGE RULE:",
    "- The CURRENT_FOLLOW_UP_REQUEST controls the answer language and format.",
    "- If the current request names a target language, answer in that target language.",
    "- If the current request asks for multilingual output, provide a compact multilingual answer and do not default to Korean.",
    "- If no target language is named, answer in the language of the current user request; if it is too short or language-neutral, keep the previous assistant answer language.",
    "- Never force Korean just because older context contains Korean text.",
    topicUser ? `PREVIOUS_USER_TOPIC: ${topicUser}` : "",
    lastAssistant ? `PREVIOUS_ASSISTANT_CONTEXT: ${lastAssistant}` : "",
    `CURRENT_FOLLOW_UP_REQUEST: ${current}`,
    "",
    "Required behavior:",
    "1. Use PREVIOUS_USER_TOPIC and PREVIOUS_ASSISTANT_CONTEXT as the target paper/topic.",
    "2. If the user asks for a highlight, key point, takeaway, or equivalent in any language, give the highlight of that previous paper/topic directly.",
    "3. If the user asks for one line or one sentence, answer in exactly one concise sentence.",
    "4. If the user asks for translation or rewriting into a target language, translate or rewrite the previous answer/topic accordingly.",
    "5. If the previous context contains a paper title, keep that paper as the subject.",
    "6. Never ask for clarification unless there is truly no previous context."
  ].filter(Boolean).join("\\n");
}

function inferContinuationOutputStyle({ currentMessage, previousTopic, previousAssistant, fallbackStyle }) {
  const combined = [currentMessage, previousTopic, previousAssistant].join(" ").toLowerCase();

  // If the previous topic or assistant answer was about recommending papers, "더 주세요" should
  // continue paper recommendation, not source tracing and not generic research insight.
  if (
    isPaperRecommendationRequest(previousTopic) ||
    /(논문\s*추천|관련\s*논문|트렌디한\s*논문|추천\s*논문|paper recommendation|related papers|recent papers|latest papers)/i.test(combined)
  ) {
    return "LITERATURE_REVIEW";
  }

  if (isPaperHighlightOrShortSummaryFollowUp(currentMessage)) {
    return "PAPER_SUMMARY";
  }

  if (isResearchDirectionRequest(previousTopic) || /(유망|앞으로|연구\s*방향|future direction|promising|research direction|아이디어|가설|gap)/i.test(combined)) {
    return "RESEARCH_INSIGHT";
  }

  return fallbackStyle || "RESEARCH_SYNTHESIS";
}

async function getLastSupportingPapersForThread({ threadId, userId, env }) {
  await ensureGptMessageSourcesTable(env);

  const last = await env.DB.prepare(`
    SELECT message_id
    FROM gpt_message_sources
    WHERE thread_id = ?
      AND user_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(threadId, userId).first();

  if (!last?.message_id) return [];

  const rows = await env.DB.prepare(`
    SELECT
      rank_index,
      paper_label,
      post_id,
      title,
      source_url,
      pdf_link,
      similarity_score,
      evidence_excerpt
    FROM gpt_message_sources
    WHERE message_id = ?
      AND thread_id = ?
      AND user_id = ?
    ORDER BY rank_index ASC
    LIMIT 10
  `).bind(last.message_id, threadId, userId).all();

  return rows.results || [];
}

function formatStoredSupportingPapersAnswer(rows, userMessage = "") {
  const papers = Array.isArray(rows) ? rows : [];
  if (!papers.length) {
    return "직전 답변에 저장된 근거 논문 목록을 찾지 못했습니다. 같은 thread에서 먼저 연구 질문을 한 뒤 다시 물어보면, 그 답변에 사용된 Paper_Talk DB 논문을 보여드릴 수 있습니다.";
  }

  const requestedIndex = getRequestedPaperOrdinal(userMessage);
  const target =
    requestedIndex !== null && requestedIndex >= 0 && requestedIndex < papers.length
      ? papers[requestedIndex]
      : null;

  if (target) {
    const label = target.paper_label || `논문 ${String.fromCharCode(65 + Number(target.rank_index || requestedIndex))}`;
    return [
      `${target.title}`,
      target.source_url ? `Article URL: ${target.source_url}` : "",
      target.pdf_link ? `PDF URL: ${target.pdf_link}` : "",
      target.evidence_excerpt ? `이 답변에서 사용한 DB excerpt: ${String(target.evidence_excerpt).slice(0, 900)}` : "",
      "",
      "이 논문을 더 자세히 요약하거나, 이 논문만 기반으로 연구 가설을 다시 정리할 수 있습니다."
    ].filter(Boolean).join("\n");
  }

  return [
    "직전 답변은 아래 Paper_Talk DB 논문들을 기반으로 생성했습니다.",
    "",
    ...papers.map((paper, index) => {
      const label = paper.paper_label || `논문 ${String.fromCharCode(65 + index)}`;
      const links = [paper.source_url ? `Article: ${paper.source_url}` : "", paper.pdf_link ? `PDF: ${paper.pdf_link}` : ""]
        .filter(Boolean)
        .join(" | ");
      return `${index + 1}. ${paper.title}${links ? "\n   " + links : ""}`;
    })
  ].join("\n");
}

async function saveSupportingPapersForAssistantMessage({ assistantMessageId, threadId, userId, context, env }) {
  const selected = selectTopSupportingPapersForAnswer(context);
  if (!assistantMessageId || !threadId || !userId || !selected.length) return;

  await ensureGptMessageSourcesTable(env);

  const statements = selected.map((item, index) => {
    const title = cleanBibtexText(item?.title || "").trim();
    const excerpt = cleanBibtexText(item?.matched_chunk || makeBestEvidenceExcerpt(item?.content || "")).slice(0, 1200);

    return env.DB.prepare(`
      INSERT INTO gpt_message_sources (
        id,
        message_id,
        thread_id,
        user_id,
        rank_index,
        paper_label,
        post_id,
        title,
        source_url,
        pdf_link,
        similarity_score,
        evidence_excerpt,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      assistantMessageId,
      threadId,
      userId,
      index,
      `논문 ${String.fromCharCode(65 + index)}`,
      item?.post_id || "",
      title,
      item?.source_url || "",
      item?.pdf_link || "",
      item?.similarity_score || null,
      excerpt
    );
  });

  if (statements.length) {
    await env.DB.batch(statements);
  }
}

async function retrievePaperTalkDbForResearchIntent(userMessage, inferredIntent, env, gptKey = DEFAULT_GPT_KEY, cancelRuntime = null) {
  gptKey = normalizeGptKey(gptKey);
  // v57 safe DB-grounded retrieval:
  // Research questions should always consult Paper_Talk DB, but the chat path must stay bounded.
  // Do NOT call the older broad retrieval stack here, because it can trigger many D1/Vectorize/OpenAI
  // calls and Cloudflare may return an HTML 503 page before our JSON catch can run.
  const text = String(userMessage || "").trim();
  if (!text) return [];
  await cancelRuntime?.throwIfCanceled?.();

  const rawQueries = [
    text,
    ...(Array.isArray(inferredIntent?.retrieval_queries) ? inferredIntent.retrieval_queries : []),
    ...(Array.isArray(inferredIntent?.key_entities) ? inferredIntent.key_entities : []),
    inferredIntent?.primary_domain || ""
  ]
    .map(v => String(v || "").trim())
    .filter(Boolean);

  // Keep only a few short, meaningful queries. This is the key CPU/subrequest guard.
  const uniqueQueries = [...new Set(rawQueries)]
    .map(q => q.slice(0, 180))
    .filter(q => q.length >= 2)
    .slice(0, 4);

  const all = [];

  for (const query of uniqueQueries) {
    await cancelRuntime?.throwIfCanceled?.();
    try {
      const items = await safeRetrievePaperContextForChat(query, env, gptKey);
      await cancelRuntime?.throwIfCanceled?.();
      if (Array.isArray(items) && items.length) all.push(...items);
    } catch (error) {
      if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
        throw new UserCanceledError();
      }
      // Keep the route alive. Retrieval failure should not turn into an HTML 503 response.
    }

    // Stop early once we already have enough DB evidence for answer generation.
    if (mergeKnowledgeResults(all).length >= PAPER_TALK_MAX_CHAT_CONTEXT_ITEMS) break;
  }

  await cancelRuntime?.throwIfCanceled?.();
  const merged = trimContextForChat(mergeKnowledgeResults(all));

  // Optional tiny fallback: if inferred English queries missed Korean/mixed-language text,
  // retry once with the likely title/scientific span. Still safe and bounded.
  if (!merged.length) {
    try {
      const titleCandidate = extractLikelyPaperTitleForSafeLookup(text);
      if (titleCandidate && titleCandidate !== text) {
        return trimContextForChat(await safeRetrievePaperContextForChat(titleCandidate, env, gptKey));
      }
    } catch (error) {
      if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
        throw new UserCanceledError();
      }
    }
  }

  return merged;
}


// ======================================
// Code-first pipeline request support
// ======================================
function isPipelineCodeRequest(value = "") {
  const text = String(value || "").toLowerCase();
  if (!text.trim()) return false;

  const asksCode = /코드|스크립트|script|code|pipeline code|workflow code|bash|shell|sh\b|snakemake|nextflow|r code|r코드|r script|python|파이썬|실행\s*가능|실행가능|구현|implementation/.test(text);
  const pipelineData = /bulk\s*rna|bulk\s*rnaseq|bulk\s*rna-seq|rna\s*seq|rna-seq|fastq|fq\.gz|sc\s*rna|scrna|single[- ]cell|single cell|visium|xenium|spatial|spatial transcriptomics|10x|cellranger|cell ranger|seurat|scanpy|deseq2|featurecounts|star\b|hisat2|salmon|kallisto/.test(text);

  return asksCode && pipelineData;
}

function detectRequestedCodeLanguage(value = "") {
  const text = String(value || "").toLowerCase();
  const wantsR = /\br\b|r코드|r code|r script|r로|r으로|deseq2|edger|seurat|bioconductor/.test(text);
  const wantsPython = /python|파이썬|py\b|scanpy|anndata|pandas|snakemake/.test(text);
  const wantsShell = /bash|shell|\.sh|command line|cli|터미널|fastqc|star\b|hisat2|featurecounts|salmon|kallisto/.test(text);

  if (wantsR && !wantsPython && !wantsShell) return "R";
  if (wantsPython && !wantsR && !wantsShell) return "Python";
  if (wantsShell && !wantsR && !wantsPython) return "Bash";
  if (wantsR && wantsShell && !wantsPython) return "Bash + R";
  if (wantsPython && wantsShell && !wantsR) return "Bash + Python";
  if (wantsR && wantsPython) return "R + Python";
  return "auto";
}

function detectPipelineDataTypes(value = "") {
  const text = String(value || "").toLowerCase();
  const types = [];

  if (/bulk\s*rna|bulk\s*rnaseq|bulk\s*rna-seq|rna\s*seq|rna-seq|fastq|featurecounts|deseq2|edger|star\b|hisat2|salmon|kallisto/.test(text)) {
    types.push("bulk_rna_seq_fastq");
  }
  if (/scrna|sc\s*rna|single[- ]cell|single cell|seurat|scanpy|cellranger|cell ranger|10x/.test(text)) {
    types.push("scrna_seq");
  }
  if (/visium|spatial transcriptomics|spaceranger|space ranger/.test(text)) {
    types.push("visium");
  }
  if (/xenium|xoa|xenium explorer|in situ/.test(text)) {
    types.push("xenium");
  }

  return types.length ? types : ["auto_detect_from_question"];
}

function looksLikeCodeChunk(text = "") {
  const value = String(text || "");
  if (!value.trim()) return false;

  return /```|^\s*#!|\bimport\s+[A-Za-z0-9_.]+|\bfrom\s+[A-Za-z0-9_.]+\s+import\b|\blibrary\s*\(|\brequire\s*\(|<-\s*|%>%|\bfunction\s*\(|\bfor\s*\(|\bif\s*\(|\bdef\s+|\bclass\s+|\bsnakemake\b|\brule\s+\w+\s*:|\bprocess\s+\w+\s*\{|\bfastqc\b|\bmultiqc\b|\btrim_galore\b|\bcutadapt\b|\bSTAR\b|\bhisat2\b|\bfeatureCounts\b|\bsalmon\b|\bkallisto\b|\bDESeqDataSetFromMatrix\b|\bDESeq\s*\(|\bFindMarkers\s*\(|\bRead10X\s*\(|\bread10x\b|\bscanpy\b|\bsc\.\w+/im.test(value);
}

function scorePipelineCodeChunk(row, queryText) {
  const haystack = [row.title, row.file_name, row.source_type, row.text].map(v => String(v || "").toLowerCase()).join("\n");
  const query = String(queryText || "").toLowerCase();
  let score = 0;

  if (/\.py$/i.test(String(row.file_name || "")) || /python/i.test(String(row.source_type || ""))) score += 8;
  if (/\.r$/i.test(String(row.file_name || "")) || /r_code|r script/i.test(String(row.source_type || ""))) score += 8;
  if (/code/i.test(String(row.source_type || ""))) score += 7;
  if (looksLikeCodeChunk(row.text)) score += 6;

  const terms = [
    "bulk", "rna", "rna-seq", "rnaseq", "fastq", "fastqc", "multiqc", "trim", "star", "hisat2", "featurecounts", "deseq2", "edger", "salmon", "kallisto",
    "scrna", "single-cell", "single cell", "seurat", "scanpy", "cellranger", "10x",
    "visium", "spaceranger", "spatial", "xenium"
  ];

  for (const term of terms) {
    if (query.includes(term) && haystack.includes(term)) score += 3;
  }

  return score;
}

async function retrievePipelineCodeContext({ userMessage, gptKey, env }) {
  if (!env.DB) return [];
  await ensurePaperFullTextTables(env);
  await ensureSpecialistGptTables(env);

  const normalizedGptKey = normalizeGptKey(gptKey);
  const rows = await env.DB.prepare(`
    SELECT title, source_url, pdf_link, file_name, source_type, text, chunk_index, created_at
    FROM paper_fulltext_chunks
    WHERE COALESCE(gpt_key, 'paper_talk') = ?
      AND (
        lower(COALESCE(file_name, '')) LIKE '%.py'
        OR lower(COALESCE(file_name, '')) LIKE '%.r'
        OR lower(COALESCE(source_type, '')) LIKE '%code%'
        OR instr(text, char(96) || char(96) || char(96)) > 0
        OR text LIKE '%library(%'
        OR text LIKE '%import %'
        OR text LIKE '%from % import%'
        OR text LIKE '%fastqc%'
        OR text LIKE '%multiqc%'
        OR text LIKE '%trim_galore%'
        OR text LIKE '%cutadapt%'
        OR text LIKE '%STAR%'
        OR text LIKE '%hisat2%'
        OR text LIKE '%featureCounts%'
        OR text LIKE '%DESeq%'
        OR text LIKE '%edgeR%'
        OR text LIKE '%Seurat%'
        OR text LIKE '%scanpy%'
        OR text LIKE '%cellranger%'
        OR text LIKE '%spaceranger%'
        OR text LIKE '%xenium%'
      )
    ORDER BY datetime(created_at) DESC, chunk_index ASC
    LIMIT 80
  `).bind(normalizedGptKey).all();

  const scored = (rows.results || [])
    .map(row => ({ ...row, _score: scorePipelineCodeChunk(row, userMessage) }))
    .filter(row => row._score > 0 || looksLikeCodeChunk(row.text))
    .sort((a, b) => b._score - a._score)
    .slice(0, 14);

  return scored;
}

function buildPipelineCodeContextText(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return "NO_UPLOADED_CODE_OR_PDF_CODE_CONTEXT_FOUND";

  return rows.map((row, index) => {
    const title = cleanBibtexText(row.title || "");
    const fileName = cleanBibtexText(row.file_name || "");
    const sourceType = cleanBibtexText(row.source_type || "");
    const text = String(row.text || "").slice(0, 5500);

    return [
      `CODE_CONTEXT_${index + 1}`,
      title ? `TITLE: ${title}` : "",
      fileName ? `FILE_NAME: ${fileName}` : "",
      sourceType ? `SOURCE_TYPE: ${sourceType}` : "",
      `CHUNK_INDEX: ${row.chunk_index ?? ""}`,
      "CONTENT:",
      text
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n").slice(0, 52000);
}

async function callOpenAIForPipelineCode({ userMessage, effectiveMessage, codeRows, gptProfile }, env, cancelRuntime = null) {
  const requestedLanguage = detectRequestedCodeLanguage(userMessage + "\n" + effectiveMessage);
  const dataTypes = detectPipelineDataTypes(userMessage + "\n" + effectiveMessage);
  const codeContextText = buildPipelineCodeContextText(codeRows);
  const userLanguage = detectUserLanguage(userMessage);
  const isKo = userLanguage === "Korean";

  const prompt = `
You are ${gptProfile?.title || "Paper_Talk Vision GPT"} in CODE-FIRST PIPELINE MODE.

The user explicitly asked for executable code or script. Do not answer with a literature review, paper list, related-pipeline papers, or workflow-only explanation.

User language: ${userLanguage}
Requested output language for prose: ${isKo ? "Korean" : "same language as user"}
Requested code language: ${requestedLanguage}
Detected data type(s): ${dataTypes.join(", ")}

Hard rules:
1. Start with runnable code blocks immediately.
2. Do not start with "먼저 찾은 관련 pipeline 논문" or any related-paper section.
3. Do not ask a clarification question when the data type and request are already clear.
4. If uploaded Python code is found but the user asks for R, translate the logic into R.
5. If uploaded R code is found but the user asks for Python, translate the logic into Python.
6. If uploaded PDF/TXT contains code-like snippets, use them as implementation hints.
7. If uploaded code is missing, generate a standard practical pipeline from bioinformatics best practice.
8. If the question mixes bulk RNA-seq, scRNA-seq, Visium, and Xenium, infer which one is requested from the words in the current user question. If multiple are requested, separate the code by data type.
9. For "bulk RNA-seq FASTQ pipeline code", provide at minimum:
   - Bash shell pipeline: FastQC, MultiQC, trimming, STAR or HISAT2 alignment, samtools, featureCounts.
   - R DESeq2 script from featureCounts output to differential expression result.
10. Use realistic placeholders such as /path/to/genomeDir, annotation.gtf, samples.tsv, condition column, and explain where the user should edit paths.
11. Keep explanations short and after the code.
12. Do not invent that a specific paper used a tool unless the context explicitly says so.
13. Return plain text with markdown fenced code blocks.

Uploaded code/PDF-code context:
${codeContextText}
  `.trim();

  const abortable = createLinkedAbortController(cancelRuntime, 120000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: abortable.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: String(effectiveMessage || userMessage || "").slice(0, 2400) }
        ],
        temperature: 0.15,
        max_completion_tokens: 4500
      })
    });

    const data = await readJsonResponseSafely(response, "OpenAI pipeline-code answer request");
    return extractOpenAIText(data) || getOpenAIErrorMessage(data);
  } catch (error) {
    if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
      throw new UserCanceledError();
    }
    return `OpenAI pipeline-code request failed: ${error?.message || error}`;
  } finally {
    abortable.cleanup();
  }
}

async function gptChat(request, env) {
  let activeCancelId = "";
  let activeCancelOwnerKey = "";
  const bodyForAccess = await request.clone().json().catch(() => ({}));
  const gptKeyForAccess = getGptKeyFromRequestData(bodyForAccess);
  const neuroAccessError = requireNeuroGptAccessIfNeeded(request, env, gptKeyForAccess);
  if (neuroAccessError) return neuroAccessError;

  try {
    const user = await getSession(request, env);
    const isGuest = !user;

    if (!env.OPENAI_API_KEY) {
      return json({ ok: false, error: "OPENAI_API_KEY is missing." }, 500);
    }

    await ensureSpecialistGptTables(env);

    const data = await request.json().catch(() => ({}));
    const rawMessage = String(data.message || "").trim();
    const message = normalizeChatInputNoise(rawMessage);
    const gptKey = getGptKeyFromRequestData(data);
    const gptProfile = getGptProfile(gptKey);
    let threadId = String(data.threadId || "").trim();

    const cancelId = normalizeGptCancelId(data.cancelId || data.requestId || data.chatRequestId || "");
    const cancelOwnerKey = await getGptCancelOwnerKey(request, env, user);
    activeCancelId = cancelId;
    activeCancelOwnerKey = cancelOwnerKey;
    const cancelRuntime = makeGptCancelRuntime({ request, env, cancelId, ownerKey: cancelOwnerKey });
    await registerGptCancellableRequest({ env, cancelId, ownerKey: cancelOwnerKey, gptKey });
    await cancelRuntime.throwIfCanceled();

    if (!message) {
      return json({ ok: false, error: "Message is required." }, 400);
    }

    await cancelRuntime.throwIfCanceled();

    const quotaBefore = isGuest
      ? await getGuestGptQuota(request, env)
      : await getMonthlyGptQuota(user.id, env, user);

    if (quotaBefore.used >= quotaBefore.limit) {
      return json({
        ok: false,
        guest: isGuest,
        signupRequired: isGuest,
        signupUrl: isGuest ? "/auth/google" : null,
        error: isGuest
          ? `You have used all 3 free guest questions today. Please sign up for free with Google to continue with ${SIGNED_IN_TOTAL_GPT_MONTHLY_LIMIT} total GPT questions per month.`
          : `Monthly limit reached. You have used all ${SIGNED_IN_TOTAL_GPT_MONTHLY_LIMIT} total GPT questions for this month across Paper_Talk Vision GPT and all Specialist GPTs. Your quota will reset automatically next month.`,
        quota: {
          used: quotaBefore.used,
          limit: quotaBefore.limit,
          remaining: 0,
          monthKey: quotaBefore.monthKey || null,
          date: quotaBefore.todayKey || null,
          resetsAt: quotaBefore.resetsAt
        }
      }, 429);
    }

    if (!isGuest) {
      if (!threadId) {
        threadId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO gpt_threads (id, user_id, title, gpt_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(threadId, user.id, message.slice(0, 60) || 'New chat', gptKey).run();
      } else {
        const thread = await env.DB.prepare(`
          SELECT id FROM gpt_threads WHERE id = ? AND user_id = ? AND COALESCE(gpt_key, 'paper_talk') = ?
        `).bind(threadId, user.id, gptKey).first();
        if (!thread) return json({ ok: false, error: "Thread not found." }, 404);
      }

      await env.DB.prepare(`
        INSERT INTO gpt_messages (id, thread_id, user_id, role, content, gpt_key, created_at)
        VALUES (?, ?, ?, 'user', ?, ?, CURRENT_TIMESTAMP)
      `).bind(crypto.randomUUID(), threadId, user.id, message, gptKey).run();
    } else {
      threadId = "guest";
    }

    let recentMessagesForContinuation = [];
    let effectiveMessage = message;
    let forcedOutputStyle = "";

    if (!isGuest && isContextualThreadFollowUpRequest(message)) {
      recentMessagesForContinuation = await getRecentThreadMessagesForContinuation({
        threadId,
        userId: user.id,
        env,
        limit: 8
      });

      effectiveMessage = buildContinuationQuestionFromHistory({
        currentMessage: message,
        recentMessages: recentMessagesForContinuation
      });

      const previousTopic = recentMessagesForContinuation
        .filter(m => m.role === "user")
        .map(m => String(m.content || "").trim())
        .reverse()
        .find(v => v && v !== message && !isContextualThreadFollowUpRequest(v) && !isExplicitSourceTraceRequest(v)) || "";

      const previousAssistant = recentMessagesForContinuation
        .filter(m => m.role === "assistant")
        .map(m => String(m.content || "").trim())
        .reverse()[0] || "";

      forcedOutputStyle = inferContinuationOutputStyle({
        currentMessage: message,
        previousTopic,
        previousAssistant,
        fallbackStyle: ""
      });
    }


    if (!isGuest && isSupportingPaperFollowUp(message)) {
      const rows = await getLastSupportingPapersForThread({ threadId, userId: user.id, env });
      const sourceAnswer = formatStoredSupportingPapersAnswer(rows, message);
      const assistantMessageId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO gpt_messages (id, thread_id, user_id, role, content, gpt_key, created_at)
        VALUES (?, ?, ?, 'assistant', ?, ?, CURRENT_TIMESTAMP)
      `).bind(assistantMessageId, threadId, user.id, sourceAnswer, gptKey).run();

      await env.DB.prepare(`
        UPDATE gpt_threads
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).bind(threadId, user.id).run();

      const quotaAfter = await incrementMonthlyGptUsage(user.id, env);

      return json({
        ok: true,
        guest: false,
        threadId,
        answer: sourceAnswer,
        quota: {
          used: quotaAfter.used,
          limit: quotaAfter.limit,
          remaining: quotaAfter.remaining,
          monthKey: quotaAfter.monthKey || null,
          date: null,
          resetsAt: quotaAfter.resetsAt
        },
        sources: rows.map((item, index) => ({
          paper_label: item.paper_label || `논문 ${String.fromCharCode(65 + index)}`,
          title: item.title,
          source_url: item.source_url,
          pdf_link: item.pdf_link,
          similarity_score: item.similarity_score || null
        }))
      });
    }

    await cancelRuntime.throwIfCanceled();
    const inferredIntent = await inferPaperTalkResearchIntentForChat(effectiveMessage, env, cancelRuntime);

    // If the current message is an automatically detected follow-up, do not let
    // the intent planner downgrade it to a generic question. The target is the
    // previous paper/topic stored in effectiveMessage.
    if (forcedOutputStyle) {
      inferredIntent.is_research_related = true;
      inferredIntent.should_use_db_evidence = true;

      if (forcedOutputStyle === "PAPER_SUMMARY") {
        inferredIntent.paper_talk_intent = "PAPER_SUMMARY";
        inferredIntent.question_type = "LITERATURE";
        inferredIntent.answer_style = "paper_summary";
        inferredIntent.interpreted_intent = "Short follow-up asking for a highlight/summary/format change of the previous paper or topic.";
      } else if (forcedOutputStyle === "LITERATURE_REVIEW") {
        inferredIntent.paper_talk_intent = "LITERATURE_REVIEW";
        inferredIntent.question_type = "LITERATURE";
        inferredIntent.answer_style = "paper_recommendation_by_theme";
      } else if (forcedOutputStyle === "RESEARCH_INSIGHT") {
        inferredIntent.paper_talk_intent = "RESEARCH_IDEA";
        inferredIntent.question_type = "RESEARCH";
        inferredIntent.answer_style = "actionable_project_ideas";
      }
    }

    await cancelRuntime.throwIfCanceled();

    let strictActivePaperState = makeEmptyStrictActivePaperContext();
    if (!isGuest) {
      const activePaperRecentMessages = recentMessagesForContinuation.length
        ? recentMessagesForContinuation
        : await getRecentThreadMessagesForContinuation({
            threadId,
            userId: user.id,
            env,
            limit: 8
          }).catch(() => []);

      strictActivePaperState = await getStrictActivePaperContext({
        message: effectiveMessage,
        recentMessages: activePaperRecentMessages,
        env
      }).catch(() => makeEmptyStrictActivePaperContext());
    }

    const relatedPaperMode = isRelatedPaperDiscoveryRequest(message, inferredIntent);

    if (relatedPaperMode) {
      inferredIntent.is_research_related = true;
      inferredIntent.should_use_db_evidence = true;
      inferredIntent.paper_talk_intent = "LITERATURE_REVIEW";
      inferredIntent.question_type = "LITERATURE";
      inferredIntent.answer_style = "paper_recommendation_by_active_paper";
      inferredIntent.interpreted_intent = "The user is asking for papers similar or related to the active paper in the current thread.";
    }


    const wantsSemanticCodeFirst = shouldUseCodeFirstMode({
      inferredIntent,
      forcedOutputStyle,
      relatedPaperMode,
      strictActivePaperState
    });

    if (wantsSemanticCodeFirst) {
      await cancelRuntime.throwIfCanceled();

      const codeRows = await retrievePipelineCodeContext({
        userMessage: `${message}\n${effectiveMessage}`,
        gptKey,
        env
      }).catch(() => []);

      let codeAnswer = await callOpenAIForPipelineCode({
        userMessage: message,
        effectiveMessage,
        codeRows,
        gptProfile
      }, env, cancelRuntime);

      if (isUserCanceledText(codeAnswer)) {
        await markGptCancellableRequestFinished({ env, cancelId, ownerKey: cancelOwnerKey });
        return canceledChatJson();
      }

      codeAnswer = String(codeAnswer || "")
        .replace(/^먼저 찾은 관련 pipeline 논문[\s\S]*?(?=```|$)/i, "")
        .trim();

      if (!codeAnswer) {
        codeAnswer = "코드 생성에 실패했습니다. 다시 한 번 더 구체적인 데이터 타입과 원하는 언어를 적어주세요.";
      }

      const codeAssistantFailed =
        /^OpenAI API timeout/i.test(codeAnswer) ||
        /^OpenAI pipeline-code request failed/i.test(codeAnswer) ||
        /returned non-JSON response/i.test(codeAnswer);

      if (codeAssistantFailed) {
        await markGptCancellableRequestFinished({ env, cancelId, ownerKey: cancelOwnerKey });
        return json({
          ok: false,
          guest: isGuest,
          threadId,
          error: codeAnswer,
          quota: {
            used: quotaBefore.used,
            limit: quotaBefore.limit,
            remaining: quotaBefore.remaining,
            monthKey: quotaBefore.monthKey || null,
            date: quotaBefore.todayKey || null,
            resetsAt: quotaBefore.resetsAt
          },
          sources: []
        }, 502);
      }

      if (!isGuest) {
        const assistantMessageId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO gpt_messages (id, thread_id, user_id, role, content, gpt_key, created_at)
          VALUES (?, ?, ?, 'assistant', ?, ?, CURRENT_TIMESTAMP)
        `).bind(assistantMessageId, threadId, user.id, codeAnswer, gptKey).run();

        await env.DB.prepare(`
          UPDATE gpt_threads
          SET updated_at = CURRENT_TIMESTAMP,
              title = CASE WHEN title = 'New chat' THEN ? ELSE title END
          WHERE id = ? AND user_id = ? AND COALESCE(gpt_key, 'paper_talk') = ?
        `).bind(message.slice(0, 60), threadId, user.id, gptKey).run();
      }

      const quotaAfter = isGuest
        ? await incrementGuestGptUsage(request, env)
        : await incrementMonthlyGptUsage(user.id, env);

      await markGptCancellableRequestFinished({ env, cancelId, ownerKey: cancelOwnerKey });

      return json({
        ok: true,
        guest: isGuest,
        threadId,
        answer: codeAnswer,
        quota: {
          used: quotaAfter.used,
          limit: quotaAfter.limit,
          remaining: quotaAfter.remaining,
          monthKey: quotaAfter.monthKey || null,
          date: quotaAfter.todayKey || null,
          resetsAt: quotaAfter.resetsAt
        },
        gptKey,
        gptTitle: gptProfile.title,
        sources: codeRows.map((item, index) => ({
          paper_label: index < 10 ? `코드 ${index + 1}` : null,
          title: item.title,
          source_url: item.source_url,
          pdf_link: item.pdf_link,
          file_name: item.file_name || null,
          source_type: item.source_type || null,
          similarity_score: item._score || null
        }))
      });
    }

    const retrievalMessageForDb = relatedPaperMode && strictActivePaperState.activePaperLocked
      ? buildRelatedPaperDiscoveryQuery(strictActivePaperState.activePaperContext, message, inferredIntent)
      : effectiveMessage;

    const generalOrBroad = relatedPaperMode ? false : (forcedOutputStyle ? false : (isLikelyGeneralQuestionFast(effectiveMessage) && !inferredIntent.is_research_related));
    let context = [];

    // v56 research-purpose GPT policy:
    // Research/literature/validation/paper-related questions must search Paper_Talk DB.
    // The user should not have to type exact DB keywords. We infer biomedical concepts and retrieval
    // queries from the whole question, then search the DB with those inferred concepts.
    // If DB retrieval returns nothing, the answer remains truthful and says no matching DB source
    // was retrieved instead of answering from outside literature.
    if (!generalOrBroad || inferredIntent.should_use_db_evidence) {
      try {
        context = await retrievePaperTalkDbForResearchIntent(retrievalMessageForDb, inferredIntent, env, gptKey, cancelRuntime);
        await cancelRuntime.throwIfCanceled();
      } catch (error) {
        if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
          throw new UserCanceledError();
        }
        context = [];
      }
    }

    // Extra exact-title retry for multilingual instruction wrappers.
    if (!context.length && !generalOrBroad) {
      try {
        const titleCandidate = extractLikelyPaperTitleForSafeLookup(effectiveMessage);
        if (titleCandidate && titleCandidate !== message) {
          context = await retrievePaperTalkDbForResearchIntent(titleCandidate, inferredIntent, env, gptKey, cancelRuntime);
          await cancelRuntime.throwIfCanceled();
        }
      } catch (error) {
        if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
          throw new UserCanceledError();
        }
        context = [];
      }
    }

    if (!relatedPaperMode && strictActivePaperState.activePaperLocked && forcedOutputStyle === "PAPER_SUMMARY") {
      context = strictActivePaperState.activePaperContext;
    }

    if (relatedPaperMode && strictActivePaperState.activePaperLocked) {
      context = (context || []).filter(item =>
        !strictActivePaperState.activePaperContext.some(active => isSameKnowledgePaper(item, active))
      );
    }

    const outputStyleForSelection = relatedPaperMode
      ? "LITERATURE_REVIEW"
      : (forcedOutputStyle || determinePaperTalkOutputStyle({ userMessage: effectiveMessage, intent: inferredIntent, hasContext: context.length > 0 }));
    context = selectTopSupportingPapersForAnswer(context, null, outputStyleForSelection);

    const autoIntent = inferredIntent || makeFallbackResearchIntent(message);
    const thinkingLogicFrameworks = await retrieveThinkingLogicFrameworks({
      userMessage: effectiveMessage
    }, env).catch(() => []);

    let assistantText = relatedPaperMode
      ? buildRelatedPaperAnswerFromContext({
          context,
          activePaperContext: strictActivePaperState.activePaperContext,
          userMessage: message
        })
      : (generalOrBroad && !context.length)
        ? await callOpenAIGeneralNoRetrieval(message, env, cancelRuntime)
        : await callOpenAIForPaperTalk({
            userMessage: `${gptProfile.title} context. User question: ${effectiveMessage}`,
            context,
            thinkingLogicFrameworks,
            pastFrameworks: [],
            generatedFramework: "",
            recentMessages: recentMessagesForContinuation,
            autoIntent,
            strictActivePaperLocked: strictActivePaperState.activePaperLocked && !relatedPaperMode
          }, env, cancelRuntime);

    if (isUserCanceledText(assistantText)) {
      await markGptCancellableRequestFinished({ env, cancelId, ownerKey: cancelOwnerKey });
      return canceledChatJson();
    }

    await cancelRuntime.throwIfCanceled();

    const assistantFailed =
      /^OpenAI API timeout/i.test(assistantText) ||
      /^OpenAI API request failed/i.test(assistantText) ||
      /^OpenAI answer-generation request/i.test(assistantText) ||
      /returned non-JSON response/i.test(assistantText);

    if (assistantFailed) {
      await markGptCancellableRequestFinished({ env, cancelId, ownerKey: cancelOwnerKey });
      return json({
        ok: false,
        guest: isGuest,
        threadId,
        error: assistantText,
        quota: {
          used: quotaBefore.used,
          limit: quotaBefore.limit,
          remaining: quotaBefore.remaining,
          monthKey: quotaBefore.monthKey || null,
          date: quotaBefore.todayKey || null,
          resetsAt: quotaBefore.resetsAt
        },
        sources: []
      }, 502);
    }

    assistantText = String(assistantText || '')
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/#/g, "")
      .replace(/\*/g, "");

    const finalOutputStyle = relatedPaperMode
      ? "LITERATURE_REVIEW"
      : (forcedOutputStyle || determinePaperTalkOutputStyle({ userMessage: effectiveMessage, intent: autoIntent, hasContext: context.length > 0 }));

    if (!isSupportingPaperFollowUp(message) && !["LITERATURE_REVIEW", "METHOD_EXTRACTION", "PIPELINE_WORKFLOW", "RESEARCH_INSIGHT", "RESEARCH_SYNTHESIS"].includes(finalOutputStyle)) {
      assistantText = hideAccidentalPaperListFromNormalAnswer(assistantText);
      assistantText = hideInternalEvidenceLeaksFromNormalAnswer(assistantText);
    }


    if (!isSupportingPaperFollowUp(message)) {
      assistantText = await normalizeFinalAnswerToUserIntentStyle({
        answer: assistantText,
        userMessage: effectiveMessage,
        outputStyle: finalOutputStyle,
        env
      });
    } else {
      assistantText = formatAnswerForReadability(assistantText, finalOutputStyle);
    }

    assistantText = enforceStrictUserOutputFormat(assistantText, message);

    await cancelRuntime.throwIfCanceled();

    if (!isGuest) {
      const assistantMessageId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO gpt_messages (id, thread_id, user_id, role, content, gpt_key, created_at)
        VALUES (?, ?, ?, 'assistant', ?, ?, CURRENT_TIMESTAMP)
      `).bind(assistantMessageId, threadId, user.id, assistantText, gptKey).run();

      await saveSupportingPapersForAssistantMessage({
        assistantMessageId,
        threadId,
        userId: user.id,
        context,
        env
      });

      await env.DB.prepare(`
        UPDATE gpt_threads
        SET updated_at = CURRENT_TIMESTAMP,
            title = CASE WHEN title = 'New chat' THEN ? ELSE title END
        WHERE id = ? AND user_id = ? AND COALESCE(gpt_key, 'paper_talk') = ?
      `).bind(message.slice(0, 60), threadId, user.id, gptKey).run();
    }

    await cancelRuntime.throwIfCanceled();

    const quotaAfter = isGuest
      ? await incrementGuestGptUsage(request, env)
      : await incrementMonthlyGptUsage(user.id, env);

    await markGptCancellableRequestFinished({ env, cancelId, ownerKey: cancelOwnerKey });

    return json({
      ok: true,
      guest: isGuest,
      threadId,
      answer: assistantText,
      quota: {
        used: quotaAfter.used,
        limit: quotaAfter.limit,
        remaining: quotaAfter.remaining,
        monthKey: quotaAfter.monthKey || null,
        date: quotaAfter.todayKey || null,
        resetsAt: quotaAfter.resetsAt
      },
      gptKey,
      gptTitle: gptProfile.title,
      sources: context.map((item, index) => ({
        paper_label: index < 10 ? `논문 ${String.fromCharCode(65 + index)}` : null,
        title: item.title,
        source_url: item.source_url,
        pdf_link: item.pdf_link,
        similarity_score: item.similarity_score || null
      }))
    });
  } catch (error) {
    if (isUserCanceledError(error) || isUserCanceledText(error?.message)) {
      try {
        await markGptCancellableRequestFinished({ env, cancelId: activeCancelId, ownerKey: activeCancelOwnerKey });
      } catch {}
      return canceledChatJson();
    }

    return json({
      ok: false,
      error: `GPT chat failed safely: ${error?.message || error}`
    }, 500);
  }
}

function getCurrentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function getNextMonthResetIso(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)).toISOString();
}

async function ensureGptMonthlyUsageTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS gpt_monthly_usage (
      user_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, month_key)
    )
  `).run();
}

async function ensureUserGptQuotaColumns(env) {
  const statements = [
    "ALTER TABLE users ADD COLUMN monthly_gpt_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN monthly_gpt_limit INTEGER NOT NULL DEFAULT 50",
    "ALTER TABLE users ADD COLUMN monthly_reset_at TEXT"
  ];

  for (const sql of statements) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
      // Column already exists or the current DB already has these quota fields.
    }
  }
}

async function getLegacyMonthlyMessageCount(userId, monthKey, env) {
  const result = await env.DB.prepare(`
    SELECT COUNT(*) AS used
    FROM gpt_messages
    WHERE user_id = ?
      AND role = 'user'
      AND substr(created_at, 1, 7) = ?
  `).bind(userId, monthKey).first();

  return result ? Number(result.used || 0) : 0;
}

async function getUserGptQuotaRow(userId, env) {
  await ensureUserGptQuotaColumns(env);

  return env.DB.prepare(`
    SELECT
      id,
      email,
      monthly_gpt_count,
      monthly_gpt_limit,
      monthly_reset_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
}

async function syncMonthlyUsageMirror(userId, monthKey, used, env) {
  await ensureGptMonthlyUsageTable(env);

  await env.DB.prepare(`
    INSERT INTO gpt_monthly_usage (
      user_id,
      month_key,
      used,
      updated_at
    )
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, month_key) DO UPDATE SET
      used = excluded.used,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, monthKey, used).run();
}

async function getMonthlyGptQuota(userId, env, user = null) {
  const now = new Date();
  const monthKey = getCurrentMonthKey(now);

  await ensureGptMonthlyUsageTable(env);
  await ensureUserGptQuotaColumns(env);

  const userRow = await getUserGptQuotaRow(userId, env);

  // Fallback for unexpected missing user rows.
  if (!userRow) {
    const legacyUsed = await getLegacyMonthlyMessageCount(userId, monthKey, env);
    const fallbackLimit = SIGNED_IN_TOTAL_GPT_MONTHLY_LIMIT;

    await syncMonthlyUsageMirror(userId, monthKey, legacyUsed, env);

    return {
      used: legacyUsed,
      limit: fallbackLimit,
      remaining: Math.max(fallbackLimit - legacyUsed, 0),
      monthKey,
      resetsAt: getNextMonthResetIso(now)
    };
  }

  let limit = Number(userRow.monthly_gpt_limit);

  if (!Number.isFinite(limit) || limit <= 0) {
    limit = SIGNED_IN_TOTAL_GPT_MONTHLY_LIMIT;
  }

  limit = Math.floor(limit);

  let used = Number(userRow.monthly_gpt_count || 0);

  if (!Number.isFinite(used) || used < 0) {
    used = 0;
  }

  used = Math.floor(used);

  const resetAt = String(userRow.monthly_reset_at || "");
  const resetMonth = resetAt.slice(0, 7);

  // New month: reset this user's GPT usage counter in users.
  if (resetMonth && resetMonth !== monthKey) {
    used = 0;

    await env.DB.prepare(`
      UPDATE users
      SET
        monthly_gpt_count = 0,
        monthly_reset_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(userId).run();
  }

  // First quota read: initialize reset timestamp without changing usage.
  if (!resetAt) {
    await env.DB.prepare(`
      UPDATE users
      SET monthly_reset_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND (monthly_reset_at IS NULL OR monthly_reset_at = '')
    `).bind(userId).run();
  }

  await syncMonthlyUsageMirror(userId, monthKey, used, env);

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    monthKey,
    resetsAt: getNextMonthResetIso(now)
  };
}

async function incrementMonthlyGptUsage(userId, env) {
  const now = new Date();
  const monthKey = getCurrentMonthKey(now);

  await ensureGptMonthlyUsageTable(env);
  await ensureUserGptQuotaColumns(env);

  // This call also resets monthly_gpt_count to 0 when the saved reset month is old.
  const quotaBefore = await getMonthlyGptQuota(userId, env);
  const usedBefore = Number(quotaBefore.used || 0);
  const usedAfter = usedBefore + 1;

  await env.DB.prepare(`
    UPDATE users
    SET
      monthly_gpt_count = ?,
      monthly_reset_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(usedAfter, userId).run();

  await syncMonthlyUsageMirror(userId, monthKey, usedAfter, env);

  return getMonthlyGptQuota(userId, env);
}

function getNextDayResetIso(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return new Date(Date.UTC(year, month, day + 1, 0, 0, 0)).toISOString();
}

async function ensureGuestGptDailyUsageTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS guest_gpt_daily_usage (
      visit_date TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (visit_date, ip_hash)
    )
  `).run();
}

async function getGuestGptQuota(request, env) {
  const now = new Date();
  const todayKey = getTodayKey(now);
  const visitorIp = getVisitorIp(request);
  const ipHash = await sha256Hex(`${todayKey}:${visitorIp}:${env.SESSION_SECRET || "paper-talk"}:guest-gpt`);
  const guestLimit = GUEST_GPT_DAILY_LIMIT;

  await ensureGuestGptDailyUsageTable(env);

  const row = await env.DB.prepare(`
    SELECT used
    FROM guest_gpt_daily_usage
    WHERE visit_date = ?
      AND ip_hash = ?
  `).bind(todayKey, ipHash).first();

  const used = row ? Number(row.used || 0) : 0;

  return {
    used,
    limit: guestLimit,
    remaining: Math.max(guestLimit - used, 0),
    todayKey,
    resetsAt: getNextDayResetIso(now)
  };
}

async function incrementGuestGptUsage(request, env) {
  const quota = await getGuestGptQuota(request, env);

  await env.DB.prepare(`
    INSERT INTO guest_gpt_daily_usage (
      visit_date,
      ip_hash,
      used,
      updated_at
    )
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(visit_date, ip_hash) DO UPDATE SET
      used = used + 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(quota.todayKey, await sha256Hex(`${quota.todayKey}:${getVisitorIp(request)}:${env.SESSION_SECRET || "paper-talk"}:guest-gpt`)).run();

  return getGuestGptQuota(request, env);
}

async function deleteGptThread(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const url = new URL(request.url);
  const threadId = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");

  if (!threadId) {
    return json({ ok: false, error: "threadId is required." }, 400);
  }

  await ensureSpecialistGptTables(env);

  const gptKey = normalizeGptKey(url.searchParams.get("gptKey") || url.searchParams.get("gpt") || url.searchParams.get("domain"));

  const thread = await env.DB.prepare(`
    SELECT *
    FROM gpt_threads
    WHERE id = ?
      AND user_id = ?
      AND COALESCE(gpt_key, 'paper_talk') = ?
  `).bind(threadId, user.id, gptKey).first();

  if (!thread) {
    return json({ ok: false, error: "Thread not found." }, 404);
  }

  await env.DB.prepare(`
    DELETE FROM gpt_messages
    WHERE thread_id = ?
      AND user_id = ?
  `).bind(threadId, user.id).run();

  await env.DB.prepare(`
    DELETE FROM gpt_threads
    WHERE id = ?
      AND user_id = ?
  `).bind(threadId, user.id).run();

  return json({ ok: true });
}


function buildRobustFullTextSearchTerms(query) {
  // v53 multilingual automatic retrieval.
  // Principle: do NOT rely on a Korean-only or English-only stopword list.
  // The retrieval layer extracts scientific/title-like signals and lets scoring
  // decide relevance. Instruction words in any language rarely appear in titles
  // or chunks, so they naturally get low/no score.
  const raw = String(query || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\.pdf\b/gi, " ")
    .replace(/[_]+/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const terms = [];
  const seen = new Set();

  function addTerm(value, maxLen = 110) {
    let term = String(value || "")
      .toLowerCase()
      .replace(/[“”"'`]/g, " ")
      .replace(/[‐‑‒–—]/g, "-")
      .replace(/[%_]/g, " ")
      .replace(/[^\p{L}\p{N}+\-\s:/()]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!term) return;
    if (term.length < 2) return;

    // Avoid a whole pasted paragraph as one LIKE pattern.
    if (term.length > maxLen) term = term.slice(0, maxLen).trim();
    if (!term || seen.has(term)) return;

    seen.add(term);
    terms.push(term);
  }

  // 1) The most likely paper-title span.
  addTerm(extractLikelyPaperTitleForSafeLookup(raw), 130);

  // 2) Quoted phrases across languages.
  const quoted = raw.match(/["“”'`「『《](.{4,180}?)[“”"'`」』》]/g) || [];
  for (const q of quoted) addTerm(q.replace(/^["“”'`「『《]|["“”'`」』》]$/g, ""), 120);

  // 3) Long scientific English/Latin spans. Most biomedical titles are here,
  // even when the surrounding request is Korean/French/Spanish/Japanese/etc.
  const titleSpans = raw.match(/[A-Za-z0-9][A-Za-z0-9+\-:;,/() ]{8,220}[A-Za-z0-9)]/g) || [];
  for (const span of titleSpans) {
    const scientificTokens = span.match(/[A-Za-z0-9]+(?:[-+][A-Za-z0-9]+)*/g) || [];
    if (scientificTokens.length >= 2) addTerm(span, 130);
  }

  // 4) Scientific symbols and biomedical abbreviations.
  const symbols = raw.match(/\b(?:[A-Z]{2,}[A-Z0-9-]*|[A-Za-z]+-?\d+[A-Za-z]*|\d+[A-Za-z]+|CD\d+\+?|PD-?1|CTLA-?4|TCR|Treg|IFN-?\w*|TNF|IL-?\d+|RNA|DNA|scRNA-?seq|snRNA-?seq|ATAC|CNV|GWAS|SPP1|SOCS1|MHC|HLA)\b/gi) || [];
  for (const symbol of symbols) addTerm(symbol, 40);

  // 5) Unicode tokens from any language. No language-specific stopword list:
  // short generic words simply will not score unless they appear in DB text.
  const unicodeTokens = raw.match(/[\p{L}\p{N}]+(?:[-+][\p{L}\p{N}]+)*/gu) || [];
  const usefulTokens = unicodeTokens
    .map(v => v.toLowerCase().trim())
    .filter(Boolean)
    .filter(v => {
      if (/\d/.test(v)) return true;
      if (/[A-Za-z]/.test(v) && v.length >= 3) return true;
      if (!/[A-Za-z]/.test(v) && v.length >= 2) return true;
      return false;
    })
    .slice(0, 28);

  // Adjacent n-grams make title retrieval robust:
  // "inhibitory pd-1 axis", "stem-like cd8", "spatial transcriptomics", etc.
  for (let n = Math.min(6, usefulTokens.length); n >= 2; n--) {
    for (let i = 0; i <= usefulTokens.length - n; i++) {
      const phrase = usefulTokens.slice(i, i + n).join(" ");
      if (phrase.length >= 5 && phrase.length <= 110) addTerm(phrase, 110);
    }
  }

  for (const token of usefulTokens) addTerm(token, 40);

  // 6) Existing domain-specific expanders if present.
  try {
    for (const phrase of extractScientificKeyPhrases(raw)) addTerm(phrase, 90);
  } catch {}
  try {
    for (const phrase of extractAutoResearchKeywords(raw)) addTerm(phrase, 90);
  } catch {}

  return terms
    .sort((a, b) => {
      const aHasDigit = /\d/.test(a) ? 15 : 0;
      const bHasDigit = /\d/.test(b) ? 15 : 0;
      const aSci = /[A-Za-z]/.test(a) ? 8 : 0;
      const bSci = /[A-Za-z]/.test(b) ? 8 : 0;
      return (b.length + bHasDigit + bSci) - (a.length + aHasDigit + aSci);
    })
    .slice(0, 16);
}


function scoreFullTextChunkRow(row, terms) {
  const title = String(row.title || "").toLowerCase();
  const fileName = String(row.file_name || "").toLowerCase();
  const text = String(row.text || "").toLowerCase();
  const chunkIndex = Number(row.chunk_index || 0);

  let score = 0;

  for (const term of terms) {
    const t = String(term || "").toLowerCase();
    if (!t) continue;

    if (title.includes(t)) score += Math.min(120, 40 + t.length);
    if (fileName.includes(t)) score += Math.min(100, 32 + t.length);
    if (text.includes(t)) score += Math.min(40, 8 + Math.min(t.length, 24));

    const pieces = t.split(/\s+/).filter(Boolean);
    if (pieces.length >= 2) {
      const titleHits = pieces.filter(p => title.includes(p)).length;
      const fileHits = pieces.filter(p => fileName.includes(p)).length;
      const textHits = pieces.filter(p => text.includes(p)).length;
      score += titleHits * 10 + fileHits * 8 + textHits * 2;
    }
  }

  if (chunkIndex === 0) score += 8;
  if (chunkIndex > 0 && chunkIndex <= 3) score += 4;

  return score;
}

async function searchPaperFullTextChunks(query, env, limit = 6, gptKey = DEFAULT_GPT_KEY) {
  gptKey = normalizeGptKey(gptKey);
  const userQuery = String(query || "").trim();
  if (!userQuery) return [];

  try {
    await ensurePaperFullTextTables(env);
  } catch {
    return [];
  }

  const terms = buildRobustFullTextSearchTerms(userQuery);
  const titleCandidate = extractLikelyPaperTitleForSafeLookup(userQuery);

  const exactTitleVariants = [];
  const addVariant = (value) => {
    const v = String(value || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\.pdf\b/gi, " ")
      .replace(/[“”"'`]/g, " ")
      .replace(/[‐‑‒–—]/g, "-")
      .replace(/[%_]/g, " ")
      .replace(/[^\p{L}\p{N}+\-\s:/()]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (v.length >= 6 && !exactTitleVariants.includes(v)) exactTitleVariants.push(v.slice(0, 160));
  };

  addVariant(titleCandidate);

  // Prefix title variants are the key fix for multilingual instructions.
  // Example: "Inhibitory PD-1 axis ... T cells 을 읽고 요약해줘".
  // We search the scientific/title prefix rather than the whole user sentence.
  const latinTokens = String(titleCandidate || userQuery).match(/[A-Za-z0-9]+(?:[-+][A-Za-z0-9]+)*/g) || [];
  for (let n of [10, 8, 6, 5, 4, 3]) {
    if (latinTokens.length >= n) addVariant(latinTokens.slice(0, n).join(" "));
  }

  const rows = [];
  const seenRows = new Set();

  async function addRowsFromResult(result) {
    for (const row of (result?.results || [])) {
      const key = `${row.post_id || ""}:${row.file_name || ""}:${row.chunk_index || 0}:${String(row.title || "").slice(0, 80)}`;
      if (seenRows.has(key)) continue;
      seenRows.add(key);
      rows.push(row);
    }
  }

  // 1) Exact/partial title and file-name retrieval first. This is cheap and high precision.
  for (const variant of exactTitleVariants.slice(0, 8)) {
    try {
      const like = `%${variant}%`;
      const result = await env.DB.prepare(`
        SELECT
          post_id,
          title,
          source_url,
          pdf_link,
          file_name,
          chunk_index,
          text,
          text_length,
          created_at
        FROM paper_fulltext_chunks
        WHERE COALESCE(gpt_key, 'paper_talk') = ?
          AND (
            LOWER(title) LIKE ?
            OR LOWER(file_name) LIKE ?
          )
        ORDER BY
          CASE
            WHEN LOWER(title) LIKE ? THEN 0
            WHEN LOWER(file_name) LIKE ? THEN 1
            ELSE 2
          END,
          chunk_index ASC
        LIMIT 40
      `).bind(gptKey, like, like, like, like).all();
      await addRowsFromResult(result);
    } catch {
      // Continue to token search.
    }
  }

  // 2) Token/n-gram fallback across title, file name, and bounded text.
  if (terms.length) {
    const sqlTerms = terms.slice(0, 12);
    const clauses = [];
    const params = [];

    for (const term of sqlTerms) {
      clauses.push(`(
        LOWER(title) LIKE ?
        OR LOWER(file_name) LIKE ?
        OR LOWER(text) LIKE ?
      )`);

      const like = `%${String(term || "").toLowerCase()}%`;
      params.push(like, like, like);
    }

    try {
      const result = await env.DB.prepare(`
        SELECT
          post_id,
          title,
          source_url,
          pdf_link,
          file_name,
          chunk_index,
          text,
          text_length,
          created_at
        FROM paper_fulltext_chunks
        WHERE COALESCE(gpt_key, 'paper_talk') = ?
          AND (${clauses.join(" OR ")})
        ORDER BY datetime(created_at) DESC, chunk_index ASC
        LIMIT 120
      `).bind(gptKey, ...params).all();
      await addRowsFromResult(result);
    } catch {
      // Continue with whatever exact title retrieval found.
    }
  }

  if (!rows.length) return [];

  const allScoringTerms = [...exactTitleVariants, ...terms];

  const scoredRows = rows
    .map(row => {
      let score = scoreFullTextChunkRow(row, allScoringTerms);
      const title = String(row.title || "").toLowerCase();
      const file = String(row.file_name || "").toLowerCase();

      for (const variant of exactTitleVariants) {
        if (!variant) continue;
        if (title.includes(variant)) score += 260 + Math.min(80, variant.length);
        if (file.includes(variant)) score += 180 + Math.min(60, variant.length);

        const parts = variant.split(/\s+/).filter(v => v.length >= 2);
        const titleHits = parts.filter(p => title.includes(p)).length;
        const fileHits = parts.filter(p => file.includes(p)).length;
        if (parts.length >= 3) {
          score += (titleHits / parts.length) * 180;
          score += (fileHits / parts.length) * 120;
        }
      }

      return { row, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.row.chunk_index || 0) - Number(b.row.chunk_index || 0));

  const grouped = new Map();

  for (const { row, score } of scoredRows) {
    const key = row.post_id || normalizeSearchText(row.title || row.file_name || "");
    if (!key) continue;

    if (!grouped.has(key)) {
      grouped.set(key, {
        post_id: row.post_id || "",
        title: cleanBibtexText(row.title || row.file_name || ""),
        source_url: row.source_url || "",
        pdf_link: row.pdf_link || "",
        file_name: row.file_name || "",
        chunks: [],
        score: 0
      });
    }

    const group = grouped.get(key);
    if (group.chunks.length < 4) {
      group.chunks.push(row);
      group.score += score;
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(group => {
      const chunkText = group.chunks
        .sort((a, b) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0))
        .map(row => [
          `Chunk index: ${row.chunk_index}`,
          String(row.text || "").slice(0, 2300)
        ].join("\n"))
        .join("\n\n--- Full-text chunk ---\n\n");

      return {
        post_id: group.post_id,
        title: group.title,
        source_url: group.source_url,
        pdf_link: group.pdf_link,
        content: [
          "Paper_Talk DB Research Paper",
          "Knowledge source: FULL_TEXT_CHUNKED_UPLOAD",
          `Title: ${group.title}`,
          group.file_name ? `Full text file: ${group.file_name}` : "",
          "",
          chunkText
        ].filter(Boolean).join("\n").slice(0, 10000),
        matched_chunk: cleanBibtexText(chunkText).slice(0, 7000),
        similarity_score: Math.round(group.score),
        from_fulltext_chunk_search: true,
        from_direct_db_search: true,
        from_explicit_title_search: true
      };
    });
}


async function getBestFullTextChunksForPaper({ postId, title, query, env, limit = 3, gptKey = DEFAULT_GPT_KEY }) {
  try {
    await ensurePaperFullTextTables(env);
  } catch {
    return [];
  }

  gptKey = normalizeGptKey(gptKey);
  const safePostId = String(postId || "").trim();
  const safeTitle = cleanBibtexText(title || "").trim();
  const userQuery = String(query || "").trim();

  const tokens = [
    ...getImportantSearchTokens(userQuery),
    ...getImportantSearchTokens(safeTitle)
  ]
    .map(v => String(v || "").toLowerCase())
    .filter(v => v.length >= 4);

  const uniqueTokens = [...new Set(tokens)].slice(0, 10);

  let rows = [];

  try {
    if (safePostId) {
      const result = await env.DB.prepare(`
        SELECT post_id, title, source_url, pdf_link, file_name, chunk_index, text, text_length, created_at
        FROM paper_fulltext_chunks
        WHERE post_id = ?
          AND COALESCE(gpt_key, 'paper_talk') = ?
        ORDER BY
          CASE
            WHEN chunk_index <= 3 THEN 0
            ELSE 1
          END,
          chunk_index ASC
        LIMIT ?
      `).bind(safePostId, gptKey, Math.max(limit * 2, 6)).all();

      rows = result.results || [];
    }
  } catch {
    rows = [];
  }

  if (!rows.length && safeTitle) {
    try {
      const titleTokens = getImportantSearchTokens(safeTitle).slice(0, 8);
      if (titleTokens.length >= 3) {
        const clauses = titleTokens.map(() => `LOWER(title) LIKE ?`).join(" AND ");
        const params = titleTokens.map(t => `%${t.toLowerCase()}%`);

        const result = await env.DB.prepare(`
          SELECT post_id, title, source_url, pdf_link, file_name, chunk_index, text, text_length, created_at
          FROM paper_fulltext_chunks
          WHERE COALESCE(gpt_key, 'paper_talk') = ?
            AND ${clauses}
          ORDER BY chunk_index ASC
          LIMIT ?
        `).bind(gptKey, ...params, Math.max(limit * 2, 6)).all();

        rows = result.results || [];
      }
    } catch {
      rows = [];
    }
  }

  if (!rows.length) return [];

  const scored = rows.map(row => {
    const hay = normalizeSearchText(`${row.title || ""} ${row.file_name || ""} ${row.text || ""}`);
    const score =
      uniqueTokens.reduce((sum, token) => sum + (hay.includes(token) ? 3 : 0), 0) +
      (Number(row.chunk_index || 0) <= 3 ? 4 : 0) +
      (/abstract|introduction|result|discussion|conclusion|malignan|tumou?r|cancer|pancreatic|ductal|carcinoma|epithelial/i.test(row.text || "") ? 3 : 0);

    return { row, score };
  }).sort((a, b) => b.score - a.score || Number(a.row.chunk_index || 0) - Number(b.row.chunk_index || 0));

  return scored.slice(0, limit).map(({ row }) => ({
    post_id: row.post_id,
    title: cleanBibtexText(row.title),
    source_url: row.source_url || "",
    pdf_link: row.pdf_link || "",
    content: [
      "Paper_Talk DB Research Paper",
      "Knowledge source: FULL_TEXT_CHUNKED_UPLOAD",
      `Title: ${row.title || ""}`,
      row.file_name ? `Full text file: ${row.file_name}` : "",
      `Chunk index: ${row.chunk_index}`,
      "",
      row.text || ""
    ].filter(Boolean).join("\n"),
    matched_chunk: cleanBibtexText(row.text || ""),
    from_fulltext_chunk_search: true,
    from_direct_db_search: true
  }));
}

async function enrichKnowledgeItemsWithFullTextChunks(items, query, env, gptKey = DEFAULT_GPT_KEY) {
  const output = [];

  for (const item of (items || [])) {
    if (!item) continue;

    if (item.from_fulltext_chunk_search) {
      output.push(item);
      continue;
    }

    const chunks = await getBestFullTextChunksForPaper({
      postId: item.post_id || "",
      title: item.title || "",
      query,
      env,
      limit: 2,
      gptKey
    });

    if (chunks.length) {
      const chunkText = chunks
        .map(chunk => chunk.matched_chunk || "")
        .filter(Boolean)
        .join("\n\n--- Full-text chunk ---\n\n");

      output.push({
        ...item,
        content: [
          item.content || "",
          "",
          "Paper_Talk retrieved uploaded full-text chunks for this paper:",
          chunkText
        ].filter(Boolean).join("\n\n").slice(0, 14000),
        matched_chunk: chunkText.slice(0, 4000),
        from_fulltext_chunk_enriched: true
      });

      output.push(...chunks);
    } else {
      output.push(item);
    }
  }

  return output;
}

async function searchResearchKnowledge(query, env) {
  const userQuery = String(query || "").trim();

  if (!userQuery) {
    const latestKnowledge = await latestResearchKnowledge(env, 12);
    if (latestKnowledge.length > 0) return latestKnowledge;
    return latestResearchPostsAsKnowledge(env, 12);
  }

  // v35 explicit paper lookup:
  // If the user provides a paper URL, DOI, PMID/PII-like identifier, or full title,
  // first retrieve that exact Paper_Talk DB row by source_url/pdf_link/title/content.
  // If the row has a stored source_url, fetch that publisher page/metadata once and
  // merge the readable abstract/page text with the stored admin abstract/content.
  // This fixes cases where the DB contains the title/url but natural-language retrieval misses it.
  try {
    const explicitMatches = await findExplicitPaperMatchesFromQuestion(userQuery, env);
    if (explicitMatches.length > 0) {
      const enriched = await enrichExplicitPaperMatchesWithStoredUrls(explicitMatches, env);
      const enrichedWithFullText = await enrichKnowledgeItemsWithFullTextChunks(enriched, userQuery, env);
      return mergeKnowledgeResults(enrichedWithFullText).slice(0, 12);
    }
  } catch {
    // Continue with normal retrieval.
  }

  const allResults = [];

  // v24 retrieval fix:
  // The user should not need to type the exact stored DB wording.
  // We automatically extract scientific keywords from the question, expand common biomedical synonyms,
  // then search research_knowledge by title/content before and after Vectorize.
  const keyPhrases = extractScientificKeyPhrases(userQuery);
  const autoKeywords = extractAutoResearchKeywords(userQuery);

  // v44 chunked full-text search:
  // Search uploaded PDF/TXT chunks separately from research_knowledge.content.
  // This lets Paper_Talk scale to 1000+ PDFs without putting full text into one DB row.
  try {
    allResults.push(...await searchPaperFullTextChunks(userQuery, env, 12));
  } catch {
    // Continue.
  }

  // A) Exact phrase/entity D1 search first. This catches terms like:
  // RNA velocity, scVelo, velocyto, spatial transcriptomics, single-cell RNA-seq, TFvelo, SIRV, Visium.
  for (const phrase of [...keyPhrases, ...autoKeywords]) {
    try {
      allResults.push(...await exactPhraseKnowledgeSearch(phrase, env));
    } catch {
      // Continue.
    }
  }

  // A-2) Strong automatic keyword OR-search across title/content.
  // This is the main safety net when Vectorize misses papers or the DB uses related wording.
  try {
    allResults.push(...await smartKeywordKnowledgeSearch(userQuery, env));
  } catch {
    // Continue.
  }

  // B) Expand/translate the user's natural question into English scientific retrieval text.
  const retrievalQueries = await buildRetrievalQueries(userQuery, env);

  // C) Deterministic DB fallback with extracted key phrases, auto keywords, and expanded queries.
  for (const retrievalQuery of [...keyPhrases, ...autoKeywords, ...retrievalQueries]) {
    try {
      allResults.push(...await directResearchKnowledgeSearch(retrievalQuery, env));
    } catch {
      // Continue.
    }

    try {
      allResults.push(...await keywordFallbackSearch(retrievalQuery, env));
    } catch {
      // Continue.
    }

    try {
      allResults.push(...await searchResearchPostsAsKnowledge(retrievalQuery, env));
    } catch {
      // Continue.
    }
  }

  // D) Semantic Vectorize search is still useful, but it should not block D1 exact matches.
  for (const retrievalQuery of retrievalQueries) {
    try {
      allResults.push(...await vectorSemanticSearch(retrievalQuery, env));
    } catch {
      // Continue with other retrieval methods.
    }
  }

  const merged = mergeKnowledgeResults(allResults).slice(0, 12);
  if (merged.length > 0) {
    // v36:
    // For broad research-idea questions such as "요즘 싱글셀 연구를 뭘 하면 좋을까?",
    // first select relevant Paper_Talk DB papers, then try to read each stored source_url/pdf_link.
    // Publisher pages can block Workers, so this live fetch only augments the stored DB abstract/content.
    // If live fetch fails, GPT still answers from the saved Paper_Talk DB evidence.
    if (shouldLiveEnrichSelectedDbPapers(userQuery)) {
      const enriched = await enrichSelectedResearchPapersWithStoredUrls(merged, env);
      return mergeKnowledgeResults(enriched).slice(0, 12);
    }

    return merged;
  }

  return [];
}


function extractUrlsFromQuestion(value) {
  const text = String(value || "");
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(matches.map(url => url.replace(/[\]\).,;]+$/g, "").trim()).filter(Boolean))];
}

function makeUrlSearchVariants(url) {
  const variants = new Set();
  const raw = String(url || "").trim();
  if (!raw) return [];

  variants.add(raw);

  try {
    variants.add(decodeURIComponent(raw));
  } catch {
    // ignore malformed percent encoding
  }

  try {
    variants.add(encodeURI(decodeURIComponent(raw)));
  } catch {
    // ignore malformed percent encoding
  }

  const noQuery = raw.split("?")[0].split("#")[0];
  if (noQuery) variants.add(noQuery);

  try {
    const decodedNoQuery = decodeURIComponent(noQuery);
    if (decodedNoQuery) variants.add(decodedNoQuery);
  } catch {
    // ignore
  }

  const doi = extractDoiFromTextOrUrl(raw);
  if (doi) {
    variants.add(doi);
    variants.add(`https://doi.org/${doi}`);
  }

  const pii = raw.match(/S\d{4}-\d{4}(?:%28|\()\d{2}(?:%29|\))\d{5}-\d/i);
  if (pii) {
    variants.add(pii[0]);
    try { variants.add(decodeURIComponent(pii[0])); } catch {}
    variants.add(pii[0].replace(/%28/gi, "(").replace(/%29/gi, ")"));
  }

  return [...variants].filter(v => v && v.length >= 6).slice(0, 12);
}

function extractLikelyPaperTitlesFromQuestion(value) {
  const text = String(value || "")
    .replace(/https?:\/\/[^\s<>"']+/gi, "\n")
    .replace(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi, "\n");

  const lines = text
    .split(/[\n\r]+/)
    .map(v => v.trim())
    .filter(Boolean);

  const titles = [];

  for (const line of lines) {
    const cleaned = line
      .replace(/^(title|paper|논문|제목)\s*[:：]\s*/i, "")
      .replace(/(이\s*논문을|이\s*논문|논문에서|논문을|논문|읽고|요약|정리|중요|부분|하이라이트|핵심|한\s*줄|한줄|영어로|한국어로|번역|답변|해주세요|해줘|찾아|줘|기반으로|abstract|초록|summary|summari[sz]e|highlight|takeaway|one[-\s]?line|one\s*sentence|translate|résumé|résume|résumer|resumen|resumir|sumario|zusammenfassung|riassunto|sintesi|要約|总结|總結|摘要)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const englishWords = (cleaned.match(/[A-Za-z][A-Za-z\-]+/g) || []).length;
    if (cleaned.length >= 25 && englishWords >= 4) {
      titles.push(cleaned);
    }
  }

  // Sometimes the user pastes title + request in one line. Keep a phrase before Korean request words.
  const single = text.replace(/\s+/g, " ").trim();
  const beforeKoreanRequest = single.split(/이\s*논문|논문에서|논문을|논문|읽고|요약|정리|중요|하이라이트|핵심|한\s*줄|한줄|영어로|한국어로|해줘|해주세요|답해|분석|summary|summari[sz]e|highlight|takeaway|one[-\s]?line|one\s*sentence|translate|résumé|résume|résumer|resumen|resumir|sumario|zusammenfassung|riassunto|sintesi|要約|总结|總結|摘要/i)[0]?.trim();
  if (beforeKoreanRequest) {
    const englishWords = (beforeKoreanRequest.match(/[A-Za-z][A-Za-z\-]+/g) || []).length;
    if (beforeKoreanRequest.length >= 25 && englishWords >= 4) titles.push(beforeKoreanRequest);
  }

  return [...new Set(titles.map(cleanBibtexText).filter(v => v.length >= 20))].slice(0, 5);
}

async function findExplicitPaperMatchesFromQuestion(query, env, gptKey = DEFAULT_GPT_KEY) {
  gptKey = normalizeGptKey(gptKey);
  const text = String(query || "").trim();
  if (!text) return [];

  const results = [];
  const urlVariants = extractUrlsFromQuestion(text).flatMap(makeUrlSearchVariants);
  const doi = extractDoiFromTextOrUrl(text);
  const titles = extractLikelyPaperTitlesFromQuestion(text);

  const identifierVariants = [...new Set([
    ...urlVariants,
    doi,
    doi ? `https://doi.org/${doi}` : ""
  ].filter(v => v && v.length >= 6))].slice(0, 16);

  for (const value of identifierVariants) {
    const like = `%${value.toLowerCase()}%`;
    try {
      const found = await env.DB.prepare(`
        SELECT post_id, title, source_url, pdf_link, content, updated_at
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND COALESCE(gpt_key, 'paper_talk') = ?
          AND (
            LOWER(source_url) LIKE ?
            OR LOWER(pdf_link) LIKE ?
            OR LOWER(content) LIKE ?
            OR LOWER(title) LIKE ?
          )
        ORDER BY
          CASE
            WHEN LOWER(source_url) LIKE ? THEN 0
            WHEN LOWER(pdf_link) LIKE ? THEN 1
            WHEN LOWER(title) LIKE ? THEN 2
            ELSE 3
          END,
          datetime(updated_at) DESC
        LIMIT 6
      `).bind(gptKey, like, like, like, like, like, like, like).all();

      results.push(...(found.results || []).map(item => ({
        ...item,
        title: cleanBibtexText(item.title),
        content: cleanBibtexText(item.content),
        matched_chunk: makeBestEvidenceExcerpt(item.content || ""),
        similarity_score: null,
        from_explicit_url_or_identifier_search: true
      })));
    } catch {
      // Continue.
    }
  }

  for (const title of titles) {
    const normalizedTitle = normalizeSearchText(title);
    if (!normalizedTitle || normalizedTitle.length < 15) continue;

    const tokens = getImportantSearchTokens(title).slice(0, 8);
    try {
      const exactLike = `%${normalizedTitle.slice(0, 180)}%`;
      let found = await env.DB.prepare(`
        SELECT post_id, title, source_url, pdf_link, content, updated_at
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND COALESCE(gpt_key, 'paper_talk') = ?
          AND (
            LOWER(title) LIKE ?
            OR LOWER(content) LIKE ?
          )
        ORDER BY
          CASE WHEN LOWER(title) LIKE ? THEN 0 ELSE 1 END,
          datetime(updated_at) DESC
        LIMIT 6
      `).bind(gptKey, exactLike, exactLike, exactLike).all();

      results.push(...(found.results || []).map(item => ({
        ...item,
        title: cleanBibtexText(item.title),
        content: cleanBibtexText(item.content),
        matched_chunk: makeBestEvidenceExcerpt(item.content || ""),
        similarity_score: null,
        from_explicit_title_search: true
      })));

      if (tokens.length >= 4) {
        const titleClauses = tokens.map(() => `LOWER(title) LIKE ?`).join(" AND ");
        const contentClauses = tokens.slice(0, 5).map(() => `LOWER(content) LIKE ?`).join(" AND ");
        const params = [
          ...tokens.map(t => `%${t}%`),
          ...tokens.slice(0, 5).map(t => `%${t}%`)
        ];

        found = await env.DB.prepare(`
          SELECT post_id, title, source_url, pdf_link, content, updated_at
          FROM research_knowledge
          WHERE status = 'indexed'
            AND post_id NOT LIKE 'thinking_logic_%'
            AND title NOT LIKE '[Thinking Logic]%'
            AND COALESCE(gpt_key, 'paper_talk') = ?
            AND ((${titleClauses}) OR (${contentClauses}))
          ORDER BY datetime(updated_at) DESC
          LIMIT 6
        `).bind(gptKey, ...params).all();

        results.push(...(found.results || []).map(item => ({
          ...item,
          title: cleanBibtexText(item.title),
          content: cleanBibtexText(item.content),
          matched_chunk: makeBestEvidenceExcerpt(item.content || ""),
          similarity_score: null,
          from_explicit_title_token_search: true
        })));
      }
    } catch {
      // Continue.
    }
  }

  // If the user provides a URL that is not in DB, still try to read that URL directly.
  // This supports "사용자가 논문 URL을 주면 그것도 찾아서 답" while keeping DB as priority.
  if (!results.length && urlVariants.length) {
    const url = urlVariants.find(v => /^https?:\/\//i.test(v)) || "";
    if (url) {
      try {
        const fetched = await fetchReadableArticleText(url, "");
        if (fetched && containsExternalArticleData(fetched)) {
          results.push({
            title: extractTitleFromFetchedText(fetched) || url,
            source_url: url,
            pdf_link: "",
            content: `User-provided URL live fetch result:\n${fetched}`,
            matched_chunk: makeBestEvidenceExcerpt(fetched),
            similarity_score: null,
            from_user_provided_url_fetch: true
          });
        }
      } catch {
        // If live fetch fails, no explicit fallback here.
      }
    }
  }

  return mergeKnowledgeResults(results);
}

function extractTitleFromFetchedText(value) {
  const text = String(value || "");
  const titleLine = text.split(/\n+/).find(line => /^Title:\s*/i.test(line.trim()));
  if (titleLine) return cleanBibtexText(titleLine.replace(/^Title:\s*/i, "")).slice(0, 220);
  return "";
}

async function enrichExplicitPaperMatchesWithStoredUrls(items, env) {
  const output = [];
  for (const item of (items || []).slice(0, 4)) {
    const sourceUrl = String(item.source_url || item.pdf_link || "").trim();
    let enriched = { ...item };

    // Always keep stored DB abstract/content as fallback. Live fetch only augments it.
    if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
      try {
        const fetched = await fetchReadableArticleText(sourceUrl, item.title || "");
        if (fetched && containsExternalArticleData(fetched)) {
          const combined = [
            `Paper_Talk DB stored evidence and admin abstract/content:\n${item.content || ""}`,
            `Live source page / metadata fetched from stored URL (${sourceUrl}):\n${fetched}`
          ].join("\n\n---\n\n");

          enriched = {
            ...item,
            content: cleanFetchedArticleText(combined).slice(0, 52000),
            matched_chunk: makeBestEvidenceExcerpt(combined),
            from_stored_url_live_fetch: true
          };
        }
      } catch {
        // Publisher pages often block Workers. If so, stored abstract/content remains the answer basis.
      }
    }

    output.push(enriched);
  }

  return output.length ? output : items;
}


function shouldLiveEnrichSelectedDbPapers(query) {
  const value = String(query || "").toLowerCase();

  // Direct title/URL matching is already handled earlier, but broad research-idea
  // questions should also enrich selected DB papers using their stored URLs.
  return (
    /https?:\/\//i.test(value) ||
    /doi\s*:|10\.\d{4,9}\//i.test(value) ||
    /요즘|최근|최신|트렌드|뭘 하면 좋|무엇을 하면|연구를.*하면|아이디어|주제|방향|추천|research idea|trend|recent|latest|what.*research|topic|hypothesis/i.test(value) ||
    /single[- ]?cell|싱글셀|scRNA|scrna|spatial|공간전사체|trajectory|rna velocity|visium|tumor microenvironment|tme|cancer genomics/i.test(value)
  );
}

async function enrichSelectedResearchPapersWithStoredUrls(items, env) {
  const selected = (items || [])
    .filter(item => !isThinkingLogicKnowledgeItem(item))
    .filter(item => String(item.source_url || item.pdf_link || "").trim())
    .slice(0, 5);

  if (!selected.length) return items || [];

  const enrichedByKey = new Map();

  for (const item of selected) {
    const key = String(item.source_url || item.pdf_link || item.title || "").trim();
    let enriched = { ...item };
    const sourceUrl = String(item.source_url || item.pdf_link || "").trim();

    if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
      try {
        const fetched = await fetchReadableArticleText(sourceUrl, item.title || "");

        if (fetched && containsExternalArticleData(fetched)) {
          const combined = [
            `Paper_Talk DB stored evidence and admin abstract/content:\n${item.content || ""}`,
            `Live source page / metadata fetched from stored URL (${sourceUrl}):\n${fetched}`
          ].join("\n\n---\n\n");

          enriched = {
            ...item,
            content: cleanFetchedArticleText(combined).slice(0, 52000),
            matched_chunk: makeBestEvidenceExcerpt(combined),
            from_selected_db_url_live_fetch: true
          };
        }
      } catch {
        // Many publisher pages block server-side fetch. Keep DB abstract/content fallback.
      }
    }

    if (key) enrichedByKey.set(key, enriched);
  }

  return (items || []).map(item => {
    const key = String(item.source_url || item.pdf_link || item.title || "").trim();
    return enrichedByKey.get(key) || item;
  });
}

function extractAutoResearchKeywords(query) {
  const original = String(query || "");
  const lower = original.toLowerCase();
  const normalized = normalizeSearchText(original);
  const keywords = new Set();

  function addMany(values) {
    for (const value of values || []) {
      const cleaned = cleanRetrievalPhrase(value);
      if (cleaned && cleaned.length >= 3) keywords.add(cleaned);
    }
  }

  // 1) Keep meaningful English phrases already present in the question.
  addMany(extractScientificKeyPhrases(original));

  // 2) Domain synonym expansion. Add more topics here as Paper_Talk grows.
  const synonymRules = [
    {
      triggers: ["rna velocity", "velocity", "scvelo", "velocyto", "tfvelo", "sirv", "spliced", "unspliced", "전사 동역학", "세포 상태", "세포 운명", "궤적"],
      terms: [
        "RNA velocity",
        "scVelo",
        "velocyto",
        "TFvelo",
        "SIRV",
        "spliced RNA",
        "unspliced RNA",
        "splicing kinetics",
        "transcriptional dynamics",
        "cell fate",
        "cell state transition",
        "trajectory inference",
        "pseudotime",
        "dynamical model",
        "latent time"
      ]
    },
    {
      triggers: ["single cell", "single-cell", "scrna", "scrna-seq", "single cell rna", "단일세포", "싱글셀"],
      terms: [
        "single-cell",
        "single cell",
        "scRNA-seq",
        "single-cell RNA sequencing",
        "cell type",
        "cell state",
        "cell cluster"
      ]
    },
    {
      triggers: ["spatial", "visium", "xenium", "cosmx", "merfish", "stereo-seq", "spatial transcript", "공간전사", "공간 전사"],
      terms: [
        "spatial transcriptomics",
        "spatial transcriptome",
        "Visium",
        "Xenium",
        "CosMx",
        "MERFISH",
        "Stereo-seq",
        "spatial omics",
        "tissue architecture"
      ]
    },
    {
      triggers: ["cancer", "tumor", "tumour", "암", "종양"],
      terms: [
        "cancer",
        "tumor",
        "tumour",
        "oncology",
        "tumor microenvironment",
        "malignant",
        "metastasis",
        "clonal evolution"
      ]
    },
    {
      triggers: ["immune", "immun", "t cell", "b cell", "macrophage", "면역"],
      terms: [
        "immune",
        "immunology",
        "T cell",
        "B cell",
        "macrophage",
        "myeloid",
        "immune checkpoint",
        "TME"
      ]
    },
    {
      triggers: ["mutation", "variant", "snv", "cnv", "copy number", "변이"],
      terms: [
        "mutation",
        "variant",
        "SNV",
        "CNV",
        "copy number variation",
        "genomic alteration",
        "somatic mutation"
      ]
    }
  ];

  for (const rule of synonymRules) {
    const hit = rule.triggers.some(trigger => {
      const t = String(trigger || "").toLowerCase();
      return lower.includes(t) || normalized.includes(normalizeSearchText(t));
    });

    if (hit) addMany(rule.terms);
  }

  // 3) Extract biomedical-looking tokens and short phrases from the question.
  const englishPhrases = original
    .replace(/[\n\r]+/g, " ")
    .match(/[A-Za-z][A-Za-z0-9+\-]*([\s\-/]+[A-Za-z][A-Za-z0-9+\-]*){0,3}/g) || [];

  for (const phrase of englishPhrases) {
    const cleaned = cleanRetrievalPhrase(phrase);
    if (cleaned && cleaned.length >= 3) keywords.add(cleaned);
  }

  for (const token of getImportantSearchTokens(original)) {
    if (token && token.length >= 3) keywords.add(token);
  }

  // 4) Prefer specific phrases over generic words.
  return Array.from(keywords)
    .map(v => cleanRetrievalPhrase(v))
    .filter(v => v.length >= 3)
    .sort((a, b) => {
      const aWords = a.split(/\s+/).length;
      const bWords = b.split(/\s+/).length;
      if (bWords !== aWords) return bWords - aWords;
      return b.length - a.length;
    })
    .slice(0, 24);
}

async function smartKeywordKnowledgeSearch(query, env, limit = 14) {
  const keywords = extractAutoResearchKeywords(query)
    .map(v => cleanRetrievalPhrase(v))
    .filter(v => v.length >= 3)
    .slice(0, 18);

  if (!keywords.length) return [];

  const clauses = [];
  const params = [];

  for (const keyword of keywords) {
    clauses.push(`(
      LOWER(title) LIKE ?
      OR LOWER(content) LIKE ?
      OR LOWER(source_url) LIKE ?
      OR LOWER(pdf_link) LIKE ?
      OR LOWER(REPLACE(REPLACE(REPLACE(title, '{', ''), '}', ''), 'title =', '')) LIKE ?
      OR LOWER(REPLACE(REPLACE(REPLACE(content, '{', ''), '}', ''), 'title =', '')) LIKE ?
    )`);
    const like = `%${keyword}%`;
    params.push(like, like, like, like, like, like);
  }

  const result = await env.DB.prepare(`
    SELECT title, source_url, pdf_link, content, updated_at
    FROM research_knowledge
    WHERE status = 'indexed'
      AND post_id NOT LIKE 'thinking_logic_%'
      AND title NOT LIKE '[Thinking Logic]%'
      AND (${clauses.join(" OR ")})
    ORDER BY
      CASE
        WHEN LOWER(title) LIKE ? THEN 0
        WHEN LOWER(content) LIKE ? THEN 1
        ELSE 2
      END,
      datetime(updated_at) DESC
    LIMIT ?
  `).bind(
    ...params,
    `%${keywords[0]}%`,
    `%${keywords[0]}%`,
    limit
  ).all();

  return (result.results || []).map(item => {
    const matchedKeyword = keywords.find(keyword =>
      String(item.title || "").toLowerCase().includes(keyword) ||
      String(item.content || "").toLowerCase().includes(keyword)
    ) || keywords[0];

    return {
      ...item,
      title: cleanBibtexText(item.title),
      content: cleanBibtexText(item.content),
      matched_chunk: makeMatchedChunk(item.content || "", matchedKeyword),
      similarity_score: null,
      from_auto_keyword_search: true
    };
  });
}

function extractScientificKeyPhrases(query) {
  const original = String(query || "");
  const lower = original.toLowerCase();
  const phrases = [];

  const knownPatterns = [
    "rna velocity",
    "single-cell rna-seq",
    "single cell rna-seq",
    "scrna-seq",
    "scrnaseq",
    "spatial transcriptomics",
    "spatial transcriptome",
    "visium",
    "xenium",
    "cosmx",
    "merscope",
    "stereoseq",
    "stereo-seq",
    "seqfish",
    "seqfish+",
    "merfish",
    "tfvelo",
    "sirv",
    "cellrank",
    "scvelo",
    "dynamo",
    "trajectory inference",
    "pseudotime",
    "tumor microenvironment",
    "cancer genomics",
    "liquid biopsy",
    "immune checkpoint",
    "tnbc",
    "breast cancer",
    "lung cancer",
    "colon cancer",
    "colorectal cancer",
    "glioblastoma",
    "melanoma",
    "metastasis",
    "clonal evolution",
    "copy number variation",
    "cnv",
    "gwas",
    "eqtl",
    "locuscompare"
  ];

  for (const pattern of knownPatterns) {
    if (lower.includes(pattern)) phrases.push(pattern);
  }

  // Capture biomedical-looking English phrases around important words.
  const english = original
    .replace(/[\n\r]+/g, " ")
    .match(/[A-Za-z][A-Za-z0-9+\-]*([\s\-/]+[A-Za-z][A-Za-z0-9+\-]*){0,4}/g) || [];

  for (const item of english) {
    const cleaned = cleanRetrievalPhrase(item);
    if (!cleaned) continue;
    if (/velocity|transcript|single|spatial|cancer|tumor|immune|genom|sequenc|rna|dna|cell|gwas|eqtl|visium|xenium|cosmx|tfvelo|sirv/i.test(cleaned)) {
      phrases.push(cleaned.toLowerCase());
    }
  }

  // If the query includes Korean plus an English term, the English term is often the most important retrieval key.
  const compact = normalizeSearchText(original);
  if (compact.includes("rna velocity")) phrases.push("rna velocity");
  if (compact.includes("spatial")) phrases.push("spatial");
  if (compact.includes("velocity")) phrases.push("velocity");

  return [...new Set(
    phrases
      .map(cleanRetrievalPhrase)
      .filter(v => v.length >= 3)
  )].slice(0, 10);
}

function cleanRetrievalPhrase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/paper_talk/g, " ")
    .replace(/\b(db|paper|papers|article|articles|study|studies|research|related|compare|analysis|analyze|explain|only|based|basis|common|difference|gap|future|direction)\b/g, " ")
    .replace(/논문|연구|관련|비교|분석|공통점|차이점|현재|향후|발전|방향|설명|기준|저장된|만|으로|해줘/g, " ")
    .replace(/[^a-z0-9+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function exactPhraseKnowledgeSearch(phrase, env) {
  const cleaned = cleanRetrievalPhrase(phrase);
  if (!cleaned || cleaned.length < 3) return [];

  const like = `%${cleaned}%`;

  const result = await env.DB.prepare(`
    SELECT title, source_url, pdf_link, content
    FROM research_knowledge
    WHERE status = 'indexed'
      AND post_id NOT LIKE 'thinking_logic_%'
      AND title NOT LIKE '[Thinking Logic]%'
      AND (
        LOWER(title) LIKE ?
        OR LOWER(content) LIKE ?
        OR LOWER(source_url) LIKE ?
        OR LOWER(pdf_link) LIKE ?
      )
    ORDER BY
      CASE
        WHEN LOWER(title) LIKE ? THEN 0
        WHEN LOWER(source_url) LIKE ? THEN 1
        WHEN LOWER(pdf_link) LIKE ? THEN 2
        WHEN LOWER(content) LIKE ? THEN 3
        ELSE 4
      END,
      datetime(updated_at) DESC
    LIMIT 12
  `).bind(like, like, like, like, like, like, like, like).all();

  return (result.results || []).map(item => ({
    ...item,
    title: cleanBibtexText(item.title),
    content: cleanBibtexText(item.content),
    matched_chunk: makeMatchedChunk(item.content || "", cleaned),
    similarity_score: null,
    from_exact_phrase_search: true
  }));
}

function makeMatchedChunk(content, phrase) {
  const text = cleanBibtexText(content || "");
  const lower = text.toLowerCase();
  const key = String(phrase || "").toLowerCase();
  const index = key ? lower.indexOf(key) : -1;

  if (index < 0) return text.slice(0, 1600);

  const start = Math.max(0, index - 500);
  const end = Math.min(text.length, index + 1500);
  return text.slice(start, end);
}

async function buildRetrievalQueries(userQuery, env) {
  const queries = [String(userQuery || "").trim()].filter(Boolean);

  // Add a cheap normalization pass.
  const normalized = normalizeSearchText(userQuery);
  if (normalized && normalized !== userQuery.toLowerCase()) {
    queries.push(normalized);
  }

  // Use the OpenAI model as a query translator/expander.
  // This is not keyword mapping. It lets any natural-language question become
  // a scientific retrieval query for English abstracts/full text.
  const expanded = await expandQuestionForResearchRetrieval(userQuery, env);
  if (expanded) queries.push(expanded);

  // If the model returns comma-separated terms, also add a compact space-joined query.
  if (expanded && expanded.includes(",")) {
    queries.push(expanded.split(",").map(v => v.trim()).filter(Boolean).join(" "));
  }

  return [...new Set(queries.map(v => String(v || "").trim()).filter(Boolean))].slice(0, 4);
}

async function expandQuestionForResearchRetrieval(userQuery, env) {
  if (!env.OPENAI_API_KEY) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: [
              "You convert user questions into concise English scientific retrieval queries for a biomedical paper RAG system.",
              "Return only search terms and short phrases, no explanation.",
              "Include likely English biomedical synonyms, disease names, methods, cell types, molecules, and concepts.",
              "Do not answer the question.",
              "Example: 알츠하이머 연구가 뭐가 있지? -> Alzheimer disease, amyloid plaque, neurodegeneration, brain, spatial transcriptomics"
            ].join(" ")
          },
          {
            role: "user",
            content: String(userQuery || "").slice(0, 1000)
          }
        ],
        temperature: 0
      })
    });

    const data = await readJsonResponseSafely(res, "OpenAI retrieval expansion request");
    const value = extractOpenAIText(data);

    return cleanFetchedArticleText(value)
      .replace(/^["']|["']$/g, "")
      .slice(0, 500);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function vectorSemanticSearch(query, env) {
  if (!env.AI || !env.VECTORIZE) return [];

  const queryEmbedding = await createEmbedding(query, env);

  const vectorResult = await env.VECTORIZE.query(queryEmbedding, {
    topK: 24,
    returnMetadata: "all"
  });

  const matches = vectorResult.matches || [];
  const seen = new Set();
  const results = [];

  for (const match of matches) {
    const metadata = match.metadata || {};
    const postId = metadata.post_id;
    const sourceType = metadata.source_type || "";

    if (!postId) continue;

    if (sourceType === "full_text_chunk") {
      const key = `${postId}:fulltext:${metadata.content_hash || ""}:${metadata.chunk_index || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        post_id: postId,
        title: cleanBibtexText(metadata.title || ""),
        source_url: metadata.source_url || "",
        pdf_link: metadata.pdf_link || "",
        content: [
          "Paper_Talk DB Research Paper",
          "Knowledge source: FULL_TEXT_CHUNKED_UPLOAD",
          `Title: ${metadata.title || ""}`,
          metadata.file_name ? `Full text file: ${metadata.file_name}` : "",
          `Chunk index: ${metadata.chunk_index ?? ""}`,
          "",
          metadata.text || ""
        ].filter(Boolean).join("\n"),
        matched_chunk: cleanBibtexText(metadata.text || ""),
        similarity_score: match.score || 0,
        from_vector_search: true,
        from_fulltext_chunk_search: true
      });

      continue;
    }

    if (seen.has(postId)) continue;
    seen.add(postId);

    const paper = await env.DB.prepare(`
      SELECT post_id, title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE post_id = ?
        AND status = 'indexed'
        AND post_id NOT LIKE 'thinking_logic_%'
        AND title NOT LIKE '[Thinking Logic]%'
    `).bind(postId).first();

    if (paper) {
      results.push({
        ...paper,
        matched_chunk: metadata.text || paper.content || "",
        similarity_score: match.score || 0,
        from_vector_search: true
      });
    }
  }

  return results;
}


async function directResearchKnowledgeSearch(query, env) {
  const tokens = getImportantSearchTokens(query);
  const cleaned = stripQuestionIntentWords(normalizeSearchText(query));
  const results = [];

  // A) Try a broad cleaned phrase against title/content.
  if (cleaned && cleaned.length >= 8) {
    try {
      const phrase = cleaned.slice(0, 160);
      const phraseResult = await env.DB.prepare(`
        SELECT title, source_url, pdf_link, content
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND (
            LOWER(title) LIKE ?
            OR LOWER(content) LIKE ?
          )
        ORDER BY datetime(updated_at) DESC
        LIMIT 8
      `).bind(`%${phrase}%`, `%${phrase}%`).all();

      results.push(...(phraseResult.results || []));
    } catch {
      // Continue.
    }
  }

  if (!tokens.length) {
    return results.map(item => ({
      ...item,
      title: cleanBibtexText(item.title),
      content: cleanBibtexText(item.content),
      matched_chunk: cleanBibtexText(item.content || "")
    }));
  }

  // B) Strong title match: require multiple important tokens in the title.
  const titleTokens = tokens.slice(0, Math.min(tokens.length, 6));
  if (titleTokens.length >= 2) {
    try {
      const titleClauses = titleTokens.map(() => `LOWER(title) LIKE ?`).join(" AND ");
      const titleParams = titleTokens.map(token => `%${token}%`);

      const titleResult = await env.DB.prepare(`
        SELECT title, source_url, pdf_link, content
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND (${titleClauses})
        ORDER BY datetime(updated_at) DESC
        LIMIT 8
      `).bind(...titleParams).all();

      results.push(...(titleResult.results || []));
    } catch {
      // Continue.
    }
  }

  // C) Strong content match: require at least two important tokens in content.
  const contentTokens = tokens.slice(0, Math.min(tokens.length, 5));
  if (contentTokens.length >= 2) {
    try {
      const contentClauses = contentTokens.map(() => `LOWER(content) LIKE ?`).join(" AND ");
      const contentParams = contentTokens.map(token => `%${token}%`);

      const contentResult = await env.DB.prepare(`
        SELECT title, source_url, pdf_link, content
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND (${contentClauses})
        ORDER BY datetime(updated_at) DESC
        LIMIT 8
      `).bind(...contentParams).all();

      results.push(...(contentResult.results || []));
    } catch {
      // Continue.
    }
  }

  // D) Broad OR fallback across title AND content.
  // This is important for expanded queries such as:
  // "Alzheimer disease, amyloid plaque, neurodegeneration, brain, spatial transcriptomics".
  try {
    const broadTokens = tokens.slice(0, 10);
    if (broadTokens.length > 0) {
      const orClauses = broadTokens
        .map(() => `(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)`)
        .join(" OR ");

      const orParams = [];
      for (const token of broadTokens) {
        orParams.push(`%${token}%`, `%${token}%`);
      }

      const broadResult = await env.DB.prepare(`
        SELECT title, source_url, pdf_link, content
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND (${orClauses})
        ORDER BY datetime(updated_at) DESC
        LIMIT 12
      `).bind(...orParams).all();

      results.push(...(broadResult.results || []));
    }
  } catch {
    // Continue.
  }

  return mergeKnowledgeResults((results || []).map(item => ({
    ...item,
    title: cleanBibtexText(item.title),
    content: cleanBibtexText(item.content),
    matched_chunk: cleanBibtexText(item.content || ""),
    similarity_score: null,
    from_direct_db_search: true
  })));
}

function getImportantSearchTokens(query) {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "into", "onto", "this", "that", "these", "those",
    "paper", "article", "study", "research", "please", "summary", "summarize", "summarise", "résumé", "résume", "résumer", "resumen", "resumir", "sumario", "zusammenfassung", "riassunto", "sintesi", "about",
    "what", "which", "where", "when", "how", "why", "can", "could", "would", "should",
    "논문", "연구", "관련", "자료", "정보", "뭐가", "무엇", "어떤", "있지", "있어", "있나요",
    "요약", "요약해줘", "요약해주세요", "정리", "정리해줘", "알려줘", "해주세요", "要約", "总结", "總結", "摘要",
    "있는", "대한", "해당", "그", "이", "저", "좀"
  ]);

  const cleaned = normalizeSearchText(query);
  return cleaned
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3)
    .filter(token => !stopWords.has(token))
    .slice(0, 16);
}

function stripQuestionIntentWords(value) {
  return String(value || "")
    .replace(/\b(paper|article|study|research|please|summary|summarize|summarise|résumé|résume|résumer|resumen|resumir|sumario|zusammenfassung|riassunto|sintesi|about)\b/gi, " ")
    .replace(/논문|연구|관련|자료|정보|뭐가|무엇|어떤|있지|있어|있나요|요약해주세요|요약해줘|요약|정리해줘|정리|알려줘|해주세요|要約|总结|總結|摘要/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeKnowledgeResults(items) {
  const seen = new Set();
  const merged = [];

  for (const rawItem of items || []) {
    const item = normalizeKnowledgeItem(rawItem);
    if (!item) continue;

    const key = item.from_fulltext_chunk_search
      ? normalizeSearchText(`${item.post_id || ""}:${item.title || ""}:${item.matched_chunk || item.content || ""}`.slice(0, 260))
      : (
        normalizeSearchText(item.title || "") ||
        normalizeSearchText(item.source_url || item.pdf_link || item.post_id || "")
      );

    if (!key || seen.has(key)) continue;

    seen.add(key);
    merged.push(item);
  }

  return merged.sort((a, b) => {
    const aContent = `${a?.title || ""}\n${a?.content || ""}\n${a?.matched_chunk || ""}`;
    const bContent = `${b?.title || ""}\n${b?.content || ""}\n${b?.matched_chunk || ""}`;

    const aExact = (a?.from_explicit_url_or_identifier_search ? 120 : 0) + (a?.from_explicit_title_search ? 90 : 0) + (a?.from_explicit_title_token_search ? 60 : 0) + (a?.from_user_provided_url_fetch ? 50 : 0) + (a?.from_exact_phrase_search ? 20 : 0);
    const bExact = (b?.from_explicit_url_or_identifier_search ? 120 : 0) + (b?.from_explicit_title_search ? 90 : 0) + (b?.from_explicit_title_token_search ? 60 : 0) + (b?.from_user_provided_url_fetch ? 50 : 0) + (b?.from_exact_phrase_search ? 20 : 0);
    const aAuto = a?.from_auto_keyword_search ? 16 : 0;
    const bAuto = b?.from_auto_keyword_search ? 16 : 0;
    const aDirect = a?.from_direct_db_search ? 12 : 0;
    const bDirect = b?.from_direct_db_search ? 12 : 0;
    const aPosts = a?.from_posts_fallback ? 6 : 0;
    const bPosts = b?.from_posts_fallback ? 6 : 0;
    const aVector = a?.from_vector_search ? 3 : 0;
    const bVector = b?.from_vector_search ? 3 : 0;

    const aScore =
      aExact +
      aAuto +
      aDirect +
      aPosts +
      aVector +
      (hasScientificContent(aContent) ? 10 : 0) +
      Math.min(String(aContent).length / 1000, 5);

    const bScore =
      bExact +
      bAuto +
      bDirect +
      bPosts +
      bVector +
      (hasScientificContent(bContent) ? 10 : 0) +
      Math.min(String(bContent).length / 1000, 5);

    return bScore - aScore;
  });
}

function hasScientificContent(value) {
  const text = String(value || "").toLowerCase();

  if (text.length < 80) return false;

  const compact = text.replace(/\s+/g, " ").trim();
  if (/^(author|authors|journal|year|volume|number|pages|publisher|doi|url|pmid|pmcid|issn|isbn|keywords|month|note|booktitle|editor)\s*[=:]/.test(compact)) {
    return false;
  }

  return /title:|abstract|admin abstract|description|admin description|result|discussion|method|conclusion|fetched article text|crossref|europe pmc|pubmed|pmc full text|rna velocity|spatial|single-cell|single cell|genomics|cancer|tumor|논문|초록|결과|방법|요약/.test(text);
}

async function createEmbedding(text, env) {
  const input = String(text || "").slice(0, 8000);

  if (!env.AI) {
    throw new Error("AI binding is missing.");
  }

  const response = await env.AI.run("@cf/baai/bge-m3", {
    text: input
  });

  if (Array.isArray(response?.data) && Array.isArray(response.data[0])) {
    return response.data[0];
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response)) {
    return response;
  }

  throw new Error("Failed to create embedding.");
}

function chunkTextForEmbedding(text, maxLength = 1800) {
  const value = String(text || "").trim();

  if (!value) return [];

  const paragraphs = value
    .split(/\n{2,}/)
    .map(v => v.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= maxLength) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      if (current) chunks.push(current);

      if (paragraph.length > maxLength) {
        for (let i = 0; i < paragraph.length; i += maxLength) {
          chunks.push(paragraph.slice(i, i + maxLength));
        }
        current = "";
      } else {
        current = paragraph;
      }
    }
  }

  if (current) chunks.push(current);

  return chunks;
}

async function keywordFallbackSearch(query, env) {
  const rawQuery = String(query || "").trim();
  if (!rawQuery) return [];

  const cleanedQuery = normalizeSearchText(rawQuery);
  if (!cleanedQuery) return [];

  const words = cleanedQuery
    .split(/\s+/)
    .filter(word => word.length >= 3);

  const phrases = [];
  phrases.push(cleanedQuery.slice(0, 120));
  if (words.length >= 1) phrases.push(words[0]);
  if (words.length >= 2) phrases.push(words.slice(0, 2).join(" "));
  if (words.length >= 3) phrases.push(words.slice(0, 3).join(" "));
  if (words.length >= 4) phrases.push(words.slice(0, 4).join(" "));
  if (words.length >= 5) phrases.push(words.slice(0, 5).join(" "));

  const knownPhrases = [
    "rna velocity",
    "velocity",
    "tfvelo",
    "sirv",
    "trajectory inference",
    "pseudotime",
    "cellrank",
    "scvelo",
    "dynamo",
    "single-cell spatial atlas",
    "high-grade serous ovarian cancer",
    "spatial tumor ecosystems",
    "stereo-cell",
    "stereo cell",
    "streo-cell",
    "streo cell",
    "spado",
    "spatial transcriptome",
    "spatial transcriptomics",
    "visium",
    "mhc1",
    "mhc",
    "class ii"
  ];

  for (const phrase of knownPhrases) {
    if (cleanedQuery.includes(normalizeSearchText(phrase))) {
      phrases.push(phrase);
    }
  }

  const uniquePhrases = [...new Set(
    phrases
      .map(v => normalizeSearchText(v))
      .filter(v => v.length >= 3)
  )].slice(0, 10);

  if (!uniquePhrases.length) return [];

  const clauses = [];
  const params = [];

  for (const phrase of uniquePhrases) {
    clauses.push(`
      LOWER(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(title, 'title = {', ''),
            'title={', ''),
          '{', ''),
        '}', '')
      ) LIKE ?
    `);
    params.push(`%${phrase}%`);
  }

  clauses.push(`
    LOWER(
      REPLACE(
        REPLACE(
          REPLACE(content, '{', ''),
        '}', ''),
      'title =', '')
    ) LIKE ?
  `);
  params.push(`%${uniquePhrases[0]}%`);

  try {
    const result = await env.DB.prepare(`
      SELECT title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE status = 'indexed'
        AND post_id NOT LIKE 'thinking_logic_%'
        AND title NOT LIKE '[Thinking Logic]%'
        AND (${clauses.join(" OR ")})
      ORDER BY datetime(updated_at) DESC
      LIMIT 8
    `).bind(...params).all();

    return (result.results || []).map(item => ({
      ...item,
      title: cleanBibtexText(item.title),
      content: cleanBibtexText(item.content)
    }));
  } catch {
    try {
      const fallbackPhrase = uniquePhrases.find(v => v.length <= 80) || uniquePhrases[0];

      const fallback = await env.DB.prepare(`
        SELECT title, source_url, pdf_link, content
        FROM research_knowledge
        WHERE status = 'indexed'
          AND post_id NOT LIKE 'thinking_logic_%'
          AND title NOT LIKE '[Thinking Logic]%'
          AND LOWER(title) LIKE ?
        ORDER BY datetime(updated_at) DESC
        LIMIT 8
      `).bind(`%${fallbackPhrase}%`).all();

      return (fallback.results || []).map(item => ({
        ...item,
        title: cleanBibtexText(item.title),
        content: cleanBibtexText(item.content)
      }));
    } catch {
      return [];
    }
  }
}

function cleanBibtexText(value) {
  return String(value || "")
    .replace(/title\s*=\s*\{/gi, "")
    .replace(/title\s*=\s*/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function isMetadataOnlyTitle(value) {
  const title = cleanBibtexText(value || "").trim().toLowerCase();

  if (!title) return true;

  // These are not paper titles. They usually appear when a BibTeX entry was
  // split into metadata lines and inserted as separate knowledge rows.
  if (/^(author|authors|journal|year|volume|number|pages|publisher|doi|url|pmid|pmcid|issn|isbn|abstract|keywords|month|note|booktitle|editor)\s*=/.test(title)) {
    return true;
  }

  if (/^(author|authors|journal|year|volume|number|pages|publisher|doi|url|pmid|pmcid|issn|isbn|abstract|keywords|month|note|booktitle|editor)\s*:/.test(title)) {
    return true;
  }

  if (title.length < 3) return true;

  return false;
}


function stripUserRequestTailFromPaperTitle(value) {
  let title = cleanBibtexText(value || "").trim();
  if (!title) return "";

  // Sometimes the active paper title is stored together with the user's follow-up
  // sentence, e.g. "ecPICK: ... 논문이랑 비슷한 논문...". Keep only the paper title.
  const cutPatterns = [
    /\s+논문(?:이랑|과|와|하고|이나|이나요|은|는)?\s*(?:비슷|유사|관련|후속|추천|참고|이\s*연구)[\s\S]*$/i,
    /\s+이\s*연구\s*(?:후속|관련|참고|비슷|유사|추천)[\s\S]*$/i,
    /\s+(?:papers?\s+similar|similar\s+papers?|related\s+papers?|recommend(?:ed)?\s+papers?|follow[-\s]?up\s+stud(?:y|ies)|follow[-\s]?up\s+papers?|references?\s+for\s+this\s+study)[\s\S]*$/i,
    /\s+(?:can\s+be\s+read\s+as\s+follows|영어로|영문으로|in\s+english|answer\s+in\s+english|english\s+only)[\s\S]*$/i
  ];

  for (const pattern of cutPatterns) {
    title = title.replace(pattern, "").trim();
  }

  return title.replace(/["“”]+$/g, "").trim();
}

function isLowInformationPaperTitle(value) {
  const title = stripUserRequestTailFromPaperTitle(value || "");
  const lower = title.toLowerCase();

  if (!title || isMetadataOnlyTitle(title)) return true;
  if (/^untitled(?:\s+paper)?$/i.test(title)) return true;
  if (/^main$/i.test(title)) return true;

  // Common broken titles caused by imported ScienceDirect/Elsevier IDs being
  // stored as the title field, e.g. "r s2.0 S221112471831636X main".
  if (/^(?:r\s*)?s2\.0\s+s?\d{8,}[a-z0-9]*\s*(?:main)?$/i.test(title)) return true;
  if (/^(?:r\s*)?s?\d{10,}[a-z0-9]*\s*(?:main)?$/i.test(title)) return true;

  // Too short and mostly identifier-like strings are not useful paper titles.
  const alpha = (title.match(/[A-Za-z]/g) || []).length;
  const digits = (title.match(/\d/g) || []).length;
  if (title.length < 12 && digits >= alpha) return true;

  return false;
}

function bestDisplayPaperTitleFromItem(item) {
  const rawTitle = stripUserRequestTailFromPaperTitle(item?.title || "");
  if (!isLowInformationPaperTitle(rawTitle)) return rawTitle;

  const content = [item?.content || "", item?.matched_chunk || ""].filter(Boolean).join("\n");
  const extracted = stripUserRequestTailFromPaperTitle(extractTitleFromKnowledgeContent(content));
  if (!isLowInformationPaperTitle(extracted)) return extracted;

  return "";
}

function extractTitleFromKnowledgeContent(content) {
  const text = String(content || "");

  const patterns = [
    /(?:^|\n)\s*Title:\s*([^\n]{3,240})/i,
    /(?:^|\n)\s*title\s*=\s*\{?([^\n}]{3,240})\}?/i,
    /(?:^|\n)\s*citation_title:\s*([^\n]{3,240})/i,
    /(?:^|\n)\s*dc\.title:\s*([^\n]{3,240})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const title = cleanBibtexText(match[1]);
      if (!isMetadataOnlyTitle(title)) return title;
    }
  }

  return "";
}

function makeBestEvidenceExcerpt(content) {
  const text = cleanBibtexText(content || "");
  if (!text) return "";

  const fullTextPreferred = makeFullTextPreferredExcerpt(text);
  if (fullTextPreferred) return fullTextPreferred;

  const markers = [
    "Admin abstract:",
    "Abstract:",
    "Admin description:",
    "Description:",
    "Fetched article text from link:",
    "Europe PMC",
    "Crossref metadata",
    "PMC full text",
    "Results",
    "Discussion",
    "Conclusion",
    "Method"
  ];

  const lower = text.toLowerCase();

  for (const marker of markers) {
    const index = lower.indexOf(marker.toLowerCase());
    if (index >= 0) {
      const start = Math.max(0, index - 250);
      const end = Math.min(text.length, index + 1800);
      return text.slice(start, end);
    }
  }

  return text.slice(0, 1800);
}

function normalizeKnowledgeItem(item) {
  if (!item) return null;

  const content = cleanBibtexText(item.content || item.matched_chunk || "");
  let title = cleanBibtexText(item.title || "");

  // Thinking-logic uploads are retrieved separately as reasoning frameworks.
  // They must not appear as Paper_Talk DB paper evidence.
  if (
    String(item.post_id || "").startsWith("thinking_logic_") ||
    /^\[Thinking Logic\]/i.test(title) ||
    /Knowledge role:\s*THINKING_FRAMEWORK_ONLY|Paper_Talk Scientific Thinking Logic/i.test(content)
  ) {
    return null;
  }

  if (isMetadataOnlyTitle(title)) {
    const extractedTitle = extractTitleFromKnowledgeContent(content);
    if (extractedTitle) title = extractedTitle;
  }

  if (isMetadataOnlyTitle(title)) return null;

  const matchedChunk = cleanBibtexText(item.matched_chunk || makeBestEvidenceExcerpt(content));

  const evidenceText = `${title}\n${content}\n${matchedChunk}`;
  if (!hasScientificContent(evidenceText)) return null;

  return {
    ...item,
    title,
    content,
    matched_chunk: matchedChunk || content.slice(0, 2600)
  };
}

function isUsefulPaperKnowledgeItem(item) {
  return !!normalizeKnowledgeItem(item);
}


function normalizeSearchText(value) {
  return cleanBibtexText(value)
    .toLowerCase()
    .replace(/streo/g, "stereo")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseResearchPostBody(body) {
  try {
    const parsed = JSON.parse(body || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function postToKnowledgeItem(post) {
  const researchData = parseResearchPostBody(post.body || "{}");
  const sourceUrl = post.link || "";
  const pdfLink = researchData.pdfLink || "";

  const content = [
    `Title: ${post.title || ""}`,
    researchData.year ? `Year: ${researchData.year}` : "",
    researchData.authors ? `Authors: ${researchData.authors}` : "",
    researchData.journal ? `Journal: ${researchData.journal}` : "",
    researchData.category ? `Category: ${researchData.category}` : "",
    researchData.tags ? `Tags: ${researchData.tags}` : "",
    researchData.abstract ? `Abstract: ${researchData.abstract}` : "",
    researchData.description ? `Description: ${researchData.description}` : "",
    researchData.figures ? `Figures: ${researchData.figures}` : "",
    researchData.note ? `Note: ${researchData.note}` : "",
    sourceUrl ? `Article link: ${sourceUrl}` : "",
    pdfLink ? `PDF link: ${pdfLink}` : ""
  ].filter(Boolean).join("\n\n");

  return {
    title: cleanBibtexText(post.title || ""),
    source_url: sourceUrl,
    pdf_link: pdfLink,
    content,
    matched_chunk: content,
    similarity_score: null,
    from_posts_fallback: true
  };
}

async function latestResearchKnowledge(env, limit = 8) {
  try {
    const latest = await env.DB.prepare(`
      SELECT title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE status = 'indexed'
        AND post_id NOT LIKE 'thinking_logic_%'
        AND title NOT LIKE '[Thinking Logic]%'
      ORDER BY datetime(updated_at) DESC
      LIMIT ?
    `).bind(limit).all();

    return mergeKnowledgeResults(latest.results || []);
  } catch {
    return [];
  }
}

async function latestResearchPostsAsKnowledge(env, limit = 8) {
  try {
    const result = await env.DB.prepare(`
      SELECT *
      FROM posts
      WHERE section = 'research'
        AND type = 'paper'
        AND status = 'published'
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `).bind(limit).all();

    return (result.results || []).map(postToKnowledgeItem);
  } catch {
    return [];
  }
}

async function searchResearchPostsAsKnowledge(query, env) {
  const cleanedQuery = normalizeSearchText(query);
  if (!cleanedQuery) return latestResearchPostsAsKnowledge(env, 8);

  const tokens = getImportantSearchTokens(query);
  const clauses = [];
  const params = [];

  const cleanedPhrase = stripQuestionIntentWords(cleanedQuery).slice(0, 160);
  if (cleanedPhrase.length >= 8) {
    clauses.push(`LOWER(title) LIKE ?`);
    params.push(`%${cleanedPhrase}%`);
    clauses.push(`LOWER(body) LIKE ?`);
    params.push(`%${cleanedPhrase}%`);
  }

  if (tokens.length >= 2) {
    const titleAnd = tokens.slice(0, Math.min(tokens.length, 6)).map(() => `LOWER(title) LIKE ?`).join(" AND ");
    clauses.push(`(${titleAnd})`);
    params.push(...tokens.slice(0, Math.min(tokens.length, 6)).map(token => `%${token}%`));

    const bodyAnd = tokens.slice(0, Math.min(tokens.length, 5)).map(() => `LOWER(body) LIKE ?`).join(" AND ");
    clauses.push(`(${bodyAnd})`);
    params.push(...tokens.slice(0, Math.min(tokens.length, 5)).map(token => `%${token}%`));
  }

  for (const token of tokens.slice(0, 8)) {
    clauses.push(`LOWER(title) LIKE ?`);
    params.push(`%${token}%`);
    clauses.push(`LOWER(body) LIKE ?`);
    params.push(`%${token}%`);
  }

  if (!clauses.length) return [];

  try {
    const result = await env.DB.prepare(`
      SELECT *
      FROM posts
      WHERE section = 'research'
        AND type = 'paper'
        AND status = 'published'
        AND (${clauses.join(" OR ")})
      ORDER BY datetime(created_at) DESC
      LIMIT 8
    `).bind(...params).all();

    return (result.results || []).map(postToKnowledgeItem);
  } catch {
    return [];
  }
}

async function getRecentThreadMessages(threadId, userId, env) {
  const result = await env.DB.prepare(`
    SELECT role, content
    FROM gpt_messages
    WHERE thread_id = ?
      AND user_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 10
  `).bind(threadId, userId).all();

  return (result.results || []).reverse();
}


function isThinkingLogicKnowledgeItem(item) {
  const postId = String(item?.post_id || item?.postId || "").toLowerCase();
  const title = String(item?.title || "").toLowerCase();
  const content = String(item?.content || item?.matched_chunk || "").toLowerCase();

  return (
    postId.startsWith("thinking_logic_") ||
    title.includes("[thinking logic]".toLowerCase()) ||
    content.includes("knowledge role: thinking_framework_only") ||
    content.includes("paper_talk scientific thinking logic") ||
    content.includes("thinking framework only")
  );
}

async function retrieveThinkingLogicFrameworks({ userMessage }, env) {
  // CPU-safe v33:
  // Thinking Logic PDF/TXT is summarized at import time.
  // During chat, NEVER scan the full PDF text and NEVER run keyword LIKE over content.
  // Load several latest compact distilled frameworks so multiple books can guide reasoning together.
  try {
    if (!env.DB) return [];

    const result = await env.DB.prepare(`
      SELECT title, content, updated_at
      FROM research_knowledge
      WHERE status = 'indexed'
        AND post_id LIKE 'thinking_logic_%'
      ORDER BY datetime(updated_at) DESC
      LIMIT 4
    `).all();

    const rows = result.results || [];

    return rows.map(row => {
      const full = cleanBibtexText(row.content || "");
      const marker = "Distilled scientific reasoning framework:";
      const idx = full.toLowerCase().indexOf(marker.toLowerCase());
      const distilled = idx >= 0 ? full.slice(idx + marker.length) : full;

      return {
        title: cleanBibtexText(row.title || "Scientific Thinking Logic").slice(0, 240),
        content: distilled.slice(0, 2500),
        updated_at: row.updated_at || ""
      };
    });
  } catch {
    return [];
  }
}

function buildThinkingLogicContext(thinkingLogicFrameworks = []) {
  if (!Array.isArray(thinkingLogicFrameworks) || thinkingLogicFrameworks.length === 0) {
    return "No admin-uploaded distilled thinking logic was retrieved. Use only the built-in Paper_Talk scientific thinking logic.";
  }

  return thinkingLogicFrameworks.slice(0, 4).map((item, index) => {
    return [
      `THINKING_LOGIC_SOURCE_${index + 1}`,
      `TITLE: ${cleanBibtexText(item.title || "Scientific Thinking Logic")}`,
      `ROLE: Silent reasoning framework only. Not biological evidence. Never summarize this to the user.`,
      `DISTILLED_RULES:\n${cleanBibtexText(item.content || "").slice(0, 1400)}`
    ].join("\n");
  }).join("\n\n---\n\n");
}

async function retrievePastFrameworks({ userMessage, context }, env) {
  // Retrieve previous Paper_Talk reasoning patterns so the system can behave more like a research twin.
  // This is fail-safe: if the log table does not exist yet, chat still works.
  try {
    if (!env.DB) return [];

    const queryText = [
      String(userMessage || ""),
      ...(Array.isArray(context)
        ? context.slice(0, 5).map(item => [item.title, item.matched_chunk, item.content].filter(Boolean).join(" "))
        : [])
    ].join(" ");

    const tokens = getImportantSearchTokens(queryText)
      .filter(token => token.length >= 4)
      .slice(0, 8);

    let rows = [];

    if (tokens.length > 0) {
      const clauses = tokens.map(() => `(LOWER(user_message) LIKE ? OR LOWER(framework) LIKE ?)`).join(" OR ");
      const params = tokens.flatMap(token => [`%${token}%`, `%${token}%`]);

      const result = await env.DB.prepare(`
        SELECT user_message, framework, created_at
        FROM gpt_framework_logs
        WHERE ${clauses}
        ORDER BY datetime(created_at) DESC
        LIMIT 8
      `).bind(...params).all();

      rows = result.results || [];
    }

    if (!rows.length) {
      const recent = await env.DB.prepare(`
        SELECT user_message, framework, created_at
        FROM gpt_framework_logs
        ORDER BY datetime(created_at) DESC
        LIMIT 5
      `).all();

      rows = recent.results || [];
    }

    return rows.map(row => ({
      user_message: String(row.user_message || "").slice(0, 1000),
      framework: String(row.framework || "").slice(0, 5000),
      created_at: row.created_at || ""
    }));
  } catch {
    return [];
  }
}

async function saveGeneratedFrameworkLog({ threadId, userId, userMessage, framework, context }, env) {
  // Store the generated framework so Paper_Talk can accumulate its research reasoning patterns over time.
  // This is optional and fail-safe: if the table has not been created yet, chat will still work.
  try {
    if (!env.DB || !framework) return false;

    const sourceSummary = Array.isArray(context)
      ? context.slice(0, 8).map((item, index) => ({
          index: index + 1,
          title: item.title || "",
          source_url: item.source_url || "",
          pdf_link: item.pdf_link || "",
          similarity_score: item.similarity_score || null
        }))
      : [];

    const frameworkWithSources = [
      String(framework || "").trim(),
      sourceSummary.length
        ? "\n\nRetrieved Paper_Talk sources used for this framework:\n" + JSON.stringify(sourceSummary, null, 2)
        : ""
    ].filter(Boolean).join("");

    await env.DB.prepare(`
      INSERT INTO gpt_framework_logs (
        id,
        thread_id,
        user_id,
        user_message,
        framework,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      threadId,
      userId,
      String(userMessage || "").slice(0, 4000),
      frameworkWithSources.slice(0, 24000)
    ).run();

    return true;
  } catch (error) {
    // Do not block the chat if framework logging fails.
    return false;
  }
}

async function generateResearchFramework({ userMessage, context, pastFrameworks = [] }, env) {
  const hasContext = Array.isArray(context) && context.length > 0;

  const sourceMap = hasContext
    ? context.slice(0, 12).map((item, index) => {
        const sourceText = cleanBibtexText(item.matched_chunk || item.content || "");
        return [
          `Source ${index + 1}: ${cleanBibtexText(item.title || "Untitled source")}`,
          item.source_url ? `Article: ${item.source_url}` : "",
          item.pdf_link ? `PDF: ${item.pdf_link}` : "",
          item.similarity_score ? `Similarity score: ${item.similarity_score}` : "",
          `Available evidence excerpt: ${sourceText.slice(0, 900)}`
        ].filter(Boolean).join("\n");
      }).join("\n\n---\n\n")
    : "No matching Paper_Talk DB context was found.";

  const previousPattern = Array.isArray(pastFrameworks) && pastFrameworks.length > 0
    ? pastFrameworks.slice(0, 3).map((item, index) => {
        return [
          `Previous reasoning pattern ${index + 1}`,
          item.user_message ? `Previous question: ${String(item.user_message).slice(0, 400)}` : "",
          String(item.framework || "").slice(0, 900)
        ].filter(Boolean).join("\n");
      }).join("\n\n---\n\n")
    : "No previous reasoning pattern was retrieved.";

  return `
Paper_Talk DB-grounded Hypothesis Engine Framework

User research intent:
${String(userMessage || "").slice(0, 1000)}

Retrieved DB source map:
${sourceMap}

Previous Paper_Talk reasoning style memory:
${previousPattern}

Required reasoning sequence for the final answer:
1. Infer the user's likely research interest.
2. Use retrieved Paper_Talk DB papers as evidence.
3. Extract DB-supported known findings.
4. Identify knowledge gaps inside the retrieved DB evidence.
5. Generate cautious, testable hypotheses.
6. Propose computational and experimental validation strategies.
7. Rank hypotheses by novelty, feasibility, and risk.
8. Do not invent external papers, sample sizes, datasets, mechanisms, or biomarkers not present in the DB context.
9. If evidence is weak, explicitly say what is weak.
10. Answer in the same language as the user.
  `.trim();
}


async function inferUserResearchIntent({ userMessage, recentMessages = [] }, env) {
  const fallback = makeFallbackResearchIntent(userMessage);

  if (!env.OPENAI_API_KEY) return fallback;

  const recentText = Array.isArray(recentMessages)
    ? recentMessages
        .slice(-4)
        .map(m => `${m.role || "user"}: ${String(m.content || "").slice(0, 500)}`)
        .join("\n")
    : "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `
You are the automatic question-type and research-intent interpreter for Paper_Talk Vision GPT.

First classify the user's actual intent. Do not force every question into hypothesis generation.

Return only valid JSON.

Required JSON keys:
- question_type: one of CONCEPT, RESEARCH, VALIDATION, LITERATURE, GENERAL.
- should_generate_hypotheses: boolean.
- should_use_db_evidence: boolean.
- interpreted_intent: one sentence explaining what the user is actually asking for.
- primary_domain: short field name, for example spatial omics, cancer genomics, immuno-oncology, neurodegeneration, single-cell analysis.
- key_entities: array of important diseases, methods, genes, cell types, technologies, or biological concepts.
- retrieval_query: concise English search query for Paper_Talk DB retrieval. Include synonyms and biomedical terms.
- gap_axes: array of gap types to check only if the user wants research directions.
- hypothesis_angle: one sentence only if hypotheses are appropriate; otherwise empty string.
- validation_angle: one sentence only if validation planning is appropriate; otherwise empty string.
- answer_style: one of educational_overview, hypothesis_generation, validation_plan, literature_review, concise_answer.

Classification rules:
CONCEPT:
- The user asks "what is", "define", "meaning", "overview", "explain", "개념", "정의", "무슨 뜻", "뭐야", "뭐지".
- Answer with definition, overview, types, why it matters, examples, limitations.
- Do NOT generate research gaps, hypotheses, novelty scores, or validation strategies unless the user explicitly asks for research ideas.

RESEARCH:
- The user asks for research ideas, gaps, hypotheses, future directions, "what should I study", "연구 주제", "가설", "gap", "future work".
- Generate DB-grounded gaps, hypotheses, and validation strategies.

VALIDATION:
- The user asks how to test, validate, design experiments, analyze datasets, controls, statistics, protocol.
- Focus on validation strategy. Generate hypotheses only if needed.

LITERATURE:
- The user asks for papers, DB sources, summaries, related studies, literature review.
- Focus on retrieved papers and findings. Do not invent hypotheses unless asked.

GENERAL:
- Use a direct concise answer.

Do not answer the user's question.
Do not cite papers.
Do not use markdown.
            `.trim()
          },
          {
            role: "user",
            content: `
Recent conversation:
${recentText || "No recent conversation."}

Current user message:
${String(userMessage || "").slice(0, 1200)}
            `.trim()
          }
        ],
        temperature: 0,
        max_completion_tokens: 800
      })
    });

    const data = await readJsonResponseSafely(res, "OpenAI intent-classification request");

    const content = extractOpenAIText(data);
    const parsed = parseJsonObjectFromText(content);

    if (!parsed || typeof parsed !== "object") return fallback;

    const questionType = normalizeQuestionType(parsed.question_type || fallback.question_type);
    const shouldGenerateHypotheses =
      typeof parsed.should_generate_hypotheses === "boolean"
        ? parsed.should_generate_hypotheses
        : questionType === "RESEARCH";

    const shouldUseDbEvidence =
      typeof parsed.should_use_db_evidence === "boolean"
        ? parsed.should_use_db_evidence
        : ["RESEARCH", "VALIDATION", "LITERATURE", "METHOD", "PIPELINE"].includes(questionType);

    return {
      question_type: questionType,
      should_generate_hypotheses: shouldGenerateHypotheses,
      should_use_db_evidence: shouldUseDbEvidence,
      interpreted_intent: String(parsed.interpreted_intent || fallback.interpreted_intent).slice(0, 600),
      primary_domain: String(parsed.primary_domain || fallback.primary_domain).slice(0, 160),
      key_entities: Array.isArray(parsed.key_entities) ? parsed.key_entities.map(v => String(v).slice(0, 100)).slice(0, 12) : fallback.key_entities,
      retrieval_query: String(parsed.retrieval_query || fallback.retrieval_query).slice(0, 700),
      gap_axes: Array.isArray(parsed.gap_axes) ? parsed.gap_axes.map(v => String(v).slice(0, 120)).slice(0, 10) : fallback.gap_axes,
      hypothesis_angle: shouldGenerateHypotheses ? String(parsed.hypothesis_angle || fallback.hypothesis_angle).slice(0, 500) : "",
      validation_angle: String(parsed.validation_angle || fallback.validation_angle).slice(0, 500),
      answer_style: normalizeAnswerStyle(parsed.answer_style || fallback.answer_style)
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeQuestionType(value) {
  const label = String(value || "").trim().toUpperCase();
  if (["CONCEPT", "RESEARCH", "METHOD", "PIPELINE", "VALIDATION", "LITERATURE", "GENERAL"].includes(label)) return label;
  if (["PIPELINE_WORKFLOW", "WORKFLOW", "ANALYSIS_PIPELINE", "ANALYSIS_WORKFLOW", "END_TO_END_PIPELINE"].includes(label)) return "PIPELINE";
  if (["METHODS", "METHODOLOGY", "ANALYSIS_METHOD", "ANALYSIS_METHODS", "PRACTICAL_METHOD"].includes(label)) return "METHOD";
  return "GENERAL";
}

function normalizeAnswerStyle(value) {
  const label = String(value || "").trim().toLowerCase();
  if (["educational_overview", "hypothesis_generation", "validation_plan", "literature_review", "end_to_end_workflow", "pipeline_workflow", "paper_grounded_workflow", "practical_method_table", "method_extraction", "concise_answer"].includes(label)) return label;
  return "concise_answer";
}

function inferQuestionTypeHeuristically(userMessage) {
  const message = String(userMessage || "").toLowerCase();

  const conceptPattern = /(what is|what are|define|definition|meaning|overview|explain|introduction to|개념|정의|뜻|무슨 뜻|뭐야|뭐지|무엇|설명|개요)/i;
  const researchPattern = /(research idea|hypothesis|hypotheses|knowledge gap|gap|future direction|what should i study|study idea|project idea|연구 주제|연구 아이디어|가설|연구 방향|뭘 연구|무슨 연구|future work)/i;
  const validationPattern = /(validate|validation|experiment|experimental design|protocol|control|statistic|analysis plan|test this|검증|실험|프로토콜|대조군|분석 방법|어떻게 확인)/i;
  const pipelinePattern = /(pipeline|workflow|end[-\s]?to[-\s]?end|step[-\s]?by[-\s]?step|analysis\s+order|procedure|파이프라인|워크플로우|분석\s*순서|분석\s*단계|단계별|전체\s*분석|처음부터)/i;
  const methodPattern = /(package|packages|software|tool|tools|method|methods|algorithm|implementation|model|패키지|툴|도구|방법론|분석법|알고리즘|구현|모델)/i;
  const literaturePattern = /(paper|papers|article|literature|review|summary|summari[sz]e|résumé|résume|résumer|resumen|resumir|sumario|zusammenfassung|riassunto|sintesi|要約|总结|總結|摘要|related studies|논문|문헌|리뷰|요약|관련 연구)/i;

  if (researchPattern.test(message)) return "RESEARCH";
  if (pipelinePattern.test(message)) return "PIPELINE";
  if (validationPattern.test(message)) return "VALIDATION";
  if (methodPattern.test(message)) return "METHOD";
  if (literaturePattern.test(message)) return "LITERATURE";
  if (conceptPattern.test(message)) return "CONCEPT";
  return "GENERAL";
}

function parseJsonObjectFromText(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function makeFallbackResearchIntent(userMessage) {
  const message = String(userMessage || "").trim();
  const normalized = normalizeSearchText(message);
  const questionType = inferQuestionTypeHeuristically(message);

  const entities = normalized
    .split(/\s+/)
    .filter(v => v.length >= 3)
    .slice(0, 8);

  const shouldGenerateHypotheses = questionType === "RESEARCH";
  const shouldUseDbEvidence = ["RESEARCH", "VALIDATION", "LITERATURE", "METHOD", "PIPELINE"].includes(questionType);

  const answerStyle =
    questionType === "CONCEPT" ? "educational_overview" :
    questionType === "RESEARCH" ? "hypothesis_generation" :
    questionType === "METHOD" ? "practical_method_table" :
    questionType === "PIPELINE" ? "paper_grounded_workflow" :
    questionType === "VALIDATION" ? "validation_plan" :
    questionType === "LITERATURE" ? "literature_review" :
    "concise_answer";

  return {
    question_type: questionType,
    should_generate_hypotheses: shouldGenerateHypotheses,
    should_use_db_evidence: shouldUseDbEvidence,
    interpreted_intent: message
      ? questionType === "CONCEPT"
        ? `The user is asking for a definition or overview of "${message}", not for hypothesis generation.`
        : `The user is asking about "${message}" with question type ${questionType}.`
      : "The user did not provide a specific topic.",
    primary_domain: "biomedical research",
    key_entities: entities,
    retrieval_query: [message, normalized, "biomedical research cancer genomics spatial omics single-cell multi-omics"].filter(Boolean).join(", ").slice(0, 700),
    gap_axes: shouldGenerateHypotheses
      ? [
          "mechanism",
          "cell type",
          "spatial niche",
          "disease or cancer context",
          "multi-omics integration",
          "cohort validation",
          "experimental perturbation"
        ]
      : [],
    hypothesis_angle: shouldGenerateHypotheses
      ? "Generate cautious, testable hypotheses by connecting DB-supported findings and unresolved gaps."
      : "",
    validation_angle: questionType === "VALIDATION"
      ? "Propose computational and experimental validation steps with controls and limitations."
      : "",
    answer_style: answerStyle
  };
}


function hideInternalEvidenceLeaksFromNormalAnswer(answer) {
  let text = String(answer || "");
  text = text.replace(/\s*\/\s*retrieval score:\s*[0-9.]+/gi, "").replace(/retrieval score:\s*[0-9.]+/gi, "");
  if (!text.trim()) return text;

  // Remove parenthetical source leaks like (논문 A: Title...) or (Paper B: Title...).
  text = text.replace(/\s*[\(\[]\s*(?:논문|paper)\s*[A-J]\s*[:：][^\)\]\n]{0,1000}[\)\]]/gi, "");

  // Remove visible retrieved title chains, often English biomedical titles separated by colons.
  text = text.replace(/검색된\s+[A-Z][A-Za-z0-9\s,\-–—:;'"“”()\/]{40,700}(?=\n|###|1\.|2\.|3\.|4\.|5\.)/g, "검색된 Paper_Talk DB 근거들을 종합하면,\n현재 이 주제는 몇 가지 연구 축으로 정리할 수 있습니다.\n\n");

  // Remove direct source labels or inline paper labels.
  text = text
    .replace(/(?:논문|paper)\s*[A-J]\s*[:：][^\n]{0,1000}/gi, "")
    .replace(/(?:예를\s*들어\s*)?(?:논문|paper)\s*[A-J]\s*(?:에서는|은|는|에서|에 따르면|를 통해|shows|suggests|indicates|reports|demonstrates|reveals|finds)\s*/gi, "")
    .replace(/(?:\(|\[)?\s*(?:논문|paper)\s*[A-J]\s*(?:\)|\])?/gi, "");

  const lines = text.split(/\r?\n/);
  const kept = [];

  for (let rawLine of lines) {
    let line = rawLine.trim();

    if (!line) {
      kept.push("");
      continue;
    }

    if (/^(근거\s*논문|참고\s*논문|사용한\s*논문|supporting papers?|references?|sources?|relevant papers?)\s*[:：]?$/i.test(line)) continue;
    if (/^(?:article|pdf|doi|pmid|journal|authors?)\s*[:：]/i.test(line)) continue;

    const colonCount = (line.match(/:/g) || []).length;
    const englishTitleLike = /[A-Za-z]{8,}/.test(line) && line.length > 80;
    if (colonCount >= 2 && englishTitleLike) continue;

    // Remove a single title-looking line at the top.
    if (/^[A-Z][A-Za-z0-9\s,\-–—:;'"“”()\/]{70,}$/.test(line) && !/[가-힣]/.test(line)) continue;

    line = line
      .replace(/\s*[\(\[]\s*(?:논문|paper)\s*[A-J][^\)\]]{0,800}[\)\]]/gi, "")
      .replace(/^(첫째|둘째|셋째|넷째|다섯째)\s*,?\s*(?:논문|paper)?\s*[A-J]?\s*(?:에서는|은|는|에서)?\s*/i, "")
      .replace(/^논문\s*[A-J]\s*(?:에서는|은|는|에서|에 따르면|를 통해|은\/는)\s*/i, "")
      .replace(/^Paper\s*[A-J]\s*(?:shows|suggests|indicates|reports|demonstrates|reveals|finds|에서는|은|는)?\s*/i, "");

    if (line.trim()) kept.push(line);
  }

  text = kept.join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?:아래|다음)\s*(?:논문|문헌|Paper_Talk DB 논문|근거)\s*(?:들을|을)?\s*(?:기반으로|토대로|참고해서)?\s*(?:답변|종합)?(?:했습니다|합니다|드리겠습니다)?\s*[:：]?\s*/gi, "")
    .replace(/검색된\s*Paper_Talk\s*DB\s*근거들을\s*종합하면,\s*다음과\s*같은\s*연구\s*방향이\s*특히\s*유망할\s*것으로\s*보입니다\s*[:：]\s*/gi, "검색된 Paper_Talk DB 근거들을 종합하면,\n현재 이 주제는 몇 가지 연구 축으로 정리할 수 있습니다.\n\n")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || String(answer || "");
}

function hideAccidentalPaperListFromNormalAnswer(answer) {
  const original = String(answer || "");
  if (!original.trim()) return original;

  let text = original;

  // Remove parenthetical source leaks like:
  // (논문 A: Title...), (논문 B: Title...), (Paper C: Title...)
  text = text.replace(/\s*[\(\[]\s*(?:논문|paper)\s*[A-J]\s*[:：][^\)\]\n]{0,500}[\)\]]/gi, "");

  // Remove inline source labels while keeping the biological sentence readable.
  text = text
    .replace(/(?:예를\s*들어\s*)?(?:논문|paper)\s*[A-J]\s*(?:에서는|은|는|에서|에 따르면|를 통해|shows|suggests|indicates|reports|demonstrates|reveals|finds)\s*/gi, "")
    .replace(/(?:\(|\[)?\s*(?:논문|paper)\s*[A-J]\s*(?:\)|\])?/gi, "");

  const lines = text.split(/\r?\n/);
  const kept = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();

    // Hide internal retrieval labels, title dumps, and source-list headings in normal answers.
    if (/^(논문|paper)\s*[A-J]\s*[:：-]/i.test(line)) continue;
    if (/^\d+\.\s*(논문|paper)\s*[A-J]\s*[:：-]/i.test(line)) continue;
    if (/^(근거\s*논문|참고\s*논문|사용한\s*논문|supporting papers?|references?|sources?|relevant papers?)\s*[:：]?$/i.test(line)) continue;

    line = line
      .replace(/^(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째)\s*,?\s*(?:에서는|은|는)?\s*/i, match => {
        // Keep ordinal only if it is not immediately tied to a paper label.
        return match.replace(/(?:에서는|은|는)/g, "").trim() ? match : "";
      })
      .replace(/^논문\s*[A-J]\s*(?:에서는|은|는|에서|에 따르면|를 통해|은\/는)\s*/i, "")
      .replace(/^Paper\s*[A-J]\s*(?:shows|suggests|indicates|reports|demonstrates|reveals|finds|에서는|은|는)?\s*/i, "");

    if (!line.trim()) continue;
    kept.push(line);
  }

  let cleaned = kept.join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Remove dangling source-intro or literature-review sentences.
  cleaned = cleaned
    .replace(/(?:아래|다음|이)\s*(?:논문|문헌|Paper_Talk DB 논문|근거)\s*(?:들을|을)?\s*(?:기반으로|토대로|참고해서)?\s*(?:답변|종합)?(?:했습니다|합니다|드리겠습니다|얻을 수 있습니다)?\s*[:：]?\s*$/i, "")
    .replace(/이\s*(?:세|여러|몇\s*가지)\s*(?:논문|연구)\s*을?\s*통해[^\n.。]*[.。]?/gi, "")
    .replace(/이\s*논문들을\s*통해[^\n.。]*[.。]?/gi, "")
    .replace(/이\s*연구들은[^\n.。]*기초를\s*제공하며[^\n.。]*[.。]?/gi, "")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .trim();

  return cleaned || original;
}

function containsReportStyleHeadings(answer) {
  const text = String(answer || "");

  const forbiddenPatterns = [
    /^\s*\d+\.\s*Direct answer/im,
    /^\s*\d+\.\s*Relevant\s+(Paper_Talk\s+DB\s+)?papers/im,
    /^\s*\d+\.\s*Retrieved papers/im,
    /^\s*\d+\.\s*Paper-by-paper findings/im,
    /^\s*\d+\.\s*Agreements/im,
    /^\s*\d+\.\s*Differences or contradictions/im,
    /^\s*\d+\.\s*Contradictions/im,
    /^\s*\d+\.\s*Knowledge gaps/im,
    /^\s*\d+\.\s*Paper_Talk research interpretation/im,
    /^\s*\d+\.\s*Suggested next study/im,
    /Relevant Paper_Talk DB papers/i,
    /Paper-by-paper findings/i,
    /Agreements across retrieved papers/i,
    /Differences or contradictions/i,
    /Suggested next study or validation/i
  ];

  return forbiddenPatterns.some(pattern => pattern.test(text));
}

async function rewriteReportStyleAnswerIfNeeded({ originalAnswer, userMessage, context, env }) {
  const answer = String(originalAnswer || "");

  if (!answer.trim()) return answer;
  if (!containsReportStyleHeadings(answer)) return answer;

  if (!env.OPENAI_API_KEY) {
    return convertReportStyleAnswerLocally(answer);
  }

  const contextTitles = Array.isArray(context)
    ? [...new Set(context.map(item => cleanBibtexText(item?.title || "").trim()).filter(Boolean))]
    : [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `
You are rewriting a Paper_Talk GPT answer.

Goal:
Rewrite the answer into calm explanatory research prose.

The user wants this style:
"Spatial 연구를 새로 시작한다면, 단순히 세포의 위치를 설명하는 연구보다는 공간 정보와 세포 상태 변화를 연결하는 방향이 더 흥미로워 보입니다.

최근 spatial transcriptomics 연구들을 보면 조직 내 세포 분포나 niche 구조를 정교하게 설명하는 연구는 상당히 많이 축적되어 있습니다. 반면, 세포가 특정 공간에서 어떤 방향으로 분화하거나 상태 전이를 겪는지까지 설명하는 연구는 상대적으로 적습니다.

그래서 Spatial + RNA velocity, 또는 Spatial + longitudinal sample 분석 같은 접근이 좋은 연구 주제가 될 수 있습니다."

Strict rewriting rules:
- Do NOT add new scientific claims.
- Do NOT add new papers.
- Preserve the useful meaning from the original answer.
- Remove these report headings completely:
  Direct answer, Relevant papers, Retrieved papers, Paper-by-paper findings, Agreements, Contradictions, Knowledge gaps, Paper_Talk research interpretation, Suggested next study or validation.
- Do not list papers as bullets.
- If a paper title is useful, weave it naturally into a sentence as supporting evidence.
- Prefer connected Korean paragraphs.
- Use bullets only for concrete research questions or candidate project ideas.
- Do not sound casual like "음..." or "저는요".
- Do not sound like a report.
- Answer in the same language as the user's question.
- Return only the rewritten answer.
            `.trim()
          },
          {
            role: "system",
            content: contextTitles.length
              ? `Allowed Paper_Talk DB titles only:\n${contextTitles.map((title, i) => `${i + 1}. ${title}`).join("\n")}`
              : "No Paper_Talk DB titles were provided."
          },
          {
            role: "user",
            content: [
              `User question:`,
              String(userMessage || "").slice(0, 1200),
              ``,
              `Original report-style answer to rewrite:`,
              answer.slice(0, 7000)
            ].join("\n")
          }
        ],
        temperature: 0,
        max_completion_tokens: 1800
      })
    });

    const raw = await res.text();
    let data = {};

    try {
      data = JSON.parse(raw);
    } catch {
      return convertReportStyleAnswerLocally(answer);
    }

    if (!res.ok) {
      return convertReportStyleAnswerLocally(answer);
    }

    const rewritten = extractOpenAIText(data);

    if (!rewritten) return convertReportStyleAnswerLocally(answer);

    // If the rewrite somehow still contains the forbidden template, fall back to local cleanup.
    if (containsReportStyleHeadings(rewritten)) {
      return convertReportStyleAnswerLocally(rewritten);
    }

    return rewritten;
  } catch {
    return convertReportStyleAnswerLocally(answer);
  } finally {
    clearTimeout(timeout);
  }
}

function convertReportStyleAnswerLocally(answer) {
  const text = String(answer || "");

  const lines = text.split(/\r?\n/);
  const cleaned = [];
  let skipPaperListMode = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^\d+\.\s*(Direct answer|Relevant\s+(Paper_Talk\s+DB\s+)?papers|Retrieved papers|Paper-by-paper findings|Agreements|Differences or contradictions|Contradictions|Knowledge gaps|Paper_Talk research interpretation|Suggested next study)/i.test(line)) {
      skipPaperListMode = /Relevant\s+(Paper_Talk\s+DB\s+)?papers|Paper-by-paper findings/i.test(line);
      continue;
    }

    if (/^\d+\.\s+/i.test(line)) {
      skipPaperListMode = false;
    }

    // Remove long paper-title bullet dumps after old "Relevant papers" sections.
    if (skipPaperListMode && /^[-•]\s+/.test(line) && line.length > 80) {
      continue;
    }

    cleaned.push(rawLine);
  }

  let result = cleaned.join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*-\s+/gm, "")
    .trim();

  if (!result) {
    return text;
  }

  // Add a gentle opening if the answer became too abrupt.
  if (!/^[가-힣A-Za-z0-9]/.test(result)) {
    result = result.replace(/^[^\w가-힣]+/, "");
  }

  return result;
}


function detectStrictUserOutputFormat(userMessage) {
  const text = String(userMessage || "");
  const standaloneDashCount = (text.match(/^\s*-\s*$/gm) || []).length;

  const explicitCountMatch = text.match(/(?:^|[^0-9])(\d{1,2})\s*(?:줄|줄로|lines?|sentences?|문장|points?|bullets?|개|항목)/i);
  const explicitCount = explicitCountMatch ? Math.max(1, Math.min(12, Number(explicitCountMatch[1] || 0))) : 0;

  const asksBullet =
    standaloneDashCount >= 2 ||
    /bullet|bullets|point|points|목록|항목|불릿|하이픈|dash|dashes/i.test(text) ||
    /아래\s*처럼|이런\s*식|이렇게|형식|format/i.test(text) && standaloneDashCount >= 1;

  const asksLineCount =
    explicitCount > 0 ||
    /간략하게|짧게|brief|concise|short/i.test(text) && /줄|line|sentence|point|bullet/i.test(text);

  const strict = asksBullet || asksLineCount;

  let count = explicitCount || 0;
  if (!count && standaloneDashCount >= 2) count = Math.min(standaloneDashCount, 12);

  return {
    strict,
    bullet: asksBullet || standaloneDashCount >= 2,
    count,
    wantsEnglish: /영어|English/i.test(text),
    wantsKorean: /한국어|Korean/i.test(text)
  };
}

function buildUserRequestedFormatInstruction(userMessage) {
  const format = detectStrictUserOutputFormat(userMessage);
  if (!format.strict) return "";

  const countRule = format.count
    ? `- Return exactly ${format.count} lines/items.`
    : `- Return only the requested number of lines/items if the user specified it; otherwise keep it very concise.`;

  const bulletRule = format.bullet
    ? `- Each line/item MUST begin with a plain hyphen and one space: "- ".`
    : `- Use short separate lines, not a long paragraph.`;

  const languageRule = format.wantsEnglish
    ? `- The user requested English, so answer in English even if part of the prompt is Korean.`
    : format.wantsKorean
      ? `- The user requested Korean, so answer in Korean.`
      : `- Use the user's requested language.`;

  return `
USER-REQUESTED OUTPUT FORMAT OVERRIDE
The user explicitly requested a specific output format. This overrides the normal Paper_Talk paragraph style.
${countRule}
${bulletRule}
- Do NOT add an introduction.
- Do NOT add a conclusion.
- Do NOT add headings.
- Do NOT explain that you are following the format.
- Maximum one sentence per line/item.
${languageRule}
`.trim();
}

function enforceStrictUserOutputFormat(answer, userMessage) {
  const format = detectStrictUserOutputFormat(userMessage);
  if (!format.strict) return String(answer || "").trim();

  let text = String(answer || "")
    .replace(/\r/g, "\n")
    .replace(/^\s*(Here are|Sure|물론입니다|네[,，]?|아래는).*?:\s*/i, "")
    .trim();

  let items = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  if (items.length <= 1) {
    const sentenceMatches = text.replace(/\n+/g, " ").match(/[^.!?。！？]+[.!?。！？]?/g) || [];
    items = sentenceMatches
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  if (!items.length) return text;

  const count = format.count || Math.min(items.length, 4);
  const picked = items.slice(0, count);

  const normalized = picked
    .map(item => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!format.bullet) {
    return normalized.join("\n");
  }

  return normalized
    .map(item => `- ${item}`)
    .join("\n");
}


// v72 note: legacy normalizePaperTalkIntentLabel was removed to avoid duplicate top-level declaration.

function detectPaperTalkUserIntent(userMessage, intent = null, hasContext = false) {
  const raw = String(userMessage || "");
  const questionType = normalizeQuestionType(intent?.question_type || "GENERAL");
  const answerStyle = normalizeAnswerStyle(intent?.answer_style || "concise_answer");

  // Hard priority:
  // 1. Explicit source tracing: "어떤 논문 기반?", "근거 논문?", "출처?"
  // 2. Paper recommendation/literature: "논문 추천", "최신 논문", "트렌디한 논문"
  // 3. Follow-up more: use previous topic/task
  // 4. Research direction: "어떤 연구", "유망", "앞으로", "연구 방향"
  // 5. Validation / comparison / method / concept

  if (isExplicitSourceTraceRequest(raw)) {
    return "SOURCE_TRACE";
  }

  const semanticIntent = normalizePaperTalkIntentLabel(intent?.paper_talk_intent || "");
  if (semanticIntent === "PIPELINE_WORKFLOW" || questionType === "PIPELINE" || answerStyle === "end_to_end_workflow" || answerStyle === "pipeline_workflow" || answerStyle === "paper_grounded_workflow") {
    return "PIPELINE_WORKFLOW";
  }

  if (semanticIntent === "METHOD_EXTRACTION" || questionType === "METHOD" || answerStyle === "practical_method_table" || answerStyle === "method_extraction") {
    return "METHOD_EXTRACTION";
  }

  // Fallback only. The main route should come from the LLM intent planner above.
  if (/(pipeline|workflow|end[-\s]?to[-\s]?end|step[-\s]?by[-\s]?step|analysis\s+order|procedure|파이프라인|워크플로우|분석\s*순서|분석\s*단계|단계별|전체\s*분석|처음부터)/i.test(raw)) {
    return "PIPELINE_WORKFLOW";
  }

  if (/(논문|paper|papers|study|studies).{0,60}(썼|사용|used|applied|implemented|분석|방법|패키지|도구|툴|software|method|package|tool)|(?:package|packages|software|tool|tools|method|methods|algorithm|model|패키지|툴|도구|방법론|분석법|알고리즘|모델)/i.test(raw)) {
    return "METHOD_EXTRACTION";
  }

  if (isPaperRecommendationRequest(raw)) {
    return "LITERATURE_REVIEW";
  }

  if (/(논문\s*정리|논문\s*요약|문헌\s*리뷰|문헌\s*정리|literature review|paper review|summarize papers?|papers?\s+about)/i.test(raw)) {
    return "LITERATURE_REVIEW";
  }

  if (hasContext && isEvidenceStyleAssociationQuestion(raw)) {
    return "LITERATURE_REVIEW";
  }

  if (isContinuationMoreRequest(raw)) {
    return "FOLLOW_UP_MORE";
  }

  if (isResearchDirectionRequest(raw)) {
    return "RESEARCH_DIRECTION";
  }

  if (/(검증|실험|validation|validate|experimental design|experiment|protocol|control|대조군|분석\s*방법|어떻게\s*확인|how to test|test this|assay|perturbation)/i.test(raw)) {
    return "VALIDATION_PLAN";
  }

  if (/(비교|차이|다른점|공통점|compare|comparison|difference|similarity|versus| vs\.? )/i.test(raw)) {
    return "COMPARISON";
  }

  if (/(방법론|method|algorithm|분석법|어떻게\s*분석|tool|툴)/i.test(raw)) {
    return "METHOD_EXPLANATION";
  }

  if (/(개념|정의|뜻|뭐야|무엇|설명|기전|메커니즘|mechanism|overview|explain|what is|define|meaning|why does|how does)/i.test(raw)) {
    return "CONCEPT_EXPLANATION";
  }

  if (questionType === "LITERATURE" || answerStyle === "literature_review") return "LITERATURE_REVIEW";
  if (questionType === "RESEARCH" || answerStyle === "hypothesis_generation") return "RESEARCH_DIRECTION";
  if (questionType === "PIPELINE" || answerStyle === "end_to_end_workflow" || answerStyle === "pipeline_workflow" || answerStyle === "paper_grounded_workflow") {
    return `
Selected mode: PAPER-GROUNDED DOMAIN-SPECIFIC ANALYSIS WORKFLOW.

The user wants an actual analysis pipeline or workflow.
The workflow must be synthesized from retrieved Paper_Talk DB papers in the requested domain, not from generic protocol knowledge first.
Do not answer as trend recommendation.
Do not recommend papers as reading material unless the user asks.

Recommended structure:
- Direct answer in the user's language.
- First section: workflow patterns used or implied by retrieved papers, with exact DB titles only when they support a workflow/tool claim.
- Second section: synthesized step-by-step workflow from raw data to biological interpretation.
- For each step: purpose, input, DB-supported packages/tools/methods, general recommendation for missing steps, output, and QC/checkpoint.
- For spatial questions, use spatial papers and spatial workflow components.
- For single-cell/scRNA/scATAC/multiome questions, use single-cell/multiome papers and workflow components.
- End with the simplest paper-consistent starting pipeline.
    `.trim();
  }

  if (questionType === "METHOD" || answerStyle === "practical_method_table" || answerStyle === "method_extraction") return "METHOD_EXTRACTION";
  if (questionType === "VALIDATION" || answerStyle === "validation_plan") return "VALIDATION_PLAN";
  if (questionType === "CONCEPT" || answerStyle === "educational_overview") return "CONCEPT_EXPLANATION";

  return "GENERAL_RESEARCH";
}

function determinePaperTalkOutputStyle({ userMessage, intent, hasContext }) {
  const semanticIntent = normalizePaperTalkIntentLabel(intent?.paper_talk_intent || "");

  if (semanticIntent === "PIPELINE_WORKFLOW") return "PIPELINE_WORKFLOW";
  if (semanticIntent === "METHOD_EXTRACTION") return "METHOD_EXTRACTION";
  if (semanticIntent === "LITERATURE_REVIEW") return "LITERATURE_REVIEW";
  if (semanticIntent === "RESEARCH_IDEA") return "RESEARCH_INSIGHT";
  if (semanticIntent === "VALIDATION") return "VALIDATION_PLAN";
  if (semanticIntent === "COMPARISON") return "COMPARISON";
  if (semanticIntent === "CONCEPT") return "CONCEPT_EXPLANATION";
  if (semanticIntent === "PAPER_SUMMARY") return "PAPER_SUMMARY";
  if (semanticIntent === "SOURCE_TRACE") return "SOURCE_TRACE";

  const detectedIntent = detectPaperTalkUserIntent(userMessage, intent, hasContext);

  switch (detectedIntent) {
    case "SOURCE_TRACE":
      return "SOURCE_TRACE";
    case "LITERATURE_REVIEW":
      return "LITERATURE_REVIEW";
    case "PIPELINE_WORKFLOW":
      return "PIPELINE_WORKFLOW";
    case "METHOD_EXTRACTION":
      return "METHOD_EXTRACTION";
    case "FOLLOW_UP_MORE":
      return "FOLLOW_UP_MORE";
    case "RESEARCH_DIRECTION":
      return "RESEARCH_INSIGHT";
    case "VALIDATION_PLAN":
      return "VALIDATION_PLAN";
    case "CONCEPT_EXPLANATION":
      return "CONCEPT_EXPLANATION";
    case "COMPARISON":
      return "COMPARISON";
    case "METHOD_EXPLANATION":
      return "METHOD_EXTRACTION";
    case "PAPER_SUMMARY":
      return "PAPER_SUMMARY";
    case "GENERAL_RESEARCH":
      return hasContext ? "RESEARCH_SYNTHESIS" : "STANDARD";
    default:
      return hasContext ? "RESEARCH_SYNTHESIS" : "STANDARD";
  }
}


function detectUserLanguage(text) {
  const value = String(text || "").trim();

  const overrideMatch = value.match(/ANSWER_LANGUAGE_OVERRIDE:\s*(English|Korean|Japanese|Chinese|Multilingual)/i);
  if (overrideMatch) {
    const label = overrideMatch[1].toLowerCase();
    if (label === "english") return "English";
    if (label === "korean") return "Korean";
    if (label === "japanese") return "Japanese";
    if (label === "chinese") return "Chinese";
    if (label === "multilingual") return "Multilingual";
  }

  // Explicit target-language phrases in the current user instruction should win
  // over older retrieved/context text that may contain Korean, English, or mixed language.
  if (/(영어로|영문으로|in english|to english|answer in english)/i.test(value)) return "English";
  if (/(한국어로|한글로|in korean|to korean|answer in korean)/i.test(value)) return "Korean";
  if (/(일본어로|일어로|in japanese|to japanese)/i.test(value)) return "Japanese";
  if (/(중국어로|중문으로|in chinese|to chinese)/i.test(value)) return "Chinese";
  if (/(다국어|여러\s*언어|multilingual|multi[-\s]?language|multiple languages|several languages)/i.test(value)) return "Multilingual";

  if (/[가-힣]/.test(value)) return "Korean";
  if (/[\u3040-\u30ff]/.test(value)) return "Japanese";
  if (/[\u4e00-\u9fff]/.test(value)) return "Chinese";

  // Default to English for Latin-script scientific questions.
  return "English";
}

function buildMultilingualAnswerInstruction(userMessage) {
  const language = detectUserLanguage(userMessage);

  if (language === "Multilingual") {
    return `
MULTILINGUAL LANGUAGE POLICY

Detected user language request: Multilingual

Answer in a compact multilingual format.
Do not default to Korean merely because previous context or retrieved DB context contains Korean.
If the user names exact target languages, use those languages.
If the user only says "multilingual" or "다국어", use English as the primary language and add short parallel versions in 1-2 additional common languages only when useful.

Paper titles, gene names, software names, model names, and technical terms may remain in their original language.
`.trim();
  }

  return `
MULTILINGUAL LANGUAGE POLICY

Detected user language: ${language}

Answer entirely in ${language}.
Do not mix languages in section titles, explanations, summaries, paper recommendation labels, research ideas, or conclusions.

Important follow-up rule:
- If the current user request explicitly asks for a target language, that target language overrides older conversation context.
- Do not answer in Korean only because older context or retrieved DB context contains Korean.

If the user asks in English:
- Use English section titles such as "Why this matters", "Recommended papers", "How to read this", "Next research ideas".
- Do not use Korean labels such as "추천 논문", "왜 중요한가", "다음 연구 아이디어".

If the user asks in Korean:
- Use Korean section titles such as "왜 중요한가", "추천 논문", "어떻게 읽으면 좋은가", "다음 연구 아이디어".
- Do not switch to English section titles unless they are scientific terms.

If the user asks in Japanese or Chinese:
- Keep the whole answer in that language.
- Scientific method names and paper titles may remain in English.

Paper titles, gene names, software names, model names, and technical terms may remain in their original language.
But all explanatory sentences and section labels must follow the detected user language.
`.trim();
}


function buildAdaptiveStyleInstruction({ outputStyle, hasContext, userMessage = "" }) {
  const common = `
GENERAL READABILITY RULES
- Match the user's language and answer the user's real question first.
- Do not force a rigid template. Choose the clearest structure for the question.
- Start with the core takeaway in 2-4 friendly sentences before details.
- Use short paragraphs, natural headings in the same language as the user, and concrete examples.
- Prefer "what this means / why it matters / what to do next" over mechanical summaries.
- Keep a calm senior cancer-genomics mentor tone: clear, kind, practical, and research-aware.
- Do not invent papers, authors, years, datasets, biomarkers, or conclusions.
- If DB evidence is used internally but the user did not ask for sources, do not expose paper labels or source tracing.
  `.trim();

  const associationEvidenceStyle = isEvidenceStyleAssociationQuestion(userMessage);

  if (outputStyle === "LITERATURE_REVIEW" && associationEvidenceStyle) {
    return `
${common}

AUTOMATIC STYLE: OLD PAPER_TALK BIOLOGICAL ASSOCIATION ANSWER

The user is asking whether biological entities, cell types, or tumor microenvironment components are associated with a phenomenon such as immunosuppression, immune exclusion, therapy response, or cancer progression.
Restore the older Paper_Talk answer style the user preferred.

Critical style rule:
Do NOT write a recommendation-card format.
Do NOT use these labels: "Recommended Paper", "How to Read", "Next Research Idea", "Recommended reading", or "Reading order".
Do NOT sound like a paper recommendation list.

Preferred answer shape:
1. Start with a direct explanatory opening paragraph: answer yes/no or cautiously yes, then explain why the association matters biologically.
2. Then write 3 to 5 numbered insight sections. Use natural scientific headings such as:
   1. CAF-Macrophage Crosstalk in the Tumor Microenvironment
   2. Role in Immune Suppression
   3. Contribution to Immune Exclusion
   4. Spatial Organization and Immune Contexture
   5. Why this matters for therapy or future research
3. In each section, explain the biology first.
4. Mention retrieved Paper_Talk DB titles only when they naturally support that section. Weave the title into the prose, for example:
   The retrieved Paper_Talk source "Fibroblast-macrophage reciprocal interactions in health, fibrosis, and cancer" is useful here because it frames fibroblast-macrophage communication as a reciprocal niche-forming process.
5. Do not create one block per paper. Do not use paper labels such as Paper A/B/C.
6. If a retrieved title is only indirectly related, say it is indirect and use it cautiously.
7. End with a short "In summary" paragraph that sounds like the earlier Paper_Talk answer: synthesis first, then future direction.

For the CAF-macrophage / immunosuppression / immune exclusion type of question, the answer should feel close to:
- "The association between CAFs and macrophages is important in tumor immunology..."
- "CAFs can shape macrophage recruitment or polarization, while macrophages reinforce matrix remodeling, suppressive cytokine signaling, and T cell exclusion..."
- "Spatial profiling papers are relevant because they can test whether CAF-rich regions and macrophage-rich regions co-localize with T-cell-poor tumor zones..."

Return the answer in the user's language.
    `.trim();
  }

  if (outputStyle === "PIPELINE_WORKFLOW") {
    return `
${common}

AUTOMATIC STYLE: PAPER-GROUNDED DOMAIN-SPECIFIC ANALYSIS WORKFLOW

The user is asking for an analysis pipeline/workflow.
The answer must first find/refer to papers that match the user's provided keyword/domain in the retrieved Paper_Talk DB context, then extract the workflows used in those papers.
Do not give a generic workflow first.
Do not answer as trends or paper recommendations.
If the retrieved DB context does not contain enough keyword-matched workflow evidence, say that clearly before giving any general fallback workflow.

Core behavior:
1. Infer the domain from the question.
   - If the user asks single-cell/scRNA/scATAC/multiome, use single-cell or multiome papers as the workflow basis.
   - If the user asks spatial/spatial transcriptomics, use spatial transcriptomics/spatial omics papers as the workflow basis.
   - If the user asks cancer, immune, aging, or another domain, keep the workflow specific to that domain and data type.
2. First identify the keyword-matched papers from the retrieved context.
3. Then extract what workflows those papers actually used or imply.
4. Then synthesize a practical workflow from those paper-grounded patterns.
5. Only after that, add general practical recommendations when the DB context is thin or a step is missing.

Required output structure:
1. Start with a direct sentence in the user's language, for example:
   "이건 generic workflow가 아니라, 관련 논문들에서 실제로 어떤 분석 흐름을 썼는지 기준으로 정리해야 합니다."

2. Section: "먼저 찾은 관련 pipeline 논문"
   Use a table with columns:
   - 논문 / DB 근거 제목
   - 왜 이 키워드와 관련 있는지
   - 데이터 타입
   - 논문에서 확인되는 workflow 단서
   - 명시된 tool / method
   If there are no keyword-matched papers in the retrieved DB context, say: "현재 검색된 Paper_Talk DB context만으로는 이 키워드에 맞는 pipeline 논문 근거가 충분하지 않습니다."

3. Section: "논문에서 보이는 workflow 패턴"
   Use a table with columns:
   - workflow 단계
   - 이 단계가 나온 논문 / DB 근거 제목
   - 실제 분석 흐름
   - 명시된 tool / method
   - 내가 가져다 쓰면 좋은 부분
   If retrieved DB context does not explicitly show the workflow or tools, say so clearly.

4. Section: "종합 workflow"
   Give a step-by-step workflow with columns:
   - 단계
   - 목적
   - input
   - 논문에서 확인된 tool/method
   - 부족한 경우 보완할 general recommendation
   - output
   - QC/checkpoint

5. Domain-specific expectations:
   For scRNA-seq / scATAC-seq / multiome:
   - FASTQ/count/fragment generation: Cell Ranger, Cell Ranger ARC, STARsolo, alevin-fry when relevant.
   - scRNA QC/normalization/clustering/annotation: Seurat, Scanpy, SCTransform, SingleR/Azimuth/CellTypist when relevant.
   - scATAC QC/peak/LSI/gene activity: ArchR, Signac, SnapATAC2, MACS2, TSS enrichment, FRiP.
   - integration: Seurat/Signac WNN for same-cell multiome; LIGER/iNMF, GLUE, MultiVI/scvi-tools, Harmony, MOFA+ for cross-dataset or multi-omics integration when relevant.
   - regulatory interpretation: chromVAR, Cicero, SCENIC/pySCENIC, SCENIC+.

   For spatial transcriptomics / spatial omics:
   - platform-aware preprocessing: Visium, Xenium, CosMx, MERFISH, Slide-seq, seqFISH when relevant.
   - spot/cell QC and normalization: Seurat, Scanpy, Squidpy, Giotto when relevant.
   - cell type deconvolution / mapping: cell2location, Tangram, RCTD, stereoscope, SPOTlight when relevant.
   - spatial domain/niche detection: BayesSpace, SpaGCN, STAGATE, Squidpy, Giotto when relevant.
   - spatial cell-cell interaction: CellChat, NicheNet, LIANA, Squidpy ligand-receptor analysis, MISTy when relevant.
   - histology/image integration: Squidpy, Giotto, image features, segmentation, morphology-aware models when relevant.

6. Evidence labeling:
   - "DB-supported": only if a retrieved DB excerpt explicitly supports the paper/tool/workflow claim.
   - "General practical recommendation": useful standard workflow step, but not directly confirmed in the retrieved DB excerpt.
   - Never claim a specific paper used a tool unless the retrieved DB excerpt says or strongly supports it.

7. End with "실제로 시작한다면" and recommend the simplest paper-consistent workflow first.

Return the answer in the user's language.
  `.trim();
}

  if (outputStyle === "METHOD_EXTRACTION") {
    return `
${common}

AUTOMATIC STYLE: PAPER-GROUNDED PRACTICAL METHOD EXTRACTION

The user is not asking for trends.
The user wants practical analysis methods, packages, software, tools, models, algorithms, workflows, or pipelines that are actually usable for research.

Core rule:
Do not answer as literature trends.
Do not recommend papers as reading material unless the user explicitly asks for papers to read.
Extract methods/packages/tools from the retrieved Paper_Talk DB context and convert them into a practical analysis guide.

Preferred answer structure:
1. Start with a direct sentence in the user's language: "이 질문은 트렌드보다 실제 분석에 쓸 수 있는 method/package 관점으로 보는 게 맞습니다."
2. Provide a compact table grouped by analysis task:
   - 분석 목적
   - package / method / tool
   - 논문에서 쓰인 맥락 or DB-supported evidence
   - 어떤 데이터에 적합한지
   - 지금 바로 쓴다면 추천도
3. Group by practical analysis task, for example:
   - preprocessing / QC
   - clustering / annotation
   - scRNA-seq + scATAC-seq integration
   - spatial domain / niche detection
   - cell-cell interaction
   - trajectory / RNA velocity
   - multi-omics integration
   - deep learning / foundation model
   - visualization / validation
4. If the retrieved DB context explicitly mentions a package or method, mark it as DB-supported.
5. If a useful method is general knowledge but not explicit in the retrieved DB context, label it clearly as "general practical recommendation, not directly confirmed in retrieved DB excerpt."
6. You may show retrieved paper titles because the user asked what papers used.
7. Never invent package names, paper titles, datasets, sample sizes, or implementation details.
8. End with a short "실제로 시작한다면" recommendation: 3-5 packages/methods to try first.
9. For scRNA-seq + scATAC-seq or multiome analysis, do not omit standard practical tools such as LIGER/iNMF, Seurat/Signac WNN, ArchR, GLUE, MultiVI/scvi-tools, SnapATAC2, Harmony, MOFA+, and SCENIC/SCENIC+ when relevant; label each as DB-supported only if retrieved excerpts explicitly support it.

Return the answer in the user's language.
    `.trim();
  }

  if (outputStyle === "LITERATURE_REVIEW") {
    return `
${common}

AUTOMATIC STYLE: USER-FRIENDLY TREND-BASED LITERATURE SYNTHESIS

The user is asking for papers, recent trends, hot topics, representative studies, what to read, or literature context.
Do not answer as a mechanical paper-by-paper summary.
Do not force a "Recommended Paper / How to Read / Next Research Idea" card format unless the user explicitly asks for recommendations.
Help the user understand the field first, then weave retrieved papers into that story.

Preferred flow:
1. Start with a short orientation in the user's language explaining the main scientific pattern.
2. Group retrieved papers by trend/theme only when grouping helps.
3. For each trend, explain why it matters biologically and mention the most relevant retrieved DB title naturally inside the prose.
4. Add next-step research implications only after the biological explanation, not as a repetitive label.
5. End with a short summary paragraph in the user's language.

Formatting rules:
- Do not use paper labels such as 논문 A/B/C or Paper A/B/C.
- Do not start with only a raw list of papers.
- Do not write long isolated paper summaries unless the user explicitly asks for a summary.
- Actual retrieved DB paper titles may appear naturally inside the explanation.
- If retrieved papers are weakly matched, say that gently and recommend better search terms.
    `.trim();
  }

  if (outputStyle === "RESEARCH_INSIGHT" || outputStyle === "RESEARCH_SYNTHESIS") {
    return `
${common}

AUTOMATIC STYLE: USER-FRIENDLY RESEARCH IDEA MENTORING

The user is asking what research can be done, future directions, project ideas, hypotheses, or promising directions.
Do not simply list generic categories. Build a readable research plan.

Preferred flow:
1. Start with the core intuition: what makes this topic promising?
2. Then suggest 3-5 concrete project directions.
3. For each direction, explain in a friendly way:
   - the biological question,
   - what data would be useful,
   - what model or analysis could be used,
   - what result would be interesting,
   - why it could be publishable or useful.
4. End with a practical recommendation: which project is easiest to start and which is most novel.

Avoid generic answers such as:
- disease research,
- cell-cell interaction analysis,
- data integration,
- technical development.

For spatial biology / cancer genomics, naturally prioritize when relevant:
- spatial foundation models,
- histology to spatial transcriptomics translation,
- multimodal spatial AI,
- tumor ecosystem modeling,
- spatial multiomics,
- cell-cell interaction GNN,
- drug response prediction,
- tumor evolution modeling,
- 3D spatial atlas or digital twin modeling.

Do not show paper titles, 논문 A/B/C labels, DOI, PMID, or source tracing unless the user explicitly asks for sources or papers.
    `.trim();
  }

  if (outputStyle === "VALIDATION_PLAN") {
    return `${common}\n\nAUTOMATIC STYLE: USER-FRIENDLY VALIDATION PLAN\nExplain the key claim first, then organize validation into computational validation, experimental validation, controls, expected results, and caveats. Keep it practical and easy to follow.`;
  }

  if (outputStyle === "COMPARISON") {
    return `${common}\n\nAUTOMATIC STYLE: USER-FRIENDLY COMPARISON\nStart with the biggest difference in plain language, then compare by clear axes. Use a compact table only if it truly improves clarity.`;
  }

  return common;
}

function formatAnswerForReadability(answer, outputStyle = "STANDARD") {
  let text = String(answer || "").trim();
  if (!text) return text;

  text = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sectionStyles = new Set([
    "RESEARCH_INSIGHT",
    "RESEARCH_SYNTHESIS",
    "PIPELINE_WORKFLOW",
    "VALIDATION_PLAN",
    "CONCEPT_EXPLANATION",
    "COMPARISON",
    "METHOD_EXPLANATION",
    "METHOD_EXTRACTION"
  ]);

  if (sectionStyles.has(outputStyle)) {
    text = text
      .replace(/(?:^|\n)\s*1\.\s*/g, "\n\n### 1. ")
      .replace(/(?:^|\n)\s*2\.\s*/g, "\n\n### 2. ")
      .replace(/(?:^|\n)\s*3\.\s*/g, "\n\n### 3. ")
      .replace(/(?:^|\n)\s*4\.\s*/g, "\n\n### 4. ")
      .replace(/(?:^|\n)\s*5\.\s*/g, "\n\n### 5. ")
      .replace(/첫째[,，]?\s*/g, "\n\n### 1. ")
      .replace(/둘째[,，]?\s*/g, "\n\n### 2. ")
      .replace(/셋째[,，]?\s*/g, "\n\n### 3. ")
      .replace(/넷째[,，]?\s*/g, "\n\n### 4. ")
      .replace(/다섯째[,，]?\s*/g, "\n\n### 5. ");
  }

  text = text
    .replace(/\n{0,2}(#{2,3}\s+[^\n]+)\n{0,2}/g, "\n\n$1\n\n")
    .replace(/\s*(정리하면[,，]?)/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function buildStrictInternalEvidenceInstruction({ outputStyle, hasContext }) {
  const sourceRequested = ["SOURCE_TRACE", "LITERATURE_REVIEW", "METHOD_EXTRACTION", "PIPELINE_WORKFLOW"].includes(outputStyle);

  if (sourceRequested) {
    return `
SOURCE DISCLOSURE MODE

The user explicitly asked for papers, literature, references, sources, or paper-grounded methods.
You may show only retrieved Paper_Talk DB titles and source metadata.
For literature recommendation questions, organize titles under trend/theme sections rather than paper labels.
For METHOD_EXTRACTION, organize by package/tool/method and analysis purpose, not by trend.
For PIPELINE_WORKFLOW, first identify keyword-matched papers from the retrieved context, extract workflow patterns from those papers, then synthesize the analysis steps from raw data to interpretation. Do not give a generic workflow before paper-grounded patterns. If no keyword-matched workflow paper evidence is retrieved, say so explicitly before any general fallback.
For spatial workflow questions, use spatial papers as the grounding context. For single-cell/multiome workflow questions, use single-cell/multiome papers as the grounding context.
Never invent papers, packages, datasets, methods, or implementation details outside the retrieved DB context. If a workflow step is a general recommendation rather than DB-supported, label it clearly.
    `.trim();
  }

  return `
CRITICAL INTERNAL EVIDENCE RULE

Retrieved Paper_Talk DB papers are INTERNAL EVIDENCE ONLY.

For normal answers, NEVER expose:
- paper titles
- paper labels such as 논문 A, 논문 B, Paper A, Paper B
- author names
- journal names
- DOI, PMID, URL
- source lists
- parenthetical paper citations such as "(논문 A: ...)" or "(Paper B: ...)"
- phrases like "이 논문에서는", "논문 C에 따르면", "The paper shows"
- long pasted title chains from retrieved context

Also avoid saying "논문", "paper", "source", "reference", "근거 논문" in the answer unless the user explicitly asks for sources.

Use retrieved papers only to infer:
- common biological themes
- research gaps
- promising directions
- validation ideas
- limitations

The user should see the synthesized research insight, not the retrieval evidence.
If the user later asks "어떤 논문 기반이야?", the Worker will show stored sources separately.
  `.trim();
}


function buildLiteratureRecommendationAnswerFromContext({ context, userMessage }) {
  const items = selectTopSupportingPapersForAnswer(context, 10, "LITERATURE_REVIEW");
  const language = detectUserLanguage(userMessage);
  const isKo = language === "Korean";

  if (!items.length) {
    return isKo
      ? "현재 Paper_Talk DB에서 이 주제와 직접 매칭되는 논문을 찾지 못했습니다. 검색어를 조금 더 구체화하거나 DB에 해당 논문을 추가한 뒤 다시 시도해 주세요."
      : "I could not find papers in the current Paper_Talk DB that directly match this topic. Try a narrower keyword or add relevant papers to the DB and search again.";
  }

  const topic = String(userMessage || "")
    .replace(/추천해\s*주세요|추천해주세요|관련|최신|최근|트렌디한|논문|paper|papers/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const heading = isKo
    ? (topic
      ? `현재 Paper_Talk DB에서 ${topic} 주제는 몇 가지 흐름으로 나누어 읽으면 좋습니다.`
      : "현재 Paper_Talk DB에서 이 주제는 몇 가지 흐름으로 나누어 읽으면 좋습니다.")
    : (topic
      ? `In the current Paper_Talk DB, ${topic} is best read through a few major trends.`
      : "In the current Paper_Talk DB, this topic is best read through a few major trends.");

  const labels = isKo
    ? {
        why: "왜 중요한가",
        papers: "추천 논문",
        read: "어떻게 읽으면 좋은가",
        next: "다음 연구 아이디어",
        summary: "정리하면,",
        summaryText: "이 주제는 방법론, 조직 구조 해석, 세포 상태 모델링, translational biomarker 발굴 쪽으로 나누어 읽으면 흐름을 잡기 좋습니다."
      }
    : {
        why: "Why this trend matters",
        papers: "Recommended papers",
        read: "How to read this",
        next: "Next research ideas",
        summary: "In short,",
        summaryText: "This topic is easiest to understand by separating it into methods, tissue-architecture interpretation, cell-state modeling, and translational biomarker discovery."
      };

  const groups = [];
  const used = new Set();

  function addGroup(name, predicate) {
    const selected = items.filter(item => {
      const hay = `${item.title || ""} ${item.content || ""} ${item.matched_chunk || ""}`.toLowerCase();
      return !used.has(item.title) && predicate(hay);
    }).slice(0, 4);

    if (selected.length) {
      selected.forEach(item => used.add(item.title));
      groups.push({ name, items: selected });
    }
  }

  addGroup("Spatial representation learning", hay => /graph|representation|embedding|contrastive|morpholog|image|histolog|deep|learning|neural|공간|표현/.test(hay));
  addGroup("Spatial architecture and tissue organization", hay => /architecture|organization|atlas|3d|tissue|microenvironment|niche|cell type|세포|조직|미세환경/.test(hay));
  addGroup("Spatial trajectory and cell-state modeling", hay => /trajectory|transition|state|fate|velocity|differentiation|pseudotime|운명|상태/.test(hay));
  addGroup("Clinical or translational spatial analysis", hay => /clinical|patient|therapy|response|biomarker|prognosis|cancer|tumou?r|치료|바이오마커|암/.test(hay));

  const remaining = items.filter(item => !used.has(item.title)).slice(0, 5);
  if (remaining.length) groups.push({ name: isKo ? "추가로 읽어볼 흐름" : "Additional useful direction", items: remaining });

  const body = groups.map((group, groupIndex) => {
    const paperLines = group.items.map(item => {
      const title = cleanBibtexText(item.title || "Untitled paper");
      const excerpt = cleanBibtexText(item.matched_chunk || makeBestEvidenceExcerpt(item.content || "")).slice(0, 220);
      const why = excerpt
        ? excerpt.replace(/\s+/g, " ").replace(/^(title|abstract)\s*[:：]\s*/i, "")
        : (isKo ? "이 주제와 직접적으로 연결되는 Paper_Talk DB 논문입니다." : "This is a relevant Paper_Talk DB paper for this topic.");
      return `- ${title}\n  - ${why}`;
    }).join("\n");

    return [
      `${groupIndex + 1}. ${group.name}`,
      "",
      labels.why,
      isKo ? "이 흐름은 현재 질문을 더 구체적인 연구 문제로 바꾸는 데 도움이 됩니다." : "This trend helps turn the broad question into a more concrete research problem.",
      "",
      labels.papers,
      paperLines,
      "",
      labels.read,
      isKo ? "먼저 biological question과 데이터 타입을 확인한 뒤, 방법론이 어떤 한계를 해결하는지 보시면 좋습니다." : "Read it by first identifying the biological question and data type, then asking what limitation the method or result addresses.",
      "",
      labels.next,
      isKo ? "이 흐름을 바탕으로 validation, multimodal integration, 또는 환자 cohort 적용 가능성을 생각해볼 수 있습니다." : "From this trend, consider validation, multimodal integration, or application to patient cohorts."
    ].join("\n");
  }).join("\n\n");

  return [
    heading,
    "",
    body,
    "",
    labels.summary,
    "",
    labels.summaryText
  ].join("\n");
}

async function normalizeFinalAnswerToUserIntentStyle({ answer, userMessage, outputStyle, env }) {
  const original = String(answer || "").trim();
  if (!original) return original;

  // v73:
  // Only explicit paper/literature/source modes may expose paper titles or paper labels.
  // Research idea / research insight answers should use DB evidence internally and show
  // project-level synthesis only. If the user later asks for sources, SOURCE_TRACE will show them.
  if (["SOURCE_TRACE", "LITERATURE_REVIEW", "METHOD_EXTRACTION", "PIPELINE_WORKFLOW"].includes(outputStyle)) {
    return formatAnswerForReadability(original, outputStyle);
  }

  const cleaned = hideInternalEvidenceLeaksFromNormalAnswer(original);
  return formatAnswerForReadability(cleaned, outputStyle);
}

function forceLocalResearchInsightLayout(answer) {
  let text = String(answer || "").trim();
  if (!text) return text;

  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*[-*]\s*/gm, "- ")
    .trim();

  if (!/Project|프로젝트|Input|입력|Model|모델|Research Question|연구 질문/i.test(text)) {
    text = [
      "이 질문은 단순한 분야 요약보다 실제 프로젝트 형태로 정리하는 편이 좋습니다.",
      "아래 내용은 Paper_Talk DB 근거와 질문 의도를 바탕으로 정리한 연구 아이디어입니다.",
      "",
      text
    ].join("\n");
  }

  return text;
}

function buildPracticalMethodCatalogForPrompt({ userMessage, intent, outputStyle }) {
  if (!["METHOD_EXTRACTION", "PIPELINE_WORKFLOW"].includes(outputStyle)) return "";

  const text = [
    userMessage || "",
    intent?.interpreted_intent || "",
    intent?.primary_domain || "",
    Array.isArray(intent?.key_entities) ? intent.key_entities.join(" ") : ""
  ].join(" ").toLowerCase();

  const domain = String(intent?.primary_domain || "").toUpperCase();
  const isSingleCellOrMultiome =
    domain === "SINGLE_CELL" ||
    domain === "MULTIOMICS" ||
    /(scrna|sc\s*rna|single[-\s]?cell|싱글셀|단일세포|scatac|sc\s*atac|atac[-\s]?seq|chromatin|크로마틴|multi[-\s]?omics|멀티오믹스)/i.test(text);

  if (!isSingleCellOrMultiome) return "";

  return `
PRACTICAL METHOD CATALOG FOR METHOD_EXTRACTION / PIPELINE_WORKFLOW

Use this as a practical method prior, not as paper evidence.
This catalog exists so broad tool questions do not get answered with random retrieved paper metadata.

Critical rule:
- Always separate DB-supported methods from general practical recommendations.
- If a method below is not explicitly present in the retrieved DB excerpt, label it as "general practical recommendation / retrieved DB excerpt에서 직접 확인되지는 않음".
- Do not claim a specific paper used a method unless the retrieved DB excerpt explicitly supports it.
- For scRNA-seq + scATAC-seq or multiome questions, the answer should include the standard practical tools below when relevant.

scRNA-seq core analysis:
- Seurat: QC, normalization, clustering, annotation, integration, visualization.
- Scanpy: Python-based QC, preprocessing, clustering, annotation, visualization.
- Cell Ranger / STARsolo / alevin-fry: read processing and count matrix generation.

scATAC-seq core analysis:
- ArchR: scATAC QC, peak calling, LSI, clustering, gene activity, trajectory, multiome integration.
- Signac: Seurat-compatible scATAC analysis, peak/gene activity, motif/accessibility analysis.
- SnapATAC2: scalable scATAC analysis and atlas-scale workflows.
- chromVAR: motif deviation / TF activity from chromatin accessibility.
- Cicero: co-accessibility and cis-regulatory interaction inference.
- cisTopic / pycisTopic: topic modeling for chromatin accessibility.

scRNA-seq + scATAC-seq integration / multiome:
- Seurat + Signac WNN: weighted-nearest-neighbor multiome integration.
- ArchR integration: links scATAC with scRNA references and gene activity.
- LIGER / iNMF: integrative non-negative matrix factorization for cross-modality or cross-dataset integration.
- GLUE: graph-linked unified embedding for single-cell multi-omics integration.
- MultiVI / scvi-tools: probabilistic deep generative model for paired/unpaired scRNA + scATAC integration.
- Harmony: batch correction/integration, often used around embeddings rather than full regulatory modeling.
- MOFA+: factor analysis for multi-omics latent factors.

Regulatory network / TF activity:
- SCENIC / pySCENIC: gene regulatory network and regulon activity from scRNA-seq.
- SCENIC+: joint gene regulatory inference using expression plus chromatin accessibility, useful for scRNA + scATAC/multiome.
- Note spelling: if the user or DB says SENIC, treat it as likely SCENIC unless context clearly means another tool.

Spatial transcriptomics / spatial omics workflow tools:
- Seurat spatial / Scanpy / Squidpy / Giotto: spatial object handling, QC, normalization, spatial neighbors, visualization.
- BayesSpace / SpaGCN / STAGATE: spatial domain or tissue niche detection.
- cell2location / Tangram / RCTD / stereoscope / SPOTlight: cell type deconvolution or mapping from scRNA references to spatial data.
- CellChat / NicheNet / LIANA / Squidpy ligand-receptor analysis / MISTy: spatial cell-cell communication, ligand-receptor, and microenvironment modeling.
- Xenium / CosMx / MERFISH-specific workflows may require cell segmentation, transcript assignment, panel QC, and morphology-aware interpretation.
- Visium workflows often require spot-level QC, histology image alignment, deconvolution, spatial domain detection, and downstream ligand-receptor/niche analysis.

Paper-grounded workflow rule:
- For workflow/pipeline questions, do not start from this catalog alone.
- First inspect the retrieved Paper_Talk DB context and summarize workflows used by relevant papers in the requested domain.
- Then use this catalog only to fill missing practical steps, clearly labeled as general practical recommendations.

Expected answer behavior for this user request:
- Start by saying that LIGER and SCENIC/SCENIC+ are indeed relevant, but their DB-supported status depends on whether retrieved excerpts explicitly contain them.
- For broad "what tools are there" questions, give the practical tool list first, then DB evidence if available.
- For workflow/pipeline questions, first extract workflow patterns from the retrieved papers in the requested domain, then give the synthesized step-by-step workflow with method choices within each step.
- Do not let unrelated retrieved items such as generic reference mapping or map-building phrases replace the standard method list or workflow.
`.trim();
}

async function callOpenAIForPaperTalk({ userMessage, context, thinkingLogicFrameworks = [], pastFrameworks = [], generatedFramework, recentMessages, autoIntent = null, strictActivePaperLocked = false }, env, cancelRuntime = null) {
  context = trimContextForChat(context);
  const hasContext = context.length > 0;

  const intent = autoIntent || makeFallbackResearchIntent(userMessage);
  const outputStyle = determinePaperTalkOutputStyle({ userMessage, intent, hasContext });
  const adaptiveStyleInstruction = buildAdaptiveStyleInstruction({ outputStyle, hasContext, userMessage });
  const multilingualInstruction = buildMultilingualAnswerInstruction(userMessage);
  const strictInternalEvidenceInstruction = buildStrictInternalEvidenceInstruction({ outputStyle, hasContext });
  const practicalMethodCatalog = buildPracticalMethodCatalogForPrompt({ userMessage, intent, outputStyle });
  const questionType = normalizeQuestionType(intent.question_type || "GENERAL");
  const answerStyle = normalizeAnswerStyle(intent.answer_style || "concise_answer");
  const shouldGenerateHypotheses = Boolean(intent.should_generate_hypotheses);
  const shouldUseDbEvidence =
    Boolean(intent.should_use_db_evidence) ||
    ["RESEARCH", "METHOD", "PIPELINE", "VALIDATION", "LITERATURE"].includes(questionType);

  const isResearchRelated =
    shouldUseDbEvidence ||
    ["RESEARCH", "METHOD", "PIPELINE", "VALIDATION", "LITERATURE"].includes(questionType) ||
    /paper_talk|db|논문|연구|literature|paper|papers|rna velocity|spatial|single-cell|single cell|genomics|cancer/i.test(String(userMessage || ""));

  const dbTitles = hasContext
    ? [...new Set(context.map(item => cleanBibtexText(item.title || "").trim()).filter(Boolean))]
    : [];

  const thinkingLogicContext = buildThinkingLogicContext(thinkingLogicFrameworks);
  const requestedFormatInstruction = buildUserRequestedFormatInstruction(userMessage);

  const contextText = hasContext
    ? context.slice(0, PAPER_TALK_MAX_CHAT_CONTEXT_ITEMS).map((item, index) => {
        const paperLabel = String.fromCharCode(65 + index);
        const title = cleanBibtexText(item.title || "");
        const excerpt = cleanBibtexText(item.matched_chunk || makeBestEvidenceExcerpt(item.content || "")).slice(0, PAPER_TALK_MAX_FULLTEXT_EXCERPT_PER_ITEM);

        return [
          `DB_SOURCE_${index + 1}`,
          `INTERNAL_SOURCE_LABEL_DO_NOT_OUTPUT: ${paperLabel}`,
          `DB_EXCERPT_FOR_SYNTHESIS_ONLY: ${excerpt}`,
          `EXACT_DB_TITLE: ${title}`,
          item.source_url ? `DB_ARTICLE_URL: ${item.source_url}` : "",
          item.pdf_link ? `DB_PDF_URL: ${item.pdf_link}` : ""
        ].filter(Boolean).join("\n");
      }).join("\n\n---\n\n")
    : "NO_MATCHING_PAPER_TALK_DB_CONTEXT";

  const intentText = [
    `Question type: ${questionType}`,
    `Answer style: ${answerStyle}`,
    `Chosen output style: ${outputStyle}`,
    `Should generate hypotheses: ${shouldGenerateHypotheses ? "yes" : "no"}`,
    `Should use DB evidence: ${shouldUseDbEvidence ? "yes" : "no"}`,
    `Research-related mode: ${isResearchRelated ? "yes" : "no"}`,
    `Interpreted intent: ${intent.interpreted_intent || ""}`,
    `Primary domain: ${intent.primary_domain || ""}`,
    `Key entities: ${Array.isArray(intent.key_entities) ? intent.key_entities.join(", ") : ""}`,
    `Retrieval query: ${intent.retrieval_query || ""}`,
    `Gap axes to inspect: ${Array.isArray(intent.gap_axes) ? intent.gap_axes.join(", ") : ""}`,
    `Hypothesis angle: ${intent.hypothesis_angle || ""}`,
    `Validation angle: ${intent.validation_angle || ""}`
  ].filter(Boolean).join("\n");

  const modeInstruction = buildModeInstruction({
    questionType,
    answerStyle,
    shouldGenerateHypotheses,
    hasContext,
    shouldUseDbEvidence,
    isResearchRelated
  });

  const insightFirstInstruction = `
READABLE INSIGHT-FIRST SYNTHESIS RULE

For normal research answers:
- Do not explain one paper at a time.
- Do not use paper labels.
- Do not say "논문 A/B/C" or "Paper A/B/C".
- Do not include paper titles in parentheses.
- Do not include citations or references unless the user asks for sources.
- Extract common biological themes from all retrieved DB excerpts.
- Then write a clean synthesis that is easy to read:
  short paragraphs, clear transitions, and 3 to 5 research directions at most.
- Avoid dense literature-review wording.
- The answer should feel like a senior cancer genomics mentor explaining what direction is promising, not a paper retrieval report.
  `.trim();

  const strictDbRule = hasContext
    ? `
STRICT PAPER_TALK DB-ONLY RULES FOR RESEARCH ANSWERS

The user has retrieved Paper_Talk DB context.

For research-related answers:
1. Use ONLY the retrieved Paper_Talk DB sources below as evidence.
2. Do NOT add outside papers from your general knowledge.
3. Do NOT mention a paper title in normal answers. Titles are internal evidence only unless the user explicitly asks for sources.
4. Do NOT cite La Manno, Nature papers, famous landmark papers, PubMed papers, or any external publication unless that exact title is present in the retrieved DB context.
5. Do NOT invent authors, years, journals, sample sizes, datasets, biomarkers, mechanisms, or conclusions.
6. If a detail is not in the DB excerpt, say "이 정보는 현재 검색된 Paper_Talk DB excerpt에는 명확하지 않습니다."
7. If the retrieved DB context contains at least one relevant source, never say "관련 논문이 검색되지 않았습니다."
8. When comparing papers, compare only the retrieved DB titles and excerpts, but do not expose paper labels/titles in the normal answer unless the user asks for sources.
9. You may make a cautious research interpretation, but it must be explicitly based on the DB excerpts.
10. If the DB excerpts are too thin for a strong claim, say the evidence is limited.

Internal Paper_Talk DB titles for storage/source-follow-up only. Do not output these titles in normal answers:
${dbTitles.map((title, index) => `${index + 1}. ${title}`).join("\n")}

Important:
The retrieval layer already removed metadata-only rows such as author=, journal=, year=, doi=, url=.
Use the EXACT_DB_TITLE values above as the only paper names.

v63 readable hidden-source behavior:
- Internally use retrieved DB papers only as evidence.
- The user-facing answer must NOT show paper titles, paper labels, or parenthetical paper references.
- Never write these patterns in a normal answer:
  "(논문 A: ...)", "(논문 B: ...)", "(Paper A: ...)"
  "논문 A에서는", "논문 B는", "논문 C에 따르면"
  "예를 들어 ... (논문 ...)"
  "사용한 논문", "근거 논문", "참고 논문", "Relevant papers", "Sources"
- Do NOT organize by paper. Organize by synthesized insight.
- Write in the user's language with short paragraphs.
- For research-direction questions, use a clear insight style automatically:
  1) Start with one concise synthesis sentence.
  2) Use natural headings in the user's language.
  3) Explain 3 to 5 promising research directions with blank lines between sections.
  4) For each direction, explain why it matters biologically.
  5) End with a short 2-3 line summary in the user's language.
- Use natural transition phrases in the user's language instead of hard-coded Korean phrases.
- Do not reveal individual paper titles now. The Worker stores the sources separately for later follow-up.
    `.trim()
    : `
STRICT PAPER_TALK DB-ONLY RULES FOR RESEARCH ANSWERS

No Paper_Talk DB context was retrieved.

For research-related answers:
1. Do NOT use outside literature as if it came from Paper_Talk DB.
2. Do NOT invent related papers.
3. Do not start with a database-failure message unless the user explicitly asked for sources/evidence.
4. For ordinary concept, method, algorithm, or research-idea questions, answer the scientific question directly from general knowledge first.
5. If the user explicitly asked for sources/evidence, say in the user's language that no matching Paper_Talk DB source was retrieved and suggest narrower keywords or reindexing.
    `.trim();

  const activePaperLockInstruction = strictActivePaperLocked
    ? `
STRICT ACTIVE PAPER LOCK

The current conversation is locked to ONE explicit paper selected from the user's URL/title.
Use ONLY DB_SOURCE_1 as the paper context.
Do NOT retrieve, mention, infer from, or answer using any other paper.
If the user asks whether the full paper was read, answer honestly:
- You are using the Paper_Talk DB stored excerpt/content and any readable metadata fetched from the stored URL.
- Do not claim full publisher full text was read unless the retrieved context explicitly contains full text.
Important technical truth: the Worker fetches publisher URLs from Cloudflare server-side, not from the user browser, user cookies, institutional VPN, or the user IP address. Therefore the user's personal/institutional access to Cell/Nature/Science cannot be used by the Worker. If the full text is not stored in Paper_Talk DB and is not openly fetchable, say so clearly.
If the user asks where a statement came from and the statement is not supported by DB_SOURCE_1, say it was not supported by the active paper context and correct it using DB_SOURCE_1.
For follow-up requests such as key takeaway, 1 line, 3 lines, why important, or clinical meaning, answer from DB_SOURCE_1 only.
    `.trim()
    : "";

  const messages = [
    {
      role: "system",
      content: `
You are Paper_Talk Vision GPT.

Your role:
You are a calm senior cancer genomics and bioinformatics research mentor. Your answer should feel like a clear research explanation from an experienced colleague: not a rigid report, and not casual small talk.

Core behavior:
- First understand the user's intent using the admin-uploaded scientific thinking logic and the automatic intent parser, then choose the answer flow automatically.
- For ordinary research idea / research direction answers, use retrieved Paper_Talk DB papers only as hidden internal evidence.
- Do not show paper labels such as 논문 A/B/C or paper titles unless the user explicitly asks for paper recommendations, literature, sources, references, or evidence.
- If the user asks for paper recommendations or sources, then show only retrieved Paper_Talk DB titles and explain why they matter.
- Do not force old report headings such as "Direct answer / Relevant papers / Findings / Gaps".
- Do not dump retrieved papers as a raw list unless the user specifically asks for papers.
- Explain the idea first, then use Paper_Talk DB papers silently as supporting evidence inside the reasoning.
- Use natural paragraphs with a smooth logical flow.
- Be detailed enough to help the user think about research design, but do not over-format.

Target answer style:
- Be noticeably more detailed and kinder than a short Q&A answer.
- When the user asks to summarize or read a paper, do not stop at a one-paragraph summary. Usually explain:
  1. what problem the paper is trying to solve,
  2. what biological system, data, or method it uses,
  3. what the central finding means,
  4. why it matters for cancer genomics, immunology, single-cell, spatial, or biomedical research,
  5. what the limitations or next validation questions are.
- Unless the user asks for "3 lines", "briefly", "short", or "bullet only", write 4 to 8 readable paragraphs for paper interpretation.
- The preferred style is calm explanatory prose: professional, soft, explanatory, and readable.
- Do not copy a fixed example style in one language. Adapt the style to the user's language.
- Avoid overly casual filler phrases unless the user explicitly wants casual chat.
- Avoid report-like section labels.

Forbidden section labels unless the user explicitly asks for them:
- Direct answer
- Relevant papers
- Retrieved papers
- Paper-by-paper findings
- Agreements
- Contradictions
- Knowledge gaps
- Paper_Talk research interpretation
- Suggested next study or validation

Paper/source visibility rule:
- In LITERATURE_REVIEW, SOURCE_TRACE, METHOD_EXTRACTION, and PIPELINE_WORKFLOW modes, you may show retrieved DB paper titles.
- In METHOD_EXTRACTION mode, show paper titles only to support a listed package/tool/method and organize by analysis purpose, not by trend.
- In PIPELINE_WORKFLOW mode, show paper titles only to support a workflow step or tool choice and organize by analysis order, not by trend.
- In normal RESEARCH_INSIGHT, RESEARCH_SYNTHESIS, VALIDATION, CONCEPT, COMPARISON, or GENERAL answers, do NOT show 논문 A/B/C labels, paper titles, URLs, journals, authors, DOI/PMID, or source lists.
- For broad research-direction questions, synthesize across retrieved DB papers silently and give project-level research ideas.
- If the user later asks for sources/evidence/references in any language, SOURCE_TRACE will show the stored sources separately.

Adaptive format rules:
- If the user asks for research ideas, explain why a direction is promising, what the DB suggests, what research questions follow, and what validation would be useful.
- For research idea / direction answers, generate project-level suggestions rather than paper-level summaries.
- Each strong project idea should include, when useful: Project, Input, Model/Method, Research Question, Expected Output, Novelty, and Validation/Publication Potential.
- Do not create paper labels for normal research idea answers.
- If the user asks for paper comparison, paper recommendation, or paper-grounded method/package extraction, compare/show retrieved DB titles clearly. A compact table is allowed when it improves clarity.
- If the user asks for a concept, explain simply first, then connect it to cancer genomics, single-cell, spatial, or bioinformatics.
- If the user asks for validation, give a practical plan, but keep the tone explanatory rather than checklist-like.
- If the user asks a broad question, answer with a natural explanation rather than a database report.

Paper_Talk DB rules:
- Publisher URL reading is server-side from the Cloudflare Worker, not through the user's browser/IP/cookies. Do not imply that the user's institutional access lets the Worker read paywalled full text. For full-text-level answers, the full text must be stored in Paper_Talk DB, uploaded as PDF/TXT, or openly accessible to the Worker.
- For research-related questions, method/package extraction questions, literature questions, validation questions, paper comparison questions, and any question mentioning Paper_Talk DB, DB, 논문, or 연구, use the retrieved Paper_Talk DB context as the evidence source.
- Do not mix outside papers into the evidence.
- Do not invent paper titles, authors, years, journals, sample sizes, datasets, mechanisms, biomarkers, or conclusions.
- If DB evidence is thin, still answer the user's scientific question first in a helpful way.
- If DB context exists, never say "관련 논문이 없습니다". Use the retrieved DB excerpts quietly unless the user explicitly asks for sources.
- If no DB context was retrieved, do NOT start with a database-failure sentence. For ordinary concept/method/research-idea questions, answer from general scientific knowledge first. Mention DB retrieval failure only when the user explicitly asks for sources, references, Paper_Talk DB evidence, or which papers were used.

Language:
Answer entirely in the user's language. Do not mix languages in section titles or transitions.

Formatting:
Return plain text only.
Do not use markdown symbols such as #, *, or **.
Use readable paragraphs. Do not be too brief unless the user explicitly asks for one-line or short answer.
For paper summaries, be generous and educational: explain the paper's motivation, biological question, dataset/method if visible in the excerpt, key result, interpretation, why it matters, and what follow-up validation would be useful.
If the excerpt is thin, say that gently, but still explain what can be safely inferred from the retrieved text.
Use bullets only for concrete research questions, candidate project ideas, or validation steps. A compact selected-paper mapping is allowed for DB grounding, but each label must include the exact title. After that, avoid dumping paper-by-paper summaries; synthesize the papers around the question.
Headings are optional. If used, make them natural headings in the same language as the user, not report labels.

${requestedFormatInstruction || ""}
      `.trim()
    },
    {
      role: "system",
      content: multilingualInstruction
    },
    {
      role: "system",
      content: getPaperTalkScientificThinkingLogic()
    },
    {
      role: "system",
      content: `
ADMIN-UPLOADED DISTILLED THINKING LOGIC

Use this silently as an internal reasoning checklist only.
Do not summarize it.
Do not answer about the framework itself.
Do not change the final answer into a textbook-style explanation.
The final answer must keep the existing Paper_Talk style: warm multilingual research mentor, natural paragraphs, practical research suggestions, and concrete examples in the user's language.

${thinkingLogicContext.slice(0, PAPER_TALK_MAX_THINKING_LOGIC_CHAT_CHARS)}
      `.trim()
    },
    {
      role: "system",
      content: `Automatic question interpretation:\n\n${intentText}`
    },
    {
      role: "system",
      content: strictDbRule
    },
    ...(practicalMethodCatalog ? [{
      role: "system",
      content: practicalMethodCatalog
    }] : []),
    {
      role: "system",
      content: `
PAPER_TALK V72 OUTPUT OVERRIDE

Detected output style: ${outputStyle}
Detected semantic intent: ${intent.paper_talk_intent || ""}
Detected domain: ${intent.primary_domain || ""}

If outputStyle is PIPELINE_WORKFLOW:
- The user wants a paper-grounded analysis pipeline/workflow, not just a generic tool list.
- Do NOT answer with trends or paper recommendations.
- First infer the user's keyword/entities and domain from the question.
- First use retrieved Paper_Talk DB papers that match that keyword/domain as the workflow basis.
- For single-cell/scRNA/scATAC/multiome workflow questions, extract workflow patterns from keyword-matched single-cell or multiome papers.
- For spatial/spatial transcriptomics workflow questions, extract workflow patterns from keyword-matched spatial papers.
- Do not start with "먼저 찾은 관련 pipeline 논문" unless the user explicitly asks for related papers.
- Then include a section that summarizes workflow patterns visible in the retrieved Paper_Talk DB papers.
- Then synthesize a step-by-step workflow from raw data to biological interpretation.
- For each step include: purpose, input, DB-supported tools/methods, general recommendations for missing steps, output, and QC/checkpoint.
- For scRNA-seq + scATAC-seq/multiome, include same-cell multiome and separate scRNA+scATAC alternatives when useful.
- For spatial transcriptomics, include platform-aware preprocessing, QC, normalization, deconvolution/mapping, spatial domain/niche analysis, cell-cell interaction, and image/histology integration when useful.
- Mark DB-supported tools only when retrieved DB excerpts explicitly support them; otherwise mark them as general practical recommendations.
- Never claim a specific paper used a tool/workflow unless the retrieved DB excerpt supports it.
- If retrieved context does not contain keyword-matched workflow papers, explicitly say the Paper_Talk DB evidence is insufficient, then provide a clearly labeled general fallback workflow.
- End with the simplest paper-consistent starting pipeline.

If outputStyle is METHOD_EXTRACTION:
- The user wants practical packages/methods/tools actually used in papers.
- Do NOT answer with trends.
- Extract method/package/tool names from retrieved DB excerpts.
- Use a compact table grouped by analysis task.
- Include exact retrieved DB paper titles only when they support a listed method.
- If a method/package is not explicitly present in DB context, mark it as general practical recommendation, not DB-supported.
- End with 3-5 practical methods/packages to try first.

If outputStyle is LITERATURE_REVIEW:
- Use a TREND-FIRST format, not a paper-by-paper summary.
- Start by saying that the topic can be read through 3-5 current trends.
- For each trend use this structure:
  ① Trend name
  왜 뜨는가?
  추천 논문
  이 논문을 어떻게 읽으면 좋은가?
  다음 연구 아이디어
- Show exact retrieved DB paper titles only under 추천 논문.
- Do not use paper labels such as 논문 A/B/C or Paper A/B/C.
- Do not write a long sequential summary of each paper.
- End with a short 정리하면 paragraph.

If outputStyle is RESEARCH_INSIGHT or RESEARCH_SYNTHESIS:
- Produce actionable project-level research ideas.
- Use Project / Input / Model / Research Question / Expected Output / Novelty / Validation or Publication Potential, translated naturally into the user's language.
- Avoid generic categories.
- Do NOT show retrieved paper titles, paper labels, or source lists.
- If mentioning Paper_Talk DB evidence, do so only in the user's language and only in a general way, without naming individual papers.
- For spatial/cancer/AI questions, prioritize spatial foundation models, histology-to-spatial translation, multimodal spatial AI, GNN, transformer, diffusion, tumor evolution, immune escape, and drug-response prediction.

Never answer a paper recommendation request with only a field summary.
      `.trim()
    },
    ...(activePaperLockInstruction ? [{
      role: "system",
      content: activePaperLockInstruction
    }] : []),
    {
      role: "system",
      content: modeInstruction
    },
    {
      role: "system",
      content: `Retrieved Paper_Talk DB sources:\n\n${contextText.slice(0, PAPER_TALK_MAX_CHAT_CONTEXT_TEXT)}`
    },
    {
      role: "system",
      content: hasContext
        ? (["LITERATURE_REVIEW", "SOURCE_TRACE", "METHOD_EXTRACTION", "PIPELINE_WORKFLOW"].includes(outputStyle)
          ? "A DB context is present. The user explicitly asked for papers/literature/sources, paper-grounded methods, or an analysis workflow. You may show retrieved EXACT_DB_TITLE values only when they support a method/workflow step. For LITERATURE_REVIEW, organize papers by trend/theme. For METHOD_EXTRACTION, organize by analysis purpose and package/tool/method. For PIPELINE_WORKFLOW, first list keyword-matched retrieved papers and summarize workflow patterns from those papers, then organize the synthesized workflow by analysis step from raw data to interpretation. Do not use paper labels. Do not use external papers as DB evidence. If keyword-matched workflow evidence is insufficient, say so clearly before any general fallback."
          : "A DB context is present. Use the retrieved DB excerpts as INTERNAL evidence only. Do not output EXACT_DB_TITLE values, paper labels, URLs, journals, authors, or source lists unless the user explicitly asks for sources. Answer the user's question first in a friendly explanatory way.")
        : "No DB context is present. Do not start with a Paper_Talk DB retrieval-failure sentence unless the user explicitly asked for sources/evidence. For ordinary concept, algorithm, method, or research-idea questions, answer the scientific question directly from general knowledge. Do not invent paper titles, authors, years, journals, sample sizes, or datasets."
    },
    ...recentMessages
      .filter(m => m.role !== "assistant")
      .slice(-2)
      .map(m => ({
        role: "user",
        content: String(m.content || "").slice(0, 800)
      })),
    {
      role: "user",
      content: String(userMessage || "").slice(0, 1200)
    }
  ];

  if (!env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is missing.";
  }

  await cancelRuntime?.throwIfCanceled?.();
  const abortable = createLinkedAbortController(cancelRuntime, 70000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: abortable.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        temperature: isResearchRelated ? 0 : 0.1,
        max_completion_tokens: hasContext ? 2600 : (questionType === "CONCEPT" && !shouldUseDbEvidence ? 1700 : 2100)
      })
    });

    const raw = await res.text();
    let data = {};

    try {
      data = JSON.parse(raw);
    } catch {
      return `OpenAI API returned non-JSON response:\n\n${raw.slice(0, 500)}`;
    }

    if (!res.ok) {
      return `OpenAI API error: ${data?.error?.message || `HTTP ${res.status}`}`;
    }

    return extractOpenAIText(data) || getOpenAIErrorMessage(data, "No answer was generated. Please try again with a shorter question.");
  } catch (error) {
    if (isUserCanceledError(error) || await isGptRuntimeCanceledNoThrow(cancelRuntime)) {
      return USER_CANCELED_MESSAGE;
    }
    if (error && error.name === "AbortError") {
      return "OpenAI API timeout after 70 seconds. Please try a narrower question or ask about fewer mechanisms at once.";
    }

    return `OpenAI API request failed: ${error?.message || "Unknown error"}`;
  } finally {
    abortable.cleanup();
  }
}


function buildModeInstruction({ questionType, answerStyle, shouldGenerateHypotheses, hasContext, shouldUseDbEvidence = false, isResearchRelated = false }) {
  if (questionType === "CONCEPT" && !shouldUseDbEvidence) {
    return `
Selected mode: CONCEPT EXPLANATION.
Explain clearly in the user's language, like a senior research mentor.
Use examples when useful.
Do not force paper lists or research gaps unless asked.
    `.trim();
  }

  if (questionType === "PIPELINE" || answerStyle === "end_to_end_workflow" || answerStyle === "pipeline_workflow" || answerStyle === "paper_grounded_workflow") {
    return `
Selected mode: PRACTICAL END-TO-END ANALYSIS WORKFLOW.

The user wants an actual analysis pipeline or workflow, not just a package list.
Do not answer as trend recommendation.
Do not recommend papers as reading material unless the user asks.
Use retrieved Paper_Talk DB evidence when it supports a workflow step, but clearly separate DB-supported tools from general practical recommendations.

Recommended structure:
- Direct answer in the user's language.
- Step-by-step workflow from raw data to biological interpretation.
- For each step: purpose, input, recommended packages/tools, output, and QC/checkpoint.
- For scRNA-seq + scATAC-seq or multiome, separate same-cell multiome from separate-dataset integration when useful.
- End with the simplest starting pipeline.
    `.trim();
  }

  if (questionType === "METHOD" || answerStyle === "practical_method_table" || answerStyle === "method_extraction") {
    return `
Selected mode: PAPER-GROUNDED METHOD / PACKAGE EXTRACTION.

The user wants practical analysis methods, software, packages, algorithms, workflows, or pipelines, especially what papers actually used.
Use retrieved Paper_Talk DB evidence to extract methods and packages.
Do not answer as trend recommendation.
Do not recommend papers as reading material unless the user asks.
Show exact DB paper titles only when they support a listed method/package.
If DB context is thin, clearly separate DB-supported methods from general practical recommendations.

Recommended structure:
- Direct answer in the user's language.
- Compact table grouped by analysis task.
- For each method/package: what it is used for, what data it fits, and whether the retrieved DB explicitly supports it.
- End with 3-5 practical methods/packages to try first.
    `.trim();
  }

  if (questionType === "LITERATURE") {
    return `
Selected mode: LITERATURE_REVIEW / USER-FRIENDLY TREND RECOMMENDATION.

The user wants papers, trends, hot topics, representative studies, or state-of-the-art direction.
Use only retrieved Paper_Talk DB sources for paper names and evidence.
Do not answer as a mechanical list of 논문 A, 논문 B, 논문 C.
Do not summarize each paper one by one as the main structure.

Answer goal:
Help the user quickly understand what is trending, why it matters, which retrieved paper is worth reading, and what research idea follows.

Recommended structure, but adapt naturally to the user's question:
- Short orientation: what are the major trends?
- Trend/theme section
- Why this trend is hot
- Recommended retrieved paper title
- How to read this paper
- Next research idea
- Short final reading priority

Do not use retrieval scores or anonymous paper labels.
Actual DB paper titles should appear only as recommended reading under each trend.
    `.trim();
  }

  if (questionType === "RESEARCH" || shouldGenerateHypotheses || isResearchRelated) {
    return `
Selected mode: USER-FRIENDLY RESEARCH IDEA MENTORING.

The user wants research directions, project ideas, hypotheses, or practical next studies.
Use retrieved Paper_Talk DB evidence silently as background when available, but do not expose paper titles or 논문 A/B/C labels unless the user explicitly asks for sources.
Do not mix outside papers as evidence.

Answer goal:
Make the user feel they received a clear, kind research consultation, not a database report.

Recommended flow, adapted naturally:
1. Begin with the core intuition in plain language.
2. Explain why the topic is biologically or computationally promising.
3. Suggest 3-5 concrete project directions.
4. For each project, explain input data, model/analysis, research question, expected output, novelty, and validation potential in readable prose.
5. End by recommending which idea is easiest to start and which one is most novel.

Avoid generic answers such as:
- disease research,
- cell-cell interaction analysis,
- data integration,
- technical development.

For spatial biology, cancer genomics, single-cell, or multiomics questions, naturally prioritize when relevant:
- spatial foundation models,
- histology to spatial transcriptomics translation,
- multimodal spatial AI,
- tumor ecosystem modeling,
- spatial multiomics,
- cell-cell interaction GNN,
- drug response prediction,
- tumor evolution modeling,
- 3D spatial atlas or digital twin modeling.

If Paper_Talk DB context is absent, say that no strong DB match was retrieved, then give only a clearly labeled general brainstorming answer.
    `.trim();
  }

  if (questionType === "VALIDATION") {
    return `
Selected mode: VALIDATION PLAN.
Explain what to test, computational validation, experimental validation, controls, expected results, and caveats.
Use only retrieved DB evidence for paper-based claims.
    `.trim();
  }

  return `
Selected mode: GENERAL.
Answer naturally and clearly.
If the question is research-related, stay DB-grounded and do not invent citations.
  `.trim();
}

async function adminListGptThreads(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const threads = await env.DB.prepare(`
    SELECT
      gpt_threads.id,
      gpt_threads.user_id,
      gpt_threads.title,
      gpt_threads.created_at,
      gpt_threads.updated_at,
      users.name AS user_name,
      users.email AS user_email
    FROM gpt_threads
    LEFT JOIN users ON users.id = gpt_threads.user_id
    ORDER BY datetime(gpt_threads.updated_at) DESC
  `).all();

  return json({
    ok: true,
    threads: threads.results || []
  });
}

async function adminListGptMessages(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");

  if (!threadId) {
    return json({ ok: false, error: "threadId is required." }, 400);
  }

  const messages = await env.DB.prepare(`
    SELECT
      gpt_messages.role,
      gpt_messages.content,
      gpt_messages.created_at,
      users.name AS user_name,
      users.email AS user_email
    FROM gpt_messages
    LEFT JOIN users ON users.id = gpt_messages.user_id
    WHERE gpt_messages.thread_id = ?
    ORDER BY datetime(gpt_messages.created_at) ASC
  `).bind(threadId).all();

  return json({
    ok: true,
    messages: messages.results || []
  });
}
