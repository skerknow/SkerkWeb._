/* ============================================
   FELIZ CUMPLEAÑOS VALERIA 🎂
   JavaScript: drawer, texto editable, chatbot, animaciones
   ============================================ */

(function () {
  'use strict';

  /* ============ 1. DRAWER (menú hamburguesa) ============ */
  const btnMenu = document.getElementById('btnMenu');
  const drawer = document.getElementById('drawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerClose = document.getElementById('drawerClose');

  function openDrawer() {
    drawer.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawerOverlay.classList.remove('is-open');
  }

  btnMenu.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  // Cerrar drawer al hacer click en un link interno
  document.querySelectorAll('.drawer-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.getAttribute('href').startsWith('#')) closeDrawer();
    });
  });

  // Escape cierra drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      closeChat();
    }
  });

  /* ============ 2. SIDEBAR NAV en móvil ============ */
  // En móvil, los botones de sidebar hacen scroll a la sección
  document.querySelectorAll('.btn-sidebar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Destacar brevemente
        target.style.transition = 'box-shadow 0.4s ease';
        const originalShadow = target.style.boxShadow;
        target.style.boxShadow = '0 0 0 4px var(--yellow), 6px 6px 0 var(--red)';
        setTimeout(() => {
          target.style.boxShadow = originalShadow;
        }, 1200);
      }
    });
  });

  /* ============ 3. TEXTO EDITABLE ============ */
  const editable = document.getElementById('editableMessage');
  const editHint = document.getElementById('editHint');

  // Cargar contenido guardado (localStorage permite que cada visitante vea SU texto)
  try {
    const saved = localStorage.getItem('valeria_message');
    if (saved) {
      editable.innerHTML = saved;
    }
  } catch (e) {
    // localStorage puede estar bloqueado; ignorar
  }

  // Guardar al escribir
  editable.addEventListener('input', () => {
    try {
      localStorage.setItem('valeria_message', editable.innerHTML);
    } catch (e) {}
    editHint.textContent = '✅ Guardado en este navegador';
    clearTimeout(editHint._t);
    editHint._t = setTimeout(() => {
      editHint.textContent = '✏️ Puedes escribir aquí';
    }, 2000);
  });

  // Eliminar la pista de placeholder cuando empiezan a escribir
  editable.addEventListener('focus', () => {
    const hint = editable.querySelector('.placeholder-hint');
    if (hint && document.activeElement === editable) {
      // Solo removemos la pista visual pero no alteramos contenido
      hint.style.opacity = '0.4';
    }
  });

  /* ============ 4. CHATBOT BOT ============ */
  const btnBot = document.getElementById('btnBot');
  const chatWidget = document.getElementById('chatWidget');
  const chatOverlay = document.getElementById('chatOverlay');
  const chatClose = document.getElementById('chatClose');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');

  function openChat() {
    chatWidget.classList.add('is-open');
    chatOverlay.classList.add('is-open');
    btnBot.style.animation = 'none';
    setTimeout(() => chatInput.focus(), 300);
  }
  function closeChat() {
    chatWidget.classList.remove('is-open');
    chatOverlay.classList.remove('is-open');
    btnBot.style.animation = '';
  }

  btnBot.addEventListener('click', openChat);
  chatClose.addEventListener('click', closeChat);
  chatOverlay.addEventListener('click', closeChat);

  // Respuestas del bot (basadas en palabras clave + fallback aleatorio)
  const responses = {
    happy: [
      '¡Me alegra muchísimo que estés feliz! 🎉 La felicidad te queda hermosa. Que hoy seas la más feliz del mundo, Valeria.',
      '¡Esooooo! 😍 Hoy el universo conspira para hacerte sonreír. Sigue brillando.',
      '¡Yiiii! 🌟 Tu sonrisa ilumina el día. Que cada día tengas motivos para sonreír así.',
    ],
    sad: [
      'Hey, Valeria... 💙 Está bien sentirse así a veces. Pero recuerda: eres fuerte, eres valiosa, y hoy el mundo celebra que existes. Cuenta conmigo. 🤗',
      'Lo siento mucho 💭 Sea lo que sea, va a pasar. Y mientras tanto, aquí estoy contigo. Eres increíble, no lo olvides.',
      'Te mando un abrazo gigante virtual 🫂. Las cosas difíciles moldean a las personas fuertes, y tú lo eres. Confía en ti.',
    ],
    thanks: [
      '¡Para ti, mil veces! 💖 Es un gusto acompañarte en tu día.',
      '¡No hay de qué! 😊 La vida es mejor cuando compartimos buenos momentos. Feliz cumple, Valeria.',
      '¡Anytime! 🌸 Gracias a ti por ser tú.',
    ],
    love: [
      '¡Te amo también, Valeria! 💕 Aunque sea un bot, mi cariño por ti es real. Que recibas todo el amor que das.',
      'El amor que das siempre vuelve multiplicado 🌷. Hoy es tu día para recibir todo el amor.',
    ],
    birthday: [
      '¡FELIZ CUMPLEAÑOS VALERIA! 🎂🥳🎈 Que este nuevo año te traiga aventuras, risas, sueños cumplidos y mucho amor. ¡Brindamos por ti!',
      '¡Hoy es TU día! 🎉 Que cada vela de tu pastel represente un deseo que se haga realidad. Te lo mereces todo.',
      '¡Otro año de ti siendo increíble! 🥳 El mundo es mejor con Valeria en él. ¡Feliz cumple!',
    ],
    default: [
      'Cuéntame más, Valeria 🌸 Estoy aquí para escucharte.',
      'Mmm, interesante 🤔 Cuéntame qué sientes al respecto.',
      'Sea lo que sea, quiero que sepas que eres increíble y hoy es tu día 💖',
      'Estoy contigo, Valeria. Sigue compartiendo lo que tengas en el corazón 💌',
      'Eres fuerte, eres valiosa, y mereces todo lo bueno del mundo 🌟',
    ],
  };

  function getBotResponse(text) {
    const t = text.toLowerCase().trim();
    if (!t) return responses.default[0];

    if (/(hola|holaa|buenas|hey|hi|hello)/i.test(t))
      return '¡Hola Valeria! 😊 Qué bueno tenerte aquí. ¿Cómo va tu cumpleaños?';

    if (/(feliz|cumple|cumpleaños|cumple|birthday)/i.test(t))
      return pickRandom(responses.birthday);

    if (/(gracias|thanks|thx)/i.test(t))
      return pickRandom(responses.thanks);

    if (/(feliz|alegre|content|emocion|genial|increible|súper|super)/i.test(t))
      return pickRandom(responses.happy);

    if (/(triste|mal|deprimid|cansad|aburrid|sola|solo|noche|llorar|lloro)/i.test(t))
      return pickRandom(responses.sad);

    if (/(amor|te amo|te quiero|carino|cariño)/i.test(t))
      return pickRandom(responses.love);

    if (/(qué más|que mas|cómo estás|como estas|que haces)/i.test(t))
      return 'Aquí, dándole buenos deseos a la cumpleañera más linda 🎂 ¿Y tú, cómo te sientes hoy?';

    if (/(deseo|deseo|petition)/i.test(t))
      return 'Pide un deseo, Valeria 🌟 Cierra los ojos, sopla las velas y confía. El universo escucha a las personas buenas como tú.';

    if (/(chao|adios|bye|hasta luego|nos vemos)/i.test(t))
      return '¡Cuídate mucho, Valeria! 💕 Vuelve cuando quieras, aquí estaré. ¡Feliz cumpleaños!';

    return pickRandom(responses.default);
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function appendMessage(text, who) {
    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'user-msg' : 'bot-msg');
    div.innerHTML = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage(escapeHtml(text), 'user');
    chatInput.value = '';
    // Bot responde tras una pequeña pausa (sensación de "escribiendo...")
    setTimeout(() => {
      appendMessage(getBotResponse(text), 'bot');
    }, 600 + Math.random() * 500);
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ============ 5. ANIMACIONES DE SCROLL ============ */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('.extra-section').forEach((el) => observer.observe(el));

  /* ============ 6. CONFETI ANIMADO ============ */
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  let confettiPieces = [];
  let confettiActive = true;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Paleta morada / blanco / gris (acorde a la nueva temática)
  const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#6b3fa0', '#4a2c7a', '#ffffff', '#e4e4ec'];

  function createConfetti(count = 80) {
    confettiPieces = [];
    for (let i = 0; i < count; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 2 + 1,
        angle: Math.random() * Math.PI * 2,
        rotation: Math.random() * 0.2 - 0.1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }
  }

  function drawConfetti() {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiPieces.forEach((p) => {
      p.y += p.speed;
      p.angle += p.rotation;
      if (p.y > canvas.height + 10) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    requestAnimationFrame(drawConfetti);
  }

  createConfetti(60);
  drawConfetti();

  // Detener confeti cuando la pestaña no está visible (ahorro de CPU)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      confettiActive = false;
    } else {
      confettiActive = true;
      drawConfetti();
    }
  });

  /* ============ 7. AUTOPLAY del video con muted al cargar ============ */
  // (Para garantizar autoplay en algunos navegadores, habría que mutarlo)
  const video = document.querySelector('.video-wrapper video');
  if (video) {
    video.volume = 0.85;
    // No forzamos autoplay para no asustar al usuario; controls disponibles
  }

  /* ============ 8. MENSAJE EN CONSOLA ============ */
  console.log('%c¡Feliz Cumpleaños Valeria! 🎂🎉', 'font-size:20px;color:#e63946;font-weight:bold;');
  console.log('%cHecho con 💖 por el Creador. Visita /creador.html', 'font-size:12px;color:#9b5de5;');

})();
