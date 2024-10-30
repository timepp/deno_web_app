let ws: WebSocket | null = null
let requestID = 0
const pendingPromises = new Map<number, (value: any) => void>()
export async function getWebSocket() {
    if (!ws) {
        const proto = window.location.protocol
        const host = window.location.hostname
        const params = new URLSearchParams(window.location.search)
        const port = params.get('_apiPort') || window.location.port || (proto === 'https:' ? '443' : '80')
        const url = (proto === 'https:' ? 'wss:' : 'ws:') + '//' + host + ':' + port
        ws = new WebSocket(url)
        ws.onclose = () => { 
            console.log('close...')
            close() 
        }
        ws.onmessage = e => {
            const { id, result } = JSON.parse(e.data)
            pendingPromises.get(id)!(result)
            pendingPromises.delete(id)
        }
        await new Promise(resolve => ws!.onopen = resolve)
    }
    return ws
}

// call api using web socket
export async function callAPI(args: IArguments, cmd?: string) {
    if (!cmd) {
        const parent = new Error().stack?.split('\n')[2].match(/at ([^(]+)/)?.[1]
        cmd = parent?.split('.').slice(-1)[0].trim()
    }
    const ws = await getWebSocket()
    ws.send(JSON.stringify({ id: ++requestID, cmd, args: [...args] }))
    return new Promise(resolve => pendingPromises.set(requestID, resolve))
}
