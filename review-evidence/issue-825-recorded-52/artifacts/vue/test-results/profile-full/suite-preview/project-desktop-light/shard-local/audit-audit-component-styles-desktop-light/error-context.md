# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audit.spec.ts >> audit component styles
- Location: vue/tests/visual/audit.spec.ts:4:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-testid="unique-tree-select"]').locator('.el-select__popper').locator('.el-tree-node__content').filter({ hasText: 'Level one 1' }).first()

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "Form" [level=2] [ref=e5]
  - generic [ref=e6]:
    - banner [ref=e7]:
      - heading "Publish an editorial update" [level=3] [ref=e8]
      - paragraph [ref=e9]: Complete the release details, review validation guidance, and attach the approved cover asset.
      - generic "Fixture language" [ref=e10]:
        - button "English" [pressed] [ref=e11] [cursor=pointer]
        - button "简体中文" [ref=e12] [cursor=pointer]
    - generic [ref=e13]:
      - generic [ref=e14]:
        - heading "Release details" [level=4] [ref=e15]
        - generic [ref=e16]:
          - generic [ref=e17]: Public title
          - generic [ref=e18]:
            - textbox "Public title" [ref=e21]:
              - /placeholder: Summarize the update for readers
            - paragraph [ref=e22]: Use the same title shown in the release timeline.
        - generic [ref=e23]:
          - generic [ref=e24]: Audience
          - generic [ref=e25]:
            - generic [ref=e29] [cursor=pointer]:
              - combobox "Audience" [ref=e30]
              - img [ref=e33]
            - paragraph [ref=e35]: This setting also controls search indexing.
        - generic [ref=e36]:
          - generic [ref=e37]: Release summary for readers, reviewers, and support responders
          - generic [ref=e38]:
            - textbox "Release summary for readers, reviewers, and support responders" [ref=e40]:
              - /placeholder: Explain what changed and what readers should do next
            - paragraph [ref=e41]: Add a concrete next step before requesting approval.
            - paragraph [ref=e42]: Explain the customer impact, the rollout boundary, and the exact recovery action a reader should take if the updated workflow is unavailable.
      - generic [ref=e43]:
        - heading "Schedule" [level=4] [ref=e44]
        - generic [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e47]: Review limit
            - generic [ref=e48]:
              - generic [ref=e49]:
                - button "el.inputNumber.decrease" [ref=e50] [cursor=pointer]:
                  - img [ref=e52]
                - button "el.inputNumber.increase" [ref=e54] [cursor=pointer]:
                  - img [ref=e56]
                - spinbutton "Review limit" [ref=e60]: "5"
              - paragraph [ref=e61]: Days before review expires.
          - generic [ref=e62]:
            - generic [ref=e63]: Publish date
            - generic [ref=e64]:
              - combobox [ref=e65]:
                - generic [ref=e66]:
                  - img [ref=e69]
                  - textbox "Publish date" [ref=e71]:
                    - /placeholder: Choose a date
                    - text: 2026-10-08
              - paragraph [ref=e72]: Displayed in Asia/Shanghai.
          - generic [ref=e73]:
            - generic [ref=e74]: Time zone
            - generic [ref=e75]:
              - generic [ref=e79] [cursor=pointer]:
                - combobox "Time zone" [ref=e80]: Asia/Shanghai (UTC+8)
                - img [ref=e83]
              - paragraph [ref=e85]: Used by scheduled publishing.
      - generic [ref=e86]:
        - heading "Review window" [level=4] [ref=e87]
        - button "Toggle start-date validation example" [ref=e88] [cursor=pointer]:
          - generic [ref=e89]: Toggle start-date validation example
        - generic [ref=e90]:
          - generic [ref=e91]:
            - generic [ref=e92]: Starts
            - generic [ref=e93]:
              - combobox [ref=e94]:
                - generic [ref=e95]:
                  - img [ref=e98]
                  - textbox "Starts" [ref=e100]:
                    - /placeholder: Start date
                    - text: 2026-10-08
              - paragraph [ref=e101]: Reviewers receive access.
          - generic [ref=e102]:
            - generic [ref=e103]: Ends
            - generic [ref=e104]:
              - combobox [ref=e105]:
                - generic [ref=e106]:
                  - img [ref=e109]
                  - textbox "Ends" [ref=e111]:
                    - /placeholder: End date
                    - text: 2026-10-09
              - paragraph [ref=e112]: Open feedback becomes read-only.
      - generic [ref=e113]:
        - heading "Approved cover asset" [level=4] [ref=e114]
        - group "Cover image" [ref=e115]:
          - generic [ref=e116]: Cover image
          - generic [ref=e118]:
            - generic [ref=e120] [cursor=pointer]:
              - generic [ref=e121]: Drop the approved image here or choose a local file.
              - paragraph [ref=e122]: PNG or JPEG, up to 2 MB. The editorial crop is 16:9.
            - paragraph [ref=e123]: The current draft still needs an approved cover image.
            - list
      - generic [ref=e124]:
        - heading "Read-only and processing states" [level=4] [ref=e125]
        - generic [ref=e126]:
          - generic [ref=e127]: Release owner
          - generic [ref=e128]:
            - textbox "Release owner" [disabled] [ref=e131]: Editorial operations
            - paragraph [ref=e132]: Ownership changes require administrator approval.
        - group "Approval controls" [ref=e133]:
          - generic [ref=e134]: Approval controls
          - generic [ref=e135]:
            - generic [ref=e136] [cursor=pointer]:
              - generic [ref=e137]:
                - checkbox "Require editor approval before publishing" [checked]
              - generic [ref=e139]: Require editor approval before publishing
            - generic [ref=e140]:
              - switch [checked]
              - generic [ref=e142] [cursor=pointer]: Do not notify
              - generic [ref=e146] [cursor=pointer]: Notify reviewers
            - radiogroup "radio-group" [ref=e147]:
              - generic [ref=e148] [cursor=pointer]:
                - radio "Approval required" [checked] [ref=e150]
                - generic [ref=e152]: Approval required
              - generic [ref=e153] [cursor=pointer]:
                - radio "Advisory review" [ref=e155]
                - generic [ref=e157]: Advisory review
        - button "Checking release policy" [disabled]:
          - generic:
            - generic:
              - img
          - generic: Checking release policy
  - generic [ref=e158]:
    - banner [ref=e159]:
      - heading "Dark form state authority matrix" [level=3] [ref=e160]
      - paragraph [ref=e161]: Compare readable guidance, secondary state text, and structural borders without changing control geometry.
    - generic [ref=e162]:
      - generic [ref=e163]:
        - heading "Input" [level=4] [ref=e164]
        - generic [ref=e165]:
          - generic [ref=e166]:
            - generic [ref=e167]: Input · default
            - textbox [ref=e170]
            - paragraph [ref=e171]: Required release guidance remains readable.
          - generic [ref=e172]:
            - generic [ref=e173]: Input · hover
            - textbox [ref=e176]
            - paragraph [ref=e177]: Required release guidance remains readable.
          - generic [ref=e178]:
            - generic [ref=e179]: Input · focus
            - textbox [ref=e182]
            - paragraph [ref=e183]: Required release guidance remains readable.
          - generic [ref=e184]:
            - generic [ref=e185]: Input · filled
            - textbox [ref=e188]: Release brief ready
            - paragraph [ref=e189]: Required release guidance remains readable.
          - generic [ref=e190]:
            - generic [ref=e191]: Input · placeholder
            - textbox "Enter release brief" [ref=e194]
            - paragraph [ref=e195]: Required release guidance remains readable.
          - generic [ref=e196]:
            - generic [ref=e197]: Input · disabled
            - textbox [disabled] [ref=e200]: Release brief ready
            - paragraph [ref=e201]: Required release guidance remains readable.
          - generic [ref=e202]:
            - generic [ref=e203]: Input · invalid
            - textbox [ref=e206]
            - paragraph [ref=e207]: Resolve this value before publishing.
      - generic [ref=e208]:
        - heading "Textarea" [level=4] [ref=e209]
        - generic [ref=e210]:
          - generic [ref=e211]:
            - generic [ref=e212]: Textarea · default
            - textbox [ref=e214]
            - paragraph [ref=e215]: Required release guidance remains readable.
          - generic [ref=e216]:
            - generic [ref=e217]: Textarea · hover
            - textbox [ref=e219]
            - paragraph [ref=e220]: Required release guidance remains readable.
          - generic [ref=e221]:
            - generic [ref=e222]: Textarea · focus
            - textbox [ref=e224]
            - paragraph [ref=e225]: Required release guidance remains readable.
          - generic [ref=e226]:
            - generic [ref=e227]: Textarea · filled
            - textbox [ref=e229]: Explain the reader-facing change.
            - paragraph [ref=e230]: Required release guidance remains readable.
          - generic [ref=e231]:
            - generic [ref=e232]: Textarea · placeholder
            - textbox "Add release guidance" [ref=e234]
            - paragraph [ref=e235]: Required release guidance remains readable.
          - generic [ref=e236]:
            - generic [ref=e237]: Textarea · disabled
            - textbox [disabled] [ref=e239]: Explain the reader-facing change.
            - paragraph [ref=e240]: Required release guidance remains readable.
          - generic [ref=e241]:
            - generic [ref=e242]: Textarea · invalid
            - textbox [ref=e244]
            - paragraph [ref=e245]: Resolve this value before publishing.
      - generic [ref=e246]:
        - heading "Select" [level=4] [ref=e247]
        - generic [ref=e248]:
          - generic [ref=e249]:
            - generic [ref=e250]: Select · default
            - generic [ref=e254] [cursor=pointer]:
              - combobox "请选择" [ref=e255]
              - img [ref=e258]
            - paragraph [ref=e260]: Required release guidance remains readable.
          - generic [ref=e261]:
            - generic [ref=e262]: Select · hover
            - generic [ref=e266] [cursor=pointer]:
              - combobox "请选择" [ref=e267]
              - img [ref=e270]
            - paragraph [ref=e272]: Required release guidance remains readable.
          - generic [ref=e273]:
            - generic [ref=e274]: Select · focus
            - generic [ref=e278] [cursor=pointer]:
              - combobox "请选择" [ref=e279]
              - img [ref=e282]
            - paragraph [ref=e284]: Required release guidance remains readable.
          - generic [ref=e285]:
            - generic [ref=e286]: Select · filled
            - generic [ref=e290] [cursor=pointer]:
              - combobox "请选择" [ref=e291]: Signed-in members
              - img [ref=e294]
            - paragraph [ref=e296]: Required release guidance remains readable.
          - generic [ref=e297]:
            - generic [ref=e298]: Select · placeholder
            - generic [ref=e302] [cursor=pointer]:
              - combobox "Choose an audience" [ref=e303]
              - img [ref=e306]
            - paragraph [ref=e308]: Required release guidance remains readable.
          - generic [ref=e309]:
            - generic [ref=e310]: Select · disabled
            - generic [ref=e314]:
              - combobox "请选择" [disabled] [ref=e315]: Signed-in members
              - img [ref=e318]
            - paragraph [ref=e320]: Required release guidance remains readable.
          - generic [ref=e321]:
            - generic [ref=e322]: Select · invalid
            - generic [ref=e326] [cursor=pointer]:
              - combobox "请选择" [ref=e327]
              - img [ref=e330]
            - paragraph [ref=e332]: Resolve this value before publishing.
      - generic [ref=e333]:
        - heading "Select V2" [level=4] [ref=e334]
        - generic [ref=e335]:
          - generic [ref=e336]:
            - generic [ref=e337]: Select V2 · default
            - generic [ref=e339] [cursor=pointer]:
              - combobox [ref=e341]
              - img [ref=e344]
            - paragraph [ref=e346]: Required release guidance remains readable.
          - generic [ref=e347]:
            - generic [ref=e348]: Select V2 · hover
            - generic [ref=e350] [cursor=pointer]:
              - combobox [ref=e352]
              - img [ref=e355]
            - paragraph [ref=e357]: Required release guidance remains readable.
          - generic [ref=e358]:
            - generic [ref=e359]: Select V2 · focus
            - generic [ref=e361] [cursor=pointer]:
              - combobox [ref=e363]
              - img [ref=e366]
            - paragraph [ref=e368]: Required release guidance remains readable.
          - generic [ref=e369]:
            - generic [ref=e370]: Select V2 · filled
            - generic [ref=e372] [cursor=pointer]:
              - combobox [ref=e374]
              - generic [ref=e375]: Editorial approval
              - img [ref=e378]
            - paragraph [ref=e380]: Required release guidance remains readable.
          - generic [ref=e381]:
            - generic [ref=e382]: Select V2 · placeholder
            - generic [ref=e384] [cursor=pointer]:
              - combobox [ref=e386]
              - img [ref=e389]
            - paragraph [ref=e391]: Required release guidance remains readable.
          - generic [ref=e392]:
            - generic [ref=e393]: Select V2 · disabled
            - generic [ref=e395]:
              - combobox [disabled] [ref=e397]
              - generic [ref=e398]: Editorial approval
              - img [ref=e401]
            - paragraph [ref=e403]: Required release guidance remains readable.
          - generic [ref=e404]:
            - generic [ref=e405]: Select V2 · invalid
            - generic [ref=e407] [cursor=pointer]:
              - combobox [ref=e409]
              - img [ref=e412]
            - paragraph [ref=e414]: Resolve this value before publishing.
      - generic [ref=e415]:
        - heading "Date Picker" [level=4] [ref=e416]
        - generic [ref=e417]:
          - generic [ref=e418]:
            - generic [ref=e419]: Date Picker · default
            - combobox [ref=e420]:
              - generic [ref=e421]:
                - img [ref=e424]
                - textbox [ref=e426]
            - paragraph [ref=e427]: Required release guidance remains readable.
          - generic [ref=e428]:
            - generic [ref=e429]: Date Picker · hover
            - combobox [ref=e430]:
              - generic [ref=e431]:
                - img [ref=e434]
                - textbox [ref=e436]
            - paragraph [ref=e437]: Required release guidance remains readable.
          - generic [ref=e438]:
            - generic [ref=e439]: Date Picker · focus
            - combobox [ref=e440]:
              - generic [ref=e441]:
                - img [ref=e444]
                - textbox [ref=e446]
            - paragraph [ref=e447]: Required release guidance remains readable.
          - generic [ref=e448]:
            - generic [ref=e449]: Date Picker · filled
            - combobox [ref=e450]:
              - generic [ref=e451]:
                - img [ref=e454]
                - textbox [ref=e456]: 2026-07-24
            - paragraph [ref=e457]: Required release guidance remains readable.
          - generic [ref=e458]:
            - generic [ref=e459]: Date Picker · placeholder
            - combobox [ref=e460]:
              - generic [ref=e461]:
                - img [ref=e464]
                - textbox "Choose a date" [ref=e466]
            - paragraph [ref=e467]: Required release guidance remains readable.
          - generic [ref=e468]:
            - generic [ref=e469]: Date Picker · disabled
            - combobox [ref=e470]:
              - generic [ref=e471]:
                - img [ref=e474]
                - textbox [disabled] [ref=e476]: 2026-07-24
            - paragraph [ref=e477]: Required release guidance remains readable.
          - generic [ref=e478]:
            - generic [ref=e479]: Date Picker · invalid
            - combobox [ref=e480]:
              - generic [ref=e481]:
                - img [ref=e484]
                - textbox [ref=e486]
            - paragraph [ref=e487]: Resolve this value before publishing.
      - generic [ref=e488]:
        - heading "Time Picker" [level=4] [ref=e489]
        - generic [ref=e490]:
          - generic [ref=e491]:
            - generic [ref=e492]: Time Picker · default
            - combobox [ref=e493]:
              - generic [ref=e494]:
                - img [ref=e497]
                - textbox [ref=e501]
            - paragraph [ref=e502]: Required release guidance remains readable.
          - generic [ref=e503]:
            - generic [ref=e504]: Time Picker · hover
            - combobox [ref=e505]:
              - generic [ref=e506]:
                - img [ref=e509]
                - textbox [ref=e513]
            - paragraph [ref=e514]: Required release guidance remains readable.
          - generic [ref=e515]:
            - generic [ref=e516]: Time Picker · focus
            - combobox [ref=e517]:
              - generic [ref=e518]:
                - img [ref=e521]
                - textbox [ref=e525]
            - paragraph [ref=e526]: Required release guidance remains readable.
          - generic [ref=e527]:
            - generic [ref=e528]: Time Picker · filled
            - combobox [ref=e529]:
              - generic [ref=e530]:
                - img [ref=e533]
                - textbox [ref=e537]: 09:00:00
            - paragraph [ref=e538]: Required release guidance remains readable.
          - generic [ref=e539]:
            - generic [ref=e540]: Time Picker · placeholder
            - combobox [ref=e541]:
              - generic [ref=e542]:
                - img [ref=e545]
                - textbox "Choose a time" [ref=e549]
            - paragraph [ref=e550]: Required release guidance remains readable.
          - generic [ref=e551]:
            - generic [ref=e552]: Time Picker · disabled
            - combobox [ref=e553]:
              - generic [ref=e554]:
                - img [ref=e557]
                - textbox [disabled] [ref=e561]: 09:00:00
            - paragraph [ref=e562]: Required release guidance remains readable.
          - generic [ref=e563]:
            - generic [ref=e564]: Time Picker · invalid
            - combobox [ref=e565]:
              - generic [ref=e566]:
                - img [ref=e569]
                - textbox [ref=e573]
            - paragraph [ref=e574]: Resolve this value before publishing.
      - generic [ref=e575]:
        - heading "Time Select" [level=4] [ref=e576]
        - generic [ref=e577]:
          - generic [ref=e578]:
            - generic [ref=e579]: Time Select · default
            - generic [ref=e583] [cursor=pointer]:
              - img [ref=e586]
              - combobox "请选择" [ref=e590]
              - img [ref=e593]
            - paragraph [ref=e595]: Required release guidance remains readable.
          - generic [ref=e596]:
            - generic [ref=e597]: Time Select · hover
            - generic [ref=e601] [cursor=pointer]:
              - img [ref=e604]
              - combobox "请选择" [ref=e608]
              - img [ref=e611]
            - paragraph [ref=e613]: Required release guidance remains readable.
          - generic [ref=e614]:
            - generic [ref=e615]: Time Select · focus
            - generic [ref=e619] [cursor=pointer]:
              - img [ref=e622]
              - combobox "请选择" [ref=e626]
              - img [ref=e629]
            - paragraph [ref=e631]: Required release guidance remains readable.
          - generic [ref=e632]:
            - generic [ref=e633]: Time Select · filled
            - generic [ref=e637] [cursor=pointer]:
              - img [ref=e640]
              - combobox "请选择" [ref=e644]: 09:00
              - img [ref=e647]
            - paragraph [ref=e649]: Required release guidance remains readable.
          - generic [ref=e650]:
            - generic [ref=e651]: Time Select · placeholder
            - generic [ref=e655] [cursor=pointer]:
              - img [ref=e658]
              - combobox "Choose a release slot" [ref=e662]
              - img [ref=e665]
            - paragraph [ref=e667]: Required release guidance remains readable.
          - generic [ref=e668]:
            - generic [ref=e669]: Time Select · disabled
            - generic [ref=e673]:
              - img [ref=e676]
              - combobox "请选择" [disabled] [ref=e680]: 09:00
              - img [ref=e683]
            - paragraph [ref=e685]: Required release guidance remains readable.
          - generic [ref=e686]:
            - generic [ref=e687]: Time Select · invalid
            - generic [ref=e691] [cursor=pointer]:
              - img [ref=e694]
              - combobox "请选择" [ref=e698]
              - img [ref=e701]
            - paragraph [ref=e703]: Resolve this value before publishing.
      - generic [ref=e704]:
        - heading "Input Number" [level=4] [ref=e705]
        - generic [ref=e706]:
          - generic [ref=e707]:
            - generic [ref=e708]: Input Number · default
            - generic [ref=e709]:
              - button "el.inputNumber.decrease" [ref=e710] [cursor=pointer]:
                - img [ref=e712]
              - button "el.inputNumber.increase" [ref=e714] [cursor=pointer]:
                - img [ref=e716]
              - spinbutton [ref=e720]
            - paragraph [ref=e721]: Required release guidance remains readable.
          - generic [ref=e722]:
            - generic [ref=e723]: Input Number · hover
            - generic [ref=e724]:
              - button "el.inputNumber.decrease" [ref=e725] [cursor=pointer]:
                - img [ref=e727]
              - button "el.inputNumber.increase" [ref=e729] [cursor=pointer]:
                - img [ref=e731]
              - spinbutton [ref=e735]
            - paragraph [ref=e736]: Required release guidance remains readable.
          - generic [ref=e737]:
            - generic [ref=e738]: Input Number · focus
            - generic [ref=e739]:
              - button "el.inputNumber.decrease" [ref=e740] [cursor=pointer]:
                - img [ref=e742]
              - button "el.inputNumber.increase" [ref=e744] [cursor=pointer]:
                - img [ref=e746]
              - spinbutton [ref=e750]
            - paragraph [ref=e751]: Required release guidance remains readable.
          - generic [ref=e752]:
            - generic [ref=e753]: Input Number · filled
            - generic [ref=e754]:
              - button "el.inputNumber.decrease" [ref=e755] [cursor=pointer]:
                - img [ref=e757]
              - button "el.inputNumber.increase" [ref=e759] [cursor=pointer]:
                - img [ref=e761]
              - spinbutton [ref=e765]: "7"
            - paragraph [ref=e766]: Required release guidance remains readable.
          - generic [ref=e767]:
            - generic [ref=e768]: Input Number · placeholder
            - generic [ref=e769]:
              - button "el.inputNumber.decrease" [ref=e770] [cursor=pointer]:
                - img [ref=e772]
              - button "el.inputNumber.increase" [ref=e774] [cursor=pointer]:
                - img [ref=e776]
              - spinbutton [ref=e780]
            - paragraph [ref=e781]: Required release guidance remains readable.
          - generic [ref=e782]:
            - generic [ref=e783]: Input Number · disabled
            - generic [ref=e784]:
              - button "el.inputNumber.decrease" [ref=e785] [cursor=pointer]:
                - img [ref=e787]
              - button "el.inputNumber.increase" [ref=e789] [cursor=pointer]:
                - img [ref=e791]
              - spinbutton [disabled] [ref=e795]: "7"
            - paragraph [ref=e796]: Required release guidance remains readable.
          - generic [ref=e797]:
            - generic [ref=e798]: Input Number · invalid
            - generic [ref=e799]:
              - button "el.inputNumber.decrease" [ref=e800] [cursor=pointer]:
                - img [ref=e802]
              - button "el.inputNumber.increase" [ref=e804] [cursor=pointer]:
                - img [ref=e806]
              - spinbutton [ref=e810]
            - paragraph [ref=e811]: Resolve this value before publishing.
      - generic [ref=e812]:
        - heading "Cascader" [level=4] [ref=e813]
        - generic [ref=e814]:
          - generic [ref=e815]:
            - generic [ref=e816]: Cascader · default
            - generic [ref=e819]:
              - textbox "请选择" [ref=e820] [cursor=pointer]
              - img [ref=e823]
            - paragraph [ref=e825]: Required release guidance remains readable.
          - generic [ref=e826]:
            - generic [ref=e827]: Cascader · hover
            - generic [ref=e830]:
              - textbox "请选择" [ref=e831] [cursor=pointer]
              - img [ref=e834]
            - paragraph [ref=e836]: Required release guidance remains readable.
          - generic [ref=e837]:
            - generic [ref=e838]: Cascader · focus
            - generic [ref=e841]:
              - textbox "请选择" [ref=e842] [cursor=pointer]
              - img [ref=e845]
            - paragraph [ref=e847]: Required release guidance remains readable.
          - generic [ref=e848]:
            - generic [ref=e849]: Cascader · filled
            - generic [ref=e852]:
              - textbox [ref=e853] [cursor=pointer]: Editorial / Release
              - img [ref=e856]
            - paragraph [ref=e858]: Required release guidance remains readable.
          - generic [ref=e859]:
            - generic [ref=e860]: Cascader · placeholder
            - generic [ref=e863]:
              - textbox "Choose a release category" [ref=e864] [cursor=pointer]
              - img [ref=e867]
            - paragraph [ref=e869]: Required release guidance remains readable.
          - generic [ref=e870]:
            - generic [ref=e871]: Cascader · disabled
            - generic [ref=e874]:
              - textbox [disabled] [ref=e875]: Editorial / Release
              - img [ref=e878]
            - paragraph [ref=e880]: Required release guidance remains readable.
          - generic [ref=e881]:
            - generic [ref=e882]: Cascader · invalid
            - generic [ref=e885]:
              - textbox "请选择" [ref=e886] [cursor=pointer]
              - img [ref=e889]
            - paragraph [ref=e891]: Resolve this value before publishing.
      - generic [ref=e892]:
        - heading "Upload" [level=4] [ref=e893]
        - generic [ref=e894]:
          - generic [ref=e895]:
            - generic [ref=e896]: Upload · default
            - generic [ref=e897]:
              - paragraph [ref=e900] [cursor=pointer]: Drop a cover or browse
              - list
            - paragraph [ref=e901]: Required release guidance remains readable.
          - generic [ref=e902]:
            - generic [ref=e903]: Upload · hover
            - generic [ref=e904]:
              - paragraph [ref=e907] [cursor=pointer]: Drop a cover or browse
              - list
            - paragraph [ref=e908]: Required release guidance remains readable.
          - generic [ref=e909]:
            - generic [ref=e910]: Upload · focus
            - generic [ref=e911]:
              - paragraph [ref=e914] [cursor=pointer]: Drop a cover or browse
              - list
            - paragraph [ref=e915]: Required release guidance remains readable.
          - generic [ref=e916]:
            - generic [ref=e917]: Upload · filled
            - generic [ref=e918]:
              - paragraph [ref=e921] [cursor=pointer]: approved-cover.png
              - list
            - paragraph [ref=e922]: Required release guidance remains readable.
          - generic [ref=e923]:
            - generic [ref=e924]: Upload · placeholder
            - generic [ref=e925]:
              - paragraph [ref=e928] [cursor=pointer]: Choose an approved cover
              - list
            - paragraph [ref=e929]: Required release guidance remains readable.
          - generic [ref=e930]:
            - generic [ref=e931]: Upload · disabled
            - generic [ref=e932]:
              - paragraph [ref=e935] [cursor=pointer]: approved-cover.png
              - list
            - paragraph [ref=e936]: Required release guidance remains readable.
          - generic [ref=e937]:
            - generic [ref=e938]: Upload · invalid
            - generic [ref=e939]:
              - paragraph [ref=e942] [cursor=pointer]: Drop a cover or browse
              - list
            - paragraph [ref=e943]: Resolve this value before publishing.
  - generic [ref=e944]:
    - heading "Radio & RadioButton" [level=3] [ref=e945]
    - generic [ref=e946]:
      - radiogroup "radio-group" [ref=e948]:
        - generic [ref=e949] [cursor=pointer]:
          - radio "公开" [checked] [ref=e951]
          - generic [ref=e953]: 公开
        - generic [ref=e954] [cursor=pointer]:
          - radio "仅自己可见" [ref=e956]
          - generic [ref=e958]: 仅自己可见
      - radiogroup "radio-group" [ref=e960]:
        - generic [ref=e961]:
          - radio "公开" [checked] [ref=e962]
          - generic [ref=e963] [cursor=pointer]: 公开
        - generic [ref=e964]:
          - radio "仅自己可见" [ref=e965]
          - generic [ref=e966] [cursor=pointer]: 仅自己可见
  - generic [ref=e967]:
    - heading "Checkbox & CheckboxButton" [level=3] [ref=e968]
    - generic [ref=e969]:
      - generic [ref=e971] [cursor=pointer]:
        - generic [ref=e972]:
          - checkbox "Checkbox" [checked]
        - generic [ref=e974]: Checkbox
      - group "checkbox-group" [ref=e976]:
        - generic [ref=e977] [cursor=pointer]:
          - generic [ref=e978]:
            - checkbox "推送到首页" [checked]
          - generic [ref=e980]: 推送到首页
        - generic [ref=e981] [cursor=pointer]:
          - generic [ref=e982]:
            - checkbox "保持普通"
          - generic [ref=e984]: 保持普通
      - group "checkbox-group" [ref=e986]:
        - generic [ref=e987]:
          - checkbox "推送到首页" [checked] [ref=e988]
          - generic [ref=e989] [cursor=pointer]: 推送到首页
        - generic [ref=e990]:
          - checkbox "保持普通" [ref=e991]
          - generic [ref=e992] [cursor=pointer]: 保持普通
  - generic [ref=e993]:
    - heading "Input" [level=3] [ref=e994]
    - generic [ref=e995]:
      - textbox "输入文章标题" [ref=e999]
      - textbox "写下摘要或更新说明" [ref=e1002]
  - generic [ref=e1003]:
    - heading "InputNumber" [level=3] [ref=e1004]
    - generic [ref=e1005]:
      - generic [ref=e1007]:
        - button "el.inputNumber.decrease" [ref=e1008]:
          - img [ref=e1010]
        - button "el.inputNumber.increase" [ref=e1012] [cursor=pointer]:
          - img [ref=e1014]
        - spinbutton [ref=e1018]: "1"
      - generic [ref=e1020]:
        - button "el.inputNumber.decrease" [ref=e1021]:
          - img [ref=e1023]
        - button "el.inputNumber.increase" [ref=e1025] [cursor=pointer]:
          - img [ref=e1027]
        - spinbutton [ref=e1031]: "1"
      - generic [ref=e1033]:
        - button "el.inputNumber.decrease" [ref=e1034]:
          - img [ref=e1036]
        - button "el.inputNumber.increase" [ref=e1038] [cursor=pointer]:
          - img [ref=e1040]
        - spinbutton [ref=e1044]: "1"
      - generic [ref=e1046]:
        - button "el.inputNumber.decrease" [ref=e1047]:
          - img [ref=e1049]
        - button "el.inputNumber.increase" [ref=e1051] [cursor=pointer]:
          - img [ref=e1053]
        - spinbutton [ref=e1057]: "1"
      - generic [ref=e1059]:
        - button "el.inputNumber.decrease" [ref=e1060]:
          - img [ref=e1062]
        - button "el.inputNumber.increase" [ref=e1064] [cursor=pointer]:
          - img [ref=e1066]
        - spinbutton [ref=e1070]: "1"
      - generic [ref=e1072]:
        - button "el.inputNumber.decrease" [ref=e1073]:
          - img [ref=e1075]
        - button "el.inputNumber.increase" [ref=e1077] [cursor=pointer]:
          - img [ref=e1079]
        - spinbutton [ref=e1083]: "1"
      - generic [ref=e1085]:
        - button "el.inputNumber.decrease" [ref=e1086]:
          - img [ref=e1088]
        - button "el.inputNumber.increase" [ref=e1090] [cursor=pointer]:
          - img [ref=e1092]
        - spinbutton [disabled] [ref=e1096]: "1"
  - generic [ref=e1097]:
    - heading "Select & Option & OptionGroup" [level=3] [ref=e1098]
    - generic [ref=e1102] [cursor=pointer]:
      - combobox "选择可见范围" [ref=e1103]
      - img [ref=e1106]
  - generic [ref=e1108]:
    - heading "SelectV2" [level=3] [ref=e1109]
    - generic [ref=e1111] [cursor=pointer]:
      - combobox [ref=e1113]
      - img [ref=e1116]
  - generic [ref=e1118]:
    - heading "Cascader & CascaderPanel" [level=3] [ref=e1119]
    - generic [ref=e1120]:
      - generic [ref=e1124]:
        - textbox "选择分类" [ref=e1125] [cursor=pointer]
        - img [ref=e1128]
      - menu [ref=e1134]:
        - menuitem "Guide" [ref=e1135] [cursor=pointer]:
          - generic [ref=e1136]: Guide
          - img [ref=e1138]
  - generic [ref=e1140]:
    - heading "Switch" [level=3] [ref=e1141]
    - generic [ref=e1142]:
      - switch [checked]
      - generic [ref=e1144] [cursor=pointer]: Close
      - generic [ref=e1148] [cursor=pointer]: Open
  - generic [ref=e1149]:
    - heading "Slider" [level=3] [ref=e1150]
    - slider "el.slider.defaultLabel" [ref=e1154] [cursor=pointer]
  - generic [ref=e1156]:
    - heading "TimePicker / TimeSelect" [level=3] [ref=e1157]
    - generic [ref=e1158]:
      - combobox [ref=e1160]:
        - generic [ref=e1161]:
          - img [ref=e1164]
          - textbox "选择发布时间" [ref=e1168]
      - generic [ref=e1173] [cursor=pointer]:
        - img [ref=e1176]
        - combobox "选择推送时段" [ref=e1180]
        - img [ref=e1183]
  - generic [ref=e1185]:
    - heading "DatePicker" [level=3] [ref=e1186]
    - generic [ref=e1187]:
      - combobox [ref=e1189]:
        - generic [ref=e1190]:
          - img [ref=e1193]
          - textbox "选择日期" [ref=e1195]: 2026-10-08
      - generic [ref=e1197]:
        - img [ref=e1199]
        - textbox "开始日期" [ref=e1201]: 2026-10-08
        - generic [ref=e1202]: 至
        - textbox "结束日期" [ref=e1203]: 2026-10-08
  - generic [ref=e1204]:
    - heading "Upload" [level=3] [ref=e1205]
    - generic [ref=e1206]:
      - button "上传封面" [ref=e1208] [cursor=pointer]:
        - generic [ref=e1209]: 上传封面
      - generic [ref=e1210]: 支持 jpg/png，单个文件 ≤ 500KB
      - list
  - generic [ref=e1211]:
    - heading "Rate" [level=3] [ref=e1212]
    - slider "rating" [ref=e1213]:
      - img [ref=e1216] [cursor=pointer]
      - img [ref=e1220] [cursor=pointer]
      - img [ref=e1224] [cursor=pointer]
      - generic [ref=e1227] [cursor=pointer]:
        - img [ref=e1228]
        - img [ref=e1231]
      - img [ref=e1235] [cursor=pointer]
  - generic [ref=e1237]:
    - heading "ColorPicker" [level=3] [ref=e1238]
    - button "el.colorpicker.defaultLabel" [ref=e1239]
  - generic [ref=e1243]:
    - heading "Transfer" [level=3] [ref=e1244]
    - generic [ref=e1246]:
      - generic [ref=e1247]:
        - paragraph [ref=e1248]:
          - generic [ref=e1249] [cursor=pointer]:
            - generic [ref=e1250]:
              - checkbox "列表 1 0/15"
            - generic [ref=e1252]:
              - text: 列表 1
              - generic [ref=e1253]: 0/15
        - group "checkbox-group" [ref=e1255]:
          - generic [ref=e1256]:
            - generic [ref=e1257] [cursor=pointer]:
              - checkbox "同步成员权限" [disabled]
            - generic "同步成员权限" [ref=e1260]
          - generic [ref=e1261] [cursor=pointer]:
            - generic [ref=e1262]:
              - checkbox "发布前校对"
            - generic "发布前校对" [ref=e1265]
          - generic [ref=e1266] [cursor=pointer]:
            - generic [ref=e1267]:
              - checkbox "更新封面图"
            - generic "更新封面图" [ref=e1270]
          - generic [ref=e1271] [cursor=pointer]:
            - generic [ref=e1272]:
              - checkbox "复核评论设置"
            - generic "复核评论设置" [ref=e1275]
          - generic [ref=e1276]:
            - generic [ref=e1277] [cursor=pointer]:
              - checkbox "写入审计记录" [disabled]
            - generic "写入审计记录" [ref=e1280]
          - generic [ref=e1281] [cursor=pointer]:
            - generic [ref=e1282]:
              - checkbox "刷新搜索索引"
            - generic "刷新搜索索引" [ref=e1285]
          - generic [ref=e1286] [cursor=pointer]:
            - generic [ref=e1287]:
              - checkbox "生成分享摘要"
            - generic "生成分享摘要" [ref=e1290]
          - generic [ref=e1291] [cursor=pointer]:
            - generic [ref=e1292]:
              - checkbox "同步首页推荐"
            - generic "同步首页推荐" [ref=e1295]
          - generic [ref=e1296]:
            - generic [ref=e1297] [cursor=pointer]:
              - checkbox "校验附件大小" [disabled]
            - generic "校验附件大小" [ref=e1300]
          - generic [ref=e1301] [cursor=pointer]:
            - generic [ref=e1302]:
              - checkbox "通知协作者"
            - generic "通知协作者" [ref=e1305]
          - generic [ref=e1306] [cursor=pointer]:
            - generic [ref=e1307]:
              - checkbox "归档过期草稿"
            - generic "归档过期草稿" [ref=e1310]
          - generic [ref=e1311] [cursor=pointer]:
            - generic [ref=e1312]:
              - checkbox "检查外链状态"
            - generic "检查外链状态" [ref=e1315]
          - generic [ref=e1316]:
            - generic [ref=e1317] [cursor=pointer]:
              - checkbox "更新标签分组" [disabled]
            - generic "更新标签分组" [ref=e1320]
          - generic [ref=e1321] [cursor=pointer]:
            - generic [ref=e1322]:
              - checkbox "预热公开缓存"
            - generic "预热公开缓存" [ref=e1325]
          - generic [ref=e1326] [cursor=pointer]:
            - generic [ref=e1327]:
              - checkbox "记录发布说明"
            - generic "记录发布说明" [ref=e1330]
      - generic [ref=e1331]:
        - button "列表 2 → 列表 1" [disabled] [ref=e1332]:
          - img [ref=e1335]
        - button "列表 1 → 列表 2" [disabled] [ref=e1337]:
          - img [ref=e1340]
      - generic [ref=e1342]:
        - paragraph [ref=e1343]:
          - generic [ref=e1344] [cursor=pointer]:
            - generic [ref=e1345]:
              - checkbox "列表 2 0/0"
            - generic [ref=e1347]:
              - text: 列表 2
              - generic [ref=e1348]: 0/0
        - paragraph [ref=e1350]: 无数据
  - generic [ref=e1351]:
    - heading "Form & FormItem" [level=3] [ref=e1352]
    - generic [ref=e1353]:
      - generic [ref=e1354]:
        - generic [ref=e1355]: 文章标题
        - textbox "文章标题" [ref=e1359]
      - generic [ref=e1360]:
        - generic [ref=e1361]: 可见范围
        - generic [ref=e1367] [cursor=pointer]:
          - combobox "可见范围" [ref=e1368]
          - img [ref=e1371]
  - generic [ref=e1373]:
    - heading "Autocomplete" [level=3] [ref=e1374]
    - combobox [ref=e1375]:
      - textbox [ref=e1378]
  - generic [ref=e1379]:
    - heading "TreeSelect" [level=3] [ref=e1380]
    - generic [ref=e1382]:
      - generic [ref=e1385] [cursor=pointer]:
        - combobox "请选择" [expanded] [active] [ref=e1386]: Level one 1
        - img [ref=e1389]
      - tooltip "Level one 1" [ref=e1391]:
        - listbox [ref=e1395]:
          - tree [ref=e1396]:
            - treeitem "Level one 1" [ref=e1397]:
              - generic [ref=e1398] [cursor=pointer]:
                - img [ref=e1400]
                - option "Level one 1" [selected] [ref=e1402]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
  3  | 
  4  | test('audit component styles', async ({ page }, testInfo) => {
  5  |   test.setTimeout(60_000)
  6  | 
  7  |   const components = [
  8  |     { name: 'Button', route: 'basic', selector: '.el-button' },
  9  |     { name: 'Input', route: 'form', selector: '.el-input__wrapper' },
  10 |     { name: 'Switch', route: 'form', selector: '.el-switch__core' },
  11 |     { name: 'Checkbox', route: 'form', selector: '.el-checkbox__inner' },
  12 |     { name: 'Radio', route: 'form', selector: '.el-radio__inner' },
  13 |     { name: 'Tag', route: 'data', selector: '.el-tag' },
  14 |     { name: 'Card', route: 'others', selector: '.el-card' },
  15 |     { name: 'Alert', route: 'feedback', selector: '.el-alert' },
  16 |     { name: 'Pagination', route: 'data', selector: '.el-pager li' },
  17 |     {
  18 |       name: 'Select-Input',
  19 |       route: 'form',
  20 |       selector: '.el-select .el-input__wrapper',
  21 |     },
  22 |   ]
  23 | 
  24 |   console.log('\n--- GLOBAL RADIUS AUDIT REPORT ---')
  25 |   for (const comp of components) {
  26 |     try {
  27 |       await page.goto(buildVisualUrl(comp.route, testInfo.project.name))
  28 |       await page.waitForSelector('.demo-app-container')
  29 |       const radius = await page.$eval(
  30 |         comp.selector,
  31 |         (el) => window.getComputedStyle(el).borderRadius,
  32 |       )
  33 |       console.log(`[AUDIT] ${comp.name.padEnd(15)}: ${radius}`)
  34 |     } catch {
  35 |       console.log(`[AUDIT] ${comp.name.padEnd(15)}: NOT FOUND`)
  36 |     }
  37 |   }
  38 | 
  39 |   // 特殊审计：TreeSelect
  40 |   await page.goto(buildVisualUrl('form', testInfo.project.name))
  41 |   await page.waitForSelector('.demo-app-container')
  42 |   console.log('\n--- INTERACTION AUDIT: TREESELECT ---')
  43 |   const treeSelect = page.locator('[data-testid="unique-tree-select"]')
  44 |   await treeSelect.locator('.el-input__wrapper').click({ force: true })
  45 |   const treePopper = treeSelect.locator('.el-select__popper')
  46 |   await expect(treePopper).toBeVisible()
  47 | 
  48 |   const treeItem = treePopper
  49 |     .locator('.el-tree-node__content', {
  50 |       hasText: 'Level one 1',
  51 |     })
  52 |     .first()
  53 |   await treeItem.hover()
> 54 |   await treeItem.evaluate((el) => {
     |                  ^ Error: locator.evaluate: Test timeout of 60000ms exceeded.
  55 |     el.closest<HTMLElement>('.el-tree-node')?.focus()
  56 |   })
  57 |   const treeItemStyle = await treeItem.evaluate((el) => {
  58 |     const rowStyle = window.getComputedStyle(el)
  59 |     const rowRect = el.getBoundingClientRect()
  60 |     const option = el.querySelector<HTMLElement>('.el-select-dropdown__item')
  61 |     if (!option) {
  62 |       throw new Error('TreeSelect option item is missing')
  63 |     }
  64 |     const optionStyle = window.getComputedStyle(option)
  65 |     const optionRect = option.getBoundingClientRect()
  66 |     const range = document.createRange()
  67 |     range.selectNodeContents(option)
  68 |     const textRect = range.getBoundingClientRect()
  69 |     range.detach()
  70 |     return {
  71 |       radius: optionStyle.borderRadius,
  72 |       padding: optionStyle.padding,
  73 |       height: rowStyle.height,
  74 |       optionLeftDelta: Math.abs(optionRect.left - rowRect.left),
  75 |       textLeft: textRect.left,
  76 |       itemLeft: optionRect.left,
  77 |       overlap: textRect.left - optionRect.left,
  78 |     }
  79 |   })
  80 |   console.log(`[TREESELECT] Item Radius: ${treeItemStyle.radius}`)
  81 |   console.log(`[TREESELECT] Item Padding: ${treeItemStyle.padding}`)
  82 |   console.log(
  83 |     `[TREESELECT] Text-to-Box Gap: ${treeItemStyle.overlap}px (Should be >= 12px)`,
  84 |   )
  85 |   expect(treeItemStyle.radius).toBe('0px')
  86 |   expect(treeItemStyle.optionLeftDelta).toBe(32)
  87 |   expect(treeItemStyle.overlap).toBeGreaterThanOrEqual(12)
  88 | })
  89 | 
```