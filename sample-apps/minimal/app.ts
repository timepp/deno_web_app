import * as denoUI from "../../index.ts"
import type { BackendAPI } from "./ui.ts"

const apiImpl: BackendAPI = {
    getUptime: async () => {
        // Implement the logic to get network info here
        return Deno.osUptime()
    }
}

await denoUI.startDenoUI({
    appName: 'dui-sample-app:minimal',
    ui: new URL('./ui.ts', import.meta.url),
    api: apiImpl,
})
