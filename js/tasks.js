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
  // ό,τι αριθμούς έδειξε ο μαθητής: με print ή στην οθόνη του hub
  const numbers = (run, sim) => ((run.output + " " + sim.shown.join(" ")).match(/-?\d+(\.\d+)?/g) || []).map(Number);
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
robot = DriveBase(left_motor, right_motor, wheel_diameter=64.2, axle_track=112)
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
            "<p><b>Στόχος:</b> το ρομπότ μετρά το μήκος μιας πλευράς του τετραγώνου (εσωτερικά, από μαύρο σε μαύρο) και το εμφανίζει με <code>print</code> ή στην οθόνη του hub σε mm.</p>" +
            "<p class=\"note\">Το μέγεθος αλλάζει σε κάθε εκτέλεση: πρέπει να το μετρήσει το ρομπότ, δεν γίνεται να το ξέρεις από πριν.</p>",
      build(rnd) { const side = pick(rnd, 440, 560, 20); return { mat: rectMat(side, side), start: { x: CX, y: CY, heading: 0 }, info: { side: side - 20 } }; },
      hints: [
        "Σχέδιο: πήγαινε μπροστά μέχρι τη γραμμή, μηδένισε την απόσταση, πήγαινε προς τα <b>πίσω</b> μέχρι την απέναντι γραμμή και διάβασε πόσο διένυσες.",
        "Μηδενισμός: <code>robot.reset()</code>. Διάβασμα: <code>robot.distance()</code>. Προς τα πίσω η απόσταση βγαίνει αρνητική — χρησιμοποίησε <code>abs()</code>. Στην οθόνη του hub: <code>hub.display.text(str(side))</code> δείχνει τα ψηφία ένα-ένα.",
        "Παγίδα: όταν σταματήσεις, ο αισθητήρας είναι ήδη πάνω στο μαύρο. Αν ψάξεις αμέσως για μαύρο, θα το «βρει» επιτόπου. Φύγε πρώτα από τη γραμμή: <code>robot.straight(-60)</code>.",
        "Το δεύτερο μισό:" + code("robot.reset()\nrobot.straight(-60)\nrobot.drive(-SPEED, 0)\nwhile True:\n    if left_sensor.reflection() < TARGET:\n        break\nrobot.stop()\nside = abs(robot.distance())\nprint(side)")
      ],
      solution: INIT + FORWARD + "\n# --- Πίσω μέχρι την απέναντι γραμμή ---\n" + BACK + "side = abs(robot.distance())\nprint(side)\nhub.display.text(str(side))\n",
      evaluate(sim, run) {
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: run.finished && numbers(run, sim).some(n => Math.abs(n - sim.info.side) <= 12), text: "Έδειξε τη σωστή πλευρά (±12 mm)" }
        ];
      }
    },
    // ───────────────────────── 3 ─────────────────────────
    {
      id: "rect-perimeter",
      title: "Μέτρα την περίμετρο του ορθογωνίου",
      desc: "<p><b>Αρχή:</b> ορθογώνιο (όχι τετράγωνο) από μαύρη γραμμή 20 mm. Το ρομπότ είναι στο κέντρο και κοιτάζει οριζόντια προς μία πλευρά.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ μετρά την περίμετρο του ορθογωνίου (εσωτερικά) και την εμφανίζει με <code>print</code> ή στην οθόνη του hub σε mm. Χρησιμοποίησε το γυροσκόπιο για τη στροφή.</p>" +
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
        FORWARD + "\n# --- Πλάτος ---\n" + BACK + "width = abs(robot.distance())\n\nperimeter = 2 * (length + width)\nprint(perimeter)\nhub.display.text(str(perimeter))\n",
      evaluate(sim, run) {
        const target = 2 * (sim.info.w + sim.info.h);
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: sim.usedGyro, text: "Χρησιμοποίησε το γυροσκόπιο (use_gyro)" },
          { ok: run.finished && numbers(run, sim).some(n => Math.abs(n - target) <= 35), text: "Έδειξε τη σωστή περίμετρο (±35 mm)" }
        ];
      }
    },
    // ───────────────────────── 4 ─────────────────────────
    {
      id: "rect-area",
      title: "Λοξή εκκίνηση: μέτρα το εμβαδό",
      desc: "<p><b>Αρχή:</b> ορθογώνιο από μαύρη γραμμή 20 mm. Το ρομπότ είναι στο κέντρο αλλά κοιτάζει λοξά, περίπου 40° ως προς τις γραμμές.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ μετρά το εμβαδό του ορθογωνίου (εσωτερικά) και το εμφανίζει με <code>print</code> ή στην οθόνη του hub σε mm². Χρησιμοποίησε το γυροσκόπιο.</p>" +
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
        FORWARD + "\n# --- Δεύτερη διάσταση ---\n" + BACK + "second = abs(robot.distance())\n\narea = first * second\nprint(area)\nhub.display.text(str(area))\n",
      evaluate(sim, run) {
        const target = sim.info.w * sim.info.h;
        return [
          { ok: run.finished, text: "Το πρόγραμμα τελείωσε χωρίς σφάλμα" },
          { ok: sim.usedGyro, text: "Χρησιμοποίησε το γυροσκόπιο (use_gyro)" },
          { ok: run.finished && numbers(run, sim).some(n => Math.abs(n - target) <= 0.04 * target), text: "Έδειξε το σωστό εμβαδό (±4%)" }
        ];
      }
    },
    // ───────────────────────── 5 ─────────────────────────
    {
      id: "line-until-red",
      title: "Ακολούθησε τη γραμμή μέχρι το κόκκινο",
      desc: "<p><b>Αρχή:</b> μαύρη καμπύλη γραμμή με ένα πράσινο και ένα κόκκινο σημάδι. Ο αριστερός αισθητήρας είναι πάνω στην αριστερή άκρη της γραμμής.</p>" +
            "<p><b>Στόχος:</b> το ρομπότ ακολουθεί την άκρη της γραμμής με τον <b>αριστερό</b> αισθητήρα (αναλογικός έλεγχος), σταματά όταν ο <b>δεξιός</b> δει <b>κόκκινο</b> — όχι στο πράσινο — και εμφανίζει με <code>print</code> ή στην οθόνη του hub την απόσταση που διένυσε σε mm.</p>",
      build() {
        return {
          mat: Object.assign({
            line: [[160, 690], [480, 690], [710, 640], [840, 500], [890, 340], [1000, 205], [1170, 155], [1340, 230], [1400, 400], [1370, 580], [1370, 700]],
            marks: [{ s: 760, color: "GREEN", length: 40, width: 150 }, { s: -90, color: "RED", length: 40, width: 150 }]
          }, MAT),
          start: { x: 180, y: 706, heading: 0 }
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
          { ok: run.finished && numbers(run, sim).some(n => Math.abs(n - sim.odo) <= 35), text: "Έδειξε τη σωστή απόσταση (±35 mm)" }
        ];
      }
    }
    ,
    // ───────────────────────── 6 · πλήρης αποστολή ─────────────────────────
    {
      id: "robo-pet-care",
      tab: "🏆 Robo Pet Care",
      title: "UMC Robo Pet Care Junior (προσαρμογή ROBOTONIO)",
      timeLimit: 120000, passScore: 60,
      desc: "<p><b>Πεδίο:</b> 125 × 75 cm, υπερυψωμένο — αν βγει ρόδα έξω από την άκρη, το ρομπότ πέφτει και το run τελειώνει. " +
            "Η Γραμμή Εκκίνησης είναι σε άγνωστη απόσταση <b>X = 48–62 cm</b> από τη δυτική άκρη και ο μαύρος δίσκος έχει άγνωστη διάμετρο <b>20–30 cm</b> (το δεξί του άκρο απέχει πάντα 20 cm από την ανατολική άκρη). Όλες οι θέσεις αλλάζουν έως ±2 cm σε κάθε εκτέλεση.</p>" +
            "<p><b>Εκκίνηση:</b> κάποιο μέρος του ρομπότ πάνω από τη Γραμμή Εκκίνησης, με το μπροστινό μέρος προς τα δυτικά (αριστερά). Μπορείς να σύρεις το ρομπότ όπου θέλεις πάνω στη γραμμή. Έχεις <b>2 λεπτά</b>.</p>" +
            "<p><b>Αποστολές</b> (με όποια σειρά θέλεις): κόκκινοι κύβοι πάνω στον μαύρο δίσκο · πορτοκαλί κομμάτια στην Άμμο · σκύλος στο πράσινο πάρκο · μπάλες κάτω από τους πύργους, χωρίς να ακουμπήσεις τον πύργο · γάτα a (πορτοκαλί) στον Καλλωπιστή, γάτα b (λευκή) στον Κτηνίατρο · εμφάνισε την απόσταση X και τη διάμετρο του δίσκου · σταμάτα μόνος σου πάνω από τη Γραμμή Εκκίνησης.</p>" +
            "<p class=\"note\">Εξαρτήματα: <code>Motor(Port.E)</code> ρίχνει το καπάκι του πιρουνιού (0° όρθιο = ανοιχτό, 90° πεσμένο = κλειστό) · <code>Motor(Port.F)</code> γυρίζει τη δοκό που ρίχνει τις μπάλες (0° μπροστά, 90° δεξιά, −90° αριστερά). Έξω από την άκρη του πεδίου ο αισθητήρας βλέπει σκοτάδι (ανάκλαση ≈ 0).</p>",
      build(rnd) {
        const j = () => Math.round((rnd() * 2 - 1) * 20);
        const X = 480 + Math.round(rnd() * 140), R = 100 + Math.round(rnd() * 50);
        const obj = (id, kind, x, y, r, color) => ({ id, kind, x: x + j(), y: y + j(), r, color });
        return {
          mat: {
            width: 1250, height: 750, lineWidth: 20, outside: "void", view: { x: -90, y: -90, w: 1430, h: 930 },
            segs: [{ x: 295, y: 0, w: 10, h: 200 }, { x: 295, y: 550, w: 10, h: 200 }, { x: X - 5, y: 0, w: 10, h: 750 }, { x: 1050, y: 345, w: 200, h: 10 }],
            disk: { cx: 1050 - R, cy: 350, r: R },
            zones: [{ x: 100, y: 600, w: 110, h: 110, color: "PARK" }]
          },
          world: {
            objs: [obj("letter1", "letter", 100, 300, 17, "RED"), obj("letter2", "letter", 100, 500, 17, "RED"),
                   obj("dog", "dog", 100, 100, 17, "BROWN"), obj("cat_a", "cat", 1000, 600, 17, "ORANGE"), obj("cat_b", "cat", 1100, 600, 17, "WHITE"),
                   obj("litter1", "litter", 850, 50, 11, "ORANGE"), obj("litter2", "litter", 950, 50, 11, "ORANGE"), obj("litter3", "litter", 900, 100, 11, "ORANGE")],
            towers: [{ id: "north", x: 300, y: 40 }, { id: "east", x: 1210, y: 350 }],
            containers: [{ id: "litter", label: "Άμμος", side: "N", x0: 800, x1: 1000, color: "YELLOW" },
                         { id: "groomer", label: "Καλλωπιστής", side: "S", x0: 200, x1: 400, color: "PARK" },
                         { id: "vet", label: "Κτηνίατρος", side: "S", x0: 800, x1: 1000, color: "PARK" }]
          },
          start: { x: X + 100, y: 400, heading: 180 }, anchor: { x: X, y: 0 }, info: { X, D: 2 * R }
        };
      },
      hints: [
        "Μην τα κάνεις όλα μαζί. Διάλεξε πρώτα 2–3 αποστολές που είναι κοντά η μία στην άλλη και γράψε κάθε μία σε δικό της κομμάτι κώδικα. Σκέψου πόσους πόντους δίνει η καθεμία και πόσο ρίσκο έχει.",
        "Απόσταση X: ξεκίνα με τους αισθητήρες ανατολικά της γραμμής. Προχώρα δυτικά· όταν ο αισθητήρας δει τη γραμμή, <code>robot.reset()</code>. Συνέχισε μέχρι την άκρη του πεδίου (η ανάκλαση πέφτει σχεδόν στο 0) και διάβασε <code>robot.distance()</code>. Οι ρόδες είναι 60 mm πίσω από τους αισθητήρες, άρα δεν πέφτεις.",
        "Διάμετρος δίσκου: το δεξί άκρο του δίσκου είναι πάντα στα 1050 mm από τη δυτική άκρη. Αν ξέρεις σε ποιο x μπήκε ο αισθητήρας στο μαύρο, τότε διάμετρος = 1050 − x. Για να ξέρεις το x, μέτρα απόσταση από ένα σημείο που γνωρίζεις (π.χ. τη δυτική άκρη).",
        "Κύβοι: πέρασε το πιρούνι πάνω από τους δύο κύβους στη σειρά, κλείσε το καπάκι με <code>gate_motor.run_target(300, 90)</code>, πήγαινε στον δίσκο, άνοιξε με <code>gate_motor.run_target(300, 0)</code> και κάνε πίσω.",
        "Μπάλες: γύρνα τη δοκό στο πλάι, π.χ. <code>beam_motor.run_target(300, 90)</code>, και πέρνα δίπλα από τον πύργο έτσι ώστε η δοκός να περάσει πάνω από το κέντρο του, χωρίς το σώμα ή το πιρούνι να ακουμπήσει τη βάση (−20 πόντοι).",
        "Τέλος: γύρνα προς τη Γραμμή Εκκίνησης και σταμάτα όταν ο αισθητήρας τη δει. Το πρόγραμμα πρέπει να τελειώσει μόνο του πριν από τα 2 λεπτά."
      ],
      solution: STARTER + `# Λύση αναφοράς: X + διάμετρος + κύβοι στον δίσκο + αυτόνομος τερματισμός (61 πόντοι)

# --- Αρχικοποίηση ---
left_motor = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right_motor = Motor(Port.B)
left_sensor = ColorSensor(Port.C)
right_sensor = ColorSensor(Port.D)
gate_motor = Motor(Port.E)
beam_motor = Motor(Port.F)
robot = DriveBase(left_motor, right_motor, wheel_diameter=64.2, axle_track=112)
robot.use_gyro(True)

# --- Σταθερές ---
TARGET = 50
SPEED = 150
DISK_RIGHT_EDGE = 1050      # mm από τη δυτική άκρη (125 cm - 20 cm)
SENSOR_TO_AXLE = 60         # οι αισθητήρες είναι 60 mm μπροστά από τον άξονα

# --- 1. Απόσταση X: από τη Γραμμή Εκκίνησης μέχρι τη δυτική άκρη ---
robot.drive(SPEED, 0)
while True:
    if left_sensor.reflection() < TARGET:
        break
robot.reset()
robot.drive(SPEED, 0)
while True:
    if robot.distance() > 30 and left_sensor.reflection() < TARGET:
        break
edge = robot.distance()
robot.stop()
wait(300)
x_distance = edge - 5
print(x_distance)
hub.display.text(str(x_distance))

# --- 2. Πίσω, γύρω από τους κύβους, και στη στήλη τους από τα νότια ---
overshoot = robot.distance() - edge
robot.straight(-(240 + overshoot))
robot.turn(-90)
robot.straight(290)
robot.turn(90)
robot.straight(200)
robot.turn(90)

# --- 3. Οι δύο κύβοι μέσα στο πιρούνι, καπάκι κλειστό ---
robot.straight(290)
gate_motor.run_target(300, 90)

# --- 4. Ανατολικά μέχρι τον δίσκο: διάμετρος ---
robot.turn(90)
robot.reset()
robot.drive(SPEED, 0)
while True:
    if robot.distance() > x_distance - 100 and left_sensor.reflection() < TARGET:
        break
enter_x = 100 + SENSOR_TO_AXLE + robot.distance()
robot.stop()
diameter = DISK_RIGHT_EDGE - enter_x
print(diameter)
hub.display.text(str(diameter))

# --- 5. Οι κύβοι πάνω στον δίσκο ---
robot.straight(70)
gate_motor.run_target(300, 0)
robot.straight(-150)

# --- 6. Αυτόνομος τερματισμός πάνω στη Γραμμή Εκκίνησης ---
robot.drive(-SPEED, 0)
while True:
    if left_sensor.reflection() < TARGET:
        break
robot.stop()
`,
      evaluate(sim, run) {
        const W = sim.world, m = sim.mat, X = sim.info.X, D = sim.info.D, nums = numbers(run, sim);
        const near = (target) => nums.some(n => Math.abs(n - target) <= 20 || Math.abs(n * 10 - target) <= 20);
        const get = id => W.objs.find(o => o.id === id);
        const spans = pts => Math.min.apply(null, pts.map(q => q[0])) <= X + 5 && Math.max.apply(null, pts.map(q => q[0])) >= X - 5;
        // νόμιμη εκκίνηση: μέρος του ρομπότ πάνω από τη γραμμή, μπροστινό μέρος προς τα δυτικά
        const st = sim.start, h = st.heading * Math.PI / 180, tip = P.ROBOT.forkStart + P.ROBOT.forkLength;
        const startPts = [[-62, -69], [tip, -69], [tip, 69], [-62, 69]].map(q => [st.x + q[0] * Math.cos(h) - q[1] * Math.sin(h), 0]);
        const legal = spans(startPts) && Math.cos(h) < -0.96;
        const letters = ["letter1", "letter2"].filter(id => { const o = get(id); return o.state === "field" && Math.hypot(o.x - m.disk.cx, o.y - m.disk.cy) < m.disk.r + o.r; }).length;
        const litter = W.objs.filter(o => o.kind === "litter" && o.state === "litter").length;
        const dog = get("dog"), z = m.zones[0];
        const inside = dog.state === "field" && dog.x - dog.r >= z.x && dog.x + dog.r <= z.x + z.w && dog.y - dog.r >= z.y && dog.y + dog.r <= z.y + z.h;
        const partly = dog.state === "field" && dog.x + dog.r > z.x && dog.x - dog.r < z.x + z.w && dog.y + dog.r > z.y && dog.y - dog.r < z.y + z.h;
        const movedObj = o => o.state !== "field" || Math.hypot(o.x - o.x0, o.y - o.y0) > 10;
        const cat = (id, home) => get(id).state === home ? 10 : movedObj(get(id)) ? 5 : 0;
        const balls = W.towers.filter(t => !t.ball).length, hits = W.towers.filter(t => t.hit).length;
        const finish = run.finished && !sim.moving() && sim.travel > 100 && spans(sim.footprint());   // πρέπει να έχει κινηθεί
        const rows = [
          { text: "Γράμματα: κύβοι πάνω στον δίσκο (12 ο καθένας)", pts: letters * 12, max: 24 },
          { text: "Άμμος: κομμάτια μέσα στο δοχείο (3 το καθένα)", pts: litter * 3, max: 9 },
          { text: "Σκύλος: μέσα στο πάρκο 10 · εν μέρει 8 · μετακινήθηκε 4", pts: inside ? 10 : partly ? 8 : movedObj(dog) ? 4 : 0, max: 10 },
          { text: "Μπάλες πύργων (10 η καθεμία)", pts: balls * 10, max: 20 },
          { text: "Γάτα a στον Καλλωπιστή 10 · μετακινήθηκε 5", pts: cat("cat_a", "groomer"), max: 10 },
          { text: "Γάτα b στον Κτηνίατρο 10 · μετακινήθηκε 5", pts: cat("cat_b", "vet"), max: 10 },
          { text: "Αυτόνομος τερματισμός πάνω από τη Γραμμή Εκκίνησης", pts: finish ? 8 : 0, max: 8 },
          { text: "Μέτρηση X (±20 mm)", pts: near(X) ? 8 : 0, max: 8 },
          { text: "Ακεραιότητα ρομπότ (δεν έπεσε από το πεδίο)", pts: sim.fell ? 0 : 11, max: 11 },
          { text: "BONUS: διάμετρος δίσκου (±2 cm)", pts: near(D) ? 10 : 0, max: 10 },
          { text: "ΠΟΙΝΗ: πύργος που ακούμπησε το ρομπότ (−20 ο καθένας)", pts: -20 * hits, max: 0, penalty: true }
        ];
        if (!legal) rows.unshift({ text: "ΑΚΥΡΟ: παράνομη εκκίνηση — το ρομπότ πρέπει να πατά στη Γραμμή Εκκίνησης και να κοιτάζει δυτικά", pts: 0, max: 0, penalty: true, bad: true });
        rows.forEach(r => { r.ok = r.bad ? false : r.penalty ? r.pts === 0 : r.pts > 0; });
        rows.score = legal ? Math.max(0, rows.reduce((a, r) => a + r.pts, 0)) : 0;
        rows.maxScore = 120; rows.truth = "X = " + X + " mm · διάμετρος = " + D + " mm";
        return rows;
      }
    }
  ];

  P.STARTER = STARTER;
  TASKS.forEach(t => P.TASKS.push(t));
})(typeof globalThis !== "undefined" ? globalThis : this);
