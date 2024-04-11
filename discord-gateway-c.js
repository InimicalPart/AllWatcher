//get the websocket module
import WebSocket from "ws";
import chalk from "chalk";
import readline from "readline";
import inquirer from "inquirer";
import { QuickDB } from "quick.db";
const prompt = inquirer.createPromptModule();
//get chalk, a prompt module
let heartbeatInterval = 0;
let heartbeatTimer = null;
let autoConnect = true;
let botTag = "";
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

let logChanges = false;
let logHeartbeats = false;
let logNotWantedPresence = false;

let needResuming = false;
let failedTimes = 0;
let maxFailed = 20;
let checkFailedMin = 10;
let failedTimer = null;
//setup quick.db
//if the table "presences" doesn't exist, create it
// const { QuickDB } = await import("quick.db");
// const quickDB = QuickDB("./presences.sqlite");
let lastSessionID,
  sessionID,
  lastSequence,
  sequence = null;
let presences = {};
let token = "MzAxMDYyNTIwNjc5MTcwMDY2.GoGP7f.SwkF2NvOhp2_cQaOtoS3tcyxpSqjEvXEstiOoQ";
let connectionUrl = "wss://gateway.discord.gg";
let status = "TOKENREQ"; // (TOKEN REQUIRED) //(AWAITING CONNECTION)
let ws;
let lastReceivedHB = 0;
rl.on("line", function (line) {
  processInput(line);
});
failedTimer = setInterval(function () {
  //if failedTimes is greater than maxFailed, then exit the process, if not then reset failedTimes
  if (failedTimes > maxFailed) {
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(TMERR) ") +
        chalk.white.bold("Too many errors. Exiting.")
    );
    process.exit(1);
  } else {
    failedTimes = 0;
  }
}, checkFailedMin * 60000);
if (logChanges)
  setInterval(() => {
    if (sessionID !== lastSessionID) {
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(UPDATE) ") +
          chalk.blue.bold("Session ID updated to: " + sessionID)
      );
      lastSessionID = sessionID;
    }
    if (sequence !== lastSequence) {
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(UPDATE) ") +
          chalk.blue.bold("Sequence updated to: " + sequence)
      );
      lastSequence = sequence;
    }
  }, 100);
if (token === "") {
  console.log(
    chalk.hex("#d4af37").bold("! ") +
      chalk.hex("#ff0000").bold("(" + status + ") ") +
      chalk.white.bold("Please enter BOT token.")
  );
} else {
  if (!autoConnect) {
    status = "AWCON";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.white.bold("Press ENTER to initate a connection.")
    );
  } else {
    init();
  }
}
function processInput(input) {
  if (input === "" && status === "AWCON") {
    init();
  } else if (input !== "" && status === "TOKENREQ") {
    token = input;
    status = "AWCON";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.white.bold("Press ENTER to initate a connection.")
    );
  } else if (input.toLowerCase() === "sendreq") {
    status = "SENDREQ";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.white.bold("Paste in the stringified JSON object.")
    );
  } else if (status === "SENDREQ" && input !== "") {
    let request = JSON.parse(input);
    status = "CONREADY";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.white.bold("Sending request.")
    );
    ws.send(JSON.stringify(request));
  }
}
function init() {
  status = "CONNECTING";
  console.log(
    chalk.hex("#d4af37").bold("! ") +
      chalk.hex("#ff0000").bold("(" + status + ") ") +
      chalk.yellow.bold("Connecting to gateway...")
  );
  ws = new WebSocket(connectionUrl);
  ws.on("open", function connection(req) {
    status = "CONNECTED";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.green.bold("Connected to gateway.")
    );
    status = "AWHELLO";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.white.bold("Awaiting HELLO packet...")
    );
  });
  //   ws.on("upgrade", function connection(req) {
  //     console.log(req);
  //   });
  ws.on("message", function incoming(data) {
    let dataObj = JSON.parse(data);
    if (dataObj.s) sequence = dataObj.s;
    if (dataObj.op == 10) {
      // HELLO
      status = "RCVHELLO";
      if (dataObj.d?.heartbeat_interval) {
        heartbeatInterval = dataObj.d.heartbeat_interval;
      }
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + status + ") ") +
          chalk.green.bold(
            "Received HELLO packet. Heartbeat Interval: " + heartbeatInterval
          )
      );
      heartbeatTimer = setInterval(function () {
        if (heartbeatInterval && status !== "DISCONNECTED") {
          if (logHeartbeats)
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(HEARTBEAT) ") +
                chalk.white.bold("Sending heartbeat...")
            );

          ws.send(
            JSON.stringify({
              op: 1,
              d: sequence,
            })
          );
          setTimeout(function () {
            //if no heartbeat is received within the interval, disconnect
            if (new Date().getTime() - lastReceivedHB > heartbeatInterval) {
              console.log(
                chalk.hex("#d4af37").bold("! ") +
                  chalk.hex("#ff0000").bold("(HEARTBEAT)") +
                  chalk.red.bold("Heartbeat not acknowledged. Disconnecting.")
              );
              ws.close();
              process.exit(0);
            }
          }, heartbeatInterval);
        }
      }, heartbeatInterval);
      if (needResuming) {
        status = "RESUMING";
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + status + ") ") +
            chalk.white.bold("Resuming session...")
        );
        status = "AWMPCK";
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + status + ") ") +
            chalk.white.bold("Awaiting missed packets...")
        );
        status = "MSDPACK";
        ws.send(
          JSON.stringify({
            op: 6,
            d: {
              token: token,
              session_id: sessionID,
              seq: sequence,
            },
          })
        );
      } else {
        status = "SNDIDENT";
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + status + ") ") +
            chalk.white.bold("Sending Identify packet...")
        );
        let identify = {
          op: 2,
          d: {
            token: token,
            intents: (1 << 1) + (1 << 7) + (1 << 8),
            properties: {
              $os: "linux",
              $browser: "gatewayclient",
              $device: "gatewayclient",
            },
            presence: {
              status: "idle",
              activities: [
                {
                  name: "Presences",
                  type: 3,
                },
              ],
              since: 91879201,
              afk: false,
            },
          },
        };
        status = "SNTIDENT";
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + status + ") ") +
            chalk.green.bold("Sent Identify packet.")
        );
        status = "AWREADY";
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + status + ") ") +
            chalk.white.bold("Awaiting READY packet...")
        );
        ws.send(JSON.stringify(identify));
      }
    } else if (dataObj.op == 11) {
      if (logHeartbeats)
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(RCVH) ") +
            chalk.green.bold("Heartbeat acknowledged.")
        );
      lastReceivedHB = new Date().getTime();
    } else if (dataObj.t == "READY") {
      status = "RCVREADY";
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + status + ") ") +
          chalk.green.bold("Received READY packet.")
      );
      status = "CONREADY";
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + status + ") ") +
          chalk.green.bold("Connected & Ready as ") +
          chalk.white.bold(
            dataObj.d.user.username + "#" + dataObj.d.user.discriminator
          )
      );
      botTag = dataObj.d.user.username + "#" + dataObj.d.user.discriminator;
      //sequence should exist now
      sequence = dataObj.s;
      sessionID = dataObj.d.session_id;
    } else if (dataObj.t == "PRESENCE_UPDATE") {
      if (
        [
          "516333697163853828",
          "814623079346470993",
          "301062520679170066",
          "745783548241248286",
        ].includes(dataObj?.d?.user?.id) &&
        ["857017449743777812"].includes(dataObj?.d?.guild_id)
      ) {
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(PRESUPD) ") +
            chalk.green.bold(
              "Received presence update for a wanted user.",
              dataObj.d.user.id
            )
        );
        //store it in the db
        presences["user_" + dataObj.d.user.id] = dataObj;
        presences["user_" + dataObj.d.user.id].d.lastUpdated =
          new Date().getTime();
        ws.send(
          JSON.stringify({
            op: 8,
            d: {
              guild_id: presences["user_" + dataObj.d.user.id].d.guild_id,
              user_ids: [presences["user_" + dataObj.d.user.id].d.user.id],
            },
          })
        );
      } else if (logNotWantedPresence) {
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(PRESUPD) ") +
            chalk.red.bold(
              "Received presence update for a non-wanted user.",
              dataObj.d.user.id
            )
        );
      }
    } else if (dataObj.t == "GUILD_MEMBERS_CHUNK") {
      presences["user_" + dataObj.d.members[0].user.id].d.user =
        dataObj.d.members[0].user;
      quickDB.set(
        "presence_" +
          presences["user_" + dataObj.d.members[0].user.id].d.user.id,
        presences["user_" + dataObj.d.members[0].user.id].d
      );
    } else if (dataObj.op == 9) {
      //invalid session. wait a 1-5 seconds and send a new identify packet
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(INVSES) ") +
          chalk.red.bold("Invalid session. Sending new Identify...")
      );
      status = "SNDIDENT";
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + status + ") ") +
          chalk.white.bold("Sending Identify packet...")
      );
      let identify = {
        op: 2,
        d: {
          token: token,
          intents: (1 << 1) + (1 << 7) + (1 << 8) + (1 << 9),
          properties: {
            $os: "linux",
            $browser: "gatewayclient",
            $device: "gatewayclient",
          },
          presence: {
            status: "invisible",
          },
        },
      };
      setTimeout(() => {
        status = "SNTIDENT";
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + status + ") ") +
            chalk.green.bold("Sent Identify packet.")
        );
        status = "AWREADY";
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + status + ") ") +
            chalk.white.bold("Awaiting READY packet...")
        );
        heartbeatInterval = 0;
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        botTag = "";
        needResuming = false;
        presences = {};
        lastReceivedHB = 0;

        ws.send(JSON.stringify(identify));
      }, Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000);
    } else if (dataObj.t == "RESUMED") {
      status = "CONREADY";
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + status + ") ") +
          chalk.green.bold("Received resume confirmation. Resuming as ") +
          chalk.white.bold(botTag)
      );
      needResuming = false;
      if (dataObj.s) sequence = dataObj.s;
    } else if (dataObj.op === 7) {
      //server wants us to reconnect to the gateway
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(RECON) ") +
          chalk.red.bold("Server wants us to reconnect to the gateway.")
      );
      status = "RECON";
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + status + ") ") +
          chalk.white.bold("Reconnecting...")
      );
      ws.close();
    } else if (dataObj.op === 1) {
      ws.send(
        JSON.stringify({
          op: 1,
          d: sequence,
        })
      );
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(Forced-Heartbeat) ") +
          chalk.green.bold("Server forced a heartbeat packet.")
      );
    } else {
      console.log(dataObj);
    }
  });
  ws.on("close", function close() {
    status = "DISCONNECTED";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.red.bold("Disconnected from gateway... Attempting RESUMINATION.")
    );
    failedTimes++;
    heartbeatInterval = 0;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    resuminate();
  });
  function resuminate() {
    status = "RESUMINATION";
    console.log(
      chalk.hex("#d4af37").bold("! ") +
        chalk.hex("#ff0000").bold("(" + status + ") ") +
        chalk.white.bold("Attempting to resume...")
    );
    needResuming = true;
    init();
  }
}

//once heartbeat interval is set, start the heartbeat
