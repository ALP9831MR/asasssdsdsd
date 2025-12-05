const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  EmbedBuilder
} = require('discord.js');
const TicketManager = require('../../../systems/tickets/ticketManager');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gestiona el sistema de tickets')
    .addSubcommand(subcommand =>
      subcommand
        .setName('panel')
        .setDescription('Crea un panel de tickets en el canal actual'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configura el sistema de tickets')
        .addChannelOption(option =>
          option.setName('categoria')
            .setDescription('Categoría donde se crearán los tickets')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Rol que puede ver y gestionar tickets')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('logs')
            .setDescription('Canal donde se registrarán las acciones de tickets')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)))
    .addSubcommandGroup(group =>
      group
        .setName('categoria')
        .setDescription('Gestiona las categorías de tickets')
        .addSubcommand(subcommand =>
          subcommand
            .setName('agregar')
            .setDescription('Agrega una nueva categoría de ticket')
            .addStringOption(option =>
              option.setName('id')
                .setDescription('ID único de la categoría (sin espacios, minúsculas)')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('nombre')
                .setDescription('Nombre visible de la categoría')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('descripcion')
                .setDescription('Descripción de la categoría')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('emoji')
                .setDescription('Emoji para la categoría (ej: 🎮, 💰, 🔧)')
                .setRequired(false)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('eliminar')
            .setDescription('Elimina una categoría de ticket existente')
            .addStringOption(option =>
              option.setName('id')
                .setDescription('ID de la categoría a eliminar')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('editar')
            .setDescription('Edita una categoría de ticket existente')
            .addStringOption(option =>
              option.setName('id')
                .setDescription('ID de la categoría a editar')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption(option =>
              option.setName('nombre')
                .setDescription('Nuevo nombre de la categoría')
                .setRequired(false))
            .addStringOption(option =>
              option.setName('descripcion')
                .setDescription('Nueva descripción de la categoría')
                .setRequired(false))
            .addStringOption(option =>
              option.setName('emoji')
                .setDescription('Nuevo emoji para la categoría')
                .setRequired(false)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('listar')
            .setDescription('Lista todas las categorías de tickets configuradas')))
    .addSubcommandGroup(group =>
      group
        .setName('texto')
        .setDescription('Personaliza los textos del sistema de tickets')
        .addSubcommand(subcommand =>
          subcommand
            .setName('panel')
            .setDescription('Configura el texto del panel de tickets')
            .addStringOption(option =>
              option.setName('titulo')
                .setDescription('Título del panel')
                .setRequired(false))
            .addStringOption(option =>
              option.setName('descripcion')
                .setDescription('Descripción del panel')
                .setRequired(false))
            .addStringOption(option =>
              option.setName('imagen')
                .setDescription('URL de la imagen separadora')
                .setRequired(false)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('boton')
            .setDescription('Configura el texto del botón de crear ticket')
            .addStringOption(option =>
              option.setName('texto')
                .setDescription('Texto del botón')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('emoji')
                .setDescription('Emoji del botón')
                .setRequired(false)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('mensaje')
            .setDescription('Configura mensajes del sistema')
            .addStringOption(option =>
              option.setName('tipo')
                .setDescription('Tipo de mensaje a configurar')
                .setRequired(true)
                .addChoices(
                  { name: 'Mensaje de bienvenida en ticket', value: 'welcome' },
                  { name: 'Pie de página del panel', value: 'footer' },
                  { name: 'Tiempo de respuesta', value: 'response_time' }
                ))
            .addStringOption(option =>
              option.setName('texto')
                .setDescription('Nuevo texto para el mensaje')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('restaurar')
            .setDescription('Restaura todos los textos a sus valores por defecto')))
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Muestra la configuración actual del sistema de tickets'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  
  async autocomplete(interaction, client) {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'id') {
      const categories = client.config.systems.tickets.categories || [];
      const filtered = categories
        .filter(cat => cat.id.toLowerCase().includes(focusedOption.value.toLowerCase()))
        .map(cat => ({
          name: `${cat.emoji || '📋'} ${cat.label} (${cat.id})`,
          value: cat.id
        }))
        .slice(0, 25);
      
      await interaction.respond(filtered);
    }
  },
  
  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    
    // Asegurar que existe la estructura de configuración
    if (!client.config.systems.tickets.categories) {
      client.config.systems.tickets.categories = [
        { id: 'general', emoji: '❓', label: 'General', description: 'Consultas generales y ayuda' },
        { id: 'soporte', emoji: '🛠️', label: 'Soporte Técnico', description: 'Problemas técnicos y bugs' },
        { id: 'comprar', emoji: '🛒', label: 'Comprar', description: 'Compra de Coins/Vip/Elementos/Vehiculos Vip/Bienes Vip' }
      ];
    }
    
    if (!client.config.systems.tickets.texts) {
      client.config.systems.tickets.texts = {
        panel: {
          title: '🎫 Centro de Atención al Usuario',
          description: '¿Necesitas ayuda? ¡Estamos aquí para asistirte! Selecciona una categoría que mejor se adapte a tu consulta y un miembro de nuestro equipo te atenderá lo antes posible.',
          image: 'https://media.discordapp.net/attachments/1104118332901036082/1122947010072858654/separate.gif',
          footer: '{server} • Sistema de Soporte',
          responseTime: 'Nuestro equipo de soporte responderá a tu ticket tan pronto como sea posible, generalmente en un plazo de 24 horas.'
        },
        button: {
          text: 'Crear Ticket',
          emoji: '🎫'
        },
        welcome: '¡Hola {user}! Gracias por crear un ticket. Un miembro del equipo te atenderá pronto.'
      };
    }
    
    if (subcommandGroup === 'categoria') {
      await handleCategoryCommands(interaction, client, subcommand);
    } else if (subcommandGroup === 'texto') {
      await handleTextCommands(interaction, client, subcommand);
    } else if (subcommand === 'panel') {
      await TicketManager.createTicketPanel(interaction, client);
    } else if (subcommand === 'setup') {
      await handleSetup(interaction, client);
    } else if (subcommand === 'config') {
      await showConfig(interaction, client);
    }
  }
};

async function handleCategoryCommands(interaction, client, subcommand) {
  const categories = client.config.systems.tickets.categories;
  
  if (subcommand === 'agregar') {
    const id = interaction.options.getString('id').toLowerCase().replace(/\s+/g, '_');
    const nombre = interaction.options.getString('nombre');
    const descripcion = interaction.options.getString('descripcion');
    const emoji = interaction.options.getString('emoji') || '📋';
    
    // Verificar si ya existe
    if (categories.find(cat => cat.id === id)) {
      return interaction.reply({
        content: `❌ Ya existe una categoría con el ID \`${id}\`. Usa un ID diferente o edita la categoría existente.`,
        flags: MessageFlags.Ephemeral
      });
    }
    
    // Agregar categoría
    categories.push({
      id: id,
      emoji: emoji,
      label: nombre,
      description: descripcion
    });
    
    await saveConfig(client);
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.success)
      .setTitle('✅ Categoría Agregada')
      .setDescription(`Se ha agregado la nueva categoría de tickets:`)
      .addFields(
        { name: 'ID', value: `\`${id}\``, inline: true },
        { name: 'Nombre', value: `${emoji} ${nombre}`, inline: true },
        { name: 'Descripción', value: descripcion }
      )
      .setFooter({ text: 'Usa /ticket panel para actualizar el panel de tickets' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
  } else if (subcommand === 'eliminar') {
    const id = interaction.options.getString('id');
    
    const index = categories.findIndex(cat => cat.id === id);
    if (index === -1) {
      return interaction.reply({
        content: `❌ No se encontró ninguna categoría con el ID \`${id}\`.`,
        flags: MessageFlags.Ephemeral
      });
    }
    
    const removed = categories.splice(index, 1)[0];
    await saveConfig(client);
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.warning)
      .setTitle('🗑️ Categoría Eliminada')
      .setDescription(`Se ha eliminado la categoría: ${removed.emoji} **${removed.label}** (\`${removed.id}\`)`)
      .setFooter({ text: 'Usa /ticket panel para actualizar el panel de tickets' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
  } else if (subcommand === 'editar') {
    const id = interaction.options.getString('id');
    const nombre = interaction.options.getString('nombre');
    const descripcion = interaction.options.getString('descripcion');
    const emoji = interaction.options.getString('emoji');
    
    const category = categories.find(cat => cat.id === id);
    if (!category) {
      return interaction.reply({
        content: `❌ No se encontró ninguna categoría con el ID \`${id}\`.`,
        flags: MessageFlags.Ephemeral
      });
    }
    
    // Actualizar campos
    if (nombre) category.label = nombre;
    if (descripcion) category.description = descripcion;
    if (emoji) category.emoji = emoji;
    
    await saveConfig(client);
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.info)
      .setTitle('✏️ Categoría Editada')
      .setDescription(`Se ha actualizado la categoría:`)
      .addFields(
        { name: 'ID', value: `\`${id}\``, inline: true },
        { name: 'Nombre', value: `${category.emoji} ${category.label}`, inline: true },
        { name: 'Descripción', value: category.description }
      )
      .setFooter({ text: 'Usa /ticket panel para actualizar el panel de tickets' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
  } else if (subcommand === 'listar') {
    if (categories.length === 0) {
      return interaction.reply({
        content: '❌ No hay categorías configuradas. Usa `/ticket categoria agregar` para crear una.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.primary)
      .setTitle('📋 Categorías de Tickets Configuradas')
      .setDescription(categories.map((cat, index) => 
        `**${index + 1}.** ${cat.emoji} **${cat.label}** (\`${cat.id}\`)\n└ ${cat.description}`
      ).join('\n\n'))
      .setFooter({ text: `Total: ${categories.length} categoría${categories.length !== 1 ? 's' : ''}` });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleTextCommands(interaction, client, subcommand) {
  const texts = client.config.systems.tickets.texts;
  
  if (subcommand === 'panel') {
    const titulo = interaction.options.getString('titulo');
    const descripcion = interaction.options.getString('descripcion');
    const imagen = interaction.options.getString('imagen');
    
    if (titulo) texts.panel.title = titulo;
    if (descripcion) texts.panel.description = descripcion;
    if (imagen) texts.panel.image = imagen;
    
    await saveConfig(client);
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.success)
      .setTitle('✅ Textos del Panel Actualizados')
      .setDescription('Se han actualizado los textos del panel de tickets.')
      .addFields(
        { name: 'Título', value: texts.panel.title },
        { name: 'Descripción', value: texts.panel.description.substring(0, 1024) },
        { name: 'Imagen', value: texts.panel.image || 'Sin imagen' }
      )
      .setFooter({ text: 'Usa /ticket panel para ver los cambios' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
  } else if (subcommand === 'boton') {
    const texto = interaction.options.getString('texto');
    const emoji = interaction.options.getString('emoji');
    
    texts.button.text = texto;
    if (emoji) texts.button.emoji = emoji;
    
    await saveConfig(client);
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.success)
      .setTitle('✅ Botón Actualizado')
      .setDescription(`Nuevo texto: ${texts.button.emoji} **${texts.button.text}**`)
      .setFooter({ text: 'Usa /ticket panel para ver los cambios' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
  } else if (subcommand === 'mensaje') {
    const tipo = interaction.options.getString('tipo');
    const texto = interaction.options.getString('texto');
    
    if (tipo === 'welcome') {
      texts.welcome = texto;
    } else if (tipo === 'footer') {
      texts.panel.footer = texto;
    } else if (tipo === 'response_time') {
      texts.panel.responseTime = texto;
    }
    
    await saveConfig(client);
    
    const tipoNombres = {
      welcome: 'Mensaje de Bienvenida',
      footer: 'Pie de Página',
      response_time: 'Tiempo de Respuesta'
    };
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.success)
      .setTitle('✅ Mensaje Actualizado')
      .setDescription(`**${tipoNombres[tipo]}**\n${texto}`)
      .setFooter({ text: 'Los cambios se aplicarán en nuevos tickets/paneles' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
  } else if (subcommand === 'restaurar') {
    client.config.systems.tickets.texts = {
      panel: {
        title: '🎫 Centro de Atención al Usuario',
        description: '¿Necesitas ayuda? ¡Estamos aquí para asistirte! Selecciona una categoría que mejor se adapte a tu consulta y un miembro de nuestro equipo te atenderá lo antes posible.',
        image: 'https://media.discordapp.net/attachments/1104118332901036082/1122947010072858654/separate.gif',
        footer: '{server} • Sistema de Soporte',
        responseTime: 'Nuestro equipo de soporte responderá a tu ticket tan pronto como sea posible, generalmente en un plazo de 24 horas.'
      },
      button: {
        text: 'Crear Ticket',
        emoji: '🎫'
      },
      welcome: '¡Hola {user}! Gracias por crear un ticket. Un miembro del equipo te atenderá pronto.'
    };
    
    await saveConfig(client);
    
    const embed = new EmbedBuilder()
      .setColor(client.config.embedColors.success)
      .setTitle('♻️ Textos Restaurados')
      .setDescription('Se han restaurado todos los textos a sus valores por defecto.')
      .setFooter({ text: 'Usa /ticket panel para aplicar los cambios' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleSetup(interaction, client) {
  const category = interaction.options.getChannel('categoria');
  const role = interaction.options.getRole('rol');
  const logChannel = interaction.options.getChannel('logs');
  
  client.config.systems.tickets.categoryId = category.id;
  client.config.systems.tickets.supportRoleId = role.id;
  
  if (logChannel) {
    client.config.systems.tickets.logChannelId = logChannel.id;
  }
  
  await saveConfig(client);
  
  const categories = client.config.systems.tickets.categories || [];
  
  const embed = new EmbedBuilder()
    .setColor(client.config.embedColors.success)
    .setTitle('✅ Sistema de Tickets Configurado')
    .setDescription('El sistema de tickets ha sido configurado correctamente.')
    .addFields(
      { name: '📁 Categoría', value: category.toString(), inline: true },
      { name: '👥 Rol de Soporte', value: role.toString(), inline: true },
      { name: '📝 Canal de Logs', value: logChannel ? logChannel.toString() : 'No configurado', inline: true },
      { 
        name: '📋 Categorías de Tickets', 
        value: categories.length > 0 
          ? categories.map(c => `${c.emoji} **${c.label}**`).join('\n')
          : 'No hay categorías configuradas'
      }
    )
    .setFooter({ text: 'Usa /ticket panel para crear el panel de tickets' });
  
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function showConfig(interaction, client) {
  const config = client.config.systems.tickets;
  const categories = config.categories || [];
  const texts = config.texts || {};
  
  const embed = new EmbedBuilder()
    .setColor(client.config.embedColors.info)
    .setTitle('⚙️ Configuración del Sistema de Tickets')
    .addFields(
      { 
        name: '📁 Configuración General', 
        value: `**Categoría:** ${config.categoryId ? `<#${config.categoryId}>` : 'No configurada'}\n` +
               `**Rol de Soporte:** ${config.supportRoleId ? `<@&${config.supportRoleId}>` : 'No configurado'}\n` +
               `**Canal de Logs:** ${config.logChannelId ? `<#${config.logChannelId}>` : 'No configurado'}`
      },
      { 
        name: '📋 Categorías de Tickets', 
        value: categories.length > 0 
          ? categories.map(c => `${c.emoji} **${c.label}** (\`${c.id}\`)`).join('\n')
          : 'No hay categorías configuradas',
        inline: false
      }
    );
  
  if (texts.panel) {
    embed.addFields({
      name: '✏️ Textos Personalizados',
      value: `**Título del Panel:** ${texts.panel.title || 'Por defecto'}\n` +
             `**Botón:** ${texts.button?.emoji || '🎫'} ${texts.button?.text || 'Crear Ticket'}`,
      inline: false
    });
  }
  
  embed.setFooter({ text: 'Usa /ticket para gestionar la configuración' });
  
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function saveConfig(client) {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    await fs.writeFile(configPath, JSON.stringify(client.config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error al guardar configuración:', error);
  }
}