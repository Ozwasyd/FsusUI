import path from 'path'
import chalk from 'chalk'
import { dest, parallel, series, src } from 'gulp'
import gulpSass from 'gulp-sass'
import dartSass from 'sass'
import autoprefixer from 'gulp-autoprefixer'
import cleanCSS from 'gulp-clean-css'
import rename from 'gulp-rename'
import consola from 'consola'
import { epOutput } from '@element-plus/build-utils'
import type { TaskFunction } from 'gulp'

const distFolder = path.resolve(__dirname, 'dist')
const distBundle = path.resolve(epOutput, 'theme-chalk')
/* fsus-theme.scss is included here so it compiles to its own per-component
   CSS bundle (dist/el-fsus-theme.css). Previously it was excluded and only
   pulled in via @use from src/index.scss, which mixed product overrides
   into the same dist/index.css bundle as the element-plus base styles.
   That mixing made equal-specificity overrides depend on import order,
   which produced silent cascade bugs (e.g. theme-mode-toggle segmented
   rule losing to base .el-radio-button--small rule). The split is the
   structural fix. */
const themeEntryFiles = [path.resolve(__dirname, 'src/*.scss')]

/**
 * compile theme-chalk scss & minify
 * not use sass.sync().on('error', sass.logError) to throw exception
 * @returns
 */
const buildThemeChalk: TaskFunction = () => {
  const sass = gulpSass(dartSass)
  const noElPrefixFile = /(index|base|display)/
  return src(themeEntryFiles)
    .pipe(
      sass.sync({
        silenceDeprecations: [
          'legacy-js-api',
          'global-builtin',
          'color-functions',
          'import',
        ],
      })
    )
    .pipe(autoprefixer({ cascade: false }))
    .pipe(
      cleanCSS({}, (details) => {
        consola.success(
          `${chalk.cyan(details.name)}: ${chalk.yellow(
            details.stats.originalSize / 1000
          )} KB -> ${chalk.green(details.stats.minifiedSize / 1000)} KB`
        )
      })
    )
    .pipe(
      rename((path) => {
        if (!noElPrefixFile.test(path.basename)) {
          path.basename = `el-${path.basename}`
        }
      })
    )
    .pipe(dest(distFolder))
}

/**
 * copy from packages/theme-chalk/dist to dist/element-plus/theme-chalk
 */
export const copyThemeChalkBundle: TaskFunction = () =>
  src(`${distFolder}/**`).pipe(dest(distBundle))

/**
 * copy source file to packages
 */

export const copyThemeChalkSource: TaskFunction = () =>
  src(path.resolve(__dirname, 'src/**')).pipe(
    dest(path.resolve(distBundle, 'src'))
  )

export const build: TaskFunction = parallel(
  copyThemeChalkSource,
  series(buildThemeChalk, copyThemeChalkBundle)
)

export default build
