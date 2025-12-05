// ========================================
// 📁 systems/moderation/tempbanManager.js
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

class TempBanManager {
  static dataPath = path.join(__dirname, '../../data/moderation/tempbans.json');
  
  /**
   * Carga los datos de tempbans
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
      console.error('Error al cargar datos de tempbans:', error);
      return { guilds: {} };
    }
  }
  
  /**
   * Guarda los datos de tempbans
   */
  static saveData(data) {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error al guardar datos de tempbans:', error);
    }
  }
  
  /**
   * Convierte duración en milisegundos
   */
  static parseDuration(duration) {
    const units = {
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    const match = duration.match(/^(\d+)([hd])$/);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return value * units[unit];
  }
  
  /**
   * Formatea la duración para lectura humana
   */
  static formatDuration(duration) {
    const units = {
      '1h': '1 hora',
      '6h': '6 horas',
      '12h': '12 horas',
      '1d': '1 día',
      '3d': '3 días',
      '7d': '7 días',
      '14d': '14 días',
      '30d': '30 días'
    };
    
    return units[duration] || duration;
  }
  
  /**
   * Obtiene el canal de logs
   */
  static getLogsChannel(guildId) {
    try {
      const WarnManager = require('./warnManager');
      const config = WarnManager.getGuildConfig(guildId);
      return config.logsChannelId || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Agrega un ban temporal
   */
  static async addTempBan(interaction, client, usuario, duracion, razon, borrarMensajes) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const userId = usuario.id;
      const moderatorId = interaction.user.id;
      
      // Validaciones
      if (usuario.bot) {
        return interaction.followUp({
          content: '❌ No puedes banear a un bot.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (userId === moderatorId) {
        return interaction.followUp({
          content: '❌ No puedes banearte a ti mismo.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (userId === client.user.id) {
        return interaction.followUp({
          content: '❌ No puedes banearme a mí. 🤖',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      
      if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.followUp({
          content: '❌ No puedes banear a alguien con un rol igual o superior al tuyo.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Verificar si ya está baneado
      const banInfo = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (banInfo) {
        return interaction.followUp({
          content: '❌ Este usuario ya está baneado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Convertir duración
      const ms = this.parseDuration(duracion);
      if (!ms) {
        return interaction.followUp({
          content: '❌ Formato de duración inválido.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const endsAt = new Date(Date.now() + ms);
      
      // Enviar DM al usuario antes de banear
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔨 Has Sido Baneado Temporalmente')
          .setDescription(
            `Has sido baneado temporalmente de **${interaction.guild.name}**.\n\n` +
            `**Razón:** ${razon}\n` +
            `**Duración:** ${this.formatDuration(duracion)}\n` +
            `**Moderador:** ${interaction.user.tag}\n` +
            `**Finaliza:** <t:${Math.floor(endsAt.getTime() / 1000)}:F>\n\n` +
            `Serás desbaneado automáticamente cuando termine el tiempo.\n` +
            `Si crees que esto es un error, puedes apelar el ban.`
          )
          .setFooter({ text: `ID del Ban: TB${Date.now()}` })
          .setTimestamp();
        
        await usuario.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`No se pudo enviar DM a ${usuario.tag}`);
      }
      
      // Banear usuario
      try {
        await interaction.guild.members.ban(userId, {
          reason: `[TempBan] ${razon} - Duración: ${this.formatDuration(duracion)} - Por: ${interaction.user.tag}`,
          deleteMessageSeconds: borrarMensajes ? 7 * 24 * 60 * 60 : 0
        });
      } catch (error) {
        console.error('Error al banear usuario:', error);
        return interaction.followUp({
          content: '❌ No tengo permisos para banear a este usuario.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Guardar en base de datos
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        data.guilds[guildId] = {};
      }
      
      if (!data.guilds[guildId][userId]) {
        data.guilds[guildId][userId] = { history: [] };
      }
      
      const banId = `TB${Date.now()}`;
      const banRecord = {
        id: banId,
        reason: razon,
        duration: duracion,
        durationMs: ms,
        moderator: moderatorId,
        moderatorTag: interaction.user.tag,
        timestamp: new Date().toISOString(),
        endsAt: endsAt.toISOString(),
        active: true,
        deletedMessages: borrarMensajes,
        userTag: usuario.tag
      };
      
      data.guilds[guildId][userId].history.push(banRecord);
      this.saveData(data);
      
      // Programar auto-unban
      setTimeout(async () => {
        await this.autoUnban(client, guildId, userId, banId);
      }, ms);
      
      // Log
      const logsChannelId = this.getLogsChannel(guildId);
      if (logsChannelId) {
        await this.sendLog(
          client, 
          logsChannelId, 
          usuario, 
          interaction.user, 
          razon, 
          duracion,
          banId,
          borrarMensajes,
          true
        );
      }
      
      // Respuesta al moderador
      const responseEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 Ban Temporal Aplicado')
        .setDescription(
          `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
          `**ID:** \`${userId}\`\n` +
          `**Duración:** ${this.formatDuration(duracion)}\n` +
          `**Razón:** ${razon}\n` +
          `**Finaliza:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n` +
          `**ID del Ban:** \`${banId}\`\n` +
          `**Mensajes eliminados:** ${borrarMensajes ? 'Últimos 7 días' : 'Ninguno'}\n\n` +
          `✉️ DM enviado al usuario.\n` +
          `🔄 Se desbaneará automáticamente.`
        )
        .setThumbnail(usuario.displayAvatarURL())
        .setFooter({ text: `Moderador: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al agregar tempban:', error);
      await interaction.followUp({
        content: '❌ Error al aplicar el ban temporal.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Quita un ban temporal antes de tiempo
   */
  static async removeTempBan(interaction, client, usuarioId, razon) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      
      // Verificar si está baneado
      const banInfo = await interaction.guild.bans.fetch(usuarioId).catch(() => null);
      if (!banInfo) {
        return interaction.followUp({
          content: '❌ Este usuario no está baneado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Desbanear
      try {
        await interaction.guild.members.unban(usuarioId, `Ban temporal removido por ${interaction.user.tag} - Razón: ${razon}`);
      } catch (error) {
        console.error('Error al desbanear:', error);
        return interaction.followUp({
          content: '❌ No tengo permisos para desbanear a este usuario.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Actualizar base de datos
      const data = this.loadData();
      
      if (data.guilds[guildId] && data.guilds[guildId][usuarioId]) {
        const history = data.guilds[guildId][usuarioId].history;
        const activeBan = history.find(b => b.active);
        
        if (activeBan) {
          activeBan.active = false;
          activeBan.removedBy = interaction.user.id;
          activeBan.removedAt = new Date().toISOString();
          activeBan.removalReason = razon;
          this.saveData(data);
        }
      }
      
      // Log
      const logsChannelId = this.getLogsChannel(guildId);
      if (logsChannelId) {
        await this.sendUnbanLog(client, logsChannelId, usuarioId, interaction.user, razon, banInfo.user);
      }
      
      // Respuesta
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Ban Temporal Removido')
        .setDescription(
          `**Usuario:** ${banInfo.user.tag}\n` +
          `**ID:** \`${usuarioId}\`\n` +
          `**Razón del desbaneo:** ${razon}\n\n` +
          `El usuario ha sido desbaneado anticipadamente.`
        )
        .setFooter({ text: `Moderador: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al remover tempban:', error);
      await interaction.followUp({
        content: '❌ Error al remover el ban temporal.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Lista todos los bans temporales activos
   */
  static async listTempBans(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        return interaction.followUp({
          content: '✅ No hay bans temporales activos.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const activeBans = [];
      
      for (const [userId, userData] of Object.entries(data.guilds[guildId])) {
        const activeBan = userData.history.find(b => b.active);
        if (activeBan) {
          activeBans.push({ userId, ...activeBan });
        }
      }
      
      if (activeBans.length === 0) {
        return interaction.followUp({
          content: '✅ No hay bans temporales activos.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const bansText = activeBans.slice(0, 10).map((ban, index) => {
        const endsAt = Math.floor(new Date(ban.endsAt).getTime() / 1000);
        
        return `**${index + 1}.** ${ban.userTag} (\`${ban.userId}\`)\n` +
               `   ⏱️ ${this.formatDuration(ban.duration)}\n` +
               `   📝 ${ban.reason}\n` +
               `   ⏰ Termina: <t:${endsAt}:R>\n` +
               `   🆔 \`${ban.id}\``;
      }).join('\n\n');
      
      const listEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🔨 Bans Temporales Activos')
        .setDescription(
          `**Total:** ${activeBans.length} ban(s) temporal(es)\n\n` +
          bansText +
          (activeBans.length > 10 ? `\n\n*+${activeBans.length - 10} ban(s) más*` : '')
        )
        .setFooter({ text: `Servidor: ${interaction.guild.name}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al listar tempbans:', error);
      await interaction.followUp({
        content: '❌ Error al obtener la lista de bans.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Muestra el historial de bans de un usuario
   */
  static async showHistory(interaction, client, usuarioId) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId] || !data.guilds[guildId][usuarioId] || 
          data.guilds[guildId][usuarioId].history.length === 0) {
        return interaction.followUp({
          content: `✅ Este usuario no tiene historial de bans temporales.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      const history = data.guilds[guildId][usuarioId].history;
      
      const historyText = history.slice(-10).reverse().map((ban, index) => {
        const date = new Date(ban.timestamp).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const status = ban.active ? '🔴 Activo' : '✅ Completado';
        
        return `**${history.length - index}.** \`${ban.id}\` ${status}\n` +
               `   📅 ${date}\n` +
               `   ⏱️ ${this.formatDuration(ban.duration)}\n` +
               `   👮 ${ban.moderatorTag}\n` +
               `   📝 ${ban.reason}`;
      }).join('\n\n');
      
      const historyEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🔨 Historial de Bans Temporales`)
        .setDescription(
          `**Usuario ID:** \`${usuarioId}\`\n` +
          `**Total de bans:** ${history.length}\n` +
          `**Activos:** ${history.filter(b => b.active).length}\n\n` +
          `**Últimos 10 bans:**\n\n${historyText}`
        )
        .setFooter({ text: 'Mostrando los 10 más recientes' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [historyEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al mostrar historial:', error);
      await interaction.followUp({
        content: '❌ Error al obtener el historial.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Verifica información de un ban temporal
   */
  static async checkTempBan(interaction, client, usuarioId) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId] || !data.guilds[guildId][usuarioId]) {
        return interaction.followUp({
          content: '❌ Este usuario no tiene bans temporales registrados.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const history = data.guilds[guildId][usuarioId].history;
      const activeBan = history.find(b => b.active);
      
      if (!activeBan) {
        return interaction.followUp({
          content: '❌ Este usuario no tiene un ban temporal activo.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const endsAt = Math.floor(new Date(activeBan.endsAt).getTime() / 1000);
      const now = Math.floor(Date.now() / 1000);
      const remaining = endsAt - now;
      
      const checkEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🔨 Información del Ban Temporal')
        .setDescription(
          `**Usuario:** ${activeBan.userTag}\n` +
          `**ID:** \`${usuarioId}\`\n` +
          `**Duración:** ${this.formatDuration(activeBan.duration)}\n` +
          `**Razón:** ${activeBan.reason}\n` +
          `**Moderador:** ${activeBan.moderatorTag}\n` +
          `**Inicio:** <t:${Math.floor(new Date(activeBan.timestamp).getTime() / 1000)}:F>\n` +
          `**Finaliza:** <t:${endsAt}:F>\n` +
          `**Tiempo restante:** <t:${endsAt}:R>\n` +
          `**ID del Ban:** \`${activeBan.id}\`\n` +
          `**Mensajes eliminados:** ${activeBan.deletedMessages ? 'Sí (7 días)' : 'No'}`
        )
        .setFooter({ text: 'Se desbaneará automáticamente' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [checkEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al verificar tempban:', error);
      await interaction.followUp({
        content: '❌ Error al verificar el ban temporal.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Auto-unban cuando termina el tiempo
   */
  static async autoUnban(client, guildId, userId, banId) {
    try {
      const data = this.loadData();
      
      if (!data.guilds[guildId] || !data.guilds[guildId][userId]) {
        return;
      }
      
      const history = data.guilds[guildId][userId].history;
      const ban = history.find(b => b.id === banId && b.active);
      
      if (!ban) return;
      
      const guild = await client.guilds.fetch(guildId);
      
      // Verificar si todavía está baneado
      const banInfo = await guild.bans.fetch(userId).catch(() => null);
      if (!banInfo) {
        // Ya fue desbaneado manualmente
        ban.active = false;
        this.saveData(data);
        return;
      }
      
      // Desbanear
      try {
        await guild.members.unban(userId, `[Auto-Unban] Ban temporal expirado - ID: ${banId}`);
      } catch (error) {
        console.error(`Error al auto-desbanear usuario ${userId}:`, error);
        return;
      }
      
      // Actualizar base de datos
      ban.active = false;
      ban.autoUnbanned = true;
      ban.unbannedAt = new Date().toISOString();
      this.saveData(data);
      
      // Log
      const logsChannelId = this.getLogsChannel(guildId);
      if (logsChannelId) {
        await this.sendAutoUnbanLog(client, logsChannelId, userId, ban.userTag, ban.reason, ban.duration);
      }
      
      console.log(`✅ Auto-unban completado: ${ban.userTag} (${userId}) en ${guild.name}`);
      
    } catch (error) {
      console.error('Error en auto-unban:', error);
    }
  }
  
  /**
   * Envía log de ban temporal
   */
  static async sendLog(client, logsChannelId, usuario, moderador, razon, duracion, banId, borrarMensajes, isBan) {
    try {
      const logsChannel = await client.channels.fetch(logsChannelId);
      
      const logEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setAuthor({ 
          name: 'Ban Temporal Aplicado',
          iconURL: usuario.displayAvatarURL() 
        })
        .addFields(
          { name: '👤 Usuario', value: `${usuario} (\`${usuario.tag}\`)`, inline: true },
          { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true },
          { name: '⏱️ Duración', value: this.formatDuration(duracion), inline: true },
          { name: '📝 Razón', value: razon, inline: false },
          { name: '🆔 ID del Ban', value: `\`${banId}\``, inline: true },
          { name: '🗑️ Mensajes Eliminados', value: borrarMensajes ? 'Últimos 7 días' : 'Ninguno', inline: true }
        )
        .setTimestamp();
      
      await logsChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Error al enviar log:', error);
    }
  }
  
  /**
   * Envía log de desbaneo manual
   */
  static async sendUnbanLog(client, logsChannelId, usuarioId, moderador, razon, usuario) {
    try {
      const logsChannel = await client.channels.fetch(logsChannelId);
      
      const logEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setAuthor({ 
          name: 'Ban Temporal Removido',
          iconURL: usuario.displayAvatarURL() 
        })
        .addFields(
          { name: '👤 Usuario', value: `${usuario.tag} (\`${usuarioId}\`)`, inline: true },
          { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true },
          { name: '📝 Razón', value: razon, inline: false }
        )
        .setTimestamp();
      
      await logsChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Error al enviar log de unban:', error);
    }
  }
  
  /**
   * Envía log de auto-unban
   */
  static async sendAutoUnbanLog(client, logsChannelId, usuarioId, userTag, razon, duracion) {
    try {
      const logsChannel = await client.channels.fetch(logsChannelId);
      
      const logEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setAuthor({ 
          name: 'Ban Temporal Expirado (Automático)',
          iconURL: client.user.displayAvatarURL() 
        })
        .addFields(
          { name: '👤 Usuario', value: `${userTag} (\`${usuarioId}\`)`, inline: true },
          { name: '⏱️ Duración', value: this.formatDuration(duracion), inline: true },
          { name: '📝 Razón Original', value: razon, inline: false }
        )
        .setFooter({ text: 'El usuario ha sido desbaneado automáticamente' })
        .setTimestamp();
      
      await logsChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Error al enviar log de auto-unban:', error);
    }
  }
}

module.exports = TempBanManager;