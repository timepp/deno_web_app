/** @type {import('vite').UserConfig} */
export default {
    // ...
    root: 'frontend',
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `[name].js`,
          chunkFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`
        }
      }
    }
  }