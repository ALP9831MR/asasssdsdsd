// ========================================
// 📁 systems/moderation/lockdownManager.js
// ========================================

const { 
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits
  } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  
  class LockdownManager {
    static dataPath = path.join(__dirname, '../../data/moderation/lockdowns.json');
    
    /**
     * Carga los datos de lockdowns
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
        console.error('Error al cargar datos de lockdowns:', error);
        return { guilds: {} };
      }
    }
    
    /**
     * Guarda los datos de lockdowns
     */
    static saveData(data) {
      try {
        const dir = path.dirname(this.dataPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('Error al guardar datos de lockdowns:', error);
      }
    }
    
    /**
     * Convierte duración en milisegundos
     */
    static parseDuration(duration) {
      if (duration === 'manual') return null;
      
      const units = {
        'm': 60 * 1000,
        'h': 60 * 60 * 1000
      };
      
      const match = duration.match(/^(\d+)([mh])$/);
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
        '5m': '5 minutos',
        '15m': '15 minutos',
        '30m': '30 minutos',
        '1h': '1 hora',
        '6h': '6 horas',
        '12h': '12 horas',
        'manual': 'Manual (sin auto-unlock)'
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
     * Bloquea un canal específico
     */
    static async lockChannel(interaction, client, canal, razon) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        
        // Guardar permisos actuales del rol @everyone
        const everyoneRole = interaction.guild.roles.everyone;
        const currentPermissions = canal.permissionOverwrites.cache.get(everyoneRole.id);
        
        // Bloquear canal
        await canal.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
          AddReactions: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false
        });
        
        // Guardar estado en base de datos
        const data = this.loadData();
        
        if (!data.guilds[guildId]) {
          data.guilds[guildId] = { channels: {}, serverLockdown: null };
        }
        
        data.guilds[guildId].channels[canal.id] = {
          locked: true,
          reason: razon,
          moderator: interaction.user.id,
          moderatorTag: interaction.user.tag,
          timestamp: new Date().toISOString(),
          previousPermissions: currentPermissions ? {
            sendMessages: currentPermissions.allow.has(PermissionFlagsBits.SendMessages),
            addReactions: currentPermissions.allow.has(PermissionFlagsBits.AddReactions)
          } : null
        };
        
        this.saveData(data);
        
        // Anuncio en el canal bloqueado
        const lockEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔒 Canal Bloqueado')
          .setDescription(
            `Este canal ha sido bloqueado temporalmente.\n\n` +
            `**Razón:** ${razon}\n` +
            `**Moderador:** ${interaction.user}\n\n` +
            `⚠️ No se pueden enviar mensajes hasta que se desbloquee.`
          )
          .setTimestamp();
        
        await canal.send({ embeds: [lockEmbed] });
        
        // Log
        const logsChannelId = this.getLogsChannel(guildId);
        if (logsChannelId) {
          await this.sendChannelLockLog(client, logsChannelId, canal, interaction.user, razon, true);
        }
        
        // Respuesta al moderador
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Canal Bloqueado')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Razón:** ${razon}\n\n` +
            `El canal ha sido bloqueado exitosamente. Los permisos anteriores han sido guardados.`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al bloquear canal:', error);
        await interaction.followUp({
          content: '❌ Error al bloquear el canal. Asegúrate de que tenga los permisos necesarios.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Desbloquea un canal específico
     */
    static async unlockChannel(interaction, client, canal) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const data = this.loadData();
        
        if (!data.guilds[guildId] || !data.guilds[guildId].channels[canal.id]) {
          return interaction.followUp({
            content: '❌ Este canal no está bloqueado.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const lockData = data.guilds[guildId].channels[canal.id];
        
        // Restaurar permisos
        const everyoneRole = interaction.guild.roles.everyone;
        
        if (lockData.previousPermissions) {
          await canal.permissionOverwrites.edit(everyoneRole, {
            SendMessages: lockData.previousPermissions.sendMessages ? true : null,
            AddReactions: lockData.previousPermissions.addReactions ? true : null,
            CreatePublicThreads: null,
            CreatePrivateThreads: null
          });
        } else {
          await canal.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null,
            AddReactions: null,
            CreatePublicThreads: null,
            CreatePrivateThreads: null
          });
        }
        
        // Eliminar de base de datos
        delete data.guilds[guildId].channels[canal.id];
        this.saveData(data);
        
        // Anuncio en el canal
        const unlockEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🔓 Canal Desbloqueado')
          .setDescription(
            `El canal ha sido desbloqueado por ${interaction.user}.\n\n` +
            `Pueden volver a enviar mensajes normalmente.`
          )
          .setTimestamp();
        
        await canal.send({ embeds: [unlockEmbed] });
        
        // Log
        const logsChannelId = this.getLogsChannel(guildId);
        if (logsChannelId) {
          await this.sendChannelLockLog(client, logsChannelId, canal, interaction.user, null, false);
        }
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Canal Desbloqueado')
          .setDescription(
            `**Canal:** ${canal}\n\n` +
            `El canal ha sido desbloqueado exitosamente.`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al desbloquear canal:', error);
        await interaction.followUp({
          content: '❌ Error al desbloquear el canal.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Bloquea todo el servidor
     */
    static async lockServer(interaction, client, duracion, razon) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        
        // Obtener todos los canales de texto
        const textChannels = interaction.guild.channels.cache.filter(
          c => c.isTextBased() && !c.isThread()
        );
        
        const everyoneRole = interaction.guild.roles.everyone;
        let lockedCount = 0;
        const channelData = {};
        
        // Bloquear cada canal
        for (const [channelId, channel] of textChannels) {
          try {
            const currentPermissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
            
            await channel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: false,
              AddReactions: false,
              CreatePublicThreads: false,
              CreatePrivateThreads: false
            });
            
            channelData[channelId] = {
              previousPermissions: currentPermissions ? {
                sendMessages: currentPermissions.allow.has(PermissionFlagsBits.SendMessages),
                addReactions: currentPermissions.allow.has(PermissionFlagsBits.AddReactions)
              } : null
            };
            
            lockedCount++;
          } catch (error) {
            console.error(`Error al bloquear canal ${channel.name}:`, error);
          }
        }
        
        // Calcular tiempo de finalización
        const ms = this.parseDuration(duracion);
        const endsAt = ms ? new Date(Date.now() + ms).toISOString() : null;
        
        // Guardar en base de datos
        const data = this.loadData();
        
        if (!data.guilds[guildId]) {
          data.guilds[guildId] = { channels: {}, serverLockdown: null };
        }
        
        data.guilds[guildId].serverLockdown = {
          active: true,
          reason: razon,
          duration: duracion,
          moderator: interaction.user.id,
          moderatorTag: interaction.user.tag,
          timestamp: new Date().toISOString(),
          endsAt: endsAt,
          channelData: channelData
        };
        
        this.saveData(data);
        
        // Programar auto-unlock si tiene duración
        if (ms) {
          setTimeout(async () => {
            await this.autoUnlockServer(client, guildId);
          }, ms);
        }
        
        // Anuncio en todos los canales
        const lockEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🚨 SERVIDOR EN LOCKDOWN')
          .setDescription(
            `El servidor ha sido bloqueado completamente.\n\n` +
            `**Razón:** ${razon}\n` +
            `**Moderador:** ${interaction.user}\n` +
            `**Duración:** ${this.formatDuration(duracion)}\n` +
            (endsAt ? `**Finaliza:** <t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>\n` : '') +
            `\n⚠️ Nadie puede enviar mensajes hasta que se levante el lockdown.`
          )
          .setTimestamp();
        
        for (const [, channel] of textChannels) {
          try {
            await channel.send({ embeds: [lockEmbed] });
          } catch (error) {
            console.error(`Error al enviar anuncio en ${channel.name}`);
          }
        }
        
        // Log
        const logsChannelId = this.getLogsChannel(guildId);
        if (logsChannelId) {
          await this.sendServerLockLog(
            client, 
            logsChannelId, 
            interaction.user, 
            razon, 
            duracion, 
            lockedCount, 
            true
          );
        }
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🚨 Servidor Bloqueado')
          .setDescription(
            `**Razón:** ${razon}\n` +
            `**Duración:** ${this.formatDuration(duracion)}\n` +
            `**Canales bloqueados:** ${lockedCount}\n` +
            (endsAt ? `**Finaliza:** <t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>` : '\n⚠️ **Desbloqueo manual requerido**')
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al bloquear servidor:', error);
        await interaction.followUp({
          content: '❌ Error al bloquear el servidor.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Desbloquea todo el servidor
     */
    static async unlockServer(interaction, client) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const data = this.loadData();
        
        if (!data.guilds[guildId] || !data.guilds[guildId].serverLockdown || 
            !data.guilds[guildId].serverLockdown.active) {
          return interaction.followUp({
            content: '❌ El servidor no está en lockdown.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const lockdownData = data.guilds[guildId].serverLockdown;
        const everyoneRole = interaction.guild.roles.everyone;
        let unlockedCount = 0;
        
        // Desbloquear cada canal
        for (const [channelId, channelInfo] of Object.entries(lockdownData.channelData)) {
          try {
            const channel = await interaction.guild.channels.fetch(channelId);
            
            if (channelInfo.previousPermissions) {
              await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: channelInfo.previousPermissions.sendMessages ? true : null,
                AddReactions: channelInfo.previousPermissions.addReactions ? true : null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null
              });
            } else {
              await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null,
                AddReactions: null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null
              });
            }
            
            unlockedCount++;
          } catch (error) {
            console.error(`Error al desbloquear canal ${channelId}:`, error);
          }
        }
        
        // Actualizar base de datos
        data.guilds[guildId].serverLockdown.active = false;
        data.guilds[guildId].serverLockdown.unlockedBy = interaction.user.id;
        data.guilds[guildId].serverLockdown.unlockedAt = new Date().toISOString();
        this.saveData(data);
        
        // Anuncio en todos los canales
        const unlockEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Lockdown Finalizado')
          .setDescription(
            `El servidor ha sido desbloqueado por ${interaction.user}.\n\n` +
            `Pueden volver a enviar mensajes normalmente.`
          )
          .setTimestamp();
        
        const textChannels = interaction.guild.channels.cache.filter(
          c => c.isTextBased() && !c.isThread()
        );
        
        for (const [, channel] of textChannels) {
          try {
            await channel.send({ embeds: [unlockEmbed] });
          } catch (error) {
            console.error(`Error al enviar anuncio en ${channel.name}`);
          }
        }
        
        // Log
        const logsChannelId = this.getLogsChannel(guildId);
        if (logsChannelId) {
          await this.sendServerLockLog(
            client, 
            logsChannelId, 
            interaction.user, 
            null, 
            null, 
            unlockedCount, 
            false
          );
        }
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Servidor Desbloqueado')
          .setDescription(
            `**Canales desbloqueados:** ${unlockedCount}\n\n` +
            `El servidor ha sido desbloqueado exitosamente.`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al desbloquear servidor:', error);
        await interaction.followUp({
          content: '❌ Error al desbloquear el servidor.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Auto-unlock del servidor
     */
    static async autoUnlockServer(client, guildId) {
      try {
        const data = this.loadData();
        
        if (!data.guilds[guildId] || !data.guilds[guildId].serverLockdown || 
            !data.guilds[guildId].serverLockdown.active) {
          return;
        }
        
        const guild = await client.guilds.fetch(guildId);
        const lockdownData = data.guilds[guildId].serverLockdown;
        const everyoneRole = guild.roles.everyone;
        
        // Desbloquear cada canal
        for (const [channelId, channelInfo] of Object.entries(lockdownData.channelData)) {
          try {
            const channel = await guild.channels.fetch(channelId);
            
            if (channelInfo.previousPermissions) {
              await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: channelInfo.previousPermissions.sendMessages ? true : null,
                AddReactions: channelInfo.previousPermissions.addReactions ? true : null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null
              });
            } else {
              await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null,
                AddReactions: null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null
              });
            }
          } catch (error) {
            console.error(`Error en auto-unlock del canal ${channelId}:`, error);
          }
        }
        
        // Actualizar base de datos
        data.guilds[guildId].serverLockdown.active = false;
        data.guilds[guildId].serverLockdown.autoUnlocked = true;
        data.guilds[guildId].serverLockdown.unlockedAt = new Date().toISOString();
        this.saveData(data);
        
        // Anuncio
        const unlockEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Lockdown Finalizado (Automático)')
          .setDescription(
            `El lockdown del servidor ha finalizado automáticamente.\n\n` +
            `Pueden volver a enviar mensajes normalmente.`
          )
          .setTimestamp();
        
        const textChannels = guild.channels.cache.filter(
          c => c.isTextBased() && !c.isThread()
        );
        
        for (const [, channel] of textChannels) {
          try {
            await channel.send({ embeds: [unlockEmbed] });
          } catch (error) {
            console.error(`Error al enviar anuncio en ${channel.name}`);
          }
        }
        
        console.log(`✅ Auto-unlock completado para el servidor ${guildId}`);
        
      } catch (error) {
        console.error('Error en auto-unlock del servidor:', error);
      }
    }
    
    /**
     * Muestra el estado de lockdown
     */
    static async showStatus(interaction, client) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const guildId = interaction.guild.id;
        const data = this.loadData();
        
        if (!data.guilds[guildId]) {
          return interaction.followUp({
            content: '✅ No hay lockdowns activos en este servidor.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const guildData = data.guilds[guildId];
        const serverLockdown = guildData.serverLockdown;
        const channelLockdowns = Object.entries(guildData.channels || {});
        
        const statusEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🔒 Estado de Lockdowns')
          .setTimestamp();
        
        // Lockdown del servidor
        if (serverLockdown && serverLockdown.active) {
          const endsAt = serverLockdown.endsAt 
            ? `<t:${Math.floor(new Date(serverLockdown.endsAt).getTime() / 1000)}:R>`
            : 'Manual';
          
          statusEmbed.addFields({
            name: '🚨 Lockdown del Servidor',
            value: `**Activo:** Sí\n` +
                   `**Razón:** ${serverLockdown.reason}\n` +
                   `**Moderador:** ${serverLockdown.moderatorTag}\n` +
                   `**Duración:** ${this.formatDuration(serverLockdown.duration)}\n` +
                   `**Finaliza:** ${endsAt}`
          });
        } else {
          statusEmbed.addFields({
            name: '🚨 Lockdown del Servidor',
            value: '**Activo:** No'
          });
        }
        
        // Canales bloqueados individuales
        if (channelLockdowns.length > 0) {
          const channelsText = channelLockdowns.map(([channelId, data]) => {
            return `<#${channelId}> - ${data.moderatorTag}`;
          }).join('\n');
          
          statusEmbed.addFields({
            name: `🔒 Canales Bloqueados (${channelLockdowns.length})`,
            value: channelsText
          });
        } else {
          statusEmbed.addFields({
            name: '🔒 Canales Bloqueados',
            value: 'Ninguno'
          });
        }
        
        await interaction.followUp({ embeds: [statusEmbed], flags: MessageFlags.Ephemeral });
        
      } catch (error) {
        console.error('Error al mostrar estado:', error);
        await interaction.followUp({
          content: '❌ Error al obtener el estado de lockdowns.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
    
    /**
     * Envía log de bloqueo/desbloqueo de canal
     */
    static async sendChannelLockLog(client, logsChannelId, canal, moderador, razon, isLock) {
      try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        
        const logEmbed = new EmbedBuilder()
          .setColor(isLock ? '#FF0000' : '#00FF00')
          .setTitle(isLock ? '🔒 Canal Bloqueado' : '🔓 Canal Desbloqueado')
          .addFields(
            { name: '📍 Canal', value: `${canal}`, inline: true },
            { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true }
          )
          .setTimestamp();
        
        if (isLock && razon) {
          logEmbed.addFields({ name: '📝 Razón', value: razon });
        }
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log de canal:', error);
      }
    }
    
    /**
     * Envía log de lockdown/unlock del servidor
     */
    static async sendServerLockLog(client, logsChannelId, moderador, razon, duracion, canalesAfectados, isLock) {
      try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        
        const logEmbed = new EmbedBuilder()
          .setColor(isLock ? '#FF0000' : '#00FF00')
          .setTitle(isLock ? '🚨 Servidor Bloqueado' : '✅ Servidor Desbloqueado')
          .addFields(
            { name: '👮 Moderador', value: `${moderador} (\`${moderador.tag}\`)`, inline: true },
            { name: '📊 Canales Afectados', value: `${canalesAfectados}`, inline: true }
          )
          .setTimestamp();
        
        if (isLock) {
          logEmbed.addFields(
            { name: '📝 Razón', value: razon },
            { name: '⏱️ Duración', value: this.formatDuration(duracion) }
          );
        }
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log de servidor:', error);
      }
    }
  }
  
  module.exports = LockdownManager;