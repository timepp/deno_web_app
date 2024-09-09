import * as vite from 'npm:vite@5.3.3'
import * as fs from 'jsr:@std/fs'
import * as enc from 'jsr:@std/encoding@1.0.1'

const root = 'frontend'
const r = await vite.build({
    root,
    configFile: 'vite.config.js',
})

const files = fs.expandGlobSync('**/*', { root: root + '/dist', includeDirs: false})
const assetsLines = [...files].map(f => `  "${f.name}": "${enc.encodeBase64(Deno.readFileSync(f.path))}"`)
const assetsTs = Deno.readTextFileSync('assets.ts')
// replace object definition in assetsTs
const newAssetsTs = assetsTs.replace(/export const assets: Record<string, string> = {[^}]*}/, `export const assets: Record<string, string> = {\n${assetsLines.join(',\n')}\n}`)
Deno.writeTextFileSync('assets.ts', newAssetsTs)
