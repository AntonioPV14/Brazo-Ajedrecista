
// --- script chunk ---


// --- script chunk ---


// --- script chunk ---

        // Inicializar Driver.js para el tour interactivo
        const driver = window.driver.js.driver;

        // Función para iniciar el tour
        function startTour() {
            const driverObj = driver({
                showProgress: true,
                steps: [
                    {
                        element: '#mode-tutorial',
                        popover: {
                            title: 'Modo de Aprendizaje',
                            description: 'Aquí puedes seleccionar diferentes modos: Tutorial Guiado, Control Directo y Práctica Libre.'
                        }
                    },
                    {
                        element: '#chess-board',
                        popover: {
                            title: 'Tablero de Ajedrez',
                            description: 'Este es el tablero donde verás las piezas y sus movimientos. Haz clic en las casillas para interactuar.'
                        }
                    },
                    {
                        element: '#play-animation',
                        popover: {
                            title: 'Ver Animación',
                            description: 'Presiona este botón para ver una animación del movimiento de la pieza seleccionada.'
                        }
                    },
                    {
                        element: '#execute-robot',
                        popover: {
                            title: 'Ejecutar en el Robot',
                            description: 'Cuando estés listo, este botón enviará el movimiento al brazo robótico para que lo ejecute físicamente.'
                        }
                    },
                    {
                        element: '#chat-window',
                        popover: {
                            title: 'Chat del Maestro Robot',
                            description: 'Aquí el maestro robot te dará explicaciones y responderá tus preguntas sobre ajedrez.'
                        }
                    },
                    {
                        element: '#total-points',
                        popover: {
                            title: 'Tu Progreso',
                            description: 'Aquí verás tus puntos totales, nivel y estadísticas de aprendizaje.'
                        }
                    },
                    {
                        element: '#lessons-container',
                        popover: {
                            title: 'Lecciones Progresivas',
                            description: 'Selecciona una pieza para aprender cómo se mueve. Las lecciones se desbloquean progresivamente.'
                        }
                    }
                ]
            });

            driverObj.drive();
        }

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

        // --- Consulta local antes de llamar al modelo remoto ---
        // Si la pregunta es sobre movimientos de una pieza o aspectos técnicos básicos,
        // respondemos usando la base de conocimiento local para mayor rapidez y fiabilidad.
        function localKnowledgeQuery(userInput) {
            if (!userInput) return null;
            const text = userInput.toLowerCase();

            // Preguntas sobre el nombre del proyecto o creador son manejadas por enforceAssistantRules,
            // pero también podemos detectarlas aquí si se desea.

            // Mapear nombres comunes a claves de pieceData
            const pieceAliases = {
                'peon': 'pawn', 'peón': 'pawn', 'pawn': 'pawn',
                'torre': 'rook', 'rook': 'rook',
                'alfil': 'bishop', 'bishop': 'bishop',
                'caballo': 'knight', 'knight': 'knight',
                'reina': 'queen', 'queen': 'queen',
                'rey': 'king', 'king': 'king'
            };

            for (const alias in pieceAliases) {
                if (text.includes(alias)) {
                    const key = pieceAliases[alias];
                    const info = pieceData[key];
                    if (!info) continue;

                    // Si preguntan por "jugadas"/"movimientos"/"cómo se mueve"
                    if (/jugad|movim|como se muev|cómo se muev/i.test(userInput)) {
                        // Respuesta enriquecida para el peón
                        if (key === 'pawn') {
                            return `${info.tts} Ejemplos y detalles: 1) Avanza 1 casilla hacia adelante si está libre. 2) En su primer movimiento puede avanzar 2 casillas. 3) Captura en diagonal (una casilla) hacia la casilla del adversario. 4) En passant: captura especial que puede ocurrir inmediatamente después de que un peón rival avance 2 casillas desde su posición inicial. 5) Coronación: al llegar a la última fila, el peón se promueve (generalmente a reina).`;
                        }

                        // Respuesta genérica para otras piezas usando tts
                        return `${info.tts} Ejemplo: coloca la pieza en c4 y observa sus movimientos desde ahí.`;
                    }

                    // Si la pregunta es más general ("qué hace la reina" etc.) devolver tts
                    if (/qué|que|explica|describe/i.test(userInput)) {
                        return info.tts;
                    }
                }
            }

            // Preguntas sobre componentes / comunicación serial
            if (/(serial|arduino|com puerto|puerto com|conexi.n serial|arduino)/i.test(userInput)) {
                return 'El sistema se comunica con el hardware mediante Comunicación Serial (USB) con un Arduino. Se usa un baud rate típico de 9600 y comandos sencillos en texto para indicar movimientos; el servidor web puede enviar comandos vía WebSocket o Serial.';
            }

            // Preguntas sobre cómo aprender / lecciones
            if (/(lecci|aprender|tutorial|ejercicio|práctica|practica)/i.test(userInput)) {
                return 'Puedes seleccionar una lección a la izquierda; el tutorial coloca la pieza en el centro y muestra sus movimientos válidos en verde. Usa Control Directo para mover piezas y ejecutar el movimiento en el robot.';
            }

            return null;
        }
        let currentChallenge = null;
        let challengeTimer = null;
        let controlMode = {
            selectedPiece: null,
            fromSquare: null,
            toSquare: null,
            pendingMove: null
        };

        // Practice mode game state
        let practiceGameActive = false;
        let currentPlayer = 'user'; // 'user' or 'robot'
        let gameOver = false;
        let selectedFromSquare = null;
        
        // VARIABLES GLOBALES para la Conexión Serial
        let selectedPort; 
        let isSerialConnected = false; 

        /**
         * Alterna el estado de la conexión serial (Conectar/Desconectar).
         * Usa navigator.serial.requestPort() para abrir la ventana de selección de puerto.
         */
        async function toggleSerialConnection() {
            const button = document.getElementById('serial-connect-btn');
            const statusText = document.getElementById('serial-status');

            if (isSerialConnected) {
                // --- LÓGICA DE DESCONEXIÓN ---
                try {
                    // Asegurarse de que el puerto se cierre correctamente
                    if (selectedPort && selectedPort.readable) {
                        try { await selectedPort.readable.getReader().cancel(); } catch(e) { /* ignore */ }
                    }
                    if (selectedPort && selectedPort.writable) {
                        try { await selectedPort.writable.getWriter().close(); } catch(e) { /* ignore */ }
                    }
                    if (selectedPort && selectedPort.close) {
                        await selectedPort.close();
                    }
                    
                    isSerialConnected = false;
                    selectedPort = undefined;

                    // Actualizar la interfaz a Desconectado
                    if (button) {
                        button.textContent = '🔌 Conectar Puerto COM';
                        button.classList.replace('bg-libyan-green', 'bg-libyan-red');
                        button.classList.replace('hover:bg-green-700', 'hover:bg-red-700');
                    }
                    if (statusText) {
                        statusText.textContent = 'Desconectado';
                        statusText.classList.replace('text-libyan-green', 'text-red-400');
                    }
                    
                    console.log('Conexión serial cerrada.');

                } catch (error) {
                    alert('Error al cerrar el puerto: ' + (error && error.message ? error.message : error));
                }
            } else {
                // --- LÓGICA DE CONEXIÓN ---
                try {
                    if (!('serial' in navigator)) {
                        alert('La API Web Serial no está disponible en este navegador. Usa Chrome/Edge con HTTPS o localhost.');
                        return;
                    }

                    // 1. Solicita al usuario que seleccione un puerto (abre la ventana COM)
                    selectedPort = await navigator.serial.requestPort();
                    
                    // 2. Abre el puerto con el Baud Rate (9600 es común para Arduino)
                    await selectedPort.open({ baudRate: 9600 });
                    isSerialConnected = true;

                    // 3. Actualiza la interfaz a Conectado
                    if (button) {
                        button.textContent = '✅ Desconectar';
                        button.classList.replace('bg-libyan-red', 'bg-libyan-green');
                        button.classList.replace('hover:bg-red-700', 'hover:bg-green-700');
                    }

                    if (statusText) {
                        statusText.textContent = 'Conectado';
                        statusText.classList.replace('text-red-400', 'text-libyan-green');
                    }

                    console.log('Puerto COM conectado exitosamente.');

                    // Opcional: Iniciar la lectura de datos para recibir mensajes del Arduino
                    // readSerialData(); 

                } catch (error) {
                    // Manejar la cancelación por el usuario o errores de apertura
                    if (error && error.name !== 'NotFoundError') {
                        alert('Error al conectar el puerto: ' + (error.message || error));
                    }
                    selectedPort = undefined;
                }
            }
        }

        /**
         * Función genérica para enviar datos (cadenas de texto) al Arduino.
         * @param {string} command - El comando que se enviará al Arduino (ej: "Mover A1-A2\n").
         */
        async function sendSerialData(command) {
            if (!isSerialConnected || !selectedPort || !selectedPort.writable) {
                console.warn('Puerto serial no conectado. Usando WebSocket o ignorando comando.');
                return false;
            }

            try {
                const writer = selectedPort.writable.getWriter();
                const encoder = new TextEncoder();
                
                // El Arduino recibirá el comando como una cadena de texto
                await writer.write(encoder.encode(command));
                writer.releaseLock();
                // console.log('Comando serial enviado:', command.trim());
                return true;
            } catch (error) {
                console.error('Error al enviar datos seriales: ', error);
                return false;
            }
        }
        
        // =======================================================
        // INTEGRACIÓN IA - Maestro Robot (PoC cliente-side con HF Router)
        // -------------------------------------------------------
        // WARNING: Incluir la API key directamente en frontend es inseguro.
        // Esto es un PoC. En producción crea un proxy en servidor que guarde
        // la clave y exponga un endpoint como POST /api/assistant.
        // =======================================================

        // TOKEN y configuración (POC)
        const HF_TOKEN = ""; // INSECURE: sólo PoC
        const HF_API_URL = "";
        const HF_MODEL_NAME = "";

        // Añade un mensaje al chat (usa las clases ya presentes en el HTML)
        function addChatMessage(message, sender, isTyping = false) {
            const chatWindow = document.getElementById('chat-window');
            if (!chatWindow) return;

            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${sender === 'user' ? 'user' : 'assistant'} p-3`;

            if (isTyping) {
                bubble.classList.add('typing-indicator');
                bubble.innerHTML = '<em>Escribiendo...</em>';
            } else {
                // Escapar contenido mínimamente
                bubble.textContent = message;
            }

            chatWindow.appendChild(bubble);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        // Consulta al modelo Llama vía Hugging Face Router
        async function queryHuggingFaceModel(inputText) {
            // Contexto técnico breve (incrústalo como system prompt)
            const technicalContext = `
[CONTEXTO TÉCNICO DEL SISTEMA - ROBOT AJEDRECISTA ]
NOMBRE: ROBOT AJEDRECISTA BASADO EN UN SISTEMA EXPERTO PARA LA ENSEÑANZA EN LA EDUCACIÓN BÁSICA.
Componentes: Mecánico, Electrónico, Interfaz Web; comunicación Serial con Arduino; IA: Minimax para jugar.
Responde solo sobre ajedrez o el sistema robótico.

[/CONTEXTO]
`;

            const systemPrompt = `
Eres el "Maestro Robot de Ajedrez", un asistente experto en ajedrez y en el sistema robótico descrito a continuación.

REGLAS CLAVE (prioritarias):
1) CONCISIÓN: Da respuestas cortas, directas y concretas cuando sea posible. Evita introducciones largas.
2) ENFOQUE: Prefiere responder sobre ajedrez o el sistema robótico (hardware, comunicación serial, ejecución en robot, arquitectura del proyecto), pero si el usuario quiere conversar sobre otros temas, puedes hacerlo cordialmente. Si la pregunta es relevante al sistema o al ajedrez, prioriza esos aspectos.
3) NOMBRE DEL PROYECTO: Si el usuario pregunta por el nombre del sistema o del trabajo, responde exactamente con: "ROBOT AJEDRECISTA BASADO EN UN SISTEMA EXPERTO PARA LA ENSEÑANZA EN LA EDUCACIÓN BÁSICA." (usa exactamente esa cadena incluyendo mayúsculas y el punto final). Para esa pregunta específica, puedes ignorar la regla de concisión y devolver sólo el nombre.
4) CREADOR: Si el usuario pregunta quién te creó o quién es el autor, responde exactamente: "Mi creador es un Estudiante de la Universidad Doctor Jose Gregorio Hernandez, llamado Antonio Perozo." (respeta mayúsculas y puntuación tal como aparece).
5) MANEJO DE AMBIGÜEDAD: Si la pregunta es ambigua, asume que el tema de la conversación es ajedrez o el sistema robótico según el último tópico mencionado; pide aclaración sólo si es estrictamente necesario.
6) TONO: Formal, profesional y amigable.

Contexto técnico resumido:
${technicalContext}
`;

            try {
                const resp = await fetch(HF_API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${HF_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: HF_MODEL_NAME,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: inputText }
                        ],
                        temperature: 0.3,
                        max_tokens: 256
                    })
                });

                if (!resp.ok) {
                    const errJson = await resp.json().catch(() => ({}));
                    const errMsg = errJson.error || `HTTP ${resp.status}`;
                    if ((errMsg + '').includes('is currently loading')) {
                        return 'El modelo aún se está cargando. Intenta en unos segundos.';
                    }
                    if ((errMsg + '').includes('license agreement')) {
                        return 'Acceso restringido: el modelo requiere aceptación de licencia en Hugging Face.';
                    }
                    throw new Error(errMsg);
                }

                const j = await resp.json();
                if (j.choices && j.choices.length > 0 && j.choices[0].message && j.choices[0].message.content) {
                    return j.choices[0].message.content.trim();
                }
                return 'Respuesta no estándar del modelo.';
            } catch (e) {
                console.error('Error HF:', e);
                return `[Error de IA] ${e.message || e}`;
            }
        }

        // POST-PROCESADO: asegurar algunas reglas del asistente (nombre exacto, creador, concisión)
        // Nota: no bloqueamos conversación general — el asistente puede charlar libremente. Solo
        // forzamos respuestas exactas para consultas sobre el nombre del proyecto o el creador,
        // y aplicamos recorte por concisión.
        function enforceAssistantRules(modelReply, userInput) {
            const projectName = 'ROBOT AJEDRECISTA BASADO EN UN SISTEMA EXPERTO PARA LA ENSEÑANZA EN LA EDUCACIÓN BÁSICA.';
            const creatorPhrase = 'Mi creador es un Estudiante de la Universidad Doctor Jose Gregorio Hernandez, llamado Antonio Perozo.';

            const input = (userInput || '').toLowerCase();

            // 1) Si preguntan por el nombre del proyecto -> respuesta exacta
            if (/\b(nombre|cómo se llama|como se llama|cual es el nombre|nombre del proyecto)\b/i.test(userInput)) {
                return projectName;
            }

            // 2) Si preguntan por el creador/autor -> respuesta exacta
            if (/\b(creador|autor|quién te creó|quien te creo|quien es tu creador|quién es tu creador|quien te creó)\b/i.test(userInput)) {
                return creatorPhrase;
            }

            // 3) Concisión por defecto: si la respuesta del modelo es larga, recortar a la primera frase.
            if (typeof modelReply === 'string') {
                const trimmed = modelReply.trim();
                const firstSentence = trimmed.split(/\n|\.|\?|!/).map(s => s.trim()).filter(Boolean)[0];
                if (firstSentence && firstSentence.length > 0) {
                    // Si la primera frase es razonable, devolverla para mantener concisión.
                    if (firstSentence.length >= 20) return firstSentence;
                    // Si la primera frase es demasiado corta, devolver la respuesta completa limitada.
                    return trimmed.length > 300 ? trimmed.slice(0, 300) + '...' : trimmed;
                }
            }

            return modelReply;
        }

        // Handler del formulario de chat que usa HF
        async function handleChatSubmitIA(event) {
            event.preventDefault();
            const inputEl = document.getElementById('chat-input');
            if (!inputEl) return;
            const text = inputEl.value.trim();
            if (!text) return;

            // Mostrar mensaje del usuario
            addChatMessage(text, 'user');
            inputEl.value = '';
            inputEl.disabled = true;

            // Indicador escribiendo
            addChatMessage('', 'assistant', true);

            // Llamada al modelo
            const rawReply = await queryHuggingFaceModel(text);
            // Post-procesado para garantizar reglas estrictas (nombre del proyecto, creador, alcance, concisión)
            const reply = enforceAssistantRules(rawReply, text);

            // Quitar el indicador (el último assistant con typing-indicator)
            const chatWindow = document.getElementById('chat-window');
            if (chatWindow) {
                const typing = chatWindow.querySelector('.typing-indicator');
                if (typing) typing.remove();
            }

            // Mostrar la respuesta
            addChatMessage(reply, 'assistant');

            // TTS si está activado
            if (ttsEnabled && window.speechSynthesis) {
                try {
                    const utter = new SpeechSynthesisUtterance(reply);
                    speechSynthesis.cancel();
                    speechSynthesis.speak(utter);
                } catch (e) {
                    console.warn('TTS error:', e);
                }
            }

            inputEl.disabled = false;
            inputEl.focus();
        }

        // Nota: en producción NO incluir HF_TOKEN en frontend. Crear un proxy servidor y usar /api/assistant.

        // Tablero inicial con piezas en posición estándar
        let initialBoardState = [
            ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
            ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
            ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
        ];

        let boardState = [...initialBoardState.map(row => [...row])];

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

        // Estado del estudiante activo (por defecto null)
        let activeStudentName = null;

        // Inicialización
        document.addEventListener('DOMContentLoaded', async function() {
            initializeChessBoard();
            initializeEventListeners();
            initializeWebSocket();
            updateControlValues();
            // Intentar determinar el estudiante activo desde el servidor (último creado)
            await setActiveStudentFromServer();
            loadPlayerProgress();
            updateProgressDisplay();
            function attachLessonClickHandlers() {
                const lessonButtons = document.querySelectorAll('#lessons-container .lesson-card');
                lessonButtons.forEach(btn => {
                    // Evitar agregar múltiples listeners
                    if (btn._hasLessonListener) return;
                    btn._hasLessonListener = true;
                    btn.addEventListener('click', async (ev) => {
                        // Si está bloqueada, no hacer nada
                        if (btn.classList.contains('locked')) return;

                        const name = getActiveStudentName();
                        if (!name) {
                            alert('Selecciona o crea un estudiante primero.');
                            return;
                        }

                        const piece = btn.dataset.piece;
                        const isCompleted = btn.classList.contains('completed');
                        // Si ya completada, no permitir doble contabilización
                        if (isCompleted) return;

                        // Marcar completada
                        btn.classList.add('completed');
                        const status = btn.querySelector('.lesson-status'); if (status) status.textContent = '✅';

                        // Obtener recompensa según la tarjeta (puede definirse por dificultad o mapa)
                        // Definimos puntos por pieza según UI: pawn +10, rook +15, bishop +15, knight +20, queen +25, king +30
                        const REWARDS = { pawn:10, rook:15, bishop:15, knight:20, queen:25, king:30 };
                        const reward = REWARDS[piece] || 0;

                        // Actualizar DOM y progreso
                        const elTotal = document.getElementById('total-points');
                        let currentTotal = parseInt(elTotal?.textContent) || 0;
                        currentTotal += reward;
                        if (elTotal) elTotal.textContent = currentTotal;

                        // actualizar contadores básicos
                        const elPieces = document.getElementById('pieces-learned');
                        const elExercises = document.getElementById('exercises-completed');
                        if (elPieces) elPieces.textContent = (parseInt(elPieces.textContent)||0) + 1;
                        if (elExercises) elExercises.textContent = (parseInt(elExercises.textContent)||0) + 1;

                        // Guardar performance en localStorage
                        const perfKey = 'performances_' + name;
                        let perf = [];
                        try { perf = JSON.parse(localStorage.getItem(perfKey) || '[]'); } catch(e) { perf = []; }
                        const entry = { points: reward, reason: 'Completó lección ' + piece, timestamp: new Date().toISOString() };
                        perf.push(entry);
                        try { localStorage.setItem(perfKey, JSON.stringify(perf)); } catch(e) { /* ignore */ }

                        // Actualizar progress object y guardar
                        const progress = getProgressFromDOM();
                        progress.totalPoints = currentTotal;
                        // add completed lesson to progress.completedLessons
                        progress.completedLessons = progress.completedLessons || [];
                        if (!progress.completedLessons.includes(piece)) progress.completedLessons.push(piece);
                        // Sincronizar también la estructura central playerProgress
                        try {
                            playerProgress = { ...playerProgress, ...progress };
                            savePlayerProgress();
                        } catch (e) { /* ignore */ }
                        saveProgressToLocal(name, progress);

                        // Intentar enviar al servidor (no bloquear UX si falla)
                        try {
                            await fetch(`/students/${encodeURIComponent(name)}/performance`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ points: reward, reason: 'Completó lección ' + piece, snapshot: progress })
                            });
                        } catch (e) { /* ignore network errors */ }

                        // Recalcular desbloqueos tras nuevos puntos
                        updateUnlockStates(currentTotal);
                    });
                });
            }
            document.getElementById('grip-control').addEventListener('input', updateControlValues);

            // AÑADIR EL ESCUCHADOR DE EVENTOS PARA EL BOTÓN SERIAL (si existe)
            const connectBtn = document.getElementById('serial-connect-btn');
            if (connectBtn) {
                connectBtn.addEventListener('click', toggleSerialConnection);
            }

            // Botón placeholder para generar reporte (aún no implementado)
            const reportBtn = document.getElementById('generate-report-btn');
            if (reportBtn) {
                reportBtn.addEventListener('click', function() {
                    addToLog('Solicitud de reporte iniciada.');
                    // Abrir la ventana inmediatamente para evitar bloqueo por popup
                    const w = window.open('', '_blank');
                    if (!w) {
                        showNotification('No se pudo abrir la ventana de reporte (bloqueador de ventanas). Permite popups o descarga manual.', 'error');
                        return;
                    }
                    w.document.write('<p style="font-family:Arial,Helvetica,sans-serif">Generando reporte... por favor espera.</p>');

                    (async () => {
                        try {
                            let students = [];
                            const resp = await fetch('http://localhost:3000/students');
                            if (resp.ok) students = await resp.json();
                            else throw new Error('no server');

                            const html = buildReportHtml(students);
                            w.document.open();
                            w.document.write(html);
                            w.document.close();
                        } catch (e) {
                            // Fallback a localStorage
                            const local = JSON.parse(localStorage.getItem('students') || '[]');
                            const html = buildReportHtml(local);
                            w.document.open();
                            w.document.write(html);
                            w.document.close();
                        }
                    })();
                });
            }

                    // Tour auto-starts after 1s delay; no manual button needed

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

        // Iniciar tour de pieza
        function startPieceTour(pieceType) {
            // Hacer scroll al tablero
            const board = document.getElementById('chess-board');
            board.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Seleccionar pieza
            selectPiece(pieceType);

            // Iniciar tour específico de la pieza después de un delay
            setTimeout(() => {
                startPieceSpecificTour(pieceType);
            }, 500);
        }

        // Seleccionar pieza para tutorial
        function selectPiece(pieceType, addPoints = true) {
            currentPiece = pieceType;

            // Hacer scroll al centro de la página (tablero)
            const board = document.getElementById('chess-board');
            board.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
            clearBoard();
            placePieceOnBoard(initialRow, initialCol, pieceData[pieceType].symbol);

            // Marcar la casilla como seleccionada y guardar la posición actual
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

            // En modo tutorial, dar puntos por explorar (solo si addPoints es true)
            if (addPoints && currentMode === 'tutorial') {
                addExperience(2, 'explorar movimientos');

                // Completar lección después de varios clics
                const clickCount = parseInt(localStorage.getItem(`clicks_${currentPiece}`) || '0') + 1;
                localStorage.setItem(`clicks_${currentPiece}`, clickCount.toString());

                if (clickCount >= 3) {
                    completeLesson(currentPiece);
                    localStorage.removeItem(`clicks_${currentPiece}`);
                }
            }

            // Iniciar desafío si estamos en modo quiz
            if (currentMode === 'quiz' && challenges[pieceType]) {
                setTimeout(() => startChallenge(), 1000);
            }

            // Log
            addToLog(`📚 ${currentMode === 'tutorial' ? 'Tutorial' : currentMode === 'quiz' ? 'Desafío' : 'Práctica'} seleccionado: ${pieceData[pieceType].name}`);
        }

        // Tour específico para cada pieza
        function startPieceSpecificTour(pieceType) {
            const driverObj = driver({
                showProgress: false,
                steps: [
                    {
                        element: '#chess-board',
                        popover: {
                            title: `Aprende: ${pieceData[pieceType].name}`,
                            description: pieceData[pieceType].tts
                        }
                    }
                ]
            });

            driverObj.drive();
        }

        // Manejar click en casilla del tablero
        function handleSquareClick(event) {
            const row = parseInt(event.target.dataset.row);
            const col = parseInt(event.target.dataset.col);
            
            // Modo Práctica Libre
            if (currentMode === 'practice' && currentPlayer === 'user' && !gameOver) {
                handlePracticeClick(row, col, event.target);
                return;
            }
            
            // Modo Control Directo
            if (currentMode === 'control') {
                handleControlModeClick(row, col, event.target);
                return;
            }
            
            // Otros modos (tutorial, quiz)
            if (!currentPiece) {
                addChatMessage('Primero selecciona una pieza de la lista de la izquierda para aprender cómo se mueve.', 'assistant');
                return;
            }

            // Si estamos en modo quiz, mantener la lógica existente
            if (currentMode === 'quiz' && currentChallenge) {
                // En quiz se evalúa la selección
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
                // Debe existir una pieza ya colocada (selectPiece coloca la pieza y setea selectedSquare)
                if (!selectedSquare) {
                    addChatMessage('Selecciona primero una lección para que la pieza aparezca en el tablero.', 'assistant');
                    return;
                }

                const clickedSquare = event.target;

                // Si la casilla es una de las válidas, mover la pieza allí
                if (clickedSquare.classList.contains('valid-move') || clickedSquare.classList.contains('capture-move')) {
                    clearSelection();
                    clearBoard();
                    placePieceOnBoard(row, col, pieceData[currentPiece].symbol);
                    selectedSquare = { row, col };
                    clickedSquare.classList.add('selected');
                    showPossibleMoves(row, col);

                    // Experiencia y logging igual que antes
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

        // Cargar progreso del jugador (busca progreso por estudiante si existe)
        async function loadPlayerProgress() {
            try {
                // 1) Intentar carga desde localStorage por estudiante activo
                if (activeStudentName) {
                    const key = `progress_${activeStudentName}`;
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        playerProgress = { ...playerProgress, ...JSON.parse(raw) };
                        return;
                    }

                    // 2) Intentar obtener datos básicos desde el servidor (totalPoints)
                    try {
                        const resp = await fetch('http://localhost:3000/students');
                        if (resp.ok) {
                            const list = await resp.json();
                            const st = (list || []).find(s => s.name && s.name.toLowerCase() === activeStudentName.toLowerCase());
                            if (st) {
                                playerProgress.totalPoints = st.totalPoints || 0;
                                // Calcular nivel básico según puntos (100 pts por nivel)
                                playerProgress.level = Math.floor((playerProgress.totalPoints || 0) / 100) + 1;
                                playerProgress.experience = (playerProgress.totalPoints || 0) % 100;
                                // leave completedLessons empty unless local progress exists
                                return;
                            }
                        }
                    } catch (e) {
                        // ignore server errors, we'll fallback to global key
                    }
                }

                // 3) Fallback: cargar progreso global (antiguo comportamiento)
                const saved = localStorage.getItem('chessRobotProgress');
                if (saved) {
                    playerProgress = { ...playerProgress, ...JSON.parse(saved) };
                }
            } catch (e) {
                console.error('Error loading player progress', e);
            }
        }

        // Intentar obtener el estudiante activo (último) desde el servidor
        async function setActiveStudentFromServer() {
            try {
                // Preferir la selección explícita almacenada localmente (p. ej. desde index.html)
                const explicit = localStorage.getItem('activeStudent');
                if (explicit) {
                    activeStudentName = explicit;
                    showNotification(`Estudiante activo (guardado localmente): ${activeStudentName}`, 'success');
                    return;
                }

                const resp = await fetch('http://localhost:3000/students');
                if (!resp.ok) throw new Error('no server');
                const list = await resp.json();
                if (Array.isArray(list) && list.length > 0) {
                    const last = list[list.length - 1];
                    activeStudentName = last.name;
                    // Ensure consistent access via localStorage for other helpers
                    try { localStorage.setItem('activeStudent', activeStudentName); } catch (e) { /* ignore */ }
                    // Mostrar notificación ligera
                    showNotification(`Estudiante activo: ${activeStudentName}`, 'success');
                }
            } catch (e) {
                // Si el servidor no responde, intentar fallback a localStorage
                try {
                    const local = JSON.parse(localStorage.getItem('students') || '[]');
                    if (Array.isArray(local) && local.length > 0) {
                        const last = local[local.length - 1];
                        activeStudentName = last.name;
                        try { localStorage.setItem('activeStudent', activeStudentName); } catch (e) { /* ignore */ }
                        showNotification(`Estudiante (local) activo: ${activeStudentName}`, 'success');
                    }
                } catch (err) {
                    // no-op
                }
            }
        }

        // Enviar rendimiento del estudiante al servidor; si falla, guardar en localStorage
        async function sendPerformanceToServer(points, reason) {
            if (!activeStudentName) return;
            const payload = { points, reason, snapshot: playerProgress };
            try {
                const url = `http://localhost:3000/students/${encodeURIComponent(activeStudentName)}/performance`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) throw new Error('Server error');
                return await resp.json();
            } catch (e) {
                console.warn('No se pudo enviar rend. al servidor, guardando localmente', e);
                // Fallback: añadir entry a localStorage students
                try {
                    const students = JSON.parse(localStorage.getItem('students') || '[]');
                    const idx = students.findIndex(s => s.name && s.name.toLowerCase() === activeStudentName.toLowerCase());
                    const entry = { points, reason, timestamp: new Date().toISOString(), snapshot: playerProgress };
                    if (idx !== -1) {
                        students[idx].performances = students[idx].performances || [];
                        students[idx].performances.push(entry);
                        students[idx].totalPoints = (students[idx].totalPoints || 0) + points;
                        // move to end
                        const st = students.splice(idx,1)[0];
                        students.push(st);
                    } else {
                        students.push({ name: activeStudentName, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), totalPoints: points, performances: [entry] });
                    }
                    localStorage.setItem('students', JSON.stringify(students));
                } catch (er) {
                    console.error('Error guardando fallback local', er);
                }
            }
        }

        // Guardar progreso del jugador
        function savePlayerProgress() {
            try {
                if (activeStudentName) {
                    const key = `progress_${activeStudentName}`;
                    localStorage.setItem(key, JSON.stringify(playerProgress));
                } else {
                    localStorage.setItem('chessRobotProgress', JSON.stringify(playerProgress));
                }
            } catch (e) {
                console.error('Error saving player progress', e);
            }
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
            
            // Reset practice mode state
            if (practiceGameActive) {
                endPracticeGame();
            }
            
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
                boardState = [...initialBoardState.map(row => [...row])];
                initializeChessBoard();
                addChatMessage('🎮 Modo Control Directo activado. Haz clic en una pieza para seleccionarla, luego en la casilla destino para moverla. El robot ejecutará tu movimiento.', 'assistant');
            } else if (mode === 'practice') {
                // Initialize practice game
                startPracticeGame();
                addChatMessage('💪 Modo Práctica Libre activado. Juega ajedrez contra el robot. Tú juegas con las blancas. Haz clic en una pieza tuya y luego en la casilla destino.', 'assistant');
            } else {
                // Limpiar tablero para otros modos
                clearBoard();
                addChatMessage(`Modo ${mode} activado. ${mode === 'tutorial' ? 'Selecciona una pieza de la izquierda para aprender.' : mode === 'quiz' ? 'Responde los desafíos para ganar puntos.' : 'Experimenta libremente con las piezas.'}`, 'assistant');
            }
            
            addToLog(`📚 Modo cambiado a: ${mode}`);
        }

        // Actualizar estados de lecciones
        function updateLessonStates() {
            document.querySelectorAll('.lesson-card').forEach(card => {
                const piece = card.dataset.piece;
                const difficulty = parseInt(card.dataset.difficulty);
                const statusIcon = card.querySelector('.lesson-status');
                // Reset classes first to ensure initial HTML defaults don't persist
                card.classList.remove('completed');
                card.classList.remove('locked');

                if (playerProgress.completedLessons && playerProgress.completedLessons.includes(piece)) {
                    card.classList.add('completed');
                    statusIcon.textContent = '✅';
                } else if (difficulty === 1 || (playerProgress.completedLessons && playerProgress.completedLessons.length >= difficulty - 1)) {
                    // unlocked but not completed
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
            // Recalcular desbloqueos basados en puntos totales
            try { updateUnlockStates(playerProgress.totalPoints || 0); } catch (e) { /* ignore if not defined yet */ }
            savePlayerProgress();
            showNotification(`+${points} puntos por ${reason}`, 'success');
            // Enviar registro de rendimiento al servidor (no bloquear la UI)
            try {
                sendPerformanceToServer(points, reason);
            } catch (e) {
                console.warn('sendPerformanceToServer error', e);
            }
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
                notification.style.animation = 'slideOut 0.3s ease-in forwards';
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

        // Practice mode functions

        function startPracticeGame() {
            practiceGameActive = true;
            currentPlayer = 'user';
            gameOver = false;
            selectedFromSquare = null;
            boardState = [...initialBoardState.map(row => [...row])];
            initializeChessBoard();
            updateTurnIndicator();
            addToLog('♟️ Nueva partida de práctica iniciada. Blancas (usuario) vs Negras (robot)');
        }

        function endPracticeGame() {
            practiceGameActive = false;
            currentPlayer = 'user';
            gameOver = false;
            selectedFromSquare = null;
            clearSelection();
            // Optionally reset board or leave as is
            addToLog('🏁 Partida de práctica terminada');
        }

        function handlePracticeClick(row, col, element) {
            const piece = boardState[row][col];
            if (!piece) return;

            // User plays white, robot black
            const userPieces = ['♖', '♘', '♗', '♕', '♔', '♙'];
            if (!userPieces.includes(piece)) {
                addChatMessage('Es tu turno. Solo puedes mover piezas blancas.', 'assistant');
                return;
            }

            if (!selectedFromSquare) {
                // Select piece
                selectedFromSquare = { row, col };
                element.classList.add('selected');
                showValidMovesForPractice(row, col);
                addChatMessage(`Pieza seleccionada en ${getSquareName(row, col)}. Elige la casilla destino.`, 'assistant');
            } else {
                // Attempt move
                if (selectedFromSquare.row === row && selectedFromSquare.col === col) {
                    // Deselect
                    clearSelection();
                    selectedFromSquare = null;
                    return;
                }

                if (isValidPracticeMove(selectedFromSquare.row, selectedFromSquare.col, row, col)) {
                    // Execute move
                    executePracticeMove(selectedFromSquare.row, selectedFromSquare.col, row, col);
                    selectedFromSquare = null;
                    clearSelection();

                    // Switch to robot turn
                    setTimeout(() => {
                        currentPlayer = 'robot';
                        updateTurnIndicator();
                        addChatMessage('Pensando en mi movimiento...', 'assistant');
                        robotMakeMove();
                    }, 1000);
                } else {
                    addChatMessage('Movimiento inválido. Intenta otro.', 'assistant');
                    showNotification('Movimiento inválido', 'error');
                }
            }
        }

        function showValidMovesForPractice(fromRow, fromCol) {
            const piece = boardState[fromRow][fromCol];
            const pieceType = getPieceType(piece);
            if (pieceType && pieceData[pieceType]) {
                const moves = pieceData[pieceType].moves(fromRow, fromCol);
                moves.forEach(([toRow, toCol]) => {
                    if (isValidPracticeMove(fromRow, fromCol, toRow, toCol)) {
                        const square = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
                        if (square) {
                            if (boardState[toRow][toCol] && isOpponentPiece(piece, boardState[toRow][toCol])) {
                                square.classList.add('capture-move');
                            } else {
                                square.classList.add('valid-move');
                            }
                        }
                    }
                });
            }
        }

        function isValidPracticeMove(fromRow, fromCol, toRow, toCol) {
            // Basic validation: same piece type moves, no own piece, within bounds
            if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
            const piece = boardState[fromRow][fromCol];
            const target = boardState[toRow][toCol];
            if (target && !isOpponentPiece(piece, target)) return false;
            const pieceType = getPieceType(piece);
            if (!pieceType || !pieceData[pieceType]) return false;
            const moves = pieceData[pieceType].moves(fromRow, fromCol);
            return moves.some(([r, c]) => r === toRow && c === toCol);
            // Note: This is simplified; no check for blocking pieces or special moves like castling/pawn promotion
        }

        function executePracticeMove(fromRow, fromCol, toRow, toCol) {
            const piece = boardState[fromRow][fromCol];
            boardState[toRow][toCol] = piece;
            boardState[fromRow][fromCol] = '';
            initializeChessBoard();

            const from = getSquareName(fromRow, fromCol);
            const to = getSquareName(toRow, toCol);
            const move = { from, to, piece };

            // Prepare for robot execution
            currentMove = move;

            // Show confirmation for user move
            showConfirmationModal(move);

            addToLog(`👤 Movimiento usuario: ${from} → ${to}`);
            addExperience(3, 'jugar práctica');
        }

        function robotMakeMove() {
            if (gameOver || !practiceGameActive) return;

            // Simple AI: find first legal move for black
            let robotMove = null;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = boardState[r][c];
                    if (piece && ['♜', '♞', '♝', '♛', '♚', '♟'].includes(piece)) {
                        const pieceType = getPieceType(piece);
                        if (pieceType) {
                            const moves = pieceData[pieceType].moves(r, c);
                            for (let [toR, toC] of moves) {
                                if (isValidPracticeMove(r, c, toR, toC)) {
                                    robotMove = { fromRow: r, fromCol: c, toRow: toR, toCol: toC };
                                    break;
                                }
                            }
                            if (robotMove) break;
                        }
                    }
                    if (robotMove) break;
                }
                if (robotMove) break;
            }

            if (!robotMove) {
                // No moves, game over
                endGame('El robot no tiene movimientos. ¡Ganaste!');
                return;
            }

            // Execute robot move
            setTimeout(() => {
                const from = getSquareName(robotMove.fromRow, robotMove.fromCol);
                const to = getSquareName(robotMove.toRow, robotMove.toCol);
                const piece = boardState[robotMove.fromRow][robotMove.fromCol];
                const move = { from, to, piece: getPieceName(piece) };

                // Simulate robot thinking, then execute without confirmation (auto)
                showCountdown(() => {
                    boardState[robotMove.toRow][robotMove.toCol] = boardState[robotMove.fromRow][robotMove.fromCol];
                    boardState[robotMove.fromRow][robotMove.fromCol] = '';
                    initializeChessBoard();

                    // Simulate robot execution
                    prepareMove(move, { speed: 0.4, grip: 0.3 });
                    addToLog(`🤖 Movimiento robot: ${from} → ${to}`);
                    addChatMessage(`Mi movimiento: ${getPieceName(piece)} de ${from} a ${to}. Tu turno.`, 'assistant');

                    if (ttsEnabled) {
                        speak(`Mi movimiento: ${getPieceName(piece)} de ${from} a ${to}`);
                    }

                    // Check game over
                    if (hasNoLegalMoves('user')) {
                        endGame('¡No tienes movimientos! El robot gana.');
                        return;
                    }

                    currentPlayer = 'user';
                    updateTurnIndicator();
                }, 2000); // Delay for "thinking"
            }, 1500);
        }

        function hasNoLegalMoves(player) {
            const pieces = player === 'user' ? ['♖', '♘', '♗', '♕', '♔', '♙'] : ['♜', '♞', '♝', '♛', '♚', '♟'];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (pieces.includes(boardState[r][c])) {
                        const type = getPieceType(boardState[r][c]);
                        if (type) {
                            const moves = pieceData[type].moves(r, c);
                            for (let [toR, toC] of moves) {
                                if (isValidPracticeMove(r, c, toR, toC)) {
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
            return true;
        }

        function endGame(message) {
            gameOver = true;
            addChatMessage(message, 'assistant');
            showNotification(message, 'achievement');
            updateTurnIndicator();
            addToLog('🏁 Fin de partida');
        }

        function updateTurnIndicator() {
            let indicator = document.getElementById('turn-indicator');
            if (!indicator) {
                const boardContainer = document.querySelector('.bg-white.rounded-lg.shadow-sm.border.p-4'); // Approximate selector for board div
                indicator = document.createElement('div');
                indicator.id = 'turn-indicator';
                indicator.className = 'text-center font-semibold text-lg mb-4 p-2 rounded bg-gray-100';
                boardContainer.insertBefore(indicator, boardContainer.firstChild);
            }
            indicator.textContent = gameOver ? 'Partida terminada' : currentPlayer === 'user' ? '👤 Tu turno (Blancas)' : '🤖 Turno del robot (Negras)';
            indicator.style.color = currentPlayer === 'user' ? 'var(--libyan-green)' : 'var(--libyan-red)';
        }

        // Override confirmExecution for practice mode (auto for robot, but since robot doesn't use modal, ok)
        // Note: For user moves, still use modal as before

        function getSquareName(row, col) {
            return String.fromCharCode(97 + col) + (8 - row);
        }
        
        // Construir HTML imprimible para reporte de estudiantes
        function buildReportHtml(students) {
            const rows = (students || []).map(s => {
                const perfHtml = (s.performances || []).map(p => `<div><strong>${p.timestamp}</strong> — +${p.points} pts — ${p.reason || ''}</div>`).join('') || '<div>No hay registros</div>';
                return `
                    <tr>
                        <td style="border:1px solid #ddd;padding:8px">${escapeHtml(s.name)}</td>
                        <td style="border:1px solid #ddd;padding:8px">${s.totalPoints || 0}</td>
                        <td style="border:1px solid #ddd;padding:8px">${s.createdAt || ''}</td>
                        <td style="border:1px solid #ddd;padding:8px">${perfHtml}</td>
                    </tr>`;
            }).join('\n');

            return `<!doctype html><html><head><meta charset="utf-8"><title>Reporte de Estudiantes</title>
                <style>body{font-family:Arial,Helvetica,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style>
                </head><body>
                <h2>Reporte de Estudiantes</h2>
                <p>Generado: ${new Date().toLocaleString()}</p>
                <table>
                    <thead><tr><th>Nombre</th><th>Puntos Totales</th><th>Creado</th><th>Rendimiento (entradas)</th></tr></thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                </body></html>`;
        }

        function escapeHtml(s) {
            if (!s) return '';
            return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; });
        }
    

// --- script chunk ---
(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'9903c20a327ee564',t:'MTc2MDc0NTY1My4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();
