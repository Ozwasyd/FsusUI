# 组件总览

FsusUI 提供 100+ 个 Vue 3 组件，涵盖基础、表单、数据展示、导航、反馈等各类场景。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看所有组件的交互效果。

---

## 基础组件

| 组件                               | 说明                                           |
| ---------------------------------- | ---------------------------------------------- |
| [Button 按钮](./button.md)         | 常用操作按钮，支持多种类型与状态               |
| [Icon 图标](./icon.md)             | 基于 `@element-plus/icons-vue` 的 SVG 图标系统 |
| [Link 链接](./link.md)             | 文字超链接，支持多种类型与下划线控制           |
| [Text 文本](./text.md)             | 语义化文本组件，支持截断与多行省略             |
| [Scrollbar 滚动条](./scrollbar.md) | 替代浏览器原生滚动条                           |
| [Space 间距](./space.md)           | 为相邻元素提供统一间距                         |
| [Layout 布局](./layout.md)         | 24 栅格响应式布局系统                          |
| [Divider 分割线](./divider.md)     | 区隔内容的分割线                               |
| [Motion 动效](./motion.md)         | 语义化动效 presets、指令和过渡组件             |

## 表单组件

| 组件                                        | 说明                             |
| ------------------------------------------- | -------------------------------- |
| [Input 输入框](./input.md)                  | 单行文本输入                     |
| [InputNumber 数字输入框](./input-number.md) | 仅允许输入标准数字值             |
| [Select 选择器](./select.md)                | 从选项中进行选择                 |
| [SelectV2 虚拟化选择器](./select-v2.md)     | 大数据量的高性能选择器           |
| [Radio 单选框](./radio.md)                  | 单选框                           |
| [Checkbox 多选框](./checkbox.md)            | 多选框                           |
| [Cascader 级联选择器](./cascader.md)        | 从一组相关联的数据集合中进行选择 |
| [Form 表单](./form.md)                      | 表单校验与提交                   |
| [DatePicker 日期选择器](./date-picker.md)   | 日期与日期范围选择               |
| [TimePicker 时间选择器](./time-picker.md)   | 时间任意滚动选择                 |
| [TimeSelect 时间选择](./time-select.md)     | 时间下拉选择                     |
| [Switch 开关](./switch.md)                  | 表示两种相互对立的状态           |
| [Slider 滑块](./slider.md)                  | 在一定范围内拖动选择             |
| [Upload 上传](./upload.md)                  | 将文件上传至服务器               |
| [Rate 评分](./rate.md)                      | 对事物进行评级操作               |
| [ColorPicker 颜色选择器](./color-picker.md) | 颜色选取工具                     |
| [Transfer 穿梭框](./transfer.md)            | 双栏穿梭选择                     |

## 数据展示

| 组件                                            | 说明                                       |
| ----------------------------------------------- | ------------------------------------------ |
| [Table 表格](./table.md)                        | 展示多条结构类似的数据，支持 WASM 加速排序 |
| [TableV2 虚拟化表格](./table-v2.md)             | 大数据量表格虚拟滚动                       |
| [VirtualList 虚拟列表](./virtual-list.md)       | 高性能虚拟滚动列表，支持 WASM 行高预估     |
| [Pagination 分页](./pagination.md)              | 数据量过多时分页展示                       |
| [Tree 树形控件](./tree.md)                      | 展示具有层级关系的数据                     |
| [TreeV2 虚拟树](./tree-v2.md)                   | 虚拟化树，适合大数据量                     |
| [TreeSelect 树形选择](./tree-select.md)         | 树形结构的下拉选择                         |
| [Autocomplete 自动补全](./autocomplete.md)      | 带推荐提示的文本输入框                     |
| [Avatar 头像](./avatar.md)                      | 用于展示用户或事物的头像                   |
| [Badge 徽章](./badge.md)                        | 出现在按钮、图标旁的数字或状态标记         |
| [Calendar 日历](./calendar.md)                  | 显示日期                                   |
| [Card 卡片](./card.md)                          | 将信息聚合在卡片容器中                     |
| [Carousel 走马灯](./carousel.md)                | 在有限空间内循环播放同类型内容             |
| [Collapse 折叠面板](./collapse.md)              | 通过折叠面板收纳内容                       |
| [Countdown 倒计时](./countdown.md)              | 展示倒计时数值                             |
| [Descriptions 描述列表](./descriptions.md)      | 以键值对的形式展示数据                     |
| [Empty 空状态](./empty.md)                      | 空状态占位                                 |
| [Image 图片](./image.md)                        | 图片懒加载、预览                           |
| [ImageViewer 图片预览](./image-viewer.md)       | 全屏图片预览、缩放、旋转与切换             |
| [InfiniteScroll 无限滚动](./infinite-scroll.md) | 滚动至底部触发加载                         |
| [Statistic 统计数值](./statistic.md)            | 展示统计数值                               |
| [Tag 标签](./tag.md)                            | 标记和分类                                 |
| [Timeline 时间线](./timeline.md)                | 可视化地展示时间流                         |
| [Watermark 水印](./watermark.md)                | 在页面上添加特定文字或图案                 |
| [Skeleton 骨架屏](./skeleton.md)                | 在需要等待加载内容的位置提供占位图形组合   |

## 导航

| 组件                                 | 说明                                     |
| ------------------------------------ | ---------------------------------------- |
| [Menu 导航菜单](./menu.md)           | 为页面和功能提供导航的菜单列表           |
| [Tabs 标签页](./tabs.md)             | 分隔内容上有关联但属于不同类别的数据集合 |
| [Breadcrumb 面包屑](./breadcrumb.md) | 显示当前页面的路径，快速返回             |
| [PageHeader 页头](./page-header.md)  | 如果页面的路径比较简单，推荐使用页头     |
| [Dropdown 下拉菜单](./dropdown.md)   | 将动作或菜单折叠到下拉菜单中             |
| [Steps 步骤条](./steps.md)           | 引导用户按照流程完成任务                 |
| [Affix 固钉](./affix.md)             | 将页面元素钉在可视范围                   |
| [Backtop 回到顶部](./backtop.md)     | 返回页面顶部的操作按钮                   |

## 反馈

| 组件                                     | 说明                                               |
| ---------------------------------------- | -------------------------------------------------- |
| [Alert 警告](./alert.md)                 | 用于页面中展示重要的提示信息                       |
| [Dialog 对话框](./dialog.md)             | 在保留当前页面状态的情况下，告知用户并承载相关操作 |
| [Drawer 抽屉](./drawer.md)               | 从边缘滑入的浮层面板                               |
| [Loading 加载](./loading.md)             | 加载数据时显示动效                                 |
| [Message 消息提示](./message.md)         | 常用于主动操作后的反馈提示                         |
| [MessageBox 消息弹框](./message-box.md)  | 模拟系统的消息提示框而实现的一套模态对话框组件     |
| [Notification 通知](./notification.md)   | 悬浮出现在页面角落，显示全局的通知提醒消息         |
| [Popover 气泡卡片](./popover.md)         | 弹出气泡式的卡片浮层                               |
| [Popconfirm 气泡确认框](./popconfirm.md) | 点击元素弹出气泡式的确认框                         |
| [Tooltip 文字提示](./tooltip.md)         | 常用于展示鼠标 hover 时的提示信息                  |
| [Progress 进度条](./progress.md)         | 展示操作进度                                       |
| [Result 结果](./result.md)               | 用于反馈一系列操作任务的处理结果                   |
| [PerceptionChallenge 感知挑战](./perception-challenge.md) | perception v2 challenge host 与三类 task 渲染 |

## 配置

| 组件                                            | 说明                                   |
| ----------------------------------------------- | -------------------------------------- |
| [ConfigProvider 全局配置](./config-provider.md) | 全局配置 FsusUI 的语言、尺寸与 z-index |
