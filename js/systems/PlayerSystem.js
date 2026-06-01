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
    if (!scene.anims.exists('idle_down')) this._buildAnimations();
    this._createSprite(x, y);
    this._createKeys();
  }

  get sprite() { return this._sprite; }
  get x()      { return this._sprite.x; }
  get y()      { return this._sprite.y; }
  get facing() { return this._facing; }

  update() {
    if (this._state === 'attack') return;
    this._handleMovement();
    this._sprite.setDepth(this._sprite.y);
  }

  playAttack(onComplete) {
    if (this._state === 'attack') return;
    this._state = 'attack';
    this._sprite.play(`attack_${this._facing}`, true);
    this._sprite.once('animationcomplete', () => {
      this._state = 'idle';
      if (onComplete) onComplete();
    });
  }

  _createSprite(x, y) {
    const p = CFG.PLAYER;
    this._sprite = this.scene.physics.add.sprite(x, y, 'sw_idle');
    this._sprite.setScale(p.SCALE);
    this._sprite.body.setSize(p.BODY_W, p.BODY_H);
    this._sprite.body.setOffset(
      (p.FRAME_W - p.BODY_W) / 2,
      p.OFFSET_Y
    );
    //this._sprite.setDepth(10);  // Above most map tiles (depth 0)
    this._sprite.play('idle_down');
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
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    });
  }

  _handleMovement() {
    const k     = this._keys;
    const p     = CFG.PLAYER;
    const isRun = k.shift.isDown;
    const speed = isRun ? p.RUN_SPEED : p.SPEED;

    let vx = 0, vy = 0;
    if (k.left.isDown  || k.a.isDown)  vx = -speed;
    if (k.right.isDown || k.d.isDown)  vx =  speed;
    if (k.up.isDown    || k.w.isDown)  vy = -speed;
    if (k.down.isDown  || k.s.isDown)  vy =  speed;
    if (vx && vy) { vx *= 0.707; vy *= 0.707; }

    this._sprite.body.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;
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

  _buildAnimations() {
    const s = this.scene;

    const ROW = { down:0, left:1, right:2, up:3 };

    // UPDATED make function: Separates 'gridCols' (physical grid width) 
    // from 'validFrames' (how many frames we actually want to play).
    const make = (key, tex, dir, gridCols, fps, repeat = -1, validFrames = null) => {
      if (s.anims.exists(key)) return;
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
      make(`idle_${dir}`,    'sw_idle',    dir, 12,  8, -1, idleValidFrames);
      make(`walk_${dir}`,    'sw_walk',    dir,  6, 10);
      make(`run_${dir}`,     'sw_run',     dir,  8, 12);
      make(`attack_${dir}`,  'sw_attack',  dir,  8, 12,  0);
      make(`walkAtk_${dir}`, 'sw_walkAtk', dir,  6, 10,  0);
      make(`runAtk_${dir}`,  'sw_runAtk',  dir,  8, 12,  0);
      make(`hurt_${dir}`,    'sw_hurt',    dir,  5, 10,  0);
      make(`death_${dir}`,   'sw_death',   dir,  7,  8,  0);
    });
  }
}