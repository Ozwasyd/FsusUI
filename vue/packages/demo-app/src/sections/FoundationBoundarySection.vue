<template>
  <main class="foundation-boundary" data-testid="foundation-boundary-fixture">
    <header class="foundation-boundary__intro">
      <p class="foundation-boundary__eyebrow">Foundation contract fixture</p>
      <p>Native, renderer-owned, and explicitly scoped content side by side.</p>
    </header>

    <section class="foundation-boundary__panel" data-testid="native-document">
      <h1 data-testid="native-h1">Native document heading</h1>
      <h2 data-testid="native-h2">Browser-owned subheading</h2>
      <ul data-testid="native-list">
        <li>Native marker remains visible</li>
        <li>Semantic list geometry remains browser-owned</li>
      </ul>
      <form data-testid="native-form">
        <label>
          Search notes
          <input name="query" value="foundation" />
        </label>
        <label>
          Sort order
          <select name="sort">
            <option>Newest first</option>
          </select>
        </label>
        <button type="button">Apply</button>
      </form>
    </section>

    <section class="foundation-boundary__panel" data-testid="svg-owners">
      <span data-testid="external-logo">
        <svg aria-label="External logo" role="img" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="8" fill="#7c3aed" />
          <path d="M16 32h32" stroke="#ffffff" stroke-width="6" />
        </svg>
      </span>
      <span data-testid="external-chart">
        <svg aria-label="External chart" role="img" viewBox="0 0 96 64">
          <path
            d="M8 52L32 30L54 42L88 10"
            fill="none"
            stroke="#059669"
            stroke-linecap="square"
            stroke-linejoin="bevel"
            stroke-width="7"
          />
        </svg>
      </span>
      <span class="third-party-icon" data-testid="third-party-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#dc2626" d="M12 2l10 20H2z" />
        </svg>
      </span>
      <span data-testid="fsus-linear-icon">
        <el-icon variant="linear">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 12h16"
              fill="none"
              stroke="currentColor"
              stroke-linecap="butt"
              stroke-linejoin="miter"
              stroke-width="3"
            />
          </svg>
        </el-icon>
      </span>
    </section>

    <section
      class="foundation-boundary__panel markdown-renderer"
      data-testid="renderer-content"
    >
      <h1 data-testid="markdown-heading">Markdown heading</h1>
      <div class="markdown-renderer__latex katex" data-testid="katex-fixture">
        <svg viewBox="0 0 32 20" aria-label="Formula">
          <path fill="#111827" d="M2 2h28v16H2z" />
        </svg>
      </div>
      <div
        class="markdown-renderer__mermaid"
        data-testid="mermaid-fixture"
      >
        <svg viewBox="0 0 80 32" aria-label="Diagram">
          <path
            d="M4 16h72"
            fill="none"
            stroke="#2563eb"
            stroke-linecap="butt"
            stroke-width="5"
          />
        </svg>
      </div>
    </section>

    <article
      class="foundation-boundary__panel fsus-prose"
      data-testid="prose-fixture"
    >
      <h1 data-testid="prose-h1">Opted-in editorial heading</h1>
      <ul data-testid="prose-list">
        <li>Editorial marker is explicitly scoped</li>
      </ul>
    </article>
  </main>
</template>

<style scoped>
.foundation-boundary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px;
}

.foundation-boundary__intro {
  grid-column: 1 / -1;
}

.foundation-boundary__eyebrow {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

.foundation-boundary__panel {
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--el-border-color);
}

[data-testid='svg-owners'] {
  display: flex;
  gap: 24px;
  align-items: center;
}

[data-testid='svg-owners'] > span,
[data-testid='svg-owners'] > span > svg,
.third-party-icon,
.third-party-icon svg {
  width: 64px;
  height: 64px;
}

form {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 4px;
}

@media (max-width: 720px) {
  .foundation-boundary {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .foundation-boundary__intro {
    grid-column: auto;
  }
}
</style>
