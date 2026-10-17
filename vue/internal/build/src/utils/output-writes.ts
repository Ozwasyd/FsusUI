import type { OutputOptions, RollupBuild, RollupOutput } from 'rollup'

export async function writeBundles(
  bundle: RollupBuild,
  options: OutputOptions[],
): Promise<RollupOutput[]> {
  const outputs: RollupOutput[] = []
  for (const option of options) outputs.push(await bundle.write(option))
  return outputs
}
