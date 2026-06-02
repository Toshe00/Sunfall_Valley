// js/systems/PlayerSystem.js
// CONFIRMED row → direction mapping (deduced from all user bug reports):
//   Row 0 = DOWN  ↓  (facing camera / south)
//   Row 1 = LEFT  ←  (facing left / west)
//   Row 2 = RIGHT →  (facing right / east)
//   Row 3 = UP    ↑  (back to camera / north)
// Frame size: 64×64 px. All sheets have 4 rows.
class PlayerSystem {
  constructor(scene, x, y) {
    this.scene   = scene;
    this._facing = 'down';
    this._state  = 'idle';
    this._heroLevel = CFG.PLAYER.START_LEVEL ?? 1;
    this._maxHealth = CFG.PLAYER.MAX_HEALTH ?? 100;
    this._health = this._maxHealth;
    this._maxStamina = CFG.PLAYER.MAX_STAMINA ?? 100;
    this._stamina = this._maxStamina;
    this._nextAttackAt = 0;
    this._invulnerableUntil = 0;
    if (!scene.anims.exists('idle_down')) this._buildAnimations(this._heroLevel);
    this._createSprite(x, y);
    this._createKeys();
  }

  get sprite() { return this._sprite; }
  get x()      { return this._sprite.x; }
  get y()      { return this._sprite.y; }
  get facing() { return this._facing; }
  get health() { return this._health; }
  get maxHealth() { return this._maxHealth; }
  get stamina() { return this._stamina; }
  get maxStamina() { return this._maxStamina; }
  get isDead() { return this._state === 'dead'; }
  get heroLevel() { return this._heroLevel; }

  update(delta = 16) {
    if (this._state === 'dead') {
      this._sprite.body.setVelocity(0, 0);
      return;
    }
    if (this._state === 'attack' || this._state === 'hurt') return;
    this._handleMovement(delta);
    this._sprite.setDepth(this._sprite.y);
  }

  playAttack(options = null) {
    if (this._state === 'dead' || this._state === 'hurt' || this._state === 'attack') return false;

    const now = this.scene.time.now;
    if (now < this._nextAttackAt) return false;
    this._nextAttackAt = now + (CFG.PLAYER.ATTACK_COOLDOWN_MS ?? 550);

    const onHit = typeof options === 'object' ? options?.onHit : null;
    const onComplete = typeof options === 'function' ? options : options?.onComplete;
    const animKey = `attack_${this._facing}`;

    this._state = 'attack';
    this._sprite.body.setVelocity(0, 0);
    this._sprite.setAlpha(1);
    this._sprite.play(animKey, true);

    this.scene.time.delayedCall(CFG.PLAYER.ATTACK_HIT_DELAY_MS ?? 180, () => {
      if (this._state === 'attack' && this._sprite.anims.currentAnim?.key === animKey) {
        onHit?.();
      }
    });

    this._sprite.once('animationcomplete', (anim) => {
      if (anim.key !== animKey || this._state !== 'attack') return;
      this._state = 'idle';
      if (onComplete) onComplete();
    });
    return true;
  }

  takeDamage(amount = 10) {
    if (this._state === 'dead') return false;

    const now = this.scene.time.now;
    if (now < this._invulnerableUntil) return false;
    this._invulnerableUntil = now + (CFG.PLAYER.HURT_INVULN_MS ?? 700);

    this._health = Math.max(0, this._health - amount);
    this._emitHealthChanged();

    if (this._health <= 0) {
      this._playDeath();
    } else {
      this._playHurt();
    }
    return true;
  }

  heal(amount = 10) {
    if (this._state === 'dead') return false;
    this._health = Math.min(this._maxHealth, this._health + amount);
    this._emitHealthChanged();
    return true;
  }

  respawnAt(x, y) {
    this.scene.tweens.killTweensOf(this._sprite);
    this._health = this._maxHealth;
    this._stamina = this._maxStamina;
    this._state = 'idle';
    this._facing = 'down';
    this._nextAttackAt = 0;
    this._invulnerableUntil = this.scene.time.now + (CFG.PLAYER.RESPAWN_INVULN_MS ?? 900);

    this._sprite.body.enable = true;
    this._sprite.body.reset(x, y);
    this._sprite.setPosition(x, y);
    this._sprite.setVelocity(0, 0);
    this._sprite.setAlpha(1);
    this._sprite.setVisible(true);
    this._sprite.setDepth(this._sprite.y);
    this._sprite.play('idle_down', true);
    this._emitHealthChanged();
    this._emitStaminaChanged();
  }

  setHeroLevel(level) {
    const nextLevel = Phaser.Math.Clamp(level, 1, 9);
    if (nextLevel === this._heroLevel) return;

    const currentAnimKey = this._sprite.anims.currentAnim?.key ?? `idle_${this._facing}`;
    this._heroLevel = nextLevel;
    this._buildAnimations(this._heroLevel, true);
    this._sprite.setTexture(this._sheetKey('idle'), 0);

    const replayKey = this.scene.anims.exists(currentAnimKey)
      ? currentAnimKey
      : `idle_${this._facing}`;
    this._sprite.play(replayKey, true);
  }

  _playHurt() {
    const animKey = `hurt_${this._facing}`;
    this._state = 'hurt';
    this._sprite.body.setVelocity(0, 0);
    this._sprite.play(animKey, true);

    this.scene.tweens.killTweensOf(this._sprite);
    this._sprite.setAlpha(0.55);
    this.scene.tweens.add({
      targets: this._sprite,
      alpha: 1,
      duration: 90,
      yoyo: true,
      repeat: 2,
      onComplete: () => this._sprite.setAlpha(1),
    });

    const recover = () => {
      if (this._state !== 'hurt') return;
      this._sprite.setAlpha(1);
      this._state = 'idle';
    };

    this._sprite.once('animationcomplete', (anim) => {
      if (anim.key === animKey) recover();
    });
    this.scene.time.delayedCall(650, recover);
  }

  _playDeath() {
    const animKey = `death_${this._facing}`;
    this._state = 'dead';
    this.scene.tweens.killTweensOf(this._sprite);
    this._sprite.setAlpha(1);
    this._sprite.body.setVelocity(0, 0);
    this._sprite.body.enable = false;
    if (this.scene.anims.exists(animKey)) {
      this._sprite.play(animKey, true);
    }
    this.scene.events.emit('player-death');
  }

  _createSprite(x, y) {
    const p = CFG.PLAYER;
    this._sprite = this.scene.physics.add.sprite(x, y, this._sheetKey('idle'));
    this._sprite.setScale(p.SCALE);
    this._sprite.body.setSize(p.BODY_W, p.BODY_H);
    this._sprite.body.setOffset(
      (p.FRAME_W - p.BODY_W) / 2,
      p.OFFSET_Y
    );
    //this._sprite.setDepth(10);  // Above most map tiles (depth 0)
    this._sprite.play('idle_down');
    this._emitHealthChanged();
    this._emitStaminaChanged();
  }

  _emitHealthChanged() {
    this.scene.events.emit('player-health-changed', this._health, this._maxHealth);
  }

  _emitStaminaChanged() {
    this.scene.events.emit('player-stamina-changed', this._stamina, this._maxStamina);
  }

  _createKeys() {
    this._keys = this.scene.input.keyboard.addKeys({
      up   : Phaser.Input.Keyboard.KeyCodes.UP,
      down : Phaser.Input.Keyboard.KeyCodes.DOWN,
      left : Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w    : Phaser.Input.Keyboard.KeyCodes.W,
      a    : Phaser.Input.Keyboard.KeyCodes.A,
      s    : Phaser.Input.Keyboard.KeyCodes.S,
      d    : Phaser.Input.Keyboard.KeyCodes.D,
      z    : Phaser.Input.Keyboard.KeyCodes.Z,
      q    : Phaser.Input.Keyboard.KeyCodes.Q,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    });
  }

  _handleMovement(delta = 16) {
    const k     = this._keys;
    const p     = CFG.PLAYER;
    const dt = Math.min(delta ?? 16, 50) / 1000;
    const wantsRun = k.shift.isDown && this._stamina > 0;

    let vx = 0, vy = 0;
    if (k.left.isDown  || k.a.isDown || k.q.isDown)  vx = -1;
    if (k.right.isDown || k.d.isDown)  vx =  1;
    if (k.up.isDown    || k.w.isDown || k.z.isDown)  vy = -1;
    if (k.down.isDown  || k.s.isDown)  vy =  1;
    if (vx && vy) { vx *= 0.707; vy *= 0.707; }

    const moving = vx !== 0 || vy !== 0;
    const isRun = moving && wantsRun;
    const speed = isRun ? p.RUN_SPEED : p.SPEED;
    this._sprite.body.setVelocity(vx * speed, vy * speed);
    this._updateStamina(isRun, dt);

    if (moving) {
      // Horizontal takes priority for facing
      if      (vx < 0) this._facing = 'left';
      else if (vx > 0) this._facing = 'right';
      else if (vy < 0) this._facing = 'up';
      else             this._facing = 'down';

      const type    = isRun ? 'run' : 'walk';
      const animKey = `${type}_${this._facing}`;
      if (this._sprite.anims.currentAnim?.key !== animKey) {
        this._sprite.play(animKey, true);
      }
      // Ensure sprite never becomes invisible during animation switch
      if (this._sprite.alpha < 1) this._sprite.setAlpha(1);
      this._state = type;
    } else {
      const animKey = `idle_${this._facing}`;
      if (this._sprite.anims.currentAnim?.key !== animKey)
        this._sprite.play(animKey, true);
      this._state = 'idle';
    }
  }

  _updateStamina(isRunning, dt) {
    const previous = this._stamina;
    if (isRunning) {
      const drain = CFG.PLAYER.STAMINA_DRAIN_PER_SEC ?? 35;
      this._stamina = Math.max(0, this._stamina - drain * dt);
    } else if (this._stamina < this._maxStamina) {
      const regen = CFG.PLAYER.STAMINA_REGEN_PER_SEC ?? 20;
      this._stamina = Math.min(this._maxStamina, this._stamina + regen * dt);
    }

    if (Math.abs(previous - this._stamina) >= 0.1) this._emitStaminaChanged();
  }

  _sheetKey(anim) {
    const assetKey = CFG.PLAYER.HERO_LEVELS?.[this._heroLevel]?.assetKey ?? 'hero_lvl1';
    const key = `${assetKey}_${anim}`;
    return this.scene.textures.exists(key) ? key : `sw_${anim}`;
  }

  _buildAnimations(level = this._heroLevel, replace = false) {
    const s = this.scene;

    const ROW = { down:0, left:1, right:2, up:3 };
    const levelDef = CFG.PLAYER.HERO_LEVELS?.[level] ?? CFG.PLAYER.HERO_LEVELS?.[1];
    const assetDef = CFG.PLAYER.HERO_ASSETS?.[levelDef?.assetKey] ?? {};
    const sheets = { ...(CFG.PLAYER.SHEETS ?? {}), ...(assetDef.sheets ?? {}) };

    // UPDATED make function: Separates 'gridCols' (physical grid width) 
    // from 'validFrames' (how many frames we actually want to play).
    const make = (key, anim, dir, gridCols, fps, repeat = -1, validFrames = null) => {
      if (replace && s.anims.exists(key)) s.anims.remove(key);
      if (s.anims.exists(key)) return;
      const tex = this._sheetKey(anim);
      const row = ROW[dir];
      
      // If validFrames isn't explicitly passed, assume we use the whole physical row
      const framesToPlay = validFrames !== null ? validFrames : gridCols;

      s.anims.create({
        key,
        frames: s.anims.generateFrameNumbers(tex, {
          start: row * gridCols,                         // Exact start of the row in the grid
          end  : (row * gridCols) + framesToPlay - 1,    // Stop before the empty frames
        }),
        frameRate: fps,
        repeat,
      });
    };

    const DIRS = ['down', 'up', 'left', 'right'];
    DIRS.forEach(dir => {
      // The idle spritesheet is a 12-column physical grid.
      let idleValidFrames = 12;
      
      if (dir === 'left') idleValidFrames = 4; // Existing fix for left idle
      if (dir === 'up')   idleValidFrames = 3; // NEW: Fix for back (up) idle!

      // Note: We pass 12 as the physical grid width, and idleValidFrames as the amount to play
      make(`idle_${dir}`,    'idle',    dir, sheets.idle?.frames    ?? 12,  8, -1, idleValidFrames);
      make(`walk_${dir}`,    'walk',    dir, sheets.walk?.frames    ?? 6,  10);
      make(`run_${dir}`,     'run',     dir, sheets.run?.frames     ?? 8,  12);
      make(`attack_${dir}`,  'attack',  dir, sheets.attack?.frames  ?? 8,  12,  0);
      make(`walkAtk_${dir}`, 'walkAtk', dir, sheets.walkAtk?.frames ?? 6,  10,  0);
      make(`runAtk_${dir}`,  'runAtk',  dir, sheets.runAtk?.frames  ?? 8,  12,  0);
      make(`hurt_${dir}`,    'hurt',    dir, sheets.hurt?.frames    ?? 5,  10,  0);
      make(`death_${dir}`,   'death',   dir, sheets.death?.frames   ?? 7,   8,  0);
    });
  }
}
