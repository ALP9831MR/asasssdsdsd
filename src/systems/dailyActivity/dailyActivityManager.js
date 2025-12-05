// ========================================
// 📁 systems/dailyActivity/dailyActivityManager.js
// ========================================

const { 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class DailyActivityManager {
  static dataPath = path.join(__dirname, '../../data/dailyActivity.json');
  static configPath = path.join(__dirname, '../../data/dailyActivityConfig.json');
  
  /**
   * Carga los datos de actividad diaria
   */
  static loadData() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        const initialData = {
          users: {},
          todayClicks: [],
          todayUserDetails: [],
          lastReset: new Date().toISOString().split('T')[0],
          weeklyStats: {},
          monthlyStats: {}
        };
        this.saveData(initialData);
        return initialData;
      }
      return JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
    } catch (error) {
      console.error('Error al cargar datos de actividad diaria:', error);
      return { 
        users: {}, 
        todayClicks: [], 
        todayUserDetails: [],
        lastReset: new Date().toISOString().split('T')[0],
        weeklyStats: {},
        monthlyStats: {}
      };
    }
  }
  
  /**
   * Guarda los datos de actividad diaria
   */
  static saveData(data) {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error al guardar datos de actividad diaria:', error);
    }
  }
  
  /**
   * Carga la configuración
   */
  static loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      console.error('Error al cargar config de actividad diaria:', error);
      return null;
    }
  }
  
  /**
   * Guarda la configuración
   */
  static saveConfig(config) {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error al guardar config de actividad diaria:', error);
    }
  }
  
  /**
   * Obtiene la semana actual (formato: YYYY-WXX)
   */
  static getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.ceil(diff / oneWeek);
    return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  
  /**
   * Obtiene el mes actual (formato: YYYY-MM)
   */
  static getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  /**
   * Calcula las insignias de un usuario
   */
  static calculateBadges(userData) {
    const badges = [];
    
    // Insignias por racha
    if (userData.maxStreak >= 7) badges.push({ emoji: '🔥', name: 'Semana Completa', desc: '7 días seguidos' });
    if (userData.maxStreak >= 30) badges.push({ emoji: '⭐', name: 'Mes Dedicado', desc: '30 días seguidos' });
    if (userData.maxStreak >= 100) badges.push({ emoji: '💎', name: 'Diamante', desc: '100 días seguidos' });
    if (userData.maxStreak >= 365) badges.push({ emoji: '👑', name: 'Leyenda', desc: '1 año seguido' });
    
    // Insignias por total de clicks
    if (userData.totalClicks >= 50) badges.push({ emoji: '🎯', name: 'Activo', desc: '50 clicks totales' });
    if (userData.totalClicks >= 100) badges.push({ emoji: '🏆', name: 'Comprometido', desc: '100 clicks totales' });
    if (userData.totalClicks >= 500) badges.push({ emoji: '🌟', name: 'Estrella', desc: '500 clicks totales' });
    
    // Insignia especial
    if (userData.revivedStreak) badges.push({ emoji: '🔄', name: 'Segunda Oportunidad', desc: 'Usó revivir racha' });
    
    return badges;
  }
  
  /**
   * Configura el sistema de actividad diaria
   */
  static async setupDailyActivity(interaction, client, canal, logs, rol, objetivo) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const config = {
        guildId: interaction.guild.id,
        channelId: canal.id,
        logsChannelId: logs.id,
        notificationRoleId: rol ? rol.id : null,
        messageId: null,
        dailyGoal: objetivo,
        reminderSent: false
      };
      
      this.saveConfig(config);
      
      // Enviar mensaje inicial
      const embed = this.createDailyEmbed(client, [], [], objetivo);
      const button = this.createDailyButton();
      
      const mentionText = rol ? `<@&${rol.id}>` : '@everyone';
      
      const message = await canal.send({
        content: mentionText,
        embeds: [embed],
        components: [button]
      });
      
      config.messageId = message.id;
      this.saveConfig(config);
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Sistema Configurado')
        .setDescription(`**Sistema de actividad diaria configurado exitosamente!**\n\n` +
          `📍 **Canal de actividad:** ${canal}\n` +
          `📝 **Canal de logs:** ${logs}\n` +
          `🔔 **Notificación:** ${rol ? rol : '@everyone'}\n` +
          `🎯 **Objetivo diario:** ${objetivo} personas\n\n` +
          `**Funcionalidades activas:**\n` +
          `✨ Auto-reset diario a las 00:00\n` +
          `⏰ Recordatorio automático a las 23:00\n` +
          `📊 Estadísticas semanales y mensuales\n` +
          `🏆 Sistema de insignias\n` +
          `🔄 Revivir racha (1 vez/mes por usuario)`)
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Error al configurar actividad diaria:', error);
      await interaction.followUp({
        content: '❌ Error al configurar el sistema de actividad diaria.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  /**
   * Crea el embed de actividad diaria
   */
  static createDailyEmbed(client, todayClicks, userDetails = [], goal = 30) {
    const today = new Date().toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Mostrar solo los primeros 10 usuarios
    const displayUsers = userDetails.slice(0, 10);
    
    const clicksText = displayUsers.length === 0 
      ? '*Nadie ha presionado el botón todavía hoy...*' 
      : displayUsers.map((user, index) => {
          return `**${index + 1}.** <@${user.id}> (\`${user.username}\`)`;
        }).join('\n');
    
    // Si hay más de 10, mostrar cuántos más clickearon
    const moreUsers = todayClicks.length > 10 ? `\n\n*+${todayClicks.length - 10} personas más han clickeado hoy*` : '';
    
    const progressBar = this.createProgressBar(todayClicks.length, goal);
    
    // Emoji según progreso
    let statusEmoji = '😴';
    const percentage = (todayClicks.length / goal) * 100;
    if (percentage >= 100) statusEmoji = '🎉';
    else if (percentage >= 75) statusEmoji = '🔥';
    else if (percentage >= 50) statusEmoji = '💪';
    else if (percentage >= 25) statusEmoji = '👍';
    
    return new EmbedBuilder()
      .setColor(percentage >= 100 ? '#00FF00' : '#5865F2')
      .setTitle(`${statusEmoji} Actividad Diaria`)
      .setDescription(
        `¡Hola a todos! 👋\n\n` +
        `Presiona el botón de abajo para registrar tu actividad diaria y mantener tu racha activa.\n\n` +
        `**📅 Fecha:** ${today}\n` +
        `**👥 Actividad de hoy:** ${todayClicks.length}/${goal} personas\n\n` +
        `${progressBar}\n\n` +
        `**Primeros 10 en clickear hoy:**\n${clicksText}${moreUsers}`
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: '¡Mantén tu racha activa cada día! 🔥' })
      .setTimestamp();
  }
  
  /**
   * Crea una barra de progreso visual
   */
  static createProgressBar(current, max) {
    const percentage = Math.min(Math.floor((current / max) * 100), 100);
    const filled = Math.floor((current / max) * 10);
    const empty = 10 - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `\`${bar}\` ${percentage}%`;
  }
  
  /**
   * Crea el botón de actividad diaria
   */
  static createDailyButton() {
    const button = new ButtonBuilder()
      .setCustomId('daily_activity_click')
      .setLabel('¡Presionar Actividad!')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Primary);
    
    return new ActionRowBuilder().addComponents(button);
  }
  
  /**
   * Maneja el click del botón de actividad
   */
  static async handleDailyClick(interaction, client) {
    try {
      const data = this.loadData();
      const config = this.loadConfig();
      const userId = interaction.user.id;
      const today = new Date().toISOString().split('T')[0];
      const currentWeek = this.getCurrentWeek();
      const currentMonth = this.getCurrentMonth();
      
      // Verificar si es un nuevo día
      if (data.lastReset !== today) {
        data.todayClicks = [];
        data.todayUserDetails = [];
        data.lastReset = today;
      }
      
      // Verificar si ya clickeó hoy
      if (data.todayClicks.includes(userId)) {
        return interaction.reply({
          content: '⚠️ Ya has registrado tu actividad diaria hoy. ¡Vuelve mañana!',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Inicializar datos del usuario si no existen
      if (!data.users[userId]) {
        data.users[userId] = {
          totalClicks: 0,
          currentStreak: 0,
          maxStreak: 0,
          lastClick: null,
          revivedStreak: false,
          lastRevive: null
        };
      }
      
      const userData = data.users[userId];
      
      // CORRECCIÓN: Calcular diferencia de días correctamente
      let daysSinceLastClick = 0;
      if (userData.lastClick) {
        const lastClickDate = new Date(userData.lastClick);
        const todayDate = new Date(today);
        daysSinceLastClick = Math.floor((todayDate - lastClickDate) / (1000 * 60 * 60 * 24));
      }
      
      // Actualizar racha con lógica corregida
      if (userData.lastClick === null) {
        // Primera vez
        userData.currentStreak = 1;
      } else if (daysSinceLastClick === 1) {
        // Día consecutivo
        userData.currentStreak++;
      } else if (daysSinceLastClick > 1) {
        // Racha perdida
        userData.currentStreak = 1;
      }
      
      userData.totalClicks++;
      userData.lastClick = today;
      userData.maxStreak = Math.max(userData.maxStreak, userData.currentStreak);
      
      // Actualizar estadísticas semanales
      if (!data.weeklyStats[currentWeek]) {
        data.weeklyStats[currentWeek] = {};
      }
      data.weeklyStats[currentWeek][userId] = (data.weeklyStats[currentWeek][userId] || 0) + 1;
      
      // Actualizar estadísticas mensuales
      if (!data.monthlyStats[currentMonth]) {
        data.monthlyStats[currentMonth] = {};
      }
      data.monthlyStats[currentMonth][userId] = (data.monthlyStats[currentMonth][userId] || 0) + 1;
      
      // Agregar a clicks de hoy con detalles del usuario
      data.todayClicks.push(userId);
      if (!data.todayUserDetails) data.todayUserDetails = [];
      data.todayUserDetails.push({
        id: userId,
        username: interaction.user.username
      });
      
      // Guardar datos
      this.saveData(data);
      
      // Actualizar el embed EN EL MISMO MENSAJE
      if (config && config.messageId && config.channelId) {
        try {
          const channel = await client.channels.fetch(config.channelId);
          const message = await channel.messages.fetch(config.messageId);
          const embed = this.createDailyEmbed(client, data.todayClicks, data.todayUserDetails, config.dailyGoal || 30);
          
          const mentionText = config.notificationRoleId ? `<@&${config.notificationRoleId}>` : '@everyone';
          
          await message.edit({ 
            content: mentionText,
            embeds: [embed], 
            components: [this.createDailyButton()] 
          });
        } catch (error) {
          console.error('Error al actualizar mensaje de actividad:', error);
        }
      }
      
      // Enviar log
      if (config && config.logsChannelId) {
        await this.sendLog(client, config.logsChannelId, interaction.user, userData, data.todayClicks.length, config.dailyGoal || 30);
      }
      
      // Calcular insignias
      const badges = this.calculateBadges(userData);
      const badgesText = badges.length > 0 
        ? `\n\n🏆 **Insignias:** ${badges.map(b => b.emoji).join(' ')}` 
        : '';
      
      // Respuesta al usuario
      const responseEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ ¡Actividad Registrada!')
        .setDescription(
          `¡Genial ${interaction.user}! Has registrado tu actividad diaria.\n\n` +
          `🔥 **Racha actual:** ${userData.currentStreak} días\n` +
          `🏆 **Racha máxima:** ${userData.maxStreak} días\n` +
          `📊 **Total de clicks:** ${userData.totalClicks}\n` +
          `👥 **Personas activas hoy:** ${data.todayClicks.length}/${config.dailyGoal || 30}${badgesText}`
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: '¡Sigue así y mantén tu racha!' })
        .setTimestamp();
      
      // Mensajes especiales por hitos
      if (userData.currentStreak === 7) {
        responseEmbed.addFields({
          name: '🎉 ¡Nueva Insignia Desbloqueada!',
          value: '🔥 **Semana Completa** - 7 días consecutivos!'
        });
      } else if (userData.currentStreak === 30) {
        responseEmbed.addFields({
          name: '🎊 ¡Nueva Insignia Desbloqueada!',
          value: '⭐ **Mes Dedicado** - 30 días consecutivos!'
        });
      } else if (userData.currentStreak === 100) {
        responseEmbed.addFields({
          name: '💎 ¡INSIGNIA ÉPICA DESBLOQUEADA!',
          value: '💎 **Diamante** - ¡100 días consecutivos! Eres increíble!'
        });
      } else if (userData.currentStreak % 10 === 0 && userData.currentStreak > 0) {
        responseEmbed.addFields({
          name: '🎉 ¡Hito Alcanzado!',
          value: `Has alcanzado **${userData.currentStreak} días** consecutivos! 🎊`
        });
      }
      
      await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al manejar click de actividad diaria:', error);
      await interaction.reply({
        content: '❌ Error al registrar tu actividad. Intenta de nuevo.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Envía un log al canal de registros
   */
  static async sendLog(client, logsChannelId, user, userData, totalToday, goal) {
    try {
      const logsChannel = await client.channels.fetch(logsChannelId);
      
      const badges = this.calculateBadges(userData);
      const badgesText = badges.length > 0 ? badges.map(b => `${b.emoji} ${b.name}`).join(', ') : 'Ninguna';
      
      const logEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ 
          name: `${user.tag} registró su actividad`, 
          iconURL: user.displayAvatarURL() 
        })
        .addFields(
          { name: '👤 Usuario', value: `${user}`, inline: true },
          { name: '🔥 Racha', value: `${userData.currentStreak} días`, inline: true },
          { name: '📊 Total', value: `${userData.totalClicks} clicks`, inline: true },
          { name: '👥 Progreso Hoy', value: `${totalToday}/${goal} personas`, inline: false },
          { name: '🏆 Insignias', value: badgesText, inline: false }
        )
        .setTimestamp();
      
      await logsChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Error al enviar log de actividad:', error);
    }
  }
  
  /**
   * Envía manualmente el mensaje de actividad
   */
  static async sendDailyMessage(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const config = this.loadConfig();
      
      if (!config) {
        return interaction.followUp({
          content: '❌ Primero debes configurar el sistema con `/dailyactivity setup`',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Eliminar mensaje anterior si existe
      if (config.messageId && config.channelId) {
        try {
          const channel = await client.channels.fetch(config.channelId);
          const oldMessage = await channel.messages.fetch(config.messageId);
          await oldMessage.delete();
        } catch (error) {
          console.log('No se pudo eliminar el mensaje anterior:', error.message);
        }
      }
      
      const channel = await client.channels.fetch(config.channelId);
      const data = this.loadData();
      const embed = this.createDailyEmbed(client, data.todayClicks, data.todayUserDetails || [], config.dailyGoal || 30);
      const button = this.createDailyButton();
      
      const mentionText = config.notificationRoleId ? `<@&${config.notificationRoleId}>` : '@everyone';
      
      const message = await channel.send({
        content: mentionText,
        embeds: [embed],
        components: [button]
      });
      
      config.messageId = message.id;
      this.saveConfig(config);
      
      await interaction.followUp({
        content: '✅ Mensaje de actividad diaria enviado correctamente.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error al enviar mensaje de actividad:', error);
      await interaction.followUp({
        content: '❌ Error al enviar el mensaje.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  /**
   * Muestra estadísticas generales o por periodo
   */
  static async showStats(interaction, client, periodo = 'alltime') {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const data = this.loadData();
      let title = '📊 Estadísticas de Actividad Diaria';
      let usersToShow = {};
      
      if (periodo === 'weekly') {
        const currentWeek = this.getCurrentWeek();
        usersToShow = data.weeklyStats[currentWeek] || {};
        title = `📊 Estadísticas de Esta Semana (${currentWeek})`;
      } else if (periodo === 'monthly') {
        const currentMonth = this.getCurrentMonth();
        usersToShow = data.monthlyStats[currentMonth] || {};
        title = `📊 Estadísticas de Este Mes (${currentMonth})`;
      } else if (periodo === 'daily') {
        title = `📊 Estadísticas de Hoy`;
        data.todayClicks.forEach(userId => {
          usersToShow[userId] = 1;
        });
      } else {
        // All time - usar rachas actuales y totales
        Object.entries(data.users).forEach(([userId, userData]) => {
          usersToShow[userId] = userData.totalClicks;
        });
      }
      
      // Top 10 por el periodo seleccionado
      const topUsers = Object.entries(usersToShow)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
      
      // Top rachas actuales (solo para alltime)
      let topStreaks = [];
      if (periodo === 'alltime') {
        topStreaks = Object.entries(data.users)
          .filter(([, userData]) => userData.currentStreak > 0)
          .sort(([, a], [, b]) => b.currentStreak - a.currentStreak)
          .slice(0, 10);
      }
      
      const usersText = topUsers.length === 0 
        ? '*No hay datos aún*' 
        : topUsers.map(([userId, count], index) => {
            if (periodo === 'alltime') {
              const streak = data.users[userId]?.currentStreak || 0;
              return `**${index + 1}.** <@${userId}> - **${count}** clicks (🔥 ${streak} días)`;
            }
            return `**${index + 1}.** <@${userId}> - **${count}** ${periodo === 'daily' ? 'click' : 'clicks'}`;
          }).join('\n');
      
      const statsEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(title)
        .setDescription(periodo === 'daily' 
          ? `**Personas activas hoy:** ${data.todayClicks.length}\n\n**🏆 Ranking de Hoy:**\n${usersText}`
          : `**🏆 Top ${periodo === 'alltime' ? 'General' : 'del Periodo'}**\n${usersText}`)
        .setTimestamp();
      
      // Agregar top rachas solo para alltime
      if (periodo === 'alltime' && topStreaks.length > 0) {
        const streaksText = topStreaks.map(([userId, userData], index) => 
          `**${index + 1}.** <@${userId}> - **${userData.currentStreak}** días 🔥`
        ).join('\n');
        
        statsEmbed.addFields({
          name: '🔥 Top Rachas Actuales',
          value: streaksText
        });
      }
      
      await interaction.followUp({ embeds: [statsEmbed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Error al mostrar estadísticas:', error);
      await interaction.followUp({
        content: '❌ Error al obtener estadísticas.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  /**
   * Reinicia el contador diario
   */
  static async resetDaily(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const data = this.loadData();
      data.todayClicks = [];
      data.todayUserDetails = [];
      data.lastReset = new Date().toISOString().split('T')[0];
      this.saveData(data);
      
      const config = this.loadConfig();
      if (config && config.channelId) {
        try {
          // Eliminar mensaje anterior si existe
          if (config.messageId) {
            const channel = await client.channels.fetch(config.channelId);
            const oldMessage = await channel.messages.fetch(config.messageId);
            await oldMessage.delete();
          }
        } catch (error) {
          console.log('No se pudo eliminar el mensaje anterior:', error.message);
        }
        
        // Crear nuevo mensaje
        const channel = await client.channels.fetch(config.channelId);
        const embed = this.createDailyEmbed(client, [], [], config.dailyGoal || 30);
        
        const mentionText = config.notificationRoleId ? `<@&${config.notificationRoleId}>` : '@everyone';
        
        const newMessage = await channel.send({
          content: mentionText,
          embeds: [embed],
          components: [this.createDailyButton()]
        });
        
        config.messageId = newMessage.id;
        config.reminderSent = false;
        this.saveConfig(config);
      }
      
      await interaction.followUp({
        content: '✅ Contador diario reiniciado y nuevo mensaje creado correctamente.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error al reiniciar contador:', error);
      await interaction.followUp({
        content: '❌ Error al reiniciar el contador.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  /**
   * Revive la racha de un usuario (1 vez al mes)
   */
  static async reviveStreak(interaction, client, targetUser) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const data = this.loadData();
      const userId = targetUser.id;
      
      if (!data.users[userId]) {
        return interaction.followUp({
          content: `❌ ${targetUser} no tiene datos de actividad registrados.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      const userData = data.users[userId];
      const now = new Date();
      const currentMonth = this.getCurrentMonth();
      
      // Verificar si ya usó el revive este mes
      if (userData.lastRevive && userData.lastRevive.startsWith(currentMonth)) {
        return interaction.followUp({
          content: `❌ ${targetUser} ya usó su revivir de racha este mes. Solo se puede usar 1 vez al mes.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Verificar que tenga una racha perdida para revivir
      if (userData.currentStreak > 0) {
        return interaction.followUp({
          content: `❌ ${targetUser} ya tiene una racha activa de ${userData.currentStreak} días.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Revivir la racha (usar la racha máxima o 1)
      const revivedStreak = userData.maxStreak > 0 ? userData.maxStreak : 1;
      userData.currentStreak = revivedStreak;
      userData.revivedStreak = true;
      userData.lastRevive = now.toISOString().split('T')[0];
      userData.lastClick = now.toISOString().split('T')[0];
      
      this.saveData(data);
      
      // Log del revive
      const config = this.loadConfig();
      if (config && config.logsChannelId) {
        try {
          const logsChannel = await client.channels.fetch(config.logsChannelId);
          const logEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🔄 Racha Revivida')
            .setDescription(`${interaction.user} revivió la racha de ${targetUser}`)
            .addFields(
              { name: '👤 Usuario', value: `${targetUser}`, inline: true },
              { name: '🔥 Racha Revivida', value: `${revivedStreak} días`, inline: true },
              { name: '📅 Fecha', value: now.toLocaleDateString('es-ES'), inline: true }
            )
            .setTimestamp();
          
          await logsChannel.send({ embeds: [logEmbed] });
        } catch (error) {
          console.error('Error al enviar log de revive:', error);
        }
      }
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Racha Revivida')
        .setDescription(
          `La racha de ${targetUser} ha sido revivida exitosamente!\n\n` +
          `🔥 **Racha restaurada:** ${revivedStreak} días\n` +
          `🔄 **Próximo revive disponible:** Siguiente mes\n\n` +
          `*Nota: Solo se puede revivir 1 vez al mes por usuario.*`
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al revivir racha:', error);
      await interaction.followUp({
        content: '❌ Error al revivir la racha.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  /**
   * Muestra las insignias de un usuario
   */
  static async showBadges(interaction, client, targetUser) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const data = this.loadData();
      const userId = targetUser.id;
      
      if (!data.users[userId]) {
        return interaction.followUp({
          content: `❌ ${targetUser.username} no tiene datos de actividad registrados.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      const userData = data.users[userId];
      const badges = this.calculateBadges(userData);
      
      let badgesText = '';
      if (badges.length === 0) {
        badgesText = '*No ha desbloqueado insignias todavía*\n\n' +
          '**Insignias disponibles:**\n' +
          '🔥 Semana Completa - 7 días seguidos\n' +
          '⭐ Mes Dedicado - 30 días seguidos\n' +
          '💎 Diamante - 100 días seguidos\n' +
          '👑 Leyenda - 365 días seguidos\n' +
          '🎯 Activo - 50 clicks totales\n' +
          '🏆 Comprometido - 100 clicks totales\n' +
          '🌟 Estrella - 500 clicks totales';
      } else {
        badgesText = badges.map(b => `${b.emoji} **${b.name}** - ${b.desc}`).join('\n');
      }
      
      const badgesEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🏆 Insignias de ${targetUser.username}`)
        .setDescription(
          `**Total de insignias:** ${badges.length}\n\n` +
          badgesText
        )
        .addFields(
          { name: '🔥 Racha Actual', value: `${userData.currentStreak} días`, inline: true },
          { name: '🏆 Racha Máxima', value: `${userData.maxStreak} días`, inline: true },
          { name: '📊 Total Clicks', value: `${userData.totalClicks}`, inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: '¡Sigue clickeando para desbloquear más!' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [badgesEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al mostrar insignias:', error);
      await interaction.followUp({
        content: '❌ Error al obtener las insignias.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  /**
   * Envía recordatorio automático a las 23:00 a usuarios con racha alta
   */
  static async sendReminder(client) {
    try {
      const config = this.loadConfig();
      if (!config || config.reminderSent) return;
      
      const data = this.loadData();
      const today = new Date().toISOString().split('T')[0];
      
      // Verificar que sea el día correcto
      if (data.lastReset !== today) return;
      
      // Buscar usuarios con racha >= 7 días que no han clickeado hoy
      const usersToRemind = Object.entries(data.users)
        .filter(([userId, userData]) => {
          return userData.currentStreak >= 7 && !data.todayClicks.includes(userId);
        })
        .slice(0, 10); // Limitar a 10 usuarios para no hacer spam
      
      if (usersToRemind.length === 0) {
        config.reminderSent = true;
        this.saveConfig(config);
        return;
      }
      
      const channel = await client.channels.fetch(config.channelId);
      
      const mentions = usersToRemind.map(([userId]) => `<@${userId}>`).join(' ');
      
      const reminderEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏰ ¡Recordatorio de Actividad!')
        .setDescription(
          `¡Hola! Tienes una racha activa y aún no has registrado tu actividad hoy.\n\n` +
          `⚠️ **¡El día termina pronto!**\n` +
          `No pierdas tu racha, presiona el botón de actividad antes de las **00:00**.\n\n` +
          `${mentions}`
        )
        .setFooter({ text: 'Este recordatorio se envía a las 23:00 para usuarios con racha >= 7 días' })
        .setTimestamp();
      
      await channel.send({ embeds: [reminderEmbed] });
      
      config.reminderSent = true;
      this.saveConfig(config);
      
      console.log(`✅ Recordatorio enviado a ${usersToRemind.length} usuarios con racha alta`);
      
    } catch (error) {
      console.error('Error al enviar recordatorio:', error);
    }
  }
}

module.exports = DailyActivityManager;