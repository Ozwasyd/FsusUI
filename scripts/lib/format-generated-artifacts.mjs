import path from 'node:path'
import { format, resolveConfig } from 'prettier'

export async function createArtifactFormatter(root, shouldFormat = () => true) {
  const config = await resolveConfig(path.join(root, 'package.json'))

  return async (files) =>
    Object.fromEntries(
      await Promise.all(
        Object.entries(files).map(async ([relativePath, content]) => [
          relativePath,
          shouldFormat(relativePath)
            ? await format(content, {
                ...(config ?? {}),
                filepath: path.join(root, relativePath),
              })
            : content,
        ]),
      ),
    )
}
