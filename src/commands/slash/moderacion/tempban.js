// ========================================
// 📁 src/commands/slash/moderation/tempban.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits
} = require('discord.js');
const TempBanManager = require('../../../systems/moderation/tempbanManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Sistema de baneos temporales')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Banear temporalmente a un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a banear')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('duracion')
            .setDescription('Duración del ban')
            .setRequired(true)
            .addChoices(
              { name: '1 hora', value: '1h' },
              { name: '6 horas', value: '6h' },
              { name: '12 horas', value: '12h' },
              { name: '1 día', value: '1d' },
              { name: '3 días', value: '3d' },
              { name: '7 días', value: '7d' },
              { name: '14 días', value: '14d' },
              { name: '30 días', value: '30d' }
            ))
        .addStringOption(option =>
          option
            .setName('razon')
            .setDescription('Razón del ban temporal')
            .setRequired(true))
        .addBooleanOption(option =>
          option
            .setName('borrar_mensajes')
            .setDescription('Borrar mensajes del usuario (últimos 7 días)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Desbanear a un usuario antes de tiempo')
        .addStringOption(option =>
          option
            .setName('usuario_id')
            .setDescription('ID del usuario a desbanear')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('razon')
            .setDescription('Razón del desbaneo anticipado')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Ver lista de bans temporales activos'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('Ver historial de bans de un usuario')
        .addStringOption(option =>
          option
            .setName('usuario_id')
            .setDescription('ID del usuario')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Ver información de un ban temporal')
        .addStringOption(option =>
          option
            .setName('usuario_id')
            .setDescription('ID del usuario baneado')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'add') {
      const usuario = interaction.options.getUser('usuario');
      const duracion = interaction.options.getString('duracion');
      const razon = interaction.options.getString('razon');
      const borrarMensajes = interaction.options.getBoolean('borrar_mensajes') ?? false;
      
      await TempBanManager.addTempBan(interaction, client, usuario, duracion, razon, borrarMensajes);
    }
    else if (subcommand === 'remove') {
      const usuarioId = interaction.options.getString('usuario_id');
      const razon = interaction.options.getString('razon') || 'No especificada';
      
      await TempBanManager.removeTempBan(interaction, client, usuarioId, razon);
    }
    else if (subcommand === 'list') {
      await TempBanManager.listTempBans(interaction, client);
    }
    else if (subcommand === 'history') {
      const usuarioId = interaction.options.getString('usuario_id');
      
      await TempBanManager.showHistory(interaction, client, usuarioId);
    }
    else if (subcommand === 'check') {
      const usuarioId = interaction.options.getString('usuario_id');
      
      await TempBanManager.checkTempBan(interaction, client, usuarioId);
    }
  }
};