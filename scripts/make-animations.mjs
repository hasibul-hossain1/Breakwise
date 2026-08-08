/**
 * Generates the two Lottie animations used on the break card.
 *
 * Lottie JSON is far too verbose to hand-edit, so it is generated instead —
 * same idea as scripts/make-icons.py. Tweak the constants below and re-run.
 *
 * These are deliberately simple pictograms. If you later drop in a
 * professionally made animation from lottiefiles.com, just overwrite the
 * matching JSON file — nothing else needs to change.
 *
 * Usage: node scripts/make-animations.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'src', 'animations')

const FPS = 30
const SIZE = 100

/** #38bdf8 and #a78bfa, matching the card accents in base.css. */
const EYE = rgb(56, 189, 248)
const BODY = rgb(167, 139, 250)

function rgb(r, g, b) {
  return [r / 255, g / 255, b / 255, 1]
}

/** Lottie keyframes from [frame, value] pairs, with a soft ease between them. */
function keys(pairs) {
  return pairs.map(([t, v], index) =>
    index === pairs.length - 1
      ? { t, s: Array.isArray(v) ? v : [v] }
      : {
          t,
          s: Array.isArray(v) ? v : [v],
          i: { x: [0.42], y: [1] },
          o: { x: [0.58], y: [0] }
        }
  )
}

const still = (value) => ({ a: 0, k: value })
const animated = (pairs) => ({ a: 1, k: keys(pairs) })

/** Every shape group must end with a transform item. */
const groupTransform = () => ({
  ty: 'tr',
  p: still([0, 0]),
  a: still([0, 0]),
  s: still([100, 100]),
  r: still(0),
  o: still(100),
  sk: still(0),
  sa: still(0)
})

/**
 * A straight stroked limb along the pivot's local +Y axis, from `from` to `to`.
 * The offset matters for things like a nose, which has to start outside the
 * head rather than at its centre.
 */
function limb(from, to, width, color, opacity = 100) {
  return {
    ty: 'gr',
    it: [
      {
        ty: 'sh',
        ks: still({
          i: [
            [0, 0],
            [0, 0]
          ],
          o: [
            [0, 0],
            [0, 0]
          ],
          v: [
            [0, from],
            [0, to]
          ],
          c: false
        })
      },
      { ty: 'st', c: still(color), o: still(opacity), w: still(width), lc: 2, lj: 2 },
      groupTransform()
    ]
  }
}

function dot(diameter, color) {
  return {
    ty: 'gr',
    it: [
      { ty: 'el', p: still([0, 0]), s: still([diameter, diameter]) },
      { ty: 'fl', c: still(color), o: still(100) },
      groupTransform()
    ]
  }
}

/** An open arc, used for the "distance" chevrons. */
function arc(radius, width, color, sweep = 55) {
  const start = (-sweep / 2) * (Math.PI / 180)
  const end = (sweep / 2) * (Math.PI / 180)
  const point = (angle) => [Math.cos(angle) * radius, Math.sin(angle) * radius]
  // A single cubic segment is close enough to a circular arc at this sweep.
  const handle = (radius * Math.tan((end - start) / 4) * 4) / 3
  return {
    ty: 'gr',
    it: [
      {
        ty: 'sh',
        ks: still({
          i: [
            [0, 0],
            [handle * Math.sin(end), -handle * Math.cos(end)]
          ],
          o: [
            [-handle * Math.sin(start), handle * Math.cos(start)],
            [0, 0]
          ],
          v: [point(start), point(end)],
          c: false
        })
      },
      { ty: 'st', c: still(color), o: still(100), w: still(width), lc: 2, lj: 2 },
      groupTransform()
    ]
  }
}

function layer({ index, name, shapes, position, rotation, opacity, duration }) {
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: opacity ?? still(100),
      r: rotation ?? still(0),
      p: still([...position, 0]),
      a: still([0, 0, 0]),
      s: still([100, 100, 100])
    },
    ao: 0,
    shapes,
    ip: 0,
    op: duration,
    st: 0,
    bm: 0
  }
}

function document(name, duration, layers) {
  return {
    v: '5.7.4',
    fr: FPS,
    ip: 0,
    op: duration,
    w: SIZE,
    h: SIZE,
    nm: name,
    ddd: 0,
    assets: [],
    layers
  }
}

/* ------------------------------------------------------------------ */

/** Side-view figure walking: legs swing, arms counter-swing, body bobs. */
function walkAnimation() {
  const D = 36 // one full stride, in frames
  const color = BODY
  const hip = [50, 58]
  const shoulder = [50, 36]

  // Arms lead the opposite leg, which is what makes a walk read as a walk.
  // They swing wider than the legs so they clear the torso line — at a small
  // swing they just sit on top of it and the figure looks armless.
  const swing = (from) =>
    animated([
      [0, from],
      [D / 2, -from],
      [D, from]
    ])

  return document('walk', D, [
    layer({
      index: 1,
      name: 'arm-back',
      shapes: [limb(0, 18, 4, color, 55)],
      position: shoulder,
      rotation: swing(-42),
      duration: D
    }),
    layer({
      index: 2,
      name: 'leg-back',
      shapes: [limb(0, 26, 5, color, 55)],
      position: hip,
      rotation: swing(-26),
      duration: D
    }),
    layer({
      index: 3,
      name: 'torso',
      shapes: [limb(0, 24, 5.5, color)],
      position: [50, 34],
      duration: D
    }),
    layer({
      index: 4,
      name: 'head',
      shapes: [dot(17, color)],
      position: [50, 24],
      duration: D
    }),
    layer({
      index: 5,
      name: 'leg-front',
      shapes: [limb(0, 26, 5, color)],
      position: hip,
      rotation: swing(26),
      duration: D
    }),
    layer({
      index: 6,
      name: 'arm-front',
      shapes: [limb(0, 18, 4, color)],
      position: shoulder,
      rotation: swing(42),
      duration: D
    })
  ])
}

/**
 * A head in profile turning from the screen to the horizon, with distance
 * arcs rippling outward as the gaze travels.
 */
function lookAwayAnimation() {
  const D = 90
  const color = EYE

  const rippleAt = (offset) =>
    animated([
      [0, 0],
      [18 + offset, 0],
      [26 + offset, 90],
      [46 + offset, 90],
      [56 + offset, 0],
      [D, 0]
    ])

  const head = [34, 50]
  const headRadius = 13

  return document('look-away', D, [
    // Arcs fan out to the right of the head, suggesting depth of field.
    layer({
      index: 1,
      name: 'arc-far',
      shapes: [arc(42, 3.5, color)],
      position: head,
      opacity: rippleAt(14),
      duration: D
    }),
    layer({
      index: 2,
      name: 'arc-mid',
      shapes: [arc(33, 3.5, color)],
      position: head,
      opacity: rippleAt(7),
      duration: D
    }),
    layer({
      index: 3,
      name: 'arc-near',
      shapes: [arc(24, 3.5, color)],
      position: head,
      opacity: rippleAt(0),
      duration: D
    }),
    layer({
      index: 4,
      name: 'head',
      shapes: [dot(headRadius * 2, color)],
      position: head,
      duration: D
    }),
    // The nose is what makes the turn readable, so it has to start outside
    // the head circle rather than at its centre.
    layer({
      index: 5,
      name: 'nose',
      shapes: [limb(headRadius - 2, headRadius + 8, 4.5, color)],
      position: head,
      // -90deg points along +X, i.e. straight at the horizon.
      rotation: animated([
        [0, -60],
        [24, -96],
        [66, -96],
        [D, -60]
      ]),
      duration: D
    })
  ])
}

/* ------------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true })

for (const [file, data] of [
  ['body-walk.json', walkAnimation()],
  ['eye-look.json', lookAwayAnimation()]
]) {
  const json = JSON.stringify(data)
  writeFileSync(join(OUT, file), json)
  console.log(`wrote ${file} (${(json.length / 1024).toFixed(1)} KB, ${data.op} frames @ ${FPS}fps)`)
}
