<template>
  <div id="data" class="demo-section" data-testid="section-data">
    <h2>Data</h2>
    <div class="demo-block">
      <h3>Table & TableColumn</h3>
      <el-table
        :data="tableData"
        border
        responsive="auto"
        responsive-details-label="显示此行全部字段"
        style="width: 100%"
      >
        <el-table-column type="selection" width="48" fixed />
        <el-table-column
          prop="name"
          label="标题"
          priority="primary"
          width="180"
        />
        <el-table-column
          prop="date"
          label="发布日期"
          priority="secondary"
          width="180"
        />
        <el-table-column prop="author" label="作者" priority="secondary" />
        <el-table-column prop="status" label="状态" priority="secondary" />
        <el-table-column prop="category" label="分类" priority="detail" />
        <el-table-column prop="views" label="阅读量" priority="detail" />
        <el-table-column prop="identifier" label="标识符" priority="detail" />
        <el-table-column prop="address" label="可见范围" priority="detail" />
        <el-table-column
          label="操作"
          priority="primary"
          width="80"
          fixed="right"
        >
          <template #default>
            <el-button text>打开</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div
        class="demo-responsive-scroll-fixture"
        data-testid="table-scroll-fixture"
        style="width: 375px; max-width: 100%; margin-top: 16px"
      >
        <el-table
          :data="tableData.slice(0, 1)"
          responsive="scroll"
          scroll-aria-label="横向浏览文章字段"
        >
          <el-table-column prop="name" label="标题" width="220" />
          <el-table-column prop="identifier" label="标识符" width="360" />
          <el-table-column prop="address" label="可见范围" width="320" />
        </el-table>
      </div>
    </div>
    <div class="demo-block">
      <h3>TableV2 & AutoResizer</h3>
      <div class="demo-table-container">
        <el-auto-resizer>
          <template #default="{ height, width }">
            <el-table-v2
              :columns="tableV2Columns"
              :data="tableV2Data"
              :width="width"
              :height="height"
            />
          </template>
        </el-auto-resizer>
      </div>
    </div>
    <div class="demo-block">
      <h3>Tag / CheckTag</h3>
      <el-space wrap>
        <el-tag>文章</el-tag>
        <el-tag type="success">已发布</el-tag>
        <el-tag type="info">技术笔记</el-tag>
        <el-tag type="warning">待复核</el-tag>
        <el-tag type="danger">高风险</el-tag>
        <el-check-tag :checked="checkTag" @change="checkTag = !checkTag">
          已同步
        </el-check-tag>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Progress</h3>
      <el-space direction="vertical" style="width: 100%">
        <el-progress :percentage="50" />
        <el-progress :percentage="100" status="success" />
        <el-progress :percentage="80" status="exception" />
        <el-progress type="circle" :percentage="25" />
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Tree</h3>
      <el-tree :data="treeData" show-checkbox />
    </div>
    <div class="demo-block">
      <h3>TreeV2</h3>
      <div style="height: 200px" data-testid="tree-v2-container">
        <el-tree-v2 :data="treeDataV2" :height="200" :item-size="44" />
      </div>
    </div>
    <div class="demo-block">
      <h3>Pagination</h3>
      <el-pagination
        background
        layout="prev, pager, next, jumper, total"
        :total="1000"
      />
    </div>
    <div class="demo-block">
      <h3>Badge</h3>
      <el-space :size="30">
        <el-badge :value="12"><el-button>Comments</el-button></el-badge>
        <el-badge :value="3" is-dot>
          <el-button :icon="Share" type="primary">
            <el-visually-hidden>Share article</el-visually-hidden>
          </el-button>
        </el-badge>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Avatar</h3>
      <el-space wrap>
        <el-avatar :size="50" :src="circleUrl" />
        <el-avatar shape="square" :size="50" :src="squareUrl" />
        <el-avatar> User </el-avatar>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Skeleton & SkeletonItem</h3>
      <el-skeleton style="width: 240px" animated>
        <template #template>
          <el-skeleton-item
            variant="image"
            style="width: 240px; height: 240px"
          />
          <div style="padding: 14px">
            <el-skeleton-item variant="p" style="width: 50%" />
            <div class="demo-skeleton-row">
              <el-skeleton-item variant="text" style="margin-right: 16px" />
              <el-skeleton-item variant="text" style="width: 30%" />
            </div>
          </div>
        </template>
      </el-skeleton>
    </div>
    <div class="demo-block">
      <h3>Empty</h3>
      <el-empty description="暂无文章" />
    </div>
    <div class="demo-block">
      <h3>Descriptions & DescriptionsItem</h3>
      <el-descriptions title="用户资料" border responsive="auto">
        <el-descriptions-item label="笔名"> 青砚 </el-descriptions-item>
        <el-descriptions-item label="联系电话">
          18100000000
        </el-descriptions-item>
        <el-descriptions-item label="所在地"> 苏州 </el-descriptions-item>
        <el-descriptions-item label="标签">
          <el-tag size="small">写作</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="地址">
          江苏省苏州市吴中区吴中大道 1188 号
        </el-descriptions-item>
        <el-descriptions-item label="主页" :span="2">
          https://example.com/authors/青砚/research-notes-and-publications
        </el-descriptions-item>
        <el-descriptions-item label="备注"></el-descriptions-item>
      </el-descriptions>
    </div>
    <div class="demo-block">
      <h3>Result</h3>
      <el-result icon="success" title="已发布" sub-title="读者将看到最新版本">
        <template #extra>
          <el-button type="primary">返回文章列表</el-button>
        </template>
      </el-result>
    </div>
    <div class="demo-block">
      <h3>Statistic / Countdown</h3>
      <el-row>
        <el-col :span="12">
          <el-statistic title="今日活跃读者" :value="268500" />
        </el-col>
        <el-col :span="12">
          <el-countdown title="距定时发布" :value="countdownValue" />
        </el-col>
      </el-row>
    </div>
    <div class="demo-block">
      <h3>Timeline & TimelineItem</h3>
      <el-timeline>
        <el-timeline-item timestamp="2018/4/12" placement="top">
          更新封面图
        </el-timeline-item>
        <el-timeline-item timestamp="2018/4/3" placement="top">
          校对摘要
        </el-timeline-item>
      </el-timeline>
    </div>
    <div class="demo-block">
      <h3>Calendar</h3>
      <el-calendar v-model="date" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Share, useDemoState } from '../demo-state'

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
