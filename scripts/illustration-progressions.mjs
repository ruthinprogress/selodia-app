// A PROGRESSION IS DRAWN AS A WHOLE SET, EVEN THE STAGES ALREADY FILMED.
//
// Ruth, 16 October 2026: "I actually think we need the FULL set of a
// progression in illustration or it will feel disjointed. so we need them all,
// even if we already have the video - that will be for isolated uses in a
// workout, but I want to be able to present a beautiful 'set progression'."
//
// THIS IS THE SEAM, and it is not the one I proposed earlier. I looked for a
// line between illustration and video by CATEGORY - yoga drawn, gym filmed -
// and it was arbitrary, because her real gaps are 15 strength and 10 mobility.
// The line is CONTEXT:
//
//   a progression is a SET and is shown as illustrations, all of it;
//   a single movement inside a workout may use the clip if one exists.
//
// A set half in 3D render and half in watercolour looks broken. One movement
// on its own has nothing to clash with. So every stage below is drawn whether
// or not resolve_movement_refs finds a clip for it, and that duplication is
// the point rather than waste.
//
// FOUR PROGRESSIONS, NOT NINE. Nine were scoped. She kept the ones she had
// named herself - both splits, handstand, cossack - and parked the six that
// came from a browser search: "the 3 sets were to stay, (splits x 2 and
// handstand), what needed parking were the ones i sent from a browser search."
//
// That browser list was a calisthenics list - muscle ups, one-arm and archer
// press ups, weighted and L-sit pull ups, elbow levers. They want a bar, a
// training history and a body already doing the thing. The reader this app was
// built for is standing in the front room between work and dinner.
//
// WHY THE TWO POSITIONS ARE WRITTEN OUT HERE RATHER THAN LEFT TO THE
// GENERATOR. An image generator makes one picture per request, so the art
// direction is given once and ninety-eight short requests follow it. The art
// direction decides whether a picture is beautiful; THESE decide whether it is
// right. "Lizard lunge" on its own comes back as something that is not a
// lizard lunge, and a confidently wrong demonstration is a form fault - the
// same reason movement-demos.ts refuses a near-miss match.
//
// Each stage becomes ONE file: start and finish stacked in one picture.

/** @typedef {{ name: string, start: string, finish: string }} Stage */

/** Ordered, easiest first. The last stage is the destination, not the norm. */
export const PROGRESSIONS = {
  'Side splits': [
    {
      name: 'frog stretch',
      start:
        'On all fours with the knees wide out to the sides, shins turned out so the inner edges of the lower legs and the insides of the feet rest on the floor, forearms down, hips stacked over the knees.',
      finish:
        'Hips pushed back and down away from the hands, knees wider still, chest lowered toward the floor onto the forearms.',
      // THE PICTURE CANNOT SET THE WIDTH, so the words do. Ruth, 16 October
      // 2026: "frog stretch could say to open out knees as wide as they can."
      // A drawing fixes one angle and every hip is different; this is the
      // better instruction and it saved a re-run.
      coaching:
        'Open your knees out as wide as they will go. How wide that is differs for everybody, so work to your own edge rather than to the picture.',
    },
    {
      name: 'butterfly stretch',
      start:
        'Seated upright, soles of the feet together in front, knees out to the sides, hands around the feet, back tall.',
      finish:
        'Knees lowered toward the floor, chest folded gently forward over the feet, back long rather than rounded hard.',
    },
    {
      name: 'seated straddle stretch',
      start:
        'Seated upright, legs straight and wide apart in a V, knees facing the ceiling, hands on the floor in front, back tall.',
      finish:
        'Hips tipped forward, chest and hands walked out along the floor between the legs, legs still straight, knees still facing the ceiling.',
    },
    {
      name: 'wide-leg forward fold',
      start:
        'Standing with the feet wide apart, toes pointing forward, legs straight, hands on the hips, back tall.',
      finish:
        'Folded forward from the hips, hands or forearms on the floor between the feet, crown of the head toward the ground, legs still straight.',
    },
    {
      name: 'middle splits at the wall',
      // SETTLED. Her plan called it a "wall-supported middle split slide",
      // which could as easily have been standing with the feet sliding apart
      // on a slick floor. She does the movement and chose this one, 16
      // October 2026: "how you said is fine."
      start:
        'Lying on the back with the hips close to the wall and both legs straight up it, heels resting against the wall, legs together.',
      finish:
        'Legs opened out wide into a V down the wall, heels still on the wall, gravity carrying them apart, hands resting lightly on the inner thighs.',
    },
    {
      name: 'full middle splits',
      start:
        'Seated with the legs wide in a straddle, hands on the floor in front, hips open.',
      finish:
        'Legs straight out to both sides in one line, the whole length of both legs on the floor, hips square and facing forward, torso upright, hands light on the floor for balance.',
    },
  ],

  'Front splits': [
    {
      name: 'low lunge',
      start: 'Standing with one foot a long stride forward, hands on the hips.',
      finish:
        'Back knee lowered to the floor, front knee above the ankle, hips sinking forward and down, torso upright, hands on the floor either side of the front foot.',
    },
    {
      name: 'half split',
      start:
        'Kneeling on the back knee with the front leg straight ahead, heel on the floor and toes pulled up, hands on the floor either side of the front leg, back flat.',
      finish:
        'Hips pushed back over the kneeling knee, front leg still straight, chest folding down toward the front thigh, back long.',
    },
    {
      name: 'hip flexor stretch',
      start:
        'Kneeling on one knee with the other foot flat on the floor in front, both knees at right angles, torso upright.',
      finish:
        'Hips pressed gently forward over the front foot, the back hip tucked under so the front of the back thigh lengthens, torso upright, the same-side arm reaching overhead.',
    },
    {
      name: 'lizard lunge',
      start:
        'In a low lunge with the front foot flat and both hands on the floor INSIDE the front foot, back leg straight behind with the toes tucked.',
      finish:
        'Forearms lowered to the floor inside the front foot, the front knee drifting out to the side away from the shoulder, back leg still long, hips low.',
    },
    {
      name: 'front splits',
      start:
        'In a low lunge with the back knee down and the hands on the floor either side of the front foot.',
      finish:
        'Front leg straight ahead with the whole back of the leg on the floor, back leg straight behind with the front of the thigh on the floor, hips square and facing forward, torso upright, hands light on the floor.',
    },
  ],

  // NOTHING IN THE LIBRARY IS A HANDSTAND. It holds crow pose, headstand and
  // the pike variants and stops there, so every one of these is new.
  //
  // RUTH'S LADDER, 16 OCTOBER 2026, IN HER ORDER AND HER WORDS:
  //
  //   Wall plank hold
  //   Wall walk -> chest-to-wall
  //   Back-to-wall kick up
  //   Coming down with control
  //   Shoulder taps
  //   Tuck handstand hold, pressed from crow
  //   Freestanding - stable, and down with control
  //
  // "That's mostly a ladder after all, with the press as the hard one rather
  // than an alternative door."
  //
  // THREE THINGS THIS FILE HAD WRONG AGAINST IT, found on 17 October only
  // because she repeated the ladder back to me: coming down with control was
  // missing entirely; the shoulder taps were below the tuck hold instead of
  // above it; and the tuck hold did not say it is pressed from crow, which is
  // the whole reason it sits near the top.
  Handstand: [
    {
      name: 'wall plank hold',
      start:
        'On hands and knees facing away from a wall, hands on the floor, feet a short way from the skirting.',
      finish:
        'Feet lifted and placed flat against the wall at about hip height, body in one straight line from hands to heels, arms straight, ribs drawn down.',
    },
    {
      name: 'wall walk',
      start:
        'In a plank with the feet flat on the wall at hip height, hands on the floor well out to the left of the wall, arms straight, the front of the body facing the floor. Her nose points LEFT, away from the wall; her bun is on the RIGHT side of her head, nearer the wall.',
      finish:
        'Hands walked in toward the wall and the feet walked up it, body near vertical, arms straight, hips over the shoulders. Her nose points RIGHT, toward the wall; her bun is on the LEFT side of her head, away from the wall. The front of her body faces the wall and her spine faces into the room.',
    },
    {
      // RUTH, 17 OCTOBER 2026: "HS3 should start from a downward facing dog
      // type position with hips up high." A kneel was the wrong entry - you
      // cannot reach a chest-to-wall handstand from it, and the hips have to be
      // travelling upward before the legs leave the floor.
      name: 'chest-to-wall handstand',
      start:
        'In a downward dog with the hands on the floor close to the wall and NO gap between the fingertips and the skirting, hips lifted high toward the ceiling, legs straight and feet flat on the floor well out to the left, body making a sharp inverted V. Her nose points DOWN and slightly RIGHT, toward the wall; her bun is on the LEFT side of her head.',
      finish:
        'Inverted with the chest, hips and toes all touching the wall and no gap at any of the three, body in one straight vertical line, arms straight, shoulders pushed up through the hands. Her nose points RIGHT, toward the wall; her bun is on the LEFT side of her head, away from the wall.',
    },
    {
      // RUTH, 17 OCTOBER 2026, on the first attempt: "HS4 is total rubbish."
      // The squat start had her feet against the skirting AND her hands a long
      // way out from it, which leaves nowhere for the finish to happen: from
      // there the heels can never reach the wall. The entry is a lunge facing
      // AWAY from the wall with the hands going down CLOSE to it.
      // THE KICK-UP IS NOT A SEPARATE RUNG. Ruth's ladder, 16 October, has one
      // rung called "back-to-wall kick up" - the kick IS how you get there, and
      // a stage for it on its own was the set padded by naming one movement
      // twice, which she has already caught once on this progression.
      name: 'back-to-wall kick up',
      start:
        'In a lunge facing LEFT, away from the wall, folding forward to place both hands flat on the floor about a hand-span out from the skirting, front knee bent, back leg straight behind and ready to swing. Her nose points LEFT, away from the wall; her bun is on the RIGHT side of her head, nearer the wall.',
      finish:
        'Inverted on straight arms with the hands still a hand-span from the skirting, body stacked vertically rather than arched, both heels resting against the wall behind her with no gap. Her spine faces the wall and the front of her body faces LEFT into the room. Her nose points LEFT, away from the wall; her bun is on the RIGHT side of her head, nearer the wall.',
    },
    {
      // GETTING DOWN IS A SKILL, AND IT WAS MISSING ENTIRELY. Ruth named it
      // twice: in the ladder as its own rung, and on the last rung - "should be
      // able to hold it stable and come down with full control, or move into
      // another progression". A handstand you can only fall out of is not one
      // you have, and leaving the descent undrawn teaches exactly that.
      name: 'coming down with control',
      start:
        'Inverted in a handstand a hand-span from the wall, body vertical on straight arms, both legs together and straight overhead, no wobble. Her nose points LEFT, away from the wall; her bun is on the RIGHT side of her head.',
      finish:
        'One leg lowered slowly to place the ball of that foot on the floor to the LEFT of her hands while the other leg stays lifted behind, arms still straight, head still down between them, the whole body under control rather than collapsing. Her nose points LEFT; her bun is on the RIGHT side of her head.',
    },
    {
      name: 'handstand shoulder taps',
      start:
        'Inverted in a handstand a hand-span from the wall, body vertical on straight arms, weight even across both hands. Her nose points LEFT, away from the wall; her bun is on the RIGHT side of her head.',
      finish:
        'Weight shifted onto the RIGHT arm with the LEFT hand lifted off the floor to tap the opposite shoulder, hips still stacked over the supporting shoulder, body still vertical and not twisted. Her nose points LEFT; her bun is on the RIGHT side of her head.',
    },
    {
      // RUTH, 16 OCTOBER 2026: "I actually think pressing from crow is advanced
      // though." I had called it more accessible because nothing goes overhead,
      // and that was backwards - it needs serious shoulder strength and
      // compression. So it is not a parallel easy door into the handstand; it
      // is the hard rung, and it sits here, near the top.
      name: 'tuck handstand hold, pressed from crow',
      start:
        'In crow pose, facing LEFT: hands flat on the floor, knees resting high on the backs of the upper arms, feet lifted off the floor behind, weight already forward over the hands. Her nose points LEFT and slightly down; her bun is on the RIGHT side of her head.',
      finish:
        'Pressed up out of crow with the arms now STRAIGHT and the knees lifted off the arms entirely, hips fully stacked over the shoulders, knees pulled in tight to the chest and the shins tucked, balance held on the hands with no wall. Her nose points LEFT; her bun is on the RIGHT side of her head. THIS IS NOT CROW - the arms must be straight and the knees must not be touching them.',
    },
    {
      name: 'freestanding handstand',
      start:
        'Standing in a lunge in an empty room with no wall anywhere in the frame, facing LEFT, arms straight overhead beside the ears, ready to reach for the floor.',
      finish:
        'Fully inverted with no wall, legs together and straight overhead, body in one vertical line, arms straight, fingers gripping the floor, perfectly still. Her nose points LEFT; her bun is on the RIGHT side of her head.',
    },
  ],

  // HER OWN, AND THE REASON CHANGES THE DRAWING. Ruth, 16 October 2026: "it's
  // a good mobility marker and there's a bit of balance and slight balance
  // shifting to get the weight over enough to do it, useful to keep as a range
  // of motion challenge." So the FINISH frame has to show the hip clearly OVER
  // the bent leg. A symmetrical squat with one leg stuck out is the wrong
  // picture and misses the whole point of the movement.
  //
  // AND THE TRANSITION IS NOT "CHANGE SIDES". Two frames can show a position
  // becoming a position, so the sequence between sides cannot be drawn and has
  // to live in the words on the card. Her correction of my phrasing, and it is
  // a correction worth keeping because it names the mechanism: "it's not
  // 'change sides' as much as 'now shift your weight back to centre and then
  // over to the other side into side lunge then cossack squat'."
  //
  // The coaching fields below are HERS, not a model's. No describe_movements
  // call would produce the foot pivot or the knee tip - they are the kind of
  // thing somebody who does the movement knows and a writer working from the
  // name does not. That is exactly why they are data here rather than left to
  // movement-howto.ts to invent.
  'Cossack squat': [
    {
      name: 'supported cossack squat',
      start:
        'Standing with the feet wide apart and the toes pointing forward, holding a door frame or the back of a chair in front.',
      finish:
        'Weight shifted across over one leg, that knee bent deeply with the heel staying down, the other leg straight out to the side with the toes lifted and the heel on the floor, torso upright, hands still on the support.',
    },
    {
      name: 'cossack squat',
      start:
        'Standing with the feet wide and the toes forward, arms held out in front for balance.',
      finish:
        'Weight shifted fully over one bent leg with the hip sinking low and that heel staying down, the other leg straight out to the side with the toes lifted, chest upright, no hands on the floor.',
      coaching:
        'Coming out of it, shift your weight back to centre and then over to the other side, into a side lunge and then the squat. As you pass through the side lunge, pivot on the heel and let the toe rotate up. That is what lets the knee bend further and the hip travel toward the floor.',
    },
    {
      name: 'deep cossack squat to the floor',
      start:
        'In a cossack squat on one side, hip low over the bent leg, the other leg straight out to the side, no hands down.',
      finish:
        'Hips all the way down to the floor with the bent leg folded underneath and the straight leg still extended to the side, torso upright, hands free and off the floor, the weight far enough over to come back up the same way.',
      coaching:
        'To get back up, bring the knee in slightly. That shifts your weight forward enough to tip you over your own axis, and from there you can push up in balance.',
    },
  ],
};

/** Every stage name, deduped, in progression order. */
export const PROGRESSION_STAGES = [
  ...new Set(Object.values(PROGRESSIONS).flat().map((s) => s.name)),
];
