// 关键修改：在 Renderer.drawLines 中添加设备像素比处理和坐标校正

// ========== 常量配置 ==========
let pinchStartDistance = 0;
let pinchStartZoom = 1;
const CONFIG = {
    ROWS: 10,
    COLS: 10,
    TILE_SIZE: 50,
    MAX_LEVEL: 7,
    LEVEL_TIME: 180,
    MIN_ZOOM: 0.5,
    MAX_ZOOM: 2.0,
    ZOOM_STEP: 0.1,
    ANIMATION_DURATION: 300
};

// ========== 游戏状态 ==========
class GameState {
    constructor() {
        this.board = [];
        this.selected = [];
        this.hintPair = null;
        this.currentLevel = 1;
        this.totalTime = CONFIG.LEVEL_TIME;
        this.timer = null;
        this.currentZoom = 1;
        this.bgmStarted = false;
        this.images = [];
        this.loadedCount = 0;
    }

    reset() {
        this.board = [];
        this.selected = [];
        this.hintPair = null;
        this.totalTime = CONFIG.LEVEL_TIME;
    }
}

const state = new GameState();

// ========== DOM 元素 ==========
const DOM = {
    game: document.getElementById("game"),
    canvas: document.getElementById("lineCanvas"),
    ctx: document.getElementById("lineCanvas").getContext("2d"),
    timer: document.getElementById('timer'),
    hintBtn: document.getElementById("hintBtn"),
    container: document.getElementById("container"),
    bgm: document.getElementById("bgm"),
    clickSound: document.getElementById("clickSound"),
    clearSound: document.getElementById("clearSound")
};

window.addEventListener('load', () => {
    const gameRect = DOM.game.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(DOM.game).gap) || 0;
    const tileWidth = (gameRect.width - gap * (CONFIG.COLS - 1)) / CONFIG.COLS;
    const tileHeight = (gameRect.height - gap * (CONFIG.ROWS - 1)) / CONFIG.ROWS;
    
    const padding = Math.max(tileWidth, tileHeight);
    const dpr = window.devicePixelRatio || 1;
    
    DOM.canvas.width = (gameRect.width + padding * 2) * dpr;
    DOM.canvas.height = (gameRect.height + padding * 2) * dpr;
    DOM.canvas.style.width = (gameRect.width + padding * 2) + 'px';
    DOM.canvas.style.height = (gameRect.height + padding * 2) + 'px';
    DOM.canvas.style.left = `-${padding}px`;
    DOM.canvas.style.top = `-${padding}px`;
    
    DOM.ctx.scale(dpr, dpr);
});

window.addEventListener('resize', () => {
    const gameRect = DOM.game.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(DOM.game).gap) || 0;
    const tileWidth = (gameRect.width - gap * (CONFIG.COLS - 1)) / CONFIG.COLS;
    const tileHeight = (gameRect.height - gap * (CONFIG.ROWS - 1)) / CONFIG.ROWS;
    
    const padding = Math.max(tileWidth, tileHeight);
    const dpr = window.devicePixelRatio || 1;
    
    DOM.canvas.width = (gameRect.width + padding * 2) * dpr;
    DOM.canvas.height = (gameRect.height + padding * 2) * dpr;
    DOM.canvas.style.width = (gameRect.width + padding * 2) + 'px';
    DOM.canvas.style.height = (gameRect.height + padding * 2) + 'px';
    DOM.canvas.style.left = `-${padding}px`;
    DOM.canvas.style.top = `-${padding}px`;
    
    DOM.ctx.scale(dpr, dpr);
});

// ========== 工具函数 ==========
const Utils = {
    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    isEmpty(r, c) {
        return r < 0 || c < 0 || r >= CONFIG.ROWS || c >= CONFIG.COLS || state.board[r][c] === null;
    },

    getTileCenter(r, c) {
        const gameRect = DOM.game.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(DOM.game).gap) || 0;
        const tileWidth = (gameRect.width - gap * (CONFIG.COLS - 1)) / CONFIG.COLS;
        const tileHeight = (gameRect.height - gap * (CONFIG.ROWS - 1)) / CONFIG.ROWS;
        
        const padding = Math.max(tileWidth, tileHeight);
        
        if (r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS) {
            const tileIndex = r * CONFIG.COLS + c;
            const tiles = DOM.game.querySelectorAll('.tile');
            const tile = tiles[tileIndex];
            
            if (tile) {
                const tileRect = tile.getBoundingClientRect();
                const gameRectWithPadding = {
                    left: gameRect.left - padding,
                    top: gameRect.top - padding
                };
                const centerX = tileRect.left + tileRect.width / 2 - gameRectWithPadding.left;
                const centerY = tileRect.top + tileRect.height / 2 - gameRectWithPadding.top;
                return [centerX, centerY];
            }
        }
        
        let centerX, centerY;
        
        if (c < 0) {
            centerX = padding - tileWidth / 2 - gap;
        } else if (c >= CONFIG.COLS) {
            centerX = gameRect.width + padding + tileWidth / 2 + gap;
        } else {
            centerX = c * (tileWidth + gap) + tileWidth / 2 + padding;
        }
        
        if (r < 0) {
            centerY = padding - tileHeight / 2 - gap;
        } else if (r >= CONFIG.ROWS) {
            centerY = gameRect.height + padding + tileHeight / 2 + gap;
        } else {
            centerY = r * (tileHeight + gap) + tileHeight / 2 + padding;
        }
        
        return [centerX, centerY];
    },

    playSound(sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    },

    tryPlayBGM() {
        if (!state.bgmStarted) {
            DOM.bgm.play().catch(() => {});
            state.bgmStarted = true;
        }
    }
};

// ========== 棋盘管理 ==========
const Board = {
    generate() {
        const total = CONFIG.ROWS * CONFIG.COLS;
        const pairs = Math.floor(total / 2);
        let symbols = [];

        while (symbols.length < pairs) {
            symbols.push(...state.images.slice(0, Math.min(pairs - symbols.length, state.images.length)));
        }
        
        symbols = [...symbols, ...symbols];
        symbols = Utils.shuffleArray(symbols);

        state.board = [];
        let idx = 0;
        for (let r = 0; r < CONFIG.ROWS; r++) {
            const row = [];
            for (let c = 0; c < CONFIG.COLS; c++) {
                row.push(symbols[idx++]);
            }
            state.board.push(row);
        }
    },

    applyGravity() {
        const level = state.currentLevel;
        
        switch(level) {
            case 2: this.moveDown(); break;
            case 3: this.moveLeft(); break;
            case 4: this.moveRight(); break;
            case 5: this.moveToCenter(); break;
            case 6: this.moveToSides(); break;
            case 7: this.moveUpDown(); break;
        }
    },

    moveDown() {
        for (let c = 0; c < CONFIG.COLS; c++) {
            const stack = [];
            for (let r = 0; r < CONFIG.ROWS; r++) {
                if (state.board[r][c]) stack.push(state.board[r][c]);
            }
            for (let r = CONFIG.ROWS - 1; r >= 0; r--) {
                state.board[r][c] = stack.pop() || null;
            }
        }
    },

    moveLeft() {
        for (let r = 0; r < CONFIG.ROWS; r++) {
            const stack = state.board[r].filter(v => v);
            for (let c = 0; c < CONFIG.COLS; c++) {
                state.board[r][c] = stack[c] || null;
            }
        }
    },

    moveRight() {
        for (let r = 0; r < CONFIG.ROWS; r++) {
            const stack = state.board[r].filter(v => v);
            for (let c = CONFIG.COLS - 1; c >= 0; c--) {
                state.board[r][c] = stack.pop() || null;
            }
        }
    },

    moveToCenter() {
        const mid = Math.floor(CONFIG.COLS / 2);
        for (let r = 0; r < CONFIG.ROWS; r++) {
            const tiles = state.board[r].filter(v => v);
            const newRow = Array(CONFIG.COLS).fill(null);
            const start = mid - Math.floor(tiles.length / 2);
            for (let i = 0; i < tiles.length; i++) {
                newRow[start + i] = tiles[i];
            }
            state.board[r] = newRow;
        }
    },

    moveToSides() {
        const mid = Math.floor(CONFIG.COLS / 2);
        for (let r = 0; r < CONFIG.ROWS; r++) {
            const tiles = state.board[r].filter(v => v);
            const newRow = Array(CONFIG.COLS).fill(null);
            let left = mid - 1, right = mid, toggle = true;
            for (let val of tiles) {
                if (toggle && left >= 0) newRow[left--] = val;
                else if (right < CONFIG.COLS) newRow[right++] = val;
                toggle = !toggle;
            }
            state.board[r] = newRow;
        }
    },

    moveUpDown() {
        const mid = Math.floor(CONFIG.ROWS / 2);
        for (let c = 0; c < CONFIG.COLS; c++) {
            const tiles = [];
            for (let r = 0; r < CONFIG.ROWS; r++) {
                if (state.board[r][c]) tiles.push(state.board[r][c]);
            }
            const newCol = Array(CONFIG.ROWS).fill(null);
            let up = mid - 1, down = mid, toggle = true;
            for (let val of tiles) {
                if (toggle && up >= 0) newCol[up--] = val;
                else if (down < CONFIG.ROWS) newCol[down++] = val;
                toggle = !toggle;
            }
            for (let r = 0; r < CONFIG.ROWS; r++) {
                state.board[r][c] = newCol[r];
            }
        }
    },

    isCleared() {
        return state.board.every(row => row.every(cell => cell === null));
    },

    reshuffle() {
        const tiles = [];
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                if (state.board[r][c]) tiles.push(state.board[r][c]);
            }
        }

        if (tiles.length === 0) return;

        const shuffled = Utils.shuffleArray(tiles);
        let idx = 0;
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                state.board[r][c] = idx < shuffled.length ? shuffled[idx++] : null;
            }
        }

        this.applyGravity();
    }
};

// ========== 连接检测 ==========
const Connection = {
    directPathClear(r1, c1, r2, c2) {
        if (r1 === r2) {
            for (let c = Math.min(c1, c2) + 1; c < Math.max(c1, c2); c++) {
                if (!Utils.isEmpty(r1, c)) return false;
            }
            return true;
        }
        if (c1 === c2) {
            for (let r = Math.min(r1, r2) + 1; r < Math.max(r1, r2); r++) {
                if (!Utils.isEmpty(r, c1)) return false;
            }
            return true;
        }
        return false;
    },

    canConnect(pos1, pos2) {
        const [r1, c1] = pos1;
        const [r2, c2] = pos2;

        if (r1 === r2 && c1 === c2) return false;
        if (state.board[r1][c1] !== state.board[r2][c2]) return false;

        const center1 = Utils.getTileCenter(r1, c1);
        const center2 = Utils.getTileCenter(r2, c2);

        if ((r1 === r2 || c1 === c2) && this.directPathClear(r1, c1, r2, c2)) {
            return [...center1, ...center2];
        }

        for (let [r, c] of [[r1, c2], [r2, c1]]) {
            if (Utils.isEmpty(r, c) &&
                this.directPathClear(r1, c1, r, c) &&
                this.directPathClear(r, c, r2, c2)) {
                const cornerCenter = Utils.getTileCenter(r, c);
                return [...center1, ...cornerCenter, ...center2];
            }
        }

        for (let r3 = -1; r3 <= CONFIG.ROWS; r3++) {
            for (let c3 = -1; c3 <= CONFIG.COLS; c3++) {
                if (!Utils.isEmpty(r3, c3)) continue;
                if (!this.directPathClear(r1, c1, r3, c3)) continue;

                for (let r4 = -1; r4 <= CONFIG.ROWS; r4++) {
                    for (let c4 = -1; c4 <= CONFIG.COLS; c4++) {
                        if (!Utils.isEmpty(r4, c4)) continue;
                        if (this.directPathClear(r3, c3, r4, c4) &&
                            this.directPathClear(r4, c4, r2, c2)) {
                            const corner1 = Utils.getTileCenter(r3, c3);
                            const corner2 = Utils.getTileCenter(r4, c4);
                            return [...center1, ...corner1, ...corner2, ...center2];
                        }
                    }
                }
            }
        }

        return false;
    },

    findHint() {
        for (let r1 = 0; r1 < CONFIG.ROWS; r1++) {
            for (let c1 = 0; c1 < CONFIG.COLS; c1++) {
                if (!state.board[r1][c1]) continue;
                for (let r2 = 0; r2 < CONFIG.ROWS; r2++) {
                    for (let c2 = 0; c2 < CONFIG.COLS; c2++) {
                        if (r1 === r2 && c1 === c2) continue;
                        if (state.board[r1][c1] === state.board[r2][c2]) {
                            const path = this.canConnect([r1, c1], [r2, c2]);
                            if (path) {
                                return [[r1, c1], [r2, c2]];
                            }
                        }
                    }
                }
            }
        }
        return null;
    }
};

// ========== 渲染管理 ==========
const Renderer = {
    drawBoard() {
        DOM.game.innerHTML = "";

        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                const tile = this.createTile(r, c);
                DOM.game.appendChild(tile);
            }
        }
    },

    createTile(r, c) {
        const tile = document.createElement("div");
        tile.classList.add("tile");

        if (state.board[r][c]) {
            const img = document.createElement("img");
            img.src = state.board[r][c].src;
            tile.appendChild(img);
        }

        if (state.selected.some(s => s[0] === r && s[1] === c)) {
            tile.classList.add("selected");
        }

        if (state.hintPair && state.hintPair.some(p => p[0] === r && p[1] === c)) {
            tile.classList.add("hint");
        }

        const handleClick = (e) => {
            e.preventDefault();
            Game.onTileClick(r, c);
        };
        tile.addEventListener("click", handleClick);
        tile.addEventListener("touchstart", handleClick);

        return tile;
    },

    drawLines(lines) {
        const gameRect = DOM.game.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(DOM.game).gap) || 0;
        const tileWidth = (gameRect.width - gap * (CONFIG.COLS - 1)) / CONFIG.COLS;
        const tileHeight = (gameRect.height - gap * (CONFIG.ROWS - 1)) / CONFIG.ROWS;
        const padding = Math.max(tileWidth, tileHeight);
        const dpr = window.devicePixelRatio || 1;
        
        // 设置 canvas 尺寸
        DOM.canvas.width = (gameRect.width + padding * 2) * dpr;
        DOM.canvas.height = (gameRect.height + padding * 2) * dpr;
        DOM.canvas.style.left = `-${padding}px`;
        DOM.canvas.style.top = `-${padding}px`;
        
        // 清除画布前先应用 DPR 缩放
        DOM.ctx.scale(dpr, dpr);
        DOM.ctx.clearRect(0, 0, gameRect.width + padding * 2, gameRect.height + padding * 2);
        
        if (!lines || lines.length === 0) {
            return;
        }

        DOM.ctx.save();
        
        // 应用缩放，但不再在这里重复应用 DPR
        DOM.ctx.scale(state.currentZoom, state.currentZoom);
        
        DOM.ctx.strokeStyle = "#ff0000";
        DOM.ctx.lineWidth = 6 / state.currentZoom;
        DOM.ctx.lineCap = "round";
        DOM.ctx.lineJoin = "round";
        DOM.ctx.shadowColor = 'rgba(255, 0, 0, 0.3)';
        DOM.ctx.shadowBlur = 4;

        DOM.ctx.beginPath();
        DOM.ctx.moveTo(lines[0], lines[1]);
        
        for (let i = 2; i < lines.length; i += 2) {
            DOM.ctx.lineTo(lines[i], lines[i + 1]);
        }
        DOM.ctx.stroke();
        
        DOM.ctx.shadowBlur = 0;
        DOM.ctx.fillStyle = "#ff0000";
        
        DOM.ctx.beginPath();
        DOM.ctx.arc(lines[0], lines[1], 8 / state.currentZoom, 0, Math.PI * 2);
        DOM.ctx.fill();
        
        DOM.ctx.beginPath();
        DOM.ctx.arc(lines[lines.length - 2], lines[lines.length - 1], 8 / state.currentZoom, 0, Math.PI * 2);
        DOM.ctx.fill();
        
        DOM.ctx.restore();
    }
};

// ========== 游戏逻辑 ==========
const Game = {
    init() {
        this.loadImages();
        this.setupEventListeners();
        Zoom.init();
    },

    loadImages() {
        for (let i = 1; i <= 20; i++) {
            const img = new Image();
            img.onload = () => {
                state.loadedCount++;
                if (state.loadedCount === 20) {
                    this.startLevel();
                }
            };
            img.onerror = () => {
                console.error(`图片加载失败: images/animal${i}.png`);
                state.loadedCount++;
                if (state.loadedCount === 20) {
                    this.startLevel();
                }
            };
            img.src = `images/animal${i}.png`;
            state.images.push(img);
        }
    },

    startLevel() {
        state.reset();
        Board.generate();
        Board.applyGravity();
        Renderer.drawBoard();
        Timer.start();
    },

    onTileClick(r, c) {
        if (!state.board[r][c]) return;

        Utils.tryPlayBGM();
        state.selected.push([r, c]);
        Utils.playSound(DOM.clickSound);

        if (state.selected.length === 2) {
            const [pos1, pos2] = state.selected;
            const path = Connection.canConnect(pos1, pos2);

            if (path) {
                Utils.playSound(DOM.clearSound);
                
                Renderer.drawBoard();
                Renderer.drawLines(path);

                setTimeout(() => {
                    state.board[pos1[0]][pos1[1]] = null;
                    state.board[pos2[0]][pos2[1]] = null;
                    
                    if (!Board.isCleared()) {
                        Board.applyGravity();
                    }
                    
                    Renderer.drawBoard();
                    Renderer.drawLines([]);
                    this.checkWinOrReshuffle();
                }, CONFIG.ANIMATION_DURATION);
            } else {
                Renderer.drawBoard();
            }

            state.selected = [];
            state.hintPair = null;
        } else {
            Renderer.drawBoard();
        }
    },

    checkWinOrReshuffle() {
        if (Board.isCleared()) {
            setTimeout(() => {
                state.currentLevel++;
                if (state.currentLevel > CONFIG.MAX_LEVEL) {
                    alert("🎉 全部通关！");
                    state.currentLevel = 1;
                }
                this.startLevel();
            }, 500);
        } else {
            setTimeout(() => {
                if (!Connection.findHint()) {
                    Board.reshuffle();
                    Renderer.drawBoard();
                }
            }, 100);
        }
    },

    endGame() {
        Timer.stop();
        alert("⏰ 时间到！游戏结束！");
        state.currentLevel = 1;
        this.startLevel();
    },

    setupEventListeners() {
        DOM.hintBtn.addEventListener("click", () => {
            state.hintPair = Connection.findHint();
            Renderer.drawBoard();
        });

        document.body.addEventListener("click", Utils.tryPlayBGM.bind(Utils), { once: true });
        document.body.addEventListener("touchstart", Utils.tryPlayBGM.bind(Utils), { once: true });
    }
};

// ========== 计时器 ==========
const Timer = {
    start() {
        this.stop();
        state.totalTime = CONFIG.LEVEL_TIME;
        this.updateDisplay();

        state.timer = setInterval(() => {
            if (state.totalTime > 0) {
                state.totalTime--;
                this.updateDisplay();
            } else {
                Game.endGame();
            }
        }, 1000);
    },

    stop() {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
    },

    updateDisplay() {
        const minutes = Math.floor(state.totalTime / 60);
        const seconds = state.totalTime % 60;
        DOM.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
};

// ========== 缩放功能 ==========
const Zoom = {
    init() {
        this.update(1);
        
        DOM.container.addEventListener("touchstart", (e) => {
           if (e.touches.length === 2) {
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
            pinchStartZoom = state.currentZoom;
           }
        }, { passive: true });

        DOM.container.addEventListener("touchmove", (e) => {
            if (e.touches.length === 2) {
            e.preventDefault();

            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            const newDistance = Math.sqrt(dx * dx + dy * dy);

           let scale = newDistance / pinchStartDistance;
           let newZoom = pinchStartZoom * scale;
           newZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, newZoom));

           Zoom.update(newZoom);
           }
        }, { passive: false });
    },

    update(zoom) {
        state.currentZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, zoom));
        DOM.container.style.transform = `scale(${state.currentZoom})`;
    }
};

// ========== 启动游戏 ==========
Game.init();