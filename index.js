const fs = require('node:fs')
const path = require('node:path')
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
} = require('discord.js')

require('dotenv').config()
const token = process.env.DISCORD_TOKEN
const API_KEY = process.env.TENSOR_API_KEY

const { createClient } = require('graphql-ws')
const WebSocket = require('ws')

const admin = require('firebase-admin')
const axios = require('axios')

const { formatDistanceToNow } = require('date-fns')

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.commands = new Collection()
const commandsPath = path.join(__dirname, 'commands')
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'))

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file)
  const command = require(filePath)
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command)
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a 
      required "data" or "execute" property.`,
    )
  }
}

const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const WS_URL = 'wss://api.tensor.so/graphql'
const ACCEPTED_SUBPROTOCOL = 'graphql_transport_ws'

const NEW_TRANSACTION_TV2_SUBSCRIPTION = `
  subscription NewTransactionTV2($slug: String!) {
    newTransactionTV2(slug: $slug) {
      tx {
        grossAmount
        mintOnchainId
        txAt
        txId
        txType
        buyerId
        sellerId
        source
      }
    }
  }
`

const activeSubscriptions = new Map()

const socket = createClient({
  url: WS_URL,
  webSocketImpl: WebSocket,
  connectionParams: {
    headers: {
      'X-TENSOR-API-KEY': API_KEY,
    },
  },
  connectionCallback: (error) => {
    if (error) {
      console.error('WebSocket connection error:', error)
    } else {
      console.log('WebSocket connection opened')
    }
  },
  lazy: false,
  subprotocols: [ACCEPTED_SUBPROTOCOL],
})

const db = admin.firestore()
const slugCollectionRef = db.collection('subscriptions')

client.on(Events.ClientReady, () => {
  console.log('Ready!')
  startSubscription()
})

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const command = client.commands.get(interaction.commandName)

  if (!command) return

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error(error)
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      })
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      })
    }
  }
})

function startSubscription() {
  const unsubscribe = slugCollectionRef.onSnapshot(
    (querySnapshot) => {
      disposeAllSubscriptions()

      querySnapshot.forEach((doc) => {
        const slug = doc.id
        const guilds = doc.data().guilds

        console.log('Subscribing to ' + slug)

        const dispose = socket.subscribe(
          {
            query: NEW_TRANSACTION_TV2_SUBSCRIPTION,
            variables: {
              slug: slug,
            },
          },
          {
            next: (response) => {
              if (response.data) {
                guilds.forEach((guildChannelPair) => {
                  const [guildId, channelId] = guildChannelPair.split('-')
                  const guild = client.guilds.cache.get(guildId)
                  if (guild) {
                    const channel = guild.channels.cache.get(channelId)
                    if (channel) {
                      const tx = response.data.newTransactionTV2.tx
                      var tokenName = null,
                        imageUri = null
                      axios
                        .post(
                          'https://api.tensor.so/graphql',
                          {
                            query:
                              'query Mint($mint: String!) {\n  mint(mint: $mint) \
                                {\n    name\n    imageUri\n    slug\n    lastSale \
                                {\n      price\n      txAt\n    }\n  }\n}',
                            variables: {
                              mint: tx.mintOnchainId,
                            },
                          },
                          {
                            headers: {
                              'content-type': 'application/json',
                              'X-TENSOR-API-KEY': API_KEY,
                            },
                          },
                        )
                        .then((response) => {
                          tokenName = response.data.data.mint.name
                          imageUri = response.data.data.mint.imageUri
                          lastPrice =
                            response.data.data.mint.lastSale['price'] / 1e9
                          lastTx = response.data.data.mint.lastSale['txAt']
                          var color = null
                          if (tx.txType == 'DELIST') {
                            color = '#FF6863'
                          } else {
                            color = '#89CFF0'
                          }
                          var embed = new EmbedBuilder()
                          .setColor(color)
                          .setTitle(tx.txType + ' ' + tokenName)
                          .setAuthor({ name: tx.source })
                          .setThumbnail(imageUri)
                          .addFields(
                            {
                              name: 'Current Price',
                              value:
                                (tx.grossAmount / 1e9).toPrecision(4) +
                                ' ◎',
                              inline: true,
                            },
                            {
                              name: 'Last Price',
                              value: lastPrice.toPrecision(4) + ' ◎',
                              inline: true,
                            },
                            {
                              name: 'Last Sale',
                              value: formatDistanceToNow(lastTx),
                              inline: true,
                            },
                          )
                          .setTimestamp()
                          .setFooter({
                            text: 'Zap for Tensor',
                            iconURL:
                              'https://pbs.twimg.com/profile_images/1570907127287259136/qujno7O4_400x400.jpg',
                          })
                          const row = new ActionRowBuilder()
                            .addComponents(
                              new ButtonBuilder()
                                .setStyle('Link')
                                .setLabel('View on Tensor')
                                .setURL('https://tensor.trade/trade/' + slug),
                            )
                            .addComponents(
                              new ButtonBuilder()
                                .setStyle('Link')
                                .setLabel('View on Solscan')
                                .setURL('https://solscan.io/tx/' + tx.txId),
                            );
                          channel.send({ embeds: [embed], components: [row] })
                        })
                        .catch((error) => {
                          console.log(error)
                        })
                    }
                  }
                })
              } else {
                console.log('No data received in response')
              }
            },
            error: (error) => {
              console.log('Subscription error:', error)
            },
            complete: () => {
              console.log('Subscription completed')
            },
          },
        )

        activeSubscriptions.set(slug, dispose)
      })
    },
    (error) => {
      console.log('Firebase snapshot error:', error)
    },
  )

  return unsubscribe
}

function disposeAllSubscriptions() {
  activeSubscriptions.forEach((dispose, slug) => {
    console.log(`Disposing subscription for ${slug}`)
    dispose()
  })
  activeSubscriptions.clear()
}

client.login(token)
