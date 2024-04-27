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

import { AWG } from "@src/types/types.js";
import DiscordRPC from "discord-rpc";
import { readdirSync } from "fs";
import { join } from "path";

declare const global: AWG

export async function connectToDiscordsIPC(asPlatform: string) {
    let client: DiscordRPC.Client
    try {
        client = global.client ?? new DiscordRPC.Client({ transport: "ipc" });
        if (global.client) await client.destroy()
        await client.login({ clientId: asPlatform });
    } catch (err) {
        if (err.message === "Could not connect") {
            return false
        } else console.error(err)
    }
    return client
}

export async function isRemoteDebuggingAvailable() {
    try {
        const browserResponse = await fetch("http://localhost:9222/json/version")
        return browserResponse.status === 200 ? await browserResponse.json() : false
    } catch (err) {
        return false
    }
}


export async function checkMissingPlatformHandlers() {
    const clientIdMap = {}

    for (let platform of Object.keys(process.env).filter(key => key.startsWith("PLATFORM_"))) {
        clientIdMap[platform.replace("PLATFORM_", "").toLowerCase()] = process.env[platform]
    }

    const platforms = []
    for (let file of readdirSync(join(process.cwd(), 'dist/platforms'))) {
        if ((file as string).endsWith('.js')) {
            platforms.push((file as string).replace('.js', ''))
        }
    }

    let missing = platforms.filter(platform => !Object.keys(clientIdMap).includes(platform))
    return missing.length > 0 ? missing : false
}

export async function loadClientIDs() {
    const clientIdMap: {
        [key: string]: string
    } = {}

    for (let platform of Object.keys(process.env).filter(key => key.startsWith("PLATFORM_"))) {
        clientIdMap[platform.replace("PLATFORM_", "").toLowerCase()] = process.env[platform]
    }

    return clientIdMap
}


export function getSeasonWithTimeout(title: string, episode_number: number, episode_name?: string, timeout: number = 5000) {
    return Promise.race([
        getSeason(title, episode_number, episode_name),
        new Promise((resolve) => setTimeout(() => resolve("?"), timeout))
    ])

}

export const seasonsCache = {}

export async function getSeason(title: string, episode_number: number, episode_name?: string) {
    //? Get TMDB API key
    let apiKey = process.env.TMDB_API_KEY
    if (!apiKey) return "?"

    let season;
     try {
       //? Check if the title is in the cache, meaning we have already fetched the seasons and episodes
       if (Object.keys(seasonsCache).includes(title)) {
         //? Find the episode in the cache
         let currentEpisode = seasonsCache[title].episodes.find(
           (episode) =>
             episode.episode_number === episode_number &&
             (!episode_name || episode.name.toLowerCase() === episode_name.toLowerCase())
         );
         //? If the episode is not found, check if the episode name is "Pilot" and if so, find the episode by episode number
         //? It is common that the "Pilot" episode is not named "Pilot" on TMDB 
         if (!currentEpisode) return "?"

         season = currentEpisode.season_number;
       } else {
        //? Fetch the title from TMDB as a TV show
        let movie = await (
            await fetch(`https:api.themoviedb.org/3/search/tv?include_adult=true&query=${title}&api_key=${apiKey}`)
        ).json();

        let type = "tv";

        //? If the title is not found, fetch the title as a movie
        if (!movie.results.some(serie => serie.name === title)) {
            movie = await (  
                await fetch(`https:api.themoviedb.org/3/search/movie?include_adult=true&query=${title}&api_key=${apiKey}`)
            ).json();
            type = "movie";
            
            //? If the title is not found as a movie or a TV show, throw an error
            if (!movie.results.some(serie => serie.name === title)) {
                throw new Error("Movie not found on TMDB");
            }
        }

         

         for (let i = 0; i < movie.results.filter(serie => serie.name === title).length; i++) {
           let movieId = movie.results[i].id;
          //? Fetch the details of the movie/TV show
          let details = await (
            await fetch(
              `https:api.themoviedb.org/3/${type}/${movieId}?api_key=${apiKey}`
            )
          ).json();
          let seasons = details.seasons.filter(
            (season) => season.season_number !== 0
          );

          let allEpisodes = [];

          //? Fetch all episodes of all seasons
          for (let i = 0; i < seasons.length; i++) {
            let episodes = await (
              await fetch(
                `https:api.themoviedb.org/3/${type}/${movieId}/season/${seasons[i].season_number}?api_key=${apiKey}`
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
            (!episode_name || episode.name.toLowerCase() === episode_name.toLowerCase())
        );

          //? If the episode is not found, check the next movie/TV show
          if (!currentEpisode) continue

          season = currentEpisode.season_number;
          //? Cache the seasons and episodes
          seasonsCache[title] = {
            episodes: allEpisodes,
          };
          break
       }
       if (!seasonsCache[title]) throw new Error("Could not find the movie/TV show on TMDB");
      }
     } catch (e) {
       console.error(e);
     }


    //? Return the season number
    return season;
}

export function HMS2ms(hms: string) {
    let hmsSplit = hms.split(':');
    let seconds = 0;
    if (hmsSplit.length == 3) {
        seconds += parseInt(hmsSplit[0]) * 60 * 60
        seconds += parseInt(hmsSplit[1]) * 60
        seconds += parseInt(hmsSplit[2])
    } else if (hmsSplit.length == 2) {
        seconds += parseInt(hmsSplit[0]) * 60
        seconds += parseInt(hmsSplit[1])
    }
    return seconds * 1000
}

export function ms2HMS(ms: number) {
    let seconds = ms / 1000
    let hours = Math.floor(seconds / 3600)
    seconds = seconds % 3600
    let minutes = Math.floor(seconds / 60)
    seconds = seconds % 60
    return hours ?
        `${hours.toString().padEnd(2,"0")}:${minutes.toString().padEnd(2,"0")}:${seconds.toString().padEnd(2,"0")}` :
        `${minutes.toString().padEnd(2,"0")}:${seconds.toString().padEnd(2,"0")}`
}