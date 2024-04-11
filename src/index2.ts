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

import { BrowserController } from "./browser.js";


const browser = new BrowserController();


(async()=>{
    const matching = browser.filterToValidPlatforms(await browser.getTabs())
    console.log(matching)

    

    const interested = matching[0]

    if(interested){
        console.log(interested.title)
        console.log("---")

        // platform: "soap2day",
        // title: `document.querySelector("li.breadcrumb-item.active").innerText`,
        // type: `document.querySelector(".ss-episodes") == undefined ? "movie" : "series"`,
    
        // episode_title: `document.querySelector("li>a.active.eps-item").innerText.replace(/^.*?:/m,"").trim()`,
        // episode: `parseInt(document.querySelector("li>a.active.eps-item").innerText.replace(/:.*/g,"").replace(/[a-zA-Z]/g,""))`,
        // season: `parseInt(document.querySelector("#current-season").innerText.replace(/[a-zA-Z]/g,""))`,
        // playing: `!document.querySelector("video").paused`




    }


})()

