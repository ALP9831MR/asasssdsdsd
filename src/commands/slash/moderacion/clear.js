// ========================================
// 📁 src/commands/slash/moderation/clear.js
// ========================================

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType
  } = require('discord.js');
  const ClearManager = require('../../../systems/moderation/clearManager');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Sistema de limpieza de mensajes')
      .addSubcommand(subcommand =>
        subcommand
          .setName('all')
          .setDescription('Borrar X mensajes del canal')
          .addIntegerOption(option =>
            option
              .setName('cantidad')
              .setDescription('Cantidad de mensajes a borrar (1-100)')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal donde borrar (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('user')
          .setDescription('Borrar mensajes de un usuario específico')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario cuyos mensajes se borrarán')
              .setRequired(true))
          .addIntegerOption(option =>
            option
              .setName('cantidad')
              .setDescription('Cantidad de mensajes a borrar (1-100)')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal donde borrar (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('bots')
          .setDescription('Borrar solo mensajes de bots')
          .addIntegerOption(option =>
            option
              .setName('cantidad')
              .setDescription('Cantidad de mensajes a revisar (1-100)')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal donde borrar (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('links')
          .setDescription('Borrar mensajes que contengan links')
          .addIntegerOption(option =>
            option
              .setName('cantidad')
              .setDescription('Cantidad de mensajes a revisar (1-100)')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal donde borrar (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('images')
          .setDescription('Borrar mensajes con imágenes o archivos')
          .addIntegerOption(option =>
            option
              .setName('cantidad')
              .setDescription('Cantidad de mensajes a revisar (1-100)')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal donde borrar (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('contains')
          .setDescription('Borrar mensajes que contengan un texto específico')
          .addStringOption(option =>
            option
              .setName('texto')
              .setDescription('Texto a buscar en los mensajes')
              .setRequired(true))
          .addIntegerOption(option =>
            option
              .setName('cantidad')
              .setDescription('Cantidad de mensajes a revisar (1-100)')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal donde borrar (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('between')
          .setDescription('Borrar mensajes entre dos IDs')
          .addStringOption(option =>
            option
              .setName('mensaje_inicio')
              .setDescription('ID del mensaje de inicio')
              .setRequired(true))
          .addStringOption(option =>
            option
              .setName('mensaje_fin')
              .setDescription('ID del mensaje de fin')
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal donde borrar (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .setDMPermission(false),
    
    async execute(interaction, client) {
      const subcommand = interaction.options.getSubcommand();
      const canal = interaction.options.getChannel('canal') || interaction.channel;
      
      if (subcommand === 'all') {
        const cantidad = interaction.options.getInteger('cantidad');
        await ClearManager.clearAll(interaction, client, canal, cantidad);
      }
      else if (subcommand === 'user') {
        const usuario = interaction.options.getUser('usuario');
        const cantidad = interaction.options.getInteger('cantidad');
        await ClearManager.clearUser(interaction, client, canal, usuario, cantidad);
      }
      else if (subcommand === 'bots') {
        const cantidad = interaction.options.getInteger('cantidad');
        await ClearManager.clearBots(interaction, client, canal, cantidad);
      }
      else if (subcommand === 'links') {
        const cantidad = interaction.options.getInteger('cantidad');
        await ClearManager.clearLinks(interaction, client, canal, cantidad);
      }
      else if (subcommand === 'images') {
        const cantidad = interaction.options.getInteger('cantidad');
        await ClearManager.clearImages(interaction, client, canal, cantidad);
      }
      else if (subcommand === 'contains') {
        const texto = interaction.options.getString('texto');
        const cantidad = interaction.options.getInteger('cantidad');
        await ClearManager.clearContains(interaction, client, canal, texto, cantidad);
      }
      else if (subcommand === 'between') {
        const mensajeInicio = interaction.options.getString('mensaje_inicio');
        const mensajeFin = interaction.options.getString('mensaje_fin');
        await ClearManager.clearBetween(interaction, client, canal, mensajeInicio, mensajeFin);
      }
    }
  };