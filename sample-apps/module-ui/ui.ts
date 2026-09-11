export interface BackendAPI {
    getUptime(): Promise<number>
}

import { createClient } from 'jsr:@timepp/dui/client'
export const api = createClient<BackendAPI>()

document.addEventListener('DOMContentLoaded', function() {
    const div = document.createElement('div')
    document.body.appendChild(div)
    setInterval(async () => {
        const uptime = await api.getUptime()
        div.textContent = `System Uptime: ${uptime} seconds`
    }, 1000)
}, false);

