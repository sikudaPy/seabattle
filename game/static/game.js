  /* ==========================================================================
       Константы и конфигурация игры
       ========================================================================== */
    const BOARD_SIZE = 10;
    const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'] //, 'Л', 'М', 'Н', 'О', 'П'];
    
    // Классический флот: 1x4, 2x3, 3x2, 4x1
    const SHIP_SPECS = [
      { size: 4, count: 1, name: 'Линкор' },
      { size: 3, count: 2, name: 'Крейсер' },
      { size: 2, count: 3, name: 'Эсминец' },
      { size: 1, count: 4, name: 'Катер' }
    ];

    /* ==========================================================================
       Звуковые эффекты (Web Audio API)
       ========================================================================== */
    class SoundController {
      constructor() {
        this.ctx = null;
      }

      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
      }

      playTone(freq, duration, type = 'sine', gainVal = 0.15) {
        try {
          this.init();
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
          gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
      }

      miss() {
        this.playTone(320, 0.18, 'sine', 0.08);
      }

      hit() {
        this.playTone(580, 0.22, 'triangle', 0.2);
      }

      sunk() {
        try {
          this.init();
          if (!this.ctx) return;
          // Каскад победных нот затопления
          [300, 220, 150].forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 0.28, 'sawtooth', 0.15), idx * 110);
          });
        } catch (e) {}
      }

      victory() {
        [440, 554, 659, 880].forEach((f, i) => {
          setTimeout(() => this.playTone(f, 0.35, 'triangle', 0.2), i * 150);
        });
      }

      defeat() {
        [300, 270, 230, 180].forEach((f, i) => {
          setTimeout(() => this.playTone(f, 0.45, 'sawtooth', 0.2), i * 180);
        });
      }
    }

    const sound = new SoundController();

    /* ==========================================================================
       Модель данных Корабля и Доски
       ========================================================================== */
    class Ship {
      constructor(size, id) {
        this.id = id;
        this.size = size;
        this.coordinates = []; // [{r, c}]
        this.hits = 0;
      }

      isSunk() {
        return this.hits >= this.size;
      }
    }

    class Board {
      constructor() {
        this.grid = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        // Состояние клеток: 0 - пусто, 1 - корабль, 2 - промах, 3 - ранен/потоплен
        this.ships = [];
      }

      clear() {
        this.grid = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
        this.ships = [];
      }

      // Проверка допустимости размещения корабля
      canPlaceShip(row, col, size, isHorizontal) {
        for (let i = 0; i < size; i++) {
          const r = isHorizontal ? row : row + i;
          const c = isHorizontal ? col + i : col;

          // Проверка выхода за границы
          if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
            return false;
          }

          // Проверка буфера вокруг клетки (1 клетка во все стороны, включая диагонали)
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const checkR = r + dr;
              const checkC = c + dc;
              if (
                checkR >= 0 && checkR < BOARD_SIZE &&
                checkC >= 0 && checkC < BOARD_SIZE
              ) {
                if (this.grid[checkR][checkC] !== null) {
                  return false;
                }
              }
            }
          }
        }
        return true;
      }

      placeShip(row, col, size, isHorizontal) {
        if (!this.canPlaceShip(row, col, size, isHorizontal)) {
          return null;
        }

        const ship = new Ship(size, this.ships.length + 1);
        for (let i = 0; i < size; i++) {
          const r = isHorizontal ? row : row + i;
          const c = isHorizontal ? col + i : col;
          this.grid[r][c] = { ship, index: i, state: 'ship' };
          ship.coordinates.push({ r, c });
        }
        this.ships.push(ship);
        return ship;
      }

      // Случайная расстановка флота
      placeRandomFleet() {
        this.clear();
        const allShipSizes = [];
        SHIP_SPECS.forEach(spec => {
          for (let i = 0; i < spec.count; i++) {
            allShipSizes.push(spec.size);
          }
        });

        // Сортируем от больших к меньшим для стабильной генерации
        allShipSizes.sort((a, b) => b - a);

        for (const size of allShipSizes) {
          let placed = false;
          let attempts = 0;
          while (!placed && attempts < 1000) {
            attempts++;
            const isHorizontal = Math.random() < 0.5;
            const r = Math.floor(Math.random() * BOARD_SIZE);
            const c = Math.floor(Math.random() * BOARD_SIZE);
            if (this.canPlaceShip(r, c, size, isHorizontal)) {
              this.placeShip(r, c, size, isHorizontal);
              placed = true;
            }
          }
          if (!placed) {
            // Если не поместился, перезапускаем заново
            return this.placeRandomFleet();
          }
        }
      }

      // Получить буферные клетки вокруг потопленного корабля
      getSurroundingCoords(ship) {
        const surrounding = [];
        const visited = new Set();

        ship.coordinates.forEach(({ r, c }) => {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              const key = `${nr},${nc}`;
              if (
                nr >= 0 && nr < BOARD_SIZE &&
                nc >= 0 && nc < BOARD_SIZE &&
                !visited.has(key)
              ) {
                visited.add(key);
                // Если в клетке нет самого корабля
                const isShipPart = ship.coordinates.some(coord => coord.r === nr && coord.c === nc);
                if (!isShipPart) {
                  surrounding.push({ r: nr, c: nc });
                }
              }
            }
          }
        });
        return surrounding;
      }

      // Обработка выстрела: результат - 'miss', 'hit', 'sunk', или false (если уже стреляли)
      receiveAttack(r, c) {
        const cell = this.grid[r][c];

        if (cell === 'miss' || (cell && (cell.state === 'hit' || cell.state === 'sunk'))) {
          return false; // Повторный выстрел
        }

        if (cell === null) {
          this.grid[r][c] = 'miss';
          return { result: 'miss', r, c };
        }

        if (cell && cell.state === 'ship') {
          cell.state = 'hit';
          cell.ship.hits++;

          if (cell.ship.isSunk()) {
            cell.ship.coordinates.forEach(coord => {
              this.grid[coord.r][coord.c].state = 'sunk';
            });
            const surrounding = this.getSurroundingCoords(cell.ship);
            surrounding.forEach(coord => {
              if (this.grid[coord.r][coord.c] === null) {
                this.grid[coord.r][coord.c] = 'miss';
              }
            });
            return {
              result: 'sunk',
              ship: cell.ship,
              surrounding,
              r, c
            };
          }

          return { result: 'hit', ship: cell.ship, r, c };
        }

        return false;
      }

      isAllSunk() {
        return this.ships.length > 0 && this.ships.every(s => s.isSunk());
      }

      getAliveCount() {
        return this.ships.filter(s => !s.isSunk()).length;
      }
    }

    /* ==========================================================================
       Интеллект ИИ (ИИ стрелок: Охота + Добивание с определением оси)
       ========================================================================== */
    class BattleshipAI {
      constructor(board) {
        this.board = board; // Ссылка на игровое поле Игрока
        this.reset();
      }

      reset() {
        this.mode = 'HUNT'; // 'HUNT' или 'TARGET'
        this.hitsStack = []; // Клетки текущего раненого, но еще не добитого корабля
        this.candidateTargets = []; // Приоритетные цели вокруг попаданий
        this.shotsFired = new Set(); // Запоминаем все выстрелы: "r,c"
      }

      getNextShot() {
        let shot = null;

        if (this.mode === 'TARGET' && this.candidateTargets.length > 0) {
          // Выбираем следующую клетку из списка кандидатов
          while (this.candidateTargets.length > 0) {
            const candidate = this.candidateTargets.pop();
            const key = `${candidate.r},${candidate.c}`;
            if (!this.shotsFired.has(key)) {
              shot = candidate;
              break;
            }
          }
        }

        // Если целей нет или режим HUNT
        if (!shot) {
          this.mode = 'HUNT';
          shot = this.getHuntShot();
        }

        this.shotsFired.add(`${shot.r},${shot.c}`);
        return shot;
      }

      // Стратегия поиска: шахматный порядок + исключение невозможных клеток
      getHuntShot() {
        const parityCandidates = [];
        const otherCandidates = [];

        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const key = `${r},${c}`;
            if (!this.shotsFired.has(key)) {
              if ((r + c) % 2 === 0) {
                parityCandidates.push({ r, c });
              } else {
                otherCandidates.push({ r, c });
              }
            }
          }
        }

        // В первую очередь стреляем по шахматной сетке
        const pool = parityCandidates.length > 0 ? parityCandidates : otherCandidates;
        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
      }

      // Обработка результата собственного выстрела ИИ
      processResult(shot, attackResult) {
        const { result } = attackResult;

        if (result === 'hit') {
          this.mode = 'TARGET';
          this.hitsStack.push(shot);
          this.recalculateTargets();
        } else if (result === 'sunk') {
          // Корабль добит! Автоматически исключаем окружающие клетки
          if (attackResult.surrounding) {
            attackResult.surrounding.forEach(coord => {
              this.shotsFired.add(`${coord.r},${coord.c}`);
            });
          }
          // Сбрасываем режим добивания
          this.hitsStack = [];
          this.candidateTargets = [];
          this.mode = 'HUNT';
        }
      }

      // Пересчет перспективных целей при попадании
      recalculateTargets() {
        this.candidateTargets = [];

        if (this.hitsStack.length === 1) {
          // Одно попадание - проверяем 4 ортогональных соседа
          const { r, c } = this.hitsStack[0];
          const dirs = [
            { r: r - 1, c },
            { r: r + 1, c },
            { r, c: c - 1 },
            { r, c: c + 1 }
          ];

          dirs.forEach(d => {
            if (this.isValidShot(d.r, d.c)) {
              this.candidateTargets.push(d);
            }
          });
        } else if (this.hitsStack.length > 1) {
          // Два или более попаданий - определяем линию корабля (горизонталь/вертикаль)
          const isHorizontal = this.hitsStack[0].r === this.hitsStack[1].r;

          if (isHorizontal) {
            const row = this.hitsStack[0].r;
            const cols = this.hitsStack.map(h => h.c).sort((a, b) => a - b);
            const minC = cols[0];
            const maxC = cols[cols.length - 1];

            if (this.isValidShot(row, minC - 1)) {
              this.candidateTargets.push({ r: row, c: minC - 1 });
            }
            if (this.isValidShot(row, maxC + 1)) {
              this.candidateTargets.push({ r: row, c: maxC + 1 });
            }
          } else {
            const col = this.hitsStack[0].c;
            const rows = this.hitsStack.map(h => h.r).sort((a, b) => a - b);
            const minR = rows[0];
            const maxR = rows[rows.length - 1];

            if (this.isValidShot(minR - 1, col)) {
              this.candidateTargets.push({ r: minR - 1, c: col });
            }
            if (this.isValidShot(maxR + 1, col)) {
              this.candidateTargets.push({ r: maxR + 1, c: col });
            }
          }
        }
      }

      isValidShot(r, c) {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
        return !this.shotsFired.has(`${r},${c}`);
      }
    }

    /* ==========================================================================
       Главный управляющий класс игры (Game Controller & UI)
       ========================================================================== */
    class GameUI {
      constructor() {
        this.playerBoard = new Board();
        this.aiBoard = new Board();
        this.ai = new BattleshipAI(this.playerBoard);

        this.gameState = 'SETUP'; // 'SETUP', 'BATTLE', 'BATTLE_HUMAN', 'GAMEOVER'
        this.currentTurn = 'PLAYER'; // 'PLAYER', 'AI', 'PLAYER2'
        this.fSecondPlayerHuman = false; 
        
        // Переменные фазы расстановки
        this.isHorizontal = true;
        this.unplacedShips = []; // Список кораблей для размещения
        this.selectedShipSize = null;

        // DOM элементы
        this.statusPanel = document.getElementById('status-panel');
        this.btnRotate = document.getElementById('btn-rotate');
        this.btnRandomPlayer = document.getElementById('btn-random-player');
        this.btnReset = document.getElementById('btn-reset');
        this.btnStart = document.getElementById('btn-start');
        this.btnStartB = document.getElementById('btn-startB');
        this.btnNewGame = document.getElementById('btn-new-game');
        this.dockShipsContainer = document.getElementById('dock-ships');
        this.placementDock = document.getElementById('placement-dock');
        
        this.playerBoardEl = document.getElementById('player-board');
        this.aiBoardEl = document.getElementById('ai-board');
        this.playerScoreEl = document.getElementById('player-score');
        this.aiScoreEl = document.getElementById('ai-score');

        //model end game
        this.modal = document.getElementById('endgame-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalMsg = document.getElementById('modal-msg');

        //model waiting human
        this.WaitModal = document.getElementById('waiting-modal');
        this.WaitModalTitle = document.getElementById('wmodal-title');
        this.WaitModalMsg = document.getElementById('wmodal-msg');

        this.btnModalRestart = document.getElementById('btn-modal-restart');
        this.btnWaitRestart = document.getElementById('btn-wait-restart');  
        this.init();
      }

      init() {
        this.createBoardHeaders('player');
        this.createBoardHeaders('ai');
        this.renderBoardCells('player');
        this.renderBoardCells('ai');

        this.bindEvents();
        this.resetToSetup();
      }

      createBoardHeaders(prefix) {
        const colContainer = document.getElementById(`${prefix}-col-labels`);
        const rowContainer = document.getElementById(`${prefix}-row-labels`);

        LETTERS.forEach(letter => {
          const div = document.createElement('div');
          div.className = 'col-label';
          div.textContent = letter;
          colContainer.appendChild(div);
        });

        for (let i = 1; i <= BOARD_SIZE; i++) {
          const div = document.createElement('div');
          div.className = 'row-label';
          div.textContent = i;
          rowContainer.appendChild(div);
        }
      }

      renderBoardCells(prefix) {
        const boardEl = document.getElementById(`${prefix}-board`);
        boardEl.innerHTML = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            boardEl.appendChild(cell);
          }
        }
      }

      bindEvents() {
        // Поворот корабля
        this.btnRotate.addEventListener('click', () => this.toggleOrientation());
        window.addEventListener('keydown', (e) => {
          if (this.gameState === 'SETUP' && (e.code === 'KeyR' || e.code === 'Space')) {
            e.preventDefault();
            this.toggleOrientation();
          }
        });

        // Кнопки управления
        this.btnRandomPlayer.addEventListener('click', () => {
          sound.init();
          this.playerBoard.placeRandomFleet();
          this.unplacedShips = [];
          this.selectedShipSize = null;
          this.renderPlayerBoard();
          this.updateDockUI();
          this.updateSetupButtons();
        });

        this.btnReset.addEventListener('click', () => {
          sound.init();
          this.resetToSetup();
        });

        this.btnStart.addEventListener('click', () => {
          this.fSecondPlayerHuman = false;
          sound.init();
          this.startBattle();
        });

        this.btnStartB.addEventListener('click', () => {
          this.fSecondPlayerHuman = true;
          sound.init();
          this.startBattle();
        });

        this.btnNewGame.addEventListener('click', () => {
          sound.init();
          this.resetToSetup();
        });

        this.btnModalRestart.addEventListener('click', () => {
          sound.init();
          this.modal.classList.remove('active');
          this.resetToSetup();
        });

        this.btnWaitRestart.addEventListener('click', () => {
          sound.init();
          this.WaitModal.classList.remove('active');
          this.resetToSetup();
        });

        // Наведение и клик по сетке игрока при расстановке
        this.playerBoardEl.addEventListener('mousemove', (e) => this.handlePlayerBoardHover(e));
        this.playerBoardEl.addEventListener('mouseleave', () => this.clearPlayerBoardPreview());
        this.playerBoardEl.addEventListener('click', (e) => this.handlePlayerBoardClick(e));

        // Клик по сетке противника при стрельбе
        this.aiBoardEl.addEventListener('click', (e) => this.handleAiBoardClick(e));
      }

      toggleOrientation() {
        this.isHorizontal = !this.isHorizontal;
        this.btnRotate.textContent = `Поворот: ${this.isHorizontal ? 'Горизонтально [R]' : 'Вертикально [R]'}`;
      }

      resetToSetup() {
        this.gameState = 'SETUP';
        document.getElementById('app').classList.remove('battle-active');
        document.getElementById('app').classList.add('setup-active');

        this.playerBoard.clear();
        this.aiBoard.clear();
        this.ai.reset();

        // Сброс списка неразмещенных кораблей
        this.unplacedShips = [];
        SHIP_SPECS.forEach(spec => {
          for (let i = 0; i < spec.count; i++) {
            this.unplacedShips.push(spec.size);
          }
        });
        this.selectedShipSize = Math.max(...this.unplacedShips);

        this.btnRotate.style.display = 'inline-block';
        this.btnRandomPlayer.style.display = 'inline-block';
        this.btnReset.style.display = 'inline-block';
        this.btnStart.style.display = 'inline-block';
        //disable 
        this.btnStartB.style.display = 'none';  
        this.btnNewGame.style.display = 'none';
        this.placementDock.style.display = 'flex';

        this.statusPanel.className = 'status-panel turn-player';
        this.statusPanel.textContent = 'Расставьте свои корабли на поле или нажмите «Случайно»';

        this.renderPlayerBoard();
        this.renderAiBoard();
        this.updateDockUI();
        this.updateSetupButtons();
        this.updateScores();
      }

      updateSetupButtons() {
        const isFleetReady = this.playerBoard.ships.length === 10;
        this.btnStart.disabled = !isFleetReady;
        this.btnStartB.disabled = !isFleetReady;
        if (isFleetReady) {
          this.statusPanel.textContent = 'Флот готов к бою! Нажмите зеленую кнопку «В бой!»';
        }
      }

      updateDockUI() {
        this.dockShipsContainer.innerHTML = '';
        
        // Группируем доступные корабли
        const counts = {};
        SHIP_SPECS.forEach(s => counts[s.size] = 0);
        this.unplacedShips.forEach(s => counts[s] = (counts[s] || 0) + 1);

        SHIP_SPECS.forEach(spec => {
          const item = document.createElement('div');
          const remaining = counts[spec.size];
          item.className = `dock-ship ${this.selectedShipSize === spec.size ? 'selected' : ''} ${remaining === 0 ? 'disabled' : ''}`;
          
          let decksHtml = '<div class="dock-ship-visual">';
          for (let i = 0; i < spec.size; i++) {
            decksHtml += '<div class="dock-deck"></div>';
          }
          decksHtml += '</div>';

          item.innerHTML = `
            ${decksHtml}
            <span class="dock-count">×${remaining}</span>
          `;

          if (remaining > 0) {
            item.addEventListener('click', () => {
              this.selectedShipSize = spec.size;
              this.updateDockUI();
            });
          }

          this.dockShipsContainer.appendChild(item);
        });

        // Если текущий выбранный размер закончился, выбираем максимальный из оставшихся
        if (this.selectedShipSize && counts[this.selectedShipSize] === 0) {
          const available = Object.keys(counts).map(Number).filter(s => counts[s] > 0);
          this.selectedShipSize = available.length > 0 ? Math.max(...available) : null;
          if (this.selectedShipSize) this.updateDockUI();
        }
      }

      handlePlayerBoardHover(e) {
        if (this.gameState !== 'SETUP' || !this.selectedShipSize) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        this.clearPlayerBoardPreview();

        const canPlace = this.playerBoard.canPlaceShip(row, col, this.selectedShipSize, this.isHorizontal);
        const className = canPlace ? 'preview-valid' : 'preview-invalid';

        for (let i = 0; i < this.selectedShipSize; i++) {
          const r = this.isHorizontal ? row : row + i;
          const c = this.isHorizontal ? col + i : col;
          if (r < BOARD_SIZE && c < BOARD_SIZE) {
            const cellEl = this.playerBoardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (cellEl) cellEl.classList.add(className);
          }
        }
      }

      clearPlayerBoardPreview() {
        const previewCells = this.playerBoardEl.querySelectorAll('.preview-valid, .preview-invalid');
        previewCells.forEach(c => c.classList.remove('preview-valid', 'preview-invalid'));
      }

      handlePlayerBoardClick(e) {
        if (this.gameState !== 'SETUP' || !this.selectedShipSize) return;
        const cell = e.target.closest('.cell');
        if (!cell) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        if (this.playerBoard.canPlaceShip(row, col, this.selectedShipSize, this.isHorizontal)) {
          this.playerBoard.placeShip(row, col, this.selectedShipSize, this.isHorizontal);
          
          // Удаляем один корабль этого размера из неразмещенных
          const idx = this.unplacedShips.indexOf(this.selectedShipSize);
          if (idx !== -1) this.unplacedShips.splice(idx, 1);

          this.clearPlayerBoardPreview();
          this.renderPlayerBoard();
          this.updateDockUI();
          this.updateSetupButtons();
        } else {
          sound.miss();
        }
      }

      renderPlayerBoard() {
        const cells = this.playerBoardEl.querySelectorAll('.cell');
        cells.forEach(cell => {
          const r = parseInt(cell.dataset.row);
          const c = parseInt(cell.dataset.col);
          const state = this.playerBoard.grid[r][c];

          cell.className = 'cell';
          if (state && state.state === 'ship') {
            cell.classList.add('ship');
          } else if (state && state.state === 'hit') {
            cell.classList.add('hit');
          } else if (state && state.state === 'sunk') {
            cell.classList.add('sunk');
          } else if (state === 'miss') {
            cell.classList.add('miss');
          }
        });
      }

      renderAiBoard(revealShips = false) {
        const cells = this.aiBoardEl.querySelectorAll('.cell');
        cells.forEach(cell => {
          const r = parseInt(cell.dataset.row);
          const c = parseInt(cell.dataset.col);
          const state = this.aiBoard.grid[r][c];

          cell.className = 'cell';
          if (state && state.state === 'ship') {
            if (revealShips) cell.classList.add('ship');
          } else if (state && state.state === 'hit') {
            cell.classList.add('hit');
          } else if (state && state.state === 'sunk') {
            cell.classList.add('sunk');
          } else if (state === 'miss') {
            cell.classList.add('miss');
          }
        });
      }

      updateScores() {
        this.playerScoreEl.textContent = `(Живых: ${this.playerBoard.getAliveCount()})`;
        this.aiScoreEl.textContent = `(Живых: ${this.aiBoard.getAliveCount()})`;
      }

      startBattle() {
        this.gameState = 'BATTLE';
        document.getElementById('app').classList.remove('setup-active');
        document.getElementById('app').classList.add('battle-active');

        // Расставляем корабли ИИ
        this.aiBoard.placeRandomFleet();

        // Скрываем инструменты расстановки
        this.btnRotate.style.display = 'none';
        this.btnRandomPlayer.style.display = 'none';
        this.btnReset.style.display = 'none';
        this.btnStart.style.display = 'none';
        this.btnStartB.style.display = 'none';
        this.btnNewGame.style.display = 'inline-block';
        this.placementDock.style.display = 'none';

        this.currentTurn = 'PLAYER';
        this.setStatus('Ваш ход! Выберите клетку на поле противника.', 'player');
        this.updateScores();
      }

      setStatus(text, turnType = 'player') {
        this.statusPanel.textContent = text;
        this.statusPanel.className = `status-panel turn-${turnType}`;
      }

      handleAiBoardClick(e) {
        if (this.gameState !== 'BATTLE' || this.currentTurn !== 'PLAYER') return;
        const cell = e.target.closest('.cell');
        if (!cell) return;

        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);

        const attackResult = this.aiBoard.receiveAttack(r, c);
        if (!attackResult) {
          // Уже стреляли сюда
          return;
        }

        sound.init();
        this.renderAiBoard();
        this.updateScores();

        if (attackResult.result === 'miss') {
          sound.miss();
          this.setStatus(`Вы промахнулись по (${LETTERS[c]}${r + 1})! Ход ИИ...`, 'ai');
          this.currentTurn = 'AI';
          setTimeout(() => this.aiTurn(), 800);
        } else if (attackResult.result === 'hit') {
          sound.hit();
          this.setStatus(`Попадание по (${LETTERS[c]}${r + 1})! Вы стреляете снова.`, 'player');
          this.checkGameOver();
        } else if (attackResult.result === 'sunk') {
          sound.sunk();
          this.setStatus(`Корабль противника (${attackResult.ship.size}-палубный) потоплен! Вы стреляете снова.`, 'player');
          this.renderAiBoard(); // перерисовать ореол
          this.checkGameOver();
        }
      }

      aiTurn() {
        if (this.gameState !== 'BATTLE' || this.currentTurn !== 'AI') return;

        if(this.fSecondPlayerHuman){
            this.WaitModalTitle.textContent = 'Ожидаем хода соперника!';
            this.WaitModalMsg.textContent = 'Интересная информация...';
            this.WaitModal.classList.add('active');  
        }
        const shot = this.ai.getNextShot();
        const attackResult = this.playerBoard.receiveAttack(shot.r, shot.c);
        this.ai.processResult(shot, attackResult);

        this.renderPlayerBoard();
        this.updateScores();

        const coordStr = `${LETTERS[shot.c]}${shot.r + 1}`;

        if (attackResult.result === 'miss') {
          sound.miss();
          this.setStatus(`ИИ выстрелил в ${coordStr} и промахнулся! Ваш ход.`, 'player');
          this.currentTurn = 'PLAYER';
        } else if (attackResult.result === 'hit') {
          sound.hit();
          this.setStatus(`ИИ ранил ваш корабль в ${coordStr}! ИИ делает повторный выстрел...`, 'ai');
          if (!this.checkGameOver()) {
            setTimeout(() => this.aiTurn(), 900);
          }
        } else if (attackResult.result === 'sunk') {
          sound.sunk();
          this.setStatus(`ИИ потопил ваш ${attackResult.ship.size}-палубный корабль! ИИ ходит снова...`, 'ai');
          this.renderPlayerBoard(); // обновить ореол
          if (!this.checkGameOver()) {
            setTimeout(() => this.aiTurn(), 900);
          }
        }
      }

      checkGameOver() {
        if (this.aiBoard.isAllSunk()) {
          this.gameState = 'GAMEOVER';
          sound.victory();
          this.showEndgame(true);
          return true;
        }

        if (this.playerBoard.isAllSunk()) {
          this.gameState = 'GAMEOVER';
          sound.defeat();
          this.renderAiBoard(true); // Открываем корабли противника
          this.showEndgame(false);
          return true;
        }

        return false;
      }

      showEndgame(isPlayerWon) {
        if (isPlayerWon) {
          this.modalTitle.textContent = 'ПОБЕДА!';
          this.modalTitle.className = 'modal-title win';
          this.modalMsg.textContent = 'Вы достойны славы адмирала Ушакова, но императора Павла убьют и Россия не воспользуется вашими победами!';
        } else {
          this.modalTitle.textContent = 'ПОРАЖЕНИЕ!';
          this.modalTitle.className = 'modal-title lose';
          this.modalMsg.textContent = 'Вы адмирал Рождественский потопивший свой флот в Цусиме! Что не удивительно ведь казнократство во флоте не интересовало императора Николай 2!';
        }
        this.modal.classList.add('active');
      }

      //Основная игра между людьми по sockets
      gameHumans(){
        let url = "ws://"+window.location.host+"/ws/socket-server"
        shipSocket= new WebSocket(url)

        shipSocket.onmessage = function(e){
          const data = JSON.parse(e.data);
          console.log('Data:',data)
          
          //Подключение к игре
          if(data.type=="Connected"){
              shipSocket.send(JSON.stringify({
                  "type":"begin",
                  "name": playerName,
                  "ships": [],
              }))
          }

          //Ожидание хода другого игрока
          else if(data.type=="Queue"){
              showLoading();
          }

          //Инициализация игры
          else if(data.type=="Start"){
              
          }

          ///Проверка попадания хода 
          else if(data.type=="opponent_move"){
              if(data.hit){
              }
              else{
              } 
          }

          //Проверка попадания оппонентом
          else if(data.type=="ack_hit"){

              if(data.hit){
              }
              else{
              }
          }

          //Если Вы выиграли
          else if(data.type=="win"){
              shipSocket.close(1000, "win")
          }
          //Если Вы проиграли
          else if(data.type=="lost"){
              shipSocket.close(1000, "lost")
          }
          //Переключение на Ваш ход
          else if(data.type=="turn_on"){
          }
          //Переключение на ход оппонента
          else if(data.type=="turn_off"){
          }

          //Отключение сервера или другого игрока
          else if(data.type=="Disconnected"){
          }

          //Тестирование
          else if(data.type="O"){
              comsole.log("OOOOOO ha vinto il ")
          }
        }

        shipSocket.onclose = function(event) {
          console.log(`Connessione chiusa: codice = ${event.code}, motivo = ${event.reason}`);
        }  
      }
    }

    // Запуск игры при загрузке документа
    window.addEventListener('DOMContentLoaded', () => {
      new GameUI();
    });