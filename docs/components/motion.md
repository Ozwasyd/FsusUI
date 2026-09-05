# Motion

Motion is FsusUI's semantic motion layer. Product pages select a preset instead
of writing low-level `transform`, `duration`, or GSAP parameters.

## Basic Usage

The full FsusUI install registers `v-motion` and `FsuTransition`.

```vue
<template>
  <article v-motion="'fade-up'">文章摘要</article>
</template>
```

The object form can override `duration`, `delay`, and `easing`, and supports
`once`.

```vue
<template>
  <section
    v-motion="{
      name: 'fade-up',
      duration: 220,
      delay: 80,
      once: true,
    }"
  >
    内容区块
  </section>
</template>
```

## Card

```vue
<template>
  <el-card v-motion="'fade-up'">
    <h3>评论审核</h3>
    <p>审核队列、风险信号和地区策略结果。</p>
  </el-card>
</template>
```

## Dialog

```vue
<template>
  <FsuTransition name="scale-fade">
    <el-dialog v-if="open" model-value title="确认操作">
      操作完成后不可恢复。
    </el-dialog>
  </FsuTransition>
</template>
```

## SSR / AOT Hydration

SSR and AOT pages already have their initial DOM before Vue owns the tree. Use
`suppress-appear-during-hydration` with `appear` when the first hydrated frame
must not replay entrance motion. Client-only views can omit the suppression prop
to keep normal `appear` behavior.

```vue
<template>
  <FsuTransition name="mobile-bar" appear suppress-appear-during-hydration>
    <nav>...</nav>
  </FsuTransition>
</template>
```

For an ownership transfer where an existing SSR/AOT snapshot stays visible while
the client runtime takes ownership, use the named snapshot preset or helper. The
consumer owns the snapshot DOM and route intent; FsusUI only owns the transition
semantics.

```ts
import { runOwnershipTransferSnapshotMotion } from 'element-plus'

runOwnershipTransferSnapshotMotion(snapshotEl, {
  phase: 'leave',
  onFinish: () => snapshotEl.remove(),
})
```

```vue
<template>
  <FsuTransition
    name="ownership-transfer-snapshot"
    suppress-appear-during-hydration
  >
    <div v-if="snapshotVisible" inert aria-hidden="true" />
  </FsuTransition>
</template>
```

## Timeline

Use `useTimeline` to coordinate multiple elements. Add preset steps rather than
assembling GSAP timeline parameters in the product page.

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTimeline } from 'element-plus'

const titleRef = ref<HTMLElement>()
const summaryRef = ref<HTMLElement>()
const timeline = useTimeline()

onMounted(() => {
  timeline
    .add({ target: titleRef, preset: 'fade-up' })
    .add({ target: summaryRef, preset: 'fade-up', position: '-=0.08' })
    .play()
})
</script>
```

## Scroll Reveal

The full install registers `v-scroll-reveal`. FsusUI owns ScrollTrigger
registration, instance cleanup, and the reduced-motion terminal state.

```vue
<template>
  <section v-scroll-reveal="{ name: 'fade-up', once: true }">
    动态内容区块
  </section>
</template>
```

Composition API form:

```ts
import { onMounted, ref } from 'vue'
import { useScrollReveal } from 'element-plus'

const blockRef = ref<HTMLElement>()
const reveal = useScrollReveal({ target: blockRef, name: 'fade-up' })

onMounted(() => {
  reveal.reveal()
})
```

## Dropdown

```vue
<template>
  <FsuTransition name="fade-down">
    <div v-if="visible" class="menu-panel">
      <button>编辑</button>
      <button>归档</button>
    </div>
  </FsuTransition>
</template>
```

## List Stagger

```vue
<template>
  <ul>
    <li
      v-for="(item, index) in items"
      :key="item.id"
      v-motion="{ name: 'list-stagger', index }"
    >
      {{ item.title }}
    </li>
  </ul>
</template>
```

## GSAP Context

Wrap custom orchestration in `useGsapContext` and call `revert()` when the
component unmounts or the route changes.

```ts
import { onMounted, ref } from 'vue'
import { getGsap, useGsapContext } from 'element-plus'

const scope = ref<HTMLElement>()
const motion = useGsapContext(scope)

onMounted(() => {
  motion.create(() => {
    getGsap().set('.title', { opacity: 1 })
  })
})
```

## Route Cleanup

Add route-owned contexts, timelines, and scroll reveals to one cleanup bucket.
Clean up animation instances on route leave and refresh ScrollTrigger afterward.

```ts
import { onBeforeRouteLeave } from 'vue-router'
import {
  useGsapContext,
  useMotionRouteCleanup,
  useScrollReveal,
  useTimeline,
} from 'element-plus'

const routeMotion = useMotionRouteCleanup()
const context = useGsapContext()
const timeline = useTimeline()
const reveal = useScrollReveal()

routeMotion.add(context.revert)
routeMotion.add(timeline.kill)
routeMotion.add(reveal.kill)

onBeforeRouteLeave(() => {
  routeMotion.cleanup()
})
```

## Dynamic Content Refresh

When Markdown, images, comments, or other content changes height after the
initial render, wait for the content to settle and call
`refreshScrollTriggers()`. Consumers do not need to access
`ScrollTrigger.refresh()` directly.

```ts
import { nextTick } from 'vue'
import { refreshScrollTriggers } from 'element-plus'

await nextTick()
refreshScrollTriggers()
```

## Component Motion Prop

Key components share the `motion` prop convention: a preset name enables
semantic motion and `false` disables local motion. `ElConfigProvider` still
controls global reduced or disabled motion.

```vue
<template>
  <el-button motion="scale-fade">保存</el-button>
  <el-card motion="fade-up">评论审核</el-card>
  <el-dialog v-model="open" motion="scale-fade">确认操作</el-dialog>
  <el-drawer v-model="drawerOpen" motion="slide-right">筛选器</el-drawer>
  <el-dropdown motion="fade-down">
    <button>更多</button>
    <template #dropdown>...</template>
  </el-dropdown>
  <el-tooltip motion="fade-scale" content="查看详情">
    <button>?</button>
  </el-tooltip>
  <el-collapse motion="slide-up">...</el-collapse>
  <el-tabs motion="route-fade">...</el-tabs>
  <el-button :motion="false">无动效操作</el-button>
</template>
```

Message and Notification also accept `motion`:

```ts
ElMessage({ message: '已保存', motion: 'slide-up' })
ElNotification({ title: '完成', message: '同步结束', motion: false })
```

## Presets

Preset gallery:

| Preset         | Use | Recommended surfaces |
| -------------- | --- | -------------------- |
| `fade-in`      | Quietly fades static content in. | Low-density notes and secondary regions |
| `fade-up`      | Enters a content block. | Article cards, search results, settings sections |
| `fade-down`    | Enters a top or trigger-adjacent surface. | Dropdowns, menus, filter panels |
| `fade-left`    | Enters supporting content from the right. | Right summaries and detail previews |
| `fade-right`   | Enters supporting content from the left. | Side navigation and notes |
| `scale-fade`   | Enters a centered surface. | Dialog, Popconfirm, empty-state illustration |
| `slide-left`   | Enters a panel from the right. | Right Drawer and mobile action panels |
| `slide-right`  | Enters a panel from the left. | Left Drawer and navigation rail |
| `slide-up`     | Enters feedback from the bottom. | Message, Notification, bottom tool panels |
| `list-stagger` | Staggers a bounded list. | Navigation or card lists of at most 20 items |
| `route-fade`   | Switches route content. | Main content and article transitions |
| `card-hover`   | Provides light hover/press feedback. | Entry cards and interactive dashboard tiles |

## Motion Recipe

Recipe is the semantic layer above presets. Use a recipe when the business
surface knows why it moves, and let FsusUI choose the preset, fallback, and
budget.

```ts
import { motion, runMotionRecipe } from '@ozwasyd/element-plus'

motion.recipe('state-settled')
runMotionRecipe(el, { recipe: 'reading-anchor-highlight' })
```

```vue
<template>
  <FsuMotionRecipe name="article-list-enter" :index="index">
    <ArticleCard />
  </FsuMotionRecipe>
</template>
```

Initial recipes:

| Recipe                     | Intent                              | Default preset |
| -------------------------- | ----------------------------------- | -------------- |
| `content-enter`            | ordinary content enters quietly     | `fade-in`      |
| `article-list-enter`       | short article list reveal           | `list-stagger` |
| `island-enter`             | async island mount                  | `fade-up`      |
| `state-pending`            | in-progress operation state         | `fade-in`      |
| `state-settled`            | completed operation feedback        | `fade-in`      |
| `state-error`              | failed operation feedback           | `fade-in`      |
| `route-crossfade`          | route body switch                   | `route-fade`   |
| `reading-anchor-highlight` | anchor jump feedback in long-form   | `fade-in`      |
| `panel-enter`              | dialog, drawer, popover, menu enter | `scale-fade`   |
| `list-enter-small`         | bounded small list enter            | `list-stagger` |
| `card-interactive`         | clickable card hover/press          | `card-hover`   |

Avoid `fade-up` on article bodies and long-form reading content. Avoid
`list-stagger` for long lists; use it only for bounded groups, with the default
20-item cap. Prefer route-level and overlay-level recipes for content-heavy
pages. Content card hover displacement should stay at `0` or
`translateY(-1px)`.

## Scroll Timeline

`useScrollTimeline()` and `FsuScrollTimeline` provide natural scroll-linked
segments. They do not hide scrollbars, pin sections, snap the page, block
wheel/touch events, or enable scroll-jacking.

```ts
useScrollTimeline({
  target: sectionRef,
  segments: [
    { from: 0, to: 0.25, recipe: 'content-enter' },
    { from: 0.25, to: 0.5, recipe: 'reading-anchor-highlight' },
  ],
  reducedFallback: 'terminal',
})
```

Use scroll timelines for public-page spotlight reveals, short article lists,
TOC or anchor feedback, and async island mount. Do not enable narrative scroll
effects by default in admin screens or article bodies.

## Shared Element And FLIP

`useSharedElementMotion()`, `useFlipMotion()`, and `FsuSharedElement` cover the
first shared-transition layer for routes such as article card to article page,
thumbnail to lightbox, or list row to editor. The default implementation only
animates `transform` and `opacity`, respects reduced/disabled motion, and falls
back to terminal state when measurement fails.

## Same-document View Transitions

`runViewTransition()` is the stable, tree-shakeable progressive-enhancement
boundary exported by both `@ozwasyd/element-plus` and
`@ozwasyd/element-plus/motion`. Capability detection happens for every call;
importing the module never reads `window` or `document`.

```ts
import { runViewTransition } from '@ozwasyd/element-plus/motion'

const result = runViewTransition(() => commitRouteOrState(), {
  name: 'route-crossfade',
  signal: navigationSignal,
})

await result.updateDone // business update completion, not animation success
```

The result always has `mode`, `ready`, `updateDone`, `finished`, and `skip()`.
When the Web API is absent, throws synchronously, motion is reduced/disabled,
or the signal is already aborted, FsusUI calls the update once and returns the
same settled result shape in `fallback` mode. An update rejection remains
visible through `updateDone`; `finished` always settles so animation cleanup
cannot block business error handling. A new run skips the previous snapshot
transition. Aborting, hiding, unmounting, or route cleanup may call `skip()`;
none of those paths replay the update.

`state-settled` and `route-crossfade` recipes prefer the native backend when it
is usable:

```ts
runMotionRecipeUpdate(() => replaceLargeRegion(), 'state-settled')
runMotionRecipeUpdate(() => commitRoute(), 'route-crossfade')
```

Only one primary backend runs for an intent. Native snapshots and the existing
GSAP/CSS/FLIP runtime are never started together. Other recipes retain their
current terminal or runtime behavior.

For bounded shared elements, keep the existing identity API and move the DOM
update inside `run()`:

```ts
const shared = useSharedElementMotion({ backend: 'auto' })
shared.register(articleId, cardElement)
shared.run(articleId, () => mountArticleHero())
```

FsusUI normalizes the identity, rejects duplicate live owners, temporarily
sets `view-transition-name`, and restores the prior inline value after native
completion, skip, failure, or scope disposal. If native snapshots are not
usable, `run()` executes the update and then uses the existing FLIP path.
`backend: 'flip'` is available for deterministic consumer testing; consumers
should otherwise keep the default `auto` policy.

Hydration does not start a transition. The consumer decides when SSR/AOT
hydration is ready and only then calls the adapter. The server and client DOM
shape stays identical, ownership-transfer snapshots keep their current rules,
and no blocking script or CSP exception is required.

The demo is available at `?visual=view-transitions`. It covers ordinary state
replacement, route simulation, theme mode, shared element, unsupported API,
and hydration-safe guidance. FsusUI owns Web Platform compatibility, snapshot
style, interruption, cleanup, reduced motion, and backend choice. Applications
own route/data commits, business identity, loading/error/empty states, focus,
scroll, and the point at which hydration is ready. Do not scatter direct
`document.startViewTransition()` calls through an application.

Local browser verification uses `pnpm test:view-transitions`: Chromium,
Firefox, and WebKit run the same terminal-DOM, focus, scroll, ARIA, reduced,
disabled, capability-loss, interruption, and cleanup assertions. Chromium also
runs controlled CPU rates `1x`, `4x`, and `6x`; these are repeatable emulation
profiles, not claims about physical mobile devices. Failure artifacts retain
trace and screenshots. Real Android/iOS/GPU evidence is optional unless
a release makes a platform-specific performance claim.

## Motion Budget

The default budget is:

```ts
{
  maxStaggerItems: 20,
  maxAnimatedNodesPerViewport: 40,
  disableScrollEffectsBelowFps: 45,
  disableBlurOnLowPower: true,
  disableParallaxOnTouch: true,
  preferCssWhenPossible: true,
}
```

`list-stagger` delay is capped at `maxStaggerItems`. When too many nodes are
already animating, new motion falls back to the terminal state. Presets and
recipes should animate only `transform`, `opacity`, and budget-controlled
`filter`.

## Reduced Motion

When `ElConfigProvider` sets `motion.mode` to `reduced` or `disabled`, or the
system enables `prefers-reduced-motion: reduce`, `v-motion` and `FsuTransition`
skip translation/scale and land at the terminal state.

`useTimeline`, `useScrollReveal`, and `v-scroll-reveal` follow the same policy.
Product components must not create ScrollTrigger directly or scatter raw GSAP
calls through FsusBlog pages; add new scenarios through a Motion wrapper.

Disable motion globally:

```vue
<el-config-provider :motion="{ mode: 'disabled' }">
  <RouterView />
</el-config-provider>
```

Disable motion for one component:

```vue
<el-card :motion="false">文章目录</el-card>
```

## Selection Rules

Use CSS transitions for local hover, focus, active, tab-indicator, button-press,
and card-lift interactions. Animate only `opacity`, `transform`, `box-shadow`,
or color tokens.

Use Vue Transition for component enter/leave behavior such as Dialog, Drawer,
Dropdown, Tooltip, Message, and route content. Components select a
transition/preset; product pages do not write motion class names.

Use a GSAP timeline only for multi-element orchestration or sequences that need
pause, reverse, or restart. Product pages use `useTimeline()`, not
`gsap.timeline()`.

Use ScrollTrigger only for viewport-entry reveals. Product pages use
`v-scroll-reveal` or `useScrollReveal()`, not `ScrollTrigger.create()`.

## Performance Policy

- Prefer `transform` and `opacity`.
- Avoid animating `height`, `width`, `top`, `left`, `margin`, or `padding` in hot paths.
- Do not create one ScrollTrigger per item in a large list; use `list-stagger` or reveal the group container.
- Do not hijack scrolling or change the user's scroll inertia.
- Keep reading pages quiet: article bodies, code blocks, and TOCs allow only light reveal or route fade.
- Reduce blur, shadow, and long-distance movement on mobile; pass `motion={false}` when needed.
- Call `refreshScrollTriggers()` after dynamic Markdown, image, comment, or async-card content settles.

## Anti-Patterns

- Do not import `gsap` or `ScrollTrigger` directly in FsusBlog pages.
- Do not copy `transition-duration`, `cubic-bezier`, or motion distances into product CSS.
- Do not animate loading, button, or tag states in a way that changes layout occupancy.
- Do not bind `v-scroll-reveal` to every item in a large list.
- Do not hide accessible state changes with motion; disabled, loading, and selected states need a clear static state.

## FsusBlog Integration

Article list:

```vue
<article
  v-for="(post, index) in posts"
  :key="post.slug"
  v-motion="{ name: 'list-stagger', index }"
>
  <PostCard :post="post" />
</article>
```

Article body and dynamic Markdown:

```ts
import { nextTick, watch } from 'vue'
import { refreshScrollTriggers } from 'element-plus'

watch(markdownHtml, async () => {
  await nextTick()
  refreshScrollTriggers()
})
```

Management entry:

```vue
<el-card motion="card-hover">
  <h3>评论审核</h3>
  <p>审核队列、模型风险信号和地区策略结果。</p>
</el-card>
```

Route page:

```ts
import { onBeforeRouteLeave } from 'vue-router'
import { useMotionRouteCleanup, useScrollReveal } from 'element-plus'

const routeMotion = useMotionRouteCleanup()
const reveal = useScrollReveal()

routeMotion.add(reveal.kill)
onBeforeRouteLeave(routeMotion.cleanup)
```

## Semantic Settle Vocabulary

Prefer the semantic settle presets for new product work:

| Preset              | Intended surfaces                                               | Forbidden defaults                         |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `surface-settle`    | ordinary content, reading, list/table                           | none; this is the quiet default            |
| `paper-settle`      | ordinary panels and admin operation cards                       | reading body content                       |
| `route-settle`      | route and reading page changes, using a quiet opacity crossfade | local card or row state feedback           |
| `dialog-settle`     | dialog, popover, menu, centered overlay                         | ordinary content panels and reading bodies |
| `sheet-settle`      | drawer, bottom sheet, mobile sheet                              | article body and ordinary content panels   |
| `dock-settle`       | mobile dock and bottom action bar                               | article body and ordinary content panels   |
| `toast-receipt`     | toast and task completion receipts                              | route transitions                          |
| `banner-receipt`    | banner, inline status, operation summary                        | route transitions                          |
| `lightbox-focus`    | image preview and lightbox focus                                | ordinary content panels                    |
| `index-list-settle` | bounded index, table, navigation lists                          | reading body paragraphs                    |

Older generic presets remain available for compatibility, but
`motionPresetAliases` documents their migration target. New app code should map
semantic product names to the settle presets instead of adding local keyframes.

In browsers with Web Animations API support, the runtime keeps terminal states
as retained `fill: forwards` effects. It does not call `commitStyles()` or write
terminal values through `HTMLElement.style`, so consumers can enforce
`style-src-attr 'none'` without weakening CSP. The inline-transition fallback
is reserved for environments without WAAPI, such as legacy DOM test runtimes.

## Task And Row Feedback

Use `useTaskFeedback()` for save, publish, sync, import, export, rollback, and
audit flows. Apps provide business text; FsusUI owns phase classes, timers, and
live-region behavior.

```vue
<script setup lang="ts">
import { FsuTaskReceipt, useTaskFeedback } from '@ozwasyd/element-plus'

const feedback = useTaskFeedback({ clearDelay: 2400 })
</script>

<template>
  <FsuTaskReceipt
    :phase="feedback.phase.value"
    :message="feedback.message.value"
  />
</template>
```

Use `useRowStateMotion()` for row-level pending, confirm, partial, and error
markers. The exported classes are line or lock markers:
`fsu-motion-row-busy-line`, `fsu-motion-row-confirm-line`,
`fsu-motion-row-error-lock`, `fsu-motion-summary-receipt`, and
`fsu-motion-task-receipt`. For large bulk operations, update one
`FsuTaskReceipt` summary instead of animating every affected row.

## Reading And Technical Writing Presets

Reading pages should not animate article body paragraphs by default. Use
`.fsus-reading-surface` or `data-fsus-surface="reading"` on the owning surface;
all allowed presets then resolve to `filter: none`, zero glow/trail, and no
translate-based paragraph reveal. `route-settle` and anchor feedback remain
opacity-only. Reduced and disabled modes land immediately at the undisplaced
terminal state.

content-type presets only where a state becomes interactive or ready:

| Preset                       | Use for                                      |
| ---------------------------- | -------------------------------------------- |
| `reading-title-settle`       | article title and metadata settle            |
| `media-develop`              | image or diagram load reveal                 |
| `media-focus`                | image affordance without default hover scale |
| `code-ready`                 | code toolbar/copy-control readiness          |
| `grid-settle`                | markdown table or compact grid readiness     |
| `quote-line`                 | quote or aside accent line                   |
| `toc-anchor`                 | active table-of-contents state               |
| `anchor-mark`                | hash-target highlight                        |
| `reading-progress-transform` | progress bar transform only                  |
| `copy-confirm`               | accessible copy confirmation                 |

```vue
<template>
  <h1 v-motion="'reading-title-settle'">{{ title }}</h1>
  <img v-scroll-reveal="'media-develop'" :src="cover" alt="" />
  <pre v-motion="'code-ready'"><code>{{ source }}</code></pre>
  <a v-motion="'anchor-mark'" :href="hash">Section</a>
</template>
```

```ts
import { useScrollReveal } from '@ozwasyd/element-plus'

const reveal = useScrollReveal({ name: 'media-develop', once: true })
```

Code copy feedback should be attached to the copy button or toolbar with
`copy-confirm` and an `aria-live` receipt, not by moving the entire code block.

## Mobile And Overlay Motion

Use FsusUI primitives for mobile docks, bottom action bars, sheets, overlays,
dialogs, lightboxes, toast receipts, and banners. These primitives own motion,
safe-area, focus restore, and reduced-motion behavior; apps provide labels and
actions.

```vue
<template>
  <FsuMobileDock label="Article actions">
    <button>Like</button>
    <button>Share</button>
  </FsuMobileDock>

  <FsuBottomTabBar
    label="Primary navigation"
    :items="[
      { key: 'home', label: 'Home', href: '/' },
      { key: 'archive', label: 'Archive', href: '/archive' },
      { key: 'about', label: 'About', href: '/about' },
    ]"
    active-key="archive"
  />

  <FsuBottomActionBar label="Bulk edit actions">
    <button>Cancel</button>
    <button>Save</button>
  </FsuBottomActionBar>

  <FsuOverlayTransition>
    <div v-if="open" role="dialog" aria-modal="true">
      <FsuSheetTransition>
        <aside v-if="open">Filters</aside>
      </FsuSheetTransition>
    </div>
  </FsuOverlayTransition>

  <FsuToastReceipt tone="success" message="Published" />
</template>
```

Base dock and overlay components do not add default glass, blur, or large slide
distances. `FsuMobileDock` consumes the canonical
`var(--fsus-safe-area-inset-bottom)` token by default (never a direct
`env(safe-area-inset-*)` read), while `FsuOverlayTransition` restores focus to
the trigger after close. Document-level `viewport-fit=cover` remains a consumer
responsibility; see [`docs/theme/tokens.md`](../theme/tokens.md) and
[`docs/consumers/design-integration.md`](../consumers/design-integration.md).

## Motion Governance And Adoption Checks

Run the adoption check against a downstream semantic mapping file:

```bash
pnpm run check:motion-adoption
pnpm exec tsx scripts/check-motion-adoption.ts path/to/app-motion-map.json
```

Allowed downstream pattern:

```json
{
  "semantic": "article.media.load",
  "preset": "media-develop",
  "surface": "reading-surface",
  "effect": "preset"
}
```

Disallowed downstream patterns:

- app-local `@keyframes` for product motion
- app-local raw `gsap`, `ScrollTrigger`, or animation-engine imports
- local wrappers that reimplement motion instead of calling FsusUI presets
- scale defaults on ordinary content panels
- translate reveals on reading body content
- complex stagger for large ordinary lists
- loading sweep as the default reading-page loading pattern

Allowed exceptions must be explicit:

- hover scale is only for `media-preview-surface` or lightbox-style previews
- route transitions belong on `route-surface`, not individual rows or cards
- loading sweep can be requested for non-reading operational surfaces, but the
  reading default is `surface-settle`, `code-ready`, or a static receipt

Request a new preset by documenting the surface category, state meaning,
reduced-motion terminal state, forbidden surfaces, and a migration example.
Apps should first add semantic mappings to FsusUI presets; if the mapping cannot
express the interaction, open a preset request instead of adding local effects.

## QA Checklist

- Route leave calls cleanup for every context, timeline, and scroll reveal.
- Component unmount leaves no ScrollTrigger or un-killed timeline.
- `motion={false}` disables local motion on Button, Card, Dialog, Drawer, Dropdown,
  Tooltip, Message, Notification, Collapse, and Tabs.
- `ElConfigProvider motion.mode="reduced"` and system
  `prefers-reduced-motion: reduce` both land at the terminal visual state.
- Dynamic Markdown, image loads, and expanded comments call
  `refreshScrollTriggers()`.
- Desktop and mobile layouts have no text overlap, squeezed button wrapping,
  fixed-column bleed-through, or layout jumps.
