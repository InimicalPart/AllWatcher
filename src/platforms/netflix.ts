import { BrowserController } from "@src/browser.js";
import { AWG } from "@src/types/types.js";
import { randomBytes } from "crypto";
import { config } from "dotenv";
import { readFileSync, watch } from "fs";
import JsonCParser from "jsonc-parser";
config();
import { join } from "path";


declare const global: AWG; 

export default function init() {
     global.websiteMap.set(/(\/|\.)netflix\.com(\/|)/, {
        platform: "netflix",
        funcs: {
          getInformation
        }
     })
}



 let cache = {}


let seasonsCache = {
  /*
  "name": {
    episodes: [
      {
        episode_number: number,
        name: string,
        season_number: number
      }
    ],
    name: string
  }
  
  
  */
}

const NetflixConfig = JsonCParser.parse(readFileSync(join(process.cwd(), "config.jsonc")).toString())?.netflix


 export async function getInformation(id: string, browser: BrowserController, user, check:boolean=false): Promise<{
      platform?: string,
      title?: string,
      type?: string,
      season?: number,
      season_total?: number,
      episode?: number,
      episode_title?: string,
      episode_total?: number,
      episode_progress?: number,
      episode_duration?: number,
      movie_progress?: number,
      movie_duration?: number,
      playing?: boolean,
      browsing?: boolean,
      watching?: boolean,
      buttons?: {
        label: string,
        url: string
      }[]
    }> {

      const playing = !await browser.evaluate(id, `(document.querySelector(".VideoContainer video")?.paused ?? document.querySelector(".watch-video--player-view video")?.paused)`, "playingCheck")
      
      const url = await browser.evaluate(id, `document.location.href`, "urlGrab") as string

      const browsing = /\/(browse|search|title)/.test(url)
      const watching = /\/watch/.test(url)
      

      if (check) {
        return {
          platform: "netflix",
          watching,
          browsing
        }
      }


      if (watching) {
        const ready = await browser.evaluate(id, `!!(document.querySelector(".VideoContainer video") ?? document.querySelector(".watch-video--player-view video")) && document.readyState === "complete"`, "readyCheck")
        if (!ready) {
          console.log("Page isn't ready to be handled by platform handler")
          return null
        }
      } else if (browsing) {
          return {
            platform: "netflix",
            browsing: true,
          }
      }
    
      
      const bottomController = "watch-video--bottom-controls-container"
      const eID = await browser.evaluate(id, `document.querySelector("[data-videoid]")?.dataset?.videoid;`, "episodeIDGrabber") as string ?? url.split("/").pop().split("?")[0] 
      
      if (NetflixConfig?.autoSkipIntro && watching) {
        await browser.evaluate(id, `Array.from(document.querySelectorAll("span")).filter((a) => a.innerText == "Skip intro").forEach((a) => a.click())`, "skipIntro")
      }

      
      
      let type = null
      if (watching) {
        if (!await browser.evaluate(id, `!!document.querySelector(".${bottomController}")`, "bottomContainerCheck") && !Object.keys(cache).includes(eID)) {
          await browser.evaluate(id, `((document.querySelector(".VideoContainer video") ?? document.querySelector(".watch-video--player-view video")).click())`, "bottomContainerActivate")
          return null
        }
        // button with aria-label="Episodes"
          type = await browser.evaluate(id, `document.querySelector("button[aria-label='Episodes']")`, "moviesOrSeriesCheck") == undefined ? "movie" : "series"
          if (type == "movie") {
            if (cache[eID].type == "series") {
              type = "series"
            }
          }
      }
      if (watching) {
      const title = await browser.evaluate(id, `document.querySelector("[data-uia$='video-title']")?.firstChild?.textContent || undefined`, "titleGrab") as string ?? cache[eID]?.title
      const episode_title = (await browser.evaluate(id, `(document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ")?.textContent || undefined`, "episodeTitleGrab") as string ?? cache[eID].eTitle ?? "N/A").replace("’","'")
      let episode = await browser.evaluate(id, `parseInt(document.querySelector("[data-uia$='video-title'] span")?.textContent?.replace("E","")??"0")`, "episodeNumberGrab") || cache[eID].episode || 0


      let season = await getSeason(id, title, episode, episode_title, browser) ?? "?"
      if (!Object.keys(cache).includes(eID)) {
          cache[eID] = {
              title,
              eTitle: episode_title,
              episode,
              type
          }
      }
      const totalEpisodesInSeason = season ? seasonsCache[title].episodes.filter(e => e.season_number == season).length : 0
      const totalSeasons = seasonsCache[title].episodes.reduce((acc, e) => acc.includes(e.season_number) ? acc : [...acc, e.season_number], []).length

      const progress = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`, "videoProgressGrab") as string ?? "0") * 1000
      const duration = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`, "videoDurationGrab") as string ?? "0") * 1000

      const isTeleparty = await browser.evaluate(id, `document.body.innerHTML.includes("tpinjected")`, "telepartyCheck")
      let peopleInParty = 0
        if (isTeleparty) {
          const chatIframe = await browser.getIFrame(id, /redirect\.teleparty\.com/).catch(()=>null)
          if (chatIframe) {
            peopleInParty = await browser.evaluate(chatIframe, `parseInt(document.querySelector("div[data-tip='View member list']")?.querySelector("p")?.textContent)??0`, "peopleInTelepartyGrab") as number
            await browser.evaluate(chatIframe, `if (document.body.getAttribute("clipboard-overwrite") !== "true") {let a=0;const old = navigator.clipboard.writeText;navigator.clipboard.writeText = async (text)=>{document.body.setAttribute("tp-link", text);if (a!==0){old.bind(navigator.clipboard, text)} else {a++}};document.body.setAttribute("clipboard-overwrite", "true")}`, "copyTelepartyLinkOverride")
              if (!cache[eID].tpLink) {
                await browser.evaluate(chatIframe, `document.querySelector("button[data-for='linkTip']")?.click()`, "storeTelepartyLink")
                const link = await browser.evaluate(chatIframe, `document.body.getAttribute("tp-link")`, "grabTelepartyLink") as string;
                if (link && link.split("/join/")[1].trim() !== "") cache[eID].tpLink = link
              }
            }
        } else {
          cache[eID].tpLink = null
        }
          

      return {
          platform: "netflix",
          title,
          type,
          season,
          episode,
          episode_title,
          episode_total: totalEpisodesInSeason,
          season_total: totalSeasons,
          episode_progress: progress,
          episode_duration: duration,
          movie_progress: progress,
          movie_duration: duration,
          playing,
          browsing,
          watching,
          buttons: [
                {
                    label: `Watch ${title}`.length > 32 ? "Watch" : `Watch ${title}`,
                    url: "https://www.netflix.com/title/" + eID
                },
                ...(isTeleparty&&NetflixConfig?.teleparty?.showJoinLink ? [
                  {
                    label: `Watch with ${user.global_name}`.length > 32 ? "Join" : `Watch with ${user.global_name}`,
                    url: cache[eID].tpLink
                  }
                ] : [])
          ]
      }
      } else {
      return {
        platform: "netflix",
        browsing: true
      }
    }

 }


 async function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
  }

  let apiKey = process.env.TMDB_API_KEY
  async function getSeason(id: string, name, episode, episode_name, browser: BrowserController) {
    let season;
     try {
       if (Object.keys(seasonsCache).includes(name)) {
         let currentEpisodeNumber = episode
         let currentEpisode = seasonsCache[name].episodes.find(
           (episodede) =>
             episodede.episode_number === currentEpisodeNumber &&
             episodede.name.replace("’","'") === episode_name
         );
         if (!currentEpisode) {
            if (episode_name.toLowerCase() == "pilot") {
              currentEpisode = seasonsCache[name].episodes.find(
                (episodede) =>
                  episodede.episode_number === currentEpisodeNumber
              );
              if (!currentEpisode) throw new Error("Episode not found on TMDB");
            } else throw new Error("Episode not found on TMDB");
         }

         season = currentEpisode.season_number;
       } else {
         let movie = await (
           await fetch(
             "https:api.themoviedb.org/3/search/tv?query=" +
               name +
               "&api_key=" +
               apiKey
           )
         ).json();
         let type = "tv";
         if (!movie.results.some(serie=>serie.name === name)) {
           movie = await (
             await fetch(
               "https:api.themoviedb.org/3/search/movie?query=" +
                 name +
                 "&api_key=" +
                 apiKey
             )
           ).json();
           type = "movie";
           if (!movie.results.some(serie=>serie.name === name)) {
             throw new Error("Movie not found on TMDB");
           }
         }
         let movieId = movie.results.find(serie=>serie.name === name).id;
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
         let currentEpisodeNumber = episode
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

           for (let j = 0; j < episodes.episodes.length; j++) {
             let episodee = {
               episode_number: episodes.episodes[j].episode_number,
               name: episodes.episodes[j].name.replace("’","'"),
               season_number: episodes.episodes[j].season_number,
             };
             allEpisodes.push(episodee);
           }
         }


         let currentEpisode = allEpisodes.find(
           (episodede) =>
             episodede.episode_number === currentEpisodeNumber &&
             episodede.name === episode_name
         );

         if (!currentEpisode) {
          if (episode_name.toLowerCase() == "pilot") {
            currentEpisode = allEpisodes.find(
              (episodede) =>
                episodede.episode_number === currentEpisodeNumber
            );
            if (!currentEpisode) throw new Error("Episode not found on TMDB");
          } else throw new Error("Episode not found on TMDB");


         }

         season = currentEpisode.season_number;
         seasonsCache[name] = {
           episodes: allEpisodes,
         };
       }
     } catch (e) {
       console.error(e);
     }


     return season;
}