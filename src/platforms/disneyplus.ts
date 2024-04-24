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

export default class DisneyPlus extends Platform {
    public static prettyName: string = 'Disney+'
    public static platform: string = 'disneyplus'
    public static matchingRegex: RegExp = /disneyplus\.com/
    public matchingRegex: RegExp = DisneyPlus.matchingRegex
    public platform: string = DisneyPlus.platform


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
        const type = await DisneyPlus.getType(this.tab, url)
        if (type == "browsing") return { browsing: true }

        const title = await global.browser.evaluate(this.tab, `document.querySelector(".title-field.body-copy")?.textContent`, "title") as string
        let duration: any = await global.browser.evaluate(this.tab, `parseInt(document.querySelector(".slider-container[aria-label='Slider']")?.ariaValueMax)`, "duration") as number * 1000
        let progress = await global.browser.evaluate(this.tab, `document?.getElementsByTagName("disney-web-player")[0]?.shadowRoot?.querySelector("video")?.currentTime`, "progress") as number * 1000
        
        if (!title || !duration || !progress) return null


        const playing = await DisneyPlus.isPlaying(this.tab)

        const videoType = await global.browser.evaluate(this.tab, `!!document.querySelector(".subtitle-field") ? "series" : "movie"`, "videoType") as string

        let totalEpisodesInSeason: string | number = "?"
        let totalSeasons: string | number = "?"
        let season: string | number = "?"
        let episode: string | number = "?"
        let episode_title = "?"

        if (videoType == "series") {
        season = await global.browser.evaluate(this.tab, `document.querySelector(".subtitle-field") ? parseInt(document.querySelector(".subtitle-field")?.textContent?.split(":")[0].slice(1)) : null`, "season") as number
        episode = await global.browser.evaluate(this.tab, `document.querySelector(".subtitle-field") ? parseInt(document.querySelector(".subtitle-field")?.textContent?.split(":")[1].split(" ")[0].slice(1)) : null`, "episode") as number
        episode_title = await global.browser.evaluate(this.tab, `document.querySelector(".subtitle-field") ? document.querySelector(".subtitle-field")?.textContent?.split(":").splice(1).join(":").split(" ").slice(1).join(" ") : null`, "episode_title") as string

        await getSeason(title, episode, episode_title) // To set the seasons in the cache

        totalEpisodesInSeason = seasonsCache[title as string] ? seasonsCache[title as string].episodes.filter(e => e.season_number == season).length : "?"
        totalSeasons = seasonsCache[title as string] ? seasonsCache[title as string].episodes.reduce((acc, e) => acc.includes(e.season_number) ? acc : [...acc, e.season_number], []).length : "?"
      }
    
      let vidID = await global.browser.evaluate(this.tab, `document.location.href.replace(/.*www\\.disneyplus\\.com\\/play\\//g,"").replace(/\\?.*/g,"")`, "vidID") as string

      return {
        platform: DisneyPlus.platform,
        title,
        type: videoType,
        season,
        episode,
        episode_title,
        episode_total: totalEpisodesInSeason,
        season_total: totalSeasons,
        progress,
        duration,
        playing,
        browsing: false,
        watching: true,
        buttons: [
            {
                label: `Watch: ${title}`.length > 32 ? `Show on Disney+` : `Watch: ${title}`,
                url: `https://www.disneyplus.com/browse/entity-${vidID}`
            }
        ]
      }
    }
    public static async isPlaying(tabId) {
        return !await global.browser.evaluate(tabId, `document?.getElementsByTagName("disney-web-player")[0]?.shadowRoot?.querySelector("video")?.paused`, "playingCheck")
    }

    public get ready(): Promise<boolean> {
        return new Promise(async (resolve) => {
            const type = await DisneyPlus.getType(this.tab)
            if (type == "browsing") {
                global.browser.evaluate(this.tab, `document.readyState === "complete"`, "ReadyCheck").then(resolve)
            } else if (type == "watching") {
                global.browser.evaluate(this.tab, `!!document?.getElementsByTagName("disney-web-player")[0]?.shadowRoot?.querySelector("video") && document.readyState === "complete"`, "ReadyCheck").then(resolve)
            } else {
                console.warn("The '" + this.platform + "' platform was unable to determine the type of activity.")
                resolve(false)
            }
        })
    }

    private static async getType(tabId: string, url?: string) {
        const tabURL = url ?? (await global.browser.getTabs()).find((tab: any) => tab.id === tabId).url
        const result = {
            browsing: /\/(home|search|browse|originals|movies|series|brand)/.test(tabURL),
            watching: /\/play/.test(tabURL)
        }
        return result.watching ? "watching" : result.browsing ? "browsing" : null
    }
}