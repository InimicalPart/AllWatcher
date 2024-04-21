import { Platform } from "@src/lib/base/base-platform.js";
import { AWG } from "@src/types/types.js";

declare const global: AWG

export default class Netflix extends Platform {
    public static platform: string = 'netflix'
    public static matchingRegex: RegExp = /(\/|\.)netflix\.com(\/|)/
    public matchingRegex: RegExp = Netflix.matchingRegex
    public platform: string = Netflix.platform

    public isSetup: boolean = false
    private cache: any = {}
    private seasonsCache: any = {}

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

        let episode_title;
        let episode;
        let season; 
        if (videoType == "series") {
            episode_title = (this.cache[episodeID]?.episode_title ?? await global.browser.evaluate(this.tab, `(document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ")?.textContent || undefined`, "episodeTitleGrab") as string ?? "N/A").replace("’","'")
            episode = this.cache[episodeID]?.episode             || await global.browser.evaluate(this.tab, `parseInt(document.querySelector("[data-uia$='video-title'] span")?.textContent?.replace("E","")??"0")`, "episodeNumberGrab") as number
            season = await this.getSeason(title, episode, episode_title) ?? "?"
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

        if (videoType == "series") {
            totalEpisodesInSeason = season ? this.seasonsCache[title].episodes.filter(e => e.season_number == season).length : "?"
            totalSeasons = this.seasonsCache[title].episodes.reduce((acc, e) => acc.includes(e.season_number) ? acc : [...acc, e.season_number], []).length
        }
  
        const progress = parseFloat(await global.browser.evaluate(this.tab, `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`, "videoProgressGrab") as string ?? "0") * 1000
        const duration = parseFloat(await global.browser.evaluate(this.tab, `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`, "videoDurationGrab") as string ?? "0") * 1000
  
        const isTeleparty = await global.browser.evaluate(this.tab, `document.body.innerHTML.includes("tpinjected")`, "telepartyCheck")
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
          } else {
            this.cache[episodeID].tpLink = null
          }

          return {
            platform: "netflix",
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
                  ...(isTeleparty && global.config?.netflix?.teleparty?.showJoinLink ? [
                    {
                      label: `Watch with ${global.user.global_name}`.length > 32 ? "Join" : `Watch with ${global.user.global_name}`,
                      url: this.cache[episodeID].tpLink
                    }
                  ] : [])
            ]
        }
      }
    public static async isPlaying(tabId) {
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

    private async getSeason(title, episode_number, episode_name) {
        //? Get TMDB API key
        let apiKey = process.env.TMDB_API_KEY
        if (!apiKey) throw new Error("TMDB API key not found")


        let season;
         try {
           //? Check if the title is in the cache, meaning we have already fetched the seasons and episodes
           if (Object.keys(this.seasonsCache).includes(title)) {
             //? Find the episode in the cache
             let currentEpisode = this.seasonsCache[title].episodes.find(
               (episode) =>
                 episode.episode_number === episode_number &&
                 episode.name === episode_name
             );
             //? If the episode is not found, check if the episode name is "Pilot" and if so, find the episode by episode number
             //? It is common that the "Pilot" episode is not named "Pilot" on TMDB 
             if (!currentEpisode) {
                if (episode_name.toLowerCase() == "pilot") {
                  currentEpisode = this.seasonsCache[title].episodes.find(
                    (episode) =>
                      episode.episode_number === episode_number
                  );
                  if (!currentEpisode) throw new Error("Episode not found on TMDB");
                } else throw new Error("Episode not found on TMDB");
             }

             season = currentEpisode.season_number;
           } else {
            //? fetch the title from TMDB as a TV show
             let movie = await (
               await fetch(
                 "https:api.themoviedb.org/3/search/tv?query=" +
                   title +
                   "&api_key=" +
                   apiKey
               )
             ).json();
             let type = "tv";
             //? If the title is not found, fetch the title as a movie
             if (!movie.results.some(serie => serie.name === title)) {
               movie = await (
                 await fetch(
                   "https:api.themoviedb.org/3/search/movie?query=" +
                     title +
                     "&api_key=" +
                     apiKey
                 )
               ).json();
               type = "movie";
               //? If the title is not found as a movie or a TV show, throw an error
               if (!movie.results.some(serie => serie.name === title)) {
                 throw new Error("Movie not found on TMDB");
               }
             }
             let movieId = movie.results.find(serie => serie.name === title).id;
             //? Fetch the details of the movie/TV show
             let details = await (
               await fetch(
                 "https:api.themoviedb.org/3/" +
                   type +
                   "/" +
                   movieId +
                   "?api_key=" +
                   apiKey
               )
             ).json();
             let seasons = details.seasons.filter(
               (season) => season.season_number !== 0
             );

             let allEpisodes = [];
            //? Fetch all episodes of all seasons
             for (let i = 0; i < seasons.length; i++) {
               let season = seasons[i];
               let episodes = await (
                 await fetch(
                   "https:api.themoviedb.org/3/" +
                     type +
                     "/" +
                     movieId +
                     "/season/" +
                     season.season_number +
                     "?api_key=" +
                     apiKey
                 )
               ).json();
               //? Push all episodes to the allEpisodes array
               for (let j = 0; j < episodes.episodes.length; j++) {
                 let episode = {
                   episode_number: episodes.episodes[j].episode_number,
                   name: episodes.episodes[j].name.replace("’","'"),
                   season_number: episodes.episodes[j].season_number,
                 };
                 allEpisodes.push(episode);
               }
             }


            //? Find the current episode
             let currentEpisode = allEpisodes.find(
               (episode) =>
                 episode.episode_number === episode_number &&
                 episode.name === episode_name
             );

            //? If the episode is not found, check if the episode name is "Pilot" and if so, find the episode by episode number
            //? It is common that the "Pilot" episode is not named "Pilot" on TMDB
            if (!currentEpisode) {
                if (episode_name.toLowerCase() == "pilot") {
                currentEpisode = allEpisodes.find(
                    (episode) =>
                    episode.episode_number === episode_number
                );
                if (!currentEpisode) throw new Error("Episode not found on TMDB");
                } else throw new Error("Episode not found on TMDB");
            }

             season = currentEpisode.season_number;
            //? Cache the seasons and episodes
             this.seasonsCache[title] = {
               episodes: allEpisodes,
             };
           }
         } catch (e) {
           console.error(e);
         }


        //? Return the season number
        return season;
    }
}