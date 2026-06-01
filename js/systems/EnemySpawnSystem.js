// js/systems/EnemySpawnSystem.js
class EnemySpawnSystem {
  constructor(scene, mapData, spawns = [], options = {}) {
    this.scene = scene;
    this.mapData = mapData;
    this.tileW = mapData.tilewidth ?? CFG.TILE_SIZE;
    this.tileH = mapData.tileheight ?? CFG.TILE_SIZE;
    this.enabled = options.enabled === true;
    this.spawns = spawns.map((spawn) => this._toPixelSpawn(spawn));
    this.enemies = [];

    if (this.enabled) this._spawnAll();
  }

  _toPixelSpawn(spawn) {
    return {
      ...spawn,
      x: spawn.tileX * this.tileW + this.tileW / 2,
      y: spawn.tileY * this.tileH + this.tileH / 2,
    };
  }

  _spawnAll() {
    this.group = this.scene.physics.add.group({ allowGravity: false });
    this.spawns.forEach((spawn) => this._spawnEnemy(spawn));
  }

  _spawnEnemy(spawn) {
    const colorByType = {
      goblin: 0x64b346,
      slime: 0x50c8dc,
      golem: 0x9a8f7a,
    };
    const radiusByType = {
      goblin: 9,
      slime: 8,
      golem: 12,
    };
    const radius = radiusByType[spawn.type] ?? 9;
    const color = colorByType[spawn.type] ?? 0xffffff;
    const enemy = this.scene.add.circle(spawn.x, spawn.y, radius, color, 0.95)
      .setDepth(spawn.y)
      .setData('enemy', true)
      .setData('hp', spawn.hp ?? 25)
      .setData('type', spawn.type)
      .setData('tileX', spawn.tileX)
      .setData('tileY', spawn.tileY);

    enemy.isEnemy = true;
    this.scene.physics.add.existing(enemy);
    enemy.body.setCircle(radius);
    enemy.body.setAllowGravity(false);
    this.group.add(enemy);
    this.enemies.push(enemy);
    return enemy;
  }
}
