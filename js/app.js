/* ROBOTONIO — Pybricks drill: διεπαφή (προκλήσεις, editor, καμβάς, υποδείξεις, έλεγχος) */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const P = window.PBSIM, R = P.ROBOT, TASKS = P.TASKS;

  const store = {
    get(k) { try { return localStorage.getItem("pbdrill2:" + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem("pbdrill2:" + k, v); } catch (e) { /* ιδιωτική περιήγηση */ } }
  };
  const clampIdx = n => Math.max(0, Math.min(TASKS.length - 1, n | 0));

  let idx = clampIdx(Number(store.get("current")) || 0);
  // Όλες οι προκλήσεις είναι ανοιχτές από την αρχή· κρατάμε μόνο ποιες έχουν λυθεί, για το ✔
  let done = [];
  try { done = JSON.parse(store.get("done") || "[]").filter(id => TASKS.some(t => t.id === id)); } catch (e) { done = []; }
  let task = TASKS[idx], sim = new P.Sim(task), rt = null, running = false;
  let runs = 0, taskStart = Date.now(), taskStop = null, solved = false;
  const hintsShown = TASKS.map(() => 0);
  // Έκδοση Blocks: ο μαθητής φτιάχνει το πρόγραμμα με blocks στο Pybricks και φέρνει εδώ την Python που παράγει (αρχείο .py ή επικόλληση)
  let blocks = new URLSearchParams(location.search).has("blocks") || store.get("mode") === "blocks";
  const codeKey = () => blocks ? "code-blocks" : "code";

  // ───────── Editor (ο ίδιος κώδικας σε όλες τις προκλήσεις) ─────────
  const ta = $("code"), gutter = $("gutter");
  let errLine = 0;
  function refreshGutter() {
    const n = ta.value.split("\n").length; let h = "";
    for (let i = 1; i <= n; i++) h += (i === errLine ? '<span class="err">' + i + "</span>" : i) + "\n";
    gutter.innerHTML = h; gutter.scrollTop = ta.scrollTop;
  }
  function setCode(v) { ta.value = v; errLine = 0; refreshGutter(); store.set(codeKey(), v); }
  ta.addEventListener("scroll", () => { gutter.scrollTop = ta.scrollTop; });
  ta.addEventListener("input", () => { errLine = 0; refreshGutter(); store.set(codeKey(), ta.value); });
  ta.addEventListener("drop", e => e.preventDefault());

  // ───────── Έκδοση Blocks: φόρτωση αρχείου .py, επικόλληση, σύρσιμο ─────────
  function importProgram(text, from) {
    if (running) return;
    text = String(text || "").replace(/\r\n?/g, "\n");
    if (!/pybricks/.test(text)) { toast("Αυτό δεν μοιάζει με πρόγραμμα Pybricks"); return; }
    setCode(text); ta.scrollTop = 0; toast("Φορτώθηκε " + from + " — πάτα «Εκτέλεση»");
  }
  function readFile(f) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importProgram(r.result, "το αρχείο " + f.name);
    r.onerror = () => toast("Δεν μπόρεσα να διαβάσω το αρχείο");
    r.readAsText(f);
  }
  $("btn-load").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", e => { readFile(e.target.files[0]); e.target.value = ""; });
  $("btn-paste").addEventListener("click", async () => {
    try { importProgram(await navigator.clipboard.readText(), "από το πρόχειρο"); }
    catch (err) { toast("Κάνε κλικ στη σελίδα και πάτα Ctrl+V"); }
  });
  document.addEventListener("paste", e => {
    if (!blocks) return;
    const t = e.clipboardData && e.clipboardData.getData("text");
    if (t) { e.preventDefault(); importProgram(t, "από το πρόχειρο"); }
  });
  document.addEventListener("dragover", e => { if (blocks) e.preventDefault(); });
  document.addEventListener("drop", e => { if (!blocks) return; e.preventDefault(); readFile(e.dataTransfer.files[0]); });
  function applyMode() {
    store.set("mode", blocks ? "blocks" : "python");
    document.body.classList.toggle("blocks", blocks);
    document.querySelectorAll("#mode button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.mode === "blocks") === blocks)));
    ta.readOnly = blocks;
    ta.placeholder = blocks ? "1. Φτιάξε το πρόγραμμα με blocks στο Pybricks.\n2. Κατέβασε το αρχείο του (.py) από τη λίστα αρχείων.\n3. Πάτα εδώ «Φόρτωσε αρχείο από Pybricks» ή σύρε το αρχείο στη σελίδα.\n\nΕναλλακτικά: αντίγραψε τον κώδικα Python που δείχνει το Pybricks και πάτα Ctrl+V." : "";
    $("code-label").textContent = blocks ? "Το πρόγραμμά σου από το Pybricks" : "Ο κώδικάς σου";
    const saved = store.get(codeKey());
    ta.value = saved !== null ? saved : (blocks ? "" : P.STARTER); errLine = 0; refreshGutter();
  }
  document.querySelectorAll("#mode button").forEach(b => b.addEventListener("click", () => {
    if (running) return; blocks = b.dataset.mode === "blocks"; applyMode();
  }));
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

  let clearArmed = null;
  $("btn-clear").addEventListener("click", () => {
    if (running) return;
    const b = $("btn-clear");
    if (!clearArmed) {                               // δεύτερο κλικ για επιβεβαίωση (σβήνει όλο τον κώδικα)
      b.textContent = "Σίγουρα; Πάτα ξανά";
      clearArmed = setTimeout(() => { clearArmed = null; b.textContent = "↺ Από την αρχή"; }, 3000);
      return;
    }
    clearTimeout(clearArmed); clearArmed = null; b.textContent = "↺ Από την αρχή";
    setCode(P.STARTER); ta.focus();
  });

  // ───────── Λειτουργία καθηγητή: ?teacher=1, διπλό κλικ στο «ROBOTONIO · UML» ή Ctrl+Shift+L ─────────
  let teacher = new URLSearchParams(location.search).has("teacher");
  function setTeacher(on, quiet) {
    teacher = on; $("btn-solution").hidden = !on; renderSteps();
    if (!quiet) toast(on ? "Λειτουργία καθηγητή: επικόλληση και λύσεις" : "Λειτουργία μαθητή");
  }
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyL") { e.preventDefault(); setTeacher(!teacher); } });
  document.querySelector("header .brand").addEventListener("dblclick", () => setTeacher(!teacher));
  $("btn-solution").addEventListener("click", () => { if (!running) setCode(task.solution); });
  ta.addEventListener("paste", e => { if (teacher || blocks) return; e.preventDefault(); toast("Χωρίς επικόλληση — γράψ' το μόνος σου 🙂"); });

  // ───────── Στατιστικά ─────────
  const mmss = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  const taskMs = () => (taskStop || Date.now()) - taskStart;
  function renderStats() { $("st-time").textContent = mmss(taskMs()); $("st-hints").textContent = hintsShown[idx]; $("st-runs").textContent = runs; }
  setInterval(renderStats, 1000);

  let toastTimer = null;
  function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), 2600); }

  // ───────── Κονσόλα ─────────
  const con = $("console");
  function out(text, cls) { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; con.appendChild(s); con.scrollTop = con.scrollHeight; }
  function explain(msg) {
    if (/^NameError/.test(msg)) return "Χρησιμοποιείς ένα όνομα που δεν υπάρχει. Το όρισες πιο πάνω; Ορθογραφία;";
    if (/^(ImportError|ModuleNotFoundError)/.test(msg) || /has no attribute/.test(msg) && /module/.test(msg)) return "Λάθος στο import: έλεγξε από ποιο module έρχεται κάθε όνομα (hubs, pupdevices, parameters, robotics, tools).";
    if (/^AttributeError/.test(msg)) return "Αυτό το αντικείμενο δεν έχει τέτοια μέθοδο. Έλεγξε το όνομα μετά την τελεία.";
    if (/^(SyntaxError|IndentationError|TabError)/.test(msg)) return "Συντακτικό λάθος: έλεγξε άνω-κάτω τελεία, παρενθέσεις και εσοχές σε αυτή ή στην προηγούμενη γραμμή.";
    if (/ENODEV/.test(msg)) return "Σε αυτή τη θύρα δεν υπάρχει τέτοια συσκευή. Δες την κάρτα του ρομπότ (A, B μοτέρ · C, D αισθητήρες).";
    if (/^NotImplementedError/.test(msg)) return "Αυτή η εντολή δεν υπάρχει ακόμα στον προσομοιωτή.";
    if (/^TypeError/.test(msg)) return "Λάθος ορίσματα: έλεγξε τι (και πόσα) δίνεις μέσα στις παρενθέσεις.";
    return "";
  }

  // ───────── Πρόκληση: τίτλος, περιγραφή, βήματα, υποδείξεις, έλεγχοι ─────────
  function renderSteps() {
    const nav = $("steps"); nav.innerHTML = "";
    TASKS.forEach((t, i) => {
      const b = document.createElement("button"), ok = done.includes(t.id);
      b.textContent = (ok ? "✔ " : "") + (t.tab || "Πρόκληση " + (i + 1));
      b.title = t.title; if (ok) b.classList.add("done");
      if (i === idx) b.setAttribute("aria-current", "step");
      b.addEventListener("click", () => { if (!running) loadTask(i); });
      nav.appendChild(b);
    });
  }
  function renderHints() {
    const n = hintsShown[idx], all = task.hints.length;
    $("hints-list").innerHTML = task.hints.slice(0, n).map(h => "<li>" + h + "</li>").join("");
    $("hints-empty").hidden = n > 0;
    const b = $("btn-hint"); b.disabled = n >= all;
    b.textContent = n >= all ? "Δεν έχει άλλες υποδείξεις" : "💡 Δείξε υπόδειξη (" + (n + 1) + " από " + all + ")";
  }
  $("btn-hint").addEventListener("click", () => { if (hintsShown[idx] < task.hints.length) { hintsShown[idx]++; renderHints(); renderStats(); } });
  function renderChecks(list) {
    const fresh = !list, items = list || task.evaluate(sim, { output: "", finished: false });
    const el = $("checks");
    if (items.maxScore) {                            // αποστολή με πόντους: πίνακας βαθμολογίας
      el.className = "checks score";
      el.innerHTML = items.filter(c => !(fresh && c.bad)).map(c => '<li class="' + (fresh ? "" : c.pts < 0 || c.bad ? "bad" : c.pts > 0 ? "ok" : "") + '"><span>' + c.text + "</span><b>" +
        (fresh ? (c.penalty ? "" : c.max) : c.penalty ? (c.pts || "") : c.pts + " / " + c.max) + "</b></li>").join("") +
        '<li class="total"><span>ΣΥΝΟΛΟ</span><b>' + (fresh ? "— / " : items.score + " / ") + items.maxScore + "</b></li>";
    } else {
      el.className = "checks";
      el.innerHTML = items.map(c => '<li class="' + (fresh ? "" : c.ok ? "ok" : "bad") + '">' + c.text + "</li>").join("");
    }
  }
  function loadTask(i) {
    idx = clampIdx(i); task = TASKS[idx]; store.set("current", idx);
    sim = new P.Sim(task); matCache = null; fit(); placed = null; homeStart = sim.start;
    runs = 0; taskStart = Date.now(); taskStop = null; solved = false; errLine = 0;
    $("task-title").textContent = (task.tab ? "" : "Πρόκληση " + (idx + 1) + " · ") + task.title;
    $("task-desc").innerHTML = task.desc;
    con.textContent = ""; $("banner").classList.remove("on");
    renderSteps(); renderHints(); renderChecks(null); renderStats(); refreshGutter();
  }

  // ───────── Ηχείο του hub (Web Audio) ─────────
  let audio = null, sound = store.get("sound") !== "off";
  function renderSound() { const b = $("btn-sound"); b.textContent = sound ? "🔊" : "🔇"; b.setAttribute("aria-pressed", String(sound)); b.title = sound ? "Ήχος: ανοιχτός" : "Ήχος: κλειστός"; }
  $("btn-sound").addEventListener("click", () => { sound = !sound; store.set("sound", sound ? "on" : "off"); renderSound(); });
  function wakeAudio() {                             // ο browser επιτρέπει ήχο μόνο μετά από κλικ του χρήστη
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; if (!audio) audio = new AC(); if (audio.state === "suspended") audio.resume(); } catch (e) { audio = null; }
  }
  P.onBeep = (freq, ms, volume) => {
    if (!sound || !audio || !(freq >= 20 && freq <= 12000)) return;
    try {
      const t = audio.currentTime, len = Math.max(0.02, ms / 1000), osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = "square"; osc.frequency.value = freq;
      const level = 0.07 * Math.max(0, Math.min(100, volume === undefined ? 100 : volume)) / 100;
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(level, t + 0.005);
      gain.gain.setValueAtTime(level, t + Math.max(0.006, len - 0.01)); gain.gain.linearRampToValueAtTime(0, t + len);
      osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + len + 0.02);
      P.beeps = (P.beeps || 0) + 1;
    } catch (e) { /* χωρίς ήχο */ }
  };

  // ───────── Τοποθέτηση του ρομπότ με το ποντίκι: σύρσιμο = μετακίνηση, λαβή ή ροδέλα = περιστροφή ─────────
  let placed = null, homeStart = null, drag = null;
  const board = $("mat");
  const HANDLE = 185;                                // mm μπροστά από το κέντρο του ρομπότ
  function toMat(e) { const r = board.getBoundingClientRect(); const v = sim.mat.view; return [v.x + (e.clientX - r.left) / r.width * v.w, v.y + (e.clientY - r.top) / r.height * v.h]; }
  function hit(pt) {
    const hx = sim.x + HANDLE * Math.cos(sim.th), hy = sim.y + HANDLE * Math.sin(sim.th);
    if (Math.hypot(pt[0] - hx, pt[1] - hy) <= 30) return "rotate";
    const dx = pt[0] - sim.x, dy = pt[1] - sim.y, c = Math.cos(sim.th), sn = Math.sin(sim.th);
    const u = dx * c + dy * sn, v = -dx * sn + dy * c;   // στο σύστημα του ρομπότ
    return (u > -70 && u < 148 && Math.abs(v) < 75) ? "move" : null;
  }
  function place(x, y, th) {
    const m = sim.mat;
    x = Math.max(0, Math.min(m.width, x)); y = Math.max(0, Math.min(m.height, y));
    placed = { dx: x - sim.anchor.x, dy: y - sim.anchor.y, heading: th * 180 / Math.PI };
    sim.start = { x, y, heading: placed.heading }; sim.reset(); renderChecks(null); $("banner").classList.remove("on");
  }
  board.addEventListener("pointerdown", e => {
    if (running || e.button > 0) return;
    const pt = toMat(e), h = hit(pt); if (!h) return;
    e.preventDefault(); board.setPointerCapture(e.pointerId);
    drag = { mode: h, ox: pt[0] - sim.x, oy: pt[1] - sim.y }; board.style.cursor = "grabbing";
  });
  board.addEventListener("pointermove", e => {
    const pt = toMat(e);
    if (!drag) { if (!running) { const h = hit(pt); board.style.cursor = h === "rotate" ? "crosshair" : h ? "grab" : ""; } return; }
    if (running) { drag = null; return; }
    if (drag.mode === "move") place(pt[0] - drag.ox, pt[1] - drag.oy, sim.th);
    else {
      let th = Math.atan2(pt[1] - sim.y, pt[0] - sim.x);
      if (e.shiftKey) th = Math.round(th / (Math.PI / 12)) * (Math.PI / 12);   // Shift: βήματα 15°
      place(sim.x, sim.y, th);
    }
  });
  const endDrag = e => { if (drag) { drag = null; board.style.cursor = ""; try { board.releasePointerCapture(e.pointerId); } catch (err) { /* ok */ } } };
  board.addEventListener("pointerup", endDrag); board.addEventListener("pointercancel", endDrag);
  board.addEventListener("wheel", e => {                // ροδέλα πάνω στο ρομπότ: περιστροφή ανά 5°
    if (running || !hit(toMat(e))) return;
    e.preventDefault(); place(sim.x, sim.y, sim.th + Math.sign(e.deltaY) * 5 * Math.PI / 180);
  }, { passive: false });

  // ───────── Εκτέλεση ─────────
  async function run() {
    if (running) return;
    if (blocks && !ta.value.trim()) { toast("Φόρτωσε πρώτα το πρόγραμμά σου από το Pybricks"); return; }
    if (/^\s*async\s+def\b|\bawait\b/m.test(ta.value)) {
      con.textContent = ""; out("Ο προσομοιωτής δεν υποστηρίζει ακόμα multitasking (async / await, πολλαπλά start blocks, block «multitask»).\nΦτιάξε το πρόγραμμα με ένα μόνο start block, χωρίς multitask.\n", "e"); return;
    }
    wakeAudio();
    running = true; runs++; renderStats(); errLine = 0; refreshGutter();
    $("btn-run").disabled = true; $("btn-stop").disabled = false; $("btn-reset").disabled = true;
    sim.setup(); matCache = null;                    // νέο τυχαίο στιγμιότυπο της πρόκλησης
    if (placed) { sim.start = { x: sim.anchor.x + placed.dx, y: sim.anchor.y + placed.dy, heading: placed.heading }; sim.reset(); }   // ...αλλά από τη θέση όπου έβαλε ο χρήστης το ρομπότ
    con.textContent = ""; renderChecks(null); $("banner").classList.remove("on");
    rt = new P.Runtime(sim, { speed: Number($("speed").value) });
    const result = { output: "", finished: false };
    try {
      await P.runProgram(window.Sk, ta.value, rt, t => { result.output += t; out(t); });
      result.finished = true;
    } catch (e) {
      if (rt.signal === "stop") out("\n■ Σταμάτησε από εσένα.\n", "m");
      else if (rt.signal === "timeout") out("\n⏱ Πέρασαν " + rt.timeLimit / 1000 + " δευτερόλεπτα και το πρόγραμμα δεν τελείωσε.\n", "e");
      else if (rt.signal === "fell") out("\n⤵ Το ρομπότ έβγαλε ρόδα έξω από το πεδίο και έπεσε. Το run τελείωσε.\n", "e");
      else {
        const msg = e && e.toString ? e.toString() : String(e);
        const tb = (e && e.traceback || []).filter(t => t.filename === "<stdin>.py");
        if (tb.length) errLine = tb[tb.length - 1].lineno;
        out("\n" + msg.replace(/ on line \d+$/, "") + (errLine ? "  (γραμμή " + errLine + ")" : "") + "\n", "e");
        const h = explain(msg); if (h) out("→ " + h + "\n", "h");
        refreshGutter();
      }
    }
    // Όπως στο πραγματικό hub: στο τέλος του προγράμματος τα μοτέρ σταματούν
    const fell = sim.fell;
    sim.stopMotors(); rt.stopFlag = false; rt.signal = null; rt.timeLimit = Infinity; rt.resync();
    if (!fell) await rt.long(450);
    const checks = task.evaluate(sim, result);
    renderChecks(checks);
    const last = idx === TASKS.length - 1, scored = !!checks.maxScore;
    const passed = scored ? checks.score >= (task.passScore || 1) : checks.every(c => c.ok);
    if (scored) {
      const best = Math.max(checks.score, Number(store.get("best:" + task.id)) || 0); store.set("best:" + task.id, best);
      out("\nΠραγματικές τιμές σε αυτό το γήπεδο: " + checks.truth + "\n", "m");
      $("banner-text").textContent = "Σκορ: " + checks.score + " / " + checks.maxScore + " · καλύτερο: " + best + " · χρόνος run " + (sim.time / 1000).toFixed(1) + " s · υποδείξεις " + hintsShown[idx];
      $("btn-next").hidden = true; $("banner").classList.add("on");
    }
    if (passed) {
      if (!solved) { solved = true; taskStop = Date.now(); }
      if (!done.includes(task.id)) { done.push(task.id); store.set("done", JSON.stringify(done)); }
      if (!scored) {
        $("banner-text").textContent = (last ? "Τις έβγαλες όλες! " : "Πέτυχες! ") + "Χρόνος " + mmss(taskMs()) + " · υποδείξεις " + hintsShown[idx] + " · εκτελέσεις " + runs;
        $("btn-next").hidden = last; $("banner").classList.add("on");
      }
      renderSteps();
    }
    running = false; rt = null; $("btn-run").disabled = false; $("btn-stop").disabled = true; $("btn-reset").disabled = false; renderStats();
  }
  $("btn-run").addEventListener("click", run);
  $("btn-stop").addEventListener("click", () => { if (rt) rt.stopFlag = true; });
  $("btn-reset").addEventListener("click", () => {   // το ρομπότ ξανά στη θέση εκκίνησης, στην ίδια πίστα
    if (running) return;
    if (placed) { placed = null; sim.start = homeStart; }
    sim.reset(); renderChecks(null); $("banner").classList.remove("on");
  });
  $("speed").addEventListener("change", () => { if (rt) { rt.speed = Number($("speed").value); rt.resync(); } });
  $("btn-next").addEventListener("click", () => { if (!running && idx < TASKS.length - 1) { loadTask(idx + 1); $("task-title").scrollIntoView({ block: "start" }); } });

  // ───────── Σχεδίαση ─────────
  const cv = $("mat"), ctx = cv.getContext("2d");
  let matCache = null, scale = 1;
  const css = c => "rgb(" + c.map(Math.round).join(",") + ")";
  function fit() {
    const w = cv.clientWidth || 1200, dpr = window.devicePixelRatio || 1, v = sim.mat.view;
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * v.h / v.w);
    scale = cv.width / v.w; matCache = null;
  }
  const toView = g => { const v = sim.mat.view; g.setTransform(scale, 0, 0, scale, -v.x * scale, -v.y * scale); };
  function drawMat() {
    const m = sim.mat, v = m.view, c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height;
    const g = c.getContext("2d"), raised = m.def.outside === "void";
    g.fillStyle = raised ? "#4b4f5a" : "#96826a"; g.fillRect(0, 0, c.width, c.height);     // πάτωμα γύρω από υπερυψωμένο πεδίο
    toView(g);
    g.fillStyle = css(P.RGB.WHITE); g.fillRect(0, 0, m.width, m.height);
    g.strokeStyle = "#dedacd"; g.lineWidth = 1;
    for (let x = 100; x < m.width; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, m.height); g.stroke(); }
    for (let y = 100; y < m.height; y += 100) { g.beginPath(); g.moveTo(0, y); g.lineTo(m.width, y); g.stroke(); }
    for (const z of m.zones) { g.fillStyle = css(P.RGB[z.color]); g.fillRect(z.x, z.y, z.w, z.h); }
    g.fillStyle = css(P.RGB.BLACK);
    if (m.disk) { g.beginPath(); g.arc(m.disk.cx, m.disk.cy, m.disk.r, 0, 7); g.fill(); }
    for (const q of m.segs) g.fillRect(q.x, q.y, q.w, q.h);
    g.strokeStyle = css(P.RGB.BLACK); g.lineWidth = m.lineWidth; g.lineCap = "round"; g.lineJoin = "round";
    if (m.hasPath) { g.beginPath(); m.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
    if (m.rect) g.strokeRect(m.rect.cx - m.rect.w / 2, m.rect.cy - m.rect.h / 2, m.rect.w, m.rect.h);
    for (const k of m.marks) {
      g.save(); g.translate(k.c.x, k.c.y); g.rotate(k.c.th); g.fillStyle = css(P.RGB[k.color]);
      g.fillRect(-k.length / 2, -k.width / 2, k.length, k.width); g.restore();
    }
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#8a8674"; g.font = "20px sans-serif"; g.fillText("πλέγμα: 100 mm", m.width - 170, m.height - 16);
    if (sim.world) {                                 // δοχεία έξω από την άκρη του πεδίου και ετικέτες
      g.font = "600 22px sans-serif"; g.textAlign = "center";
      for (const k of sim.world.containers) {
        const y = k.side === "N" ? -62 : m.height + 2;
        g.fillStyle = css(P.RGB[k.color]); g.fillRect(k.x0, y, k.x1 - k.x0, 60);
        g.strokeStyle = "#1b2230"; g.lineWidth = 3; g.strokeRect(k.x0, y, k.x1 - k.x0, 60);
        g.fillStyle = "#1b2230"; g.fillText(k.label, (k.x0 + k.x1) / 2, k.side === "N" ? -68 : m.height + 86);
      }
      g.fillStyle = "#8a8674"; g.font = "600 20px sans-serif"; g.save(); g.translate(sim.info.X + 26, 60); g.rotate(Math.PI / 2); g.textAlign = "left"; g.fillText("Γραμμή Εκκίνησης", 0, 0); g.restore();
      g.textAlign = "left"; g.fillText("Δ", 12, m.height / 2 + 6); g.textAlign = "right"; g.fillText("Α", m.width - 12, m.height / 2 - 40);
      g.textAlign = "left";
    }
    g.strokeStyle = "#1b2230"; g.lineWidth = 6; g.strokeRect(3, 3, m.width - 6, m.height - 6);
    return c;
  }
  function drawWorld(g) {                            // αντικείμενα, πύργοι, μπάλες
    const W = sim.world;
    for (const t of W.towers) {
      g.save(); g.translate(t.x, t.y); if (t.hit) g.rotate(0.35);
      g.fillStyle = t.hit ? "#f3b4ae" : css(P.RGB.GREY); g.strokeStyle = t.hit ? "#c2362b" : "#333"; g.lineWidth = 3;
      g.fillRect(-40, -40, 80, 80); g.strokeRect(-40, -40, 80, 80);
      if (t.ball) { g.fillStyle = "#e41a1a"; g.strokeStyle = "#222"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 25, 0, 7); g.fill(); g.stroke(); }
      g.restore();
      if (!t.ball) { g.fillStyle = "#e41a1a88"; g.strokeStyle = "#2228"; g.lineWidth = 2; g.beginPath(); g.arc(t.x + (t.x > 600 ? -70 : 70), t.y + 62, 25, 0, 7); g.fill(); g.stroke(); }
    }
    for (const o of W.objs) {
      g.globalAlpha = o.state === "lost" ? 0.35 : 1;
      g.fillStyle = css(P.RGB[o.color]); g.strokeStyle = o.color === "WHITE" ? "#0b4fa8" : "#0006"; g.lineWidth = 2.5;
      if (o.kind === "letter") { g.fillRect(o.x - 15, o.y - 15, 30, 30); g.strokeRect(o.x - 15, o.y - 15, 30, 30); g.fillStyle = "#fff"; g.fillRect(o.x - 8, o.y - 3, 16, 6); }
      else if (o.kind === "dog" || o.kind === "cat") { rr(g, o.x - 15, o.y - 15, 30, 30, 8); g.fill(); g.stroke(); }
      else { g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill(); g.stroke(); }
      if (o.kind === "cat" || o.kind === "dog") { g.fillStyle = o.color === "WHITE" ? "#0b4fa8" : "#fff"; g.font = "700 18px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(o.id === "cat_a" ? "a" : o.id === "cat_b" ? "b" : "σ", o.x, o.y + 1); g.textAlign = "left"; g.textBaseline = "alphabetic"; }
      g.globalAlpha = 1;
    }
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  // Το ρομπότ σε τοπικές συντεταγμένες (mm): αρχή στο μέσο του άξονα, +x μπροστά
  function drawRobot(g, x, y, th, eyes, light, pixels, gateDeg, beamDeg) {
    const half = R.axleTrack / 2, sf = R.sensorForward, ss = R.sensorSide;
    g.save(); g.translate(x, y); g.rotate(th);
    g.fillStyle = "#0002"; rr(g, -62, -half - 10, 112, R.axleTrack + 28, 14); g.fill();           // σκιά
    g.fillStyle = "#9aa1ad"; rr(g, -9, -half, 18, R.axleTrack, 4); g.fill();                        // δοκός τροχών
    const fs = R.forkSide, f0 = R.forkStart, tip = R.forkStart + R.forkLength;
    for (const k of [-1, 1]) { g.fillStyle = "#9aa1ad"; rr(g, 20, k * ss - 4.5, sf - 26, 9, 2); g.fill(); }   // βραχίονες αισθητήρων
    g.fillStyle = "#4a5160"; rr(g, f0 - 10, -fs - 5, 10, 2 * fs + 10, 3); g.fill();                 // πλάτη πιρουνιού
    for (const k of [-1, 1]) { rr(g, f0 - 4, k * fs - 5, R.forkLength + 4, 10, 4); g.fill(); }      // δόντια
    const ga = Math.max(0, Math.min(120, gateDeg || 0)) * Math.PI / 180;                           // καπάκι: άρθρωση στο αριστερό δόντι
    g.strokeStyle = "#e0a400"; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(tip - 4, -fs); g.lineTo(tip - 4 + 2 * fs * Math.cos(ga), -fs + 2 * fs * Math.sin(ga)); g.stroke(); g.lineCap = "butt";
    for (const k of [-1, 1]) {                                                                      // τροχοί
      g.fillStyle = "#20242c"; rr(g, -R.wheelDiameter / 2, k * half - 13, R.wheelDiameter, 26, 7); g.fill();
      g.fillStyle = "#35b6c4"; rr(g, -10, k * half - 5, 20, 10, 3); g.fill();
    }
    g.fillStyle = "#c9ccd2"; g.beginPath(); g.arc(-48, 0, 9, 0, 7); g.fill();                       // ρόδα-μπίλια
    g.fillStyle = "#f5c400"; rr(g, -56, -30, 92, 60, 9); g.fill();                                  // hub
    g.fillStyle = "#fffdf5"; rr(g, -50, -24, 80, 48, 6); g.fill();
    // οθόνη 5×5: η πάνω γραμμή είναι προς το μπροστινό μέρος του ρομπότ
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const b = pixels ? pixels[r * 5 + c] : 0;
      g.fillStyle = b > 0 ? (b > 60 ? "#e06c00" : "#f0b673") : "#d9d5c8";
      g.fillRect(-36 + (4 - r) * 8.5 - (b > 0 ? 1 : 0), -19 + c * 8.5 - (b > 0 ? 1 : 0), b > 0 ? 7 : 5, b > 0 ? 7 : 5);
    }
    g.fillStyle = light ? css(P.RGB[light] || [120, 220, 255]) : "#7fd1ff";
    g.beginPath(); g.arc(19, 0, 7, 0, 7); g.fill();
    g.fillStyle = "#1b2230"; g.beginPath(); g.moveTo(36, 0); g.lineTo(28, -6); g.lineTo(28, 6); g.fill(); // βέλος «μπροστά»
    [-1, 1].forEach((k, i) => {                                                                     // αισθητήρες
      g.fillStyle = "#f1f1ee"; g.strokeStyle = "#20242c"; g.lineWidth = 2;
      rr(g, sf - 11, k * ss - 11, 22, 22, 5); g.fill(); g.stroke();
      g.fillStyle = css(eyes[i]); g.beginPath(); g.arc(sf, k * ss, 6, 0, 7); g.fill(); g.stroke();
    });
    const ba = (beamDeg || 0) * Math.PI / 180;                                                      // δοκός (πάνω από όλα, στο ύψος των μπαλών)
    g.strokeStyle = "rgba(194,54,43,.85)"; g.lineWidth = 9; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(R.beamLength * Math.cos(ba), R.beamLength * Math.sin(ba)); g.stroke(); g.lineCap = "butt";
    g.fillStyle = "#7d1f18"; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
    g.restore();
  }
  function drawRobotFigure() {                       // η κάτοψη στην κάρτα «Το ρομπότ σου»
    const c = $("robotfig"), dpr = window.devicePixelRatio || 1, W = 320, H = 300, k = 1.15;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext("2d"); g.scale(dpr, dpr);
    const ox = 160, oy = 212;
    g.save(); g.translate(ox, oy); g.scale(k, k); drawRobot(g, 0, 0, -Math.PI / 2, [P.RGB.WHITE, P.RGB.WHITE], null, null, 90, 42); g.restore();
    const tag = (t, x, y, lx, ly) => {
      g.strokeStyle = "#6a7180"; g.lineWidth = 1; g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y); g.stroke();
      g.fillStyle = "#f5c400"; rr(g, x - 13, y - 12, 26, 24, 5); g.fill();
      g.fillStyle = "#1b2230"; g.font = "700 15px ui-monospace, Consolas, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, x, y + 1);
    };
    const half = R.axleTrack / 2 * k, sf = R.sensorForward * k, ss = R.sensorSide * k, tip = (R.forkStart + R.forkLength) * k, fs = R.forkSide * k;
    tag("A", 28, oy, ox - half - 16, oy); tag("B", W - 28, oy, ox + half + 16, oy);
    tag("C", 50, oy - sf, ox - ss - 12, oy - sf); tag("D", W - 50, oy - sf - 30, ox + ss + 12, oy - sf);
    tag("E", 40, oy - tip + 4, ox - fs + 14, oy - tip + 4); tag("F", W - 22, oy - 150, ox + 118, oy - 132);
    g.fillStyle = "#6a7180"; g.font = "12px sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillText("↑ μπροστά", ox, 22); g.fillText("κάτοψη", ox, H - 6);
  }
  function frame() {
    if (!matCache) matCache = drawMat();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(matCache, 0, 0);
    toView(ctx);
    if (sim.world) drawWorld(ctx);
    if (sim.trail.length > 1) {
      ctx.strokeStyle = "rgba(11,107,203,.55)"; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.beginPath();
      sim.trail.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineTo(sim.x, sim.y); ctx.stroke();
    }
    const c = sim.read("C"), d = sim.read("D");
    drawRobot(ctx, sim.x, sim.y, sim.th, [c.rgb, d.rgb], sim.light, sim.pixels, sim.motors.E.angle, sim.motors.F.angle);
    if (!running) {                                  // λαβή περιστροφής
      const hx = sim.x + HANDLE * Math.cos(sim.th), hy = sim.y + HANDLE * Math.sin(sim.th);
      ctx.strokeStyle = "rgba(11,107,203,.6)"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(sim.x + 150 * Math.cos(sim.th), sim.y + 150 * Math.sin(sim.th)); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#0b6bcb"; ctx.beginPath(); ctx.arc(hx, hy, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, 6, 0.6, 5.2); ctx.stroke();
    }
    const key = sim.pixels.join("");
    if (frame.px !== key) {                          // η οθόνη του hub σε μεγέθυνση, όρθια
      frame.px = key; const hc = $("hubdisp"), hg = hc.getContext("2d"), u = hc.width / 5;
      hg.fillStyle = "#141925"; hg.fillRect(0, 0, hc.width, hc.height);
      for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) {
        const b = sim.pixels[r * 5 + q];
        hg.fillStyle = b > 0 ? (b > 60 ? "#ffd21f" : "#8a7420") : "#2a3142";
        hg.fillRect(q * u + u * 0.14, r * u + u * 0.14, u * 0.72, u * 0.72);
      }
    }
    const chip = (name, r) => '<span class="chip">' + name + ' <i style="background:' + css(r.rgb) + '"></i>' + r.name.padEnd(6, " ") + " " + String(r.reflection).padStart(3, " ") + "%</span>";
    const html = chip("C", c) + chip("D", d) +
      '<span class="chip">E' + String(Math.round(sim.motors.E.angle)).padStart(4, "\u00a0") + "° F" + String(Math.round(sim.motors.F.angle)).padStart(4, "\u00a0") + "°</span>" +
      '<span class="chip">γυροσκόπιο ' + String(Math.round(sim.heading())).padStart(4, " ") + "°</span>" +
      '<span class="chip">θέση ' + String(Math.round(sim.x)).padStart(4, "\u00a0") + "," + String(Math.round(sim.y)).padStart(4, "\u00a0") + " ·" + String(Math.round(((sim.th * 180 / Math.PI) % 360 + 360) % 360)).padStart(4, "\u00a0") + "°</span>" +
      '<span class="chip">χρόνος ' + (sim.time / 1000).toFixed(1).padStart(5, " ") + " s</span>";
    if (frame.last !== html) { $("telemetry").innerHTML = html; frame.last = html; }
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", fit);

  // ───────── Εκκίνηση ─────────
  applyMode(); renderSound();
  setTeacher(teacher, true);
  loadTask(idx);
  drawRobotFigure();
  requestAnimationFrame(frame);
  window.__drill = { get sim() { return sim; }, get task() { return task; }, tasks: TASKS, setCode, loadTask };   // για δοκιμές
})();
