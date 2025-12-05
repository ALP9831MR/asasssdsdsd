const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = async (client) => {
  try {
    // Leer la carpeta de eventos
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    let eventCount = 0;

    // Recorrer y registrar cada evento
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);
      
      if (!event.name || !event.execute) {
        console.warn(chalk.yellow(`[ADVERTENCIA] El evento ${file} no tiene nombre o método execute. Ignorando...`));
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      
      eventCount++;
    }

    console.log(chalk.green(`[INFO] Se han cargado ${eventCount} eventos.`));
  } catch (error) {
    console.error(chalk.red('[ERROR] Error al cargar los eventos:'), error);
  }
};