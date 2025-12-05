// ========================================
// 📁 events/ready.js (ARCHIVO COMPLETO MEJORADO)
// ========================================

const chalk = require('chalk');
const { ActivityType } = require('discord.js');
const cron = require('node-cron');
const DailyActivityManager = require('../systems/dailyActivity/dailyActivityManager');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    try {
      // Establecer la actividad del bot
      client.user.setPresence({
        status: 'dnd',
        activities: [
          {
            name: '🌌 SkyRich Community',
            type: ActivityType.Watching
          }
        ]
      });
      
      // Registrar información del bot
      console.log(chalk.green('╔═════════════════════════════════════════════════════╗'));
      console.log(chalk.green(`║ Bot ${client.user.username} está en línea!`));
      console.log(chalk.green(`║ ID: ${client.user.id}`));
      console.log(chalk.green(`║ Servidores: ${client.guilds.cache.size}`));
      console.log(chalk.green(`║ Usuarios: ${client.users.cache.size}`));
      console.log(chalk.green(`║ Discord.js: v${require('discord.js').version}`));
      console.log(chalk.green(`║ Node.js: ${process.version}`));
      console.log(chalk.green('╚═════════════════════════════════════════════════════╝'));
      
      // ========================================
      // 🌅 AUTO-RESET DIARIO (00:00 GMT-6)
      // ========================================
      cron.schedule('0 0 * * *', async () => {
        try {
          const config = DailyActivityManager.loadConfig();
          if (!config) return;
          
          const data = DailyActivityManager.loadData();
          const today = new Date().toISOString().split('T')[0];
          
          if (data.lastReset !== today) {
            data.todayClicks = [];
            data.todayUserDetails = [];
            data.lastReset = today;
            DailyActivityManager.saveData(data);
            
            // Eliminar mensaje anterior
            try {
              const channel = await client.channels.fetch(config.channelId);
              if (config.messageId) {
                const oldMessage = await channel.messages.fetch(config.messageId);
                await oldMessage.delete();
              }
            } catch (error) {
              console.log('No se pudo eliminar mensaje anterior:', error.message);
            }
            
            // Crear nuevo mensaje
            const channel = await client.channels.fetch(config.channelId);
            const embed = DailyActivityManager.createDailyEmbed(client, [], [], config.dailyGoal || 30);
            
            const mentionText = config.notificationRoleId ? `<@&${config.notificationRoleId}>` : '@everyone';
            
            const newMessage = await channel.send({ 
              content: mentionText,
              embeds: [embed], 
              components: [DailyActivityManager.createDailyButton()] 
            });
            
            config.messageId = newMessage.id;
            config.reminderSent = false; // Resetear flag de recordatorio
            DailyActivityManager.saveConfig(config);
            
            console.log(chalk.cyan('✅ Nuevo mensaje de actividad diaria creado automáticamente (00:00)'));
          }
        } catch (error) {
          console.error(chalk.red('Error en reset automático de actividad diaria:'), error);
        }
      }, {
        timezone: "America/Guatemala"
      });
      
      // ========================================
      // ⏰ RECORDATORIO AUTOMÁTICO (23:00 GMT-6)
      // ========================================
      cron.schedule('0 23 * * *', async () => {
        try {
          await DailyActivityManager.sendReminder(client);
          console.log(chalk.yellow('⏰ Recordatorio de actividad enviado (23:00)'));
        } catch (error) {
          console.error(chalk.red('Error al enviar recordatorio automático:'), error);
        }
      }, {
        timezone: "America/Guatemala"
      });
      
      console.log(chalk.cyan('⏰ Sistema de auto-reset activado (00:00 GMT-6)'));
      console.log(chalk.yellow('⏰ Sistema de recordatorios activado (23:00 GMT-6)'));
      
    } catch (error) {
      console.error(chalk.red('[ERROR] Error en el evento ready:'), error);
    }
  }
};