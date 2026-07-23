<template>
  <section
    class="pagination-matrix"
    data-testid="pagination-matrix"
    v-bind="matrixAttributes"
  >
    <article
      v-for="fixture in fixtures"
      :key="fixture.id"
      class="pagination-matrix__case"
      v-bind="fixture.attributes"
    >
      <h2 class="pagination-matrix__label">
        {{ fixture.label }}
      </h2>
      <el-pagination
        v-bind="fixture.pagination"
        background
        responsive="auto"
        :ariaLabel="fixture.ariaLabel"
        :default-current-page="Math.min(5, fixture.pageCount)"
        :layout="fixture.layout"
        @size-change="ignoreSizeChange"
      />
    </article>
  </section>
</template>

<script setup lang="ts">
const params = new URLSearchParams(window.location.search)
const locale = params.get('locale') === 'en-US' ? 'en-US' : 'zh-CN'
const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
const matrixAttributes: Record<string, string> = {
  'data-locale': locale,
  'data-theme': theme,
}
const pageCounts = [1, 5, 20, 1000] as const

const fixtures = pageCounts.flatMap((pageCount) =>
  Array.from({ length: 8 }, (_, mask) => {
    const hasTotal = (mask & 1) !== 0
    const hasSizes = (mask & 2) !== 0
    const hasJumper = (mask & 4) !== 0
    const information = [
      hasTotal ? 'total' : '',
      hasSizes ? 'sizes' : '',
      hasJumper ? 'jumper' : '',
    ].filter(Boolean)
    const id = `pages-${pageCount}-options-${mask}`

    return {
      ariaLabel:
        locale === 'zh-CN'
          ? `${pageCount} 页结果导航`
          : `${pageCount} page result navigation`,
      attributes: {
        'data-has-jumper': String(hasJumper),
        'data-has-sizes': String(hasSizes),
        'data-has-total': String(hasTotal),
        'data-page-count': String(pageCount),
        'data-pagination-case': id,
      } satisfies Record<string, string>,
      hasJumper,
      hasSizes,
      hasTotal,
      id,
      label:
        locale === 'zh-CN'
          ? `${pageCount} 页，选项 ${mask}`
          : `${pageCount} pages, options ${mask}`,
      layout: ['prev', 'pager', 'next', ...information].join(', '),
      pageCount,
      pagination: hasTotal ? { total: pageCount * 10 } : { pageCount },
    }
  }),
)

const ignoreSizeChange = (_size: number) => undefined
</script>

<style scoped>
.pagination-matrix {
  box-sizing: border-box;
  display: grid;
  gap: 16px;
  inline-size: 100%;
  padding: 16px;
}

.pagination-matrix__case {
  box-sizing: border-box;
  inline-size: 100%;
  min-inline-size: 0;
  padding-block-end: 8px;
}

.pagination-matrix__label {
  font-size: 12px;
  font-weight: 500;
  margin: 0 0 8px;
}
</style>
