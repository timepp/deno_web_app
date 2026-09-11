import { createClient } from 'jsr:@timepp/dui/client'

export type NetworkInfo = {
    name: string;
    family: "IPv4" | "IPv6";
    address: string;
    netmask: string;
    scopeid: number | null;
    cidr: string;
    mac: string;
}

export interface BackendAPI {
    getNetworkInfo(name: string): Promise<NetworkInfo[]>
}

export const api = createClient<BackendAPI>()

