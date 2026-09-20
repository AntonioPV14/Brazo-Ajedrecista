/*
  chatbot.js
  - Lógica reutilizable del "Maestro Robot" para ser incluida en otras páginas.
  - No embedear tokens en frontend: por defecto HF_TOKEN queda vacío y se usa solo localKnowledgeQuery.
  - Para usar modelo remoto, setear window.CHATBOT_HF_TOKEN = 'tu_token' antes de cargar este script
    o incluir data-hf-token en el script tag que carga este archivo y llamar initChatbot().
*/
(function (global) {
  'use strict';

  // Configuración: por seguridad no ponemos token aquí.
  let HF_TOKEN = '';
  const HF_API_URL = '';
  const HF_MODEL_NAME = '';

  // Estado interno
  let ttsEnabled = true;

  // Minimal local knowledge (extracted). Puedes ampliarlo según necesites.
  const pieceData = {
    pawn: { name: 'Peón', tts: 'El peón se mueve hacia adelante una casilla. Si es su primer movimiento, puede avanzar dos casillas. Para capturar, se mueve en diagonal.' },
    rook: { name: 'Torre', tts: 'La torre se desplaza en línea recta: hacia delante, atrás o a los lados.' },
    knight: { name: 'Caballo', tts: 'El caballo salta en forma de L: dos casillas en una dirección y una casilla a la derecha o izquierda.' },
    bishop: { name: 'Alfil', tts: 'El alfil se mueve diagonalmente, siempre en el mismo color de casilla.' },
    queen: { name: 'Reina', tts: 'La reina puede moverse como la torre y como el alfil: en línea recta o en diagonal.' },
    king: { name: 'Rey', tts: 'El rey se mueve una casilla en cualquier dirección.' }
  };

  function addChatMessage(message, sender = 'assistant') {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender} p-3`;
    bubble.textContent = message;

    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function localKnowledgeQuery(userInput) {
    if (!userInput) return null;
    const text = userInput.toLowerCase();

    const pieceAliases = { 'peon': 'pawn', 'peón': 'pawn', 'pawn': 'pawn', 'torre': 'rook', 'alfil': 'bishop', 'caballo': 'knight', 'reina': 'queen', 'rey': 'king' };
    for (const alias in pieceAliases) {
      if (text.includes(alias)) {
        const key = pieceAliases[alias];
        const info = pieceData[key];
        if (!info) continue;
        if (/movim|jugad|cómo se muev|como se muev/i.test(userInput)) {
          return info.tts;
        }
        if (/qué|que|explica|describe/i.test(userInput)) return info.tts;
      }
    }

    if (/(serial|arduino|com puerto|puerto com|conexi.n serial)/i.test(userInput)) {
      return 'El sistema puede comunicarse con el hardware mediante Comunicación Serial (USB) a través de un servidor o WebSocket.';
    }

    return null;
  }

  async function queryHuggingFaceModel(inputText) {
    // Si no hay token configurado, devolvemos null para indicar que no se llamó al modelo.
    const token = HF_TOKEN || (global.CHATBOT_HF_TOKEN || '');
    if (!token) return null;

    try {
      const resp = await fetch(HF_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: HF_MODEL_NAME, messages: [{ role: 'user', content: inputText }], temperature: 0.3, max_tokens: 256 })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const errMsg = errJson.error || `HTTP ${resp.status}`;
        return `[Error de IA] ${errMsg}`;
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

  function enforceAssistantRules(modelReply, userInput) {
    const projectName = 'ROBOT AJEDRECISTA BASADO EN UN SISTEMA EXPERTO PARA LA ENSEÑANZA EN LA EDUCACIÓN BÁSICA.';
    const creatorPhrase = 'Mi creador es un Estudiante de la Universidad Doctor Jose Gregorio Hernandez, llamado Antonio Perozo.';
    if (/(nombre|como se llama|cual es el nombre|nombre del proyecto)/i.test(userInput)) return projectName;
    if (/(creador|autor|quién te creó|quien te creo|quien es tu creador)/i.test(userInput)) return creatorPhrase;
    if (typeof modelReply === 'string') {
      const trimmed = modelReply.trim();
      const firstSentence = trimmed.split(/\n|\.|\?|!/).map(s => s.trim()).filter(Boolean)[0];
      if (firstSentence && firstSentence.length > 0) return firstSentence.length >= 20 ? firstSentence : (trimmed.length > 300 ? trimmed.slice(0,300)+'...' : trimmed);
    }
    return modelReply;
  }

  function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('tts-toggle');
    if (btn) btn.textContent = ttsEnabled ? '🎤' : '🔇';
  }

  function speak(text) {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn('TTS error', e);
    }
  }

  async function handleChatSubmitIA(event) {
    event && event.preventDefault();
    const inputEl = document.getElementById('chat-input');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    addChatMessage(text, 'user');
    inputEl.value = '';
    // typing indicator
    const chatWindow = document.getElementById('chat-window');
    const typing = document.createElement('div');
    typing.className = 'chat-bubble assistant p-3 typing-indicator';
    typing.innerHTML = '<em>Escribiendo...</em>';
    chatWindow.appendChild(typing);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // 1) Intentar respuesta local rápida
    const local = localKnowledgeQuery(text);
    if (local) {
      typing.remove();
      const final = local;
      addChatMessage(final, 'assistant');
      if (ttsEnabled) speak(final);
      return;
    }

    // 2) Intentar consulta al modelo remoto si está configurado
    const rawReply = await queryHuggingFaceModel(text);
    typing.remove();

    if (rawReply === null) {
      const fallback = 'IA no configurada: responde con conocimiento local. Añade un token en el servidor o en window.CHATBOT_HF_TOKEN para habilitar IA remota.';
      addChatMessage(fallback, 'assistant');
      return;
    }

    const reply = enforceAssistantRules(rawReply, text);
    addChatMessage(reply, 'assistant');
    if (ttsEnabled) speak(reply);
  }

  // Public wrapper to add a message programmatically (used by page code)
  function publicAddMessage(message, sender = 'assistant') {
    addChatMessage(message, sender);
    // auto speak if assistant and TTS enabled
    if (sender === 'assistant' && ttsEnabled) speak(message);
  }

  // Public wrapper to submit a user message programmatically
  async function publicSubmitFromText(text) {
    // insert text into input and call handler to preserve behavior
    const inputEl = document.getElementById('chat-input');
    if (!inputEl) return;
    inputEl.value = text;
    await handleChatSubmitIA();
  }

  function initChatbot(options = {}) {
    // options: { hfToken }
    if (options.hfToken) HF_TOKEN = options.hfToken;

    // Para evitar conflictos con listeners antiguos en la página (porque el archivo original
    // `learn.html` podía tener handlers globales), clonamos el formulario y el botón TTS para quitar
    // event listeners preexistentes y luego añadimos solo los nuestros.
    const form = document.getElementById('chat-form');
    if (form && form.parentNode) {
      try {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', handleChatSubmitIA);
      } catch (e) {
        // Fallback: si falla el reemplazo, intentar añadir el listener directamente
        form.addEventListener('submit', handleChatSubmitIA);
      }
    }

    const ttsBtn = document.getElementById('tts-toggle');
    if (ttsBtn && ttsBtn.parentNode) {
      try {
        const newBtn = ttsBtn.cloneNode(true);
        ttsBtn.parentNode.replaceChild(newBtn, ttsBtn);
        newBtn.addEventListener('click', toggleTTS);
      } catch (e) {
        ttsBtn.addEventListener('click', toggleTTS);
      }
    }

    // Mensaje de bienvenida (no duplicar si ya hay mensajes)
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow && chatWindow.children.length === 0) {
      const welcome = '¡Hola! Soy tu maestro robot de ajedrez. Escribe una pregunta o selecciona una pieza para empezar.';
      addChatMessage(welcome, 'assistant');
    }
  }

  // exportar API
  global.Chatbot = { init: initChatbot, setToken: (t)=>{ HF_TOKEN = t; }, toggleTTS, speak, addMessage: publicAddMessage, submit: publicSubmitFromText };

})(window);
