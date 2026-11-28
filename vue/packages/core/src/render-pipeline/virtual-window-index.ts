const nextPowerOfTwo = (value: number) => {
  let capacity = 1
  while (capacity < Math.max(1, value)) capacity *= 2
  return capacity
}

/**
 * Mutable prefix-size index used by variable-height virtual windows.
 * Point updates and prefix/offset lookups are O(log N); total is O(1).
 */
export class FsusVirtualSizeIndex {
  private capacity = 1
  private countValue = 0
  private tree = new Float64Array(2)

  constructor(values: readonly number[] = []) {
    this.rebuild(values)
  }

  get count() {
    return this.countValue
  }

  get total() {
    return this.tree[1] ?? 0
  }

  append(value: number) {
    if (this.countValue === this.capacity) {
      const values = Array.from({ length: this.countValue }, (_, index) =>
        this.get(index),
      )
      values.push(value)
      this.rebuild(values)
      return
    }

    const index = this.countValue
    this.countValue += 1
    this.writeLeaf(index, value)
  }

  findFirstEndAtLeast(target: number) {
    return this.findByEnd(target, false)
  }

  findFirstEndGreater(target: number) {
    return this.findByEnd(target, true)
  }

  get(index: number) {
    if (index < 0 || index >= this.countValue) return 0
    return this.tree[this.capacity + index] ?? 0
  }

  prefixSize(endExclusive: number) {
    let left = this.capacity
    let right =
      this.capacity + Math.min(this.countValue, Math.max(0, endExclusive))
    let sum = 0

    while (left < right) {
      if (left % 2 === 1) sum += this.tree[left++] ?? 0
      if (right % 2 === 1) sum += this.tree[--right] ?? 0
      left = Math.floor(left / 2)
      right = Math.floor(right / 2)
    }

    return sum
  }

  rebuild(values: readonly number[]) {
    this.countValue = values.length
    this.capacity = nextPowerOfTwo(values.length)
    this.tree = new Float64Array(this.capacity * 2)
    for (let index = 0; index < values.length; index += 1) {
      this.tree[this.capacity + index] = values[index] ?? 0
    }
    for (let index = this.capacity - 1; index > 0; index -= 1) {
      this.tree[index] =
        (this.tree[index * 2] ?? 0) + (this.tree[index * 2 + 1] ?? 0)
    }
  }

  truncate(nextCount: number) {
    const normalized = Math.min(
      this.countValue,
      Math.max(0, Math.floor(nextCount)),
    )
    for (let index = this.countValue - 1; index >= normalized; index -= 1) {
      this.writeLeaf(index, 0)
    }
    this.countValue = normalized
  }

  update(index: number, value: number) {
    if (index < 0 || index >= this.countValue) return false
    if (this.get(index) === value) return false
    this.writeLeaf(index, value)
    return true
  }

  private findByEnd(target: number, strict: boolean) {
    if (this.countValue === 0) return 0
    if (strict ? this.total <= target : this.total < target) {
      return this.countValue
    }

    let node = 1
    let remaining = target
    while (node < this.capacity) {
      const left = node * 2
      const leftTotal = this.tree[left] ?? 0
      const chooseLeft = strict ? leftTotal > remaining : leftTotal >= remaining
      if (chooseLeft) {
        node = left
      } else {
        remaining -= leftTotal
        node = left + 1
      }
    }

    return Math.min(this.countValue, node - this.capacity)
  }

  private writeLeaf(index: number, value: number) {
    let node = this.capacity + index
    this.tree[node] = value
    node = Math.floor(node / 2)
    while (node > 0) {
      this.tree[node] =
        (this.tree[node * 2] ?? 0) + (this.tree[node * 2 + 1] ?? 0)
      node = Math.floor(node / 2)
    }
  }
}
