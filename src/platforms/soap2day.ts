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
import { AWG } from "@src/types/types.js";

declare const global: AWG

export default class Soap2Day extends Platform {
    public static prettyName: string = 'Soap2Day'
    public static platform: string = 'soap2day'
    public static matchingRegex: RegExp = /(\/|\.)soap2day/
    public matchingRegex: RegExp = Soap2Day.matchingRegex
    public platform: string = Soap2Day.platform

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
        const type = await Soap2Day.getType(this.tab, url)
        if (type == "browsing") {
            return { browsing: true }
        } else if (type == "watching") {
            const iframe = await global.browser.getIFrame(this.tab, /.*rabbitstream\.net/).catch(() => null)
            if (iframe) {
                const type = await global.browser.evaluate(this.tab, `document.querySelector(".ss-episodes") == undefined ? "movie" : "series"`, "type")
                return {
                    watching: true,
                    title: await global.browser.evaluate(this.tab, `document.querySelector("li.breadcrumb-item.active")?.innerText`, "title"),
                    type: type,
                    episode_title: type == "series" ? await global.browser.evaluate(this.tab, `document.querySelector("li>a.active.eps-item")?.innerText?.replace(/^.*?:/m,"")?.trim() ?? "N/A"`, "episode_title"): undefined,
                    episode: type == "series" ? await global.browser.evaluate(this.tab, `parseInt(document.querySelector("li>a.active.eps-item")?.innerText?.replace(/:.*/g,"")?.replace(/[a-zA-Z]/g,"")) ?? "N/A"`, "episode"): undefined,
                    season: type == "series" ? await global.browser.evaluate(this.tab, `parseInt(document.querySelector("#current-season")?.innerText?.replace(/[a-zA-Z]/g,""))`, "season"): undefined,
                    episode_total: type == "series" ? await global.browser.evaluate(this.tab, `Array.from(document.querySelector(".ss-episodes.active").children).find(a=>a.tagName=="UL").children.length`, "episode_total"): undefined,
                    progress: await global.browser.evaluate(iframe, `document.querySelector("video")?.currentTime ?? "N/A"`, "movie_progress") as number * 1000,
                    duration: await global.browser.evaluate(iframe, `document.querySelector("video")?.duration ?? "N/A"`, "movie_duration") as number * 1000,
                    playing: await global.browser.evaluate(iframe, `!document.querySelector("video")?.paused ?? "N/A"`, "playing")

                } as any
            } else return null
        } else {
            console.warn("The '" + this.platform + "' platform was unable to determine the type of activity.")
        }
    }

    public static async isPlaying(tabId: string) {
        const iframe = await global.browser.getIFrame(tabId, /.*rabbitstream\.net/).catch(() => null)
        if (iframe) {
            return await global.browser.evaluate(iframe, `!document.querySelector("video")?.paused ?? "N/A"`, "playingCheck")
        } else {
            return false
        }
    }

    public get ready(): Promise<boolean> {
        return new Promise(async (resolve) => {
            const type = await Soap2Day.getType(this.tab)
            if (type == "browsing") {
                resolve(true)
            } else if (type == "watching") {
                const iframe = await global.browser.getIFrame(this.tab, /.*rabbitstream\.net/).catch(() => null)
                resolve(!!iframe)
            } else {
                console.warn("The '" + this.platform + "' platform was unable to determine the type of activity.")
                resolve(false)
            }
        })
    }

    private static async getType(tabId: string, url?: string) {
        const tabURL = url ?? (await global.browser.getTabs()).find((tab: any) => tab.id === tabId).url
        const result = {
            browsing: /\/(home|genre\/.*|country\/.*|movie|tv-show|top-imdb|search|tv|movie)/.test(tabURL),
            watching: /\/(watch-tv|watch-movie)/.test(tabURL)
        }
        return result.watching ? "watching" : result.browsing ? "browsing" : null
    }


}
