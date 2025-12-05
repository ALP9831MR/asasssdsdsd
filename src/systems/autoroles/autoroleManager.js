const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits,
    MessageFlags
  } = require('discord.js');
  
  class AutoroleManager {
    /**
     * Asigna roles por defecto a un nuevo miembro
     * @param {GuildMember} member - El miembro que se unió al servidor
     * @param {Client} client - El cliente del bot
     * @returns {Promise<void>}
     */
    static async assignDefaultRoles(member, client) {
      try {
        // Verificar si hay roles para asignar
        const defaultRoles = client.config.systems.autoroles.roles.filter(r => r.default);
        
        if (!defaultRoles.length) return;
        
        // Asignar roles por defecto
        for (const roleConfig of defaultRoles) {
          const role = member.guild.roles.cache.get(roleConfig.id);
          if (role) {
            await member.roles.add(role);
            console.log(`Rol ${role.name} asignado a ${member.user.tag}`);
          }
        }
      } catch (error) {
        console.error('Error al asignar roles por defecto:', error);
      }
    }
  
    /**
     * Crea un panel de selección de roles con botones
     * @param {Interaction} interaction - La interacción que solicitó el panel
     * @param {Client} client - El cliente del bot
     * @param {string} title - El título del panel
     * @param {string} description - La descripción del panel
     * @param {string[]} roleIds - Los IDs de los roles a incluir
     * @returns {Promise<void>}
     */
    static async createButtonPanel(interaction, client, title, description, roleIds) {
      try {
        await interaction.deferReply();
        
        // Verificar permisos
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
          return interaction.followUp({
            content: '❌ No tienes permisos para gestionar roles.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Verificar que los roles existan
        const roles = [];
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role && role.id !== interaction.guild.id) {
            roles.push(role);
          }
        }
        
        if (!roles.length) {
          return interaction.followUp({
            content: '❌ No se encontraron roles válidos para añadir al panel.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Crear embed para el panel
        const embed = new EmbedBuilder()
          .setColor(client.config.embedColors.primary)
          .setTitle(title || '🎭 Roles Disponibles')
          .setDescription(description || 'Haz clic en los botones para obtener o quitar los roles.')
          .setTimestamp()
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });
        
        // Crear botones para cada rol (máximo 5 por fila)
        const components = [];
        let row = new ActionRowBuilder();
        let rowCount = 0;
        
        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          
          const button = new ButtonBuilder()
            .setCustomId(`autorole_toggle_${role.id}`)
            .setLabel(role.name)
            .setStyle(ButtonStyle.Primary);
          
          row.addComponents(button);
          rowCount++;
          
          // Si llegamos a 5 botones o es el último rol, añadir la fila
          if (rowCount === 5 || i === roles.length - 1) {
            components.push(row);
            row = new ActionRowBuilder();
            rowCount = 0;
          }
        }
        
        // Añadir roles al sistema de autoroles si no existen ya
        for (const role of roles) {
          if (!client.config.systems.autoroles.roles.some(r => r.id === role.id)) {
            client.config.systems.autoroles.roles.push({
              id: role.id,
              name: role.name,
              default: false
            });
          }
        }
        
        // Enviar panel
        await interaction.followUp({
          embeds: [embed],
          components: components
        });
      } catch (error) {
        console.error('Error al crear panel de autoroles con botones:', error);
        await interaction.followUp({
          content: '❌ Ha ocurrido un error al crear el panel de autoroles.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  
    /**
     * Crea un panel de selección de roles con menú desplegable
     * @param {Interaction} interaction - La interacción que solicitó el panel
     * @param {Client} client - El cliente del bot
     * @param {string} title - El título del panel
     * @param {string} description - La descripción del panel
     * @param {string[]} roleIds - Los IDs de los roles a incluir
     * @returns {Promise<void>}
     */
    static async createSelectMenuPanel(interaction, client, title, description, roleIds) {
      try {
        await interaction.deferReply();
        
        // Verificar permisos
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
          return interaction.followUp({
            content: '❌ No tienes permisos para gestionar roles.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Verificar que los roles existan
        const roles = [];
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role && role.id !== interaction.guild.id) {
            roles.push(role);
          }
        }
        
        if (!roles.length) {
          return interaction.followUp({
            content: '❌ No se encontraron roles válidos para añadir al panel.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        if (roles.length > 25) {
          return interaction.followUp({
            content: '❌ No se pueden añadir más de 25 roles a un menú de selección.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // Crear embed para el panel
        const embed = new EmbedBuilder()
          .setColor(client.config.embedColors.primary)
          .setTitle(title || '🎭 Selección de Roles')
          .setDescription(description || 'Selecciona los roles que deseas obtener desde el menú desplegable.')
          .setTimestamp()
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });
        
        // Crear menú de selección
        const select = new StringSelectMenuBuilder()
          .setCustomId('autorole_select')
          .setPlaceholder('Selecciona tus roles...')
          .setMinValues(0)
          .setMaxValues(roles.length);
        
        // Añadir opciones al menú
        for (const role of roles) {
          select.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(role.name)
              .setDescription(`Obtén el rol ${role.name}`)
              .setValue(role.id)
          );
        }
        
        const row = new ActionRowBuilder().addComponents(select);
        
        // Añadir roles al sistema de autoroles si no existen ya
        for (const role of roles) {
          if (!client.config.systems.autoroles.roles.some(r => r.id === role.id)) {
            client.config.systems.autoroles.roles.push({
              id: role.id,
              name: role.name,
              default: false
            });
          }
        }
        
        // Enviar panel
        await interaction.followUp({
          embeds: [embed],
          components: [row]
        });
      } catch (error) {
        console.error('Error al crear panel de autoroles con menú de selección:', error);
        await interaction.followUp({
          content: '❌ Ha ocurrido un error al crear el panel de autoroles.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  
    /**
     * Maneja las interacciones de botones relacionadas con autoroles
     * @param {ButtonInteraction} interaction - La interacción del botón
     * @param {Client} client - El cliente del bot
     * @param {string} action - La acción a realizar
     * @param {string[]} params - Parámetros adicionales
     * @returns {Promise<void>}
     */
    static async handleButton(interaction, client, action, params) {
      try {
        if (action === 'toggle') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          
          const roleId = params[0];
          const role = interaction.guild.roles.cache.get(roleId);
          
          if (!role) {
            return interaction.followUp({
              content: '❌ El rol seleccionado no existe o ha sido eliminado.',
              flags: MessageFlags.Ephemeral
            });
          }
          
          // Verificar si el miembro ya tiene el rol
          const member = interaction.member;
          const hasRole = member.roles.cache.has(roleId);
          
          if (hasRole) {
            // Quitar el rol
            await member.roles.remove(role);
            await interaction.followUp({
              content: `✅ Se ha eliminado el rol **${role.name}**.`,
              flags: MessageFlags.Ephemeral
            });
          } else {
            // Añadir el rol
            await member.roles.add(role);
            await interaction.followUp({
              content: `✅ Se ha añadido el rol **${role.name}**.`,
              flags: MessageFlags.Ephemeral
            });
          }
        }
      } catch (error) {
        console.error(`Error al manejar botón de autorole (${action}):`, error);
        await interaction.followUp({
          content: '❌ Ha ocurrido un error al procesar la acción.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  
    /**
     * Maneja las interacciones de menús de selección relacionadas con autoroles
     * @param {StringSelectMenuInteraction} interaction - La interacción del menú
     * @param {Client} client - El cliente del bot
     * @param {string} action - La acción a realizar
     * @param {string[]} params - Parámetros adicionales
     * @returns {Promise<void>}
     */
    static async handleSelectMenu(interaction, client, action, params) {
      try {
        if (interaction.customId === 'autorole_select') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          
          const selectedRoles = interaction.values;
          const member = interaction.member;
          const allOptions = interaction.component.options;
          
          // Obtener todos los roles posibles del menú
          const allRoleIds = allOptions.map(option => option.value);
          
          // Determinar roles a añadir y quitar
          const rolesToAdd = [];
          const rolesToRemove = [];
          
          for (const roleId of allRoleIds) {
            const role = interaction.guild.roles.cache.get(roleId);
            
            if (role) {
              if (selectedRoles.includes(roleId)) {
                if (!member.roles.cache.has(roleId)) {
                  rolesToAdd.push(role);
                }
              } else {
                if (member.roles.cache.has(roleId)) {
                  rolesToRemove.push(role);
                }
              }
            }
          }
          
          // Aplicar cambios de roles
          if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd);
          }
          
          if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove);
          }
          
          // Crear mensaje de respuesta
          let responseMessage = '✅ Tus roles han sido actualizados:\n\n';
          
          if (rolesToAdd.length > 0) {
            responseMessage += `**Roles añadidos:** ${rolesToAdd.map(r => r.name).join(', ')}\n`;
          }
          
          if (rolesToRemove.length > 0) {
            responseMessage += `**Roles eliminados:** ${rolesToRemove.map(r => r.name).join(', ')}\n`;
          }
          
          if (rolesToAdd.length === 0 && rolesToRemove.length === 0) {
            responseMessage = '❓ No se han realizado cambios en tus roles.';
          }
          
          await interaction.followUp({
            content: responseMessage,
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (error) {
        console.error(`Error al manejar menú de selección de autorole:`, error);
        await interaction.followUp({
          content: '❌ Ha ocurrido un error al procesar la selección de roles.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  }
  
  module.exports = AutoroleManager;