import { Platform } from "@src/lib/base/base-platform.js";
import { AWG } from "@src/types/types.js";

declare const global: AWG

export default class MyFlixer extends Platform {
    public static platform: string = 'myflixer'
    public static matchingRegex: RegExp = /(\/|\.)myflixer/
    public matchingRegex: RegExp = MyFlixer.matchingRegex
    public platform: string = MyFlixer.platform

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
        const type = await MyFlixer.getType(this.tab, url)
        if (type == "browsing") {
            return { browsing: true }
        } else if (type == "watching") {
            const iframe = await global.browser.getIFrame(this.tab, /.*megacloud\.tv/).catch(() => null)
            if (iframe) {
                return {
                    watching: true,
                    title: await global.browser.evaluate(this.tab, `document.querySelector("li.breadcrumb-item.active")?.innerText.replace(/\\s-\\s(Season|Episode).*/gm,"")`, "title"),
                    type: await global.browser.evaluate(this.tab, `document.querySelector(".ss-episodes") == undefined ? "movie" : "series"`, "type"),
                    episode_title: await global.browser.evaluate(this.tab, `document.querySelector("li>a.active.eps-item")?.innerText?.replace(/^.*?:/m,"")?.trim() ?? "N/A"`, "episode_title"),
                    episode: await global.browser.evaluate(this.tab, `parseInt(document.querySelector("li>a.active.eps-item")?.innerText?.replace(/:.*/g,"")?.replace(/[a-zA-Z]/g,"")) ?? "N/A"`, "episode"),
                    season: await global.browser.evaluate(this.tab, `parseInt(document.querySelector("#current-season")?.innerText?.replace(/[a-zA-Z]/g,""))`, "season"),
                    episode_total: await global.browser.evaluate(this.tab, `Array.from(document.querySelector(".ss-episodes.active").children).find(a=>a.tagName=="UL").children.length`, "episode_total"),
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
        const iframe = await global.browser.getIFrame(tabId, /.*megacloud\.tv/).catch(() => null)
        if (iframe) {
            return await global.browser.evaluate(iframe, `!document.querySelector("video")?.paused ?? "N/A"`, "playingCheck")
        } else {
            return false
        }
    }

    public get ready(): Promise<boolean> {
        return new Promise(async (resolve) => {
            const type = await MyFlixer.getType(this.tab)
            if (type == "browsing") {
                resolve(true)
            } else if (type == "watching") {
                const iframe = await global.browser.getIFrame(this.tab, /.*megacloud\.tv/).catch(() => null)
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
