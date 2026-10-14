export interface BackendAPI {
    getUptime(): Promise<number>,
    longTask(callback: (status: string) => void): Promise<void>,
    greeting(callback: (message: string) => Promise<string>): Promise<string>,
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

    const greetButton = document.createElement('button')
    greetButton.textContent = 'Greet'
    document.body.appendChild(greetButton)
    greetButton.addEventListener('click', async () => {
        const message = await api.greeting(async (msg) => {
            // prompt the user to input
            return Promise.resolve(prompt(msg) || '')
        })
        alert(message)
    })
}, false);

