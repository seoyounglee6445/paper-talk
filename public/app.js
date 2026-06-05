```js
let currentUser = null;

async function loadAuth() {
  const res = await fetch("/api/me", {
    cache: "no-store",
    credentials: "include"
  });
  const data = await res.json();

  currentUser = data.ok ? data.user : null;

  const box = document.getElementById("authBox");
  if (!box) return;

  if (currentUser) {
    box.innerHTML = `
      <span class="auth-name">Signed in as ${escapeHtml(currentUser.name)}</span>
      <a class="btn" href="/auth/logout">Logout</a>
      <button class="danger-btn" onclick="deleteAccount()">Delete Account</button>
    `;
  } else {
    box.innerHTML = `<a class="btn" href="/auth/google">Sign in with Google</a>`;
  }
}

document.addEventListener("DOMContentLoaded", loadAuth);

async function loadPosts({ section, type = "", page = 1, target = "postList" }) {
  await loadAuth();

  const params = new URLSearchParams({ section, page });
  if (type) params.set("type", type);

  const res = await fetch("/api/posts?" + params.toString(), {
    cache: "no-store",
    credentials: "include"
  });
  const data = await res.json();

  const box = document.getElementById(target);
  if (!box) return;

  if (!data.posts || data.posts.length === 0) {
    box.innerHTML = `<p class="empty-posts">No posts yet.</p>`;
    return;
  }

  box.innerHTML = data.posts.map(renderPost).join("");
}

function renderPost(p) {
  const linkUrl = safeUrl(p.link);
  const linkedinUrl = safeUrl(p.linkedin_url);
  const isOwner = currentUser && currentUser.email === p.author_email;

  return `
    <article class="post-card" id="post-${p.id}">
      <div class="post-card-header">
        <div>
          <h3>${escapeHtml(p.title)}</h3>
          <p class="post-meta">${labelType(p.type)} · ${formatDate(p.created_at)}</p>
        </div>
        <span class="post-badge">${labelType(p.type)}</span>
      </div>

      ${p.author_name ? `<p class="post-author">By ${escapeHtml(p.author_name)}</p>` : ""}
      ${p.body ? `<p class="post-body">${escapeHtml(p.body)}</p>` : ""}

      <div class="post-actions">
        ${linkUrl ? `<a class="btn" href="${linkUrl}" target="_blank">Open Link</a>` : ""}
        ${linkedinUrl ? `<a class="btn" href="${linkedinUrl}" target="_blank">LinkedIn Profile</a>` : ""}
        ${isOwner ? `<button onclick="showEditForm('${p.id}')">Edit</button>` : ""}
        ${isOwner ? `<button class="danger-btn" onclick="deleteMyPost('${p.id}')">Delete</button>` : ""}
      </div>

      ${isOwner ? `
        <div class="edit-box" id="edit-${p.id}" style="display:none;">
          <label>Title</label>
          <input id="edit-title-${p.id}" value="${escapeHtml(p.title)}">

          <label>Body</label>
          <textarea id="edit-body-${p.id}">${escapeHtml(p.body)}</textarea>

          <label>Link</label>
          <input id="edit-link-${p.id}" value="${escapeHtml(p.link)}">

          <label>LinkedIn URL</label>
          <input id="edit-linkedin-${p.id}" value="${escapeHtml(p.linkedin_url)}">

          <button onclick="updateMyPost('${p.id}')">Save Changes</button>
        </div>
      ` : ""}
    </article>
  `;
}

function showEditForm(id) {
  const box = document.getElementById(`edit-${id}`);
  box.style.display = box.style.display === "none" ? "block" : "none";
}

async function updateMyPost(id) {
  const res = await fetch("/api/my/update", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      title: document.getElementById(`edit-title-${id}`).value,
      body: document.getElementById(`edit-body-${id}`).value,
      link: document.getElementById(`edit-link-${id}`).value,
      linkedinUrl: document.getElementById(`edit-linkedin-${id}`).value
    })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Update failed");
    return;
  }

  alert("Updated. It will be shown after admin approval.");
  location.reload();
}

async function deleteMyPost(id) {
  if (!confirm("Delete this post?")) return;

  const res = await fetch("/api/my/delete", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Delete failed");
    return;
  }

  alert("Deleted.");
  location.reload();
}

async function submitPost(e) {
  e.preventDefault();

  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  const res = await fetch("/api/posts", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!result.ok) {
    alert(result.error || "Submit failed");
    return;
  }

  alert("Submitted! Your post will be published after admin approval.");
  e.target.reset();
  location.reload();
}

async function deleteAccount() {
  if (!confirm("Delete your account? This cannot be undone.")) return;

  const res = await fetch("/api/delete-account", {
    method: "POST",
    cache: "no-store",
    credentials: "include"
  });
  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Failed to delete account.");
    return;
  }

  alert("Your account has been deleted.");
  location.href = "/";
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return escapeHtml(url);
  return escapeHtml("https://" + url);
}

function labelType(type) {
  const labels = {
    linkedin: "LinkedIn Promotion",
    job: "Job Posting",
    jobsite: "Job Website",
    collaboration: "Research Collaboration",
    question: "Question / Discussion",
    conference_notice: "Conference Notice",
    paper: "Research Paper",
    study_post: "Study",
    methodology: "Methodology",
    methodology_page: "Methodology",
    blog: "Blog"
  };

  return labels[type] || escapeHtml(type);
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countTodayVisit() {
  fetch("/api/public/visits/today", {
    method: "GET",
    cache: "no-store",
    credentials: "include"
  }).catch(() => {});
}

document.addEventListener("DOMContentLoaded", countTodayVisit);
```
