import chalk from "chalk";
import {config} from "dotenv";
import { join } from "path";
import inquirer from "inquirer";
import { readFileSync, readdirSync, writeFileSync } from "fs";


config({path: join(process.cwd(), '.env')})

const platforms = []

for (let file of readdirSync(join(process.cwd(), 'dist/platforms'))) {
    if ((file as string).endsWith('.js')) {
        platforms.push((file as string).replace('.js', ''))
    }
}

const nameFormatMap = {
    "netflix": "Netflix",
    "disneyplus": "Disney+",
    "myflixer": "MyFlixer",
    "soap2day": "Soap2Day",
}

let missingPlatforms = []

for (let platform of platforms) {
    if (!process.env["PLATFORM_" + platform]) {
        missingPlatforms.push(platform)
    }
}

if (missingPlatforms.length == 0) {
    platforms.forEach(platform => {
        console.log("Found ID for " + chalk.cyanBright(nameFormatMap[platform] + " - " + process.env["PLATFORM_" + platform]))
    })
    console.log(chalk.greenBright('Everything is set up correctly!'))
} else {
    platforms.filter(platform => process.env[platform]).forEach(platform => {
        console.log("Found ID for " + chalk.cyanBright(nameFormatMap[platform] + " - " + process.env["PLATFORM_" + platform]))
    })
    console.log(chalk.redBright('Missing platform IDs: ' + missingPlatforms.join(', ')))
    console.log()
    // Say that IDs are required for this to work, and that the user has to specify them in the .env file, in the "platform=ID" format, but the user
    // can also provide their Discord token for the system to automatically create the necessary IDs for them
    //
    // Ask the user if they want to provide their Discord token, if they say yes, ask for the token, else exit
    
    console.log('Please provide the necessary IDs in the .env file, in the "' + chalk.cyanBright('PLATFORM_<platform>=<ID>') + '" format (platform being lowercase, same as the file name')
    console.log()
    console.log('You can also provide your Discord token to automatically create the necessary IDs for you')
    console.log('Use this guide to get your Discord token: ' + chalk.cyanBright("https://www.geeksforgeeks.org/how-to-get-discord-token/") + ' (Please keep your token private)')
    console.log()
    console.log(chalk.redBright.bold('If you are cautious about providing your token, you can check the source code of this setup script here: ') + chalk.cyanBright("https://github.com/InimicalPart/AllWatcher/blob/main/setup.ts"))
    console.log()
    inquirer.prompt([
        {
            type: 'confirm',
            name: 'provideToken',
            message: 'Would you like to provide your Discord token?'
        }
    ]).then(async answers => {
        if (answers.provideToken) {
            inquirer.prompt([
                {
                    type: 'input',
                    name: 'discordToken',
                    message: 'Please provide your Discord token:',
                    validate: (input) => {
                        if (!input) {
                            return 'Please provide a token'
                        }
                        return true
                    }
                }
            ]).then(async answers => {
                process.env.DISCORD_TOKEN = answers.discordToken
                console.log(chalk.green('Discord token provided! Starting setup...'))
                setup()
            })
        } else {
            console.log(chalk.redBright('Exiting...'))
            process.exit(2)
        }
    })
} 


async function setup() {
    /*
        POST https://discord.com/api/v9/teams - {"name":"ABCDEF"} - {"id": "1228739932848128000", ...}
        POST https://discord.com/api/v9/applications - {"name":"Netflix", "team_id": "1228738598870712431"} - {"id": "1228738856602304603", ...}
        POST https://discord.com/api/v9/oauth2/applications/1228738856602304603/assets - {"name":"logo", "image": "data:image/png;base64,iVBO...", "type": "1"}
    */


    //validating token
    console.log()
    console.log()
    console.log('Validating token...')
    const validationResponse = await fetch("https://discord.com/api/v9/users/@me", {
        headers: {
            Authorization: process.env.DISCORD_TOKEN
        }
    })
    if (validationResponse.status == 401) {
        console.log(chalk.redBright('Invalid token! Exiting...'))
        process.exit(3)
    } else {
        console.log(chalk.greenBright('Token is valid! Welcome ') + chalk.yellowBright("@"+(await validationResponse.json()).username) + chalk.green('!'))
    }

    console.log()
    console.log("Checking if team exists... (" + chalk.cyanBright("AllWatcher") + ")")
    let teamID = null
    let alreadyExistingApplications = []
    const teamsResponse = await fetch("https://discord.com/api/v9/teams", {
        headers: {
            Authorization: process.env.DISCORD_TOKEN
        }
    })
    for (let team of await teamsResponse.json()) {
        if (team.name == "AllWatcher") {
            teamID = team.id
            console.log(chalk.greenBright('Team found!'))
        }
    }
    
    if (teamID) {
        console.log("Checking what platforms already exist...")
        const applicationsResponse = await fetch("https://discord.com/api/v9/teams/" + teamID + "/applications", {
            headers: {
                Authorization: process.env.DISCORD_TOKEN
            }
        })
        alreadyExistingApplications = (await applicationsResponse.json()).map((app: any) => {
            return {
                id: app.id,
                name: app.name
            }
        })
        console.log(chalk.greenBright('Found ' + chalk.cyanBright(alreadyExistingApplications.length) + ' applications'))
        alreadyExistingApplications.forEach(app => {
            console.log("Platform: " + chalk.cyanBright(app.name.padEnd(Object.values(nameFormatMap).reduce((a, b) => a.length > b.length ? a : b).length, " ")) + " ID: " + chalk.cyanBright(app.id))
        })
        // use the name map to get the name of the platform (value->key)

        let missingApplications = missingPlatforms.filter(platform => !alreadyExistingApplications.map(app => app.name).includes(nameFormatMap[platform]))
        if (missingApplications.length < missingPlatforms.length) {
            console.log(chalk.yellowBright('Some/All of the missing platforms already exist, adding their IDs to .env'))
            const envObj = envToObj(readFileSync(join(process.cwd(), '.env')).toString())
            for (let application of alreadyExistingApplications) {
                let internalName = Object.keys(nameFormatMap).find(key => nameFormatMap[key] == application.name)
                envObj["PLATFORM_"+internalName] = application.id
            }
            const env = objToEnv(envObj)
            writeFileSync(join(process.cwd(), '.env'), env)
            console.log(chalk.greenBright('Added IDs to .env'))
            missingPlatforms = missingApplications
        } 
    } else {
        console.log(chalk.redBright('Team not found! Creating team...'))
        const teamResponse = await fetch("https://discord.com/api/v9/teams", {
            method: 'POST',
            headers: {
                Authorization: process.env.DISCORD_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: "AllWatcher"
            })
        })
        teamID = (await teamResponse.json()).id
        console.log(chalk.greenBright('Team created!'))
    }

    if (missingPlatforms.length == 0) {
        console.log(chalk.greenBright('All platforms are set up! Setup complete!'))
        process.exit(0)
    }
    console.log("Creating applications...")
    let newApplications = []
    for (let platform of missingPlatforms) {
        const response = await fetch("https://discord.com/api/v9/applications", {
            method: 'POST',
            headers: {
                Authorization: process.env.DISCORD_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: nameFormatMap[platform],
                team_id: teamID
            })
        })
        const application = await response.json()
        newApplications.push({
            id: application.id,
            name: application.name
        })
        console.log(chalk.greenBright('Created application for ' + chalk.cyanBright(nameFormatMap[platform])))
    }
    console.log("Creating assets...")
    const platform_icons = readdirSync(join(process.cwd(), 'assets', 'platform_icons'))
    // find the one that matches the platform name, and name it "logo"
    // also add "author.png"
    for (let application of newApplications) {
        const icon = platform_icons.find(icon => icon.replace(".png","") == Object.keys(nameFormatMap).find(key => nameFormatMap[key] == application.name))
        if (icon) {
            await fetch("https://discord.com/api/v9/oauth2/applications/" + application.id + "/assets", {
                method: 'POST',
                headers: {
                    Authorization: process.env.DISCORD_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'logo',
                    image: 'data:image/png;base64,' + readFileSync(join(process.cwd(), 'assets', 'platform_icons', icon)).toString('base64'),
                    type: 1
                })
            })
            console.log(chalk.greenBright('Created "logo" asset for ' + chalk.cyanBright(application.name)))
        } else {
            console.log(chalk.redBright('No icon found for ' + chalk.cyanBright(application.name)))
        }
        const author = platform_icons.find(icon => icon == 'author.png')
        if (author) {
            const response = await fetch("https://discord.com/api/v9/oauth2/applications/" + application.id + "/assets", {
                method: 'POST',
                headers: {
                    Authorization: process.env.DISCORD_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'author',
                    image: 'data:image/png;base64,' + readFileSync(join(process.cwd(), 'assets', 'platform_icons', author)).toString('base64'),
                    type: 1
                })
            })
            console.log(chalk.greenBright('Created "author" asset for ' + chalk.cyanBright(application.name)))
        } else {
            console.log(chalk.redBright('No author icon found'))
        }
    }
    console.log()
    console.log(chalk.greenBright('Adding new IDs to .env'))
    const envObj = envToObj(readFileSync(join(process.cwd(), '.env')).toString())
    for (let application of newApplications) {
        let internalName = Object.keys(nameFormatMap).find(key => nameFormatMap[key] == application.name)
        envObj["PLATFORM_"+internalName] = application.id
    }
    const env = objToEnv(envObj)
    writeFileSync(join(process.cwd(), '.env'), env)
    console.log(chalk.greenBright('Added IDs to .env'))
    console.log()
    console.log(chalk.greenBright('Setup complete!'))
    console.log()
    console.log("It might take a few minutes for the changes to reflect on Discord.")


}

function envToObj(env: string) {
    let obj = {}
    for (let line of env.split('\n')) {
        let [key, value] = line.split('=')
        obj[key] = value
    }
    return obj
}
function objToEnv(obj: any) {
    let env = ''
    for (let key in obj) {
        env += key + '=' + obj[key] + '\n'
    }
    return env.trim()
}


