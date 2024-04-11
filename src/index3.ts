import RPC from 'discord-rpc';

const clientIdMap = {
    "soap2day": "1226991012879011860",
    "netflix": "1227576564519010374"
}

let presence = {}


// const scopes = ['rpc', 'rpc.activities.write'];

let client = new RPC.Client({
    transport: 'ipc', 
});

client.once('ready', () => {

    console.log('Authed for user', client.user.username);

    presence = {
        instance: true,
        details: "That One Movie",
        state: "S1:E2 - The one where they do something",
        largeImageKey: "logo",
        startTimestamp: Date.now(),
        endTimestamp: Date.now() +(2*60*60*1000)
    }
    client.setActivity(presence);



    setTimeout(async () => {
        console.log("Switching to netflix")
        await switchPlatform("netflix");
    },20000)

    setTimeout(async () => {
        console.log("Switching to soap2day")
        await switchPlatform("soap2day");
    },40000)

});

client.on("disconnect", (code, reason) => {
    console.log("Connection closed", code, reason);
    process.exit(2);
})

// Log in to RPC with client id
client.login({ clientId: clientIdMap["soap2day"]});


async function switchPlatform(platform: string){
    await client.destroy()

    client = new RPC.Client({
        transport: 'ipc', 
    });
    client.login({ clientId: clientIdMap[platform]});
    client.once('ready', () => {
        console.log('Authed for user', client.user.username);
        client.setActivity(presence);
    })
}


