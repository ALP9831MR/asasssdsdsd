const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

module.exports = async (client) => {
  try {
    // Cargar comandos de prefijo
    await loadPrefixCommands(client);
    
    // Cargar y registrar slash commands
    await loadAndRegisterSlashCommands(client);
    
  } catch (error) {
    console.error(chalk.red('[ERROR] Error al cargar los comandos:'), error);
  }
};

async function loadPrefixCommands(client) {
  const prefixCommandsPath = path.join(__dirname, '..', 'commands', 'prefix');
  const commandFolders = fs.readdirSync(prefixCommandsPath);
  let prefixCommandCount = 0;

  for (const folder of commandFolders) {
    const folderPath = path.join(prefixCommandsPath, folder);
    // Verificar si es una carpeta
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if (!command.name) {
        console.warn(chalk.yellow(`[ADVERTENCIA] El comando ${file} no tiene nombre. Ignorando...`));
        continue;
      }

      // Guardar el comando en la colección
      client.prefixCommands.set(command.name, command);
      prefixCommandCount++;
    }
  }

  console.log(chalk.green(`[INFO] Se han cargado ${prefixCommandCount} comandos de prefijo.`));
}

async function loadAndRegisterSlashCommands(client) {
  const slashCommandsPath = path.join(__dirname, '..', 'commands', 'slash');
  const commandFolders = fs.readdirSync(slashCommandsPath);
  const slashCommands = [];
  let slashCommandCount = 0;

  for (const folder of commandFolders) {
    const folderPath = path.join(slashCommandsPath, folder);
    // Verificar si es una carpeta
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if (!command.data) {
        console.warn(chalk.yellow(`[ADVERTENCIA] El slash command ${file} no tiene datos. Ignorando...`));
        continue;
      }

      // Guardar el comando en la colección
      client.slashCommands.set(command.data.name, command);
      slashCommands.push(command.data.toJSON());
      slashCommandCount++;
    }
  }

  console.log(chalk.green(`[INFO] Se han cargado ${slashCommandCount} slash commands.`));

  // Registrar los slash commands en Discord API
  if (slashCommands.length > 0) {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
      console.log(chalk.blue('[INFO] Comenzando la actualización de los comandos de barra...'));

      // Para modo de desarrollo (solo un servidor específico)
      if (process.env.NODE_ENV === 'development' && process.env.GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
          { body: slashCommands }
        );
        console.log(chalk.green(`[INFO] Comandos de barra actualizados en el servidor de desarrollo (${process.env.GUILD_ID}).`));
      } 
      // Para producción (todos los servidores)
      else {
        await rest.put(
          Routes.applicationCommands(process.env.CLIENT_ID),
          { body: slashCommands }
        );
        console.log(chalk.green('[INFO] Comandos de barra actualizados globalmente.'));
      }
    } catch (error) {
      console.error(chalk.red('[ERROR] Error al registrar los comandos de barra:'), error);
    }
  }
}