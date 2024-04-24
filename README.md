<h1 align="center">AllWatcher</h1>
<p align="center">AllWatcher is a system that shows what the user is watching to other people on Discord as a Discord presence.</p>
<br>
<br>
<div align="center">
  <img src="https://github.com/InimicalPart/AllWatcher/assets/37552123/6440815b-7e11-47ee-aa22-120f792fdf71"/>
  <img src="https://github.com/InimicalPart/AllWatcher/assets/37552123/c21e8991-ec3c-410b-914f-9c0d214a8194"/>
</div>

> [!WARNING]
> This project is still under active development. Bugs and errors **will** occur.
>
> But feel free to report them in the Issues tab :)

## Supported Platforms
> <sub>✅ - **Platform is fully supported.**<br></sub>
> <sub>⚠️ - **Supported but may be unstable.**<br></sub>
> <sub>🚧 - **Not yet supported, but work is in progress.**<br></sub>
> <sub>🤔 - **Not yet supported, but is planned.**<br></sub>
> <sub>❌ - **Not planned.**<br></sub>

| Platform | Status | Additonal features / Comments |
| :---: | :---: | --- |
| Netflix | ✅ | - [Teleparty](#teleparty) |
| Disney+ | ✅ | Teleparty support is under-works |
| Soap2Day | ✅ | 
| MyFlixer | ✅ |
| 123Movies | ⚠️ |
| YouTube | :x: | Needs some planning and most likely a toggle switch |

## Prerequisites
- Node (>=21)
- Desktop version of Discord
- [A chromium-based browser](https://alternativeto.net/category/browsers/chromium-based/)

## Usage
1. Clone this repository
2. Install dependencies
   ```bash
   npm install
   ```
3. Install TypeScript
   ```bash
   npm install -g typescript
   ``` 
5. Configure AllWatching using the `./config.jsonc` file
6. Set your environment variables (take a look at `.env.template`)
7. Make sure Discord is running
8. [Start your chromium-based browser with remote debugging enabled](https://stackoverflow.com/a/56457835) (you can set it so that it turns on remote debugging by default for convienience)
9. Start AllWatcher
    ```bash
    npm run start
    ```
10. Enjoy!


## Contributing
Contributions are very welcome! To add a custom platform, simply clone this repository, and add a `<platform>.ts` file in `./src/platforms/`. Take a look at the other platforms for inspiration.<br>
After you are done with adding your platform, and feel like sharing it with the rest of the world, open a pull request!

I would also highly appreciate it if you could edit the README.md to contain information about your platform. You may also include your GitHub profile link in the "Comments" section like this:
```
Credits: [@inimicalpart](https://github.com/InimicalPart)
```

## Additional Features

### Teleparty
If a platform has support for the Teleparty integration, it allows the user to make it so the invitation link for teleparty gets added to the Discord Presence, the owner could also make it so that the link isn't available, but that it shown with how many people the owner is watching with.

<div align="center">
  <img alt="teleparty - show join link enabled" src="https://github.com/InimicalPart/AllWatcher/assets/37552123/6f40f6b7-4577-4948-a3af-3f9b6d81072a"/>
  <img alt="teleparty - many people, join link enabled" src="https://github.com/InimicalPart/AllWatcher/assets/37552123/853506f8-da29-45de-926c-934778226e26"/>
  <br>
  <img alt="teleparty - show join link disabled" src="https://github.com/InimicalPart/AllWatcher/assets/37552123/757ef1ec-cf9a-4d7a-b67b-5c178732f3ce"/>
  <img alt="teleparty - many people, join link disabled" src="https://github.com/InimicalPart/AllWatcher/assets/37552123/f906fd68-e630-4c1b-bb39-d45d5bec0630"/>
</div>
