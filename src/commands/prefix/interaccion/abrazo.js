const EmbedUtil = require('../../../utils/embedBuilder');
const InteractionManager = require('../../../systems/interactions/interactionManager');

module.exports = {
  name: 'abrazo',
  description: 'Da un abrazo a un usuario',
  aliases: ['hug'],
  usage: '<@usuario|ID>',
  cooldown: 3,
  guildOnly: true,
  async execute(message, args, client) {
    // Verificar si se mencionó a un usuario
    if (!args.length) {
      return message.reply({ 
        embeds: [EmbedUtil.errorEmbed(client, 'Debes mencionar a un usuario para abrazarlo.')]
      });
    }

    // Obtener el usuario objetivo
    const targetId = args[0].replace(/[<@!>]/g, '');
    let target;
    
    try {
      target = await message.guild.members.fetch(targetId);
    } catch (error) {
      return message.reply({ 
        embeds: [EmbedUtil.errorEmbed(client, 'No se pudo encontrar a ese usuario en el servidor.')]
      });
    }
    
    // Verificar que no se esté abrazando a sí mismo
    if (target.id === message.author.id) {
      return message.reply({ 
        embeds: [EmbedUtil.warningEmbed(client, 'No puedes abrazarte a ti mismo. ¡Pide un abrazo a alguien!')]
      });
    }
    
    // Ejecutar la interacción
    const result = await InteractionManager.executeInteraction(
      'abrazo',
      message.member,
      target,
      client
    );
    
    if (result.success) {
      message.reply({ embeds: [result.embed] });
    } else {
      message.reply({ 
        embeds: [EmbedUtil.errorEmbed(client, result.message)]
      });
    }
  }
};