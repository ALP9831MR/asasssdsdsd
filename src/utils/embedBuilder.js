const { EmbedBuilder } = require('discord.js');

class EmbedUtil {
  /**
   * Crea un embed básico con color primario
   * @param {Client} client - Cliente de Discord
   * @returns {EmbedBuilder} Embed básico
   */
  static baseEmbed(client) {
    return new EmbedBuilder()
      .setColor(client.config.embedColors.primary)
      .setTimestamp()
      .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() });
  }

  /**
   * Crea un embed de éxito
   * @param {Client} client - Cliente de Discord
   * @param {string} description - Descripción del embed
   * @returns {EmbedBuilder} Embed de éxito
   */
  static successEmbed(client, description) {
    return this.baseEmbed(client)
      .setColor(client.config.embedColors.success)
      .setDescription(`✅ ${description}`);
  }

  /**
   * Crea un embed de error
   * @param {Client} client - Cliente de Discord
   * @param {string} description - Descripción del embed
   * @returns {EmbedBuilder} Embed de error
   */
  static errorEmbed(client, description) {
    return this.baseEmbed(client)
      .setColor(client.config.embedColors.error)
      .setDescription(`❌ ${description}`);
  }

  /**
   * Crea un embed de advertencia
   * @param {Client} client - Cliente de Discord
   * @param {string} description - Descripción del embed
   * @returns {EmbedBuilder} Embed de advertencia
   */
  static warningEmbed(client, description) {
    return this.baseEmbed(client)
      .setColor(client.config.embedColors.warning)
      .setDescription(`⚠️ ${description}`);
  }

  /**
   * Crea un embed informativo
   * @param {Client} client - Cliente de Discord
   * @param {string} description - Descripción del embed
   * @returns {EmbedBuilder} Embed informativo
   */
  static infoEmbed(client, description) {
    return this.baseEmbed(client)
      .setColor(client.config.embedColors.info)
      .setDescription(`ℹ️ ${description}`);
  }
}

module.exports = EmbedUtil;