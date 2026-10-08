# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-app-dev.spec.ts >> default home mounts only the virtual window and navigates to sections
- Location: vue/tests/demo-app-dev/demo-app-dev.spec.ts:251:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "requestfailed: GET https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png net::ERR_CERT_AUTHORITY_INVALID",
+   "console.error: Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID",
+   "requestfailed: GET https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png net::ERR_CERT_AUTHORITY_INVALID",
+   "console.error: Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - heading "FsusUI 组件预览" [level=1] [ref=e5]
    - paragraph [ref=e6]: v2.2-STABLE
    - generic "Demo sections" [ref=e7]:
      - button "Basic" [ref=e8] [cursor=pointer]
      - button "Form" [ref=e9] [cursor=pointer]
      - button "Data" [active] [ref=e10] [cursor=pointer]
      - button "Navigation" [ref=e11] [cursor=pointer]
      - button "Feedback" [ref=e12] [cursor=pointer]
      - button "Others" [ref=e13] [cursor=pointer]
      - button "Icons" [ref=e14] [cursor=pointer]
      - 'button "Issue #1" [ref=e15] [cursor=pointer]'
      - button "Markdown Stress" [ref=e16] [cursor=pointer]
  - generic [ref=e19]:
    - heading "Data" [level=2] [ref=e20]
    - generic [ref=e21]:
      - heading "Table & TableColumn" [level=3] [ref=e22]
      - generic [ref=e24]:
        - table [ref=e26]:
          - rowgroup [ref=e38]:
            - row "标题 发布日期 作者 状态 分类 阅读量 标识符 可见范围 操作" [ref=e39]:
              - columnheader [ref=e40]:
                - generic [ref=e43] [cursor=pointer]:
                  - checkbox
              - columnheader "标题" [ref=e45]:
                - generic [ref=e46]: 标题
              - columnheader "发布日期" [ref=e47]:
                - generic [ref=e48]: 发布日期
              - columnheader "作者" [ref=e49]:
                - generic [ref=e50]: 作者
              - columnheader "状态" [ref=e51]:
                - generic [ref=e52]: 状态
              - columnheader "分类" [ref=e53]:
                - generic [ref=e54]: 分类
              - columnheader "阅读量" [ref=e55]:
                - generic [ref=e56]: 阅读量
              - columnheader "标识符" [ref=e57]:
                - generic [ref=e58]: 标识符
              - columnheader "可见范围" [ref=e59]:
                - generic [ref=e60]: 可见范围
              - columnheader "操作" [ref=e61]:
                - generic [ref=e62]: 操作
        - region "Scrollable data table" [ref=e63]:
          - table [ref=e67]:
            - rowgroup [ref=e79]:
              - row "Tom 2016-05-03 青砚 已发布 研究笔记 12840 research-note-2016-05-03-long-identifier No. 189, Grove St, Los Angeles 打开" [ref=e80]:
                - cell [ref=e81]:
                  - generic [ref=e84] [cursor=pointer]:
                    - checkbox
                - cell "Tom" [ref=e86]:
                  - generic [ref=e87]: Tom
                - cell "2016-05-03" [ref=e88]:
                  - generic [ref=e89]: 2016-05-03
                - cell "青砚" [ref=e90]:
                  - generic [ref=e91]: 青砚
                - cell "已发布" [ref=e92]:
                  - generic [ref=e93]: 已发布
                - cell "研究笔记" [ref=e94]:
                  - generic [ref=e95]: 研究笔记
                - cell "12840" [ref=e96]:
                  - generic [ref=e97]: "12840"
                - cell "research-note-2016-05-03-long-identifier" [ref=e98]:
                  - generic [ref=e99]: research-note-2016-05-03-long-identifier
                - cell "No. 189, Grove St, Los Angeles" [ref=e100]:
                  - generic [ref=e101]: No. 189, Grove St, Los Angeles
                - cell "打开" [ref=e102]:
                  - button "打开" [ref=e104] [cursor=pointer]:
                    - generic [ref=e105]: 打开
              - row "John 2016-05-02 Lin 草稿 随笔 320 draft-2016-05-02 No. 189, Grove St, Los Angeles 打开" [ref=e106]:
                - cell [ref=e107]:
                  - generic [ref=e110] [cursor=pointer]:
                    - checkbox
                - cell "John" [ref=e112]:
                  - generic [ref=e113]: John
                - cell "2016-05-02" [ref=e114]:
                  - generic [ref=e115]: 2016-05-02
                - cell "Lin" [ref=e116]:
                  - generic [ref=e117]: Lin
                - cell "草稿" [ref=e118]:
                  - generic [ref=e119]: 草稿
                - cell "随笔" [ref=e120]:
                  - generic [ref=e121]: 随笔
                - cell "320" [ref=e122]:
                  - generic [ref=e123]: "320"
                - cell "draft-2016-05-02" [ref=e124]:
                  - generic [ref=e125]: draft-2016-05-02
                - cell "No. 189, Grove St, Los Angeles" [ref=e126]:
                  - generic [ref=e127]: No. 189, Grove St, Los Angeles
                - cell "打开" [ref=e128]:
                  - button "打开" [ref=e130] [cursor=pointer]:
                    - generic [ref=e131]: 打开
      - generic [ref=e135]:
        - table [ref=e137]:
          - rowgroup [ref=e142]:
            - row "标题 标识符 可见范围" [ref=e143]:
              - columnheader "标题" [ref=e144]:
                - generic [ref=e145]: 标题
              - columnheader "标识符" [ref=e146]:
                - generic [ref=e147]: 标识符
              - columnheader "可见范围" [ref=e148]:
                - generic [ref=e149]: 可见范围
        - region "横向浏览文章字段" [ref=e150]:
          - table [ref=e154]:
            - rowgroup [ref=e159]:
              - row "Tom research-note-2016-05-03-long-identifier No. 189, Grove St, Los Angeles" [ref=e160]:
                - cell "Tom" [ref=e161]:
                  - generic [ref=e162]: Tom
                - cell "research-note-2016-05-03-long-identifier" [ref=e163]:
                  - generic [ref=e164]: research-note-2016-05-03-long-identifier
                - cell "No. 189, Grove St, Los Angeles" [ref=e165]:
                  - generic [ref=e166]: No. 189, Grove St, Los Angeles
    - generic [ref=e167]:
      - heading "TableV2 & AutoResizer" [level=3] [ref=e168]
      - table [ref=e172]:
        - rowgroup [ref=e173]:
          - generic [ref=e175]:
            - row "Tom-0 id-0" [ref=e176]:
              - cell "Tom-0" [ref=e177]:
                - generic "Tom-0" [ref=e178]
              - cell "id-0" [ref=e179]:
                - generic "id-0" [ref=e180]
            - row "Tom-1 id-1" [ref=e181]:
              - cell "Tom-1" [ref=e182]:
                - generic "Tom-1" [ref=e183]
              - cell "id-1" [ref=e184]:
                - generic "id-1" [ref=e185]
            - row "Tom-2 id-2" [ref=e186]:
              - cell "Tom-2" [ref=e187]:
                - generic "Tom-2" [ref=e188]
              - cell "id-2" [ref=e189]:
                - generic "id-2" [ref=e190]
            - row "Tom-3 id-3" [ref=e191]:
              - cell "Tom-3" [ref=e192]:
                - generic "Tom-3" [ref=e193]
              - cell "id-3" [ref=e194]:
                - generic "id-3" [ref=e195]
            - row "Tom-4 id-4" [ref=e196]:
              - cell "Tom-4" [ref=e197]:
                - generic "Tom-4" [ref=e198]
              - cell "id-4" [ref=e199]:
                - generic "id-4" [ref=e200]
            - row "Tom-5 id-5" [ref=e201]:
              - cell "Tom-5" [ref=e202]:
                - generic "Tom-5" [ref=e203]
              - cell "id-5" [ref=e204]:
                - generic "id-5" [ref=e205]
            - row "Tom-6 id-6" [ref=e206]:
              - cell "Tom-6" [ref=e207]:
                - generic "Tom-6" [ref=e208]
              - cell "id-6" [ref=e209]:
                - generic "id-6" [ref=e210]
        - rowgroup [ref=e212]:
          - row "Name ID" [ref=e214]:
            - columnheader "Name" [ref=e215]:
              - generic "Name" [ref=e216]
            - columnheader "ID" [ref=e217]:
              - generic "ID" [ref=e218]
    - generic [ref=e219]:
      - heading "Tag / CheckTag" [level=3] [ref=e220]
      - generic [ref=e221]:
        - generic [ref=e223]: 文章
        - generic [ref=e225]: 已发布
        - generic [ref=e227]: 技术笔记
        - generic [ref=e229]: 待复核
        - generic [ref=e231]: 高风险
        - checkbox "已同步" [checked] [ref=e233] [cursor=pointer]
    - generic [ref=e234]:
      - heading "Progress" [level=3] [ref=e235]
      - generic [ref=e236]:
        - progressbar [ref=e238]:
          - generic [ref=e239]: 50%
        - progressbar [ref=e241]:
          - img [ref=e244]
        - progressbar [ref=e248]:
          - img [ref=e251]
        - progressbar [ref=e255]:
          - img [ref=e257]
          - generic [ref=e260]: 25%
    - generic [ref=e261]:
      - heading "Tree" [level=3] [ref=e262]
      - tree [ref=e263]:
        - treeitem "Level one 1" [ref=e264]:
          - generic [ref=e265] [cursor=pointer]:
            - img [ref=e267]
            - generic [ref=e270]:
              - checkbox
            - generic [ref=e272]: Level one 1
    - generic [ref=e273]:
      - heading "TreeV2" [level=3] [ref=e274]
      - tree [ref=e276]:
        - generic [ref=e279]:
          - treeitem "Node 0" [ref=e280]:
            - generic [ref=e282] [cursor=pointer]: Node 0
          - treeitem "Node 1" [ref=e283]:
            - generic [ref=e285] [cursor=pointer]: Node 1
          - treeitem "Node 2" [ref=e286]:
            - generic [ref=e288] [cursor=pointer]: Node 2
          - treeitem "Node 3" [ref=e289]:
            - generic [ref=e291] [cursor=pointer]: Node 3
          - treeitem "Node 4" [ref=e292]:
            - generic [ref=e294] [cursor=pointer]: Node 4
          - treeitem "Node 5" [ref=e295]:
            - generic [ref=e297] [cursor=pointer]: Node 5
          - treeitem "Node 6" [ref=e298]:
            - generic [ref=e300] [cursor=pointer]: Node 6
    - generic [ref=e302]:
      - heading "Pagination" [level=3] [ref=e303]
      - generic [ref=e304]:
        - navigation "文章分页" [ref=e305]:
          - button "上一页" [ref=e306] [cursor=pointer]:
            - generic:
              - img
          - list [ref=e308]:
            - listitem "第 1 页" [ref=e309] [cursor=pointer]: "1"
            - listitem "向前 5 页" [ref=e310] [cursor=pointer]:
              - img
            - listitem "第 3 页" [ref=e311] [cursor=pointer]: "3"
            - listitem "第 4 页" [ref=e312] [cursor=pointer]: "4"
            - listitem "第 5 页" [ref=e313]: "5"
            - listitem "第 6 页" [ref=e314] [cursor=pointer]: "6"
            - listitem "第 7 页" [ref=e315] [cursor=pointer]: "7"
            - listitem "向后 5 页" [ref=e316] [cursor=pointer]:
              - img
            - listitem "第 100 页" [ref=e317] [cursor=pointer]: "100"
          - button "下一页" [ref=e318] [cursor=pointer]:
            - generic:
              - img
        - generic [ref=e319]:
          - generic [ref=e320]: 共 1000 条
          - generic [ref=e321]:
            - generic [ref=e322]: 前往
            - spinbutton "页" [ref=e325]: "5"
            - generic [ref=e326]: 页
    - generic [ref=e327]:
      - heading "Badge" [level=3] [ref=e328]
      - generic [ref=e329]:
        - generic [ref=e331]:
          - button "Comments" [ref=e332] [cursor=pointer]:
            - generic [ref=e333]: Comments
          - superscript [ref=e334]: "12"
        - generic [ref=e336]:
          - button "Share article" [ref=e337] [cursor=pointer]:
            - img [ref=e339]
            - generic [ref=e341]: Share article
          - superscript [ref=e342]
    - generic [ref=e343]:
      - heading "Avatar" [level=3] [ref=e344]
      - generic [ref=e351]: User
    - generic [ref=e352]:
      - heading "Skeleton & SkeletonItem" [level=3] [ref=e353]
      - img [ref=e356]
    - generic [ref=e363]:
      - heading "Empty" [level=3] [ref=e364]
      - generic [ref=e365]:
        - img [ref=e367]
        - generic [ref=e372]: 暂无文章
    - generic [ref=e373]:
      - heading "Descriptions & DescriptionsItem" [level=3] [ref=e374]
      - generic [ref=e375]:
        - generic [ref=e377]: 用户资料
        - table [ref=e380]:
          - rowgroup [ref=e381]:
            - row "笔名 青砚 联系电话 18100000000 所在地 苏州" [ref=e382]:
              - cell "笔名" [ref=e383]
              - cell "青砚" [ref=e384]
              - cell "联系电话" [ref=e385]
              - cell "18100000000" [ref=e386]
              - cell "所在地" [ref=e387]
              - cell "苏州" [ref=e388]
            - row "标签 写作 地址 江苏省苏州市吴中区吴中大道 1188 号 主页 https://example.com/authors/青砚/research-notes-and-publications" [ref=e389]:
              - cell "标签" [ref=e390]
              - cell "写作" [ref=e391]:
                - generic [ref=e392]: 写作
              - cell "地址" [ref=e393]
              - cell "江苏省苏州市吴中区吴中大道 1188 号" [ref=e394]
              - cell "主页" [ref=e395]
              - cell "https://example.com/authors/青砚/research-notes-and-publications" [ref=e396]
            - row "备注" [ref=e397]:
              - cell "备注" [ref=e398]
              - cell [ref=e399]
    - generic [ref=e400]:
      - heading "Descriptions spacing matrix" [level=3] [ref=e401]
      - generic [ref=e402]:
        - generic [ref=e404]:
          - generic [ref=e406]: bordered large
          - table [ref=e409]:
            - rowgroup [ref=e410]:
              - row "笔名 青砚 所在地 苏州" [ref=e411]:
                - cell "笔名" [ref=e412]
                - cell "青砚" [ref=e413]
                - cell "所在地" [ref=e414]
                - cell "苏州" [ref=e415]
              - row "主页 https://example.com/authors/qingyan" [ref=e416]:
                - cell "主页" [ref=e417]
                - cell "https://example.com/authors/qingyan" [ref=e418]
        - generic [ref=e420]:
          - generic [ref=e422]: bordered default
          - table [ref=e425]:
            - rowgroup [ref=e426]:
              - row "笔名 青砚 所在地 苏州" [ref=e427]:
                - cell "笔名" [ref=e428]
                - cell "青砚" [ref=e429]
                - cell "所在地" [ref=e430]
                - cell "苏州" [ref=e431]
              - row "地址 江苏省苏州市吴中区吴中大道 1188 号" [ref=e432]:
                - cell "地址" [ref=e433]
                - cell "江苏省苏州市吴中区吴中大道 1188 号" [ref=e434]
        - generic [ref=e436]:
          - generic [ref=e438]: bordered small
          - table [ref=e441]:
            - rowgroup [ref=e442]:
              - row "笔名 青砚 所在地 苏州" [ref=e443]:
                - cell "笔名" [ref=e444]
                - cell "青砚" [ref=e445]
                - cell "所在地" [ref=e446]
                - cell "苏州" [ref=e447]
        - generic [ref=e449]:
          - generic [ref=e451]: non-bordered default
          - table [ref=e454]:
            - rowgroup [ref=e455]:
              - row "笔名青砚 所在地苏州" [ref=e456]:
                - cell "笔名青砚" [ref=e457]
                - cell "所在地苏州" [ref=e458]
        - generic [ref=e460]:
          - generic [ref=e462]: bordered vertical
          - table [ref=e465]:
            - rowgroup [ref=e466]:
              - row "笔名 备注" [ref=e467]:
                - columnheader "笔名" [ref=e468]
                - columnheader "备注" [ref=e469]
              - row "青砚 长备注：研究笔记、出版记录与公开主页摘要。" [ref=e470]:
                - cell "青砚" [ref=e471]
                - cell "长备注：研究笔记、出版记录与公开主页摘要。" [ref=e472]
        - generic [ref=e474]:
          - generic [ref=e476]: responsive stack
          - generic "Description fields" [ref=e478]:
            - generic [ref=e479]:
              - term [ref=e480]: 笔名
              - definition [ref=e481]: 青砚
            - generic [ref=e482]:
              - term [ref=e483]: 所在地
              - definition [ref=e484]: 苏州
    - generic [ref=e485]:
      - heading "Result" [level=3] [ref=e486]
      - generic [ref=e487]:
        - img [ref=e489]
        - generic [ref=e491]: 已发布
        - generic [ref=e492]: 读者将看到最新版本
        - button "返回文章列表" [ref=e494] [cursor=pointer]:
          - generic [ref=e495]: 返回文章列表
    - generic [ref=e496]:
      - heading "Statistic / Countdown" [level=3] [ref=e497]
      - generic [ref=e498]:
        - generic [ref=e500]:
          - generic [ref=e501]: 今日活跃读者
          - generic [ref=e502]: 268,500
        - generic [ref=e504]:
          - generic [ref=e505]: 距定时发布
          - generic [ref=e506]: 47:59:55
    - generic [ref=e507]:
      - heading "Timeline & TimelineItem" [level=3] [ref=e508]
      - list [ref=e509]:
        - listitem [ref=e510]:
          - generic [ref=e513]:
            - generic [ref=e514]: 2018/4/12
            - generic [ref=e515]: 更新封面图
        - listitem [ref=e516]:
          - generic [ref=e518]:
            - generic [ref=e519]: 2018/4/3
            - generic [ref=e520]: 校对摘要
    - generic [ref=e521]:
      - heading "Calendar" [level=3] [ref=e522]
      - generic [ref=e523]:
        - generic [ref=e524]:
          - generic [ref=e525]: 2026年10月
          - generic [ref=e527]:
            - button "上个月" [ref=e528] [cursor=pointer]:
              - generic [ref=e530]: 上个月
            - button "今天" [ref=e531] [cursor=pointer]:
              - generic [ref=e532]: 今天
            - button "下个月" [ref=e533] [cursor=pointer]:
              - generic [ref=e535]: 下个月
        - table [ref=e537]:
          - rowgroup [ref=e538]:
            - columnheader "一" [ref=e539]
            - columnheader "二" [ref=e540]
            - columnheader "三" [ref=e541]
            - columnheader "四" [ref=e542]
            - columnheader "五" [ref=e543]
            - columnheader "六" [ref=e544]
            - columnheader "日" [ref=e545]
          - rowgroup [ref=e546]:
            - row "28 29 30 1 2 3 4" [ref=e547]:
              - cell "28" [ref=e548]:
                - generic [ref=e549]: "28"
              - cell "29" [ref=e550]:
                - generic [ref=e551]: "29"
              - cell "30" [ref=e552]:
                - generic [ref=e553]: "30"
              - cell "1" [ref=e554]:
                - generic [ref=e555]: "1"
              - cell "2" [ref=e556]:
                - generic [ref=e557]: "2"
              - cell "3" [ref=e558]:
                - generic [ref=e559]: "3"
              - cell "4" [ref=e560]:
                - generic [ref=e561]: "4"
            - row "5 6 7 8 9 10 11" [ref=e562]:
              - cell "5" [ref=e563]:
                - generic [ref=e564]: "5"
              - cell "6" [ref=e565]:
                - generic [ref=e566]: "6"
              - cell "7" [ref=e567]:
                - generic [ref=e568]: "7"
              - cell "8" [ref=e569]:
                - generic [ref=e570]: "8"
              - cell "9" [ref=e571]:
                - generic [ref=e572]: "9"
              - cell "10" [ref=e573]:
                - generic [ref=e574]: "10"
              - cell "11" [ref=e575]:
                - generic [ref=e576]: "11"
            - row "12 13 14 15 16 17 18" [ref=e577]:
              - cell "12" [ref=e578]:
                - generic [ref=e579]: "12"
              - cell "13" [ref=e580]:
                - generic [ref=e581]: "13"
              - cell "14" [ref=e582]:
                - generic [ref=e583]: "14"
              - cell "15" [ref=e584]:
                - generic [ref=e585]: "15"
              - cell "16" [ref=e586]:
                - generic [ref=e587]: "16"
              - cell "17" [ref=e588]:
                - generic [ref=e589]: "17"
              - cell "18" [ref=e590]:
                - generic [ref=e591]: "18"
            - row "19 20 21 22 23 24 25" [ref=e592]:
              - cell "19" [ref=e593]:
                - generic [ref=e594]: "19"
              - cell "20" [ref=e595]:
                - generic [ref=e596]: "20"
              - cell "21" [ref=e597]:
                - generic [ref=e598]: "21"
              - cell "22" [ref=e599]:
                - generic [ref=e600]: "22"
              - cell "23" [ref=e601]:
                - generic [ref=e602]: "23"
              - cell "24" [ref=e603]:
                - generic [ref=e604]: "24"
              - cell "25" [ref=e605]:
                - generic [ref=e606]: "25"
            - row "26 27 28 29 30 31 1" [ref=e607]:
              - cell "26" [ref=e608]:
                - generic [ref=e609]: "26"
              - cell "27" [ref=e610]:
                - generic [ref=e611]: "27"
              - cell "28" [ref=e612]:
                - generic [ref=e613]: "28"
              - cell "29" [ref=e614]:
                - generic [ref=e615]: "29"
              - cell "30" [ref=e616]:
                - generic [ref=e617]: "30"
              - cell "31" [ref=e618]:
                - generic [ref=e619]: "31"
              - cell "1" [ref=e620]:
                - generic [ref=e621]: "1"
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test'
  2   | import type { Page } from '@playwright/test'
  3   | import { attachPageDiagnostics } from '../support/page-diagnostics'
  4   | 
  5   | const diagnostics = new WeakMap<Page, string[]>()
  6   | 
  7   | const demoRoutes = [
  8   |   { name: 'home', path: '/?theme=light' },
  9   |   {
  10  |     name: 'basic',
  11  |     path: '/?visual=basic&theme=light',
  12  |     testId: 'section-basic',
  13  |   },
  14  |   { name: 'form', path: '/?visual=form&theme=light', testId: 'section-form' },
  15  |   { name: 'data', path: '/?visual=data&theme=light', testId: 'section-data' },
  16  |   {
  17  |     name: 'navigation',
  18  |     path: '/?visual=navigation&theme=light',
  19  |     testId: 'section-navigation',
  20  |     openDropdown: true,
  21  |   },
  22  |   {
  23  |     name: 'feedback',
  24  |     path: '/?visual=feedback&theme=light',
  25  |     testId: 'section-feedback',
  26  |   },
  27  |   {
  28  |     name: 'others',
  29  |     path: '/?visual=others&theme=light',
  30  |     testId: 'section-others',
  31  |   },
  32  |   {
  33  |     name: 'icons',
  34  |     path: '/?visual=icons&theme=light',
  35  |     testId: 'section-icons',
  36  |   },
  37  |   {
  38  |     name: 'markdown-stress',
  39  |     path: '/?visual=markdown-stress&theme=light',
  40  |     testId: 'section-markdown-stress',
  41  |   },
  42  | ] as const
  43  | 
  44  | test.beforeEach(async ({ page }) => {
  45  |   diagnostics.set(page, attachPageDiagnostics(page))
  46  |   await page.emulateMedia({ reducedMotion: 'reduce' })
  47  | })
  48  | 
  49  | test.afterEach(async ({ page }) => {
> 50  |   expect(diagnostics.get(page) ?? []).toEqual([])
      |                                       ^ Error: expect(received).toEqual(expected) // deep equality
  51  | })
  52  | 
  53  | type MarkdownScrollSample = {
  54  |   scrollTop: number
  55  |   scrollHeight: number
  56  |   clientHeight: number
  57  |   section: number
  58  | }
  59  | 
  60  | const sampleMarkdownStressScroll = async (
  61  |   page: Page,
  62  |   options: { steps?: number; delta?: number; delayMs?: number } = {},
  63  | ) => {
  64  |   const { steps = 80, delta = 900, delayMs = 8 } = options
  65  | 
  66  |   return page.evaluate(
  67  |     async ({ delta, delayMs, steps }) => {
  68  |       const wrap = document.querySelector<HTMLElement>(
  69  |         '.markdown-stress-scrollbar .el-scrollbar__wrap',
  70  |       )
  71  |       const renderer = document.querySelector<HTMLElement>(
  72  |         '.markdown-stress-renderer',
  73  |       )
  74  | 
  75  |       if (!wrap || !renderer) {
  76  |         throw new Error('Markdown stress scroll internals are missing')
  77  |       }
  78  | 
  79  |       const sectionNumber = (heading: HTMLElement | undefined) =>
  80  |         Number.parseInt(
  81  |           /Stress Section\s+(\d+)/.exec(heading?.textContent || '')?.[1] || '0',
  82  |           10,
  83  |         ) || 0
  84  |       const sectionFromViewport = () => {
  85  |         const headings = Array.from(
  86  |           renderer.querySelectorAll<HTMLElement>('h1,h2,h3'),
  87  |         )
  88  |         const wrapRect = wrap.getBoundingClientRect()
  89  |         const anchorTop = wrapRect.top + 32
  90  |         let bestHeading: HTMLElement | undefined
  91  |         let bestTop = Number.NEGATIVE_INFINITY
  92  | 
  93  |         for (const heading of headings) {
  94  |           const top = heading.getBoundingClientRect().top
  95  |           if (top <= anchorTop && top > bestTop) {
  96  |             bestTop = top
  97  |             bestHeading = heading
  98  |           }
  99  |         }
  100 | 
  101 |         return sectionNumber(bestHeading ?? headings[0])
  102 |       }
  103 | 
  104 |       const waitForFrames = () =>
  105 |         new Promise<void>((resolve) => {
  106 |           requestAnimationFrame(() => resolve())
  107 |         })
  108 |       const wait = (ms: number) =>
  109 |         new Promise<void>((resolve) => setTimeout(resolve, ms))
  110 |       const samples: MarkdownScrollSample[] = []
  111 | 
  112 |       for (let index = 0; index < steps; index += 1) {
  113 |         const maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight)
  114 |         wrap.scrollTop = Math.min(maxScrollTop, wrap.scrollTop + delta)
  115 |         wrap.dispatchEvent(new Event('scroll', { bubbles: true }))
  116 |         await waitForFrames()
  117 |         if (delayMs > 0) await wait(delayMs)
  118 | 
  119 |         samples.push({
  120 |           clientHeight: wrap.clientHeight,
  121 |           scrollHeight: wrap.scrollHeight,
  122 |           scrollTop: wrap.scrollTop,
  123 |           section: sectionFromViewport(),
  124 |         })
  125 |       }
  126 | 
  127 |       return samples
  128 |     },
  129 |     { delta, delayMs, steps },
  130 |   )
  131 | }
  132 | 
  133 | const expectStableForwardMarkdownScroll = (samples: MarkdownScrollSample[]) => {
  134 |   expect(samples.length).toBeGreaterThan(4)
  135 | 
  136 |   const regressions = samples
  137 |     .slice(1)
  138 |     .map((sample, index) => ({
  139 |       previous: samples[index],
  140 |       sample,
  141 |     }))
  142 |     .filter(({ previous, sample }) => {
  143 |       const scrollRegressed = sample.scrollTop < previous.scrollTop - 160
  144 |       const sectionRegressed =
  145 |         sample.section > 0 &&
  146 |         previous.section > 0 &&
  147 |         sample.section < previous.section - 3
  148 | 
  149 |       return scrollRegressed || sectionRegressed
  150 |     })
```