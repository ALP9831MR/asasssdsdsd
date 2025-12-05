/**
 * Utilitario para validaciones comunes
 */
class ValidationUtil {
    /**
     * Verifica si un usuario es desarrollador del bot
     * @param {Client} client - Cliente de Discord
     * @param {string} userId - ID del usuario a verificar
     * @returns {boolean} true si es desarrollador, false si no
     */
    static isDeveloper(client, userId) {
      return client.config.developers.includes(userId);
    }
  
    /**
     * Verifica si un usuario tiene los permisos requeridos
     * @param {GuildMember} member - Miembro del servidor
     * @param {PermissionResolvable[]} permissions - Permisos requeridos
     * @returns {boolean} true si tiene los permisos, false si no
     */
    static hasPermissions(member, permissions) {
      return member.permissions.has(permissions);
    }
  
    /**
     * Verifica si el bot tiene los permisos requeridos
     * @param {GuildMember} botMember - Miembro del bot en el servidor
     * @param {PermissionResolvable[]} permissions - Permisos requeridos
     * @returns {boolean} true si tiene los permisos, false si no
     */
    static botHasPermissions(botMember, permissions) {
      return botMember.permissions.has(permissions);
    }
  
    /**
     * Verifica si se ha excedido el cooldown para un comando
     * @param {Collection} cooldowns - Colección de cooldowns
     * @param {string} commandName - Nombre del comando
     * @param {string} userId - ID del usuario
     * @param {number} cooldownAmount - Tiempo de cooldown en segundos
     * @returns {number|false} Tiempo restante en segundos o false si no hay cooldown
     */
    static checkCooldown(cooldowns, commandName, userId, cooldownAmount) {
      if (!cooldowns.has(commandName)) {
        cooldowns.set(commandName, new Map());
      }
      
      const now = Date.now();
      const timestamps = cooldowns.get(commandName);
      
      if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId) + cooldownAmount * 1000;
        
        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          return Math.round(timeLeft);
        }
      }
      
      timestamps.set(userId, now);
      return false;
    }
  }
  
  module.exports = ValidationUtil;