// js/systems/ClockHUD.js
class ClockHUD {

  static PHASE_ICON = {
    'midnight' : '🌑',
    'pre-dawn' : '🌑',
    'dawn'     : '🌅',
    'morning'  : '🌤️',
    'day'      : '☀️',
    'afternoon': '🌤️',
    'dusk'     : '🌆',
    'evening'  : '🌙',
    'night'    : '🌙',
  };

  // ── Layout constants ──────────────────────────────────────────────────────
  static BG_W    = 120;
  static BG_H    = 65;
  static ARC_R   = 16;
  static PAD_R   = 8;
  static PAD_Y   = 39;
  static BTN_W   = 100;
  static BTN_H   = 18;
  static BTN_GAP = 4;

  constructor(scene) {
    this.scene    = scene;
    this._lastStr = '';
    this._fast    = false;

    const W = scene.scale.width;
    const { BG_W, BG_H, PAD_R, PAD_Y, BTN_W, BTN_H, BTN_GAP } = ClockHUD;

    this._bx   = W - BG_W - PAD_R;
    this._by   = PAD_Y;
    this._btnX = this._bx;
    this._btnY = PAD_Y + BG_H + BTN_GAP;
    this._btnW = BTN_W;
    this._btnH = BTN_H;

    this._bg      = scene.add.graphics().setScrollFactor(0).setDepth(9100);
    this._arcGfx  = scene.add.graphics().setScrollFactor(0).setDepth(9101);
    this._bodyGfx = scene.add.graphics().setScrollFactor(0).setDepth(9102);
    this._btnGfx  = scene.add.graphics().setScrollFactor(0).setDepth(9103);

    this._timeText = scene.add.text(
      this._bx + BG_W / 2, PAD_Y + 14, '', {
        fontFamily      : '"Courier New", monospace',
        fontSize        : '34px',
        fontStyle       : 'bold',
        resolution      : 2,
        color           : '#f5e6c8',
        stroke          : '#1a1008',
        strokeThickness : 5,
      })
      .setScrollFactor(0).setDepth(9104)
      .setOrigin(0.5, 0)
      .setScale(0.5);

    this._phaseText = scene.add.text(
      this._bx + BG_W / 2, PAD_Y + 34, '', {
        fontFamily      : '"Courier New", monospace',
        fontSize        : '26px',
        resolution      : 2,
        color           : '#c8b88a',
        stroke          : '#1a1008',
        strokeThickness : 4,
      })
      .setScrollFactor(0).setDepth(9104)
      .setOrigin(0.5, 0)
      .setScale(0.5);

    this._btnText = scene.add.text(
      this._bx + BTN_W / 2,
      this._btnY + BTN_H / 2,
      '⏩ ×1', {
        fontFamily      : '"Courier New", monospace',
        fontSize        : '24px',
        fontStyle       : 'bold',
        resolution      : 2,
        color           : '#88aa88',
        stroke          : '#1a1008',
        strokeThickness : 4,
      })
      .setScrollFactor(0).setDepth(9105)
      .setOrigin(0.5).setScale(0.5)
      .setInteractive({ useHandCursor: true });

    this._btnZone = scene.add.rectangle(
      this._bx + BTN_W / 2,
      this._btnY + BTN_H / 2,
      BTN_W + 10, BTN_H + 10
    ).setScrollFactor(0).setDepth(9106)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.01);

    const toggle = () => {
      this._fast = !this._fast;
      scene.registry.set('daySpeedMultiplier', this._fast ? 10 : 1);
      this._drawButton();
    };
    this._btnZone.on('pointerdown', toggle);
    this._btnText.on('pointerdown', toggle);

    this._drawButton();
    this.update();

    // Button hidden by default — call showButton() to reveal it
    this.hideButton();
  }

  // ── Public: toggle button visibility ─────────────────────────────────────
  hideButton() {
    this._btnGfx.setVisible(false);
    this._btnText.setVisible(false);
    this._btnZone.setVisible(false);
  }

  showButton() {
    this._btnGfx.setVisible(true);
    this._btnText.setVisible(true);
    this._btnZone.setVisible(true);
  }

  update() {
    const t     = this.scene.registry.get('gameTime') ?? 0.35;
    const phase = this.scene.registry.get('dayPhase') ?? 'day';

    const totalMinutes = Math.floor(t * 24 * 60);
    const h    = Math.floor(totalMinutes / 60) % 24;
    const m    = totalMinutes % 60;
    const h12  = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    const timeStr  = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    const icon     = ClockHUD.PHASE_ICON[phase] ?? '🕐';
    const phaseStr = phase.charAt(0).toUpperCase() + phase.slice(1);

    const key = `${timeStr}|${phase}`;
    if (key === this._lastStr) return;
    this._lastStr = key;

    this._timeText.setText(`${icon} ${timeStr}`);
    this._phaseText.setText(phaseStr);

    const isNight = ['night','midnight','pre-dawn','evening'].includes(phase);
    const isDusk  = phase === 'dusk'  || phase === 'afternoon';
    const isDawn  = phase === 'dawn'  || phase === 'morning';

    const bgColor  = isNight ? 0x0d1028 : isDusk ? 0x2a1008 : isDawn ? 0x1a1230 : 0x0a1808;
    const timeCol  = isNight ? '#aabbff' : isDusk ? '#ffcc88' : isDawn ? '#ffddaa' : '#f5e6c8';
    const phaseCol = isNight ? '#7788cc' : isDusk ? '#cc8844' : isDawn ? '#ddaa66' : '#88bb66';
    const borderC  = isNight ? 0x334488  : isDusk ? 0x884422  : 0x336622;

    this._timeText.setStyle({ color: timeCol });
    this._phaseText.setStyle({ color: phaseCol });

    const { BG_W, BG_H, ARC_R } = ClockHUD;
    const bx = this._bx, by = this._by;

    this._bg.clear();
    this._bg.fillStyle(bgColor, 0.90);
    this._bg.fillRoundedRect(bx, by, BG_W, BG_H, 8);
    this._bg.lineStyle(1.5, borderC, 0.85);
    this._bg.strokeRoundedRect(bx, by, BG_W, BG_H, 8);

    const ARC_X = bx + BG_W / 2;
    const ARC_Y = by - 4;
    this._arcGfx.clear();
    this._arcGfx.lineStyle(1.5, isNight ? 0x334488 : 0x448833, 0.45);
    this._arcGfx.beginPath();
    this._arcGfx.arc(ARC_X, ARC_Y, ARC_R, Math.PI, 0, false);
    this._arcGfx.strokePath();

    const arcT  = Phaser.Math.Clamp((t - 0.25) / 0.5, 0, 1);
    const angle = Math.PI - arcT * Math.PI;
    const dotX  = ARC_X + Math.cos(angle) * ARC_R;
    const dotY  = ARC_Y - Math.sin(angle) * ARC_R;

    const dotColor = isNight ? 0xaabbff : isDusk ? 0xff8833 : isDawn ? 0xffcc44 : 0xffee22;
    const dotR     = isNight ? 3 : 4;

    this._bodyGfx.clear();
    this._bodyGfx.fillStyle(dotColor, 0.28);
    this._bodyGfx.fillCircle(dotX, dotY, dotR + 3);
    this._bodyGfx.fillStyle(dotColor, 1);
    this._bodyGfx.fillCircle(dotX, dotY, dotR);
    this._bodyGfx.fillStyle(0xffffff, 0.75);
    this._bodyGfx.fillCircle(dotX - 1, dotY - 1, dotR * 0.38);
  }

  _drawButton() {
    const { _btnX: bx, _btnY: by, _btnW: bw, _btnH: bh, _fast: fast } = this;
    this._btnGfx.clear();
    this._btnGfx.fillStyle(fast ? 0x553300 : 0x111a11, 0.92);
    this._btnGfx.fillRoundedRect(bx, by, bw, bh, 5);
    this._btnGfx.lineStyle(1.5, fast ? 0xffcc00 : 0x334433, 0.9);
    this._btnGfx.strokeRoundedRect(bx, by, bw, bh, 5);
    this._btnText.setText(fast ? '⏩ ×10  ON' : '⏩ ×10 OFF');
    this._btnText.setStyle({ color: fast ? '#ffee44' : '#557755' });
  }
}