// ========================================
// 📁 src/commands/slash/moderation/automod.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const AutoModManager = require('../../../systems/moderation/automodManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Sistema de auto-moderación')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar el sistema de auto-moderación')
        .addChannelOption(option =>
          option
            .setName('canal_logs')
            .setDescription('Canal para logs de auto-moderación')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('rule')
        .setDescription('Gestionar reglas de auto-moderación')
        .addStringOption(option =>
          option
            .setName('accion')
            .setDescription('Acción a realizar')
            .addChoices(
              { name: 'Agregar Regla', value: 'add' },
              { name: 'Remover Regla', value: 'remove' },
              { name: 'Ver Reglas', value: 'list' }
            )
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo de regla')
            .addChoices(
              { name: '🔁 Anti-Spam', value: 'spam' },
              { name: '🔗 Anti-Links', value: 'links' },
              { name: '📢 Anti-Invitaciones', value: 'invites' },
              { name: '🔠 Anti-CAPS', value: 'caps' },
              { name: '@️⃣ Anti-Menciones Masivas', value: 'mentions' },
              { name: '😀 Anti-Emoji Spam', value: 'emojis' },
              { name: '🚫 Palabras Prohibidas', value: 'badwords' }
            )
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('castigo')
            .setDescription('Castigo a aplicar')
            .addChoices(
              { name: 'Borrar Mensaje', value: 'delete' },
              { name: 'Warn', value: 'warn' },
              { name: 'Timeout 5min', value: 'timeout5' },
              { name: 'Timeout 30min', value: 'timeout30' },
              { name: 'Kick', value: 'kick' }
            )
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('id_regla')
            .setDescription('ID de la regla a remover')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('whitelist')
        .setDescription('Gestionar whitelist (excepciones)')
        .addStringOption(option =>
          option
            .setName('accion')
            .setDescription('Acción a realizar')
            .addChoices(
              { name: 'Agregar', value: 'add' },
              { name: 'Remover', value: 'remove' },
              { name: 'Ver Lista', value: 'list' }
            )
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo de excepción')
            .addChoices(
              { name: 'Canal', value: 'channel' },
              { name: 'Rol', value: 'role' },
              { name: 'Usuario', value: 'user' }
            )
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del canal/rol/usuario')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('badwords')
        .setDescription('Gestionar lista de palabras prohibidas')
        .addStringOption(option =>
          option
            .setName('accion')
            .setDescription('Acción a realizar')
            .addChoices(
              { name: 'Agregar Palabra', value: 'add' },
              { name: 'Remover Palabra', value: 'remove' },
              { name: 'Ver Lista', value: 'list' }
            )
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('palabra')
            .setDescription('Palabra a agregar/remover')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Ver estadísticas de auto-moderación'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Activar/desactivar el sistema completo')
        .addBooleanOption(option =>
          option
            .setName('activar')
            .setDescription('Activar (true) o desactivar (false)')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'setup') {
      const canalLogs = interaction.options.getChannel('canal_logs');
      
      await AutoModManager.setup(interaction, client, canalLogs);
    }
    else if (subcommand === 'rule') {
      const accion = interaction.options.getString('accion');
      const tipo = interaction.options.getString('tipo');
      const castigo = interaction.options.getString('castigo');
      const idRegla = interaction.options.getString('id_regla');
      
      await AutoModManager.manageRule(interaction, client, accion, tipo, castigo, idRegla);
    }
    else if (subcommand === 'whitelist') {
      const accion = interaction.options.getString('accion');
      const tipo = interaction.options.getString('tipo');
      const id = interaction.options.getString('id');
      
      await AutoModManager.manageWhitelist(interaction, client, accion, tipo, id);
    }
    else if (subcommand === 'badwords') {
      const accion = interaction.options.getString('accion');
      const palabra = interaction.options.getString('palabra');
      
      await AutoModManager.manageBadWords(interaction, client, accion, palabra);
    }
    else if (subcommand === 'stats') {
      await AutoModManager.showStats(interaction, client);
    }
    else if (subcommand === 'toggle') {
      const activar = interaction.options.getBoolean('activar');
      
      await AutoModManager.toggle(interaction, client, activar);
    }
  }
};