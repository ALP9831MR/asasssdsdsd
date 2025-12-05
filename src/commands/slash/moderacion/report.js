// ========================================
// 📁 src/commands/slash/moderation/report.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits
} = require('discord.js');
const ReportManager = require('../../../systems/moderation/reportManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Sistema de reportes de usuarios')
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Reportar a un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a reportar')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('razon')
            .setDescription('Razón del reporte')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('evidencia')
            .setDescription('Enlace a evidencia (capturas, mensajes, etc.)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Ver un reporte específico')
        .addStringOption(option =>
          option
            .setName('id_reporte')
            .setDescription('ID del reporte')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('claim')
        .setDescription('Tomar un reporte para atenderlo')
        .addStringOption(option =>
          option
            .setName('id_reporte')
            .setDescription('ID del reporte')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Cerrar un reporte')
        .addStringOption(option =>
          option
            .setName('id_reporte')
            .setDescription('ID del reporte')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('accion')
            .setDescription('Acción tomada')
            .addChoices(
              { name: '✅ Resuelto - Acción tomada', value: 'resolved' },
              { name: '⚠️ Advertencia dada', value: 'warned' },
              { name: '🔨 Usuario sancionado', value: 'punished' },
              { name: '❌ Reporte inválido', value: 'invalid' },
              { name: '📋 Sin acción necesaria', value: 'no_action' }
            )
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('notas')
            .setDescription('Notas adicionales sobre el cierre')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Ver lista de reportes')
        .addStringOption(option =>
          option
            .setName('estado')
            .setDescription('Filtrar por estado')
            .addChoices(
              { name: '🆕 Pendientes', value: 'pending' },
              { name: '👁️ En Revisión', value: 'claimed' },
              { name: '✅ Cerrados', value: 'closed' },
              { name: '📊 Todos', value: 'all' }
            )
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Ver estadísticas de reportes del servidor'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar el sistema de reportes')
        .addChannelOption(option =>
          option
            .setName('canal_reportes')
            .setDescription('Canal privado para reportes')
            .setRequired(true))
        .addRoleOption(option =>
          option
            .setName('rol_moderadores')
            .setDescription('Rol que puede ver y atender reportes')
            .setRequired(true)))
    .setDMPermission(false),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'user') {
      const usuario = interaction.options.getUser('usuario');
      const razon = interaction.options.getString('razon');
      const evidencia = interaction.options.getString('evidencia');
      
      await ReportManager.createReport(interaction, client, usuario, razon, evidencia);
    }
    else if (subcommand === 'view') {
      const reportId = interaction.options.getString('id_reporte');
      
      await ReportManager.viewReport(interaction, client, reportId);
    }
    else if (subcommand === 'claim') {
      const reportId = interaction.options.getString('id_reporte');
      
      await ReportManager.claimReport(interaction, client, reportId);
    }
    else if (subcommand === 'close') {
      const reportId = interaction.options.getString('id_reporte');
      const accion = interaction.options.getString('accion');
      const notas = interaction.options.getString('notas');
      
      await ReportManager.closeReport(interaction, client, reportId, accion, notas);
    }
    else if (subcommand === 'list') {
      const estado = interaction.options.getString('estado') || 'pending';
      
      await ReportManager.listReports(interaction, client, estado);
    }
    else if (subcommand === 'stats') {
      await ReportManager.showStats(interaction, client);
    }
    else if (subcommand === 'setup') {
      const canalReportes = interaction.options.getChannel('canal_reportes');
      const rolModeradores = interaction.options.getRole('rol_moderadores');
      
      // Verificar que el usuario sea admin
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ Solo administradores pueden configurar el sistema de reportes.',
          ephemeral: true
        });
      }
      
      await ReportManager.setup(interaction, client, canalReportes, rolModeradores);
    }
  }
};