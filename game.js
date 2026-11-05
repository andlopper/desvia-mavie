import {
  advanceJump, BALL_RADIUS, clamp, DUCK_HEIGHT_RATIO,
  getBallDuration, getJumpFrameIndex, getSpawnInterval,
  AIR_BALL_OFFSET, JUMP_FRAME_HEIGHT_RATIOS, PLAYER_DISPLAY_HEIGHT,
  circlePastLeftEdge, circleTouchesAlphaMask, getPortraitCamera
} from './game-logic.js';

(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const desktopBackground = new Image();
  const mobileBackground = new Image();
  mobileBackground.addEventListener('load', () => resize());
  desktopBackground.addEventListener('load', () => draw());
  desktopBackground.src = 'assets/backgrounds/desktop.png?v=stadium-20261104';
  mobileBackground.src = 'assets/backgrounds/mobile.png?v=stadium-20261104';
  function loadSprite(path) {
    const image = new Image();
    image.addEventListener('load', () => draw());
    image.src = `${path}?v=character-animations-20261105-v1`;
    return image;
  }
  const playerSprite = loadSprite('assets/characters/idle.png');
  const spriteAlphaMasks = new WeakMap();
  const walkSprites = [
    { image: loadSprite('assets/characters/walk-c.png'), anchorX: 128 },
    { image: loadSprite('assets/characters/walk-a.png'), anchorX: 302 },
    { image: loadSprite('assets/characters/walk-b.png'), anchorX: 177 }
  ];
  const jumpSprites = Array.from({ length: 8 }, (_, index) =>
    loadSprite(`assets/characters/jump-${String(index).padStart(2, '0')}.png`));
  const duckSprite = loadSprite('assets/characters/duck.png');
  const duckWalkSprites = Array.from({ length: 3 }, (_, index) =>
    loadSprite(`assets/characters/duck-walk-${String(index).padStart(2, '0')}.png`));
  const ballSprites = Array.from({ length: 8 }, (_, index) =>
    loadSprite(`assets/balls/rotation-${String(index).padStart(2, '0')}.png`));
  const speechBubble = document.querySelector('#speech-bubble');
  const overlay = document.querySelector('#overlay');
  const gameTitle = document.querySelector('#game-title');
  const startButton = document.querySelector('#start-button');
  const timeValue = document.querySelector('#time-value');
  const bestValue = document.querySelector('#best-value');
  const levelValue = document.querySelector('#level-value');
  const threatDots = document.querySelector('#threat-dots');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const overlayEyebrow = document.querySelector('#overlay-eyebrow');

  const W = 960;
  const H = 510;
  const groundY = 405;
  // Anatomical landmarks in the source image: the hip is at the shorts waist,
  // and the knees sit just below the shorts. The same landmarks drive both
  // the connected sprite warp and its collision shapes.
  const PLAYER_SPRITE = { width: 619, height: 1415, baseDisplayHeight: PLAYER_DISPLAY_HEIGHT, displayHeight: PLAYER_DISPLAY_HEIGHT, anchorX: 221, hipY: 800, kneeY: 1065 };
  const DUCK_SPRITE = { width: 745, height: 1022, anchorX: 290 };
  const portraitFocusX = W * .29;
  let worldScale = 1;
  let worldOffsetX = 0;
  let worldOffsetY = 0;
  function updateSpriteMetrics() {
    PLAYER_SPRITE.displayHeight = PLAYER_SPRITE.baseDisplayHeight;
    PLAYER_SPRITE.scale = PLAYER_SPRITE.displayHeight / PLAYER_SPRITE.height;
    PLAYER_SPRITE.displayWidth = PLAYER_SPRITE.width * PLAYER_SPRITE.scale;
    PLAYER_SPRITE.anchorOffsetX = PLAYER_SPRITE.anchorX * PLAYER_SPRITE.scale;
    PLAYER_SPRITE.hipScreenY = groundY - (PLAYER_SPRITE.height - PLAYER_SPRITE.hipY) * PLAYER_SPRITE.scale;
    DUCK_SPRITE.displayHeight = PLAYER_SPRITE.displayHeight * DUCK_HEIGHT_RATIO;
  }
  const JUMP_FRAME_LAYOUTS = [
    { anchorX: .38, anchorY: .62, grounded: true },
    { anchorX: .38, anchorY: .55, grounded: true },
    { anchorX: .38, anchorY: .5, grounded: true },
    { anchorX: .38, anchorY: .63 },
    { anchorX: .38, anchorY: .61 },
    { anchorX: .38, anchorY: .6 },
    { anchorX: .38, anchorY: .58 },
    { anchorX: .38, anchorY: .53, grounded: true }
  ];
  const WALK_FRAME_DURATION = .1;
  const DUCK_WALK_FRAME_DURATION = .18;
  const phi = (1 + Math.sqrt(5)) / 2;
  const soccerPanelNormals = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ].map(([x, y, z]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  });
  const JUMP_PREP_DURATION = .14;
  const player = {
    x: W * 0.29, targetX: W * 0.29, speed: 720,
    jumpHeight: 0, jumpVelocity: 0, jumpPrep: 0, jumpPending: false, landingTimer: 0,
    ducking: false, duckAmount: 0, walking: false, walkPhase: 0,
    duckWalking: false, duckWalkPhase: 0
  };
  const passMessages = [
    'Arrogantchi!', 'Dónde quieres?', 'A mi no!', 'Otário',
    'Me sinto bem', 'Não sinto dor', 'Hahaha', 'Shh! Cala boca', 'Tu tá gordinho'
  ];
  const hitMessages = ['Pra que?', 'Ela é só uma criança', 'Pra que jogar na Mavie, pô?', 'Pra que jogar bola na Mavie?'];
  const GAME_TITLE = 'Desvia, Mavie!';
  const keys = new Set();
  const balls = [];
  const particles = [];
  const clouds = [
    { x: .14, y: 88, scale: 1 }, { x: .68, y: 72, scale: .76 }, { x: .87, y: 127, scale: .48 }
  ];
  let state = 'ready';
  let elapsed = 0;
  let spawnClock = 0;
  let lastFrame = 0;
  let ballId = 0;
  let pointerActive = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerStartPlayerX = 0;
  let pointerDucking = false;
  let swipeDuckUntil = 0;
  let shake = 0;
  let best = readBest();
  let lastPassMessage = '';
  let lastHitMessage = '';
  let speechTime = 0;
  let portraitStage = false;
  let hitFreezeUntil = 0;

  function readBest() {
    try { return Number(localStorage.getItem('mavie-dodge-best')) || 0; }
    catch { return 0; }
  }

  function persistBest(value) {
    try { localStorage.setItem('mavie-dodge-best', String(value)); }
    catch { /* Storage may be disabled in private browsing. */ }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    portraitStage = rect.height / rect.width > H / W;
    if (portraitStage) {
      ({ scale: worldScale, offsetX: worldOffsetX, offsetY: worldOffsetY } =
        getPortraitCamera(canvas.width, canvas.height, W, H, portraitFocusX));
    } else {
      worldScale = Math.min(canvas.width / W, canvas.height / H);
      worldOffsetX = (canvas.width - W * worldScale) / 2;
      worldOffsetY = Math.max(0, canvas.height - H * worldScale) * .8;
    }
    updateSpriteMetrics();
    if (balls.length) {
      balls.forEach((ball) => { ball.radius = BALL_RADIUS; });
    }
    const sceneTop = worldOffsetY;
    const sceneBottom = worldOffsetY + H * worldScale;
    if (portraitStage && (!mobileBackground.complete || !mobileBackground.naturalWidth)) {
      drawMobileExtensions(canvas.width, canvas.height, sceneTop, sceneBottom, ratio);
    }
    ctx.setTransform(worldScale, 0, 0, worldScale, worldOffsetX, worldOffsetY);
    draw();
  }

  function drawMobileExtensions(width, height, sceneTop, sceneBottom, ratio) {
    if (sceneTop > 0) {
      const sky = ctx.createLinearGradient(0, 0, 0, sceneTop);
      sky.addColorStop(0, '#6fae98');
      sky.addColorStop(1, '#78b9a1');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, sceneTop);

      ctx.fillStyle = '#f1f1d7a8';
      [[.2, .57, 1], [.72, .34, .72], [.86, .76, .48]].forEach(([x, y, size]) => {
        const centerX = width * x;
        const centerY = sceneTop * y;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 25 * ratio * size, 8 * ratio * size, 0, 0, Math.PI * 2);
        ctx.ellipse(centerX - 12 * ratio * size, centerY + ratio * size, 12 * ratio * size, 7 * ratio * size, 0, 0, Math.PI * 2);
        ctx.ellipse(centerX + 11 * ratio * size, centerY - 3 * ratio * size, 14 * ratio * size, 10 * ratio * size, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (sceneBottom < height) {
      const field = ctx.createLinearGradient(0, sceneBottom, 0, height);
      field.addColorStop(0, '#246d41');
      field.addColorStop(1, '#174d31');
      ctx.fillStyle = field;
      ctx.fillRect(0, sceneBottom, width, height - sceneBottom);

      const stripeHeight = 22 * ratio;
      for (let y = sceneBottom; y < height; y += stripeHeight) {
        const stripeIndex = Math.floor((y - sceneBottom) / stripeHeight);
        ctx.fillStyle = stripeIndex % 2 === 0 ? '#ffffff0a' : '#0b381210';
        ctx.fillRect(0, y, width, stripeHeight);
      }
      ctx.strokeStyle = '#e8f2cd55';
      ctx.lineWidth = 1.5 * ratio;
      ctx.beginPath();
      ctx.moveTo(0, sceneBottom + 5 * ratio);
      ctx.lineTo(width, sceneBottom + 5 * ratio);
      ctx.stroke();
    }
  }

  function formatTime(value) { return `${value.toFixed(1)}s`; }

  function updateHud() {
    timeValue.textContent = formatTime(elapsed);
    bestValue.textContent = formatTime(best);
    const level = 1 + Math.floor(elapsed / 12);
    levelValue.textContent = level < 2 ? 'AQUECIMENTO' : `NÍVEL ${level}`;
    const danger = Math.min(4, 1 + Math.floor(elapsed / 18));
    threatDots.textContent = '●'.repeat(danger) + '○'.repeat(4 - danger);
  }

  function startGame() {
    elapsed = 0;
    spawnClock = .6;
    balls.length = 0;
    particles.length = 0;
    player.x = W * .29;
    player.targetX = player.x;
    player.jumpHeight = 0;
    player.jumpVelocity = 0;
    player.jumpPrep = 0;
    player.jumpPending = false;
    player.landingTimer = 0;
    player.ducking = false;
    player.duckAmount = 0;
    player.walking = false;
    player.walkPhase = 0;
    player.duckWalking = false;
    player.duckWalkPhase = 0;
    swipeDuckUntil = 0;
    speechTime = 0;
    speechBubble.classList.remove('is-visible');
    overlay.classList.remove('overlay--game-over');
    gameTitle.textContent = GAME_TITLE;
    overlayEyebrow.hidden = true;
    state = 'playing';
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    updateHud();
    lastFrame = performance.now();
    if (document.hidden) {
      pauseGame();
      return;
    }
    requestAnimationFrame(frame);
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    keys.clear();
    speechTime = 0;
    speechBubble.classList.remove('is-visible');
    overlayTitle.textContent = 'Partida pausada';
    overlayEyebrow.hidden = true;
    overlayCopy.textContent = 'O jogo pausou enquanto esta aba estava em segundo plano.';
    startButton.innerHTML = 'Continuar partida <span aria-hidden="true">▶</span>';
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    keys.clear();
    state = 'playing';
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  function endGame(hitBall) {
    if (state !== 'playing') return;
    state = 'hit';
    keys.clear();
    balls.splice(0, balls.length, hitBall);
    hitFreezeUntil = performance.now() + 180;
    shake = 0;
    const isNewBest = elapsed > best;
    if (isNewBest) {
      best = elapsed;
      persistBest(best);
    }
    updateHud();
    overlayEyebrow.textContent = 'FIM DE JOGO';
    overlayEyebrow.hidden = false;
    const hitMessage = randomMessage(hitMessages, lastHitMessage);
    lastHitMessage = hitMessage;
    overlayTitle.textContent = hitMessage;
    speechTime = 0;
    speechBubble.classList.remove('is-visible');
    overlayCopy.textContent = `Você protegeu a Mavie por ${formatTime(elapsed)}. Respira, ajeita a camisa e tenta de novo.`;
    startButton.innerHTML = 'Jogar de novo <span aria-hidden="true">↻</span>';
  }

  function showGameOverModal() {
    state = 'over';
    overlay.classList.add('overlay--game-over');
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function spawnBall() {
    const startX = W + 45;
    const duration = getBallDuration(elapsed, Math.random());
    const lane = Math.random() < .58 ? 'ground' : 'air';
    const y = lane === 'ground' ? groundY - 20 : groundY - AIR_BALL_OFFSET;
    const axis = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
    const axisLength = Math.hypot(...axis) || 1;
    const spinAxis = axis.map((component) => component / axisLength);
    balls.push({
      // A regulation ball is about 13% of an adult's height; the player sprite is 160px tall.
      id: ballId++, x: startX, y, startX, t: 0, duration, lane,
      radius: BALL_RADIUS,
      orientationX: Math.random() * Math.PI * 2,
      orientationY: Math.random() * Math.PI * 2,
      orientationZ: Math.random() * Math.PI * 2,
      spinAxis, spinAngle: Math.random() * Math.PI * 2,
      spinSpeed: 2.5 + Math.random() * 7.5
    });
  }

  function randomMessage(messages, previous) {
    const choices = messages.filter((message) => message !== previous);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function getMovementBounds() {
    if (!portraitStage) return [68, W - 140];
    const halfVisibleWidth = canvas.width / (2 * worldScale);
    return [
      clamp(portraitFocusX - halfVisibleWidth + 56, 68, W - 140),
      clamp(portraitFocusX + halfVisibleWidth - 96, 68, W - 140)
    ];
  }

  function showPassMessage() {
    speechBubble.textContent = randomMessage(passMessages, lastPassMessage);
    lastPassMessage = speechBubble.textContent;
    speechTime = 1.5;
    speechBubble.classList.add('is-visible');
    positionSpeechLine();
  }

  function positionSpeechLine() {
    if (!speechTime) return;
    const rect = canvas.getBoundingClientRect();
    const pixelToCss = rect.width / canvas.width;
    const scale = worldScale * pixelToCss;
    const offsetX = worldOffsetX * pixelToCss;
    const offsetY = worldOffsetY * rect.height / canvas.height;
    const left = clamp(player.x * scale + offsetX, 50, rect.width - 50);
    speechBubble.style.left = `${left}px`;
    const playerHeight = player.ducking ? DUCK_SPRITE.displayHeight : PLAYER_SPRITE.displayHeight;
    speechBubble.style.top = `${(groundY - playerHeight - 30 - player.jumpHeight) * scale + offsetY}px`;
  }

  function jump() {
    if (state !== 'playing' || player.jumpHeight > 0 || player.jumpPending || player.ducking) return;
    player.jumpPending = true;
    player.jumpPrep = JUMP_PREP_DURATION;
  }

  function intersectsBall(ball) {
    const renderedPlayer = getPlayerRenderState();
    if (!renderedPlayer) return false;
    const mask = getSpriteAlphaMask(renderedPlayer.sprite);
    if (mask) {
      return circleTouchesAlphaMask(ball, ball.radius, mask, {
        left: renderedPlayer.left,
        top: renderedPlayer.top,
        scale: renderedPlayer.scale
      });
    }
    return false;
  }

  function getSpriteAlphaMask(sprite) {
    const existing = spriteAlphaMasks.get(sprite);
    if (existing) return existing;
    if (!sprite.complete || !sprite.naturalWidth || !sprite.naturalHeight) return null;
    if (typeof document.createElement !== 'function') return null;
    try {
      const scratch = document.createElement('canvas');
      scratch.width = sprite.naturalWidth;
      scratch.height = sprite.naturalHeight;
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
      scratchContext.drawImage(sprite, 0, 0);
      const mask = {
        width: sprite.naturalWidth,
        height: sprite.naturalHeight,
        data: scratchContext.getImageData(0, 0, sprite.naturalWidth, sprite.naturalHeight).data
      };
      spriteAlphaMasks.set(sprite, mask);
      return mask;
    } catch (error) {
      console.warn('Não foi possível ler a transparência do sprite para colisão:', error);
      return null;
    }
  }

  function update(dt) {
    if (state !== 'playing') return;
    elapsed += dt;
    const previousPlayerX = player.x;
    let direction = 0;
    if (keys.has('arrowleft') || keys.has('a')) direction -= 1;
    if (keys.has('arrowright') || keys.has('d')) direction += 1;
    if (direction) {
      const [minX, maxX] = getMovementBounds();
      player.targetX = clamp(player.targetX + direction * player.speed * dt, minX, maxX);
    }
    player.x += (player.targetX - player.x) * Math.min(1, dt * 13);
    const horizontalDelta = player.x - previousPlayerX;
    if (speechTime > 0) {
      speechTime = Math.max(0, speechTime - dt);
      if (!speechTime) speechBubble.classList.remove('is-visible');
      else positionSpeechLine();
    }
    player.ducking = player.jumpHeight === 0 && !player.jumpPending
      && (keys.has('arrowdown') || keys.has('s') || performance.now() < swipeDuckUntil);
    player.duckAmount += ((player.ducking ? 1 : 0) - player.duckAmount) * Math.min(1, dt * 16);
    player.landingTimer = Math.max(0, player.landingTimer - dt);
    const horizontalSpeed = dt > 0 ? horizontalDelta / dt : 0;
    const canWalk = !player.jumpPending && player.jumpHeight === 0 && !player.landingTimer;
    const isMoving = canWalk && Math.abs(horizontalSpeed) > 8;
    player.walking = isMoving && !player.ducking;
    player.duckWalking = isMoving && player.ducking;
    if (player.walking) {
      const gaitRate = clamp(Math.abs(horizontalSpeed) / player.speed, .45, 1.1);
      const cycleDuration = WALK_FRAME_DURATION * walkSprites.length;
      player.walkPhase = (player.walkPhase + Math.sign(horizontalDelta) * dt * gaitRate) % cycleDuration;
      if (player.walkPhase < 0) player.walkPhase += cycleDuration;
    } else {
      player.walkPhase = 0;
    }
    if (player.duckWalking) {
      const gaitRate = clamp(Math.abs(horizontalSpeed) / player.speed, .45, 1.1);
      const cycleDuration = DUCK_WALK_FRAME_DURATION * duckWalkSprites.length;
      player.duckWalkPhase = (player.duckWalkPhase + Math.sign(horizontalDelta) * dt * gaitRate) % cycleDuration;
      if (player.duckWalkPhase < 0) player.duckWalkPhase += cycleDuration;
    } else {
      player.duckWalkPhase = 0;
    }
    if (advanceJump(player, dt)) player.landingTimer = .14;

    const interval = getSpawnInterval(elapsed);
    spawnClock -= dt;
    if (spawnClock <= 0) {
      spawnBall();
      spawnClock += interval;
      if (elapsed > 20 && Math.random() < Math.min(.25, elapsed / 250)) spawnClock -= .22;
    }

    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      const previousX = ball.x;
      ball.t += dt;
      const progress = clamp(ball.t / ball.duration, 0, 1);
      ball.x = ball.startX - (W + 110) * progress;
      ball.spinAngle += dt * ball.spinSpeed;
      if (intersectsBall(ball)) {
        endGame(ball);
        return;
      }
      const wasAheadOfPlayer = previousX > previousPlayerX + 88;
      const isPastPlayer = ball.x <= player.x + 88;
      if (!ball.spoke && wasAheadOfPlayer && isPastPlayer) {
        ball.spoke = true;
        showPassMessage();
      }
      const visibleLeftEdge = -worldOffsetX / worldScale;
      if (progress >= 1 || circlePastLeftEdge(ball.x, ball.radius, visibleLeftEdge)) {
        balls.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    updateHud();
  }

  function frame(now, fromWatchdog = false) {
    if (state === 'hit') {
      draw();
      if (now >= hitFreezeUntil) showGameOverModal();
      else requestAnimationFrame(frame);
      return;
    }
    if (state !== 'playing') { draw(); return; }
    let remaining = Math.min(.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    try {
      while (remaining > 0 && state === 'playing') {
        const dt = Math.min(.033, remaining);
        update(dt);
        remaining -= dt;
      }
      draw();
    } catch (error) {
      console.error('Falha no ciclo do jogo:', error);
      state = 'error';
      keys.clear();
      overlayTitle.textContent = 'O jogo encontrou um erro';
      overlayEyebrow.hidden = true;
      overlayCopy.textContent = 'Recarregue a página para iniciar uma nova partida.';
      startButton.innerHTML = 'Recarregar jogo <span aria-hidden="true">↻</span>';
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      return;
    }
    if (state === 'hit' || (state === 'playing' && !fromWatchdog)) requestAnimationFrame(frame);
  }

  window.setInterval(() => {
    if (state !== 'playing' || document.hidden) return;
    const now = performance.now();
    if (now - lastFrame > .18 * 1000) frame(now, true);
  }, 80);

  function roundedRect(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function draw() {
    const hasBackground = portraitStage
      ? mobileBackground.complete && mobileBackground.naturalWidth
      : desktopBackground.complete && desktopBackground.naturalWidth;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#173c2d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (portraitStage && hasBackground) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(mobileBackground, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (!portraitStage && hasBackground) {
      const scale = Math.max(W / desktopBackground.naturalWidth, H / desktopBackground.naturalHeight);
      const width = desktopBackground.naturalWidth * scale;
      const height = desktopBackground.naturalHeight * scale;
      ctx.drawImage(desktopBackground, (W - width) / 2, (H - height) / 2, width, height);
    }

    ctx.setTransform(worldScale, 0, 0, worldScale, worldOffsetX, worldOffsetY);
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
      shake *= .83;
    }
    if (!hasBackground) {
      drawSky();
      drawStadium();
      drawField();
    } else {
      drawPlayerShadow();
    }
    drawPlayer();
    drawBalls();
    positionSpeechLine();
    drawParticles();
    ctx.restore();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, 350);
    sky.addColorStop(0, '#78b9a1'); sky.addColorStop(.62, '#b5d8a6'); sky.addColorStop(1, '#d2dda0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e4ecaa'; ctx.beginPath(); ctx.arc(W * .81, 82, 36, 0, Math.PI * 2); ctx.fill();
    clouds.forEach((cloud) => {
      const s = cloud.scale; const cloudX = cloud.x * W; ctx.fillStyle = '#f1f1d7a8';
      ctx.beginPath(); ctx.ellipse(cloudX, cloud.y, 35 * s, 12 * s, 0, 0, Math.PI * 2); ctx.ellipse(cloudX - 17 * s, cloud.y + 1, 17 * s, 11 * s, 0, 0, Math.PI * 2); ctx.ellipse(cloudX + 15 * s, cloud.y - 4 * s, 19 * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#527e67';
    ctx.beginPath(); ctx.moveTo(0, 229); ctx.quadraticCurveTo(180, 190, 370, 230); ctx.quadraticCurveTo(560, 188, 760, 220); ctx.quadraticCurveTo(870, 198, W, 223); ctx.lineTo(W, 327); ctx.lineTo(0, 327); ctx.closePath(); ctx.fill();
  }

  function drawStadium() {
    ctx.fillStyle = '#456b5a'; ctx.fillRect(0, 240, W, 92);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 52; col++) {
        const x = col * 20 - (row % 2) * 8;
        const y = 252 + row * 16 + Math.sin(col * 3.1 + row) * 2;
        const palette = ['#e8bd8e', '#d6e0c1', '#536f8a', '#f1e6c6', '#bd8168'];
        ctx.fillStyle = palette[(col * 7 + row * 3) % palette.length];
        ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    const bannerWidth = Math.min(190, W - 40);
    ctx.fillStyle = '#f4f2d5'; ctx.fillRect((W - bannerWidth) / 2, 264, bannerWidth, 31);
    ctx.fillStyle = '#23513b'; ctx.font = '700 13px Space Grotesk, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VAI, CRAQUE!', W / 2, 284);
  }

  function drawField() {
    const field = ctx.createLinearGradient(0, 316, 0, H);
    field.addColorStop(0, '#4e9a5d'); field.addColorStop(1, '#1d653b');
    ctx.fillStyle = field; ctx.fillRect(0, 326, W, H - 326);
    for (let i = 0; i < 7; i++) {
      const y = 333 + i * 30;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff07' : '#0b38120c'; ctx.fillRect(0, y, W, 30);
    }
    ctx.strokeStyle = '#e8f2cd6b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 335); ctx.lineTo(W, 335); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W / 2, 335, Math.min(46, W * .12), 14, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 427); ctx.lineTo(W, 427); ctx.stroke();
    ctx.fillStyle = '#f4f2d5'; ctx.fillRect(25, 318, 4, 36); ctx.fillRect(W - 29, 318, 4, 36);
    ctx.fillRect(25, 318, 18, 3); ctx.fillRect(W - 43, 318, 18, 3);
  }

  function drawPlayerShadow() {
    ctx.fillStyle = '#10210d40';
    ctx.beginPath();
    ctx.ellipse(player.x + 5, groundY + 6, PLAYER_SPRITE.displayWidth * .5 + 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function getPlayerRenderState() {
    if (!playerSprite.complete || !playerSprite.naturalWidth) return null;
    let sprite = playerSprite;
    let scale = PLAYER_SPRITE.scale;
    let anchorX = PLAYER_SPRITE.anchorX;
    let lift = player.jumpHeight;

    if (player.ducking) {
      if (player.duckWalking) {
        const frameIndex = Math.floor(player.duckWalkPhase / DUCK_WALK_FRAME_DURATION) % duckWalkSprites.length;
        sprite = duckWalkSprites[frameIndex];
        // The supplied frames share a 724px square canvas. Drawing by canvas height
        // preserves the original proportions and keeps their feet on the field.
        scale = DUCK_SPRITE.displayHeight / sprite.naturalHeight;
        anchorX = sprite.naturalWidth * .46;
      } else {
        sprite = duckSprite;
        scale = DUCK_SPRITE.displayHeight / DUCK_SPRITE.height;
        anchorX = DUCK_SPRITE.anchorX;
      }
      lift = 0;
    } else {
      const jumpFrame = getJumpFrameIndex(player, JUMP_PREP_DURATION);
      if (jumpFrame >= 0) {
        sprite = jumpSprites[jumpFrame];
        scale = PLAYER_SPRITE.displayHeight * JUMP_FRAME_HEIGHT_RATIOS[jumpFrame] / sprite.naturalHeight;
        const layout = JUMP_FRAME_LAYOUTS[jumpFrame];
        anchorX = sprite.naturalWidth * layout.anchorX;
        lift = player.jumpHeight;
      } else if (player.walking) {
        const walkIndex = Math.floor(player.walkPhase / WALK_FRAME_DURATION) % walkSprites.length;
        const frame = walkSprites[walkIndex];
        sprite = frame.image;
        scale = PLAYER_SPRITE.displayHeight / sprite.naturalHeight;
        anchorX = frame.anchorX ?? sprite.naturalWidth * frame.anchorRatio;
      }
    }

    if (!sprite.complete || !sprite.naturalWidth) {
      if (player.ducking && duckSprite.complete && duckSprite.naturalWidth) {
        sprite = duckSprite;
        scale = DUCK_SPRITE.displayHeight / DUCK_SPRITE.height;
        anchorX = DUCK_SPRITE.anchorX;
      } else {
        sprite = playerSprite;
        scale = PLAYER_SPRITE.scale;
        anchorX = PLAYER_SPRITE.anchorX;
      }
    }
    const width = sprite.naturalWidth * scale;
    const height = sprite.naturalHeight * scale;
    const left = player.x - anchorX * scale;
    let top = groundY - lift - height;
    const jumpFrame = sprite === jumpSprites[0] ? 0 : jumpSprites.indexOf(sprite);
    if (jumpFrame > 0 && jumpFrame < 7 && !JUMP_FRAME_LAYOUTS[jumpFrame].grounded) {
      const layout = JUMP_FRAME_LAYOUTS[jumpFrame];
      top = PLAYER_SPRITE.hipScreenY - player.jumpHeight - sprite.naturalHeight * scale * layout.anchorY;
    }
    return { sprite, scale, left, top, width, height };
  }

  function drawPlayer() {
    const pose = getPlayerRenderState();
    if (!pose) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pose.sprite, pose.left, pose.top, pose.width, pose.height);
    ctx.imageSmoothingEnabled = true;
  }

  function drawBalls() {
    balls.forEach((ball) => {
      const progress = clamp(ball.t / ball.duration, 0, 1);
      const radius = ball.radius;
      ctx.fillStyle = `rgba(13, 30, 17, ${ball.lane === 'ground' ? .22 : .13})`;
      ctx.beginPath(); ctx.ellipse(ball.x - 3, groundY - 3, radius * 1.05, ball.lane === 'ground' ? 5 : 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(ball.x, ball.y);
      const spin = ((ball.spinAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const frameIndex = Math.floor(spin / (Math.PI * 2) * ballSprites.length) % ballSprites.length;
      const sprite = ballSprites[frameIndex];
      if (sprite.complete && sprite.naturalWidth) {
        const imageScale = (radius * 2) / Math.max(sprite.naturalWidth, sprite.naturalHeight);
        const width = sprite.naturalWidth * imageScale;
        const height = sprite.naturalHeight * imageScale;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
        ctx.imageSmoothingEnabled = true;
      } else {
        ctx.fillStyle = '#fffdf3'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, radius - 0.5, 0, Math.PI * 2); ctx.clip();
        drawSoccerPattern(radius, ball);
        ctx.restore();
        ctx.strokeStyle = '#c9d1c2'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = `rgba(255,255,238,${.16 + progress * .28})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ball.x + 20, ball.y); ctx.lineTo(ball.x + 43, ball.y - 3); ctx.stroke();
    });
  }

  function drawSoccerPattern(radius, ball) {
    const { x: ax, y: ay, z: az } = { x: ball.spinAxis[0], y: ball.spinAxis[1], z: ball.spinAxis[2] };
    const spinSin = Math.sin(ball.spinAngle), spinCos = Math.cos(ball.spinAngle);
    const sx = Math.sin(ball.orientationX), cx = Math.cos(ball.orientationX);
    const sy = Math.sin(ball.orientationY), cy = Math.cos(ball.orientationY);
    const sz = Math.sin(ball.orientationZ), cz = Math.cos(ball.orientationZ);

    soccerPanelNormals.forEach(([x, y, z], index) => {
      const axisProjection = ax * x + ay * y + az * z;
      const crossX = ay * z - az * y;
      const crossY = az * x - ax * z;
      const crossZ = ax * y - ay * x;
      const rotatedX = x * spinCos + crossX * spinSin + ax * axisProjection * (1 - spinCos);
      const rotatedY = y * spinCos + crossY * spinSin + ay * axisProjection * (1 - spinCos);
      const rotatedZ = z * spinCos + crossZ * spinSin + az * axisProjection * (1 - spinCos);
      const y1 = rotatedY * cx - rotatedZ * sx;
      const z1 = rotatedY * sx + rotatedZ * cx;
      const x2 = rotatedX * cy + z1 * sy;
      const z2 = -rotatedX * sy + z1 * cy;
      const projectedX = x2 * cz - y1 * sz;
      const projectedY = x2 * sz + y1 * cz;
      if (z2 < -.22) return;

      ctx.save();
      ctx.translate(projectedX * radius, projectedY * radius);
      ctx.scale(1, Math.max(.16, z2));
      ctx.fillStyle = '#171d1d';
      drawBallPentagon(0, 0, radius * .31, index * 2.4);
      ctx.restore();
    });
  }

  function drawBallPentagon(x, y, radius, rotation) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = rotation + i * Math.PI * 2 / 5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#aeb4b1';
    ctx.lineWidth = Math.max(0.8, radius * .09);
    ctx.stroke();
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  startButton.addEventListener('click', () => {
    if (state === 'paused') resumeGame();
    else if (state === 'error') window.location.reload();
    else startGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)
      || (key === ' ' && (state === 'playing' || event.target === document.body))) event.preventDefault();
    if (!event.repeat && ['arrowup', 'w', ' '].includes(key)) {
      if (state === 'playing') jump();
      else if (key === ' ' && event.target === document.body) startGame();
    }
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', (event) => {
    if (state !== 'playing') return;
    pointerActive = true;
    pointerDucking = false;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerStartPlayerX = player.x;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointerActive) return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    if (!pointerDucking && Math.abs(deltaY) > 28 && Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
      pointerDucking = true;
      if (deltaY > 0) {
        swipeDuckUntil = performance.now() + 650;
        keys.add('arrowdown');
      } else {
        jump();
      }
    }
    if (!pointerDucking && Math.abs(deltaX) > 12) {
      const rect = canvas.getBoundingClientRect();
      const [minX, maxX] = getMovementBounds();
      const worldDelta = deltaX * canvas.width / rect.width / worldScale;
      player.targetX = clamp(pointerStartPlayerX + worldDelta, minX, maxX);
    }
  });
  const finishCanvasPointer = () => {
    if (!pointerActive) return;
    pointerActive = false;
    if (pointerDucking) keys.delete('arrowdown');
  };
  canvas.addEventListener('pointerup', finishCanvasPointer);
  canvas.addEventListener('pointercancel', finishCanvasPointer);
  document.querySelectorAll('.move-button').forEach((button) => {
    const action = button.dataset.action;
    const direction = Number(button.dataset.direction);
    const key = action === 'jump' ? 'arrowup' : action === 'duck' ? 'arrowdown' : direction < 0 ? 'arrowleft' : 'arrowright';
    const down = (event) => { event.preventDefault(); if (action === 'jump') jump(); else keys.add(key); };
    const up = () => keys.delete(key);
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
  });
  updateHud();
  resize();
})();
