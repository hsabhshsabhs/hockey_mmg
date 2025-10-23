// game.js
class GoalieClicker {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Конфигурация
        this.FPS = 60;
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
        
        // Линии отладки
        this.debugLines = {
            vertical: [],
            horizontal: []
        };
        this.showDebugLines = false;
        this.lineEditingMode = null;
        
        // Background система
        this.bgRect = { x: 0, y: 0, width: 0, height: 0 };
        this.bgScale = 1;
        
        // Конфигурация относительно background
        this.config = {
            "bg": {
                "path": "background.png",
                "width": 1024,
                "height": 1470,
                "aspectRatio": 1024/1470
            },
            "goalieL": {
                "img": "keepL.png",
                "x_rel": 0.3,
                "y_rel": 0.6,
                "scale": 0.3
            },
            "goalieR": {
                "img": "keepR.png", 
                "x_rel": 0.6,
                "y_rel": 0.6,
                "scale": 0.3
            },
            "spawns": [
                {
                    "x_rel": 0.2,
                    "y_rel": 0.85
                },
                {
                    "x_rel": 0.8,
                    "y_rel": 0.85
                }
            ],
            "targets": [
                {
                    "x_rel": 0.3,
                    "y_rel": 0.45
                },
                {
                    "x_rel": 0.7,
                    "y_rel": 0.45
                }
            ],
            "line": {
                "y_rel": 0.5
            }
        };
        
        this.init();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
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
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const gameArea = document.querySelector('.game-area');
        
        if (gameArea) {
            const rect = gameArea.getBoundingClientRect();
            
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.canvas.style.left = rect.left + 'px';
            this.canvas.style.top = rect.top + 'px';

            this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
            this.canvas.height = Math.max(1, Math.round(rect.height * dpr));

            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        this.computeGameRect();
        this.updateUIElements();
    }

    computeGameRect() {
        const gameArea = document.querySelector('.game-area');
        if (!gameArea) {
            this.gameRect = { x: 0, y: 0, width: 412, height: 892 };
            return;
        }

        const rect = gameArea.getBoundingClientRect();
        
        // Вычисляем размер background с сохранением соотношения сторон
        const bgAspect = this.config.bg.aspectRatio;
        const containerAspect = rect.width / rect.height;
        
        if (containerAspect > bgAspect) {
            // Контейнер шире - подгоняем по высоте
            this.bgRect.height = rect.height;
            this.bgRect.width = rect.height * bgAspect;
            this.bgRect.x = (rect.width - this.bgRect.width) / 2;
            this.bgRect.y = 0;
        } else {
            // Контейнер уже - подгоняем по ширине
            this.bgRect.width = rect.width;
            this.bgRect.height = rect.width / bgAspect;
            this.bgRect.x = 0;
            this.bgRect.y = (rect.height - this.bgRect.height) / 2;
        }
        
        this.bgScale = this.bgRect.width / this.config.bg.width;
        
        // Игровая область теперь совпадает с background
        this.gameRect = {
            x: this.bgRect.x,
            y: this.bgRect.y,
            width: this.bgRect.width,
            height: this.bgRect.height
        };
        
        this.setupSpawnsAndTargets();
    }

    updateUIElements() {
        const goalElement = document.getElementById('goalText');
        if (goalElement) {
            goalElement.style.left = `${this.gameRect.x + this.gameRect.width * 0.5}px`;
            goalElement.style.top = `${this.gameRect.y + this.gameRect.height * 0.15}px`;
        }
    }

    async loadAssets() {
        this.assets = {};
        await this.loadImages();
        await this.loadSounds();
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

            if (totalToLoad === 0) {
                resolve();
                return;
            }

            imagesToLoad.forEach(img => {
                this.assets[img.key] = new Image();
                this.assets[img.key].onload = () => {
                    loadedCount++;
                    if (loadedCount === totalToLoad) resolve();
                };
                this.assets[img.key].onerror = () => {
                    console.warn(`Не удалось загрузить изображение: ${img.path}`);
                    loadedCount++;
                    if (loadedCount === totalToLoad) resolve();
                };
                this.assets[img.key].src = `assets/${img.path}`;
            });
        });
    }

    async loadSounds() {
        this.sounds = {};
        const soundsToLoad = [
            { key: 'background', path: 'game.mp3' },
            { key: 'save', path: 'save.mp3' },
            { key: 'miss', path: 'miss.mp3' }
        ];

        for (const sound of soundsToLoad) {
            try {
                const audio = new Audio();
                audio.src = `assets/${sound.path}`;
                audio.preload = 'auto';
                this.sounds[sound.key] = audio;
                await audio.load();
            } catch (error) {
                console.warn(`Не удалось загрузить звук: ${sound.path}`, error);
            }
        }
    }

    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('restartButton').addEventListener('click', () => this.startGame());
        document.getElementById('muteButton').addEventListener('click', () => this.toggleMute());
        document.getElementById('subscribeButton').addEventListener('click', () => this.openVK());
        
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseenter', () => this.mouseInGameArea = true);
        this.canvas.addEventListener('mouseleave', () => this.mouseInGameArea = false);
        
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        document.addEventListener('click', () => this.resumeAudioContext(), { once: true });
        document.addEventListener('touchstart', () => this.resumeAudioContext(), { once: true });
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

    resumeAudioContext() {
        if (this.audioContext) {
            this.audioContext.resume();
        }
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
            x: s.x_rel * this.bgRect.width,
            y: s.y_rel * this.bgRect.height
        }));

        this.targets = this.config.targets.map(t => ({
            x: t.x_rel * this.bgRect.width,
            y: t.y_rel * this.bgRect.height
        }));

        this.lineY = this.config.line.y_rel * this.bgRect.height;
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
        
        if (this.debugMode) {
            this.updateDebugInfo();
        }
    }

    spawnPuck() {
        const spawnIndex = Math.floor(Math.random() * this.spawns.length);
        const targetIndex = Math.floor(Math.random() * this.targets.length);
        const spawn = this.spawns[spawnIndex];
        const target = this.targets[targetIndex];
        
        const baseSpeed = (260 + Math.random() * 100) * this.speedMult;
        this.pucks.push(new Puck(spawn.x, spawn.y, target.x, target.y, baseSpeed, this.PUCK_RADIUS * this.bgScale));
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
                
                const mid = this.bgRect.width * 0.5;
                const targetSide = puck.tx < mid ? "L" : "R";
                
                if (this.goalieSide === targetSide) {
                    puck.fade = true;
                    this.score++;
                    
                    if (this.saveSoundEnabled) {
                        this.playSaveSound();
                        this.saveSoundCooldown = 3 + Math.random() * 3;
                        this.saveSoundEnabled = false;
                    }
                } else {
                    puck.alive = false;
                    if (!(this.debugMode && this.infiniteLives)) {
                        this.lives--;
                    }
                    this.playMissSound();
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

    updateDebugInfo() {
        const debugElement = document.getElementById('debugInfo');
        if (debugElement) {
            let debugText = `Background: ${this.bgRect.width.toFixed(0)}x${this.bgRect.height.toFixed(0)}`;
            debugText += `<br>Scale: ${this.bgScale.toFixed(3)}`;
            debugText += `<br>Game Area: ${this.gameRect.width.toFixed(0)}x${this.gameRect.height.toFixed(0)}`;
            debugText += `<br>LineY: ${this.lineY.toFixed(1)} (${this.config.line.y_rel})`;
            debugText += `<br>Pucks: ${this.pucks.length}, Goalie: ${this.goalieSide}`;
            
            debugText += `<br>Линии: ${this.showDebugLines ? 'ВКЛ' : 'ВЫКЛ'}`;
            debugText += `<br>Режим: ${this.lineEditingMode || 'нет'}`;
            debugText += `<br>Верт. линии: ${this.debugLines.vertical.length}`;
            debugText += `<br>Гориз. линии: ${this.debugLines.horizontal.length}`;
            debugText += `<br>F3 - линии, F4 - верт., F5 - гориз., Del - удалить`;
            
            debugElement.innerHTML = debugText;
        }
    }

    render() {
        this.ctx.fillStyle = '#0a121e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGameArea();
        this.pucks.forEach(puck => puck.draw(this.ctx, this.gameRect));
        this.drawGoalie();
        
        if (this.debugMode) {
            this.drawDebugMarkers();
            this.drawCursorCoordinates();
        }
    }

    renderStaticScreens() {
        this.ctx.fillStyle = '#0a121e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGameArea();
        
        if (this.debugMode) {
            this.drawDebugMarkers();
            this.drawCursorCoordinates();
        }
    }

    drawCursorCoordinates() {
        if (!this.mouseInGameArea) return;
        
        const relX = (this.mouseX - this.gameRect.x) / this.gameRect.width;
        const relY = (this.mouseY - this.gameRect.y) / this.gameRect.height;
        
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.mouseX - 10, this.mouseY);
        this.ctx.lineTo(this.mouseX + 10, this.mouseY);
        this.ctx.moveTo(this.mouseX, this.mouseY - 10);
        this.ctx.lineTo(this.mouseX, this.mouseY + 10);
        this.ctx.stroke();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(this.mouseX + 15, this.mouseY + 15, 150, 60);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`X: ${relX.toFixed(3)}`, this.mouseX + 20, this.mouseY + 35);
        this.ctx.fillText(`Y: ${relY.toFixed(3)}`, this.mouseX + 20, this.mouseY + 55);
        
        if (this.lineEditingMode) {
            this.ctx.fillStyle = this.lineEditingMode === 'vertical' ? '#00ffff' : '#ffa500';
            this.ctx.fillText(`Режим: ${this.lineEditingMode === 'vertical' ? 'ВЕРТИКАЛЬ' : 'ГОРИЗОНТАЛЬ'}`, 
                             this.mouseX + 20, this.mouseY + 75);
        }
    }

    drawGameArea() {
        this.ctx.fillStyle = '#0e1e37';
        this.ctx.fillRect(this.gameRect.x, this.gameRect.y, this.gameRect.width, this.gameRect.height);
        
        if (this.assets && this.assets.bg && this.assets.bg.complete) {
            this.drawBackground();
        }
    }

    drawBackground() {
        this.ctx.drawImage(
            this.assets.bg, 
            this.bgRect.x, 
            this.bgRect.y, 
            this.bgRect.width, 
            this.bgRect.height
        );
    }

    drawGoalie() {
        const goalieConfig = this.goalieSide === "L" ? this.config.goalieL : this.config.goalieR;
        const assetKey = this.goalieSide === "L" ? 'goalieL' : 'goalieR';
        
        if (this.assets && this.assets[assetKey] && this.assets[assetKey].complete) {
            const config = goalieConfig || {};
            const scale = (config.scale || 1.0) * this.bgScale;
            
            const x = this.bgRect.x + (config.x_rel || 0.3) * this.bgRect.width;
            const y = this.bgRect.y + (config.y_rel || 0.6) * this.bgRect.height;
            
            const width = this.assets[assetKey].width * scale;
            const height = this.assets[assetKey].height * scale;
            
            this.ctx.drawImage(this.assets[assetKey], x, y, width, height);
        } else {
            const x = this.bgRect.x + (this.goalieSide === "L" ? 0.3 : 0.6) * this.bgRect.width;
            const y = this.bgRect.y + 0.6 * this.bgRect.height;
            
            this.ctx.fillStyle = '#0c3c78';
            this.ctx.fillRect(x - 40 * this.bgScale, y - 40 * this.bgScale, 80 * this.bgScale, 80 * this.bgScale);
        }
    }

    drawDebugMarkers() {
        this.ctx.fillStyle = '#00ff00';
        this.spawns.forEach((spawn, index) => {
            const x = this.bgRect.x + spawn.x;
            const y = this.bgRect.y + spawn.y;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 8 * this.bgScale, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = `${12 * this.bgScale}px Arial`;
            this.ctx.fillText(`S${index}`, x + 10 * this.bgScale, y - 10 * this.bgScale);
            this.ctx.fillText(`(${this.config.spawns[index].x_rel.toFixed(3)}, ${this.config.spawns[index].y_rel.toFixed(3)})`, 
                             x + 10 * this.bgScale, y + 20 * this.bgScale);
        });

        this.ctx.fillStyle = '#ff0000';
        this.targets.forEach((target, index) => {
            const x = this.bgRect.x + target.x;
            const y = this.bgRect.y + target.y;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 8 * this.bgScale, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = `${12 * this.bgScale}px Arial`;
            this.ctx.fillText(`T${index}`, x + 10 * this.bgScale, y - 10 * this.bgScale);
            this.ctx.fillText(`(${this.config.targets[index].x_rel.toFixed(3)}, ${this.config.targets[index].y_rel.toFixed(3)})`, 
                             x + 10 * this.bgScale, y + 20 * this.bgScale);
        });

        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.spawns.forEach(spawn => {
            this.targets.forEach(target => {
                this.ctx.beginPath();
                this.ctx.moveTo(this.bgRect.x + spawn.x, this.bgRect.y + spawn.y);
                this.ctx.lineTo(this.bgRect.x + target.x, this.bgRect.y + target.y);
                this.ctx.stroke();
            });
        });
        
        if (this.showDebugLines) {
            this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
            this.ctx.lineWidth = 2 * this.bgScale;
            this.ctx.setLineDash([3, 3]);
            this.debugLines.vertical.forEach(relX => {
                const x = this.bgRect.x + relX * this.bgRect.width;
                this.ctx.beginPath();
                this.ctx.moveTo(x, this.bgRect.y);
                this.ctx.lineTo(x, this.bgRect.y + this.bgRect.height);
                this.ctx.stroke();
                
                this.ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
                this.ctx.font = `${12 * this.bgScale}px Arial`;
                this.ctx.fillText(relX.toFixed(3), x + 5 * this.bgScale, this.bgRect.y + 15 * this.bgScale);
            });

            this.ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
            this.debugLines.horizontal.forEach(relY => {
                const y = this.bgRect.y + relY * this.bgRect.height;
                this.ctx.beginPath();
                this.ctx.moveTo(this.bgRect.x, y);
                this.ctx.lineTo(this.bgRect.x + this.bgRect.width, y);
                this.ctx.stroke();
                
                this.ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
                this.ctx.font = `${12 * this.bgScale}px Arial`;
                this.ctx.fillText(relY.toFixed(3), this.bgRect.x + 5 * this.bgScale, y - 5 * this.bgScale);
            });
            this.ctx.setLineDash([]);
        }
        
        if (this.debugMode) {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2 * this.bgScale;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            const lineYAbsolute = this.bgRect.y + this.lineY;
            this.ctx.moveTo(this.bgRect.x, lineYAbsolute);
            this.ctx.lineTo(this.bgRect.x + this.bgRect.width, lineYAbsolute);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
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

        if (this.debugMode && this.lineEditingMode) {
            const relX = (x - this.bgRect.x) / this.bgRect.width;
            const relY = (y - this.bgRect.y) / this.bgRect.height;
            
            if (this.lineEditingMode === 'vertical') {
                this.debugLines.vertical.push(relX);
                console.log(`Добавлена вертикальная линия: x = ${relX.toFixed(3)}`);
            } else if (this.lineEditingMode === 'horizontal') {
                this.debugLines.horizontal.push(relY);
                console.log(`Добавлена горизонтальная линия: y = ${relY.toFixed(3)}`);
            }
        } else {
            this.goalieSide = this.goalieSide === "L" ? "R" : "L";
        }
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
                document.getElementById('debugInfo').classList.toggle('hidden', !this.debugMode);
                break;
            case 'F2':
                event.preventDefault();
                this.infiniteLives = !this.infiniteLives;
                this.updateHUD();
                break;
            case 'F3':
                event.preventDefault();
                this.showDebugLines = !this.showDebugLines;
                break;
            case 'F4':
                event.preventDefault();
                if (this.lineEditingMode === 'vertical') {
                    this.lineEditingMode = null;
                } else {
                    this.lineEditingMode = 'vertical';
                }
                break;
            case 'F5':
                event.preventDefault();
                if (this.lineEditingMode === 'horizontal') {
                    this.lineEditingMode = null;
                } else {
                    this.lineEditingMode = 'horizontal';
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (this.debugMode) {
                    if (this.lineEditingMode === 'vertical' && this.debugLines.vertical.length > 0) {
                        this.debugLines.vertical.pop();
                    } else if (this.lineEditingMode === 'horizontal' && this.debugLines.horizontal.length > 0) {
                        this.debugLines.horizontal.pop();
                    }
                }
                break;
        }
    }

    playBackgroundMusic() {
        if (this.muted || !this.sounds.background) return;
        
        try {
            this.sounds.background.loop = true;
            this.sounds.background.volume = 0.7;
            this.sounds.background.play().catch(e => {
                console.warn('Не удалось воспроизвести фоновую музыку:', e);
            });
        } catch (error) {
            console.warn('Ошибка воспроизведения фоновой музыки:', error);
        }
    }

    stopBackgroundMusic() {
        if (this.sounds.background) {
            this.sounds.background.pause();
            this.sounds.background.currentTime = 0;
        }
    }

    playSaveSound() {
        if (this.muted || !this.sounds.save) return;
        
        try {
            const saveSound = this.sounds.save.cloneNode();
            saveSound.volume = 1.0;
            saveSound.play().catch(e => {
                console.warn('Не удалось воспроизвести звук сейва:', e);
            });
        } catch (error) {
            console.warn('Ошибка воспроизведения звука сейва:', error);
        }
    }

    playMissSound() {
        if (this.muted || !this.sounds.miss) return;
        
        try {
            if (this.sounds.save) {
                this.sounds.save.pause();
                this.sounds.save.currentTime = 0;
            }
            
            const missSound = this.sounds.miss.cloneNode();
            missSound.volume = 1.0;
            missSound.play().catch(e => {
                console.warn('Не удалось воспроизвести звук пропуска:', e);
            });
        } catch (error) {
            console.warn('Ошибка воспроизведения звука пропуска:', error);
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
    constructor(sx, sy, tx, ty, baseSpeed, radius = 14) {
        this.x = sx;
        this.y = sy;
        this.tx = tx;
        this.ty = ty;
        this.radius = radius;
        
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
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

window.addEventListener('load', () => {
    new GoalieClicker();
});
