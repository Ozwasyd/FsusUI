<template>
  <div id="data" class="demo-section" data-testid="section-data">
    <h2>Data</h2>
    <div class="demo-block">
      <h3>Table & TableColumn</h3>
      <el-table :data="tableData" border style="width: 100%">
        <el-table-column prop="date" label="Date" width="180" />
        <el-table-column prop="name" label="Name" width="180" />
        <el-table-column prop="address" label="Address" />
      </el-table>
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
          <el-button
            :icon="Share"
            type="primary"
          >
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
      <el-empty description="No Data" />
    </div>
    <div class="demo-block">
      <h3>Descriptions & DescriptionsItem</h3>
      <el-descriptions title="User Info" border>
        <el-descriptions-item label="Username">
          kooriookami
        </el-descriptions-item>
        <el-descriptions-item label="Telephone">
          18100000000
        </el-descriptions-item>
        <el-descriptions-item label="Place"> Suzhou </el-descriptions-item>
        <el-descriptions-item label="Remarks">
          <el-tag size="small">School</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Address">
          No.1188, Wuzhong Avenue, Wuzhong District, Suzhou, Jiangsu Province
        </el-descriptions-item>
      </el-descriptions>
    </div>
    <div class="demo-block">
      <h3>Result</h3>
      <el-result
        icon="success"
        title="Success Tip"
        sub-title="Please follow the instructions"
      >
        <template #extra><el-button type="primary">Back</el-button></template>
      </el-result>
    </div>
    <div class="demo-block">
      <h3>Statistic / Countdown</h3>
      <el-row>
        <el-col :span="12">
          <el-statistic title="Daily active users" :value="268500" />
        </el-col>
        <el-col :span="12">
          <el-countdown title="Countdown" :value="countdownValue" />
        </el-col>
      </el-row>
    </div>
    <div class="demo-block">
      <h3>Timeline & TimelineItem</h3>
      <el-timeline>
        <el-timeline-item timestamp="2018/4/12" placement="top">
          Update Github template
        </el-timeline-item>
        <el-timeline-item timestamp="2018/4/3" placement="top">
          Custom icon
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
