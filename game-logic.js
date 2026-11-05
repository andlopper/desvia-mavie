export const DISPLAY_SIZE_MULTIPLIER = 1.2;
export const PLAYER_DISPLAY_HEIGHT = 160 * DISPLAY_SIZE_MULTIPLIER;
export const BALL_RADIUS = 11 * DISPLAY_SIZE_MULTIPLIER;
export const DUCK_HEIGHT_RATIO = .66;
export const AIR_BALL_OFFSET = 190;
// Scale every jump cutout with the same source-pixel scale. This keeps compact
// tucked poses from being enlarged to the full standing bounding-box height.
export const JUMP_FRAME_HEIGHT_RATIOS = Object.freeze([556, 505, 431, 564, 552, 423, 519, 499].map((height) => height / 556));

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function circlePastLeftEdge(centerX, radius, leftEdge) {
  return centerX + radius < leftEdge;
}

export function getPortraitCamera(width, height, worldWidth, worldHeight, focusX) {
  const scale = Math.min(height / worldHeight, width / worldWidth * 1.55);
  return {
    scale,
    offsetX: width / 2 - focusX * scale,
    offsetY: (height - worldHeight * scale) / 2
  };
}

export function circleTouchesAlphaMask(point, radius, mask, bounds, alphaThreshold = 96) {
  if (!mask || !mask.data || !bounds || bounds.scale <= 0) return false;
  const { left, top, scale } = bounds;
  const right = left + mask.width * scale;
  const bottom = top + mask.height * scale;
  const minX = Math.max(left, point.x - radius);
  const maxX = Math.min(right, point.x + radius);
  const minY = Math.max(top, point.y - radius);
  const maxY = Math.min(bottom, point.y + radius);
  const radiusSquared = radius * radius;
  const minSourceX = Math.max(0, Math.floor((minX - left) / scale));
  const maxSourceX = Math.min(mask.width - 1, Math.ceil((maxX - left) / scale));
  const minSourceY = Math.max(0, Math.floor((minY - top) / scale));
  const maxSourceY = Math.min(mask.height - 1, Math.ceil((maxY - top) / scale));

  for (let sourceY = minSourceY; sourceY <= maxSourceY; sourceY++) {
    const dy = top + (sourceY + .5) * scale - point.y;
    for (let sourceX = minSourceX; sourceX <= maxSourceX; sourceX++) {
      const dx = left + (sourceX + .5) * scale - point.x;
      if (dx * dx + dy * dy > radiusSquared) continue;
      const alphaIndex = (sourceY * mask.width + sourceX) * 4 + 3;
      if (mask.data[alphaIndex] >= alphaThreshold) return true;
    }
  }
  return false;
}

export function circleTouchesEllipse(point, radius, ellipse) {
  const dx = point.x - ellipse.x;
  const dy = point.y - ellipse.y;
  const normalized = (dx * dx) / (ellipse.rx * ellipse.rx) + (dy * dy) / (ellipse.ry * ellipse.ry);
  if (normalized <= 1) return true;

  let angle = Math.atan2(dy * ellipse.rx, dx * ellipse.ry);
  for (let i = 0; i < 6; i++) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ex = ellipse.rx * cos - dx;
    const ey = ellipse.ry * sin - dy;
    const tx = -ellipse.rx * sin;
    const ty = ellipse.ry * cos;
    const first = ex * tx + ey * ty;
    const second = tx * tx + ty * ty - ex * ellipse.rx * cos - ey * ellipse.ry * sin;
    if (Math.abs(second) < 1e-8) break;
    angle -= first / second;
  }
  const nearestX = ellipse.rx * Math.cos(angle);
  const nearestY = ellipse.ry * Math.sin(angle);
  return Math.hypot(dx - nearestX, dy - nearestY) <= radius;
}

export function advanceJump(player, dt, prepDuration = .14) {
  let landed = false;
  if (player.jumpPending) {
    player.jumpPrep -= dt;
    if (player.jumpPrep <= 0) {
      player.jumpPrep = 0;
      player.jumpPending = false;
      player.jumpVelocity = 620;
    }
  }
  if (player.jumpHeight > 0 || player.jumpVelocity > 0) {
    player.jumpHeight += player.jumpVelocity * dt;
    player.jumpVelocity -= 1550 * dt;
    if (player.jumpHeight <= 0) {
      landed = player.jumpVelocity < 0;
      player.jumpHeight = 0;
      player.jumpVelocity = 0;
    }
  }
  return landed;
}

export function getJumpFrameIndex(player, prepDuration = .14) {
  if (player.jumpPending) return player.jumpPrep > prepDuration * .5 ? 1 : 2;

  if (player.jumpHeight > 0 || player.jumpVelocity > 0) {
    const heightProgress = clamp(player.jumpHeight / 124, 0, 1);
    if (player.jumpVelocity > 0) {
      if (heightProgress < .14) return 3;
      if (heightProgress < .62) return 4;
      return 5;
    }
    if (heightProgress > .62) return 5;
    if (heightProgress > .25) return 6;
    return 7;
  }

  if (player.landingTimer > 0) return player.landingTimer > .07 ? 7 : 0;
  return -1;
}

export function getBallDuration(elapsed, randomValue) {
  const difficulty = Math.min(1, elapsed / 75);
  return 3.1 - difficulty * 1.2 + randomValue * .25;
}

export function getSpawnInterval(elapsed) {
  return Math.max(.53, 1.48 - elapsed * .012);
}
