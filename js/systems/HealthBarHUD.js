// js/systems/HealthBarHUD.js
// ─────────────────────────────────────────────────────────────────────────────
// Displays the HealthBar_full.png asset in the top-left corner.
//
// Usage (UIScene.create) — add AFTER the top bar is created:
//   this._healthBar = new HealthBarHUD(this);
//
// Usage (UIScene.update) — optional, only needed if HP changes:
//   this._healthBar.setHealth(current, max);
// ─────────────────────────────────────────────────────────────────────────────
class HealthBarHUD {

  // Tune these to taste
  static SCALE    = 1.8;   // display scale of the sprite
  static PAD_X    = 8;     // left margin
  static PAD_Y    = 44;    // top margin (sits just below the title bar)
  static DEPTH    = 9110;  // above day/night overlay (9001)

  constructor(scene) {
    this.scene  = scene;
    this._maxHp = 100;
    this._curHp = 100;

    const { SCALE, PAD_X, PAD_Y, DEPTH } = HealthBarHUD;

    // ── Full bar sprite (always visible as background) ────────────────────
    this._barFull = scene.add.image(PAD_X, PAD_Y, 'ui_healthbar')
      .setOrigin(0, 0)
      .setScale(SCALE)
      .setScrollFactor(0)
      .setDepth(DEPTH);

    // ── Red fill overlay — we mask it by scaling X from 0→1 ──────────────
    // We draw a Graphics object over the bar portion to show current HP.
    // The red segment sits inside the bar image.
    // Tune BAR_OFF_X/Y and BAR_W/H to match your HealthBar_full.png layout.
    this._fillGfx = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);

    // Measure the loaded texture so we know the bar's pixel dimensions
    this._imgW = 0;
    this._imgH = 0;
    if (scene.textures.exists('ui_healthbar')) {
      const src    = scene.textures.get('ui_healthbar').source[0];
      this._imgW   = src.width  * SCALE;
      this._imgH   = src.height * SCALE;
    }

    this._drawFill();
  }

  // Call this whenever player HP changes
  setHealth(current, max) {
    this._curHp = Math.max(0, current);
    this._maxHp = Math.max(1, max);
    this._drawFill();
  }

  _drawFill() {
    // No fill overlay needed if we're just showing a static sprite for now.
    // If you want a dynamic HP bar drawn on top, implement here.
    // Left as a no-op so the sprite shows cleanly without a red overlay.
    this._fillGfx.clear();
  }
}
