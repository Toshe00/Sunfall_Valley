class EnemySpawnSystem {
  constructor(scene, mapData, spawns = [], options = {}) {
    this.scene = scene;
    this.mapData = mapData;
    this.tileW = mapData.tilewidth ?? CFG.TILE_SIZE;
    this.tileH = mapData.tileheight ?? CFG.TILE_SIZE;
    this.enabled = options.enabled === true;
    this.spawns = spawns.map((spawn) => this._toPixelSpawn(spawn));
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
      for (const enemy of this.enemies) enemy.body?.setVelocity(0, 0);
      return;
    }

    for (const enemy of [...this.enemies]) {
      if (!enemy?.active || enemy.getData('dead')) continue;
      this._updateEnemy(enemy, player, time, dt);
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
    this.spawns.forEach((spawn) => this._spawnEnemy(spawn));
  }

  _spawnEnemy(spawn) {
    if (spawn.type !== 'slime') return null;

    const def = this._typeDef('slime');
    const enemy = this.scene.physics.add.sprite(spawn.x, spawn.y, 'enemy_slime_idle')
      .setScale(def.scale)
      .setDepth(spawn.y)
      .setData('enemy', true)
      .setData('type', 'slime')
      .setData('tileX', spawn.tileX)
      .setData('tileY', spawn.tileY)
      .setData('spawnX', spawn.x)
      .setData('spawnY', spawn.y)
      .setData('hp', spawn.hp ?? def.hp)
      .setData('maxHp', spawn.hp ?? def.hp)
      .setData('state', 'idle')
      .setData('facing', 'down')
      .setData('nextAttackAt', 0)
      .setData('nextWanderAt', 0)
      .setData('wanderTarget', null);

    enemy.isEnemy = true;
    enemy.takeDamage = (amount) => this._takeDamage(enemy, amount);

    enemy.body.setAllowGravity(false);
    enemy.body.setCollideWorldBounds(true);
    enemy.body.setSize(def.bodyW, def.bodyH);
    enemy.body.setOffset(def.bodyOffsetX, def.bodyOffsetY);
    enemy.play('slime_idle_down');

    this.group.add(enemy);
    this.enemies.push(enemy);
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
    enemy.setData('state', 'attack');
    enemy.setData('nextAttackAt', time + def.attackCooldownMs);
    enemy.play(`slime_attack_${facing}`, true);

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
      if (!enemy.active || anim.key !== `slime_attack_${facing}`) return;
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
    const key = `slime_${anim}_${dir}`;
    if (enemy.anims.currentAnim?.key !== key) enemy.play(key, true);
  }

  _takeDamage(enemy, amount) {
    if (!enemy.active || enemy.getData('dead')) return false;
    const nextHp = Math.max(0, (enemy.getData('hp') ?? 0) - amount);
    enemy.setData('hp', nextHp);

    if (nextHp <= 0) {
      this._kill(enemy);
    } else {
      this._hurt(enemy);
    }
    return true;
  }

  _hurt(enemy) {
    const facing = enemy.getData('facing') ?? 'down';
    enemy.setData('state', 'hurt');
    enemy.body.setVelocity(0, 0);
    enemy.play(`slime_hurt_${facing}`, true);
    enemy.once('animationcomplete', (anim) => {
      if (!enemy.active || anim.key !== `slime_hurt_${facing}`) return;
      if (!enemy.getData('dead')) enemy.setData('state', 'idle');
    });
  }

  _kill(enemy) {
    enemy.setData('dead', true);
    enemy.setData('state', 'death');
    enemy.body.setVelocity(0, 0);
    enemy.body.enable = false;

    const facing = enemy.getData('facing') ?? 'down';
    enemy.play(`slime_death_${facing}`, true);
    enemy.once('animationcomplete', () => this._remove(enemy));
    this.scene.time.delayedCall(1200, () => this._remove(enemy));
  }

  _remove(enemy) {
    if (!enemy || !enemy.active) return;
    this.enemies = this.enemies.filter((item) => item !== enemy);
    this.group.remove(enemy, true, true);
  }

  _isNearSpawn(x, y, sx, sy, radius) {
    const dx = x - sx;
    const dy = y - sy;
    return (dx * dx + dy * dy) <= radius * radius;
  }

  _typeDef(type) {
    return CFG.ENEMIES?.TYPES?.[type] ?? CFG.ENEMIES?.TYPES?.slime ?? {};
  }

  _ensureAnimations() {
    if (this.scene.anims.exists('slime_idle_down')) return;

    const row = { down: 0, up: 1, left: 2, right: 3 };
    const make = (anim, frames, fps, repeat) => {
      for (const [dir, rowIndex] of Object.entries(row)) {
        this.scene.anims.create({
          key: `slime_${anim}_${dir}`,
          frames: this.scene.anims.generateFrameNumbers(`enemy_slime_${anim}`, {
            start: rowIndex * frames,
            end: rowIndex * frames + frames - 1,
          }),
          frameRate: fps,
          repeat,
        });
      }
    };

    const sheets = CFG.ENEMIES?.ASSETS?.slime?.sheets ?? {};
    make('idle',   sheets.idle?.frames   ?? 6,  7, -1);
    make('walk',   sheets.walk?.frames   ?? 8,  9, -1);
    make('run',    sheets.run?.frames    ?? 8, 11, -1);
    make('attack', sheets.attack?.frames ?? 10, 12,  0);
    make('hurt',   sheets.hurt?.frames   ?? 5, 10,  0);
    make('death',  sheets.death?.frames  ?? 10, 10, 0);
  }
}
