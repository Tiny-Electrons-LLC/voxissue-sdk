import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'vue/index': 'src/vue/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Never bundle Vue/router into our output - they're the consumer's singletons.
  external: ['vue', 'vue-router', 'react'],
  target: 'es2020',
})
