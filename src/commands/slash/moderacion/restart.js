const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Reinicia el bot (solo administradores)'),

  async execute(interaction, client) {
    // Verificar que el usuario tenga permisos de administrador
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ No tienes permisos para reiniciar el bot.', ephemeral: true });
    }

    // Embed avisando del reinicio
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setDescription('🔄 Reiniciando el bot...');

    await interaction.reply({ embeds: [embed] });

    // Dar un pequeño delay antes de cerrar para que se vea el mensaje
    setTimeout(() => {
      process.exit(0); // Pterodactyl / PM2 lo reiniciará automáticamente
    }, 2000);
  }
};
