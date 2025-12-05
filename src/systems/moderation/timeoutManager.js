// ========================================
// 📁 systems/moderation/timeoutManager.js
// ========================================

const { 
    EmbedBuilder,
    MessageFlags
  } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  
  class TimeoutManager {
    static dataPath = path.join(__dirname, '../../data/moderation/timeouts.json');
    
    /**
     * Carga los datos de timeouts
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
        console.error('Error al cargar datos de timeouts:', error);
        return { guilds: {} };
      }
    }
    
    /**
     * Guarda los datos de timeouts
     */
    static saveData(data) {
      try {
        const dir = path.dirname(this.dataPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('Error al guardar datos de timeouts:', error);
      }
    }
    
    /**
     * Convierte duración en milisegundos
     */
    static parseDuration(duration) {
      const units = {
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000
      };
      
      const match = duration.match(/^(\d+)([mhdw])$/);
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
        '1m': '1 minuto',
        '5m': '5 minutos',
        '10m': '10 minutos',
        '30m': '30 minutos',
        '1h': '1 hora',
        '6h': '6 horas',
        '12h': '12 horas',
        '1d': '1 día',
        '1w': '1 semana'
      };
      
      return units[duration] || duration;
    }
    
    /**
     * Obtiene el canal de logs del servidor
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
     * Agrega un timeout a un usuario
     */
    static async addTimeout(interaction, client, usuario, duracion, razon) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const userId = usuario.id;
        const moderatorId = interaction.user.id;
        
        // Validaciones
        if (usuario.bot) {
          return interaction.followUp({
            content: '❌ No puedes silenciar a un bot.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        if (userId === moderatorId) {
          return interaction.followUp({
            content: '❌ No puedes silenciarte a ti mismo.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        if (userId === client.user.id) {
          return interaction.followUp({
            content: '❌ No puedes silenciarme a mí. 🤖',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
          return interaction.followUp({
            content: '❌ No se pudo encontrar al usuario en el servidor.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
          return interaction.followUp({
            content: '❌ No puedes silenciar a alguien con un rol igual o superior al tuyo.',
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
        
        // Aplicar timeout
        try {
          await member.timeout(ms, razon);
        } catch (error) {
          console.error('Error al aplicar timeout:', error);
          return interaction.followUp({
            content: '❌ No tengo permisos para silenciar a este usuario.',
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
        
        const timeoutRecord = {
          id: `T${Date.now()}`,
          reason: razon,
          duration: duracion,
          durationMs: ms,
          moderator: moderatorId,
          moderatorTag: interaction.user.tag,
          timestamp: new Date().toISOString(),
          endsAt: new Date(Date.now() + ms).toISOString(),
          active: true
        };
        
        data.guilds[guildId][userId].history.push(timeoutRecord);
        this.saveData(data);
        
        // Enviar DM al usuario
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('⏱️ Has Sido Silenciado')
            .setDescription(
              `Has sido silenciado temporalmente en **${interaction.guild.name}**.\n\n` +
              `**Razón:** ${razon}\n` +
              `**Duración:** ${this.formatDuration(duracion)}\n` +
              `**Moderador:** ${interaction.user.tag}\n\n` +
              `No podrás enviar mensajes, reaccionar ni unirte a canales de voz hasta que termine el timeout.`
            )
            .setFooter({ text: `ID del Timeout: ${timeoutRecord.id}` })
            .setTimestamp();
          
          await usuario.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.log(`No se pudo enviar DM a ${usuario.tag}`);
        }
        
        // Log en canal de moderación
        const logsChannelId = this.getLogsChannel(guildId);
        if (logsChannelId) {
          await this.sendLog(
            client, 
            logsChannelId, 
            usuario, 
            interaction.user, 
            razon, 
            duracion,
            timeoutRecord.id
          );
        }
        
        // Respuesta al moderador
        const responseEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('✅ Timeout Aplicado')
          .setDescription(
            `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
            `**Duración:** ${this.formatDuration(duracion)}\n` +
            `**Razón:** ${razon}\n` +
            `**Finaliza:** <t:${Math.floor((Date.now() + ms) / 1000)}:R>\n` +
            `**ID del Timeout:** \`${timeoutRecord.id}\`\n\n` +
            `✉️ DM enviado al usuario.`
          )
          .setThumbnail(usuario.displayAvatarURL())
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al agregar timeout:', error);
        await interaction.followUp({
          content: '❌ Error al aplicar el timeout.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Quita el timeout de un usuario
     */
    static async removeTimeout(interaction, client, usuario) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const userId = usuario.id;
        
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
          return interaction.followUp({
            content: '❌ No se pudo encontrar al usuario en el servidor.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        if (!member.isCommunicationDisabled()) {
          return interaction.followUp({
            content: '❌ Este usuario no tiene un timeout activo.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Quitar timeout
        try {
          await member.timeout(null, `Timeout removido por ${interaction.user.tag}`);
        } catch (error) {
          console.error('Error al quitar timeout:', error);
          return interaction.followUp({
            content: '❌ No tengo permisos para quitar el timeout de este usuario.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Actualizar base de datos
        const data = this.loadData();
        
        if (data.guilds[guildId] && data.guilds[guildId][userId]) {
          const history = data.guilds[guildId][userId].history;
          const activeTimeout = history.find(t => t.active);
          
          if (activeTimeout) {
            activeTimeout.active = false;
            activeTimeout.removedBy = interaction.user.id;
            activeTimeout.removedAt = new Date().toISOString();
            this.saveData(data);
          }
        }
        
        // Log
        const logsChannelId = this.getLogsChannel(guildId);
        if (logsChannelId) {
          await this.sendRemoveLog(client, logsChannelId, usuario, interaction.user);
        }
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Timeout Removido')
          .setDescription(
            `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
            `El timeout ha sido removido exitosamente.`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al quitar timeout:', error);
        await interaction.followUp({
          content: '❌ Error al quitar el timeout.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Muestra el historial de timeouts de un usuario
     */
    static async showHistory(interaction, client, usuario) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const userId = usuario.id;
        
        const data = this.loadData();
        
        if (!data.guilds[guildId] || !data.guilds[guildId][userId] || 
            data.guilds[guildId][userId].history.length === 0) {
          return interaction.followUp({
            content: `✅ ${usuario} no tiene historial de timeouts.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        const history = data.guilds[guildId][userId].history;
        
        const historyText = history.slice(-10).reverse().map((timeout, index) => {
          const date = new Date(timeout.timestamp).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const status = timeout.active ? '🔴 Activo' : '✅ Finalizado';
          
          return `**${history.length - index}.** \`${timeout.id}\` ${status}\n` +
                 `   📅 ${date}\n` +
                 `   ⏱️ ${this.formatDuration(timeout.duration)}\n` +
                 `   👮 ${timeout.moderatorTag}\n` +
                 `   📝 ${timeout.reason}`;
        }).join('\n\n');
        
        const historyEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`⏱️ Historial de Timeouts de ${usuario.tag}`)
          .setDescription(
            `**Total de timeouts:** ${history.length}\n` +
            `**Activos:** ${history.filter(t => t.active).length}\n\n` +
            `**Últimos 10 timeouts:**\n\n${historyText}`
          )
          .setThumbnail(usuario.displayAvatarURL())
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
     * Muestra todos los timeouts activos del servidor
     */
    static async showActive(interaction, client) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const data = this.loadData();
        
        if (!data.guilds[guildId]) {
          return interaction.followUp({
            content: '✅ No hay timeouts activos en este servidor.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const activeTimeouts = [];
        
        for (const [userId, userData] of Object.entries(data.guilds[guildId])) {
          const activeTimeout = userData.history.find(t => t.active);
          if (activeTimeout) {
            activeTimeouts.push({ userId, ...activeTimeout });
          }
        }
        
        if (activeTimeouts.length === 0) {
          return interaction.followUp({
            content: '✅ No hay timeouts activos en este servidor.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const activeText = activeTimeouts.map((timeout, index) => {
          const endsAt = Math.floor(new Date(timeout.endsAt).getTime() / 1000);
          
          return `**${index + 1}.** <@${timeout.userId}>\n` +
                 `   ⏱️ ${this.formatDuration(timeout.duration)}\n` +
                 `   📝 ${timeout.reason}\n` +
                 `   ⏰ Termina: <t:${endsAt}:R>`;
        }).join('\n\n');
        
        const activeEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⏱️ Timeouts Activos')
          .setDescription(
            `**Total:** ${activeTimeouts.length} usuario(s) silenciado(s)\n\n` +
            activeText
          )
          .setFooter({ text: `Servidor: ${interaction.guild.name}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [activeEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al mostrar timeouts activos:', error);
        await interaction.followUp({
          content: '❌ Error al obtener los timeouts activos.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Envía un log al canal de moderación
     */
    static async sendLog(client, logsChannelId, usuario, moderador, razon, duracion, timeoutId) {
      try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        
        const logEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setAuthor({ 
            name: 'Timeout Aplicado',
            iconURL: usuario.displayAvatarURL() 
          })
          .addFields(
            { name: '👤 Usuario', value: `${usuario} (\`${usuario.tag}\`)`, inline: true },
            { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true },
            { name: '⏱️ Duración', value: this.formatDuration(duracion), inline: true },
            { name: '📝 Razón', value: razon, inline: false },
            { name: '🆔 ID del Timeout', value: `\`${timeoutId}\``, inline: false }
          )
          .setTimestamp();
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log:', error);
      }
    }
    
    /**
     * Envía log de timeout removido
     */
    static async sendRemoveLog(client, logsChannelId, usuario, moderador) {
      try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        
        const logEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setAuthor({ 
            name: 'Timeout Removido',
            iconURL: usuario.displayAvatarURL() 
          })
          .addFields(
            { name: '👤 Usuario', value: `${usuario} (\`${usuario.tag}\`)`, inline: true },
            { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true }
          )
          .setTimestamp();
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log de remove:', error);
      }
    }
  }
  
  module.exports = TimeoutManager;