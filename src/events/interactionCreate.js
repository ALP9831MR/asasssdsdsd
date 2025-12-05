// ========================================
// 📁 events/interactionCreate.js
// ========================================

const { InteractionType, MessageFlags } = require('discord.js');
const EmbedUtil = require('../utils/embedBuilder');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // ========================================
      // 🔹 MANEJAR COMANDOS DE BARRA (SLASH COMMANDS)
      // ========================================
      if (interaction.type === InteractionType.ApplicationCommand) {
        const command = client.slashCommands.get(interaction.commandName);
        
        if (!command) return;
        
        try {
          await command.execute(interaction, client);
        } catch (error) {
          console.error(`Error al ejecutar el slash command ${interaction.commandName}:`, error);
          
          const errorResponse = {
            embeds: [EmbedUtil.errorEmbed(client, 'Ocurrió un error al ejecutar este comando.')],
            flags: MessageFlags.Ephemeral
          };
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorResponse);
          } else {
            await interaction.reply(errorResponse);
          }
        }
      }
      
      // ========================================
      // 🔹 MANEJAR BOTONES
      // ========================================
      else if (interaction.isButton()) {
        const [type, action, ...params] = interaction.customId.split('_');
        
        switch (type) {
          case 'ticket':
            const ticketSystem = require('../systems/tickets/ticketManager');
            await ticketSystem.handleButton(interaction, client, action, params);
            break;
            
          case 'autorole':
            const autoroleSystem = require('../systems/autoroles/autoroleManager');
            await autoroleSystem.handleButton(interaction, client, action, params);
            break;
            
          case 'embed':
            const embedSystem = require('../systems/embeds/embedManager');
            await embedSystem.handleButton(interaction, client, action, params);
            break;
            
          case 'clear':
            const ClearManager = require('../systems/moderation/clearManager');
            await ClearManager.handleButton(interaction, client, action, params);
            break;
            
          case 'daily':
            // Sistema de actividad diaria
            if (action === 'activity' && params[0] === 'click') {
              const DailyActivityManager = require('../systems/dailyActivity/dailyActivityManager');
              await DailyActivityManager.handleDailyClick(interaction, client);
            }
            break;
            
          case 'report':
            const ReportManager = require('../systems/moderation/reportManager');
            await ReportManager.handleButton(interaction, client, action, params);
            break;
            
          case 'verification':
            const VerificationManager = require('../systems/moderation/verificationManager');
            await VerificationManager.handleButton(interaction, client);
            break;

          case 'modpanel':
            const ModPanelManager = require('../systems/moderation/modpanelManager');
            await ModPanelManager.handleButton(interaction, client, action, params);
            break;

          // ===== SISTEMA DE GIVEAWAYS =====
          case 'giveaway':
            const GiveawayManager = require('../systems/giveaways/giveawayManager');
            
            // Botón de participar
            if (action === 'enter') {
              await GiveawayManager.enterGiveaway(interaction);
            }
            // Botón de salir
            else if (action === 'leave') {
              await GiveawayManager.leaveGiveaway(interaction);
            }
            // Botón de ver participantes
            else if (action === 'participants') {
              await GiveawayManager.showParticipants(interaction);
            }
            // Botón de enviar pruebas (muestra el embed informativo)
            else if (action === 'submit' && params[0] === 'proof') {
              await GiveawayManager.showProofModal(interaction);
            }
            // Botón para abrir el modal de pruebas
            else if (action === 'open' && params[0] === 'proof' && params[1] === 'modal') {
              await GiveawayManager.openProofModal(interaction);
            }
            break;
          // ===== FIN SISTEMA DE GIVEAWAYS =====
            
          default:
            try {
              const modulePath = type === 'ticket' ? '../systems/tickets/ticketManager' : `../systems/${type}/${type}Manager`;
              const buttonHandler = require(modulePath);
              
              if (buttonHandler && typeof buttonHandler.handleButton === 'function') {
                await buttonHandler.handleButton(interaction, client, action, params);
              }
            } catch (error) {
              console.error(`No se encontró manejador para el botón tipo: ${type}`, error.message);
            }
        }
      }
      
      // ========================================
      // 🔹 MANEJAR MENÚS DE SELECCIÓN
      // ========================================
      else if (interaction.isStringSelectMenu()) {
        const [type, action, ...params] = interaction.customId.split('_');
        
        switch (type) {
          case 'ticket':
            const ticketSystem = require('../systems/tickets/ticketManager');
            await ticketSystem.handleSelectMenu(interaction, client, action, params);
            break;
            
          case 'autorole':
            const autoroleSystem = require('../systems/autoroles/autoroleManager');
            await autoroleSystem.handleSelectMenu(interaction, client, action, params);
            break;
            
          case 'embed':
            const embedSystem = require('../systems/embeds/embedManager');
            await embedSystem.handleSelectMenu(interaction, client, action, params);
            break;

          case 'modpanel':
            const ModPanelManager = require('../systems/moderation/modpanelManager');
            await ModPanelManager.handleSelectMenu(interaction, client, action, params);
            break;

          case 'helpmod':
            // Manejar menú de helpmod
            if (action === 'system' && params[0] === 'select') {
              const helpmodCommand = client.slashCommands.get('helpmod');
              if (helpmodCommand && helpmodCommand.handleSelectMenu) {
                await helpmodCommand.handleSelectMenu(interaction);
              }
            }
            break;
            
          default:
            try {
              const modulePath = type === 'ticket' ? '../systems/tickets/ticketManager' : `../systems/${type}/${type}Manager`;
              const menuHandler = require(modulePath);
              
              if (menuHandler && typeof menuHandler.handleSelectMenu === 'function') {
                await menuHandler.handleSelectMenu(interaction, client, action, params);
              }
            } catch (error) {
              console.error(`No se encontró manejador para el menú tipo: ${type}`, error.message);
            }
        }
      }
      
      // ========================================
      // 🔹 MANEJAR MODALES
      // ========================================
      else if (interaction.isModalSubmit()) {
        const [type, action, ...params] = interaction.customId.split('_');
        
        switch (type) {
          case 'ticket':
            const ticketSystem = require('../systems/tickets/ticketManager');
            await ticketSystem.handleModalSubmit(interaction, client, action, params);
            break;
            
          case 'embed':
            const embedSystem = require('../systems/embeds/embedManager');
            await embedSystem.handleModalSubmit(interaction, client, action, params);
            break;
            
          case 'dm':
            const dmSystem = require('../systems/directmessages/directMessagesManager');
            await dmSystem.handleModalSubmit(interaction, client, action, params);
            break;

          case 'modpanel':
            const ModPanelManager = require('../systems/moderation/modpanelManager');
            await ModPanelManager.handleModalSubmit(interaction, client, action, params);
            break;

          // ===== SISTEMA DE GIVEAWAYS - MODALES =====
          case 'giveaway':
            const GiveawayManager = require('../systems/giveaways/giveawayManager');
            
            // Modal de envío de pruebas
            if (action === 'proof' && params[0] === 'submit') {
              await GiveawayManager.submitProof(interaction);
            }
            break;
          // ===== FIN SISTEMA DE GIVEAWAYS - MODALES =====
            
          default:
            try {
              const modulePath = type === 'ticket' ? '../systems/tickets/ticketManager' : `../systems/${type}/${type}Manager`;
              const modalHandler = require(modulePath);
              
              if (modalHandler && typeof modalHandler.handleModalSubmit === 'function') {
                await modalHandler.handleModalSubmit(interaction, client, action, params);
              }
            } catch (error) {
              console.error(`No se encontró manejador para el modal tipo: ${type}`, error.message);
            }
        }
      }
      
      // ========================================
      // 🔹 MANEJAR AUTOCOMPLETADO
      // ========================================
      else if (interaction.isAutocomplete()) {
        const command = client.slashCommands.get(interaction.commandName);
        
        if (!command || !command.autocomplete) return;
        
        try {
          await command.autocomplete(interaction, client);
        } catch (error) {
          console.error(`Error en autocompletado de ${interaction.commandName}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Error en el evento interactionCreate:', error);
      
      try {
        const errorResponse = {
          content: '❌ Ocurrió un error inesperado al procesar tu interacción.',
          flags: MessageFlags.Ephemeral
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorResponse);
        } else if (interaction.isRepliable()) {
          await interaction.reply(errorResponse);
        }
      } catch (replyError) {
        console.error('No se pudo responder con el error:', replyError);
      }
    }
  }
};