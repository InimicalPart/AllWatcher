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

import chalk from 'chalk';
import { readdirSync } from 'fs';
import path from 'path';
import UAParserJS from 'ua-parser-js'
import { WebSocket } from 'ws';
import { AWG } from './types/types.js';

declare const global: AWG

//! Where the magic happens
// global.websiteMap = new Map<RegExp, {
//     platform: string, //? -> string
//     title: string, //? -> string
    
//     //! Is movie or series
//     type: string, //? -> "movie" | "series"

//     //! series
//     season?: string //? -> number
//     season_title?: string //? -> string
//     episode?: string, //? -> number
//     episode_title?: string, //? -> string

//     episode_progress?: string, //? -> number
//     episode_duration?: string, //? -> number

//     //! movie
//     movie_progress?: string, //? -> number
//     movie_duration?: string, //? -> number


//     //! playing
//     playing?: string, //? -> boolean


//     //! get iframe and use it
//     iframe?: RegExp, //? -> RegExp
// }>()

// for (let file of readdirSync(path.join(process.cwd(), 'dist/platforms'))) {
//     if (file.endsWith('.js')) {
//         console.log('Loading platform: ' + file)
//         let a = await import(path.join(process.cwd(), 'dist/platforms', file))
//         a.default()
//     }
// }

export class BrowserController {

    port: number = 9222;
    browser: any;
    public pages: {
        id: string,
        type: string,
        parentId?: string,
        url: string,
        platform: string,
        debuggingUrl: string,
        ws?: WebSocket
    }[] = []

    constructor(port?: number) {
        if (port) this.port = port;

        this.checkAvailability().then(available => {
            if (!available) {
                console.error('No browser found, please make sure you have a browser running with remote debugging enabled.')
                console.error('You can enable remote debugging by running your browser with the "--remote-debugging-port=9222" flag')
                process.exit(1)
            }
        })
        this.getBrowser().then(async browser => {
            this.browser = browser
        })

    }

    public async getIFrame(parentID: any, iframeURLRegExp: RegExp): Promise<string> {
        return new Promise(async (resolve, reject) => {
            let page = this.pages.find(page => page.id === parentID)
            if (!page) {
                await this.initiateDebugging(parentID)
                page = this.pages.find(page => page.id === parentID)
            }
            const iframes = (await this.getTabs()).filter(tab => tab.type === 'iframe').filter(tab => tab.parentId === parentID)

            const iframe = iframes.find(iframe => iframeURLRegExp.test(iframe.url))
            if (!iframe) {
                console.error('IFrame not found')
                return reject()
            }

            await this.initiateDebugging(iframe.id)
            console.log("--- FOUND - " + iframe.id + " - " + iframe.url)
            resolve(iframe.id as string)

        })
    }

    public async initiateDebugging(tabId: string) {
        return new Promise(async (resolve, reject) => {
            if (this.pages.find(page => page.id === tabId)) {
                return resolve(this.pages.find(page => page.id === tabId)?.ws)
            }
            
            const tabs = await this.getTabs()
            const tab = tabs.find((tab: any) => tab.id === tabId)
            if (!tab) {
                console.error('Tab not found')
                return reject()
            }

            const ws = new WebSocket(tab.webSocketDebuggerUrl)
            ws.once('open', () => {
                console.log(`Connected remote debugging to tab: ${tab.title} (${tab.type}${tab.parentId ? ` - ${tab.parentId}` : ''})`)
                this.pages.push({
                    type: tab.type,
                    ...(tab.type=="iframe"?{parentId: tab.parentId}:{}),
                    id: tabId,
                    url: tab.url,
                    platform: null,
                    debuggingUrl: tab.webSocketDebuggerUrl,
                    ws
                })
                resolve(ws)
            })
            ws.once('close', () => {
                console.log('Disconnected from tab ' + tab.title)
                this.pages = this.pages.filter(page => page.id !== tabId)
            })
        })
    }

    public async evaluate(tabId: string, expression: string, type:string="UNKWN") {


        return new Promise(async (resolve, reject) => {
        let page = this.pages.find(page => page.id === tabId)
        if (!page) {
            await this.initiateDebugging(tabId)
            page = this.pages.find(page => page.id === tabId)
        }

        console.log(
            chalk.yellowBright(`[*] `) +
            chalk.hex('#A020F0')(`Running JS expression for ${chalk.blueBright(type)} on page: `) +
            chalk.blueBright(page.url.replace(/\?.*/,""))
        )

        const randomNumber = Math.floor(Math.random() * 2147483647)

        page.ws?.send(JSON.stringify({
            id: randomNumber,
            method: 'Runtime.evaluate',
            params: {
                expression
            }
        }))


        function parseResponse(data) {
            const response = JSON.parse(data.toString())
            
            if (response.id === randomNumber) {
                page.ws.off('message', parseResponse)
                if (response.result.result.subtype == "error") {
                    reject(response.result.result.description)
                } else {
                    if (["string","number","boolean"].includes(response.result.result.type)) {
                        resolve(response.result.result.value)
                    } else if (response.result.result.subtype === 'null') {
                        resolve(null)
                    } else if (response.result.result.type === 'undefined') {
                        resolve(undefined)
                    } else resolve(response.result.result)
                }
            }
        }
        page.ws.on('message', parseResponse)
    
        
    
    })

    }


    private async checkAvailability() {
        try {
            await this.request('/json/version', 'GET', null)
            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    public async getTabs() {
        const response = await this.request('/json/list', 'GET', null)
        return await response.json()
    }

    public async getBrowser() {
        const response = await this.request('/json/version', 'GET', null)
        const json = await response.json()
        return UAParserJS(json["User-Agent"])
    }

    public filterToValidPlatforms(tabs: any[]) {
        return tabs.filter(tab => {

            for (const [regex, platform] of global.websiteMap) {
                if (regex.test(tab.url) && !/allwatcher=false/.test(tab.url)) {
                    return true
                }
            }
            return false

        }).map(tab => {
            for (const [regex, platform] of global.websiteMap) {
                if (regex.test(tab.url)) {
                    return {
                        ...tab,
                        platform
                    }
                }
            }
        })
    }

    private request(url: string, method: string, body: any) {
        return fetch(`http://localhost:${this.port}${url}`, {
            method,
            ...(
                ["GET", "HEAD"].includes(method) ? {} : {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            )
        })
    }
}