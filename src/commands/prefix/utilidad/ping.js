const EmbedUtil = require('../../../utils/embedBuilder');

module.exports = {
  name: 'ping',
  description: 'Muestra la latencia del bot',
  aliases: ['latencia'],
  cooldown: 5,
  async execute(message, args, client) {
    // Medir ping
    const sent = await message.reply({ content: 'Midiendo ping...' });
    const timeDiff = sent.createdTimestamp - message.createdTimestamp;
    
    // Crear embed para la respuesta
    const embed = EmbedUtil.infoEmbed(client, `🏓 Pong!
**Latencia del Bot:** ${timeDiff}ms
**Latencia de la API:** ${Math.round(client.ws.ping)}ms`);
    
    // Enviar respuesta
    await sent.edit({ content: null, embeds: [embed] });
  }
};