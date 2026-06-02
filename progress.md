Original prompt: Ajouter l'icone de l'epee dans l'inventaire, permettre son drag vers la hotbar, et autoriser l'attaque au clic gauche uniquement quand le slot hotbar contenant l'epee est selectionne.

Progress:
- Current prompt: Centraliser les statistiques de tous les ennemis dans ENEMY_STATS sans modifier spawns/animations/respawn/comportements.
- Added ENEMY_STATS in GameConfig.js with the requested temporary balancing values. CFG.ENEMIES.STATS points to the centralized table, while CFG.ENEMIES.TYPES now keeps technical settings and derives gameplay stats from ENEMY_STATS. EnemySpawnSystem._typeDef now merges centralized stats and safely falls back to slime stats for unknown enemy types, while preserving visionRange/attackCooldownMs aliases for the existing movement/attack code.
- Verified with Playwright scripts: enemy-stats-test confirms exact centralized values, difficulty ordering, golem highest HP/slow role, demon damage scaling, alias mapping, fallback safety, 5 minute respawn unchanged, spawned HP/maxHP from stats; all enemy family behavior/respawn tests and ZQSD/TAB/hotbar/sword-gated click attack still pass.
- Current prompt: Passer le timer de respawn de tous les ennemis de 10 minutes a 5 minutes, sans changer spawns/stats/animations.
- Changed CFG.ENEMIES.RESPAWN_MS from 10 * 60 * 1000 to 5 * 60 * 1000, and aligned the EnemySpawnSystem fallback to 300000 ms. Verified all enemy family tests now assert a 300000 ms delayed respawn, keep original spawn positions, and do not duplicate enemies. UI/ZQSD/TAB/hotbar/sword-gated click attack test and develop-web-game client still pass.
- Current prompt: Ajouter Demon1 tile 105,29, Demon2 tile 66,27, Demon3 tile 59,11, plus Demon1 tile 104,14 et Demon2 tile 127,28 via le systeme ennemi existant, avec assets demons reels.
- Added Demon1/2/3 spritesheets under assets/characters/demon1, demon2, demon3 and configured five demon spawn records, temporary stats, and 128x128 asset definitions. Demon stats are stronger than goblins and below golem HP.
- Verified with Playwright scripts: total fixed enemies is now 20; demon tiles convert to 1688,472 / 1064,440 / 952,184 / 1672,232 / 2040,456; all Demon spawns use real assets, avoid collision bodies, chase/attack/take sword damage/die/10 minute respawn without duplicate; existing slime/goblin/golem/lizardman/skeleton and ZQSD/TAB/hotbar/sword-gated click attack still pass. Visual check confirmed Demon1 renders in the lava dungeon area.
- Current prompt: Ajouter Skeleton1 tile 153,85, Skeleton2 tile 170,70, Skeleton3 tile 155,43, plus un Skeleton1 tile 170,20 via le systeme ennemi existant, avec assets skeletons reels.
- Added Skeleton1/2/3 spritesheets under assets/characters/skeleton1, skeleton2, skeleton3 and configured their spawn/assets/stats. Skeleton hitboxes are slightly smaller and centered so the exact requested tiles do not overlap map collision, especially Skeleton2 at 170,70.
- Verified with Playwright scripts: total fixed enemies is now 15; skeleton tiles convert to 2456,1368 / 2728,1128 / 2488,696 / 2728,328; all Skeleton variants chase/attack/take sword damage/die/10 minute respawn without duplicate; existing slime/goblin/golem/lizardman and ZQSD/TAB/hotbar/sword-gated click attack still pass. Visual check confirmed Skeleton1 renders on the undead dungeon area.
- Current prompt: Ajouter Lizardman1 tile 25,76, Lizardman2 tile 26,50, Lizardman3 tile 18,39, plus un gobelin tile 23,17 via le systeme ennemi existant, avec assets lizardmen reels.
- Added Lizardman1/2/3 spritesheets under assets/characters/lizardman1, lizardman2, lizardman3 and configured their spawn/assets/stats. Added the extra goblin spawn using the existing goblin type.
- Verified with Playwright scripts: 3 slimes, 4 goblins, 1 golem, and 3 lizardmen spawn; lizard tiles convert to 408,1224 / 424,808 / 296,632 and extra goblin to 376,280; all Lizardmen chase/attack/take sword damage/die/10 minute respawn without duplicate; existing slime/goblin/golem and ZQSD/TAB/hotbar/sword-gated click attack still pass. Visual checks confirmed the lizardmen are rendered on land; water-layer false positives come from lower decorative tile layers.
- Current prompt: Ajouter un spawn de golem tile 117,68 via le systeme ennemi existant, avec assets Golem1, degats identiques au slime, plus tanky qu'un gobelin, lent et respawn 10 minutes.
- Added Golem1 spritesheets under assets/characters/golem/golem1 and configured golem spawn/assets/stats: 300 HP, 5 damage, slow movement.
- Verified with Playwright scripts: 3 slimes, 3 goblins, and 1 golem spawn; golem tile 117,68 converts to 1880,1096; golem spawn does not intersect tested collision or water tile layers; golem chase/attack/death/10 minute respawn works without duplicate; ZQSD/TAB/hotbar/sword-gated click attack still pass.
- Current prompt: Ajouter trois spawns de gobelins aux tiles 114,92 / 55,77 / 72,50 via le systeme ennemi existant, avec assets Goblin1, stats superieures au slime et respawn 10 minutes.
- Added Goblin1 spritesheets under assets/characters/goblin/goblin1 and configured goblin enemy assets, stats, and spawn records in CFG.ENEMIES.
- Verified with Playwright scripts: 3 slimes and 3 goblins spawn, goblins are 150 HP / 10 damage, spawn tiles convert to 1832,1480 / 888,1240 / 1160,808, no tested goblin spawn intersects collision or water tile layers, goblin chase/attack/death/10 minute respawn works without duplicate, and ZQSD/TAB/hotbar/sword-gated click attack still pass.
- Current prompt: Ajouter deux spawns de slime aux tiles 55,111 et 101,112 via CFG.ENEMIES.SPAWNS, en conservant le systeme tileX/tileY, le respawn 10 minutes, les controles ZQSD, TAB, hotbar et attaque epee.
- Added slime spawn config entries for tile 55,111 and tile 101,112 using the existing EnemySpawnSystem tile-based conversion.
- Verified with Playwright scripts: slime spawns at 55,111 / 79,112 / 101,112, HP remains 75, chase/attack/death/10 minute respawn work, respawn does not duplicate, and ZQSD/TAB/hotbar/sword click attack still pass.
- UI resize pass: increased bottom hotbar by 50%, anchored it to the bottom edge, and increased top-left player HUD by 50%.
- Verified UI resize in Playwright: hotbar slot size is 72px, hotbar strip bottom aligns with viewport bottom, player HUD scale is 2.7, TAB/drag/drop/ZQSD/sword attack still work.
- Player spawn moved to PlayerSpawn at x=1295, y=1488 on the farm path shown in the screenshot.
- Hotbar bottom anchoring fixed by rendering the cropped visible hotbar strip and relayouting it on scale resize.
- Added DEBUG_GRID=false development grid gate, DebugGridSystem, and tile-based enemy spawn conversion config.
- DEBUG_GRID left enabled for development so G can show/hide the coordinate grid.
- Debug grid labels now show visible tileX,tileY coordinates every 5 tiles, with a mouse tooltip for tile and pixel coordinates.
- Found sword icon already in project: assets/items/weapon_icon_2/Icons/Icon_4_06.png.
- Inventory and hotbar systems already support draggable inventory items and active slot selection.
- Pointer attack is centralized in GameScene._handlePointerAttack.
- Added sword texture, starting inventory item, and left-click sword gating.
- Changed inventory item click handling so a drag is not interrupted by the panel closing on pointerdown.
- Verified with Playwright: D movement still works, TAB opens inventory, sword drag to hotbar works, non-sword active slot blocks left-click attack, sword active slot allows attack.

TODO:
- No open TODOs.
