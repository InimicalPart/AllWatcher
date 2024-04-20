export abstract class Platform {
    // public static platform: string;
    // public static matchingRegex: RegExp;
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
      }> 

    public abstract get ready(): Promise<boolean>
}