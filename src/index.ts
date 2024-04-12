import RPC from 'discord-rpc';
import chalk from 'chalk';
import { BrowserController } from './browser.js';

const browser = new BrowserController();


async function getIFrame(parentID, iframe, index=0, stopAt=-1, rememberenceStack=[]) {
    const hasMultiple = !(iframe instanceof RegExp)
    if (stopAt != -1 && index >= stopAt) return {
        id: parentID,
        rememberenceStack
    }
    if (hasMultiple && index >= Object.keys(iframe).length) return {
        id: parentID,
        rememberenceStack
    }
    const iframeToCheck = hasMultiple ? iframe[index] : iframe
    let ready = true
    let lastIFrameID = parentID
    lastIFrameID = await browser.getIFrame(parentID, iframeToCheck).catch(e => {
        ready = false
    }).then(async (str) => {
        if (ready) {
            if (hasMultiple && index + 1 < Object.keys(iframe).length) {
                rememberenceStack.push(str)
                lastIFrameID = (await getIFrame(str, iframe, index + 1, stopAt, rememberenceStack))?.id
                if (!lastIFrameID) {
                    ready = false
                    return null
                }
                return lastIFrameID
            }
            else {
                rememberenceStack.push(str)
                lastIFrameID = str
                return str
            }
        }
        // return lastIFrameID
    })

    if (!lastIFrameID) {
        ready = false
        return null
    }

    return ready ? {
        id: lastIFrameID,
        rememberenceStack
    } : null                                
}


let client = new RPC.Client({
    transport: 'ipc', 
});

declare const global: AllWatcherGlobal

const showAuthor = true;

(async()=>{

    
    const clientIdMap = {
        "soap2day": "1226991012879011860",
        "netflix": "1227576564519010374",
        "myflixer": "1228072915237605427",
        // "123movies": "1228342834072129567"
    }

    let presence: any = {}
    let pastInformation:{
        browsing?: boolean,
        watching?: boolean,
        playing?: boolean,
        title?: string,
        episode?: number,
        season?: number,
        endTime?: number,
        buttons?: any
    }= {}
    let rpcName = "soap2day"

    
    // const scopes = ['rpc', 'rpc.activities.write'];
    
    client.once('ready', async () => {
        
        console.log('Authed for user', client.user.username);
        
        const matching = await retrieveWanted()

        const highestPrio = matching[0]?.priority

        if (!highestPrio && highestPrio !== 0) {
            if (presence) {
                presence = null;
                pastInformation = {};
                await client.clearActivity();
            }
            console.log("No page found");
        } else {

            let interested: any = matching.filter(tab => tab.priority == highestPrio)

            if (interested.length > 1) {
                let active = []
                for (let tab of interested) {
                    await browser.evaluate(tab.id, "document.visibilityState == 'visible'").then(visible => {
                        if (visible) active.push(tab)
                    })
                }
                if (active.length > 1) {
                    // document.hasFocus()
                    let focus = []
                    for (let tab of active) {
                        await browser.evaluate(tab.id, "document.hasFocus()").then(focused => {
                            if (focused) focus.push(tab)
                        })
                    }
                    interested = focus[0] || active[0]
                } else interested = interested[0]
            } else interested = interested[0]

            await browser.initiateDebugging(interested.id)

            const pageIsReady = await browser.evaluate(interested.id, "document.readyState === 'complete'")




            if (pageIsReady) {

                let ready = true

                if (interested.platform.isReady) {
                    if (interested?.platform?.isReady?.browsing && interested.browsing) {

                        if (interested?.platform?.isReady?.browsing == "IFRAME_EXISTS") {
                            let lastIFrameID = await getIFrame(interested.id, interested?.platform?.iframe)
                            if (!lastIFrameID) ready = false
                        } else {
                            const browsing = await browser.evaluate(interested.id, interested?.platform?.isReady?.browsing)
                            if (!browsing) ready = false
                        }
                    }
                    if (interested?.platform?.isReady?.watching && interested.watching) {

                        if (interested?.platform?.isReady?.watching == "IFRAME_EXISTS") {
                            let lastIFrameID = await getIFrame(interested.id, interested?.platform?.iframe)
                            if (!lastIFrameID) ready = false
                        } else {       
                            const watching = await browser.evaluate(interested.id, interested?.platform?.isReady?.watching)
                            if (!watching) ready = false
                        }
                    }
                }

                if (ready) {


                    if (interested?.platform?.preCheck?.browsing && interested.browsing) {
                        await browser.evaluate(interested.id, interested?.platform?.preCheck?.browsing)
                    } else if (interested?.platform?.preCheck?.watching && interested.watching) {
                        await browser.evaluate(interested.id, interested?.platform?.preCheck?.watching)
                    }
        
                    const information = await mapToResults(interested)
                    
                    if (interested?.platform?.postCheck?.browsing && interested.browsing) {
                        await browser.evaluate(interested.id, interested?.platform?.postCheck?.browsing)
                    } else if (interested?.platform?.postCheck?.watching && interested.watching) {
                        await browser.evaluate(interested.id, interested?.platform?.postCheck?.watching)
                    }


                    if (information) {
                        console.log(information)
                        pastInformation = {browsing: information.browsing, watching: information.watching, playing: information.playing,
                            ...(
                            information.type == "series" ? {episode: information.episode, season: information.season} : {title: information.title}
                            ),
                            endTime: !information.playing ? Number.POSITIVE_INFINITY : (information.type == "movie" ? (floorToSeconds((Date.now() + information.movie_duration) - information.movie_progress)??null) : (floorToSeconds((Date.now() + information.episode_duration) - information.episode_progress) ?? null))
                        }
                        presence = await mapInfoToPresence(information)
                        
                        console.log(presence)
                        
                        await switchPlatform(information["platform"])
                        await setActivity(presence)
                    }
                } else {
                    console.log("Page not ready")
                }
            } else {
                console.log("Page not ready")
            }
        }

            
            setInterval(async () => {
 
                const matching = await retrieveWanted()

                const highestPrio = matching[0]?.priority

                if (!highestPrio && highestPrio !== 0) {
                    if (presence) {
                        presence = null;
                        pastInformation = {};
                        await client.clearActivity();
                    }
                    console.log("No page found");
                    return;
                }

                let interested: any = matching.filter(tab => tab.priority == highestPrio)

                if (interested.length > 1) {
                    let active = []
                    for (let tab of interested) {
                        await browser.evaluate(tab.id, "document.visibilityState == 'visible'").then(visible => {
                            if (visible) active.push(tab)
                        })
                    }
                    if (active.length > 1) {
                        // document.hasFocus()
                        let focus = []
                        for (let tab of active) {
                            await browser.evaluate(tab.id, "document.hasFocus()").then(focused => {
                                if (focused) focus.push(tab)
                            })
                        }
                        interested = focus[0] || active[0]
                    } else interested = interested[0]
                } else interested = interested[0]

                await browser.initiateDebugging(interested.id)


            const pageIsReady = await browser.evaluate(interested.id, "document.readyState === 'complete'")
            
            if (!pageIsReady) return console.log("Page not ready")

            console.log(interested.platform.isReady, interested.browsing, interested.watching)
            if (interested.platform.isReady) {
                if (interested?.platform?.isReady?.browsing && interested.browsing) {

                    if (interested?.platform?.isReady?.browsing == "IFRAME_EXISTS") {
                        let lastIFrameID = await getIFrame(interested.id, interested?.platform?.iframe)
                        if (!lastIFrameID) return console.log("IFrame not ready")

                    } else {
                        const browsing = await browser.evaluate(interested.id, interested?.platform?.isReady?.browsing)
                        if (!browsing) return console.log("Browsing not ready")
                    }
                }
                if (interested?.platform?.isReady?.watching && interested.watching) {

                    if (interested?.platform?.isReady?.watching == "IFRAME_EXISTS") {
                        let lastIFrameID = await getIFrame(interested.id, interested?.platform?.iframe)
                        if (!lastIFrameID) return console.log("IFrame not ready")
                    } else {
                        const watching = await browser.evaluate(interested.id, interested?.platform?.isReady?.watching)
                        if (!watching) return console.log("Watching not ready")
                    }
                }
            }


            if (interested?.platform?.preCheck?.browsing && interested.browsing) {
                await browser.evaluate(interested.id, interested?.platform?.preCheck?.browsing)
            } else if (interested?.platform?.preCheck?.watching && interested.watching) {
                await browser.evaluate(interested.id, interested?.platform?.preCheck?.watching)
            }

            const information = await mapToResults(interested)
                    
            if (interested?.platform?.postCheck?.browsing && interested.browsing) {
                await browser.evaluate(interested.id, interested?.platform?.postCheck?.browsing)
            } else if (interested?.platform?.postCheck?.watching && interested.watching) {
                await browser.evaluate(interested.id, interested?.platform?.postCheck?.watching)
            }

            if (!information) return console.log("No information found")

            let newPresence = await mapInfoToPresence(information)

            console.log(pastInformation)
            if (JSON.stringify(pastInformation) != JSON.stringify({browsing: information.browsing, watching: information.watching, playing: information.playing, ...(information.type == "series" ? {episode: information.episode, season: information.season} : {title: information.title}), endTime: !information.playing ? Number.POSITIVE_INFINITY : (information.type == "movie" ? (floorToSeconds((Date.now() + information.movie_duration) - information.movie_progress)??null) : (floorToSeconds((Date.now() + information.episode_duration) - information.episode_progress) ?? null))})) {
                pastInformation = {browsing: information.browsing, watching: information.watching, playing: information.playing,
                    ...(
                        information.type == "series" ? {episode: information.episode, season: information.season} : {title: information.title}
                    ),
                    endTime: !information.playing ? Number.POSITIVE_INFINITY : (information.type == "movie" ? (floorToSeconds((Date.now() + information.movie_duration) - information.movie_progress)??null) : (floorToSeconds((Date.now() + information.episode_duration) - information.episode_progress) ?? null))
                }
                console.log(newPresence)   
                await switchPlatform(information["platform"])
                await setActivity(newPresence)
            } else {
                console.log(presence)
                console.log("Presence not updated")
            }

        }, 1000)
        
    });
    
    client.on("disconnect", (code, reason) => {
        console.log("Connection closed", code, reason);
        process.exit(2);
    })

    // Log in to RPC with client id
    client.login({ clientId: clientIdMap["soap2day"]});


    async function setActivity(p) {
        presence = p;
        console.log("Presence set to: " + p.state)
        client.setActivity(presence);
    }

    async function switchPlatform(platform: string){
        return new Promise<void>(async (resolve, reject) => {
            if (rpcName == platform) {
                console.log("Already on " + platform)
                return resolve()
            }
            if (Object.keys(clientIdMap).indexOf(platform) == -1) {
                console.error("Invalid platform")
                process.exit(1)
            }
            console.log("Switching to " + platform)
            await client.destroy()
            
            client = new RPC.Client({
                transport: 'ipc', 
            });
            client.login({ clientId: clientIdMap[platform]});
            client.once('ready', () => {
                rpcName = platform
                console.log('Authed for user', client.user.username);
                resolve()
            })
        })
    }
})()

async function retrieveWanted() {
    const tabs = await browser.getTabs()
    const onWatchSite = tabs.map(tab => {
            for (const [regex, platform] of global.websiteMap) {
                if (regex.test(tab.url) && !/allwatcher=false/.test(tab.url)) {
                    return {
                        ...tab,
                        platform
                    }
                }
            }
            return null
    }).filter(a=>!!a)
    
    for (let watchingTab of [...onWatchSite]) {
        if (watchingTab.platform.watching) {
            if (typeof watchingTab.platform.watching == "string") {
                if (!browser.pages.find(page => page.id == watchingTab.id)) await browser.initiateDebugging(watchingTab.id)
                if (watchingTab.platform.watching.startsWith("IF:")) {
                    const IFAppearsXTimes = countOccurrences(watchingTab.platform.watching, "IF:")
                    if (!watchingTab.platform.iframe) {
                        console.warn("IF: expression used without iframe in '" + watchingTab.platform.platform + "'");
                        onWatchSite.splice(onWatchSite.indexOf(watchingTab), 1)
                        continue
                    }

                    const iframe = await getIFrame(watchingTab.id, watchingTab.platform.iframe, 0, IFAppearsXTimes-1)

                    if (!iframe) {
                        console.warn("IF: expression used without iframe in pos " + (IFAppearsXTimes-1) + " in '" + watchingTab.platform.platform + "'");
                        onWatchSite.splice(onWatchSite.indexOf(watchingTab), 1)
                        continue
                    }
                    if (!await browser.evaluate(iframe.id, watchingTab.platform.watching.replace(/^(IF:)+/gm, ""))) {
                        onWatchSite.splice(onWatchSite.indexOf(watchingTab), 1)
                        continue
                    }
                } else {
                    if (!await browser.evaluate(watchingTab.id, watchingTab.platform.watching)) {
                        onWatchSite.splice(onWatchSite.indexOf(watchingTab), 1)
                        continue
                    }
                }
            } else {
                if (!watchingTab.platform.watching.test(watchingTab.url)) {
                    onWatchSite.splice(onWatchSite.indexOf(watchingTab), 1)
                    continue
                }

            }
        } else {
            if (watchingTab.platform.funcs?.getInformation) {
                let info = await watchingTab.platform.funcs.getInformation(watchingTab.id, browser, true)
                console.log(info)
                if (!info || !info.watching) {
                    onWatchSite.splice(onWatchSite.indexOf(watchingTab), 1)
                    continue
                }
            } else {   
                onWatchSite.splice(onWatchSite.indexOf(watchingTab), 1)
                continue
            }
        }
        watchingTab.watching = true
    }

    const isBrowsing = tabs.map(tab => {
        for (const [regex, platform] of global.websiteMap) {
            if (regex.test(tab.url) && !/allwatcher=false/.test(tab.url)) {
                return {
                    ...tab,
                    platform
                }
            }
        }
        return null
    }).filter(a=>!!a)
    
        for (let browsingTab of [...isBrowsing]) {
            if (browsingTab.platform.browsing) {
                if (typeof browsingTab.platform.browsing == "string") {
                    if (!browser.pages.find(page => page.id == browsingTab.id)) await browser.initiateDebugging(browsingTab.id)
                    if (browsingTab.platform.browsing.startsWith("IF:")) {
                        const IFAppearsXTimes = countOccurrences(browsingTab.platform.watching, "IF:")
                        console.log(IFAppearsXTimes)
                        if (!browsingTab.platform.iframe) {
                            console.warn("IF: expression used without iframe in '" + browsingTab.platform.platform + "'");
                            isBrowsing.splice(isBrowsing.indexOf(browsingTab), 1)
                            continue
                        }
                        const iframe = await getIFrame(browsingTab.id, browsingTab.platform.iframe, 0, IFAppearsXTimes-1)
                        
                        if (!iframe) {
                            console.warn("IF: expression used without iframe in pos " + (IFAppearsXTimes-1) + " in '" + browsingTab.platform.platform + "'");
                            onWatchSite.splice(onWatchSite.indexOf(browsingTab), 1)
                            continue
                        }

                        if (!await browser.evaluate(iframe.id, browsingTab.platform.browsing.replace(/^(IF:)+/gm, ""))) {
                            isBrowsing.splice(isBrowsing.indexOf(browsingTab), 1)
                            continue
                        }
                    } else {
                        if (!await browser.evaluate(browsingTab.id, browsingTab.platform.browsing)) {
                            isBrowsing.splice(isBrowsing.indexOf(browsingTab), 1)
                            continue
                        }
                    }   
                } else {
                    if (!browsingTab.platform.browsing.test(browsingTab.url)) {
                        isBrowsing.splice(isBrowsing.indexOf(browsingTab), 1)
                        continue
                    }
                }
            } else {

                if (browsingTab.platform.funcs?.getInformation) {
                    let info = await browsingTab.platform.funcs.getInformation(browsingTab.id, browser, true)
                    if (!info || !info.browsing) {
                        isBrowsing.splice(isBrowsing.indexOf(browsingTab), 1)
                        continue
                    }
                } else {   
                    isBrowsing.splice(isBrowsing.indexOf(browsingTab), 1)
                    continue
                }
            }

            browsingTab.browsing = true
        }
        
    const watchingPrio = 1
    const playingPrio = 30

    const table: any = {}

    for (const tab of onWatchSite) {

        table[tab.id] = watchingPrio + (tab.platform.playing ? playingPrio : 0)
    }

    for (const tab of isBrowsing) {
        table[tab.id] = 0
    }



    const sorted = Object.keys(table).sort((a, b) => table[b] - table[a])

    return sorted.map(id => { return {priority:table[id], ...(onWatchSite.find(tab => tab.id == id) || isBrowsing.find(tab => tab.id == id))}})
}

async function mapToResults(interested): Promise<{
    [key: string]: any
}> {

    const information: any = {}

    await browser.initiateDebugging(interested.id)

    const associatedPlatform = Array.from(global.websiteMap.entries()).find(([regex, platform]) => regex.test(interested.url))[1]

    console.log(associatedPlatform)

    if (!associatedPlatform) return null

    if (associatedPlatform?.funcs?.getInformation) {
        return associatedPlatform.funcs.getInformation(interested.id, browser)
    } else {
        let sortedKeys = Object.keys(interested.platform).sort((a, b) => {
            // type, platform, browsing, watching first, then iframe, and then the rest
            if (a == "type") return -1
            if (b == "type") return 1
            if (a == "platform") return -1
            if (b == "platform") return 1
            if (a == "browsing") return -1
            if (b == "browsing") return 1
            if (a == "watching") return -1
            if (b == "watching") return 1
            if (a == "iframe") return -1
            if (b == "iframe") return 1
        

            return 0

        })

        let iframeIDStack = null



        let type = null
        for (const key of sortedKeys) {
            const value = interested.platform[key]
            if (key == "platform") information["platform"] = value
            else if (key == "iframe" && information["watching"]) {
                iframeIDStack = await getIFrame(interested.id, value)
                if (!iframeIDStack) {
                    console.warn("IF: expression used without iframe in '" + interested.platform.platform + "'")
                    return null
                }
                iframeIDStack = iframeIDStack.rememberenceStack

            }
            else {
                if (type == "movie" && (key.startsWith("episode") || key.startsWith("season")) || information["browsing"]) continue
                if (type == "series" && key.startsWith("movie") || information["browsing"]) continue


                if (["isReady"].includes(key)) continue

                let result;

                if (value instanceof RegExp) {
                    result = value.test(interested.url)
                } else if (typeof value == "string") {
                    if ((value as string).startsWith("IF:")) {
                        const IFAppearsXTimes = countOccurrences(value as string, "IF:")
                        console.log(iframeIDStack)
                        if (!iframeIDStack) {
                            result = "N/A"
                        } else {
                            result = await browser.evaluate(iframeIDStack[IFAppearsXTimes-1], (value as string).replace(/^(IF:)+/gm, ""))
                        }
                    } else {
                        result = await browser.evaluate(interested.id, value as string)
                    }
                } else continue


                if (key == "episode_progress" || key == "episode_duration" || key == "movie_progress" || key == "movie_duration") {
                    result = result*1000
                }

                if (key == "type") {
                    type = result
                }

                information[key] = result
            }

        }

        information.watching = information.watching ?? false
        information.browsing = information.browsing ?? false
        information.playing = information.playing ?? false

        return information
    }
}

function s2HMS(_seconds: number) {
    const hours = Math.floor(_seconds / 3600);
    const minutes = Math.floor((_seconds % 3600) / 60);
    const seconds = Math.floor(_seconds % 60);
    return {
        hours,
        minutes,
        seconds
    }
}

async function mapInfoToPresence(information) {
    let p: RPC.Presence = {
        instance: false
    }


    console.log(information.watching, information.browsing, information.playing)

    p.buttons = information.buttons

    if (information.watching) {

        p.details = information.title
        p.largeImageKey = "logo"
        if (information.playing) p.endTimestamp = information.type == "movie" ? floorToSeconds((Date.now() + information.movie_duration) - information.movie_progress) : floorToSeconds((Date.now() + information.episode_duration) - information.episode_progress)
        if (information.type == "series") {
            p.state = `S${information.season}:E${information.episode}: ${information.episode_title}`
            if (information.episode_total) {
                p.largeImageText = `Episode ${information.episode} of ${information.episode_total}`
            }
        }
            
    } else {
        p.details = "Browsing"
        p.largeImageKey = "logo"
        p.state = "Selecting a title"
    }

    if (showAuthor) {
        p.smallImageKey = "author"
        p.smallImageText = "AllWatcher - by Inimi"
    }

    return p
}

async function onExit(c) {
    if (c == 2) return;
    console.error(c)
    try {
        if (client) {
            await client.clearActivity()
            await client.destroy()
        }
    } catch (e) {
        console.error(e)
        process.exit(2)
    }
    process.exit(2)

}

function floorToSeconds(time: number) {
    return Math.round(time/1000) * 1000
}

process.on('exit', onExit)
process.on('SIGINT', onExit)
process.on('SIGTERM', onExit)
process.on('uncaughtException', onExit)
process.on('unhandledRejection', onExit)

function countOccurrences(str: string, char: string): number {
    return str.split(char).length - 1; 
}