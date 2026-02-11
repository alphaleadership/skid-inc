module.exports = {
  async onLoad(context) {
    context.logger?.info(`[${context.manifest.id}] chargé (jeu ${context.game.version})`);
  },

  async onEnable(context) {
    if (!context.hooks?.on) {
      return;
    }

    context.hooks.on('hello:ping', async (payload = {}) => {
      context.logger?.info(`[${context.manifest.id}] hello:ping reçu`, payload instanceof Error ? payload : undefined);
      return {
        pong: true,
        receivedAt: new Date().toISOString(),
        payload
      };
    });
  }
};
