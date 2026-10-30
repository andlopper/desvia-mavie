(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const speechBubble = document.querySelector('#speech-bubble');
  const overlay = document.querySelector('#overlay');
  const gameTitle = document.querySelector('#game-title');
  const startButton = document.querySelector('#start-button');
  const timeValue = document.querySelector('#time-value');
  const bestValue = document.querySelector('#best-value');
  const levelValue = document.querySelector('#level-value');
  const threatDots = document.querySelector('#threat-dots');
  const soundButton = document.querySelector('#sound-button');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const overlayEyebrow = document.querySelector('#overlay-eyebrow');

  const W = 960;
  const H = 510;
  const groundY = 405;
  const phi = (1 + Math.sqrt(5)) / 2;
  const soccerPanelNormals = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ].map(([x, y, z]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  });
  const JUMP_PREP_DURATION = .07;
  const player = {
    x: W * 0.29, targetX: W * 0.29, speed: 720,
    jumpHeight: 0, jumpVelocity: 0, jumpPrep: 0, jumpPending: false, ducking: false
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
  let soundOn = false;
  let audioContext = null;
  let pointerActive = false;
  let shake = 0;
  let best = readBest();
  let lastPassMessage = '';
  let lastHitMessage = '';
  let speechTime = 0;

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
    const scale = Math.min(canvas.width / W, canvas.height / H);
    const offsetX = (canvas.width - W * scale) / 2;
    const remainingY = canvas.height - H * scale;
    const offsetY = remainingY > 0 ? remainingY * .8 : 0;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    draw();
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
    player.ducking = false;
    speechTime = 0;
    speechBubble.classList.remove('is-visible');
    gameTitle.textContent = GAME_TITLE;
    overlayEyebrow.hidden = true;
    state = 'playing';
    overlay.classList.add('hidden');
    updateHud();
    lastFrame = performance.now();
    requestAnimationFrame(frame);
    playTone(520, .07, 'sine');
  }

  function endGame() {
    if (state !== 'playing') return;
    state = 'over';
    shake = 10;
    burst(player.x + 25, groundY - 48, '#f8ecce', 15);
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
    gameTitle.textContent = hitMessage;
    speechTime = 0;
    speechBubble.classList.remove('is-visible');
    overlayCopy.textContent = `Você protegeu a Mavie por ${formatTime(elapsed)}. Respira, ajeita a camisa e tenta de novo.`;
    startButton.innerHTML = 'Jogar de novo <span aria-hidden="true">↻</span>';
    overlay.classList.remove('hidden');
    playTone(180, .22, 'triangle');
  }

  function spawnBall() {
    const difficulty = Math.min(1, elapsed / 75);
    const startX = W + 45;
    const duration = 3.1 - difficulty * 1.2 + Math.random() * .25;
    const lane = Math.random() < .58 ? 'ground' : 'air';
    const y = lane === 'ground' ? groundY - 20 : groundY - 150;
    const axis = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
    const axisLength = Math.hypot(...axis) || 1;
    const spinAxis = axis.map((component) => component / axisLength);
    balls.push({
      id: ballId++, x: startX, y, startX, t: 0, duration, lane, radius: 19,
      orientationX: Math.random() * Math.PI * 2,
      orientationY: Math.random() * Math.PI * 2,
      orientationZ: Math.random() * Math.PI * 2,
      spinAxis, spinAngle: Math.random() * Math.PI * 2,
      spinSpeed: 2.5 + Math.random() * 7.5
    });
  }

  function moveToPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const pointX = (event.clientX - rect.left) / rect.width * W;
    player.targetX = clamp(pointX, 68, W - 140);
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function randomMessage(messages, previous) {
    const choices = messages.filter((message) => message !== previous);
    return choices[Math.floor(Math.random() * choices.length)];
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
    const scale = Math.min(rect.width / W, rect.height / H);
    const offsetX = (rect.width - W * scale) / 2;
    const offsetY = Math.max(0, rect.height - H * scale) * .8;
    const left = clamp(player.x * scale + offsetX, 50, rect.width - 50);
    speechBubble.style.left = `${left}px`;
    speechBubble.style.top = `${(groundY - 190 - player.jumpHeight) * scale + offsetY}px`;
  }

  function jump() {
    if (state !== 'playing' || player.jumpHeight > 0 || player.jumpPending || player.ducking) return;
    player.jumpPending = true;
    player.jumpPrep = JUMP_PREP_DURATION;
    playTone(430, .06, 'sine');
  }

  function intersectsBall(ball) {
    const anticipation = player.jumpPending ? .68 * (1 - player.jumpPrep / JUMP_PREP_DURATION) : 0;
    const crouch = Math.max(player.ducking ? 1 : 0, anticipation);
    const angle = crouch * .9;
    const dx = ball.x - player.x;
    const dy = ball.y - (groundY - 37 - player.jumpHeight);
    const localBall = {
      x: player.x + dx * Math.cos(angle) + dy * Math.sin(angle),
      y: groundY - 37 - dx * Math.sin(angle) + dy * Math.cos(angle)
    };
    const ellipses = [
      { x: player.x + 1, y: groundY - 69, rx: 26, ry: 34 }, // shirt
      { x: player.x + 2, y: groundY - 128, rx: 23, ry: 27 }, // head
      { x: player.x + 52, y: groundY - 116, rx: 23, ry: 26 }, // baby's head
      { x: player.x + 52, y: groundY - 68, rx: 21, ry: 25 } // baby's outfit
    ];
    return ellipses.some((shape) => circleTouchesEllipse(localBall, ball.radius, shape))
      || playerLegsTouchBall(ball);
  }

  function circleTouchesEllipse(point, radius, ellipse) {
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

  function playerLegsTouchBall(ball) {
    const crouch = player.ducking ? 1 : 0;
    const airBend = player.jumpHeight > 0 ? Math.min(.48, player.jumpHeight / 190) : 0;
    const bend = Math.max(crouch, airBend);
    for (const side of [-1, 1]) {
      const points = [
        { x: player.x + side * 12, y: groundY - 38 - player.jumpHeight },
        { x: player.x + side * 12 + bend * 11, y: groundY - 19 + bend * 8 - airBend * 4 - player.jumpHeight },
        { x: player.x + side * 14 - bend * 7, y: groundY - 4 - airBend * 12 - player.jumpHeight }
      ];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        const t = clamp(((ball.x - a.x) * (b.x - a.x) + (ball.y - a.y) * (b.y - a.y)) / lengthSq, 0, 1);
        const nearestX = a.x + t * (b.x - a.x);
        const nearestY = a.y + t * (b.y - a.y);
        if (Math.hypot(ball.x - nearestX, ball.y - nearestY) <= ball.radius + 5.5) return true;
      }
      const foot = { left: points[2].x - 14, right: points[2].x + 12, top: points[2].y - 3, bottom: points[2].y + 7 };
      const nearestX = clamp(ball.x, foot.left, foot.right);
      const nearestY = clamp(ball.y, foot.top, foot.bottom);
      if (Math.hypot(ball.x - nearestX, ball.y - nearestY) <= ball.radius) return true;
    }
    return false;
  }

  function update(dt) {
    if (state !== 'playing') return;
    elapsed += dt;
    const previousPlayerX = player.x;
    let direction = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) direction -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) direction += 1;
    if (direction) player.targetX = clamp(player.targetX + direction * player.speed * dt, 68, W - 140);
    player.x += (player.targetX - player.x) * Math.min(1, dt * 13);
    if (speechTime > 0) {
      speechTime = Math.max(0, speechTime - dt);
      if (!speechTime) speechBubble.classList.remove('is-visible');
      else positionSpeechLine();
    }
    player.ducking = player.jumpHeight === 0 && !player.jumpPending && (keys.has('ArrowDown') || keys.has('s'));
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
        player.jumpHeight = 0;
        player.jumpVelocity = 0;
      }
    }

    const interval = Math.max(.53, 1.48 - elapsed * .012);
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
        endGame();
        return;
      }
      const wasAheadOfPlayer = previousX > previousPlayerX + 88;
      const isPastPlayer = ball.x <= player.x + 88;
      if (!ball.spoke && wasAheadOfPlayer && isPastPlayer) {
        ball.spoke = true;
        showPassMessage();
      }
      if (progress >= 1) {
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

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 190;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 70, life: .35 + Math.random() * .5, maxLife: .85, size: 2 + Math.random() * 4, color });
    }
  }

  function frame(now) {
    if (state !== 'playing') { draw(); return; }
    const dt = Math.min(.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    draw();
    if (state === 'playing') requestAnimationFrame(frame);
  }

  function roundedRect(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
      shake *= .83;
    }
    drawSky();
    drawStadium();
    drawField();
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
    ctx.fillStyle = '#ffffff20'; ctx.beginPath(); ctx.ellipse(player.x + 9, groundY + 6, 67, 11, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlayer() {
    const x = player.x;
    const anticipation = player.jumpPending ? .68 * (1 - player.jumpPrep / JUMP_PREP_DURATION) : 0;
    const crouch = Math.max(player.ducking ? 1 : 0, anticipation);
    const airBend = player.jumpHeight > 0 ? Math.min(.48, player.jumpHeight / 190) : 0;
    const kneeBend = Math.max(crouch, airBend);

    // Bend at the knees instead of scaling the whole character down.
    ctx.save();
    ctx.translate(0, -player.jumpHeight);
    ctx.strokeStyle = '#d19c76'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const hipX = x + side * 12;
      const kneeX = x + side * 12 + kneeBend * 11;
      const kneeY = groundY - 19 + kneeBend * 8 - airBend * 4;
      const ankleX = x + side * 14 - kneeBend * 7;
      const ankleY = groundY - 4 - airBend * 12;
      ctx.beginPath(); ctx.moveTo(hipX, groundY - 38); ctx.lineTo(kneeX, kneeY); ctx.lineTo(ankleX, ankleY); ctx.stroke();
      roundedRect(ankleX - 14, ankleY - 3, 26, 10, 4, '#f5f2e7');
    }
    ctx.restore();

    // The upper body leans forward while the knees bend into a grounded squat.
    const pivotY = groundY - 37;
    ctx.save();
    ctx.translate(0, -player.jumpHeight);
    ctx.translate(x, pivotY);
    ctx.rotate(crouch * .9);
    ctx.translate(-x, -pivotY);

    // Bright cyan polo shirt, shaped sleeves, collar, and a small football crest.
    ctx.fillStyle = '#10afe2';
    ctx.beginPath();
    ctx.moveTo(x - 23, groundY - 104); ctx.lineTo(x - 37, groundY - 91);
    ctx.lineTo(x - 27, groundY - 62); ctx.lineTo(x - 19, groundY - 69);
    ctx.lineTo(x - 18, groundY - 35); ctx.lineTo(x + 25, groundY - 35);
    ctx.lineTo(x + 24, groundY - 70); ctx.lineTo(x + 34, groundY - 84);
    ctx.lineTo(x + 22, groundY - 99); ctx.lineTo(x + 10, groundY - 105);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eafaff'; ctx.beginPath();
    ctx.moveTo(x - 5, groundY - 104); ctx.lineTo(x + 2, groundY - 92); ctx.lineTo(x + 9, groundY - 104);
    ctx.lineTo(x + 4, groundY - 87); ctx.lineTo(x + 1, groundY - 90); ctx.lineTo(x - 2, groundY - 87); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0887b8'; ctx.fillRect(x + 2, groundY - 87, 2, 35);
    ctx.fillStyle = '#f5fdff'; ctx.beginPath(); ctx.moveTo(x + 14, groundY - 87); ctx.lineTo(x + 23, groundY - 84); ctx.lineTo(x + 22, groundY - 73); ctx.lineTo(x + 14, groundY - 76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#173348'; ctx.beginPath(); ctx.moveTo(x + 16, groundY - 85); ctx.lineTo(x + 21, groundY - 83); ctx.lineTo(x + 20, groundY - 77); ctx.lineTo(x + 16, groundY - 79); ctx.closePath(); ctx.fill();

    // Neck and side-profile face, looking toward the baby.
    ctx.fillStyle = '#c88861'; ctx.fillRect(x - 5, groundY - 119, 17, 20);
    ctx.fillStyle = '#d9a47f'; ctx.beginPath(); ctx.ellipse(x + 2, groundY - 128, 22, 27, .08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 17, groundY - 125); ctx.lineTo(x + 28, groundY - 119); ctx.lineTo(x + 18, groundY - 115); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#986849'; ctx.beginPath(); ctx.arc(x - 15, groundY - 124, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#281e1a'; ctx.beginPath(); ctx.ellipse(x + 10, groundY - 129, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#694637'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + 18, groundY - 107); ctx.quadraticCurveTo(x + 7, groundY - 95, x - 7, groundY - 106); ctx.stroke();
    ctx.fillStyle = '#382820'; ctx.beginPath(); ctx.moveTo(x - 17, groundY - 117); ctx.quadraticCurveTo(x - 2, groundY - 94, x + 13, groundY - 105); ctx.lineTo(x + 7, groundY - 98); ctx.quadraticCurveTo(x - 8, groundY - 94, x - 17, groundY - 108); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e4d0bd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - 16, groundY - 119, 3, 0, Math.PI * 2); ctx.stroke();

    // Backwards black cap: rounded crown, visible opening, strap, and rear-facing brim.
    ctx.fillStyle = '#12171b'; ctx.beginPath();
    ctx.moveTo(x - 21, groundY - 131); ctx.lineTo(x - 20, groundY - 145);
    ctx.quadraticCurveTo(x - 14, groundY - 158, x + 2, groundY - 158);
    ctx.quadraticCurveTo(x + 19, groundY - 158, x + 23, groundY - 144);
    ctx.lineTo(x + 17, groundY - 137); ctx.quadraticCurveTo(x + 1, groundY - 145, x - 9, groundY - 136);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9a47f'; ctx.beginPath(); ctx.ellipse(x - 10, groundY - 145, 6, 4, -.1, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 15, groundY - 143); ctx.quadraticCurveTo(x - 7, groundY - 138, x + 2, groundY - 142); ctx.stroke();
    ctx.fillStyle = '#090d10'; ctx.beginPath(); ctx.moveTo(x - 18, groundY - 139); ctx.lineTo(x - 37, groundY - 134); ctx.lineTo(x - 34, groundY - 129); ctx.lineTo(x - 15, groundY - 132); ctx.closePath(); ctx.fill();

    // Supporting arm behind the baby, which is carried at the player's side.
    ctx.strokeStyle = '#d9a47f'; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 18, groundY - 80); ctx.quadraticCurveTo(x + 27, groundY - 58, x + 48, groundY - 55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 17, groundY - 78); ctx.quadraticCurveTo(x - 14, groundY - 53, x + 10, groundY - 48); ctx.stroke();

    // Baby in a white outfit, held upright beside the torso.
    ctx.fillStyle = '#fffdf6'; ctx.beginPath();
    ctx.moveTo(x + 33, groundY - 88); ctx.quadraticCurveTo(x + 48, groundY - 96, x + 63, groundY - 87);
    ctx.lineTo(x + 72, groundY - 54); ctx.quadraticCurveTo(x + 54, groundY - 43, x + 31, groundY - 54);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8e1d7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 34, groundY - 70); ctx.quadraticCurveTo(x + 51, groundY - 64, x + 69, groundY - 70); ctx.stroke();
    ctx.fillStyle = '#f0ede5'; roundedRect(x + 34, groundY - 51, 16, 18, 6, '#f0ede5'); roundedRect(x + 53, groundY - 51, 16, 18, 6, '#f0ede5');
    ctx.fillStyle = '#edaa78'; ctx.beginPath(); ctx.ellipse(x + 52, groundY - 116, 23, 26, .08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d79769'; ctx.beginPath(); ctx.arc(x + 72, groundY - 116, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#624637'; ctx.beginPath(); ctx.arc(x + 43, groundY - 119, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d48c6c'; ctx.beginPath(); ctx.moveTo(x + 34, groundY - 115); ctx.lineTo(x + 27, groundY - 111); ctx.lineTo(x + 35, groundY - 108); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d9a47f'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x + 15, groundY - 51); ctx.quadraticCurveTo(x + 36, groundY - 46, x + 55, groundY - 54); ctx.stroke();
    ctx.restore();
  }

  function drawBalls() {
    balls.forEach((ball) => {
      const progress = clamp(ball.t / ball.duration, 0, 1);
      const radius = ball.radius;
      ctx.fillStyle = `rgba(13, 30, 17, ${ball.lane === 'ground' ? .22 : .13})`;
      ctx.beginPath(); ctx.ellipse(ball.x - 3, groundY - 3, radius * 1.05, ball.lane === 'ground' ? 5 : 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(ball.x, ball.y);
      ctx.fillStyle = '#fffdf3'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, radius - 0.5, 0, Math.PI * 2); ctx.clip();
      drawSoccerPattern(radius, ball);
      ctx.restore();
      ctx.strokeStyle = '#c9d1c2'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
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

  function playTone(frequency, duration, type) {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.07, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch { /* Audio is optional; gameplay must work without it. */ }
  }

  startButton.addEventListener('click', startGame);
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
  canvas.addEventListener('pointerdown', (event) => { pointerActive = true; canvas.setPointerCapture(event.pointerId); moveToPointer(event); });
  canvas.addEventListener('pointermove', (event) => { if (pointerActive) moveToPointer(event); });
  canvas.addEventListener('pointerup', () => { pointerActive = false; });
  canvas.addEventListener('pointercancel', () => { pointerActive = false; });
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
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? 'Desativar sons' : 'Ativar sons');
    soundButton.querySelector('span').textContent = soundOn ? 'Som ligado' : 'Som desligado';
    if (soundOn) playTone(620, .08, 'sine');
  });

  updateHud();
  resize();
})();
