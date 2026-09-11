import * as denoUI from 'jsr:@timepp/dui'
import type { BackendAPI } from "./ui.ts"

const apiImpl: BackendAPI = {
    getUptime: async () => {
        return Deno.osUptime()
    }
}

await denoUI.startDenoUI({
    appName: 'dui-sample-app:module-ui',
    ui: new URL('./ui.ts', import.meta.url),
    api: apiImpl,
})
