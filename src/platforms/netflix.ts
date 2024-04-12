import { BrowserController } from "@src/browser.js";
import { randomBytes } from "crypto";
import { config } from "dotenv";

config();

declare const global: AllWatcherGlobal; 

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


 export async function getInformation(id: string, browser: BrowserController, check:boolean=false): Promise<{
      platform?: string,
      title?: string,
      type?: string,
      season?: number,
      episode?: number,
      episode_title?: string,
      episode_progress?: number,
      episode_duration?: number,
      movie_progress?: number,
      movie_duration?: number,
      playing?: boolean,
      browsing?: boolean,
      watching?: boolean,
    }> {


      const playing = !await browser.evaluate(id, `(document.querySelector(".VideoContainer video")?.paused ?? document.querySelector(".watch-video--player-view video")?.paused)`)
      
      const url = await browser.evaluate(id, `document.location.href`) as string

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
        const ready = await browser.evaluate(id, `!!(document.querySelector(".VideoContainer video") ?? document.querySelector(".watch-video--player-view video")) && document.readyState === "complete"`)
        console.log(ready)
        if (!ready) {
          console.log("Not ready")
          return null
        }
      } else if (browsing) {
          return {
            platform: "netflix",
            browsing: true,
          }
      }
      
      const bottomController = "watch-video--bottom-controls-container"
      const eID = await browser.evaluate(id, `document.querySelector("[data-videoid]")?.dataset?.videoid;`) as string ?? url.split("/").pop().split("?")[0] 
      
      
      
      let type = null
      if (watching) {
        if (!await browser.evaluate(id, `!!document.querySelector(".${bottomController}")`) && !Object.keys(cache).includes(eID)) {
          await browser.evaluate(id, `((document.querySelector(".VideoContainer video") ?? document.querySelector(".watch-video--player-view video")).click())`)
          return null
        }
        // button with aria-label="Episodes"
          type = await browser.evaluate(id, `document.querySelector("button[aria-label='Episodes']")`) == undefined ? "movie" : "series"
      }

     const title = await browser.evaluate(id, `document.querySelector("[data-uia$='video-title']")?.firstChild?.textContent`) as string ?? cache[eID]?.title
     const episode_title = await browser.evaluate(id, `(document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ")?.textContent`) as string ?? cache[eID].eTitle ?? "N/A"
     let episode = await browser.evaluate(id, `parseInt(document.querySelector("[data-uia$='video-title'] span")?.textContent?.replace("E","")??"0")`) || cache[eID].episode || 0


     let season = await getSeason(id, title, episode, episode_title, browser)
     if (!Object.keys(cache).includes(eID)) {
         cache[eID] = {
             title,
             eTitle: episode_title,
             episode
         }
     }
     const totalEpisodesInSeason = season ? seasonsCache[title].episodes.filter(e => e.season_number == season).length : 0

     const progress = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`) as string ?? "0") * 1000
     const duration = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`) as string ?? "0") * 1000



     const fin = {
         platform: "netflix",
         title,
         type,
         season,
         episode,
         episode_title,
         episode_total: totalEpisodesInSeason,
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
              }
         ]
     }


     return fin


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
                 episodede.name === episode_name
             );
             if (!currentEpisode) {
               throw new Error("Episode not found on TMDB");
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
                   name: episodes.episodes[j].name,
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
               throw new Error("Episode not found on TMDB");
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