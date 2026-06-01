/*
Paper_Talk v3 update:
- Converts every user question into an automatic DB-grounded research exploration.
- The system infers the user's likely research interest, searches related Paper_Talk DB papers, extracts known findings, identifies knowledge gaps, generates testable hypotheses, and proposes validation strategies.
- Even simple concept questions are answered with a research-intent layer plus hypothesis-generation output.
- Uses retrieved Paper_Talk DB sources as evidence. Outside literature is not used as evidence unless the user explicitly asks for general background.
*/

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (pathname === "/api/test-secret") {
        return json({
          hasKey: !!env.OPENAI_API_KEY
        });
      }

      if (pathname === "/auth/google") return googleLogin(request, env);
      if (pathname === "/auth/google/callback") return googleCallback(request, env);
      if (pathname === "/auth/logout") return logout();
      if (pathname === "/api/me") return apiMe(request, env);

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

      if (pathname === "/api/admin/gpt/threads" && request.method === "GET") return adminListGptThreads(request, env);
      if (pathname === "/api/admin/gpt/messages" && request.method === "GET") return adminListGptMessages(request, env);

      if (pathname === "/api/admin/posts" && request.method === "GET") return adminListPosts(request, env);
      if (pathname === "/api/admin/users/count" && request.method === "GET") return adminUserCount(request, env);
      if (pathname === "/api/admin/approve" && request.method === "POST") return adminApprovePost(request, env);
      if (pathname === "/api/admin/delete" && request.method === "POST") return adminDeletePost(request, env);
      if (pathname === "/api/admin/post/update" && request.method === "POST") return adminUpdatePost(request, env);

      if (pathname === "/api/admin/research/import-linkedin-csv" && request.method === "POST") {
        return adminImportLinkedInCsv(request, env);
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

      if (pathname === "/admin" || pathname === "/admin.html") {
        return env.ASSETS.fetch(new Request(new URL("/admin.html", request.url)));
      }

      if (pathname === "/admin-gpt" || pathname === "/admin-gpt.html") {
        return env.ASSETS.fetch(new Request(new URL("/admin-gpt.html", request.url)));
      }

      if (pathname === "/research") {
        return env.ASSETS.fetch(new Request(new URL("/research.html", request.url)));
      }

      if (pathname === "/study") {
        return env.ASSETS.fetch(new Request(new URL("/study.html", request.url)));
      }

      if (pathname === "/visium-gpt") {
        return env.ASSETS.fetch(new Request(new URL("/visium-gpt.html", request.url)));
      }

      if (pathname === "/community") {
        return env.ASSETS.fetch(new Request(new URL("/community.html", request.url)));
      }

      if (pathname === "/career") {
        return env.ASSETS.fetch(new Request(new URL("/career.html", request.url)));
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
      return json({
        ok: false,
        error: error?.message || "Worker server error"
      }, 500);
    }
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
        limit: 20,
        remaining: 20
      }
    });
  }

  const quota = await getMonthlyGptQuota(user.id, env, user);

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

  await env.DB.prepare(`
    DELETE FROM research_knowledge
    WHERE post_id = ?
  `).bind(data.id).run();

  if (env.VECTORIZE) {
    try {
      const ids = Array.from({ length: 24 }, (_, index) => `${data.id}:${index}`);
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
  const fetchedArticle = await fetchArticleKnowledgeText({
    title,
    sourceUrl,
    pdfLink
  });

  const content = [
    `Title: ${title}`,
    researchData.year ? `Year: ${researchData.year}` : "",
    researchData.authors ? `Authors: ${researchData.authors}` : "",
    researchData.journal ? `Journal: ${researchData.journal}` : "",
    researchData.category ? `Category: ${researchData.category}` : "",
    researchData.tags ? `Tags: ${researchData.tags}` : "",
    researchData.abstract ? `Admin abstract: ${researchData.abstract}` : "",
    researchData.description ? `Admin description: ${researchData.description}` : "",
    fetchedArticle ? `Fetched article text from link: ${fetchedArticle}` : "",
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


async function fetchArticleKnowledgeText({ title, sourceUrl, pdfLink }) {
  const normalizedTitle = cleanFetchedArticleText(title || "");
  const urls = [sourceUrl, pdfLink]
    .map(v => String(v || "").trim())
    .filter(Boolean);

  const collected = [];
  const doi = extractDoiFromTextOrUrl([sourceUrl, pdfLink, title].join("\n"));

  // 1) DOI/title 기반 공개 학술 메타데이터를 먼저 수집합니다.
  // ScienceDirect/Wiley 같은 출판사 페이지는 Worker fetch가 차단될 수 있으므로
  // Crossref + Europe PMC/PubMed 계열 API를 우선 사용합니다.
  try {
    const crossref = await fetchCrossrefKnowledge({ doi, title: normalizedTitle });
    if (crossref) collected.push(crossref);
  } catch {
    // Continue with other sources.
  }

  try {
    const europePmc = await fetchEuropePmcKnowledge({ doi, title: normalizedTitle });
    if (europePmc) collected.push(europePmc);
  } catch {
    // Continue with direct link fallback.
  }

  // 2) 그래도 부족하면 원문 링크 HTML 메타데이터/초록을 직접 시도합니다.
  for (const url of urls) {
    try {
      const item = await fetchReadableArticleText(url, normalizedTitle);
      if (item) collected.push(item);
    } catch {
      // Some publisher pages block automated access. Do not fail saving/indexing.
    }
  }

  const finalText = cleanFetchedArticleText(collected.join("\n\n"));
  return finalText.slice(0, 36000);
}

async function fetchCrossrefKnowledge({ doi, title }) {
  let url = "";

  if (doi) {
    url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  } else if (title) {
    url = `https://api.crossref.org/works?rows=1&query.title=${encodeURIComponent(title)}`;
  } else {
    return "";
  }

  const data = await fetchJsonWithTimeout(url, 12000);
  const item = doi ? data?.message : data?.message?.items?.[0];

  if (!item) return "";

  const titleText = Array.isArray(item.title) ? item.title.join(" ") : "";
  const abstract = item.abstract ? cleanCrossrefAbstract(item.abstract) : "";
  const container = Array.isArray(item["container-title"]) ? item["container-title"].join(" ") : "";
  const published = item.published?.["date-parts"]?.[0]?.join("-") || "";
  const authors = Array.isArray(item.author)
    ? item.author.slice(0, 20).map(a => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", ")
    : "";
  const doiText = item.DOI || doi || "";
  const urlText = item.URL || "";

  const pieces = [
    "Crossref metadata from article DOI/title:",
    titleText ? `Title: ${titleText}` : "",
    authors ? `Authors: ${authors}` : "",
    container ? `Journal: ${container}` : "",
    published ? `Published: ${published}` : "",
    doiText ? `DOI: ${doiText}` : "",
    urlText ? `URL: ${urlText}` : "",
    abstract ? `Abstract: ${abstract}` : ""
  ].filter(Boolean);

  return pieces.join("\n");
}

async function fetchEuropePmcKnowledge({ doi, title }) {
  const queries = [];

  if (doi) queries.push(`DOI:"${doi}"`);
  if (title) queries.push(`TITLE:"${title.replace(/"/g, " ")}"`);

  for (const query of queries) {
    const searchUrl =
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=1`;

    const data = await fetchJsonWithTimeout(searchUrl, 15000);
    const result = data?.resultList?.result?.[0];

    if (!result) continue;

    const pieces = [];

    pieces.push("Europe PMC / PubMed-indexed article data:");
    if (result.title) pieces.push(`Title: ${result.title}`);
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
  }, 15000);

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
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
  }, 15000);

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

  const doiParam = text.match(/[?&](?:doi|DOI)=([^&\s]+)/);
  if (doiParam) return cleanDoi(decodeURIComponent(doiParam[1]));

  const doi = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  if (doi) return cleanDoi(doi[0]);

  return "";
}

function cleanDoi(value) {
  return String(value || "")
    .replace(/^doi:/i, "")
    .replace(/[.,;)\]}]+$/g, "")
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

  const data = await request.json().catch(() => ({}));
  const message = String(data.message || "").trim();
  let threadId = String(data.threadId || "").trim();

  if (!message) {
    return json({ ok: false, error: "Message is required." }, 400);
  }

  const quotaBefore = await getMonthlyGptQuota(user.id, env, user);

  if (quotaBefore.used >= quotaBefore.limit) {
    return json({
      ok: false,
      error: "Monthly limit reached. You have used all 20 questions for this month. Your quota will reset automatically next month.",
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

  // v3-auto-hypothesis:
  // Every user message is first interpreted as a research exploration request.
  // The inferred intent is used to broaden DB retrieval, then the final answer must include:
  // user interest inference, related paper evidence, knowledge gaps, hypotheses, and validation strategy.
  const recentMessages = await getRecentThreadMessages(threadId, user.id, env);
  const autoIntent = await inferUserResearchIntent({
    userMessage: message,
    recentMessages
  }, env);

  const retrievalMessage = autoIntent?.retrieval_query
    ? `${message}

Auto-inferred research retrieval query:
${autoIntent.retrieval_query}`
    : message;

  const context = await searchResearchKnowledge(retrievalMessage, env);

  let assistantText = await callOpenAIForPaperTalk({
    userMessage: message,
    context,
    pastFrameworks: [],
    generatedFramework: "",
    recentMessages,
    autoIntent
  }, env);

  assistantText = assistantText
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/#/g, "")
    .replace(/\*/g, "");

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

  const quotaAfter = await getMonthlyGptQuota(user.id, env, user);

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

async function getMonthlyGptQuota(userId, env, user = null) {
  const monthlyLimit = 20;

  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);

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
    const latestKnowledge = await latestResearchKnowledge(env, 12);
    if (latestKnowledge.length > 0) return latestKnowledge;
    return latestResearchPostsAsKnowledge(env, 12);
  }

  const allResults = [];

  // True semantic RAG:
  // 1) Expand/translate the user's natural question into English scientific retrieval text.
  //    This lets Korean questions like "알츠하이머 연구가 뭐가 있지?" match English paper text
  //    such as "Alzheimer's disease, amyloid plaque, oligodendrocyte".
  // 2) Query Vectorize with both the original question and the expanded retrieval query.
  // 3) Use deterministic DB title/content search only as a fallback/safety net.
  const retrievalQueries = await buildRetrievalQueries(userQuery, env);

  // A) Semantic Vectorize search first.
  for (const retrievalQuery of retrievalQueries) {
    try {
      allResults.push(...await vectorSemanticSearch(retrievalQuery, env));
    } catch {
      // Continue with other retrieval methods.
    }
  }

  let semanticMerged = mergeKnowledgeResults(allResults).slice(0, 12);
  if (semanticMerged.length > 0) {
    return semanticMerged;
  }

  // B) Deterministic DB fallback with expanded English retrieval queries.
  for (const retrievalQuery of retrievalQueries) {
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

  const merged = mergeKnowledgeResults(allResults).slice(0, 12);
  if (merged.length > 0) return merged;

  return [];
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
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5",
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

    const raw = await res.text();
    const data = JSON.parse(raw);
    const value = data?.choices?.[0]?.message?.content || "";

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
    topK: 18,
    returnMetadata: "all"
  });

  const matches = vectorResult.matches || [];
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
    "paper", "article", "study", "research", "please", "summary", "summarize", "summarise", "about",
    "what", "which", "where", "when", "how", "why", "can", "could", "would", "should",
    "논문", "연구", "관련", "자료", "정보", "뭐가", "무엇", "어떤", "있지", "있어", "있나요",
    "요약", "요약해줘", "요약해주세요", "정리", "정리해줘", "알려줘", "해주세요",
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
    .replace(/\b(paper|article|study|research|please|summary|summarize|summarise|about)\b/gi, " ")
    .replace(/논문|연구|관련|자료|정보|뭐가|무엇|어떤|있지|있어|있나요|요약해주세요|요약해줘|요약|정리해줘|정리|알려줘|해주세요/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeKnowledgeResults(items) {
  const seen = new Set();
  const merged = [];

  for (const item of items || []) {
    if (!item) continue;
    const key = normalizeSearchText(item.title || "") || normalizeSearchText(item.source_url || item.pdf_link || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.sort((a, b) => {
    const aContent = a?.content || a?.matched_chunk || "";
    const bContent = b?.content || b?.matched_chunk || "";
    const aVector = a?.from_vector_search ? 3 : 0;
    const bVector = b?.from_vector_search ? 3 : 0;
    const aScore = aVector + (hasScientificContent(aContent) ? 10 : 0) + Math.min(String(aContent).length / 1000, 5);
    const bScore = bVector + (hasScientificContent(bContent) ? 10 : 0) + Math.min(String(bContent).length / 1000, 5);
    return bScore - aScore;
  });
}

function hasScientificContent(value) {
  const text = String(value || "").toLowerCase();
  if (text.length < 120) return false;
  return /abstract|admin abstract|description|result|discussion|method|conclusion|fetched article text|crossref|europe pmc|pubmed|pmc full text|논문|초록|결과|방법|요약/.test(text);
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
      WHERE (${clauses.join(" OR ")})
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
        WHERE LOWER(title) LIKE ?
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
      ORDER BY datetime(updated_at) DESC
      LIMIT ?
    `).bind(limit).all();

    return latest.results || [];
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
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5",
        messages: [
          {
            role: "system",
            content: `
You are the automatic research-intent interpreter for Paper_Talk Vision GPT.

Convert any user message into a biomedical research exploration plan.
Even if the user asks a simple definition question, infer the deeper research need.
Return only valid JSON.

JSON keys:
- interpreted_intent: one sentence explaining what the user probably wants to understand or discover.
- primary_domain: short field name, for example cancer genomics, spatial omics, immuno-oncology, neurodegeneration, single-cell analysis.
- key_entities: array of important diseases, methods, genes, cell types, technologies, or biological concepts.
- retrieval_query: concise English search query for Paper_Talk DB retrieval. Include synonyms and biomedical terms.
- gap_axes: array of gap types to check, such as mechanism, cell type, spatial niche, cancer context, cohort validation, perturbation, multi-omics integration, clinical association.
- hypothesis_angle: one sentence describing the kind of hypothesis that should be generated.
- validation_angle: one sentence describing the likely validation strategy.

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
        max_completion_tokens: 700
      })
    });

    const raw = await res.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return fallback;
    }

    if (!res.ok) return fallback;

    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = parseJsonObjectFromText(content);

    if (!parsed || typeof parsed !== "object") return fallback;

    return {
      interpreted_intent: String(parsed.interpreted_intent || fallback.interpreted_intent).slice(0, 600),
      primary_domain: String(parsed.primary_domain || fallback.primary_domain).slice(0, 160),
      key_entities: Array.isArray(parsed.key_entities) ? parsed.key_entities.map(v => String(v).slice(0, 100)).slice(0, 12) : fallback.key_entities,
      retrieval_query: String(parsed.retrieval_query || fallback.retrieval_query).slice(0, 700),
      gap_axes: Array.isArray(parsed.gap_axes) ? parsed.gap_axes.map(v => String(v).slice(0, 120)).slice(0, 10) : fallback.gap_axes,
      hypothesis_angle: String(parsed.hypothesis_angle || fallback.hypothesis_angle).slice(0, 500),
      validation_angle: String(parsed.validation_angle || fallback.validation_angle).slice(0, 500)
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
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

  const entities = normalized
    .split(/\s+/)
    .filter(v => v.length >= 3)
    .slice(0, 8);

  return {
    interpreted_intent: message
      ? `The user is asking about "${message}"; treat it as a request to understand the concept, find related Paper_Talk DB evidence, identify research gaps, and generate testable hypotheses.`
      : "The user did not provide a specific topic; explore the most relevant recent Paper_Talk DB papers and generate research hypotheses.",
    primary_domain: "biomedical research",
    key_entities: entities,
    retrieval_query: [message, normalized, "biomedical research mechanism knowledge gap hypothesis validation spatial omics cancer genomics single-cell multi-omics"].filter(Boolean).join(", ").slice(0, 700),
    gap_axes: [
      "mechanism",
      "cell type",
      "spatial niche",
      "disease or cancer context",
      "multi-omics integration",
      "cohort validation",
      "experimental perturbation"
    ],
    hypothesis_angle: "Generate cautious, testable hypotheses by connecting DB-supported findings and unresolved gaps.",
    validation_angle: "Propose computational re-analysis plus experimental validation only when supported by retrieved DB evidence."
  };
}

async function callOpenAIForPaperTalk({ userMessage, context, pastFrameworks = [], generatedFramework, recentMessages, autoIntent = null }, env) {
  const hasContext = Array.isArray(context) && context.length > 0;

  const contextText = hasContext
    ? context.slice(0, 10).map((item, index) => {
        return [
          `Source ${index + 1}: ${cleanBibtexText(item.title || "")}`,
          item.source_url ? `Article: ${item.source_url}` : "",
          item.pdf_link ? `PDF: ${item.pdf_link}` : "",
          cleanBibtexText(item.matched_chunk || item.content || "").slice(0, 2200)
        ].filter(Boolean).join("\n");
      }).join("\n\n---\n\n")
    : "No matching research paper context was found in the Paper_Talk knowledge base.";

  const intent = autoIntent || makeFallbackResearchIntent(userMessage);

  const intentText = [
    `Interpreted intent: ${intent.interpreted_intent || ""}`,
    `Primary domain: ${intent.primary_domain || ""}`,
    `Key entities: ${Array.isArray(intent.key_entities) ? intent.key_entities.join(", ") : ""}`,
    `Retrieval query: ${intent.retrieval_query || ""}`,
    `Gap axes to inspect: ${Array.isArray(intent.gap_axes) ? intent.gap_axes.join(", ") : ""}`,
    `Hypothesis angle: ${intent.hypothesis_angle || ""}`,
    `Validation angle: ${intent.validation_angle || ""}`
  ].filter(Boolean).join("\n");

  const messages = [
    {
      role: "system",
      content: `
You are Paper_Talk Vision GPT, a DB-grounded biomedical hypothesis-generation engine.

Core behavior:
Never stop at a simple definition or summary.
For every user question, automatically perform this sequence:
1. Infer the user's likely research interest.
2. Search and use related Paper_Talk DB papers supplied in the retrieved context.
3. Extract known DB-supported findings.
4. Identify research gaps inside the retrieved DB evidence.
5. Generate cautious, testable hypotheses.
6. Propose validation strategies.
7. Prioritize next-step research ideas.

Evidence rules:
- Use only retrieved Paper_Talk DB sources as scientific evidence.
- Do not use outside literature as evidence unless the user explicitly asks for general background.
- Do not invent papers, datasets, sample sizes, biomarkers, mechanisms, or claims.
- If retrieved DB evidence is weak or absent, clearly say so and label hypotheses as exploratory.
- Separate DB-supported findings from generated hypotheses.

Language:
Answer in the user's language.

Required output format:

Auto-interpreted research intent
- What the user probably wants to understand or discover
- Main domain and key entities

Related Paper_Talk DB papers used
- Source 1: title — short reason it is relevant
- Source 2: title — short reason it is relevant
If no source was found, write: No matching Paper_Talk DB source was found.

Known findings from DB
- DB-supported finding with source title
- DB-supported finding with source title

Research gaps identified
- Gap 1: missing mechanism / missing cell type / missing spatial context / missing validation / unresolved contradiction
- Gap 2

Generated hypotheses
Hypothesis 1
Statement:
Why this follows from DB evidence:
Knowledge gap addressed:
Validation strategy:
Novelty score: 1-5
Feasibility score: 1-5
Risk score: 1-5

Hypothesis 2
Statement:
Why this follows from DB evidence:
Knowledge gap addressed:
Validation strategy:
Novelty score: 1-5
Feasibility score: 1-5
Risk score: 1-5

Recommended next step
- Pick the strongest hypothesis and explain the first analysis or experiment to run.

Evidence guardrail
- State what should not be overclaimed.

Keep answers concise enough to avoid timeout.
Return plain text only. Do not use markdown symbols such as #, *, or **.
      `.trim()
    },
    {
      role: "system",
      content: `Automatic research-intent interpretation:\n\n${intentText}`
    },
    {
      role: "system",
      content: `Retrieved Paper_Talk DB sources:\n\n${contextText.slice(0, 17000)}`
    },
    {
      role: "system",
      content: hasContext
        ? "Matching Paper_Talk DB sources were found. Use their titles and excerpts as the only evidence base."
        : "No matching Paper_Talk DB source was found. Do not hallucinate evidence; provide only exploratory hypotheses and say that DB support is absent."
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
      content: String(userMessage || "").slice(0, 1500)
    }
  ];

  if (!env.OPENAI_API_KEY) {
    return "OPENAI_API_KEY is missing.";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5",
        messages,
        temperature: 0.2,
        max_completion_tokens: 1800
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

    return data?.choices?.[0]?.message?.content || "No answer was generated.";
  } catch (error) {
    if (error && error.name === "AbortError") {
      return "OpenAI API timeout. Please try a narrower question or ask about fewer mechanisms at once.";
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
