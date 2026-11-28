<template>
  <div class="consumer-smoke-app">
    <FsusButton type="primary">FsusUI Consumer Smoke</FsusButton>
    <FsusMarkdownRenderer
      content="# Consumer Markdown&#10;&#10;This render path validates packaged WASM assets."
      mode="preview"
    />
    <FsusEmptyState
      title="EmptyState package export"
      description="This validates the packed component and global types."
      size="compact"
    />
  </div>
</template>

<style scoped>
.consumer-smoke-app {
  display: grid;
  gap: 24px;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
}
</style>
