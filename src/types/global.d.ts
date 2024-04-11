interface AllWatcherGlobal extends NodeJS.Global {

    websiteMap: Map<RegExp, {
        platform: string, //? -> string
        title: string, //? -> string
        
        //! Is movie or series
        type: string, //? -> "movie" | "series"
    
        //! series
        season?: string //? -> number
        season_title?: string //? -> string
        episode?: string, //? -> number
        episode_title?: string, //? -> string
    
        episode_progress?: string, //? -> number
        episode_duration?: string, //? -> number
    
        //! movie
        movie_progress?: string, //? -> number
        movie_duration?: string, //? -> number
    
    
        //! booleans
        playing?: string, //? -> boolean
        browsing?: string | RegExp, //? -> boolean
        watching?: string | RegExp, //? -> boolean

        isReady?: {
            watching?: string, //? -> boolean
            browsing?: string, //? -> boolean
        },
    
        preCheck?: {
            watching?: string, //? -> boolean
            browsing?: string, //? -> boolean
        },

        postCheck?: {
            watching?: string, //? -> boolean
            browsing?: string, //? -> boolean
        },

        funcs?: {
            [key: string]: Function
        },
    
        //! get iframe and use it by starting expressions with "IF:"
        iframe?: RegExp, //? -> RegExp
    }>

}