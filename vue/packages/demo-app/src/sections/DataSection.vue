<template>
  <div id="data" class="demo-section" data-testid="section-data">
    <h2>Data</h2>
    <div class="demo-block">
      <h3>Table & TableColumn</h3>
      <fsus-table
        :data="tableData"
        border
        responsive="auto"
        responsive-details-label="显示此行全部字段"
        style="width: 100%"
      >
        <fsus-table-column type="selection" width="48" fixed />
        <fsus-table-column
          prop="name"
          label="标题"
          priority="primary"
          width="180"
        />
        <fsus-table-column
          prop="date"
          label="发布日期"
          priority="secondary"
          width="180"
        />
        <fsus-table-column prop="author" label="作者" priority="secondary" />
        <fsus-table-column prop="status" label="状态" priority="secondary" />
        <fsus-table-column prop="category" label="分类" priority="detail" />
        <fsus-table-column prop="views" label="阅读量" priority="detail" />
        <fsus-table-column prop="identifier" label="标识符" priority="detail" />
        <fsus-table-column prop="address" label="可见范围" priority="detail" />
        <fsus-table-column
          label="操作"
          priority="primary"
          width="80"
          fixed="right"
        >
          <template #default>
            <fsus-button text>打开</fsus-button>
          </template>
        </fsus-table-column>
      </fsus-table>
      <div
        class="demo-responsive-scroll-fixture"
        data-testid="table-scroll-fixture"
        style="width: 375px; max-width: 100%; margin-top: 16px"
      >
        <fsus-table
          :data="tableData.slice(0, 1)"
          responsive="scroll"
          scroll-aria-label="横向浏览文章字段"
        >
          <fsus-table-column prop="name" label="标题" width="220" />
          <fsus-table-column prop="identifier" label="标识符" width="360" />
          <fsus-table-column prop="address" label="可见范围" width="320" />
        </fsus-table>
      </div>
      <div
        v-if="showTableResponsiveMatrix"
        class="demo-table-responsive-matrix"
        data-testid="table-responsive-matrix"
      >
        <div
          v-for="fixture in tableResponsiveFixtures"
          :key="fixture.columnCount"
          :data-testid="`table-matrix-${fixture.columnCount}`"
        >
          <fsus-table
            :data="[fixture.row]"
            border
            responsive="auto"
            responsive-details-label="显示此行全部字段"
          >
            <fsus-table-column type="selection" width="48" fixed />
            <fsus-table-column
              v-for="column in fixture.columns"
              :key="column.prop"
              :prop="column.prop"
              :label="column.label"
              :priority="column.priority"
              :width="column.width"
            />
            <fsus-table-column
              class-name="matrix-operation-column"
              label="操作"
              priority="primary"
              width="80"
              fixed="right"
            >
              <template #default>
                <fsus-button text>打开</fsus-button>
              </template>
            </fsus-table-column>
          </fsus-table>
        </div>
        <div data-testid="table-matrix-empty">
          <fsus-table :data="[]" empty-text="暂无可展示的数据" responsive="auto">
            <fsus-table-column prop="title" label="标题" priority="primary" />
            <fsus-table-column prop="status" label="状态" priority="secondary" />
            <fsus-table-column prop="owner" label="负责人" priority="detail" />
          </fsus-table>
        </div>
        <div
          v-for="mode in ['auto', 'priority'] as const"
          :key="mode"
          :data-testid="`table-matrix-compact-${mode}`"
          style="max-width: 343px"
        >
          <fsus-table :data="compactTableRows" row-key="id" :responsive="mode">
            <fsus-table-column prop="title" label="Title" min-width="240" />
            <fsus-table-column prop="actions" label="Actions" min-width="180" />
          </fsus-table>
        </div>
        <div
          data-testid="table-matrix-resize-overflow"
          style="width: 650px; max-width: 100%"
        >
          <fsus-table :data="compactTableRows" row-key="id" responsive="auto">
            <fsus-table-column prop="title" label="Title" min-width="240" />
            <fsus-table-column prop="actions" label="Actions" min-width="480" />
          </fsus-table>
        </div>
        <div data-testid="table-matrix-scroll">
          <fsus-table
            :data="[tableResponsiveFixtures[2].row]"
            responsive="scroll"
            scroll-aria-label="横向浏览十五列数据"
          >
            <fsus-table-column
              v-for="column in tableResponsiveFixtures[2].columns"
              :key="column.prop"
              :prop="column.prop"
              :label="column.label"
              :width="column.width"
            />
          </fsus-table>
        </div>
      </div>
    </div>
    <div class="demo-block">
      <h3>TableV2 & AutoResizer</h3>
      <div class="demo-table-container">
        <fsus-auto-resizer>
          <template #default="{ height, width }">
            <fsus-table
              :columns="tableV2Columns"
              :data="tableV2Data"
              :width="width"
              :height="height"
            />
          </template>
        </fsus-auto-resizer>
      </div>
    </div>
    <div class="demo-block">
      <h3>Tag / CheckTag</h3>
      <fsus-space wrap>
        <fsus-tag>文章</fsus-tag>
        <fsus-tag tone="success">已发布</fsus-tag>
        <fsus-tag tone="info">技术笔记</fsus-tag>
        <fsus-tag tone="warning">待复核</fsus-tag>
        <fsus-tag tone="danger">高风险</fsus-tag>
        <fsus-check-tag v-model:checked="checkTag">
          已同步
        </fsus-check-tag>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Progress</h3>
      <fsus-space direction="vertical" style="width: 100%">
        <fsus-progress :percentage="50" />
        <fsus-progress :percentage="100" status="success" />
        <fsus-progress :percentage="80" status="exception" />
        <fsus-progress type="circle" :percentage="25" />
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Tree</h3>
      <fsus-tree :data="treeData" show-checkbox />
    </div>
    <div class="demo-block">
      <h3>TreeV2</h3>
      <div style="height: 200px" data-testid="tree-v2-container">
        <fsus-tree :data="treeDataV2" :height="200" :item-size="44" />
      </div>
    </div>
    <div class="demo-block">
      <h3>Pagination</h3>
      <fsus-pagination
        background
        layout="prev, pager, next, jumper, total"
        responsive="auto"
        :ariaLabel="'文章分页'"
        :default-current-page="5"
        :total="1000"
      />
    </div>
    <div class="demo-block">
      <h3>Badge</h3>
      <fsus-space :size="30">
        <fsus-badge :value="12"><fsus-button>Comments</fsus-button></fsus-badge>
        <fsus-badge :value="3" is-dot>
          <fsus-button :icon="Share" type="primary">
            <span class="fsus-sr-only">Share article</span>
          </fsus-button>
        </fsus-badge>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Avatar</h3>
      <fsus-space wrap>
        <fsus-avatar :size="50" :src="circleUrl" />
        <fsus-avatar shape="square" :size="50" :src="squareUrl" />
        <fsus-avatar> User </fsus-avatar>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Skeleton & SkeletonItem</h3>
      <fsus-skeleton style="width: 240px" animated>
        <template #template>
          <fsus-skeleton-item
            variant="image"
            style="width: 240px; height: 240px"
          />
          <div style="padding: 14px">
            <fsus-skeleton-item variant="p" style="width: 50%" />
            <div class="demo-skeleton-row">
              <fsus-skeleton-item variant="text" style="margin-right: 16px" />
              <fsus-skeleton-item variant="text" style="width: 30%" />
            </div>
          </div>
        </template>
      </fsus-skeleton>
    </div>
    <div class="demo-block">
      <h3>Empty</h3>
      <fsus-empty-state description="暂无文章" />
    </div>
    <div class="demo-block">
      <h3>Descriptions & DescriptionsItem</h3>
      <fsus-descriptions title="用户资料" border responsive="auto">
        <fsus-descriptions-item label="笔名"> 青砚 </fsus-descriptions-item>
        <fsus-descriptions-item label="联系电话">
          18100000000
        </fsus-descriptions-item>
        <fsus-descriptions-item label="所在地"> 苏州 </fsus-descriptions-item>
        <fsus-descriptions-item label="标签">
          <fsus-tag size="small">写作</fsus-tag>
        </fsus-descriptions-item>
        <fsus-descriptions-item label="地址">
          江苏省苏州市吴中区吴中大道 1188 号
        </fsus-descriptions-item>
        <fsus-descriptions-item label="主页" :span="2">
          https://example.com/authors/青砚/research-notes-and-publications
        </fsus-descriptions-item>
        <fsus-descriptions-item label="备注"></fsus-descriptions-item>
      </fsus-descriptions>
    </div>
    <div
      class="demo-block"
      data-testid="descriptions-spacing-fixtures"
      data-descriptions-spacing-fixtures
    >
      <h3>Descriptions spacing matrix</h3>
      <fsus-space direction="vertical" :size="16" fill style="width: 100%">
        <fsus-descriptions
          border
          :column="2"
          size="large"
          data-descriptions-case="bordered-large"
          title="bordered large"
        >
          <fsus-descriptions-item label="笔名">青砚</fsus-descriptions-item>
          <fsus-descriptions-item label="所在地">苏州</fsus-descriptions-item>
          <fsus-descriptions-item label="主页" :span="2">
            https://example.com/authors/qingyan
          </fsus-descriptions-item>
        </fsus-descriptions>
        <fsus-descriptions
          border
          :column="2"
          data-descriptions-case="bordered-default"
          title="bordered default"
        >
          <fsus-descriptions-item label="笔名">青砚</fsus-descriptions-item>
          <fsus-descriptions-item label="所在地">苏州</fsus-descriptions-item>
          <fsus-descriptions-item label="地址" :span="2">
            江苏省苏州市吴中区吴中大道 1188 号
          </fsus-descriptions-item>
        </fsus-descriptions>
        <fsus-descriptions
          border
          :column="2"
          size="small"
          data-descriptions-case="bordered-small"
          title="bordered small"
        >
          <fsus-descriptions-item label="笔名">青砚</fsus-descriptions-item>
          <fsus-descriptions-item label="所在地">苏州</fsus-descriptions-item>
        </fsus-descriptions>
        <fsus-descriptions
          :column="2"
          data-descriptions-case="non-bordered-default"
          title="non-bordered default"
        >
          <fsus-descriptions-item label="笔名">青砚</fsus-descriptions-item>
          <fsus-descriptions-item label="所在地">苏州</fsus-descriptions-item>
        </fsus-descriptions>
        <fsus-descriptions
          border
          :column="2"
          direction="vertical"
          data-descriptions-case="bordered-vertical"
          title="bordered vertical"
        >
          <fsus-descriptions-item label="笔名">青砚</fsus-descriptions-item>
          <fsus-descriptions-item label="备注">
            长备注：研究笔记、出版记录与公开主页摘要。
          </fsus-descriptions-item>
        </fsus-descriptions>
        <fsus-descriptions
          border
          :column="2"
          responsive="stack"
          data-descriptions-case="responsive-stack"
          title="responsive stack"
        >
          <fsus-descriptions-item label="笔名">青砚</fsus-descriptions-item>
          <fsus-descriptions-item label="所在地">苏州</fsus-descriptions-item>
        </fsus-descriptions>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Result</h3>
      <fsus-result icon="success" title="已发布" sub-title="读者将看到最新版本">
        <template #extra>
          <fsus-button type="primary">返回文章列表</fsus-button>
        </template>
      </fsus-result>
    </div>
    <div class="demo-block">
      <h3>Statistic / Countdown</h3>
      <fsus-row>
        <fsus-col :span="12">
          <fsus-statistic title="今日活跃读者" :value="268500" />
        </fsus-col>
        <fsus-col :span="12">
          <fsus-countdown title="距定时发布" :value="countdownValue" />
        </fsus-col>
      </fsus-row>
    </div>
    <div class="demo-block">
      <h3>Timeline & TimelineItem</h3>
      <fsus-timeline>
        <fsus-timeline-item timestamp="2018/4/12" placement="top">
          更新封面图
        </fsus-timeline-item>
        <fsus-timeline-item timestamp="2018/4/3" placement="top">
          校对摘要
        </fsus-timeline-item>
      </fsus-timeline>
    </div>
    <div class="demo-block">
      <h3>Calendar</h3>
      <fsus-calendar v-model="date" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Share, useDemoState } from '../demo-state'

const showTableResponsiveMatrix = new URLSearchParams(
  window.location.search,
).has('tableMatrix')

const compactTableRows = [{ id: 1, title: 'Title', actions: 'Action detail' }]

const createTableResponsiveFixture = (columnCount: 3 | 8 | 15) => {
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    label:
      index === columnCount - 1
        ? '超长中文表头用于验证窄屏字段披露'
        : `字段 ${index + 1}`,
    priority:
      index === 0
        ? ('primary' as const)
        : index < 3
          ? ('secondary' as const)
          : ('detail' as const),
    prop: `field${index + 1}`,
    width: index === columnCount - 1 ? 300 : 140,
  }))
  const row = Object.fromEntries(
    columns.map((column, index) => [
      column.prop,
      index === 1
        ? 'latin-value-with-a-deliberately-long-unbroken-identifier'
        : index === columnCount - 1
          ? '超长中文字段值用于确认移动端不会静默丢失任何业务信息'
          : `value-${index + 1}`,
    ]),
  )
  return { columnCount, columns, row }
}

const tableResponsiveFixtures = ([3, 8, 15] as const).map(
  createTableResponsiveFixture,
)

const {
  checkTag,
  circleUrl,
  countdownValue,
  date,
  squareUrl,
  tableData,
  tableV2Columns,
  tableV2Data,
  treeData,
  treeDataV2,
} = useDemoState()
</script>
