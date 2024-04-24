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

export default class Netflix extends Platform {
    public static prettyName: string = 'Netflix'
    public static platform: string = 'netflix'
    public static matchingRegex: RegExp = /(\/|\.)netflix\.com(\/|)/
    public matchingRegex: RegExp = Netflix.matchingRegex
    public platform: string = Netflix.platform


    public isSetup: boolean = false
    private cache: any = {}

    constructor(tab: string) {
        super(tab)
    }

    public async setup(): Promise<boolean> {
        this.isSetup = true
        return true
    }

    public async run() {
        const url = (await global.browser.getTabs()).find((tab: any) => tab.id === this.tab).url
        const type = await Netflix.getType(this.tab, url)
        if (type == "browsing") return { browsing: true }

        const episodeID = await global.browser.evaluate(this.tab, `document.querySelector("[data-videoid]")?.dataset?.videoid;`, "episodeID") as string ?? url.split("/").pop().split("?")[0]

        await global.browser.evaluate(this.tab, `
            if (!(typeof skipIntroInterval != "undefined") && ${global?.config?.netflix?.autoSkipIntro ?? false}) {
                skipIntroInterval = setInterval(()=>{
                    document.querySelector("button[data-uia='player-skip-intro']")?.click()
                },100)
            } else if ((typeof skipIntroInterval != "undefined") && ${global?.config?.netflix?.autoSkipIntro ?? false} == false) {
                clearInterval(skipIntroInterval)
                delete skipIntroInterval
            }
        `, "SkipIntroSetup")

        await global.browser.evaluate(this.tab, `
          if (!(typeof skipRecapInterval != "undefined") && ${global?.config?.netflix?.autoSkipRecap ?? false}) {
            skipRecapInterval = setInterval(()=>{
                  document.querySelector("button[data-uia='player-skip-recap']")?.click()
              },100)
          } else if ((typeof skipRecapInterval != "undefined") && ${global?.config?.netflix?.autoSkipRecap ?? false} == false) {
              clearInterval(skipRecapInterval)
              delete skipRecapInterval
          }
      `, "SkipRecapSetup")


        if (!await global.browser.evaluate(this.tab, `!!document.querySelector(".watch-video--bottom-controls-container")`, "bottomContainerCheck") && !Object.keys(this.cache).includes(episodeID)) {
            await global.browser.evaluate(this.tab, `((document.querySelector(".VideoContainer video") ?? document.querySelector(".watch-video--player-view video")).click())`, "bottomContainerActivate")
            return null
        }
        
        let videoType = await global.browser.evaluate(this.tab, `document.querySelector("button[aria-label='Episodes']")`, "moviesOrSeriesCheck") == undefined ? "movie" : "series"
        if (videoType == "movie") {
          if (this.cache[episodeID]?.type == "series") {
            videoType = "series"
          }
        }


        const title = this.cache[episodeID]?.title                 ?? await global.browser.evaluate(this.tab, `document.querySelector("[data-uia$='video-title']")?.firstChild?.textContent || undefined`, "titleGrab") as string ?? "N/A"

        let episode_title: any;
        let episode: any;
        let season: any; 
        if (videoType == "series") {
            episode_title = (this.cache[episodeID]?.episode_title   ?? await global.browser.evaluate(this.tab, `(document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ")?.textContent || undefined`, "episodeTitleGrab") as string ?? "N/A").replace("’","'")
            episode = this.cache[episodeID]?.episode                || await global.browser.evaluate(this.tab, `parseInt(document.querySelector("[data-uia$='video-title'] span")?.textContent?.replace("E","")??"0")`, "episodeNumberGrab") as number
            season = await getSeason(title, episode, episode_title) ?? "?"
        }
        const playing = await Netflix.isPlaying(this.tab)
        
        if (!Object.keys(this.cache).includes(episodeID)) {
            this.cache[episodeID] = {
                title,
                episode_title,
                episode,
                type: videoType
            }
        }

        let totalEpisodesInSeason = "?"
        let totalSeasons = "?"

        if (videoType == "series" && season != "?") {
            totalEpisodesInSeason = season ? seasonsCache[title].episodes.filter((e: { season_number: any; }) => e.season_number == season).length : "?"
            totalSeasons = seasonsCache[title].episodes.reduce((acc: string | any[], e: { season_number: any; }) => acc.includes(e.season_number) ? acc : [...acc, e.season_number], []).length
        }
  
        const progress = parseFloat(await global.browser.evaluate(this.tab, `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`, "videoProgressGrab") as string ?? "0") * 1000
        const duration = parseFloat(await global.browser.evaluate(this.tab, `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`, "videoDurationGrab") as string ?? "0") * 1000
  
        const isTeleparty = global.config?.netflix?.teleparty?.showInRichPresence ? await global.browser.evaluate(this.tab, `document.body.innerHTML.includes("tpinjected")`, "telepartyCheck") : false
        let telepartyLabel = ""
        let peopleInParty = 0
          if (isTeleparty) {
            const chatIframe = await global.browser.getIFrame(this.tab, /redirect\.teleparty\.com/).catch(()=>null)
            if (chatIframe) {
              peopleInParty = await global.browser.evaluate(chatIframe, `parseInt(document.querySelector("div[data-tip='View member list']")?.querySelector("p")?.textContent)??0`, "peopleInTelepartyGrab") as number
              await global.browser.evaluate(chatIframe, `if (document.body.getAttribute("clipboard-overwrite") !== "true") {let a=0;const old = navigator.clipboard.writeText;navigator.clipboard.writeText = async (text)=>{document.body.setAttribute("tp-link", text);if (a!==0){old.bind(navigator.clipboard, text)} else {a++}};document.body.setAttribute("clipboard-overwrite", "true")}`, "copyTelepartyLinkOverride")
                if (!this.cache[episodeID].tpLink) {
                  await global.browser.evaluate(chatIframe, `document.querySelector("button[data-for='linkTip']")?.click()`, "storeTelepartyLink")
                  const link = await global.browser.evaluate(chatIframe, `document.body.getAttribute("tp-link")`, "grabTelepartyLink") as string;
                  if (link && link.split("/join/")[1].trim() !== "") this.cache[episodeID].tpLink = link
                }
              }

              if (global?.config?.netflix?.teleparty?.showInRichPresence) {

                const pluralSingular = peopleInParty > 1 || peopleInParty == 0 ? "others" : "other"
                if (global.config?.netflix?.teleparty?.showJoinLink) {
                  if (peopleInParty == 1) {
                    telepartyLabel = `Watch with ${global.user.global_name}`.length > 32 ? "Join" : `Watch with ${global.user.global_name}` 
                  } else {
                    telepartyLabel = `Watch with ${peopleInParty} ${pluralSingular}`.length > 32 ? "Join" : `Watch with ${peopleInParty} ${pluralSingular}}`
                  }
                } else {
                  if (peopleInParty == 1) {
                    telepartyLabel = `Watching alone` 
                  } else {
                    telepartyLabel = `Watching with ${peopleInParty} ${pluralSingular}`
                  }
                }
              }

          } else {
            this.cache[episodeID].tpLink = null
          }




          return {
            platform: Netflix.platform,
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
                      label: `Watch: ${title}`.length > 32 ? "Watch" : `Watch: ${title}`,
                      url: "https://www.netflix.com/title/" + episodeID
                  },
                  ...(isTeleparty && global.config?.netflix?.teleparty?.showInRichPresence ? [
                    {
                      label: telepartyLabel,
                      url: global.config?.netflix?.teleparty?.showJoinLink ? this.cache[episodeID].tpLink : "http://#"
                    }
                  ] : [])
            ]
        }
      }
    public static async isPlaying(tabId: string) {
        return !await global.browser.evaluate(tabId, `(document.querySelector(".VideoContainer video")?.paused ?? document.querySelector(".watch-video--player-view video")?.paused)`, "playingCheck")
    }

    public get ready(): Promise<boolean> {
        return new Promise(async (resolve) => {
            const type = await Netflix.getType(this.tab)
            if (type == "browsing") {
                global.browser.evaluate(this.tab, `document.readyState === "complete"`, "ReadyCheck").then(resolve)
            } else if (type == "watching") {
                global.browser.evaluate(this.tab, `!!(document.querySelector(".VideoContainer video") ?? document.querySelector(".watch-video--player-view video")) && document.readyState === "complete"`, "ReadyCheck").then(resolve)
            } else {
                console.warn("The '" + this.platform + "' platform was unable to determine the type of activity.")
                resolve(false)
            }
        })
    }

    private static async getType(tabId: string, url?: string) {
        const tabURL = url ?? (await global.browser.getTabs()).find((tab: any) => tab.id === tabId).url
        const result = {
            browsing: /\/(browse|search|title)/.test(tabURL),
            watching: /\/watch/.test(tabURL)
        }
        return result.watching ? "watching" : result.browsing ? "browsing" : null
    }


}