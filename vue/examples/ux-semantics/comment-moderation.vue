<template>
  <main data-ux-page="comment-moderation" class="ux-example">
    <header data-ux-task-page-header>
      <h1>评论审核</h1>
      <p data-ux-page-description>
        审核当前筛选条件下的评论，优先处理高风险和高置信建议。
      </p>
      <el-button type="primary" data-ux-primary-action>
        通过选中评论
      </el-button>
    </header>

    <section data-ux-filter-control>
      <label>状态：待审核</label>
      <label>地区：中国大陆</label>
      <label>关键词：spam</label>
    </section>
    <p data-ux-filter-summary>
      当前显示：状态=待审核，地区=中国大陆，关键词=spam，共 12 条结果
    </p>

    <section data-ux-recommendation-banner>
      <strong>建议：拒绝</strong>
      <p>置信度：high</p>
      <ul>
        <li>模型高置信</li>
        <li>地区策略命中</li>
      </ul>
      <el-button
        type="danger"
        data-ux-danger-action
        data-ux-confirmation="确认拒绝这条评论"
        data-ux-consequence="评论不会展示给其他用户，作者会看到审核未通过状态"
        data-ux-reversible="true"
        data-ux-notification="true"
        data-ux-audit="true"
      >
        拒绝评论
      </el-button>
      <el-button>查看详情</el-button>
    </section>

    <el-table data-ux-filterable-list :data="[]">
      <el-table-column prop="author" label="作者" />
      <el-table-column prop="comment" label="评论" />
      <el-table-column prop="risk" label="风险" />
    </el-table>
  </main>
</template>
