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

export abstract class Platform {
    public static platform: string = 'platform'
    public static matchingRegex: RegExp = /some\.platform\.com/

    public static prettyName: string = 'Platform'

    public matchingRegex: RegExp = Platform.matchingRegex
    public platform: string = Platform.platform

    public tab: string

    constructor(tab: string) {
        if (!tab) throw new Error('Tab is required')
        this.tab = tab
    }

    public async setup(): Promise<boolean> {return true}
    public abstract run(): Promise<{
        platform?: string,
        title?: string,
        type?: string,
        season?: number | string,
        season_total?: number | string,
        episode?: number | string,
        episode_title?: string,
        episode_total?: number | string,
        progress?: number,
        duration?: number,
        playing?: boolean,
        browsing?: boolean,
        watching?: boolean,
        buttons?: {
          label: string,
          url: string
        }[]
      }> 

    public abstract get ready(): Promise<boolean>
}