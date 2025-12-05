const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'help',
  description: 'Muestra la lista de comandos disponibles',
  aliases: ['ayuda', 'comandos'],
  usage: '[comando]',
  cooldown: 5,
  async execute(message, args, client) {
    const { prefixCommands } = client;
    const prefix = process.env.PREFIX;

    // Si no hay argumentos, mostrar todos los comandos
    if (!args.length) {
      // Obtener las categorías (carpetas) de comandos
      const commandsPath = path.join(__dirname, '../../prefix');
      const categories = fs.readdirSync(commandsPath).filter(
        file => fs.statSync(path.join(commandsPath, file)).isDirectory()
      );

      // Crear embed para la ayuda
      const helpEmbed = new EmbedBuilder()
        .setColor(client.config.embedColors.primary)
        .setTitle('📚 Lista de Comandos')
        .setDescription(`Usa \`${prefix}help [comando]\` para obtener más información sobre un comando específico.`)
        .setTimestamp()
        .setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() });

      // Añadir campos para cada categoría
      for (const category of categories) {
        // Obtener comandos de esa categoría
        const categoryPath = path.join(commandsPath, category);
        const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        
        // Crear lista de comandos
        const commandsList = [];
        
        for (const file of commandFiles) {
          const command = require(path.join(categoryPath, file));
          commandsList.push(`\`${command.name}\``);
        }
        
        // Añadir campo si hay comandos
        if (commandsList.length) {
          helpEmbed.addFields({
            name: `${category.charAt(0).toUpperCase() + category.slice(1)}`,
            value: commandsList.join(', '),
            inline: false
          });
        }
      }

      // Enviar embed
      return message.reply({ embeds: [helpEmbed] });
    }

    // Si hay un argumento, buscar información del comando específico
    const commandName = args[0].toLowerCase();
    const command = prefixCommands.get(commandName) ||
                   prefixCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) {
      return message.reply({ content: `❌ No he encontrado el comando \`${commandName}\`.` });
    }

    // Crear embed para el comando específico
    const commandEmbed = new EmbedBuilder()
      .setColor(client.config.embedColors.primary)
      .setTitle(`Comando: ${command.name}`)
      .setTimestamp()
      .setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() });

    // Añadir información del comando
    if (command.description) {
      commandEmbed.setDescription(command.description);
    }

    // Añadir campos con detalles
    if (command.aliases && command.aliases.length) {
      commandEmbed.addFields({ name: 'Alias', value: command.aliases.join(', '), inline: true });
    }
    
    if (command.usage) {
      commandEmbed.addFields({ name: 'Uso', value: `\`${prefix}${command.name} ${command.usage}\``, inline: true });
    } else {
      commandEmbed.addFields({ name: 'Uso', value: `\`${prefix}${command.name}\``, inline: true });
    }
    
    if (command.cooldown) {
      commandEmbed.addFields({ name: 'Tiempo de espera', value: `${command.cooldown} segundos`, inline: true });
    }

    // Enviar embed
    message.reply({ embeds: [commandEmbed] });
  }
};