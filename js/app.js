/* ROBOTONIO — Pybricks drill: διεπαφή (editor, καμβάς, έλεγχος αποστολής) */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const P = window.PBSIM, R = P.ROBOT;
  const task = P.TASKS[0];
  const PEEK_SECONDS = 8;

  let sim = new P.Sim(task), rt = null, running = false;
  let level = "gaps", peeks = 0, runs = 0, typingStart = null, typingStop = null, solved = false;

  const store = {
    get(k) { try { return localStorage.getItem("pbdrill:" + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem("pbdrill:" + k, v); } catch (e) { /* ιδιωτική περιήγηση */ } }
  };
  const codeKey = () => task.id + ":" + level;
  const template = () => level === "gaps" ? task.gaps : level === "outline" ? task.outline : "";

  // ───────── Κείμενα αποστολής ─────────
  $("task-title").textContent = task.title;
  $("task-steps").innerHTML = task.steps.map(s => "<li>" + s + "</li>").join("");

  // ───────── Editor ─────────
  const ta = $("code"), gutter = $("gutter");
  let errLine = 0;
  function refreshGutter() {
    const n = ta.value.split("\n").length; let h = "";
    for (let i = 1; i <= n; i++) h += (i === errLine ? '<span class="err">' + i + "</span>" : i) + "\n";
    gutter.innerHTML = h; gutter.scrollTop = ta.scrollTop;
  }
  ta.addEventListener("scroll", () => { gutter.scrollTop = ta.scrollTop; });
  ta.addEventListener("input", () => {
    if (typingStart === null) typingStart = Date.now();
    if (solved) { solved = false; typingStop = null; }
    errLine = 0; refreshGutter(); store.set(codeKey(), ta.value);
  });
  ta.addEventListener("paste", e => { e.preventDefault(); toast("Χωρίς επικόλληση — γράψ' το απέξω 🙂"); });
  ta.addEventListener("drop", e => e.preventDefault());
  ta.addEventListener("keydown", e => {
    const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); return; }
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.shiftKey) return;                       // Shift+Tab: κανονική πλοήγηση εστίασης
      e.preventDefault(); insert("    ");
    } else if (e.key === "Enter") {
      e.preventDefault();
      const line = v.slice(v.lastIndexOf("\n", s - 1) + 1, s);
      let ind = line.match(/^ */)[0];
      if (/:\s*(#.*)?$/.test(line)) ind += "    ";
      insert("\n" + ind);
    } else if (e.key === "Backspace" && s === en) {
      const line = v.slice(v.lastIndexOf("\n", s - 1) + 1, s);
      if (line.length >= 4 && /^ +$/.test(line) && line.length % 4 === 0) {
        e.preventDefault(); ta.setRangeText("", s - 4, s, "end"); ta.dispatchEvent(new Event("input"));
      }
    }
  });
  function insert(t) { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }

  function loadLevel(lv, fresh) {
    level = lv; store.set("level", lv);
    document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.level === lv)));
    const saved = fresh ? null : store.get(codeKey());
    ta.value = saved !== null ? saved : template();
    if (fresh) store.set(codeKey(), ta.value);
    peeks = 0; runs = 0; typingStart = null; typingStop = null; solved = false; errLine = 0;
    refreshGutter(); resetStage(); renderStats();
  }
  document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => { if (!running) loadLevel(b.dataset.level, false); }));
  $("btn-clear").addEventListener("click", () => { if (!running) { loadLevel(level, true); ta.focus(); } });

  // ───────── Κρυφοκοίταγμα ─────────
  let peekTimer = null;
  $("btn-peek").addEventListener("click", () => {
    if (peekTimer || running) return;
    peeks++; renderStats();
    const el = $("peek"); let left = PEEK_SECONDS;
    const show = () => { el.innerHTML = '<span class="count">' + left + "″</span>"; el.appendChild(document.createTextNode(task.solution)); };
    show(); el.classList.add("on"); ta.disabled = true;
    peekTimer = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(peekTimer); peekTimer = null; el.classList.remove("on"); ta.disabled = false; ta.focus(); }
      else el.querySelector(".count").textContent = left + "″";
    }, 1000);
  });

  // ───────── Στατιστικά ─────────
  const mmss = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  const typedMs = () => typingStart === null ? 0 : (typingStop || Date.now()) - typingStart;
  function renderStats() { $("st-time").textContent = mmss(typedMs()); $("st-peeks").textContent = peeks; $("st-runs").textContent = runs; }
  setInterval(renderStats, 1000);

  let toastTimer = null;
  function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), 2200); }

  // ───────── Κονσόλα ─────────
  const con = $("console");
  function out(text, cls) { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; con.appendChild(s); con.scrollTop = con.scrollHeight; }
  function hint(msg) {
    if (msg.includes("____")) return "Υπάρχει ακόμα κενό ____ που δεν συμπλήρωσες.";
    if (/^NameError/.test(msg)) return "Χρησιμοποιείς ένα όνομα που δεν υπάρχει. Το όρισες πιο πάνω; Το έκανες import; Ορθογραφία;";
    if (/^(ImportError|ModuleNotFoundError)/.test(msg) || /has no attribute/.test(msg) && /module/.test(msg)) return "Λάθος στο import: έλεγξε από ποιο module έρχεται κάθε όνομα (hubs, pupdevices, parameters, robotics, tools).";
    if (/^AttributeError/.test(msg)) return "Αυτό το αντικείμενο δεν έχει τέτοια μέθοδο/ιδιότητα. Έλεγξε το όνομα μετά την τελεία.";
    if (/^(SyntaxError|IndentationError|TabError)/.test(msg)) return "Συντακτικό λάθος: έλεγξε άνω-κάτω τελεία, παρενθέσεις και εσοχές σε αυτή ή στην προηγούμενη γραμμή.";
    if (/ENODEV/.test(msg)) return "Σε αυτή τη θύρα δεν υπάρχει τέτοια συσκευή. Δες την κάρτα του ρομπότ (A, B μοτέρ · C, D αισθητήρες).";
    if (/^TypeError/.test(msg)) return "Λάθος ορίσματα: έλεγξε τι (και πόσα) δίνεις μέσα στις παρενθέσεις.";
    return "";
  }

  // ───────── Έλεγχος αποστολής ─────────
  function renderChecks(list) {
    const items = list || task.evaluate(sim, { output: "", finished: false }).map(c => ({ text: c.text }));
    $("checks").innerHTML = items.map(c => '<li class="' + (c.ok === undefined ? "" : c.ok ? "ok" : "bad") + '">' + c.text + "</li>").join("");
  }
  function resetStage() { sim.reset(); con.textContent = ""; renderChecks(null); $("banner").classList.remove("on"); }

  // ───────── Εκτέλεση ─────────
  async function run() {
    if (running || peekTimer) return;
    running = true; runs++; renderStats(); errLine = 0; refreshGutter();
    $("btn-run").disabled = true; $("btn-stop").disabled = false;
    resetStage();
    rt = new P.Runtime(sim, { speed: Number($("speed").value) });
    const result = { output: "", finished: false };
    try {
      await P.runProgram(window.Sk, ta.value, rt, t => { result.output += t; out(t); });
      result.finished = true;
    } catch (e) {
      if (rt.signal === "stop") out("\n■ Σταμάτησε από εσένα.\n", "m");
      else if (rt.signal === "timeout") out("\n⏱ Πέρασαν " + task.timeLimit / 1000 + " δευτερόλεπτα και το πρόγραμμα δεν τελείωσε.\n", "e");
      else {
        const msg = e && e.toString ? e.toString() : String(e);
        const tb = (e && e.traceback || []).filter(t => t.filename === "<stdin>.py");
        if (tb.length) errLine = tb[tb.length - 1].lineno;
        out("\n" + msg.replace(/ on line \d+$/, "") + (errLine ? "  (γραμμή " + errLine + ")" : "") + "\n", "e");
        const h = hint(msg); if (h) out("→ " + h + "\n", "h");
        refreshGutter();
      }
    }
    // Όπως στο πραγματικό hub: στο τέλος του προγράμματος τα μοτέρ σταματούν
    sim.stopMotors(); rt.stopFlag = false; rt.signal = null; rt.timeLimit = Infinity; rt.resync();
    await rt.long(450);
    const checks = task.evaluate(sim, result);
    renderChecks(checks);
    if (checks.every(c => c.ok)) {
      solved = true; if (typingStart !== null) typingStop = Date.now();
      const lv = { gaps: "Με κενά", outline: "Μόνο σχόλια", blank: "Απέξω" }[level];
      $("banner").textContent = "Πέτυχες! Επίπεδο «" + lv + "» · χρόνος " + mmss(typedMs()) + " · κρυφοκοιτάγματα " + peeks + " · εκτελέσεις " + runs;
      $("banner").classList.add("on");
    }
    running = false; rt = null; $("btn-run").disabled = false; $("btn-stop").disabled = true; renderStats();
  }
  $("btn-run").addEventListener("click", run);
  $("btn-stop").addEventListener("click", () => { if (rt) rt.stopFlag = true; });
  $("speed").addEventListener("change", () => { if (rt) { rt.speed = Number($("speed").value); rt.resync(); } });

  // ───────── Σχεδίαση ─────────
  const cv = $("mat"), ctx = cv.getContext("2d");
  let matCache = null, scale = 1;
  const css = c => "rgb(" + c.map(Math.round).join(",") + ")";
  function fit() {
    const w = cv.clientWidth || 750, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * sim.mat.height / sim.mat.width);
    scale = cv.width / sim.mat.width; matCache = null;
  }
  function drawMat() {
    const m = sim.mat, c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height;
    const g = c.getContext("2d"); g.scale(scale, scale);
    g.fillStyle = css(P.RGB.WHITE); g.fillRect(0, 0, m.width, m.height);
    g.strokeStyle = "#d9d5c8"; g.lineWidth = 1;
    for (let x = 100; x < m.width; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, m.height); g.stroke(); }
    for (let y = 100; y < m.height; y += 100) { g.beginPath(); g.moveTo(0, y); g.lineTo(m.width, y); g.stroke(); }
    g.strokeStyle = css(P.RGB.BLACK); g.lineWidth = m.lineWidth; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); m.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    for (const k of m.marks) {
      g.save(); g.translate(k.c.x, k.c.y); g.rotate(k.c.th); g.fillStyle = css(P.RGB[k.color]);
      g.fillRect(-k.length / 2, -k.width / 2, k.length, k.width); g.restore();
    }
    g.fillStyle = "#8a8674"; g.font = "600 26px sans-serif";
    g.fillText("START", task.start.x - 60, task.start.y + 110);
    g.font = "20px sans-serif"; g.fillText("πλέγμα: 100 mm", m.width - 170, m.height - 16);
    g.strokeStyle = "#1b2230"; g.lineWidth = 6; g.strokeRect(3, 3, m.width - 6, m.height - 6);
    return c;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  function drawRobot(g) {
    const half = R.axleTrack / 2, sf = R.sensorForward, ss = R.sensorSide;
    g.save(); g.translate(sim.x, sim.y); g.rotate(sim.th);
    g.fillStyle = "#0003"; rr(g, -62, -half - 10, 112, R.axleTrack + 28, 14); g.fill();           // σκιά
    g.fillStyle = "#9aa1ad"; rr(g, -9, -half, 18, R.axleTrack, 4); g.fill();                        // δοκός τροχών
    g.strokeStyle = "#9aa1ad"; g.lineWidth = 9;
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(20, k * ss); g.lineTo(sf - 6, k * ss); g.stroke(); }
    for (const k of [-1, 1]) {                                                                      // τροχοί
      g.fillStyle = "#20242c"; rr(g, -R.wheelDiameter / 2, k * half - 13, R.wheelDiameter, 26, 7); g.fill();
      g.fillStyle = "#35b6c4"; rr(g, -10, k * half - 5, 20, 10, 3); g.fill();
    }
    g.fillStyle = "#c9ccd2"; g.beginPath(); g.arc(-48, 0, 9, 0, 7); g.fill();                       // ρόδα-μπίλια
    g.fillStyle = "#f5c400"; rr(g, -56, -30, 92, 60, 9); g.fill();                                  // hub
    g.fillStyle = "#fffdf5"; rr(g, -50, -24, 80, 48, 6); g.fill();
    g.fillStyle = "#d9d5c8";
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) g.fillRect(-36 + i * 8.5, -19 + j * 8.5, 5, 5);
    g.fillStyle = sim.light ? css(P.RGB[sim.light] || [120, 220, 255]) : "#7fd1ff";
    g.beginPath(); g.arc(19, 0, 7, 0, 7); g.fill();
    g.fillStyle = "#1b2230"; g.beginPath(); g.moveTo(36, 0); g.lineTo(28, -6); g.lineTo(28, 6); g.fill(); // βέλος «μπροστά»
    [["C", -1], ["D", 1]].forEach(([port, k]) => {                                                  // αισθητήρες
      g.fillStyle = "#f1f1ee"; g.strokeStyle = "#20242c"; g.lineWidth = 2;
      rr(g, sf - 11, k * ss - 11, 22, 22, 5); g.fill(); g.stroke();
      g.fillStyle = css(sim.read(port).rgb); g.beginPath(); g.arc(sf, k * ss, 6, 0, 7); g.fill(); g.stroke();
    });
    g.restore();
  }
  function frame() {
    if (!matCache) matCache = drawMat();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(matCache, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (sim.trail.length > 1) {
      ctx.strokeStyle = "rgba(11,107,203,.55)"; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.beginPath();
      sim.trail.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineTo(sim.x, sim.y); ctx.stroke();
    }
    drawRobot(ctx);
    const c = sim.read("C"), d = sim.read("D");
    const chip = (name, r) => '<span class="chip">' + name + ' <i style="background:' + css(r.rgb) + '"></i>' + r.name.padEnd(6, " ") + " " + String(r.reflection).padStart(3, " ") + "%</span>";
    const html = chip("C αριστ.", c) + chip("D δεξ.", d) +
      '<span class="chip">διαδρομή ' + String(Math.round(sim.odo)).padStart(5, " ") + " mm</span>" +
      '<span class="chip">χρόνος ' + (sim.time / 1000).toFixed(1).padStart(5, " ") + " s</span>";
    if (frame.last !== html) { $("telemetry").innerHTML = html; frame.last = html; }
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", fit);

  // ───────── Εκκίνηση ─────────
  const savedLevel = store.get("level");
  fit(); loadLevel(["gaps", "outline", "blank"].includes(savedLevel) ? savedLevel : "gaps", false);
  requestAnimationFrame(frame);
  window.__drill = { sim, task, setCode(v) { ta.value = v; ta.dispatchEvent(new Event("input")); } };   // για δοκιμές
})();
