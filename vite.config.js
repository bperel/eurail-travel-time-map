import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import {defineConfig} from "vite";

export default defineConfig({
  server: {
    port: 3000
  },
  base: '/',

  resolve: {
    alias: {
      process: "process/browser",
      stream: "stream-browserify",
      zlib: "browserify-zlib",
      util: "util",
    },
    fallback: {
      'assert': require.resolve('assert/') // don't forget  to install assert (npm i --save-dev assert)
    }
  },

  define: {
    'process.env': {}
  },

  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      },
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true
        })
      ]
    }
  },
})
