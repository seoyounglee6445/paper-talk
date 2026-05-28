```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return html(homePage());
    }

    if (url.pathname === "/research") {
      return html(researchPage());
    }

    if (url.pathname === "/study") {
      return html(studyPage());
    }

    if (url.pathname === "/community") {
      return html(communityPage());
    }

    if (url.pathname === "/career") {
      return html(careerPage());
    }

    return html(homePage());
  }
};

function html(content) {
  return new Response(content, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8"
    }
  });
}

function layout(title, body) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>

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
  font-family: Inter, Arial, sans-serif;
  background: var(--light-blue);
  color: var(--text-dark);
}

.header {
  background: var(--main-blue);
  padding: 18px 24px;
}

.nav {
  max-width: 1200px;
  margin: auto;
  display: flex;
  align-items: center;
  gap: 20px;
}

.logo {
  color: white;
  font-size: 28px;
  font-weight: 900;
  margin-right: auto;
}

.nav a {
  color: white;
  text-decoration: none;
  font-weight: 700;
}

.container {
  max-width: 1200px;
  margin: auto;
  padding: 30px 20px;
}

h1 {
  color: var(--main-blue);
  font-size: 44px;
}

h2 {
  color: var(--main-blue);
}

.card {
  background: white;
  border-radius: 20px;
  border: 1px solid var(--border-blue);
  padding: 20px;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.post {
  padding: 14px 0;
  border-bottom: 1px solid #e2e8f0;
}

.post:last-child {
  border-bottom: 0;
}

.post-title {
  font-weight: 800;
  margin-bottom: 6px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.category-box {
  background: white;
  border-radius: 20px;
  border: 1px solid var(--border-blue);
  padding: 20px;
}

.badge {
  display: inline-block;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--main-blue);
  color: white;
  font-weight: 700;
  margin: 6px 6px 0 0;
}

@media (max-width: 900px) {
  .home-grid {
    grid-template-columns: 1fr;
  }

  .category-grid {
    grid-template-columns: 1fr;
  }
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

<div class="container">
${body}
</div>

</body>
</html>
`;
}

function homePage() {
  return layout(
    "Paper_Talk",
    `
<h1>Paper_Talk</h1>

<p>
Research paper, conference, community, and career platform
for cancer genomics and bioinformatics researchers.
</p>

<div class="home-grid">

  <div class="card">
    <h2>Latest Research Papers</h2>

    <div class="post">
      <div class="post-title">
        TFvelo: gene regulation inspired RNA velocity estimation
      </div>
      <div>Nature Communications · 2024</div>
    </div>

    <div class="post">
      <div class="post-title">
        Spatial transcriptomics in oncology
      </div>
      <div>Genome Biology · 2025</div>
    </div>
  </div>

  <div class="card">
    <h2>Conference Notices</h2>

    <div class="post">
      <div class="post-title">
        AACR 2026 Abstract Submission
      </div>
      <div>Deadline: July 2026</div>
    </div>

    <div class="post">
      <div class="post-title">
        ASCO 2026 Travel Grant
      </div>
      <div>Application Open</div>
    </div>
  </div>

  <div class="card">
    <h2>LinkedIn Profiles</h2>

    <div class="post">
      <div class="post-title">
        Cancer Multi-omics Researcher
      </div>
      <div>LinkedIn Promotion</div>
    </div>

    <div class="post">
      <div class="post-title">
        Single-cell AI Scientist
      </div>
      <div>Machine Learning & Oncology</div>
    </div>
  </div>

</div>
`
  );
}

function researchPage() {
  return layout(
    "Research",
    `
<h1>Research Paper</h1>

<div class="card">
  <h2>All Research Papers</h2>

  <div class="post">
    <div class="post-title">
      TFvelo: gene regulation inspired RNA velocity estimation
    </div>
    <div>Nature Communications · 2024</div>
  </div>

  <div class="post">
    <div class="post-title">
      Multi-omics precision oncology
    </div>
    <div>Cell · 2025</div>
  </div>

  <div style="margin-top:20px;">
    <span class="badge">1</span>
    <span class="badge">2</span>
    <span class="badge">3</span>
  </div>
</div>
`
  );
}

function studyPage() {
  return layout(
    "Study",
    `
<h1>Study Materials</h1>

<div class="category-grid">

  <div class="category-box">
    <h2>Study</h2>
    <p>Personal study notes and materials.</p>
  </div>

  <div class="category-box">
    <h2>Methodology</h2>
    <p>Experimental methods and pipelines.</p>
  </div>

  <div class="category-box">
    <h2>Blog</h2>
    <p>Research blog and scientific writing.</p>
  </div>

</div>
`
  );
}

function communityPage() {
  return layout(
    "Community",
    `
<h1>Community</h1>

<div class="category-grid">

  <div class="category-box">
    <h2>Question / Discussion</h2>
    <p>Research discussion and Q&A.</p>
  </div>

  <div class="category-box">
    <h2>Conference Notices</h2>
    <p>Conference announcements and deadlines.</p>
  </div>

</div>
`
  );
}

function careerPage() {
  return layout(
    "Career",
    `
<h1>Career</h1>

<div class="category-grid">

  <div class="category-box">
    <h2>LinkedIn Promotion</h2>
    <p>Researchers can promote their LinkedIn profiles.</p>
  </div>

  <div class="category-box">
    <h2>Job Postings</h2>
    <p>Labs and companies can post hiring opportunities.</p>
  </div>

</div>
`
  );
}
```
