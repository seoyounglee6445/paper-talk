async function loadMyPosts() {
  const res = await fetch("/api/my/posts");
  const data = await res.json();

  const box = document.getElementById("myPosts");
  if (!box) return;

  if (!data.ok) {
    box.innerHTML = `<p class="empty-posts">${escapeHtml(data.error || "Please sign in first.")}</p>`;
    return;
  }

  if (!data.posts.length) {
    box.innerHTML = `<p class="empty-posts">No posts yet.</p>`;
    return;
  }

  box.innerHTML = data.posts.map(post => `
    <article class="post-card">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="post-meta">${labelType(post.type)} · ${escapeHtml(post.status)}</p>

      <label>Title</label>
      <input id="title-${post.id}" value="${escapeHtml(post.title)}">

      <label>Body</label>
      <textarea id="body-${post.id}">${escapeHtml(post.body)}</textarea>

      <label>Link</label>
      <input id="link-${post.id}" value="${escapeHtml(post.link)}">

      <label>LinkedIn URL</label>
      <input id="linkedin-${post.id}" value="${escapeHtml(post.linkedin_url)}">

      <div class="post-actions">
        <button onclick="updateMyPost('${post.id}')">Update</button>
        <button class="danger-btn" onclick="deleteMyPost('${post.id}')">Delete</button>
      </div>
    </article>
  `).join("");
}

async function updateMyPost(id) {
  const res = await fetch("/api/my/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id,
      title: document.getElementById(`title-${id}`).value,
      body: document.getElementById(`body-${id}`).value,
      link: document.getElementById(`link-${id}`).value,
      linkedinUrl: document.getElementById(`linkedin-${id}`).value
    })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Update failed");
    return;
  }

  alert("Updated. It will be shown after admin approval.");
  loadMyPosts();
}

async function deleteMyPost(id) {
  if (!confirm("Delete this post?")) return;

  const res = await fetch("/api/my/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Delete failed");
    return;
  }

  alert("Deleted.");
  loadMyPosts();
}
