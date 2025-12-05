// ========================================
// 📁 systems/moderation/clearManager.js
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
  
  class ClearManager {
    static configPath = path.join(__dirname, '../../data/moderation/clearConfig.json');
    
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
        console.error('Error al cargar config de clear:', error);
        return {};
      }
    }
    
    /**
     * Obtiene el canal de logs
     */
    static getLogsChannel(guildId) {
      const config = this.loadConfig();
      return config[guildId]?.logsChannelId || null;
    }
    
    /**
     * Envía un log de limpieza
     */
    static async sendLog(client, guildId, moderator, channel, deletedCount, type, details = {}) {
      try {
        const logsChannelId = this.getLogsChannel(guildId);
        if (!logsChannelId) return;
        
        const logsChannel = await client.channels.fetch(logsChannelId).catch(() => null);
        if (!logsChannel) return;
        
        const logEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setAuthor({ 
            name: 'Mensajes Eliminados',
            iconURL: moderator.displayAvatarURL() 
          })
          .addFields(
            { name: '👮 Moderador', value: `${moderator} (\`${moderator.tag}\`)`, inline: true },
            { name: '📍 Canal', value: `${channel}`, inline: true },
            { name: '🗑️ Cantidad', value: `${deletedCount} mensajes`, inline: true },
            { name: '📝 Tipo', value: type, inline: false }
          )
          .setTimestamp();
        
        if (Object.keys(details).length > 0) {
          const detailsText = Object.entries(details)
            .map(([key, value]) => `**${key}:** ${value}`)
            .join('\n');
          logEmbed.addFields({ name: '📋 Detalles', value: detailsText });
        }
        
        await logsChannel.send({ embeds: [logEmbed] });
      } catch (error) {
        console.error('Error al enviar log de clear:', error);
      }
    }
    
    /**
     * Crea botones de confirmación
     */
    static createConfirmButtons(customId) {
      const confirmBtn = new ButtonBuilder()
        .setCustomId(`${customId}_confirm`)
        .setLabel('✅ Confirmar')
        .setStyle(ButtonStyle.Danger);
      
      const cancelBtn = new ButtonBuilder()
        .setCustomId(`${customId}_cancel`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Secondary);
      
      return new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);
    }
    
    /**
     * Espera confirmación del usuario
     */
    static async waitForConfirmation(interaction, embed, buttons) {
      const response = await interaction.followUp({ 
        embeds: [embed], 
        components: [buttons],
        flags: MessageFlags.Ephemeral
      });
      
      try {
        const confirmation = await response.awaitMessageComponent({ 
          filter: i => i.user.id === interaction.user.id,
          time: 30000 
        });
        
        return confirmation.customId.endsWith('_confirm');
      } catch (error) {
        await response.edit({ 
          content: '⏱️ Tiempo de confirmación agotado. Operación cancelada.', 
          embeds: [], 
          components: [] 
        });
        return false;
      }
    }
    
    /**
     * Borrar todos los mensajes
     */
    static async clearAll(interaction, client, canal, cantidad) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Confirmación
        const confirmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Confirmar Eliminación')
          .setDescription(
            `¿Estás seguro de que quieres eliminar **${cantidad}** mensajes del canal ${canal}?\n\n` +
            `⚠️ Esta acción no se puede deshacer.`
          );
        
        const buttons = this.createConfirmButtons('clear_all');
        const confirmed = await this.waitForConfirmation(interaction, confirmEmbed, buttons);
        
        if (!confirmed) {
          return interaction.editReply({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
        
        // Borrar mensajes
        const messages = await canal.messages.fetch({ limit: cantidad });
        const deletedMessages = await canal.bulkDelete(messages, true);
        
        // Log
        await this.sendLog(
          client, 
          interaction.guild.id, 
          interaction.user, 
          canal, 
          deletedMessages.size, 
          'Limpieza General'
        );
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Mensajes Eliminados')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Mensajes eliminados:** ${deletedMessages.size}\n` +
            `**Solicitado:** ${cantidad}\n\n` +
            `${deletedMessages.size < cantidad ? '⚠️ *Algunos mensajes no pudieron ser eliminados (más de 14 días de antigüedad)*' : ''}`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [successEmbed], 
          components: [] 
        });
        
      } catch (error) {
        console.error('Error al limpiar mensajes:', error);
        await interaction.editReply({
          content: '❌ Error al eliminar mensajes. Asegúrate de que tenga los permisos necesarios.',
          embeds: [],
          components: []
        }).catch(console.error);
      }
    }
    
    /**
     * Borrar mensajes de un usuario
     */
    static async clearUser(interaction, client, canal, usuario, cantidad) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const messages = await canal.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(m => m.author.id === usuario.id).first(cantidad);
        
        if (userMessages.length === 0) {
          return interaction.followUp({
            content: `❌ No se encontraron mensajes de ${usuario} en los últimos 100 mensajes.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Confirmación
        const confirmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Confirmar Eliminación')
          .setDescription(
            `¿Estás seguro de que quieres eliminar **${userMessages.length}** mensajes de ${usuario} en ${canal}?\n\n` +
            `⚠️ Esta acción no se puede deshacer.`
          );
        
        const buttons = this.createConfirmButtons('clear_user');
        const confirmed = await this.waitForConfirmation(interaction, confirmEmbed, buttons);
        
        if (!confirmed) {
          return interaction.editReply({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
        
        // Borrar mensajes
        const deletedMessages = await canal.bulkDelete(userMessages, true);
        
        // Log
        await this.sendLog(
          client, 
          interaction.guild.id, 
          interaction.user, 
          canal, 
          deletedMessages.size, 
          'Limpieza por Usuario',
          { 'Usuario objetivo': `${usuario.tag}` }
        );
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Mensajes Eliminados')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
            `**Mensajes eliminados:** ${deletedMessages.size}\n` +
            `**Solicitado:** ${cantidad}`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [successEmbed], 
          components: [] 
        });
        
      } catch (error) {
        console.error('Error al limpiar mensajes de usuario:', error);
        await interaction.editReply({
          content: '❌ Error al eliminar mensajes.',
          embeds: [],
          components: []
        }).catch(console.error);
      }
    }
    
    /**
     * Borrar mensajes de bots
     */
    static async clearBots(interaction, client, canal, cantidad) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const messages = await canal.messages.fetch({ limit: cantidad });
        const botMessages = messages.filter(m => m.author.bot);
        
        if (botMessages.size === 0) {
          return interaction.followUp({
            content: `❌ No se encontraron mensajes de bots en los últimos ${cantidad} mensajes.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Confirmación
        const confirmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Confirmar Eliminación')
          .setDescription(
            `¿Estás seguro de que quieres eliminar **${botMessages.size}** mensajes de bots en ${canal}?\n\n` +
            `⚠️ Esta acción no se puede deshacer.`
          );
        
        const buttons = this.createConfirmButtons('clear_bots');
        const confirmed = await this.waitForConfirmation(interaction, confirmEmbed, buttons);
        
        if (!confirmed) {
          return interaction.editReply({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
        
        // Borrar mensajes
        const deletedMessages = await canal.bulkDelete(botMessages, true);
        
        // Log
        await this.sendLog(
          client, 
          interaction.guild.id, 
          interaction.user, 
          canal, 
          deletedMessages.size, 
          'Limpieza de Bots'
        );
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Mensajes Eliminados')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Tipo:** Mensajes de bots\n` +
            `**Mensajes eliminados:** ${deletedMessages.size}\n` +
            `**Mensajes revisados:** ${cantidad}`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [successEmbed], 
          components: [] 
        });
        
      } catch (error) {
        console.error('Error al limpiar mensajes de bots:', error);
        await interaction.editReply({
          content: '❌ Error al eliminar mensajes.',
          embeds: [],
          components: []
        }).catch(console.error);
      }
    }
    
    /**
     * Borrar mensajes con links
     */
    static async clearLinks(interaction, client, canal, cantidad) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const messages = await canal.messages.fetch({ limit: cantidad });
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        const linkMessages = messages.filter(m => linkRegex.test(m.content));
        
        if (linkMessages.size === 0) {
          return interaction.followUp({
            content: `❌ No se encontraron mensajes con links en los últimos ${cantidad} mensajes.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Confirmación
        const confirmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Confirmar Eliminación')
          .setDescription(
            `¿Estás seguro de que quieres eliminar **${linkMessages.size}** mensajes con links en ${canal}?\n\n` +
            `⚠️ Esta acción no se puede deshacer.`
          );
        
        const buttons = this.createConfirmButtons('clear_links');
        const confirmed = await this.waitForConfirmation(interaction, confirmEmbed, buttons);
        
        if (!confirmed) {
          return interaction.editReply({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
        
        // Borrar mensajes
        const deletedMessages = await canal.bulkDelete(linkMessages, true);
        
        // Log
        await this.sendLog(
          client, 
          interaction.guild.id, 
          interaction.user, 
          canal, 
          deletedMessages.size, 
          'Limpieza de Links'
        );
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Mensajes Eliminados')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Tipo:** Mensajes con links\n` +
            `**Mensajes eliminados:** ${deletedMessages.size}\n` +
            `**Mensajes revisados:** ${cantidad}`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [successEmbed], 
          components: [] 
        });
        
      } catch (error) {
        console.error('Error al limpiar mensajes con links:', error);
        await interaction.editReply({
          content: '❌ Error al eliminar mensajes.',
          embeds: [],
          components: []
        }).catch(console.error);
      }
    }
    
    /**
     * Borrar mensajes con imágenes
     */
    static async clearImages(interaction, client, canal, cantidad) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const messages = await canal.messages.fetch({ limit: cantidad });
        const imageMessages = messages.filter(m => 
          m.attachments.size > 0 || 
          m.embeds.some(e => e.image || e.thumbnail)
        );
        
        if (imageMessages.size === 0) {
          return interaction.followUp({
            content: `❌ No se encontraron mensajes con imágenes en los últimos ${cantidad} mensajes.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Confirmación
        const confirmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Confirmar Eliminación')
          .setDescription(
            `¿Estás seguro de que quieres eliminar **${imageMessages.size}** mensajes con imágenes en ${canal}?\n\n` +
            `⚠️ Esta acción no se puede deshacer.`
          );
        
        const buttons = this.createConfirmButtons('clear_images');
        const confirmed = await this.waitForConfirmation(interaction, confirmEmbed, buttons);
        
        if (!confirmed) {
          return interaction.editReply({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
        
        // Borrar mensajes
        const deletedMessages = await canal.bulkDelete(imageMessages, true);
        
        // Log
        await this.sendLog(
          client, 
          interaction.guild.id, 
          interaction.user, 
          canal, 
          deletedMessages.size, 
          'Limpieza de Imágenes'
        );
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Mensajes Eliminados')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Tipo:** Mensajes con imágenes/archivos\n` +
            `**Mensajes eliminados:** ${deletedMessages.size}\n` +
            `**Mensajes revisados:** ${cantidad}`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [successEmbed], 
          components: [] 
        });
        
      } catch (error) {
        console.error('Error al limpiar mensajes con imágenes:', error);
        await interaction.editReply({
          content: '❌ Error al eliminar mensajes.',
          embeds: [],
          components: []
        }).catch(console.error);
      }
    }
    
    /**
     * Borrar mensajes que contengan texto específico
     */
    static async clearContains(interaction, client, canal, texto, cantidad) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const messages = await canal.messages.fetch({ limit: cantidad });
        const containsMessages = messages.filter(m => 
          m.content.toLowerCase().includes(texto.toLowerCase())
        );
        
        if (containsMessages.size === 0) {
          return interaction.followUp({
            content: `❌ No se encontraron mensajes que contengan "${texto}" en los últimos ${cantidad} mensajes.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Confirmación
        const confirmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Confirmar Eliminación')
          .setDescription(
            `¿Estás seguro de que quieres eliminar **${containsMessages.size}** mensajes que contienen "${texto}" en ${canal}?\n\n` +
            `⚠️ Esta acción no se puede deshacer.`
          );
        
        const buttons = this.createConfirmButtons('clear_contains');
        const confirmed = await this.waitForConfirmation(interaction, confirmEmbed, buttons);
        
        if (!confirmed) {
          return interaction.editReply({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
        
        // Borrar mensajes
        const deletedMessages = await canal.bulkDelete(containsMessages, true);
        
        // Log
        await this.sendLog(
          client, 
          interaction.guild.id, 
          interaction.user, 
          canal, 
          deletedMessages.size, 
          'Limpieza por Contenido',
          { 'Texto buscado': texto }
        );
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Mensajes Eliminados')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Tipo:** Mensajes que contienen "${texto}"\n` +
            `**Mensajes eliminados:** ${deletedMessages.size}\n` +
            `**Mensajes revisados:** ${cantidad}`
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [successEmbed], 
          components: [] 
        });
        
      } catch (error) {
        console.error('Error al limpiar mensajes con texto:', error);
        await interaction.editReply({
          content: '❌ Error al eliminar mensajes.',
          embeds: [],
          components: []
        }).catch(console.error);
      }
    }
    
    /**
     * Borrar mensajes entre dos IDs
     */
    static async clearBetween(interaction, client, canal, mensajeInicio, mensajeFin) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Validar IDs
        let startMsg, endMsg;
        try {
          startMsg = await canal.messages.fetch(mensajeInicio);
          endMsg = await canal.messages.fetch(mensajeFin);
        } catch (error) {
          return interaction.followUp({
            content: '❌ No se pudieron encontrar uno o ambos mensajes con los IDs proporcionados.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Asegurar que startMsg sea el más antiguo
        if (startMsg.createdTimestamp > endMsg.createdTimestamp) {
          [startMsg, endMsg] = [endMsg, startMsg];
        }
        
        // Obtener mensajes entre los dos IDs
        const messages = await canal.messages.fetch({ 
          after: startMsg.id,
          limit: 100 
        });
        
        const messagesToDelete = messages.filter(m => 
          m.createdTimestamp <= endMsg.createdTimestamp
        );
        
        if (messagesToDelete.size === 0) {
          return interaction.followUp({
            content: '❌ No se encontraron mensajes entre esos dos IDs.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Confirmación
        const confirmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Confirmar Eliminación')
          .setDescription(
            `¿Estás seguro de que quieres eliminar **${messagesToDelete.size}** mensajes entre los IDs proporcionados en ${canal}?\n\n` +
            `**Mensaje inicio:** ${startMsg.id}\n` +
            `**Mensaje fin:** ${endMsg.id}\n\n` +
            `⚠️ Esta acción no se puede deshacer.`
          );
        
        const buttons = this.createConfirmButtons('clear_between');
        const confirmed = await this.waitForConfirmation(interaction, confirmEmbed, buttons);
        
        if (!confirmed) {
          return interaction.editReply({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
        
        // Borrar mensajes
        const deletedMessages = await canal.bulkDelete(messagesToDelete, true);
        
        // Log
        await this.sendLog(
          client, 
          interaction.guild.id, 
          interaction.user, 
          canal, 
          deletedMessages.size, 
          'Limpieza entre IDs',
          { 
            'ID Inicio': mensajeInicio,
            'ID Fin': mensajeFin
          }
        );
        
        // Respuesta
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Mensajes Eliminados')
          .setDescription(
            `**Canal:** ${canal}\n` +
            `**Tipo:** Mensajes entre IDs\n` +
            `**Mensajes eliminados:** ${deletedMessages.size}\n` +
            `**ID Inicio:** \`${mensajeInicio}\`\n` +
            `**ID Fin:** \`${mensajeFin}\``
          )
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.editReply({ 
          embeds: [successEmbed], 
          components: [] 
        });
        
      } catch (error) {
        console.error('Error al limpiar mensajes entre IDs:', error);
        await interaction.editReply({
          content: '❌ Error al eliminar mensajes.',
          embeds: [],
          components: []
        }).catch(console.error);
      }
    }
    
    /**
     * Maneja los botones de confirmación
     */
    static async handleButton(interaction, client, action, params) {
      if (action === 'all' || action === 'user' || action === 'bots' || 
          action === 'links' || action === 'images' || action === 'contains' || 
          action === 'between') {
        
        if (params[0] === 'confirm') {
          // La confirmación ya fue manejada en waitForConfirmation
          await interaction.update({ 
            content: '⏳ Procesando...', 
            embeds: [], 
            components: [] 
          });
        } else if (params[0] === 'cancel') {
          await interaction.update({ 
            content: '❌ Operación cancelada.', 
            embeds: [], 
            components: [] 
          });
        }
      }
    }
  }
  
  module.exports = ClearManager;