export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth/google") return googleLogin(request, env);
    if (url.pathname === "/auth/google/callback") return googleCallback(request, env);
    if (url.pathname === "/auth/logout") return logout();
    if (url.pathname === "/api/me") return apiMe(request, env);

    if (url.pathname === "/api/delete-account" && request.method === "POST") {
      return deleteAccount(request, env);
    }

    if (url.pathname === "/api/my/posts" && request.method === "GET") {
      return myPosts(request, env);
    }

    if (url.pathname === "/api/my/update" && request.method === "POST") {
      return updateMyPost(request, env);
    }

    if (url.pathname === "/api/my/delete" && request.method === "POST") {
      return deleteMyPost(request, env);
    }

    if (url.pathname === "/api/posts" && request.method === "GET") {
      return listPosts(request, env);
    }

    if (url.pathname === "/api/posts" && request.method === "POST") {
      return createPost(request, env);
    }

    if (url.pathname === "/api/admin/posts" && request.method === "GET") {
      return adminListPosts(request, env);
    }

    if (url.pathname === "/api/admin/approve" && request.method === "POST") {
      return adminApprovePost(request, env);
    }

    if (url.pathname === "/api/admin/delete" && request.method === "POST") {
      return adminDeletePost(request, env);
    }

    if (url.pathname === "/api/admin/research/create" && request.method === "POST") {
      return adminCreateResearchPaper(request, env);
    }

    if (url.pathname === "/admin") {
      return env.ASSETS.fetch(new Request(new URL("/admin.html", request.url)));
    }

    if (url.pathname === "/research") {
      return env.ASSETS.fetch(new Request(new URL("/research.html", request.url)));
    }

    if (url.pathname === "/career") {
      return env.ASSETS.fetch(new Request(new URL("/career.html", request.url)));
    }

    if (url.pathname === "/study") {
      return env.ASSETS.fetch(new Request(new URL("/study.html", request.url)));
    }

    if (url.pathname === "/community") {
      return env.ASSETS.fetch(new Request(new URL("/community.html", request.url)));
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
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const limit = 10;
  const offset = (page - 1) * limit;

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
    total: count ? count.total : 0,
    totalPages: Math.ceil((count ? count.total : 0) / limit)
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
    crypto.randomUUID(),
    title,
    JSON.stringify(researchData),
    data.articleLink || ""
  ).run();

  return json({
    ok: true,
    message: "Research paper saved."
  });
}
