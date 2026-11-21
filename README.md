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

## Έκδοση Blocks
Με το κουμπί **Blocks** πάνω δεξιά (ή `?blocks=1` στη διεύθυνση) ο μαθητής δεν πληκτρολογεί: φτιάχνει το πρόγραμμα
με blocks στο Pybricks, κατεβάζει το αρχείο `.py` του προγράμματος και το φορτώνει εδώ («Φόρτωσε αρχείο από Pybricks»,
σύρσιμο στη σελίδα, ή επικόλληση της Python που δείχνει το Pybricks). Το setup των blocks πρέπει να ταιριάζει με το
ρομπότ της σελίδας (θύρες, ρόδα, μετατρόχιο).

## Λειτουργία καθηγητή
`?teacher=1` στη διεύθυνση, ή διπλό κλικ στο «ROBOTONIO · UML» πάνω αριστερά (εναλλακτικά Ctrl+Shift+L):
επιτρέπεται η επικόλληση και εμφανίζεται «Φόρτωσε λύση». (Οι προκλήσεις είναι όλες ανοιχτές για όλους.)

## Τι προσομοιώνεται
- Το ρομπότ δεν είναι ιδανικό: ο δεξιός τροχός χάνει 1% και στις στροφές υπάρχει 8% ολίσθηση
  (`driftRight`, `turnScrub` στο `ROBOT`). Χωρίς `use_gyro(True)` το `turn(90)` βγαίνει περίπου 83°.
- Η βιβλιοθήκη `pybricks` ακολουθεί την τεκμηρίωση της τρέχουσας έκδοσης (docs.pybricks.com, «latest»):
  `DriveBase` (straight, turn με `absolute`, arc/curve, drive, stop/brake/hold, distance, angle, state, reset, settings,
  done, stalled, use_gyro, και `wait=False`), `Motor` (run, dc, run_time, run_angle, run_target, track_target,
  run_until_stalled, stop/brake/hold, angle, speed, reset_angle, done, load, stalled, settings, control),
  `ColorSensor`, `PrimeHub` (light, display με `Icon`, speaker με πραγματικό ήχο για `beep` και `play_notes`, imu, buttons, battery, charger, system),
  `wait`, `StopWatch`, `hub_menu`, `Port`, `Direction`, `Color`, `Stop`, `Button`, `Side`, `Axis`, `Icon`, `umath`, `urandom`.
- Δεν υπάρχουν: multitasking (`async`/`await`, `multitask`, `run_task`), `move_by`, `Car`, αισθητήρες πέρα από τον `ColorSensor`,
  τουβλάκια που σπρώχνονται. Οι επιταχύνσεις, το `then=` και οι ρυθμίσεις PID γίνονται δεκτά αλλά αγνοούνται.
