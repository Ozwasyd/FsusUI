// Asset declarations must be ambient modules, not module augmentations.
declare module '*.css' {}

// theme-chalk side-effect style imports
declare module '@element-plus/theme-chalk/*.css' {}
declare module '@element-plus/theme-chalk/src/*.scss' {}
declare module '@element-plus/theme-chalk/src/**/*.scss' {}
