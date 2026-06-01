// js/systems/DebugGridSystem.js
class DebugGridSystem {
  constructor(scene, mapData) {
    this.scene = scene;
    this.mapData = mapData;
    this.tileW = mapData.tilewidth ?? CFG.TILE_SIZE;
    this.tileH = mapData.tileheight ?? CFG.TILE_SIZE;
    this.mapW = mapData.width * this.tileW;
    this.mapH = mapData.height * this.tileH;
    this.majorEvery = 5;
    this._visible = false;
    this._labelPool = [];
    this._lastLabelKey = '';

    this._grid = scene.add.graphics()
      .setDepth(9500)
      .setScrollFactor(1)
      .setVisible(false);

    this._labels = scene.add.container(0, 0)
      .setDepth(9501)
      .setScrollFactor(1)
      .setVisible(false);

    this._tooltip = scene.add.text(12, 12, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#8ef7ff',
      stroke: '#000000',
      strokeThickness: 3,
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
    this.scene.events.off('postupdate', this._updateVisibleLabels, this);
    if (this._onResize) this.scene.scale.off('resize', this._onResize);
  }

  _bindInput() {
    this._key = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this._key.on('down', () => this.toggle());
    this.scene.input.on('pointermove', (pointer) => this._updateTooltip(pointer));
    this._onResize = () => this._updateTooltip(this.scene.input.activePointer);
    this.scene.scale.on('resize', this._onResize);
    this.scene.events.on('postupdate', this._updateVisibleLabels, this);
  }

  toggle() {
    this._visible = !this._visible;
    this._grid.setVisible(this._visible);
    this._labels.setVisible(this._visible);
    this._tooltip.setVisible(this._visible);
    if (this._visible) {
      this._lastLabelKey = '';
      this._updateVisibleLabels();
      this._updateTooltip(this.scene.input.activePointer);
    }
  }

  _draw() {
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
    for (let x = 0; x <= this.mapW; x += this.tileW * this.majorEvery) {
      this._grid.moveTo(x, 0);
      this._grid.lineTo(x, this.mapH);
    }
    for (let y = 0; y <= this.mapH; y += this.tileH * this.majorEvery) {
      this._grid.moveTo(0, y);
      this._grid.lineTo(this.mapW, y);
    }
    this._grid.strokePath();
  }

  _updateVisibleLabels() {
    if (!this._visible) return;

    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const startX = Phaser.Math.Clamp(
      Math.floor(view.left / this.tileW / this.majorEvery) * this.majorEvery,
      0,
      this.mapData.width - 1
    );
    const endX = Phaser.Math.Clamp(
      Math.ceil(view.right / this.tileW / this.majorEvery) * this.majorEvery,
      0,
      this.mapData.width - 1
    );
    const startY = Phaser.Math.Clamp(
      Math.floor(view.top / this.tileH / this.majorEvery) * this.majorEvery,
      0,
      this.mapData.height - 1
    );
    const endY = Phaser.Math.Clamp(
      Math.ceil(view.bottom / this.tileH / this.majorEvery) * this.majorEvery,
      0,
      this.mapData.height - 1
    );

    const labelKey = `${startX},${endX},${startY},${endY}`;
    if (labelKey === this._lastLabelKey) return;
    this._lastLabelKey = labelKey;

    let poolIndex = 0;
    for (let ty = startY; ty <= endY; ty += this.majorEvery) {
      for (let tx = startX; tx <= endX; tx += this.majorEvery) {
        const label = this._getLabel(poolIndex++);
        label
          .setText(`${tx},${ty}`)
          .setPosition(tx * this.tileW + 2, ty * this.tileH + 2)
          .setVisible(true);
      }
    }

    for (let i = poolIndex; i < this._labelPool.length; i++) {
      this._labelPool[i].setVisible(false);
    }
  }

  _getLabel(index) {
    if (!this._labelPool[index]) {
      const label = this.scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#8ef7ff',
        stroke: '#000000',
        strokeThickness: 3,
      })
        .setDepth(9501)
        .setVisible(false);
      this._labels.add(label);
      this._labelPool[index] = label;
    }
    return this._labelPool[index];
  }

  _updateTooltip(pointer) {
    if (!this._visible) return;
    const world = pointer.positionToCamera(this.scene.cameras.main);
    const pixelX = Math.floor(world.x);
    const pixelY = Math.floor(world.y);
    const tileX = Math.floor(pixelX / this.tileW);
    const tileY = Math.floor(pixelY / this.tileH);
    const offset = 14;
    this._tooltip.setText(`tile: ${tileX},${tileY}\npixel: ${pixelX},${pixelY}`);
    const maxX = this.scene.scale.width - this._tooltip.width - 8;
    const maxY = this.scene.scale.height - this._tooltip.height - 8;
    this._tooltip.setPosition(
      Phaser.Math.Clamp(pointer.x + offset, 8, maxX),
      Phaser.Math.Clamp(pointer.y + offset, 8, maxY)
    );
  }
}
