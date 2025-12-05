// ========================================
// 📁 systems/moderation/warnManager.js
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
  
  class WarnManager {
    static dataPath = path.join(__dirname, '../../data/moderation/warns.json');
    static configPath = path.join(__dirname, '../../data/moderation/warnConfig.json');
    
    /**
     * Carga los datos de warns
     */
    static loadData() {
      try {
        if (!fs.existsSync(this.dataPath)) {
          const initialData = {
            guilds: {}
          };
          this.saveData(initialData);
          return initialData;
        }
        return JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
      } catch (error) {
        console.error('Error al cargar datos de warns:', error);
        return { guilds: {} };
      }
    }
    
    /**
     * Guarda los datos de warns
     */
    static saveData(data) {
      try {
        const dir = path.dirname(this.dataPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('Error al guardar datos de warns:', error);
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
        console.error('Error al cargar config de warns:', error);
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
        console.error('Error al guardar config de warns:', error);
      }
    }
    
    /**
     * Genera un ID único para el warn
     */
    static generateWarnId() {
      return `W${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    }
    
    /**
     * Obtiene la configuración del servidor
     */
    static getGuildConfig(guildId) {
      const config = this.loadConfig();
      return config[guildId] || {
        maxWarns: 3,
        logsChannelId: null,
        expirationDays: 30
      };
    }
    
    /**
     * Limpia warns expirados
     */
    static cleanExpiredWarns(guildId, userId, warns, expirationDays) {
      if (expirationDays === 0) return warns;
      
      const now = Date.now();
      const expirationMs = expirationDays * 24 * 60 * 60 * 1000;
      
      return warns.filter(warn => {
        const warnDate = new Date(warn.timestamp).getTime();
        return (now - warnDate) < expirationMs;
      });
    }
    
    /**
     * Agrega una advertencia
     */
    static async addWarn(interaction, client, usuario, razon, enviarDM) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const userId = usuario.id;
        const moderatorId = interaction.user.id;
        
        // Validaciones
        if (usuario.bot) {
          return interaction.followUp({
            content: '❌ No puedes advertir a un bot.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        if (userId === moderatorId) {
          return interaction.followUp({
            content: '❌ No puedes advertirte a ti mismo.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        if (userId === client.user.id) {
          return interaction.followUp({
            content: '❌ No puedes advertirme a mí. 🤖',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
          return interaction.followUp({
            content: '❌ No puedes advertir a alguien con un rol igual o superior al tuyo.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Cargar datos
        const data = this.loadData();
        const config = this.getGuildConfig(guildId);
        
        if (!data.guilds[guildId]) {
          data.guilds[guildId] = {};
        }
        
        if (!data.guilds[guildId][userId]) {
          data.guilds[guildId][userId] = {
            warns: []
          };
        }
        
        // Limpiar warns expirados
        data.guilds[guildId][userId].warns = this.cleanExpiredWarns(
          guildId, 
          userId, 
          data.guilds[guildId][userId].warns, 
          config.expirationDays
        );
        
        // Crear warn
        const warnId = this.generateWarnId();
        const warn = {
          id: warnId,
          reason: razon,
          moderator: moderatorId,
          moderatorTag: interaction.user.tag,
          timestamp: new Date().toISOString(),
          active: true
        };
        
        data.guilds[guildId][userId].warns.push(warn);
        this.saveData(data);
        
        const totalWarns = data.guilds[guildId][userId].warns.filter(w => w.active).length;
        
        // Enviar DM al usuario
        if (enviarDM && member) {
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('⚠️ Has Recibido una Advertencia')
              .setDescription(
                `Has recibido una advertencia en **${interaction.guild.name}**.\n\n` +
                `**Razón:** ${razon}\n` +
                `**Moderador:** ${interaction.user.tag}\n` +
                `**Total de advertencias:** ${totalWarns}/${config.maxWarns}\n\n` +
                (totalWarns >= config.maxWarns 
                  ? '🚨 **Has alcanzado el límite de advertencias. Serás baneado.**' 
                  : `⚠️ Si recibes **${config.maxWarns - totalWarns}** advertencia(s) más, serás baneado automáticamente.`)
              )
              .setFooter({ text: `ID del Warn: ${warnId}` })
              .setTimestamp();
            
            await usuario.send({ embeds: [dmEmbed] });
          } catch (error) {
            console.log(`No se pudo enviar DM a ${usuario.tag}`);
          }
        }
        
        // Auto-ban si alcanza el máximo
        let autoBanned = false;
        if (totalWarns >= config.maxWarns && member) {
          try {
            await member.ban({ 
              reason: `Auto-ban: Alcanzó ${config.maxWarns} advertencias. Última razón: ${razon}` 
            });
            autoBanned = true;
          } catch (error) {
            console.error('Error al auto-banear:', error);
          }
        }
        
        // Log en canal de moderación
        if (config.logsChannelId) {
          await this.sendLog(
            client, 
            config.logsChannelId, 
            usuario, 
            interaction.user, 
            razon, 
            warnId, 
            totalWarns, 
            config.maxWarns,
            autoBanned
          );
        }
        
        // Respuesta al moderador
        const responseEmbed = new EmbedBuilder()
          .setColor(autoBanned ? '#FF0000' : '#00FF00')
          .setTitle(autoBanned ? '🔨 Usuario Baneado' : '✅ Advertencia Agregada')
          .setDescription(
            `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
            `**Razón:** ${razon}\n` +
            `**Total de advertencias:** ${totalWarns}/${config.maxWarns}\n` +
            `**ID del Warn:** \`${warnId}\`\n` +
            (autoBanned 
              ? '\n🔨 **El usuario ha sido baneado automáticamente por alcanzar el límite de advertencias.**' 
              : enviarDM ? '\n✉️ DM enviado al usuario.' : '\n📭 DM no enviado.')
          )
          .setThumbnail(usuario.displayAvatarURL())
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al agregar warn:', error);
        await interaction.followUp({
          content: '❌ Error al agregar la advertencia.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Quita una advertencia
     */
    static async removeWarn(interaction, client, usuario, warnId) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const userId = usuario.id;
        
        const data = this.loadData();
        
        if (!data.guilds[guildId] || !data.guilds[guildId][userId]) {
          return interaction.followUp({
            content: '❌ Este usuario no tiene advertencias.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const warns = data.guilds[guildId][userId].warns;
        const warnIndex = warns.findIndex(w => w.id === warnId && w.active);
        
        if (warnIndex === -1) {
          return interaction.followUp({
            content: '❌ No se encontró una advertencia activa con ese ID.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        warns[warnIndex].active = false;
        warns[warnIndex].removedBy = interaction.user.id;
        warns[warnIndex].removedAt = new Date().toISOString();
        
        this.saveData(data);
        
        const config = this.getGuildConfig(guildId);
        const totalWarns = warns.filter(w => w.active).length;
        
        // Log
        if (config.logsChannelId) {
          await this.sendRemoveLog(client, config.logsChannelId, usuario, interaction.user, warnId, totalWarns);
        }
        
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Advertencia Eliminada')
          .setDescription(
            `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
            `**ID del Warn:** \`${warnId}\`\n` +
            `**Advertencias restantes:** ${totalWarns}/${config.maxWarns}`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al quitar warn:', error);
        await interaction.followUp({
          content: '❌ Error al quitar la advertencia.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Lista las advertencias de un usuario
     */
    static async listWarns(interaction, client, usuario) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const userId = usuario.id;
        
        const data = this.loadData();
        const config = this.getGuildConfig(guildId);
        
        if (!data.guilds[guildId] || !data.guilds[guildId][userId]) {
          return interaction.followUp({
            content: `✅ ${usuario} no tiene advertencias.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Limpiar warns expirados
        data.guilds[guildId][userId].warns = this.cleanExpiredWarns(
          guildId, 
          userId, 
          data.guilds[guildId][userId].warns, 
          config.expirationDays
        );
        this.saveData(data);
        
        const warns = data.guilds[guildId][userId].warns;
        const activeWarns = warns.filter(w => w.active);
        
        if (activeWarns.length === 0) {
          return interaction.followUp({
            content: `✅ ${usuario} no tiene advertencias activas.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        const warnsText = activeWarns.map((warn, index) => {
          const date = new Date(warn.timestamp).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          
          return `**${index + 1}.** \`${warn.id}\`\n` +
                 `   📅 ${date}\n` +
                 `   👮 ${warn.moderatorTag}\n` +
                 `   📝 ${warn.reason}`;
        }).join('\n\n');
        
        const listEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle(`⚠️ Advertencias de ${usuario.tag}`)
          .setDescription(
            `**Total de advertencias:** ${activeWarns.length}/${config.maxWarns}\n\n` +
            warnsText
          )
          .setThumbnail(usuario.displayAvatarURL())
          .setFooter({ text: 'Usa /warn remove para quitar una advertencia' })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al listar warns:', error);
        await interaction.followUp({
          content: '❌ Error al listar las advertencias.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Limpia todas las advertencias de un usuario
     */
    static async clearWarns(interaction, client, usuario) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const userId = usuario.id;
        
        const data = this.loadData();
        
        if (!data.guilds[guildId] || !data.guilds[guildId][userId]) {
          return interaction.followUp({
            content: '❌ Este usuario no tiene advertencias.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const activeWarns = data.guilds[guildId][userId].warns.filter(w => w.active).length;
        
        if (activeWarns === 0) {
          return interaction.followUp({
            content: '❌ Este usuario no tiene advertencias activas.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Desactivar todos los warns
        data.guilds[guildId][userId].warns.forEach(warn => {
          if (warn.active) {
            warn.active = false;
            warn.removedBy = interaction.user.id;
            warn.removedAt = new Date().toISOString();
          }
        });
        
        this.saveData(data);
        
        const config = this.getGuildConfig(guildId);
        
        // Log
        if (config.logsChannelId) {
          await this.sendClearLog(client, config.logsChannelId, usuario, interaction.user, activeWarns);
        }
        
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Advertencias Limpiadas')
          .setDescription(
            `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
            `**Advertencias eliminadas:** ${activeWarns}\n\n` +
            `Todas las advertencias activas han sido removidas.`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al limpiar warns:', error);
        await interaction.followUp({
          content: '❌ Error al limpiar las advertencias.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Configura el sistema de warns
     */
    static async configureWarns(interaction, client, maxWarns, canalLogs, expiracionDias) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const config = this.loadConfig();
        
        config[guildId] = {
          maxWarns: maxWarns,
          logsChannelId: canalLogs.id,
          expirationDays: expiracionDias
        };
        
        this.saveConfig(config);
        
        const configEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Sistema de Warns Configurado')
          .setDescription(
            `**Configuración guardada exitosamente:**\n\n` +
            `⚠️ **Máximo de advertencias:** ${maxWarns}\n` +
            `📝 **Canal de logs:** ${canalLogs}\n` +
            `⏱️ **Expiración:** ${expiracionDias === 0 ? 'Nunca' : `${expiracionDias} días`}\n\n` +
            `**Funcionalidades activas:**\n` +
            `✨ Auto-ban al alcanzar el máximo\n` +
            `✉️ DM automático al usuario advertido\n` +
            `📊 Historial completo con moderador y fecha\n` +
            `🔄 ${expiracionDias === 0 ? 'Warns permanentes' : 'Auto-expiración de warns antiguos'}`
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [configEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al configurar warns:', error);
        await interaction.followUp({
          content: '❌ Error al configurar el sistema.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Envía un log al canal de moderación
     */
    static async sendLog(client, logsChannelId, usuario, moderador, razon, warnId, totalWarns, maxWarns, autoBanned) {
      try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        
        const logEmbed = new EmbedBuilder()
          .setColor(autoBanned ? '#FF0000' : '#FFA500')
          .setAuthor({ 
            name: autoBanned ? 'Usuario Baneado Automáticamente' : 'Advertencia Agregada',
            iconURL: usuario.displayAvatarURL() 
          })
          .addFields(
            { name: '👤 Usuario', value: `${usuario} (\`${usuario.tag}\`)`, inline: true },
            { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true },
            { name: '⚠️ Total Warns', value: `${totalWarns}/${maxWarns}`, inline: true },
            { name: '📝 Razón', value: razon, inline: false },
            { name: '🆔 ID del Warn', value: `\`${warnId}\``, inline: false }
          )
          .setTimestamp();
        
        if (autoBanned) {
          logEmbed.addFields({
            name: '🔨 Acción Automática',
            value: 'El usuario ha sido baneado por alcanzar el límite de advertencias.'
          });
        }
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log:', error);
      }
    }
    
    /**
     * Envía log de warn removido
     */
    static async sendRemoveLog(client, logsChannelId, usuario, moderador, warnId, totalWarns) {
      try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        
        const logEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setAuthor({ 
            name: 'Advertencia Eliminada',
            iconURL: usuario.displayAvatarURL() 
          })
          .addFields(
            { name: '👤 Usuario', value: `${usuario} (\`${usuario.tag}\`)`, inline: true },
            { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true },
            { name: '⚠️ Warns Restantes', value: `${totalWarns}`, inline: true },
            { name: '🆔 ID del Warn', value: `\`${warnId}\``, inline: false }
          )
          .setTimestamp();
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log de remove:', error);
      }
    }
    
    /**
     * Envía log de limpieza de warns
     */
    static async sendClearLog(client, logsChannelId, usuario, moderador, cantidad) {
      try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        
        const logEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setAuthor({ 
            name: 'Advertencias Limpiadas',
            iconURL: usuario.displayAvatarURL() 
          })
          .addFields(
            { name: '👤 Usuario', value: `${usuario} (\`${usuario.tag}\`)`, inline: true },
            { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true },
            { name: '🗑️ Cantidad Eliminada', value: `${cantidad}`, inline: true }
          )
          .setTimestamp();
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log de clear:', error);
      }
    }
  }
  
  module.exports = WarnManager;