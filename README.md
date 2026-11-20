# Προκλήσεις Pybricks — ROBOTONIO UML

Σελίδα εξάσκησης: ο μαθητής γράφει κώδικα Pybricks και τον βλέπει να τρέχει σε προσομοιωμένο SPIKE Prime
(2 μοτέρ, 2 αισθητήρες χρώματος, γυροσκόπιο) σε μια σειρά προκλήσεων αυξανόμενης δυσκολίας.
Ο κώδικας μένει ο ίδιος από πρόκληση σε πρόκληση. Στατική σελίδα, χωρίς server και χωρίς build.

## Δημοσίευση σε GitHub Pages
1. Νέο public repository (π.χ. `pybricks-drill`) και ανέβασμα όλων των αρχείων του φακέλου στη ρίζα του.
2. Settings → Pages → Source: «Deploy from a branch» → Branch `main`, φάκελος `/ (root)` → Save.
3. Σε 1–2 λεπτά η σελίδα είναι στο `https://<org>.github.io/pybricks-drill/`.

Τοπικά ανοίγει και με διπλό κλικ στο `index.html`.

## Αρχεία
- `index.html` — σελίδα και εμφάνιση
- `js/tasks.js` — **οι προκλήσεις**: περιγραφή, πίστα, υποδείξεις, λύση, κριτήρια επιτυχίας
- `js/sim.js` — ρομπότ (`ROBOT`), φυσική, πίστα, βιβλιοθήκη `pybricks`
- `js/app.js` — editor, καμβάς, βήματα, υποδείξεις
- `lib/` — Skulpt 1.2.0 (Python στον browser, άδεια MIT)

## Νέα πρόκληση
Προσθέστε ένα αντικείμενο στον πίνακα `TASKS` του `js/tasks.js`:
`title`, `desc` (HTML), `build(rnd)` που επιστρέφει πίστα και θέση εκκίνησης (με `rnd()` για τυχαίες διαστάσεις),
`hints` (εμφανίζονται μία-μία), `solution`, `evaluate(sim, run)` που επιστρέφει τους ελέγχους.
Η πίστα περιγράφεται με `rect` (ορθογώνιο από γραμμή), `line` (καμπύλη από σημεία) και `marks` (χρωματιστά σημάδια).

## Λειτουργία καθηγητή
`?teacher=1` στη διεύθυνση, ή διπλό κλικ στο «ROBOTONIO · UML» πάνω αριστερά (εναλλακτικά Ctrl+Shift+L):
επιτρέπεται η επικόλληση, εμφανίζεται «Φόρτωσε λύση» και ξεκλειδώνουν όλες οι προκλήσεις.

## Τι προσομοιώνεται
- Το ρομπότ δεν είναι ιδανικό: ο δεξιός τροχός χάνει 1% και στις στροφές υπάρχει 8% ολίσθηση
  (`driftRight`, `turnScrub` στο `ROBOT`). Χωρίς `use_gyro(True)` το `turn(90)` βγαίνει περίπου 83°.
- `PrimeHub` (light, display, speaker.beep, imu.heading/reset_heading), `Motor` (run, dc, stop, brake, hold, angle,
  speed, reset_angle, run_time, run_angle, run_target), `ColorSensor` (color, reflection, hsv, ambient),
  `DriveBase` (drive, stop, brake, straight, turn, distance, angle, reset, settings, state, use_gyro),
  `wait`, `StopWatch`, `Port`, `Direction`, `Color`, `Stop`, `Button`, `Side`.
- Δεν υπάρχουν ακόμα: τουβλάκια που σπρώχνονται, `curve`, `multitask`, `UltrasonicSensor`, blocks.
