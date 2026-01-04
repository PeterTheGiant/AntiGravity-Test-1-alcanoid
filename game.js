/**
 * Forest Journey - Game Engine
 */

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.radius = 16;
        this.speedY = 2;

        const config = {
            'EXPAND': { color: '#4b6f44', label: '🌿' },
            'SLOW': { color: '#7fb5b5', label: '🍃' },
            'MULTI': { color: '#ff9b9b', label: '🌰' },
            'SAFETY': { color: '#fdfd96', label: '🛡️' },
            'FIREBALL': { color: '#ff7f50', label: '🔥' },
            'LASER': { color: '#b19cd9', label: '✨' }
        };

        // Safety fallback
        if (!config[type]) type = 'EXPAND';

        this.type = type;
        this.color = config[type].color;
        this.label = config[type].label;
    }

    update() {
        this.y += this.speedY;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.x, this.y);
        ctx.restore();
    }
}

class Ball {
    constructor(x, y, dx, dy, speed, radius, color) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = speed;
        this.radius = radius;
        this.color = color;
        this.attached = false;
        this.isFireball = false;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
    }

    draw(ctx) {
        ctx.save();
        if (this.isFireball) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff4500';
            ctx.fillStyle = '#ff4500';
        } else {
            ctx.fillStyle = this.color;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speedY = -10;
        this.radius = 4;
    }
    update() { this.y += this.speedY; }
    draw(ctx) {
        ctx.fillStyle = '#b19cd9';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type = 'sine', duration = 0.1, volume = 0.1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playHit() { this.playTone(440, 'square', 0.05, 0.05); }
    playPaddle() { this.playTone(220, 'sine', 0.1, 0.1); }
    playExplode() { this.playTone(110, 'sawtooth', 0.2, 0.08); }
    playPowerup() { this.playTone(523, 'sine', 0.3, 0.15); }
    playShot() { this.playTone(880, 'sine', 0.05, 0.05); }
    playWin() {
        this.playTone(440, 'sine', 0.2);
        setTimeout(() => this.playTone(660, 'sine', 0.2), 100);
        setTimeout(() => this.playTone(880, 'sine', 0.4), 200);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.state = 'START';
        this.lastTime = 0;
        this.launchDelay = 0;

        this.paddle = null;
        this.balls = [];
        this.bricks = [];
        this.particles = [];
        this.items = [];
        this.bullets = [];

        this.effects = {
            paddleExpand: 0,
            safetyFloor: 0,
            fireBall: 0,
            laser: 0
        };

        this.audio = new AudioManager();
        this.keys = {};
        window.addEventListener('keydown', e => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
                e.stopPropagation(); // Stop bubbling
                this.keys[e.code] = true;
            }
        });
        window.addEventListener('keyup', e => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
                e.stopPropagation();
                this.keys[e.code] = false;
            }
        });
        // Clear keys on focus loss to prevent stuck keys
        window.addEventListener('blur', () => { this.keys = {}; });

        this.ui = {
            score: document.getElementById('score'),
            lives: document.getElementById('lives'),
            level: document.getElementById('level'),
            skillAnnouncer: document.getElementById('skillAnnouncement'),
            screens: {
                start: document.getElementById('startScreen'),
                gameOver: document.getElementById('gameOverScreen'),
                levelWin: document.getElementById('levelWinScreen')
            },
            finalScore: document.getElementById('finalScore')
        };

        const handleButtonClick = (action) => (e) => {
            e.preventDefault();
            if (e.currentTarget) e.currentTarget.blur();
            if (document.activeElement) document.activeElement.blur();
            window.focus();
            action();
        };

        document.getElementById('startBtn').addEventListener('click', handleButtonClick(() => this.startNewGame()));
        document.getElementById('restartBtn').addEventListener('click', handleButtonClick(() => this.startNewGame()));
        document.getElementById('nextLevelBtn').addEventListener('click', handleButtonClick(() => this.nextLevel()));

        this.initEntities();
        this.setupMobileControls();
        this.requestFrame();
    }

    setupMobileControls() {
        let lastTouchX = null;

        const handleTouch = (e) => {
            e.preventDefault(); // Prevent scrolling

            // Check all active touches
            let touchingRight = false;
            let touchingLeft = false;

            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i];
                const halfWidth = window.innerWidth / 2;

                if (t.clientX > halfWidth) {
                    // Right side: Fire
                    touchingRight = true;
                } else {
                    // Left side: Move
                    if (e.type !== 'touchend') { // Only track movement if finger is down
                        touchingLeft = true;
                        if (lastTouchX !== null) {
                            const deltaX = t.clientX - lastTouchX;
                            // Sensitivity factor (1.5x)
                            this.paddle.x += deltaX * 1.5;
                            // Bounds check
                            this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.x));
                        }
                        lastTouchX = t.clientX;
                    }
                }
            }

            // Update Fire State
            this.keys['Space'] = touchingRight;

            // Reset movement tracking if no fingers on left side
            if (!touchingLeft) {
                lastTouchX = null;
            }
        };

        this.canvas.addEventListener('touchstart', handleTouch, { passive: false });
        this.canvas.addEventListener('touchmove', handleTouch, { passive: false });
        this.canvas.addEventListener('touchend', handleTouch, { passive: false });
    }

    resize() {
        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
    }

    initEntities() {
        // Dynamic Difficulty: Check if mobile
        const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
        const mobileFactor = isMobile ? 0.75 : 1.0; // 25% slower on mobile

        const speedScale = (1 + (this.level - 1) * 0.1) * mobileFactor;
        const sizeScale = Math.max(0.5, 1 - (this.level - 1) * 0.05);

        const pWidth = (this.canvas.width * 0.15) * sizeScale;
        this.paddle = {
            baseWidth: pWidth,
            width: pWidth,
            height: 12,
            x: (this.canvas.width - pWidth) / 2,
            y: this.canvas.height - 40,
            speed: (10 + (this.level - 1)) * mobileFactor, // Paddle also slightly slower matching pace
            color: '#a0522d'
        };

        this.balls = [new Ball(
            this.canvas.width / 2,
            this.paddle.y - 12,
            0, 0,
            7 * speedScale,
            9,
            '#ff7f50'
        )];
        this.balls[0].attached = true;

        this.particles = [];
        this.items = [];
        this.bullets = [];
        this.effects = { paddleExpand: 0, safetyFloor: 0, fireBall: 0, laser: 0 };
        this.generateBricks();
    }

    generateBricks() {
        this.bricks = [];
        const rows = 3 + Math.min(this.level, 5);
        const cols = 8;
        const padding = 10;
        const offsetTop = 60;
        const offsetLeft = 40;
        const bWidth = (this.canvas.width - (offsetLeft * 2) - (padding * (cols - 1))) / cols;
        const bHeight = 22;
        const colors = ['#ff9b9b', '#7fb5b5', '#fdfd96', '#91c18e', '#b19cd9'];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                this.bricks.push({
                    x: c * (bWidth + padding) + offsetLeft,
                    y: r * (bHeight + padding) + offsetTop,
                    w: bWidth,
                    h: bHeight,
                    color: colors[r % colors.length],
                    active: true,
                    points: (rows - r) * 10
                });
            }
        }
    }

    startNewGame() {
        this.score = 0; this.lives = 3; this.level = 1;
        this.keys = {};
        this.resetLevel();
        this.hideOverlays();
        this.state = 'PLAYING';
        this.updateUI();
        this.audio.playTone(440, 'sine', 0.5);
    }

    nextLevel() {
        this.level++;
        this.resetLevel();
        this.hideOverlays();
        this.state = 'PLAYING';
        this.updateUI();
    }

    resetLevel() { this.initEntities(); }

    hideOverlays() { Object.values(this.ui.screens).forEach(s => s.classList.remove('active')); }

    showOverlay(name) { this.ui.screens[name].classList.add('active'); }

    updateUI() {
        this.ui.score.textContent = this.score.toString().padStart(4, '0');
        this.ui.level.textContent = this.level;
        this.ui.lives.innerHTML = '';
        for (let i = 0; i < this.lives; i++) {
            const icon = document.createElement('span');
            icon.className = 'life-icon';
            this.ui.lives.appendChild(icon);
        }
    }

    launchBall() {
        const attachedBall = this.balls.find(b => b.attached);
        if (attachedBall) {
            attachedBall.attached = false;
            attachedBall.dx = (Math.random() - 0.5) * 6;
            attachedBall.dy = -attachedBall.speed;
            this.audio.playHit();
        } else if (this.effects.laser > 0) {
            this.bullets.push(new Bullet(this.paddle.x + 10, this.paddle.y));
            this.bullets.push(new Bullet(this.paddle.x + this.paddle.width - 10, this.paddle.y));
            this.audio.playShot();
        }
    }

    applyItem(type) {
        this.audio.playPowerup();
        const skillNames = {
            'EXPAND': "거대 정령의 축복",
            'SLOW': "미풍의 속삭임",
            'MULTI': "마법 씨앗의 노래",
            'SAFETY': "대지의 가호",
            'FIREBALL': "캘시퍼의 불꽃",
            'LASER': "숲의 투영"
        };
        try {
            this.announceSkill(skillNames[type]);
        } catch (e) {
            console.warn('[Game] Skill announcement failed:', e);
        }

        switch (type) {
            case 'EXPAND': this.effects.paddleExpand = 600; break;
            case 'SLOW':
                this.balls.forEach(b => {
                    b.dx *= 0.6; b.dy *= 0.6; b.speed *= 0.6;
                });
                break;
            case 'MULTI':
                const refBall = this.balls[0] || { x: this.paddle.x, y: this.paddle.y, speed: 7, radius: 9, color: '#ff7f50' };
                for (let i = 0; i < 2; i++) {
                    const b = new Ball(refBall.x, refBall.y, (Math.random() - 0.5) * 8, -refBall.speed, refBall.speed, refBall.radius, refBall.color);
                    this.balls.push(b);
                }
                break;
            case 'SAFETY': this.effects.safetyFloor = 600; break;
            case 'FIREBALL': this.effects.fireBall = 400; break;
            case 'LASER': this.effects.laser = 500; break;
        }
    }

    announceSkill(name) {
        if (!this.ui.skillAnnouncer) return; // Safety check
        try {
            const el = document.createElement('div');
            el.className = 'skill-text skill-animate';
            el.textContent = name;
            this.ui.skillAnnouncer.innerHTML = '';
            this.ui.skillAnnouncer.appendChild(el);
            setTimeout(() => { if (el.parentNode) el.remove(); }, 1500);
        } catch (e) {
            console.error('Skill Announcement Error:', e);
        }
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 8; i++) { // Generate 8 particles
            this.particles.push(new Particle(x, y, color));
        }
    }

    handleCollisions(ball) {
        // Walls
        if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.dx *= -1; this.audio.playHit(); }
        else if (ball.x + ball.radius > this.canvas.width) { ball.x = this.canvas.width - ball.radius; ball.dx *= -1; this.audio.playHit(); }

        if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.dy *= -1; this.audio.playHit(); }

        // Paddle
        if (ball.y + ball.radius > this.paddle.y && ball.y - ball.radius < this.paddle.y + this.paddle.height &&
            ball.x > this.paddle.x && ball.x < this.paddle.x + this.paddle.width) {

            let hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
            ball.dx = hitPos * 7;
            ball.dy = -Math.abs(ball.speed);
            ball.y = this.paddle.y - ball.radius; // Correct position
            this.audio.playPaddle();
        }

        // Bricks
        for (let b of this.bricks) {
            if (!b.active) continue;

            // Simple AABB Collision
            if (ball.x + ball.radius > b.x && ball.x - ball.radius < b.x + b.w &&
                ball.y + ball.radius > b.y && ball.y - ball.radius < b.y + b.h) {

                if (!ball.isFireball) {
                    // Calculate overlaps
                    let bCenterX = b.x + b.w / 2;
                    let bCenterY = b.y + b.h / 2;

                    let overlapX = (b.w / 2 + ball.radius) - Math.abs(ball.x - bCenterX);
                    let overlapY = (b.h / 2 + ball.radius) - Math.abs(ball.y - bCenterY);

                    if (overlapX < overlapY) {
                        ball.dx *= -1;
                        // Push out X
                        if (ball.x < bCenterX) ball.x -= overlapX; else ball.x += overlapX;
                    } else {
                        ball.dy *= -1;
                        // Push out Y
                        if (ball.y < bCenterY) ball.y -= overlapY; else ball.y += overlapY;
                    }
                }

                this.destroyBrick(b);
                break; // Prevent multiple brick hits in one frame
            }
        }
    }

    destroyBrick(b) {
        if (!b.active) return;
        b.active = false;

        // Score & Audio
        this.score += b.points;
        this.updateUI();
        this.audio.playHit();
        this.createExplosion(b.x + b.w / 2, b.y + b.h / 2, b.color);

        // Item Spawn Logic
        if (Math.random() < 0.25) {
            const types = ['EXPAND', 'SLOW', 'MULTI', 'SAFETY', 'FIREBALL', 'LASER'];
            const randomType = types[Math.floor(Math.random() * types.length)];
            this.items.push(new Item(b.x + b.w / 2, b.y + b.h / 2, randomType));
        }

        // Win Condition Check
        if (!this.bricks.some(brick => brick.active)) {
            console.log('[Game] All bricks destroyed. Level Win!');
            this.state = 'LEVEL_WIN';
            this.audio.playWin();
            this.showOverlay('levelWin');
        }
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // Effects
        if (this.effects.paddleExpand > 0) {
            this.paddle.width = this.paddle.baseWidth * 1.6; this.effects.paddleExpand--;
        } else { this.paddle.width = this.paddle.baseWidth; }

        if (this.effects.safetyFloor > 0) this.effects.safetyFloor--;
        if (this.effects.laser > 0) this.effects.laser--;
        if (this.effects.fireBall > 0) {
            this.balls.forEach(b => b.isFireball = true);
            this.effects.fireBall--;
        } else { this.balls.forEach(b => b.isFireball = false); }

        // Paddle
        if (this.keys['ArrowLeft']) this.paddle.x -= this.paddle.speed;
        if (this.keys['ArrowRight']) this.paddle.x += this.paddle.speed;
        this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.x));

        if (this.launchDelay > 0) this.launchDelay--;
        if (this.keys['Space'] && this.launchDelay <= 0) this.launchBall();

        // Bullets (Reverse Loop for safe removal)
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update();
            let bulletHit = false;

            for (let b of this.bricks) {
                if (b.active && bullet.x > b.x && bullet.x < b.x + b.w && bullet.y > b.y && bullet.y < b.y + b.h) {
                    this.destroyBrick(b);
                    bulletHit = true;
                    break; // Bullet destroys only one brick
                }
            }

            if (bulletHit || bullet.y < 0) {
                this.bullets.splice(i, 1);
            }
        }

        // Items (Reverse Loop)
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.update();
            if (item.y + item.radius > this.paddle.y && item.y - item.radius < this.paddle.y + this.paddle.height &&
                item.x > this.paddle.x && item.x < this.paddle.x + this.paddle.width) {
                console.log(`[Game] Item picked up: ${item.type}`);
                this.applyItem(item.type);
                this.items.splice(i, 1);
            } else if (item.y > this.canvas.height) {
                this.items.splice(i, 1);
            }
        }

        // Balls (Reverse Loop)
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            if (ball.attached) {
                ball.x = this.paddle.x + this.paddle.width / 2;
                ball.y = this.paddle.y - ball.radius;
            } else {
                ball.update();
                this.handleCollisions(ball);
                if (ball.y - ball.radius > this.canvas.height) {
                    if (this.effects.safetyFloor > 0) {
                        ball.dy *= -1;
                        ball.y = this.canvas.height - ball.radius;
                        this.effects.safetyFloor = 0;
                        this.audio.playPaddle();
                    } else if (this.balls.length > 1) {
                        this.balls.splice(i, 1); // Safe removal
                    } else {
                        this.lives--; this.updateUI(); this.audio.playExplode();
                        if (this.lives <= 0) {
                            this.state = 'GAME_OVER'; this.ui.finalScore.textContent = this.score; this.showOverlay('gameOver');
                        } else {
                            ball.attached = true; this.keys['Space'] = false; this.launchDelay = 30;
                        }
                    }
                }
            }
        }

        // Particles (Reverse Loop)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.effects.safetyFloor > 0) {
            this.ctx.strokeStyle = '#4b6f44'; this.ctx.lineWidth = 4;
            this.ctx.beginPath(); this.ctx.moveTo(0, this.canvas.height - 2); this.ctx.lineTo(this.canvas.width, this.canvas.height - 2); this.ctx.stroke();
        }
        this.bricks.forEach(b => {
            if (!b.active) return;
            this.ctx.fillStyle = b.color; this.ctx.beginPath(); this.ctx.roundRect(b.x, b.y, b.w, b.h, 6); this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(0,0,0,0.1)'; this.ctx.stroke();
        });
        this.items.forEach(item => item.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.ctx.fillStyle = this.paddle.color;
        this.ctx.beginPath(); this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 20); this.ctx.fill();
        this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 2; this.ctx.stroke();
        if (this.effects.laser > 0) {
            this.ctx.fillStyle = '#b19cd9';
            this.ctx.fillRect(this.paddle.x + 5, this.paddle.y - 5, 10, 5);
            this.ctx.fillRect(this.paddle.x + this.paddle.width - 15, this.paddle.y - 5, 10, 5);
        }
        this.balls.forEach(ball => ball.draw(this.ctx));
    }

    requestFrame() {
        requestAnimationFrame((time) => {
            const dt = (time - this.lastTime) / 1000; this.lastTime = time;
            this.update(dt); this.draw(); this.requestFrame();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
