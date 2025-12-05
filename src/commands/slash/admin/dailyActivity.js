// ========================================
// 📁 src/commands/slash/admin/dailyActivity.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require('discord.js');
const DailyActivityManager = require('../../../systems/dailyActivity/dailyActivityManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dailyactivity')
    .setDescription('Gestiona el sistema de actividad diaria')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configura el sistema de actividad diaria')
        .addChannelOption(option =>
          option
            .setName('canal')
            .setDescription('Canal donde se enviará el mensaje diario')
            .setRequired(true))
        .addChannelOption(option =>
          option
            .setName('logs')
            .setDescription('Canal para registros de actividad')
            .setRequired(true))
        .addRoleOption(option =>
          option
            .setName('rol_notificacion')
            .setDescription('Rol a mencionar (en lugar de @everyone)')
            .setRequired(false))
        .addIntegerOption(option =>
          option
            .setName('objetivo')
            .setDescription('Objetivo diario de personas activas (por defecto: 30)')
            .setMinValue(5)
            .setMaxValue(100)
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('enviar')
        .setDescription('Envía manualmente el mensaje de actividad diaria'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Muestra estadísticas de actividad')
        .addStringOption(option =>
          option
            .setName('periodo')
            .setDescription('Periodo de tiempo')
            .addChoices(
              { name: 'Hoy', value: 'daily' },
              { name: 'Esta Semana', value: 'weekly' },
              { name: 'Este Mes', value: 'monthly' },
              { name: 'Todo el Tiempo', value: 'alltime' }
            )
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reinicia el contador diario (úsalo con cuidado)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('revivir')
        .setDescription('Revive la racha de un usuario (1 vez al mes)')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a quien revivir la racha')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('insignias')
        .setDescription('Muestra las insignias de un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a consultar (si no se especifica, eres tú)')
            .setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'setup') {
      const canal = interaction.options.getChannel('canal');
      const logs = interaction.options.getChannel('logs');
      const rol = interaction.options.getRole('rol_notificacion');
      const objetivo = interaction.options.getInteger('objetivo') || 30;
      
      await DailyActivityManager.setupDailyActivity(interaction, client, canal, logs, rol, objetivo);
    }
    else if (subcommand === 'enviar') {
      await DailyActivityManager.sendDailyMessage(interaction, client);
    }
    else if (subcommand === 'stats') {
      const periodo = interaction.options.getString('periodo') || 'alltime';
      await DailyActivityManager.showStats(interaction, client, periodo);
    }
    else if (subcommand === 'reset') {
      await DailyActivityManager.resetDaily(interaction, client);
    }
    else if (subcommand === 'revivir') {
      const usuario = interaction.options.getUser('usuario');
      await DailyActivityManager.reviveStreak(interaction, client, usuario);
    }
    else if (subcommand === 'insignias') {
      const usuario = interaction.options.getUser('usuario') || interaction.user;
      await DailyActivityManager.showBadges(interaction, client, usuario);
    }
  }
};