// ========================================
// 📁 src/commands/slash/moderation/timeout.js
// ========================================

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits
  } = require('discord.js');
  const TimeoutManager = require('../../../systems/moderation/timeoutManager');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Sistema de timeouts (silenciar temporalmente)')
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Silenciar temporalmente a un usuario')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario a silenciar')
              .setRequired(true))
          .addStringOption(option =>
            option
              .setName('duracion')
              .setDescription('Duración del timeout')
              .setRequired(true)
              .addChoices(
                { name: '1 minuto', value: '1m' },
                { name: '5 minutos', value: '5m' },
                { name: '10 minutos', value: '10m' },
                { name: '30 minutos', value: '30m' },
                { name: '1 hora', value: '1h' },
                { name: '6 horas', value: '6h' },
                { name: '12 horas', value: '12h' },
                { name: '1 día', value: '1d' },
                { name: '1 semana', value: '1w' }
              ))
          .addStringOption(option =>
            option
              .setName('razon')
              .setDescription('Razón del timeout')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove')
          .setDescription('Quitar timeout de un usuario')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario a quitar el timeout')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('history')
          .setDescription('Ver historial de timeouts de un usuario')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario a consultar')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('active')
          .setDescription('Ver todos los timeouts activos del servidor'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .setDMPermission(false),
    
    async execute(interaction, client) {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'add') {
        const usuario = interaction.options.getUser('usuario');
        const duracion = interaction.options.getString('duracion');
        const razon = interaction.options.getString('razon');
        
        await TimeoutManager.addTimeout(interaction, client, usuario, duracion, razon);
      }
      else if (subcommand === 'remove') {
        const usuario = interaction.options.getUser('usuario');
        
        await TimeoutManager.removeTimeout(interaction, client, usuario);
      }
      else if (subcommand === 'history') {
        const usuario = interaction.options.getUser('usuario');
        
        await TimeoutManager.showHistory(interaction, client, usuario);
      }
      else if (subcommand === 'active') {
        await TimeoutManager.showActive(interaction, client);
      }
    }
  };