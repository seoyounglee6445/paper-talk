export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/test-secret") {
      return json({
        hasKey: !!env.OPENAI_API_KEY
      });
    }

    if (url.pathname === "/auth/google") return googleLogin(request, env);
    if (url.pathname === "/auth/google/callback") return googleCallback(request, env);
    if (url.pathname === "/auth/logout") return logout();
    if (url.pathname === "/api/me") return apiMe(request, env);

    if (url.pathname === "/api/delete-account" && request.method === "POST") return deleteAccount(request, env);

    if (url.pathname === "/api/my/posts" && request.method === "GET") return myPosts(request, env);
    if (url.pathname === "/api/my/update" && request.method === "POST") return updateMyPost(request, env);
    if (url.pathname === "/api/my/delete" && request.method === "POST") return deleteMyPost(request, env);

    if (url.pathname === "/api/posts" && request.method === "GET") return listPosts(request, env);
    if (url.pathname === "/api/posts" && request.method === "POST") return createPost(request, env);

    if (url.pathname === "/api/gpt/threads" && request.method === "GET") return listGptThreads(request, env);
    if (url.pathname === "/api/gpt/threads" && request.method === "POST") return createGptThread(request, env);
    if (url.pathname.startsWith("/api/gpt/threads/") && request.method === "DELETE") return deleteGptThread(request, env);
    if (url.pathname === "/api/gpt/messages" && request.method === "GET") return listGptMessages(request, env);
    if (url.pathname === "/api/gpt/chat" && request.method === "POST") return gptChat(request, env);

    if (url.pathname === "/api/admin/gpt/threads" && request.method === "GET") return adminListGptThreads(request, env);
    if (url.pathname === "/api/admin/gpt/messages" && request.method === "GET") return adminListGptMessages(request, env);

    if (url.pathname === "/api/admin/posts" && request.method === "GET") return adminListPosts(request, env);
    if (url.pathname === "/api/admin/users/count" && request.method === "GET") return adminUserCount(request, env);
    if (url.pathname === "/api/admin/approve" && request.method === "POST") return adminApprovePost(request, env);
    if (url.pathname === "/api/admin/delete" && request.method === "POST") return adminDeletePost(request, env);

    if (url.pathname === "/api/admin/research/import-linkedin-csv" && request.method === "POST") {
      return adminImportLinkedInCsv(request, env);
    }

    if (url.pathname === "/api/admin/research/reindex" && request.method === "POST") {
      return adminReindexResearchPapers(request, env);
    }

    if (url.pathname === "/api/admin/study/create" && request.method === "POST") {
      return adminCreateStudyPost(request, env);
    }

    if (url.pathname === "/api/admin/methodology/save" && request.method === "POST") {
      return adminSaveMethodologyPage(request, env);
    }

    if (url.pathname === "/api/admin/blog/create" && request.method === "POST") {
      return adminCreateBlogPost(request, env);
    }

    if (url.pathname === "/admin" || url.pathname === "/admin.html") {
      return env.ASSETS.fetch(new Request(new URL("/admin.html", request.url)));
    }

    if (url.pathname === "/admin-gpt" || url.pathname === "/admin-gpt.html") {
      return env.ASSETS.fetch(new Request(new URL("/admin-gpt.html", request.url)));
    }

    if (url.pathname === "/research") {
      return env.ASSETS.fetch(new Request(new URL("/research.html", request.url)));
    }

    if (url.pathname === "/study") {
      return env.ASSETS.fetch(new Request(new URL("/study.html", request.url)));
    }

    if (url.pathname === "/visium-gpt") {
      return env.ASSETS.fetch(new Request(new URL("/visium-gpt.html", request.url)));
    }

    if (url.pathname === "/community") {
      return env.ASSETS.fetch(new Request(new URL("/community.html", request.url)));
    }

    if (url.pathname === "/career") {
      return env.ASSETS.fetch(new Request(new URL("/career.html", request.url)));
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);

    return new Response("Not found", { status: 404 });
  }
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
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
    return json({
      ok: false,
      user: null,
      quota: {
        used: 0,
        limit: 10,
        remaining: 10
      }
    });
  }

  const quota = await getMonthlyGptQuota(user.id, env);

  return json({
    ok: true,
    user,
    quota: {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining
    }
  });
}

async function deleteAccount(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  await env.DB.prepare(`
    DELETE FROM users
    WHERE id = ?
  `).bind(user.id).run();

  return json(
    { ok: true },
    200,
    {
      "Set-Cookie": "pt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    }
  );
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
    where += " AND type = ?";
    params.push(type);
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

  const data = await request.json();

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

  const data = await request.json();
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

  const data = await request.json();

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

function isAdmin(request, env) {
  const url = new URL(request.url);
  const key = request.headers.get("X-Admin-Key") || url.searchParams.get("key");

  return Boolean(key && env.ADMIN_KEY && key === env.ADMIN_KEY);
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
    where += " AND type = ?";
    params.push(type);
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

  const data = await request.json();

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

  const data = await request.json();

  if (!data.id) {
    return json({ ok: false, error: "Post ID is required." }, 400);
  }

  await env.DB.prepare(`
    DELETE FROM research_knowledge
    WHERE post_id = ?
  `).bind(data.id).run();

  if (env.VECTORIZE) {
    try {
      const ids = Array.from({ length: 8 }, (_, index) => `${data.id}:${index}`);
      await env.VECTORIZE.deleteByIds(ids);
    } catch (error) {
      // Ignore Vectorize delete errors so post deletion still works.
    }
  }

  await env.DB.prepare(`
    DELETE FROM posts
    WHERE id = ?
  `).bind(data.id).run();

  return json({ ok: true });
}

async function adminCreateResearchPaper(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json();
  const title = String(data.title || "").trim();

  if (!title) {
    return json({ ok: false, error: "Title is required." }, 400);
  }

  const postId = crypto.randomUUID();

  const researchData = {
    year: data.year || "",
    authors: data.authors || "",
    journal: data.journal || "",
    abstract: data.abstract || "",
    category: data.category || "",
    figures: data.figures || "",
    pdfLink: data.pdfLink || "",
    tags: data.tags || "",
    description: data.description || "",
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
    message: "Research paper saved and added to Paper_Talk GPT knowledge base."
  });
}

async function adminImportLinkedInCsv(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const csvText = String(data.csvText || "").trim();

  if (!csvText) {
    return json({ ok: false, error: "CSV text is required." }, 400);
  }

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

      const fingerprint = normalized.sourceUrl || normalized.content.slice(0, 300);
      const postId = "linkedin_" + await sha256Hex(fingerprint);

      const title = normalized.title || makeTitleFromText(normalized.content);

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
      errors.push(error?.message || "Unknown import error");
    }
  }

  return json({
    ok: true,
    imported,
    skipped,
    errors: errors.slice(0, 10),
    message: `Imported ${imported} LinkedIn posts. Skipped: ${skipped}`
  });
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

  const posts = await env.DB.prepare(`
    SELECT *
    FROM posts
    WHERE section = 'research'
      AND type = 'paper'
      AND status = 'published'
    ORDER BY datetime(created_at) DESC
  `).all();

  let indexed = 0;
  let failed = 0;
  const errors = [];

  for (const post of posts.results || []) {
    try {
      await indexResearchPaperPost(post, env);
      indexed++;
    } catch (error) {
      failed++;
      errors.push({
        id: post.id,
        title: post.title,
        error: error?.message || "Unknown error"
      });
    }
  }

  return json({
    ok: true,
    total: posts.results?.length || 0,
    indexed,
    failed,
    errors: errors.slice(0, 20),
    message: `Reindexed ${indexed} research papers. Failed: ${failed}`
  });
}

async function adminCreateStudyPost(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json();
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
    VALUES (?, 'study', 'study_post', ?, ?, ?, 'Admin', '', '', 'published')
  `).bind(
    crypto.randomUUID(),
    title,
    JSON.stringify(studyData),
    data.link || ""
  ).run();

  return json({
    ok: true,
    message: "Study post saved."
  });
}

async function adminSaveMethodologyPage(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json();
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

  const data = await request.json();
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
  const content = [
    `Title: ${title}`,
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
    sourceUrl,
    pdfLink,
    content
  ).run();

  await upsertResearchKnowledgeVectors({
    postId,
    title,
    sourceUrl,
    pdfLink,
    content
  }, env);

  return true;
}

async function upsertResearchKnowledgeVectors({ postId, title, sourceUrl, pdfLink, content }, env) {
  if (!env.AI || !env.VECTORIZE) {
    return false;
  }

  const chunks = chunkTextForEmbedding(content, 1800).slice(0, 8);

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
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const threads = await env.DB.prepare(`
    SELECT *
    FROM gpt_threads
    WHERE user_id = ?
    ORDER BY datetime(updated_at) DESC
  `).bind(user.id).all();

  return json({
    ok: true,
    threads: threads.results || []
  });
}

async function createGptThread(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const data = await request.json().catch(() => ({}));
  const title = String(data.title || "New chat").trim() || "New chat";
  const threadId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO gpt_threads (
      id,
      user_id,
      title,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(threadId, user.id, title).run();

  return json({
    ok: true,
    thread: {
      id: threadId,
      user_id: user.id,
      title
    }
  });
}

async function listGptMessages(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");

  if (!threadId) {
    return json({ ok: false, error: "threadId is required." }, 400);
  }

  const thread = await env.DB.prepare(`
    SELECT *
    FROM gpt_threads
    WHERE id = ?
      AND user_id = ?
  `).bind(threadId, user.id).first();

  if (!thread) {
    return json({ ok: false, error: "Thread not found." }, 404);
  }

  const messages = await env.DB.prepare(`
    SELECT role, content, created_at
    FROM gpt_messages
    WHERE thread_id = ?
      AND user_id = ?
    ORDER BY datetime(created_at) ASC
  `).bind(threadId, user.id).all();

  return json({
    ok: true,
    messages: messages.results || []
  });
}

async function gptChat(request, env) {
  const user = await getSession(request, env);

  if (!user) {
    return json({ ok: false, error: "Please sign in first." }, 401);
  }

  if (!env.OPENAI_API_KEY) {
    return json({ ok: false, error: "OPENAI_API_KEY is missing." }, 500);
  }

  const data = await request.json();
  const message = String(data.message || "").trim();
  let threadId = String(data.threadId || "").trim();

  if (!message) {
    return json({ ok: false, error: "Message is required." }, 400);
  }

  const quotaBefore = await getMonthlyGptQuota(user.id, env);

  if (quotaBefore.used >= quotaBefore.limit) {
    return json({
      ok: false,
     error: "Monthly limit reached. You have used all 10 questions for this month. Your quota will reset automatically next month.",
      quota: {
        used: quotaBefore.used,
        limit: quotaBefore.limit,
        remaining: 0
      }
    }, 429);
  }

  if (!threadId) {
    threadId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO gpt_threads (
        id,
        user_id,
        title,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      threadId,
      user.id,
      message.slice(0, 60)
    ).run();
  } else {
    const thread = await env.DB.prepare(`
      SELECT *
      FROM gpt_threads
      WHERE id = ?
        AND user_id = ?
    `).bind(threadId, user.id).first();

    if (!thread) {
      return json({ ok: false, error: "Thread not found." }, 404);
    }
  }

  await env.DB.prepare(`
    INSERT INTO gpt_messages (
      id,
      thread_id,
      user_id,
      role,
      content,
      created_at
    )
    VALUES (?, ?, ?, 'user', ?, CURRENT_TIMESTAMP)
  `).bind(
    crypto.randomUUID(),
    threadId,
    user.id,
    message
  ).run();

  const context = await searchResearchKnowledge(message, env);
  const recentMessages = await getRecentThreadMessages(threadId, user.id, env);

  const assistantText = await callOpenAIForPaperTalk({
    userMessage: message,
    context,
    recentMessages
  }, env);

  await env.DB.prepare(`
    INSERT INTO gpt_messages (
      id,
      thread_id,
      user_id,
      role,
      content,
      created_at
    )
    VALUES (?, ?, ?, 'assistant', ?, CURRENT_TIMESTAMP)
  `).bind(
    crypto.randomUUID(),
    threadId,
    user.id,
    assistantText
  ).run();

  await env.DB.prepare(`
    UPDATE gpt_threads
    SET updated_at = CURRENT_TIMESTAMP,
        title = CASE
          WHEN title = 'New chat' THEN ?
          ELSE title
        END
    WHERE id = ?
      AND user_id = ?
  `).bind(
    message.slice(0, 60),
    threadId,
    user.id
  ).run();

  const quotaAfter = await getMonthlyGptQuota(user.id, env);

  return json({
    ok: true,
    threadId,
    answer: assistantText,
    quota: {
      used: quotaAfter.used,
      limit: quotaAfter.limit,
      remaining: quotaAfter.remaining
    },
    sources: context.map(item => ({
      title: item.title,
      source_url: item.source_url,
      pdf_link: item.pdf_link,
      similarity_score: item.similarity_score || null
    }))
  });
}

async function getMonthlyGptQuota(userId, env) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const monthlyLimit = 10;

  const result = await env.DB.prepare(`
    SELECT COUNT(*) AS used
    FROM gpt_messages
    WHERE user_id = ?
      AND role = 'user'
      AND substr(created_at, 1, 7) = ?
  `).bind(userId, monthKey).first();

  const used = result ? Number(result.used || 0) : 0;

  return {
    used,
    limit: monthlyLimit,
    remaining: Math.max(monthlyLimit - used, 0),
    monthKey
  };
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

  const thread = await env.DB.prepare(`
    SELECT *
    FROM gpt_threads
    WHERE id = ?
      AND user_id = ?
  `).bind(threadId, user.id).first();

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

async function searchResearchKnowledge(query, env) {
  const userQuery = String(query || "").trim();

  if (!userQuery) {
    const latest = await env.DB.prepare(`
      SELECT title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE status = 'indexed'
      ORDER BY datetime(updated_at) DESC
      LIMIT 8
    `).all();

    return latest.results || [];
  }

  if (!env.AI || !env.VECTORIZE) {
    return keywordFallbackSearch(userQuery, env);
  }

  try {
    const queryEmbedding = await createEmbedding(userQuery, env);

    const vectorResult = await env.VECTORIZE.query(queryEmbedding, {
      topK: 8,
      returnMetadata: "all"
    });

    const matches = vectorResult.matches || [];

    if (matches.length === 0) {
      return keywordFallbackSearch(userQuery, env);
    }

    const seen = new Set();
    const results = [];

    for (const match of matches) {
      const metadata = match.metadata || {};
      const postId = metadata.post_id;

      if (!postId || seen.has(postId)) continue;
      seen.add(postId);

      const paper = await env.DB.prepare(`
        SELECT title, source_url, pdf_link, content
        FROM research_knowledge
        WHERE post_id = ?
          AND status = 'indexed'
      `).bind(postId).first();

      if (paper) {
        results.push({
          ...paper,
          matched_chunk: metadata.text || "",
          similarity_score: match.score || 0
        });
      }
    }

    if (results.length === 0) {
      return keywordFallbackSearch(userQuery, env);
    }

    return results.slice(0, 8);
  } catch (error) {
    return keywordFallbackSearch(userQuery, env);
  }
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
  const terms = String(query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(term => term.length >= 2)
    .slice(0, 12);

  if (terms.length === 0) {
    const latest = await env.DB.prepare(`
      SELECT title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE status = 'indexed'
      ORDER BY datetime(updated_at) DESC
      LIMIT 8
    `).all();

    return latest.results || [];
  }

  const clauses = terms
    .map(() => `(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)`) 
    .join(" OR ");

  const params = [];

  for (const term of terms) {
    params.push(`%${term}%`, `%${term}%`);
  }

  const result = await env.DB.prepare(`
    SELECT title, source_url, pdf_link, content
    FROM research_knowledge
    WHERE status = 'indexed'
      AND (${clauses})
    ORDER BY datetime(updated_at) DESC
    LIMIT 8
  `).bind(...params).all();

  return result.results || [];
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

async function callOpenAIForPaperTalk({ userMessage, context, recentMessages }, env) {
  const contextText = context.length
    ? context.map((item, index) => {
        return [
          `Source ${index + 1}: ${item.title}`,
          item.source_url ? `Article: ${item.source_url}` : "",
          item.pdf_link ? `PDF: ${item.pdf_link}` : "",
          item.matched_chunk || item.content || ""
        ].filter(Boolean).join("\n");
      }).join("\n\n---\n\n")
    : "No matching research paper context was found in the Paper_Talk knowledge base.";

  const messages = [
    {
      role: "system",
      content: `
You are Paper_Talk Vision GPT, a research assistant for cancer genomics, bioinformatics, spatial transcriptomics, and Visium-related research.

Rules:
- Always search and use the provided Paper_Talk research knowledge base when relevant.
- The user may ask in Korean, English, or mixed Korean-English. Understand both languages.
- Use semantic meaning, not only exact keywords, when interpreting the user's question.
- If relevant Paper_Talk sources are found, base the answer on them and mention the source titles.
- If the knowledge base does not contain enough information, say that clearly.
- Do not invent paper details.
- Give concise but scientifically useful answers.
- When possible, mention which uploaded Paper_Talk source you used.
- The user may be a researcher, student, or bioinformatics learner.
      `.trim()
    },
    {
      role: "system",
      content: `Paper_Talk research knowledge base:\n\n${contextText}`
    },
    ...recentMessages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    })),
    {
      role: "user",
      content: userMessage
    }
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1",
        messages,
        temperature: 0.3
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return `OpenAI API error: ${data.error?.message || `HTTP ${res.status}`}`;
    }

    return data.choices?.[0]?.message?.content || "No answer was generated.";
  } catch (error) {
    if (error && error.name === "AbortError") {
      return "OpenAI API timeout. Please try again.";
    }

    return `OpenAI API request failed: ${error?.message || "Unknown error"}`;
  } finally {
    clearTimeout(timeout);
  }
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
