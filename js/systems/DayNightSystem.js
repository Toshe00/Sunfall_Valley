// js/systems/DayNightSystem.js
// ─────────────────────────────────────────────────────────────────────────────
// A full day/night cycle with:
//  • Smooth colour overlay (dawn → day → dusk → night)
//  • Stars that fade in at night
//  • A clock HUD pushed to UIScene via registry
//
// Usage (GameScene.create):
//   this._dayNight = new DayNightSystem(this);
//
// Usage (GameScene.update):
//   this._dayNight.update(delta);
// ─────────────────────────────────────────────────────────────────────────────
class DayNightSystem {

  // ── Tuning ─────────────────────────────────────────────────────────────────
  static DAY_DURATION_MS = 10 * 60 * 1000; // 10 real minutes = 1 game day
  static STAR_COUNT      = 60;

  // Times expressed as 0-1 fraction of the day
  // 0.0 = midnight, 0.25 = 6am, 0.5 = noon, 0.75 = 6pm
  static PHASES = [
    // [ time,  r,    g,    b,    alpha,  label  ]
    // Night/midnight: deep blue-purple overlay
    [  0.00, 0x05, 0x08, 0x22, 0.72, 'midnight' ],
    [  0.20, 0x0d, 0x10, 0x2e, 0.65, 'pre-dawn' ],
    // Dawn: warm peach-orange, gentle alpha
    [  0.25, 0xff, 0x88, 0x44, 0.18, 'dawn'     ],
    [  0.30, 0xff, 0xaa, 0x66, 0.08, 'morning'  ],
    // Daytime: fully transparent
    [  0.35, 0x00, 0x00, 0x00, 0.00, 'day'      ],
    [  0.65, 0x00, 0x00, 0x00, 0.00, 'day'      ],
    // Afternoon/dusk: warm amber-orange, moderate alpha
    [  0.72, 0xff, 0x88, 0x33, 0.12, 'afternoon'],
    [  0.78, 0xff, 0x55, 0x11, 0.25, 'dusk'     ],
    // Evening → night
    [  0.83, 0x18, 0x0e, 0x35, 0.45, 'evening'  ],
    [  0.88, 0x05, 0x08, 0x22, 0.68, 'night'    ],
    [  1.00, 0x05, 0x08, 0x22, 0.72, 'midnight' ],
  ];

  // Hour labels for the clock (game time maps 0-1 → 0:00-24:00)
  static HOUR_NAMES = [
    'midnight','1 am','2 am','3 am','4 am','5 am',
    '6 am','7 am','8 am','9 am','10 am','11 am',
    'noon','1 pm','2 pm','3 pm','4 pm','5 pm',
    '6 pm','7 pm','8 pm','9 pm','10 pm','11 pm',
  ];

  constructor(scene) {
    this.scene    = scene;
    this._t       = 0.30; // start just after dawn
    this._elapsed = DayNightSystem.DAY_DURATION_MS * 0.30;

    const { width: W, height: H } = scene.scale;

    // Full-screen colour overlay — depth just below UI (8999)
    this._overlay = scene.add.rectangle(0, 0, W, H, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(9001)
      .setScrollFactor(0);

    // Stars
    this._stars = [];
    this._buildStars(W, H);

    // Push initial time to registry so UIScene clock can read it
    scene.registry.set('gameTime', this._t);
    scene.registry.set('dayPhase', 'morning');
  }

  // ── Called every GameScene.update(time, delta) ────────────────────────────
  update(delta) {
    // Read speed multiplier set by ClockHUD fast-forward button (default 1)
    const speed = this.scene.registry.get('daySpeedMultiplier') ?? 1;
    this._elapsed = (this._elapsed + delta * speed) % DayNightSystem.DAY_DURATION_MS;
    this._t       = this._elapsed / DayNightSystem.DAY_DURATION_MS;

    const { r, g, b, alpha } = this._interpolatePhase(this._t);

    // Compose hex colour from interpolated r/g/b
    const hex = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
    this._overlay.setFillStyle(hex, alpha);

    // Stars: visible and bright only at night/pre-dawn
    const starAlpha = this._starAlpha(this._t);
    for (const s of this._stars) s.setAlpha(starAlpha * s.getData('base'));

    // Push time to registry for the clock
    this.scene.registry.set('gameTime', this._t);
    this.scene.registry.set('dayPhase', this._phaseName(this._t));
  }

  // ── Build random star field ───────────────────────────────────────────────
  _buildStars(W, H) {
    for (let i = 0; i < DayNightSystem.STAR_COUNT; i++) {
      const x    = Phaser.Math.Between(0, W);
      const y    = Phaser.Math.Between(0, H * 0.6);
      const size = Math.random() < 0.15 ? 2 : 1;
      const base = 0.3 + Math.random() * 0.7; // each star has a unique max brightness

      const star = this.scene.add.rectangle(x, y, size, size, 0xffffff, 0)
        .setDepth(8998)
        .setScrollFactor(0)
        .setData('base', base);

      this._stars.push(star);
    }
  }

  // ── How bright should stars be at time t ─────────────────────────────────
  _starAlpha(t) {
    // Full at night (0–0.22 and 0.85–1.0), fade out at dawn/dusk
    if (t < 0.22)  return Phaser.Math.Linear(1, 0, t / 0.22);
    if (t < 0.30)  return Phaser.Math.Linear(0, 0, 1); // 0 during dawn
    if (t > 0.85)  return Phaser.Math.Linear(0, 1, (t - 0.85) / 0.15);
    if (t > 0.78)  return Phaser.Math.Linear(0, 0, 1); // 0 during dusk
    return 0;
  }

  // ── Interpolate r/g/b/alpha between phase keyframes ───────────────────────
  _interpolatePhase(t) {
    const P = DayNightSystem.PHASES;
    let lo = P[P.length - 1], hi = P[0];
    for (let i = 0; i < P.length - 1; i++) {
      if (t >= P[i][0] && t < P[i + 1][0]) { lo = P[i]; hi = P[i + 1]; break; }
    }
    const span = hi[0] - lo[0] || 1;
    const f    = (t - lo[0]) / span;
    return {
      r    : lo[1] + (hi[1] - lo[1]) * f,
      g    : lo[2] + (hi[2] - lo[2]) * f,
      b    : lo[3] + (hi[3] - lo[3]) * f,
      alpha: lo[4] + (hi[4] - lo[4]) * f,
    };
  }

  // ── Human-readable phase name ─────────────────────────────────────────────
  _phaseName(t) {
    const P = DayNightSystem.PHASES;
    for (let i = P.length - 2; i >= 0; i--) {
      if (t >= P[i][0]) return P[i][5];
    }
    return P[0][5];
  }

  // ── Utility: current game hour 0–23 ──────────────────────────────────────
  get gameHour() { return Math.floor(this._t * 24); }
  get gameMinute() { return Math.floor((this._t * 24 * 60) % 60); }
}