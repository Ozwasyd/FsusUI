<template>
  <main data-ux-page="admin-navigation" class="ux-example">
    <header data-ux-task-page-header>
      <h1>管理导航分组</h1>
      <p data-ux-page-description>调整后台导航分组、显示状态和可见范围。</p>
      <el-button type="primary" data-ux-primary-action>
        更新导航分组
      </el-button>
    </header>

    <section data-ux-context-bar>
      <strong>正在编辑：内容管理分组</strong>
      <span>状态：已发布</span>
      <span>影响范围：后台管理员</span>
    </section>

    <section data-ux-action-preview-dialog>
      <h2>操作预演</h2>
      <p>将隐藏 1 个导航分组，并保留历史配置。该操作会写入审计日志。</p>
      <el-button
        type="danger"
        data-ux-danger-action
        data-ux-confirmation="确认隐藏该导航分组"
        data-ux-consequence="后台管理员暂时看不到该分组，但历史链接仍可恢复"
        data-ux-reversible="true"
        data-ux-notification="false"
        data-ux-audit="true"
      >
        隐藏导航分组
      </el-button>
      <el-button>取消预演</el-button>
    </section>
  </main>
</template>
