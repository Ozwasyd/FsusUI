<template>
  <div
    ref="node$"
    :class="[
      ns.b('node'),
      ns.is('expanded', expanded),
      ns.is('current', current),
      ns.is('focusable', !disabled),
      ns.is('checked', !disabled && checked),
    ]"
    role="treeitem"
    tabindex="-1"
    :aria-expanded="expanded"
    :aria-disabled="disabled"
    :aria-checked="checked"
    v-bind="nodeAttrs"
    @click.stop="handleClick"
    @contextmenu="handleContextMenu"
  >
    <div
      :class="ns.be('node', 'content')"
      :style="{
        paddingLeft: `${(node.level - 1) * indent}px`,
        height: itemSize + 'px',
      }"
    >
      <el-icon
        v-if="icon"
        :class="[
          ns.is('leaf', !!node?.isLeaf),
          ns.is('hidden', hiddenExpandIcon),
          {
            expanded: !node?.isLeaf && expanded,
          },
          ns.be('node', 'expand-icon'),
        ]"
        v-bind="expandIconAttrs"
      >
        <component :is="icon" />
      </el-icon>
      <el-checkbox
        v-if="showCheckbox"
        :model-value="checked"
        :indeterminate="indeterminate"
        :disabled="disabled"
        v-bind="checkboxAttrs"
      />
      <el-node-content :node="node" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue'
import ElIcon from '@element-plus/components/icon'
import { CaretRight } from '@element-plus/icons-vue'
import ElCheckbox from '@element-plus/components/checkbox'
import { useNamespace } from '@element-plus/hooks'
import ElNodeContent from './tree-node-content'
import {
  NODE_CONTEXTMENU,
  ROOT_TREE_INJECTION_KEY,
  treeNodeEmits,
  treeNodeProps,
} from './virtual-tree'

defineOptions({
  name: 'ElTreeNode',
})

const props = defineProps(treeNodeProps)
const emit = defineEmits(treeNodeEmits)

const tree = inject(ROOT_TREE_INJECTION_KEY)
const ns = useNamespace('tree')

const indent = computed(() => {
  return tree?.props.indent ?? 16
})

const icon = computed(() => {
  return tree?.props.icon ?? CaretRight
})

const nodeAttrs = computed<Record<string, unknown>>(() => ({
  'data-key': props.node?.key,
}))

const handleClick = (e: MouseEvent) => {
  emit('click', props.node, e)
}
const handleExpandIconClick = () => {
  emit('toggle', props.node)
}
const stopNodeClick = (event: MouseEvent) => {
  event.stopPropagation()
}
const handleCheckboxClick = (event: MouseEvent) => {
  stopNodeClick(event)

  if (!props.disabled) {
    emit('check', props.node, !props.checked)
  }
}

const expandIconAttrs = {
  onClick: (event: MouseEvent) => {
    stopNodeClick(event)
    handleExpandIconClick()
  },
}

const checkboxAttrs = {
  onClick: handleCheckboxClick,
}

const handleContextMenu = (event: Event) => {
  if (tree?.instance?.vnode?.props?.['onNodeContextmenu']) {
    event.stopPropagation()
    event.preventDefault()
  }
  tree?.ctx.emit(NODE_CONTEXTMENU, event, props.node?.data, props.node)
}
</script>
