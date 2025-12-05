// ========================================
// 📁 src/commands/slash/moderation/warn.js
// ========================================

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
  } = require('discord.js');
  const WarnManager = require('../../../systems/moderation/warnManager');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Sistema de advertencias para usuarios')
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Advertir a un usuario')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario a advertir')
              .setRequired(true))
          .addStringOption(option =>
            option
              .setName('razon')
              .setDescription('Razón de la advertencia')
              .setRequired(true))
          .addBooleanOption(option =>
            option
              .setName('dm')
              .setDescription('Enviar DM al usuario (por defecto: sí)')
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove')
          .setDescription('Quitar una advertencia')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario del warn')
              .setRequired(true))
          .addStringOption(option =>
            option
              .setName('id_warn')
              .setDescription('ID de la advertencia')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('Ver advertencias de un usuario')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario a consultar')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('clear')
          .setDescription('Limpiar todas las advertencias de un usuario')
          .addUserOption(option =>
            option
              .setName('usuario')
              .setDescription('Usuario a limpiar warns')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('config')
          .setDescription('Configurar el sistema de warns')
          .addIntegerOption(option =>
            option
              .setName('max_warns')
              .setDescription('Máximo de warns antes de auto-ban')
              .setMinValue(1)
              .setMaxValue(20)
              .setRequired(true))
          .addChannelOption(option =>
            option
              .setName('canal_logs')
              .setDescription('Canal para logs de moderación')
              .setRequired(true))
          .addIntegerOption(option =>
            option
              .setName('expiracion_dias')
              .setDescription('Días para que expiren los warns (0 = nunca)')
              .setMinValue(0)
              .setMaxValue(365)
              .setRequired(false)))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .setDMPermission(false),
    
    async execute(interaction, client) {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'add') {
        const usuario = interaction.options.getUser('usuario');
        const razon = interaction.options.getString('razon');
        const enviarDM = interaction.options.getBoolean('dm') ?? true;
        
        await WarnManager.addWarn(interaction, client, usuario, razon, enviarDM);
      }
      else if (subcommand === 'remove') {
        const usuario = interaction.options.getUser('usuario');
        const warnId = interaction.options.getString('id_warn');
        
        await WarnManager.removeWarn(interaction, client, usuario, warnId);
      }
      else if (subcommand === 'list') {
        const usuario = interaction.options.getUser('usuario');
        
        await WarnManager.listWarns(interaction, client, usuario);
      }
      else if (subcommand === 'clear') {
        const usuario = interaction.options.getUser('usuario');
        
        await WarnManager.clearWarns(interaction, client, usuario);
      }
      else if (subcommand === 'config') {
        const maxWarns = interaction.options.getInteger('max_warns');
        const canalLogs = interaction.options.getChannel('canal_logs');
        const expiracionDias = interaction.options.getInteger('expiracion_dias') ?? 30;
        
        await WarnManager.configureWarns(interaction, client, maxWarns, canalLogs, expiracionDias);
      }
    }
  };