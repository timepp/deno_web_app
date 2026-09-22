import * as denoUI from 'jsr:@timepp/dui'
import type { BackendAPI } from "./ui.ts"

const apiImpl: BackendAPI = {
    getUptime: async () => {
        return Deno.osUptime()
    },
    longTask: async (callback: (status: string) => void) => {
        for (let i = 0; i < 10; i++) {
            callback(`Progress: ${i + 1}/10`)
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }
}

await denoUI.startDenoUI({
    appName: 'dui-sample-app:module-ui',
    ui: new URL('./ui.ts', import.meta.url),
    api: apiImpl,
})
