const { 
  EmbedBuilder, 
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');

class EmbedManager {
  // Almacenamiento temporal de embeds en construcción
  static embedCache = new Map();

  /**
   * Muestra un modal para crear un embed con mensaje opcional
   */
  static async showEmbedCreationModal(interaction, client) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          content: '❌ No tienes permisos para crear embeds.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const modal = new ModalBuilder()
        .setCustomId('embed_create')
        .setTitle('Crear Mensaje con Embed');
      
      const messageInput = new TextInputBuilder()
        .setCustomId('embedMessage')
        .setLabel('Mensaje (opcional)')
        .setPlaceholder('Este texto aparecerá encima del embed')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(2000);
      
      const titleInput = new TextInputBuilder()
        .setCustomId('embedTitle')
        .setLabel('Título del Embed')
        .setPlaceholder('Título del embed')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256);
      
      const descriptionInput = new TextInputBuilder()
        .setCustomId('embedDescription')
        .setLabel('Descripción del Embed')
        .setPlaceholder('Descripción del embed')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);
      
      const colorInput = new TextInputBuilder()
        .setCustomId('embedColor')
        .setLabel('Color (hexadecimal)')
        .setPlaceholder('#5865F2')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7);
      
      const footerInput = new TextInputBuilder()
        .setCustomId('embedFooter')
        .setLabel('Texto de pie de página (opcional)')
        .setPlaceholder('Pie de página del embed')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2048);
      
      const firstRow = new ActionRowBuilder().addComponents(messageInput);
      const secondRow = new ActionRowBuilder().addComponents(titleInput);
      const thirdRow = new ActionRowBuilder().addComponents(descriptionInput);
      const fourthRow = new ActionRowBuilder().addComponents(colorInput);
      const fifthRow = new ActionRowBuilder().addComponents(footerInput);
      
      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
      
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error al mostrar modal de creación de embed:', error);
      await interaction.reply({
        content: '❌ Ha ocurrido un error al abrir el formulario de creación de embed.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }

  /**
   * Maneja el envío del modal para crear un embed
   */
  static async handleModalSubmit(interaction, client, action, params) {
    try {
      if (action === 'create') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const message = interaction.fields.getTextInputValue('embedMessage') || null;
        const title = interaction.fields.getTextInputValue('embedTitle') || null;
        const description = interaction.fields.getTextInputValue('embedDescription');
        const color = interaction.fields.getTextInputValue('embedColor') || client.config.embedColors.primary;
        const footerText = interaction.fields.getTextInputValue('embedFooter') || null;
        
        const colorRegex = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;
        const validColor = colorRegex.test(color) ? color : client.config.embedColors.primary;
        
        const embed = new EmbedBuilder()
          .setColor(validColor)
          .setDescription(description);
        
        if (title) embed.setTitle(title);
        if (footerText) embed.setFooter({ text: footerText });
        embed.setTimestamp();
        
        // Guardar datos en caché
        const cacheKey = `${interaction.user.id}_${Date.now()}`;
        this.embedCache.set(cacheKey, {
          message: message,
          embed: embed,
          buttons: [],
          previewMessageId: null
        });
        
        // Botones de opciones
        const addButtonBtn = new ButtonBuilder()
          .setCustomId(`embed_addbutton_${cacheKey}`)
          .setLabel('Añadir Botón')
          .setEmoji('🔘')
          .setStyle(ButtonStyle.Primary);
        
        const addImageBtn = new ButtonBuilder()
          .setCustomId(`embed_addimage_${cacheKey}`)
          .setLabel('Añadir Imagen')
          .setEmoji('🖼️')
          .setStyle(ButtonStyle.Primary);
        
        const addThumbnailBtn = new ButtonBuilder()
          .setCustomId(`embed_addthumbnail_${cacheKey}`)
          .setLabel('Añadir Miniatura')
          .setEmoji('🔳')
          .setStyle(ButtonStyle.Primary);
        
        const sendButton = new ButtonBuilder()
          .setCustomId(`embed_finalsend_${cacheKey}`)
          .setLabel('Enviar')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success);
        
        const cancelButton = new ButtonBuilder()
          .setCustomId(`embed_cancel_${cacheKey}`)
          .setLabel('Cancelar')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger);
        
        const row1 = new ActionRowBuilder().addComponents(addButtonBtn, addImageBtn, addThumbnailBtn);
        const row2 = new ActionRowBuilder().addComponents(sendButton, cancelButton);
        
        let previewContent = '📝 **Vista previa:**\n';
        if (message) {
          previewContent += `\n**Mensaje:**\n${message}\n\n**Embed:**`;
        }
        
        const reply = await interaction.followUp({
          content: previewContent,
          embeds: [embed],
          components: [row1, row2],
          flags: MessageFlags.Ephemeral
        });
        
        // Guardar el ID del mensaje de vista previa
        const cachedData = this.embedCache.get(cacheKey);
        cachedData.previewMessageId = reply.id;
        cachedData.channelId = interaction.channelId;
        this.embedCache.set(cacheKey, cachedData);
        
        // Limpiar caché después de 10 minutos
        setTimeout(() => {
          this.embedCache.delete(cacheKey);
        }, 600000);
      }
      else if (action === 'savebtn') {
        const buttonType = params[params.length - 1];
        const cacheKey = params.slice(0, -1).join('_');
        
        console.log('🔍 Buscando cacheKey:', cacheKey);
        console.log('🔍 Tipo de botón:', buttonType);
        
        const cachedData = this.embedCache.get(cacheKey);
        
        if (!cachedData) {
          console.log('❌ No se encontró cachedData para:', cacheKey);
          return interaction.reply({
            content: '❌ Sesión expirada. Por favor, crea el embed nuevamente.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const label = interaction.fields.getTextInputValue('buttonLabel');
        const emoji = interaction.fields.getTextInputValue('buttonEmoji') || null;
        const value = interaction.fields.getTextInputValue('buttonValue');
        let color = 'primary';
        
        try {
          const colorInput = interaction.fields.getTextInputValue('buttonColor');
          if (colorInput) {
            const validColors = ['primary', 'secondary', 'success', 'danger'];
            color = validColors.includes(colorInput.toLowerCase()) ? colorInput.toLowerCase() : 'primary';
          }
        } catch (e) {
          // No hay campo de color
        }
        
        if (cachedData.buttons.length >= 25) {
          return interaction.followUp({
            content: '❌ Has alcanzado el límite de 25 botones.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        cachedData.buttons.push({
          type: buttonType,
          label: label,
          emoji: emoji,
          value: value,
          color: color
        });
        
        this.embedCache.set(cacheKey, cachedData);
        
        await this.updatePreview(interaction, client, cacheKey);
      }
      else if (action === 'addimage' || action === 'addthumbnail') {
        // Nuevo: Guardar imagen/miniatura desde el modal
        const imageType = action === 'addimage' ? 'imagen' : 'miniatura';
        const cacheKey = params.join('_');
        const imageUrl = interaction.fields.getTextInputValue('imageUrl');
        
        const cachedData = this.embedCache.get(cacheKey);
        
        if (!cachedData) {
          return interaction.reply({
            content: '❌ Sesión expirada. Por favor, crea el embed nuevamente.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Validar que sea una URL válida
        try {
          new URL(imageUrl);
          
          // Agregar imagen o miniatura al embed
          if (action === 'addimage') {
            cachedData.embed.setImage(imageUrl);
          } else {
            cachedData.embed.setThumbnail(imageUrl);
          }
          
          this.embedCache.set(cacheKey, cachedData);
          
          // Actualizar vista previa
          await this.updatePreviewDirect(interaction, client, cacheKey, `✅ ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} añadida correctamente.`);
        } catch (error) {
          await interaction.followUp({
            content: `❌ La URL proporcionada no es válida. Por favor, ingresa una URL correcta de imagen.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }
    } catch (error) {
      console.error(`Error al procesar modal de embed (${action}):`, error);
      const errorMsg = '❌ Ha ocurrido un error al procesar la acción.';
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(console.error);
      } else {
        await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(console.error);
      }
    }
  }

  /**
   * Maneja las interacciones de botones relacionadas con embeds
   */
  static async handleButton(interaction, client, action, params) {
    try {
      if (action === 'addbutton') {
        const cacheKey = params.join('_');
        
        console.log('🔘 AddButton - cacheKey reconstruido:', cacheKey);
        
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`embed_btntype_${cacheKey}`)
          .setPlaceholder('Selecciona el tipo de botón')
          .addOptions([
            {
              label: 'Botón con Link',
              description: 'Abre un enlace externo',
              value: 'link',
              emoji: '🔗'
            },
            {
              label: 'Botón de Rol',
              description: 'Asigna o quita un rol al hacer clic',
              value: 'role',
              emoji: '👤'
            },
            {
              label: 'Botón Personalizado',
              description: 'Acción personalizada (requiere código)',
              value: 'custom',
              emoji: '⚙️'
            }
          ]);
        
        const row = new ActionRowBuilder().addComponents(menu);
        
        await interaction.reply({
          content: '🔘 **Selecciona el tipo de botón que deseas añadir:**',
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }
      else if (action === 'addimage' || action === 'addthumbnail') {
        // Nuevo: Mostrar modal para ingresar URL de imagen
        const cacheKey = params.join('_');
        const imageType = action === 'addimage' ? 'Imagen' : 'Miniatura';
        
        const modal = new ModalBuilder()
          .setCustomId(`embed_${action}_${cacheKey}`)
          .setTitle(`Añadir ${imageType}`);
        
        const imageUrlInput = new TextInputBuilder()
          .setCustomId('imageUrl')
          .setLabel(`URL de la ${imageType}`)
          .setPlaceholder('https://ejemplo.com/imagen.png')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(imageUrlInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
      }
      else if (action === 'finalsend') {
        await interaction.deferUpdate();
        
        const cacheKey = params.join('_');
        const cachedData = this.embedCache.get(cacheKey);
        
        if (!cachedData) {
          return interaction.followUp({
            content: '❌ Sesión expirada.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const sendOptions = { embeds: [cachedData.embed] };
        
        if (cachedData.message) {
          sendOptions.content = cachedData.message;
        }
        
        if (cachedData.buttons.length > 0) {
          const buttonRows = this.createButtonRows(cachedData.buttons);
          sendOptions.components = buttonRows;
        }
        
        await interaction.channel.send(sendOptions);
        
        await interaction.editReply({
          content: '✅ El mensaje ha sido enviado al canal exitosamente.',
          embeds: [],
          components: []
        });
        
        this.embedCache.delete(cacheKey);
      }
      else if (action === 'cancel') {
        const cacheKey = params.join('_');
        if (cacheKey) {
          this.embedCache.delete(cacheKey);
        }
        
        await interaction.update({
          content: '❌ Envío cancelado.',
          embeds: [],
          components: []
        });
      }
      else if (action === 'customaction') {
        const actionId = params[0];
        
        await interaction.reply({
          content: `⚙️ Botón personalizado activado: \`${actionId}\`\n\n*Implementa tu lógica personalizada aquí*`,
          flags: MessageFlags.Ephemeral
        });
      }
      else if (action === 'togglerole') {
        const roleId = params[0];
        const role = interaction.guild.roles.cache.get(roleId);
        
        if (!role) {
          return interaction.reply({
            content: '❌ No se encontró el rol.',
            flags: MessageFlags.Ephemeral
          });
        }
        
        const member = interaction.member;
        
        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            await interaction.reply({
              content: `✅ Se te ha quitado el rol **${role.name}**.`,
              flags: MessageFlags.Ephemeral
            });
          } else {
            await member.roles.add(roleId);
            await interaction.reply({
              content: `✅ Se te ha asignado el rol **${role.name}**.`,
              flags: MessageFlags.Ephemeral
            });
          }
        } catch (error) {
          console.error('Error al gestionar rol:', error);
          await interaction.reply({
            content: '❌ No pude gestionar el rol. Verifica que el bot tenga permisos suficientes.',
            flags: MessageFlags.Ephemeral
          });
        }
      }
    } catch (error) {
      console.error(`Error al manejar botón de embed (${action}):`, error);
      const errorMsg = '❌ Ha ocurrido un error al procesar la acción.';
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(console.error);
      } else {
        await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(console.error);
      }
    }
  }

  /**
   * Maneja los menús de selección
   */
  static async handleSelectMenu(interaction, client, action, params) {
    try {
      if (action === 'btntype') {
        const cacheKey = params.join('_');
        const buttonType = interaction.values[0];
        
        console.log('📋 SelectMenu - cacheKey reconstruido:', cacheKey);
        
        const modal = new ModalBuilder()
          .setCustomId(`embed_savebtn_${cacheKey}_${buttonType}`)
          .setTitle(`Configurar Botón - ${buttonType.toUpperCase()}`);
        
        const labelInput = new TextInputBuilder()
          .setCustomId('buttonLabel')
          .setLabel('Texto del Botón')
          .setPlaceholder('Haz clic aquí')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80);
        
        const emojiInput = new TextInputBuilder()
          .setCustomId('buttonEmoji')
          .setLabel('Emoji (opcional)')
          .setPlaceholder('🔗 o :emoji:')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(50);
        
        let thirdInput, fourthInput;
        
        if (buttonType === 'link') {
          thirdInput = new TextInputBuilder()
            .setCustomId('buttonValue')
            .setLabel('URL del Link')
            .setPlaceholder('https://ejemplo.com')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        } else if (buttonType === 'role') {
          thirdInput = new TextInputBuilder()
            .setCustomId('buttonValue')
            .setLabel('ID del Rol')
            .setPlaceholder('123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          
          fourthInput = new TextInputBuilder()
            .setCustomId('buttonColor')
            .setLabel('Color del Botón')
            .setPlaceholder('primary, secondary, success, danger')
            .setValue('primary')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
        } else {
          thirdInput = new TextInputBuilder()
            .setCustomId('buttonValue')
            .setLabel('ID Personalizado')
            .setPlaceholder('mi_accion_personalizada')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          
          fourthInput = new TextInputBuilder()
            .setCustomId('buttonColor')
            .setLabel('Color del Botón')
            .setPlaceholder('primary, secondary, success, danger')
            .setValue('primary')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
        }
        
        const firstRow = new ActionRowBuilder().addComponents(labelInput);
        const secondRow = new ActionRowBuilder().addComponents(emojiInput);
        const thirdRow = new ActionRowBuilder().addComponents(thirdInput);
        
        modal.addComponents(firstRow, secondRow, thirdRow);
        
        if (fourthInput) {
          const fourthRow = new ActionRowBuilder().addComponents(fourthInput);
          modal.addComponents(fourthRow);
        }
        
        await interaction.showModal(modal);
      }
    } catch (error) {
      console.error('Error al manejar menú de selección:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Ha ocurrido un error al procesar la selección.',
          flags: MessageFlags.Ephemeral
        }).catch(console.error);
      }
    }
  }

  /**
   * Actualiza la vista previa con los botones añadidos
   */
  static async updatePreview(interaction, client, cacheKey) {
    const cachedData = this.embedCache.get(cacheKey);
    
    if (!cachedData) return;
    
    let previewContent = '📝 **Vista previa:**\n';
    if (cachedData.message) {
      previewContent += `\n**Mensaje:**\n${cachedData.message}\n\n**Embed:**`;
    }
    
    if (cachedData.buttons.length > 0) {
      previewContent += `\n\n🔘 **Botones añadidos:** ${cachedData.buttons.length}/25`;
    }
    
    const addButtonBtn = new ButtonBuilder()
      .setCustomId(`embed_addbutton_${cacheKey}`)
      .setLabel('Añadir Botón')
      .setEmoji('🔘')
      .setStyle(ButtonStyle.Primary);
    
    const addImageBtn = new ButtonBuilder()
      .setCustomId(`embed_addimage_${cacheKey}`)
      .setLabel('Añadir Imagen')
      .setEmoji('🖼️')
      .setStyle(ButtonStyle.Primary);
    
    const addThumbnailBtn = new ButtonBuilder()
      .setCustomId(`embed_addthumbnail_${cacheKey}`)
      .setLabel('Añadir Miniatura')
      .setEmoji('🔳')
      .setStyle(ButtonStyle.Primary);
    
    const sendButton = new ButtonBuilder()
      .setCustomId(`embed_finalsend_${cacheKey}`)
      .setLabel('Enviar')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId(`embed_cancel_${cacheKey}`)
      .setLabel('Cancelar')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger);
    
    const controlRow1 = new ActionRowBuilder().addComponents(addButtonBtn, addImageBtn, addThumbnailBtn);
    const controlRow2 = new ActionRowBuilder().addComponents(sendButton, cancelButton);
    
    const previewButtons = this.createButtonRows(cachedData.buttons, true);
    
    const allComponents = [controlRow1, controlRow2, ...previewButtons];
    
    try {
      await interaction.webhook.editMessage(cachedData.previewMessageId, {
        content: previewContent,
        embeds: [cachedData.embed],
        components: allComponents
      });
      
      await interaction.followUp({
        content: '✅ Botón añadido correctamente.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error al actualizar vista previa:', error);
      await interaction.followUp({
        content: '⚠️ Botón añadido, pero no se pudo actualizar la vista previa.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  /**
   * Actualiza la vista previa directamente (para imágenes)
   */
  static async updatePreviewDirect(interaction, client, cacheKey, successMessage) {
    const cachedData = this.embedCache.get(cacheKey);
    
    if (!cachedData) return;
    
    let previewContent = '📝 **Vista previa:**\n';
    if (cachedData.message) {
      previewContent += `\n**Mensaje:**\n${cachedData.message}\n\n**Embed:**`;
    }
    
    if (cachedData.buttons.length > 0) {
      previewContent += `\n\n🔘 **Botones añadidos:** ${cachedData.buttons.length}/25`;
    }
    
    const addButtonBtn = new ButtonBuilder()
      .setCustomId(`embed_addbutton_${cacheKey}`)
      .setLabel('Añadir Botón')
      .setEmoji('🔘')
      .setStyle(ButtonStyle.Primary);
    
    const addImageBtn = new ButtonBuilder()
      .setCustomId(`embed_addimage_${cacheKey}`)
      .setLabel('Añadir Imagen')
      .setEmoji('🖼️')
      .setStyle(ButtonStyle.Primary);
    
    const addThumbnailBtn = new ButtonBuilder()
      .setCustomId(`embed_addthumbnail_${cacheKey}`)
      .setLabel('Añadir Miniatura')
      .setEmoji('🔳')
      .setStyle(ButtonStyle.Primary);
    
    const sendButton = new ButtonBuilder()
      .setCustomId(`embed_finalsend_${cacheKey}`)
      .setLabel('Enviar')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId(`embed_cancel_${cacheKey}`)
      .setLabel('Cancelar')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger);
    
    const controlRow1 = new ActionRowBuilder().addComponents(addButtonBtn, addImageBtn, addThumbnailBtn);
    const controlRow2 = new ActionRowBuilder().addComponents(sendButton, cancelButton);
    
    const previewButtons = this.createButtonRows(cachedData.buttons, true);
    
    const allComponents = [controlRow1, controlRow2, ...previewButtons];
    
    try {
      await interaction.webhook.editMessage(cachedData.previewMessageId, {
        content: previewContent,
        embeds: [cachedData.embed],
        components: allComponents
      });
      
      await interaction.followUp({
        content: successMessage,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error al actualizar vista previa:', error);
      await interaction.followUp({
        content: '⚠️ Cambio aplicado, pero no se pudo actualizar la vista previa.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  /**
   * Crea filas de botones (máximo 5 botones por fila)
   */
  static createButtonRows(buttons, isPreview = false) {
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonsInRow = 0;
    
    for (const btn of buttons) {
      if (buttonsInRow >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        buttonsInRow = 0;
      }
      
      let button;
      
      if (btn.type === 'link') {
        button = new ButtonBuilder()
          .setLabel(btn.label)
          .setURL(btn.value)
          .setStyle(ButtonStyle.Link);
      } else if (btn.type === 'role') {
        const styleMap = {
          'primary': ButtonStyle.Primary,
          'secondary': ButtonStyle.Secondary,
          'success': ButtonStyle.Success,
          'danger': ButtonStyle.Danger
        };
        
        button = new ButtonBuilder()
          .setCustomId(isPreview ? `preview_role_${btn.value}` : `embed_togglerole_${btn.value}`)
          .setLabel(btn.label)
          .setStyle(styleMap[btn.color] || ButtonStyle.Primary)
          .setDisabled(isPreview);
      } else {
        const styleMap = {
          'primary': ButtonStyle.Primary,
          'secondary': ButtonStyle.Secondary,
          'success': ButtonStyle.Success,
          'danger': ButtonStyle.Danger
        };
        
        button = new ButtonBuilder()
          .setCustomId(isPreview ? `preview_custom_${btn.value}` : `embed_customaction_${btn.value}`)
          .setLabel(btn.label)
          .setStyle(styleMap[btn.color] || ButtonStyle.Primary)
          .setDisabled(isPreview);
      }
      
      if (btn.emoji) {
        button.setEmoji(btn.emoji);
      }
      
      currentRow.addComponents(button);
      buttonsInRow++;
    }
    
    if (buttonsInRow > 0) {
      rows.push(currentRow);
    }
    
    return rows;
  }
}

module.exports = EmbedManager;