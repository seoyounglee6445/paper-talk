async function loadAuth() {
  const res = await fetch("/api/me");
  const data = await res.json();

  const box = document.getElementById("authBox");
  if (!box) return;

  if (data.ok && data.user) {
    box.innerHTML = `
      <span class="auth-name">Signed in as ${escapeHtml(data.user.name)}</span>
      <a class="btn" href="/auth/logout">Logout</a>
      <button class="danger-btn" onclick="deleteAccount()">Delete Account</button>
    `;
  } else {
    box.innerHTML = `<a class="btn" href="/auth/google">Sign in with Google</a>`;
  }
}

document.addEventListener("DOMContentLoaded", loadAuth);

async function loadPosts({ section, type = "", page = 1, target = "postList" }) {
  const params = new URLSearchParams({ section, page });

  if (type) params.set("type", type);

  const res = await fetch("/api/posts?" + params.toString());
  const data = await res.json();

  const box = document.getElementById(target);
  if (!box) return;

  if (!data.posts || data.posts.length === 0) {
    box.innerHTML = `<p class="empty-posts">No posts yet.</p>`;
    return;
  }

  box.innerHTML = data.posts.map(renderPost).join("");

  const pagination = document.getElementById("pagination");

  if (pagination) {
    pagination.innerHTML = "";

    for (let i = 1; i <= data.totalPages; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;

      if (i === data.page) {
        btn.classList.add("active");
      }

      btn.onclick = () => loadPosts({ section, type, page: i, target });
      pagination.appendChild(btn);
    }
  }
}

function renderPost(p) {
  const linkUrl = safeUrl(p.link);
  const linkedinUrl = safeUrl(p.linkedin_url);

  return `
    <article class="post-card">
      <div class="post-card-header">
        <div>
          <h3>${escapeHtml(p.title)}</h3>
          <p class="post-meta">
            ${labelType(p.type)} · ${formatDate(p.created_at)}
          </p>
        </div>

        <span class="post-badge">${labelType(p.type)}</span>
      </div>

      ${p.author_name ? `<p class="post-author">By ${escapeHtml(p.author_name)}</p>` : ""}

      ${p.body ? `<p class="post-body">${escapeHtml(p.body)}</p>` : ""}

      <div class="post-actions">
        ${linkUrl ? `<a class="btn" href="${linkUrl}" target="_blank" rel="noopener noreferrer">Open Link</a>` : ""}
        ${linkedinUrl ? `<a class="btn" href="${linkedinUrl}" target="_blank" rel="noopener noreferrer">LinkedIn Profile</a>` : ""}
      </div>
    </article>
  `;
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return escapeHtml(url);
  }

  return escapeHtml("https://" + url);
}

function labelType(type) {
  const labels = {
    linkedin: "LinkedIn Promotion",
    job: "Job Posting",
    jobsite: "Job Website",
    question: "Question / Discussion",
    conference_notice: "Conference Notice",
    paper: "Research Paper",
    study_post: "Study",
    methodology: "Methodology",
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

async function submitPost(e) {
  e.preventDefault();

  const form = new FormData(e.target);
  const data = Object.fromEntries(form.entries());

  const res = await fetch("/api/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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
    method: "POST"
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Failed to delete account.");
    return;
  }

  alert("Your account has been deleted.");
  location.href = "/";
}
