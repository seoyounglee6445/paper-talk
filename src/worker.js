export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
    if (url.pathname === "/api/gpt/messages" && request.method === "GET") return listGptMessages(request, env);
    if (url.pathname === "/api/gpt/chat" && request.method === "POST") return gptChat(request, env);

    if (url.pathname === "/api/admin/gpt/threads" && request.method === "GET") return adminListGptThreads(request, env);
    if (url.pathname === "/api/admin/gpt/messages" && request.method === "GET") return adminListGptMessages(request, env);

    if (url.pathname === "/api/admin/posts" && request.method === "GET") return adminListPosts(request, env);
    if (url.pathname === "/api/admin/users/count" && request.method === "GET") return adminUserCount(request, env);
    if (url.pathname === "/api/admin/approve" && request.method === "POST") return adminApprovePost(request, env);
    if (url.pathname === "/api/admin/delete" && request.method === "POST") return adminDeletePost(request, env);

    if (url.pathname === "/api/admin/research/create" && request.method === "POST") {
      return adminCreateResearchPaper(request, env);
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
  return json({ ok: !!user, user });
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

  return json({
    ok: true,
    threadId,
    answer: assistantText,
    sources: context.map(item => ({
      title: item.title,
      source_url: item.source_url,
      pdf_link: item.pdf_link
    }))
  });
}

async function searchResearchKnowledge(query, env) {
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(term => term.length >= 3)
    .slice(0, 8);

  if (terms.length === 0) {
    const latest = await env.DB.prepare(`
      SELECT title, source_url, pdf_link, content
      FROM research_knowledge
      WHERE status = 'indexed'
      ORDER BY datetime(updated_at) DESC
      LIMIT 5
    `).all();

    return latest.results || [];
  }

  const clauses = terms.map(() => `(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)`).join(" OR ");
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
          item.content || ""
        ].filter(Boolean).join("\n");
      }).join("\n\n---\n\n")
    : "No matching research paper context was found in the Paper_Talk knowledge base.";

  const messages = [
    {
      role: "system",
      content: `
You are Paper_Talk Visium GPT, a research assistant for cancer genomics, bioinformatics, spatial transcriptomics, and Visium-related research.

Rules:
- Use the provided Paper_Talk research knowledge base when relevant.
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.3
    })
  });

  const data = await res.json();

  if (!res.ok) {
    return `OpenAI API error: ${data.error?.message || "Unknown error"}`;
  }

  return data.choices?.[0]?.message?.content || "No answer was generated.";
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
