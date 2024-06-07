// this doesn't work in TSC
// import { fetchAPI } from './dwa/dwa_client.ts'

export async function fetchAPI(cmd:string, ...args:any[]){
    const resp = await fetch(`/api?cmd=${cmd}&args=${encodeURIComponent(JSON.stringify(args))}`)
    return await resp.json()
}

export const api = {
    checkResult: async function (_a:number, _b:number, _res:number) {
        return await fetchAPI('checkResult', arguments) as string
    },
    getWindows: async function () {
        return await fetchAPI('getWindows', arguments) as {title:string, className:string}[]
    }
}
