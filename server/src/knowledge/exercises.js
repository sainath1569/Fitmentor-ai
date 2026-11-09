// equipment: any one of these makes the exercise possible. "none" means bodyweight.
// avoid: injury areas that rule the exercise out.
// quiet: no jumping, safe for an upper-floor hostel room.
const e = (id, name, pattern, equipment, level, reps, cue, avoid = [], quiet = true) => ({
  id, name, pattern, equipment, level, reps, cue, avoid, quiet,
});

export const exercises = [
  // Push
  e('incline-pushup', 'Incline push-up on bed frame', 'push', ['none'], 1, '8-12', 'Hands on a sturdy bed edge, body in one straight line.', ['wrist']),
  e('pushup', 'Push-up', 'push', ['none'], 2, '8-15', 'Lower your chest to a fist above the floor.', ['wrist', 'shoulder']),
  e('decline-pushup', 'Feet-raised push-up', 'push', ['none'], 3, '6-12', 'Feet on the bed, keep your ribs down.', ['wrist', 'shoulder']),
  e('pike-pushup', 'Pike push-up', 'push', ['none'], 3, '6-10', 'Hips high, lower your head between your hands.', ['wrist', 'shoulder']),
  e('band-press', 'Band chest press', 'push', ['bands'], 1, '10-15', 'Anchor the band behind you and press straight ahead.', ['shoulder']),
  e('db-floor-press', 'Dumbbell floor press', 'push', ['dumbbells'], 1, '8-12', 'Pause your elbows on the floor each rep.'),
  e('db-shoulder-press', 'Dumbbell shoulder press', 'push', ['dumbbells', 'gym'], 2, '8-12', 'Squeeze your glutes so your back does not arch.', ['shoulder']),
  e('bench-press', 'Bench press', 'push', ['gym'], 2, '6-10', 'Shoulder blades pinched, bar to lower chest.', ['shoulder']),
  e('machine-press', 'Machine chest press', 'push', ['gym'], 1, '10-12', 'Set the handles level with mid-chest.'),
  // Pull
  e('towel-row', 'Towel door row', 'pull', ['none'], 1, '10-15', 'Loop a towel on a solid door handle and lean back. Check the door first.', ['shoulder']),
  e('table-row', 'Under-table row', 'pull', ['none'], 2, '6-12', 'Use a heavy study table only. Pull your chest to the edge.', ['shoulder']),
  e('backpack-row', 'Backpack row', 'pull', ['none'], 1, '10-15', 'Load your bag with books and row to your hip.', ['back']),
  e('band-row', 'Band row', 'pull', ['bands'], 1, '12-15', 'Squeeze your shoulder blades at the end.'),
  e('db-row', 'One-arm dumbbell row', 'pull', ['dumbbells', 'gym'], 1, '8-12', 'Support one hand on the bed and keep your back flat.'),
  e('negative-pullup', 'Slow pull-up lowering', 'pull', ['pullup_bar', 'gym'], 2, '3-6', 'Jump up, lower for five seconds.', ['shoulder', 'elbow'], false),
  e('pullup', 'Pull-up', 'pull', ['pullup_bar', 'gym'], 3, '4-10', 'Start from a dead hang, chest to the bar.', ['shoulder', 'elbow']),
  e('lat-pulldown', 'Lat pulldown', 'pull', ['gym'], 1, '8-12', 'Pull to your upper chest without leaning far back.'),
  e('cable-row', 'Seated cable row', 'pull', ['gym'], 1, '10-12', 'Chest tall, elbows brush your ribs.'),
  // Squat
  e('chair-squat', 'Sit-to-stand from chair', 'squat', ['none'], 1, '10-15', 'Touch the chair lightly and stand without rocking.'),
  e('bodyweight-squat', 'Bodyweight squat', 'squat', ['none'], 1, '12-20', 'Knees track over your toes.', ['knee']),
  e('split-squat', 'Split squat', 'squat', ['none'], 2, '8-12 each leg', 'Back knee lowers straight down.', ['knee']),
  e('bulgarian-split', 'Rear-foot-raised split squat', 'squat', ['none'], 3, '6-10 each leg', 'Back foot on the bed, chest slightly forward.', ['knee']),
  e('wall-sit', 'Wall sit', 'squat', ['none'], 1, '30-45 sec', 'Thighs level with the floor if your knees allow.'),
  e('goblet-squat', 'Goblet squat', 'squat', ['dumbbells', 'gym'], 2, '8-12', 'Hold the dumbbell at your chest and sit between your hips.', ['knee']),
  e('barbell-squat', 'Barbell back squat', 'squat', ['gym'], 3, '5-8', 'Brace first, then descend with control.', ['knee', 'back']),
  e('leg-press', 'Leg press', 'squat', ['gym'], 1, '10-12', 'Keep your lower back on the pad.', ['knee']),
  // Hinge
  e('glute-bridge', 'Glute bridge', 'hinge', ['none'], 1, '12-20', 'Press through your heels and pause at the top.'),
  e('single-leg-bridge', 'Single-leg glute bridge', 'hinge', ['none'], 2, '8-12 each leg', 'Keep your hips level.'),
  e('backpack-rdl', 'Backpack Romanian deadlift', 'hinge', ['none'], 2, '10-15', 'Push your hips back, bag close to your legs.', ['back']),
  e('band-good-morning', 'Band hip hinge', 'hinge', ['bands'], 1, '12-15', 'Stand on the band and hinge at the hips.', ['back']),
  e('db-rdl', 'Dumbbell Romanian deadlift', 'hinge', ['dumbbells', 'gym'], 2, '8-12', 'Feel your hamstrings stretch, keep your back flat.', ['back']),
  e('deadlift', 'Deadlift', 'hinge', ['gym'], 3, '4-6', 'Bar over mid-foot, push the floor away.', ['back']),
  e('leg-curl', 'Leg curl machine', 'hinge', ['gym'], 1, '10-12', 'Control the way back.'),
  // Core
  e('plank', 'Forearm plank', 'core', ['none'], 1, '20-45 sec', 'Squeeze your glutes and breathe.', ['shoulder']),
  e('dead-bug', 'Dead bug', 'core', ['none'], 1, '8-10 each side', 'Lower back stays pressed to the floor.'),
  e('side-plank', 'Side plank', 'core', ['none'], 2, '20-30 sec each side', 'Hips stay high.', ['shoulder']),
  e('hollow-hold', 'Hollow hold', 'core', ['none'], 3, '15-30 sec', 'Lower back glued to the floor.', ['back']),
  e('hanging-knee-raise', 'Hanging knee raise', 'core', ['pullup_bar', 'gym'], 2, '8-12', 'Curl your pelvis up, avoid swinging.', ['shoulder']),
  // Conditioning
  e('stair-climb', 'Hostel stair climb', 'cardio', ['none'], 1, '4-6 minutes', 'Walk up briskly and walk down slowly.', ['knee'], false),
  e('march', 'High-knee march', 'cardio', ['none'], 1, '2-3 minutes', 'Quiet feet, swing your arms.'),
  e('shadow-box', 'Shadow boxing', 'cardio', ['none'], 1, '2-3 minutes', 'Stay light and keep your hands up.'),
  e('jump-squat', 'Jump squat', 'cardio', ['none'], 3, '8-12', 'Land softly. Do this on the ground floor or outside.', ['knee', 'back'], false),
  e('burpee', 'Burpee', 'cardio', ['none'], 3, '6-10', 'Keep a pace you can hold. Do this outside your room.', ['knee', 'wrist', 'back'], false),
  e('skipping', 'Skipping rope', 'cardio', ['skipping_rope'], 2, '2-3 minutes', 'Small jumps from your ankles.', ['knee'], false),
];
