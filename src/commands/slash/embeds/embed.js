const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const EmbedManager = require('../../../systems/embeds/embedManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Crea embeds personalizados')
    .addSubcommand(subcommand =>
      subcommand
        .setName('crear')
        .setDescription('Crea un embed personalizado con mensaje opcional'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'crear') {
      // Mostrar modal para crear embed
      await EmbedManager.showEmbedCreationModal(interaction, client);
    }
  }
};