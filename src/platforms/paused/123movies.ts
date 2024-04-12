// declare const global: AllWatcherGlobal; 



// export default function init() {
//     global.websiteMap.set(/ww\.movies123\.la/, {
//         platform: "123movies",
//         title: `document.querySelector(".card-title").textContent`,
//         type: `document.querySelector("#eps-list") == undefined ? "movie" : "series"`,
    
//         episode_title: `IF:IF:document.querySelector("ul.episodes").textContent.trim().replace(/EP.*?:( |)/,"") ?? "N/A"`,
//         episode: `IF:IF:parseInt(document.querySelector("div.title").textContent.split(" ").find(a=>a.startsWith("EP")).replace("EP","")) ?? "N/A"`,
//         season: `IF:IF:parseInt(document.querySelector("div.title").textContent.split(" ").find(a=>a.startsWith("SS")).replace("SS","")) ?? "N/A"`,
//         episode_total: `document.querySelector("#eps-list").children.length`,
        
//         episode_progress: `IF:IF:document.querySelector("video")?.currentTime ?? "N/A"`,
//         episode_duration: `IF:IF:document.querySelector("video")?.duration ?? "N/A"`,
        
//         movie_progress: `IF:IF:document.querySelector("video")?.currentTime ?? "N/A"`,
//         movie_duration: `IF:IF:document.querySelector("video")?.duration ?? "N/A"`,
        
//         playing: `IF:IF:!document.querySelector("video")?.paused ?? "N/A"`,
//         browsing: /\/(123movies|genre\/.*|movies|tv-series|top-imdb)/,
//         watching: /\/movie\//,

//         isReady: {
//             watching: `IFRAME_EXISTS`
//         },
//         iframe: {
//             0: /(play\.123moviesfree\.ltd\/.*?\.php)/,
//             // 1: /(play\.123moviesfree\.ltd\/vidsrc)/,
//             1: /vid30c\.site|2embed\.cc|gomo\.to/,
//         }
    
//     })
// }