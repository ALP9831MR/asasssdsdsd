// ========================================
// 📁 systems/moderation/reportManager.js
// ========================================

const { 
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class ReportManager {
  static dataPath = path.join(__dirname, '../../data/moderation/reports.json');
  static configPath = path.join(__dirname, '../../data/moderation/reportConfig.json');
  
  /**
   * Carga los datos de reportes
   */
  static loadData() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        const initialData = { guilds: {} };
        this.saveData(initialData);
        return initialData;
      }
      return JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
    } catch (error) {
      console.error('Error al cargar datos de reportes:', error);
      return { guilds: {} };
    }
  }
  
  /**
   * Guarda los datos de reportes
   */
  static saveData(data) {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error al guardar datos de reportes:', error);
    }
  }
  
  /**
   * Carga la configuración
   */
  static loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      console.error('Error al cargar config de reportes:', error);
      return {};
    }
  }
  
  /**
   * Guarda la configuración
   */
  static saveConfig(config) {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error al guardar config de reportes:', error);
    }
  }
  
  /**
   * Genera un ID único para reportes
   */
  static generateReportId() {
    return `REP${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
  
  /**
   * Obtiene el color según el estado
   */
  static getStatusColor(status) {
    const colors = {
      'pending': '#FFA500',
      'claimed': '#3498DB',
      'closed': '#2ECC71'
    };
    return colors[status] || '#5865F2';
  }
  
  /**
   * Obtiene el nombre de la acción
   */
  static getActionName(action) {
    const names = {
      'resolved': '✅ Resuelto - Acción tomada',
      'warned': '⚠️ Advertencia dada',
      'punished': '🔨 Usuario sancionado',
      'invalid': '❌ Reporte inválido',
      'no_action': '📋 Sin acción necesaria'
    };
    return names[action] || action;
  }
  
  /**
   * Configura el sistema de reportes
   */
  static async setup(interaction, client, canalReportes, rolModeradores) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      config[guildId] = {
        reportsChannelId: canalReportes.id,
        moderatorRoleId: rolModeradores.id
      };
      
      this.saveConfig(config);
      
      const setupEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Sistema de Reportes Configurado')
        .setDescription(
          `**Sistema configurado exitosamente!**\n\n` +
          `📢 **Canal de reportes:** ${canalReportes}\n` +
          `👮 **Rol de moderadores:** ${rolModeradores}\n\n` +
          `**Cómo usar:**\n` +
          `• Los usuarios usan \`/report user\` para reportar\n` +
          `• Los reportes aparecen en ${canalReportes}\n` +
          `• Los moderadores pueden usar \`/report claim\` para tomar casos\n` +
          `• Usa \`/report close\` para cerrar reportes\n\n` +
          `**Características:**\n` +
          `✨ Sistema de tickets privados\n` +
          `📊 Estadísticas de reportes\n` +
          `🔔 Notificaciones automáticas\n` +
          `📝 Historial completo`
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [setupEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al configurar reportes:', error);
      await interaction.followUp({
        content: '❌ Error al configurar el sistema.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Crea un nuevo reporte
   */
  static async createReport(interaction, client, usuario, razon, evidencia) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config[guildId]) {
        return interaction.followUp({
          content: '❌ El sistema de reportes no está configurado. Un administrador debe usar `/report setup`',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // No permitir reportar a bots o a sí mismo
      if (usuario.bot) {
        return interaction.followUp({
          content: '❌ No puedes reportar a un bot.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (usuario.id === interaction.user.id) {
        return interaction.followUp({
          content: '❌ No puedes reportarte a ti mismo.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Cargar datos
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        data.guilds[guildId] = {
          reports: [],
          stats: {
            total: 0,
            resolved: 0,
            invalid: 0,
            pending: 0
          }
        };
      }
      
      // Crear reporte
      const reportId = this.generateReportId();
      const report = {
        id: reportId,
        reportedUser: usuario.id,
        reportedUserTag: usuario.tag,
        reporter: interaction.user.id,
        reporterTag: interaction.user.tag,
        reason: razon,
        evidence: evidencia || 'No proporcionada',
        status: 'pending',
        claimedBy: null,
        claimedAt: null,
        closedBy: null,
        closedAt: null,
        closeAction: null,
        closeNotes: null,
        timestamp: new Date().toISOString()
      };
      
      data.guilds[guildId].reports.push(report);
      data.guilds[guildId].stats.total++;
      data.guilds[guildId].stats.pending++;
      this.saveData(data);
      
      // Enviar al canal de reportes
      const reportsChannel = await client.channels.fetch(config[guildId].reportsChannelId);
      
      const reportEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(`🆕 Nuevo Reporte - ${reportId}`)
        .setDescription(
          `**Usuario reportado:** ${usuario} (\`${usuario.tag}\`)\n` +
          `**Reportado por:** ${interaction.user} (\`${interaction.user.tag}\`)\n` +
          `**Estado:** 🆕 Pendiente\n\n` +
          `**Razón:**\n${razon}\n\n` +
          `**Evidencia:**\n${evidencia || '*No proporcionada*'}`
        )
        .setThumbnail(usuario.displayAvatarURL())
        .setFooter({ text: `ID: ${reportId}` })
        .setTimestamp();
      
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`report_claim_${reportId}`)
            .setLabel('Tomar Caso')
            .setEmoji('👁️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`report_view_${reportId}`)
            .setLabel('Ver Detalles')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary)
        );
      
      const reportMessage = await reportsChannel.send({
        content: `<@&${config[guildId].moderatorRoleId}>`,
        embeds: [reportEmbed],
        components: [buttons]
      });
      
      // Guardar ID del mensaje
      report.messageId = reportMessage.id;
      this.saveData(data);
      
      // Respuesta al usuario
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Reporte Enviado')
        .setDescription(
          `Tu reporte ha sido enviado al equipo de moderación.\n\n` +
          `**Usuario reportado:** ${usuario.tag}\n` +
          `**ID del reporte:** \`${reportId}\`\n\n` +
          `Recibirás una notificación cuando el reporte sea atendido.`
        )
        .setFooter({ text: 'Gracias por ayudar a mantener la comunidad segura' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al crear reporte:', error);
      await interaction.followUp({
        content: '❌ Error al crear el reporte.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Ver un reporte específico
   */
  static async viewReport(interaction, client, reportId) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ No hay reportes en este servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const report = data.guilds[guildId].reports.find(r => r.id === reportId);
      
      if (!report) {
        return interaction.followUp({
          content: '❌ No se encontró un reporte con ese ID.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const statusEmojis = {
        'pending': '🆕 Pendiente',
        'claimed': '👁️ En Revisión',
        'closed': '✅ Cerrado'
      };
      
      const viewEmbed = new EmbedBuilder()
        .setColor(this.getStatusColor(report.status))
        .setTitle(`📋 Reporte ${reportId}`)
        .addFields(
          { name: '👤 Usuario Reportado', value: `<@${report.reportedUser}> (\`${report.reportedUserTag}\`)`, inline: true },
          { name: '📢 Reportado Por', value: `<@${report.reporter}> (\`${report.reporterTag}\`)`, inline: true },
          { name: '📊 Estado', value: statusEmojis[report.status], inline: true },
          { name: '📝 Razón', value: report.reason, inline: false },
          { name: '🔍 Evidencia', value: report.evidence, inline: false }
        )
        .setTimestamp(new Date(report.timestamp));
      
      if (report.claimedBy) {
        viewEmbed.addFields({
          name: '👁️ Tomado Por',
          value: `<@${report.claimedBy}> - <t:${Math.floor(new Date(report.claimedAt).getTime() / 1000)}:R>`,
          inline: false
        });
      }
      
      if (report.status === 'closed') {
        viewEmbed.addFields(
          { name: '✅ Cerrado Por', value: `<@${report.closedBy}>`, inline: true },
          { name: '🎯 Acción', value: this.getActionName(report.closeAction), inline: true }
        );
        
        if (report.closeNotes) {
          viewEmbed.addFields({ name: '📝 Notas de Cierre', value: report.closeNotes });
        }
      }
      
      await interaction.followUp({ embeds: [viewEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al ver reporte:', error);
      await interaction.followUp({
        content: '❌ Error al ver el reporte.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Tomar un reporte para atenderlo
   */
  static async claimReport(interaction, client, reportId) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      const data = this.loadData();
      
      if (!config[guildId] || !data.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ Sistema de reportes no configurado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Verificar que tenga el rol de moderador
      if (!interaction.member.roles.cache.has(config[guildId].moderatorRoleId)) {
        return interaction.followUp({
          content: '❌ No tienes permiso para tomar reportes.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const report = data.guilds[guildId].reports.find(r => r.id === reportId);
      
      if (!report) {
        return interaction.followUp({
          content: '❌ No se encontró un reporte con ese ID.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (report.status === 'closed') {
        return interaction.followUp({
          content: '❌ Este reporte ya está cerrado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (report.status === 'claimed' && report.claimedBy !== interaction.user.id) {
        return interaction.followUp({
          content: `❌ Este reporte ya fue tomado por <@${report.claimedBy}>`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      report.status = 'claimed';
      report.claimedBy = interaction.user.id;
      report.claimedAt = new Date().toISOString();
      this.saveData(data);
      
      // Actualizar mensaje en el canal de reportes
      try {
        const reportsChannel = await client.channels.fetch(config[guildId].reportsChannelId);
        const reportMessage = await reportsChannel.messages.fetch(report.messageId);
        
        const updatedEmbed = EmbedBuilder.from(reportMessage.embeds[0])
          .setColor('#3498DB')
          .setTitle(`👁️ Reporte en Revisión - ${reportId}`)
          .spliceFields(2, 1, { name: '📊 Estado', value: '👁️ En Revisión', inline: true })
          .addFields({ name: '👁️ Tomado Por', value: `${interaction.user}`, inline: false });
        
        const closeButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`report_close_${reportId}`)
              .setLabel('Cerrar Reporte')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success)
          );
        
        await reportMessage.edit({ embeds: [updatedEmbed], components: [closeButton] });
      } catch (error) {
        console.error('Error al actualizar mensaje de reporte:', error);
      }
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Reporte Tomado')
        .setDescription(
          `Has tomado el reporte **${reportId}**.\n\n` +
          `Ahora eres responsable de revisar y resolver este caso.\n` +
          `Usa \`/report close\` cuando hayas terminado.`
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al tomar reporte:', error);
      await interaction.followUp({
        content: '❌ Error al tomar el reporte.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Cerrar un reporte
   */
  static async closeReport(interaction, client, reportId, accion, notas) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      const data = this.loadData();
      
      if (!config[guildId] || !data.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ Sistema de reportes no configurado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const report = data.guilds[guildId].reports.find(r => r.id === reportId);
      
      if (!report) {
        return interaction.followUp({
          content: '❌ No se encontró un reporte con ese ID.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (report.status === 'closed') {
        return interaction.followUp({
          content: '❌ Este reporte ya está cerrado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      report.status = 'closed';
      report.closedBy = interaction.user.id;
      report.closedAt = new Date().toISOString();
      report.closeAction = accion;
      report.closeNotes = notas || 'Sin notas adicionales';
      
      // Actualizar estadísticas
      data.guilds[guildId].stats.pending = Math.max(0, data.guilds[guildId].stats.pending - 1);
      if (accion === 'resolved' || accion === 'warned' || accion === 'punished') {
        data.guilds[guildId].stats.resolved++;
      } else if (accion === 'invalid') {
        data.guilds[guildId].stats.invalid++;
      }
      
      this.saveData(data);
      
      // Actualizar mensaje
      try {
        const reportsChannel = await client.channels.fetch(config[guildId].reportsChannelId);
        const reportMessage = await reportsChannel.messages.fetch(report.messageId);
        
        const updatedEmbed = EmbedBuilder.from(reportMessage.embeds[0])
          .setColor('#2ECC71')
          .setTitle(`✅ Reporte Cerrado - ${reportId}`)
          .spliceFields(2, 1, { name: '📊 Estado', value: '✅ Cerrado', inline: true })
          .addFields(
            { name: '✅ Cerrado Por', value: `${interaction.user}`, inline: true },
            { name: '🎯 Acción', value: this.getActionName(accion), inline: true }
          );
        
        if (notas) {
          updatedEmbed.addFields({ name: '📝 Notas', value: notas });
        }
        
        await reportMessage.edit({ embeds: [updatedEmbed], components: [] });
      } catch (error) {
        console.error('Error al actualizar mensaje:', error);
      }
      
      // Notificar al reportador
      try {
        const reporter = await client.users.fetch(report.reporter);
        const notifyEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('📢 Tu Reporte fue Atendido')
          .setDescription(
            `Tu reporte **${reportId}** ha sido cerrado.\n\n` +
            `**Usuario reportado:** ${report.reportedUserTag}\n` +
            `**Acción tomada:** ${this.getActionName(accion)}\n` +
            `**Servidor:** ${interaction.guild.name}\n\n` +
            `Gracias por ayudarnos a mantener la comunidad segura.`
          )
          .setTimestamp();
        
        await reporter.send({ embeds: [notifyEmbed] });
      } catch (error) {
        console.log('No se pudo notificar al reportador');
      }
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Reporte Cerrado')
        .setDescription(
          `El reporte **${reportId}** ha sido cerrado exitosamente.\n\n` +
          `**Acción:** ${this.getActionName(accion)}\n` +
          `**Notas:** ${notas || 'Sin notas'}`
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al cerrar reporte:', error);
      await interaction.followUp({
        content: '❌ Error al cerrar el reporte.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Lista reportes
   */
  static async listReports(interaction, client, estado) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId] || data.guilds[guildId].reports.length === 0) {
        return interaction.followUp({
          content: '✅ No hay reportes en este servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      let reports = data.guilds[guildId].reports;
      
      if (estado !== 'all') {
        reports = reports.filter(r => r.status === estado);
      }
      
      if (reports.length === 0) {
        return interaction.followUp({
          content: `✅ No hay reportes con estado "${estado}".`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Ordenar por fecha (más recientes primero)
      reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Mostrar últimos 10
      const reportsText = reports.slice(0, 10).map((report, index) => {
        const statusEmojis = {
          'pending': '🆕',
          'claimed': '👁️',
          'closed': '✅'
        };
        
        const date = new Date(report.timestamp).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        return `**${index + 1}.** ${statusEmojis[report.status]} \`${report.id}\`\n` +
               `   👤 ${report.reportedUserTag}\n` +
               `   📅 ${date} | 📢 ${report.reporterTag}\n` +
               `   📝 ${report.reason.substring(0, 50)}${report.reason.length > 50 ? '...' : ''}`;
      }).join('\n\n');
      
      const statusNames = {
        'pending': '🆕 Pendientes',
        'claimed': '👁️ En Revisión',
        'closed': '✅ Cerrados',
        'all': '📊 Todos'
      };
      
      const listEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📋 Reportes - ${statusNames[estado]}`)
        .setDescription(
          `**Total:** ${reports.length} reporte(s)\n\n` +
          reportsText +
          (reports.length > 10 ? `\n\n*Mostrando los 10 más recientes*` : '')
        )
        .setFooter({ text: 'Usa /report view para ver detalles' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al listar reportes:', error);
      await interaction.followUp({
        content: '❌ Error al listar los reportes.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Muestra estadísticas de reportes
   */
  static async showStats(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        return interaction.followUp({
          content: '✅ No hay reportes en este servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const stats = data.guilds[guildId].stats;
      const reports = data.guilds[guildId].reports;
      
      // Calcular estadísticas adicionales
      const claimedReports = reports.filter(r => r.status === 'claimed').length;
      const closedReports = reports.filter(r => r.status === 'closed').length;
      const avgResponseTime = this.calculateAvgResponseTime(reports);
      
      // Top usuarios reportados
      const reportedUsers = {};
      reports.forEach(r => {
        reportedUsers[r.reportedUser] = (reportedUsers[r.reportedUser] || 0) + 1;
      });
      
      const topReported = Object.entries(reportedUsers)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([userId, count], index) => 
          `**${index + 1}.** <@${userId}> - ${count} reporte(s)`
        )
        .join('\n') || '*No hay datos*';
      
      // Top moderadores
      const moderators = {};
      reports.filter(r => r.closedBy).forEach(r => {
        moderators[r.closedBy] = (moderators[r.closedBy] || 0) + 1;
      });
      
      const topMods = Object.entries(moderators)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([userId, count], index) => 
          `**${index + 1}.** <@${userId}> - ${count} reporte(s)`
        )
        .join('\n') || '*No hay datos*';
      
      const statsEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Estadísticas de Reportes')
        .addFields(
          { name: '📈 Total de Reportes', value: `${stats.total}`, inline: true },
          { name: '🆕 Pendientes', value: `${stats.pending}`, inline: true },
          { name: '👁️ En Revisión', value: `${claimedReports}`, inline: true },
          { name: '✅ Resueltos', value: `${stats.resolved}`, inline: true },
          { name: '❌ Inválidos', value: `${stats.invalid}`, inline: true },
          { name: '✅ Cerrados', value: `${closedReports}`, inline: true },
          { name: '⏱️ Tiempo Promedio', value: avgResponseTime, inline: false },
          { name: '👥 Top Usuarios Reportados', value: topReported, inline: true },
          { name: '👮 Top Moderadores', value: topMods, inline: true }
        )
        .setFooter({ text: `Servidor: ${interaction.guild.name}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [statsEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al mostrar estadísticas:', error);
      await interaction.followUp({
        content: '❌ Error al obtener estadísticas.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Calcula el tiempo promedio de respuesta
   */
  static calculateAvgResponseTime(reports) {
    const closedReports = reports.filter(r => r.status === 'closed' && r.closedAt);
    
    if (closedReports.length === 0) {
      return 'Sin datos';
    }
    
    const totalTime = closedReports.reduce((sum, report) => {
      const created = new Date(report.timestamp).getTime();
      const closed = new Date(report.closedAt).getTime();
      return sum + (closed - created);
    }, 0);
    
    const avgMs = totalTime / closedReports.length;
    const hours = Math.floor(avgMs / (1000 * 60 * 60));
    const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
  
  /**
   * Maneja los botones de reportes
   */
  static async handleButton(interaction, client, action, params) {
    const reportId = params[0];
    
    if (action === 'claim') {
      await this.claimReport(interaction, client, reportId);
    }
    else if (action === 'view') {
      await this.viewReport(interaction, client, reportId);
    }
    else if (action === 'close') {
      // Mostrar modal para cerrar
      await interaction.reply({
        content: `Para cerrar el reporte **${reportId}**, usa el comando:\n\`/report close id_reporte:${reportId} accion:[elige una]\``,
        flags: MessageFlags.Ephemeral
      });
    }
  }
}

module.exports = ReportManager;