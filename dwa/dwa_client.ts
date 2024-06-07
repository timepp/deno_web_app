export async function fetchAPI(cmd:string, ...args:any[]){
    const proto = window.location.protocol
    const host = window.location.hostname
    const port = 8080
    const resp = await fetch(`${proto}//${host}:${port}/api?cmd=${cmd}&args=${encodeURIComponent(JSON.stringify(args))}`)
    return await resp.json()
}
