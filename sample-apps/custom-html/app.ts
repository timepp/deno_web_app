import { parseArgs } from "jsr:@std/cli@0.224.7/parse-args"
import { apiImpl } from './api-impl.ts'
import * as denoUI from 'jsr:@timepp/dui'

const args = parseArgs(Deno.args)
const memoryAssets = import.meta.url.startsWith('file://')
    ? {}
    : (await import('./release-assets.ts')).assets ?? {}

await denoUI.startDenoUI({
    appName: 'dui-sample-app',
    ui: new URL('./frontend/index.html', import.meta.url),
    api: apiImpl,
    appMode: args.appMode ?? false,
    memoryAssets
})
