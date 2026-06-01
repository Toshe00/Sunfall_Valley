Original prompt: Ajouter l'icone de l'epee dans l'inventaire, permettre son drag vers la hotbar, et autoriser l'attaque au clic gauche uniquement quand le slot hotbar contenant l'epee est selectionne.

Progress:
- UI resize pass: increased bottom hotbar by 50%, anchored it to the bottom edge, and increased top-left player HUD by 50%.
- Verified UI resize in Playwright: hotbar slot size is 72px, hotbar strip bottom aligns with viewport bottom, player HUD scale is 2.7, TAB/drag/drop/ZQSD/sword attack still work.
- Found sword icon already in project: assets/items/weapon_icon_2/Icons/Icon_4_06.png.
- Inventory and hotbar systems already support draggable inventory items and active slot selection.
- Pointer attack is centralized in GameScene._handlePointerAttack.
- Added sword texture, starting inventory item, and left-click sword gating.
- Changed inventory item click handling so a drag is not interrupted by the panel closing on pointerdown.
- Verified with Playwright: D movement still works, TAB opens inventory, sword drag to hotbar works, non-sword active slot blocks left-click attack, sword active slot allows attack.

TODO:
- No open TODOs.
