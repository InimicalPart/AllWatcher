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

import { Platform } from "@src/lib/base/base-platform.js";
import { getSeason, seasonsCache } from "@src/lib/utils/misc.js";
import { AWG } from "@src/types/types.js";

declare const global: AWG

export default class OTTMovies extends Platform { // OTT = OneTwoThree
    public static prettyName: string = '123Movies'
    public static platform: string = '123movies'
    public static matchingRegex: RegExp = /ww(|[0-9])\.movies123\.la/
    public matchingRegex: RegExp = OTTMovies.matchingRegex
    public platform: string = OTTMovies.platform

    private static iframe1RegExp = /play\.123moviesfree\.ltd\/.*?\.php/
    private static iframe2RegExp = /vid30c\.site|2embed\.cc|gomo\.to|vidsrc\.xyz/
    private static iframe3RegExp = /vidsrc\.stream/

    public isSetup: boolean = false

    constructor(tab: string) {
        super(tab)
    }

    public async setup(): Promise<boolean> {
        this.isSetup = true
        return true
    }

    public async run() {
        const url = (await global.browser.getTabs()).find((tab: any) => tab.id === this.tab).url
        const type = await OTTMovies.getType(this.tab, url)
        if (type == "browsing") return { browsing: true }

        const title = await global.browser.evaluate(this.tab, `document.querySelector(".card-title")?.textContent`, "title") as string
        const videoType = await global.browser.evaluate(this.tab, `!!Array.from(document?.querySelectorAll("#eps-list"))?.filter(a=>a?.children[0]?.textContent?.trim()?.startsWith("Episode"))[0] ? "series" : "movie"`, "type")

        const iframe1 = await global.browser.getIFrame(this.tab, OTTMovies.iframe1RegExp).catch(() => null)
        if (!iframe1) return null

        
        let episode_title = "?"
        let episode: string | number = "?"
        let season: string | number = "?"
        let episode_total: string | number = "?";
        if (videoType == "series") {
            episode_title = await global.browser.evaluate(iframe1, `document.querySelector("iframe").contentDocument.querySelector("ul.episodes").textContent.trim().replace(/EP.*?:( |)/,"") ?? "N/A"`, "episode_title") as any
            episode = await global.browser.evaluate(iframe1, `parseInt(document.querySelector("iframe").contentDocument.querySelector("div.title").textContent.split(" ").find(a=>a.startsWith("EP")).replace("EP","")) ?? "N/A"`, "episode") as any
            season = await global.browser.evaluate(iframe1, `parseInt(document.querySelector("iframe").contentDocument.querySelector("div.title").textContent.split(" ").find(a=>a.startsWith("SS")).replace("SS","")) ?? "N/A"`, "season") as any
            episode_total = await global.browser.evaluate(this.tab, `document.querySelector("#eps-list").children.length`, "episode_total") as any
        }



        let iframe2 = await global.browser.getIFrame(iframe1, OTTMovies.iframe2RegExp).catch(() => null)
        if (!iframe2) return null

        let thirdIframeNeeded = false

        if (global.browser.pages.find(a=>a.id==iframe2).url.includes("vidsrc.xyz")) {
            iframe2 = await global.browser.getIFrame(iframe2, OTTMovies.iframe3RegExp).catch(() => null)
            if (!iframe2) return null
            thirdIframeNeeded = true
        }

        const progress = await global.browser.evaluate(iframe2, `${thirdIframeNeeded ? 'document.querySelector("iframe").contentDocument':"document"}.querySelector("video")?.currentTime ?? "N/A"`, "episode_progress") as number * 1000
        const duration = await global.browser.evaluate(iframe2, `${thirdIframeNeeded ? 'document.querySelector("iframe").contentDocument':"document"}.querySelector("video")?.duration ?? "N/A"`, "episode_duration") as number * 1000

        const playing = await global.browser.evaluate(iframe2, `!${thirdIframeNeeded ? 'document.querySelector("iframe").contentDocument':"document"}.querySelector("video")?.paused`, "playing")

        let totalSeasons: string | number = "?"
        
        if (videoType == "series") {
            await getSeason(title, episode as number) // To set the seasons in the cache.   
            totalSeasons = seasonsCache[title as string].episodes.reduce((acc: string | any[], e: { season_number: any; }) => acc.includes(e.season_number) ? acc : [...acc, e.season_number], []).length
        }

        return {
            watching: true,
            title,
            type: videoType,
            episode_title,
            episode,
            season,
            episode_total,
            season_total: totalSeasons,
            progress,
            duration,
            playing
        } as any
        
    }
    public static async isPlaying(tabId) {
        const iframe1 = await global.browser.getIFrame(tabId, OTTMovies.iframe1RegExp).catch(() => null)
        if (!iframe1) return null
        const iframe2 = await global.browser.getIFrame(iframe1, OTTMovies.iframe2RegExp).catch(() => null)
        if (!iframe2) return null
        return await global.browser.evaluate(iframe2, `!document.querySelector("video")?.paused ?? "N/A"`, "playingCheck")
    }

    public get ready(): Promise<boolean> {
        return new Promise(async (resolve) => {
            const type = await OTTMovies.getType(this.tab)
            if (type == "browsing") {
                global.browser.evaluate(this.tab, `document.readyState === "complete"`, "ReadyCheck").then(resolve)
            } else if (type == "watching") {
                const iframe1 = await global.browser.getIFrame(this.tab, OTTMovies.iframe1RegExp).catch(() => null)
                console.log(iframe1)
                if (!iframe1) return resolve(false)
                let iframe2 = await global.browser.getIFrame(iframe1, OTTMovies.iframe2RegExp).catch(() => null)
                console.log(iframe2)
                if (!iframe2) return resolve(false)

                let thirdIframeNeeded = false
                
                if (global.browser.pages.find(a=>a.id==iframe2).url.includes("vidsrc.xyz")) {
                    iframe2 = await global.browser.getIFrame(iframe2, OTTMovies.iframe3RegExp).catch(() => null)
                    if (!iframe2) return resolve(false)
                    thirdIframeNeeded = true
                }
                
                global.browser.evaluate(iframe2, `!!${thirdIframeNeeded ? 'document?.querySelector("iframe")?.contentDocument':"document"}?.querySelector("video") && document.readyState === "complete"`, "ReadyCheck").then(resolve)
            } else {
                console.warn("The '" + this.platform + "' platform was unable to determine the type of activity.")
                resolve(false)
            }
        })
    }

    private static async getType(tabId: string, url?: string) {
        const tabURL = url ?? (await global.browser.getTabs()).find((tab: any) => tab.id === tabId).url
        const result = {
            browsing: /\/(123movies|genre\/.*|movies|tv-series|top-imdb)/.test(tabURL),
            watching: /\/movie\//.test(tabURL)
        }
        return result.watching ? "watching" : result.browsing ? "browsing" : null
    }
}