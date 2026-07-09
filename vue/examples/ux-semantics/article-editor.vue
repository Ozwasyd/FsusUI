<template>
  <main data-ux-page="article-editor" class="ux-example">
    <header data-ux-task-page-header>
      <nav aria-label="Breadcrumb">内容 / 草稿 / 编辑</nav>
      <h1>文章编辑器</h1>
      <p data-ux-page-description>
        编辑当前草稿，检查发布前状态，并选择保存草稿或发布文章。
      </p>
    </header>

    <section data-ux-context-bar>
      <strong>正在编辑：无标题草稿</strong>
      <span>作者：当前用户</span>
      <span>状态：草稿</span>
      <span>自动保存：30 秒前</span>
    </section>

    <section data-ux-async-action>
      <p data-ux-pending-state>正在保存草稿</p>
      <p data-ux-success-state>草稿已保存</p>
      <p data-ux-error-state>保存失败，请重试</p>
    </section>

    <footer data-ux-task-action-bar>
      <el-button type="primary" native-type="submit" data-ux-primary-action>
        保存草稿
      </el-button>
      <el-button>预览文章</el-button>
      <el-button>发布文章</el-button>
    </footer>
  </main>
</template>
