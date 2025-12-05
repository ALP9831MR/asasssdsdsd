const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Muestra la latencia del bot'),
  
  async execute(interaction, client) {
    // Calcular ping
    await interaction.deferReply();
    const sent = await interaction.fetchReply();
    const timeDiff = sent.createdTimestamp - interaction.createdTimestamp;
    
    // Crear embed para la respuesta
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.info)
      .setDescription(`🏓 Pong!
**Latencia del Bot:** ${timeDiff}ms
**Latencia de la API:** ${Math.round(client.ws.ping)}ms`);
    
    // Enviar respuesta
    await interaction.followUp({ embeds: [embed] });
  }
};