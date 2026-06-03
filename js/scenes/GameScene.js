// js/scenes/GameScene.js
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this._dayNight = new DayNightSystem(this);
    const jsonData = this.cache.json.get('mapjson');

    const mapW = jsonData.width  * CFG.TILE_SIZE;   
    const mapH = jsonData.height * CFG.TILE_SIZE;   
    this._mapData = jsonData;
    this._tileW = jsonData.tilewidth ?? CFG.TILE_SIZE;
    this._tileH = jsonData.tileheight ?? CFG.TILE_SIZE;
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this._mapW = mapW;
    this._mapH = mapH;

    this._dynPropDefs = this._buildDynPropDefs(jsonData.tilesets);
    this._meta = this._buildMeta(jsonData.tilesets);

    const _doorTs   = jsonData.tilesets.find(t => t.name === 'Doors');
    const _fenceTs  = jsonData.tilesets.find(t => t.name === 'fence_animation');
    const _windowTs = jsonData.tilesets.find(t => t.name === 'house_windows');
    this._doorFirstgid   = _doorTs?.firstgid   ?? -1;
    this._fenceFirstgid  = _fenceTs?.firstgid  ?? -2;
    this._windowFirstgid = _windowTs?.firstgid ?? -3;

    this._ANIM_HALF  = 900;
    this._animGidMap = this._buildAnimGidMap();
    this._tileLayers = [];
    this._flattenLayers(jsonData.layers, this._tileLayers);

    const sorted = this._sortTiles();

    // ── 1. RENDER STATIC LAYERS ONCE ──────────────────────────────────────
    this._belowCanvas = this._makeCanvas(mapW, mapH);
    this._midCanvas   = this._makeCanvas(mapW, mapH);

    this._renderStatic(this._belowCanvas.getContext('2d'), sorted.belowEntries);
    this._renderStatic(this._midCanvas.getContext('2d'),   sorted.midEntries);

    this.textures.addCanvas('belowDisplay', this._belowCanvas);
    this.textures.addCanvas('midDisplay',   this._midCanvas);

    this.add.image(0, 0, 'belowDisplay').setOrigin(0, 0).setDepth(-2);
    this.add.image(0, 0, 'midDisplay').setOrigin(0, 0).setDepth(0);

    // ── 2. CONVERT ANIMATED TILES TO HARDWARE SPRITES ─────────────────────
    this._animatedTiles = [];
    const spawnAnimTile = (e, baseDepth) => {
      const frame = this._getTileFrame(e.ts, e.localId);
      const TW = CFG.TILE_SIZE;
      
      const img = this.add.image(e.dx + TW / 2, e.dy + TW / 2, e.ts.texKey, frame)
        .setDepth(baseDepth);

      if (e.flipD) {
        img.setAngle(90);
        if (!e.flipH && !e.flipV) img.setScale(-1, 1);
        else if (e.flipH && e.flipV) img.setScale(1, 1);
        else if (e.flipH) img.setScale(1, -1);
        else img.setScale(-1, 1);
      } else {
        if (e.flipH) img.setFlipX(true);
        if (e.flipV) img.setFlipY(true);
      }

      this._animatedTiles.push({ img, entry: e, state: 'closed', clock: 0, lastMs: 0 });
    };

    for (const e of sorted.animEntries) spawnAnimTile(e, -1);
    for (const e of sorted.aboveAnimEntries) spawnAnimTile(e, 9000);

    // ── 3. BUILD REST OF WORLD ────────────────────────────────────────────
    this._buildYSprites(sorted.aboveEntries, sorted.houseClusterTiles);
    this._buildDynamicProps(jsonData.layers);

    const playerSpawn = CFG.PLAYER.SPAWN ?? {
      x: CFG.PLAYER.START_X,
      y: CFG.PLAYER.START_Y,
    };
    this._playerSpawn = { x: playerSpawn.x, y: playerSpawn.y };
    this._player = new PlayerSystem(this, playerSpawn.x, playerSpawn.y);
    this._heroXP = new HeroXPSystem(this, this._player);
    this._player.sprite.setCollideWorldBounds(true);
    this.cameras.main.setZoom(2.0);
    this.cameras.main.startFollow(this._player.sprite, true, 0.08, 0.08);
    this._lastAttackHits = 0;
    this.events.on('player-health-changed', (current, max) => {
      this.registry.set('playerHealth', { current, max });
      this.scene.get('UIScene')?._healthBar?.setHealth(current, max);
    });
    this.events.on('player-stamina-changed', (current, max) => {
      this.registry.set('playerStamina', { current, max });
      this.scene.get('UIScene')?._healthBar?.setStamina(current, max);
    });
    this.events.on('player-death', () => {
      this._schedulePlayerRespawn();
    });
    this.events.on('damage-player', (amount = 10) => this.damagePlayer(amount));
    this.registry.set('playerHealth', { current: this._player.health, max: this._player.maxHealth });
    this.scene.get('UIScene')?._healthBar?.setHealth(this._player.health, this._player.maxHealth);
    this.registry.set('playerStamina', { current: this._player.stamina, max: this._player.maxStamina });

    this._buildCollisions(jsonData.layers);

    const inv = {
      addItem   : (k,q,l,icon) => this.scene.get('UIScene')?._inventory?.addItem(k,q,l,icon),
      hasItem   : (k,q)        => this.scene.get('UIScene')?._inventory?.hasItem(k,q) ?? true,
      removeItem: (k,q)        => this.scene.get('UIScene')?._inventory?.removeItem(k,q),
    };

    const bedPositions    = this._getBedPositions();
    const mineSpawns      = this._getObjLayer(jsonData.layers, 'Mine_stones');
    const treeSpawns      = this._getObjLayer(jsonData.layers, 'Cuttable_trees_object');
    const rawDynamicProps = this._getRawObjLayer(jsonData.layers, 'Dynamic_props_object');

    this._mining     = new MiningSystem(this,  mineSpawns, inv, this._player);
    this._trees      = new TreeSystem(this,    treeSpawns, inv, this._player);
    this._farming    = new FarmingSystem(this, inv, this._player, bedPositions);
    this._fruitTrees = new FruitTreeSystem(this, rawDynamicProps, inv, this._player);
    this._enemySystem = new EnemySpawnSystem(
      this,
      jsonData,
      CFG.ENEMIES?.SPAWNS ?? [],
      { enabled: CFG.ENEMIES?.ENABLED === true }
    );
    this._enemySystem.linkWorldColliders?.(this._collisionGroup);

    this._mining.linkStaticProps(this.children.list);
    this._farming.enableMousePlanting();

    if (DEBUG_GRID === true) {
      this._debugGrid = new DebugGridSystem(this, jsonData);
    }

    this.time.delayedCall(100, () => {
      const uiScene = this.scene.get('UIScene');
      if (uiScene?._inventory) {
        uiScene._inventory.onSelect(key => { this._farming.selectSeed(key); });
      }
    });

    this._interactKey = this.input.keyboard.addKey(CFG.KEY_INTERACT);
    this._useItemKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.on('pointerdown', this._handlePointerAttack, this);
    this.registry.set('fps', 0);
  }

  update(time, delta) {
    this._dayNight.update(delta);

    // CULLED hardware sprite animation updates
    this._updateAnimatedTiles(time);

    this._player.update(delta);
    const playerFeetY = this._player.sprite.body.y + this._player.sprite.body.height;
    this._player.sprite.setDepth(playerFeetY);

    if (!this._lastLabelTick || time - this._lastLabelTick > 100) {
      this._mining.updateLabels();
      this._trees.updateLabels();
      this._farming.updateLabels();
      this._fruitTrees.updateLabels();
      this._lastLabelTick = time;
    }

    this._mining.update();
    this._trees.update();
    this._farming.update();
    this._fruitTrees.update();
    this._enemySystem?.update(time, delta);

    if (Phaser.Input.Keyboard.JustDown(this._useItemKey) && !this._player?.isDead && !this.registry.get('playerInputLocked')) {
      this.useSelectedHotbarItem();
    }

    if (Phaser.Input.Keyboard.JustDown(this._interactKey) && !this._player?.isDead && !this.registry.get('playerInputLocked')) {
      const activeKey = this.scene.get('UIScene')?._hotbar?.activeItem?.key ?? null;
      const harvestedFruit = this._fruitTrees.tryHarvest();
      if (!harvestedFruit) {
        const mined = this._mining.tryMine();
        if (!mined) {
          const chopped = (!activeKey || activeKey.endsWith('_axe')) && this._trees.tryChop();
          if (!chopped) this._farming.tryInteract();
        }
      }
      this._player.playAttack();
    }
  }

  _handlePointerAttack(pointer) {
    if (pointer.button !== 0 || this._player?.isDead || this.registry.get('playerInputLocked')) return;
    if (this.scene.get('UIScene')?._inventory?.isOpen?.()) return;
    if (!this._isSwordSelected()) return;

    this._player.playAttack({
      onHit: () => {
        this._lastAttackHits = this._damageEnemiesInAttackBox();
        this.registry.set('lastAttackHits', this._lastAttackHits);
      },
    });
  }

  _isSwordSelected() {
    const hotbar = this.scene.get('UIScene')?._hotbar;
    return hotbar?.activeItem?.key === 'sword';
  }

  damagePlayer(amount = 10) {
    return this._player?.takeDamage(amount) ?? false;
  }

  useSelectedHotbarItem() {
    const ui = this.scene.get('UIScene');
    if (!ui || ui._inventory?.isOpen?.()) return false;

    const hotbar = ui._hotbar;
    const item = hotbar?.activeItem;
    const def = CFG.CONSUMABLES?.[item?.key];
    if (!item || !def) return false;

    if ((item.qty ?? 0) < 1) {
      hotbar?.clearActiveIfKey?.(item.key);
      ui._showNotif?.(`${def.label ?? item.label ?? item.key} x0`, '#ffdd88');
      return false;
    }

    const heal = Math.max(0, def.heal ?? 0);
    if (heal <= 0) return false;

    if (this._player.health >= this._player.maxHealth) {
      ui._showNotif?.('Vie deja pleine', '#ffdd88');
      return false;
    }

    const before = this._player.health;
    this._player.heal(heal);
    const healed = this._player.health - before;
    if (healed <= 0) return false;

    if (!hotbar?.consumeActiveItem?.(1)) return false;

    this.registry.set('lastConsumedItem', {
      key: item.key,
      healed,
      health: this._player.health,
      maxHealth: this._player.maxHealth,
    });
    ui._showNotif?.(`+${healed} HP`, '#88ff88');
    return true;
  }

  _schedulePlayerRespawn() {
    if (this._playerRespawnEvent) return;
    this.registry.set('playerDead', true);
    this.registry.set('playerInputLocked', true);
    this._player.sprite.body?.setVelocity(0, 0);
    this._playerRespawnEvent = this.time.delayedCall(CFG.PLAYER.RESPAWN_DELAY_MS ?? 2500, () => {
      this._playerRespawnEvent = null;
      this._respawnPlayer();
    });
  }

  _respawnPlayer() {
    const spawn = this._playerSpawn ?? CFG.PLAYER.SPAWN ?? {
      x: CFG.PLAYER.START_X,
      y: CFG.PLAYER.START_Y,
    };
    this._player.respawnAt(spawn.x, spawn.y);
    this.registry.set('playerDead', false);
    this.registry.set('playerInputLocked', false);
    this.cameras.main.startFollow(this._player.sprite, true, 0.08, 0.08);
    this.cameras.main.centerOn(this._player.x, this._player.y);
  }

  _damageEnemiesInAttackBox() {
    const rect = this._getAttackBox();
    const targets = this._collectEnemyTargets();
    let hits = 0;

    for (const target of targets) {
      if (!target || target === this._player.sprite || target.active === false) continue;
      const bounds = this._getTargetBounds(target);
      if (!bounds || !Phaser.Geom.Intersects.RectangleToRectangle(rect, bounds)) continue;
      if (this._damageEnemyTarget(target, this._player.attackDamage ?? CFG.PLAYER.ATTACK_DAMAGE ?? 25)) hits++;
    }
    return hits;
  }

  _getAttackBox() {
    const p = this._player;
    const w = CFG.PLAYER.ATTACK_ARC_W ?? 44;
    const h = CFG.PLAYER.ATTACK_ARC_H ?? 38;
    const r = CFG.PLAYER.ATTACK_RANGE ?? 42;
    const offsets = {
      down : { x: 0,  y: r },
      up   : { x: 0,  y: -r },
      left : { x: -r, y: 0 },
      right: { x: r,  y: 0 },
    };
    const o = offsets[p.facing] ?? offsets.down;
    return new Phaser.Geom.Rectangle(
      p.x + o.x - w / 2,
      p.y + o.y - h / 2,
      w,
      h
    );
  }

  _collectEnemyTargets() {
    const sources = [
      this._enemySystem?.enemies,
      this._enemySystem?.group,
      this._enemies,
      this.enemies,
      this.enemyGroup,
    ];
    const out = [];

    const addSource = (source) => {
      if (!source) return;
      if (Array.isArray(source)) {
        out.push(...source);
      } else if (source.getChildren) {
        out.push(...source.getChildren());
      } else if (source.children?.entries) {
        out.push(...source.children.entries);
      }
    };
    sources.forEach(addSource);

    for (const obj of this.children.list) {
      if (obj?.getData?.('enemy') || obj?.isEnemy || obj?.enemy) out.push(obj);
    }

    return Array.from(new Set(out));
  }

  _getTargetBounds(target) {
    if (target.getBounds) return target.getBounds();
    const body = target.body;
    if (body) {
      return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
    }
    return null;
  }

  _damageEnemyTarget(target, amount) {
    if (typeof target.takeDamage === 'function') return target.takeDamage(amount, { source: 'player' }) !== false;
    if (typeof target.receiveDamage === 'function') return target.receiveDamage(amount) !== false;
    if (typeof target.damage === 'function') return target.damage(amount) !== false;
    if (typeof target.hit === 'function') return target.hit(amount) !== false;

    const currentHp = target.getData?.('hp');
    if (typeof currentHp === 'number') {
      const nextHp = Math.max(0, currentHp - amount);
      target.setData('hp', nextHp);
      if (nextHp <= 0) target.destroy?.();
      return true;
    }
    return false;
  }

  static get HIDE_LAYER_IDS() { return new Set(); }

  _buildMeta(tilesets) {
    const pathToKey = {};
    for (const entry of CFG.TILESETS) {
      const rel = entry.path.replace(/^assets\/world\//, '');
      pathToKey[rel] = entry.key;
    }

    return tilesets.map(ts => {
      if (!ts.image && ts.source) {
        return { firstgid: ts.firstgid, img: null, cols: 1, animMap: {}, texKey: null };
      }

      if (!ts.image) {
        return { firstgid: ts.firstgid, img: null, cols: 1, animMap: {}, texKey: null };
      }

      const texKey = pathToKey[ts.image] ?? null;
      if (!texKey) return { firstgid: ts.firstgid, img: null, cols: 1, animMap: {}, texKey: null };

      const tex  = this.textures.get(texKey);
      const img  = tex?.source?.[0]?.image ?? null;
      const cols = ts.columns || (img ? Math.floor(img.naturalWidth / CFG.TILE_SIZE) : 1);

      const animMap = {};
      for (const t of (ts.tiles || [])) {
        if (t.animation) animMap[t.id] = t.animation;
      }

      return { firstgid: ts.firstgid, img, cols, animMap, texKey };
    });
  }

  _getTileFrame(ts, localId) {
    const frameKey = `tile_${localId}`;
    const tex = this.textures.get(ts.texKey);
    
    if (tex && !tex.frames[frameKey]) {
      const TW = CFG.TILE_SIZE;
      const sx = (localId % ts.cols) * TW;
      const sy = Math.floor(localId / ts.cols) * TW;
      tex.add(frameKey, 0, sx, sy, TW, TW);
    }
    return frameKey;
  }

  _buildDynPropDefs(tilesets) {
    const map = new Map();
    for (const ts of tilesets) {
      if (ts.image) continue;
      for (const t of (ts.tiles || [])) {
        const gid = ts.firstgid + t.id;
        if (map.has(gid)) continue;

        const imgSrc = t.image || '';
        if (!imgSrc) continue;

        let resolvedPath = imgSrc.startsWith('../') 
          ? 'assets/' + imgSrc.slice(3) 
          : 'assets/world/' + imgSrc;

        map.set(gid, {
          texKey : 'dp_' + resolvedPath,
          nativeW: t.imagewidth  || 32,
          nativeH: t.imageheight || 32,
        });
      }
    }
    return map;
  }

  _buildAnimGidMap() {
    const map = new Map();
    for (const ts of this._meta)
      for (const [lid, frames] of Object.entries(ts.animMap))
        map.set(ts.firstgid + parseInt(lid), frames);
    return map;
  }

  _flattenLayers(layers, out) {
    const seen = new Set();
    const walk = arr => {
      for (const l of arr) {
        if (l.visible === false) continue;
        if (l.type === 'tilelayer' && !seen.has(l.id)) {
          seen.add(l.id);
          if (!GameScene.HIDE_LAYER_IDS.has(l.id)) out.push(l);
        }
        if (l.layers) walk(l.layers);
      }
    };
    walk(layers);
  }

  _resolveGid(raw) {
    for (let i = this._meta.length - 1; i >= 0; i--)
      if (raw >= this._meta[i].firstgid && this._meta[i].img)
        return { ts: this._meta[i], localId: raw - this._meta[i].firstgid };
    return null;
  }

  _sortTiles() {
    const F_ALL = 0x80000000|0x40000000|0x20000000;
    const TW    = CFG.TILE_SIZE;

    const posMaxAnim = new Map();
    for (let li = 0; li < this._tileLayers.length; li++) {
      const layer = this._tileLayers[li];
      const lw=layer.width, ox=layer.offsetx||0, oy=layer.offsety||0;
      for (let i=0;i<layer.data.length;i++) {
        const gid=layer.data[i]; if(!gid) continue;
        if(!this._animGidMap.has(gid&~F_ALL)) continue;
        const key=`${(i%lw)*TW+ox},${Math.floor(i/lw)*TW+oy}`;
        if ((posMaxAnim.get(key)??-1)<li) posMaxAnim.set(key,li);
      }
    }

    const belowEntries=[], animEntries=[], aboveAnimEntries=[],
          aboveEntries=[], midEntries=[], houseClusterTiles=[];

    const ROOF_IDS = new Set([83,85,86,87,88,89,75,76,77,78,79,395,396]);

    for (let li=0;li<this._tileLayers.length;li++) {
      const layer=this._tileLayers[li];
      const lw=layer.width, ox=layer.offsetx||0, oy=layer.offsety||0;
      const name = (layer.name||'').toLowerCase();

      const isFront  = name.includes('front');
      const isWall   = name.includes('wall');
      const isWindow = name.includes('window');
      const isRoof   = ROOF_IDS.has(layer.id) || name.includes('roof');
      const isHouse  = isRoof||isFront||isWall||isWindow;

      for (let i=0;i<layer.data.length;i++) {
        const gid=layer.data[i]; if(!gid) continue;
        const flipH=!!(gid&0x80000000),flipV=!!(gid&0x40000000),flipD=!!(gid&0x20000000);
        const raw=gid&~F_ALL, res=this._resolveGid(raw);
        if(!res||!res.ts.img) continue;
        const dx=(i%lw)*TW+ox, dy=Math.floor(i/lw)*TW+oy;
        const key=`${dx},${dy}`, frames=this._animGidMap.get(raw);
        const maxAnim=posMaxAnim.get(key)??-1;
        const e={ts:res.ts,localId:res.localId,flipH,flipV,flipD,dx,dy,isRoof,isWall,isWindow,isFront};
        if(isHouse) houseClusterTiles.push(e);

        if(frames) {
          (isRoof||isWindow||isWall ? aboveAnimEntries : animEntries).push({...e,frames});
        } else if(isRoof||isWall||isWindow) {
          aboveEntries.push(e);
        } else if(isFront) {
          midEntries.push(e);
        } else {
          (li>maxAnim&&maxAnim!==-1 ? midEntries : belowEntries).push(e);
        }
      }
    }
    return {belowEntries,animEntries,aboveAnimEntries,aboveEntries,midEntries,houseClusterTiles};
  }

  _renderStatic(ctx,entries) { for(const e of entries) this._blitTile(ctx,e,e.localId); }

  _buildYSprites(aboveEntries, houseClusterTiles) {
    const TW = CFG.TILE_SIZE;
    const GAP = TW * 3;
    
    // O(N) Spatial Hashing avoids startup lag when clustering thousands of tiles
    const clusters = [];
    const visited = new Set();
    const spatial = new Map();
    
    for (const e of houseClusterTiles) spatial.set(`${e.dx},${e.dy}`, e);

    const getNeighbors = (e) => {
      const neighbors = [];
      for (let nx = e.dx - GAP; nx <= e.dx + GAP; nx += TW) {
        for (let ny = e.dy - GAP; ny <= e.dy + GAP; ny += TW) {
          const n = spatial.get(`${nx},${ny}`);
          if (n) neighbors.push(n);
        }
      }
      return neighbors;
    };

    for (const e of houseClusterTiles) {
      if (visited.has(e)) continue;
      const cluster = [];
      const queue = [e];
      visited.add(e);

      while (queue.length > 0) {
        const curr = queue.shift();
        cluster.push(curr);
        const neighbors = getNeighbors(curr);
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
      clusters.push(cluster);
    }

    const depth = new Map();
    for (const cl of clusters) {
      const maxDy = cl.reduce((m, e) => Math.max(m, e.dy), -Infinity);
      for (const e of aboveEntries) {
        if (!cl.includes(e)) continue;
        if (e.isRoof) {
          const dist = maxDy - e.dy, interior = e.dy !== maxDy && dist >= TW * 3;
          depth.set(e, interior ? maxDy + TW + 1 : e.dy + 1);
        } else { 
          depth.set(e, e.dy + TW); 
        }
      }
    }
    for (const e of aboveEntries) {
      const k = `ys_${e.ts.firstgid}_${e.localId}_${e.flipH ? 1 : 0}_${e.flipV ? 1 : 0}_${e.flipD ? 1 : 0}`;
      if (!this.textures.exists(k)) {
        const c = document.createElement('canvas'); c.width = TW; c.height = TW;
        const ox = e.dx, oy = e.dy; e.dx = 0; e.dy = 0;
        this._blitTile(c.getContext('2d'), e, e.localId);
        e.dx = ox; e.dy = oy;
        this.textures.addCanvas(k, c);
      }
      this.add.image(e.dx, e.dy, k).setOrigin(0, 0).setDepth(depth.get(e) ?? (e.dy + TW));
    }
  }

  _buildDynamicProps(layers) {
    const F_ALL = 0x80000000|0x40000000|0x20000000;
    const stats = {
      candidates: 0,
      rendered: 0,
      missingDefs: [],
      missingTextures: [],
      layers: [],
    };

    const propLayerNames = [
      'dynamic_props_object',
      'cuttable_trees_object',
      'dynamic_props_top_extenstion', 
      'dynamic_props_right_extention',
      'dynamic_props_left_extention',
    ];

    const objs = [];
    const walk = (arr, px=0, py=0) => {
      for (const l of arr) {
        const ox = px + (l.offsetx || 0);
        const oy = py + (l.offsety || 0);
        if (l.type === 'objectgroup') {
          const lname = (l.name || '').toLowerCase().trim();
          if (propLayerNames.includes(lname)) {
            stats.layers.push(l.name || '');
            for (const o of (l.objects || [])) {
              objs.push({ ...o, x: o.x + ox, y: o.y + oy });
            }
          }
        }
        if (l.layers) walk(l.layers, ox, oy);
      }
    };
    walk(layers);

    for (const o of objs) {
      if (!o.gid) continue;
      stats.candidates++;

      const raw = o.gid & ~F_ALL;
      const def = this._dynPropDefs.get(raw);
      if (!def) {
        stats.missingDefs.push(raw);
        continue;
      }

      if (!this.textures.exists(def.texKey)) {
        stats.missingTextures.push(def.texKey);
        continue;
      }

      const flipH = !!(o.gid & 0x80000000);
      const flipV = !!(o.gid & 0x40000000);

      const h = o.height || def.nativeH || 32;
      const w = o.width  || def.nativeW || 32;

      const isGateArch = def.texKey.includes('Gates_dark_shadow');
      const isBuilding = (w % 32 !== 0 || h % 32 !== 0) && h > 64;
      const depth = isGateArch ? 500
                  : isBuilding ? o.y - h * 0.05
                  :              (h > 32 ? o.y - h * 0.35 : o.y);

      this.add.image(o.x, o.y, def.texKey)
        .setOrigin(0, 1)
        .setDisplaySize(w, h)
        .setDepth(depth)
        .setFlipX(flipH)
        .setFlipY(flipV);
      stats.rendered++;
    }

    stats.missingDefs = Array.from(new Set(stats.missingDefs));
    stats.missingTextures = Array.from(new Set(stats.missingTextures));
    this._dynamicPropStats = stats;
    if (stats.missingDefs.length || stats.missingTextures.length) {
      console.warn('[MAP DECORATION MISSING]', stats);
    }
  }

  _getRawObjLayer(layers, targetName) {
    const out=[], tgt=targetName.toLowerCase().trim();
    const walk=(arr,px=0,py=0)=>{
      for(const l of arr){
        const ox=px+(l.offsetx||0), oy=py+(l.offsety||0);
        if(l.type==='objectgroup'&&l.name?.toLowerCase().trim()===tgt)
          for(const o of(l.objects||[])) out.push({...o,x:o.x+ox,y:o.y+oy});
        if(l.layers) walk(l.layers,ox,oy);
      }
    };
    walk(layers); return out;
  }

  // ── 4. HIGH-PERFORMANCE CAMERA CULLED UPDATER ───────────────────────────
  _updateAnimatedTiles(ms) {
    const px = this._player?.x ?? -9999, py = this._player?.y ?? -9999;
    
    // Use Squared Distances (DIST * DIST) to skip slow Math.sqrt
    const DIST_SQ = { 
      [this._doorFirstgid]: 72 * 72, 
      [this._fenceFirstgid]: 60 * 60, 
      [this._windowFirstgid]: 80 * 80 
    };
    const HALF = this._ANIM_HALF;

    // Camera viewport boundaries + small buffer
    const cam = this.cameras.main.worldView;
    const cullLeft = cam.x - 32, cullRight = cam.right + 32;
    const cullTop = cam.y - 32, cullBottom = cam.bottom + 32;

    for (const tile of this._animatedTiles) {
      const e = tile.entry;
      
      // Camera Culling: Skip processing entirely if off-screen
      if (e.dx < cullLeft || e.dx > cullRight || e.dy < cullTop || e.dy > cullBottom) {
        continue;
      }

      const isGated = e.ts.firstgid === this._doorFirstgid || e.ts.firstgid === this._fenceFirstgid || e.ts.firstgid === this._windowFirstgid;
      let targetFrameLocalId;

      if (!isGated) {
        targetFrameLocalId = this._getAnimFrame(e.frames, ms);
      } else {
        const dt = Math.min(ms - tile.lastMs, 100); 
        tile.lastMs = ms;
        
        // Fast squared distance
        const dx = px - e.dx - 8;
        const dy = py - e.dy - 8;
        const distSq = (dx * dx) + (dy * dy);
        const near = distSq <= (DIST_SQ[e.ts.firstgid] ?? 5184); // 72^2
        
        if (near && tile.state === 'closed') tile.state = 'opening';
        else if (!near && tile.state === 'open') tile.state = 'closing';
        
        if (tile.state === 'opening') { tile.clock = Math.min(tile.clock + dt, HALF); if (tile.clock >= HALF) tile.state = 'open'; }
        else if (tile.state === 'closing') { tile.clock = Math.max(tile.clock - dt, 0); if (tile.clock <= 0) tile.state = 'closed'; }
        
        targetFrameLocalId = this._getAnimFrame(e.frames, tile.clock);
      }

      const frameKey = this._getTileFrame(e.ts, targetFrameLocalId);
      if (tile.img.frame.name !== frameKey) {
        tile.img.setFrame(frameKey);
      }
    }
  }

  _blitTile(ctx,e,localId){
    const TW=CFG.TILE_SIZE,sx=(localId%e.ts.cols)*TW,sy=Math.floor(localId/e.ts.cols)*TW;
    if(!e.flipH&&!e.flipV&&!e.flipD){try{ctx.drawImage(e.ts.img,sx,sy,TW,TW,e.dx,e.dy,TW,TW);}catch(_){}return;}
    ctx.save();ctx.translate(e.dx+TW/2,e.dy+TW/2);
    if(e.flipD){ctx.rotate(Math.PI/2);if(!e.flipH&&!e.flipV)ctx.scale(-1,1);else if(e.flipH&&e.flipV)ctx.scale(1,1);else if(e.flipH)ctx.scale(1,-1);else ctx.scale(-1,1);}
    else{if(e.flipH)ctx.scale(-1,1);if(e.flipV)ctx.scale(1,-1);}
    try{ctx.drawImage(e.ts.img,sx,sy,TW,TW,-TW/2,-TW/2,TW,TW);}catch(_){}
    ctx.restore();
  }

  _getAnimFrame(frames,ms){
    const tot=frames.reduce((s,f)=>s+f.duration,0);let t=ms%tot;
    for(const f of frames){if(t<f.duration)return f.tileid;t-=f.duration;}
    return frames[0].tileid;
  }

  _makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

  // 1D Greedy Meshing for Static Bodies
  _buildCollisions(layers) {
    const group = this.physics.add.staticGroup();
    const walk = (arr, px = 0, py = 0) => {
      for (const l of arr) {
        const ox = px + (l.offsetx || 0), oy = py + (l.offsety || 0);
        
        if (l.name && l.name.toLowerCase().includes('collision')) {
          if (l.type === 'objectgroup') {
            for (const o of (l.objects || [])) {
              const w = o.width || CFG.TILE_SIZE, h = o.height || CFG.TILE_SIZE;
              let fy = o.y; 
              if (o.gid) fy -= h;
              const r = this.add.rectangle(o.x + ox + w / 2, fy + oy + h / 2, w, h).setVisible(false);
              this.physics.add.existing(r, true); 
              group.add(r);
            }
          } else if (l.type === 'tilelayer') {
            const lw = l.width;
            const lh = l.height || (l.data.length / lw);
            const TW = CFG.TILE_SIZE;
            
            for (let y = 0; y < lh; y++) {
              let startX = -1;
              let mergeCount = 0;

              for (let x = 0; x < lw; x++) {
                const idx = y * lw + x;
                const hasTile = l.data[idx];

                if (hasTile) {
                  if (startX === -1) startX = x;
                  mergeCount++;
                } else if (startX !== -1) {
                  const bw = mergeCount * TW;
                  const rx = startX * TW + ox + bw / 2;
                  const ry = y * TW + oy + TW / 2;
                  
                  const r = this.add.rectangle(rx, ry, bw, TW).setVisible(false);
                  this.physics.add.existing(r, true);
                  group.add(r);
                  
                  startX = -1;
                  mergeCount = 0;
                }
              }
              if (startX !== -1) {
                const bw = mergeCount * TW;
                const rx = startX * TW + ox + bw / 2;
                const ry = y * TW + oy + TW / 2;
                const r = this.add.rectangle(rx, ry, bw, TW).setVisible(false);
                this.physics.add.existing(r, true);
                group.add(r);
              }
            }
          }
        }
        if (l.layers) walk(l.layers, ox, oy);
      }
    };
    walk(layers);
    this._collisionGroup = group;
    this.physics.add.collider(this._player.sprite, group);
    return group;
  }

  _getObjLayer(layers, targetName) {
    const out=[], tgt=targetName.toLowerCase().trim();
    const walk=(arr,px=0,py=0)=>{
      for(const l of arr){
        const ox=px+(l.offsetx||0),oy=py+(l.offsety||0);
        if(l.type==='objectgroup'&&l.name?.toLowerCase().trim()===tgt){
          for(const o of(l.objects||[])){
            const w=o.width||CFG.TILE_SIZE,h=o.height||CFG.TILE_SIZE;
            let fy=o.y;if(o.gid)fy-=h;
            let type=o.type||'';
            if(!type&&o.properties){const p=o.properties.find(p=>p.name==='type');if(p)type=p.value;}
            out.push({x:o.x+ox,y:fy+oy,w,h,name:o.name||'',type,gid:o.gid||0});
          }
        }
        if(l.layers)walk(l.layers,ox,oy);
      }
    };
    walk(layers);return out;
  }

  _getBedPositions(){
    const tl=this._tileLayers.find(l=>l.name==='beds');
    if(!tl)return[];
    const jd=this.cache.json.get('mapjson');
    const lw=tl.width||jd.width,ox=tl.offsetx||0,oy=tl.offsety||0;
    const F_ALL=0x80000000|0x40000000|0x20000000;
    const soilTs=jd.tilesets.find(t=>t.name==='ground_grass_bricks');
    if(!soilTs)return[];
    const si=jd.tilesets.indexOf(soilTs);
    const nf=si+1<jd.tilesets.length?jd.tilesets[si+1].firstgid:Infinity;
    const pos=[];
    for(let i=0;i<tl.data.length;i++){
      const gid=tl.data[i];if(!gid)continue;
      const raw=gid&~F_ALL;
      if(raw>=soilTs.firstgid&&raw<nf){
        pos.push({x:(i%lw)*16+ox+8,y:Math.floor(i/lw)*16+oy+8});
      }
    }
    return pos;
  }
}
