export async function fetchAPI(cmd:string, ...args:any[]){
    const resp = await fetch(`/api?cmd=${cmd}&args=${encodeURIComponent(JSON.stringify(args))}`)
    return await resp.json()
}
