/*
  * Copyright (c) 2024 Inimi | InimicalPart | Incoverse
  *
  * This program is free software: you can redistribute it and/or modify
  * it under the terms of the GNU General Public License as published by
  * the Free Software Foundation, either version 3 of the License, or
  * (at your option) any later version.
  *
  * This program is distributed in the hope that it will be useful,
  * but WITHOUT ANY WARRANTY; without even the implied warranty of
  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  * GNU General Public License for more details.
  *
  * You should have received a copy of the GNU General Public License
  * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
    checkMissingPlatformHandlers,
    connectToDiscordsIPC,
    isRemoteDebuggingAvailable,
    loadClientIDs
} from '@src/lib/utils/misc.js'
import chalk from 'chalk'
import DiscordRPC, { Client } from 'discord-rpc'
import dotenv from 'dotenv'
import { BrowserController } from './browser.js'
import { AWG } from './types/types.js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import JsonCParser from 'jsonc-parser'
import { Platform } from './lib/base/base-platform.js'
import UAParserJS from 'ua-parser-js'
dotenv.config()

const checkEveryMs = 1000 //? Check every 1 second


declare const global: AWG

//! -------------------------------------------------------- !\\
//!       This is the start of the AllWatcher journey.       !\\
//!                                                          !\\
//!        https://github.com/InimicalPart/AllWatcher        !\\
//! -------------------------------------------------------- !\\

let presence;
let RPCName = null
const platformHandlers: {
    [key: string]: any
} = {};

let showAuthor = true;

(async()=>{

    //? Clear the console a slight bit
    for (let i = 0; i < 5; i++) {
        console.log()
    }

    //? Load platform configuration
    global.config = JsonCParser.parse(readFileSync(join(process.cwd(), "config.jsonc")).toString())
    showAuthor = global?.config?.showAuthor ?? true
    
    //? Set up the global object
    global.websiteMap = new Map<RegExp, Platform>()

    //? Check for missing platform handlers
    console.log("Checking for missing platform handlers...")
    const missingHandlers = await checkMissingPlatformHandlers()
    if (missingHandlers) {
        console.log()
        console.error(chalk.redBright("Missing client id for platforms: " + missingHandlers.join(", ")))
        console.error(chalk.redBright("Please run 'npm run setup' to set up the client IDs"))
        return
    } else console.log(chalk.greenBright('All platform handlers are present.'))
    
    //? Load the client IDs for the platforms (from the environment variables)
    console.log("Loading client IDs for each platform...")
    global.clientIDMap = await loadClientIDs()
    console.log(chalk.greenBright(Object.keys(global.clientIDMap).length + " platform client ID(s) loaded:"))
    let longestPlatform = 0
    for (let platform of Object.keys(global.clientIDMap)) {
        if (platform.length > longestPlatform) longestPlatform = platform.length
    }
    for (let platform of Object.keys(global.clientIDMap)) {
        console.log(chalk.yellowBright("  -"), chalk.greenBright(platform.padEnd(longestPlatform, " ")) + ":", chalk.cyanBright(global.clientIDMap[platform]))
    }

    //? Check if Discord's IPC is available
    console.log("Checking if Discord is running, and connecting to its IPC if it is...")
    const discordAvailable = await connectToDiscordsIPC(global.clientIDMap[Object.keys(global.clientIDMap)[0]])
    if (!discordAvailable) {
        return console.error(chalk.redBright("Discord's IPC was not found, or is overloaded. Please make sure Discord is running. If it is, please wait a moment and try again.."))
    } else console.log(chalk.greenBright("Discord's IPC was found and has been connected to."))
    global.client = discordAvailable as Client
    global.user = global.client.user
    RPCName = Object.keys(global.clientIDMap)[0]

    //? Check if remote debugging is available (Chromium-based browsers only)
    console.log("Checking if a browser with remote debugging is available...")
    const remoteDebuggingAvailable = await isRemoteDebuggingAvailable()
    if (!remoteDebuggingAvailable) {
        return console.error(chalk.redBright('Remote debugging was not found, please make sure your Chromium-based browser is running with remote debugging enabled. If it is, please report this issue. If not, please check the README.md for information on how to enable remote debugging.'))
    } else {
        console.log(chalk.greenBright('Remote debugging was found.'))
        const userAgent = remoteDebuggingAvailable["User-Agent"]
        const browserName = new UAParserJS(userAgent).getBrowser().name
        const browserMajorVersion = new UAParserJS(userAgent).getBrowser().version.split(".")[0]
        console.log(chalk.gray("Connected to browser:", chalk.cyanBright(browserName), "Version:", chalk.cyanBright(browserMajorVersion)))
        global.browser = new BrowserController()
        
    }

    //? Load all platforms
    console.log("Loading all platform handlers...")
    for (let file of readdirSync(join(process.cwd(), 'dist/platforms'))) {
        if (file.endsWith('.js')) {
            console.log('Loading platform: ' + chalk.cyanBright(file.replace('.js', '')))
            let a = await import("./platforms/" + file)
            global.websiteMap.set(a.default.matchingRegex, a.default)
        }
    }
    
    await main()
    let running = false;
    let failCount = 0;
    setInterval(async()=>{
        if (!running) {
            failCount = 0
            running = true
            await main()
            running = false
        } else {
            console.log("Already running.")
            failCount++
            if (failCount > 5) {
                console.error("Main function has been unable to run for 5 seconds. Forcing run.")
                failCount = 0
                running = false
            }
        }
    }, checkEveryMs)




})()

async function main() {

    const matching = await getTopTabs()
    const highestPriority = matching[0]?.priority

    //? If there are no important tabs, clear the presence
    if (!highestPriority && highestPriority != 0) {
        if (presence) {
            presence = null;
            await global.client.clearActivity();
            console.log("Cleared presence.")
        }
        console.log("No important tabs found.")
        return
    }

    //? Get the most important tabs
    let interested: any = matching.filter(tab => tab.priority == highestPriority)

    //? If there are multiple tabs, get the most active one
    if (interested.length > 1) {
        let active = []
        //? Check if the tab is visible on the user's screen
        for (let tab of interested) {
            await global.browser.evaluate(tab.id, "document.visibilityState == 'visible'", "visibilityCheck").then(visible => {
                if (visible) active.push(tab)
            })
        }
        //? If there are multiple active tabs, get the one that is focused
        if (active.length > 1) {
            let focus = []
            //? Check if the tab is focused
            for (let tab of active) {
                await global.browser.evaluate(tab.id, "document.hasFocus()", "focusCheck").then(focused => {
                    if (focused) focus.push(tab)
                })
            }
            interested = focus[0] || active[0]
        } else interested = interested[0]
    } else interested = interested[0]


    let platform = platformHandlers[interested.id] ?? new interested.platform(interested.id) as any
    if (!platformHandlers[interested.id]) platformHandlers[interested.id] = platform

    //? Make sure the page matches its RegExp
    if (!platform.matchingRegex.test(interested.url)) {
        console.log("Tab does not match its platform. Updating...")
        const oldPlatform = platform.platform
        platform = new interested.platform(interested.id) as any
        platformHandlers[interested.id] = platform
        console.log("Updated platform from " + oldPlatform + " to " + platform.platform)
    }

    console.log("Acting on platform: " + platform.platform)

    //? Check if the page is ready
    if (!await platform.ready) {
        console.log("Page is not ready.")
        return
    }

    //? Check if the platform is set up, and set it up if it isn't
    if (!platform.isSetup) {
        await platform.setup()
    }

    //? Get the platform class
    const platformClass = (await import(`./platforms/${platform.platform}.js`)).default

    //? Get the type of the page (browsing/watching)
    const type = await platformClass.getType(interested.id, interested.url)

    if (!type) {
        console.log("Type not found.")
        return
    }

    //? Set the presence to browsing if the user is browsing the page
    if (type == "browsing") {
        await switchPlatform(platform.platform)
        const newPresence = await mapInfoToPresence({ browsing: true })
        if (arePresencesDifferent({...newPresence, platform: platform.platform}, presence)) {
            await global.client.setActivity(newPresence)
            presence = {
                ...newPresence,
                platform: platform.platform
            }
            console.log("Set presence.")
        }

    //? Set the presence to watching if the user is watching something
    } else if (type == "watching") {
        const watchingInfo = await platform.run()
        if (!watchingInfo) {
            console.log("No information was provided by the platform.")
            return
        }
        await switchPlatform(platform.platform)
        const newPresence = await mapInfoToPresence(watchingInfo)
        if (arePresencesDifferent({...newPresence, platform: platform.platform}, presence)) {
            await global.client.setActivity(newPresence)
            presence = {
                ...newPresence,
                platform: platform.platform
            }
            console.log("Set presence.")
        }
    }



}

function arePresencesDifferent(presence1: DiscordRPC.Presence & {platform: string}, presence2: DiscordRPC.Presence & {platform: string}) {


    if ((!presence1 || !presence2) && presence1 != presence2) return true 

    if ((!presence1.endTimestamp || !presence2.endTimestamp) && presence1.endTimestamp != presence2.endTimestamp) return true

    let p1Copy = {...presence1}
    let p2Copy = {...presence2}
    if (presence1.endTimestamp) p1Copy.endTimestamp = Math.floor(presence1.endTimestamp as number / 1000) * 1000
    if (presence2.endTimestamp) p2Copy.endTimestamp = Math.floor(presence2.endTimestamp as number / 1000) * 1000

    return JSON.stringify(p1Copy) != JSON.stringify(p2Copy) || p1Copy.endTimestamp != p2Copy.endTimestamp

}

async function switchPlatform(platform: string){
    return new Promise<void>(async (resolve, reject) => {
        if (RPCName == platform) {
            console.log("Already on " + platform)
            return resolve()
        }
        if (Object.keys(global.clientIDMap).indexOf(platform) == -1) {
            console.error("Invalid platform")
            process.exit(1)
        }
        console.log("Switching to " + platform)
        await global.client.destroy()
        
        global.client = new Client({
            transport: 'ipc', 
        });
        global.client.login({ clientId: global.clientIDMap[platform]});
        global.client.once('ready', () => {
            RPCName = platform
            resolve()
        })
    })
}

async function getTopTabs(tabs?: any[]) {
    if (!tabs) tabs = (await global.browser.getTabs()).filter(tab => tab.type == "page")
    const matchingPages = tabs.map(tab => {
            for (const [regex, platform] of global.websiteMap) {
                if (regex.test(tab.url) && !/allwatcher=false/.test(tab.url)) {
                    return {
                        ...tab,
                        platform
                    }
                }
            }
            return null
    }).filter((a: any)=>!!a)
    
    for (let matchingTab of [...matchingPages]) {
        const type = await matchingTab.platform.getType(matchingTab.id, matchingTab.url)
        if (!type) {
            matchingPages.splice(matchingPages.indexOf(matchingTab), 1)
            continue
        }
        matchingTab.watching = type == "watching"
        matchingTab.browsing = type == "browsing"
    }
    
    const watchingPrio = 1
    const playingPrio = 30

    const table: any = {}

    for (const tab of matchingPages) {

        if (tab.browsing) {
            table[tab.id] = 0
        } else if (tab.watching) {
            table[tab.id] = watchingPrio

            if (await tab.platform.isPlaying(tab.id)) {
                table[tab.id] += playingPrio
            }
        }
    }



    const sorted = Object.keys(table).sort((a, b) => table[b] - table[a]).map(id => {
        return {...matchingPages.find(tab => tab.id == id), priority: table[id]}
    })
    return sorted
}

async function mapInfoToPresence(information) {
    let newPresence: DiscordRPC.Presence = {
        instance: false
    }


    newPresence.buttons = information.buttons

    if (information.watching) {

        newPresence.details = information.title
        newPresence.largeImageKey = "logo"
        if (information.playing) newPresence.endTimestamp = Date.now() + (information.duration - information.progress)
        if (information.type == "series") {
            newPresence.state = `S${information.season}:E${information.episode}: ${information.episode_title}`
            newPresence.largeImageText="S? of S? | E? of E?"

            if (information.episode_total && information.season_total && information.episode_total > 1 && information.season_total > 1 && information.episode_total !== "?" && information.season_total !== "?") {
                newPresence.largeImageText = `S${information.season} of S${information.season_total} | E${information.episode} of E${information.episode_total}`

            } else if (information.season_total && information.season_total > 1 && information.season_total !== "?") {
                newPresence.largeImageText = `Season ${information.season} of ${information.season_total}`
            } else if (information.episode_total && information.episode_total > 1 && information.episode_total !== "?") {
                newPresence.largeImageText = `Episode ${information.episode} of ${information.episode_total}`
            }
        } else {
            newPresence.largeImageText = undefined
        }
            
    } else {
        newPresence.details = "Browsing"
        newPresence.largeImageKey = "logo"
        newPresence.state = "Selecting a title"
    }

    if (showAuthor && (information.playing || information.browsing)) {
        newPresence.smallImageKey = "author"
        newPresence.smallImageText = "AllWatcher - by Inimi"
    }

    if (!information.playing && information.watching) {
        newPresence.smallImageKey = "paused"
        newPresence.smallImageText = "Paused"
        if (!newPresence.state) newPresence.state = "Paused"
    }

    console.log(newPresence)

    return newPresence
}

process.on('exit', onExit)
process.on('SIGINT', onExit)
process.on('SIGTERM', onExit)
process.on('uncaughtException', onExit)
process.on('unhandledRejection', onExit)

async function onExit(c) {
    if (c == 2) return;
    console.log(c)
    if (c instanceof Error) console.error(c)
    try {
        if (global.client) {
            await global.client.clearActivity()
            await global.client.destroy()
        }
    } catch (e) {
        console.error(e)
    }
    process.exit(2)
}
