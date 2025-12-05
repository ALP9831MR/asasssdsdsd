// ========================================
// 📁 systems/moderation/verificationManager.js
// ========================================

const { 
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class VerificationManager {
  static configPath = path.join(__dirname, '../../data/moderation/verification.json');
  static pendingVerifications = new Map(); // Usuario ID -> timestamp
  
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
      console.error('Error al cargar config de verificación:', error);
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
      console.error('Error al guardar config de verificación:', error);
    }
  }
  
  /**
   * Genera un código captcha simple
   */
  static generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  /**
   * Genera pregunta de seguridad
   */
  static generateQuestion() {
    const questions = [
      { q: '¿Cuánto es 5 + 3?', a: ['8', 'ocho'] },
      { q: '¿Cuánto es 10 - 4?', a: ['6', 'seis'] },
      { q: '¿Cuánto es 3 × 4?', a: ['12', 'doce'] },
      { q: '¿De qué color es el cielo?', a: ['azul', 'celeste'] },
      { q: '¿Cuántas patas tiene un perro?', a: ['4', 'cuatro'] },
      { q: '¿En qué plataforma estás? (Discord, Instagram, etc)', a: ['discord'] }
    ];
    
    return questions[Math.floor(Math.random() * questions.length)];
  }
  
  /**
   * Configura el sistema de verificación
   */
  static async setup(interaction, client, canalVerificacion, rolVerificado, rolNoVerificado, tiempoLimite, metodo) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        config.guilds[guildId] = {
          enabled: true,
          verificationChannelId: canalVerificacion.id,
          verifiedRoleId: rolVerificado.id,
          unverifiedRoleId: rolNoVerificado ? rolNoVerificado.id : null,
          timeLimit: tiempoLimite,
          method: metodo,
          messageId: null,
          stats: {
            totalVerified: 0,
            totalKicked: 0,
            pendingVerifications: 0
          }
        };
      } else {
        config.guilds[guildId].verificationChannelId = canalVerificacion.id;
        config.guilds[guildId].verifiedRoleId = rolVerificado.id;
        config.guilds[guildId].unverifiedRoleId = rolNoVerificado ? rolNoVerificado.id : null;
        config.guilds[guildId].timeLimit = tiempoLimite;
        config.guilds[guildId].method = metodo;
      }
      
      this.saveConfig(config);
      
      // Crear mensaje de verificación
      const verifyEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('✅ Verificación de Usuario')
        .setDescription(
          `¡Bienvenido a **${interaction.guild.name}**! 👋\n\n` +
          `Para acceder al servidor, necesitas verificarte presionando el botón de abajo.\n\n` +
          `**¿Por qué verificarse?**\n` +
          `• Protege al servidor de bots y raids\n` +
          `• Asegura que eres un usuario real\n` +
          `• Te da acceso a todos los canales\n\n` +
          (tiempoLimite > 0 ? `⏱️ Tienes **${tiempoLimite} minutos** para verificarte.\n` : '') +
          `✨ ¡Presiona el botón verde para comenzar!`
        )
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: 'Sistema de Verificación Automática' })
        .setTimestamp();
      
      const verifyButton = new ButtonBuilder()
        .setCustomId('verification_start')
        .setLabel('✅ Verificarme')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');
      
      const row = new ActionRowBuilder().addComponents(verifyButton);
      
      // Eliminar mensaje anterior si existe
      if (config.guilds[guildId].messageId) {
        try {
          const oldMessage = await canalVerificacion.messages.fetch(config.guilds[guildId].messageId);
          await oldMessage.delete();
        } catch (error) {
          console.log('No se pudo eliminar mensaje anterior');
        }
      }
      
      const message = await canalVerificacion.send({
        embeds: [verifyEmbed],
        components: [row]
      });
      
      config.guilds[guildId].messageId = message.id;
      this.saveConfig(config);
      
      const setupEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Sistema de Verificación Configurado')
        .setDescription(
          `**Sistema configurado exitosamente!**\n\n` +
          `📍 **Canal:** ${canalVerificacion}\n` +
          `✅ **Rol verificado:** ${rolVerificado}\n` +
          `❌ **Rol no verificado:** ${rolNoVerificado || 'Ninguno'}\n` +
          `⏱️ **Tiempo límite:** ${tiempoLimite === 0 ? 'Sin límite' : `${tiempoLimite} minutos`}\n` +
          `🔐 **Método:** ${this.getMethodName(metodo)}\n\n` +
          `**Funcionalidades:**\n` +
          `✨ Verificación automática\n` +
          `⏱️ ${tiempoLimite > 0 ? 'Auto-kick si no se verifican' : 'Sin auto-kick'}\n` +
          `📊 Estadísticas de verificación\n` +
          `👮 Verificación manual disponible`
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [setupEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al configurar verificación:', error);
      await interaction.followUp({
        content: '❌ Error al configurar el sistema.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Obtiene el nombre del método
   */
  static getMethodName(method) {
    const names = {
      'button': '🔘 Botón Simple',
      'captcha': '✅ Captcha Visual',
      'question': '❓ Pregunta de Seguridad'
    };
    return names[method] || method;
  }
  
  /**
   * Inicia el proceso de verificación
   */
  static async startVerification(interaction, client) {
    try {
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId] || !config.guilds[guildId].enabled) {
        return interaction.reply({
          content: '❌ El sistema de verificación no está configurado o está desactivado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const guildConfig = config.guilds[guildId];
      
      // Verificar si ya está verificado
      if (interaction.member.roles.cache.has(guildConfig.verifiedRoleId)) {
        return interaction.reply({
          content: '✅ Ya estás verificado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const method = guildConfig.method;
      
      if (method === 'button') {
        // Verificación simple con botón
        await this.verifyUser(interaction, client);
      }
      else if (method === 'captcha') {
        // Generar captcha
        const captchaCode = this.generateCaptcha();
        this.pendingVerifications.set(interaction.user.id, {
          code: captchaCode,
          timestamp: Date.now(),
          guildId: guildId
        });
        
        const captchaEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🔐 Verificación Captcha')
          .setDescription(
            `Por favor, escribe el siguiente código en el chat:\n\n` +
            `**Código:** \`${captchaCode}\`\n\n` +
            `Tienes **2 minutos** para escribirlo.`
          )
          .setFooter({ text: 'Escribe el código exactamente como se muestra' })
          .setTimestamp();
        
        await interaction.reply({
          embeds: [captchaEmbed],
          flags: MessageFlags.Ephemeral
        });
        
        // Limpiar después de 2 minutos
        setTimeout(() => {
          if (this.pendingVerifications.has(interaction.user.id)) {
            this.pendingVerifications.delete(interaction.user.id);
          }
        }, 2 * 60 * 1000);
      }
      else if (method === 'question') {
        // Pregunta de seguridad
        const question = this.generateQuestion();
        this.pendingVerifications.set(interaction.user.id, {
          answers: question.a,
          timestamp: Date.now(),
          guildId: guildId
        });
        
        const questionEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('❓ Pregunta de Seguridad')
          .setDescription(
            `Por favor, responde la siguiente pregunta:\n\n` +
            `**${question.q}**\n\n` +
            `Escribe tu respuesta en el chat.\n` +
            `Tienes **2 minutos** para responder.`
          )
          .setFooter({ text: 'Escribe solo la respuesta' })
          .setTimestamp();
        
        await interaction.reply({
          embeds: [questionEmbed],
          flags: MessageFlags.Ephemeral
        });
        
        // Limpiar después de 2 minutos
        setTimeout(() => {
          if (this.pendingVerifications.has(interaction.user.id)) {
            this.pendingVerifications.delete(interaction.user.id);
          }
        }, 2 * 60 * 1000);
      }
      
    } catch (error) {
      console.error('Error al iniciar verificación:', error);
      await interaction.reply({
        content: '❌ Error al iniciar la verificación.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Verifica a un usuario
   */
  static async verifyUser(interaction, client) {
    try {
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return;
      }
      
      const guildConfig = config.guilds[guildId];
      const member = interaction.member;
      
      // Agregar rol verificado
      try {
        await member.roles.add(guildConfig.verifiedRoleId);
      } catch (error) {
        console.error('Error al agregar rol verificado:', error);
        return interaction.reply({
          content: '❌ No pude darte el rol de verificado. Contacta a un administrador.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Quitar rol no verificado si existe
      if (guildConfig.unverifiedRoleId && member.roles.cache.has(guildConfig.unverifiedRoleId)) {
        try {
          await member.roles.remove(guildConfig.unverifiedRoleId);
        } catch (error) {
          console.error('Error al quitar rol no verificado:', error);
        }
      }
      
      // Actualizar estadísticas
      guildConfig.stats.totalVerified++;
      this.saveConfig(config);
      
      // Limpiar verificación pendiente
      this.pendingVerifications.delete(interaction.user.id);
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ ¡Verificación Exitosa!')
        .setDescription(
          `¡Bienvenido a **${interaction.guild.name}**! 🎉\n\n` +
          `Has sido verificado exitosamente y ahora tienes acceso a todos los canales.\n\n` +
          `¡Disfruta tu estadía y respeta las reglas del servidor!`
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
      
      await interaction.reply({
        embeds: [successEmbed],
        flags: MessageFlags.Ephemeral
      });
      
      // Enviar mensaje de bienvenida en el canal general (opcional)
      // Esto lo puedes personalizar según tu servidor
      
    } catch (error) {
      console.error('Error al verificar usuario:', error);
    }
  }
  
  /**
   * Verifica la respuesta del usuario (captcha o pregunta)
   */
  static async checkVerificationResponse(message, client) {
    try {
      const userId = message.author.id;
      
      if (!this.pendingVerifications.has(userId)) {
        return;
      }
      
      const verification = this.pendingVerifications.get(userId);
      const guildId = verification.guildId;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return;
      }
      
      const guildConfig = config.guilds[guildId];
      let isCorrect = false;
      
      // Verificar según el método
      if (verification.code) {
        // Es un captcha
        isCorrect = message.content.trim().toUpperCase() === verification.code;
      } else if (verification.answers) {
        // Es una pregunta
        const userAnswer = message.content.trim().toLowerCase();
        isCorrect = verification.answers.some(ans => userAnswer.includes(ans));
      }
      
      if (isCorrect) {
        // Verificación exitosa
        const member = message.guild.members.cache.get(userId);
        
        if (member) {
          // Agregar rol verificado
          await member.roles.add(guildConfig.verifiedRoleId);
          
          // Quitar rol no verificado
          if (guildConfig.unverifiedRoleId) {
            await member.roles.remove(guildConfig.unverifiedRoleId).catch(() => {});
          }
          
          // Actualizar estadísticas
          guildConfig.stats.totalVerified++;
          this.saveConfig(config);
          
          // Limpiar verificación
          this.pendingVerifications.delete(userId);
          
          const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ ¡Verificación Exitosa!')
            .setDescription(
              `¡Bienvenido a **${message.guild.name}**! 🎉\n\n` +
              `Has sido verificado exitosamente.\n` +
              `Ahora tienes acceso a todos los canales.`
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setTimestamp();
          
          await message.reply({ embeds: [successEmbed] }).then(msg => {
            setTimeout(() => {
              msg.delete().catch(() => {});
              message.delete().catch(() => {});
            }, 5000);
          });
        }
      } else {
        // Respuesta incorrecta
        await message.reply({
          content: '❌ Respuesta incorrecta. Intenta de nuevo presionando el botón de verificación.',
          allowedMentions: { repliedUser: false }
        }).then(msg => {
          setTimeout(() => {
            msg.delete().catch(() => {});
            message.delete().catch(() => {});
          }, 5000);
        });
        
        this.pendingVerifications.delete(userId);
      }
      
    } catch (error) {
      console.error('Error al verificar respuesta:', error);
    }
  }
  
  /**
   * Verificación manual por moderador
   */
  static async manualVerify(interaction, client, usuario) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ El sistema de verificación no está configurado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const guildConfig = config.guilds[guildId];
      const member = await interaction.guild.members.fetch(usuario.id).catch(() => null);
      
      if (!member) {
        return interaction.followUp({
          content: '❌ No se pudo encontrar al usuario en el servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (member.roles.cache.has(guildConfig.verifiedRoleId)) {
        return interaction.followUp({
          content: '❌ Este usuario ya está verificado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Agregar rol verificado
      await member.roles.add(guildConfig.verifiedRoleId);
      
      // Quitar rol no verificado
      if (guildConfig.unverifiedRoleId) {
        await member.roles.remove(guildConfig.unverifiedRoleId).catch(() => {});
      }
      
      // Actualizar estadísticas
      guildConfig.stats.totalVerified++;
      this.saveConfig(config);
      
      // Notificar al usuario
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Has Sido Verificado')
          .setDescription(
            `Has sido verificado manualmente en **${interaction.guild.name}** por un moderador.\n\n` +
            `Ahora tienes acceso a todos los canales del servidor.`
          )
          .setTimestamp();
        
        await usuario.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log('No se pudo enviar DM al usuario');
      }
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Usuario Verificado')
        .setDescription(
          `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n\n` +
          `El usuario ha sido verificado manualmente.`
        )
        .setFooter({ text: `Verificado por: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error en verificación manual:', error);
      await interaction.followUp({
        content: '❌ Error al verificar al usuario.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Quitar verificación de un usuario
   */
  static async unverify(interaction, client, usuario) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ El sistema de verificación no está configurado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const guildConfig = config.guilds[guildId];
      const member = await interaction.guild.members.fetch(usuario.id).catch(() => null);
      
      if (!member) {
        return interaction.followUp({
          content: '❌ No se pudo encontrar al usuario en el servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      if (!member.roles.cache.has(guildConfig.verifiedRoleId)) {
        return interaction.followUp({
          content: '❌ Este usuario no está verificado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Quitar rol verificado
      await member.roles.remove(guildConfig.verifiedRoleId);
      
      // Agregar rol no verificado
      if (guildConfig.unverifiedRoleId) {
        await member.roles.add(guildConfig.unverifiedRoleId).catch(() => {});
      }
      
      const successEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ Verificación Removida')
        .setDescription(
          `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n\n` +
          `Se ha removido la verificación del usuario.`
        )
        .setFooter({ text: `Removido por: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al quitar verificación:', error);
      await interaction.followUp({
        content: '❌ Error al quitar la verificación.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Kickear usuarios no verificados
   */
  static async kickUnverified(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ El sistema de verificación no está configurado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const guildConfig = config.guilds[guildId];
      
      if (guildConfig.timeLimit === 0) {
        return interaction.followUp({
          content: '❌ No hay tiempo límite configurado para verificación.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const members = await interaction.guild.members.fetch();
      const unverifiedMembers = members.filter(member => 
        !member.user.bot && 
        !member.roles.cache.has(guildConfig.verifiedRoleId)
      );
      
      let kickedCount = 0;
      
      for (const [, member] of unverifiedMembers) {
        try {
          await member.kick('No verificado dentro del tiempo límite');
          kickedCount++;
        } catch (error) {
          console.error(`Error al kickear ${member.user.tag}:`, error);
        }
      }
      
      // Actualizar estadísticas
      guildConfig.stats.totalKicked += kickedCount;
      this.saveConfig(config);
      
      const resultEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('👢 Usuarios No Verificados Kickeados')
        .setDescription(
          `**Total kickeados:** ${kickedCount}\n` +
          `**Total encontrados:** ${unverifiedMembers.size}\n\n` +
          `Los usuarios que no se verificaron han sido expulsados del servidor.`
        )
        .setFooter({ text: `Ejecutado por: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [resultEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al kickear no verificados:', error);
      await interaction.followUp({
        content: '❌ Error al kickear usuarios.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Muestra estadísticas de verificación
   */
  static async showStats(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId]) {
        return interaction.followUp({
          content: '❌ El sistema de verificación no está configurado.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const guildConfig = config.guilds[guildId];
      const stats = guildConfig.stats;
      
      // Contar usuarios verificados actuales
      const members = await interaction.guild.members.fetch();
      const currentVerified = members.filter(member => 
        member.roles.cache.has(guildConfig.verifiedRoleId)
      ).size;
      
      const currentUnverified = members.filter(member => 
        !member.user.bot && 
        !member.roles.cache.has(guildConfig.verifiedRoleId)
      ).size;
      
      stats.pendingVerifications = currentUnverified;
      this.saveConfig(config);
      
      const statsEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Estadísticas de Verificación')
        .addFields(
          { name: '✅ Total Verificados', value: `${stats.totalVerified}`, inline: true },
          { name: '👢 Total Kickeados', value: `${stats.totalKicked}`, inline: true },
          { name: '⏱️ Pendientes', value: `${stats.pendingVerifications}`, inline: true },
          { name: '📊 Actualmente Verificados', value: `${currentVerified}`, inline: true },
          { name: '❌ Sin Verificar', value: `${currentUnverified}`, inline: true },
          { name: '🔐 Método', value: this.getMethodName(guildConfig.method), inline: true },
          { name: '⏱️ Tiempo Límite', value: guildConfig.timeLimit === 0 ? 'Sin límite' : `${guildConfig.timeLimit} min`, inline: false }
        )
        .setFooter({ text: `Servidor: ${interaction.guild.name}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [statsEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al mostrar estadísticas:', error);
      await interaction.followUp({
        content: '❌ Error al obtener estadísticas.',
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
          content: '❌ Primero debes configurar el sistema con `/verify setup`',
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
            ? 'El sistema de verificación está ahora **activo**. Los nuevos usuarios deberán verificarse.' 
            : 'El sistema de verificación está ahora **desactivado**. Los usuarios no necesitarán verificarse.'
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
   * Maneja nuevos miembros
   */
  static async handleNewMember(member, client) {
    try {
      const guildId = member.guild.id;
      const config = this.loadConfig();
      
      if (!config.guilds[guildId] || !config.guilds[guildId].enabled) {
        return;
      }
      
      const guildConfig = config.guilds[guildId];
      
      // Agregar rol no verificado si existe
      if (guildConfig.unverifiedRoleId) {
        await member.roles.add(guildConfig.unverifiedRoleId).catch(() => {});
      }
      
      // Si hay tiempo límite, programar kick
      if (guildConfig.timeLimit > 0) {
        setTimeout(async () => {
          // Verificar si el usuario aún no está verificado
          const updatedMember = await member.guild.members.fetch(member.id).catch(() => null);
          
          if (updatedMember && !updatedMember.roles.cache.has(guildConfig.verifiedRoleId)) {
            try {
              await updatedMember.kick('No se verificó dentro del tiempo límite');
              guildConfig.stats.totalKicked++;
              this.saveConfig(config);
            } catch (error) {
              console.error('Error al kickear usuario no verificado:', error);
            }
          }
        }, guildConfig.timeLimit * 60 * 1000);
      }
      
    } catch (error) {
      console.error('Error al manejar nuevo miembro:', error);
    }
  }
  
  /**
   * Maneja botones de verificación
   */
  static async handleButton(interaction, client) {
    await this.startVerification(interaction, client);
  }
}

module.exports = VerificationManager;