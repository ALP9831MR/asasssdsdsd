const { EmbedBuilder } = require('discord.js');

class WelcomeManager {
  /**
   * Envía un mensaje de bienvenida para un nuevo miembro
   * @param {GuildMember} member - El miembro que se unió al servidor
   * @param {Client} client - El cliente del bot
   * @returns {Promise<void>}
   */
  static async sendWelcomeMessage(member, client) {
    try {
      // Obtener configuración
      const { channelId, message } = client.config.systems.welcome;
      
      // Verificar si hay un canal configurado
      if (!channelId) return;
      
      // Obtener el canal
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) return;
      
      // Reemplazar variables en el mensaje
      const welcomeMessage = message
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount);
      
      // Crear embed de bienvenida
      const welcomeEmbed = new EmbedBuilder()
        .setColor(client.config.embedColors.primary)
        .setTitle(`¡Bienvenido/a a ${member.guild.name}!`)
        .setDescription(welcomeMessage)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setTimestamp()
        .setFooter({ text: `ID: ${member.id}`, iconURL: member.guild.iconURL() });
      
      // Enviar mensaje
      await channel.send({ 
        content: `¡Hey <@${member.id}>! 👋`,
        embeds: [welcomeEmbed]
      });
    } catch (error) {
      console.error('Error al enviar mensaje de bienvenida:', error);
    }
  }

  /**
   * Configura el canal de bienvenidas
   * @param {TextChannel} channel - El canal donde se enviarán los mensajes
   * @param {Client} client - El cliente del bot
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async setWelcomeChannel(channel, client) {
    try {
      // Actualizar configuración
      client.config.systems.welcome.channelId = channel.id;
      
      // Guardar la configuración (esto requeriría un sistema de persistencia)
      // En una implementación real, aquí guardaríamos en una base de datos
      // Por ahora, solo actualizamos en memoria
      
      return { success: true, channelId: channel.id };
    } catch (error) {
      console.error('Error al configurar canal de bienvenidas:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Configura el mensaje de bienvenida
   * @param {string} message - El mensaje de bienvenida
   * @param {Client} client - El cliente del bot
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async setWelcomeMessage(message, client) {
    try {
      // Actualizar configuración
      client.config.systems.welcome.message = message;
      
      // Guardar la configuración (esto requeriría un sistema de persistencia)
      
      return { success: true, message };
    } catch (error) {
      console.error('Error al configurar mensaje de bienvenida:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WelcomeManager;