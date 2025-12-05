const { 
  EmbedBuilder, 
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');

class DirectMessagesManager {
  /**
   * Envía un mensaje directo a un usuario
   * @param {User} user - Usuario al que enviar el mensaje
   * @param {string} message - Contenido del mensaje
   * @param {Guild} guild - Servidor desde donde se envía el mensaje
   * @param {Client} client - El cliente del bot
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async sendDirectMessage(user, message, guild, client) {
    try {
      // Verificar que el mensaje no esté vacío
      if (!message || message.trim() === '') {
        return { success: false, message: 'El mensaje no puede estar vacío.' };
      }
      
      // Obtener información del servidor
      const serverName = guild ? guild.name : 'Desconocido';
      const serverIcon = guild ? guild.iconURL({ dynamic: true }) : client.user.displayAvatarURL();
      
      // Crear embed para el mensaje
      const embed = new EmbedBuilder()
        .setColor(client.config.embedColors.primary)
        .setAuthor({ 
          name: `${serverName}`,
          iconURL: serverIcon
        })
        .setDescription(message)
        .setTimestamp()
        .setFooter({ text: `Enviado por un moderador`, iconURL: client.user.displayAvatarURL() });
      
      // Agregar el logo del servidor como thumbnail
      if (serverIcon) {
        embed.setThumbnail(serverIcon);
      }
      
      // Intentar enviar el mensaje
      await user.send({ embeds: [embed] });
      
      return { 
        success: true, 
        message: `✅ Mensaje enviado a **${user.tag}**`
      };
    } catch (error) {
      console.error('Error al enviar mensaje directo:', error);
      
      if (error.code === 50007) {
        return { success: false, message: 'No se pudo enviar el mensaje. El usuario tiene los mensajes directos desactivados.' };
      }
      
      return { success: false, message: `Ha ocurrido un error: ${error.message}` };
    }
  }

  /**
   * Muestra un modal para enviar un mensaje directo
   * @param {Interaction} interaction - La interacción que solicitó el envío
   * @param {User} targetUser - Usuario al que se enviará el mensaje
   * @returns {Promise<void>}
   */
  static async showDirectMessageModal(interaction, targetUser) {
    try {
      // Verificar permisos
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
          content: '❌ No tienes permisos para enviar mensajes directos desde el bot.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Crear modal para el mensaje
      const modal = new ModalBuilder()
        .setCustomId(`dm_send_${targetUser.id}`)
        .setTitle(`Enviar mensaje a ${targetUser.tag}`);
      
      // Añadir campo al modal
      const messageInput = new TextInputBuilder()
        .setCustomId('dmMessage')
        .setLabel('Mensaje')
        .setPlaceholder('Escribe el mensaje que quieres enviar...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);
      
      // Añadir componentes al modal
      const firstRow = new ActionRowBuilder().addComponents(messageInput);
      
      modal.addComponents(firstRow);
      
      // Mostrar el modal
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error al mostrar modal de mensaje directo:', error);
      await interaction.reply({
        content: '❌ Ha ocurrido un error al abrir el formulario de mensaje directo.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  /**
   * Maneja el envío del modal para enviar un mensaje directo
   * @param {ModalSubmitInteraction} interaction - La interacción del modal
   * @param {Client} client - El cliente del bot
   * @param {string} action - La acción a realizar
   * @param {string[]} params - Parámetros adicionales (ID del usuario)
   * @returns {Promise<void>}
   */
  static async handleModalSubmit(interaction, client, action, params) {
    try {
      if (action === 'send') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const userId = params[0];
        const message = interaction.fields.getTextInputValue('dmMessage');
        
        // Obtener el usuario
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
          return interaction.followUp({
            content: '❌ No se pudo encontrar al usuario especificado.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Enviar el mensaje, pasando el servidor actual
        const result = await this.sendDirectMessage(user, message, interaction.guild, client);
        
        if (result.success) {
          await interaction.followUp({
            content: result.message,
            flags: MessageFlags.Ephemeral
          });
        } else {
          await interaction.followUp({
            content: `❌ ${result.message}`,
            flags: MessageFlags.Ephemeral
          });
        }
      }
    } catch (error) {
      console.error(`Error al procesar modal de mensaje directo (${action}):`, error);
      await interaction.followUp({
        content: '❌ Ha ocurrido un error al enviar el mensaje directo.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
}

module.exports = DirectMessagesManager;