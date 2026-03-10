// deno-lint-ignore-file no-unused-vars
import { callAPI } from './frontend/websocket-client.ts'

export type NetworkInfo = {
    name: string;
    family: "IPv4" | "IPv6";
    address: string;
    netmask: string;
    scopeid: number | null;
    cidr: string;
    mac: string;
}

export const api = {
    getNetworkInfo: async function (name: string) {
        return await callAPI(arguments) as NetworkInfo[]
    },
    runCommandAndCaptureOutput: async function (command: string, args: string[]) {
        // Returns a session ID for streaming output
        return await callAPI(arguments) as string
    }
}

export type BackendAPI = typeof api

