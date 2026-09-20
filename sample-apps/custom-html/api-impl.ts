export type NetworkInfo = {
    name: string;
    family: "IPv4" | "IPv6";
    address: string;
    netmask: string;
    scopeid: number | null;
    cidr: string;
    mac: string;
}

export const apiImpl = {
    getNetworkInfo: function (name: string): NetworkInfo[] {
        const ni = Deno.networkInterfaces()
        return ni.filter(n => !name || n.name === name)
    }
}

export type BackendAPI = typeof apiImpl
