const { PermissionFlagsBits } = require('discord.js');
const EmbedUtil = require('../../../utils/embedBuilder');

module.exports = {
  name: 'ip', // Nombre del comando (sin el prefijo)
  description: 'Muestra la información de IP del servidor NeonCity RP',
  aliases: ['servidor', 'server'], // Nombres alternativos para el comando
  usage: '', // No requiere argumentos
  cooldown: 3, // Tiempo en segundos entre usos del comando
  permissions: [], // No requiere permisos especiales
  botPermissions: [PermissionFlagsBits.SendMessages], // El bot necesita poder enviar mensajes
  args: false, // El comando no requiere argumentos
  guildOnly: true, // El comando solo funciona en servidores
  
  async execute(message, args, client) {
    // Mensaje a enviar
    const ipMessage = `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                                                                                       
**[ESP] NeonCity RP (PC/ANDROID)**
**IP:** neoncity.es:7777
﻿
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`;

    // Enviar el mensaje como respuesta
    await message.channel.send(ipMessage);
  }
};