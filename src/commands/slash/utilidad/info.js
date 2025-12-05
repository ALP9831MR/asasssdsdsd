const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Muestra información de los canales y categorías del servidor'),

  async execute(interaction) {
    const guild = interaction.guild;

    // Filtrar categorías
    const categories = guild.channels.cache.filter(c => c.type === 4); // 4 = Category
    const textAndVoiceChannels = guild.channels.cache.filter(c => c.type === 0 || c.type === 2); // 0 = Text, 2 = Voice

    // Crear objeto para agrupar canales por categoría
    const channelsByCategory = {};

    textAndVoiceChannels.forEach(channel => {
      const categoryName = channel.parent ? channel.parent.name : 'Sin categoría';
      if (!channelsByCategory[categoryName]) channelsByCategory[categoryName] = [];
      channelsByCategory[categoryName].push(channel.name);
    });

    // Crear descripción agrupando canales por categoría
    let description = '';
    for (const [category, channels] of Object.entries(channelsByCategory)) {
      description += `**${category}**:\n${channels.map(c => `- ${c}`).join('\n')}\n\n`;
    }

    // Crear embed
    const embed = new EmbedBuilder()
      .setTitle(`Información de ${guild.name}`)
      .setColor('Blue')
      .addFields(
        { name: 'Número de categorías', value: `${categories.size}`, inline: true },
        { name: 'Número de canales', value: `${textAndVoiceChannels.size}`, inline: true },
        { name: 'Canales por categoría', value: description || 'No hay canales' }
      )
      .setFooter({ text: `ID del servidor: ${guild.id}` });

    await interaction.reply({ embeds: [embed] });
  }
};
