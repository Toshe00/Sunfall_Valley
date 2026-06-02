class HeroXPSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.levels = CFG.PLAYER.HERO_LEVELS ?? {};
    this.rewards = CFG.PLAYER.XP_REWARDS ?? {};
    this.defaultReward = CFG.PLAYER.DEFAULT_XP_REWARD ?? 1;
    this.level = CFG.PLAYER.START_LEVEL ?? 1;
    this.xp = 0;

    this.player?.setHeroLevel?.(this.level);
    this._emitChanged();
    this.scene.events.on('enemy-killed-by-player', this._onEnemyKilledByPlayer, this);
  }

  destroy() {
    this.scene.events.off('enemy-killed-by-player', this._onEnemyKilledByPlayer, this);
  }

  awardEnemyKill(enemyOrType) {
    const type = typeof enemyOrType === 'string'
      ? enemyOrType
      : enemyOrType?.getData?.('type');
    return this.addXP(this.rewards[type] ?? this.defaultReward, type ?? 'unknown');
  }

  addXP(amount, source = null) {
    const gained = Math.max(0, Math.floor(amount ?? 0));
    if (gained <= 0 || this.isMaxLevel()) return false;

    this.xp += gained;
    const levelUps = [];

    while (!this.isMaxLevel()) {
      const needed = this.xpToNext();
      if (!needed || this.xp < needed) break;
      this.xp -= needed;
      this.level += 1;
      levelUps.push(this.level);
      this.player?.setHeroLevel?.(this.level);
      this.scene.events.emit('hero-level-up', this.level);
    }

    if (this.isMaxLevel()) this.xp = 0;
    this._emitChanged(source, gained, levelUps);
    return true;
  }

  xpToNext() {
    return this.levels[this.level]?.xpToNext ?? null;
  }

  isMaxLevel() {
    return !this.xpToNext();
  }

  snapshot() {
    return {
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext(),
      isMax: this.isMaxLevel(),
    };
  }

  _onEnemyKilledByPlayer(enemy) {
    this.awardEnemyKill(enemy);
  }

  _emitChanged(source = null, gained = 0, levelUps = []) {
    const state = {
      ...this.snapshot(),
      gained,
      source,
      levelUps,
    };
    this.scene.registry.set('heroXP', state);
    this.scene.events.emit('hero-xp-changed', state);
  }
}
