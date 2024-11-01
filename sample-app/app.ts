import { parseArgs } from "jsr:@std/cli@0.224.7/parse-args"
import { apiImpl } from './api-impl.ts'
import * as denoUI from "../index.ts"

const args = parseArgs(Deno.args)
const release = args.release || !import.meta.url.startsWith('file://')
const memoryAssets = release? (await import('./release-assets.ts')).assets : {}

await denoUI.startDenoUI({
    appName: 'dui-sample-app',
    frontendRoot: 'frontend',
    apiImpl,
    release,
    memoryAssets
})
