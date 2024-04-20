import { AWG } from "@src/types/types.js";

declare const global: AWG; 



export default function init() {
    global.websiteMap.set(/(\/|\.)myflixer/, {
        platform: "myflixer",
        title: `document.querySelector("li.breadcrumb-item.active")?.innerText.replace(/\\s-\\s(Season|Episode).*/gm,"")`,
        type: `document.querySelector(".ss-episodes") == undefined ? "movie" : "series"`,
    
        episode_title: `document.querySelector("li>a.active.eps-item")?.innerText?.replace(/^.*?:/m,"")?.trim() ?? "N/A"`,
        episode: `parseInt(document.querySelector("li>a.active.eps-item")?.innerText?.replace(/:.*/g,"")?.replace(/[a-zA-Z]/g,"")) ?? "N/A"`,
        season: `parseInt(document.querySelector("#current-season")?.innerText?.replace(/[a-zA-Z]/g,""))`,
        episode_total: `Array.from(document.querySelector(".ss-episodes.active").children).find(a=>a.tagName=="UL").children.length`,
        
        episode_progress: `IF:document.querySelector("video")?.currentTime ?? "N/A"`,
        episode_duration: `IF:document.querySelector("video")?.duration ?? "N/A"`,
        
        movie_progress: `IF:document.querySelector("video")?.currentTime ?? "N/A"`,
        movie_duration: `IF:document.querySelector("video")?.duration ?? "N/A"`,
        
        playing: `IF:!document.querySelector("video")?.paused ?? "N/A"`,
        browsing: /\/(home|genre\/.*|country\/.*|movie|tv-show|top-imdb|search|tv|movie)/,
        watching: /\/(watch-tv|watch-movie)/,

        isReady: {
            watching: `IFRAME_EXISTS`
        },
    
        iframe: /.*megacloud\.tv/
    
    })
}