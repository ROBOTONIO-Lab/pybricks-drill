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
    BLUE: [0, 92, 200], YELLOW: [250, 205, 0], TABLE: [150, 130, 105]
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
    const path = buildPath(def.line);
    const pts = path.pts;
    const at = s => {
      const i = Math.max(0, Math.min(pts.length - 2, Math.floor(s / 2)));
      const a = pts[i], b = pts[i + 1];
      const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const f = s / 2 - i;
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, th };
    };
    const marks = def.marks.map(m => {
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
    function rgbAt(x, y, r) {
      if (x < 0 || y < 0 || x > def.width || y > def.height) return RGB.TABLE;
      const n = nearest(x, y), hw = def.lineWidth / 2;
      const cl = Math.max(0, Math.min(1, (hw + r - n.d) / (2 * r)));
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
    return { def, width: def.width, height: def.height, lineWidth: def.lineWidth, pts, length: path.length, marks, at, nearest, rgbAt };
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

  // ───────────────────────── Φυσική ─────────────────────────
  class Sim {
    constructor(task) { this.task = task; this.mat = makeMat(task.mat); this.reset(); }
    reset() {
      const st = this.task.start;
      this.x = st.x; this.y = st.y; this.th = st.heading * Math.PI / 180;
      this.th0 = this.th; this.headingZero = 0;
      this.time = 0; this.odo = 0; this.maxDev = 0; this.maxS = 0;
      this.motors = { A: { target: 0, speed: 0, angle: 0 }, B: { target: 0, speed: 0, angle: 0 } };
      this.trail = [[this.x, this.y]]; this._acc = 0;
      this.light = null; this.display = ""; this.beepUntil = 0;
    }
    stopMotors() { this.motors.A.target = 0; this.motors.B.target = 0; }
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
    heading() { return (this.th - this.th0) * 180 / Math.PI - this.headingZero; }
    moving() { return Math.abs(this.motors.A.speed) + Math.abs(this.motors.B.speed) > 8; }
    step(dt) {
      const K = Math.PI * ROBOT.wheelDiameter / 360, a = 1 - Math.exp(-dt / ROBOT.motorTau);
      for (const m of [this.motors.A, this.motors.B]) {
        const tg = Math.max(-ROBOT.maxMotorSpeed, Math.min(ROBOT.maxMotorSpeed, m.target));
        m.speed += (tg - m.speed) * a; m.angle += m.speed * dt / 1000;
      }
      const vl = -this.motors.A.speed * K, vr = this.motors.B.speed * K;   // A είναι καθρεφτισμένο
      const v = (vl + vr) / 2, w = (vl - vr) / ROBOT.axleTrack;
      this.th += w * dt / 1000;
      this.x += v * Math.cos(this.th) * dt / 1000; this.y += v * Math.sin(this.th) * dt / 1000;
      this.odo += v * dt / 1000; this.time += dt;
      this._acc += dt;
      if (this._acc >= 20) {
        this._acc = 0;
        const p = this.sensorPos("mid"), n = this.mat.nearest(p[0], p[1]);
        if (n.d > this.maxDev) this.maxDev = n.d;
        if (n.d < 80 && n.s > this.maxS) this.maxS = n.s;
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
    after(ms, val) { const p = this.tick(ms); return p ? p.then(() => val) : val; }
    call(name) {
      const a = arguments, sim = this.sim, M = sim.motors;
      switch (name) {
        case "device": { const d = ROBOT.ports[a[1]]; return d ? d.type : null; }
        case "time": return sim.time;
        case "wait": return a[1] <= 8 ? this.after(Math.max(0, a[1]), null) : this.long(a[1]).then(() => null);
        case "run": M[a[1]].target = a[2]; return this.after(1, null);
        case "drive": M[a[1]].target = a[2]; M[a[3]].target = a[4]; return this.after(1, null);
        case "angle": return this.after(1, M[a[1]].angle);
        case "angles": return this.after(1, [M[a[1]].angle, M[a[2]].angle]);
        case "speed": return this.after(1, M[a[1]].speed);
        case "color": return this.after(1, sim.read(a[1]).name);
        case "reflection": return this.after(1, sim.read(a[1]).reflection);
        case "hsv": return this.after(1, sim.read(a[1]).hsv);
        case "heading": return this.after(1, sim.heading());
        case "reset_heading": sim.headingZero += sim.heading() - a[1]; return null;
        case "light": sim.light = a[1]; return null;
        case "display": sim.display = String(a[1]); return null;
        case "beep": sim.beepUntil = sim.time + a[2]; return this.long(a[2]).then(() => null);
      }
      throw new Error("unknown sim call " + name);
    }
  }

  // ───────────────────────── Βιβλιοθήκη pybricks (Python, τρέχει μέσα στο Skulpt) ─────────────────────────
  const ENODEV = "[Errno 19] ENODEV: A sensor or motor is not connected to the specified port. " +
    "Check the port settings in your script.";
  const PY = {};
  PY["pybricks/__init__.py"] = "";
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
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    CENTER = "CENTER"
    BLUETOOTH = "BLUETOOTH"

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
        if self._name is not None or other._name is not None:
            return self._name == other._name
        return self.h == other.h and self.s == other.s and self.v == other.v
    def __ne__(self, other):
        return not self.__eq__(other)
    def __hash__(self):
        return self.h * 10000 + self.s * 100 + self.v
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
`;
  PY["pybricks/tools.py"] = `
import _sim

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

class Motor:
    def __init__(self, port, positive_direction=Direction.CLOCKWISE, gears=None, reset_angle=True, profile=None):
        _check(port, "motor")
        if positive_direction != 1 and positive_direction != -1:
            raise TypeError("positive_direction must be Direction.CLOCKWISE or Direction.COUNTERCLOCKWISE")
        self._p = port.name
        self._d = positive_direction
        self._zero = _sim.op("angle", self._p) * self._d
    def run(self, speed):
        _sim.op("run", self._p, speed * self._d)
    def dc(self, duty):
        _sim.op("run", self._p, duty * 10 * self._d)
    def stop(self):
        _sim.op("run", self._p, 0)
    def brake(self):
        _sim.op("run", self._p, 0)
    def hold(self):
        _sim.op("run", self._p, 0)
    def angle(self):
        return int(round(_sim.op("angle", self._p) * self._d - self._zero))
    def speed(self):
        return int(round(_sim.op("speed", self._p) * self._d))
    def reset_angle(self, angle=0):
        self._zero = _sim.op("angle", self._p) * self._d - angle
    def run_time(self, speed, time, then=Stop.HOLD, wait=True):
        self.run(speed)
        _sim.op("wait", time)
        self.stop()
    def run_target(self, speed, target_angle, then=Stop.HOLD, wait=True):
        speed = abs(speed)
        while True:
            rem = target_angle - (_sim.op("angle", self._p) * self._d - self._zero)
            if abs(rem) < 2:
                break
            v = min(speed, max(30, abs(rem) * 8))
            if rem < 0:
                v = -v
            self.run(v)
            _sim.op("wait", 4)
        self.stop()
    def run_angle(self, speed, rotation_angle, then=Stop.HOLD, wait=True):
        if speed < 0:
            rotation_angle = -rotation_angle
        self.run_target(speed, self.angle() + rotation_angle)

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
`;
  PY["pybricks/robotics.py"] = `
import _sim
from pybricks.parameters import Stop
from pybricks.pupdevices import Motor

_PI = 3.141592653589793

class DriveBase:
    def __init__(self, left_motor, right_motor, wheel_diameter, axle_track):
        if not isinstance(left_motor, Motor) or not isinstance(right_motor, Motor):
            raise TypeError("DriveBase needs two Motor objects: DriveBase(left_motor, right_motor, wheel_diameter, axle_track)")
        if left_motor._p == right_motor._p:
            raise ValueError("left_motor and right_motor must be different motors")
        self._l = left_motor
        self._r = right_motor
        self._wd = wheel_diameter
        self._at = axle_track
        self._ss = 200
        self._tr = 150
        self._d0 = 0
        self._a0 = 0
        self.reset()
    def _raw(self):
        v = _sim.op("angles", self._l._p, self._r._p)
        k = _PI * self._wd / 360
        dl = v[0] * self._l._d * k
        dr = v[1] * self._r._d * k
        return ((dl + dr) / 2, (dl - dr) / self._at * 180 / _PI)
    def reset(self, distance=0, angle=0):
        r = self._raw()
        self._d0 = r[0] - distance
        self._a0 = r[1] - angle
    def distance(self):
        return int(round(self._raw()[0] - self._d0))
    def angle(self):
        return int(round(self._raw()[1] - self._a0))
    def state(self):
        r = self._raw()
        return (int(round(r[0] - self._d0)), 0, int(round(r[1] - self._a0)), 0)
    def settings(self, straight_speed=None, straight_acceleration=None, turn_rate=None, turn_acceleration=None):
        if straight_speed is not None:
            self._ss = straight_speed
        if turn_rate is not None:
            self._tr = turn_rate
        return (self._ss, 500, self._tr, 500)
    def use_gyro(self, use_gyro):
        pass
    def done(self):
        return True
    def drive(self, speed, turn_rate):
        k = 360 / (_PI * self._wd)
        diff = turn_rate * _PI / 180 * self._at / 2
        _sim.op("drive", self._l._p, (speed + diff) * k * self._l._d, self._r._p, (speed - diff) * k * self._r._d)
    def stop(self):
        _sim.op("drive", self._l._p, 0, self._r._p, 0)
    def brake(self):
        self.stop()
    def straight(self, distance, then=Stop.HOLD, wait=True):
        target = self._raw()[0] + distance
        while True:
            rem = target - self._raw()[0]
            if abs(rem) < 1:
                break
            v = min(self._ss, max(25, abs(rem) * 5))
            if rem < 0:
                v = -v
            self.drive(v, 0)
            _sim.op("wait", 4)
        self.stop()
        _sim.op("wait", 150)
    def turn(self, angle, then=Stop.HOLD, wait=True):
        target = self._raw()[1] + angle
        while True:
            rem = target - self._raw()[1]
            if abs(rem) < 0.7:
                break
            w = min(self._tr, max(15, abs(rem) * 6))
            if rem < 0:
                w = -w
            self.drive(0, w)
            _sim.op("wait", 4)
        self.stop()
        _sim.op("wait", 150)
`;
  PY["pybricks/hubs.py"] = `
import _sim

class _Speaker:
    def beep(self, frequency=500, duration=100):
        _sim.op("beep", frequency, duration)
    def volume(self, volume=None):
        return 100

class _Light:
    def on(self, color):
        _sim.op("light", color._name)
    def off(self):
        _sim.op("light", None)
    def blink(self, color, durations):
        _sim.op("light", color._name)

class _Display:
    def text(self, text, on=500, off=50):
        _sim.op("display", str(text))
    def number(self, number):
        _sim.op("display", str(number))
    def char(self, char):
        _sim.op("display", str(char))
    def off(self):
        _sim.op("display", "")
    def icon(self, icon):
        pass
    def pixel(self, row, column, brightness=100):
        pass
    def orientation(self, up):
        pass

class _IMU:
    def heading(self):
        return _sim.op("heading")
    def reset_heading(self, angle=0):
        _sim.op("reset_heading", angle)
    def ready(self):
        return True
    def stationary(self):
        return True
    def tilt(self):
        return (0, 0)

class _Buttons:
    def pressed(self):
        return []

class _Battery:
    def voltage(self):
        return 8100
    def current(self):
        return 150

class _System:
    def set_stop_button(self, button):
        pass
    def name(self):
        return "ROBOTONIO Sim"

class PrimeHub:
    def __init__(self, top_side=None, front_side=None):
        self.speaker = _Speaker()
        self.light = _Light()
        self.display = _Display()
        self.imu = _IMU()
        self.buttons = _Buttons()
        self.battery = _Battery()
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
    Sk.configure({
      output: onOutput, __future__: Sk.python3, yieldLimit: 40, execLimit: null,
      read: f => { const v = Sk.builtinFiles.files[f]; if (v === undefined) throw "File not found: '" + f + "'"; return v; }
    });
    return Sk.misceval.asyncToPromise(
      () => Sk.importMainWithBody("<stdin>", false, code, true),
      { "Sk.yield": () => { try { rt.check(); rt.catchUp(); } catch (e) { return Promise.reject(e); } return null; } });
  }

  // ───────────────────────── Αποστολές (ΠΡΟΣΘΕΣΕ ΕΔΩ νέες) ─────────────────────────
  const TASKS = [{
    id: "line-until-red",
    title: "Ακολούθησε τη γραμμή μέχρι το ΚΟΚΚΙΝΟ και μέτρα απόσταση",
    steps: [
      "Αρχικοποίηση: hub, δύο μοτέρ, δύο αισθητήρες χρώματος, DriveBase.",
      "Ακολούθησε την άκρη της μαύρης γραμμής με τον <b>αριστερό</b> αισθητήρα (αναλογικός έλεγχος).",
      "Σταμάτα όταν ο <b>δεξιός</b> αισθητήρας δει <b>κόκκινο</b> — όχι στο πράσινο.",
      "Τύπωσε με <code>print</code> την απόσταση που διένυσε το ρομπότ (mm)."
    ],
    timeLimit: 45000,
    mat: {
      width: 1500, height: 900, lineWidth: 20,
      line: [[110, 750], [430, 750], [660, 700], [790, 560], [840, 400], [950, 265], [1120, 215], [1290, 290], [1350, 460], [1320, 640], [1320, 760]],
      marks: [{ s: 760, color: "GREEN", length: 40, width: 150 }, { s: -90, color: "RED", length: 40, width: 150 }]
    },
    start: { x: 130, y: 764, heading: 0 },
    solution: `from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor
from pybricks.parameters import Port, Direction, Color
from pybricks.robotics import DriveBase

# --- Αρχικοποίηση ---
hub = PrimeHub()
left_motor = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right_motor = Motor(Port.B)
left_sensor = ColorSensor(Port.C)
right_sensor = ColorSensor(Port.D)
robot = DriveBase(left_motor, right_motor, wheel_diameter=56, axle_track=112)

# --- Σταθερές ---
TARGET = 50
KP = 1.5
SPEED = 150

# --- Ακολουθία άκρης γραμμής μέχρι το κόκκινο ---
robot.reset()
while True:
    error = left_sensor.reflection() - TARGET
    robot.drive(SPEED, KP * error)
    if right_sensor.color() == Color.RED:
        break
robot.stop()

# --- Απόσταση που διανύθηκε ---
print(robot.distance())
`,
    gaps: `from pybricks.hubs import ____
from pybricks.pupdevices import ____, ____
from pybricks.parameters import Port, Direction, Color
from pybricks.robotics import ____

# --- Αρχικοποίηση ---
hub = ____()
left_motor = Motor(Port.____, Direction.____)
right_motor = ____(Port.B)
left_sensor = ColorSensor(Port.____)
right_sensor = ____(Port.D)
robot = DriveBase(____, ____, wheel_diameter=____, axle_track=____)

# --- Σταθερές ---
TARGET = ____
KP = 1.5
SPEED = 150

# --- Ακολουθία άκρης γραμμής μέχρι το κόκκινο ---
robot.____()
while True:
    error = left_sensor.____() - TARGET
    robot.drive(____, ____ * error)
    if right_sensor.____() == Color.____:
        ____
robot.____()

# --- Απόσταση που διανύθηκε ---
print(robot.____())
`,
    outline: `# --- Εισαγωγές (imports) ---


# --- Αρχικοποίηση ---


# --- Σταθερές ---


# --- Ακολουθία άκρης γραμμής μέχρι το κόκκινο ---


# --- Απόσταση που διανύθηκε ---

`,
    evaluate(sim, run) {
      const red = sim.mat.marks.find(m => m.color === "RED");
      const onRed = ["C", "D"].some(p => sim.read(p).name === "RED");
      const nums = (run.output.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      const distOk = nums.some(n => Math.abs(n - sim.odo) <= 25);
      return [
        { ok: run.finished, text: "Το πρόγραμμα έτρεξε και τελείωσε χωρίς σφάλμα" },
        { ok: sim.maxS > red.s - 60 && sim.maxDev < 60, text: "Το ρομπότ ακολούθησε τη γραμμή χωρίς να τη χάσει" },
        { ok: run.finished && onRed && !sim.moving(), text: "Σταμάτησε πάνω στο κόκκινο" },
        { ok: run.finished && distOk, text: "Τύπωσε τη σωστή απόσταση (±25 mm)" }
      ];
    }
  }];

  const API = { ROBOT, RGB, TASKS, Sim, Runtime, StopSignal, TimeoutSignal, runProgram, classify, current: null };
  root.PBSIM = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
