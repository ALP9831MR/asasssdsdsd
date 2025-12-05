require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config.json');

// Crear el cliente con los intents configurados
const client = new Client({
  intents: config.clientSettings.intents.map(intent => GatewayIntentBits[intent]),
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
});

// Colecciones para almacenar comandos y datos
client.prefixCommands = new Collection();
client.slashCommands = new Collection();
client.cooldowns = new Collection();
client.config = config;

// Obtener manejadores (handlers)
const handlersDir = path.join(__dirname, 'handlers');
const handlerFiles = fs.readdirSync(handlersDir).filter(file => file.endsWith('.js'));

// Cargar los manejadores
(async () => {
  for (const file of handlerFiles) {
    const handler = require(path.join(handlersDir, file));
    await handler(client);
  }

  // Iniciar sesión del bot
  client.login(process.env.TOKEN).catch(err => {
    console.error('Error al iniciar sesión:', err);
    process.exit(1);
  });
})();

// ========================================
// 🎉 INICIALIZAR SISTEMA DE GIVEAWAYS
// ========================================
client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  
  // Inicializar sistema de sorteos
  try {
    const GiveawayManager = require('./systems/giveaways/giveawayManager');
    GiveawayManager.initializeSystem(client);
    console.log('✅ Sistema de sorteos inicializado');
  } catch (error) {
    console.error('❌ Error al inicializar sistema de sorteos:', error);
  }
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});