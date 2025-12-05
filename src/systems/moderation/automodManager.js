// ========================================
// 📁 systems/moderation/automodManager.js
// ========================================

const { 
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class AutoModManager {
  static configPath = path.join(__dirname, '../../data/moderation/automod.json');
  static userSpamCache = new Map(); // Cache para detectar spam
  
  /**
   * Carga la configuración
   */
  static loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        const initialConfig = { guilds: {} };
        this.saveConfig(initialConfig);
        return initialConfig;
      }
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      console.error('Error al cargar config de automod:', error);
      return { guilds: {} };
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
      console.error('Error al guardar config de automod:', error);
    }
  }
  
  /**
   * Genera un ID único para reglas
   */
  static generateRuleId() {
    return `R${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  }
  
  /**
   * Obtiene el nombre del tipo de regla
   */
  static getRuleName(type) {
    const names = {
      'spam': '🔁 Anti-Spam',
      'links': '🔗 Anti-Links',
      'invites': '📢 Anti-Invitaciones',
      'caps': '🔠 Anti-CAPS',
      'mentions': '@️⃣ Anti-Menciones Masivas',
      'emojis': '😀 Anti-Emoji Spam',
      'badwords': '🚫 Palabras Prohibidas'
    };
    return names[type] || type;
  }
  
  /**
   * Obtiene el nombre del castigo
   */
  static getPunishmentName(punishment) {
    const names = {
      'delete': 'Borrar Mensaje',
      'warn': 'Warn',
      'timeout5': 'Timeout 5min',
      'timeout30': 'Timeout 30min',
      'kick': 'Kick'
    };
    return names[punishment] || punishment;
  }
  
  /**
   * Configura el sistema de auto-moderación
   */
  static async setup(interaction, client, canalLogs) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        config.guilds[guildId] = {
          enabled: true,
          logsChannelId: canalLogs.id,
          rules: [],
          whitelist: {
            channels: [],
            roles: [],
            users: []
          },
          badWords: [],
          stats: {
            messagesDeleted: 0,
            warnsGiven: 0,
            timeoutsApplied: 0,
            kicksPerformed: 0
          }
        };
      } else {
        config.guilds[guildId].logsChannelId = canalLogs.id;
      }
      
      this.saveConfig(config);
      
      const setupEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Auto-Moderación Configurada')
        .setDescription(
          `**Sistema configurado exitosamente!**\n\n` +
          `📝 **Canal de logs:** ${canalLogs}\n` +
          `✨ **Estado:** ${config.guilds[guildId].enabled ? 'Activado' : 'Desactivado'}\n\n` +
          `**Próximos pasos:**\n` +
          `1. Usa \`/automod rule\` para agregar reglas\n` +
          `2. Usa \`/automod whitelist\` para agregar excepciones\n` +
          `3. Usa \`/automod badwords\` para agregar palabras prohibidas\n\n` +
          `**Reglas disponibles:**\n` +
          `🔁 Anti-Spam - Detecta mensajes repetidos\n` +
          `🔗 Anti-Links - Bloquea enlaces no autorizados\n` +
          `📢 Anti-Invitaciones - Bloquea invitaciones de Discord\n` +
          `🔠 Anti-CAPS - Detecta abuso de mayúsculas\n` +
          `@️⃣ Anti-Menciones - Detecta menciones masivas\n` +
          `😀 Anti-Emoji Spam - Detecta spam de emojis\n` +
          `🚫 Palabras Prohibidas - Filtra palabras específicas`
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [setupEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al configurar automod:', error);
      await interaction.followUp({
        content: '❌ Error al configurar el sistema.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Gestiona reglas de auto-moderación
   */
  static async manageRule(interaction, client, accion, tipo, castigo, idRegla) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ Primero debes configurar el sistema con `/automod setup`',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const guildConfig = config.guilds[guildId];
      
      if (accion === 'add') {
        if (!tipo || !castigo) {
          return interaction.followUp({
            content: '❌ Debes especificar el tipo de regla y el castigo.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Verificar si ya existe una regla de ese tipo
        const existingRule = guildConfig.rules.find(r => r.type === tipo);
        if (existingRule) {
          return interaction.followUp({
            content: `❌ Ya existe una regla de tipo "${this.getRuleName(tipo)}". Remuévela primero si quieres cambiarla.`,
            flags: MessageFlags.Ephemeral
          });
        }
        
        const ruleId = this.generateRuleId();
        const rule = {
          id: ruleId,
          type: tipo,
          punishment: castigo,
          createdBy: interaction.user.tag,
          createdAt: new Date().toISOString()
        };
        
        guildConfig.rules.push(rule);
        this.saveConfig(config);
        
        const addEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Regla Agregada')
          .setDescription(
            `**Tipo:** ${this.getRuleName(tipo)}\n` +
            `**Castigo:** ${this.getPunishmentName(castigo)}\n` +
            `**ID:** \`${ruleId}\`\n\n` +
            `La regla está ahora activa.`
          )
          .setFooter({ text: `Creada por: ${interaction.user.tag}` })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [addEmbed], flags: MessageFlags.Ephemeral });
      }
      else if (accion === 'remove') {
        if (!idRegla) {
          return interaction.followUp({
            content: '❌ Debes especificar el ID de la regla a remover.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const ruleIndex = guildConfig.rules.findIndex(r => r.id === idRegla);
        
        if (ruleIndex === -1) {
          return interaction.followUp({
            content: '❌ No se encontró una regla con ese ID.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const removedRule = guildConfig.rules.splice(ruleIndex, 1)[0];
        this.saveConfig(config);
        
        const removeEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Regla Removida')
          .setDescription(
            `**Tipo:** ${this.getRuleName(removedRule.type)}\n` +
            `**Castigo:** ${this.getPunishmentName(removedRule.punishment)}\n` +
            `**ID:** \`${idRegla}\`\n\n` +
            `La regla ha sido desactivada.`
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [removeEmbed], flags: MessageFlags.Ephemeral });
      }
      else if (accion === 'list') {
        if (guildConfig.rules.length === 0) {
          return interaction.followUp({
            content: '✅ No hay reglas configuradas. Usa `/automod rule` para agregar algunas.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const rulesText = guildConfig.rules.map((rule, index) => {
          return `**${index + 1}.** ${this.getRuleName(rule.type)}\n` +
                 `   🎯 Castigo: ${this.getPunishmentName(rule.punishment)}\n` +
                 `   🆔 ID: \`${rule.id}\`\n` +
                 `   👤 Creada por: ${rule.createdBy}`;
        }).join('\n\n');
        
        const listEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📋 Reglas de Auto-Moderación')
          .setDescription(
            `**Total de reglas:** ${guildConfig.rules.length}\n\n` +
            rulesText
          )
          .setFooter({ text: 'Usa /automod rule accion:remove para eliminar una regla' })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
      }
      
    } catch (error) {
      console.error('Error al gestionar regla:', error);
      await interaction.followUp({
        content: '❌ Error al gestionar la regla.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Gestiona la whitelist
   */
  static async manageWhitelist(interaction, client, accion, tipo, id) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ Primero debes configurar el sistema con `/automod setup`',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const whitelist = config.guilds[guildId].whitelist;
      
      if (accion === 'add') {
        if (!tipo || !id) {
          return interaction.followUp({
            content: '❌ Debes especificar el tipo y el ID.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const listName = tipo === 'channel' ? 'channels' : tipo === 'role' ? 'roles' : 'users';
        
        if (whitelist[listName].includes(id)) {
          return interaction.followUp({
            content: '❌ Este elemento ya está en la whitelist.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        whitelist[listName].push(id);
        this.saveConfig(config);
        
        const addEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Agregado a Whitelist')
          .setDescription(
            `**Tipo:** ${tipo === 'channel' ? 'Canal' : tipo === 'role' ? 'Rol' : 'Usuario'}\n` +
            `**ID:** \`${id}\`\n\n` +
            `Este elemento será ignorado por el auto-moderador.`
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [addEmbed], flags: MessageFlags.Ephemeral });
      }
      else if (accion === 'remove') {
        if (!tipo || !id) {
          return interaction.followUp({
            content: '❌ Debes especificar el tipo y el ID.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const listName = tipo === 'channel' ? 'channels' : tipo === 'role' ? 'roles' : 'users';
        const index = whitelist[listName].indexOf(id);
        
        if (index === -1) {
          return interaction.followUp({
            content: '❌ Este elemento no está en la whitelist.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        whitelist[listName].splice(index, 1);
        this.saveConfig(config);
        
        const removeEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Removido de Whitelist')
          .setDescription(
            `**Tipo:** ${tipo === 'channel' ? 'Canal' : tipo === 'role' ? 'Rol' : 'Usuario'}\n` +
            `**ID:** \`${id}\`\n\n` +
            `Este elemento ya no será ignorado por el auto-moderador.`
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [removeEmbed], flags: MessageFlags.Ephemeral });
      }
      else if (accion === 'list') {
        const channelsText = whitelist.channels.length > 0 
          ? whitelist.channels.map(id => `<#${id}>`).join(', ') 
          : '*Ninguno*';
        
        const rolesText = whitelist.roles.length > 0 
          ? whitelist.roles.map(id => `<@&${id}>`).join(', ') 
          : '*Ninguno*';
        
        const usersText = whitelist.users.length > 0 
          ? whitelist.users.map(id => `<@${id}>`).join(', ') 
          : '*Ninguno*';
        
        const listEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📋 Whitelist de Auto-Moderación')
          .addFields(
            { name: '📍 Canales', value: channelsText },
            { name: '👥 Roles', value: rolesText },
            { name: '👤 Usuarios', value: usersText }
          )
          .setFooter({ text: 'Los elementos en whitelist son ignorados por el auto-moderador' })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
      }
      
    } catch (error) {
      console.error('Error al gestionar whitelist:', error);
      await interaction.followUp({
        content: '❌ Error al gestionar la whitelist.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Gestiona palabras prohibidas
   */
  static async manageBadWords(interaction, client, accion, palabra) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ Primero debes configurar el sistema con `/automod setup`',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const badWords = config.guilds[guildId].badWords;
      
      if (accion === 'add') {
        if (!palabra) {
          return interaction.followUp({
            content: '❌ Debes especificar la palabra a agregar.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const palabraLower = palabra.toLowerCase();
        
        if (badWords.includes(palabraLower)) {
          return interaction.followUp({
            content: '❌ Esta palabra ya está en la lista.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        badWords.push(palabraLower);
        this.saveConfig(config);
        
        const addEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Palabra Agregada')
          .setDescription(
            `La palabra ha sido agregada a la lista de palabras prohibidas.\n\n` +
            `**Total de palabras:** ${badWords.length}`
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [addEmbed], flags: MessageFlags.Ephemeral });
      }
      else if (accion === 'remove') {
        if (!palabra) {
          return interaction.followUp({
            content: '❌ Debes especificar la palabra a remover.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const palabraLower = palabra.toLowerCase();
        const index = badWords.indexOf(palabraLower);
        
        if (index === -1) {
          return interaction.followUp({
            content: '❌ Esta palabra no está en la lista.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        badWords.splice(index, 1);
        this.saveConfig(config);
        
        const removeEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Palabra Removida')
          .setDescription(
            `La palabra ha sido removida de la lista de palabras prohibidas.\n\n` +
            `**Total de palabras:** ${badWords.length}`
          )
          .setTimestamp();
        
        await interaction.followUp({ embeds: [removeEmbed], flags: MessageFlags.Ephemeral });
      }
      else if (accion === 'list') {
        if (badWords.length === 0) {
          return interaction.followUp({
            content: '✅ No hay palabras prohibidas configuradas.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const wordsText = badWords.map((word, index) => `**${index + 1}.** ||${word}||`).join('\n');
        
        const listEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🚫 Palabras Prohibidas')
          .setDescription(
            `**Total:** ${badWords.length} palabra(s)\n\n` +
            wordsText
          )
          .setFooter({ text: 'Las palabras están ocultas por spoiler' })
          .setTimestamp();
        
        await interaction.followUp({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
      }
      
    } catch (error) {
      console.error('Error al gestionar badwords:', error);
      await interaction.followUp({
        content: '❌ Error al gestionar las palabras prohibidas.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Muestra estadísticas de auto-moderación
   */
  static async showStats(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ Primero debes configurar el sistema con `/automod setup`',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const stats = config.guilds[guildId].stats;
      const rules = config.guilds[guildId].rules.length;
      const badWords = config.guilds[guildId].badWords.length;
      
      const statsEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Estadísticas de Auto-Moderación')
        .addFields(
          { name: '📋 Reglas Activas', value: `${rules}`, inline: true },
          { name: '🚫 Palabras Prohibidas', value: `${badWords}`, inline: true },
          { name: '📊 Total Acciones', value: `${stats.messagesDeleted + stats.warnsGiven + stats.timeoutsApplied + stats.kicksPerformed}`, inline: true },
          { name: '🗑️ Mensajes Eliminados', value: `${stats.messagesDeleted}`, inline: true },
          { name: '⚠️ Warns Dados', value: `${stats.warnsGiven}`, inline: true },
          { name: '⏱️ Timeouts Aplicados', value: `${stats.timeoutsApplied}`, inline: true },
          { name: '👢 Kicks Realizados', value: `${stats.kicksPerformed}`, inline: true }
        )
        .setFooter({ text: `Servidor: ${interaction.guild.name}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [statsEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al mostrar stats:', error);
      await interaction.followUp({
        content: '❌ Error al obtener las estadísticas.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Activa/desactiva el sistema
   */
  static async toggle(interaction, client, activar) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ Primero debes configurar el sistema con `/automod setup`',
          flags: MessageFlags.Ephemeral
        });
      }
      
      config.guilds[guildId].enabled = activar;
      this.saveConfig(config);
      
      const toggleEmbed = new EmbedBuilder()
        .setColor(activar ? '#00FF00' : '#FF0000')
        .setTitle(activar ? '✅ Sistema Activado' : '⛔ Sistema Desactivado')
        .setDescription(
          activar 
            ? 'El sistema de auto-moderación está ahora **activo** y monitoreará los mensajes según las reglas configuradas.' 
            : 'El sistema de auto-moderación está ahora **desactivado**. Los mensajes no serán monitoreados.'
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [toggleEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      await interaction.followUp({
        content: '❌ Error al cambiar el estado del sistema.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Verifica si un mensaje debe ser moderado
   */
  static async checkMessage(message, client) {
    try {
      // Ignorar bots
      if (message.author.bot) return;
      
      // Ignorar mensajes sin guild
      if (!message.guild) return;
      
      const guildId = message.guild.id;
      const config = this.loadConfig();
      
      // Verificar si el sistema está configurado y activado
      if (!config.guilds[guildId] || !config.guilds[guildId].enabled) return;
      
      const guildConfig = config.guilds[guildId];
      
      // Verificar whitelist
      if (this.isWhitelisted(message, guildConfig.whitelist)) return;
      
      // Revisar cada regla
      for (const rule of guildConfig.rules) {
        let violated = false;
        let reason = '';
        
        switch (rule.type) {
          case 'spam':
            violated = await this.checkSpam(message);
            reason = 'Spam detectado (mensajes repetidos)';
            break;
          
          case 'links':
            violated = this.checkLinks(message.content);
            reason = 'Link no autorizado';
            break;
          
          case 'invites':
            violated = this.checkInvites(message.content);
            reason = 'Invitación de Discord detectada';
            break;
          
          case 'caps':
            violated = this.checkCaps(message.content);
            reason = 'Abuso de mayúsculas';
            break;
          
          case 'mentions':
            violated = this.checkMentions(message);
            reason = 'Menciones masivas';
            break;
          
          case 'emojis':
            violated = this.checkEmojis(message.content);
            reason = 'Spam de emojis';
            break;
          
          case 'badwords':
            violated = this.checkBadWords(message.content, guildConfig.badWords);
            reason = 'Palabra prohibida detectada';
            break;
        }
        
        if (violated) {
          await this.applyPunishment(message, rule.punishment, reason, guildConfig, config);
          break; // Solo aplicar un castigo por mensaje
        }
      }
      
    } catch (error) {
      console.error('Error al verificar mensaje:', error);
    }
  }
  
  /**
   * Verifica si está en whitelist
   */
  static isWhitelisted(message, whitelist) {
    // Verificar canal
    if (whitelist.channels.includes(message.channel.id)) return true;
    
    // Verificar roles del usuario
    if (message.member) {
      const hasWhitelistedRole = message.member.roles.cache.some(role => 
        whitelist.roles.includes(role.id)
      );
      if (hasWhitelistedRole) return true;
    }
    
    // Verificar usuario
    if (whitelist.users.includes(message.author.id)) return true;
    
    return false;
  }
  
  /**
   * Verifica spam
   */
  static async checkSpam(message) {
    const userId = message.author.id;
    const now = Date.now();
    
    if (!this.userSpamCache.has(userId)) {
      this.userSpamCache.set(userId, []);
    }
    
    const userMessages = this.userSpamCache.get(userId);
    
    // Limpiar mensajes antiguos (más de 5 segundos)
    const recentMessages = userMessages.filter(msg => now - msg.timestamp < 5000);
    
    // Agregar mensaje actual
    recentMessages.push({
      content: message.content,
      timestamp: now
    });
    
    this.userSpamCache.set(userId, recentMessages);
    
    // Verificar si hay spam (5 mensajes en 5 segundos o 3 mensajes idénticos)
    if (recentMessages.length >= 5) {
      return true;
    }
    
    const duplicates = recentMessages.filter(msg => msg.content === message.content);
    if (duplicates.length >= 3) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Verifica links
   */
  static checkLinks(content) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    return linkRegex.test(content);
  }
  
  /**
   * Verifica invitaciones de Discord
   */
  static checkInvites(content) {
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/gi;
    return inviteRegex.test(content);
  }
  
  /**
   * Verifica abuso de mayúsculas
   */
  static checkCaps(content) {
    // Ignorar mensajes cortos
    if (content.length < 10) return false;
    
    const uppercaseCount = (content.match(/[A-Z]/g) || []).length;
    const percentage = (uppercaseCount / content.length) * 100;
    
    return percentage > 70; // Más del 70% en mayúsculas
  }
  
  /**
   * Verifica menciones masivas
   */
  static checkMentions(message) {
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    return totalMentions >= 5; // 5 o más menciones
  }
  
  /**
   * Verifica spam de emojis
   */
  static checkEmojis(content) {
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|:\w+:)/g;
    const emojis = content.match(emojiRegex) || [];
    
    return emojis.length >= 10; // 10 o más emojis
  }
  
  /**
   * Verifica palabras prohibidas
   */
  static checkBadWords(content, badWords) {
    const contentLower = content.toLowerCase();
    
    return badWords.some(word => contentLower.includes(word));
  }
  
  /**
   * Aplica el castigo
   */
  static async applyPunishment(message, punishment, reason, guildConfig, config) {
    try {
      const guildId = message.guild.id;
      
      // Siempre borrar el mensaje primero
      try {
        await message.delete();
        guildConfig.stats.messagesDeleted++;
      } catch (error) {
        console.error('Error al borrar mensaje:', error);
      }
      
      // Aplicar castigo adicional
      if (punishment === 'warn') {
        try {
          const WarnManager = require('./warnManager');
          const fakeInteraction = {
            guild: message.guild,
            user: message.client.user,
            options: { getBoolean: () => true }
          };
          // Esto es solo para estadísticas, el warn real debe hacerse manualmente
          guildConfig.stats.warnsGiven++;
        } catch (error) {
          console.error('Error al dar warn:', error);
        }
      }
      else if (punishment === 'timeout5' || punishment === 'timeout30') {
        try {
          const duration = punishment === 'timeout5' ? 5 * 60 * 1000 : 30 * 60 * 1000;
          await message.member.timeout(duration, `[AutoMod] ${reason}`);
          guildConfig.stats.timeoutsApplied++;
        } catch (error) {
          console.error('Error al aplicar timeout:', error);
        }
      }
      else if (punishment === 'kick') {
        try {
          await message.member.kick(`[AutoMod] ${reason}`);
          guildConfig.stats.kicksPerformed++;
        } catch (error) {
          console.error('Error al kickear:', error);
        }
      }
      
      // Guardar estadísticas
      this.saveConfig(config);
      
      // Enviar log
      await this.sendAutoModLog(
        message.client,
        guildConfig.logsChannelId,
        message.author,
        message.channel,
        reason,
        punishment,
        message.content
      );
      
      // Notificar al usuario
      try {
        const punishmentNames = {
          'delete': 'Tu mensaje fue eliminado',
          'warn': 'Recibiste una advertencia',
          'timeout5': 'Fuiste silenciado por 5 minutos',
          'timeout30': 'Fuiste silenciado por 30 minutos',
          'kick': 'Fuiste expulsado del servidor'
        };
        
        const dmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Auto-Moderación')
          .setDescription(
            `Tu mensaje en **${message.guild.name}** fue moderado automáticamente.\n\n` +
            `**Razón:** ${reason}\n` +
            `**Acción:** ${punishmentNames[punishment]}\n\n` +
            `Por favor, respeta las reglas del servidor.`
          )
          .setTimestamp();
        
        await message.author.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log('No se pudo enviar DM al usuario');
      }
      
    } catch (error) {
      console.error('Error al aplicar castigo:', error);
    }
  }
  
  /**
   * Envía log de auto-moderación
   */
  static async sendAutoModLog(client, logsChannelId, user, channel, reason, punishment, content) {
    try {
      const logsChannel = await client.channels.fetch(logsChannelId);
      
      const punishmentNames = {
        'delete': '🗑️ Mensaje Eliminado',
        'warn': '⚠️ Warn',
        'timeout5': '⏱️ Timeout 5min',
        'timeout30': '⏱️ Timeout 30min',
        'kick': '👢 Kick'
      };
      
      const logEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setAuthor({ 
          name: 'Auto-Moderación',
          iconURL: client.user.displayAvatarURL() 
        })
        .addFields(
          { name: '👤 Usuario', value: `${user} (\`${user.tag}\`)`, inline: true },
          { name: '📍 Canal', value: `${channel}`, inline: true },
          { name: '🎯 Acción', value: punishmentNames[punishment], inline: true },
          { name: '📝 Razón', value: reason, inline: false },
          { name: '💬 Contenido', value: content.substring(0, 1000) || '*Sin contenido*', inline: false }
        )
        .setTimestamp();
      
      await logsChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Error al enviar log de automod:', error);
    }
  }
}

module.exports = AutoModManager;