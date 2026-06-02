class EnemySpawnSystem {
  constructor(scene, mapData, spawns = [], options = {}) {
    this.scene = scene;
    this.mapData = mapData;
    this.tileW = mapData.tilewidth ?? CFG.TILE_SIZE;
    this.tileH = mapData.tileheight ?? CFG.TILE_SIZE;
    this.enabled = options.enabled === true;
    this.respawnMs = options.respawnMs ?? CFG.ENEMIES?.RESPAWN_MS ?? 300000;
    this.spawns = spawns.map((spawn) => this._toPixelSpawn(spawn));
    this._spawnRecords = this.spawns.map((spawn, index) => ({
      id: index,
      spawn,
      enemy: null,
      respawnEvent: null,
    }));
    this.enemies = [];
    this.group = this.scene.physics.add.group({ allowGravity: false });
    this._collider = null;

    this._ensureAnimations();
    if (this.enabled) this._spawnAll();
  }

  linkWorldColliders(collisionGroup) {
    if (!collisionGroup || !this.group) return;
    if (this._collider) this._collider.destroy();
    this._collider = this.scene.physics.add.collider(this.group, collisionGroup);
  }

  update(time, delta) {
    if (!this.enabled || !this.enemies.length) return;
    const dt = Math.min(delta ?? 16, 50) / 1000;
    const player = this.scene._player?.sprite;
    if (!player?.active || this.scene._player?.isDead) {
      for (const enemy of this.enemies) {
        enemy.body?.setVelocity(0, 0);
        this._updateHealthBar(enemy);
      }
      return;
    }

    for (const enemy of [...this.enemies]) {
      if (!enemy?.active || enemy.getData('dead')) {
        this._destroyHealthBar(enemy);
        continue;
      }
      this._updateEnemy(enemy, player, time, dt);
      this._updateHealthBar(enemy);
    }
  }

  _toPixelSpawn(spawn) {
    return {
      ...spawn,
      x: spawn.tileX * this.tileW + this.tileW / 2,
      y: spawn.tileY * this.tileH + this.tileH / 2,
    };
  }

  _spawnAll() {
    this._spawnRecords.forEach((record) => this._spawnEnemy(record));
  }

  _spawnEnemy(recordOrSpawn) {
    const record = recordOrSpawn?.spawn ? recordOrSpawn : null;
    const spawn = record?.spawn ?? recordOrSpawn;
    if (record?.enemy?.active && !record.enemy.getData('dead')) return record.enemy;
    const type = spawn.type ?? 'slime';
    const idleTexture = `enemy_${type}_idle`;
    if (!this.scene.textures.exists(idleTexture)) return null;

    const def = this._typeDef(type);
    const enemy = this.scene.physics.add.sprite(spawn.x, spawn.y, idleTexture)
      .setScale(def.scale)
      .setDepth(spawn.y)
      .setData('enemy', true)
      .setData('type', type)
      .setData('tileX', spawn.tileX)
      .setData('tileY', spawn.tileY)
      .setData('spawnX', spawn.x)
      .setData('spawnY', spawn.y)
      .setData('spawnId', record?.id ?? -1)
      .setData('spawnRecord', record)
      .setData('hp', spawn.hp ?? def.hp)
      .setData('maxHp', spawn.hp ?? def.hp)
      .setData('state', 'idle')
      .setData('facing', 'down')
      .setData('nextAttackAt', 0)
      .setData('nextWanderAt', 0)
      .setData('wanderTarget', null)
      .setData('healthBar', null);

    enemy.isEnemy = true;
    enemy.takeDamage = (amount) => this._takeDamage(enemy, amount);

    enemy.body.setAllowGravity(false);
    enemy.body.setCollideWorldBounds(true);
    enemy.body.setSize(def.bodyW, def.bodyH);
    enemy.body.setOffset(def.bodyOffsetX, def.bodyOffsetY);
    const idleAnim = this._animKey(enemy, 'idle', 'down');
    if (this.scene.anims.exists(idleAnim)) enemy.play(idleAnim);

    this.group.add(enemy);
    this.enemies.push(enemy);
    if (record) record.enemy = enemy;
    return enemy;
  }

  _updateEnemy(enemy, player, time, dt) {
    const state = enemy.getData('state');
    if (state === 'attack' || state === 'hurt' || state === 'death') {
      enemy.body.setVelocity(0, 0);
      enemy.setDepth(enemy.y);
      return;
    }

    const def = this._typeDef(enemy.getData('type'));
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distSq = dx * dx + dy * dy;
    const attackRangeSq = def.attackRange * def.attackRange;
    const visionRangeSq = def.visionRange * def.visionRange;

    if (distSq <= attackRangeSq) {
      this._tryAttack(enemy, player, time);
    } else if (distSq <= visionRangeSq) {
      this._moveToward(enemy, player.x, player.y, def.speed, 'run');
    } else {
      this._wander(enemy, time, def, dt);
    }

    enemy.setDepth(enemy.y);
  }

  _tryAttack(enemy, player, time) {
    const def = this._typeDef(enemy.getData('type'));
    enemy.body.setVelocity(0, 0);

    if (time < (enemy.getData('nextAttackAt') ?? 0)) {
      this._play(enemy, 'idle');
      return;
    }

    const facing = this._faceToward(enemy, player.x, player.y);
    const animKey = this._animKey(enemy, 'attack', facing);
    enemy.setData('state', 'attack');
    enemy.setData('nextAttackAt', time + def.attackCooldownMs);
    enemy.play(animKey, true);

    this.scene.time.delayedCall(def.attackHitDelayMs, () => {
      if (!enemy.active || enemy.getData('dead') || enemy.getData('state') !== 'attack') return;
      const p = this.scene._player?.sprite;
      if (!p?.active || this.scene._player?.isDead) return;
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      if ((dx * dx + dy * dy) <= (def.attackRange + 8) * (def.attackRange + 8)) {
        this.scene.damagePlayer(def.damage);
      }
    });

    enemy.once('animationcomplete', (anim) => {
      if (!enemy.active || anim.key !== animKey) return;
      if (!enemy.getData('dead')) enemy.setData('state', 'idle');
    });
  }

  _wander(enemy, time, def) {
    const target = enemy.getData('wanderTarget');
    const dx = target ? target.x - enemy.x : 0;
    const dy = target ? target.y - enemy.y : 0;
    const reached = !target || (dx * dx + dy * dy) < 36;

    if (reached || time >= (enemy.getData('nextWanderAt') ?? 0)) {
      const next = this._pickWanderTarget(enemy, def);
      enemy.setData('wanderTarget', next);
      enemy.setData('nextWanderAt', time + Phaser.Math.Between(1500, 3200));

      if (!next) {
        enemy.body.setVelocity(0, 0);
        this._play(enemy, 'idle');
        return;
      }
    }

    const nextTarget = enemy.getData('wanderTarget');
    if (nextTarget) {
      this._moveToward(enemy, nextTarget.x, nextTarget.y, def.wanderSpeed, 'walk');
    } else {
      enemy.body.setVelocity(0, 0);
      this._play(enemy, 'idle');
    }
  }

  _pickWanderTarget(enemy, def) {
    const sx = enemy.getData('spawnX') ?? enemy.x;
    const sy = enemy.getData('spawnY') ?? enemy.y;
    for (let i = 0; i < 8; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const radius = Phaser.Math.Between(10, def.wanderRadius);
      const x = Phaser.Math.Clamp(sx + Math.cos(angle) * radius, 0, this.mapData.width * this.tileW);
      const y = Phaser.Math.Clamp(sy + Math.sin(angle) * radius, 0, this.mapData.height * this.tileH);
      if (this._isNearSpawn(x, y, sx, sy, def.wanderRadius + 4)) return { x, y };
    }
    return null;
  }

  _moveToward(enemy, x, y, speed, anim) {
    const dx = x - enemy.x;
    const dy = y - enemy.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      enemy.body.setVelocity(0, 0);
      this._play(enemy, 'idle');
      return;
    }

    const facing = this._faceToward(enemy, x, y);
    enemy.body.setVelocity((dx / len) * speed, (dy / len) * speed);
    this._play(enemy, anim, facing);
    enemy.setData('state', anim);
  }

  _faceToward(enemy, x, y) {
    const dx = x - enemy.x;
    const dy = y - enemy.y;
    const facing = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    enemy.setData('facing', facing);
    return facing;
  }

  _play(enemy, anim, facing = null) {
    if (!enemy.active || enemy.getData('dead')) return;
    const dir = facing ?? enemy.getData('facing') ?? 'down';
    const key = this._animKey(enemy, anim, dir);
    if (enemy.anims.currentAnim?.key !== key) enemy.play(key, true);
  }

  _takeDamage(enemy, amount) {
    if (!enemy.active || enemy.getData('dead')) return false;
    const nextHp = Math.max(0, (enemy.getData('hp') ?? 0) - amount);
    enemy.setData('hp', nextHp);

    if (nextHp <= 0) {
      this._destroyHealthBar(enemy);
      this._kill(enemy);
    } else {
      this._showHealthBar(enemy);
      this._hurt(enemy);
    }
    return true;
  }

  _showHealthBar(enemy) {
    const bar = this._ensureHealthBar(enemy);
    if (!bar) return;

    bar.bg.setVisible(true);
    bar.fill.setVisible(true);
    this._updateHealthBar(enemy);

    bar.hideEvent?.remove(false);
    bar.hideEvent = this.scene.time.delayedCall(3500, () => {
      if (!enemy.active || enemy.getData('dead')) {
        this._destroyHealthBar(enemy);
        return;
      }

      const current = enemy.getData('healthBar');
      current?.bg?.setVisible(false);
      current?.fill?.setVisible(false);
    });
  }

  _ensureHealthBar(enemy) {
    if (!enemy?.active) return null;
    const existing = enemy.getData('healthBar');
    if (existing?.bg && existing?.fill) return existing;

    const bar = {
      bg: this.scene.add.graphics().setDepth(9200),
      fill: this.scene.add.graphics().setDepth(9201),
      hideEvent: null,
    };
    enemy.setData('healthBar', bar);
    return bar;
  }

  _updateHealthBar(enemy) {
    const bar = enemy?.getData?.('healthBar');
    if (!bar?.bg || !bar?.fill) return;

    if (!enemy.active || enemy.getData('dead')) {
      this._destroyHealthBar(enemy);
      return;
    }

    const maxHp = Math.max(1, enemy.getData('maxHp') ?? 1);
    const hp = Phaser.Math.Clamp(enemy.getData('hp') ?? maxHp, 0, maxHp);
    const pct = hp / maxHp;
    const bounds = enemy.getBounds();
    const width = Phaser.Math.Clamp(bounds.width * 0.375, 17, 34);
    const height = 3;
    const x = enemy.x - width / 2;
    const y = bounds.top - 8;
    const fillColor = pct > 0.5 ? 0x45d35f : (pct > 0.25 ? 0xffd34d : 0xe84b4b);

    bar.bg.clear();
    bar.bg.fillStyle(0x161b22, 0.9);
    bar.bg.fillRect(x - 1, y - 1, width + 2, height + 2);

    bar.fill.clear();
    bar.fill.fillStyle(fillColor, 1);
    bar.fill.fillRect(x, y, width * pct, height);
  }

  _destroyHealthBar(enemy) {
    const bar = enemy?.getData?.('healthBar');
    if (!bar) return;

    bar.hideEvent?.remove(false);
    bar.bg?.destroy();
    bar.fill?.destroy();
    enemy.setData?.('healthBar', null);
  }

  _hurt(enemy) {
    const facing = enemy.getData('facing') ?? 'down';
    const animKey = this._animKey(enemy, 'hurt', facing);
    enemy.setData('state', 'hurt');
    enemy.body.setVelocity(0, 0);
    enemy.play(animKey, true);
    enemy.once('animationcomplete', (anim) => {
      if (!enemy.active || anim.key !== animKey) return;
      if (!enemy.getData('dead')) enemy.setData('state', 'idle');
    });
  }

  _kill(enemy) {
    if (enemy.getData('dead')) return;
    this._destroyHealthBar(enemy);
    enemy.setData('dead', true);
    enemy.setData('state', 'death');
    enemy.body.setVelocity(0, 0);
    enemy.body.enable = false;

    const facing = enemy.getData('facing') ?? 'down';
    const animKey = this._animKey(enemy, 'death', facing);
    enemy.play(animKey, true);
    this._scheduleRespawn(enemy.getData('spawnRecord'));
    enemy.once('animationcomplete', () => this._remove(enemy));
    this.scene.time.delayedCall(1200, () => this._remove(enemy));
  }

  _remove(enemy) {
    if (!enemy || !enemy.active) return;
    this._destroyHealthBar(enemy);
    const record = enemy.getData?.('spawnRecord');
    if (record?.enemy === enemy) record.enemy = null;
    this.enemies = this.enemies.filter((item) => item !== enemy);
    this.group.remove(enemy, true, true);
  }

  _scheduleRespawn(record) {
    if (!record || record.respawnEvent) return;
    record.respawnEvent = this.scene.time.delayedCall(this.respawnMs, () => {
      record.respawnEvent = null;
      this._respawnRecord(record);
    });
  }

  _respawnRecord(record) {
    if (!this.enabled || !record) return null;
    if (record.enemy?.active && !record.enemy.getData('dead')) return record.enemy;
    record.enemy = null;
    return this._spawnEnemy(record);
  }

  _isNearSpawn(x, y, sx, sy, radius) {
    const dx = x - sx;
    const dy = y - sy;
    return (dx * dx + dy * dy) <= radius * radius;
  }

  _typeDef(type) {
    const fallback = CFG.ENEMIES?.TYPES?.slime ?? {};
    const statsFallback = CFG.ENEMIES?.STATS?.slime ?? {};
    const stats = CFG.ENEMIES?.STATS?.[type] ?? statsFallback;
    const typeDef = { ...fallback, ...(CFG.ENEMIES?.TYPES?.[type] ?? {}), ...stats };
    return {
      ...typeDef,
      visionRange: typeDef.visionRange ?? typeDef.detectionRange ?? fallback.visionRange ?? statsFallback.detectionRange,
      attackCooldownMs: typeDef.attackCooldownMs ?? typeDef.attackCooldown ?? fallback.attackCooldownMs ?? statsFallback.attackCooldown,
    };
  }

  _animKey(enemy, anim, facing) {
    const type = enemy.getData('type') ?? 'slime';
    return `${type}_${anim}_${facing}`;
  }

  _ensureAnimations() {
    const row = { down: 0, up: 1, left: 2, right: 3 };
    const make = (type, anim, frames, fps, repeat) => {
      const texture = `enemy_${type}_${anim}`;
      if (!this.scene.textures.exists(texture)) return;

      for (const [dir, rowIndex] of Object.entries(row)) {
        const key = `${type}_${anim}_${dir}`;
        if (this.scene.anims.exists(key)) continue;
        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(texture, {
            start: rowIndex * frames,
            end: rowIndex * frames + frames - 1,
          }),
          frameRate: fps,
          repeat,
        });
      }
    };

    for (const [type, asset] of Object.entries(CFG.ENEMIES?.ASSETS ?? {})) {
      const sheets = asset?.sheets ?? {};
      make(type, 'idle',   sheets.idle?.frames   ?? 6,  7, -1);
      make(type, 'walk',   sheets.walk?.frames   ?? 8,  9, -1);
      make(type, 'run',    sheets.run?.frames    ?? 8, 11, -1);
      make(type, 'attack', sheets.attack?.frames ?? 10, 12,  0);
      make(type, 'hurt',   sheets.hurt?.frames   ?? 5, 10,  0);
      make(type, 'death',  sheets.death?.frames  ?? 10, 10, 0);
    }
  }
}
