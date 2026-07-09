<template>
  <main data-ux-page="dashboard-today" class="ux-example">
    <header data-ux-task-page-header>
      <h1>Dashboard 今日待处理</h1>
      <p data-ux-page-description>
        汇总今日需要处理的审核、发布和消息任务，并显示推荐优先级。
      </p>
      <el-button type="primary" data-ux-primary-action>
        处理最高优先级
      </el-button>
    </header>

    <section data-ux-loading-threshold-ms="300">
      <el-skeleton :rows="3" animated />
    </section>

    <section data-ux-recommendation-banner>
      <strong>建议：先处理 5 条高风险评论</strong>
      <p>原因：等待时间最长，且模型置信度为 high。</p>
      <el-button type="primary">处理高风险评论</el-button>
      <el-button>查看全部待处理</el-button>
    </section>

    <p data-ux-filter-summary>当前显示：今天到期的待处理事项，共 10 项。</p>
    <ul data-ux-filterable-list>
      <li>评论审核：5 条</li>
      <li>草稿发布：2 篇</li>
      <li>消息回复：3 条</li>
    </ul>
  </main>
</template>
