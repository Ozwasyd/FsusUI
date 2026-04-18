<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="brand">
        <span class="brand-text">{{ title }}</span>
      </div>
      <nav class="nav">
        <a href="#components" class="nav-link">Components</a>
        <a href="#design" class="nav-link">Design Language</a>
        <a href="https://github.com/fsus-ui/fsus-ui" target="_blank" class="nav-link">GitHub</a>
      </nav>
    </header>
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 48px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-logo {
  height: 32px;
}

.brand-text {
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.nav {
  display: flex;
  gap: 32px;
}

.nav-link {
  text-decoration: none;
  color: var(--el-text-color-regular);
  font-size: 14px;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: var(--el-color-primary);
}

.main-content {
  flex: 1;
  padding: 48px;
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
}
</style>
