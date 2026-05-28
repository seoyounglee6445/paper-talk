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

  const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM posts ${where}`)
    .bind(...params)
    .first();

  const posts = await env.DB.prepare(`
    SELECT * FROM posts
    ${where}
    ORDER BY datetime(created_at) DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();

  return json({
    ok: true,
    posts: posts.results,
    page,
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

  return json({ ok: true, message: "Submitted. 관리자 승인 후 공개됩니다." });
}

async function adminListPosts(request, env) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

  const posts = await env.DB.prepare(`
    SELECT * FROM posts
    WHERE status = 'pending'
    ORDER BY datetime(created_at) DESC
  `).all();

  return json({ ok: true, posts: posts.results });
}

async function adminApprovePost(request, env) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

  const data = await request.json();

  await env.DB.prepare(`
    UPDATE posts SET status = 'published' WHERE id = ?
  `).bind(data.id).run();

  return json({ ok: true });
}

async function adminDeletePost(request, env) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

  const data = await request.json();

  await env.DB.prepare(`
    DELETE FROM posts WHERE id = ?
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
  --blue:#1428A0;
  --dark:#071b72;
  --light:#eef3ff;
  --border:#c7d2fe;
}
body {
  margin:0;
  font-family:Inter,system-ui,Arial,sans-serif;
  background:var(--light);
  color:#0f172a;
}
.header {
  background:var(--blue);
  padding:18px 24px;
  position:sticky;
  top:0;
  z-index:10;
}
.nav {
  max-width:1100px;
  margin:auto;
  display:flex;
  gap:18px;
  align-items:center;
  flex-wrap:wrap;
}
.logo {
  color:white;
  font-size:24px;
  font-weight:900;
  margin-right:auto;
}
.nav a {
  color:white;
  text-decoration:none;
  font-weight:800;
}
.container {
  max-width:1100px;
  margin:34px auto;
  padding:0 20px;
}
h1 {
  color:var(--blue);
  font-size:44px;
}
h2 {
  color:var(--blue);
  margin-top:38px;
}
.card {
  background:white;
  border:1px solid var(--border);
  border-radius:20px;
  padding:22px;
  margin-bottom:18px;
}
button,.btn {
  border:0;
  border-radius:999px;
  padding:11px 18px;
  background:var(--blue);
  color:white;
  font-weight:900;
  cursor:pointer;
  text-decoration:none;
  display:inline-block;
}
button:hover,.btn:hover {
  background:var(--dark);
}
input,select,textarea {
  width:100%;
  box-sizing:border-box;
  padding:12px;
  margin:7px 0 14px;
  border:1px solid var(--border);
  border-radius:12px;
  font:inherit;
}
textarea {
  min-height:130px;
}
.meta {
  color:#64748b;
  font-weight:700;
}
.pagination {
  display:flex;
  gap:8px;
  margin-top:20px;
  flex-wrap:wrap;
}
.pagination button.active {
  background:#0f172a;
}
.notice {
  background:white;
  border-left:6px solid var(--blue);
  border-radius:16px;
  padding:20px;
}
</style>
</head>
<body>
<header class="header">
<nav class="nav">
  <div class="logo">Paper_Talk</div>
  <a href="/">Home</a>
  <a href="/research">Research Paper</a>
  <a href="/study">Study Materials</a>
  <a href="/community">Community</a>
  <a href="/career">Career</a>
</nav>
</header>

<main class="container">
${content(type)}
</main>

<script>
async function loadPosts({ section, type = "", page = 1, target = "postList" }) {
  const params = new URLSearchParams({ section, page });
  if (type) params.set("type", type);

  const res = await fetch("/api/posts?" + params.toString());
  const data = await res.json();
  const box = document.getElementById(target);
  if (!box) return;

  if (!data.posts || data.posts.length === 0) {
    box.innerHTML = "<p>No posts yet.</p>";
    return;
  }

  box.innerHTML = data.posts.map(renderPost).join("");

  const pagination = document.getElementById("pagination");
  if (pagination) {
    pagination.innerHTML = "";
    for (let i = 1; i <= data.totalPages; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      if (i === data.page) btn.classList.add("active");
      btn.onclick = () => loadPosts({ section, type, page: i, target });
      pagination.appendChild(btn);
    }
  }
}

function renderPost(p) {
  return \`
    <article class="card">
      <h3>\${escapeHtml(p.title)}</h3>
      <p class="meta">\${escapeHtml(p.type)} · \${new Date(p.created_at).toLocaleDateString()}</p>
      \${p.author_name ? \`<p>By \${escapeHtml(p.author_name)}</p>\` : ""}
      \${p.body ? \`<p>\${escapeHtml(p.body)}</p>\` : ""}
      \${p.link ? \`<p><a class="btn" href="\${escapeHtml(p.link)}" target="_blank">Open Link</a></p>\` : ""}
      \${p.linkedin_url ? \`<p><a class="btn" href="\${escapeHtml(p.linkedin_url)}" target="_blank">LinkedIn Profile</a></p>\` : ""}
    </article>
  \`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function submitPost(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  const res = await fetch("/api/posts", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(data)
  });

  const result = await res.json();
  if (!result.ok) {
    alert(result.error || "Submit failed");
    return;
  }

  alert("Submitted! 관리자 승인 후 공개됩니다.");
  e.target.reset();
}

async function loadPending() {
  const key = document.getElementById("adminKey").value;
  const res = await fetch("/api/admin/posts?key=" + encodeURIComponent(key));
  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Failed");
    return;
  }

  const box = document.getElementById("pendingList");
  if (!data.posts.length) {
    box.innerHTML = "<p>No pending posts.</p>";
    return;
  }

  box.innerHTML = data.posts.map(p => \`
    <article class="card">
      <h3>\${escapeHtml(p.title)}</h3>
      <p class="meta">\${escapeHtml(p.section)} · \${escapeHtml(p.type)}</p>
      <p>\${escapeHtml(p.body)}</p>
      \${p.link ? \`<p><a href="\${escapeHtml(p.link)}" target="_blank">Open Link</a></p>\` : ""}
      \${p.linkedin_url ? \`<p><a href="\${escapeHtml(p.linkedin_url)}" target="_blank">LinkedIn</a></p>\` : ""}
      <p>Author: \${escapeHtml(p.author_name)} / \${escapeHtml(p.author_email)}</p>
      <button onclick="approvePost('\${p.id}')">Approve</button>
      <button onclick="deletePost('\${p.id}')">Delete</button>
    </article>
  \`).join("");
}

async function approvePost(id) {
  const key = document.getElementById("adminKey").value;
  await fetch("/api/admin/approve", {
    method:"POST",
    headers:{"Content-Type":"application/json","X-Admin-Key":key},
    body:JSON.stringify({ id })
  });
  loadPending();
}

async function deletePost(id) {
  if (!confirm("Delete this post?")) return;
  const key = document.getElementById("adminKey").value;
  await fetch("/api/admin/delete", {
    method:"POST",
    headers:{"Content-Type":"application/json","X-Admin-Key":key},
    body:JSON.stringify({ id })
  });
  loadPending();
}
</script>

${script(type)}
</body>
</html>`;
}

function content(type) {
  if (type === "home") {
    return `
<h1>Paper_Talk</h1>
<p>Research paper, community, and career platform for cancer genomics and bioinformatics researchers.</p>

<h2>Latest Research Papers</h2>
<div id="latestResearch"></div>

<h2>Latest Conference Notices</h2>
<div id="latestConference"></div>

<h2>Latest LinkedIn Profiles</h2>
<div id="latestLinkedIn"></div>`;
  }

  if (type === "research") {
    return `
<h1>Research Paper</h1>
<p>전체 논문 목록입니다. 한 페이지에 10개씩 표시됩니다.</p>
<div id="postList"></div>
<div id="pagination" class="pagination"></div>`;
  }

  if (type === "study") {
    return `
<h1>Study Materials</h1>
<div class="notice">
  <p>Seo-Young님이 직접 글을 작성할 공간입니다.</p>
</div>`;
  }

  if (type === "community") {
    return `
<h1>Community</h1>
<p>질문/토론과 학회 공고를 올릴 수 있습니다.</p>

<section class="card">
<h2>Write Community Post</h2>
<form onsubmit="submitPost(event)">
  <input type="hidden" name="section" value="community">

  <label>Type</label>
  <select name="type">
    <option value="question">Question / Discussion</option>
    <option value="conference_notice">Conference Notice</option>
  </select>

  <label>Title</label>
  <input name="title" required>

  <label>Body</label>
  <textarea name="body"></textarea>

  <label>Link</label>
  <input name="link">

  <label>Your Name</label>
  <input name="authorName">

  <label>Your Email</label>
  <input name="authorEmail">

  <button type="submit">Submit</button>
</form>
</section>

<h2>Community Posts</h2>
<div id="postList"></div>
<div id="pagination" class="pagination"></div>`;
  }

  if (type === "career") {
    return `
<h1>Career</h1>
<p>LinkedIn 자기 홍보와 구인공고를 올릴 수 있습니다.</p>

<section class="card">
<h2>Write Career Post</h2>
<form onsubmit="submitPost(event)">
  <input type="hidden" name="section" value="career">

  <label>Type</label>
  <select name="type">
    <option value="linkedin">LinkedIn Promotion</option>
    <option value="job">Job Posting</option>
  </select>

  <label>Title</label>
  <input name="title" required>

  <label>Description</label>
  <textarea name="body"></textarea>

  <label>Link</label>
  <input name="link">

  <label>Your LinkedIn URL</label>
  <input name="linkedinUrl">

  <label>Your Name</label>
  <input name="authorName">

  <label>Your Email</label>
  <input name="authorEmail">

  <button type="submit">Submit</button>
</form>
</section>

<h2>Career Posts</h2>
<div id="postList"></div>
<div id="pagination" class="pagination"></div>`;
  }

  if (type === "admin") {
    return `
<h1>Admin Approval</h1>

<section class="card">
  <label>Admin Key</label>
  <input id="adminKey" type="password" placeholder="Enter admin key">
  <button onclick="loadPending()">Load Pending Posts</button>
</section>

<h2>Pending Posts</h2>
<div id="pendingList"></div>`;
  }

  return "";
}

function script(type) {
  if (type === "home") {
    return `
<script>
loadPosts({ section:"research", target:"latestResearch" });
loadPosts({ section:"community", type:"conference_notice", target:"latestConference" });
loadPosts({ section:"career", type:"linkedin", target:"latestLinkedIn" });
</script>`;
  }

  if (type === "research") {
    return `<script>loadPosts({ section:"research" });</script>`;
  }

  if (type === "community") {
    return `<script>loadPosts({ section:"community" });</script>`;
  }

  if (type === "career") {
    return `<script>loadPosts({ section:"career" });</script>`;
  }

  return "";
}
