import { parseArgs } from "jsr:@std/cli@0.224.7/parse-args"
import { apiImpl } from './api-impl.ts'
import * as denoUI from '../index.ts'

async function main() {
    const args = parseArgs(Deno.args)
    await denoUI.startDenoUI({
        frontendRoot: 'frontend',
        apiImpl,
        release: args.release,
    })
}

await main()
