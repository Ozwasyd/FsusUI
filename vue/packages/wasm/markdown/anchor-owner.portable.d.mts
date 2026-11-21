export function createOwnerAbi(imports: object): {
  memory: { readonly buffer: ArrayBuffer }
  _initialize(): void
  fa_alloc(size: number): number
  fa_collect(pointer: number, length: number): number
  fa_data(): number
  fa_free(pointer: number): void
}
