export async function runFullBuildTasks<T>(
  entry: () => Promise<unknown>,
  files: readonly T[],
  buildLocale: (file: T) => Promise<unknown>,
): Promise<void> {
  await entry()
  for (const file of files) await buildLocale(file)
}
