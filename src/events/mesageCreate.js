// ========================================
// 📁 events/messageCreate.js
// ========================================

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const EmbedUtil = require('../utils/embedBuilder');
const ValidationUtil = require('../utils/validation');
const EmbedManager = require('../systems/embeds/embedManager');
const AutoModManager = require('../systems/moderation/automodManager');
const VerificationManager = require('../systems/moderation/verificationManager');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    try {
      // Ignorar mensajes de bots
      if (message.author.bot) return;

      // ===== SISTEMA DE VERIFICACIÓN (CAPTCHA/PREGUNTA) =====
      // Verificar si el usuario tiene una verificación pendiente
      if (message.guild && VerificationManager.pendingVerifications.has(message.author.id)) {
        await VerificationManager.checkVerificationResponse(message, client);
        return; // No procesar como comando
      }
      // ===== FIN SISTEMA DE VERIFICACIÓN =====

      // ===== SISTEMA DE AUTO-MODERACIÓN =====
      // Verificar mensaje con AutoMod (solo en servidores)
      if (message.guild) {
        await AutoModManager.checkMessage(message, client);
        
        // Si el mensaje fue eliminado por AutoMod, no continuar
        if (message.deletedAt || !message.channel) return;
      }
      // ===== FIN AUTO-MODERACIÓN =====

      // ===== SISTEMA DE IMÁGENES PARA EMBEDS =====
      // Verificar si el bot fue mencionado y hay archivos adjuntos
      if (message.mentions.has(client.user.id) && message.attachments.size > 0) {
        // Buscar si este usuario tiene un embed en construcción esperando imagen
        const userCacheKeys = Array.from(EmbedManager.embedCache.keys())
          .filter(key => key.startsWith(message.author.id));
        
        if (userCacheKeys.length > 0) {
          // Tomar la más reciente
          const cacheKey = userCacheKeys[userCacheKeys.length - 1];
          const cachedData = EmbedManager.embedCache.get(cacheKey);
          
          if (cachedData && cachedData.awaitingImage) {
            const imageType = cachedData.awaitingImage;
            const attachment = message.attachments.first();
            
            // Verificar que sea una imagen
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
              // Añadir la imagen al embed
              if (imageType === 'addimage') {
                cachedData.embed.setImage(attachment.url);
              } else if (imageType === 'addthumbnail') {
                cachedData.embed.setThumbnail(attachment.url);
              }
              
              // Limpiar flag de espera
              delete cachedData.awaitingImage;
              EmbedManager.embedCache.set(cacheKey, cachedData);
              
              // Actualizar la vista previa
              try {
                const channel = message.channel;
                
                // Buscar el mensaje de vista previa
                const messages = await channel.messages.fetch({ limit: 50 });
                const previewMessage = messages.find(msg => 
                  msg.author.id === client.user.id && 
                  msg.embeds.length > 0 &&
                  msg.components.length > 0 &&
                  msg.components.some(row => 
                    row.components.some(btn => 
                      btn.customId && btn.customId.includes(cacheKey)
                    )
                  )
                );
                
                if (previewMessage) {
                  let previewContent = '📝 **Vista previa:**\n';
                  if (cachedData.message) {
                    previewContent += `\n**Mensaje:**\n${cachedData.message}\n\n**Embed:**`;
                  }
                  
                  if (cachedData.buttons.length > 0) {
                    previewContent += `\n\n🔘 **Botones añadidos:** ${cachedData.buttons.length}/25`;
                  }
                  
                  await previewMessage.edit({
                    content: previewContent,
                    embeds: [cachedData.embed],
                    components: previewMessage.components
                  });
                  
                  await message.react('✅');
                  await message.reply({
                    content: `✅ ${imageType === 'addimage' ? 'Imagen' : 'Miniatura'} añadida correctamente al embed.`,
                    allowedMentions: { repliedUser: false }
                  }).then(msg => {
                    setTimeout(() => msg.delete().catch(() => {}), 5000);
                  });
                  
                  // Eliminar el mensaje del usuario después de 5 segundos
                  setTimeout(() => {
                    message.delete().catch(() => {});
                  }, 5000);
                  
                  return; // Importante: salir aquí para no procesar como comando
                }
              } catch (error) {
                console.error('Error al actualizar vista previa con imagen:', error);
                await message.react('❌');
              }
            } else {
              await message.reply({
                content: '❌ El archivo debe ser una imagen (PNG, JPG, GIF, etc.)',
                allowedMentions: { repliedUser: false }
              }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
              });
              return; // Salir aquí también
            }
          }
        }
      }
      // ===== FIN SISTEMA DE IMÁGENES =====

      // ===== SISTEMA DE COMANDOS PREFIX =====
      // Ignorar si no empieza con el prefijo
      if (!message.content.startsWith(process.env.PREFIX)) return;

      // Obtener argumentos y nombre del comando
      const args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      // Buscar el comando
      const command = client.prefixCommands.get(commandName) || 
                      client.prefixCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

      // Si no se encuentra el comando, ignorar
      if (!command) return;

      // Verificar si el comando solo puede ser usado en servidores
      if (command.guildOnly && !message.guild) {
        return message.reply({ 
          embeds: [EmbedUtil.errorEmbed(client, 'Este comando solo puede ser usado en servidores.')] 
        });
      }

      // Verificar permisos del usuario
      if (command.permissions && message.guild) {
        const member = message.guild.members.cache.get(message.author.id);
        if (!ValidationUtil.hasPermissions(member, command.permissions)) {
          return message.reply({ 
            embeds: [EmbedUtil.errorEmbed(client, 'No tienes los permisos necesarios para usar este comando.')] 
          });
        }
      }

      // Verificar permisos del bot
      if (command.botPermissions && message.guild) {
        const botMember = message.guild.members.cache.get(client.user.id);
        if (!ValidationUtil.botHasPermissions(botMember, command.botPermissions)) {
          return message.reply({ 
            embeds: [EmbedUtil.errorEmbed(client, 'No tengo los permisos necesarios para ejecutar este comando.')] 
          });
        }
      }

      // Verificar argumentos requeridos
      if (command.args && !args.length) {
        let reply = 'No proporcionaste ningún argumento.';
        
        if (command.usage) {
          reply += `\nEl uso correcto sería: \`${process.env.PREFIX}${command.name} ${command.usage}\``;
        }
        
        return message.reply({ embeds: [EmbedUtil.warningEmbed(client, reply)] });
      }

      // Verificar cooldown
      const cooldownTime = command.cooldown || 3; // 3 segundos por defecto
      const timeLeft = ValidationUtil.checkCooldown(client.cooldowns, command.name, message.author.id, cooldownTime);
      
      if (timeLeft) {
        return message.reply({ 
          embeds: [EmbedUtil.warningEmbed(client, `Por favor espera ${timeLeft} segundos más antes de usar el comando \`${command.name}\`.`)] 
        });
      }

      // Ejecutar comando
      try {
        await command.execute(message, args, client);
      } catch (error) {
        console.error(`Error al ejecutar el comando ${command.name}:`, error);
        message.reply({ 
          embeds: [EmbedUtil.errorEmbed(client, 'Ocurrió un error al ejecutar el comando.')] 
        });
      }
      // ===== FIN SISTEMA DE COMANDOS PREFIX =====

    } catch (error) {
      console.error('Error en el evento messageCreate:', error);
    }
  }
};