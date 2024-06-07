import * as wui from "https://win32.deno.dev/0.4.1/UI.WindowsAndMessaging"
import { api } from '../api.ts'

type BackendAPI = typeof api

export const apiImpl: BackendAPI = {
    checkResult: async (a: number, b: number, res: number) => {
        if ((a + b) == res) {
            return `Correct: ${a} + ${b} = ${res}`;
        }
        else {
            return `Incorrect: ${a} + ${b} != ${res}`;
        }
    },
    getWindows: async () => {
        const windows: { title: string, className: string }[] = []
        const cb = new Deno.UnsafeCallback({
            parameters: ['pointer', 'pointer'],
            result: 'bool'
        }, (w, lparam) => {
            const buffer = new Uint16Array(100)
            wui.GetWindowTextW(w, buffer, 100)
            const title = new TextDecoder('utf-16le').decode(buffer).split('\0')[0]
            wui.GetClassNameW(w, buffer, 100)
            const className = new TextDecoder('utf-16le').decode(buffer).split('\0')[0]
            const info = { title, className }
            // console.log(w, info, title, className);
            windows.push(info)
            return true;
        })
        wui.EnumWindows(cb.pointer, null)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return windows
    },
}
