// js/systems/DebugGridSystem.js
class DebugGridSystem {
  constructor(scene, mapData) {
    this.scene = scene;
    this.mapData = mapData;
    this.tileW = mapData.tilewidth ?? CFG.TILE_SIZE;
    this.tileH = mapData.tileheight ?? CFG.TILE_SIZE;
    this.mapW = mapData.width * this.tileW;
    this.mapH = mapData.height * this.tileH;
    this._visible = false;

    this._grid = scene.add.graphics()
      .setDepth(9500)
      .setScrollFactor(1)
      .setVisible(false);

    this._labels = scene.add.container(0, 0)
      .setDepth(9501)
      .setScrollFactor(1)
      .setVisible(false);

    this._tooltip = scene.add.text(12, scene.scale.height - 114, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 5 },
    })
      .setScrollFactor(0)
      .setDepth(9502)
      .setVisible(false);

    this._draw();
    this._bindInput();
  }

  destroy() {
    this._grid?.destroy();
    this._labels?.destroy();
    this._tooltip?.destroy();
    this._key?.destroy?.();
  }

  _bindInput() {
    this._key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this._key.on('down', () => this.toggle());
    this.scene.input.on('pointermove', (pointer) => this._updateTooltip(pointer));
    this.scene.scale.on('resize', () => {
      this._tooltip?.setPosition(12, this.scene.scale.height - 114);
    });
  }

  toggle() {
    this._visible = !this._visible;
    this._grid.setVisible(this._visible);
    this._labels.setVisible(this._visible);
    this._tooltip.setVisible(this._visible);
  }

  _draw() {
    const majorEvery = 5;
    this._grid.clear();
    this._grid.lineStyle(1, 0xffffff, 0.18);

    for (let x = 0; x <= this.mapW; x += this.tileW) {
      this._grid.moveTo(x, 0);
      this._grid.lineTo(x, this.mapH);
    }
    for (let y = 0; y <= this.mapH; y += this.tileH) {
      this._grid.moveTo(0, y);
      this._grid.lineTo(this.mapW, y);
    }
    this._grid.strokePath();

    this._grid.lineStyle(1, 0xffdd55, 0.45);
    for (let x = 0; x <= this.mapW; x += this.tileW * majorEvery) {
      this._grid.moveTo(x, 0);
      this._grid.lineTo(x, this.mapH);
    }
    for (let y = 0; y <= this.mapH; y += this.tileH * majorEvery) {
      this._grid.moveTo(0, y);
      this._grid.lineTo(this.mapW, y);
    }
    this._grid.strokePath();

    for (let tx = 0; tx < this.mapData.width; tx += majorEvery) {
      const label = this.scene.add.text(tx * this.tileW + 2, 2, `${tx}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffe07a',
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(9501);
      this._labels.add(label);
    }
    for (let ty = 0; ty < this.mapData.height; ty += majorEvery) {
      const label = this.scene.add.text(2, ty * this.tileH + 2, `${ty}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffe07a',
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(9501);
      this._labels.add(label);
    }
  }

  _updateTooltip(pointer) {
    if (!this._visible) return;
    const world = pointer.positionToCamera(this.scene.cameras.main);
    const pixelX = Math.floor(world.x);
    const pixelY = Math.floor(world.y);
    const tileX = Math.floor(pixelX / this.tileW);
    const tileY = Math.floor(pixelY / this.tileH);
    this._tooltip.setText(`tile ${tileX},${tileY} | pixel ${pixelX},${pixelY}`);
  }
}
