// Estado global de la aplicación
let currentPiece = null;
let currentMove = null;
let selectedSquare = null;
let ws = null;
let ttsEnabled = true;
let isExecuting = false;
let currentMode = 'tutorial';
let playerProgress = {
    level: 1,
    experience: 0,
    totalPoints: 0,
    piecesLearned: 0,
    exercisesCompleted: 0,
    streakCount: 0,
    completedLessons: [],
    achievements: []
};
let currentChallenge = null;
let challengeTimer = null;
let controlMode = {
    selectedPiece: null,
    fromSquare: null,
    toSquare: null,
    pendingMove: null
};

// Tablero inicial con piezas en posición estándar
let boardState = [
    ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
    ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
    ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
];

// Desafíos y ejercicios
const challenges = {
    pawn: [
        {
            question: "¿A cuántas casillas puede avanzar un peón en su primer movimiento?",
            options: ["1 casilla", "2 casillas", "1 o 2 casillas", "3 casillas"],
            correct: 2,
            hint: "Los peones tienen un movimiento especial en su primera jugada",
            points: 10
        },
        {
            question: "¿Cómo captura un peón?",
            options: ["Hacia adelante", "En diagonal", "Hacia los lados", "Hacia atrás"],
            correct: 1,
            hint: "Los peones capturan diferente a como se mueven",
            points: 15
        }
    ],
    rook: [
        {
            question: "¿En qué direcciones puede moverse la torre?",
            options: ["Solo horizontal", "Solo vertical", "Horizontal y vertical", "En diagonal"],
            correct: 2,
            hint: "La torre se mueve en líneas rectas",
            points: 15
        }
    ],
    knight: [
        {
            question: "¿Cuál es la forma del movimiento del caballo?",
            options: ["Línea recta", "Diagonal", "Forma de L", "En círculo"],
            correct: 2,
            hint: "El caballo tiene un movimiento muy especial y único",
            points: 20
        }
    ]
};

// Sistema de logros
const achievements = {
    first_piece: { name: "Primera Pieza", description: "Aprendiste tu primera pieza", icon: "🎯", points: 5 },
    speed_learner: { name: "Aprendiz Rápido", description: "Completaste 3 lecciones seguidas", icon: "⚡", points: 25 },
    perfectionist: { name: "Perfeccionista", description: "Respondiste 5 desafíos sin errores", icon: "💎", points: 50 },
    chess_master: { name: "Maestro del Ajedrez", description: "Completaste todas las lecciones", icon: "👑", points: 100 }
};

// Configuración de piezas y sus movimientos
const pieceData = {
    pawn: {
        name: 'Peón',
        symbol: '♟',
        points: 10,
        tts: 'El peón se mueve hacia adelante una casilla. Si es su primer movimiento, puede avanzar dos casillas. Para capturar, se mueve en diagonal hacia la casilla del adversario.',
        moves: (row, col) => {
            const moves = [];
            if (row < 7) moves.push([row + 1, col]);
            if (row === 1) moves.push([row + 2, col]);
            if (row < 7 && col > 0) moves.push([row + 1, col - 1]);
            if (row < 7 && col < 7) moves.push([row + 1, col + 1]);
            return moves;
        }
    },
    rook: {
        name: 'Torre',
        symbol: '♜',
        points: 15,
        tts: 'La torre se desplaza en línea recta: hacia delante, atrás o a los lados. Puede recorrer muchas casillas hasta chocar con otra pieza.',
        moves: (row, col) => {
            const moves = [];
            for (let i = 0; i < 8; i++) {
                if (i !== row) moves.push([i, col]);
                if (i !== col) moves.push([row, i]);
            }
            return moves;
        }
    },
    knight: {
        name: 'Caballo',
        symbol: '♞',
        points: 20,
        tts: 'El caballo salta en forma de L: dos casillas en una dirección y una casilla a la derecha o izquierda. Puede saltar sobre otras piezas.',
        moves: (row, col) => {
            const moves = [];
            const knightMoves = [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]];
            knightMoves.forEach(([dr, dc]) => {
                const newRow = row + dr;
                const newCol = col + dc;
                if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                    moves.push([newRow, newCol]);
                }
            });
            return moves;
        }
    },
    bishop: {
        name: 'Alfil',
        symbol: '♝',
        points: 15,
        tts: 'El alfil se mueve diagonalmente, siempre en el mismo color de casilla en el que empezó. Recorre tantas casillas como necesite hasta chocar con otra pieza.',
        moves: (row, col) => {
            const moves = [];
            for (let i = 1; i < 8; i++) {
                if (row + i < 8 && col + i < 8) moves.push([row + i, col + i]);
                if (row + i < 8 && col - i >= 0) moves.push([row + i, col - i]);
                if (row - i >= 0 && col + i < 8) moves.push([row - i, col + i]);
                if (row - i >= 0 && col - i >= 0) moves.push([row - i, col - i]);
            }
            return moves;
        }
    },
    queen: {
        name: 'Reina',
        symbol: '♛',
        points: 25,
        tts: 'La reina puede moverse como la torre y como el alfil: en línea recta o en diagonal. Es la pieza más poderosa.',
        moves: (row, col) => {
            const moves = [];
            // Combinar movimientos de torre y alfil
            for (let i = 0; i < 8; i++) {
                if (i !== row) moves.push([i, col]);
                if (i !== col) moves.push([row, i]);
            }
            for (let i = 1; i < 8; i++) {
                if (row + i < 8 && col + i < 8) moves.push([row + i, col + i]);
                if (row + i < 8 && col - i >= 0) moves.push([row + i, col - i]);
                if (row - i >= 0 && col + i < 8) moves.push([row - i, col + i]);
                if (row - i >= 0 && col - i >= 0) moves.push([row - i, col - i]);
            }
            return moves;
        }
    },
    king: {
        name: 'Rey',
        symbol: '♚',
        points: 30,
        tts: 'El rey se mueve una casilla en cualquier dirección. Hay una jugada especial llamada enroque, donde el rey y la torre se mueven juntos para proteger al rey.',
        moves: (row, col) => {
            const moves = [];
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const newRow = row + dr;
                    const newCol = col + dc;
                    if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                        moves.push([newRow, newCol]);
                    }
                }
            }
            return moves;
        }
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeChessBoard();
    initializeEventListeners();
    initializeWebSocket();
    updateControlValues();
    loadPlayerProgress();
    updateProgressDisplay();
    updateLessonStates();
});

// Crear tablero de ajedrez
function initializeChessBoard() {
    const board = document.getElementById('chess-board');
    board.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', handleSquareClick);

            // Agregar pieza si existe en el estado del tablero
            if (boardState[row][col]) {
                square.textContent = boardState[row][col];
            }

            board.appendChild(square);
        }
    }
}

// Event listeners
function initializeEventListeners() {
    // Lesson cards
    document.querySelectorAll('.lesson-card').forEach(card => {
        card.addEventListener('click', function() {
            if (!this.classList.contains('locked')) {
                selectPiece(this.dataset.piece);
            }
        });
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchMode(this.id.replace('mode-', ''));
        });
    });

    // Botones principales
    document.getElementById('play-animation').addEventListener('click', playAnimation);
    document.getElementById('execute-robot').addEventListener('click', executeRobotMove);
    document.getElementById('repeat-explanation').addEventListener('click', repeatExplanation);
    document.getElementById('emergency-stop').addEventListener('click', emergencyStop);
    document.getElementById('tts-toggle').addEventListener('click', toggleTTS);

    // Challenge buttons
    document.getElementById('challenge-hint').addEventListener('click', showChallengeHint);
    document.getElementById('challenge-skip').addEventListener('click', skipChallenge);

    // Chat
    document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);

    // Modal
    document.getElementById('teacher-confirmation').addEventListener('change', function() {
        document.getElementById('confirm-execution').disabled = !this.checked;
    });
    document.getElementById('cancel-execution').addEventListener('click', closeConfirmationModal);
    document.getElementById('confirm-execution').addEventListener('click', confirmExecution);

    // Controles
    document.getElementById('speed-control').addEventListener('input', updateControlValues);
    document.getElementById('grip-control').addEventListener('input', updateControlValues);
}

// WebSocket para comunicación con el robot
function initializeWebSocket() {
    // Simulación de WebSocket (en producción usar URL real)
    ws = {
        send: function(data) {
            console.log('Enviando al robot:', data);
            // Simular respuesta del robot
            setTimeout(() => {
                const msg = JSON.parse(data);
                if (msg.type === 'prepare_move') {
                    handleRobotMessage({
                        type: 'prepare_move_response',
                        id: msg.id,
                        ok: true,
                        warnings: []
                    });
                }
            }, 500);
        }
    };
}

// Seleccionar pieza para tutorial
function selectPiece(pieceType) {
    currentPiece = pieceType;

    // Actualizar UI
    document.querySelectorAll('.lesson-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`[data-piece="${pieceType}"]`).classList.add('active');

    // Limpiar selección previa y tablero
    clearSelection();
    clearBoard();

    // Colocar pieza en el centro del tablero con animación
    const initialRow = 3;
    const initialCol = 3;
    placePieceOnBoard(initialRow, initialCol, pieceData[pieceType].symbol);

    // Guardar la posición actual y marcar la casilla
    selectedSquare = { row: initialRow, col: initialCol };
    const startSquare = document.querySelector(`[data-row="${initialRow}"][data-col="${initialCol}"]`);
    if (startSquare) startSquare.classList.add('selected');

    // Mostrar movimientos válidos para la pieza en su posición central
    showPossibleMoves(initialRow, initialCol);

    // Agregar animación a la pieza
    const square = document.querySelector(`[data-row="${initialRow}"][data-col="${initialCol}"]`);
    if (square) {
        square.classList.add('piece-animation');
        setTimeout(() => square.classList.remove('piece-animation'), 1500);
    }

    // Agregar mensaje al chat
    const welcomeMessage = currentMode === 'tutorial'
        ? `Has seleccionado el ${pieceData[pieceType].name}. ${pieceData[pieceType].tts}`
        : currentMode === 'quiz'
        ? `¡Perfecto! Ahora responde el desafío sobre el ${pieceData[pieceType].name}.`
        : `Experimenta libremente con el ${pieceData[pieceType].name}. Haz clic en el tablero para ver sus movimientos.`;

    addChatMessage(welcomeMessage, 'assistant');

    // Reproducir explicación por voz
    if (ttsEnabled) {
        speak(welcomeMessage);
    }

    // Iniciar desafío si estamos en modo quiz
    if (currentMode === 'quiz' && challenges[pieceType]) {
        setTimeout(() => startChallenge(), 1000);
    }

    // Log
    addToLog(`📚 ${currentMode === 'tutorial' ? 'Tutorial' : currentMode === 'quiz' ? 'Desafío' : 'Práctica'} seleccionado: ${pieceData[pieceType].name}`);
}

// Manejar click en casilla del tablero
function handleSquareClick(event) {
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);

    // Modo Control Directo
    if (currentMode === 'control') {
        handleControlModeClick(row, col, event.target);
        return;
    }

    // Otros modos (tutorial, practice, quiz)
    if (!currentPiece) {
        addChatMessage('Primero selecciona una pieza de la lista de la izquierda para aprender cómo se mueve.', 'assistant');
        return;
    }

    // Si estamos en modo quiz, mantener la lógica existente
    if (currentMode === 'quiz' && currentChallenge) {
        selectedSquare = { row, col };
        event.target.classList.add('selected');
        const isCorrect = checkChallengeAnswer(selectedSquare);
        if (isCorrect) {
            showPossibleMoves(row, col);
            return;
        }
        return;
    }

    // Modo Tutorial: sólo permitir mover a casillas marcadas (valid-move / capture-move)
    if (currentMode === 'tutorial') {
        if (!selectedSquare) {
            addChatMessage('Selecciona primero una lección para que la pieza aparezca en el tablero.', 'assistant');
            return;
        }

        const clickedSquare = event.target;

        if (clickedSquare.classList.contains('valid-move') || clickedSquare.classList.contains('capture-move')) {
            clearSelection();
            clearBoard();
            placePieceOnBoard(row, col, pieceData[currentPiece].symbol);
            selectedSquare = { row, col };
            clickedSquare.classList.add('selected');
            showPossibleMoves(row, col);

            addExperience(2, 'explorar movimientos');
            const clickCount = parseInt(localStorage.getItem(`clicks_${currentPiece}`) || '0') + 1;
            localStorage.setItem(`clicks_${currentPiece}`, clickCount.toString());
            if (clickCount >= 3) {
                completeLesson(currentPiece);
                localStorage.removeItem(`clicks_${currentPiece}`);
            }

            addToLog(`🎯 Movimiento tutorial: ${String.fromCharCode(97 + col)}${8 - row}`);
        } else {
            addChatMessage('Haz clic en una casilla marcada en verde para mover la pieza.', 'assistant');
            showNotification('Selecciona una casilla marcada en verde', 'error');
        }

        return;
    }
}

// Mostrar movimientos posibles
function showPossibleMoves(row, col) {
    const moves = pieceData[currentPiece].moves(row, col);

    moves.forEach(([moveRow, moveCol]) => {
        const square = document.querySelector(`[data-row="${moveRow}"][data-col="${moveCol}"]`);
        if (square) {
            square.classList.add('valid-move');
        }
    });
}

// Limpiar selección y movimientos
function clearSelection() {
    document.querySelectorAll('.chess-square').forEach(square => {
        square.classList.remove('selected', 'valid-move', 'capture-move');
    });
}

// Limpiar tablero
function clearBoard() {
    document.querySelectorAll('.chess-square').forEach(square => {
        square.textContent = '';
    });
}

// Colocar pieza en el tablero
function placePieceOnBoard(row, col, symbol) {
    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (square) {
        square.textContent = symbol;
    }
}

// Reproducir animación
function playAnimation() {
    if (!currentPiece || !selectedSquare) {
        addChatMessage('Selecciona una pieza y haz clic en una casilla del tablero para ver la animación.', 'assistant');
        return;
    }

    addToLog('🎬 Reproduciendo animación...');
    addChatMessage(`Observa cómo se mueve el ${pieceData[currentPiece].name} desde su posición actual.`, 'assistant');

    // Simular animación con efectos visuales
    setTimeout(() => {
        addToLog('✅ Animación completada');
    }, 2000);
}

// Ejecutar movimiento en el robot
function executeRobotMove() {
    if (!currentPiece || !selectedSquare) {
        addChatMessage('Selecciona una pieza y una casilla antes de ejecutar en el robot.', 'assistant');
        return;
    }

    if (isExecuting) {
        addChatMessage('Ya hay una ejecución en progreso. Espera a que termine.', 'assistant');
        return;
    }

    // Preparar movimiento
    const move = {
        from: 'e2', // Posición inicial simulada
        to: `${String.fromCharCode(97 + selectedSquare.col)}${8 - selectedSquare.row}`
    };

    currentMove = move;

    // Mostrar modal de confirmación
    showConfirmationModal(move);
}

// Mostrar modal de confirmación
function showConfirmationModal(move) {
    document.getElementById('move-description').textContent = `${pieceData[currentPiece].name} de ${move.from} a ${move.to}`;
    document.getElementById('confirmation-modal').classList.remove('hidden');
    document.getElementById('teacher-confirmation').checked = false;
    document.getElementById('confirm-execution').disabled = true;
}

// Cerrar modal de confirmación
function closeConfirmationModal() {
    document.getElementById('confirmation-modal').classList.add('hidden');
    currentMove = null;
}

// Confirmar ejecución
function confirmExecution() {
    if (!currentMove) return;

    closeConfirmationModal();
    isExecuting = true;

    // Si estamos en modo control, ejecutar el movimiento en el tablero
    if (currentMode === 'control') {
        // Mostrar countdown
        showCountdown(() => {
            executeControlMove();

            // Enviar comando al robot
            const options = {
                speed: parseFloat(document.getElementById('speed-control').value),
                grip: parseFloat(document.getElementById('grip-control').value)
            };

            prepareMove(currentMove, options);
            addToLog('🤖 Enviando comando al robot...');
        });
    } else {
        // Modo normal (tutorial, practice, quiz)
        showCountdown(() => {
            // Enviar comando al robot
            const options = {
                speed: parseFloat(document.getElementById('speed-control').value),
                grip: parseFloat(document.getElementById('grip-control').value)
            };

            prepareMove(currentMove, options);
            addToLog('🤖 Enviando comando al robot...');
            addChatMessage('El robot está ejecutando el movimiento. ¡Observa con atención!', 'assistant');
        });
    }
}

// Mostrar countdown
function showCountdown(callback) {
    const overlay = document.getElementById('countdown-overlay');
    const number = document.getElementById('countdown-number');
    let count = 3;

    overlay.classList.remove('hidden');

    const countInterval = setInterval(() => {
        number.textContent = count;
        number.style.animation = 'none';
        setTimeout(() => number.style.animation = 'countdown-pulse 1s ease-in-out', 10);

        count--;

        if (count < 0) {
            clearInterval(countInterval);
            overlay.classList.add('hidden');
            callback();
        }
    }, 1000);
}

// Preparar movimiento en el robot
function prepareMove(move, options = {}) {
    const id = crypto.randomUUID();
    const payload = {
        type: 'prepare_move',
        id: id,
        move: move,
        options: options
    };

    ws.send(JSON.stringify(payload));
    return id;
}

// Manejar mensajes del robot
function handleRobotMessage(msg) {
    if (msg.type === 'prepare_move_response') {
        if (msg.ok) {
            executeMove(msg.id, currentMove);
        } else {
            addToLog('❌ Error en preparación: ' + (msg.warnings || ['Movimiento no permitido']).join(', '));
            isExecuting = false;
        }
    } else if (msg.type === 'execute_result') {
        addToLog(`✅ Ejecución ${msg.status}`);
        isExecuting = false;
        if (msg.status === 'completed') {
            addChatMessage('¡Movimiento completado! ¿Quieres probar con otra pieza?', 'assistant');
        }
    }
}

// Ejecutar movimiento
function executeMove(id, move) {
    const payload = {
        type: 'execute_move',
        id: id,
        move: move,
        options: {
            speed: parseFloat(document.getElementById('speed-control').value),
            grip: parseFloat(document.getElementById('grip-control').value),
            retry: 1
        }
    };

    ws.send(JSON.stringify(payload));

    // Simular progreso
    setTimeout(() => handleRobotMessage({ type: 'execute_result', id: id, status: 'completed' }), 3000);
}

// Parada de emergencia
function emergencyStop() {
    if (ws) {
        ws.send(JSON.stringify({ type: 'emergency_stop', reason: 'user_pressed_button' }));
    }
    isExecuting = false;
    addToLog('🛑 PARADA DE EMERGENCIA ACTIVADA');
    addChatMessage('Parada de emergencia activada. Todas las operaciones han sido detenidas.', 'assistant');
}

// Repetir explicación
function repeatExplanation() {
    if (!currentPiece) {
        addChatMessage('Selecciona una pieza primero para escuchar su explicación.', 'assistant');
        return;
    }

    const explanation = pieceData[currentPiece].tts;
    addChatMessage(`Te repito la explicación del ${pieceData[currentPiece].name}: ${explanation}`, 'assistant');

    if (ttsEnabled) {
        speak(explanation);
    }
}

// Toggle TTS
function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const button = document.getElementById('tts-toggle');
    button.textContent = ttsEnabled ? '🎤' : '🔇';
    button.title = ttsEnabled ? 'Desactivar voz' : 'Activar voz';

    addToLog(`🔊 Voz ${ttsEnabled ? 'activada' : 'desactivada'}`);
}

// Función TTS
function speak(text, options = {}) {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'es-ES';
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 0.8;

    // Buscar voz masculina en español
    const voices = speechSynthesis.getVoices();
    const maleVoice = voices.find(voice =>
        voice.lang.includes('es') &&
        (voice.name.toLowerCase().includes('male') ||
         voice.name.toLowerCase().includes('masculin') ||
         voice.name.toLowerCase().includes('diego') ||
         voice.name.toLowerCase().includes('jorge'))
    );

    if (maleVoice) {
        utterance.voice = maleVoice;
    }

    // Mostrar indicador de voz
    const indicator = document.getElementById('voice-indicator');
    indicator.classList.remove('hidden');

    utterance.onend = () => {
        indicator.classList.add('hidden');
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

// Manejar envío de chat
function handleChatSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    addChatMessage(message, 'user');
    input.value = '';

    // Simular respuesta del asistente
    setTimeout(() => {
        handleAssistantResponse(message);
    }, 1000);
}

// Manejar respuesta del asistente
function handleAssistantResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    let response = '';

    if (lowerMessage.includes('caballo')) {
        response = 'El caballo se mueve en L: dos casillas y luego una. ¿Quieres ver una animación?';
    } else if (lowerMessage.includes('peón')) {
        response = 'El peón avanza hacia adelante, pero captura en diagonal. ¿Te muestro cómo?';
    } else if (lowerMessage.includes('torre')) {
        response = 'La torre se mueve en líneas rectas: horizontal y vertical. ¡Es muy poderosa!';
    } else if (lowerMessage.includes('alfil')) {
        response = 'El alfil se mueve solo en diagonal. Siempre permanece en casillas del mismo color.';
    } else if (lowerMessage.includes('reina')) {
        response = 'La reina es la pieza más poderosa. Combina los movimientos de torre y alfil.';
    } else if (lowerMessage.includes('rey')) {
        response = 'El rey se mueve una casilla en cualquier dirección. ¡Hay que protegerlo!';
    } else {
        response = 'Interesante pregunta. Selecciona una pieza de la izquierda para aprender más sobre ella.';
    }

    addChatMessage(response, 'assistant');

    if (ttsEnabled) {
        speak(response);
    }
}

// Agregar mensaje al chat
function addChatMessage(message, sender) {
    const chatWindow = document.getElementById('chat-window');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-bubble ${sender} p-3`;
    messageDiv.textContent = message;

    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Agregar al log
function addToLog(message) {
    const log = document.getElementById('execution-log');
    const logEntry = document.createElement('div');
    logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;

    log.appendChild(logEntry);
    log.scrollTop = log.scrollHeight;
}

// Actualizar valores de controles
function updateControlValues() {
    const speedValue = document.getElementById('speed-control').value;
    const gripValue = document.getElementById('grip-control').value;

    document.getElementById('speed-value').textContent = speedValue;
    document.getElementById('grip-value').textContent = gripValue;
}

// === NUEVAS FUNCIONES DIDÁCTICAS ===

// Cargar progreso del jugador
function loadPlayerProgress() {
    const saved = localStorage.getItem('chessRobotProgress');
    if (saved) {
        playerProgress = { ...playerProgress, ...JSON.parse(saved) };
    }
}

// Guardar progreso del jugador
function savePlayerProgress() {
    localStorage.setItem('chessRobotProgress', JSON.stringify(playerProgress));
}

// Actualizar display de progreso
function updateProgressDisplay() {
    document.getElementById('total-points').textContent = playerProgress.totalPoints;
    document.getElementById('current-level').textContent = playerProgress.level;
    document.getElementById('current-exp').textContent = playerProgress.experience;
    document.getElementById('next-level-exp').textContent = playerProgress.level * 100;
    document.getElementById('pieces-learned').textContent = playerProgress.piecesLearned;
    document.getElementById('exercises-completed').textContent = playerProgress.exercisesCompleted;
    document.getElementById('streak-count').textContent = playerProgress.streakCount;

    const progressPercent = (playerProgress.experience / (playerProgress.level * 100)) * 100;
    document.getElementById('progress-bar').style.width = progressPercent + '%';
}

// Cambiar modo de aprendizaje
function switchMode(mode) {
    currentMode = mode;

    // Actualizar UI de botones
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`mode-${mode}`).classList.add('active');

    // Limpiar estado anterior
    clearSelection();
    controlMode = {
        selectedPiece: null,
        fromSquare: null,
        toSquare: null,
        pendingMove: null
    };

    // Mostrar/ocultar elementos según el modo
    const challengePanel = document.getElementById('challenge-panel');
    if (mode === 'quiz') {
        challengePanel.classList.remove('hidden');
        if (currentPiece && challenges[currentPiece]) {
            startChallenge();
        }
    } else {
        challengePanel.classList.add('hidden');
        if (challengeTimer) {
            clearInterval(challengeTimer);
            challengeTimer = null;
        }
    }

    // Configurar tablero según el modo
    if (mode === 'control') {
        // Mostrar tablero completo con todas las piezas
        initializeChessBoard();
        addChatMessage('🎮 Modo Control Directo activado. Haz clic en una pieza para seleccionarla, luego en la casilla destino para moverla. El robot ejecutará tu movimiento.', 'assistant');
    } else {
        // Limpiar tablero para otros modos
        clearBoard();
        addChatMessage(`Modo ${mode} activado. ${mode === 'tutorial' ? 'Selecciona una pieza de la izquierda para aprender.' : mode === 'practice' ? 'Experimenta libremente con las piezas.' : 'Responde los desafíos para ganar puntos.'}`, 'assistant');
    }

    addToLog(`📚 Modo cambiado a: ${mode}`);
}

// Actualizar estados de lecciones
function updateLessonStates() {
    document.querySelectorAll('.lesson-card').forEach(card => {
        const piece = card.dataset.piece;
        const difficulty = parseInt(card.dataset.difficulty);
        const statusIcon = card.querySelector('.lesson-status');

        if (playerProgress.completedLessons.includes(piece)) {
            card.classList.add('completed');
            statusIcon.textContent = '✅';
        } else if (difficulty === 1 || playerProgress.completedLessons.length >= difficulty - 1) {
            card.classList.remove('locked');
            statusIcon.textContent = '🔓';
        } else {
            card.classList.add('locked');
            statusIcon.textContent = '🔒';
        }
    });
}

// Agregar puntos y experiencia
function addExperience(points, reason) {
    playerProgress.totalPoints += points;
    playerProgress.experience += points;

    // Verificar subida de nivel
    const requiredExp = playerProgress.level * 100;
    if (playerProgress.experience >= requiredExp) {
        playerProgress.level++;
        playerProgress.experience -= requiredExp;
        showNotification(`¡Subiste al nivel ${playerProgress.level}!`, 'achievement');

        if (ttsEnabled) {
            speak(`¡Felicidades! Has subido al nivel ${playerProgress.level}`);
        }
    }

    updateProgressDisplay();
    savePlayerProgress();
    showNotification(`+${points} puntos por ${reason}`, 'success');
}

// Completar lección
function completeLesson(piece) {
    if (!playerProgress.completedLessons.includes(piece)) {
        playerProgress.completedLessons.push(piece);
        playerProgress.piecesLearned++;

        const points = pieceData[piece].points || 10;
        addExperience(points, `aprender ${pieceData[piece].name}`);

        // Verificar logros
        checkAchievements();
        updateLessonStates();

        showNotification(`¡Completaste la lección del ${pieceData[piece].name}!`, 'achievement');
    }
}

// Verificar logros
function checkAchievements() {
    // Primer pieza
    if (playerProgress.piecesLearned === 1 && !playerProgress.achievements.includes('first_piece')) {
        unlockAchievement('first_piece');
    }

    // Aprendiz rápido
    if (playerProgress.piecesLearned === 3 && !playerProgress.achievements.includes('speed_learner')) {
        unlockAchievement('speed_learner');
    }

    // Maestro del ajedrez
    if (playerProgress.piecesLearned === 6 && !playerProgress.achievements.includes('chess_master')) {
        unlockAchievement('chess_master');
    }
}

// Desbloquear logro
function unlockAchievement(achievementId) {
    const achievement = achievements[achievementId];
    if (achievement && !playerProgress.achievements.includes(achievementId)) {
        playerProgress.achievements.push(achievementId);
        addExperience(achievement.points, `logro: ${achievement.name}`);

        // Agregar al panel de logros
        const container = document.getElementById('achievements-container');
        if (container.children.length === 1 && container.children[0].textContent.includes('Completa lecciones')) {
            container.innerHTML = '';
        }

        const achievementDiv = document.createElement('div');
        achievementDiv.className = 'flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded-lg';
        achievementDiv.innerHTML = `
            <div class="text-2xl mr-3">${achievement.icon}</div>
            <div class="flex-1">
                <div class="font-semibold text-sm">${achievement.name}</div>
                <div class="text-xs text-gray-600">${achievement.description}</div>
            </div>
        `;
        container.appendChild(achievementDiv);

        showNotification(`🏆 ¡Logro desbloqueado: ${achievement.name}!`, 'achievement');

        if (ttsEnabled) {
            speak(`¡Felicidades! Has desbloqueado el logro ${achievement.name}`);
        }
    }
}

// Iniciar desafío
function startChallenge() {
    if (!currentPiece || !challenges[currentPiece]) return;

    const piecesChallenges = challenges[currentPiece];
    const randomChallenge = piecesChallenges[Math.floor(Math.random() * piecesChallenges.length)];

    currentChallenge = { ...randomChallenge, timeLeft: 30 };

    document.getElementById('challenge-question').textContent = randomChallenge.question;
    document.getElementById('challenge-points').textContent = `+${randomChallenge.points} pts`;
    document.getElementById('challenge-timer').textContent = currentChallenge.timeLeft;

    // Iniciar timer
    challengeTimer = setInterval(() => {
        currentChallenge.timeLeft--;
        const timerElement = document.getElementById('challenge-timer');
        timerElement.textContent = currentChallenge.timeLeft;

        if (currentChallenge.timeLeft <= 10) {
            timerElement.classList.add('warning');
        }

        if (currentChallenge.timeLeft <= 0) {
            clearInterval(challengeTimer);
            challengeTimer = null;
            showNotification('¡Se acabó el tiempo!', 'error');
            document.getElementById('challenge-panel').classList.add('hidden');
        }
    }, 1000);
}

// Mostrar pista del desafío
function showChallengeHint() {
    if (currentChallenge) {
        addChatMessage(`💡 Pista: ${currentChallenge.hint}`, 'assistant');
        if (ttsEnabled) {
            speak(currentChallenge.hint);
        }
    }
}

// Saltar desafío
function skipChallenge() {
    if (challengeTimer) {
        clearInterval(challengeTimer);
        challengeTimer = null;
    }
    document.getElementById('challenge-panel').classList.add('hidden');
    currentChallenge = null;
}

// Verificar respuesta del desafío
function checkChallengeAnswer(selectedSquare) {
    if (!currentChallenge || currentMode !== 'quiz') return false;

    // Lógica simplificada: cualquier movimiento válido cuenta como correcto
    const moves = pieceData[currentPiece].moves(selectedSquare.row, selectedSquare.col);
    if (moves.length > 0) {
        // Respuesta correcta
        if (challengeTimer) {
            clearInterval(challengeTimer);
            challengeTimer = null;
        }

        playerProgress.exercisesCompleted++;
        playerProgress.streakCount++;
        addExperience(currentChallenge.points, 'completar desafío');

        showNotification('¡Respuesta correcta!', 'success');
        document.getElementById('challenge-panel').classList.add('hidden');
        currentChallenge = null;

        return true;
    }

    return false;
}

// Sistema de notificaciones
function showNotification(message, type = 'success') {
    const container = document.getElementById('notifications-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    let icon = '✅';
    if (type === 'achievement') icon = '🏆';
    else if (type === 'error') icon = '❌';

    notification.innerHTML = `
        <div class="flex items-center">
            <span class="text-lg mr-2">${icon}</span>
            <span class="text-sm font-medium">${message}</span>
        </div>
    `;

    container.appendChild(notification);

    // Auto-remove después de 4 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// === FUNCIONES DEL MODO CONTROL DIRECTO ===

// Manejar clics en modo control directo
function handleControlModeClick(row, col, element) {
    const piece = boardState[row][col];

    // Si no hay pieza seleccionada y hay una pieza en esta casilla
    if (!controlMode.selectedPiece && piece) {
        selectPieceForControl(row, col, element);
    }
    // Si hay una pieza seleccionada
    else if (controlMode.selectedPiece) {
        // Si hacemos clic en la misma pieza, deseleccionar
        if (controlMode.fromSquare && controlMode.fromSquare.row === row && controlMode.fromSquare.col === col) {
            deselectPieceForControl();
        }
        // Si hacemos clic en otra casilla, intentar mover
        else {
            attemptMoveInControl(row, col);
        }
    }
    // Si no hay pieza seleccionada y no hay pieza en esta casilla
    else {
        addChatMessage('Selecciona una pieza primero haciendo clic en ella.', 'assistant');
    }
}

// Seleccionar pieza para control
function selectPieceForControl(row, col, element) {
    // Limpiar selección anterior
    clearSelection();
    const piece = boardState[row][col];

    // Permitir seleccionar solo piezas negras en Control Directo
    if (!isBlackPiece(piece)) {
        addChatMessage('En Control Directo solo puedes seleccionar piezas negras.', 'assistant');
        showNotification('Solo puedes seleccionar piezas negras en Control Directo', 'error');
        return;
    }

    controlMode.selectedPiece = piece;
    controlMode.fromSquare = { row, col };

    // Marcar casilla como seleccionada
    element.classList.add('selected');

    // Mostrar movimientos válidos para esta pieza
    showValidMovesForControlPiece(row, col);

    const pieceName = getPieceName(controlMode.selectedPiece);
    addChatMessage(`Has seleccionado ${pieceName} en ${getSquareName(row, col)}. Ahora haz clic en la casilla destino.`, 'assistant');
    addToLog(`🎯 Pieza seleccionada: ${pieceName} en ${getSquareName(row, col)}`);
}

// Deseleccionar pieza para control
function deselectPieceForControl() {
    clearSelection();
    controlMode.selectedPiece = null;
    controlMode.fromSquare = null;
    addChatMessage('Pieza deseleccionada. Selecciona otra pieza para mover.', 'assistant');
}

// Intentar mover en modo control
function attemptMoveInControl(toRow, toCol) {
    const fromRow = controlMode.fromSquare.row;
    const fromCol = controlMode.fromSquare.col;

    // Verificar si el movimiento es válido (lógica básica)
    if (isValidMove(fromRow, fromCol, toRow, toCol)) {
        // Preparar el movimiento
        const move = {
            from: getSquareName(fromRow, fromCol),
            to: getSquareName(toRow, toCol),
            piece: controlMode.selectedPiece,
            capture: boardState[toRow][toCol] !== ''
        };

        controlMode.pendingMove = {
            fromRow, fromCol, toRow, toCol, move
        };

        // Mostrar confirmación
        showControlMoveConfirmation(move);
    } else {
        addChatMessage('Movimiento no válido. Intenta con otra casilla.', 'assistant');
        showNotification('Movimiento no válido', 'error');
    }
}

// Mostrar movimientos válidos para pieza en modo control
function showValidMovesForControlPiece(row, col) {
    const piece = boardState[row][col];
    const pieceType = getPieceType(piece);

    if (pieceType && pieceData[pieceType]) {
        const moves = pieceData[pieceType].moves(row, col);

        moves.forEach(([moveRow, moveCol]) => {
            const square = document.querySelector(`[data-row="${moveRow}"][data-col="${moveCol}"]`);
            if (square) {
                // Si hay una pieza enemiga, marcar como captura
                if (boardState[moveRow][moveCol] && isOpponentPiece(piece, boardState[moveRow][moveCol])) {
                    square.classList.add('capture-move');
                } else if (!boardState[moveRow][moveCol]) {
                    square.classList.add('valid-move');
                }
            }
        });
    }
}

// Verificar si el movimiento es válido (lógica simplificada)
function isValidMove(fromRow, fromCol, toRow, toCol) {
    const piece = boardState[fromRow][fromCol];
    const targetPiece = boardState[toRow][toCol];

    // No se puede mover a una casilla ocupada por pieza propia
    if (targetPiece && !isOpponentPiece(piece, targetPiece)) {
        return false;
    }

    const pieceType = getPieceType(piece);
    if (pieceType && pieceData[pieceType]) {
        const validMoves = pieceData[pieceType].moves(fromRow, fromCol);
        return validMoves.some(([row, col]) => row === toRow && col === toCol);
    }

    return false;
}

// Mostrar confirmación de movimiento en modo control
function showControlMoveConfirmation(move) {
    const moveDescription = `${getPieceName(move.piece)} de ${move.from} a ${move.to}${move.capture ? ' (captura)' : ''}`;

    document.getElementById('move-description').textContent = moveDescription;
    document.getElementById('confirmation-modal').classList.remove('hidden');
    document.getElementById('teacher-confirmation').checked = false;
    document.getElementById('confirm-execution').disabled = true;

    // Actualizar el movimiento actual para la confirmación
    currentMove = move;
}

// Ejecutar movimiento en modo control
function executeControlMove() {
    if (!controlMode.pendingMove) return;

    const { fromRow, fromCol, toRow, toCol, move } = controlMode.pendingMove;

    // Actualizar estado del tablero
    boardState[toRow][toCol] = boardState[fromRow][fromCol];
    boardState[fromRow][fromCol] = '';

    // Actualizar tablero visual
    initializeChessBoard();

    // Limpiar estado de control
    controlMode = {
        selectedPiece: null,
        fromSquare: null,
        toSquare: null,
        pendingMove: null
    };

    // Agregar experiencia
    addExperience(5, 'ejecutar movimiento');

    addChatMessage(`¡Movimiento ejecutado! ${getPieceName(move.piece)} se movió de ${move.from} a ${move.to}. El robot está replicando este movimiento.`, 'assistant');
    addToLog(`✅ Movimiento ejecutado: ${move.from} → ${move.to}`);

    if (ttsEnabled) {
        speak(`Movimiento ejecutado. ${getPieceName(move.piece)} de ${move.from} a ${move.to}`);
    }
}

// Funciones auxiliares para el modo control
function getPieceName(piece) {
    const pieceNames = {
        '♔': 'Rey blanco', '♕': 'Reina blanca', '♖': 'Torre blanca',
        '♗': 'Alfil blanco', '♘': 'Caballo blanco', '♙': 'Peón blanco',
        '♚': 'Rey negro', '♛': 'Reina negra', '♜': 'Torre negra',
        '♝': 'Alfil negro', '♞': 'Caballo negro', '♟': 'Peón negro'
    };
    return pieceNames[piece] || 'Pieza desconocida';
}

function getPieceType(piece) {
    const typeMap = {
        '♔': 'king', '♕': 'queen', '♖': 'rook', '♗': 'bishop', '♘': 'knight', '♙': 'pawn',
        '♚': 'king', '♛': 'queen', '♜': 'rook', '♝': 'bishop', '♞': 'knight', '♟': 'pawn'
    };
    return typeMap[piece];
}

function isOpponentPiece(piece1, piece2) {
    const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
    const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];

    return (whitePieces.includes(piece1) && blackPieces.includes(piece2)) ||
           (blackPieces.includes(piece1) && whitePieces.includes(piece2));
}

// Determina si una pieza es negra
function isBlackPiece(piece) {
    const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
    return blackPieces.includes(piece);
}

function getSquareName(row, col) {
    return String.fromCharCode(97 + col) + (8 - row);
}
