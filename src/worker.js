export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/posts" && request.method === "GET") {
      return listPosts(request, env);
    }

    if (url.pathname === "/api/posts" && request.method === "POST") {
      return createPost(request, env);
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

  const countQuery = `SELECT COUNT(*) AS total FROM posts ${where}`;
  const count = await env.DB.prepare(countQuery).bind(...params).first();

  const listQuery = `
    SELECT *
    FROM posts
    ${where}
    ORDER BY datetime(created_at) DESC
    LIMIT ? OFFSET ?
  `;

  const posts = await env.DB.prepare(listQuery)
    .bind(...params, limit, offset)
    .all();

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

  const id = crypto.randomUUID();

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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
  `).bind(
    id,
    section,
    type,
    title,
    data.body || "",
    data.link || "",
    data.authorName || "",
    data.authorEmail || "",
    data.linkedinUrl || ""
  ).run();

  return json({ ok: true, id });
}
