import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceJump,
  AIR_BALL_OFFSET,
  BALL_RADIUS,
  circleTouchesAlphaMask,
  circleTouchesEllipse,
  circlePastLeftEdge,
  clamp,
  DISPLAY_SIZE_MULTIPLIER,
  DUCK_HEIGHT_RATIO,
  getBallDuration,
  getJumpFrameIndex,
  getSpawnInterval,
  JUMP_FRAME_HEIGHT_RATIOS,
  PLAYER_DISPLAY_HEIGHT,
  getPortraitCamera
} from '../game-logic.js';

test('clamp keeps values within the requested bounds', () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(12, 0, 10), 10);
});

test('circle/ellipse collision detects containment, contact and overlap', () => {
  const ellipse = { x: 0, y: 0, rx: 10, ry: 5 };
  assert.equal(circleTouchesEllipse({ x: 0, y: 0 }, 1, ellipse), true);
  assert.equal(circleTouchesEllipse({ x: 12, y: 0 }, 2, ellipse), true);
  assert.equal(circleTouchesEllipse({ x: 12.01, y: 0 }, 2, ellipse), false);
  assert.equal(circleTouchesEllipse({ x: 30, y: 30 }, 2, ellipse), false);
});

test('circle/ellipse collision respects an ellipse vertical radius', () => {
  const ellipse = { x: 4, y: 8, rx: 4, ry: 12 };
  assert.equal(circleTouchesEllipse({ x: 4, y: 21 }, 1, ellipse), true);
  assert.equal(circleTouchesEllipse({ x: 4, y: 22.01 }, 1, ellipse), false);
});

test('football is removed only after its full circle exits the left edge', () => {
  assert.equal(circlePastLeftEdge(-8, 13, 0), false);
  assert.equal(circlePastLeftEdge(-13.01, 13, 0), true);
  assert.equal(circlePastLeftEdge(-8, 13, 8), true);
});

test('football collision follows opaque pixels of the currently drawn sprite', () => {
  const width = 8;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 2; y <= 5; y++) {
    for (let x = 2; x <= 5; x++) data[(y * width + x) * 4 + 3] = 255;
  }
  const mask = { width, height, data };
  const bounds = { left: 10, top: 20, scale: 1 };
  assert.equal(circleTouchesAlphaMask({ x: 14, y: 24 }, 1, mask, bounds), true);
  assert.equal(circleTouchesAlphaMask({ x: 18, y: 24 }, 1, mask, bounds), false);
});

test('jump preparation transitions to an upward launch after its duration', () => {
  const player = { jumpPending: true, jumpPrep: .14, jumpHeight: 0, jumpVelocity: 0 };
  assert.equal(advanceJump(player, .06), false);
  assert.equal(player.jumpPending, true);
  assert.equal(advanceJump(player, .081), false);
  assert.equal(player.jumpPending, false);
  assert.equal(player.jumpPrep, 0);
  assert.equal(player.jumpHeight > 0, true);
  assert.ok(Math.abs(player.jumpVelocity - (620 - 1550 * .081)) < 1e-10);
});

test('jump follows gravity, reaches an apex, and reports landing once', () => {
  const player = { jumpPending: false, jumpHeight: 0, jumpVelocity: 620 };
  let landed = false;
  for (let i = 0; i < 180 && !landed; i++) landed = advanceJump(player, 1 / 60);
  assert.equal(landed, true);
  assert.equal(player.jumpHeight, 0);
  assert.equal(player.jumpVelocity, 0);
  assert.equal(advanceJump(player, 1 / 60), false);
});

test('jump frame selection covers preparation, ascent, descent and landing', () => {
  assert.equal(getJumpFrameIndex({ jumpPending: true, jumpPrep: .12 }, .14), 1);
  assert.equal(getJumpFrameIndex({ jumpPending: true, jumpPrep: .02 }, .14), 2);
  assert.equal(getJumpFrameIndex({ jumpHeight: 10, jumpVelocity: 400 }), 3);
  assert.equal(getJumpFrameIndex({ jumpHeight: 80, jumpVelocity: 100 }), 5);
  assert.equal(getJumpFrameIndex({ jumpHeight: 80, jumpVelocity: -100 }), 5);
  assert.equal(getJumpFrameIndex({ jumpHeight: 40, jumpVelocity: -100 }), 6);
  assert.equal(getJumpFrameIndex({ jumpHeight: 5, jumpVelocity: -100 }), 7);
  assert.equal(getJumpFrameIndex({ jumpHeight: 0, jumpVelocity: 0, landingTimer: .1 }), 7);
  assert.equal(getJumpFrameIndex({ jumpHeight: 0, jumpVelocity: 0, landingTimer: 0 }), -1);
});

test('ball flight time decreases with difficulty and stays within its range', () => {
  assert.equal(getBallDuration(0, 0), 3.1);
  assert.ok(Math.abs(getBallDuration(75, 1) - 2.15) < 1e-10);
  assert.ok(Math.abs(getBallDuration(150, 0) - 1.9) < 1e-10);
});

test('spawn interval shortens with difficulty and has a lower bound', () => {
  assert.equal(getSpawnInterval(0), 1.48);
  assert.ok(getSpawnInterval(60) < getSpawnInterval(0));
  assert.equal(getSpawnInterval(1000), .53);
});

test('duck and jump cutouts preserve their source proportions', () => {
  const standingHeight = 160;
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);
  const jumpFrameSourceHeights = [556, 505, 431, 564, 552, 423, 519, 499];
  near(standingHeight * DUCK_HEIGHT_RATIO, 105.6);
  for (let frame = 0; frame < jumpFrameSourceHeights.length; frame++) {
    near(JUMP_FRAME_HEIGHT_RATIOS[frame], jumpFrameSourceHeights[frame] / jumpFrameSourceHeights[0]);
  }
  assert.ok(standingHeight * JUMP_FRAME_HEIGHT_RATIOS[5] < standingHeight * .8,
    'the tucked airborne pose stays smaller instead of being enlarged to standing height');
});

test('player and football display sizes increase by exactly twenty percent', () => {
  assert.equal(DISPLAY_SIZE_MULTIPLIER, 1.2);
  assert.equal(PLAYER_DISPLAY_HEIGHT, 192);
  assert.equal(BALL_RADIUS, 13.2);
  assert.equal(PLAYER_DISPLAY_HEIGHT / 160, DISPLAY_SIZE_MULTIPLIER);
  assert.equal(BALL_RADIUS / 11, DISPLAY_SIZE_MULTIPLIER);
});

test('portrait camera fills mobile height and centers its play focus', () => {
  const camera = getPortraitCamera(390, 500, 960, 510, 278.4);
  assert.ok(Math.abs(camera.scale - (390 / 960 * 1.55)) < 1e-10);
  assert.ok(Math.abs(278.4 * camera.scale + camera.offsetX - 195) < 1e-10);
  assert.ok(camera.offsetY > 0, 'the world is centered vertically after reducing portrait zoom');
  assert.equal(AIR_BALL_OFFSET, 190);
  assert.equal(PLAYER_DISPLAY_HEIGHT, 192);
  assert.equal(BALL_RADIUS, 13.2);
});
