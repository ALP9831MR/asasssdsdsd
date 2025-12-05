// ========================================
// 📁 systems/moderation/modpanelManager.js
// ========================================

const { 
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

class ModPanelManager {
  
  /**
   * Maneja los botones del panel
   */
  static async handleButton(interaction, client, action, params) {
    const userId = params[0];
    
    try {
      if (action === 'warn') {
        const modal = new ModalBuilder()
          .setCustomId(`modpanel_warn_submit_${userId}`)
          .setTitle('Advertir Usuario');
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Razón de la advertencia')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escribe la razón aquí...')
          .setRequired(true)
          .setMaxLength(500);
        
        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
      }
      else if (action === 'timeout') {
        const modal = new ModalBuilder()
          .setCustomId(`modpanel_timeout_submit_${userId}`)
          .setTitle('Timeout Usuario');
        
        const durationInput = new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duración (ej: 5m, 1h, 1d)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('5m')
          .setRequired(true)
          .setMaxLength(10);
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Razón del timeout')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escribe la razón aquí...')
          .setRequired(true)
          .setMaxLength(500);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(durationInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );
        
        await interaction.showModal(modal);
      }
      else if (action === 'kick') {
        const modal = new ModalBuilder()
          .setCustomId(`modpanel_kick_submit_${userId}`)
          .setTitle('Kick Usuario');
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Razón del kick')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escribe la razón aquí...')
          .setRequired(true)
          .setMaxLength(500);
        
        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
      }
      else if (action === 'ban') {
        const modal = new ModalBuilder()
          .setCustomId(`modpanel_ban_submit_${userId}`)
          .setTitle('Banear Usuario');
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Razón del ban')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escribe la razón aquí...')
          .setRequired(true)
          .setMaxLength(500);
        
        const daysInput = new TextInputBuilder()
          .setCustomId('days')
          .setLabel('Días de mensajes a borrar (0-7)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('7')
          .setValue('7')
          .setRequired(false)
          .setMaxLength(1);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(reasonInput),
          new ActionRowBuilder().addComponents(daysInput)
        );
        
        await interaction.showModal(modal);
      }
      else if (action === 'clearwarns') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const WarnManager = require('./warnManager');
        const user = await client.users.fetch(userId);
        
        const data = WarnManager.loadData();
        const guildId = interaction.guild.id;
        
        if (data.guilds[guildId] && data.guilds[guildId][userId]) {
          const activeWarns = data.guilds[guildId][userId].warns.filter(w => w.active).length;
          
          if (activeWarns === 0) {
            return interaction.followUp({
              content: '❌ Este usuario no tiene advertencias activas.',
              flags: MessageFlags.Ephemeral
            });
          }
          
          data.guilds[guildId][userId].warns.forEach(warn => {
            if (warn.active) {
              warn.active = false;
              warn.removedBy = interaction.user.id;
              warn.removedAt = new Date().toISOString();
            }
          });
          
          WarnManager.saveData(data);
          
          await interaction.followUp({
            content: `✅ Se limpiaron **${activeWarns}** advertencia(s) de ${user.tag}`,
            flags: MessageFlags.Ephemeral
          });
        } else {
          await interaction.followUp({
            content: '❌ Este usuario no tiene advertencias.',
            flags: MessageFlags.Ephemeral
          });
        }
      }
      else if (action === 'untimeout') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const member = await interaction.guild.members.fetch(userId);
        
        if (member.isCommunicationDisabled()) {
          await member.timeout(null, `Timeout removido por ${interaction.user.tag} via ModPanel`);
          
          await interaction.followUp({
            content: `✅ Se quitó el timeout de ${member.user.tag}`,
            flags: MessageFlags.Ephemeral
          });
        } else {
          await interaction.followUp({
            content: '❌ Este usuario no tiene timeout activo.',
            flags: MessageFlags.Ephemeral
          });
        }
      }
      else if (action === 'refresh') {
        await interaction.deferUpdate();
        
        const usuario = await client.users.fetch(userId);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
          return interaction.followUp({
            content: '❌ No se pudo encontrar al usuario.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Cargar datos actualizados
        const WarnManager = require('./warnManager');
        const TimeoutManager = require('./timeoutManager');
        const TempBanManager = require('./tempbanManager');
        const NotesManager = require('./notesManager');
        
        const warnData = WarnManager.loadData();
        const timeoutData = TimeoutManager.loadData();
        const tempbanData = TempBanManager.loadData();
        const notesData = NotesManager.loadData();
        
        const guildId = interaction.guild.id;
        
        const warns = warnData.guilds[guildId]?.[userId]?.warns?.filter(w => w.active) || [];
        const timeouts = timeoutData.guilds[guildId]?.[userId]?.history || [];
        const tempbans = tempbanData.guilds[guildId]?.[userId]?.history || [];
        const notes = notesData.guilds[guildId]?.[userId]?.notes || [];
        
        const activeTimeouts = timeouts.filter(t => t.active).length;
        const activeTempbans = tempbans.filter(t => t.active).length;
        const isTimedOut = member.isCommunicationDisabled();
        const isBanned = await interaction.guild.bans.fetch(userId).catch(() => null);
        
        const updatedEmbed = new EmbedBuilder()
          .setColor(warns.length >= 3 ? '#FF0000' : warns.length >= 1 ? '#FFA500' : '#5865F2')
          .setTitle(`👮 Panel de Moderación`)
          .setDescription(
            `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
            `**ID:** \`${userId}\`\n` +
            `**Estado:** ${isBanned ? '🔨 Baneado' : isTimedOut ? '⏱️ En Timeout' : '✅ Activo'}\n\n` +
            `**📊 Resumen de Infracciones:**`
          )
          .addFields(
            { name: '⚠️ Warns Activos', value: `${warns.length}`, inline: true },
            { name: '⏱️ Timeouts', value: `${timeouts.length} (${activeTimeouts} activos)`, inline: true },
            { name: '🔨 TempBans', value: `${tempbans.length} (${activeTempbans} activos)`, inline: true },
            { name: '📝 Notas', value: `${notes.length}`, inline: true },
            { name: '📅 Cuenta Creada', value: `<t:${Math.floor(usuario.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '📅 Se Unió', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }
          )
          .setThumbnail(usuario.displayAvatarURL())
          .setFooter({ text: `Moderador: ${interaction.user.tag}` })
          .setTimestamp();
        
        // Reconstruir menú de selección
        const actionMenu = new StringSelectMenuBuilder()
          .setCustomId(`modpanel_action_${userId}`)
          .setPlaceholder('⚡ Selecciona una acción rápida')
          .addOptions([
            {
              label: 'Ver Warns',
              description: 'Ver todas las advertencias del usuario',
              value: 'view_warns',
              emoji: '⚠️'
            },
            {
              label: 'Ver Notas',
              description: 'Ver notas privadas del usuario',
              value: 'view_notes',
              emoji: '📝'
            },
            {
              label: 'Ver Historial Timeout',
              description: 'Ver historial de timeouts',
              value: 'view_timeouts',
              emoji: '⏱️'
            },
            {
              label: 'Ver Historial TempBan',
              description: 'Ver historial de bans temporales',
              value: 'view_tempbans',
              emoji: '🔨'
            },
            {
              label: 'Agregar Nota',
              description: 'Agregar una nota privada',
              value: 'add_note',
              emoji: '➕'
            }
          ]);
        
        // Reconstruir botones
        const row1 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`modpanel_warn_${userId}`)
              .setLabel('Advertir')
              .setEmoji('⚠️')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`modpanel_timeout_${userId}`)
              .setLabel('Timeout')
              .setEmoji('⏱️')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`modpanel_kick_${userId}`)
              .setLabel('Kick')
              .setEmoji('👢')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`modpanel_ban_${userId}`)
              .setLabel('Ban')
              .setEmoji('🔨')
              .setStyle(ButtonStyle.Danger)
          );
        
        const row2 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`modpanel_clearwarns_${userId}`)
              .setLabel('Limpiar Warns')
              .setEmoji('🗑️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(warns.length === 0),
            new ButtonBuilder()
              .setCustomId(`modpanel_untimeout_${userId}`)
              .setLabel('Quitar Timeout')
              .setEmoji('🔓')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!isTimedOut),
            new ButtonBuilder()
              .setCustomId(`modpanel_refresh_${userId}`)
              .setLabel('Actualizar')
              .setEmoji('🔄')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`modpanel_close`)
              .setLabel('Cerrar')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Secondary)
          );
        
        const row3 = new ActionRowBuilder().addComponents(actionMenu);
        
        await interaction.editReply({
          embeds: [updatedEmbed],
          components: [row1, row2, row3]
        });
      }
      else if (action === 'close') {
        await interaction.update({
          content: '✅ Panel cerrado.',
          embeds: [],
          components: []
        });
      }
      
    } catch (error) {
      console.error('Error en handleButton de modpanel:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Error al procesar la acción.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      } else {
        await interaction.followUp({
          content: '❌ Error al procesar la acción.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  }
  
  /**
   * Maneja los menús de selección
   */
  static async handleSelectMenu(interaction, client, action, params) {
    const userId = params[0];
    const selected = interaction.values[0];
    
    try {
      const usuario = await client.users.fetch(userId);
      
      // Para "add_note" mostramos el modal SIN defer
      if (selected === 'add_note') {
        const modal = new ModalBuilder()
          .setCustomId(`modpanel_note_submit_${userId}`)
          .setTitle('Agregar Nota');
        
        const noteInput = new TextInputBuilder()
          .setCustomId('note')
          .setLabel('Contenido de la nota')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escribe la nota aquí...')
          .setRequired(true)
          .setMaxLength(1000);
        
        const categoryInput = new TextInputBuilder()
          .setCustomId('category')
          .setLabel('Categoría')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('general, advertencia, sospecha, etc.')
          .setValue('general')
          .setRequired(false)
          .setMaxLength(50);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(noteInput),
          new ActionRowBuilder().addComponents(categoryInput)
        );
        
        return await interaction.showModal(modal);
      }
      
      // Para el resto NO hacemos defer, los managers lo harán
      if (selected === 'view_warns') {
        const WarnManager = require('./warnManager');
        // NO hacer deferReply aquí, listWarns lo hace
        await WarnManager.listWarns(interaction, client, usuario);
      }
      else if (selected === 'view_notes') {
        const NotesManager = require('./notesManager');
        // Verificar si viewNotes hace deferReply internamente
        await NotesManager.viewNotes(interaction, client, usuario, null);
      }
      else if (selected === 'view_timeouts') {
        const TimeoutManager = require('./timeoutManager');
        await TimeoutManager.showHistory(interaction, client, usuario);
      }
      else if (selected === 'view_tempbans') {
        const TempBanManager = require('./tempbanManager');
        await TempBanManager.showHistory(interaction, client, usuario);
      }
      
    } catch (error) {
      console.error('Error en handleSelectMenu de modpanel:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Error al procesar la selección.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      } else {
        await interaction.followUp({
          content: '❌ Error al procesar la selección.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  }
  
  /**
   * Maneja los modales enviados
   */
  static async handleModalSubmit(interaction, client, action, params) {
    const userId = params[1];
    
    try {
      const usuario = await client.users.fetch(userId);
      
      if (action === 'warn' && params[0] === 'submit') {
        const reason = interaction.fields.getTextInputValue('reason');
        const WarnManager = require('./warnManager');
        
        // NO hacer deferReply, addWarn lo hace internamente
        await WarnManager.addWarn(interaction, client, usuario, reason, true);
      }
      else if (action === 'timeout' && params[0] === 'submit') {
        const duration = interaction.fields.getTextInputValue('duration');
        const reason = interaction.fields.getTextInputValue('reason');
        const TimeoutManager = require('./timeoutManager');
        
        // NO hacer deferReply, addTimeout lo hace internamente
        await TimeoutManager.addTimeout(interaction, client, usuario, duration, reason);
      }
      else if (action === 'kick' && params[0] === 'submit') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const reason = interaction.fields.getTextInputValue('reason');
        const member = await interaction.guild.members.fetch(userId);
        
        if (!member.kickable) {
          return interaction.followUp({
            content: '❌ No puedo kickear a este usuario (permisos insuficientes o rol superior).',
            flags: MessageFlags.Ephemeral
          });
        }
        
        await member.kick(reason);
        
        await interaction.followUp({
          content: `✅ ${usuario.tag} ha sido kickeado.\n**Razón:** ${reason}`,
          flags: MessageFlags.Ephemeral
        });
      }
      else if (action === 'ban' && params[0] === 'submit') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const reason = interaction.fields.getTextInputValue('reason');
        const daysInput = interaction.fields.getTextInputValue('days') || '7';
        const days = parseInt(daysInput);
        
        if (isNaN(days) || days < 0 || days > 7) {
          return interaction.followUp({
            content: '❌ Los días deben ser un número entre 0 y 7.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && !member.bannable) {
          return interaction.followUp({
            content: '❌ No puedo banear a este usuario (permisos insuficientes o rol superior).',
            flags: MessageFlags.Ephemeral
          });
        }
        
        await interaction.guild.members.ban(userId, {
          reason: reason,
          deleteMessageSeconds: days * 24 * 60 * 60
        });
        
        await interaction.followUp({
          content: `✅ ${usuario.tag} ha sido baneado.\n**Razón:** ${reason}\n**Mensajes borrados:** Últimos ${days} día(s)`,
          flags: MessageFlags.Ephemeral
        });
      }
      else if (action === 'note' && params[0] === 'submit') {
        const note = interaction.fields.getTextInputValue('note');
        const category = interaction.fields.getTextInputValue('category') || 'general';
        const NotesManager = require('./notesManager');
        
        // NO hacer deferReply, addNote lo hace internamente
        await NotesManager.addNote(interaction, client, usuario, note, category);
      }
      
    } catch (error) {
      console.error('Error en handleModalSubmit de modpanel:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Error al procesar el formulario: ' + error.message,
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      } else {
        await interaction.followUp({
          content: '❌ Error al procesar el formulario: ' + error.message,
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  }
}

module.exports = ModPanelManager;