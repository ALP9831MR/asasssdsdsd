// ========================================
// 📁 src/commands/slash/moderation/helpmod.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('helpmod')
    .setDescription('Guía completa de comandos de moderación')
    .addStringOption(option =>
      option
        .setName('sistema')
        .setDescription('Ver ayuda de un sistema específico')
        .addChoices(
          { name: '📋 Resumen General', value: 'general' },
          { name: '⚠️ Warns', value: 'warns' },
          { name: '🗑️ Clear', value: 'clear' },
          { name: '⏱️ Timeout', value: 'timeout' },
          { name: '🔒 Lockdown', value: 'lockdown' },
          { name: '🔨 TempBan', value: 'tempban' },
          { name: '📝 Notas', value: 'notes' },
          { name: '🤖 AutoMod', value: 'automod' },
          { name: '📢 Reportes', value: 'reportes' },
          { name: '✅ Verificación', value: 'verification' },
          { name: '👮 ModPanel', value: 'modpanel' }
        )
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const sistema = interaction.options.getString('sistema') || 'general';
      
      let embed;
      
      if (sistema === 'general') {
        embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📚 Guía Completa de Moderación')
          .setDescription(
            `¡Bienvenido al sistema de moderación más completo de Discord!\n\n` +
            `Usa el menú de abajo para ver información detallada de cada sistema.`
          )
          .addFields(
            { 
              name: '⚠️ **Warns** - Sistema de Advertencias', 
              value: 'Gestiona advertencias con auto-ban. Comando: `/warn`', 
              inline: false 
            },
            { 
              name: '🗑️ **Clear** - Limpieza de Mensajes', 
              value: 'Borra mensajes con filtros avanzados. Comando: `/clear`', 
              inline: false 
            },
            { 
              name: '⏱️ **Timeout** - Silenciamiento Temporal', 
              value: 'Silencia usuarios temporalmente. Comando: `/timeout`', 
              inline: false 
            },
            { 
              name: '🔒 **Lockdown** - Bloqueo de Canales', 
              value: 'Bloquea canales o el servidor completo. Comando: `/lockdown`', 
              inline: false 
            },
            { 
              name: '🔨 **TempBan** - Baneos Temporales', 
              value: 'Banea con auto-unban. Comando: `/tempban`', 
              inline: false 
            },
            { 
              name: '📝 **Notas** - Notas de Moderador', 
              value: 'Notas privadas sobre usuarios. Comando: `/notes`', 
              inline: false 
            },
            { 
              name: '🤖 **AutoMod** - Auto-Moderación', 
              value: 'Moderación automática inteligente. Comando: `/automod`', 
              inline: false 
            },
            { 
              name: '📢 **Reportes** - Sistema de Reportes', 
              value: 'Gestiona reportes de usuarios. Comando: `/report`', 
              inline: false 
            },
            { 
              name: '✅ **Verificación** - Verificación de Usuarios', 
              value: 'Sistema de verificación con captcha. Comando: `/verify`', 
              inline: false 
            },
            { 
              name: '👮 **ModPanel** - Panel Interactivo', 
              value: 'Panel de moderación todo-en-uno. Comando: `/modpanel`', 
              inline: false 
            }
          )
          .setFooter({ text: 'Usa /helpmod sistema:[nombre] para ver detalles' })
          .setTimestamp();
      }
      else if (sistema === 'warns') {
        embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Sistema de Warns - Advertencias')
          .setDescription(
            `Sistema completo de advertencias con auto-ban y expiración automática.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/warn add usuario razon dm` - Advertir a un usuario\n' +
                '`/warn remove usuario id_warn` - Quitar una advertencia\n' +
                '`/warn list usuario` - Ver advertencias de un usuario\n' +
                '`/warn clear usuario` - Limpiar todas las advertencias\n' +
                '`/warn config` - Configurar el sistema',
              inline: false 
            },
            { 
              name: '⚙️ Configuración', 
              value: 
                '**Max Warns:** Número de warns antes de auto-ban (por defecto: 3)\n' +
                '**Canal Logs:** Canal donde se registran las acciones\n' +
                '**Expiración:** Días para que expiren los warns (0 = nunca)',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '✅ Auto-ban al alcanzar el límite\n' +
                '✉️ DM automático al usuario\n' +
                '📊 Historial completo\n' +
                '⏰ Auto-expiración de warns antiguos\n' +
                '🆔 IDs únicos para cada warn',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '1. /warn config max_warns:3 canal_logs:#logs\n' +
                '2. /warn add usuario:@Usuario razon:"Spam"\n' +
                '3. /warn list usuario:@Usuario\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Moderar Miembros' });
      }
      else if (sistema === 'clear') {
        embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('🗑️ Sistema de Clear - Limpieza de Mensajes')
          .setDescription(
            `Sistema avanzado de limpieza de mensajes con múltiples filtros.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/clear all cantidad` - Borrar X mensajes\n' +
                '`/clear user usuario cantidad` - Borrar de un usuario\n' +
                '`/clear bots cantidad` - Borrar mensajes de bots\n' +
                '`/clear links cantidad` - Borrar mensajes con links\n' +
                '`/clear images cantidad` - Borrar mensajes con imágenes\n' +
                '`/clear contains texto cantidad` - Borrar por contenido\n' +
                '`/clear between msg_inicio msg_fin` - Borrar entre IDs',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '✅ Confirmación con botones\n' +
                '📝 Logs detallados\n' +
                '🔒 Límite de 100 mensajes\n' +
                '⚠️ Solo mensajes de menos de 14 días',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/clear all cantidad:50\n' +
                '/clear user usuario:@Spammer cantidad:20\n' +
                '/clear links cantidad:100\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Gestionar Mensajes' });
      }
      else if (sistema === 'timeout') {
        embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('⏱️ Sistema de Timeout - Silenciamiento Temporal')
          .setDescription(
            `Silencia usuarios temporalmente con historial completo.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/timeout add usuario duracion razon` - Silenciar\n' +
                '`/timeout remove usuario` - Quitar timeout\n' +
                '`/timeout history usuario` - Ver historial\n' +
                '`/timeout active` - Ver todos los timeouts activos',
              inline: false 
            },
            { 
              name: '⏱️ Duraciones Disponibles', 
              value: 
                '1m, 5m, 10m, 30m, 1h, 6h, 12h, 1d, 1w',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '✉️ Notificación automática\n' +
                '📊 Historial completo\n' +
                '🔔 Log en canal de moderación\n' +
                '🆔 IDs únicos para cada timeout',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/timeout add usuario:@Usuario duracion:30m razon:"Spam"\n' +
                '/timeout remove usuario:@Usuario\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Moderar Miembros' });
      }
      else if (sistema === 'lockdown') {
        embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🔒 Sistema de Lockdown - Bloqueo de Canales')
          .setDescription(
            `Bloquea canales o el servidor completo en situaciones de emergencia.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/lockdown lock canal razon` - Bloquear un canal\n' +
                '`/lockdown unlock canal` - Desbloquear un canal\n' +
                '`/lockdown server duracion razon` - Bloquear servidor\n' +
                '`/lockdown unlock-server` - Desbloquear servidor\n' +
                '`/lockdown status` - Ver estado de lockdowns',
              inline: false 
            },
            { 
              name: '⏱️ Duraciones para Servidor', 
              value: 
                '5m, 15m, 30m, 1h, 6h, 12h, manual',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '💾 Guarda permisos anteriores\n' +
                '🔄 Auto-unlock con temporizador\n' +
                '📢 Anuncia en todos los canales\n' +
                '🚨 Perfecto para raids',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/lockdown server duracion:1h razon:"Raid detectado"\n' +
                '/lockdown unlock-server\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Administrador' });
      }
      else if (sistema === 'tempban') {
        embed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🔨 Sistema de TempBan - Baneos Temporales')
          .setDescription(
            `Banea usuarios temporalmente con auto-unban automático.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/tempban add usuario duracion razon` - Banear temporalmente\n' +
                '`/tempban remove usuario_id razon` - Desbanear antes de tiempo\n' +
                '`/tempban list` - Ver bans temporales activos\n' +
                '`/tempban history usuario_id` - Ver historial\n' +
                '`/tempban check usuario_id` - Ver info de ban',
              inline: false 
            },
            { 
              name: '⏱️ Duraciones Disponibles', 
              value: 
                '1h, 6h, 12h, 1d, 3d, 7d, 14d, 30d',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '🔄 Auto-unban cuando termina el tiempo\n' +
                '🗑️ Opción de borrar mensajes (7 días)\n' +
                '✉️ Notificación al usuario\n' +
                '📊 Historial completo',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/tempban add usuario:@Usuario duracion:7d razon:"Tóxico"\n' +
                '/tempban list\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Banear Miembros' });
      }
      else if (sistema === 'notes') {
        embed = new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('📝 Sistema de Notas - Notas de Moderador')
          .setDescription(
            `Notas privadas sobre usuarios para seguimiento a largo plazo.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/notes add usuario nota categoria` - Agregar nota\n' +
                '`/notes view usuario categoria` - Ver notas\n' +
                '`/notes remove usuario id_nota` - Eliminar nota\n' +
                '`/notes search texto` - Buscar en notas\n' +
                '`/notes export usuario` - Exportar notas\n' +
                '`/notes recent cantidad` - Notas recientes',
              inline: false 
            },
            { 
              name: '📂 Categorías', 
              value: 
                '📝 General\n' +
                '⚠️ Advertencia\n' +
                '🔍 Observación\n' +
                '🚨 Sospecha\n' +
                '✅ Positivo\n' +
                '❌ Negativo',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '🔒 Solo visible para moderadores\n' +
                '📊 Exportable en TXT\n' +
                '🔍 Búsqueda en todo el servidor\n' +
                '🆔 IDs únicos',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/notes add usuario:@Usuario nota:"Sospechoso"\n' +
                '/notes view usuario:@Usuario\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Moderar Miembros' });
      }
      else if (sistema === 'automod') {
        embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🤖 Sistema de AutoMod - Auto-Moderación')
          .setDescription(
            `Auto-moderación inteligente con 7 tipos de reglas.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/automod setup canal_logs` - Configurar\n' +
                '`/automod rule` - Gestionar reglas\n' +
                '`/automod whitelist` - Gestionar excepciones\n' +
                '`/automod badwords` - Palabras prohibidas\n' +
                '`/automod stats` - Ver estadísticas\n' +
                '`/automod toggle activar` - Activar/desactivar',
              inline: false 
            },
            { 
              name: '🛡️ Reglas Disponibles', 
              value: 
                '🔁 Anti-Spam\n' +
                '🔗 Anti-Links\n' +
                '📢 Anti-Invitaciones\n' +
                '🔠 Anti-CAPS\n' +
                '@️⃣ Anti-Menciones\n' +
                '😀 Anti-Emoji Spam\n' +
                '🚫 Palabras Prohibidas',
              inline: false 
            },
            { 
              name: '🎯 Castigos', 
              value: 
                'Delete, Warn, Timeout 5min, Timeout 30min, Kick',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/automod setup canal_logs:#logs\n' +
                '/automod rule accion:add tipo:spam castigo:timeout5\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Administrador' });
      }
      else if (sistema === 'reportes') {
        embed = new EmbedBuilder()
          .setColor('#E67E22')
          .setTitle('📢 Sistema de Reportes')
          .setDescription(
            `Sistema de reportes con tickets y gestión completa.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/report setup` - Configurar sistema\n' +
                '`/report user usuario razon` - Reportar usuario\n' +
                '`/report view id_reporte` - Ver reporte\n' +
                '`/report claim id_reporte` - Tomar caso\n' +
                '`/report close id_reporte accion` - Cerrar\n' +
                '`/report list estado` - Ver lista\n' +
                '`/report stats` - Ver estadísticas',
              inline: false 
            },
            { 
              name: '🎯 Acciones de Cierre', 
              value: 
                '✅ Resuelto - Acción tomada\n' +
                '⚠️ Advertencia dada\n' +
                '🔨 Usuario sancionado\n' +
                '❌ Reporte inválido\n' +
                '📋 Sin acción necesaria',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '🎫 Sistema de tickets\n' +
                '🔔 Notificaciones automáticas\n' +
                '📊 Estadísticas completas\n' +
                '🔘 Botones interactivos',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/report user usuario:@Usuario razon:"Acoso"\n' +
                '/report claim id_reporte:REP123\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Cualquiera puede reportar' });
      }
      else if (sistema === 'verification') {
        embed = new EmbedBuilder()
          .setColor('#1ABC9C')
          .setTitle('✅ Sistema de Verificación')
          .setDescription(
            `Verificación de usuarios con captcha y preguntas de seguridad.`
          )
          .addFields(
            { 
              name: '📝 Comandos Disponibles', 
              value: 
                '`/verify setup` - Configurar sistema\n' +
                '`/verify manual usuario` - Verificar manualmente\n' +
                '`/verify unverify usuario` - Quitar verificación\n' +
                '`/verify kick-unverified` - Kickear no verificados\n' +
                '`/verify stats` - Ver estadísticas\n' +
                '`/verify toggle activar` - Activar/desactivar',
              inline: false 
            },
            { 
              name: '🔐 Métodos', 
              value: 
                '🔘 Botón Simple\n' +
                '✅ Captcha Visual (código de 6 caracteres)\n' +
                '❓ Pregunta de Seguridad',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '🤖 Auto-asignación de roles\n' +
                '⏱️ Tiempo límite configurable\n' +
                '👢 Auto-kick si no verifican\n' +
                '📊 Estadísticas detalladas',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/verify setup canal:#verify rol_verificado:@Verificado tiempo_limite:10 metodo:captcha\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Permiso requerido: Administrador' });
      }
      else if (sistema === 'modpanel') {
        embed = new EmbedBuilder()
          .setColor('#34495E')
          .setTitle('👮 ModPanel - Panel de Moderación Interactivo')
          .setDescription(
            `Panel todo-en-uno para moderar usuarios fácilmente.`
          )
          .addFields(
            { 
              name: '📝 Comando', 
              value: 
                '`/modpanel usuario` - Abrir panel de moderación',
              inline: false 
            },
            { 
              name: '🎯 Acciones Disponibles', 
              value: 
                '⚠️ Advertir\n' +
                '⏱️ Timeout\n' +
                '👢 Kick\n' +
                '🔨 Ban\n' +
                '🗑️ Limpiar Warns\n' +
                '🔓 Quitar Timeout\n' +
                '🔄 Actualizar panel',
              inline: false 
            },
            { 
              name: '📊 Información Mostrada', 
              value: 
                '✅ Warns activos\n' +
                '✅ Historial de timeouts\n' +
                '✅ Historial de tempbans\n' +
                '✅ Cantidad de notas\n' +
                '✅ Fechas de cuenta y unión',
              inline: false 
            },
            { 
              name: '✨ Características', 
              value: 
                '🔘 Botones interactivos\n' +
                '📋 Menú de acciones rápidas\n' +
                '📊 Resumen completo\n' +
                '⚡ Acceso rápido a todos los sistemas',
              inline: false 
            },
            { 
              name: '💡 Ejemplo de Uso', 
              value: 
                '```\n' +
                '/modpanel usuario:@Usuario\n' +
                '(Luego usa los botones y menús)\n' +
                '```',
              inline: false 
            }
          )
          .setFooter({ text: 'Panel interactivo más fácil que comandos individuales' });
      }
      
      // Menú de selección para cambiar de sistema
      const systemMenu = new StringSelectMenuBuilder()
        .setCustomId('helpmod_system_select')
        .setPlaceholder('📚 Selecciona un sistema para ver más información')
        .addOptions([
          { label: '📋 Resumen General', value: 'general', emoji: '📋' },
          { label: 'Warns', value: 'warns', emoji: '⚠️' },
          { label: 'Clear', value: 'clear', emoji: '🗑️' },
          { label: 'Timeout', value: 'timeout', emoji: '⏱️' },
          { label: 'Lockdown', value: 'lockdown', emoji: '🔒' },
          { label: 'TempBan', value: 'tempban', emoji: '🔨' },
          { label: 'Notas', value: 'notes', emoji: '📝' },
          { label: 'AutoMod', value: 'automod', emoji: '🤖' },
          { label: 'Reportes', value: 'reportes', emoji: '📢' },
          { label: 'Verificación', value: 'verification', emoji: '✅' },
          { label: 'ModPanel', value: 'modpanel', emoji: '👮' }
        ]);
      
      const row = new ActionRowBuilder().addComponents(systemMenu);
      
      await interaction.followUp({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
      });
      
    } catch (error) {
      console.error('Error en helpmod:', error);
      await interaction.followUp({
        content: '❌ Error al mostrar la ayuda.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  },
  
  /**
   * Maneja el menú de selección
   */
  async handleSelectMenu(interaction) {
    const selectedSystem = interaction.values[0];
    
    // Re-ejecutar el comando con el sistema seleccionado
    interaction.options = {
      getString: () => selectedSystem
    };
    
    await this.execute(interaction, interaction.client);
  }
};