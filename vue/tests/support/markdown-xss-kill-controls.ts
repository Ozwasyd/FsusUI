export type MarkdownXssKillControl = {
  expectedViolation: string
  html: string
  id: string
}

export const markdownXssKillControls: Readonly<
  Record<string, MarkdownXssKillControl>
> = Object.freeze({
  'raw-html-enabled': Object.freeze({
    expectedViolation: 'forbidden-element:script',
    html: '<p>control</p><script>globalThis.__FSUS_XSS__=1</script>',
    id: 'raw-html-enabled',
  }),
  'string-safe-sink': Object.freeze({
    expectedViolation: 'forbidden-element:iframe',
    html: '<iframe srcdoc="<script>parent.__FSUS_XSS__=1</script>"></iframe>',
    id: 'string-safe-sink',
  }),
  'feature-direct-dom': Object.freeze({
    expectedViolation: 'forbidden-element:foreignobject',
    html: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><form action="https://attacker.invalid"></form></foreignObject></svg>',
    id: 'feature-direct-dom',
  }),
  'dangerous-url-allowed': Object.freeze({
    expectedViolation: 'dangerous-url:javascript:',
    html: '<a href="javascript:globalThis.__FSUS_XSS__=1">control</a>',
    id: 'dangerous-url-allowed',
  }),
  'event-attribute-allowed': Object.freeze({
    expectedViolation: 'event-attribute:onerror',
    html: '<img src="/control.png" onerror="globalThis.__FSUS_XSS__=1">',
    id: 'event-attribute-allowed',
  }),
  'namespace-allowed': Object.freeze({
    expectedViolation: 'forbidden-element:foreignobject',
    html: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>control</div></foreignObject></svg>',
    id: 'namespace-allowed',
  }),
})
