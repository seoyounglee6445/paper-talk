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
   
