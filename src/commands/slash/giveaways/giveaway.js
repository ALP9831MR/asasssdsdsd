// ========================================
// 📁 src/commands/slash/giveaways/giveaway.js
// ========================================

const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const GiveawayManager = require('../../../systems/giveaways/giveawayManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Sistema completo de sorteos dinámicos')
    
    // ==================== CREATE ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Crear un nuevo sorteo')
        .addStringOption(option =>
          option
            .setName('premio')
            .setDescription('Premio del sorteo (ej: 100 Robux)')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('duracion')
            .setDescription('Duración del sorteo')
            .setRequired(true)
            .addChoices(
              { name: '10 minutos', value: '10m' },
              { name: '30 minutos', value: '30m' },
              { name: '1 hora', value: '1h' },
              { name: '3 horas', value: '3h' },
              { name: '6 horas', value: '6h' },
              { name: '12 horas', value: '12h' },
              { name: '1 día', value: '1d' },
              { name: '3 días', value: '3d' },
              { name: '1 semana', value: '1w' }
            ))
        .addIntegerOption(option =>
          option
            .setName('ganadores')
            .setDescription('Cantidad de ganadores (1-20)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20))
        .addChannelOption(option =>
          option
            .setName('canal')
            .setDescription('Canal donde se publicará el sorteo')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option =>
          option
            .setName('requisitos')
            .setDescription('Requisitos para participar (ej: Unirse al grupo de Roblox)')
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('descripcion')
            .setDescription('Descripción adicional del sorteo')
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('Color del embed en hexadecimal (ej: #FF6B9D)')
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('imagen')
            .setDescription('URL de la imagen del sorteo')
            .setRequired(false)))
    
    // ==================== LIST ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Ver todos los sorteos activos'))
    
    // ==================== END ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('Finalizar un sorteo manualmente')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo a finalizar')
            .setRequired(true)))
    
    // ==================== CANCEL ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Cancelar un sorteo')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo a cancelar')
            .setRequired(true)))
    
    // ==================== REROLL ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Elegir nuevos ganadores')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true)))
    
    // ==================== WINNERS ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('winners')
        .setDescription('Ver ganadores y sus pruebas')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true)))
    
    // ==================== PROOFS ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('proofs')
        .setDescription('Ver todas las pruebas enviadas (solo organizador)')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true)))
    
    // ==================== EDIT ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Editar un sorteo activo')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('premio')
            .setDescription('Nuevo premio')
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('descripcion')
            .setDescription('Nueva descripción')
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('requisitos')
            .setDescription('Nuevos requisitos')
            .setRequired(false))
        .addIntegerOption(option =>
          option
            .setName('ganadores')
            .setDescription('Nueva cantidad de ganadores')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)))
    
    // ==================== HISTORY ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('Ver historial de sorteos del servidor'))
    
    // ==================== ADDPROOF (NUEVO) ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('addproof')
        .setDescription('Agregar prueba manualmente (para pruebas enviadas por ticket)')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true))
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a marcar como verificado')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('prueba')
            .setDescription('Descripción de la prueba verificada')
            .setRequired(false)))
    
    // ==================== REMOVEPROOF (NUEVO) ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('removeproof')
        .setDescription('Remover prueba de un usuario')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true))
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuario a remover las pruebas')
            .setRequired(true)))
    
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'create':
          await GiveawayManager.createGiveaway(interaction, client);
          break;
        
        case 'list':
          await GiveawayManager.listActive(interaction);
          break;
        
        case 'end':
          await GiveawayManager.endManually(interaction);
          break;
        
        case 'cancel':
          await GiveawayManager.cancelGiveaway(interaction);
          break;
        
        case 'reroll':
          await GiveawayManager.rerollGiveaway(interaction);
          break;
        
        case 'winners':
          await GiveawayManager.viewWinners(interaction);
          break;
        
        case 'proofs':
          await GiveawayManager.viewAllProofs(interaction);
          break;
        
        case 'edit':
          await GiveawayManager.editGiveaway(interaction);
          break;
        
        case 'history':
          await GiveawayManager.viewHistory(interaction);
          break;
        
        case 'addproof':
          await GiveawayManager.addProofManually(interaction);
          break;
        
        case 'removeproof':
          await GiveawayManager.removeProofManually(interaction);
          break;
        
        default:
          await interaction.reply({
            content: '❌ Subcomando no reconocido.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error(`Error en subcomando ${subcommand}:`, error);
      
      const errorMessage = {
        content: '❌ Ocurrió un error al ejecutar este comando.',
        ephemeral: true
      };
      
      if (interaction.deferred) {
        await interaction.followUp(errorMessage).catch(console.error);
      } else {
        await interaction.reply(errorMessage).catch(console.error);
      }
    }
  }
};