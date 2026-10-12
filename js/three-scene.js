/**
 * SmartStand — three-scene.js
 * ---------------------------------------------------------------------------
 * Procedural Three.js product scene (smartphone on an adjustable stand).
 * Requires the global `THREE` (r149 UMD build, vendored in assets/vendor/).
 *
 * Public API (window.SmartStandScene):
 *   create(canvas, options) -> controller | null
 *     options: { variant: 'hero' | 'product', stage: HTMLElement,
 *                onFallback(reason), onUserRotate() }
 *   controller: { reset(), setView(name), setTilt(deg), getTilt(),
 *                 setTheme(isDark), dispose() }
 *   webglAvailable() -> boolean
 *
 * Nothing here is required for the rest of the site to work: if THREE or WebGL
 * is missing, create() returns null and calls options.onFallback().
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Feature detection                                                   */
  /* ------------------------------------------------------------------ */
  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return false;
      var lose = gl.getExtension && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Geometry helpers                                                    */
  /* ------------------------------------------------------------------ */
  function roundedRect(T, w, h, r) {
    var s = new T.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  /**
   * Rounded, bevelled slab lying in the XY plane, centred on the origin.
   * Total outline = w x h. Total thickness (Z) = depth + 2 * bevel.
   */
  function slab(T, w, h, r, depth, bevel, mat) {
    var b = bevel;
    var iw = Math.max(w - 2 * b, 0.01);
    var ih = Math.max(h - 2 * b, 0.01);
    var ir = Math.max(Math.min(r - b, Math.min(iw, ih) / 2 - 0.001), 0.005);
    var geo = new T.ExtrudeGeometry(roundedRect(T, iw, ih, ir), {
      depth: depth,
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 3,
      curveSegments: 14,
      steps: 1
    });
    geo.translate(0, 0, -depth / 2);
    var m = new T.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function cylinder(T, rTop, rBot, len, mat, segs) {
    var m = new T.Mesh(new T.CylinderGeometry(rTop, rBot, len, segs || 32), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Phone screen texture (drawn on a 2D canvas, no external assets)     */
  /* ------------------------------------------------------------------ */
  function rrPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawScreen(ctx, w, h) {
    var sans = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
    var display = '"Space Grotesk", "Inter", system-ui, sans-serif';

    var g = ctx.createLinearGradient(0, 0, w * 0.9, h);
    g.addColorStop(0, '#0a0f1d');
    g.addColorStop(0.5, '#142a63');
    g.addColorStop(1, '#2c64f5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(w * 0.8, h * 0.18, 10, w * 0.8, h * 0.18, w * 0.9);
    glow.addColorStop(0, 'rgba(140,175,255,0.35)');
    glow.addColorStop(1, 'rgba(140,175,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Front camera punch-hole
    ctx.fillStyle = '#05070c';
    ctx.beginPath();
    ctx.arc(w / 2, 44, 14, 0, Math.PI * 2);
    ctx.fill();

    // Status bar
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 24px ' + sans;
    ctx.textAlign = 'left';
    ctx.fillText('9:41', 44, 56);
    rrPath(ctx, w - 100, 40, 48, 22, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    rrPath(ctx, w - 96, 44, 34, 14, 3);
    ctx.fill();

    // Clock + date
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 150px ' + display;
    ctx.fillText('9:41', w / 2, 270);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '500 28px ' + sans;
    ctx.fillText('Monday, 12 October', w / 2, 322);

    // Widgets
    function widget(x, y, ww, hh, title, sub, accent) {
      rrPath(ctx, x, y, ww, hh, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + 36, y + 40, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = '600 28px ' + sans;
      ctx.fillText(title, x + 58, y + 50);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '500 24px ' + sans;
      ctx.fillText(sub, x + 28, y + hh - 28);
    }
    widget(36, 400, w - 72, 118, 'Online class', 'Starts at 10:00', '#7fb0ff');
    widget(36, 540, (w - 88) / 2, 118, 'Video call', 'Team sync', '#6ee7b7');
    widget(52 + (w - 88) / 2, 540, (w - 88) / 2, 118, 'Recipe', 'Step 3 of 6', '#fcd34d');

    // App grid
    var cols = ['#ffffff', '#c9ced6', '#7fb0ff', '#ffffff', '#a5b4fc', '#ffffff', '#c9ced6', '#7fb0ff'];
    for (var i = 0; i < 8; i++) {
      var cx = 56 + (i % 4) * ((w - 112) / 3.2);
      var cy = 720 + Math.floor(i / 4) * 130;
      rrPath(ctx, cx, cy, 86, 86, 24);
      ctx.fillStyle = cols[i];
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Dock
    rrPath(ctx, 28, h - 150, w - 56, 108, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    for (var j = 0; j < 4; j++) {
      rrPath(ctx, 56 + j * ((w - 112) / 3.2), h - 134, 76, 76, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }

    // Home indicator + soft diagonal glare
    rrPath(ctx, w / 2 - 70, h - 26, 140, 6, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    var glare = ctx.createLinearGradient(0, 0, w, h * 0.55);
    glare.addColorStop(0, 'rgba(255,255,255,0.16)');
    glare.addColorStop(0.45, 'rgba(255,255,255,0.03)');
    glare.addColorStop(0.46, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, w, h);
  }

  /* ------------------------------------------------------------------ */
  /* Product model                                                       */
  /* ------------------------------------------------------------------ */
  var FEET = 0.05;            // rubber feet height
  var BASE_T = 0.16;          // base thickness
  var TOP = FEET + BASE_T;    // base top surface (y)
  var PIVOT_Z = 0.15;         // hinge position along z
  var DEFAULT_TILT = 22;      // degrees from vertical

  function buildProduct(T) {
    var mats = {
      alu: new T.MeshStandardMaterial({ color: 0xd2d7de, metalness: 1.0, roughness: 0.28 }),
      graphite: new T.MeshStandardMaterial({ color: 0x252b35, metalness: 0.85, roughness: 0.38 }),
      rubber: new T.MeshStandardMaterial({ color: 0x14171c, metalness: 0.0, roughness: 0.92 }),
      blue: new T.MeshStandardMaterial({ color: 0x2c64f5, metalness: 0.55, roughness: 0.3 }),
      phone: new T.MeshStandardMaterial({ color: 0x1c2029, metalness: 0.92, roughness: 0.26 }),
      lens: new T.MeshStandardMaterial({ color: 0x07090d, metalness: 0.7, roughness: 0.12 })
    };

    var root = new T.Group();
    root.name = 'smartstand-product';

    /* --- Base ------------------------------------------------------- */
    var base = slab(T, 2.6, 2.4, 0.26, 0.1, 0.03, mats.alu);
    base.rotation.x = -Math.PI / 2;
    base.position.y = FEET + BASE_T / 2;
    root.add(base);

    [[-1.0, -0.9], [1.0, -0.9], [-1.0, 0.9], [1.0, 0.9]].forEach(function (p) {
      var foot = cylinder(T, 0.1, 0.1, FEET, mats.rubber, 24);
      foot.position.set(p[0], FEET / 2, p[1]);
      root.add(foot);
    });

    var pad = slab(T, 1.9, 1.0, 0.14, 0.012, 0.004, mats.rubber);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, TOP + 0.01, 0.62);
    root.add(pad);

    /* --- Hinge ------------------------------------------------------ */
    var hingeBlock = slab(T, 1.9, 0.5, 0.06, 0.06, 0.015, mats.graphite);
    hingeBlock.rotation.x = -Math.PI / 2;
    hingeBlock.position.set(0, TOP + 0.045, PIVOT_Z);
    root.add(hingeBlock);

    var barrel = cylinder(T, 0.11, 0.11, 1.7, mats.alu, 40);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0, TOP + 0.11, PIVOT_Z);
    root.add(barrel);

    [-1, 1].forEach(function (s) {
      var cap = cylinder(T, 0.125, 0.125, 0.07, mats.blue, 40);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(s * 0.885, TOP + 0.11, PIVOT_Z);
      root.add(cap);
    });

    /* --- Tilting assembly (plate + cradle + phone) ------------------ */
    var tilt = new T.Group();
    tilt.position.set(0, TOP + 0.11, PIVOT_Z);
    root.add(tilt);

    var plate = slab(T, 1.5, 2.4, 0.14, 0.07, 0.015, mats.graphite);
    plate.position.set(0, 1.15, -0.03);
    tilt.add(plate);

    var mark = slab(T, 0.7, 0.07, 0.03, 0.01, 0.004, mats.blue);
    mark.position.set(0, 1.9, -0.092);
    tilt.add(mark);

    var tray = slab(T, 1.5, 0.3, 0.06, 0.04, 0.01, mats.alu);
    tray.rotation.x = -Math.PI / 2;
    tray.position.set(0, 0.11, 0.13);
    tilt.add(tray);

    var lip = slab(T, 1.5, 0.24, 0.07, 0.04, 0.015, mats.alu);
    lip.position.set(0, 0.2, 0.25);
    tilt.add(lip);

    var lipStripe = slab(T, 1.2, 0.04, 0.015, 0.006, 0.003, mats.blue);
    lipStripe.position.set(0, 0.2, 0.292);
    tilt.add(lipStripe);

    /* --- Smartphone ------------------------------------------------- */
    var phone = new T.Group();
    phone.position.set(0, 1.69, 0.1);
    tilt.add(phone);

    var body = slab(T, 1.52, 3.1, 0.26, 0.1, 0.03, mats.phone);
    phone.add(body);

    var tex = null;
    var screenGeo = new T.ShapeGeometry(roundedRect(T, 1.42, 3.0, 0.22), 14);
    (function normaliseUV(g) {
      var p = g.attributes.position, uv = g.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        uv.setXY(i, (p.getX(i) + 0.71) / 1.42, (p.getY(i) + 1.5) / 3.0);
      }
      uv.needsUpdate = true;
    })(screenGeo);

    var cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 1082;
    var ctx = cv.getContext('2d');
    if (ctx) {
      drawScreen(ctx, cv.width, cv.height);
      tex = new T.CanvasTexture(cv);
      tex.encoding = T.sRGBEncoding;
      tex.anisotropy = 4;
    }
    var screen = new T.Mesh(
      screenGeo,
      new T.MeshBasicMaterial(tex ? { map: tex, toneMapped: false } : { color: 0x142a63, toneMapped: false })
    );
    screen.position.z = 0.0815;
    phone.add(screen);

    function redrawScreen() {
      if (!ctx || !tex) return;
      drawScreen(ctx, cv.width, cv.height);
      tex.needsUpdate = true;
    }

    // Rear camera module (visible from the back view)
    var bump = slab(T, 0.56, 0.56, 0.15, 0.03, 0.01, mats.graphite);
    bump.position.set(-0.42, 1.17, -0.1);
    phone.add(bump);
    [[-0.54, 1.29], [-0.54, 1.05], [-0.3, 1.17]].forEach(function (p) {
      var ring = cylinder(T, 0.1, 0.1, 0.04, mats.alu, 32);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p[0], p[1], -0.118);
      phone.add(ring);
      var lens = cylinder(T, 0.07, 0.07, 0.046, mats.lens, 32);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(p[0], p[1], -0.12);
      phone.add(lens);
    });

    // Side buttons
    [[0.77, 0.55, 0.5], [-0.77, 0.75, 0.28], [-0.77, 0.35, 0.28]].forEach(function (b) {
      var btn = new T.Mesh(new T.BoxGeometry(0.03, b[2], 0.06), mats.phone);
      btn.position.set(b[0], b[1], 0);
      btn.castShadow = true;
      phone.add(btn);
    });

    /* --- Support struts (retarget as the tilt angle changes) -------- */
    var UP = new T.Vector3(0, 1, 0);
    var struts = [];
    [-0.5, 0.5].forEach(function (x) {
      var a = new T.Vector3(x, TOP + 0.07, -1.05);
      var bLocal = new T.Vector3(x, 1.0, -0.09);

      var rod = cylinder(T, 0.035, 0.035, 1, mats.alu, 16);
      root.add(rod);

      var knobA = cylinder(T, 0.065, 0.065, 0.14, mats.blue, 24);
      knobA.rotation.z = Math.PI / 2;
      knobA.position.copy(a);
      root.add(knobA);

      var knobB = cylinder(T, 0.065, 0.065, 0.14, mats.blue, 24);
      knobB.rotation.z = Math.PI / 2;
      knobB.position.copy(bLocal);
      tilt.add(knobB);

      struts.push({ rod: rod, a: a, bLocal: bLocal });
    });

    var tmpB = new T.Vector3();
    var dir = new T.Vector3();
    function applyTilt(rad) {
      tilt.rotation.x = -rad;
      tilt.updateMatrix();
      struts.forEach(function (s) {
        tmpB.copy(s.bLocal).applyMatrix4(tilt.matrix);
        dir.subVectors(tmpB, s.a);
        var len = dir.length();
        s.rod.position.copy(s.a).addScaledVector(dir, 0.5);
        s.rod.quaternion.setFromUnitVectors(UP, dir.normalize());
        s.rod.scale.set(1, len, 1);
      });
    }
    applyTilt(DEFAULT_TILT * Math.PI / 180);

    /* --- Soft contact shadow (ambient-occlusion stand-in) ----------- */
    var bc = document.createElement('canvas');
    bc.width = bc.height = 256;
    var bctx = bc.getContext('2d');
    var rg = bctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    rg.addColorStop(0, 'rgba(0,0,0,0.55)');
    rg.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = rg;
    bctx.fillRect(0, 0, 256, 256);
    var blobTex = new T.CanvasTexture(bc);
    var blob = new T.Mesh(
      new T.PlaneGeometry(5.0, 4.6),
      new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.003;
    root.add(blob);

    return { root: root, applyTilt: applyTilt, redrawScreen: redrawScreen };
  }

  /* ------------------------------------------------------------------ */
  /* Procedural studio environment (reflections for the metals)          */
  /* ------------------------------------------------------------------ */
  function makeEnvironment(T, renderer) {
    var envScene = new T.Scene();
    var geo = new T.SphereGeometry(30, 32, 16);
    var pos = geo.attributes.position;
    var top = new T.Color(0x9aa6bb), bot = new T.Color(0x1d222b), c = new T.Color(), cols = [];
    for (var i = 0; i < pos.count; i++) {
      var t = (pos.getY(i) / 30 + 1) / 2;
      c.copy(bot).lerp(top, Math.pow(t, 0.8));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    envScene.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));

    function panel(w, h, p, rgb) {
      var m = new T.MeshBasicMaterial({ side: T.DoubleSide });
      m.color.setRGB(rgb[0], rgb[1], rgb[2]);
      var mesh = new T.Mesh(new T.PlaneGeometry(w, h), m);
      mesh.position.set(p[0], p[1], p[2]);
      mesh.lookAt(0, 1.5, 0);
      envScene.add(mesh);
    }
    panel(14, 9, [-14, 14, 12], [7, 7, 7]);        // key softbox
    panel(3, 16, [16, 6, -8], [2.2, 4.0, 9.0]);    // electric-blue rim strip
    panel(18, 18, [0, 26, 0], [2.2, 2.2, 2.4]);    // overhead fill
    panel(10, 5, [10, 3, 14], [2.5, 2.5, 2.5]);    // front-right fill

    var pm = new T.PMREMGenerator(renderer);
    var rt = pm.fromScene(envScene, 0.03);
    pm.dispose();
    envScene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    return rt;
  }

  /* ------------------------------------------------------------------ */
  /* Scene controller                                                    */
  /* ------------------------------------------------------------------ */
  var VIEWS = {
    angle: { yaw: -0.5, pitch: 0.03 },
    front: { yaw: 0, pitch: 0.02 },
    side: { yaw: -Math.PI / 2, pitch: 0.02 },
    back: { yaw: Math.PI, pitch: 0.04 }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function create(canvas, opts) {
    opts = opts || {};
    var T = global.THREE;
    function bail(reason) {
      if (typeof opts.onFallback === 'function') opts.onFallback(reason);
      return null;
    }
    if (!T) return bail('three-missing');
    if (!webglAvailable()) return bail('webgl-unavailable');

    var small = Math.min(global.innerWidth, global.innerHeight) < 700 || (navigator.hardwareConcurrency || 4) <= 4;
    var pixelCap = small ? 1.5 : 2;

    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (err) {
      return bail('renderer-failed');
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, pixelCap));

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    var target = new T.Vector3(0, 1.75, 0);

    var envRT = null;
    try {
      envRT = makeEnvironment(T, renderer);
      scene.environment = envRT.texture;
    } catch (err) { envRT = null; }

    scene.add(new T.HemisphereLight(0xffffff, 0x8892a6, envRT ? 0.25 : 0.9));

    var key = new T.DirectionalLight(0xffffff, envRT ? 1.25 : 2.0);
    key.position.set(3.5, 9, 6);
    key.castShadow = true;
    var sm = small ? 1024 : 2048;
    key.shadow.mapSize.set(sm, sm);
    key.shadow.camera.left = -4.5;
    key.shadow.camera.right = 4.5;
    key.shadow.camera.top = 4.5;
    key.shadow.camera.bottom = -4.5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 24;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    var rim = new T.DirectionalLight(0x5b8cff, 0.7);
    rim.position.set(-6, 3, -6);
    scene.add(rim);

    var ground = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    var product = buildProduct(T);
    var rig = product.root;
    scene.add(rig);

    /* --- State ------------------------------------------------------ */
    var isHero = opts.variant !== 'product';
    var start = isHero ? { yaw: -0.42, pitch: 0.03 } : VIEWS.angle;
    var home = { yaw: start.yaw, pitch: start.pitch };
    var cur = { yaw: home.yaw, pitch: home.pitch };
    var tgt = { yaw: home.yaw, pitch: home.pitch };
    var par = { x: 0, y: 0, tx: 0, ty: 0 };
    var tilt = DEFAULT_TILT * Math.PI / 180, tiltTarget = tilt;
    var swayAmp = isHero ? 0.14 : 0.1;

    var reduceMQ = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(reduceMQ && reduceMQ.matches);
    var dragging = false, drag = null;
    var visible = true, disposed = false, raf = 0, last = 0;
    var stage = opts.stage || canvas.parentElement || canvas;

    /* --- Sizing ----------------------------------------------------- */
    function fitCamera() {
      var vf = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      var dH = 4.9 / vf;
      var dW = 4.3 / (vf * camera.aspect);
      var d = Math.max(dH, dW);
      var elev = 0.16;
      camera.position.set(0, target.y + Math.sin(elev) * d, Math.cos(elev) * d);
      camera.lookAt(target);
    }
    function resize() {
      if (disposed) return;
      var rect = stage.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, pixelCap));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitCamera();
      schedule();
    }

    /* --- Frame loop (pauses off-screen / hidden / idle+reduced) ----- */
    function update(dt, now) {
      var k = reduced ? 1 : 1 - Math.pow(0.0008, dt);
      if (!dragging) {
        var sway = reduced ? 0 : Math.sin(now * 0.00045) * swayAmp;
        var pk = reduced ? 0 : 1;
        tgt.yaw = home.yaw + sway + par.x * 0.3 * pk;
        tgt.pitch = home.pitch + par.y * 0.08 * pk;
      }
      par.x += (par.tx - par.x) * k;
      par.y += (par.ty - par.y) * k;
      cur.yaw += (tgt.yaw - cur.yaw) * k;
      cur.pitch += (tgt.pitch - cur.pitch) * k;
      tilt += (tiltTarget - tilt) * k;
      rig.rotation.y = cur.yaw;
      rig.rotation.x = cur.pitch;
      product.applyTilt(tilt);
      return Math.abs(tgt.yaw - cur.yaw) > 0.0004 || Math.abs(tgt.pitch - cur.pitch) > 0.0004 ||
        Math.abs(tiltTarget - tilt) > 0.0004 || Math.abs(par.tx - par.x) > 0.001 || Math.abs(par.ty - par.y) > 0.001;
    }
    function frame(now) {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      var dt = Math.min((now - last) / 1000 || 0.016, 0.05);
      last = now;
      var moving = update(dt, now);
      renderer.render(scene, camera);
      if (!reduced || moving || dragging) schedule();
    }
    function schedule() {
      if (raf || disposed || !visible || document.hidden) return;
      last = performance.now();
      raf = global.requestAnimationFrame(frame);
    }

    /* --- Input ------------------------------------------------------ */
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      drag = { x: e.clientX, y: e.clientY, yaw: tgt.yaw, pitch: tgt.pitch };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      canvas.classList.add('is-dragging');
      schedule();
    }
    function onMove(e) {
      if (!dragging || !drag) return;
      tgt.yaw = drag.yaw + (e.clientX - drag.x) * 0.0085;
      tgt.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, -0.3, 0.35);
      schedule();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      home.yaw = tgt.yaw;
      home.pitch = tgt.pitch;
      canvas.classList.remove('is-dragging');
      if (typeof opts.onUserRotate === 'function') opts.onUserRotate();
      schedule();
    }
    function onStageMove(e) {
      if (e.pointerType !== 'mouse' || dragging) return;
      var r = stage.getBoundingClientRect();
      par.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      par.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      schedule();
    }
    function onStageLeave() { par.tx = 0; par.ty = 0; schedule(); }
    function onKey(e) {
      var handled = true;
      switch (e.key) {
        case 'ArrowLeft': home.yaw -= 0.2; break;
        case 'ArrowRight': home.yaw += 0.2; break;
        case 'ArrowUp': home.pitch = clamp(home.pitch - 0.06, -0.3, 0.35); break;
        case 'ArrowDown': home.pitch = clamp(home.pitch + 0.06, -0.3, 0.35); break;
        case 'Home': case 'Escape': controller.reset(); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        if (typeof opts.onUserRotate === 'function') opts.onUserRotate();
        schedule();
      }
    }
    function onContextLost(e) {
      e.preventDefault();
      controller.dispose();
      bail('context-lost');
    }
    function onMQ(e) { reduced = e.matches; schedule(); }
    function onVis() { schedule(); }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('webglcontextlost', onContextLost);
    stage.addEventListener('pointermove', onStageMove);
    stage.addEventListener('pointerleave', onStageLeave);
    document.addEventListener('visibilitychange', onVis);
    if (reduceMQ && reduceMQ.addEventListener) reduceMQ.addEventListener('change', onMQ);

    var ro = null, io = null;
    if (global.ResizeObserver) {
      ro = new ResizeObserver(resize);
      ro.observe(stage);
    } else {
      global.addEventListener('resize', resize);
    }
    if (global.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) schedule();
      }, { threshold: 0.01 });
      io.observe(stage);
    }

    // Re-draw the screen texture once web fonts are available.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!disposed) { product.redrawScreen(); schedule(); }
      });
    }

    /* --- Controller ------------------------------------------------- */
    var controller = {
      reset: function () {
        home.yaw = start.yaw;
        home.pitch = start.pitch;
        tiltTarget = DEFAULT_TILT * Math.PI / 180;
        schedule();
      },
      setView: function (name) {
        var v = VIEWS[name];
        if (!v) return;
        home.yaw = v.yaw;
        home.pitch = v.pitch;
        schedule();
      },
      setTilt: function (deg) {
        tiltTarget = clamp(deg, 8, 36) * Math.PI / 180;
        schedule();
      },
      getTilt: function () { return Math.round(tiltTarget * 180 / Math.PI); },
      setTheme: function (dark) {
        renderer.toneMappingExposure = dark ? 0.85 : 1.0;
        ground.material.opacity = dark ? 0.45 : 0.2;
        schedule();
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        if (raf) global.cancelAnimationFrame(raf);
        raf = 0;
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('keydown', onKey);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        stage.removeEventListener('pointermove', onStageMove);
        stage.removeEventListener('pointerleave', onStageLeave);
        document.removeEventListener('visibilitychange', onVis);
        if (reduceMQ && reduceMQ.removeEventListener) reduceMQ.removeEventListener('change', onMQ);
        if (ro) ro.disconnect(); else global.removeEventListener('resize', resize);
        if (io) io.disconnect();
        scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            var list = Array.isArray(o.material) ? o.material : [o.material];
            list.forEach(function (m) {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
        if (envRT) envRT.dispose();
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };

    resize();
    schedule();
    return controller;
  }

  global.SmartStandScene = { create: create, webglAvailable: webglAvailable, buildProduct: buildProduct };
})(window);
