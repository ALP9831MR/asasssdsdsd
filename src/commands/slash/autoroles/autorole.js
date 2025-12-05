const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    MessageFlags
  } = require('discord.js');
  const AutoroleManager = require('../../../systems/autoroles/autoroleManager');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('autorole')
      .setDescription('Gestiona el sistema de autoroles')
      .addSubcommand(subcommand =>
        subcommand
          .setName('botones')
          .setDescription('Crea un panel de selección de roles con botones')
          .addStringOption(option =>
            option.setName('titulo')
              .setDescription('Título del panel')
              .setRequired(true))
          .addStringOption(option =>
            option.setName('descripcion')
              .setDescription('Descripción del panel')
              .setRequired(true))
          .addRoleOption(option =>
            option.setName('rol1')
              .setDescription('Primer rol')
              .setRequired(true))
          .addRoleOption(option =>
            option.setName('rol2')
              .setDescription('Segundo rol')
              .setRequired(false))
          .addRoleOption(option =>
            option.setName('rol3')
              .setDescription('Tercer rol')
              .setRequired(false))
          .addRoleOption(option =>
            option.setName('rol4')
              .setDescription('Cuarto rol')
              .setRequired(false))
          .addRoleOption(option =>
            option.setName('rol5')
              .setDescription('Quinto rol')
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('menu')
          .setDescription('Crea un panel de selección de roles con menú desplegable')
          .addStringOption(option =>
            option.setName('titulo')
              .setDescription('Título del panel')
              .setRequired(true))
          .addStringOption(option =>
            option.setName('descripcion')
              .setDescription('Descripción del panel')
              .setRequired(true))
          .addRoleOption(option =>
            option.setName('rol1')
              .setDescription('Primer rol')
              .setRequired(true))
          .addRoleOption(option =>
            option.setName('rol2')
              .setDescription('Segundo rol')
              .setRequired(false))
          .addRoleOption(option =>
            option.setName('rol3')
              .setDescription('Tercer rol')
              .setRequired(false))
          .addRoleOption(option =>
            option.setName('rol4')
              .setDescription('Cuarto rol')
              .setRequired(false))
          .addRoleOption(option =>
            option.setName('rol5')
              .setDescription('Quinto rol')
              .setRequired(false)))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .setDMPermission(false),
    
    async execute(interaction, client) {
      const subcommand = interaction.options.getSubcommand();
      
      // Obtener opciones comunes
      const title = interaction.options.getString('titulo');
      const description = interaction.options.getString('descripcion');
      
      // Recopilar roles
      const roleIds = [];
      
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`rol${i}`);
        if (role && !role.managed && role.id !== interaction.guild.id) {
          roleIds.push(role.id);
        }
      }
      
      if (subcommand === 'botones') {
        // Crear panel con botones
        await AutoroleManager.createButtonPanel(interaction, client, title, description, roleIds);
      } 
      else if (subcommand === 'menu') {
        // Crear panel con menú desplegable
        await AutoroleManager.createSelectMenuPanel(interaction, client, title, description, roleIds);
      }
    }
  };