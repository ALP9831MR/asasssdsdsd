// ========================================
// 📁 src/commands/slash/moderation/verify.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits
} = require('discord.js');
const VerificationManager = require('../../../systems/moderation/verificationManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Sistema de verificación de usuarios')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar el sistema de verificación')
        .addChannelOption(option =>
          option
            .setName('canal_verificacion')
            .setDescription('Canal donde aparecerá el botón de verificación')
            .setRequired(true))
        .addRoleOption(option =>
          option
            .setName('rol_verificado')
            .setDescription('Rol que recibirán los usuarios verificados')
            .setRequired(true))
        .addRoleOption(option =>
          option
            .setName('rol_no_verificado')
            .setDescription('Rol para usuarios no verificados')
            .setRequired(false))
        .addIntegerOption(option =>
          option
            .setName('tiempo_limite')
            .setDescription('Tiempo para verificarse (en minutos, 0 = sin límite)')
            .setMinValue(0)
            .setMaxValue(60)
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('metodo')
            .setDescription('Método de verificación')
            .addChoices(
              { name: '🔘 Botón Simple', value: 'button' },
              { name: '✅ Captcha Visual', value: 'captcha' },
              { name: '❓ Pregunta de Seguridad', value: 'question' }
            )
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('manual')
        .setDescription('Verificar manualmente a un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a verificar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('unverify')
        .setDescription('Quitar verificación de un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a quitar verificación')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick-unverified')
        .setDescription('Kickear usuarios no verificados después del tiempo límite'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Ver estadísticas de verificación'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Activar/desactivar el sistema de verificación')
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
      const canalVerificacion = interaction.options.getChannel('canal_verificacion');
      const rolVerificado = interaction.options.getRole('rol_verificado');
      const rolNoVerificado = interaction.options.getRole('rol_no_verificado');
      const tiempoLimite = interaction.options.getInteger('tiempo_limite') ?? 10;
      const metodo = interaction.options.getString('metodo') || 'button';
      
      await VerificationManager.setup(
        interaction, 
        client, 
        canalVerificacion, 
        rolVerificado, 
        rolNoVerificado,
        tiempoLimite,
        metodo
      );
    }
    else if (subcommand === 'manual') {
      const usuario = interaction.options.getUser('usuario');
      
      await VerificationManager.manualVerify(interaction, client, usuario);
    }
    else if (subcommand === 'unverify') {
      const usuario = interaction.options.getUser('usuario');
      
      await VerificationManager.unverify(interaction, client, usuario);
    }
    else if (subcommand === 'kick-unverified') {
      await VerificationManager.kickUnverified(interaction, client);
    }
    else if (subcommand === 'stats') {
      await VerificationManager.showStats(interaction, client);
    }
    else if (subcommand === 'toggle') {
      const activar = interaction.options.getBoolean('activar');
      
      await VerificationManager.toggle(interaction, client, activar);
    }
  }
};