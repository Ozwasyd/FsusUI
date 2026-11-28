<template>
  <div id="others" class="demo-section" data-testid="section-others">
    <h2>Others</h2>
    <div class="demo-block">
      <h3>Card</h3>
      <fsus-card class="box-card">
        <template #header>
          <div class="card-header">
            <span>最近编辑</span>
            <fsus-button class="button" text>查看历史</fsus-button>
          </div>
        </template>
        <div class="text item">草稿 · 发布于 3 分钟前</div>
        <div class="text item">如何设置同步成员权限</div>
        <div class="text item">发布前检查文章可见范围</div>
        <div class="text item">为文章添加封面与摘要</div>
        <div class="text item">定时发布前的校对清单</div>
      </fsus-card>
    </div>
    <div class="demo-block">
      <h3>Carousel & CarouselItem</h3>
      <fsus-carousel height="150px" :autoplay="false">
        <fsus-carousel-item v-for="item in 4" :key="item">
          <div class="demo-carousel-item"><h3>{{ item }}</h3></div>
        </fsus-carousel-item>
      </fsus-carousel>
    </div>
    <div class="demo-block">
      <h3>Collapse & CollapseItem</h3>
      <fsus-collapse v-model="activeCollapse">
        <fsus-collapse-item title="内容规则" name="1">
          <div>标题与摘要保持一致</div>
        </fsus-collapse-item>
        <fsus-collapse-item title="权限范围" name="2">
          <div>仅向所选成员开放</div>
        </fsus-collapse-item>
        <fsus-collapse-item title="发布流水" name="3">
          <div>记录每次发布与回退</div>
        </fsus-collapse-item>
      </fsus-collapse>
    </div>
    <div class="demo-block">
      <h3>CollapseTransition</h3>
      <fsus-button @click="showTransition = !showTransition">Toggle</fsus-button>
      <Transition name="fsus-fade">
        <div v-show="showTransition">
          <div class="demo-layout-box">Transition Content</div>
          <div class="demo-layout-box">More Content</div>
        </div>
      </Transition>
    </div>
    <div class="demo-block">
      <h3>Image & ImageViewer</h3>
      <fsus-space wrap>
        <fsus-image
          style="width: 100px; height: 100px"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          :preview-src-list="[squareUrl]"
        />
        <fsus-button @click="showImageViewer = true">Direct Viewer</fsus-button>
        <fsus-image-viewer
          v-if="showImageViewer"
          :url-list="[squareUrl]"
          @close="showImageViewer = false"
        />
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Virtual List (Fixed/Dynamic List/Grid)</h3>
      <fsus-space wrap>
        <div class="demo-virtual-fixture">
          <h4>FixedSizeList</h4>
          <fixed-size-list :item-size="50" :total="20" :width="250" :height="150">
            <template #default="{ index, style }">
              <div :style="style" class="demo-layout-box demo-virtual-cell">
                Row {{ index }}
              </div>
            </template>
          </fixed-size-list>
        </div>
        <div class="demo-virtual-fixture">
          <h4>DynamicSizeList</h4>
          <dynamic-size-list
            :estimated-item-size="50"
            :total="20"
            :width="250"
            :height="150"
            :item-size="() => 50"
          >
            <template #default="{ index, style }">
              <div :style="style" class="demo-layout-box demo-virtual-cell">
                Row {{ index }}
              </div>
            </template>
          </dynamic-size-list>
        </div>
        <div class="demo-virtual-fixture">
          <h4>FixedSizeGrid</h4>
          <fixed-size-grid
            :column-width="100"
            :total-column="20"
            :row-height="50"
            :total-row="20"
            :width="250"
            :height="150"
          >
            <template #default="{ columnIndex, rowIndex, style }">
              <div :style="style" class="demo-layout-box demo-virtual-cell">
                {{ rowIndex }},{{ columnIndex }}
              </div>
            </template>
          </fixed-size-grid>
        </div>
        <div class="demo-virtual-fixture">
          <h4>DynamicSizeGrid</h4>
          <dynamic-size-grid
            :column-width="() => 100"
            :total-column="20"
            :row-height="() => 50"
            :total-row="20"
            :width="250"
            :height="150"
            :estimated-column-width="100"
            :estimated-row-height="50"
          >
            <template #default="{ columnIndex, rowIndex, style }">
              <div :style="style" class="demo-layout-box demo-virtual-cell">
                {{ rowIndex }},{{ columnIndex }}
              </div>
            </template>
          </dynamic-size-grid>
        </div>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>InfiniteScroll (Plugin)</h3>
      <ul v-fsus-infinite-scroll="loadInfinite" class="infinite-list demo-infinite-list">
        <li
          v-for="item in infiniteCount"
          :key="item"
          class="demo-layout-box demo-infinite-item"
        >
          {{ item }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDemoState } from '../demo-state'

const {
  activeCollapse,
  infiniteCount,
  loadInfinite,
  showImageViewer,
  showTransition,
  squareUrl,
} = useDemoState()
</script>

<style scoped>
.box-card {
  width: min(100%, 480px);
}

.card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.card-header > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-header .button {
  justify-self: end;
  margin-left: 0;
  flex-shrink: 0;
}

@media (max-width: 360px) {
  .card-header {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .card-header .button {
    justify-self: start;
  }
}
</style>
