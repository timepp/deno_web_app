export interface BackendAPI {
    getUptime(): Promise<number>,
    longTask(callback: (status: string) => void): Promise<void>,
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

    const log = document.createElement('pre')
    document.body.appendChild(log)
    api.longTask((status) => {
        log.textContent += status + '\n'
    })
}, false);

