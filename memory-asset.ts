import * as vite from 'npm:vite@5.3.3'
import * as fs from 'jsr:@std/fs@1.0.5'
import * as path from 'jsr:@std/path@1.0.7'
import * as enc from 'jsr:@std/encoding@1.0.1'

export function createMemoryAssets(files: {name:string, path:string}[], assetsFile: string) {
  const assetsLines = files.map(f => `  "${f.name}": "${enc.encodeBase64(Deno.readFileSync(f.path))}"`)
  const assetsTs = `export const assets: Record<string, string> = {\n${assetsLines.join(',\n')}\n}\n`
  Deno.writeTextFileSync(assetsFile, assetsTs)
}

export function saveMemoryAssets(assets: Record<string, string>, root: string) {
  Deno.mkdirSync(root)
  for (const [name, data] of Object.entries(assets)) {
    const filePath = root + '/' + name
    fs.ensureDirSync(path.dirname(filePath))
    Deno.writeFileSync(filePath, enc.decodeBase64(data))
  }
}

export async function buildViteDistAsMemoryAssets(root: string, assetsFile: string) {
    const r = await vite.build({
        root,
        build: {
            rollupOptions: {
              output: {
                entryFileNames: `[name].js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`
              }
            }
          }
    })

    const files = fs.expandGlobSync('**/*', { root: root + '/dist', includeDirs: false})
    createMemoryAssets([...files], assetsFile)
}
