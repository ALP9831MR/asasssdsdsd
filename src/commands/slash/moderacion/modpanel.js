// ========================================
// 📁 src/commands/slash/moderation/modpanel.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  StringSelectMenuBuilder
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modpanel')
    .setDescription('Panel interactivo de moderación para un usuario')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario a moderar')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const usuario = interaction.options.getUser('usuario');
      const member = await interaction.guild.members.fetch(usuario.id).catch(() => null);
      
      if (!member) {
        return interaction.followUp({
          content: '❌ No se pudo encontrar al usuario en el servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Cargar datos del usuario
      const WarnManager = require('../../../systems/moderation/warnManager');
      const TimeoutManager = require('../../../systems/moderation/timeoutManager');
      const TempBanManager = require('../../../systems/moderation/tempbanManager');
      const NotesManager = require('../../../systems/moderation/notesManager');
      
      const warnData = WarnManager.loadData();
      const timeoutData = TimeoutManager.loadData();
      const tempbanData = TempBanManager.loadData();
      const notesData = NotesManager.loadData();
      
      const guildId = interaction.guild.id;
      const userId = usuario.id;
      
      // Obtener estadísticas
      const warns = warnData.guilds[guildId]?.[userId]?.warns?.filter(w => w.active) || [];
      const timeouts = timeoutData.guilds[guildId]?.[userId]?.history || [];
      const tempbans = tempbanData.guilds[guildId]?.[userId]?.history || [];
      const notes = notesData.guilds[guildId]?.[userId]?.notes || [];
      
      const activeTimeouts = timeouts.filter(t => t.active).length;
      const activeTempbans = tempbans.filter(t => t.active).length;
      
      // Verificar si está en timeout
      const isTimedOut = member.isCommunicationDisabled();
      
      // Verificar si está baneado
      const isBanned = await interaction.guild.bans.fetch(userId).catch(() => null);
      
      // Crear embed principal
      const panelEmbed = new EmbedBuilder()
        .setColor(warns.length >= 3 ? '#FF0000' : warns.length >= 1 ? '#FFA500' : '#5865F2')
        .setTitle(`👮 Panel de Moderación`)
        .setDescription(
          `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
          `**ID:** \`${userId}\`\n` +
          `**Estado:** ${isBanned ? '🔨 Baneado' : isTimedOut ? '⏱️ En Timeout' : '✅ Activo'}\n\n` +
          `**📊 Resumen de Infracciones:**`
        )
        .addFields(
          { name: '⚠️ Warns Activos', value: `${warns.length}`, inline: true },
          { name: '⏱️ Timeouts', value: `${timeouts.length} (${activeTimeouts} activos)`, inline: true },
          { name: '🔨 TempBans', value: `${tempbans.length} (${activeTempbans} activos)`, inline: true },
          { name: '📝 Notas', value: `${notes.length}`, inline: true },
          { name: '📅 Cuenta Creada', value: `<t:${Math.floor(usuario.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '📅 Se Unió', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }
        )
        .setThumbnail(usuario.displayAvatarURL())
        .setFooter({ text: `Moderador: ${interaction.user.tag}` })
        .setTimestamp();
      
      // Crear menú de selección para acciones rápidas
      const actionMenu = new StringSelectMenuBuilder()
        .setCustomId(`modpanel_action_${userId}`)
        .setPlaceholder('⚡ Selecciona una acción rápida')
        .addOptions([
          {
            label: 'Ver Warns',
            description: 'Ver todas las advertencias del usuario',
            value: 'view_warns',
            emoji: '⚠️'
          },
          {
            label: 'Ver Notas',
            description: 'Ver notas privadas del usuario',
            value: 'view_notes',
            emoji: '📝'
          },
          {
            label: 'Ver Historial Timeout',
            description: 'Ver historial de timeouts',
            value: 'view_timeouts',
            emoji: '⏱️'
          },
          {
            label: 'Ver Historial TempBan',
            description: 'Ver historial de bans temporales',
            value: 'view_tempbans',
            emoji: '🔨'
          },
          {
            label: 'Agregar Nota',
            description: 'Agregar una nota privada',
            value: 'add_note',
            emoji: '➕'
          }
        ]);
      
      // Crear botones de acciones principales
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`modpanel_warn_${userId}`)
            .setLabel('Advertir')
            .setEmoji('⚠️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`modpanel_timeout_${userId}`)
            .setLabel('Timeout')
            .setEmoji('⏱️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`modpanel_kick_${userId}`)
            .setLabel('Kick')
            .setEmoji('👢')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`modpanel_ban_${userId}`)
            .setLabel('Ban')
            .setEmoji('🔨')
            .setStyle(ButtonStyle.Danger)
        );
      
      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`modpanel_clearwarns_${userId}`)
            .setLabel('Limpiar Warns')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(warns.length === 0),
          new ButtonBuilder()
            .setCustomId(`modpanel_untimeout_${userId}`)
            .setLabel('Quitar Timeout')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!isTimedOut),
          new ButtonBuilder()
            .setCustomId(`modpanel_refresh_${userId}`)
            .setLabel('Actualizar')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`modpanel_close`)
            .setLabel('Cerrar')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary)
        );
      
      const row3 = new ActionRowBuilder().addComponents(actionMenu);
      
      await interaction.followUp({
        embeds: [panelEmbed],
        components: [row1, row2, row3],
        flags: MessageFlags.Ephemeral
      });
      
    } catch (error) {
      console.error('Error en modpanel:', error);
      await interaction.followUp({
        content: '❌ Error al abrir el panel de moderación.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
};