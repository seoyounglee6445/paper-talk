export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function isAdmin(request, env) {
  const url = new URL(request.url);
  const key = request.headers.get("X-Admin-Key") || url.searchParams.get("key");
  return key && env.ADMIN_KEY && key === env.ADMIN_KEY;
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

  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM posts ${where}`
  ).bind(...params).first();

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
    total: count.total,
    totalPages: Math.ceil(count.total / limit)
  });
}

async function createPost(request, env) {
  const data = await request.json();

  const section = String(data.section || "").trim();
  const type = String(data.type || "").trim();
  const title = String(data.title || "").trim();

  if (!section || !type || !title) {
    return json({ ok: false, error: "section, type, title are required." }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO posts (
      id, section, type, title, body, link,
      author_name, author_email, linkedin_url, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    crypto.randomUUID(),
    section,
    type,
    title,
    data.body || "",
    data.link || "",
    data.authorName || "",
    data.authorEmail || "",
    data.linkedinUrl || ""
  ).run();

  return json({
    ok: true,
    message: "Submitted. Your post will appear after admin approval."
  });
}

async function adminListPosts(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";

  const posts = await env.DB.prepare(`
    SELECT *
    FROM posts
    WHERE status = ?
    ORDER BY datetime(created_at) DESC
  `).bind(status).all();

  return json({ ok: true, posts: posts.results });
}

async function adminApprovePost(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const data = await request.json();

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

  await env.DB.prepare(`
    DELETE FROM posts
    WHERE id = ?
  `).bind(data.id).run();

  return json({ ok: true });
}
