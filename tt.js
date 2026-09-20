/**
 * Clase o Módulo principal para el Algoritmo Minimax.
 * NOTA: Este código asume que tienes una función global 'moveGenerator' (que devuelve
 * todas las jugadas legales) y una estructura de datos 'board' (el estado del tablero).
 * También necesitarás funciones para 'makeMove' y 'undoMove'.
 */

// Definición de valores de las piezas para la evaluación estática
const PIECE_VALUES = {
    'p': 100, // Peón
    'n': 320, // Caballo
    'b': 330, // Alfil
    'r': 500, // Torre
    'q': 900, // Dama
    'k': 20000 // Rey (valor alto para priorizar su seguridad)
    // Se asume que las letras minúsculas son piezas negras (IA) y mayúsculas son blancas (Jugador)
};

// Profundidad máxima de búsqueda (ajustar según el rendimiento deseado)
const MAX_DEPTH = 3; 

// Valor estático para una posición ganadora o perdedora
const MAX_SCORE = 1000000;

/**
 * 1. FUNCIÓN DE EVALUACIÓN HEURÍSTICA: Asigna un valor numérico al tablero.
 * Una puntuación positiva favorece a la IA (negras). Una puntuación negativa favorece al jugador (blancas).
 * @param {Array} board - Representación del estado actual del tablero.
 * @returns {number} Puntuación del tablero.
 */
function evaluateBoard(board) {
    let score = 0;

    // Iterar sobre el tablero (asumiendo un array de 64 elementos o una representación similar)
    for (let i = 0; i < board.length; i++) {
        const piece = board[i];

        if (piece) {
            const isBlack = (piece === piece.toLowerCase()); // Asumimos minúsculas para la IA (negras)

            // Obtener el valor absoluto de la pieza
            const pieceType = piece.toLowerCase();
            const pieceValue = PIECE_VALUES[pieceType];

            // Sumar o restar la puntuación según quién es el dueño de la pieza
            if (isBlack) {
                // La IA (negras) gana puntos por sus piezas
                score += pieceValue;
            } else {
                // El jugador (blancas) pierde puntos por sus piezas (negativo para la IA)
                score -= pieceValue;
            }

            // NOTA: Para una IA más avanzada, aquí se agregarían penalizaciones por peones doblados,
            // control de centro, seguridad del rey, etc.
        }
    }
    return score;
}

/**
 * 2. ALGORITMO MINIMAX: Función recursiva principal con poda Alpha-Beta.
 * @param {Array} board - Estado actual del tablero.
 * @param {number} depth - Profundidad restante en la búsqueda.
 * @param {boolean} isMaximizingPlayer - True si es el turno de la IA (MAX), False si es del jugador (MIN).
 * @param {number} alpha - Mejor valor encontrado hasta ahora para MAX.
 * @param {number} beta - Mejor valor encontrado hasta ahora para MIN.
 * @returns {number} La puntuación minimax de la posición.
 */
function minimax(board, depth, isMaximizingPlayer, alpha, beta) {
    // CONDICIÓN DE PARADA (NODO TERMINAL):
    // 1. Se alcanza la profundidad máxima
    if (depth === 0) {
        return evaluateBoard(board);
    }
    
    // 2. La partida ha terminado (Jaque mate o tablas)
    // Necesitarías una función 'isGameOver(board)' que devuelva true/false
    // if (isGameOver(board)) {
    //     return evaluateBoard(board); // O MAX_SCORE si es mate, -MAX_SCORE si es mate del oponente
    // }

    // Generar todos los movimientos legales desde el estado actual
    // ******************************************************************************
    // NECESITAS IMPLEMENTAR ESTA FUNCIÓN. Muestra todas las jugadas posibles para el turno actual.
    // ******************************************************************************
    const possibleMoves = moveGenerator(board, isMaximizingPlayer); 

    if (isMaximizingPlayer) {
        // TURNO DE LA IA (MAXIMIZAR PUNTUACIÓN)
        let maxEval = -MAX_SCORE; 
        
        for (const move of possibleMoves) {
            // makeMove(board, move); // Ejecuta la jugada temporalmente
            // ******************************************************************************
            // NECESITAS IMPLEMENTAR makeMove(board, move) y undoMove(board, move)
            // ******************************************************************************

            const evaluation = minimax(board, depth - 1, false, alpha, beta);
            // undoMove(board, move); // Deshace la jugada

            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, maxEval);
            
            // PODA BETA
            if (beta <= alpha) {
                break; 
            }
        }
        return maxEval;

    } else {
        // TURNO DEL JUGADOR (MINIMIZAR PUNTUACIÓN)
        let minEval = MAX_SCORE; 
        
        for (const move of possibleMoves) {
            // makeMove(board, move); // Ejecuta la jugada temporalmente
            const evaluation = minimax(board, depth - 1, true, alpha, beta);
            // undoMove(board, move); // Deshace la jugada

            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, minEval);
            
            // PODA ALPHA
            if (beta <= alpha) {
                break;
            }
        }
        return minEval;
    }
}

/**
 * 3. FUNCIÓN DE INICIO: Busca la mejor jugada a realizar en el tablero actual.
 * @param {Array} board - Estado actual del tablero.
 * @returns {object} La mejor jugada encontrada.
 */
function findBestMove(board) {
    // Generar movimientos legales para la IA (MAXIMIZAR)
    // ******************************************************************************
    // Necesitas implementar moveGenerator para el jugador maximizador (IA)
    // ******************************************************************************
    const possibleMoves = moveGenerator(board, true); 
    
    let bestMove = null;
    let maxEval = -MAX_SCORE;

    for (const move of possibleMoves) {
        // Ejecutar jugada temporalmente
        // makeMove(board, move);
        
        // Llamada a Minimax para evaluar la jugada
        // 'false' indica que el siguiente jugador es el minimizador (el humano)
        const evaluation = minimax(board, MAX_DEPTH - 1, false, -MAX_SCORE, MAX_SCORE); 

        // Deshacer jugada
        // undoMove(board, move);

        if (evaluation > maxEval) {
            maxEval = evaluation;
            bestMove = move;
        }
    }

    return bestMove; // Retorna la jugada (formato: {from: 'e7', to: 'e5'})
}

// Ejemplo de uso (Asumiendo que 'currentBoard' existe):
// const bestMove = findBestMove(currentBoard); 
// console.log("La mejor jugada de la IA es:", bestMove);