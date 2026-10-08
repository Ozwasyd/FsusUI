# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: safe-area-overlay-matrix.spec.ts >> safe-area overlay matrix (full) >> runs 34 required cases with geometry assertions
- Location: vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts:313:7

# Error details

```
Error: drawer-ttb/landscape-notch must stay inside safe rect {"left":59,"top":0,"right":785,"bottom":369,"width":726,"height":369} under profile landscape-notch

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 10

- Array []
+ Array [
+   Object {
+     "bottom": 71,
+     "className": "el-drawer__close-btn",
+     "left": 765,
+     "right": 819,
+     "role": "button",
+     "top": 17,
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "FsusUI Component Boundary Audit" [level=1] [ref=e5]
    - paragraph [ref=e6]: 121 components · focus
  - generic [ref=e7]:
    - heading "Safe-area surfaces" [level=2] [ref=e8]
    - generic [ref=e9]:
      - button "Open Overlay" [ref=e10] [cursor=pointer]:
        - generic [ref=e11]: Open Overlay
      - button "Open Dialog" [ref=e12] [cursor=pointer]:
        - generic [ref=e13]: Open Dialog
      - button "Open Fullscreen Dialog" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: Open Fullscreen Dialog
      - button "Open MessageBox" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: Open MessageBox
      - button "Open Drawer LTR" [ref=e18] [cursor=pointer]:
        - generic [ref=e19]: Open Drawer LTR
      - button "Open Drawer RTL" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: Open Drawer RTL
      - button "Open Drawer TTB" [active] [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: Open Drawer TTB
      - button "Open Drawer BTT" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: Open Drawer BTT
      - button "Open ImageViewer" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: Open ImageViewer
  - generic [ref=e28]:
    - article [ref=e29]:
      - generic [ref=e30]:
        - generic [ref=e31]: FixedSizeList
        - generic [ref=e32]: focus
      - generic [ref=e37]:
        - generic [ref=e38]: Fixed row 0
        - generic [ref=e39]: Fixed row 1
        - generic [ref=e40]: Fixed row 2
        - generic [ref=e41]: Fixed row 3
        - generic [ref=e42]: Fixed row 4
        - generic [ref=e43]: Fixed row 5
    - article [ref=e45]:
      - generic [ref=e46]:
        - generic [ref=e47]: DynamicSizeList
        - generic [ref=e48]: focus
      - generic [ref=e53]:
        - generic [ref=e54]: Dynamic row 0
        - generic [ref=e55]: Dynamic row 1
        - generic [ref=e56]: Dynamic row 2
        - generic [ref=e57]: Dynamic row 3
        - generic [ref=e58]: Dynamic row 4
        - generic [ref=e59]: Dynamic row 5
    - article [ref=e61]:
      - generic [ref=e62]:
        - generic [ref=e63]: FixedSizeGrid
        - generic [ref=e64]: focus
      - generic [ref=e69]:
        - generic [ref=e70]: 0,0
        - generic [ref=e71]: 0,1
        - generic [ref=e72]: 0,2
        - generic [ref=e73]: 0,3
        - generic [ref=e74]: 0,4
        - generic [ref=e75]: 1,0
        - generic [ref=e76]: 1,1
        - generic [ref=e77]: 1,2
        - generic [ref=e78]: 1,3
        - generic [ref=e79]: 1,4
        - generic [ref=e80]: 2,0
        - generic [ref=e81]: 2,1
        - generic [ref=e82]: 2,2
        - generic [ref=e83]: 2,3
        - generic [ref=e84]: 2,4
        - generic [ref=e85]: 3,0
        - generic [ref=e86]: 3,1
        - generic [ref=e87]: 3,2
        - generic [ref=e88]: 3,3
        - generic [ref=e89]: 3,4
        - generic [ref=e90]: 4,0
        - generic [ref=e91]: 4,1
        - generic [ref=e92]: 4,2
        - generic [ref=e93]: 4,3
        - generic [ref=e94]: 4,4
        - generic [ref=e95]: 5,0
        - generic [ref=e96]: 5,1
        - generic [ref=e97]: 5,2
        - generic [ref=e98]: 5,3
        - generic [ref=e99]: 5,4
    - article [ref=e102]:
      - generic [ref=e103]:
        - generic [ref=e104]: DynamicSizeGrid
        - generic [ref=e105]: focus
      - generic [ref=e110]:
        - generic [ref=e111]: 0,0
        - generic [ref=e112]: 0,1
        - generic [ref=e113]: 0,2
        - generic [ref=e114]: 0,3
        - generic [ref=e115]: 0,4
        - generic [ref=e116]: 1,0
        - generic [ref=e117]: 1,1
        - generic [ref=e118]: 1,2
        - generic [ref=e119]: 1,3
        - generic [ref=e120]: 1,4
        - generic [ref=e121]: 2,0
        - generic [ref=e122]: 2,1
        - generic [ref=e123]: 2,2
        - generic [ref=e124]: 2,3
        - generic [ref=e125]: 2,4
        - generic [ref=e126]: 3,0
        - generic [ref=e127]: 3,1
        - generic [ref=e128]: 3,2
        - generic [ref=e129]: 3,3
        - generic [ref=e130]: 3,4
        - generic [ref=e131]: 4,0
        - generic [ref=e132]: 4,1
        - generic [ref=e133]: 4,2
        - generic [ref=e134]: 4,3
        - generic [ref=e135]: 4,4
        - generic [ref=e136]: 5,0
        - generic [ref=e137]: 5,1
        - generic [ref=e138]: 5,2
        - generic [ref=e139]: 5,3
        - generic [ref=e140]: 5,4
    - article [ref=e143]:
      - generic [ref=e144]:
        - generic [ref=e145]: ElVisuallyHidden
        - generic [ref=e146]: focus
      - generic [ref=e147]:
        - generic [ref=e148]: Hidden audit text
        - text: Visible companion text
    - article [ref=e149]:
      - generic [ref=e150]:
        - generic [ref=e151]: ElAffix
        - generic [ref=e152]: focus
      - button "Affix action" [ref=e156] [cursor=pointer]:
        - generic [ref=e157]: Affix action
    - article [ref=e158]:
      - generic [ref=e159]:
        - generic [ref=e160]: ElAlert
        - generic [ref=e161]: focus
      - alert [ref=e163]:
        - img [ref=e165]
        - generic [ref=e167]:
          - generic [ref=e168]: Focused feedback
          - img [ref=e170] [cursor=pointer]
    - article [ref=e172]:
      - generic [ref=e173]:
        - generic [ref=e174]: ElAside
        - generic [ref=e175]: focus
      - generic [ref=e177]:
        - complementary [ref=e178]: Aside
        - main [ref=e179]: Main
    - article [ref=e180]:
      - generic [ref=e181]:
        - generic [ref=e182]: ElAutocomplete
        - generic [ref=e183]: focus
      - combobox [ref=e185]:
        - textbox [ref=e188]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback - pending value
    - article [ref=e189]:
      - generic [ref=e190]:
        - generic [ref=e191]: ElAvatar
        - generic [ref=e192]: focus
      - generic [ref=e194]:
        - img [ref=e197]
        - generic [ref=e199]: UI
    - article [ref=e200]:
      - generic [ref=e201]:
        - generic [ref=e202]: ElBacktop
        - generic [ref=e203]: focus
      - generic [ref=e205]:
        - generic [ref=e206]: Scroll shell
        - button [ref=e207] [cursor=pointer]:
          - img [ref=e209]
    - article [ref=e211]:
      - generic [ref=e212]:
        - generic [ref=e213]: ElBadge
        - generic [ref=e214]: focus
      - generic [ref=e216]:
        - button "Inbox" [ref=e217] [cursor=pointer]:
          - generic [ref=e218]: Inbox
        - superscript [ref=e219]: "8"
    - article [ref=e220]:
      - generic [ref=e221]:
        - generic [ref=e222]: ElBreadcrumb
        - generic [ref=e223]: focus
      - navigation "Breadcrumb" [ref=e225]:
        - list [ref=e226]:
          - listitem [ref=e227]:
            - generic [ref=e228]: Home
            - generic: /
          - listitem [ref=e229]:
            - generic "Library" [ref=e230]
    - article [ref=e231]:
      - generic [ref=e232]:
        - generic [ref=e233]: ElBreadcrumbItem
        - generic [ref=e234]: focus
      - navigation "Breadcrumb" [ref=e236]:
        - list [ref=e237]:
          - listitem [ref=e238]:
            - link "Current item" [ref=e239]
    - article [ref=e240]:
      - generic [ref=e241]:
        - generic [ref=e242]: ElButton
        - generic [ref=e243]: focus
      - button "Button" [ref=e245] [cursor=pointer]:
        - generic [ref=e246]: Button
    - article [ref=e247]:
      - generic [ref=e248]:
        - generic [ref=e249]: ElButtonGroup
        - generic [ref=e250]: focus
      - generic [ref=e252]:
        - button "Prev" [ref=e253] [cursor=pointer]:
          - img [ref=e255]
          - generic [ref=e257]: Prev
        - button "Next" [ref=e258] [cursor=pointer]:
          - generic [ref=e259]:
            - text: Next
            - img [ref=e261]
    - article [ref=e263]:
      - generic [ref=e264]:
        - generic [ref=e265]: ElCalendar
        - generic [ref=e266]: focus
      - generic [ref=e269]:
        - generic [ref=e271]: 2026年5月
        - generic [ref=e272]:
          - table [ref=e273]:
            - rowgroup [ref=e274]:
              - columnheader "一" [ref=e275]
              - columnheader "二" [ref=e276]
              - columnheader "三" [ref=e277]
              - columnheader "四" [ref=e278]
              - columnheader "五" [ref=e279]
              - columnheader "六" [ref=e280]
              - columnheader "日" [ref=e281]
            - rowgroup [ref=e282]:
              - row "17 18 19 20 21 22 23" [ref=e283]:
                - cell "17" [ref=e284]:
                  - generic [ref=e285]: "17"
                - cell "18" [ref=e286]:
                  - generic [ref=e287]: "18"
                - cell "19" [ref=e288]:
                  - generic [ref=e289]: "19"
                - cell "20" [ref=e290]:
                  - generic [ref=e291]: "20"
                - cell "21" [ref=e292]:
                  - generic [ref=e293]: "21"
                - cell "22" [ref=e294]:
                  - generic [ref=e295]: "22"
                - cell "23" [ref=e296]:
                  - generic [ref=e297]: "23"
              - row "24 25 26 27 28 29 30" [ref=e298]:
                - cell "24" [ref=e299]:
                  - generic [ref=e300]: "24"
                - cell "25" [ref=e301]:
                  - generic [ref=e302]: "25"
                - cell "26" [ref=e303]:
                  - generic [ref=e304]: "26"
                - cell "27" [ref=e305]:
                  - generic [ref=e306]: "27"
                - cell "28" [ref=e307]:
                  - generic [ref=e308]: "28"
                - cell "29" [ref=e309]:
                  - generic [ref=e310]: "29"
                - cell "30" [ref=e311]:
                  - generic [ref=e312]: "30"
              - row "31 1 2 3 4 5 6" [ref=e313]:
                - cell "31" [ref=e314]:
                  - generic [ref=e315]: "31"
                - cell "1" [ref=e316]:
                  - generic [ref=e317]: "1"
                - cell "2" [ref=e318]:
                  - generic [ref=e319]: "2"
                - cell "3" [ref=e320]:
                  - generic [ref=e321]: "3"
                - cell "4" [ref=e322]:
                  - generic [ref=e323]: "4"
                - cell "5" [ref=e324]:
                  - generic [ref=e325]: "5"
                - cell "6" [ref=e326]:
                  - generic [ref=e327]: "6"
          - table:
            - rowgroup
    - article [ref=e328]:
      - generic [ref=e329]:
        - generic [ref=e330]: ElCard
        - generic [ref=e331]: focus
      - generic [ref=e333]:
        - generic [ref=e334]: Card header
        - paragraph [ref=e336]: Curated surface content
    - article [ref=e337]:
      - generic [ref=e338]:
        - generic [ref=e339]: ElCarousel
        - generic [ref=e340]: focus
      - generic [ref=e342]:
        - generic [ref=e343]:
          - generic [ref=e345]: Slide 1
          - generic [ref=e347]: Slide 2
          - generic [ref=e349]: Slide 3
        - list [ref=e350]:
          - listitem [ref=e351] [cursor=pointer]:
            - button "切换到第 1 张" [ref=e352]
          - listitem [ref=e353] [cursor=pointer]:
            - button "切换到第 2 张" [ref=e354]
          - listitem [ref=e355] [cursor=pointer]:
            - button "切换到第 3 张" [ref=e356]
    - article [ref=e357]:
      - generic [ref=e358]:
        - generic [ref=e359]: ElCarouselItem
        - generic [ref=e360]: focus
      - generic [ref=e362]:
        - generic [ref=e365]: Carousel item
        - list [ref=e366]:
          - listitem [ref=e367] [cursor=pointer]:
            - button "切换到第 1 张" [ref=e368]
    - article [ref=e369]:
      - generic [ref=e370]:
        - generic [ref=e371]: ElCascader
        - generic [ref=e372]: focus
      - generic [ref=e376]:
        - textbox "Cascader" [ref=e377] [cursor=pointer]
        - img [ref=e380]
    - article [ref=e382]:
      - generic [ref=e383]:
        - generic [ref=e384]: ElCascaderPanel
        - generic [ref=e385]: focus
      - menu [ref=e390]:
        - menuitem "Guide / extremely long discipline branch" [ref=e391] [cursor=pointer]:
          - generic [ref=e392]: Guide / extremely long discipline branch
          - img [ref=e394]
    - article [ref=e396]:
      - generic [ref=e397]:
        - generic [ref=e398]: ElCheckbox
        - generic [ref=e399]: focus
      - generic [ref=e401] [cursor=pointer]:
        - generic [ref=e402]:
          - checkbox "Checkbox"
        - generic [ref=e404]: Checkbox
    - article [ref=e405]:
      - generic [ref=e406]:
        - generic [ref=e407]: ElCheckboxButton
        - generic [ref=e408]: focus
      - group "checkbox-group" [ref=e410]:
        - generic [ref=e411]:
          - checkbox "推送到首页" [ref=e412]
          - generic [ref=e413] [cursor=pointer]: 推送到首页
    - article [ref=e414]:
      - generic [ref=e415]:
        - generic [ref=e416]: ElCheckboxGroup
        - generic [ref=e417]: focus
      - group "checkbox-group" [ref=e419]:
        - generic [ref=e420] [cursor=pointer]:
          - generic [ref=e421]:
            - checkbox "A" [checked]
          - generic [ref=e423]: A
        - generic [ref=e424] [cursor=pointer]:
          - generic [ref=e425]:
            - checkbox "B"
          - generic [ref=e427]: B
    - article [ref=e428]:
      - generic [ref=e429]:
        - generic [ref=e430]: ElCheckTag
        - generic [ref=e431]: focus
      - checkbox "Check tag" [ref=e433] [cursor=pointer]
    - article [ref=e434]:
      - generic [ref=e435]:
        - generic [ref=e436]: ElCol
        - generic [ref=e437]: focus
      - generic [ref=e439]:
        - generic [ref=e441]: "12"
        - generic [ref=e443]: "12"
    - article [ref=e444]:
      - generic [ref=e445]:
        - generic [ref=e446]: ElCollapse
        - generic [ref=e447]: focus
      - generic [ref=e449]:
        - generic [ref=e450]:
          - button "Consistency" [expanded] [ref=e451] [cursor=pointer]:
            - text: Consistency
            - img [ref=e453]
          - region "Consistency" [ref=e455]:
            - generic [ref=e456]: First panel
        - button "Interaction" [ref=e458] [cursor=pointer]:
          - text: Interaction
          - img [ref=e460]
    - article [ref=e462]:
      - generic [ref=e463]:
        - generic [ref=e464]: ElCollapseItem
        - generic [ref=e465]: focus
      - button "Collapse item" [ref=e469] [cursor=pointer]:
        - text: Collapse item
        - img [ref=e471]
    - article [ref=e473]:
      - generic [ref=e474]:
        - generic [ref=e475]: ElCollapseTransition
        - generic [ref=e476]: focus
      - button "Toggle" [ref=e478] [cursor=pointer]:
        - generic [ref=e479]: Toggle
    - article [ref=e480]:
      - generic [ref=e481]:
        - generic [ref=e482]: ElColorPicker
        - generic [ref=e483]: focus
      - button "el.colorpicker.defaultLabel" [ref=e485]
    - article [ref=e489]:
      - generic [ref=e490]:
        - generic [ref=e491]: ElCollectionToolbar
        - generic [ref=e492]: focus
      - generic [ref=e493]:
        - group "Collection controls" [ref=e494]:
          - textbox "Search" [ref=e498]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback - pending value
          - group "State" [ref=e500]:
            - generic [ref=e501]: State
            - radiogroup "Filter state" [ref=e503]:
              - radio "All" [checked] [ref=e504] [cursor=pointer]
              - radio "Open" [ref=e505] [cursor=pointer]
              - radio "Closed" [ref=e506] [cursor=pointer]
          - button "Refresh" [ref=e508] [cursor=pointer]:
            - generic [ref=e509]: Refresh
        - generic [ref=e511]:
          - paragraph [ref=e512]: Results
          - generic [ref=e513]: 12 items
        - navigation "Results pagination" [ref=e514]:
          - generic [ref=e515]: Page 1 of 4
          - generic [ref=e517]:
            - button "上一页" [disabled] [ref=e518]:
              - generic:
                - img
            - list [ref=e519]:
              - listitem "第 1 页" [ref=e520]: "1"
              - listitem "第 2 页" [ref=e521] [cursor=pointer]: "2"
              - listitem "第 3 页" [ref=e522] [cursor=pointer]: "3"
              - listitem "第 4 页" [ref=e523] [cursor=pointer]: "4"
            - button "下一页" [ref=e524] [cursor=pointer]:
              - generic:
                - img
    - article [ref=e525]:
      - generic [ref=e526]:
        - generic [ref=e527]: ElConfigProvider
        - generic [ref=e528]: focus
      - button "Provider child" [ref=e530] [cursor=pointer]:
        - generic [ref=e531]: Provider child
    - article [ref=e532]:
      - generic [ref=e533]:
        - generic [ref=e534]: ElContainer
        - generic [ref=e535]: focus
      - generic [ref=e537]:
        - generic [ref=e538]: Header
        - main [ref=e539]: Main
        - generic [ref=e540]: Footer
    - article [ref=e541]:
      - generic [ref=e542]:
        - generic [ref=e543]: ElCountdown
        - generic [ref=e544]: focus
      - generic [ref=e546]:
        - generic [ref=e547]: Countdown
        - generic [ref=e548]: 23:59:27
    - article [ref=e549]:
      - generic [ref=e550]:
        - generic [ref=e551]: ElDatePicker
        - generic [ref=e552]: focus
      - combobox [ref=e554]:
        - generic [ref=e555]:
          - img [ref=e558]
          - textbox "Pick day" [ref=e560]: 2026-05-20
    - article [ref=e561]:
      - generic [ref=e562]:
        - generic [ref=e563]: ElDescriptions
        - generic [ref=e564]: focus
      - generic [ref=e566]:
        - generic [ref=e568]: Profile
        - generic "Description fields" [ref=e570]:
          - generic [ref=e571]:
            - term [ref=e572]: Name
            - definition [ref=e573]: FsusUI
          - generic [ref=e574]:
            - term [ref=e575]: State
            - definition [ref=e576]: Ready
    - article [ref=e577]:
      - generic [ref=e578]:
        - generic [ref=e579]: ElDescriptionsItem
        - generic [ref=e580]: focus
      - generic "Description fields" [ref=e584]:
        - generic [ref=e585]:
          - term [ref=e586]: 文章状态
          - definition [ref=e587]: 等待复核
    - article [ref=e588]:
      - generic [ref=e589]:
        - generic [ref=e590]: ElDialog
        - generic [ref=e591]: focus
      - button "Open dialog" [ref=e593] [cursor=pointer]:
        - generic [ref=e594]: Open dialog
    - article [ref=e595]:
      - generic [ref=e596]:
        - generic [ref=e597]: ElDivider
        - generic [ref=e598]: focus
      - generic [ref=e599]:
        - text: Before
        - separator [ref=e600]:
          - generic [ref=e601]: Divider
        - text: After
    - article [ref=e602]:
      - generic [ref=e603]:
        - generic [ref=e604]: ElDrawer
        - generic [ref=e605]: focus
      - button "Open drawer" [ref=e607] [cursor=pointer]:
        - generic [ref=e608]: Open drawer
    - article [ref=e609]:
      - generic [ref=e610]:
        - generic [ref=e611]: ElDropdown
        - generic [ref=e612]: focus
      - button "Dropdown" [ref=e615] [cursor=pointer]:
        - generic [ref=e616]:
          - text: Dropdown
          - img [ref=e618]
    - article [ref=e620]:
      - generic [ref=e621]:
        - generic [ref=e622]: ElDropdownItem
        - generic [ref=e623]: focus
      - button "Dropdown item" [ref=e626] [cursor=pointer]:
        - generic [ref=e627]: Dropdown item
    - article [ref=e628]:
      - generic [ref=e629]:
        - generic [ref=e630]: ElDropdownMenu
        - generic [ref=e631]: focus
      - button "Dropdown menu" [ref=e634] [cursor=pointer]:
        - generic [ref=e635]: Dropdown menu
    - article [ref=e636]:
      - generic [ref=e637]:
        - generic [ref=e638]: ElEmpty
        - generic [ref=e639]: focus
      - generic [ref=e641]:
        - img [ref=e643]
        - generic [ref=e648]: No records
    - article [ref=e649]:
      - generic [ref=e650]:
        - generic [ref=e651]: ElEmptyState
        - generic [ref=e652]: focus
      - generic [ref=e654]:
        - paragraph [ref=e655]: No records
        - paragraph [ref=e656]: Adjust filters or create a new item.
        - button "Create item" [ref=e658] [cursor=pointer]:
          - generic [ref=e659]: Create item
    - article [ref=e660]:
      - generic [ref=e661]:
        - generic [ref=e662]: ElMetricList
        - generic [ref=e663]: focus
      - generic [ref=e665]:
        - generic [ref=e666]:
          - list [ref=e667]:
            - listitem [ref=e668]:
              - generic:
                - generic [ref=e669]: Metric Alpha
                - strong [ref=e670]: P75 22ms
              - generic [ref=e672]: Avg 23ms
              - generic [ref=e673]: 58 samples
            - listitem [ref=e674]:
              - generic [ref=e675]:
                - generic [ref=e676]: Metric Beta
                - strong [ref=e677]: 99.4%
              - generic [ref=e679]: Target 99%
              - generic [ref=e680]: 12 checks
          - generic [ref=e681]:
            - generic [ref=e682]:
              - term [ref=e683]: State
              - definition [ref=e684]: Ready
            - generic [ref=e685]:
              - term [ref=e686]: Queue
              - definition [ref=e687]: 0 / 0
        - list [ref=e688]:
          - listitem [ref=e689]:
            - generic [ref=e690]: "1"
            - generic [ref=e691]: Segment Alpha
            - generic [ref=e692]: "245"
          - listitem [ref=e695]:
            - generic [ref=e696]: "2"
            - generic [ref=e697]: Segment Beta
            - generic [ref=e698]: "106"
        - article [ref=e701]:
          - generic [ref=e702]:
            - generic [ref=e703]: Generic status
            - generic [ref=e704]: Stable
            - generic [ref=e705]: 2026-06-14 20:30
          - generic [ref=e706]: Product-owned detail copy.
          - button "Inspect" [ref=e708] [cursor=pointer]:
            - generic [ref=e709]: Inspect
        - list [ref=e710]:
          - listitem [ref=e711]:
            - generic [ref=e712]:
              - generic:
                - strong [ref=e713]: diagnostic.event
                - paragraph [ref=e714]: Recent event summary.
                - generic [ref=e715]: warning - 17:48:11 - 3 times
              - generic [ref=e717]:
                - code [ref=e718]: diagnostic-node:runCheck:sample-0001
                - button "Copy detail" [ref=e719] [cursor=pointer]: Copy
            - group [ref=e721]:
              - generic "Details" [ref=e722] [cursor=pointer]
    - article [ref=e723]:
      - generic [ref=e724]:
        - generic [ref=e725]: ElFooter
        - generic [ref=e726]: focus
      - generic [ref=e728]:
        - main [ref=e729]: Main
        - generic [ref=e730]: Footer
    - article [ref=e731]:
      - generic [ref=e732]:
        - generic [ref=e733]: ElForm
        - generic [ref=e734]: focus
      - generic [ref=e737]:
        - generic [ref=e738]: Name
        - textbox "Name" [ref=e742]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback - pending value
    - article [ref=e743]:
      - generic [ref=e744]:
        - generic [ref=e745]: ElFormItem
        - generic [ref=e746]: focus
      - generic [ref=e749]:
        - generic [ref=e750]: Region
        - generic [ref=e755] [cursor=pointer]:
          - combobox "Region" [ref=e756]
          - img [ref=e759]
    - article [ref=e761]:
      - generic [ref=e762]:
        - generic [ref=e763]: ElHeader
        - generic [ref=e764]: focus
      - generic [ref=e766]:
        - generic [ref=e767]: Header
        - main [ref=e768]: Main
    - article [ref=e769]:
      - generic [ref=e770]:
        - generic [ref=e771]: ElIcon
        - generic [ref=e772]: focus
      - img [ref=e775]
    - article [ref=e777]:
      - generic [ref=e778]:
        - generic [ref=e779]: ElImage
        - generic [ref=e780]: focus
      - img [ref=e783] [cursor=pointer]
    - article [ref=e784]:
      - generic [ref=e785]:
        - generic [ref=e786]: ElImageViewer
        - generic [ref=e787]: focus
      - generic [ref=e788]:
        - img [ref=e790]
        - button "Preview" [ref=e791] [cursor=pointer]:
          - generic [ref=e792]: Preview
    - article [ref=e793]:
      - generic [ref=e794]:
        - generic [ref=e795]: ElInboxLayout
        - generic [ref=e796]: focus
      - generic [ref=e798]:
        - region "Generic item list" [ref=e799]:
          - list "Generic item list" [ref=e800]:
            - listitem [ref=e801]:
              - button "关于评论权限的讨论 长摘要内容仍然需要留在列表列宽内 09:00 1 unread items" [ref=e802] [cursor=pointer]:
                - generic [ref=e803]:
                  - generic [ref=e804]: 关于评论权限的讨论
                  - generic [ref=e805]: 长摘要内容仍然需要留在列表列宽内
                - generic [ref=e806]:
                  - generic [ref=e807]: 09:00
                  - generic "1 unread items" [ref=e808]: "1"
            - listitem [ref=e809]:
              - button "下周封面图评审 第二条工作流摘要保持安全换行 10:30" [ref=e810] [cursor=pointer]:
                - generic [ref=e811]:
                  - generic [ref=e812]: 下周封面图评审
                  - generic [ref=e813]: 第二条工作流摘要保持安全换行
                - generic [ref=e815]: 10:30
        - region "Generic item detail" [ref=e816]:
          - region "评论权限讨论" [ref=e817]:
            - generic [ref=e819]:
              - heading "评论权限讨论" [level=3] [ref=e820]
              - generic [ref=e822]: Ready
            - generic [ref=e824]:
              - generic [ref=e825]: "Kind: Generic"
              - generic [ref=e826]: "Source: Neutral"
            - list [ref=e828]:
              - listitem [ref=e829]:
                - generic [ref=e830]:
                  - generic [ref=e831]: A
                  - generic [ref=e832]: 09:00
                - generic [ref=e833]: Neutral timeline content.
              - listitem [ref=e834]:
                - generic [ref=e835]:
                  - generic [ref=e836]: B
                  - generic [ref=e837]: 09:10
                - generic [ref=e838]: Reply content with enough length to test wrapping in a compact panel.
              - listitem [ref=e839]:
                - generic [ref=e840]: Generic state changed.
            - generic [ref=e842]:
              - strong [ref=e844]: Reply
              - textbox "Reply body" [ref=e847]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback - pending value
              - button "Send" [ref=e849] [cursor=pointer]:
                - generic [ref=e850]: Send
    - article [ref=e851]:
      - generic [ref=e852]:
        - generic [ref=e853]: ElInput
        - generic [ref=e854]: focus
      - textbox "Input" [ref=e858]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback - pending value
    - article [ref=e859]:
      - generic [ref=e860]:
        - generic [ref=e861]: ElInputNumber
        - generic [ref=e862]: focus
      - generic [ref=e864]:
        - button "el.inputNumber.decrease" [ref=e865] [cursor=pointer]:
          - img [ref=e867]
        - button "el.inputNumber.increase" [ref=e869] [cursor=pointer]:
          - img [ref=e871]
        - spinbutton [ref=e875]: "2"
    - article [ref=e876]:
      - generic [ref=e877]:
        - generic [ref=e878]: ElLink
        - generic [ref=e879]: focus
      - link "Link action" [ref=e881] [cursor=pointer]:
        - /url: "#audit-link"
        - generic [ref=e882]: Link action
    - article [ref=e883]:
      - generic [ref=e884]:
        - generic [ref=e885]: ElMain
        - generic [ref=e886]: focus
      - main [ref=e889]: Main surface
    - article [ref=e890]:
      - generic [ref=e891]:
        - generic [ref=e892]: ElMarkdownEditor
        - generic [ref=e893]: focus
      - region "Markdown 编辑器" [ref=e896]:
        - generic [ref=e897]:
          - generic:
            - generic:
              - button "加粗" [ref=e898] [cursor=pointer]
              - button "斜体" [ref=e899] [cursor=pointer]
              - button "标题" [ref=e900] [cursor=pointer]
              - button "引用" [ref=e901] [cursor=pointer]
              - button "代码" [ref=e902] [cursor=pointer]
              - button "链接" [ref=e903] [cursor=pointer]
            - button "格式工具，2 个工具" [ref=e904] [cursor=pointer]:
              - generic: 格式工具
              - generic [ref=e905]: "2"
          - tablist "Markdown 模式" [ref=e906]:
            - tab "源码" [ref=e907] [cursor=pointer]
            - tab "实时" [ref=e908] [cursor=pointer]
            - tab "分屏" [selected] [ref=e909] [cursor=pointer]
            - tab "预览" [ref=e910] [cursor=pointer]
          - generic [ref=e911]:
            - button "上传图片" [ref=e912] [cursor=pointer]
            - button "保存" [ref=e913] [cursor=pointer]
            - button "提交" [ref=e914] [cursor=pointer]
        - generic [ref=e915]:
          - textbox "Markdown 源码编辑区" [ref=e916]:
            - /placeholder: ""
            - text: "## Editor Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback [Audit link](https://example.com)"
          - button [ref=e917]
          - article [ref=e919]:
            - generic [ref=e920]:
              - heading "Editor" [level=2] [ref=e921]
              - paragraph [ref=e922]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - paragraph [ref=e923]:
                - link "Audit link" [ref=e924] [cursor=pointer]:
                  - /url: https://example.com
        - generic [ref=e926]:
          - generic [ref=e927]: 162 字符
          - generic [ref=e928]: 23 词
    - article [ref=e929]:
      - generic [ref=e930]:
        - generic [ref=e931]: ElMarkdownRenderer
        - generic [ref=e932]: focus
      - article [ref=e935]:
        - generic [ref=e936]:
          - heading "Markdown" [level=1] [ref=e937]
          - paragraph [ref=e938]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - paragraph [ref=e939]:
            - code [ref=e940]: inline-code-boundary-token
    - article [ref=e941]:
      - generic [ref=e942]:
        - generic [ref=e943]: ElMenu
        - generic [ref=e944]: focus
      - menubar [ref=e946]:
        - menuitem "Dashboard" [ref=e947] [cursor=pointer]
        - menuitem "Workspace" [ref=e948]:
          - generic [ref=e949] [cursor=pointer]:
            - text: Workspace
            - img [ref=e951]
    - article [ref=e953]:
      - generic [ref=e954]:
        - generic [ref=e955]: ElMenuItem
        - generic [ref=e956]: focus
      - menubar [ref=e958]:
        - menuitem "Overview" [ref=e959] [cursor=pointer]
        - menuitem "Active item" [ref=e960] [cursor=pointer]
    - article [ref=e961]:
      - generic [ref=e962]:
        - generic [ref=e963]: ElMenuItemGroup
        - generic [ref=e964]: focus
      - menubar [ref=e966]:
        - menuitem "Group" [expanded] [ref=e967]:
          - generic [ref=e968] [cursor=pointer]:
            - text: Group
            - img [ref=e970]
          - menu [ref=e972]:
            - listitem [ref=e973]:
              - generic [ref=e974]: Group label
              - list [ref=e975]:
                - menuitem "Grouped item" [ref=e976] [cursor=pointer]
    - article [ref=e977]:
      - generic [ref=e978]:
        - generic [ref=e979]: ElOption
        - generic [ref=e980]: focus
      - generic [ref=e985] [cursor=pointer]:
        - combobox "选择发布范围" [ref=e986]
        - img [ref=e989]
    - article [ref=e991]:
      - generic [ref=e992]:
        - generic [ref=e993]: ElOptionGroup
        - generic [ref=e994]: focus
      - generic [ref=e999] [cursor=pointer]:
        - combobox "选择推荐策略" [ref=e1000]
        - img [ref=e1003]
    - article [ref=e1005]:
      - generic [ref=e1006]:
        - generic [ref=e1007]: ElOverlay
        - generic [ref=e1008]: focus
      - button "Overlay trigger" [ref=e1011] [cursor=pointer]:
        - generic [ref=e1012]: Overlay trigger
    - article [ref=e1013]:
      - generic [ref=e1014]:
        - generic [ref=e1015]: ElPageHeader
        - generic [ref=e1016]: focus
      - generic [ref=e1020]:
        - button "Back Back" [ref=e1021] [cursor=pointer]:
          - generic "Back" [ref=e1022]:
            - img [ref=e1024]
          - generic [ref=e1027]: Back
        - separator [ref=e1028]
        - generic [ref=e1029]: Detail
    - article [ref=e1030]:
      - generic [ref=e1031]:
        - generic [ref=e1032]: ElTaskPageHeader
        - generic [ref=e1033]: focus
      - generic [ref=e1035]:
        - generic [ref=e1036]:
          - heading "Review release evidence" [level=1] [ref=e1037]
          - paragraph [ref=e1038]: Confirm the final production checks before publishing.
        - button "Open evidence" [ref=e1040] [cursor=pointer]:
          - generic [ref=e1041]: Open evidence
    - article [ref=e1042]:
      - generic [ref=e1043]:
        - generic [ref=e1044]: ElPublicShell
        - generic [ref=e1045]: focus
      - generic [ref=e1047]:
        - generic "Site header" [ref=e1048]:
          - generic [ref=e1050]:
            - generic [ref=e1051]:
              - link "Fsus" [ref=e1053] [cursor=pointer]:
                - /url: "#brand"
              - navigation "Primary navigation" [ref=e1054]:
                - generic [ref=e1055]:
                  - link "Home Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1056] [cursor=pointer]:
                    - /url: "#home"
                  - link "Docs Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1057] [cursor=pointer]:
                    - /url: "#docs"
                  - link "API Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1058] [cursor=pointer]:
                    - /url: "#api"
            - generic [ref=e1059]:
              - button "Action" [ref=e1060] [cursor=pointer]:
                - generic [ref=e1061]: Action
              - link "Sign in" [ref=e1062] [cursor=pointer]:
                - /url: "#auth"
        - main [ref=e1063]:
          - paragraph [ref=e1064]: Public shell content
        - generic [ref=e1066]: Fsus
    - article [ref=e1067]:
      - generic [ref=e1068]:
        - generic [ref=e1069]: ElPagination
        - generic [ref=e1070]: focus
      - generic [ref=e1072]:
        - button "上一页" [disabled] [ref=e1073]:
          - generic:
            - img
        - list [ref=e1074]:
          - listitem "第 1 页" [ref=e1075]: "1"
          - listitem "第 2 页" [ref=e1076] [cursor=pointer]: "2"
          - listitem "第 3 页" [ref=e1077] [cursor=pointer]: "3"
          - listitem "第 4 页" [ref=e1078] [cursor=pointer]: "4"
          - listitem "第 5 页" [ref=e1079] [cursor=pointer]: "5"
        - button "下一页" [ref=e1080] [cursor=pointer]:
          - generic:
            - img
        - generic [ref=e1081]: 共 50 条
    - article [ref=e1082]:
      - generic [ref=e1083]:
        - generic [ref=e1084]: ElPerceptionChallenge
        - generic [ref=e1085]: focus
      - generic [ref=e1087]:
        - generic [ref=e1088]:
          - generic [ref=e1089]:
            - generic [ref=e1090]:
              - paragraph [ref=e1091]: Signal
              - heading "Challenge review" [level=3] [ref=e1092]
            - button "Refresh" [ref=e1094] [cursor=pointer]:
              - generic [ref=e1095]: Refresh
          - generic [ref=e1096]:
            - generic [ref=e1097]:
              - paragraph [ref=e1098]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - paragraph [ref=e1099]: Text task is ready for review.
            - generic [ref=e1100]:
              - textbox "Challenge answer" [ref=e1103]:
                - /placeholder: ""
              - button "Submit" [disabled] [ref=e1104]:
                - generic [ref=e1105]: Submit
        - generic [ref=e1106]:
          - generic [ref=e1107]:
            - generic [ref=e1108]:
              - paragraph [ref=e1109]: Signal
              - heading "Challenge review" [level=3] [ref=e1110]
            - button "Refresh" [ref=e1112] [cursor=pointer]:
              - generic [ref=e1113]: Refresh
          - generic [ref=e1114]:
            - generic [ref=e1115]:
              - paragraph [ref=e1116]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - paragraph [ref=e1117]: Localization task is ready for review.
            - button "Challenge image" [ref=e1118]:
              - img "Localization target" [ref=e1119]
        - generic [ref=e1120]:
          - generic [ref=e1121]:
            - generic [ref=e1122]:
              - paragraph [ref=e1123]: Signal
              - heading "Challenge review" [level=3] [ref=e1124]
            - button "Refresh" [ref=e1126] [cursor=pointer]:
              - generic [ref=e1127]: Refresh
          - generic [ref=e1128]:
            - generic [ref=e1129]:
              - paragraph [ref=e1130]: Micro-interaction challenge
              - paragraph [ref=e1131]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - paragraph [ref=e1132]: Micro-interaction task is ready for review.
            - button "Confirm interaction" [ref=e1133] [cursor=pointer]:
              - generic [ref=e1134]: Confirm interaction
    - article [ref=e1135]:
      - generic [ref=e1136]:
        - generic [ref=e1137]: ElPopconfirm
        - generic [ref=e1138]: focus
      - button "Popconfirm" [ref=e1140] [cursor=pointer]:
        - generic [ref=e1141]: Popconfirm
    - article [ref=e1142]:
      - generic [ref=e1143]:
        - generic [ref=e1144]: ElPopover
        - generic [ref=e1145]: focus
      - button "Popover" [ref=e1147] [cursor=pointer]:
        - generic [ref=e1148]: Popover
    - article [ref=e1149]:
      - generic [ref=e1150]:
        - generic [ref=e1151]: ElPopper
        - generic [ref=e1152]: focus
      - generic [ref=e1153]:
        - button "Raw popper" [ref=e1154] [cursor=pointer]:
          - generic [ref=e1155]: Raw popper
        - tooltip "Raw content" [ref=e1156]: Raw content
    - article [ref=e1158]:
      - generic [ref=e1159]:
        - generic [ref=e1160]: ElPopperArrow
        - generic [ref=e1161]: focus
      - generic [ref=e1162]:
        - button "Arrow" [ref=e1163] [cursor=pointer]:
          - generic [ref=e1164]: Arrow
        - tooltip "Arrow content" [ref=e1165]: Arrow content
    - article [ref=e1167]:
      - generic [ref=e1168]:
        - generic [ref=e1169]: ElPopperContent
        - generic [ref=e1170]: focus
      - generic [ref=e1171]:
        - button "Content trigger" [ref=e1172] [cursor=pointer]:
          - generic [ref=e1173]: Content trigger
        - tooltip "Popper content" [ref=e1174]
    - article [ref=e1175]:
      - generic [ref=e1176]:
        - generic [ref=e1177]: ElPopperTrigger
        - generic [ref=e1178]: focus
      - button "Trigger" [ref=e1180] [cursor=pointer]:
        - generic [ref=e1181]: Trigger
    - article [ref=e1182]:
      - generic [ref=e1183]:
        - generic [ref=e1184]: ElProgress
        - generic [ref=e1185]: focus
      - generic [ref=e1186]:
        - progressbar [ref=e1187]:
          - generic [ref=e1191]: 44%
        - progressbar [ref=e1192]:
          - img [ref=e1194]
          - generic [ref=e1197]: 28%
    - article [ref=e1198]:
      - generic [ref=e1199]:
        - generic [ref=e1200]: ElRadio
        - generic [ref=e1201]: focus
      - generic [ref=e1203] [cursor=pointer]:
        - radio "Radio" [ref=e1205]
        - generic [ref=e1207]: Radio
    - article [ref=e1208]:
      - generic [ref=e1209]:
        - generic [ref=e1210]: ElRadioButton
        - generic [ref=e1211]: focus
      - radiogroup "radio-group" [ref=e1213]:
        - generic [ref=e1214]:
          - radio "A" [checked] [ref=e1215]
          - generic [ref=e1216] [cursor=pointer]: A
        - generic [ref=e1217]:
          - radio "B" [ref=e1218]
          - generic [ref=e1219] [cursor=pointer]: B
    - article [ref=e1220]:
      - generic [ref=e1221]:
        - generic [ref=e1222]: ElRadioGroup
        - generic [ref=e1223]: focus
      - radiogroup "radio-group" [ref=e1225]:
        - generic [ref=e1226] [cursor=pointer]:
          - radio "One" [checked] [ref=e1228]
          - generic [ref=e1230]: One
        - generic [ref=e1231] [cursor=pointer]:
          - radio "Two" [ref=e1233]
          - generic [ref=e1235]: Two
    - article [ref=e1236]:
      - generic [ref=e1237]:
        - generic [ref=e1238]: ElRate
        - generic [ref=e1239]: focus
      - slider "rating" [ref=e1241]:
        - img [ref=e1244] [cursor=pointer]
        - img [ref=e1248] [cursor=pointer]
        - img [ref=e1252] [cursor=pointer]
        - img [ref=e1256] [cursor=pointer]
        - img [ref=e1260] [cursor=pointer]
    - article [ref=e1262]:
      - generic [ref=e1263]:
        - generic [ref=e1264]: ElResult
        - generic [ref=e1265]: focus
      - generic [ref=e1267]:
        - img [ref=e1269]
        - generic [ref=e1271]: Success
        - generic [ref=e1272]: Result detail
        - button "Confirm" [ref=e1274] [cursor=pointer]:
          - generic [ref=e1275]: Confirm
    - article [ref=e1276]:
      - generic [ref=e1277]:
        - generic [ref=e1278]: ElResponsiveCollection
        - generic [ref=e1279]: focus
      - generic [ref=e1284]:
        - table [ref=e1286]:
          - rowgroup [ref=e1290]:
            - row "Name State" [ref=e1291]:
              - columnheader "Name" [ref=e1292]:
                - generic [ref=e1293]: Name
              - columnheader "State" [ref=e1294]:
                - generic [ref=e1295]: State
        - table [ref=e1300]:
          - rowgroup [ref=e1304]:
            - row "Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready" [ref=e1305]:
              - cell "Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1306]:
                - generic [ref=e1307]: Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - cell "Ready" [ref=e1308]:
                - generic [ref=e1309]: Ready
            - row "Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Review" [ref=e1310]:
              - cell "Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1311]:
                - generic [ref=e1312]: Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - cell "Review" [ref=e1313]:
                - generic [ref=e1314]: Review
    - article [ref=e1315]:
      - generic [ref=e1316]:
        - generic [ref=e1317]: ElRow
        - generic [ref=e1318]: focus
      - generic [ref=e1320]:
        - generic [ref=e1322]: "8"
        - generic [ref=e1324]: "16"
    - article [ref=e1325]:
      - generic [ref=e1326]:
        - generic [ref=e1327]: ElScrollbar
        - generic [ref=e1328]: focus
      - generic [ref=e1332]:
        - generic [ref=e1333]: Scroll item 1
        - generic [ref=e1334]: Scroll item 2
        - generic [ref=e1335]: Scroll item 3
        - generic [ref=e1336]: Scroll item 4
        - generic [ref=e1337]: Scroll item 5
        - generic [ref=e1338]: Scroll item 6
    - article [ref=e1339]:
      - generic [ref=e1340]:
        - generic [ref=e1341]: ElSectionNav
        - generic [ref=e1342]: focus
      - generic [ref=e1344]:
        - navigation "Settings audit sections" [ref=e1345]:
          - link "Overview" [ref=e1346] [cursor=pointer]:
            - /url: "#audit-overview"
          - link "Resources" [ref=e1347] [cursor=pointer]:
            - /url: "#audit-resources"
          - generic: Disabled
        - generic [ref=e1348]:
          - generic [ref=e1349]:
            - generic [ref=e1350]:
              - heading "Generic settings" [level=3] [ref=e1351]
              - paragraph [ref=e1352]: Reusable layout for copy supplied by the product.
            - button "Update" [ref=e1354] [cursor=pointer]:
              - generic [ref=e1355]: Update
          - generic [ref=e1356]:
            - generic [ref=e1358]:
              - heading "Standalone header" [level=4] [ref=e1359]
              - paragraph [ref=e1360]: Header primitive without an eyebrow.
            - generic [ref=e1361]:
              - generic [ref=e1363]:
                - heading "Form group" [level=4] [ref=e1364]
                - paragraph [ref=e1365]: Labels and inputs remain owned by the form.
              - generic [ref=e1367]:
                - text: Label
                - textbox "Label" [ref=e1368]: Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback - pending value
            - list [ref=e1369]:
              - listitem [ref=e1370]:
                - generic [ref=e1371]:
                  - generic [ref=e1372]:
                    - generic [ref=e1373]:
                      - strong [ref=e1374]: Resource Alpha
                      - generic [ref=e1376]: Ready
                    - generic [ref=e1377]: Updated recently
                    - generic [ref=e1378]:
                      - generic [ref=e1379]:
                        - term [ref=e1380]: Created
                        - definition [ref=e1381]: 2026-01-01
                      - generic [ref=e1382]:
                        - term [ref=e1383]: Fingerprint
                        - definition [ref=e1384]: "-"
                  - group "Resource actions" [ref=e1386]:
                    - button "Edit" [ref=e1387] [cursor=pointer]:
                      - generic [ref=e1388]: Edit
              - listitem [ref=e1389]:
                - generic [ref=e1391]:
                  - strong [ref=e1393]: Empty resource group
                  - generic [ref=e1394]:
                    - paragraph [ref=e1395]: No resources
                    - paragraph [ref=e1396]: Add product-owned copy here.
        - generic [ref=e1397]:
          - generic [ref=e1398]:
            - heading "Risk area" [level=3] [ref=e1399]
            - paragraph [ref=e1400]: Use explicit text in addition to color.
          - generic [ref=e1401]:
            - note [ref=e1402]:
              - strong [ref=e1403]: Review
              - generic [ref=e1404]: Confirm consequences before continuing.
            - generic [ref=e1405]:
              - generic [ref=e1406]:
                - strong [ref=e1407]: Destructive action
                - paragraph [ref=e1408]: Product copy explains the outcome and recovery path.
              - button "Continue" [ref=e1410] [cursor=pointer]:
                - generic [ref=e1411]: Continue
            - generic [ref=e1412]:
              - generic [ref=e1413]: Confirmation phrase
              - paragraph [ref=e1414]: Type the exact phrase to continue.
              - code [ref=e1415]: CONFIRM
              - textbox "Confirmation phrase" [ref=e1416]: CONF
    - article [ref=e1417]:
      - generic [ref=e1418]:
        - generic [ref=e1419]: ElSiteHeader
        - generic [ref=e1420]: focus
      - generic "Audit site header" [ref=e1422]:
        - generic [ref=e1424]:
          - generic [ref=e1425]:
            - link "FsusUI" [ref=e1427] [cursor=pointer]:
              - /url: "#audit-brand"
            - navigation "Primary navigation" [ref=e1428]:
              - link "Docs" [ref=e1429] [cursor=pointer]:
                - /url: "#audit-docs"
              - link "Components" [ref=e1430] [cursor=pointer]:
                - /url: "#audit-components"
          - button "Action" [ref=e1432] [cursor=pointer]:
            - generic [ref=e1433]: Action
    - article [ref=e1434]:
      - generic [ref=e1435]:
        - generic [ref=e1436]: ElSelect
        - generic [ref=e1437]: focus
      - generic [ref=e1442] [cursor=pointer]:
        - combobox "Select" [ref=e1443]
        - img [ref=e1446]
    - article [ref=e1448]:
      - generic [ref=e1449]:
        - generic [ref=e1450]: ElSelectV2
        - generic [ref=e1451]: focus
      - generic [ref=e1454] [cursor=pointer]:
        - combobox [ref=e1456]
        - img [ref=e1459]
    - article [ref=e1461]:
      - generic [ref=e1462]:
        - generic [ref=e1463]: ElSlider
        - generic [ref=e1464]: focus
      - slider "el.slider.defaultLabel" [ref=e1469] [cursor=pointer]
    - article [ref=e1471]:
      - generic [ref=e1472]:
        - generic [ref=e1473]: ElSkeleton
        - generic [ref=e1474]: focus
      - img [ref=e1478]
    - article [ref=e1481]:
      - generic [ref=e1482]:
        - generic [ref=e1483]: ElSkeletonItem
        - generic [ref=e1484]: focus
    - article [ref=e1488]:
      - generic [ref=e1489]:
        - generic [ref=e1490]: ElSpace
        - generic [ref=e1491]: focus
      - generic [ref=e1493]:
        - button "A" [ref=e1495] [cursor=pointer]:
          - generic [ref=e1496]: A
        - button "B" [ref=e1498] [cursor=pointer]:
          - generic [ref=e1499]: B
    - article [ref=e1500]:
      - generic [ref=e1501]:
        - generic [ref=e1502]: ElStatistic
        - generic [ref=e1503]: focus
      - generic [ref=e1505]:
        - generic [ref=e1506]: Active users
        - generic [ref=e1507]: 128,000
    - article [ref=e1508]:
      - generic [ref=e1509]:
        - generic [ref=e1510]: ElStep
        - generic [ref=e1511]: focus
      - list [ref=e1513]:
        - listitem [ref=e1514]:
          - generic [ref=e1515]:
            - generic [ref=e1519]: "1"
            - generic [ref=e1521]: Draft
            - generic [ref=e1522]: finish
        - listitem [ref=e1523]:
          - generic [ref=e1524]:
            - generic [ref=e1528]: "2"
            - generic [ref=e1530]: Review
            - generic [ref=e1531]: process
        - listitem [ref=e1532]:
          - generic [ref=e1533]:
            - generic [ref=e1536]: "3"
            - generic [ref=e1538]: Ship
            - generic [ref=e1539]: wait
    - article [ref=e1540]:
      - generic [ref=e1541]:
        - generic [ref=e1542]: ElSteps
        - generic [ref=e1543]: focus
      - list [ref=e1545]:
        - listitem [ref=e1546]:
          - generic [ref=e1547]:
            - generic [ref=e1551]: "1"
            - generic [ref=e1552]:
              - generic [ref=e1553]: 撰写
              - generic [ref=e1554]: 整理正文
            - generic [ref=e1555]: finish
        - listitem [ref=e1556]:
          - generic [ref=e1557]:
            - generic [ref=e1561]: "2"
            - generic [ref=e1562]:
              - generic [ref=e1563]: 复核
              - generic [ref=e1564]: 检查权限
            - generic [ref=e1565]: process
        - listitem [ref=e1566]:
          - generic [ref=e1567]:
            - generic [ref=e1570]: "3"
            - generic [ref=e1571]:
              - generic [ref=e1572]: 发布
              - generic [ref=e1573]: 同步公开页
            - generic [ref=e1574]: wait
    - article [ref=e1575]:
      - generic [ref=e1576]:
        - generic [ref=e1577]: ElSubMenu
        - generic [ref=e1578]: focus
      - menubar [ref=e1580]:
        - menuitem "Sub menu" [expanded] [ref=e1581]:
          - generic [ref=e1582] [cursor=pointer]:
            - text: Sub menu
            - img [ref=e1584]
          - menu [ref=e1586]:
            - menuitem "Nested item" [ref=e1587] [cursor=pointer]
    - article [ref=e1588]:
      - generic [ref=e1589]:
        - generic [ref=e1590]: ElSwitch
        - generic [ref=e1591]: focus
      - generic [ref=e1593]:
        - switch
        - generic [ref=e1595] [cursor=pointer]: Closed
        - generic [ref=e1599] [cursor=pointer]: Open
    - article [ref=e1600]:
      - generic [ref=e1601]:
        - generic [ref=e1602]: ElTabPane
        - generic [ref=e1603]: focus
      - generic [ref=e1605]:
        - tablist [ref=e1609]:
          - tab "First" [selected] [ref=e1611]
          - tab "Second" [ref=e1612]
        - tabpanel "First" [ref=e1614]: First pane
    - article [ref=e1615]:
      - generic [ref=e1616]:
        - generic [ref=e1617]: ElTable
        - generic [ref=e1618]: focus
      - generic [ref=e1621]:
        - table [ref=e1623]:
          - rowgroup [ref=e1627]:
            - row "Name State" [ref=e1628]:
              - columnheader "Name" [ref=e1629]:
                - generic [ref=e1630]: Name
              - columnheader "State" [ref=e1631]:
                - generic [ref=e1632]: State
        - table [ref=e1637]:
          - rowgroup [ref=e1641]:
            - row "Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready with extended lifecycle metadata" [ref=e1642]:
              - cell "Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1643]:
                - generic [ref=e1644]: Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - cell "Ready with extended lifecycle metadata" [ref=e1645]:
                - generic [ref=e1646]: Ready with extended lifecycle metadata
            - row "Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Idle" [ref=e1647]:
              - cell "Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1648]:
                - generic [ref=e1649]: Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
              - cell "Idle" [ref=e1650]:
                - generic [ref=e1651]: Idle
    - article [ref=e1653]:
      - generic [ref=e1654]:
        - generic [ref=e1655]: ElTableColumn
        - generic [ref=e1656]: focus
      - generic [ref=e1659]:
        - table [ref=e1661]:
          - rowgroup [ref=e1664]:
            - row "Column" [ref=e1665]:
              - generic [ref=e1667]: Column
        - table [ref=e1672]:
          - rowgroup [ref=e1675]:
            - row "Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1676]:
              - cell "Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1677]:
                - generic [ref=e1678]: Alpha Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
            - row "Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1679]:
              - cell "Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1680]:
                - generic [ref=e1681]: Beta Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
    - article [ref=e1683]:
      - generic [ref=e1684]:
        - generic [ref=e1685]: ElAutoResizer
        - generic [ref=e1686]: focus
      - table [ref=e1691]:
        - rowgroup [ref=e1692]:
          - generic [ref=e1694]:
            - row "Row 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready" [ref=e1695]:
              - cell "Row 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1696]:
                - generic "Row 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1697]
              - cell "Ready" [ref=e1698]:
                - generic "Ready" [ref=e1699]
            - row "Row 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Review" [ref=e1700]:
              - cell "Row 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1701]:
                - generic "Row 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1702]
              - cell "Review" [ref=e1703]:
                - generic "Review" [ref=e1704]
            - row "Row 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready" [ref=e1705]:
              - cell "Row 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1706]:
                - generic "Row 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1707]
              - cell "Ready" [ref=e1708]:
                - generic "Ready" [ref=e1709]
            - row "Row 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Review" [ref=e1710]:
              - cell "Row 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1711]:
                - generic "Row 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1712]
              - cell "Review" [ref=e1713]:
                - generic "Review" [ref=e1714]
            - row "Row 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready" [ref=e1715]:
              - cell "Row 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1716]:
                - generic "Row 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1717]
              - cell "Ready" [ref=e1718]:
                - generic "Ready" [ref=e1719]
        - rowgroup [ref=e1721]:
          - row "Name / long boundary heading State / dense metadata" [ref=e1723]:
            - columnheader "Name / long boundary heading" [ref=e1724]:
              - generic "Name / long boundary heading" [ref=e1725]
            - columnheader "State / dense metadata" [ref=e1726]:
              - generic "State / dense metadata" [ref=e1727]
    - article [ref=e1728]:
      - generic [ref=e1729]:
        - generic [ref=e1730]: ElTableV2
        - generic [ref=e1731]: focus
      - table [ref=e1735]:
        - rowgroup [ref=e1736]:
          - generic [ref=e1738]:
            - row "Row 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready" [ref=e1739]:
              - cell "Row 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1740]:
                - generic "Row 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1741]
              - cell "Ready" [ref=e1742]:
                - generic "Ready" [ref=e1743]
            - row "Row 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Review" [ref=e1744]:
              - cell "Row 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1745]:
                - generic "Row 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1746]
              - cell "Review" [ref=e1747]:
                - generic "Review" [ref=e1748]
            - row "Row 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready" [ref=e1749]:
              - cell "Row 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1750]:
                - generic "Row 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1751]
              - cell "Ready" [ref=e1752]:
                - generic "Ready" [ref=e1753]
            - row "Row 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Review" [ref=e1754]:
              - cell "Row 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1755]:
                - generic "Row 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1756]
              - cell "Review" [ref=e1757]:
                - generic "Review" [ref=e1758]
            - row "Row 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback Ready" [ref=e1759]:
              - cell "Row 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1760]:
                - generic "Row 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1761]
              - cell "Ready" [ref=e1762]:
                - generic "Ready" [ref=e1763]
        - rowgroup [ref=e1765]:
          - row "Name / long boundary heading State / dense metadata" [ref=e1767]:
            - columnheader "Name / long boundary heading" [ref=e1768]:
              - generic "Name / long boundary heading" [ref=e1769]
            - columnheader "State / dense metadata" [ref=e1770]:
              - generic "State / dense metadata" [ref=e1771]
    - article [ref=e1772]:
      - generic [ref=e1773]:
        - generic [ref=e1774]: ElTabs
        - generic [ref=e1775]: focus
      - generic [ref=e1777]:
        - tablist [ref=e1781]:
          - tab "First" [selected] [ref=e1783]
          - tab "Second" [ref=e1784]
        - tabpanel "First" [ref=e1786]: First content
    - article [ref=e1787]:
      - generic [ref=e1788]:
        - generic [ref=e1789]: ElTag
        - generic [ref=e1790]: focus
      - generic [ref=e1792]:
        - generic [ref=e1794]: Tag
        - generic [ref=e1796]: Info
    - article [ref=e1797]:
      - generic [ref=e1798]:
        - generic [ref=e1799]: ElText
        - generic [ref=e1800]: focus
      - generic [ref=e1802]: Editorial text sample
    - article [ref=e1803]:
      - generic [ref=e1804]:
        - generic [ref=e1805]: ElThemeModeToggle
        - generic [ref=e1806]: focus
      - radiogroup "Theme mode" [ref=e1808]:
        - generic [ref=e1809]:
          - radio "Light" [checked] [ref=e1810]
          - generic [ref=e1811] [cursor=pointer]: Light
        - generic [ref=e1812]:
          - radio "Dark" [ref=e1813]
          - generic [ref=e1814] [cursor=pointer]: Dark
        - generic [ref=e1815]:
          - radio "System" [ref=e1816]
          - generic [ref=e1817] [cursor=pointer]: System
    - article [ref=e1818]:
      - generic [ref=e1819]:
        - generic [ref=e1820]: ElTimePicker
        - generic [ref=e1821]: focus
      - combobox [ref=e1823]:
        - generic [ref=e1824]:
          - img [ref=e1827]
          - textbox "Pick time" [ref=e1831]: 17:30:00
    - article [ref=e1832]:
      - generic [ref=e1833]:
        - generic [ref=e1834]: ElTimeSelect
        - generic [ref=e1835]: focus
      - generic [ref=e1840] [cursor=pointer]:
        - img [ref=e1843]
        - combobox "Select time" [ref=e1847]
        - img [ref=e1850]
    - article [ref=e1852]:
      - generic [ref=e1853]:
        - generic [ref=e1854]: ElTimeline
        - generic [ref=e1855]: focus
      - list [ref=e1857]:
        - listitem [ref=e1858]:
          - generic [ref=e1861]:
            - generic [ref=e1862]: 2026/05/20
            - generic [ref=e1863]: Audit started
        - listitem [ref=e1864]:
          - generic [ref=e1866]:
            - generic [ref=e1867]: 2026/05/21
            - generic [ref=e1868]: Review
    - article [ref=e1869]:
      - generic [ref=e1870]:
        - generic [ref=e1871]: ElTimelineItem
        - generic [ref=e1872]: focus
      - list [ref=e1874]:
        - listitem [ref=e1875]:
          - generic [ref=e1877]:
            - generic [ref=e1878]: Timeline item
            - generic [ref=e1879]: 2026/05/20
    - article [ref=e1880]:
      - generic [ref=e1881]:
        - generic [ref=e1882]: ElTooltip
        - generic [ref=e1883]: focus
      - button "Tooltip" [ref=e1885] [cursor=pointer]:
        - generic [ref=e1886]: Tooltip
    - article [ref=e1887]:
      - generic [ref=e1888]:
        - generic [ref=e1889]: ElTooltipV2
        - generic [ref=e1890]: focus
      - button "Tooltip V2" [ref=e1892] [cursor=pointer]:
        - generic [ref=e1893]: Tooltip V2
    - article [ref=e1894]:
      - generic [ref=e1895]:
        - generic [ref=e1896]: ElTransfer
        - generic [ref=e1897]: focus
      - generic [ref=e1900]:
        - generic [ref=e1901]:
          - paragraph [ref=e1902]:
            - generic [ref=e1903] [cursor=pointer]:
              - generic [ref=e1904]:
                - checkbox "列表 1 0/17"
              - generic [ref=e1906]:
                - text: 列表 1
                - generic [ref=e1907]: 0/17
          - generic [ref=e1908]:
            - generic [ref=e1910]:
              - img [ref=e1913]
              - textbox "Search" [ref=e1915]
            - group "checkbox-group" [ref=e1916]:
              - generic [ref=e1917] [cursor=pointer]:
                - generic [ref=e1918]:
                  - checkbox "发布前校对 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "发布前校对 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1921]
              - generic [ref=e1922] [cursor=pointer]:
                - generic [ref=e1923]:
                  - checkbox "更新封面图 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "更新封面图 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1926]
              - generic [ref=e1927] [cursor=pointer]:
                - generic [ref=e1928]:
                  - checkbox "复核评论设置 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "复核评论设置 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1931]
              - generic [ref=e1932]:
                - generic [ref=e1933] [cursor=pointer]:
                  - checkbox "写入审计记录 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [disabled]
                - generic "写入审计记录 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1936]
              - generic [ref=e1937] [cursor=pointer]:
                - generic [ref=e1938]:
                  - checkbox "刷新搜索索引 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "刷新搜索索引 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1941]
              - generic [ref=e1942] [cursor=pointer]:
                - generic [ref=e1943]:
                  - checkbox "生成分享摘要 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "生成分享摘要 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1946]
              - generic [ref=e1947] [cursor=pointer]:
                - generic [ref=e1948]:
                  - checkbox "同步首页推荐 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "同步首页推荐 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1951]
              - generic [ref=e1952] [cursor=pointer]:
                - generic [ref=e1953]:
                  - checkbox "校验附件大小 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "校验附件大小 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1956]
              - generic [ref=e1957] [cursor=pointer]:
                - generic [ref=e1958]:
                  - checkbox "通知协作者 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "通知协作者 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1961]
              - generic [ref=e1962] [cursor=pointer]:
                - generic [ref=e1963]:
                  - checkbox "归档过期草稿 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "归档过期草稿 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1966]
              - generic [ref=e1967] [cursor=pointer]:
                - generic [ref=e1968]:
                  - checkbox "检查外链状态 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "检查外链状态 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1971]
              - generic [ref=e1972] [cursor=pointer]:
                - generic [ref=e1973]:
                  - checkbox "更新标签分组 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "更新标签分组 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1976]
              - generic [ref=e1977] [cursor=pointer]:
                - generic [ref=e1978]:
                  - checkbox "预热公开缓存 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "预热公开缓存 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1981]
              - generic [ref=e1982] [cursor=pointer]:
                - generic [ref=e1983]:
                  - checkbox "记录发布说明 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "记录发布说明 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1986]
              - generic [ref=e1987] [cursor=pointer]:
                - generic [ref=e1988]:
                  - checkbox "检查摘要长度 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "检查摘要长度 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1991]
              - generic [ref=e1992] [cursor=pointer]:
                - generic [ref=e1993]:
                  - checkbox "更新发布时间 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "更新发布时间 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e1996]
              - generic [ref=e1997] [cursor=pointer]:
                - generic [ref=e1998]:
                  - checkbox "生成回滚说明 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "生成回滚说明 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2001]
        - generic [ref=e2002]:
          - button "列表 2 → 列表 1" [disabled] [ref=e2003]:
            - img [ref=e2006]
          - button "列表 1 → 列表 2" [disabled] [ref=e2008]:
            - img [ref=e2011]
        - generic [ref=e2013]:
          - paragraph [ref=e2014]:
            - generic [ref=e2015] [cursor=pointer]:
              - generic [ref=e2016]:
                - checkbox "列表 2 0/1"
              - generic [ref=e2018]:
                - text: 列表 2
                - generic [ref=e2019]: 0/1
          - generic [ref=e2020]:
            - generic [ref=e2022]:
              - img [ref=e2025]
              - textbox "Search" [ref=e2027]
            - group "checkbox-group" [ref=e2028]:
              - generic [ref=e2029] [cursor=pointer]:
                - generic [ref=e2030]:
                  - checkbox "同步成员权限 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback"
                - generic "同步成员权限 - Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2033]
    - article [ref=e2034]:
      - generic [ref=e2035]:
        - generic [ref=e2036]: ElTree
        - generic [ref=e2037]: focus
      - tree [ref=e2039]:
        - treeitem "Level one Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [expanded] [ref=e2040]:
          - generic [ref=e2041] [cursor=pointer]:
            - img [ref=e2043]
            - generic [ref=e2046]:
              - checkbox
            - generic [ref=e2048]: Level one Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - group [ref=e2049]:
            - treeitem "Level two Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2050]:
              - generic [ref=e2051] [cursor=pointer]:
                - img [ref=e2053]
                - generic [ref=e2056]:
                  - checkbox
                - generic [ref=e2058]: Level two Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
    - article [ref=e2059]:
      - generic [ref=e2060]:
        - generic [ref=e2061]: ElTreeSelect
        - generic [ref=e2062]: focus
      - generic [ref=e2067] [cursor=pointer]:
        - combobox "请选择" [ref=e2068]: Level one Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
        - img [ref=e2071]
    - article [ref=e2073]:
      - generic [ref=e2074]:
        - generic [ref=e2075]: ElTreeV2
        - generic [ref=e2076]: focus
      - tree [ref=e2078]:
        - generic [ref=e2081]:
          - treeitem "Node 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [expanded] [ref=e2082]:
            - generic [ref=e2083] [cursor=pointer]:
              - img [ref=e2085]
              - generic [ref=e2087]: Node 0 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - treeitem "Nested node Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2088]:
            - generic [ref=e2090] [cursor=pointer]: Nested node Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - treeitem "Node 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2091]:
            - generic [ref=e2093] [cursor=pointer]: Node 1 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - treeitem "Node 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2094]:
            - generic [ref=e2096] [cursor=pointer]: Node 2 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - treeitem "Node 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2097]:
            - generic [ref=e2099] [cursor=pointer]: Node 3 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - treeitem "Node 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2100]:
            - generic [ref=e2102] [cursor=pointer]: Node 4 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
          - treeitem "Node 5 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback" [ref=e2103]:
            - generic [ref=e2105] [cursor=pointer]: Node 5 Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback
    - article [ref=e2107]:
      - generic [ref=e2108]:
        - generic [ref=e2109]: ElUpload
        - generic [ref=e2110]: focus
      - generic [ref=e2112]:
        - generic [ref=e2114] [cursor=pointer]:
          - img [ref=e2116]
          - generic [ref=e2118]:
            - text: Drop a file here or
            - emphasis [ref=e2119]: browse
          - paragraph [ref=e2120]: PNG/JPG, max 10 MB
        - list
    - article [ref=e2121]:
      - generic [ref=e2122]:
        - generic [ref=e2123]: ElWatermark
        - generic [ref=e2124]: focus
```

# Test source

```ts
  676 |       const selector = [
  677 |         'button:not([disabled])',
  678 |         '[role="button"]:not([aria-disabled="true"])',
  679 |         'input:not([disabled])',
  680 |         'textarea:not([disabled])',
  681 |         'a[href]',
  682 |       ].join(',')
  683 | 
  684 |       const isVisible = (node: HTMLElement) => {
  685 |         const style = getComputedStyle(node)
  686 |         const rect = node.getBoundingClientRect()
  687 |         if (
  688 |           style.display === 'none' ||
  689 |           style.visibility === 'hidden' ||
  690 |           Number(style.opacity) === 0 ||
  691 |           rect.width <= 0 ||
  692 |           rect.height <= 0
  693 |         ) {
  694 |           return false
  695 |         }
  696 |         if ((node as HTMLButtonElement).disabled) return false
  697 |         if (node.getAttribute('aria-disabled') === 'true') return false
  698 |         return true
  699 |       }
  700 | 
  701 |       const scrollParents = (node: HTMLElement) => {
  702 |         const parents: HTMLElement[] = []
  703 |         let current: HTMLElement | null = node.parentElement
  704 |         while (current) {
  705 |           const style = getComputedStyle(current)
  706 |           const scrollable =
  707 |             /(auto|scroll|overlay)/.test(style.overflowY) ||
  708 |             /(auto|scroll|overlay)/.test(style.overflow) ||
  709 |             current.scrollHeight > current.clientHeight + 1
  710 |           if (scrollable) parents.push(current)
  711 |           current = current.parentElement
  712 |         }
  713 |         return parents
  714 |       }
  715 | 
  716 |       const bringInsideSafeRect = (node: HTMLElement) => {
  717 |         node.scrollIntoView({
  718 |           block: 'center',
  719 |           inline: 'nearest',
  720 |           behavior: 'instant' as ScrollBehavior,
  721 |         })
  722 | 
  723 |         // Fine-tune scroll parents so the control lands inside the safe
  724 |         // rectangle (home-indicator / notch), not merely inside the viewport.
  725 |         for (let pass = 0; pass < 3; pass += 1) {
  726 |           const rect = node.getBoundingClientRect()
  727 |           const deltaTop = safe.top + tolerance - rect.top
  728 |           const deltaBottom = rect.bottom - (safe.bottom - tolerance)
  729 |           const deltaLeft = safe.left + tolerance - rect.left
  730 |           const deltaRight = rect.right - (safe.right - tolerance)
  731 |           if (
  732 |             deltaTop <= 0 &&
  733 |             deltaBottom <= 0 &&
  734 |             deltaLeft <= 0 &&
  735 |             deltaRight <= 0
  736 |           ) {
  737 |             return
  738 |           }
  739 | 
  740 |           for (const parent of scrollParents(node)) {
  741 |             if (deltaTop > 0) parent.scrollTop -= deltaTop
  742 |             if (deltaBottom > 0) parent.scrollTop += deltaBottom
  743 |             if (deltaLeft > 0) parent.scrollLeft -= deltaLeft
  744 |             if (deltaRight > 0) parent.scrollLeft += deltaRight
  745 |           }
  746 |         }
  747 |       }
  748 | 
  749 |       return Array.from(element.querySelectorAll<HTMLElement>(selector))
  750 |         .filter((node) => isVisible(node))
  751 |         .flatMap((node) => {
  752 |           bringInsideSafeRect(node)
  753 |           const rect = node.getBoundingClientRect()
  754 |           const detail = {
  755 |             bottom: rect.bottom,
  756 |             className: node.className?.toString?.() ?? '',
  757 |             left: rect.left,
  758 |             right: rect.right,
  759 |             role: node.getAttribute('role') ?? node.tagName.toLowerCase(),
  760 |             top: rect.top,
  761 |           }
  762 |           const outside =
  763 |             rect.left < safe.left - tolerance ||
  764 |             rect.top < safe.top - tolerance ||
  765 |             rect.right > safe.right + tolerance ||
  766 |             rect.bottom > safe.bottom + tolerance
  767 |           return outside ? [detail] : []
  768 |         })
  769 |     },
  770 |     { safeRect, tolerance: safeAreaGeometryTolerance },
  771 |   )
  772 | 
  773 |   expect(
  774 |     offenders,
  775 |     `${label} must stay inside safe rect ${JSON.stringify(safeRect)} under profile ${profile.id}`,
> 776 |   ).toEqual([])
      |     ^ Error: drawer-ttb/landscape-notch must stay inside safe rect {"left":59,"top":0,"right":785,"bottom":369,"width":726,"height":369} under profile landscape-notch
  777 | }
  778 | 
  779 | /**
  780 |  * Overlay actions (close/confirm/cancel/prev/next/drawer close) are focusable
  781 |  * and can be activated. On short-visual, the last action scrolls into view.
  782 |  */
  783 | export const assertOverlayActionsReachable = async (
  784 |   page: Page,
  785 |   actions: Locator[],
  786 |   options: { shortVisual?: boolean; label?: string } = {},
  787 | ) => {
  788 |   const label = options.label ?? 'overlay actions'
  789 |   expect(actions.length, `${label} must provide at least one action`).toBeGreaterThan(
  790 |     0,
  791 |   )
  792 | 
  793 |   for (let index = 0; index < actions.length; index += 1) {
  794 |     const action = actions[index]
  795 |     await expect(action, `${label}[${index}] visible`).toBeVisible()
  796 | 
  797 |     // Always scroll the action into the nearest scrollport. Long dialog bodies
  798 |     // can push footer/header chrome out of the drawable viewport first.
  799 |     await action.evaluate((element) => {
  800 |       element.scrollIntoView({
  801 |         block: 'center',
  802 |         inline: 'nearest',
  803 |         behavior: 'instant' as ScrollBehavior,
  804 |       })
  805 |     })
  806 |     await action.scrollIntoViewIfNeeded().catch(() => undefined)
  807 | 
  808 |     const box = await readBox(action)
  809 |     expect(box.width, `${label}[${index}] width`).toBeGreaterThan(0)
  810 |     expect(box.height, `${label}[${index}] height`).toBeGreaterThan(0)
  811 | 
  812 |     const viewport = page.viewportSize()
  813 |     expect(viewport).not.toBeNull()
  814 |     if (viewport) {
  815 |       const intersects =
  816 |         box.right > safeAreaGeometryTolerance &&
  817 |         box.bottom > safeAreaGeometryTolerance &&
  818 |         box.left < viewport.width - safeAreaGeometryTolerance &&
  819 |         box.top < viewport.height - safeAreaGeometryTolerance
  820 |       expect(
  821 |         intersects,
  822 |         `${label}[${index}] must intersect the viewport after scroll (box=${JSON.stringify(box)})`,
  823 |       ).toBe(true)
  824 |     }
  825 | 
  826 |     await action.focus({ timeout: 2_000 }).catch(async () => {
  827 |       // Some controls are role=button spans; click-focus as fallback.
  828 |       await action.click({ trial: true }).catch(() => undefined)
  829 |     })
  830 | 
  831 |     const focused = await action.evaluate(
  832 |       (element) =>
  833 |         element === document.activeElement ||
  834 |         element.contains(document.activeElement),
  835 |     )
  836 |     // Keyboard focus is required when the control is tabbable.
  837 |     const tabIndex = await action.evaluate((element) =>
  838 |       element.getAttribute('tabindex'),
  839 |     )
  840 |     if (tabIndex !== '-1') {
  841 |       expect(focused, `${label}[${index}] must accept focus`).toBe(true)
  842 |     }
  843 |   }
  844 | }
  845 | 
  846 | /** Body must not grow uncontrolled horizontal overflow under a profile. */
  847 | export const assertNoBodyOverflowLeak = async (
  848 |   page: Page,
  849 |   label = 'body overflow',
  850 | ) => {
  851 |   const overflow = await page.evaluate(() => ({
  852 |     bodyScrollWidth: document.body.scrollWidth,
  853 |     clientWidth: document.documentElement.clientWidth,
  854 |     scrollWidth: document.documentElement.scrollWidth,
  855 |   }))
  856 | 
  857 |   expect(
  858 |     overflow.scrollWidth,
  859 |     `${label}: document scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
  860 |   ).toBeLessThanOrEqual(overflow.clientWidth + safeAreaGeometryTolerance)
  861 |   expect(
  862 |     overflow.bodyScrollWidth,
  863 |     `${label}: body scrollWidth ${overflow.bodyScrollWidth} > clientWidth ${overflow.clientWidth}`,
  864 |   ).toBeLessThanOrEqual(overflow.clientWidth + safeAreaGeometryTolerance)
  865 | }
  866 | 
  867 | /**
  868 |  * Directional Drawer: panel stays edge-attached; content padding consumes the
  869 |  * edge-relevant safe-area insets only.
  870 |  */
  871 | export const assertDirectionalDrawerSafeInsets = async (
  872 |   page: Page,
  873 |   direction: 'ltr' | 'rtl' | 'ttb' | 'btt',
  874 |   profile: SafeAreaProfile,
  875 |   label = 'drawer',
  876 | ) => {
```