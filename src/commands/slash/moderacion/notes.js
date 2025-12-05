// ========================================
// 📁 src/commands/slash/moderation/notes.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits
} = require('discord.js');
const NotesManager = require('../../../systems/moderation/notesManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('Sistema de notas privadas de moderación')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Agregar una nota privada sobre un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario sobre quien agregar la nota')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('nota')
            .setDescription('Contenido de la nota')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('categoria')
            .setDescription('Categoría de la nota')
            .addChoices(
              { name: '📝 General', value: 'general' },
              { name: '⚠️ Advertencia', value: 'advertencia' },
              { name: '🔍 Observación', value: 'observacion' },
              { name: '🚨 Sospecha', value: 'sospecha' },
              { name: '✅ Positivo', value: 'positivo' },
              { name: '❌ Negativo', value: 'negativo' }
            )
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Ver todas las notas de un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a consultar')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('categoria')
            .setDescription('Filtrar por categoría')
            .addChoices(
              { name: '📝 General', value: 'general' },
              { name: '⚠️ Advertencia', value: 'advertencia' },
              { name: '🔍 Observación', value: 'observacion' },
              { name: '🚨 Sospecha', value: 'sospecha' },
              { name: '✅ Positivo', value: 'positivo' },
              { name: '❌ Negativo', value: 'negativo' }
            )
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Eliminar una nota específica')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario de la nota')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('id_nota')
            .setDescription('ID de la nota a eliminar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Buscar en todas las notas')
        .addStringOption(option =>
          option
            .setName('texto')
            .setDescription('Texto a buscar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('export')
        .setDescription('Exportar todas las notas de un usuario')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a exportar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('recent')
        .setDescription('Ver las notas más recientes del servidor')
        .addIntegerOption(option =>
          option
            .setName('cantidad')
            .setDescription('Cantidad de notas a mostrar (1-20)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'add') {
      const usuario = interaction.options.getUser('usuario');
      const nota = interaction.options.getString('nota');
      const categoria = interaction.options.getString('categoria') || 'general';
      
      await NotesManager.addNote(interaction, client, usuario, nota, categoria);
    }
    else if (subcommand === 'view') {
      const usuario = interaction.options.getUser('usuario');
      const categoria = interaction.options.getString('categoria');
      
      await NotesManager.viewNotes(interaction, client, usuario, categoria);
    }
    else if (subcommand === 'remove') {
      const usuario = interaction.options.getUser('usuario');
      const noteId = interaction.options.getString('id_nota');
      
      await NotesManager.removeNote(interaction, client, usuario, noteId);
    }
    else if (subcommand === 'search') {
      const texto = interaction.options.getString('texto');
      
      await NotesManager.searchNotes(interaction, client, texto);
    }
    else if (subcommand === 'export') {
      const usuario = interaction.options.getUser('usuario');
      
      await NotesManager.exportNotes(interaction, client, usuario);
    }
    else if (subcommand === 'recent') {
      const cantidad = interaction.options.getInteger('cantidad') || 10;
      
      await NotesManager.showRecent(interaction, client, cantidad);
    }
  }
};