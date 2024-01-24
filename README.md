## Add Zap to your server
~~https://discord.com/oauth2/authorize?client_id=1094075911722254356&scope=bot&permissions=2147502080~~ (unmaintained)

## Run Zap on your local machine
### Prerequisites

1. Zap is verified working on:
   * node v18.15.0
   * yarn v1.22.19 (assuming that npm is installed)
   * nodemon v2.0.20
2. A Cloud Firestore database
   * `subscriptions-{slug}-guilds:[{guildId}-{channelId}]`
3. A `serviceAccountKey.json` for API access to your Firestore

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/mapldx/zap
   ```
2. Install required package dependencies
   ```sh
   yarn install
   ```
3. Duplicate `.env.example` and rename it to `.env`
   ```sh
   cp .env.example .env
   ```
4. Modify the `.env` file with your API keys
   * Copied from https://discord.com/developers/applications
     * `DISCORD_CLIENT_ID`: a Discord application ID
     * `DISCORD_TOKEN`: a Discord bot token
   * `TENSOR_API_KEY`: a Tensor API key provisioned by the Tensor team – request one at their Discord

### Development

1. Start the bot
   ```sh
   nodemon
   ```
2. Register the slash commands – this has to be done every time a slash command is created or modified
   ```sh
   node deploy-commands.js
   ```
   
## Built With
* ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
* ![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)

## Contributing
* zachio, [@mapldx on Twitter](https://twitter.com/mapldx)
* zachio#0123 on Discord
