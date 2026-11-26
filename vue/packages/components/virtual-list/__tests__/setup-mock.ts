const defineGetter = <T extends object>(
  obj: T,
  prop: PropertyKey,
  value: ((this: T) => unknown) | unknown,
  defaultValue?: unknown,
) => {
  let oldValue = defaultValue
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop) || {}
  const { configurable, get } = descriptor

  if (defaultValue === undefined && get === undefined) {
    oldValue = Reflect.get(obj, prop)
  }

  const oldGetter = get ?? (() => oldValue)
  const getter =
    typeof value === 'function' ? (value as (this: T) => unknown) : () => value

  Object.defineProperty(obj, prop, {
    configurable: true,
    get: getter,
  })

  return () => {
    Object.defineProperty(obj, prop, {
      configurable,
      get: oldGetter,
    })
  }
}

export default () => {
  const clientWidth = defineGetter(
    HTMLElement.prototype,
    'clientWidth',
    function (this: HTMLElement) {
      return Number.parseInt(this.style.width, 10) || 0
    },
    0,
  )

  const clientHeight = defineGetter(
    HTMLElement.prototype,
    'clientHeight',
    function (this: HTMLElement) {
      return Number.parseInt(this.style.height, 10) || 0
    },
    0,
  )

  const scrollHeight = defineGetter(
    HTMLElement.prototype,
    'scrollHeight',
    () => Number.MAX_SAFE_INTEGER,
    0,
  )

  const scrollWidth = defineGetter(
    HTMLElement.prototype,
    'scrollWidth',
    () => Number.MAX_SAFE_INTEGER,
    0,
  )

  return () => {
    clientWidth()
    clientHeight()
    scrollHeight()
    scrollWidth()
  }
}
