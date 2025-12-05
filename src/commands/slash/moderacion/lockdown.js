// ========================================
// 📁 src/commands/slash/moderation/lockdown.js
// ========================================

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType
  } = require('discord.js');
  const LockdownManager = require('../../../systems/moderation/lockdownManager');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('lockdown')
      .setDescription('Sistema de bloqueo de canales y servidor')
      .addSubcommand(subcommand =>
        subcommand
          .setName('lock')
          .setDescription('Bloquear un canal específico')
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal a bloquear (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              .setRequired(false))
          .addStringOption(option =>
            option
              .setName('razon')
              .setDescription('Razón del bloqueo')
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('unlock')
          .setDescription('Desbloquear un canal específico')
          .addChannelOption(option =>
            option
              .setName('canal')
              .setDescription('Canal a desbloquear (por defecto: canal actual)')
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('server')
          .setDescription('Bloquear todo el servidor')
          .addStringOption(option =>
            option
              .setName('duracion')
              .setDescription('Duración del lockdown')
              .addChoices(
                { name: '5 minutos', value: '5m' },
                { name: '15 minutos', value: '15m' },
                { name: '30 minutos', value: '30m' },
                { name: '1 hora', value: '1h' },
                { name: '6 horas', value: '6h' },
                { name: '12 horas', value: '12h' },
                { name: 'Manual', value: 'manual' }
              )
              .setRequired(true))
          .addStringOption(option =>
            option
              .setName('razon')
              .setDescription('Razón del lockdown')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('unlock-server')
          .setDescription('Desbloquear todo el servidor'))
      .addSubcommand(subcommand =>
        subcommand
          .setName('status')
          .setDescription('Ver estado de lockdown del servidor'))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false),
    
    async execute(interaction, client) {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'lock') {
        const canal = interaction.options.getChannel('canal') || interaction.channel;
        const razon = interaction.options.getString('razon') || 'No especificada';
        
        await LockdownManager.lockChannel(interaction, client, canal, razon);
      }
      else if (subcommand === 'unlock') {
        const canal = interaction.options.getChannel('canal') || interaction.channel;
        
        await LockdownManager.unlockChannel(interaction, client, canal);
      }
      else if (subcommand === 'server') {
        const duracion = interaction.options.getString('duracion');
        const razon = interaction.options.getString('razon');
        
        await LockdownManager.lockServer(interaction, client, duracion, razon);
      }
      else if (subcommand === 'unlock-server') {
        await LockdownManager.unlockServer(interaction, client);
      }
      else if (subcommand === 'status') {
        await LockdownManager.showStatus(interaction, client);
      }
    }
  };