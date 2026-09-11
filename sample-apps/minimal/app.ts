import { startDenoUI } from 'jsr:@timepp/dui'

await startDenoUI({
    appName: 'dui-sample-app:minimal',
    title: 'Deno UI Minimal Demo',

    api: {
        getUptime() {
            return Deno.osUptime()
        }
    },

    ui(api) {
        document.body.style.cssText = `
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: system-ui, sans-serif;
            background: #f4f6f8;
            color: #18212f;
        `

        const card = document.createElement('main')
        card.style.cssText = `
            padding: 2rem 2.5rem;
            border-radius: 1rem;
            background: white;
            box-shadow: 0 1rem 3rem #18212f20;
            text-align: center;
        `
        card.innerHTML = '<h1>Deno UI</h1><p>Loading system uptime…</p>'
        document.body.appendChild(card)

        const output = card.querySelector('p')!
        const refresh = async () => {
            const uptime = await api.getUptime()
            output.textContent = `System uptime: ${Math.floor(uptime).toLocaleString()} seconds`
        }
        refresh()
        setInterval(refresh, 1000)
    }
})
