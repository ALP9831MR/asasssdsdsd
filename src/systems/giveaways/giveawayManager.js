// ========================================
// 📁 systems/giveaways/giveawayManager.js
// ========================================

const { 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class GiveawayManager {
  static dataPath = path.join(__dirname, '../../data/giveaways/giveaways.json');
  
  /**
   * Carga los datos de sorteos
   */
  static loadData() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        const initialData = { guilds: {} };
        this.saveData(initialData);
        return initialData;
      }
      return JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
    } catch (error) {
      console.error('Error al cargar datos de sorteos:', error);
      return { guilds: {} };
    }
  }
  
  /**
   * Guarda los datos de sorteos
   */
  static saveData(data) {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error al guardar datos de sorteos:', error);
    }
  }
  
  /**
   * Convierte duración en milisegundos
   */
  static parseDuration(duration) {
    const units = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000
    };
    
    const match = duration.match(/^(\d+)([mhdw])$/);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return value * units[unit];
  }
  
  /**
   * Formatea duración para lectura
   */
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} día${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours !== 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
  }
  
  /**
   * Crea un nuevo sorteo
   */
  static async createGiveaway(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const guildId = interaction.guild.id;
      const prize = interaction.options.getString('premio');
      const duration = interaction.options.getString('duracion');
      const winners = interaction.options.getInteger('ganadores');
      const channel = interaction.options.getChannel('canal');
      const description = interaction.options.getString('descripcion') || 'Reacciona con 🎉 para participar';
      const requirements = interaction.options.getString('requisitos') || 'Ninguno';
      const color = interaction.options.getString('color') || '#FF6B9D';
      const image = interaction.options.getString('imagen') || null;
      
      // Validaciones
      if (channel.type !== ChannelType.GuildText) {
        return interaction.followUp({
          content: '❌ El canal debe ser un canal de texto.',
          ephemeral: true
        });
      }
      
      const ms = this.parseDuration(duration);
      if (!ms) {
        return interaction.followUp({
          content: '❌ Formato de duración inválido. Usa: 1m, 1h, 1d, 1w',
          ephemeral: true
        });
      }
      
      if (winners < 1 || winners > 20) {
        return interaction.followUp({
          content: '❌ El número de ganadores debe estar entre 1 y 20.',
          ephemeral: true
        });
      }
      
      // Crear ID único
      const giveawayId = `G${Date.now()}`;
      const endsAt = Date.now() + ms;
      
      // Crear embed del sorteo
      const giveawayEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🎉 ¡SORTEO ACTIVO! 🎉')
        .setDescription(
          `**Premio:** ${prize}\n\n` +
          `${description}\n\n` +
          `**Requisitos:**\n${requirements}\n\n` +
          `**Ganadores:** ${winners}\n` +
          `**Termina:** <t:${Math.floor(endsAt / 1000)}:R>\n` +
          `**Organizador:** ${interaction.user}`
        )
        .setFooter({ text: `ID: ${giveawayId} | Reacciona con 🎉 para participar` })
        .setTimestamp(endsAt);
      
      if (image) {
        giveawayEmbed.setImage(image);
      }
      
      // Botones
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_enter_${giveawayId}`)
            .setLabel('🎉 Participar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`giveaway_leave_${giveawayId}`)
            .setLabel('❌ Salir')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`giveaway_participants_${giveawayId}`)
            .setLabel('👥 Ver Participantes')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`giveaway_submit_proof_${giveawayId}`)
            .setLabel('📸 Enviar Pruebas')
            .setStyle(ButtonStyle.Secondary)
        );
      
      // Enviar mensaje del sorteo
      const giveawayMessage = await channel.send({
        content: '@everyone',
        embeds: [giveawayEmbed],
        components: [row]
      });
      
      // Guardar en base de datos
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        data.guilds[guildId] = { giveaways: [] };
      }
      
      const giveawayData = {
        id: giveawayId,
        messageId: giveawayMessage.id,
        channelId: channel.id,
        guildId: guildId,
        prize: prize,
        description: description,
        requirements: requirements,
        winners: winners,
        color: color,
        image: image,
        host: interaction.user.id,
        hostTag: interaction.user.tag,
        participants: [],
        participantsWithProof: [], // Usuarios que enviaron pruebas
        proofs: {}, // {userId: {proofText: "", attachments: []}}
        startedAt: new Date().toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        duration: duration,
        durationMs: ms,
        ended: false,
        winnersSelected: [],
        cancelled: false
      };
      
      data.guilds[guildId].giveaways.push(giveawayData);
      this.saveData(data);
      
      // Programar finalización
      this.scheduleEnd(client, giveawayData);
      
      // Respuesta
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Sorteo Creado')
        .setDescription(
          `**Premio:** ${prize}\n` +
          `**Canal:** ${channel}\n` +
          `**Duración:** ${this.formatDuration(ms)}\n` +
          `**Ganadores:** ${winners}\n` +
          `**ID:** \`${giveawayId}\`\n\n` +
          `El sorteo ha sido publicado exitosamente.`
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
      
    } catch (error) {
      console.error('Error al crear sorteo:', error);
      await interaction.followUp({
        content: '❌ Error al crear el sorteo.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Usuario participa en sorteo
   */
  static async enterGiveaway(interaction) {
    try {
      const giveawayId = interaction.customId.split('_')[2];
      const userId = interaction.user.id;
      
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.reply({
          content: '❌ Este sorteo ya no existe.',
          ephemeral: true
        });
      }
      
      if (giveaway.ended) {
        return interaction.reply({
          content: '❌ Este sorteo ya ha finalizado.',
          ephemeral: true
        });
      }
      
      if (giveaway.participants.includes(userId)) {
        return interaction.reply({
          content: '✅ Ya estás participando en este sorteo.',
          ephemeral: true
        });
      }
      
      // Agregar participante
      giveaway.participants.push(userId);
      this.saveData(data);
      
      await interaction.reply({
        content: `✅ ¡Has entrado al sorteo!\n\n**Requisitos:** ${giveaway.requirements}\n\n💡 **Cómo enviar pruebas:**\n• Usa el botón "📸 Enviar Pruebas" y describe cómo cumpliste los requisitos\n• Incluye tu usuario de Roblox, enlaces, capturas, etc.\n• También puedes abrir un ticket en <#1437866794206494791> para verificación manual\n\n⚠️ **Importante:** Solo participantes con pruebas válidas serán elegibles para ganar.`,
        ephemeral: true
      });
      
      // Actualizar contador en el embed
      await this.updateGiveawayMessage(interaction.client, giveaway);
      
    } catch (error) {
      console.error('Error al entrar al sorteo:', error);
      await interaction.reply({
        content: '❌ Error al procesar tu participación.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Usuario sale del sorteo
   */
  static async leaveGiveaway(interaction) {
    try {
      const giveawayId = interaction.customId.split('_')[2];
      const userId = interaction.user.id;
      
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.reply({
          content: '❌ Este sorteo ya no existe.',
          ephemeral: true
        });
      }
      
      if (giveaway.ended) {
        return interaction.reply({
          content: '❌ Este sorteo ya ha finalizado.',
          ephemeral: true
        });
      }
      
      if (!giveaway.participants.includes(userId)) {
        return interaction.reply({
          content: '❌ No estás participando en este sorteo.',
          ephemeral: true
        });
      }
      
      // Remover participante
      giveaway.participants = giveaway.participants.filter(id => id !== userId);
      
      // Remover de participantes con prueba
      if (giveaway.participantsWithProof.includes(userId)) {
        giveaway.participantsWithProof = giveaway.participantsWithProof.filter(id => id !== userId);
        delete giveaway.proofs[userId];
      }
      
      this.saveData(data);
      
      await interaction.reply({
        content: '✅ Has salido del sorteo.',
        ephemeral: true
      });
      
      // Actualizar contador
      await this.updateGiveawayMessage(interaction.client, giveaway);
      
    } catch (error) {
      console.error('Error al salir del sorteo:', error);
      await interaction.reply({
        content: '❌ Error al procesar tu salida.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Mostrar embed informativo y luego modal para enviar pruebas
   */
  static async showProofModal(interaction) {
    try {
      const giveawayId = interaction.customId.split('_')[3];
      
      // Primero enviar el embed informativo
      const infoEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📸 Enviar Pruebas del Sorteo')
        .setDescription(
          '**Tienes 2 opciones para enviar tus pruebas:**\n\n' +
          '**1️⃣ Enviar aquí directamente:**\n' +
          '• Presiona el botón de abajo para abrir el formulario\n' +
          '• Escribe tu información (usuario de Roblox, enlaces, etc.)\n' +
          '• Las pruebas se enviarán automáticamente\n\n' +
          '**2️⃣ Abrir un ticket:**\n' +
          '• Ve al canal <#1437866794206494791>\n' +
          '• Abre un ticket para verificación manual\n' +
          '• Un staff revisará tus pruebas personalmente\n\n' +
          '💡 **Ejemplos de pruebas válidas:**\n' +
          '• Usuario de Roblox: `MiUsuario123`\n' +
          '• Capturas de pantalla (en ticket)\n' +
          '• Enlaces de perfil o pruebas\n' +
          '• Invitaciones realizadas\n\n' +
          '⚠️ **Importante:** Solo participantes con pruebas válidas podrán ganar.'
        )
        .setFooter({ text: 'Presiona el botón de abajo para enviar tus pruebas aquí' })
        .setTimestamp();
      
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_open_proof_modal_${giveawayId}`)
            .setLabel('📝 Abrir Formulario')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel('🎫 Ir a Tickets')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com/channels/' + interaction.guild.id + '/1437866794206494791')
        );
      
      await interaction.reply({
        embeds: [infoEmbed],
        components: [buttonRow],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error al mostrar información de pruebas:', error);
      await interaction.reply({
        content: '❌ Error al mostrar la información.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Abrir el modal de pruebas
   */
  static async openProofModal(interaction) {
    try {
      const giveawayId = interaction.customId.split('_')[4];
      
      const modal = new ModalBuilder()
        .setCustomId(`giveaway_proof_submit_${giveawayId}`)
        .setTitle('Enviar Pruebas del Sorteo');
      
      const proofInput = new TextInputBuilder()
        .setCustomId('proof_text')
        .setLabel('Describe cómo cumpliste los requisitos')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: Usuario Roblox: MiUsuario123 - Enlaces o detalles aquí')
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);
      
      const row = new ActionRowBuilder().addComponents(proofInput);
      modal.addComponents(row);
      
      await interaction.showModal(modal);
      
    } catch (error) {
      console.error('Error al abrir modal:', error);
    }
  }
  
  /**
   * Procesar envío de pruebas
   */
  static async submitProof(interaction) {
    try {
      const giveawayId = interaction.customId.split('_')[3];
      const userId = interaction.user.id;
      const proofText = interaction.fields.getTextInputValue('proof_text');
      
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.reply({
          content: '❌ Este sorteo ya no existe.',
          ephemeral: true
        });
      }
      
      if (!giveaway.participants.includes(userId)) {
        return interaction.reply({
          content: '❌ Primero debes participar en el sorteo usando el botón "🎉 Participar".',
          ephemeral: true
        });
      }
      
      // Guardar prueba
      if (!giveaway.proofs) giveaway.proofs = {};
      if (!giveaway.participantsWithProof) giveaway.participantsWithProof = [];
      
      giveaway.proofs[userId] = {
        text: proofText,
        submittedAt: new Date().toISOString(),
        userTag: interaction.user.tag
      };
      
      if (!giveaway.participantsWithProof.includes(userId)) {
        giveaway.participantsWithProof.push(userId);
      }
      
      this.saveData(data);
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Pruebas Enviadas Exitosamente')
        .setDescription(
          '**Tus pruebas han sido registradas:**\n\n' +
          `${proofText.substring(0, 200)}${proofText.length > 200 ? '...' : ''}\n\n` +
          '✅ El organizador las revisará\n' +
          '✅ Puedes actualizar tus pruebas enviándolas nuevamente\n' +
          '✅ También puedes complementar con un ticket en <#1437866794206494791>'
        )
        .setFooter({ text: `Sorteo: ${giveaway.prize}` })
        .setTimestamp();
      
      await interaction.reply({
        embeds: [successEmbed],
        ephemeral: true
      });
      
      // Notificar al host
      try {
        const host = await interaction.client.users.fetch(giveaway.host);
        const notifEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('📸 Nueva Prueba Recibida')
          .setDescription(
            `**Usuario:** ${interaction.user} (${interaction.user.tag})\n` +
            `**Sorteo:** ${giveaway.prize}\n` +
            `**ID:** \`${giveaway.id}\`\n\n` +
            `**Pruebas enviadas:**\n${proofText}`
          )
          .setTimestamp();
        
        await host.send({ embeds: [notifEmbed] });
      } catch (error) {
        console.log('No se pudo notificar al host');
      }
      
    } catch (error) {
      console.error('Error al enviar prueba:', error);
      await interaction.reply({
        content: '❌ Error al enviar tus pruebas.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Ver participantes
   */
  static async showParticipants(interaction) {
    try {
      const giveawayId = interaction.customId.split('_')[2];
      
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.reply({
          content: '❌ Este sorteo ya no existe.',
          ephemeral: true
        });
      }
      
      const totalParticipants = giveaway.participants.length;
      const withProof = giveaway.participantsWithProof?.length || 0;
      
      const embed = new EmbedBuilder()
        .setColor(giveaway.color)
        .setTitle(`👥 Participantes del Sorteo`)
        .setDescription(
          `**Premio:** ${giveaway.prize}\n\n` +
          `📊 **Total de participantes:** ${totalParticipants}\n` +
          `📸 **Con pruebas enviadas:** ${withProof}\n` +
          `🎯 **Ganadores a elegir:** ${giveaway.winners}`
        )
        .setFooter({ text: `ID: ${giveaway.id}` })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      
    } catch (error) {
      console.error('Error al mostrar participantes:', error);
      await interaction.reply({
        content: '❌ Error al obtener los participantes.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Actualiza el mensaje del sorteo
   */
  static async updateGiveawayMessage(client, giveaway) {
    try {
      const channel = await client.channels.fetch(giveaway.channelId);
      const message = await channel.messages.fetch(giveaway.messageId);
      
      const totalParticipants = giveaway.participants.length;
      const withProof = giveaway.participantsWithProof?.length || 0;
      
      const updatedEmbed = new EmbedBuilder()
        .setColor(giveaway.color)
        .setTitle('🎉 ¡SORTEO ACTIVO! 🎉')
        .setDescription(
          `**Premio:** ${giveaway.prize}\n\n` +
          `${giveaway.description}\n\n` +
          `**Requisitos:**\n${giveaway.requirements}\n\n` +
          `**Ganadores:** ${giveaway.winners}\n` +
          `**Participantes:** ${totalParticipants} (${withProof} con pruebas)\n` +
          `**Termina:** <t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>\n` +
          `**Organizador:** <@${giveaway.host}>`
        )
        .setFooter({ text: `ID: ${giveaway.id} | Reacciona con 🎉 para participar` })
        .setTimestamp(new Date(giveaway.endsAt));
      
      if (giveaway.image) {
        updatedEmbed.setImage(giveaway.image);
      }
      
      await message.edit({ embeds: [updatedEmbed] });
      
    } catch (error) {
      console.error('Error al actualizar mensaje:', error);
    }
  }
  
  /**
   * Programa la finalización del sorteo
   */
  static scheduleEnd(client, giveaway) {
    const now = Date.now();
    const endsAt = new Date(giveaway.endsAt).getTime();
    const timeLeft = endsAt - now;
    
    if (timeLeft <= 0) {
      this.endGiveaway(client, giveaway.id);
      return;
    }
    
    setTimeout(() => {
      this.endGiveaway(client, giveaway.id);
    }, timeLeft);
  }
  
  /**
   * Finaliza el sorteo y elige ganadores
   */
  static async endGiveaway(client, giveawayId) {
    try {
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway || giveaway.ended) return;
      
      giveaway.ended = true;
      
      // Elegir ganadores (priorizar usuarios con pruebas si hay requisitos)
      let eligibleParticipants = giveaway.participants;
      
      // Si hay requisitos y usuarios con pruebas, elegir solo de esos
      if (giveaway.requirements !== 'Ninguno' && giveaway.participantsWithProof && giveaway.participantsWithProof.length > 0) {
        eligibleParticipants = giveaway.participantsWithProof;
      }
      
      const winners = [];
      const winnersCount = Math.min(giveaway.winners, eligibleParticipants.length);
      
      const shuffled = [...eligibleParticipants].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < winnersCount; i++) {
        winners.push(shuffled[i]);
      }
      
      giveaway.winnersSelected = winners;
      this.saveData(data);
      
      // Anunciar ganadores
      const channel = await client.channels.fetch(giveaway.channelId);
      const message = await channel.messages.fetch(giveaway.messageId);
      
      if (winners.length === 0) {
        const noWinnersEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🎉 Sorteo Finalizado')
          .setDescription(
            `**Premio:** ${giveaway.prize}\n\n` +
            `😔 No hubo suficientes participantes válidos.\n\n` +
            `**Organizador:** <@${giveaway.host}>`
          )
          .setFooter({ text: `ID: ${giveaway.id}` })
          .setTimestamp();
        
        await message.edit({ embeds: [noWinnersEmbed], components: [] });
        await channel.send({ embeds: [noWinnersEmbed] });
        
        return;
      }
      
      const winnersMentions = winners.map(id => `<@${id}>`).join(', ');
      
      const winnersEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎊 ¡SORTEO FINALIZADO! 🎊')
        .setDescription(
          `**Premio:** ${giveaway.prize}\n\n` +
          `🎉 **Ganador${winners.length > 1 ? 'es' : ''}:** ${winnersMentions}\n\n` +
          `¡Felicidades! El organizador se pondrá en contacto contigo.\n\n` +
          `**Organizador:** <@${giveaway.host}>`
        )
        .setFooter({ text: `ID: ${giveaway.id} | Total de participantes: ${giveaway.participants.length}` })
        .setTimestamp();
      
      await message.edit({ embeds: [winnersEmbed], components: [] });
      await channel.send({ 
        content: `🎉 ${winnersMentions}`,
        embeds: [winnersEmbed] 
      });
      
      // Notificar al organizador
      try {
        const host = await client.users.fetch(giveaway.host);
        const hostEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎊 Tu Sorteo Ha Finalizado')
          .setDescription(
            `**Premio:** ${giveaway.prize}\n` +
            `**ID:** \`${giveaway.id}\`\n\n` +
            `**Ganadores:**\n${winners.map((id, i) => `${i + 1}. <@${id}>`).join('\n')}\n\n` +
            `Usa \`/giveaway winners ${giveaway.id}\` para ver las pruebas de los ganadores.`
          )
          .setTimestamp();
        
        await host.send({ embeds: [hostEmbed] });
      } catch (error) {
        console.log('No se pudo notificar al host');
      }
      
    } catch (error) {
      console.error('Error al finalizar sorteo:', error);
    }
  }
  
  /**
   * Busca un sorteo por ID
   */
  static findGiveaway(data, giveawayId) {
    for (const guildData of Object.values(data.guilds)) {
      const giveaway = guildData.giveaways.find(g => g.id === giveawayId);
      if (giveaway) return giveaway;
    }
    return null;
  }
  
  /**
   * Lista todos los sorteos activos
   */
  static async listActive(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        return interaction.followUp({
          content: '✅ No hay sorteos activos en este servidor.',
          ephemeral: true
        });
      }
      
      const activeGiveaways = data.guilds[guildId].giveaways.filter(g => !g.ended && !g.cancelled);
      
      if (activeGiveaways.length === 0) {
        return interaction.followUp({
          content: '✅ No hay sorteos activos en este servidor.',
          ephemeral: true
        });
      }
      
      const listText = activeGiveaways.map((g, index) => {
        const endsAt = Math.floor(new Date(g.endsAt).getTime() / 1000);
        return `**${index + 1}.** ${g.prize}\n` +
               `   📊 Participantes: ${g.participants.length}\n` +
               `   🎯 Ganadores: ${g.winners}\n` +
               `   ⏰ Termina: <t:${endsAt}:R>\n` +
               `   🆔 ID: \`${g.id}\``;
      }).join('\n\n');
      
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎉 Sorteos Activos')
        .setDescription(listText)
        .setFooter({ text: `Total: ${activeGiveaways.length}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      
    } catch (error) {
      console.error('Error al listar sorteos:', error);
      await interaction.followUp({
        content: '❌ Error al obtener los sorteos.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Cancela un sorteo
   */
  static async cancelGiveaway(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (giveaway.host !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
        return interaction.followUp({
          content: '❌ Solo el organizador o un administrador puede cancelar este sorteo.',
          ephemeral: true
        });
      }
      
      if (giveaway.ended) {
        return interaction.followUp({
          content: '❌ Este sorteo ya ha finalizado.',
          ephemeral: true
        });
      }
      
      giveaway.cancelled = true;
      giveaway.ended = true;
      this.saveData(data);
      
      // Actualizar mensaje
      const channel = await interaction.client.channels.fetch(giveaway.channelId);
      const message = await channel.messages.fetch(giveaway.messageId);
      
      const cancelEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Sorteo Cancelado')
        .setDescription(
          `**Premio:** ${giveaway.prize}\n\n` +
          `Este sorteo ha sido cancelado por ${interaction.user}.\n\n` +
          `**Organizador:** <@${giveaway.host}>`
        )
        .setFooter({ text: `ID: ${giveaway.id}` })
        .setTimestamp();
      
      await message.edit({ embeds: [cancelEmbed], components: [] });
      
      await interaction.followUp({
        content: '✅ El sorteo ha sido cancelado exitosamente.',
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error al cancelar sorteo:', error);
      await interaction.followUp({
        content: '❌ Error al cancelar el sorteo.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Ver ganadores y sus pruebas
   */
  static async viewWinners(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (!giveaway.ended) {
        return interaction.followUp({
          content: '❌ Este sorteo aún no ha finalizado.',
          ephemeral: true
        });
      }
      
      if (giveaway.winnersSelected.length === 0) {
        return interaction.followUp({
          content: '❌ Este sorteo no tuvo ganadores.',
          ephemeral: true
        });
      }
      
      // Crear embed con ganadores
      const winnersInfo = await Promise.all(
        giveaway.winnersSelected.map(async (userId, index) => {
          const user = await interaction.client.users.fetch(userId).catch(() => null);
          const userTag = user ? user.tag : 'Usuario Desconocido';
          const proof = giveaway.proofs[userId];
          
          let proofText = '❌ Sin pruebas enviadas';
          if (proof) {
            proofText = `✅ Pruebas enviadas:\n${proof.text.substring(0, 200)}${proof.text.length > 200 ? '...' : ''}`;
          }
          
          return `**${index + 1}. ${userTag}** (<@${userId}>)\n${proofText}`;
        })
      );
      
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🏆 Ganadores del Sorteo`)
        .setDescription(
          `**Premio:** ${giveaway.prize}\n` +
          `**ID:** \`${giveaway.id}\`\n\n` +
          winnersInfo.join('\n\n')
        )
        .setFooter({ text: `Total de participantes: ${giveaway.participants.length}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      
    } catch (error) {
      console.error('Error al ver ganadores:', error);
      await interaction.followUp({
        content: '❌ Error al obtener los ganadores.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Ver todas las pruebas enviadas
   */
  static async viewAllProofs(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (giveaway.host !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
        return interaction.followUp({
          content: '❌ Solo el organizador o un administrador puede ver las pruebas.',
          ephemeral: true
        });
      }
      
      if (!giveaway.participantsWithProof || giveaway.participantsWithProof.length === 0) {
        return interaction.followUp({
          content: '❌ No hay pruebas enviadas para este sorteo.',
          ephemeral: true
        });
      }
      
      // Crear archivo de texto con todas las pruebas
      let proofsText = `📋 PRUEBAS DEL SORTEO\n`;
      proofsText += `Premio: ${giveaway.prize}\n`;
      proofsText += `ID: ${giveaway.id}\n`;
      proofsText += `Organizador: ${giveaway.hostTag}\n`;
      proofsText += `Total de pruebas: ${giveaway.participantsWithProof.length}\n\n`;
      proofsText += `${'='.repeat(80)}\n\n`;
      
      for (const userId of giveaway.participantsWithProof) {
        const proof = giveaway.proofs[userId];
        if (proof) {
          proofsText += `Usuario: ${proof.userTag} (${userId})\n`;
          proofsText += `Enviado: ${new Date(proof.submittedAt).toLocaleString('es-ES')}\n`;
          proofsText += `\nPruebas:\n${proof.text}\n\n`;
          proofsText += `${'-'.repeat(80)}\n\n`;
        }
      }
      
      // Enviar como archivo
      const buffer = Buffer.from(proofsText, 'utf-8');
      const attachment = { attachment: buffer, name: `pruebas_${giveawayId}.txt` };
      
      await interaction.followUp({
        content: `📋 Aquí están todas las pruebas enviadas (${giveaway.participantsWithProof.length} usuarios)`,
        files: [attachment],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error al ver pruebas:', error);
      await interaction.followUp({
        content: '❌ Error al obtener las pruebas.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Reroll (elegir nuevos ganadores)
   */
  static async rerollGiveaway(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (giveaway.host !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
        return interaction.followUp({
          content: '❌ Solo el organizador o un administrador puede hacer reroll.',
          ephemeral: true
        });
      }
      
      if (!giveaway.ended) {
        return interaction.followUp({
          content: '❌ Este sorteo aún no ha finalizado.',
          ephemeral: true
        });
      }
      
      // Obtener participantes elegibles (excluyendo ganadores anteriores)
      let eligibleParticipants = giveaway.participants.filter(
        id => !giveaway.winnersSelected.includes(id)
      );
      
      // Priorizar usuarios con pruebas
      if (giveaway.requirements !== 'Ninguno' && giveaway.participantsWithProof && giveaway.participantsWithProof.length > 0) {
        eligibleParticipants = eligibleParticipants.filter(id => 
          giveaway.participantsWithProof.includes(id)
        );
      }
      
      if (eligibleParticipants.length === 0) {
        return interaction.followUp({
          content: '❌ No hay más participantes elegibles para el reroll.',
          ephemeral: true
        });
      }
      
      // Elegir nuevos ganadores
      const newWinnersCount = Math.min(giveaway.winners, eligibleParticipants.length);
      const shuffled = [...eligibleParticipants].sort(() => Math.random() - 0.5);
      const newWinners = shuffled.slice(0, newWinnersCount);
      
      // Actualizar ganadores
      giveaway.winnersSelected = [...giveaway.winnersSelected, ...newWinners];
      this.saveData(data);
      
      // Anunciar nuevos ganadores
      const channel = await interaction.client.channels.fetch(giveaway.channelId);
      const winnersMentions = newWinners.map(id => `<@${id}>`).join(', ');
      
      const rerollEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🔄 ¡NUEVOS GANADORES! (REROLL)')
        .setDescription(
          `**Premio:** ${giveaway.prize}\n\n` +
          `🎉 **Nuevo${newWinners.length > 1 ? 's' : ''} ganador${newWinners.length > 1 ? 'es' : ''}:** ${winnersMentions}\n\n` +
          `¡Felicidades! El organizador se pondrá en contacto contigo.\n\n` +
          `**Organizador:** <@${giveaway.host}>`
        )
        .setFooter({ text: `ID: ${giveaway.id} | Reroll solicitado por ${interaction.user.tag}` })
        .setTimestamp();
      
      await channel.send({ 
        content: `🎉 ${winnersMentions}`,
        embeds: [rerollEmbed] 
      });
      
      await interaction.followUp({
        content: `✅ Reroll exitoso. Nuevos ganadores: ${winnersMentions}`,
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error al hacer reroll:', error);
      await interaction.followUp({
        content: '❌ Error al hacer reroll del sorteo.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Editar un sorteo activo
   */
  static async editGiveaway(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const newPrize = interaction.options.getString('premio');
      const newDescription = interaction.options.getString('descripcion');
      const newRequirements = interaction.options.getString('requisitos');
      const newWinners = interaction.options.getInteger('ganadores');
      
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (giveaway.host !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
        return interaction.followUp({
          content: '❌ Solo el organizador o un administrador puede editar este sorteo.',
          ephemeral: true
        });
      }
      
      if (giveaway.ended) {
        return interaction.followUp({
          content: '❌ No puedes editar un sorteo que ya ha finalizado.',
          ephemeral: true
        });
      }
      
      // Actualizar datos
      if (newPrize) giveaway.prize = newPrize;
      if (newDescription) giveaway.description = newDescription;
      if (newRequirements) giveaway.requirements = newRequirements;
      if (newWinners) giveaway.winners = newWinners;
      
      this.saveData(data);
      
      // Actualizar mensaje
      await this.updateGiveawayMessage(interaction.client, giveaway);
      
      await interaction.followUp({
        content: '✅ El sorteo ha sido actualizado exitosamente.',
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error al editar sorteo:', error);
      await interaction.followUp({
        content: '❌ Error al editar el sorteo.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Ver historial de sorteos
   */
  static async viewHistory(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId] || data.guilds[guildId].giveaways.length === 0) {
        return interaction.followUp({
          content: '✅ No hay historial de sorteos en este servidor.',
          ephemeral: true
        });
      }
      
      const allGiveaways = data.guilds[guildId].giveaways;
      const recentGiveaways = allGiveaways.slice(-10).reverse();
      
      const historyText = recentGiveaways.map((g, index) => {
        const status = g.cancelled ? '❌ Cancelado' : (g.ended ? '✅ Finalizado' : '🔴 Activo');
        const date = new Date(g.startedAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        
        return `**${index + 1}.** ${g.prize} ${status}\n` +
               `   📅 ${date}\n` +
               `   👥 ${g.participants.length} participantes\n` +
               `   🏆 ${g.winnersSelected?.length || 0} ganadores\n` +
               `   🆔 \`${g.id}\``;
      }).join('\n\n');
      
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📜 Historial de Sorteos')
        .setDescription(
          `**Total de sorteos:** ${allGiveaways.length}\n` +
          `**Activos:** ${allGiveaways.filter(g => !g.ended).length}\n` +
          `**Finalizados:** ${allGiveaways.filter(g => g.ended && !g.cancelled).length}\n` +
          `**Cancelados:** ${allGiveaways.filter(g => g.cancelled).length}\n\n` +
          `**Últimos 10 sorteos:**\n\n${historyText}`
        )
        .setFooter({ text: 'Mostrando los 10 más recientes' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      
    } catch (error) {
      console.error('Error al ver historial:', error);
      await interaction.followUp({
        content: '❌ Error al obtener el historial.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Finalizar sorteo manualmente
   */
  static async endManually(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (giveaway.host !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
        return interaction.followUp({
          content: '❌ Solo el organizador o un administrador puede finalizar este sorteo.',
          ephemeral: true
        });
      }
      
      if (giveaway.ended) {
        return interaction.followUp({
          content: '❌ Este sorteo ya ha finalizado.',
          ephemeral: true
        });
      }
      
      // Finalizar inmediatamente
      await this.endGiveaway(interaction.client, giveaway.id);
      
      await interaction.followUp({
        content: '✅ El sorteo ha sido finalizado manualmente y los ganadores han sido elegidos.',
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error al finalizar sorteo:', error);
      await interaction.followUp({
        content: '❌ Error al finalizar el sorteo.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Agregar prueba manualmente (para pruebas enviadas por ticket)
   */
  static async addProofManually(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const user = interaction.options.getUser('usuario');
      const proofText = interaction.options.getString('prueba') || 'Verificado manualmente por ticket';
      
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (giveaway.host !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
        return interaction.followUp({
          content: '❌ Solo el organizador o un administrador puede agregar pruebas manualmente.',
          ephemeral: true
        });
      }
      
      if (giveaway.ended) {
        return interaction.followUp({
          content: '❌ Este sorteo ya ha finalizado.',
          ephemeral: true
        });
      }
      
      if (!giveaway.participants.includes(user.id)) {
        return interaction.followUp({
          content: '❌ Este usuario no está participando en el sorteo.',
          ephemeral: true
        });
      }
      
      // Agregar prueba manualmente
      if (!giveaway.proofs) giveaway.proofs = {};
      if (!giveaway.participantsWithProof) giveaway.participantsWithProof = [];
      
      giveaway.proofs[user.id] = {
        text: proofText,
        submittedAt: new Date().toISOString(),
        userTag: user.tag,
        manuallyAdded: true,
        addedBy: interaction.user.tag
      };
      
      if (!giveaway.participantsWithProof.includes(user.id)) {
        giveaway.participantsWithProof.push(user.id);
      }
      
      this.saveData(data);
      
      // Actualizar mensaje del sorteo
      await this.updateGiveawayMessage(interaction.client, giveaway);
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Prueba Agregada Manualmente')
        .setDescription(
          `**Usuario:** ${user} (${user.tag})\n` +
          `**Sorteo:** ${giveaway.prize}\n` +
          `**ID:** \`${giveaway.id}\`\n\n` +
          `**Prueba registrada:**\n${proofText}\n\n` +
          `✅ Este usuario ahora cuenta como "con pruebas válidas"`
        )
        .setFooter({ text: 'Agregado manualmente por ' + interaction.user.tag })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
      
      // Notificar al usuario
      try {
        const notifEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Tus Pruebas Han Sido Verificadas')
          .setDescription(
            `**Sorteo:** ${giveaway.prize}\n` +
            `**ID:** \`${giveaway.id}\`\n\n` +
            `Un staff ha verificado tus pruebas manualmente.\n` +
            `✅ Ahora eres elegible para ganar el sorteo.\n\n` +
            `¡Buena suerte! 🍀`
          )
          .setTimestamp();
        
        await user.send({ embeds: [notifEmbed] });
      } catch (error) {
        console.log('No se pudo notificar al usuario');
      }
      
    } catch (error) {
      console.error('Error al agregar prueba manualmente:', error);
      await interaction.followUp({
        content: '❌ Error al agregar la prueba.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Remover prueba manualmente
   */
  static async removeProofManually(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const giveawayId = interaction.options.getString('id');
      const user = interaction.options.getUser('usuario');
      
      const data = this.loadData();
      const giveaway = this.findGiveaway(data, giveawayId);
      
      if (!giveaway) {
        return interaction.followUp({
          content: '❌ No se encontró un sorteo con ese ID.',
          ephemeral: true
        });
      }
      
      if (giveaway.host !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
        return interaction.followUp({
          content: '❌ Solo el organizador o un administrador puede remover pruebas.',
          ephemeral: true
        });
      }
      
      if (!giveaway.participantsWithProof || !giveaway.participantsWithProof.includes(user.id)) {
        return interaction.followUp({
          content: '❌ Este usuario no tiene pruebas registradas.',
          ephemeral: true
        });
      }
      
      // Remover prueba
      giveaway.participantsWithProof = giveaway.participantsWithProof.filter(id => id !== user.id);
      if (giveaway.proofs && giveaway.proofs[user.id]) {
        delete giveaway.proofs[user.id];
      }
      
      this.saveData(data);
      
      // Actualizar mensaje del sorteo
      await this.updateGiveawayMessage(interaction.client, giveaway);
      
      await interaction.followUp({
        content: `✅ Se han removido las pruebas de ${user.tag} del sorteo.`,
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error al remover prueba:', error);
      await interaction.followUp({
        content: '❌ Error al remover la prueba.',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  /**
   * Inicializa el sistema (cargar sorteos activos al reiniciar el bot)
   */
  static initializeSystem(client) {
    const data = this.loadData();
    
    for (const guildData of Object.values(data.guilds)) {
      for (const giveaway of guildData.giveaways) {
        if (!giveaway.ended && !giveaway.cancelled) {
          this.scheduleEnd(client, giveaway);
          console.log(`✅ Sorteo ${giveaway.id} programado para finalizar`);
        }
      }
    }
  }
}

module.exports = GiveawayManager;