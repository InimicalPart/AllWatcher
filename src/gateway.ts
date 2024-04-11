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

//get the websocket module
import WebSocket from "ws";
import chalk from "chalk";
import EventEmitter from "events";



const connectionUrl = "wss://gateway.discord.gg";

const statuses = {
    IDLE: 0,
    CONNECTING: 1,
    CONNECTED: 2,
    DISCONNECTED: 3,

    AWAITING_HELLO: 4,
    HELLO_RECEIVED: 5,

    RESUMING: 6,
    AWAITING_MISSED_PACKETS: 7,
    
    SENDING_IDENTIFY: 8,
    IDENTIFY_SENT: 9,
  
    AWAITING_READY: 10,
    READY_RECEIVED: 11,
    CONNECTED_READY: 12,


    RECONNECTING: 13,

    RESUMINATION: 14,
    


}


export class GatewayClient {

    ws: WebSocket;
    status: EventEmitter = new EventEmitter();
    _token: string;
    _os: string = "linux";
    _browser: string = "gatewayclient";
    _device: string = "by-inimi";
    _activities: Array<{
      name: string,
      type: number,
      url?: string,
      state?: string,
      details?: string,
      application_id?: string,
      assets?: {
        large_image?: string,
        large_text?: string,
        small_image?: string,
        small_text?: string,
      },
      timestamps?: {
        start?: number,
        end?: number,
      },
      party?: {
        id?: string,
        size?: [number, number],
      },
      secrets?: {
        join?: string,
        spectate?: string,
        match?: string,
      },
      instance?: boolean,
      buttons?: Array<{
        label: string,
        url: string,
      }>
    }> = [];
    
    _status: number = statuses.IDLE
    _heartbeat_interval: number = 0;
    _session_id: string = "";
    _sequence: number = 0;

    _heartbeatTimer: NodeJS.Timeout | null = null;
    _lastReceivedHB: number = 0;

    _needResuming: boolean = false;
    _intents: number = (1 << 1) + (1 << 7) + (1 << 8)

    _connectedUser: string = "";
    _retries: number = 0;
    _maxRetries: number = 5;

    constructor(settings:{
      token: string,
      intents?: number,
      os?: string,
      browser?: string,
      device?: string,
      activities?: Array<{
        name: string,
        type: number,
        url?: string,
        state?: string,
        details?: string,
        application_id?: string,
        assets?: {
          large_image?: string,
          large_text?: string,
          small_image?: string,
          small_text?: string,
        },
        timestamps?: {
          start?: number,
          end?: number,
        },
        party?: {
          id?: string,
          size?: [number, number],
        },
        secrets?: {
          join?: string,
          spectate?: string,
          match?: string,
        },
        instance?: boolean,
        buttons?: Array<{
          label: string,
          url: string,
        }>
      }>
    }) {
        this._status = statuses.CONNECTING
        this._token = settings.token;
        if (settings.intents) this._intents = settings.intents;
        if (settings.os) this._os = settings.os;
        if (settings.browser) this._browser = settings.browser;
        if (settings.device) this._device = settings.device;
        if (settings.activities) this._activities = settings.activities;
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + this._status + ") ") +
            chalk.white.bold("Connecting to gateway...")
        );
        this.ws = new WebSocket(connectionUrl);
        this.ws.on("open", this.onOpen.bind(this));
        this.ws.on("close", this.onClose.bind(this));
        this.ws.on("message", this.onMessage.bind(this));
    }

    private onOpen() {
        this._status = statuses.CONNECTED;
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + this._status + ") ") +
            chalk.green.bold("Connected to gateway.")
        );
        this._status = statuses.AWAITING_HELLO;
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + this._status + ") ") +
            chalk.white.bold("Awaiting HELLO packet...")
        );
    }

    private onClose() {
      this._status = statuses.DISCONNECTED
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + this._status + ") ") +
          chalk.red.bold("Disconnected from gateway... Attempting RESUMINATION.")
      );
      this._retries++;
      this._heartbeat_interval = 0;
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
      this.resuminate();
    }

    private resuminate() {
      this._status = statuses.RESUMINATION;
      if (this._retries > this._maxRetries) {
        console.log(
          chalk.hex("#d4af37").bold("! ") +
            chalk.hex("#ff0000").bold("(" + statuses.DISCONNECTED + ") ") +
            chalk.red.bold("Max retries reached. Exiting.")
        );
        process.exit(0);
      }
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(" + this._status + ") ") +
          chalk.white.bold("Attempting to resume...")
      );
      this._needResuming = true;
      this.constructor({
        token: this._token,
        intents: this._intents,
        os: this._os,
        browser: this._browser,
        device: this._device,
        activities: this._activities,
      })
    }

    private onMessage(data: any) {
        let dataObj = JSON.parse(data);
        if (dataObj.s) this._sequence = dataObj.s;
        if (dataObj.op == 10) {
          // HELLO
          this._status = statuses.HELLO_RECEIVED
          if (dataObj.d?.heartbeat_interval) {
            this._heartbeat_interval = dataObj.d.heartbeat_interval;
          }
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(" + this._status + ") ") +
              chalk.green.bold(
                "Received HELLO packet. Heartbeat Interval: " + this._heartbeat_interval
              )
          );
          this._heartbeatTimer = setInterval(function (upper) {
            if (upper._heartbeat_interval && upper._status !== statuses.DISCONNECTED) {
                console.log(
                    chalk.hex("#d4af37").bold("! ") +
                    chalk.hex("#ff0000").bold("(HEARTBEAT) ") +
                    chalk.white.bold("Sending heartbeat...")
                );
    
                upper.ws.send(
                    JSON.stringify({
                        op: 1,
                        d: upper._sequence,
                    })
                );
              setTimeout(function () {
                //if no heartbeat is received within the interval, disconnect
                if (new Date().getTime() - upper._lastReceivedHB > upper._heartbeat_interval) {
                  console.log(
                    chalk.hex("#d4af37").bold("! ") +
                      chalk.hex("#ff0000").bold("(HEARTBEAT)") +
                      chalk.red.bold("Heartbeat not acknowledged. Disconnecting.")
                  );
                  upper.ws.close();
                  process.exit(0);
                }
              }, upper._heartbeat_interval);
            }
          }, this._heartbeat_interval, this);
          if (this._needResuming) {
            this._status = statuses.RESUMING;
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(" + this._status + ") ") +
                chalk.white.bold("Resuming session...")
            );
            this._status = statuses.AWAITING_MISSED_PACKETS;
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(" + this._status + ") ") +
                chalk.white.bold("Awaiting missed packets...")
            );
            this.ws.send(
              JSON.stringify({
                op: 6,
                d: {
                  token: this._token,
                  session_id: this._session_id,
                  seq: this._sequence
                },
              })
            );
          } else {
            this._status = statuses.SENDING_IDENTIFY;
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(" + this._status + ") ") +
                chalk.white.bold("Sending Identify packet...")
            );
            let identify = {
              op: 2,
              d: {
                token: this._token,
                intents: this._intents,
                properties: {
                  $os:  this._os,
                  $browser: this._browser,
                  $device: this._device,
                },
                presence: {
                  status: "invisible",
                  activities: this._activities,
                  since: 91879201,
                  afk: false,
                },
              },
            };
            this._status = statuses.IDENTIFY_SENT;
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(" + this._status + ") ") +
                chalk.green.bold("Sent Identify packet.")
            );
            this._status = statuses.AWAITING_READY;
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(" + this._status + ") ") +
                chalk.white.bold("Awaiting READY packet...")
            );
            this.ws.send(JSON.stringify(identify));
          }
        } else if (dataObj.op == 11) {
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(RCVH) ") +
                chalk.green.bold("Heartbeat acknowledged.")
            );
          this._lastReceivedHB = new Date().getTime();
        } else if (dataObj.t == "READY") {
          this._status = statuses.READY_RECEIVED;
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(" + this._status + ") ") +
              chalk.green.bold("Received READY packet.")
          );
          this._status = statuses.CONNECTED_READY;
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(" + this._status + ") ") +
              chalk.green.bold("Connected & Ready as ") +
              chalk.white.bold(
                dataObj.d.user.username
              )
          );
          this._connectedUser = dataObj.d.user.username;
          //sequence should exist now
          this._sequence = dataObj.s;
          this._session_id = dataObj.d.session_id;
          setTimeout(() => {
            this.status.emit("ready");
          }, 2000);
        } else if (dataObj.op == 9) {
          //invalid session. wait a 1-5 seconds and send a new identify packet
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(INVSES) ") +
              chalk.red.bold("Invalid session. Sending new Identify...")
          );
          this._status = statuses.SENDING_IDENTIFY;
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(" + this._status + ") ") +
              chalk.white.bold("Sending Identify packet...")
          );
          let identify = {
            op: 2,
            d: {
              token: this._token,
              intents: this._intents,
              properties: {
                $os: this._os,
                $browser: this._browser,
                $device: this._device,
              },
              presence: {
                status: "invisible"
              },
            },
          };
          setTimeout(() => {
            this._status = statuses.IDENTIFY_SENT;
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(" + this._status + ") ") +
                chalk.green.bold("Sent Identify packet.")
            );
            this._status = statuses.AWAITING_READY;
            console.log(
              chalk.hex("#d4af37").bold("! ") +
                chalk.hex("#ff0000").bold("(" + this._status + ") ") +
                chalk.white.bold("Awaiting READY packet...")
            );
            this._heartbeat_interval = 0;
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
            this._connectedUser = "";
            this._needResuming = false;
            this._lastReceivedHB = 0;
    
            this.ws.send(JSON.stringify(identify));
          }, Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000);
        } else if (dataObj.t == "RESUMED") {
          this._status = statuses.CONNECTED_READY;
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(" + this._status + ") ") +
              chalk.green.bold("Received resume confirmation. Resuming as ") +
              chalk.white.bold(this._connectedUser)
          );
          this._needResuming = false;
          if (dataObj.s) this._sequence = dataObj.s;
        } else if (dataObj.op === 7) {
          //server wants us to reconnect to the gateway
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(RECON) ") +
              chalk.red.bold("Server wants us to reconnect to the gateway.")
          );
          this._status = statuses.RECONNECTING;
          console.log(
            chalk.hex("#d4af37").bold("! ") +
              chalk.hex("#ff0000").bold("(" + this._status + ") ") +
              chalk.white.bold("Reconnecting...")
          );
          this.ws.close();
        } else if (dataObj.op === 1) {
          this.ws.send(
            JSON.stringify({
              op: 1,
              d: this._sequence,
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
    }

    public send(data: Object) {
      this.ws.send(JSON.stringify(data));
    }

    public async setPresence(data: {
      status?: string,
      activities?: Array<{
        name: string,
        type: number,
        url?: string,
        state?: string,
        details?: string,
        application_id?: string,
        assets?: {
          large_image?: string,
          large_text?: string,
          small_image?: string,
          small_text?: string,
        },
        timestamps?: {
          start?: number,
          end?: number,
        },
        party?: {
          id?: string,
          size?: [number, number],
        },
        secrets?: {
          join?: string,
          spectate?: string,
          match?: string,
        },
        instance?: boolean,
        buttons?: Array<{
          label: string,
          url: string,
        }>}>
    }) {
      if (!this._connectedUser) return console.log("Not connected to gateway.");
      if (!data.activities) data.activities = [];
      if (!data.status) data.status = "invisible";
      console.log(
        chalk.hex("#d4af37").bold("! ") +
          chalk.hex("#ff0000").bold("(PRESENCE) ") +
          chalk.green.bold("Setting presence...")
      );
      let presence = {
        op: 3,
        d: {
          since: 91879201,
          activities: data.activities,
          status: data.status,
          afk: false,
        },
      };
      return this.send(presence);
    }


}