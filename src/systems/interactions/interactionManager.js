const { EmbedBuilder } = require('discord.js');

class InteractionManager {
  /**
   * Lista de interacciones disponibles
   * @returns {Array<Object>} Lista de interacciones
   */
  static getInteractions() {
    return [
      {
        name: 'abrazo',
        description: 'Dar un abrazo a alguien',
        message: '{user} ha dado un abrazo a {target}',
        gifs: [
          'https://i.imgur.com/GMa1h1Z.gif',
          'https://i.imgur.com/yE2RnJa.gif',
          'https://i.imgur.com/R9sYxXG.gif',
          'https://i.imgur.com/mvlHBnQ.gif'
        ]
      },
      {
        name: 'golpe',
        description: 'Dar un golpe a alguien',
        message: '{user} ha golpeado a {target}',
        gifs: [
          'https://i.imgur.com/ZYGJEdr.gif',
          'https://i.imgur.com/Yv3WDMB.gif',
          'https://i.imgur.com/HIGGlNm.gif',
          'https://i.imgur.com/VkGLWDt.gif'
        ]
      },
      {
        name: 'beso',
        description: 'Dar un beso a alguien',
        message: '{user} ha besado a {target}',
        gifs: [
          'https://i.imgur.com/i1PIph3.gif',
          'https://i.imgur.com/sGVgr74.gif',
          'https://i.imgur.com/TDVZwUB.gif',
          'https://i.imgur.com/EAaNVfG.gif'
        ]
      },
      {
        name: 'caricia',
        description: 'Acariciar a alguien',
        message: '{user} ha acariciado a {target}',
        gifs: [
          'https://i.imgur.com/LUypjw3.gif',
          'https://i.imgur.com/Nwm7rOj.gif',
          'https://i.imgur.com/2k0MFIr.gif',
          'https://i.imgur.com/nCwCS55.gif'
        ]
      },
      {
        name: 'cosquillas',
        description: 'Hacer cosquillas a alguien',
        message: '{user} le ha hecho cosquillas a {target}',
        gifs: [
          'https://i.imgur.com/OMDbBsF.gif',
          'https://i.imgur.com/Dt2GQn6.gif',
          'https://i.imgur.com/ADKRClm.gif',
          'https://i.imgur.com/r10ASfV.gif'
        ]
      }
    ];
  }

  /**
   * Ejecuta una interacción entre dos usuarios
   * @param {string} interactionName - Nombre de la interacción
   * @param {GuildMember} user - Usuario que inicia la interacción
   * @param {GuildMember|string} target - Usuario objetivo de la interacción
   * @param {Client} client - El cliente del bot
   * @returns {Promise<Object>} Resultado de la operación
   */
  static async executeInteraction(interactionName, user, target, client) {
    try {
      // Buscar la interacción
      const interaction = this.getInteractions().find(i => i.name === interactionName);
      
      if (!interaction) {
        return { success: false, message: 'Interacción no encontrada.' };
      }
      
      // Seleccionar un GIF aleatorio
      const randomGif = interaction.gifs[Math.floor(Math.random() * interaction.gifs.length)];
      
      // Crear mensaje reemplazando placeholders
      let message = interaction.message
        .replace('{user}', user.toString())
        .replace('{target}', target.toString());
      
      // Crear embed para la interacción
      const embed = new EmbedBuilder()
        .setColor(client.config.embedColors.primary)
        .setDescription(message)
        .setImage(randomGif)
        .setTimestamp();
      
      return {
        success: true,
        embed: embed
      };
    } catch (error) {
      console.error(`Error al ejecutar interacción ${interactionName}:`, error);
      return { success: false, message: `Ha ocurrido un error: ${error.message}` };
    }
  }
}

module.exports = InteractionManager;