/* ROBOTONIO — Pybricks drill: οι προκλήσεις, με τη σειρά που εμφανίζονται.
 * Κάθε πρόκληση: title, desc (HTML), build(rnd) -> πίστα + θέση εκκίνησης (τυχαίες διαστάσεις σε κάθε εκτέλεση),
 * hints (HTML, εμφανίζονται μία-μία), solution (για τη λειτουργία καθηγητή), evaluate(sim, run) -> έλεγχοι.
 */
(function (root) {
  "use strict";
  const P = root.PBSIM || require("./sim.js");
  const MAT = { width: 1600, height: 760, lineWidth: 20 };
  const CX = 800, CY = 380;
  const pick = (rnd, lo, hi, step) => lo + step * Math.floor(rnd() * (Math.floor((hi - lo) / step) + 1));
  const numbers = out => (out.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  const rectMat = (w, h) => Object.assign({ rect: { cx: CX, cy: CY, w, h } }, MAT);
  const sensorLineDist = sim => Math.min.apply(null, ["left", "right"].map(sd => { const p = sim.sensorPos(sd); return Math.abs(sim.mat.rectSd(p[0], p[1])); }));

  // Το πρότυπο νέου αρχείου του Pybricks Code για SPIKE Prime — με αυτό ξεκινά ο μαθητής
  const STARTER = `from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor, ForceSensor
from pybricks.parameters import Button, Color, Direction, Port, Side, Stop
from pybricks.robotics import DriveBase
from pybricks.tools import wait, StopWatch

hub = PrimeHub()

`;
  const INIT = STARTER + `# --- Αρχικοποίηση ---
left_motor = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right_motor = Motor(Port.B)
left_sensor = ColorSensor(Port.C)
right_sensor = ColorSensor(Port.D)
robot = DriveBase(left_motor, right_motor, wheel_diameter=56, axle_track=112)
robot.use_gyro(True)

# --- Σταθερές ---
TARGET = 50
SPEED = 150

`;
  const FORWARD = `# --- Μπροστά μέχρι τη γραμμή ---
robot.drive(SPEED, 0)
while True:
    if left_sensor.reflection() < TARGET:
        break
robot.stop()
`;
  const BACK = `robot.reset()
robot.straight(-60)
robot.drive(-SPEED, 0)
while True:
    if left_sensor.reflection() < TARGET:
        break
robot.stop()
`;
  const code = t => "<pre>" + t.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>";

  const TASKS = [
    // ───────────────────────── 1 ─────────────────────────
    {
      id: "to-line",
      title: "Μπροστά μέχρι τη γραμμή",
      desc: "<p><b>Αρχή:</b> λευκή πίστα με ένα τετράγωνο από μαύρη γραμμή πάχους 20 mm. Το ρομπότ είναι στο κέντρο του τετραγώνου και κοιτάζει οριζόντια προς μία πλευρά.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ κινείται προς τα εμπρός μέχρι να ανιχνεύσει τη γραμμή και σταματά πάνω της.</p>",
      build(rnd) { const side = pick(rnd, 440, 560, 20); return { mat: rectMat(side, side), start: { x: CX, y: CY, heading: 0 }, info: { side: side - 20 } }; },
      hints: [
        "Κοίτα κάτω από την πίστα τις τιμές των αισθητήρων C και D (reflection %). Πόσο δείχνουν στο λευκό; Πόσο θα δείχνουν στο μαύρο; Διάλεξε ένα όριο ανάμεσα.",
        "Αρχικοποίηση: δύο <code>Motor</code> (το A κοιτάει ανάποδα, θέλει <code>Direction.COUNTERCLOCKWISE</code>), έναν <code>ColorSensor</code> και ένα <code>DriveBase</code> με διάμετρο ρόδας και μετατρόχιο από την κάρτα του ρομπότ.",
        "Τρία βήματα: ξεκίνα με <code>robot.drive(ταχύτητα, 0)</code>, περίμενε σε βρόχο μέχρι η ανάκλαση να πέσει κάτω από το όριο, σταμάτα με <code>robot.stop()</code>.",
        "Ο βρόχος αναμονής:" + code("robot.drive(SPEED, 0)\nwhile True:\n    if left_sensor.reflection() < TARGET:\n        break\nrobot.stop()")
      ],
      solution: INIT + FORWARD,
      evaluate(sim, run) {
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: run.finished && !sim.moving() && sim.odo > 50 && sensorLineDist(sim) <= 22, text: "Το ρομπότ σταμάτησε με αισθητήρα πάνω στη γραμμή" },
          { ok: sim.maxOut <= 30, text: "Δεν πέρασε τη γραμμή" }
        ];
      }
    },
    // ───────────────────────── 2 ─────────────────────────
    {
      id: "square-side",
      title: "Μέτρα την πλευρά του τετραγώνου",
      desc: "<p><b>Αρχή:</b> όπως πριν — τετράγωνο από μαύρη γραμμή 20 mm, ρομπότ στο κέντρο, κοιτάζει οριζόντια προς μία πλευρά.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ μετρά το μήκος μιας πλευράς του τετραγώνου (εσωτερικά, από μαύρο σε μαύρο) και το εμφανίζει με <code>print</code> σε mm.</p>" +
            "<p class=\"note\">Το μέγεθος αλλάζει σε κάθε εκτέλεση: πρέπει να το μετρήσει το ρομπότ, δεν γίνεται να το ξέρεις από πριν.</p>",
      build(rnd) { const side = pick(rnd, 440, 560, 20); return { mat: rectMat(side, side), start: { x: CX, y: CY, heading: 0 }, info: { side: side - 20 } }; },
      hints: [
        "Σχέδιο: πήγαινε μπροστά μέχρι τη γραμμή, μηδένισε την απόσταση, πήγαινε προς τα <b>πίσω</b> μέχρι την απέναντι γραμμή και διάβασε πόσο διένυσες.",
        "Μηδενισμός: <code>robot.reset()</code>. Διάβασμα: <code>robot.distance()</code>. Προς τα πίσω η απόσταση βγαίνει αρνητική — χρησιμοποίησε <code>abs()</code>.",
        "Παγίδα: όταν σταματήσεις, ο αισθητήρας είναι ήδη πάνω στο μαύρο. Αν ψάξεις αμέσως για μαύρο, θα το «βρει» επιτόπου. Φύγε πρώτα από τη γραμμή: <code>robot.straight(-60)</code>.",
        "Το δεύτερο μισό:" + code("robot.reset()\nrobot.straight(-60)\nrobot.drive(-SPEED, 0)\nwhile True:\n    if left_sensor.reflection() < TARGET:\n        break\nrobot.stop()\nside = abs(robot.distance())\nprint(side)")
      ],
      solution: INIT + FORWARD + "\n# --- Πίσω μέχρι την απέναντι γραμμή ---\n" + BACK + "side = abs(robot.distance())\nprint(side)\n",
      evaluate(sim, run) {
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: run.finished && numbers(run.output).some(n => Math.abs(n - sim.info.side) <= 12), text: "Τύπωσε τη σωστή πλευρά (±12 mm)" }
        ];
      }
    },
    // ───────────────────────── 3 ─────────────────────────
    {
      id: "rect-perimeter",
      title: "Μέτρα την περίμετρο του ορθογωνίου",
      desc: "<p><b>Αρχή:</b> ορθογώνιο (όχι τετράγωνο) από μαύρη γραμμή 20 mm. Το ρομπότ είναι στο κέντρο και κοιτάζει οριζόντια προς μία πλευρά.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ μετρά την περίμετρο του ορθογωνίου (εσωτερικά) και την εμφανίζει με <code>print</code> σε mm. Χρησιμοποίησε το γυροσκόπιο για τη στροφή.</p>" +
            "<p class=\"note\">Οι διαστάσεις αλλάζουν σε κάθε εκτέλεση.</p>",
      build(rnd) {
        const w = pick(rnd, 760, 1000, 40), h = pick(rnd, 340, 440, 20);
        return { mat: rectMat(w, h), start: { x: CX, y: CY, heading: 0 }, info: { w: w - 20, h: h - 20 } };
      },
      hints: [
        "Περίμετρος = 2 × (μήκος + πλάτος). Το μήκος το μετράς όπως στην πρόκληση 2. Μετά στρίβεις 90° και μετράς με τον ίδιο τρόπο το πλάτος.",
        "Γυροσκόπιο: γράψε <code>robot.use_gyro(True)</code> αμέσως μετά το <code>DriveBase(...)</code>. Χωρίς αυτό οι ρόδες γλιστρούν και το <code>robot.turn(90)</code> βγαίνει μικρότερο από 90°.",
        "Μη στρίψεις πάνω στη γραμμή. Μετά την πρώτη μέτρηση γύρνα προς το κέντρο, π.χ. <code>robot.straight(length / 2)</code>, και εκεί <code>robot.turn(90)</code>.",
        "Κράτα κάθε μέτρηση σε δική της μεταβλητή:" + code("length = abs(robot.distance())\nrobot.straight(length / 2)\nrobot.turn(90)\n# ... ίδια μέτρηση ξανά ...\nwidth = abs(robot.distance())\nprint(2 * (length + width))")
      ],
      solution: INIT + FORWARD + "\n# --- Μήκος ---\n" + BACK + "length = abs(robot.distance())\n\n# --- Στο κέντρο, στροφή 90 ---\nrobot.straight(length / 2)\nrobot.turn(90)\n\n" +
        FORWARD + "\n# --- Πλάτος ---\n" + BACK + "width = abs(robot.distance())\n\nprint(2 * (length + width))\n",
      evaluate(sim, run) {
        const target = 2 * (sim.info.w + sim.info.h);
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: sim.usedGyro, text: "Χρησιμοποίησε το γυροσκόπιο (use_gyro)" },
          { ok: run.finished && numbers(run.output).some(n => Math.abs(n - target) <= 35), text: "Τύπωσε τη σωστή περίμετρο (±35 mm)" }
        ];
      }
    },
    // ───────────────────────── 4 ─────────────────────────
    {
      id: "rect-area",
      title: "Λοξή εκκίνηση: μέτρα το εμβαδό",
      desc: "<p><b>Αρχή:</b> ορθογώνιο από μαύρη γραμμή 20 mm. Το ρομπότ είναι στο κέντρο αλλά κοιτάζει λοξά, περίπου 40° ως προς τις γραμμές.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ μετρά το εμβαδό του ορθογωνίου (εσωτερικά) και το εμφανίζει με <code>print</code> σε mm². Χρησιμοποίησε το γυροσκόπιο.</p>" +
            "<p class=\"note\">Οι διαστάσεις και η γωνία εκκίνησης αλλάζουν σε κάθε εκτέλεση.</p>",
      build(rnd) {
        // γωνία/διαστάσεις έτσι ώστε το ρομπότ να συναντά τη μακριά πλευρά μακριά από τις γωνίες
        const w = pick(rnd, 800, 960, 40), h = pick(rnd, 340, 420, 20), a = pick(rnd, 40, 48, 1) * (rnd() < 0.5 ? -1 : 1);
        return { mat: rectMat(w, h), start: { x: CX, y: CY, heading: a }, info: { w: w - 20, h: h - 20 } };
      },
      hints: [
        "Εμβαδό = μήκος × πλάτος. Λοξά όμως δεν μετράς σωστά: πρώτα το ρομπότ πρέπει να ευθυγραμμιστεί κάθετα πάνω σε μια γραμμή. Μετά συνεχίζεις όπως στην πρόκληση 3.",
        "Πρώτα γρήγορη προσέγγιση: <code>robot.drive(SPEED, 0)</code> μέχρι <b>ο ένας από τους δύο</b> αισθητήρες να δει μαύρο (<code>or</code>), και <code>robot.stop()</code>.",
        "Ευθυγράμμιση = δύο ανεξάρτητοι αναλογικοί έλεγχοι, ένας για κάθε μοτέρ. Το αριστερό μοτέρ κοιτάζει μόνο τον αριστερό αισθητήρα, το δεξί μόνο τον δεξιό: λευκό → μπροστά, μαύρο → πίσω, πάνω στην άκρη → ακίνητο. Τέλος όταν και τα δύο σφάλματα είναι μικρά (ή περάσει ο χρόνος ασφαλείας).",
        "Η ευθυγράμμιση σε κώδικα:" + code("watch = StopWatch()\nwhile True:\n    left_error = left_sensor.reflection() - TARGET\n    right_error = right_sensor.reflection() - TARGET\n    left_motor.run(KP_ALIGN * left_error)\n    right_motor.run(KP_ALIGN * right_error)\n    if abs(left_error) < 3 and abs(right_error) < 3:\n        break\n    if watch.time() > 4000:\n        break\nleft_motor.hold()\nright_motor.hold()"),
        "Μετά την ευθυγράμμιση είσαι πάνω στη γραμμή και κάθετα: <code>robot.reset()</code>, πίσω μέχρι την απέναντι γραμμή (πρώτη διάσταση), γύρνα στο κέντρο, <code>robot.turn(90)</code> και μέτρα τη δεύτερη."
      ],
      solution: INIT + `# --- Γρήγορη προσέγγιση: μέχρι ο ένας από τους δύο αισθητήρες να δει τη γραμμή ---
robot.drive(SPEED, 0)
while True:
    if left_sensor.reflection() < TARGET or right_sensor.reflection() < TARGET:
        break
robot.stop()

# --- Ευθυγράμμιση: κάθε μοτέρ ψάχνει την άκρη της γραμμής με τον δικό του αισθητήρα ---
KP_ALIGN = 4
watch = StopWatch()
while True:
    left_error = left_sensor.reflection() - TARGET
    right_error = right_sensor.reflection() - TARGET
    left_motor.run(KP_ALIGN * left_error)
    right_motor.run(KP_ALIGN * right_error)
    if abs(left_error) < 3 and abs(right_error) < 3:
        break
    if watch.time() > 4000:
        break
left_motor.hold()
right_motor.hold()

# --- Πρώτη διάσταση ---
` + BACK + "first = abs(robot.distance())\n\n# --- Στο κέντρο, στροφή 90 ---\nrobot.straight(first / 2)\nrobot.turn(90)\n\n" +
        FORWARD + "\n# --- Δεύτερη διάσταση ---\n" + BACK + "second = abs(robot.distance())\n\nprint(first * second)\n",
      evaluate(sim, run) {
        const target = sim.info.w * sim.info.h;
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: sim.usedGyro, text: "Χρησιμοποίησε το γυροσκόπιο (use_gyro)" },
          { ok: run.finished && numbers(run.output).some(n => Math.abs(n - target) <= 0.04 * target), text: "Τύπωσε το σωστό εμβαδό (±4%)" }
        ];
      }
    },
    // ───────────────────────── 5 ─────────────────────────
    {
      id: "line-until-red",
      title: "Ακολούθησε τη γραμμή μέχρι το κόκκινο",
      desc: "<p><b>Αρχή:</b> μαύρη καμπύλη γραμμή με ένα πράσινο και ένα κόκκινο σημάδι. Ο αριστερός αισθητήρας είναι πάνω στην αριστερή άκρη της γραμμής.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ ακολουθεί την άκρη της γραμμής με τον <b>αριστερό</b> αισθητήρα (αναλογικός έλεγχος), σταματά όταν ο <b>δεξιός</b> δει <b>κόκκινο</b> — όχι στο πράσινο — και εμφανίζει με <code>print</code> την απόσταση που διένυσε σε mm.</p>",
      build() {
        return {
          mat: Object.assign({
            line: [[160, 690], [480, 690], [710, 640], [840, 500], [890, 340], [1000, 205], [1170, 155], [1340, 230], [1400, 400], [1370, 580], [1370, 700]],
            marks: [{ s: 760, color: "GREEN", length: 40, width: 150 }, { s: -90, color: "RED", length: 40, width: 150 }]
          }, MAT),
          start: { x: 180, y: 704, heading: 0 }
        };
      },
      hints: [
        "Αναλογικός έλεγχος: όσο πιο πολύ λευκό βλέπει ο αισθητήρας, τόσο πιο πολύ στρίβεις προς τη γραμμή· όσο πιο πολύ μαύρο, τόσο πιο πολύ στρίβεις μακριά της.",
        "Σφάλμα = ανάκλαση − στόχος (ο στόχος είναι η τιμή πάνω στην άκρη, ανάμεσα σε λευκό και μαύρο). Στροφή = KP × σφάλμα, μέσα σε βρόχο: <code>robot.drive(SPEED, KP * error)</code>.",
        "Έξοδος από τον βρόχο: <code>if right_sensor.color() == Color.RED: break</code>. Πριν τον βρόχο <code>robot.reset()</code>, μετά <code>robot.stop()</code> και <code>print(robot.distance())</code>.",
        "Ο βρόχος:" + code("robot.reset()\nwhile True:\n    error = left_sensor.reflection() - TARGET\n    robot.drive(SPEED, KP * error)\n    if right_sensor.color() == Color.RED:\n        break\nrobot.stop()\nprint(robot.distance())")
      ],
      solution: INIT + `KP = 1.5

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
      evaluate(sim, run) {
        const red = sim.mat.marks.find(m => m.color === "RED");
        const onRed = ["C", "D"].some(p => sim.read(p).name === "RED");
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: sim.maxS > red.s - 60 && sim.maxDev < 60, text: "Ακολούθησε τη γραμμή χωρίς να τη χάσει" },
          { ok: run.finished && onRed && !sim.moving(), text: "Σταμάτησε πάνω στο κόκκινο" },
          { ok: run.finished && numbers(run.output).some(n => Math.abs(n - sim.odo) <= 35), text: "Τύπωσε τη σωστή απόσταση (±35 mm)" }
        ];
      }
    }
  ];

  P.STARTER = STARTER;
  TASKS.forEach(t => P.TASKS.push(t));
})(typeof globalThis !== "undefined" ? globalThis : this);
