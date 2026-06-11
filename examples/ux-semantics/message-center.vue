<template>
  <main data-ux-page="message-center" class="ux-example">
    <header data-ux-task-page-header>
      <h1>消息中心</h1>
      <p data-ux-page-description>
        查看当前会话和回复对象，处理需要继续跟进的消息。
      </p>
      <el-button type="primary" data-ux-primary-action>
        回复当前消息
      </el-button>
    </header>

    <section data-ux-context-bar>
      <strong>正在回复：账号申诉</strong>
      <span>用户：当前消息发送者</span>
      <span>状态：处理中</span>
    </section>

    <section data-ux-loading-threshold-ms="300" data-ux-loading-status>
      正在加载会话记录
    </section>

    <el-empty
      description="当前筛选条件下没有未读消息。"
      data-ux-empty-reason="筛选条件没有匹配未读消息"
      data-ux-empty-action="查看全部消息"
    >
      <el-button type="primary">查看全部消息</el-button>
    </el-empty>
  </main>
</template>
