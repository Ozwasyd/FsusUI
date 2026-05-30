import { nextTick } from 'vue'

const tick = async (times: number) => {
  while (times--) {
    await nextTick()
  }
}

export default tick

// in order to test transitions, we need to use
// await rAF() after firing transition events.
export const rAF = async () => {
  await new Promise((res) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        res(null)
        await nextTick()
      })
    })
  })
  await nextTick()
  await new Promise((res) => setTimeout(res, 20))
  await nextTick()
}
