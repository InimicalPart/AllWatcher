import { BrowserController } from "@src/browser.js"
import { Platform } from "@src/lib/base/base-platform.js"
import { Client, User } from "discord-rpc"


export type AWG = typeof global & {
    client: Client,
    clientIDMap: {},
    browser: BrowserController,
    config: {
        [key: string]: any
    },
    user: User & {
        global_name?: string,
    },
    websiteMap: Map<RegExp, Platform>
}