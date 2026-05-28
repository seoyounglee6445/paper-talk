export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/posts" && request.method === "GET") return listPosts(request, env);
    if (url.pathname === "/api/posts" && request.method === "POST") return createPost(request, env);

    if (url.pathname === "/api/admin/posts" && request.method === "GET") return adminListPosts(request, env);
    if (url.pathname === "/api/admin/approve" && request.method === "POST") return adminApprovePost(request, env);
    if (url.pathname === "/api/admin/delete" && request.method === "POST") return adminDeletePost(request, env);

    if (url.pathname === "/" || url.pathname === "/index.html") return html(page("home"));
    if (url.pathname === "/research" || url.pathname === "/research.html") return html(page("research"));
    if (url.pathname === "/study" || url.pathname === "/study.html") return html(page("study"));
    if (url.pathname === "/community" || url.pathname === "/community.html") return html(page("community"));
    if (url.pathname === "/career" || url.pathname === "/career.html") return html(page("career"));
    if (url.pathname === "/admin" || url.pathname === "/admin.html") return html(page("admin"));

    return html(page("home"));
  }
};

function html(content) {
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

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
    return json({ ok: false, error: "section, type, and title are required." }, 400);
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
    message: "Submitted. Your post will be published after admin approval."
  });
}

async function adminListPosts(request, env) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const posts = await env.DB.prepare(`
    SELECT *
    FROM posts
    WHERE status = 'pending'
    ORDER BY datetime(created_at) DESC
  `).all();

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

function page(type) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Paper_Talk</title>
<style>
:root {
  --main-blue: #1428A0;
  --dark-blue: #0b1f78;
  --light-blue: #eef3ff;
  --border-blue: #c7d2fe;
  --text-dark: #0f172a;
}

body {
  margin: 0;
  font-family: Inter, system-ui, Arial, sans-serif;
  background: var(--light-blue);
  color: var(--text-dark);
}

.header {
  background: var(--main-blue);
  border-bottom: 1px solid var(--dark-blue);
  padding: 18px 24px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav {
  max-width: 1200px;
  margin: auto;
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}

.logo {
  font-weight: 900;
  font-size: 24px;
  margin-right: auto;
  color: white;
}

.nav a {
  text-decoration: none;
  color: white;
  font-weight: 800;
}

.container {
  max-width: 1200px;
  margin: 34px auto;
  padding: 0 22px;
}

h1 {
  font-size: 44px;
  color: var(--main-blue);
  margin-bottom: 10px;
}

h2 {
  color: var(--main-blue);
}

.home-three-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  margin-top: 34px;
}

.home-column {
  background: white;
  border: 1px solid var(--
