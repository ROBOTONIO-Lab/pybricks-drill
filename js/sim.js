/* ROBOTONIO — Pybricks drill simulator
 * sim.js: πίστα, φυσική ρομπότ, αποστολές, γέφυρα Pybricks -> Skulpt.
 * Δεν εξαρτάται από το DOM (τρέχει και σε node για δοκιμές).
 */
(function (root) {
  "use strict";

  // ───────────────────────── Ρομπότ (ΑΛΛΑΞΕ ΕΔΩ τη διαμόρφωση) ─────────────────────────
  const ROBOT = {
    wheelDiameter: 56,   // mm
    axleTrack: 112,      // mm (απόσταση μεταξύ τροχών)
    sensorForward: 60,   // mm μπροστά από τον άξονα
    sensorSide: 24,      // mm αριστερά/δεξιά από το κέντρο
    spotRadius: 6,       // mm, «μάτι» αισθητήρα
    prongLength: 45,     // mm, εξοχή μπροστά από κάθε αισθητήρα
    driftRight: 0.01,    // ο δεξιός τροχός «χάνει» 1% (το ρομπότ δεν πάει τελείως ευθεία χωρίς γυροσκόπιο)
    turnScrub: 0.08,     // ολίσθηση στις στροφές: χωρίς γυροσκόπιο το turn(90) βγαίνει ~83°
    motorTau: 60,        // ms, αδράνεια μοτέρ
    maxMotorSpeed: 1000, // deg/s
    ports: {
      A: { type: "motor", side: "left" },   // τοποθετημένο καθρεφτισμένα
      B: { type: "motor", side: "right" },
      C: { type: "color", side: "left" },
      D: { type: "color", side: "right" }
    }
  };

  const RGB = {
    WHITE: [243, 243, 238], BLACK: [26, 26, 30], RED: [214, 40, 40], GREEN: [0, 146, 70],
    BLUE: [0, 92, 200], YELLOW: [250, 205, 0], ORANGE: [255, 140, 0], CYAN: [0, 190, 210], VIOLET: [130, 60, 220], MAGENTA: [220, 40, 200], TABLE: [150, 130, 105]
  };

  // ───────────────────────── Γεωμετρία πίστας ─────────────────────────
  function buildPath(ctrl) {
    // Catmull-Rom μέσα από τα σημεία ελέγχου, μετά αναδειγματοληψία ανά 2 mm
    const P = [ctrl[0]].concat(ctrl, [ctrl[ctrl.length - 1]]);
    const dense = [];
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      for (let k = 0; k < 60; k++) {
        const t = k / 60, t2 = t * t, t3 = t2 * t;
        dense.push([0, 1].map(a => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t +
          (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
      }
    }
    dense.push(ctrl[ctrl.length - 1].slice());
    const pts = [dense[0]]; let carry = 0;
    for (let i = 1; i < dense.length; i++) {
      let a = dense[i - 1]; const b = dense[i];
      let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (carry + seg >= 2) {
        const f = (2 - carry) / seg;
        a = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        pts.push(a); seg = Math.hypot(b[0] - a[0], b[1] - a[1]); carry = 0;
      }
      carry += seg;
    }
    return { pts, length: (pts.length - 1) * 2 };
  }

  function makeMat(def) {
    const path = def.line ? buildPath(def.line) : null;
    const pts = path ? path.pts : [];
    const rect = def.rect || null;
    const at = s => {
      const i = Math.max(0, Math.min(pts.length - 2, Math.floor(s / 2)));
      const a = pts[i], b = pts[i + 1];
      const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const f = s / 2 - i;
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, th };
    };
    const marks = (def.marks || []).map(m => {
      const s = m.s < 0 ? path.length + m.s : m.s;
      return Object.assign({}, m, { s, c: at(s) });
    });
    function nearest(x, y) {
      let best = 1e18, bi = 0;
      for (let i = 0; i < pts.length; i++) {
        const dx = pts[i][0] - x, dy = pts[i][1] - y, d = dx * dx + dy * dy;
        if (d < best) { best = d; bi = i; }
      }
      let d = Math.sqrt(best), s = bi * 2;
      for (const j of [bi - 1, bi]) {          // ακριβής προβολή στα γειτονικά τμήματα
        if (j < 0 || j >= pts.length - 1) continue;
        const a = pts[j], b = pts[j + 1];
        const ux = b[0] - a[0], uy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (y - a[1]) * uy) / (ux * ux + uy * uy)));
        const dd = Math.hypot(x - a[0] - ux * t, y - a[1] - uy * t);
        if (dd <= d) { d = dd; s = (j + t) * 2; }
      }
      return { d, s };
    }
    // προσημασμένη απόσταση από τον άξονα της γραμμής του ορθογωνίου (αρνητική = μέσα)
    function rectSd(x, y) {
      const qx = Math.abs(x - rect.cx) - rect.w / 2, qy = Math.abs(y - rect.cy) - rect.h / 2;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
    }
    function rgbAt(x, y, r) {
      if (x < 0 || y < 0 || x > def.width || y > def.height) return RGB.TABLE;
      let d = 1e9;
      if (path) d = nearest(x, y).d;
      if (rect) d = Math.min(d, Math.abs(rectSd(x, y)));
      const hw = def.lineWidth / 2;
      const cl = Math.max(0, Math.min(1, (hw + r - d) / (2 * r)));
      let c = [0, 1, 2].map(k => RGB.WHITE[k] + (RGB.BLACK[k] - RGB.WHITE[k]) * cl);
      for (const m of marks) {
        const dx = x - m.c.x, dy = y - m.c.y, ct = Math.cos(m.c.th), st = Math.sin(m.c.th);
        const u = dx * ct + dy * st, v = -dx * st + dy * ct;
        const sd = Math.max(Math.abs(u) - m.length / 2, Math.abs(v) - m.width / 2);
        const cm = Math.max(0, Math.min(1, (r - sd) / (2 * r)));
        if (cm > 0) c = c.map((q, k) => q + (RGB[m.color][k] - q) * cm);
      }
      return c;
    }
    return { def, width: def.width, height: def.height, lineWidth: def.lineWidth, pts, rect, hasPath: !!path,
             length: path ? path.length : 0, marks, at, nearest, rectSd, rgbAt };
  }

  function classify(rgb) {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
    let h = 0;
    if (dl > 1e-6) {
      if (mx === r) h = ((g - b) / dl) % 6; else if (mx === g) h = (b - r) / dl + 2; else h = (r - g) / dl + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const s = mx === 0 ? 0 : dl / mx, v = mx;
    let name;
    if (v < 0.2) name = "BLACK";
    else if (s < 0.3) name = v >= 0.5 ? "WHITE" : "BLACK";
    else if (h < 25 || h >= 330) name = "RED";
    else if (h < 75) name = "YELLOW";
    else if (h < 170) name = "GREEN";
    else if (h < 270) name = "BLUE";
    else name = "RED";
    return { name, hsv: [Math.round(h), Math.round(s * 100), Math.round(v * 100)],
             reflection: Math.round((rgb[0] + rgb[1] + rgb[2]) / 7.65) };
  }

  // ───────────────────────── Οθόνη 5×5 του hub ─────────────────────────
  const FONT = {
    "0": ".##..|#..#.|#..#.|#..#.|.##..", "1": "..#..|.##..|..#..|..#..|.###.", "2": "###..|...#.|.##..|#....|####.",
    "3": "####.|...#.|..#..|#..#.|.##..", "4": "..##.|.#.#.|#..#.|#####|...#.", "5": "#####|#....|####.|....#|####.",
    "6": "...#.|..#..|.###.|#...#|.###.", "7": "#####|...#.|..#..|.#...|#....", "8": ".###.|#...#|.###.|#...#|.###.",
    "9": ".###.|#...#|.###.|..#..|.#...",
    "A": ".##..|#..#.|####.|#..#.|#..#.", "B": "###..|#..#.|###..|#..#.|###..", "C": ".###.|#....|#....|#....|.###.",
    "D": "###..|#..#.|#..#.|#..#.|###..", "E": "####.|#....|###..|#....|####.", "F": "####.|#....|###..|#....|#....",
    "G": ".###.|#....|#.##.|#..#.|.###.", "H": "#..#.|#..#.|####.|#..#.|#..#.", "I": ".###.|..#..|..#..|..#..|.###.",
    "J": "..###|...#.|...#.|#..#.|.##..", "K": "#..#.|#.#..|##...|#.#..|#..#.", "L": "#....|#....|#....|#....|####.",
    "M": "#...#|##.##|#.#.#|#...#|#...#", "N": "#...#|##..#|#.#.#|#..##|#...#", "O": ".##..|#..#.|#..#.|#..#.|.##..",
    "P": "###..|#..#.|###..|#....|#....", "Q": ".##..|#..#.|#..#.|.##..|..##.", "R": "###..|#..#.|###..|#.#..|#..#.",
    "S": ".###.|#....|.##..|...#.|###..", "T": "#####|..#..|..#..|..#..|..#..", "U": "#..#.|#..#.|#..#.|#..#.|.##..",
    "V": "#...#|#...#|#...#|.#.#.|..#..", "W": "#...#|#...#|#.#.#|##.##|#...#", "X": "#..#.|#..#.|.##..|#..#.|#..#.",
    "Y": "#...#|.#.#.|..#..|..#..|..#..", "Z": "####.|..#..|.#...|#....|####.",
    " ": ".....|.....|.....|.....|.....", "-": ".....|.....|.###.|.....|.....", ".": ".....|.....|.....|.#...|.....",
    ",": ".....|.....|.....|..#..|.#...", ":": ".....|.#...|.....|.#...|.....", "=": ".....|.###.|.....|.###.|.....",
    "+": ".....|..#..|.###.|..#..|.....", "!": ".#...|.#...|.#...|.....|.#...", "?": ".###.|#...#|..##.|.....|..#..",
    ">": ".#...|..#..|...#.|..#..|.#...", "<": "...#.|..#..|.#...|..#..|...#.", "_": ".....|.....|.....|.....|#####"
  };
  const SMALL = ["##|##|##|##|##", ".#|.#|.#|.#|.#", "##|.#|##|#.|##", "##|.#|##|.#|##", "#.|#.|##|.#|.#",
                 "##|#.|##|.#|##", "#.|#.|##|##|##", "##|.#|.#|.#|.#", "##|##|..|##|##", "##|##|##|.#|.#"];
  function glyph(ch) {
    const g = FONT[ch] || FONT[String(ch).toUpperCase()] || FONT["?"], px = [];
    g.split("|").forEach(row => { for (let c = 0; c < 5; c++) px.push(row[c] === "#" ? 100 : 0); });
    return px;
  }
  function numberPixels(n) {       // όπως στο Pybricks: μόνο από -99 έως 99, αλλιώς > ή <
    n = Math.round(n);
    if (n > 99) return glyph(">");
    if (n < -99) return glyph("<");
    const a = Math.abs(n), px = new Array(25).fill(0);
    const put = (d, col) => SMALL[d].split("|").forEach((row, r) => { for (let c = 0; c < 2; c++) if (row[c] === "#") px[r * 5 + col + c] = 100; });
    if (a >= 10) put(Math.floor(a / 10), 0);
    put(a % 10, 3);
    if (n < 0) px[12] = 50;
    return px;
  }

  // ───────────────────────── Φυσική ─────────────────────────
  class Sim {
    constructor(task, rnd) { this.task = task; this.setup(rnd); }
    setup(rnd) {                       // νέο στιγμιότυπο της πρόκλησης (τυχαίες διαστάσεις)
      const b = this.task.build(rnd || Math.random);
      this.mat = makeMat(b.mat); this.start = b.start; this.info = b.info || {};
      this.reset();
    }
    reset() {
      const st = this.start;
      this.x = st.x; this.y = st.y; this.th = st.heading * Math.PI / 180;
      this.th0 = this.th; this.headingZero = 0;
      this.time = 0; this.odo = 0; this.maxDev = 0; this.maxS = 0; this.maxOut = -1e9;
      this.motors = { A: { target: 0, speed: 0, angle: 0, man: null }, B: { target: 0, speed: 0, angle: 0, man: null } };
      this.wDeg = 0; this.vNow = 0;
      this.db = null; this.usedGyro = false;
      this.trail = [[this.x, this.y]]; this._acc = 0;
      this.light = null; this.pixels = new Array(25).fill(0); this.shown = []; this.beepUntil = 0; this.volume = 100;
    }
    stopMotors() { if (this.db) { this.db.active = false; this.db.man = null; } for (const m of [this.motors.A, this.motors.B]) { m.target = 0; m.man = null; } }
    sensorPos(side) {
      const c = Math.cos(this.th), s = Math.sin(this.th), k = side === "left" ? -1 : side === "right" ? 1 : 0;
      return [this.x + ROBOT.sensorForward * c - k * ROBOT.sensorSide * s,
              this.y + ROBOT.sensorForward * s + k * ROBOT.sensorSide * c];
    }
    read(port) {
      const p = this.sensorPos(ROBOT.ports[port].side);
      const rgb = this.mat.rgbAt(p[0], p[1], ROBOT.spotRadius);
      return Object.assign({ rgb }, classify(rgb));
    }
    gyroDeg() { return (this.th - this.th0) * 180 / Math.PI; }
    heading() { return this.gyroDeg() - this.headingZero; }
    dbDistance() { const d = this.db, k = Math.PI * d.wd / 360; return (this.motors[d.lp].angle * d.ld + this.motors[d.rp].angle * d.rd) * k / 2; }
    dbHeading() {      // τι «νομίζει» το DriveBase για τη γωνία του: γυροσκόπιο ή οδομετρία τροχών
      const d = this.db; if (d.gyro) return this.gyroDeg();
      const k = Math.PI * d.wd / 360;
      return (this.motors[d.lp].angle * d.ld - this.motors[d.rp].angle * d.rd) * k / d.at * 180 / Math.PI;
    }
    moving() { return Math.abs(this.motors.A.speed) + Math.abs(this.motors.B.speed) > 8; }
    step(dt) {
      const d = this.db;
      for (const m of [this.motors.A, this.motors.B]) {      // ελιγμοί μεμονωμένου μοτέρ
        if (!m.man) continue;
        if (m.man.type === "time") { if (this.time >= m.man.until) { m.target = 0; m.man = null; } else m.target = m.man.speed; }
        else { const rem = m.man.target - m.angle;
          if (Math.abs(rem) < 1.5) { m.target = 0; m.man = null; } else m.target = Math.sign(rem) * Math.min(m.man.speed, Math.max(10, Math.abs(rem) * 5)); }
      }
      if (d && d.man) {                // ελιγμοί DriveBase: straight / turn / arc
        const mn = d.man; let rem, fin = false;
        if (mn.type === "straight") { rem = mn.target - this.dbDistance(); fin = Math.abs(rem) < 1; d.v = Math.sign(rem) * Math.min(mn.speed, Math.max(25, Math.abs(rem) * 5)); d.w = 0; }
        else if (mn.type === "turn") { rem = mn.target - this.dbHeading(); fin = Math.abs(rem) < 0.7; d.v = 0; d.w = Math.sign(rem) * Math.min(mn.speed, Math.max(15, Math.abs(rem) * 6)); }
        else { rem = mn.byAngle ? (mn.target - this.dbHeading()) * Math.PI / 180 * mn.r : mn.target - this.dbDistance(); fin = Math.abs(rem) < 1;
          d.v = Math.sign(rem) * Math.min(mn.speed, Math.max(25, Math.abs(rem) * 5)); d.w = d.v / mn.r * 180 / Math.PI; }
        if (fin) { d.man = null; d.active = false; this.motors[d.lp].target = 0; this.motors[d.rp].target = 0; }
      }
      if (d && d.active) {             // έλεγχος πορείας του DriveBase, όπως στο Pybricks
        if (d.gyro) this.usedGyro = true;
        d.target += d.w * dt / 1000;
        const wc = d.w + 5 * (d.target - this.dbHeading());
        const k = 360 / (Math.PI * d.wd), diff = wc * Math.PI / 180 * d.at / 2;
        this.motors[d.lp].target = (d.v + diff) * k * d.ld;
        this.motors[d.rp].target = (d.v - diff) * k * d.rd;
      }
      const K = Math.PI * ROBOT.wheelDiameter / 360, a = 1 - Math.exp(-dt / ROBOT.motorTau);
      for (const m of [this.motors.A, this.motors.B]) {
        const tg = Math.max(-ROBOT.maxMotorSpeed, Math.min(ROBOT.maxMotorSpeed, m.target));
        m.speed += (tg - m.speed) * a; m.angle += m.speed * dt / 1000;
      }
      const vl = -this.motors.A.speed * K, vr = this.motors.B.speed * K * (1 - ROBOT.driftRight);   // A είναι καθρεφτισμένο
      const v = (vl + vr) / 2, w = (vl - vr) / ROBOT.axleTrack * (1 - ROBOT.turnScrub);
      this.th += w * dt / 1000; this.wDeg = w * 180 / Math.PI; this.vNow = v;
      this.x += v * Math.cos(this.th) * dt / 1000; this.y += v * Math.sin(this.th) * dt / 1000;
      this.odo += v * dt / 1000; this.time += dt;
      this._acc += dt;
      if (this._acc >= 20) {
        this._acc = 0;
        if (this.mat.hasPath) {
          const p = this.sensorPos("mid"), n = this.mat.nearest(p[0], p[1]);
          if (n.d > this.maxDev) this.maxDev = n.d;
          if (n.d < 80 && n.s > this.maxS) this.maxS = n.s;
        }
        if (this.mat.rect) for (const sd of ["left", "right"]) {
          const p = this.sensorPos(sd), o = this.mat.rectSd(p[0], p[1]);
          if (o > this.maxOut) this.maxOut = o;
        }
        const l = this.trail[this.trail.length - 1];
        if (Math.hypot(l[0] - this.x, l[1] - this.y) > 4) this.trail.push([this.x, this.y]);
      }
    }
    advance(ms) { while (ms > 1e-9) { const d = Math.min(2, ms); this.step(d); ms -= d; } }
  }

  // ───────────────────────── Χρονισμός + API που καλεί η Python ─────────────────────────
  class StopSignal extends Error { constructor() { super("stopped"); this.isStop = true; } }
  class TimeoutSignal extends Error { constructor() { super("timeout"); this.isTimeout = true; } }

  class Runtime {
    constructor(sim, opts) {
      opts = opts || {};
      this.sim = sim; this.speed = opts.speed === undefined ? 1 : opts.speed;
      this.now = opts.now || (() => performance.now());
      this.stopFlag = false; this.timeLimit = sim.task.timeLimit || 60000;
      this.resync();
    }
    resync() { if (isFinite(this.speed)) this.t0 = this.now() - this.sim.time / this.speed; }
    check() {
      if (this.stopFlag) { this.signal = "stop"; throw new StopSignal(); }
      if (this.sim.time > this.timeLimit) { this.signal = "timeout"; throw new TimeoutSignal(); }
    }
    pace() {
      if (!isFinite(this.speed)) return null;
      const ahead = this.sim.time - (this.now() - this.t0) * this.speed;
      if (ahead > 12) return new Promise(r => setTimeout(r, (ahead - 2) / this.speed));
      if (ahead < -60) this.t0 = this.now() - (this.sim.time + 60) / this.speed;
      return null;
    }
    tick(ms) { this.check(); this.sim.advance(ms); return this.pace(); }
    async long(ms) {
      while (ms > 0) { const c = Math.min(ms, 8); ms -= c; const p = this.tick(c); if (p) await p; }
    }
    catchUp() {   // για βρόχους χωρίς καμία κλήση στο ρομπότ
      if (!isFinite(this.speed)) { this.sim.advance(20); return; }
      const behind = (this.now() - this.t0) * this.speed - this.sim.time;
      if (behind > 0) this.sim.advance(Math.min(behind, 80));
    }
    freeMotor(port) { const d = this.sim.db; if (d && (port === d.lp || port === d.rp)) { d.active = false; d.man = null; } }
    startDb() { const d = this.sim.db, M = this.sim.motors; M[d.lp].man = null; M[d.rp].man = null; if (!d.active) { d.target = this.sim.dbHeading(); d.active = true; } return d; }
    after(ms, val) { const p = this.tick(ms); return p ? p.then(() => val) : val; }
    call(name) {
      const a = arguments, sim = this.sim, M = sim.motors;
      switch (name) {
        case "device": { const d = ROBOT.ports[a[1]]; return d ? d.type : null; }
        case "time": return sim.time;
        case "wait": return a[1] <= 8 ? this.after(Math.max(0, a[1]), null) : this.long(a[1]).then(() => null);
        case "run": if (sim.db && (a[1] === sim.db.lp || a[1] === sim.db.rp)) { sim.db.active = false; sim.db.man = null; }
          M[a[1]].man = null; M[a[1]].target = a[2]; return this.after(1, null);
        case "m_time": this.freeMotor(a[1]); M[a[1]].man = { type: "time", speed: a[2], until: sim.time + a[3] }; return this.after(1, null);
        case "m_target": this.freeMotor(a[1]); M[a[1]].man = { type: "angle", speed: Math.max(1, a[2]), target: a[3] }; return this.after(1, null);
        case "m_done": return this.after(1, !M[a[1]].man && Math.abs(M[a[1]].speed) < 8);
        case "db_init": sim.db = { lp: a[1], ld: a[2], rp: a[3], rd: a[4], wd: a[5], at: a[6], gyro: false, active: false, man: null, v: 0, w: 0, target: 0 }; return null;
        case "db_gyro": sim.db.gyro = !!a[1]; sim.db.target = sim.dbHeading(); return null;
        case "db_uses_gyro": return !!(sim.db && sim.db.gyro);
        case "db_state": return this.after(1, [sim.dbDistance(), sim.dbHeading(), sim.vNow, sim.wDeg]);
        case "db_done": return this.after(1, !sim.db.man && !sim.moving());
        case "drive": { const d = this.startDb(); d.man = null; d.v = a[1]; d.w = a[2]; return this.after(1, null); }
        case "db_straight": { const d = this.startDb(); d.man = { type: "straight", target: sim.dbDistance() + a[1], speed: Math.max(1, a[2]) }; return this.after(1, null); }
        case "db_turn": { const d = this.startDb(); d.man = { type: "turn", target: a[2] ? a[1] : sim.dbHeading() + a[1], speed: Math.max(1, a[3]) }; return this.after(1, null); }
        case "db_arc": { const d = this.startDb();
          if (Math.abs(a[1]) < 1) d.man = { type: "turn", target: sim.dbHeading() + (a[2] || 0), speed: 150 };
          else d.man = a[2] !== null && a[2] !== undefined ? { type: "arc", r: a[1], byAngle: true, target: sim.dbHeading() + a[2], speed: Math.max(1, a[4]) }
                                                           : { type: "arc", r: a[1], byAngle: false, target: sim.dbDistance() + a[3], speed: Math.max(1, a[4]) };
          return this.after(1, null); }
        case "db_stop": if (!sim.db) return null; sim.db.active = false; sim.db.man = null; M[sim.db.lp].man = null; M[sim.db.rp].man = null; M[sim.db.lp].target = 0; M[sim.db.rp].target = 0; return this.after(1, null);
        case "moving": return sim.moving();
        case "turn_rate": return sim.wDeg;
        case "angle": return this.after(1, M[a[1]].angle);
        case "speed": return this.after(1, M[a[1]].speed);
        case "color": return this.after(1, sim.read(a[1]).name);
        case "reflection": return this.after(1, sim.read(a[1]).reflection);
        case "hsv": return this.after(1, sim.read(a[1]).hsv);
        case "heading": return this.after(1, sim.heading());
        case "reset_heading": sim.headingZero += sim.heading() - a[1]; return null;
        case "light": sim.light = a[1] || null; return null;
        case "disp_off": sim.pixels = new Array(25).fill(0); return null;
        case "disp_char": sim.pixels = glyph(String(a[1]).charAt(0) || " "); sim.shown.push(String(a[1])); return null;
        case "disp_number": sim.pixels = numberPixels(a[1]); sim.shown.push(String(a[1])); return null;
        case "disp_pixel": if (a[1] >= 0 && a[1] < 5 && a[2] >= 0 && a[2] < 5) sim.pixels[a[1] * 5 + a[2]] = Math.max(0, Math.min(100, a[3])); return null;
        case "disp_text": { sim.shown.push(String(a[1])); const self = this, txt = String(a[1]);
          return (async function () {            // ένας χαρακτήρας τη φορά, όπως στο πραγματικό hub
            for (const ch of txt) { sim.pixels = glyph(ch); await self.long(a[2]); sim.pixels = new Array(25).fill(0); await self.long(a[3]); }
            return null;
          })(); }
        case "beep": sim.beepUntil = sim.time + a[2];      // ήχος: τον παίζει η σελίδα (API.onBeep), εδώ μόνο ο χρόνος
          if (a[1] > 0 && API.onBeep && isFinite(this.speed)) API.onBeep(a[1], a[2] / this.speed, sim.volume);
          return this.long(a[2]).then(() => null);
        case "volume": sim.volume = Math.max(0, Math.min(100, a[1])); return null;
      }
      throw new Error("unknown sim call " + name);
    }
  }

  // ───────────────────────── Βιβλιοθήκη pybricks (Python, τρέχει μέσα στο Skulpt) ─────────────────────────
  const ENODEV = "[Errno 19] ENODEV: A sensor or motor is not connected to the specified port. " +
    "Check the port settings in your script.";
  const PY = {};
  PY["pybricks/__init__.py"] = "";
  PY["umath.py"] = "from math import *\n";
  PY["urandom.py"] = "from random import *\n";
  PY["pybricks/parameters.py"] = `
class _Port:
    def __init__(self, name):
        self.name = name
    def __repr__(self):
        return "Port." + self.name

class Port:
    A = _Port("A")
    B = _Port("B")
    C = _Port("C")
    D = _Port("D")
    E = _Port("E")
    F = _Port("F")

class Direction:
    CLOCKWISE = 1
    COUNTERCLOCKWISE = -1

class Stop:
    COAST = 0
    BRAKE = 1
    HOLD = 2
    NONE = 3
    COAST_SMART = 4

class Button:
    LEFT_MINUS = "LEFT_MINUS"
    LEFT_PLUS = "LEFT_PLUS"
    RIGHT_MINUS = "RIGHT_MINUS"
    RIGHT_PLUS = "RIGHT_PLUS"
    CENTER = "CENTER"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    BLUETOOTH = "BLUETOOTH"
    A = "A"
    B = "B"
    X = "X"
    Y = "Y"
    LB = "LB"
    RB = "RB"
    LJ = "LJ"
    RJ = "RJ"
    GUIDE = "GUIDE"
    MENU = "MENU"
    UPLOAD = "UPLOAD"
    VIEW = "VIEW"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"

class Side:
    TOP = 8
    BOTTOM = 2
    FRONT = 0
    BACK = 5
    LEFT = 4
    RIGHT = 6

class Axis:
    X = "X"
    Y = "Y"
    Z = "Z"

class Color:
    def __init__(self, h=0, s=100, v=100, name=None):
        self.h = h
        self.s = s
        self.v = v
        self._name = name
    def __eq__(self, other):
        if not isinstance(other, Color):
            return False
        return self.h == other.h and self.s == other.s and self.v == other.v
    def __ne__(self, other):
        return not self.__eq__(other)
    def __hash__(self):
        return int(self.h * 10000 + self.s * 100 + self.v)
    def __mul__(self, factor):
        return Color(self.h, self.s, max(0, min(100, self.v * factor)))
    def __rmul__(self, factor):
        return self.__mul__(factor)
    def __rshift__(self, degrees):
        return Color((self.h + degrees) % 360, self.s, self.v)
    def __repr__(self):
        if self._name is not None:
            return "Color." + self._name
        return "Color(h=" + str(self.h) + ", s=" + str(self.s) + ", v=" + str(self.v) + ")"
    def __str__(self):
        return self.__repr__()

Color.RED = Color(0, 100, 100, "RED")
Color.ORANGE = Color(30, 100, 100, "ORANGE")
Color.YELLOW = Color(60, 100, 100, "YELLOW")
Color.GREEN = Color(120, 100, 100, "GREEN")
Color.CYAN = Color(180, 100, 100, "CYAN")
Color.BLUE = Color(240, 100, 100, "BLUE")
Color.VIOLET = Color(270, 100, 100, "VIOLET")
Color.MAGENTA = Color(300, 100, 100, "MAGENTA")
Color.WHITE = Color(0, 0, 100, "WHITE")
Color.GRAY = Color(0, 0, 50, "GRAY")
Color.BLACK = Color(0, 0, 10, "BLACK")
Color.NONE = Color(0, 0, 0, "NONE")
_COLORS = {"RED": Color.RED, "YELLOW": Color.YELLOW, "GREEN": Color.GREEN, "BLUE": Color.BLUE,
           "WHITE": Color.WHITE, "BLACK": Color.BLACK, "NONE": Color.NONE}

def _color_name(color):
    if color is None:
        return None
    if color.v <= 0:
        return None
    if color.s < 30:
        return "WHITE"
    h = color.h % 360
    if h < 20 or h >= 330:
        return "RED"
    if h < 45:
        return "ORANGE"
    if h < 90:
        return "YELLOW"
    if h < 160:
        return "GREEN"
    if h < 210:
        return "CYAN"
    if h < 255:
        return "BLUE"
    if h < 285:
        return "VIOLET"
    return "MAGENTA"

class _Image:
    def __init__(self, rows):
        self.rows = rows
    def __iter__(self):
        return iter(self.rows)
    def __len__(self):
        return len(self.rows)
    def __getitem__(self, i):
        return self.rows[i]
    def __mul__(self, factor):
        return _Image([[max(0, min(100, v * factor)) for v in row] for row in self.rows])
    def __rmul__(self, factor):
        return self.__mul__(factor)
    def __add__(self, other):
        return _Image([[max(0, min(100, self.rows[r][c] + other.rows[r][c])) for c in range(5)] for r in range(5)])

def _img(text):
    return _Image([[100 if ch == "#" else 0 for ch in row] for row in text.split("|")])

class Icon:
    UP = _img("..#..|.###.|#####|.###.|.###.")
    DOWN = _img(".###.|.###.|#####|.###.|..#..")
    LEFT = _img("..#..|.####|#####|.####|..#..")
    RIGHT = _img("..#..|####.|#####|####.|..#..")
    ARROW_RIGHT_UP = _img("..###|...##|..#.#|.#...|#....")
    ARROW_RIGHT_DOWN = _img("#....|.#...|..#.#|...##|..###")
    ARROW_LEFT_UP = _img("###..|##...|#.#..|...#.|....#")
    ARROW_LEFT_DOWN = _img("....#|...#.|#.#..|##...|###..")
    ARROW_UP = _img("..#..|.###.|#.#.#|..#..|..#..")
    ARROW_DOWN = _img("..#..|..#..|#.#.#|.###.|..#..")
    ARROW_LEFT = _img("..#..|.#...|#####|.#...|..#..")
    ARROW_RIGHT = _img("..#..|...#.|#####|...#.|..#..")
    HAPPY = _img("##.##|##.##|.....|#...#|.###.")
    SAD = _img("##.##|##.##|.....|.###.|#...#")
    EYE_LEFT = _img(".....|.....|##...|##...|.....")
    EYE_RIGHT = _img(".....|.....|...##|...##|.....")
    EYE_LEFT_BLINK = _img(".....|.....|.....|##...|.....")
    EYE_RIGHT_BLINK = _img(".....|.....|.....|...##|.....")
    EYE_RIGHT_BROW = _img(".....|...##|.....|.....|.....")
    EYE_LEFT_BROW = _img(".....|##...|.....|.....|.....")
    EYE_LEFT_BROW_UP = _img("##...|.....|.....|.....|.....")
    EYE_RIGHT_BROW_UP = _img("...##|.....|.....|.....|.....")
    HEART = _img(".#.#.|#####|#####|.###.|..#..")
    PAUSE = _img(".....|.#.#.|.#.#.|.#.#.|.....")
    EMPTY = _img(".....|.....|.....|.....|.....")
    FULL = _img("#####|#####|#####|#####|#####")
    SQUARE = _img(".....|.###.|.###.|.###.|.....")
    TRIANGLE_RIGHT = _img(".#...|.##..|.###.|.##..|.#...")
    TRIANGLE_LEFT = _img("...#.|..##.|.###.|..##.|...#.")
    TRIANGLE_UP = _img(".....|..#..|.###.|#####|.....")
    TRIANGLE_DOWN = _img(".....|#####|.###.|..#..|.....")
    CIRCLE = _img(".###.|#####|#####|#####|.###.")
    CLOCKWISE = _img("####.|#..#.|#..#.|#.###|...#.")
    COUNTERCLOCKWISE = _img(".####|.#..#|.#..#|###.#|.#...")
    TRUE = _img("....#|...#.|#.#..|.#...|.....")
    FALSE = _img("#...#|.#.#.|..#..|.#.#.|#...#")
`;
  PY["pybricks/tools.py"] = `
import _sim

_UNSUPPORTED = "This simulator does not support multitasking (multitask / run_task / async / await) yet."

def wait(time):
    if not isinstance(time, (int, float)):
        raise TypeError("wait() needs a number of milliseconds")
    _sim.op("wait", time)

class StopWatch:
    def __init__(self):
        self._start = _sim.op("time")
        self._paused = None
    def time(self):
        if self._paused is not None:
            return int(self._paused - self._start)
        return int(_sim.op("time") - self._start)
    def reset(self):
        self._start = _sim.op("time")
        if self._paused is not None:
            self._paused = self._start
    def pause(self):
        if self._paused is None:
            self._paused = _sim.op("time")
    def resume(self):
        if self._paused is not None:
            self._start = self._start + _sim.op("time") - self._paused
            self._paused = None

def read_input_byte(last=False, chr=False):
    return None

def hub_menu(*symbols):
    if len(symbols) == 0:
        raise ValueError("hub_menu needs at least one symbol")
    _sim.op("disp_char", str(symbols[0]))
    _sim.op("wait", 300)
    return symbols[0]

def multitask(*coroutines, race=False):
    raise NotImplementedError(_UNSUPPORTED)

def run_task(coroutine=None):
    if coroutine is None:
        return False
    raise NotImplementedError(_UNSUPPORTED)

def vector(x, y, z=None):
    if z is None:
        return (x, y)
    return (x, y, z)
`;
  PY["pybricks/pupdevices.py"] = `
import _sim
from pybricks.parameters import _Port, _COLORS, Direction, Color, Stop

class OSError(Exception):
    pass

def _check(port, kind):
    if not isinstance(port, _Port):
        raise TypeError("expected a port, for example Port.A")
    if _sim.op("device", port.name) != kind:
        raise OSError("${ENODEV}")

class _Control:
    def __init__(self):
        self.scale = 1
    def limits(self, speed=None, acceleration=None, torque=None):
        return (1000, 2000, 560)
    def pid(self, kp=None, ki=None, kd=None, integral_deadzone=None, integral_rate=None):
        return (0, 0, 0, 0, 0)
    def target_tolerances(self, speed=None, position=None):
        return (50, 11)
    def stall_tolerances(self, speed=None, time=None):
        return (20, 200)

class Motor:
    def __init__(self, port, positive_direction=Direction.CLOCKWISE, gears=None, reset_angle=True, profile=None):
        _check(port, "motor")
        if positive_direction != 1 and positive_direction != -1:
            raise TypeError("positive_direction must be Direction.CLOCKWISE or Direction.COUNTERCLOCKWISE")
        self._p = port.name
        self._d = positive_direction
        self._zero = _sim.op("angle", self._p) * self._d
        self.control = _Control()
    def _raw_angle(self):
        return _sim.op("angle", self._p) * self._d - self._zero
    def _finish(self, wait):
        if wait:
            while not _sim.op("m_done", self._p):
                _sim.op("wait", 4)
    def angle(self):
        return int(round(self._raw_angle()))
    def reset_angle(self, angle=None):
        if angle is None:
            angle = 0
        self._zero = _sim.op("angle", self._p) * self._d - angle
    def speed(self, window=100):
        return int(round(_sim.op("speed", self._p) * self._d))
    def load(self):
        return 0
    def stalled(self):
        return False
    def done(self):
        return _sim.op("m_done", self._p)
    def stop(self):
        _sim.op("run", self._p, 0)
    def brake(self):
        _sim.op("run", self._p, 0)
    def hold(self):
        _sim.op("run", self._p, 0)
    def run(self, speed):
        _sim.op("run", self._p, speed * self._d)
    def dc(self, duty):
        _sim.op("run", self._p, duty * 10 * self._d)
    def run_time(self, speed, time, then=Stop.HOLD, wait=True):
        _sim.op("m_time", self._p, speed * self._d, time)
        self._finish(wait)
    def run_target(self, speed, target_angle, then=Stop.HOLD, wait=True):
        _sim.op("m_target", self._p, abs(speed), (target_angle + self._zero) * self._d)
        self._finish(wait)
    def run_angle(self, speed, rotation_angle, then=Stop.HOLD, wait=True):
        if speed < 0:
            rotation_angle = -rotation_angle
        self.run_target(speed, self._raw_angle() + rotation_angle, then, wait)
    def track_target(self, target_angle):
        _sim.op("m_target", self._p, 1000, (target_angle + self._zero) * self._d)
    def run_until_stalled(self, speed, then=Stop.COAST, duty_limit=None):
        # Στον προσομοιωτή τίποτα δεν μπλοκάρει τα μοτέρ: τρέχει 1 δευτερόλεπτο και σταματά
        _sim.op("m_time", self._p, speed * self._d, 1000)
        self._finish(True)
        return self.angle()
    def settings(self, max_voltage=None):
        return (9000,)
    def close(self):
        pass

class _Lights:
    def on(self, brightness=100):
        pass
    def off(self):
        pass

class ColorSensor:
    def __init__(self, port):
        _check(port, "color")
        self._p = port.name
        self.lights = _Lights()
    def color(self, surface=True):
        return _COLORS[_sim.op("color", self._p)]
    def reflection(self):
        return _sim.op("reflection", self._p)
    def ambient(self):
        return 3
    def hsv(self, surface=True):
        v = _sim.op("hsv", self._p)
        return Color(v[0], v[1], v[2])
    def detectable_colors(self, colors=None):
        return (Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.NONE)

class UltrasonicSensor:
    def __init__(self, port):
        _check(port, "ultrasonic")

class ForceSensor:
    def __init__(self, port):
        _check(port, "force")

class ColorDistanceSensor:
    def __init__(self, port):
        _check(port, "colordistance")

class DCMotor:
    def __init__(self, port, positive_direction=Direction.CLOCKWISE):
        _check(port, "dcmotor")
`;
  PY["pybricks/robotics.py"] = `
import _sim
from pybricks.parameters import Stop
from pybricks.pupdevices import Motor

class _DriveControl:
    def limits(self, speed=None, acceleration=None, torque=None):
        return (500, 1000, 560)
    def pid(self, kp=None, ki=None, kd=None, integral_deadzone=None, integral_rate=None):
        return (0, 0, 0, 0, 0)
    def target_tolerances(self, speed=None, position=None):
        return (5, 3)
    def stall_tolerances(self, speed=None, time=None):
        return (5, 200)

class DriveBase:
    def __init__(self, left_motor, right_motor, wheel_diameter, axle_track):
        if not isinstance(left_motor, Motor) or not isinstance(right_motor, Motor):
            raise TypeError("DriveBase needs two Motor objects: DriveBase(left_motor, right_motor, wheel_diameter, axle_track)")
        if left_motor._p == right_motor._p:
            raise ValueError("left_motor and right_motor must be different motors")
        self._ss = 200
        self._sa = 750
        self._tr = 150
        self._ta = 750
        self._d0 = 0
        self._a0 = 0
        self.distance_control = _DriveControl()
        self.heading_control = _DriveControl()
        _sim.op("db_init", left_motor._p, left_motor._d, right_motor._p, right_motor._d, wheel_diameter, axle_track)
        self.reset()
    def _finish(self, wait):
        if wait:
            while not _sim.op("db_done"):
                _sim.op("wait", 4)
    def reset(self, distance=0, angle=0):
        _sim.op("db_stop")
        s = _sim.op("db_state")
        self._d0 = s[0] - distance
        self._a0 = s[1] - angle
    def distance(self):
        return int(round(_sim.op("db_state")[0] - self._d0))
    def angle(self):
        return int(round(_sim.op("db_state")[1] - self._a0))
    def state(self):
        s = _sim.op("db_state")
        return (int(round(s[0] - self._d0)), int(round(s[2])), int(round(s[1] - self._a0)), int(round(s[3])))
    def settings(self, straight_speed=None, straight_acceleration=None, turn_rate=None, turn_acceleration=None):
        if straight_speed is None and straight_acceleration is None and turn_rate is None and turn_acceleration is None:
            return (self._ss, self._sa, self._tr, self._ta)
        if straight_speed is not None:
            self._ss = abs(straight_speed)
        if straight_acceleration is not None:
            self._sa = straight_acceleration
        if turn_rate is not None:
            self._tr = abs(turn_rate)
        if turn_acceleration is not None:
            self._ta = turn_acceleration
    def use_gyro(self, use_gyro):
        _sim.op("db_stop")
        a = _sim.op("db_state")[1] - self._a0
        _sim.op("db_gyro", use_gyro)
        self._a0 = _sim.op("db_state")[1] - a
    def done(self):
        return _sim.op("db_done")
    def stalled(self):
        return False
    def drive(self, speed, turn_rate):
        _sim.op("drive", speed, turn_rate)
    def stop(self):
        _sim.op("db_stop")
    def brake(self):
        _sim.op("db_stop")
    def hold(self):
        _sim.op("db_stop")
    def straight(self, distance, then=Stop.HOLD, wait=True):
        _sim.op("db_straight", distance, self._ss)
        self._finish(wait)
    def turn(self, angle, then=Stop.HOLD, wait=True, absolute=False):
        if absolute:
            _sim.op("db_turn", self._a0 + angle, True, self._tr)
        else:
            _sim.op("db_turn", angle, False, self._tr)
        self._finish(wait)
    def arc(self, radius, angle=None, distance=None, then=Stop.HOLD, wait=True):
        if angle is None and distance is None:
            raise ValueError("arc() needs an angle or a distance")
        if angle is not None and distance is not None:
            raise ValueError("arc() takes an angle or a distance, not both")
        _sim.op("db_arc", radius, angle, distance, self._ss)
        self._finish(wait)
    def curve(self, radius, angle, then=Stop.HOLD, wait=True):
        self.arc(radius, angle, None, then, wait)
    def move_by(self, dx, dy, then=Stop.HOLD):
        raise NotImplementedError("move_by() is not available in this simulator yet.")
`;
  PY["pybricks/hubs.py"] = `
import _sim
from pybricks.parameters import Side, _color_name
from pybricks.pupdevices import OSError

class _Speaker:
    def __init__(self):
        self._volume = 100
    def beep(self, frequency=500, duration=100):
        _sim.op("beep", frequency, duration)
    def play_notes(self, notes, tempo=120):
        # νότες όπως "C4/4", "F#3/8", "Bb4/2.", "R/4" (παύση), "E4/4_" (δεμένη)
        semitones = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
        for note in notes:
            parts = str(note).split("/")
            name = parts[0]
            value = 4
            dotted = False
            tied = False
            if len(parts) > 1:
                digits = ""
                for ch in parts[1]:
                    if ch in "0123456789":
                        digits = digits + ch
                    elif ch == ".":
                        dotted = True
                    elif ch == "_":
                        tied = True
                if digits != "":
                    value = int(digits)
            duration = 240000 / tempo / value
            if dotted:
                duration = duration * 1.5
            frequency = 0
            if len(name) >= 2 and name[0] in semitones:
                n = semitones[name[0]]
                rest = name[1:]
                if rest[0] == "#":
                    n += 1
                    rest = rest[1:]
                elif rest[0] == "b":
                    n -= 1
                    rest = rest[1:]
                octave = int(rest)
                frequency = 440 * 2 ** ((12 * (octave + 1) + n - 69) / 12)
            if tied or frequency == 0:
                _sim.op("beep", frequency, duration)
            else:
                _sim.op("beep", frequency, duration * 7 / 8)
                _sim.op("wait", duration / 8)
    def volume(self, volume=None):
        if volume is None:
            return self._volume
        self._volume = volume
        _sim.op("volume", volume)

class _Light:
    def on(self, color):
        _sim.op("light", _color_name(color))
    def off(self):
        _sim.op("light", None)
    def blink(self, color, durations):
        _sim.op("light", _color_name(color))
    def animate(self, colors, interval):
        _sim.op("light", _color_name(colors[0]))

class _Display:
    def text(self, text, on=500, off=50):
        _sim.op("disp_text", str(text), on, off)
    def number(self, number):
        _sim.op("disp_number", number)
    def char(self, char):
        _sim.op("disp_char", str(char))
    def off(self):
        _sim.op("disp_off")
    def pixel(self, row, column, brightness=100):
        _sim.op("disp_pixel", row, column, brightness)
    def icon(self, icon):
        r = 0
        for line in icon:
            c = 0
            for value in line:
                _sim.op("disp_pixel", r, c, value)
                c += 1
            r += 1
    def animate(self, matrices, interval):
        self.icon(matrices[0])
    def orientation(self, up):
        pass

class _IMU:
    def heading(self):
        return _sim.op("heading")
    def reset_heading(self, angle=0):
        if _sim.op("db_uses_gyro"):
            raise OSError("[Errno 1] EPERM: cannot reset the heading while a drive base is using the gyro. Use drive_base.reset() instead.")
        _sim.op("reset_heading", angle)
    def ready(self):
        return True
    def stationary(self):
        return not _sim.op("moving")
    def up(self, calibrated=True):
        return Side.TOP
    def tilt(self, calibrated=True):
        return (0, 0)
    def acceleration(self, axis=None, calibrated=True):
        if axis is None:
            return (0, 0, 9810)
        if axis == "Z":
            return 9810
        return 0
    def angular_velocity(self, axis=None, calibrated=True):
        rate = _sim.op("turn_rate")
        if axis is None:
            return (0, 0, rate)
        if axis == "Z":
            return rate
        return 0
    def rotation(self, axis, calibrated=True):
        if axis == "Z":
            return _sim.op("heading")
        return 0
    def settings(self, angular_velocity_threshold=None, acceleration_threshold=None, heading_correction=None,
                 angular_velocity_bias=None, angular_velocity_scale=None, acceleration_correction=None):
        return (2, 2500, 360, (0, 0, 0), (360, 360, 360), (9810, -9810, 9810, -9810, 9810, -9810))

class _Buttons:
    def pressed(self):
        return set()

class _Battery:
    def voltage(self):
        return 8100
    def current(self):
        return 150

class _Charger:
    def connected(self):
        return False
    def current(self):
        return 0
    def status(self):
        return 0

class _System:
    def set_stop_button(self, button):
        pass
    def name(self):
        return "ROBOTONIO Sim"
    def info(self):
        return {"name": "ROBOTONIO Sim", "reset_reason": 0, "host_connected_ble": True, "program_start_type": 3}
    def storage(self, offset, read=None, write=None):
        if read is not None:
            return bytes(read)
    def reset_storage(self):
        pass
    def shutdown(self):
        raise SystemExit()

class PrimeHub:
    def __init__(self, top_side=None, front_side=None, broadcast_channel=None, observe_channels=None):
        self.speaker = _Speaker()
        self.light = _Light()
        self.display = _Display()
        self.imu = _IMU()
        self.buttons = _Buttons()
        self.battery = _Battery()
        self.charger = _Charger()
        self.system = _System()

InventorHub = PrimeHub
`;

  const NATIVE = `var $builtinmodule = function (name) {
    var mod = {};
    mod.op = new Sk.builtin.func(function () {
      var args = [];
      for (var i = 0; i < arguments.length; i++) args.push(Sk.ffi.remapToJs(arguments[i]));
      var G = (typeof globalThis !== "undefined") ? globalThis : window;
      var r = G.PBSIM.current.call.apply(G.PBSIM.current, args);
      var conv = function (v) { return (v === null || v === undefined) ? Sk.builtin.none.none$ : Sk.ffi.remapToPy(v); };
      if (r && typeof r.then === "function") return Sk.misceval.promiseToSuspension(r.then(conv));
      return conv(r);
    });
    return mod;
  };`;

  function install(Sk) {
    const F = Sk.builtinFiles.files;
    for (const k in PY) F["src/lib/" + k] = PY[k];
    F["src/lib/_sim.js"] = NATIVE;
  }

  function runProgram(Sk, code, rt, onOutput) {
    install(Sk);
    API.current = rt;
    const cfg = {
      output: onOutput, __future__: Sk.python3, execLimit: null,
      read: f => { const v = Sk.builtinFiles.files[f]; if (v === undefined) throw "File not found: '" + f + "'"; return v; }
    };
    // Πρώτα φορτώνεται η βιβλιοθήκη χωρίς διακοπές: το Skulpt χάνει το module αν «ανασάνει» (yield) πάνω σε import,
    // κάτι που συμβαίνει σε αργούς υπολογιστές την πρώτη φορά που μεταγλωττίζεται η βιβλιοθήκη.
    Sk.configure(Object.assign({ yieldLimit: null }, cfg));
    const PRELUDE = "import pybricks.hubs\nimport pybricks.pupdevices\nimport pybricks.parameters\nimport pybricks.robotics\nimport pybricks.tools\nimport umath\nimport urandom\nimport math\nimport random\n";
    return Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<prelude>", false, PRELUDE, true)).then(() => {
      Sk.configure(Object.assign({ yieldLimit: API.yieldLimit || 40 }, cfg));
      // Το πρόγραμμα του μαθητή τρέχει πάνω στα ήδη φορτωμένα modules (χωρίς το reset του importMainWithBody)
      Sk.sysmodules.pop$item(new Sk.builtin.str("__main__"));
      Sk.lastYield = Date.now(); Sk.execStart = Date.now();
      return Sk.misceval.asyncToPromise(
        () => Sk.importModuleInternal_("<stdin>", false, "__main__", code, undefined, false, true),
        { "Sk.yield": () => { try { rt.check(); rt.catchUp(); } catch (e) { return Promise.reject(e); } return null; } });
    });
  }

  const TASKS = [];   // γεμίζει από το js/tasks.js

  const API = { ROBOT, RGB, TASKS, Sim, Runtime, StopSignal, TimeoutSignal, runProgram, classify, current: null };
  root.PBSIM = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
