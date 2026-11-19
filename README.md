# Pybricks απέξω — ROBOTONIO UML

Σελίδα εξάσκησης: ο μαθητής γράφει από μνήμης κώδικα Pybricks και τον βλέπει να τρέχει
σε προσομοιωμένο SPIKE Prime (2 μοτέρ, 2 αισθητήρες χρώματος) πάνω σε πίστα.
Στατική σελίδα, χωρίς server και χωρίς build.

## Δημοσίευση σε GitHub Pages
1. Νέο repository (π.χ. `pybricks-drill`) και ανέβασμα όλων των αρχείων του φακέλου στη ρίζα του.
2. Settings → Pages → Source: «Deploy from a branch» → Branch `main`, φάκελος `/ (root)` → Save.
3. Σε 1–2 λεπτά η σελίδα είναι στο `https://<org>.github.io/pybricks-drill/`.

Τοπικά ανοίγει και με διπλό κλικ στο `index.html`.

## Αρχεία
- `index.html` — σελίδα και εμφάνιση
- `js/sim.js` — ρομπότ (`ROBOT`), πίστα, φυσική, βιβλιοθήκη `pybricks`, αποστολές (`TASKS`)
- `js/app.js` — editor, καμβάς, έλεγχος αποστολής
- `lib/` — Skulpt 1.2.0 (Python στον browser, άδεια MIT)

## Αλλαγές
- **Ρομπότ:** αντικείμενο `ROBOT` στην αρχή του `js/sim.js` (θύρες, διάμετρος τροχού, μετατρόχιο, θέση αισθητήρων).
- **Νέα αποστολή:** νέο αντικείμενο στον πίνακα `TASKS` του `js/sim.js` — σημεία γραμμής (mm), χρωματιστά σημάδια,
  θέση εκκίνησης, `solution` / `gaps` / `outline`, και συνάρτηση `evaluate` με τα κριτήρια επιτυχίας.
  (Η σελίδα δείχνει προς το παρόν την πρώτη αποστολή του πίνακα.)

## Τι υποστηρίζει ο προσομοιωτής
`PrimeHub` (light, display, speaker.beep, imu.heading), `Motor` (run, dc, stop, brake, hold, angle, speed,
reset_angle, run_time, run_angle, run_target), `ColorSensor` (color, reflection, hsv, ambient),
`DriveBase` (drive, stop, brake, straight, turn, distance, angle, reset, settings, state),
`wait`, `StopWatch`, `Port`, `Direction`, `Color`, `Stop`, `Button`.
