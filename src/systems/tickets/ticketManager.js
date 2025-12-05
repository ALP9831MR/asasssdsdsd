//ticketManager.js

const { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  StringSelectMenuBuilder,
  Collection,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

class TicketManager {
  static activeTickets = new Collection();
  static userCooldowns = new Collection();
  static ticketCount = 0;

  /**
   * Reemplaza variables en texto
   */
  static replaceVariables(text, variables = {}) {
    return text
      .replace(/{user}/g, variables.user || '')
      .replace(/{server}/g, variables.server || '')
      .replace(/{memberCount}/g, variables.memberCount || '');
  }

  /**
   * Crea un panel de tickets personalizable
   */
  static async createTicketPanel(interaction, client) {
    try {
      if (!client.config.systems.tickets.categoryId || !client.config.systems.tickets.supportRoleId) {
        return interaction.reply({
          content: '⚠️ El sistema de tickets no está completamente configurado. Usa `/ticket setup` primero.',
          flags: MessageFlags.Ephemeral
        });
      }

      const ticketCategories = client.config.systems.tickets.categories || [];
      const texts = client.config.systems.tickets.texts || {};
      
      if (ticketCategories.length === 0) {
        return interaction.reply({
          content: '⚠️ No hay categorías de tickets configuradas. Usa `/ticket categoria agregar` para crear una.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Preparar variables
      const variables = {
        server: interaction.guild.name,
        memberCount: interaction.guild.memberCount
      };

      // Crear embed con textos personalizados
      const embed = new EmbedBuilder()
        .setColor(client.config.embedColors.primary)
        .setTitle(texts.panel?.title || '🎫 Centro de Atención al Usuario')
        .setDescription(this.replaceVariables(
          texts.panel?.description || 
          '¿Necesitas ayuda? ¡Estamos aquí para asistirte! Selecciona una categoría que mejor se adapte a tu consulta y un miembro de nuestro equipo te atenderá lo antes posible.',
          variables
        ))
        .addFields(
          { 
            name: '📋 Categorías Disponibles', 
            value: ticketCategories.map(c => `${c.emoji} **${c.label}:** ${c.description}`).join('\n\n') 
          },
          {
            name: '⏱️ Tiempo de Respuesta',
            value: this.replaceVariables(
              texts.panel?.responseTime || 
              'Nuestro equipo de soporte responderá a tu ticket tan pronto como sea posible, generalmente en un plazo de 24 horas.',
              variables
            )
          }
        )
        .setTimestamp()
        .setFooter({ 
          text: this.replaceVariables(
            texts.panel?.footer || '{server} • Sistema de Soporte',
            variables
          ), 
          iconURL: interaction.guild.iconURL() 
        });

      // Agregar imagen si está configurada
      if (texts.panel?.image) {
        embed.setImage(texts.panel.image);
      }

      // Crear botón personalizado
      const buttonText = texts.button?.text || 'Crear Ticket';
      const buttonEmoji = texts.button?.emoji || '🎫';

      const openTicketButton = new ButtonBuilder()
        .setCustomId('ticket_open')
        .setLabel(buttonText)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(buttonEmoji);

      const row = new ActionRowBuilder().addComponents(openTicketButton);

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.error('Error al crear panel de tickets:', error);
      await interaction.reply({
        content: '❌ Ha ocurrido un error al crear el panel de tickets.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  /**
   * Maneja las interacciones de botones relacionadas con tickets
   */
  static async handleButton(interaction, client, action, params = []) {
    try {
      switch (action) {
        case 'open':
          await this.handleOpenTicket(interaction, client);
          break;
        case 'close':
          await this.handleCloseTicket(interaction, client);
          break;
        case 'delete':
          await this.handleDeleteTicket(interaction, client);
          break;
        case 'transcript':
          await this.handleTicketTranscript(interaction, client);
          break;
        case 'claim':
          await this.handleClaimTicket(interaction, client);
          break;
        case 'reopen':
          await this.handleReopenTicket(interaction, client);
          break;
        case 'priority':
          await this.handlePriorityChange(interaction, client, params[0]);
          break;
        default:
          await interaction.reply({
            content: '❌ Acción no reconocida.',
            flags: MessageFlags.Ephemeral
          });
      }
    } catch (error) {
      console.error(`Error al manejar botón de ticket (${action}):`, error);
      await interaction.reply({
        content: `❌ Ha ocurrido un error al procesar la acción: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  /**
   * Maneja la apertura de un nuevo ticket
   */
  static async handleOpenTicket(interaction, client) {
    try {
      const userId = interaction.user.id;
      const now = Date.now();
      const cooldownTime = 60 * 1000;
      
      if (this.userCooldowns.has(userId)) {
        const expirationTime = this.userCooldowns.get(userId) + cooldownTime;
        
        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          return interaction.reply({
            content: `⏳ Por favor espera ${timeLeft.toFixed(1)} segundos antes de crear otro ticket.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }
      
      const existingTicket = interaction.guild.channels.cache.find(
        c => c.name.includes(`ticket-${interaction.user.id.substring(interaction.user.id.length - 4)}`) && 
             c.parentId === client.config.systems.tickets.categoryId
      );
      
      if (existingTicket) {
        return interaction.reply({
          content: `❌ Ya tienes un ticket abierto: ${existingTicket}`,
          flags: MessageFlags.Ephemeral
        });
      }

      const ticketCategories = client.config.systems.tickets.categories || [];
      
      if (ticketCategories.length === 0) {
        return interaction.reply({
          content: '❌ No hay categorías de tickets disponibles. Contacta con un administrador.',
          flags: MessageFlags.Ephemeral
        });
      }

      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('📋 Selecciona una categoría para tu ticket')
        .addOptions(ticketCategories.map(category => ({
          label: category.label,
          value: category.id,
          description: category.description.length > 100 ? category.description.substring(0, 97) + '...' : category.description,
          emoji: category.emoji
        })));

      const row = new ActionRowBuilder().addComponents(categorySelect);

      const selectEmbed = new EmbedBuilder()
        .setColor(client.config.embedColors.primary)
        .setTitle('🎫 Selección de Categoría')
        .setDescription('Por favor, selecciona la categoría que mejor se adapte a tu consulta:')
        .addFields(
          { 
            name: '📋 Categorías Disponibles', 
            value: ticketCategories.map(c => `${c.emoji} **${c.label}:** ${c.description}`).join('\n\n') 
          }
        )
        .setFooter({ text: 'Tu ticket será atendido por nuestro equipo de soporte', iconURL: interaction.guild.iconURL() });

      await interaction.reply({
        embeds: [selectEmbed],
        components: [row],
        flags: MessageFlags.Ephemeral
      });
      
      this.userCooldowns.set(userId, now);
      setTimeout(() => this.userCooldowns.delete(userId), cooldownTime);
    } catch (error) {
      console.error('Error al abrir selector de categoría de ticket:', error);
      await interaction.reply({
        content: '❌ Ha ocurrido un error al abrir el selector de tickets.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Maneja la selección de categoría para un ticket
   */
  static async handleCategorySelect(interaction, client) {
    try {
      const category = interaction.values[0];
      const ticketCategories = client.config.systems.tickets.categories || [];
      const selectedCategory = ticketCategories.find(c => c.id === category) || ticketCategories[0];
      
      if (!selectedCategory) {
        return interaction.reply({
          content: '❌ Categoría no válida.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const modal = new ModalBuilder()
        .setCustomId(`ticket_create_${category}`)
        .setTitle(`Crear Ticket: ${selectedCategory.label}`);

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticketSubject')
        .setLabel('Asunto del ticket')
        .setPlaceholder(`Ejemplo: ${selectedCategory.id === 'comprar' ? 'Quiero comprar VIP Gold' : selectedCategory.id === 'soporte' ? 'Problema al iniciar el juego' : 'Consulta sobre reglas del servidor'}`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('ticketDescription')
        .setLabel('Describe tu consulta en detalle')
        .setPlaceholder(`${selectedCategory.id === 'comprar' ? 'Indica qué quieres comprar, método de pago preferido, etc.' : 'Proporciona todos los detalles que puedas sobre tu consulta...'}`)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const firstRow = new ActionRowBuilder().addComponents(subjectInput);
      const secondRow = new ActionRowBuilder().addComponents(descriptionInput);

      modal.addComponents(firstRow, secondRow);
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error al procesar selección de categoría:', error);
      await interaction.reply({
        content: '❌ Ha ocurrido un error al procesar la categoría seleccionada.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  /**
   * Maneja el envío del modal para crear un ticket
   */
  static async handleModalSubmit(interaction, client, action, params) {
    try {
      if (action === 'create') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const subject = interaction.fields.getTextInputValue('ticketSubject');
        const description = interaction.fields.getTextInputValue('ticketDescription');
        const category = interaction.customId.split('_')[2] || 'general';
        
        this.ticketCount = (this.ticketCount || 0) + 1;
        const ticketId = `${this.ticketCount.toString().padStart(4, '0')}`;
        const channelName = `ticket-${ticketId}-${interaction.user.id.substring(interaction.user.id.length - 4)}`;
        
        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: client.config.systems.tickets.categoryId,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: client.config.systems.tickets.supportRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels
              ]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels
              ]
            }
          ]
        });
        
        const categoryData = (client.config.systems.tickets.categories || []).find(c => c.id === category) || 
                             { emoji: '🎫', label: 'General' };
        
        const ticketEmbed = new EmbedBuilder()
          .setColor(client.config.embedColors.primary)
          .setTitle(`${categoryData.emoji} Ticket #${ticketId}: ${subject}`)
          .setDescription(`**Creado por:** ${interaction.user}
**Categoría:** ${categoryData.label}
**Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>
**Estado:** 🟢 Abierto

**Descripción:**
${description}`)
          .setFooter({ text: `ID: ${interaction.user.id}`, iconURL: interaction.user.displayAvatarURL() });
        
        const closeButton = new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Cerrar Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒');
        
        const claimButton = new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Asignarme este Ticket')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👤');

        const priorityButton = new ButtonBuilder()
          .setCustomId('ticket_priority_normal')
          .setLabel('Prioridad: Normal')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔵');
        
        const row = new ActionRowBuilder().addComponents(closeButton, claimButton, priorityButton);
        
        // Mensaje de bienvenida personalizado
        const texts = client.config.systems.tickets.texts || {};
        const welcomeMsg = this.replaceVariables(
          texts.welcome || '¡Hola {user}! Gracias por crear un ticket. Un miembro del equipo te atenderá pronto.',
          { user: interaction.user.toString() }
        );
        
        const ticketMessage = await ticketChannel.send({
          content: `${interaction.user} | <@&${client.config.systems.tickets.supportRoleId}>`,
          embeds: [ticketEmbed],
          components: [row]
        });
        
        // Enviar mensaje de bienvenida si está configurado
        if (welcomeMsg && welcomeMsg !== '') {
          await ticketChannel.send({ content: welcomeMsg });
        }
        
        this.activeTickets.set(ticketChannel.id, {
          id: ticketId,
          userId: interaction.user.id,
          channelId: ticketChannel.id,
          subject: subject,
          category: category,
          status: 'open',
          createdAt: Date.now(),
          messageId: ticketMessage.id,
          priority: 'normal',
          assignedTo: null
        });
        
        if (client.config.systems.tickets.logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(client.config.systems.tickets.logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor(client.config.embedColors.success)
              .setTitle('Nuevo Ticket Creado')
              .setDescription(`**Ticket:** #${ticketId}
**Asunto:** ${subject}
**Categoría:** ${categoryData.label}
**Creado por:** ${interaction.user.tag} (${interaction.user.id})
**Canal:** ${ticketChannel}`)
              .setTimestamp();
            
            logChannel.send({ embeds: [logEmbed] }).catch(console.error);
          }
        }
        
        await interaction.followUp({
          content: `✅ Tu ticket #${ticketId} ha sido creado: ${ticketChannel}`,
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      console.error(`Error al procesar modal de ticket (${action}):`, error);
      await interaction.followUp({
        content: `❌ Ha ocurrido un error al crear el ticket: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  // ... [El resto de los métodos se mantienen igual: handleCloseTicket, handleReopenTicket, 
  // handleDeleteTicket, handleTicketTranscript, handleClaimTicket, handlePriorityChange, handleSelectMenu]
  
  static async handleCloseTicket(interaction, client) {
    try {
      await interaction.deferReply();
      
      if (!interaction.channel.name.startsWith('ticket-')) {
        return interaction.followUp({
          content: '❌ Este canal no es un ticket.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const ticketData = this.activeTickets.get(interaction.channel.id);
      if (!ticketData) {
        return interaction.followUp({
          content: '❌ No se encontró información sobre este ticket en la base de datos.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      ticketData.status = 'closed';
      ticketData.closedAt = Date.now();
      ticketData.closedBy = interaction.user.id;
      this.activeTickets.set(interaction.channel.id, ticketData);
      
      const deleteButton = new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Eliminar Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');
      
      const transcriptButton = new ButtonBuilder()
        .setCustomId('ticket_transcript')
        .setLabel('Guardar Transcripción')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝');

      const reopenButton = new ButtonBuilder()
        .setCustomId('ticket_reopen')
        .setLabel('Reabrir Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔓');
      
      const row = new ActionRowBuilder().addComponents(deleteButton, transcriptButton, reopenButton);
      
      const closeEmbed = new EmbedBuilder()
        .setColor(client.config.embedColors.warning)
        .setTitle(`Ticket #${ticketData.id} Cerrado`)
        .setDescription(`Este ticket ha sido cerrado por ${interaction.user}.
        
Puedes eliminar el ticket, guardar una transcripción o reabrirlo si es necesario.`)
        .setTimestamp();
      
      await interaction.channel.setName(`cerrado-${interaction.channel.name.slice(7)}`);
      
      if (ticketData.userId) {
        await interaction.channel.permissionOverwrites.edit(ticketData.userId, {
          SendMessages: false
        });
      }
      
      if (client.config.systems.tickets.logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(client.config.systems.tickets.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(client.config.embedColors.warning)
            .setTitle('Ticket Cerrado')
            .setDescription(`**Ticket:** #${ticketData.id}
**Asunto:** ${ticketData.subject}
**Cerrado por:** ${interaction.user.tag} (${interaction.user.id})
**Canal:** ${interaction.channel}`)
            .setTimestamp();
          
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        }
      }
      
      await interaction.followUp({
        embeds: [closeEmbed],
        components: [row]
      });
    } catch (error) {
      console.error('Error al cerrar ticket:', error);
      await interaction.followUp({
        content: `❌ Ha ocurrido un error al cerrar el ticket: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  static async handleReopenTicket(interaction, client) {
    try {
      await interaction.deferReply();
      
      if (!interaction.channel.name.startsWith('cerrado-')) {
        return interaction.followUp({
          content: '❌ Este canal no es un ticket cerrado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const ticketData = this.activeTickets.get(interaction.channel.id);
      if (!ticketData) {
        return interaction.followUp({
          content: '❌ No se encontró información sobre este ticket en la base de datos.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      ticketData.status = 'open';
      ticketData.reopenedAt = Date.now();
      ticketData.reopenedBy = interaction.user.id;
      this.activeTickets.set(interaction.channel.id, ticketData);
      
      await interaction.channel.setName(`ticket-${interaction.channel.name.slice(8)}`);
      
      if (ticketData.userId) {
        await interaction.channel.permissionOverwrites.edit(ticketData.userId, {
          SendMessages: true,
          ViewChannel: true,
          ReadMessageHistory: true
        });
      }
      
      const closeButton = new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Cerrar Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒');
      
      const claimButton = new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Asignarme este Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👤');

      const priorityButton = new ButtonBuilder()
        .setCustomId(`ticket_priority_${ticketData.priority || 'normal'}`)
        .setLabel(`Prioridad: ${ticketData.priority ? ticketData.priority.charAt(0).toUpperCase() + ticketData.priority.slice(1) : 'Normal'}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(ticketData.priority === 'high' ? '🔴' : (ticketData.priority === 'low' ? '🟢' : '🔵'));
      
      const row = new ActionRowBuilder().addComponents(closeButton, claimButton, priorityButton);
      
      const reopenEmbed = new EmbedBuilder()
        .setColor(client.config.embedColors.success)
        .setTitle(`Ticket #${ticketData.id} Reabierto`)
        .setDescription(`Este ticket ha sido reabierto por ${interaction.user}.
        
El ticket está ahora activo de nuevo y el usuario puede enviar mensajes.`)
        .setTimestamp();
      
      if (client.config.systems.tickets.logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(client.config.systems.tickets.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(client.config.embedColors.success)
            .setTitle('Ticket Reabierto')
            .setDescription(`**Ticket:** #${ticketData.id}
**Asunto:** ${ticketData.subject}
**Reabierto por:** ${interaction.user.tag} (${interaction.user.id})
**Canal:** ${interaction.channel}`)
            .setTimestamp();
          
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        }
      }
      
      await interaction.followUp({
        embeds: [reopenEmbed],
        components: [row]
      });
      
      if (ticketData.userId) {
        const creator = await interaction.guild.members.fetch(ticketData.userId).catch(() => null);
        if (creator) {
          try {
            await creator.send({
              content: `📣 Tu ticket #${ticketData.id} ha sido reabierto por un miembro del staff. Ahora puedes responder nuevamente en ${interaction.channel}.`
            });
          } catch (dmError) {
            console.log(`No se pudo enviar DM al creador del ticket: ${dmError.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Error al reabrir ticket:', error);
      await interaction.followUp({
        content: `❌ Ha ocurrido un error al reabrir el ticket: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  static async handleDeleteTicket(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      if (!interaction.channel.name.startsWith('ticket-') && !interaction.channel.name.startsWith('cerrado-')) {
        return interaction.followUp({
          content: '❌ Este canal no es un ticket.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const ticketData = this.activeTickets.get(interaction.channel.id);
      
      if (client.config.systems.tickets.logChannelId && ticketData) {
        const logChannel = interaction.guild.channels.cache.get(client.config.systems.tickets.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(client.config.embedColors.error)
            .setTitle('Ticket Eliminado')
            .setDescription(`**Ticket:** #${ticketData.id}
**Asunto:** ${ticketData.subject}
**Eliminado por:** ${interaction.user.tag} (${interaction.user.id})
**Canal:** ${interaction.channel.name}`)
            .setTimestamp();
          
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        }
      }
      
      if (ticketData) {
        this.activeTickets.delete(interaction.channel.id);
      }
      
      await interaction.followUp({
        content: `✅ Este ticket será eliminado en 5 segundos...`,
        flags: MessageFlags.Ephemeral
      });
      
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error('Error al eliminar canal de ticket:', error);
        }
      }, 5000);
    } catch (error) {
      console.error('Error al eliminar ticket:', error);
      await interaction.followUp({
        content: `❌ Ha ocurrido un error al eliminar el ticket: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  static async handleTicketTranscript(interaction, client) {
    try {
      await interaction.deferReply();
      
      if (!interaction.channel.name.startsWith('ticket-') && !interaction.channel.name.startsWith('cerrado-')) {
        return interaction.followUp({
          content: '❌ Este canal no es un ticket.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const ticketData = this.activeTickets.get(interaction.channel.id);
      if (!ticketData) {
        return interaction.followUp({
          content: '❌ No se encontró información sobre este ticket en la base de datos.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      
      let transcriptContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcripción Ticket #${ticketData.id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background-color: #5865F2; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .message { border-bottom: 1px solid #eee; padding: 10px 0; }
    .author { font-weight: bold; }
    .timestamp { color: #777; font-size: 0.8em; }
    .content { margin-top: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transcripción del Ticket #${ticketData.id}</h1>
    <p><strong>Asunto:</strong> ${ticketData.subject}</p>
    <p><strong>Categoría:</strong> ${ticketData.category}</p>
    <p><strong>Fecha de creación:</strong> ${new Date(ticketData.createdAt).toLocaleString()}</p>
  </div>
  <div class="messages">
`;
      
      const orderedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      
      for (const message of orderedMessages) {
        if (message.author.bot && message.embeds.length > 0) {
          transcriptContent += `
    <div class="message">
      <div class="author">${message.author.tag} (Bot)</div>
      <div class="timestamp">${message.createdAt.toLocaleString()}</div>
      <div class="content"><em>Embed: ${message.embeds[0].title || 'Sin título'}</em></div>
    </div>`;
        } else if (!message.author.bot) {
          transcriptContent += `
    <div class="message">
      <div class="author">${message.author.tag} (${message.author.id})</div>
      <div class="timestamp">${message.createdAt.toLocaleString()}</div>
      <div class="content">${message.content || 'Sin contenido'}</div>
    </div>`;
        }
      }
      
      transcriptContent += `
  </div>
  <div class="footer">
    <p>Transcripción generada el ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
      
      const transcriptsDir = path.join(process.cwd(), 'transcripts');
      await fs.mkdir(transcriptsDir, { recursive: true });
      
      const fileName = `ticket-${ticketData.id}-${Date.now()}.html`;
      const filePath = path.join(transcriptsDir, fileName);
      await fs.writeFile(filePath, transcriptContent, 'utf-8');
      
      const attachment = new AttachmentBuilder(filePath, { name: fileName });
      
      await interaction.followUp({
        content: `✅ Transcripción del ticket #${ticketData.id} generada con éxito.`,
        files: [attachment]
      });
      
      if (client.config.systems.tickets.logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(client.config.systems.tickets.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(client.config.embedColors.info)
            .setTitle('Transcripción de Ticket Generada')
            .setDescription(`**Ticket:** #${ticketData.id}
**Asunto:** ${ticketData.subject}
**Generada por:** ${interaction.user.tag} (${interaction.user.id})`)
            .setTimestamp();
          
          await logChannel.send({
            embeds: [logEmbed],
            files: [attachment]
          }).catch(console.error);
        }
      }
    } catch (error) {
      console.error('Error al generar transcripción de ticket:', error);
      await interaction.followUp({
        content: `❌ Ha ocurrido un error al generar la transcripción: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  static async handleClaimTicket(interaction, client) {
    try {
      await interaction.deferReply();
      
      if (!interaction.channel.name.startsWith('ticket-')) {
        return interaction.followUp({
          content: '❌ Este canal no es un ticket.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const hasSupportRole = interaction.member.roles.cache.has(client.config.systems.tickets.supportRoleId);
      if (!hasSupportRole) {
        return interaction.followUp({
          content: '❌ Solo los miembros del equipo de soporte pueden asignarse tickets.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const ticketData = this.activeTickets.get(interaction.channel.id);
      if (!ticketData) {
        return interaction.followUp({
          content: '❌ No se encontró información sobre este ticket en la base de datos.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (ticketData.assignedTo) {
        const assignee = await interaction.guild.members.fetch(ticketData.assignedTo).catch(() => null);
        if (assignee && assignee.id !== interaction.user.id) {
          return interaction.followUp({
            content: `❌ Este ticket ya está asignado a ${assignee}.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }
      
      ticketData.assignedTo = interaction.user.id;
      this.activeTickets.set(interaction.channel.id, ticketData);
      
      const claimEmbed = new EmbedBuilder()
        .setColor(client.config.embedColors.success)
        .setTitle(`Ticket #${ticketData.id} Asignado`)
        .setDescription(`Este ticket ha sido asignado a ${interaction.user}.
        
${interaction.user} ahora se encargará de resolver este ticket.`)
        .setTimestamp();
      
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const ticketMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes(`Ticket #${ticketData.id}`));
        
        if (ticketMessage) {
          const oldEmbed = ticketMessage.embeds[0];
          const newEmbed = EmbedBuilder.from(oldEmbed)
            .setDescription(oldEmbed.description.replace(/\*\*Estado:\*\* .+/, `**Estado:** 🟡 En progreso\n**Asignado a:** ${interaction.user}`));
          
          await ticketMessage.edit({ embeds: [newEmbed] });
        }
      } catch (error) {
        console.error('Error al actualizar mensaje de ticket:', error);
      }
      
      if (client.config.systems.tickets.logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(client.config.systems.tickets.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(client.config.embedColors.info)
            .setTitle('Ticket Asignado')
            .setDescription(`**Ticket:** #${ticketData.id}
**Asunto:** ${ticketData.subject}
**Asignado a:** ${interaction.user.tag} (${interaction.user.id})
**Canal:** ${interaction.channel}`)
            .setTimestamp();
          
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        }
      }
      
      await interaction.followUp({
        embeds: [claimEmbed]
      });
    } catch (error) {
      console.error('Error al asignar ticket:', error);
      await interaction.followUp({
        content: `❌ Ha ocurrido un error al asignar el ticket: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  static async handlePriorityChange(interaction, client, currentPriority) {
    try {
      await interaction.deferReply();
      
      if (!interaction.channel.name.startsWith('ticket-')) {
        return interaction.followUp({
          content: '❌ Este canal no es un ticket.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const hasSupportRole = interaction.member.roles.cache.has(client.config.systems.tickets.supportRoleId);
      if (!hasSupportRole) {
        return interaction.followUp({
          content: '❌ Solo los miembros del equipo de soporte pueden cambiar la prioridad de los tickets.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const ticketData = this.activeTickets.get(interaction.channel.id);
      if (!ticketData) {
        return interaction.followUp({
          content: '❌ No se encontró información sobre este ticket en la base de datos.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      let newPriority;
      let priorityEmoji;
      let buttonStyle;
      
      switch (currentPriority) {
        case 'normal':
          newPriority = 'high';
          priorityEmoji = '🔴';
          buttonStyle = ButtonStyle.Danger;
          break;
        case 'high':
          newPriority = 'low';
          priorityEmoji = '🟢';
          buttonStyle = ButtonStyle.Success;
          break;
        case 'low':
        default:
          newPriority = 'normal';
          priorityEmoji = '🔵';
          buttonStyle = ButtonStyle.Secondary;
          break;
      }
      
      ticketData.priority = newPriority;
      this.activeTickets.set(interaction.channel.id, ticketData);
      
      const closeButton = new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Cerrar Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒');
      
      const claimButton = new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Asignarme este Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👤');

      const priorityButton = new ButtonBuilder()
        .setCustomId(`ticket_priority_${newPriority}`)
        .setLabel(`Prioridad: ${newPriority.charAt(0).toUpperCase() + newPriority.slice(1)}`)
        .setStyle(buttonStyle)
        .setEmoji(priorityEmoji);
      
      const row = new ActionRowBuilder().addComponents(closeButton, claimButton, priorityButton);
      
      const priorityEmbed = new EmbedBuilder()
        .setColor(
          newPriority === 'high' ? client.config.embedColors.error :
          newPriority === 'normal' ? client.config.embedColors.primary :
          client.config.embedColors.success
        )
        .setTitle(`Prioridad de Ticket Actualizada`)
        .setDescription(`${interaction.user} ha cambiado la prioridad del ticket #${ticketData.id} a **${newPriority.toUpperCase()}** ${priorityEmoji}.`)
        .setTimestamp();
      
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const ticketMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes(`Ticket #${ticketData.id}`));
        
        if (ticketMessage) {
          await ticketMessage.edit({ components: [row] });
        }
      } catch (error) {
        console.error('Error al actualizar mensaje de ticket:', error);
      }
      
      if (client.config.systems.tickets.logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(client.config.systems.tickets.logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(
              newPriority === 'high' ? client.config.embedColors.error :
              newPriority === 'normal' ? client.config.embedColors.primary :
              client.config.embedColors.success
            )
            .setTitle('Prioridad de Ticket Actualizada')
            .setDescription(`**Ticket:** #${ticketData.id}
**Asunto:** ${ticketData.subject}
**Nueva prioridad:** ${newPriority.toUpperCase()} ${priorityEmoji}
**Cambiado por:** ${interaction.user.tag} (${interaction.user.id})
**Canal:** ${interaction.channel}`)
            .setTimestamp();
          
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        }
      }
      
      await interaction.followUp({
        embeds: [priorityEmbed],
        components: [row]
      });
    } catch (error) {
      console.error('Error al cambiar prioridad del ticket:', error);
      await interaction.followUp({
        content: `❌ Ha ocurrido un error al cambiar la prioridad del ticket: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  static async handleSelectMenu(interaction, client, action, params = []) {
    try {
      if (interaction.customId === 'ticket_category_select') {
        await this.handleCategorySelect(interaction, client);
        return;
      }
      
      if (action === 'category_select') {
        await this.handleCategorySelect(interaction, client);
      }
    } catch (error) {
      console.error(`Error al manejar selección (${action}):`, error);
      await interaction.reply({
        content: `❌ Ha ocurrido un error al procesar la selección: ${error.message}`,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
}

module.exports = TicketManager;