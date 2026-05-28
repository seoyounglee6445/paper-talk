async function loadPosts({ section, type = "", page = 1, target = "postList" }) {
  const params = new URLSearchParams({ section, page });

  if (type) params.set("type", type);

  const res = await fetch("/api/posts?" + params.toString());
  const data = await res.json();

  const box = document.getElementById(target);

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
  return `
    <article class="card">
      <h3>${escapeHtml(p.title)}</h3>
      <p class="meta">${escapeHtml(p.type)} · ${new Date(p.created_at).toLocaleDateString()}</p>
      ${p.author_name ? `<p>By ${escapeHtml(p.author_name)}</p>` : ""}
      ${p.body ? `<p>${escapeHtml(p.body)}</p>` : ""}
      ${p.link ? `<p><a class="btn" href="${escapeHtml(p.link)}" target="_blank">Open Link</a></p>` : ""}
      ${p.linkedin_url ? `<p><a href="${escapeHtml(p.linkedin_url)}" target="_blank">LinkedIn Profile</a></p>` : ""}
    </article>
  `;
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!result.ok) {
    alert(result.error || "Submit failed");
    return;
  }

  alert("Submitted!");
  e.target.reset();
  location.reload();
}
