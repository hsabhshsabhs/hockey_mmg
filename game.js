// game.js
class GoalieClicker {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Конфигурация
        this.FPS = 60;
        this.ASPECT_W = 16;
        this.ASPECT_H = 9;
        this.PUCK_RADIUS = 14;
        this.START_LIVES = 3;
        this.MAX_SPEED_MULT = 5;
        this.SPEED_RAMP_TIME = 120.0;
        
        // Состояние игры
        this.debugMode = false;
        this.infiniteLives = false;
        this.muted = false;
        this.isMobile = this.detectMobile();
        
        // Позиция курсора для отладки
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseInGameArea = false;
        
        // Система задержки звука сейва
        this.saveSoundCooldown = 0;
        this.saveSoundEnabled = true;
        
        // Адаптированный конфиг
        this.config = {
            "bg": {
                "path": "background.png",
                "x_rel": 0.2380375529981829,
                "y_rel": 0.024482758620689655,
                "scale": 0.84
            },
            "goalieL": {
                "img": "keepL.png",
                "x_rel": 0.355,
                "y_rel": 0.465,
                "scale": 0.3399999999999996
            },
            "goalieR": {
                "img": "keepR.png",
                "x_rel": 0.487,
                "y_rel": 0.465,
                "scale": 0.3399999999999996
            },
            "spawns": [
                {
                    "x_rel": 0.288,
                    "y_rel": 0.966
                },
                {
                    "x_rel": 0.712,
                    "y_rel": 0.962
                }
            ],
            "targets": [
                {
                    "x_rel": 0.434,
                    "y_rel": 0.627
                },
                {
                    "x_rel": 0.57,
                    "y_rel": 0.627
                }
            ],
            "line": {
                "y_rel": 0.625
            }
        };
        
        this.init();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768) ||
               ('ontouchstart' in window);
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadAssets();
        this.resetGameState();
        this.setupUI();
        this.gameLoop();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.computeGameRect();
        this.updateUIElements();
    }

    computeGameRect() {
        const maxW = Math.floor(window.innerWidth * 0.95);
        const maxH = Math.floor(window.innerHeight * 0.95);
        
        let targetW = maxW;
        let targetH = Math.floor(targetW * this.ASPECT_H / this.ASPECT_W);
        
        if (targetH > maxH) {
            targetH = maxH;
            targetW = Math.floor(targetH * this.ASPECT_W / this.ASPECT_H);
        }
        
        const gx = (window.innerWidth - targetW) / 2;
        const gy = (window.innerHeight - targetH) / 2;
        
        this.gameRect = { x: gx, y: gy, width: targetW, height: targetH };
    }

    updateUIElements() {
        const goalElement = document.getElementById('goalText');
        goalElement.style.left = `${window.innerWidth * 0.5}px`;
        goalElement.style.top = `${window.innerHeight * 0.242}px`;
    }

    async loadAssets() {
        this.assets = {};
        await this.loadImages();
        // Звуки загружаются по требованию
    }

    loadImages() {
        return new Promise((resolve) => {
            const imagesToLoad = [
                { key: 'bg', path: this.config.bg.path },
                { key: 'goalieL', path: this.config.goalieL.img },
                { key: 'goalieR', path: this.config.goalieR.img }
            ];

            let loadedCount = 0;
            const totalToLoad = imagesToLoad.length;

            imagesToLoad.forEach(img => {
                this.assets[img.key] = new Image();
                this.assets[img.key].onload = () => {
                    loadedCount++;
                    if (loadedCount === totalToLoad) resolve();
                };
                this.assets[img.key].onerror = () => {
                    loadedCount++;
                    if (loadedCount === totalToLoad) resolve();
                };
                this.assets[img.key].src = `assets/${img.path}`;
            });
        });
    }

    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('restartButton').addEventListener('click', () => this.startGame());
        document.getElementById('muteButton').addEventListener('click', () => this.toggleMute());
        document.getElementById('subscribeButton').addEventListener('click', () => this.openVK());
        
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
        
        // Отслеживание движения курсора для отладки
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseenter', () => this.mouseInGameArea = true);
        this.canvas.addEventListener('mouseleave', () => this.mouseInGameArea = false);
        
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Автозапуск аудио по первому клику
        this.enableAudio();
    }

    enableAudio() {
        // Создаем и сразу останавливаем звук чтобы разблокировать аудио
        try {
            const silentAudio = new Audio();
            silentAudio.volume = 0.001;
            const playPromise = silentAudio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    silentAudio.pause();
                }).catch(() => {
                    // Игнорируем ошибки
                });
            }
        } catch (e) {
            // Игнорируем ошибки
        }
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = event.clientX - rect.left;
        this.mouseY = event.clientY - rect.top;
        
        this.mouseInGameArea = (
            this.mouseX >= this.gameRect.x && 
            this.mouseX <= this.gameRect.x + this.gameRect.width &&
            this.mouseY >= this.gameRect.y && 
            this.mouseY <= this.gameRect.y + this.gameRect.height
        );
    }

    setupUI() {
        const hintElement = document.getElementById('startHint');
        if (this.isMobile) {
            hintElement.textContent = 'Тап по экрану — переключить вратаря';
        } else {
            hintElement.textContent = 'Клик/тап по экрану — переключить вратаря во время игры';
        }
        
        const debugHint = document.createElement('div');
        debugHint.className = 'hint';
        debugHint.style.bottom = '50px';
        debugHint.style.color = '#ff6b6b';
        debugHint.textContent = 'DEBUG: F1 - отладка, F2 - беск. жизни, M - звук';
        document.querySelector('.game-area').appendChild(debugHint);
    }

    resetGameState() {
        this.pucks = [];
        this.spawnTimer = 0;
        this.baseSpawnInterval = 0.9;
        this.score = 0;
        this.lives = this.START_LIVES;
        this.elapsed = 0;
        this.speedMult = 1.0;
        this.goalieSide = "L";
        
        this.saveSoundCooldown = 0;
        this.saveSoundEnabled = true;
        
        this.setupSpawnsAndTargets();
        
        this.showGoalText = false;
        this.goalTextTimer = 0;
        
        document.getElementById('goalText').classList.add('hidden');
    }

    setupSpawnsAndTargets() {
        this.spawns = this.config.spawns.map(s => ({
            x: s.x_rel * this.gameRect.width,
            y: s.y_rel * this.gameRect.height
        }));

        this.targets = this.config.targets.map(t => ({
            x: t.x_rel * this.gameRect.width,
            y: t.y_rel * this.gameRect.height
        }));

        this.lineY = this.config.line.y_rel * this.gameRect.height;
    }

    startGame() {
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        
        this.resetGameState();
        this.playBackgroundMusic();
    }

    gameLoop() {
        const now = performance.now();
        const dt = (now - (this.lastTime || now)) / 1000;
        this.lastTime = now;

        if (!document.getElementById('startScreen').classList.contains('hidden') || 
            !document.getElementById('gameOverScreen').classList.contains('hidden')) {
            this.renderStaticScreens();
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        this.update(dt);
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    update(dt) {
        this.elapsed += dt;
        
        const t = Math.min(this.elapsed, this.SPEED_RAMP_TIME) / Math.max(1e-6, this.SPEED_RAMP_TIME);
        this.speedMult = 1.0 + (this.MAX_SPEED_MULT - 1.0) * t;

        const interval = Math.max(0.35, this.baseSpawnInterval / (0.9 + 0.1 * this.speedMult));
        this.spawnTimer += dt;
        if (this.spawnTimer >= interval) {
            this.spawnTimer = 0;
            this.spawnPuck();
        }

        this.updatePucks(dt);
        this.updateHUD();
        this.updateGoalText(dt);
    }

    spawnPuck() {
        const spawnIndex = Math.floor(Math.random() * this.spawns.length);
        const targetIndex = Math.floor(Math.random() * this.targets.length);
        const spawn = this.spawns[spawnIndex];
        const target = this.targets[targetIndex];
        
        const baseSpeed = (260 + Math.random() * 100) * this.speedMult;
        this.pucks.push(new Puck(spawn.x, spawn.y, target.x, target.y, baseSpeed));
    }

    updatePucks(dt) {
        if (this.saveSoundCooldown > 0) {
            this.saveSoundCooldown -= dt;
            if (this.saveSoundCooldown <= 0) {
                this.saveSoundEnabled = true;
                this.saveSoundCooldown = 0;
            }
        }

        for (let i = this.pucks.length - 1; i >= 0; i--) {
            const puck = this.pucks[i];
            const prevY = puck.y;
            
            puck.update(dt);
            
            if ((prevY < this.lineY && puck.y >= this.lineY) || 
                (prevY > this.lineY && puck.y <= this.lineY)) {
                
                const mid = this.gameRect.width * 0.5;
                const targetSide = puck.tx < mid ? "L" : "R";
                
                if (this.goalieSide === targetSide) {
                    puck.fade = true;
                    this.score++;
                } else {
                    puck.alive = false;
                    if (!(this.debugMode && this.infiniteLives)) {
                        this.lives--;
                    }
                    this.showGoalText = true;
                    this.goalTextTimer = 0;
                    
                    if (this.lives <= 0 && !(this.debugMode && this.infiniteLives)) {
                        this.gameOver();
                    }
                }
            }
            
            if (!puck.alive) {
                this.pucks.splice(i, 1);
            }
        }
    }

    updateHUD() {
        document.getElementById('score').textContent = `Счёт: ${this.score}`;
        const livesText = this.debugMode && this.infiniteLives ? 
            `Жизней: ∞` : `Жизней: ${this.lives}`;
        document.getElementById('lives').textContent = livesText;
    }

    updateGoalText(dt) {
        if (this.showGoalText) {
            this.goalTextTimer += dt;
            const goalElement = document.getElementById('goalText');
            goalElement.classList.remove('hidden');
            
            if (this.goalTextTimer >= 2.0) {
                this.showGoalText = false;
                goalElement.classList.add('hidden');
            }
        }
    }

    render() {
        this.ctx.fillStyle = '#0a121e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGameArea();
        this.pucks.forEach(puck => puck.draw(this.ctx, this.gameRect));
        this.drawGoalie();
    }

    renderStaticScreens() {
        this.ctx.fillStyle = '#0a121e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGameArea();
    }

    drawGameArea() {
        this.ctx.fillStyle = '#0e1e37';
        this.ctx.fillRect(this.gameRect.x, this.gameRect.y, this.gameRect.width, this.gameRect.height);
        
        if (this.assets && this.assets.bg && this.assets.bg.complete) {
            this.drawBackground();
        }
    }

    drawBackground() {
        const bgConfig = this.config.bg;
        const scale = bgConfig.scale || 1.0;
        const x = this.gameRect.x + (bgConfig.x_rel || 0) * this.gameRect.width;
        const y = this.gameRect.y + (bgConfig.y_rel || 0) * this.gameRect.height;
        
        const width = this.assets.bg.width * scale;
        const height = this.assets.bg.height * scale;
        
        this.ctx.drawImage(this.assets.bg, x, y, width, height);
    }

    drawGoalie() {
        const goalieConfig = this.goalieSide === "L" ? this.config.goalieL : this.config.goalieR;
        const assetKey = this.goalieSide === "L" ? 'goalieL' : 'goalieR';
        
        if (this.assets && this.assets[assetKey] && this.assets[assetKey].complete) {
            const config = goalieConfig || {};
            const scale = config.scale || 1.0;
            const x = this.gameRect.x + (config.x_rel || 0.22) * this.gameRect.width;
            const y = this.gameRect.y + (config.y_rel || 0.55) * this.gameRect.height;
            
            const width = this.assets[assetKey].width * scale;
            const height = this.assets[assetKey].height * scale;
            
            this.ctx.drawImage(this.assets[assetKey], x, y, width, height);
        }
    }

    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.handleGameInput(x, y);
    }

    handleTouch(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const touch = event.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        this.handleGameInput(x, y);
    }

    handleGameInput(x, y) {
        const muteButton = document.getElementById('muteButton');
        const muteRect = muteButton.getBoundingClientRect();
        
        if (x >= muteRect.left && x <= muteRect.right && 
            y >= muteRect.top && y <= muteRect.bottom) {
            return;
        }

        this.goalieSide = this.goalieSide === "L" ? "R" : "L";
    }

    handleKeyDown(event) {
        switch(event.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.goalieSide = "L";
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.goalieSide = "R";
                break;
            case 'm':
            case 'M':
                this.toggleMute();
                break;
            case 'Escape':
                break;
            case 'F1':
                event.preventDefault();
                this.debugMode = !this.debugMode;
                break;
            case 'F2':
                event.preventDefault();
                this.infiniteLives = !this.infiniteLives;
                this.updateHUD();
                break;
        }
    }

    playBackgroundMusic() {
        if (this.muted) return;
        
        try {
            // Создаем новый Audio для фоновой музыки
            const audio = new Audio('assets/game.mp3');
            audio.loop = true;
            audio.volume = 0.7;
            audio.play().catch(e => {
                console.log('Фоновая музыка не воспроизвелась');
            });
            // Сохраняем ссылку для управления
            this.backgroundMusic = audio;
        } catch (error) {
            console.log('Ошибка фоновой музыки');
        }
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
            this.backgroundMusic.currentTime = 0;
        }
    }

    gameOver() {
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('finalScore').textContent = `Ваш рекорд: ${this.score}`;
        this.stopBackgroundMusic();
    }

    toggleMute() {
        this.muted = !this.muted;
        const button = document.getElementById('muteButton');
        button.textContent = this.muted ? "Вкл звук" : "Выкл звук";
        
        if (this.muted) {
            this.stopBackgroundMusic();
        } else {
            this.playBackgroundMusic();
        }
    }

    openVK() {
        window.open('https://vk.com/club233320861', '_blank');
    }
}

class Puck {
    constructor(sx, sy, tx, ty, baseSpeed) {
        this.x = sx;
        this.y = sy;
        this.tx = tx;
        this.ty = ty;
        
        const dx = tx - sx;
        const dy = ty - sy;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1.0;
        
        this.vx = dx / distance * baseSpeed;
        this.vy = dy / distance * baseSpeed;
        
        this.fade = false;
        this.opacity = 255;
        this.alive = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        if (this.fade) {
            this.alive = false;
        }
    }

    draw(ctx, gameRect) {
        const screenX = gameRect.x + this.x;
        const screenY = gameRect.y + this.y;
        
        ctx.save();
        ctx.globalAlpha = this.opacity / 255;
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

window.addEventListener('load', () => {
    new GoalieClicker();
});
