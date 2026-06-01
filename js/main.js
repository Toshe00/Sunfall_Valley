// js/main.js
const game = new Phaser.Game({
  type      : Phaser.CANVAS,
  width     : window.innerWidth,
  height    : window.innerHeight,
  backgroundColor: '#1a1208',
  pixelArt  : true,
  parent    : 'game-container',
  physics: {
    default: 'arcade',
    arcade : { gravity:{ y:0 }, debug: false },
  },
  scale: {
    mode      : Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Declare scenes but DON'T auto-start them all.
  // Phaser starts the FIRST scene automatically (BootScene).
  // BootScene then launches GameScene + UIScene via scene.launch().
  scene: [BootScene, GameScene, UIScene],
});

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
