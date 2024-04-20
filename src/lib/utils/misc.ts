import { AWG } from "@src/types/types.js";
import DiscordRPC from "discord-rpc";
import { readdirSync } from "fs";
import { join } from "path";

declare const global: AWG

export async function connectToDiscordsIPC(asPlatform: string) {
    let client: DiscordRPC.Client
    try {
        client = global.client ?? new DiscordRPC.Client({ transport: "ipc" });
        if (global.client) await client.destroy()
        await client.login({ clientId: asPlatform });
    } catch (err) {
        if (err.message === "Could not connect") {
            return false
        } else console.error(err)
    }
    return client
}

export async function isRemoteDebuggingAvailable() {
    try {
        const browserResponse = await fetch("http://localhost:9222/json/version")
        return browserResponse.status === 200 ? await browserResponse.json() : false
    } catch (err) {
        return false
    }
}


export async function checkMissingPlatformHandlers() {
    const clientIdMap = {}

    for (let platform of Object.keys(process.env).filter(key => key.startsWith("PLATFORM_"))) {
        clientIdMap[platform.replace("PLATFORM_", "").toLowerCase()] = process.env[platform]
    }

    const platforms = []
    for (let file of readdirSync(join(process.cwd(), 'dist/platforms'))) {
        if ((file as string).endsWith('.js')) {
            platforms.push((file as string).replace('.js', ''))
        }
    }

    let missing = platforms.filter(platform => !Object.keys(clientIdMap).includes(platform))
    return missing.length > 0 ? missing : false
}

export async function loadClientIDs() {
    const clientIdMap: {
        [key: string]: string
    } = {}

    for (let platform of Object.keys(process.env).filter(key => key.startsWith("PLATFORM_"))) {
        clientIdMap[platform.replace("PLATFORM_", "").toLowerCase()] = process.env[platform]
    }

    return clientIdMap
}

async function getPages() {
    
}