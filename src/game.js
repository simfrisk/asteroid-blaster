const WORLD_WIDTH = 390;
const WORLD_HEIGHT = 720;
const PLAYER_RADIUS = 18;
const PLANET = { x: 314, y: 246, radius: 54 };
const TERRAIN_CHANGE_SECONDS = 8;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function circleHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function makeInitialState() {
  return {
    mode: "ready",
    score: 0,
    hull: 100,
    planet: 100,
    level: 1,
    time: 0,
    terrainTimer: 0,
    terrainMode: 0,
    combo: 0,
    speedBoostUntil: 0,
    fireCooldown: 0,
    shake: 0,
    flash: 0,
    player: {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT - 116,
      radius: PLAYER_RADIUS,
      vx: 0,
      vy: 0
    },
    ufo: {
      x: 96,
      y: 118,
      radius: 27,
      vx: 48,
      cooldown: 1.2,
      disabledUntil: 0
    },
    bullets: [],
    lasers: [],
    asteroids: [],
    powerups: [],
    sparks: [],
    stars: Array.from({ length: 88 }, (_, index) => ({
      x: (index * 59) % WORLD_WIDTH,
      y: (index * 113) % WORLD_HEIGHT,
      speed: 14 + (index % 5) * 8,
      size: 0.7 + (index % 4) * 0.35
    }))
  };
}

export function terrainRects(mode, time) {
  const drift = Math.sin(time * 0.9) * 34;
  const slide = ((time * 34) % 164) - 82;

  if (mode === 1) {
    return [
      { x: -22 + drift, y: 430, width: 164, height: 18 },
      { x: 250 + drift, y: 430, width: 178, height: 18 },
      { x: 70 - drift, y: 516, width: 244, height: 16 }
    ];
  }

  if (mode === 2) {
    return [
      { x: 42 + slide, y: 384, width: 80, height: 18 },
      { x: 190 + slide, y: 486, width: 108, height: 18 },
      { x: -80 + slide, y: 590, width: 156, height: 18 },
      { x: 310 + slide, y: 590, width: 144, height: 18 }
    ];
  }

  return [
    { x: -20, y: 470, width: 136, height: 18 },
    { x: 276, y: 470, width: 138, height: 18 },
    { x: 114 + drift * 0.45, y: 552, width: 150, height: 16 }
  ];
}

class CaptainLiivoGame {
  constructor(canvas, elements = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.elements = elements;
    this.state = makeInitialState();
    this.keys = new Set();
    this.lastTime = 0;
    this.spawnClock = 0;
    this.powerClock = 0;
    this.animationFrame = 0;
    this.pointerTarget = null;

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  mount() {
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.canvas.addEventListener("pointerdown", (event) => this.setPointerTarget(event));
    this.canvas.addEventListener("pointermove", (event) => {
      if (event.buttons) this.setPointerTarget(event);
    });
    this.canvas.addEventListener("pointerup", () => {
      this.pointerTarget = null;
    });
    this.bindTouchControls();
    this.resize();
    this.draw();
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  start() {
    this.state = makeInitialState();
    this.state.mode = "running";
    this.spawnClock = 1.15;
    this.powerClock = 4.5;
    this.hideOverlay();
    this.updateHud();
  }

  restartIfNeeded() {
    if (this.state.mode !== "running") this.start();
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
    }

    if (key === "enter") {
      this.restartIfNeeded();
      return;
    }

    if (key === "p" && this.state.mode === "running") {
      this.state.mode = "paused";
      this.showOverlay("Paused", "Captain Liivo is holding orbit.", "Resume");
      this.updateHud();
      return;
    }

    if (key === "p" && this.state.mode === "paused") {
      this.state.mode = "running";
      this.hideOverlay();
      this.updateHud();
      return;
    }

    this.keys.add(key);
  }

  handleKeyUp(event) {
    this.keys.delete(event.key.toLowerCase());
  }

  bindTouchControls() {
    document.querySelectorAll("[data-control]").forEach((button) => {
      const control = button.getAttribute("data-control");
      const add = (event) => {
        event.preventDefault();
        this.keys.add(control);
        if (this.state.mode !== "running") this.restartIfNeeded();
      };
      const remove = (event) => {
        event.preventDefault();
        this.keys.delete(control);
      };
      button.addEventListener("pointerdown", add);
      button.addEventListener("pointerup", remove);
      button.addEventListener("pointercancel", remove);
      button.addEventListener("pointerleave", remove);
    });
  }

  setPointerTarget(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTarget = {
      x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT
    };
    if (this.state.mode !== "running") this.restartIfNeeded();
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(this.canvas.width / WORLD_WIDTH, 0, 0, this.canvas.height / WORLD_HEIGHT, 0, 0);
    this.draw();
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000 || 0, 0.033);
    this.lastTime = timestamp;

    if (this.state.mode === "running") {
      this.update(dt);
    }

    this.draw();
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  update(dt) {
    const s = this.state;
    s.time += dt;
    s.fireCooldown = Math.max(0, s.fireCooldown - dt);
    s.terrainTimer += dt;
    s.shake = Math.max(0, s.shake - dt * 36);
    s.flash = Math.max(0, s.flash - dt * 3.2);
    s.planet = clamp(s.planet + dt * 1.2, 0, 100);

    if (s.terrainTimer >= TERRAIN_CHANGE_SECONDS) {
      s.terrainTimer = 0;
      s.terrainMode = (s.terrainMode + 1) % 3;
      this.burst(s.player.x, s.player.y + 14, "#64f2d6", 14);
    }

    this.updatePlayer(dt);
    this.updateUfo(dt);
    this.updateBullets(dt);
    this.updateLasers(dt);
    this.updateAsteroids(dt);
    this.updatePowerups(dt);
    this.updateSparks(dt);
    this.spawnThings(dt);
    this.checkTerrain();

    if (s.planet <= 0 || s.hull <= 0) {
      s.mode = "over";
      this.showOverlay("Mission Lost", `Final score ${Math.round(s.score)}`, "Retry");
    } else if (s.score >= 2500 && s.planet >= 1) {
      s.mode = "won";
      this.showOverlay("Planet Saved", `Final score ${Math.round(s.score)}`, "Again");
    }

    this.updateHud();
  }

  updatePlayer(dt) {
    const s = this.state;
    const player = s.player;
    const boost = s.time < s.speedBoostUntil ? 1.55 : 1;
    const speed = (210 + s.level * 12) * boost;
    let ax = 0;
    let ay = 0;

    if (this.keys.has("arrowleft") || this.keys.has("a") || this.keys.has("left")) ax -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d") || this.keys.has("right")) ax += 1;
    if (this.keys.has("arrowup") || this.keys.has("w") || this.keys.has("up")) ay -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s") || this.keys.has("down")) ay += 1;

    if (this.pointerTarget) {
      const dx = this.pointerTarget.x - player.x;
      const dy = this.pointerTarget.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 8) {
        ax += dx / distance;
        ay += dy / distance;
      }
    }

    const length = Math.hypot(ax, ay) || 1;
    player.vx = (ax / length) * speed;
    player.vy = (ay / length) * speed;
    player.x = clamp(player.x + player.vx * dt, 26, WORLD_WIDTH - 26);
    player.y = clamp(player.y + player.vy * dt, 296, WORLD_HEIGHT - 58);

    if (this.keys.has(" ") || this.keys.has("fire")) this.fire();
  }

  updateUfo(dt) {
    const s = this.state;
    const ufo = s.ufo;
    ufo.x += ufo.vx * dt;
    if (ufo.x < 60 || ufo.x > 192) ufo.vx *= -1;

    if (s.time < ufo.disabledUntil) return;

    ufo.cooldown -= dt;
    if (ufo.cooldown <= 0) {
      ufo.cooldown = 1.1 + Math.random() * 0.8;
      s.lasers.push({
        x: ufo.x - 6 + Math.random() * 12,
        y: ufo.y + 18,
        radius: 5,
        speed: 248 + s.level * 12,
        age: 0
      });
    }
  }

  updateBullets(dt) {
    const s = this.state;
    s.bullets.forEach((bullet) => {
      bullet.y -= bullet.speed * dt;
      bullet.life -= dt;
    });

    s.asteroids.forEach((asteroid) => {
      s.bullets.forEach((bullet) => {
        if (!bullet.dead && !asteroid.dead && circleHit(bullet, asteroid)) {
          bullet.dead = true;
          asteroid.health -= bullet.power;
          this.burst(bullet.x, bullet.y, "#f6d36b", 8);
          if (asteroid.health <= 0) this.destroyAsteroid(asteroid);
        }
      });
    });

    s.bullets.forEach((bullet) => {
      if (!bullet.dead && circleHit(bullet, s.ufo)) {
        bullet.dead = true;
        s.ufo.disabledUntil = s.time + 1.6;
        s.score += 90;
        this.dropPowerup(s.ufo.x, s.ufo.y + 20);
        this.burst(s.ufo.x, s.ufo.y, "#64f2d6", 20);
      }
    });

    s.bullets = s.bullets.filter((bullet) => !bullet.dead && bullet.life > 0 && bullet.y > -18);
  }

  updateLasers(dt) {
    const s = this.state;
    s.lasers.forEach((laser) => {
      laser.y += laser.speed * dt;
      laser.age += dt;
      if (!laser.dead && circleHit(laser, s.player)) {
        laser.dead = true;
        this.damageHull(15);
        this.burst(s.player.x, s.player.y, "#ff6a76", 18);
      }
    });
    s.lasers = s.lasers.filter((laser) => !laser.dead && laser.y < WORLD_HEIGHT + 24);
  }

  updateAsteroids(dt) {
    const s = this.state;
    s.asteroids.forEach((asteroid) => {
      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;
      asteroid.spin += asteroid.spinSpeed * dt;

      if (!asteroid.dead && circleHit(asteroid, PLANET)) {
        asteroid.dead = true;
        s.planet = clamp(s.planet - asteroid.damage, 0, 100);
        s.shake = 10;
        s.flash = 1;
        this.burst(PLANET.x - 24, PLANET.y + 22, "#ff6a76", 28);
      }

      if (!asteroid.dead && circleHit(asteroid, s.player)) {
        asteroid.dead = true;
        this.damageHull(22);
        this.burst(s.player.x, s.player.y, "#d9e6f5", 20);
      }

      if (asteroid.y > WORLD_HEIGHT + 60 || asteroid.x < -80 || asteroid.x > WORLD_WIDTH + 80) {
        asteroid.dead = true;
      }
    });
    s.asteroids = s.asteroids.filter((asteroid) => !asteroid.dead);
  }

  updatePowerups(dt) {
    const s = this.state;
    s.powerups.forEach((powerup) => {
      powerup.y += powerup.speed * dt;
      powerup.spin += dt * 5;
      if (!powerup.dead && circleHit(powerup, s.player)) {
        powerup.dead = true;
        s.speedBoostUntil = s.time + 6;
        s.hull = clamp(s.hull + 8, 0, 100);
        s.score += 60;
        this.burst(powerup.x, powerup.y, "#64f2d6", 18);
      }
    });
    s.powerups = s.powerups.filter((powerup) => !powerup.dead && powerup.y < WORLD_HEIGHT + 28);
  }

  updateSparks(dt) {
    const s = this.state;
    s.sparks.forEach((spark) => {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.life -= dt;
    });
    s.sparks = s.sparks.filter((spark) => spark.life > 0);
  }

  spawnThings(dt) {
    const s = this.state;
    const pressure = 1 + Math.min(s.score / 1400, 1.25);
    s.level = 1 + Math.floor(s.score / 650);
    this.spawnClock -= dt;
    this.powerClock -= dt;

    if (this.spawnClock <= 0) {
      this.spawnClock = Math.max(1.3, 3 - pressure * 0.45 - s.level * 0.06);
      this.spawnAsteroid();
    }

    if (this.powerClock <= 0) {
      this.powerClock = 9 + Math.random() * 7;
      this.dropPowerup(62 + Math.random() * 170, 260 + Math.random() * 80);
    }
  }

  spawnAsteroid() {
    const s = this.state;
    const fromRight = s.time > 20 && Math.random() > 0.42;
    const boss = Math.random() < 0.16 + Math.min(s.score / 8000, 0.1);
    const radius = boss ? 30 + Math.random() * 8 : 17 + Math.random() * 12;
    const x = fromRight ? WORLD_WIDTH + radius : 36 + Math.random() * (WORLD_WIDTH - 130);
    const y = fromRight ? 58 + Math.random() * 92 : -radius - Math.random() * 72;
    const targetX = PLANET.x - 20 + (Math.random() - 0.5) * 46;
    const targetY = PLANET.y + 8 + (Math.random() - 0.5) * 54;
    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.hypot(dx, dy) || 1;
    const speed = (boss ? 35 : 48) + s.level * 4 + Math.random() * 14;

    s.asteroids.push({
      x,
      y,
      radius,
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
      health: boss ? 3 : 1,
      maxHealth: boss ? 3 : 1,
      damage: boss ? 16 : 7,
      boss,
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 3
    });
  }

  dropPowerup(x, y) {
    this.state.powerups.push({
      x,
      y,
      radius: 13,
      speed: 76,
      spin: Math.random() * Math.PI
    });
  }

  fire() {
    const s = this.state;
    const fast = s.time < s.speedBoostUntil;
    if (s.fireCooldown > 0) return;

    s.fireCooldown = fast ? 0.14 : 0.24;
    s.bullets.push({
      x: s.player.x,
      y: s.player.y - 22,
      radius: 4,
      speed: fast ? 510 : 440,
      power: fast ? 1.3 : 1,
      life: 1.4
    });
  }

  destroyAsteroid(asteroid) {
    const s = this.state;
    asteroid.dead = true;
    s.combo += 1;
    s.score += (asteroid.boss ? 220 : 110) + s.combo * 8;
    this.burst(asteroid.x, asteroid.y, asteroid.boss ? "#f6d36b" : "#d9e6f5", asteroid.boss ? 30 : 18);
    if (asteroid.boss) this.dropPowerup(asteroid.x, asteroid.y);
  }

  damageHull(amount) {
    const s = this.state;
    s.hull = clamp(s.hull - amount, 0, 100);
    s.combo = 0;
    s.shake = 7;
  }

  checkTerrain() {
    const s = this.state;
    const nose = { x: s.player.x, y: s.player.y - 14 };
    const engine = { x: s.player.x, y: s.player.y + 22 };
    for (const rect of terrainRects(s.terrainMode, s.time)) {
      if (pointInRect(nose, rect) || pointInRect(engine, rect)) {
        if (!s.lastTerrainHit || s.time - s.lastTerrainHit > 0.8) {
          s.lastTerrainHit = s.time;
          this.damageHull(10);
          this.burst(s.player.x, s.player.y, "#64f2d6", 10);
        }
        break;
      }
    }
  }

  burst(x, y, color, count) {
    const s = this.state;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      s.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.28 + Math.random() * 0.34,
        color
      });
    }
  }

  draw() {
    const ctx = this.ctx;
    const s = this.state;
    const shakeX = s.shake ? (Math.random() - 0.5) * s.shake : 0;
    const shakeY = s.shake ? (Math.random() - 0.5) * s.shake : 0;

    ctx.save();
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.translate(shakeX, shakeY);
    this.drawSpace(ctx);
    this.drawPlanet(ctx);
    this.drawTerrain(ctx);
    this.drawUfo(ctx);
    s.powerups.forEach((powerup) => this.drawPowerup(ctx, powerup));
    s.asteroids.forEach((asteroid) => this.drawAsteroid(ctx, asteroid));
    s.bullets.forEach((bullet) => this.drawBullet(ctx, bullet));
    s.lasers.forEach((laser) => this.drawLaser(ctx, laser));
    this.drawPlayer(ctx);
    this.drawSparks(ctx);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255, 106, 118, ${s.flash * 0.18})`;
      ctx.fillRect(-10, -10, WORLD_WIDTH + 20, WORLD_HEIGHT + 20);
    }
    ctx.restore();
  }

  drawSpace(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    gradient.addColorStop(0, "#07121f");
    gradient.addColorStop(0.46, "#101827");
    gradient.addColorStop(1, "#1c0f19");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.save();
    this.state.stars.forEach((star) => {
      const y = (star.y + this.state.time * star.speed) % WORLD_HEIGHT;
      ctx.globalAlpha = 0.45 + (star.size % 1) * 0.4;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(star.x, y, star.size, star.size + 1.6);
    });
    ctx.restore();
  }

  drawPlanet(ctx) {
    const health = this.state.planet / 100;
    ctx.save();
    ctx.translate(PLANET.x, PLANET.y);
    ctx.rotate(-0.18);

    ctx.strokeStyle = `rgba(248, 219, 126, ${0.28 + health * 0.34})`;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.ellipse(0, 0, 80, 20, 0, 0, Math.PI * 2);
    ctx.stroke();

    const planetGradient = ctx.createRadialGradient(-20, -24, 8, 0, 0, PLANET.radius);
    planetGradient.addColorStop(0, "#f8e8a4");
    planetGradient.addColorStop(0.42, "#66d3cc");
    planetGradient.addColorStop(1, "#22729a");
    ctx.fillStyle = planetGradient;
    ctx.beginPath();
    ctx.arc(0, 0, PLANET.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(7, 18, 31, 0.68)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 86, 17, 0, 0.05, Math.PI - 0.05);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 106, 118, ${1 - health})`;
    ctx.beginPath();
    ctx.arc(0, 0, PLANET.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawTerrain(ctx) {
    ctx.save();
    const rects = terrainRects(this.state.terrainMode, this.state.time);
    rects.forEach((rect, index) => {
      const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
      grad.addColorStop(0, "rgba(100, 242, 214, 0.08)");
      grad.addColorStop(0.5, "rgba(100, 242, 214, 0.46)");
      grad.addColorStop(1, "rgba(246, 211, 107, 0.2)");
      ctx.fillStyle = grad;
      ctx.strokeStyle = index % 2 ? "rgba(246, 211, 107, 0.55)" : "rgba(100, 242, 214, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  drawUfo(ctx) {
    const ufo = this.state.ufo;
    const disabled = this.state.time < ufo.disabledUntil;
    ctx.save();
    ctx.translate(ufo.x, ufo.y);
    ctx.globalAlpha = disabled ? 0.48 : 1;

    ctx.fillStyle = "#8cc8df";
    ctx.beginPath();
    ctx.ellipse(0, 4, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d9e6f5";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#111b29";
    ctx.beginPath();
    ctx.arc(-5, -4, 12, Math.PI, 0, false);
    ctx.lineTo(7, 4);
    ctx.lineTo(-17, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#64f2d6";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = disabled ? "#ff6a76" : "#f6d36b";
    ctx.beginPath();
    ctx.arc(-4, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawAsteroid(ctx, asteroid) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.spin);
    const r = asteroid.radius;
    ctx.fillStyle = asteroid.boss ? "#8d8b86" : "#5f6570";
    ctx.strokeStyle = asteroid.boss ? "#f6d36b" : "#b7c1cf";
    ctx.lineWidth = asteroid.boss ? 3 : 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const wobble = r * (0.72 + ((i * 37) % 19) / 55);
      const x = Math.cos(angle) * wobble;
      const y = Math.sin(angle) * wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(7, 10, 18, 0.55)";
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(-r * 0.35 + i * r * 0.22, -r * 0.2 + (i % 2) * r * 0.32, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    if (asteroid.boss) {
      ctx.fillStyle = "#111827";
      ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Liivo", 0, 1);
    }
    ctx.restore();
  }

  drawPowerup(ctx, powerup) {
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.rotate(powerup.spin);
    ctx.fillStyle = "#64f2d6";
    ctx.strokeStyle = "#f8fbff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawBullet(ctx, bullet) {
    ctx.save();
    ctx.strokeStyle = "#f6d36b";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#f6d36b";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y + 10);
    ctx.lineTo(bullet.x, bullet.y - 14);
    ctx.stroke();
    ctx.restore();
  }

  drawLaser(ctx, laser) {
    ctx.save();
    ctx.strokeStyle = "#ff6a76";
    ctx.lineWidth = 5;
    ctx.shadowColor = "#ff6a76";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(laser.x, laser.y - 14);
    ctx.lineTo(laser.x, laser.y + 16);
    ctx.stroke();
    ctx.restore();
  }

  drawPlayer(ctx) {
    const p = this.state.player;
    const boost = this.state.time < this.state.speedBoostUntil;
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = "#e9eef7";
    ctx.strokeStyle = "#07121f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(18, 22);
    ctx.lineTo(8, 17);
    ctx.lineTo(-8, 17);
    ctx.lineTo(-18, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#172235";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(0, -14 + i * 14, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = boost ? "#64f2d6" : "#f6d36b";
    const flame = boost ? 30 + Math.sin(this.state.time * 22) * 7 : 22 + Math.sin(this.state.time * 18) * 5;
    ctx.beginPath();
    ctx.moveTo(-10, 22);
    ctx.lineTo(0, 22 + flame);
    ctx.lineTo(10, 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSparks(ctx) {
    ctx.save();
    this.state.sparks.forEach((spark) => {
      ctx.globalAlpha = clamp(spark.life * 2.4, 0, 1);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  showOverlay(title, body, action) {
    const overlay = this.elements.overlay;
    if (!overlay) return;
    overlay.hidden = false;
    overlay.querySelector("h1").textContent = title;
    overlay.querySelector("p").textContent = body;
    overlay.querySelector("button").textContent = action;
  }

  hideOverlay() {
    if (this.elements.overlay) this.elements.overlay.hidden = true;
  }

  updateHud() {
    const s = this.state;
    const stateLabels = ["Calm", "Rift", "Slide"];
    const modeLabel = s.mode === "running" ? stateLabels[s.terrainMode] : s.mode[0].toUpperCase() + s.mode.slice(1);
    if (this.elements.score) this.elements.score.textContent = Math.round(s.score).toString();
    if (this.elements.planet) this.elements.planet.textContent = `${Math.round(s.planet)}%`;
    if (this.elements.hull) this.elements.hull.textContent = `${Math.round(s.hull)}%`;
    if (this.elements.state) this.elements.state.textContent = modeLabel;
  }
}

function boot() {
  const canvas = document.getElementById("game");
  if (!canvas) return;

  const game = new CaptainLiivoGame(canvas, {
    overlay: document.getElementById("overlay"),
    score: document.getElementById("score"),
    planet: document.getElementById("planet"),
    hull: document.getElementById("hull"),
    state: document.getElementById("state")
  });

  document.getElementById("startButton")?.addEventListener("click", () => game.start());
  game.mount();
  window.CaptainLiivoGame = game;
}

if (typeof document !== "undefined") {
  boot();
}
