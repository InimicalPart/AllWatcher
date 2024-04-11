import { BrowserController } from "@src/browser.js";
import { randomBytes } from "crypto";
import { config } from "dotenv";

config();

declare const global: AllWatcherGlobal; 

export default function init() {
     global.websiteMap.set(/(\/|\.)netflix\.com(\/|)/, {
         platform: "netflix",
         title: `document.querySelector("[data-uia$='video-title']")?.firstChild?.textContent`,
         type: `"series"`,
    
         episode_title: `(document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ").textContent ?? "N/A"`,
         episode: `document.querySelector("video").click();parseInt((document.querySelector("[data-uia$='video-title'] span") ?? " ")?.textContent?.replace("E","")??"0")`,
         season: `0`,
        
         episode_progress: `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`,
         episode_duration: `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`,
        
         movie_progress: `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`,
         movie_duration: `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`,
        
         playing: `!(document.querySelector(".VideoContainer video")?.paused ?? document.querySelector(".watch-video--player-view video")?.paused)`,
         browsing: /\/(browse|search)/,
         watching: /\/watch/,

         isReady: {},

          funcs: {
              getInformation
          }
     })
}



 let cache = {

 }

 const seasons = {}

 let movieIdentifier = ""
 let name = ""
 export async function getInformation(id: string, browser: BrowserController): Promise<{
     platform: string,
     title: string,
     type: string,
     season: number,
     episode: number,
     episode_title: string,
     episode_progress: number,
     episode_duration: number,
     movie_progress: number,
     movie_duration: number,
     playing: boolean,
     browsing: boolean,
     watching: boolean,
 }> {

     if (movieIdentifier == "") {
         movieIdentifier = randomBytes(16).toString("hex")
     }

     const bottomController = "watch-video--bottom-controls-container"
     const eID = await browser.evaluate(id, `document.querySelector("[data-videoid]").dataset.videoid;`) as string
    


     if (!await browser.evaluate(id, `!!document.querySelector(".${bottomController}")`) && !Object.keys(cache).includes(eID)) {
         await browser.evaluate(id, `document.querySelector("video").click()`)
         return null
     }

     const title = await browser.evaluate(id, `document.querySelector("[data-uia$='video-title']")?.firstChild?.textContent`) as string 
     name = title
     const episode_title = await browser.evaluate(id, `(document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ").textContent ?? "N/A"`) as string 
     const episode = parseInt(await browser.evaluate(id, `document.querySelector("[data-uia$='video-title'] span")?.textContent?.replace("E","")??"0"`)as string ?? "0")


     if (!Object.keys(cache).includes(eID)) {
         cache[eID] = {
             title: name,
             eTitle: await browser.evaluate(id, `(document.querySelector("[data-uia$='video-title'] span:nth-child(3)") ?? " ").textContent ?? "N/A"`) as string,
             season: await getSeason(id, name, episode, episode_title, browser),
         }
     }


     const season = 0

     const episode_progress = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`) as string ?? "0")
     const episode_duration = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`) as string ?? "0")

     const movie_progress = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.currentTime ?? document.querySelector(".watch-video--player-view video")?.currentTime ?? "N/A"`) as string  ?? "0")
     const movie_duration = parseFloat(await browser.evaluate(id, `document.querySelector(".VideoContainer video")?.duration ?? document.querySelector(".watch-video--player-view video")?.duration ?? "N/A"`) as string  ?? "0")

     const playing = !await browser.evaluate(id, `(document.querySelector(".VideoContainer video")?.paused ?? document.querySelector(".watch-video--player-view video")?.paused)`)
     const browsing = /\/(browse|search)/.test(browser.pages.find(p => p.id == id).url)
     const watching = /\/watch/.test(browser.pages.find(p => p.id == id).url)

     const fin = {
         platform: "netflix",
         title,
         type: "series",
         season,
         episode,
         episode_title,
         episode_progress,
         episode_duration,
         movie_progress,
         movie_duration,
         playing,
         browsing,
         watching
     }


     console.log(fin)
     return fin


 }

 let apiKey = process.env.TMDB_API_KEY

 async function getSeason(id: string, name, episode, episode_name, browser: BrowserController) {
         let season;
         try {
           if (Object.keys(seasons).includes(name)) {
             let currentEpisodeNumber = parseInt(episode.replace("E", ""));

             console.log(currentEpisodeNumber, episode_name);
             let currentEpisode = seasons[name].episodes.find(
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
             if (movie.results[0].name !== name) {
               movie = await (
                 await fetch(
                   "https:api.themoviedb.org/3/search/movie?query=" +
                     name +
                     "&api_key=" +
                     apiKey
                 )
               ).json();
               type = "movie";
               if (movie.results[0].title !== name) {
                 throw new Error("Movie not found on TMDB");
               }
             }
             let movieId = movie.results[0].id;
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
             let currentEpisodeNumber = parseInt(episode.replace("E", ""));
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

             console.log(currentEpisodeNumber, episode_name);
             let currentEpisode = allEpisodes.find(
               (episodede) =>
                 episodede.episode_number === currentEpisodeNumber &&
                 episodede.name === episode_name
             );

             if (!currentEpisode) {
               throw new Error("Episode not found on TMDB");
             }

             season = currentEpisode.season_number;
             seasons[name] = {
               episodes: allEpisodes,
               name: name,
             };
           }
         } catch (e) {
           console.error(e);
         }


         return season;
 }