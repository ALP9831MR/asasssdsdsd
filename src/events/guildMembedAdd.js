// ========================================
// 📁 events/guildMemberAdd.js
// ========================================

const VerificationManager = require('../systems/moderation/verificationManager');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      // ===== SISTEMA DE VERIFICACIÓN =====
      // Manejar nuevo miembro con sistema de verificación
      await VerificationManager.handleNewMember(member, client);
      
      // ===== SISTEMA DE BIENVENIDAS =====
      // Verificar si el sistema de bienvenidas está activado
      if (client.config && client.config.systems && client.config.systems.welcome && client.config.systems.welcome.enabled) {
        const welcomeSystem = require('../systems/welcome/welcomeManager');
        await welcomeSystem.sendWelcomeMessage(member, client);
      }
      
      // ===== SISTEMA DE AUTOROLES =====
      // Si el sistema de autoroles está activado, asignar roles automáticos
      if (client.config && client.config.systems && client.config.systems.autoroles && client.config.systems.autoroles.enabled) {
        const autoroleSystem = require('../systems/autoroles/autoroleManager');
        await autoroleSystem.assignDefaultRoles(member, client);
      }
      
    } catch (error) {
      console.error('Error en el evento guildMemberAdd:', error);
    }
  }
};