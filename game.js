(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const scoreEl = document.getElementById('score');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  // --- Audio (Web Audio API, no external files) ---
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playTone(freq, dur, type='sine', vol=0.15, slide=null) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(slide, audioCtx.currentTime + dur);
    }
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }
  function sfxFlap()  { playTone(620, 0.08, 'square', 0.08, 880); }
  function sfxScore()  {
    playTone(880, 0.1, 'triangle', 0.12);
    setTimeout(() => playTone(1320, 0.15, 'triangle', 0.12), 90);
  }
  function sfxHit()    { playTone(200, 0.3, 'sawtooth', 0.15, 60); }
  function sfxOver()   {
    setTimeout(() => playTone(440, 0.18, 'sine', 0.12, 220), 100);
    setTimeout(() => playTone(330, 0.22, 'sine', 0.12, 165), 300);
  }

  // --- Game state ---
  const STATE = { READY: 0, PLAY: 1, OVER: 2 };
  let state = STATE.READY;
  let score = 0;
  let best = parseInt(localStorage.getItem('flappyBest') || '0', 10);
  bestScoreEl.textContent = best;

  const bird = {
    x: 90, y: H/2, r: 16,
    vy: 0, rot: 0,
    wing: 0
  };

  // Tuned for a calmer, more forgiving feel
  const GRAVITY = 0.38;
  const FLAP = -7.6;
  const MAX_VY = 9;
  let pipes = [];
  let clouds = [];
  let hearts = [];
  let particles = [];
  let frame = 0;
  let pipeTimer = 0;
  const PIPE_W = 60;
  const PIPE_GAP = 210;          // wider gap — easier
  const PIPE_SPEED = 1.7;        // slower pipes — easier
  const PIPE_SPAWN_FRAMES = 115; // more breathing room between pipes

  // init background clouds
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W,
      y: 40 + Math.random() * 200,
      s: 0.6 + Math.random() * 0.8,
      v: 0.3 + Math.random() * 0.4
    });
  }
  // floating hearts — keep them out of the central hint area
  for (let i = 0; i < 5; i++) {
    hearts.push({
      x: Math.random() * W,
      y: H * 0.55 + Math.random() * (H * 0.4),
      s: 12 + Math.random() * 10,
      v: 0.2 + Math.random() * 0.3,
      a: Math.random() * Math.PI * 2
    });
  }

  function reset() {
    bird.x = 90;
    bird.y = H/2;
    bird.vy = 0;
    bird.rot = 0;
    pipes = [];
    particles = [];
    pipeTimer = 0;
    score = 0;
    scoreEl.textContent = '0';
    frame = 0;
  }

  function startGame() {
    initAudio();
    reset();
    state = STATE.PLAY;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
  }

  function flap() {
    if (state === STATE.READY) {
      startGame();
      bird.vy = FLAP;
      sfxFlap();
    } else if (state === STATE.PLAY) {
      bird.vy = FLAP;
      sfxFlap();
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: bird.x - 8, y: bird.y + 4,
          vx: -1 - Math.random()*1.5, vy: 0.5 - Math.random()*2,
          life: 25, color: '#ffb6d5', s: 3 + Math.random()*3
        });
      }
    }
  }

  function die() {
    if (state !== STATE.PLAY) return;
    state = STATE.OVER;
    sfxHit();
    sfxOver();
    if (score > best) {
      best = score;
      localStorage.setItem('flappyBest', best);
    }
    finalScoreEl.textContent = score;
    bestScoreEl.textContent = best;
    setTimeout(() => gameOverScreen.classList.remove('hidden'), 500);
  }

  // --- Input ---
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (state === STATE.OVER) startGame();
    else flap();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (state === STATE.OVER) startGame();
      else flap();
    }
  });
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); startGame(); });
  restartBtn.addEventListener('click', (e) => { e.stopPropagation(); startGame(); });

  // --- Drawing helpers ---
  function drawHeart(x, y, s, color='#ff85c1', alpha=1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(s/20, s/20);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-12, -8, -22, 4, 0, 18);
    ctx.bezierCurveTo(22, 4, 12, -8, 0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawCloud(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI*2);
    ctx.arc(18, -6, 18, 0, Math.PI*2);
    ctx.arc(36, 0, 20, 0, Math.PI*2);
    ctx.arc(18, 8, 16, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,182,213,0.5)';
    ctx.beginPath();
    ctx.arc(0, 4, 18, 0, Math.PI*2);
    ctx.arc(36, 4, 18, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  function drawBird() {
    const { x, y, r, vy } = bird;
    bird.wing += Math.abs(vy) > 2 ? 0.4 : 0.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.min(Math.max(vy * 0.05, -0.4), 1.2));

    const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, r);
    grad.addColorStop(0, '#fff0f6');
    grad.addColorStop(0.5, '#ffb6d5');
    grad.addColorStop(1, '#ff5fa2');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#c8467a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff5fa';
    ctx.beginPath();
    ctx.arc(2, 4, r*0.55, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#ff85c1';
    ctx.strokeStyle = '#c8467a';
    ctx.lineWidth = 1.2;
    const wAng = Math.sin(bird.wing) * 0.6;
    ctx.save();
    ctx.translate(-2, 2);
    ctx.rotate(wAng);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(5, -5, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#c8467a';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#3a1a2a';
    ctx.beginPath();
    ctx.arc(6, -5, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -6, 1, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 105, 180, 0.55)';
    ctx.beginPath();
    ctx.arc(7, 2, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, 4, 2, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#ffb84d';
    ctx.strokeStyle = '#c8467a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(13, -1);
    ctx.lineTo(22, 0);
    ctx.lineTo(13, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (state === STATE.READY) {
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#c8467a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, -r);
      ctx.lineTo(-2, -r-6);
      ctx.lineTo(0, -r-3);
      ctx.lineTo(2, -r-7);
      ctx.lineTo(5, -r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
  function drawPipe(p) {
    const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
    grad.addColorStop(0, '#ff8fbc');
    grad.addColorStop(0.4, '#ff5fa2');
    grad.addColorStop(0.6, '#ff5fa2');
    grad.addColorStop(1, '#c8467a');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#a32e62';
    ctx.lineWidth = 2;

    ctx.fillRect(p.x, 0, PIPE_W, p.top);
    ctx.strokeRect(p.x, 0, PIPE_W, p.top);
    ctx.fillRect(p.x - 4, p.top - 22, PIPE_W + 8, 22);
    ctx.strokeRect(p.x - 4, p.top - 22, PIPE_W + 8, 22);

    const by = p.top + PIPE_GAP;
    ctx.fillRect(p.x, by, PIPE_W, H - by);
    ctx.strokeRect(p.x, by, PIPE_W, H - by);
    ctx.fillRect(p.x - 4, by, PIPE_W + 8, 22);
    ctx.strokeRect(p.x - 4, by, PIPE_W + 8, 22);

    ctx.fillStyle = '#fff';
    const sx = p.x + PIPE_W/2;
    drawSparkle(sx, p.top - 11, 2, (frame + p.x) * 0.1);
    drawSparkle(sx, by + 11, 2, (frame + p.x) * 0.1 + 1.5);
  }
  function drawSparkle(x, y, s, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -s*2);
    ctx.lineTo(s*0.4, -s*0.4);
    ctx.lineTo(s*2, 0);
    ctx.lineTo(s*0.4, s*0.4);
    ctx.lineTo(0, s*2);
    ctx.lineTo(-s*0.4, s*0.4);
    ctx.lineTo(-s*2, 0);
    ctx.lineTo(-s*0.4, -s*0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawGround() {
    const g = ctx.createLinearGradient(0, H-60, 0, H);
    g.addColorStop(0, '#ffc2d8');
    g.addColorStop(1, '#ff85c1');
    ctx.fillStyle = g;
    ctx.fillRect(0, H-60, W, 60);
    ctx.fillStyle = '#ffb6d5';
    for (let x = (frame*2)%20 - 20; x < W; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, H-60);
      ctx.lineTo(x+10, H-72);
      ctx.lineTo(x+20, H-60);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#a32e62';
    ctx.fillRect(0, H-60, W, 3);
  }

  // A clean rounded panel for in-game text so hearts never overlap it
  function drawHintPanel(text, y) {
    ctx.save();
    ctx.font = 'bold 20px "Comic Sans MS", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const paddingX = 18, paddingY = 10;
    const metrics = ctx.measureText(text);
    const w = metrics.width + paddingX * 2;
    const h = 36;
    const x = (W - w) / 2;
    const r = 18;

    ctx.fillStyle = 'rgba(255, 105, 180, 0.88)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + r, y - h/2);
    ctx.lineTo(x + w - r, y - h/2);
    ctx.quadraticCurveTo(x + w, y - h/2, x + w, y - h/2 + r);
    ctx.lineTo(x + w, y + h/2 - r);
    ctx.quadraticCurveTo(x + w, y + h/2, x + w - r, y + h/2);
    ctx.lineTo(x + r, y + h/2);
    ctx.quadraticCurveTo(x, y + h/2, x, y + h/2 - r);
    ctx.lineTo(x, y - h/2 + r);
    ctx.quadraticCurveTo(x, y - h/2, x + r, y - h/2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ff1493';
    ctx.shadowBlur = 0;
    ctx.fillText(text, W/2, y);
    ctx.restore();
  }

  // --- Update ---
  function update() {
    frame++;
    clouds.forEach(c => {
      c.x -= c.v;
      if (c.x < -60) { c.x = W + 40; c.y = 40 + Math.random()*200; }
    });
    hearts.forEach(h => {
      h.y -= h.v;
      h.a += 0.05;
      if (h.y < -20) {
        h.y = H + 20;
        h.x = Math.random() * W;
      }
    });

    if (state === STATE.PLAY) {
      bird.vy += GRAVITY;
      if (bird.vy > MAX_VY) bird.vy = MAX_VY;
      bird.y += bird.vy;
      bird.rot = Math.min(Math.max(bird.vy * 0.06, -0.4), 1.2);

      pipeTimer++;
      if (pipeTimer > PIPE_SPAWN_FRAMES) {
        pipeTimer = 0;
        const minTop = 60;
        const maxTop = H - 60 - PIPE_GAP - 60;
        const top = minTop + Math.random() * (maxTop - minTop);
        pipes.push({ x: W + 10, top: top, passed: false });
      }
      pipes.forEach(p => p.x -= PIPE_SPEED);
      pipes = pipes.filter(p => p.x + PIPE_W + 8 > 0);

      pipes.forEach(p => {
        if (!p.passed && p.x + PIPE_W < bird.x) {
          p.passed = true;
          score++;
          scoreEl.textContent = score;
          sfxScore();
          for (let i = 0; i < 8; i++) {
            const ang = (Math.PI*2) * (i/8);
            particles.push({
              x: bird.x, y: bird.y,
              vx: Math.cos(ang)*2, vy: Math.sin(ang)*2 - 1,
              life: 30, color: '#ff5fa2', s: 4
            });
          }
        }
      });

      if (bird.y + bird.r >= H - 60) { bird.y = H - 60 - bird.r; die(); }
      else if (bird.y - bird.r <= 0) { bird.y = bird.r; bird.vy = 0; }
      pipes.forEach(p => {
        const inX = bird.x + bird.r*0.55 > p.x && bird.x - bird.r*0.55 < p.x + PIPE_W;
        if (inX) {
          if (bird.y - bird.r*0.55 < p.top || bird.y + bird.r*0.55 > p.top + PIPE_GAP) {
            die();
          }
        }
      });
    } else if (state === STATE.READY) {
      bird.y = H/2 + Math.sin(frame*0.08) * 8;
    } else if (state === STATE.OVER) {
      bird.vy += GRAVITY * 0.5;
      bird.y += bird.vy;
      if (bird.y + bird.r > H - 60) {
        bird.y = H - 60 - bird.r;
        bird.vy = 0;
      }
    }

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life--;
    });
    particles = particles.filter(p => p.life > 0);
  }

  // --- Render ---
  function render() {
    ctx.clearRect(0, 0, W, H);

    const sun = ctx.createRadialGradient(60, 60, 5, 60, 60, 80);
    sun.addColorStop(0, 'rgba(255,240,200,0.7)');
    sun.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    clouds.forEach(c => drawCloud(c.x, c.y, c.s));
    hearts.forEach(h => drawHeart(h.x, h.y, h.s, '#ff85c1', 0.25));

    pipes.forEach(drawPipe);

    drawGround();

    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      drawHeart(p.x, p.y, p.s, p.color, 1);
      ctx.globalAlpha = 1;
    });

    drawBird();

    if (state === STATE.READY) {
      drawHintPanel('✨ Кликни, чтобы взлететь! ✨', H/2 - 70);
    }
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }
  loop();
})();
