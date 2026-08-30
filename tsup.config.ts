import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'vue/index': 'src/vue/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Never bundle Vue/router into our output - they're the consumer's singletons.
  external: ['vue', 'vue-router'],
  // modern-screenshot + jszip stay external too; the consumer's bundler
  // dedupes/tree-shakes them (they're declared deps, npm installs them).
  target: 'es2020',
})
