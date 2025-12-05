// ========================================
// 📁 systems/moderation/notesManager.js
// ========================================

const { 
  EmbedBuilder,
  MessageFlags,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class NotesManager {
  static dataPath = path.join(__dirname, '../../data/moderation/notes.json');
  
  /**
   * Carga los datos de notas
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
      console.error('Error al cargar datos de notas:', error);
      return { guilds: {} };
    }
  }
  
  /**
   * Guarda los datos de notas
   */
  static saveData(data) {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error al guardar datos de notas:', error);
    }
  }
  
  /**
   * Obtiene el emoji de categoría
   */
  static getCategoryEmoji(category) {
    const emojis = {
      'general': '📝',
      'advertencia': '⚠️',
      'observacion': '🔍',
      'sospecha': '🚨',
      'positivo': '✅',
      'negativo': '❌'
    };
    return emojis[category] || '📝';
  }
  
  /**
   * Obtiene el nombre de categoría
   */
  static getCategoryName(category) {
    const names = {
      'general': 'General',
      'advertencia': 'Advertencia',
      'observacion': 'Observación',
      'sospecha': 'Sospecha',
      'positivo': 'Positivo',
      'negativo': 'Negativo'
    };
    return names[category] || 'General';
  }
  
  /**
   * Obtiene el color de categoría
   */
  static getCategoryColor(category) {
    const colors = {
      'general': '#5865F2',
      'advertencia': '#FFA500',
      'observacion': '#3498DB',
      'sospecha': '#E74C3C',
      'positivo': '#2ECC71',
      'negativo': '#E67E22'
    };
    return colors[category] || '#5865F2';
  }
  
  /**
   * Genera un ID único para la nota
   */
  static generateNoteId() {
    return `N${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }
  
  /**
   * Agrega una nota
   */
  static async addNote(interaction, client, usuario, nota, categoria) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const userId = usuario.id;
      const moderatorId = interaction.user.id;
      
      // Cargar datos
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        data.guilds[guildId] = {};
      }
      
      if (!data.guilds[guildId][userId]) {
        data.guilds[guildId][userId] = {
          notes: [],
          userTag: usuario.tag
        };
      }
      
      // Crear nota
      const noteId = this.generateNoteId();
      const noteData = {
        id: noteId,
        content: nota,
        category: categoria,
        moderator: moderatorId,
        moderatorTag: interaction.user.tag,
        timestamp: new Date().toISOString()
      };
      
      data.guilds[guildId][userId].notes.push(noteData);
      data.guilds[guildId][userId].userTag = usuario.tag; // Actualizar tag por si cambió
      this.saveData(data);
      
      // Respuesta
      const emoji = this.getCategoryEmoji(categoria);
      const categoryName = this.getCategoryName(categoria);
      const color = this.getCategoryColor(categoria);
      
      const successEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle('✅ Nota Agregada')
        .setDescription(
          `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
          `**Categoría:** ${emoji} ${categoryName}\n` +
          `**ID de la Nota:** \`${noteId}\`\n\n` +
          `**Contenido:**\n${nota}`
        )
        .setThumbnail(usuario.displayAvatarURL())
        .setFooter({ text: `Moderador: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al agregar nota:', error);
      await interaction.followUp({
        content: '❌ Error al agregar la nota.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Ver notas de un usuario
   */
  static async viewNotes(interaction, client, usuario, categoriaFiltro) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const userId = usuario.id;
      
      const data = this.loadData();
      
      if (!data.guilds[guildId] || !data.guilds[guildId][userId] || 
          data.guilds[guildId][userId].notes.length === 0) {
        return interaction.followUp({
          content: `✅ ${usuario} no tiene notas registradas.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      let notes = data.guilds[guildId][userId].notes;
      
      // Filtrar por categoría si se especificó
      if (categoriaFiltro) {
        notes = notes.filter(n => n.category === categoriaFiltro);
        
        if (notes.length === 0) {
          return interaction.followUp({
            content: `✅ ${usuario} no tiene notas en la categoría "${this.getCategoryName(categoriaFiltro)}".`,
            flags: MessageFlags.Ephemeral
          });
        }
      }
      
      // Mostrar últimas 10 notas
      const notesText = notes.slice(-10).reverse().map((note, index) => {
        const date = new Date(note.timestamp).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const emoji = this.getCategoryEmoji(note.category);
        const categoryName = this.getCategoryName(note.category);
        
        return `**${notes.length - index}.** \`${note.id}\` ${emoji} ${categoryName}\n` +
               `   📅 ${date}\n` +
               `   👮 ${note.moderatorTag}\n` +
               `   📝 ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`;
      }).join('\n\n');
      
      const viewEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📝 Notas de ${usuario.tag}`)
        .setDescription(
          `**Total de notas:** ${notes.length}${categoriaFiltro ? ` (Categoría: ${this.getCategoryName(categoriaFiltro)})` : ''}\n\n` +
          notesText +
          (notes.length > 10 ? `\n\n*Mostrando las 10 más recientes*` : '')
        )
        .setThumbnail(usuario.displayAvatarURL())
        .setFooter({ text: 'Usa /notes export para obtener todas las notas' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [viewEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al ver notas:', error);
      await interaction.followUp({
        content: '❌ Error al obtener las notas.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Eliminar una nota
   */
  static async removeNote(interaction, client, usuario, noteId) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const userId = usuario.id;
      
      const data = this.loadData();
      
      if (!data.guilds[guildId] || !data.guilds[guildId][userId]) {
        return interaction.followUp({
          content: '❌ Este usuario no tiene notas.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const notes = data.guilds[guildId][userId].notes;
      const noteIndex = notes.findIndex(n => n.id === noteId);
      
      if (noteIndex === -1) {
        return interaction.followUp({
          content: '❌ No se encontró una nota con ese ID.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const removedNote = notes.splice(noteIndex, 1)[0];
      this.saveData(data);
      
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Nota Eliminada')
        .setDescription(
          `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
          `**ID de la Nota:** \`${noteId}\`\n` +
          `**Categoría:** ${this.getCategoryEmoji(removedNote.category)} ${this.getCategoryName(removedNote.category)}\n\n` +
          `**Contenido eliminado:**\n${removedNote.content}`
        )
        .setFooter({ text: `Moderador: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al eliminar nota:', error);
      await interaction.followUp({
        content: '❌ Error al eliminar la nota.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Buscar en notas
   */
  static async searchNotes(interaction, client, texto) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        return interaction.followUp({
          content: '✅ No hay notas en este servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      const results = [];
      const searchLower = texto.toLowerCase();
      
      // Buscar en todas las notas del servidor
      for (const [userId, userData] of Object.entries(data.guilds[guildId])) {
        for (const note of userData.notes) {
          if (note.content.toLowerCase().includes(searchLower) ||
              note.moderatorTag.toLowerCase().includes(searchLower) ||
              userData.userTag.toLowerCase().includes(searchLower)) {
            results.push({
              userId,
              userTag: userData.userTag,
              ...note
            });
          }
        }
      }
      
      if (results.length === 0) {
        return interaction.followUp({
          content: `✅ No se encontraron notas que contengan "${texto}".`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Mostrar primeros 10 resultados
      const resultsText = results.slice(0, 10).map((note, index) => {
        const date = new Date(note.timestamp).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        
        const emoji = this.getCategoryEmoji(note.category);
        
        return `**${index + 1}.** ${note.userTag} - \`${note.id}\` ${emoji}\n` +
               `   📅 ${date} | 👮 ${note.moderatorTag}\n` +
               `   📝 ${note.content.substring(0, 80)}${note.content.length > 80 ? '...' : ''}`;
      }).join('\n\n');
      
      const searchEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🔍 Resultados de Búsqueda: "${texto}"`)
        .setDescription(
          `**Resultados encontrados:** ${results.length}\n\n` +
          resultsText +
          (results.length > 10 ? `\n\n*Mostrando los primeros 10 resultados*` : '')
        )
        .setFooter({ text: `Búsqueda en ${interaction.guild.name}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [searchEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al buscar notas:', error);
      await interaction.followUp({
        content: '❌ Error al buscar en las notas.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Exportar notas de un usuario
   */
  static async exportNotes(interaction, client, usuario) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const userId = usuario.id;
      
      const data = this.loadData();
      
      if (!data.guilds[guildId] || !data.guilds[guildId][userId] || 
          data.guilds[guildId][userId].notes.length === 0) {
        return interaction.followUp({
          content: `✅ ${usuario} no tiene notas para exportar.`,
          flags: MessageFlags.Ephemeral
        });
      }
      
      const notes = data.guilds[guildId][userId].notes;
      
      // Crear contenido del archivo
      let exportContent = `NOTAS DE MODERACIÓN - ${usuario.tag} (${userId})\n`;
      exportContent += `Servidor: ${interaction.guild.name}\n`;
      exportContent += `Fecha de exportación: ${new Date().toLocaleString('es-ES')}\n`;
      exportContent += `Total de notas: ${notes.length}\n`;
      exportContent += `Exportado por: ${interaction.user.tag}\n`;
      exportContent += `${'='.repeat(80)}\n\n`;
      
      notes.forEach((note, index) => {
        const date = new Date(note.timestamp).toLocaleString('es-ES');
        const categoryName = this.getCategoryName(note.category);
        
        exportContent += `[${index + 1}] ID: ${note.id}\n`;
        exportContent += `Fecha: ${date}\n`;
        exportContent += `Categoría: ${categoryName}\n`;
        exportContent += `Moderador: ${note.moderatorTag}\n`;
        exportContent += `Contenido:\n${note.content}\n`;
        exportContent += `${'-'.repeat(80)}\n\n`;
      });
      
      // Crear archivo
      const buffer = Buffer.from(exportContent, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { 
        name: `notas_${usuario.tag}_${Date.now()}.txt` 
      });
      
      const exportEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📄 Exportación de Notas')
        .setDescription(
          `**Usuario:** ${usuario} (\`${usuario.tag}\`)\n` +
          `**Total de notas:** ${notes.length}\n\n` +
          `Las notas han sido exportadas en formato de texto.`
        )
        .setFooter({ text: `Exportado por: ${interaction.user.tag}` })
        .setTimestamp();
      
      await interaction.followUp({ 
        embeds: [exportEmbed], 
        files: [attachment],
        flags: MessageFlags.Ephemeral 
      });
      
    } catch (error) {
      console.error('Error al exportar notas:', error);
      await interaction.followUp({
        content: '❌ Error al exportar las notas.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
  
  /**
   * Mostrar notas recientes del servidor
   */
  static async showRecent(interaction, client, cantidad) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const guildId = interaction.guild.id;
      const data = this.loadData();
      
      if (!data.guilds[guildId]) {
        return interaction.followUp({
          content: '✅ No hay notas en este servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Recolectar todas las notas del servidor
      const allNotes = [];
      
      for (const [userId, userData] of Object.entries(data.guilds[guildId])) {
        for (const note of userData.notes) {
          allNotes.push({
            userId,
            userTag: userData.userTag,
            ...note
          });
        }
      }
      
      if (allNotes.length === 0) {
        return interaction.followUp({
          content: '✅ No hay notas en este servidor.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Ordenar por fecha (más recientes primero)
      allNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Tomar las más recientes
      const recentNotes = allNotes.slice(0, cantidad);
      
      const notesText = recentNotes.map((note, index) => {
        const date = new Date(note.timestamp).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const emoji = this.getCategoryEmoji(note.category);
        
        return `**${index + 1}.** ${note.userTag} - \`${note.id}\` ${emoji}\n` +
               `   📅 ${date} | 👮 ${note.moderatorTag}\n` +
               `   📝 ${note.content.substring(0, 60)}${note.content.length > 60 ? '...' : ''}`;
      }).join('\n\n');
      
      const recentEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📝 Notas Recientes del Servidor')
        .setDescription(
          `**Total de notas:** ${allNotes.length}\n` +
          `**Mostrando:** ${recentNotes.length} más recientes\n\n` +
          notesText
        )
        .setFooter({ text: `Servidor: ${interaction.guild.name}` })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [recentEmbed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      console.error('Error al mostrar notas recientes:', error);
      await interaction.followUp({
        content: '❌ Error al obtener las notas recientes.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    }
  }
}

module.exports = NotesManager;