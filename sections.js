/* ============================================
   SECCIONES NUEVAS: Pizarra, Cartas, Música, Gustos
   - Pizarra: canvas + imágenes flotantes + sync online (jsonblob)
   - Cartas: 3 textareas con sync online
   - Música: YouTube IFrame API + carpetas + reorder
   - Gustos: 5 categorías + sync online
   ============================================ */

(function () {
  'use strict';

  // ====== Configuración del almacenamiento compartido ======
  // jsonblob: servicio gratuito que permite leer/escribir JSON compartido
  // Cada vez que se actualiza, se renueva la expiración por 24h
  const SHARED_BLOB_ID = '019fa06c-ae97-71c4-a670-ec65386696cd';
  const SHARED_URL = `https://jsonblob.com/api/jsonBlob/${SHARED_BLOB_ID}`;

  // Estado global compartido (se carga al inicio)
  let sharedState = {
    pizarra: { drawings: [], images: [], texts: [] },
    cartas: ['', '', ''],
    musica: { songs: [], folders: [] },
    gustos: { objetos: [], aromas: [], comida: [], series: [], musica: [] }
  };

  // Throttle para no saturar el servidor
  let saveTimeout = null;
  function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveSharedState, 1500);
  }

  async function loadSharedState() {
    try {
      const res = await fetch(SHARED_URL, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        // Merge con defaults por si falta algo
        sharedState = {
          pizarra: data.pizarra || { drawings: [], images: [], texts: [] },
          cartas: data.cartas || ['', '', ''],
          musica: data.musica || { songs: [], folders: [] },
          gustos: data.gustos || { objetos: [], aromas: [], comida: [], series: [], musica: [] }
        };
        return true;
      }
    } catch (e) {
      console.warn('No se pudo cargar estado compartido:', e);
    }
    return false;
  }

  async function saveSharedState() {
    try {
      const res = await fetch(SHARED_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(sharedState)
      });
      return res.ok;
    } catch (e) {
      console.warn('No se pudo guardar estado compartido:', e);
      return false;
    }
  }

  // =====================================================
  // ============ PIZARRA ============
  // =====================================================
  function initPizarra() {
    const canvas = document.getElementById('pizarraCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('pizarraStatus');

    // Ajustar canvas al tamaño del contenedor
    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      // Guardar contenido actual
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Restaurar contenido
      ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
    }
    resizeCanvas();
    window.addEventListener('resize', () => {
      setTimeout(resizeCanvas, 100);
    });

    // Estado de la pizarra
    let tool = 'pen';
    let color = '#ffffff';
    let size = 3;
    let isDrawing = false;
    let startX = 0, startY = 0;
    let snapshot = null;

    // Imágenes flotantes en la pizarra
    let images = [];
    let selectedImage = null;
    let dragMode = null; // 'move' | 'resize'
    let dragOffsetX = 0, dragOffsetY = 0;

    // Función para obtener coordenadas relativas al canvas
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
      const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
      return { x, y };
    }

    // Toolbar: selección de herramienta
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tool = btn.dataset.tool;
        canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
      });
    });

    // Color picker
    const colorPicker = document.getElementById('pizarraColor');
    colorPicker.addEventListener('input', (e) => { color = e.target.value; });

    // Color presets
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        color = btn.dataset.color;
        colorPicker.value = color;
      });
    });

    // Size slider
    const sizeSlider = document.getElementById('pizarraSize');
    const sizeValue = document.getElementById('pizarraSizeValue');
    sizeSlider.addEventListener('input', (e) => {
      size = parseInt(e.target.value);
      sizeValue.textContent = size;
    });

    // Dibujar
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    function startDrawing(e) {
      e.preventDefault();
      // Primero verificar si clickeó una imagen
      const pos = getPos(e);
      const clicked = findImageAt(pos.x, pos.y);
      if (clicked && tool !== 'eraser') {
        selectImage(clicked);
        return;
      }
      deselectImages();

      isDrawing = true;
      const p = getPos(e);
      startX = p.x;
      startY = p.y;

      if (tool === 'text') {
        // Crear texto en la posición
        const text = prompt('Escribe el texto:');
        if (text) {
          ctx.font = `${size * 6}px Inter, sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText(text, startX, startY);
          savePizarraSnapshot();
        }
        isDrawing = false;
        return;
      }

      // Snapshot para figuras (preview)
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (tool === 'pen' || tool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
      }
    }

    function draw(e) {
      e.preventDefault();
      if (!isDrawing) return;
      const p = getPos(e);

      ctx.lineWidth = size;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      if (tool === 'pen') {
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (tool === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size * 3;
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      } else if (tool === 'line') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
      } else if (tool === 'circle') {
        ctx.putImageData(snapshot, 0, 0);
        const radius = Math.max(1, Math.sqrt(Math.pow(p.x - startX, 2) + Math.pow(p.y - startY, 2)));
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function stopDrawing(e) {
      if (isDrawing) {
        isDrawing = false;
        savePizarraSnapshot();
      }
    }

    // Guardar snapshot del canvas como dataURL
    function savePizarraSnapshot() {
      const dataURL = canvas.toDataURL('image/png');
      sharedState.pizarra.drawings = [dataURL]; // solo guardamos el último estado
      scheduleSave();
    }

    // ====== Imágenes flotantes ======
    const container = canvas.parentElement;

    function findImageAt(x, y) {
      // Buscar de arriba hacia abajo (z-index)
      for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        const rect = img.element.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const imgX = rect.left - canvasRect.left;
        const imgY = rect.top - canvasRect.top;
        if (x >= imgX && x <= imgX + rect.width && y >= imgY && y <= imgY + rect.height) {
          return img;
        }
      }
      return null;
    }

    function selectImage(img) {
      deselectImages();
      selectedImage = img;
      img.element.classList.add('selected');
    }

    function deselectImages() {
      images.forEach(i => i.element.classList.remove('selected'));
      selectedImage = null;
    }

    function createPizarraImage(src, x, y, w, h) {
      const imgEl = document.createElement('img');
      imgEl.src = src;
      imgEl.className = 'pizarra-img';
      imgEl.style.left = x + 'px';
      imgEl.style.top = y + 'px';
      imgEl.style.width = (w || 150) + 'px';
      imgEl.style.height = (h || 'auto');
      imgEl.draggable = false;

      // Resize handle
      const resizeH = document.createElement('div');
      resizeH.className = 'resize-handle';
      imgEl.appendChild(resizeH);

      // Delete handle
      const deleteH = document.createElement('div');
      deleteH.className = 'delete-handle';
      deleteH.innerHTML = '×';
      deleteH.addEventListener('click', (e) => {
        e.stopPropagation();
        container.removeChild(imgEl);
        images = images.filter(i => i.element !== imgEl);
        sharedState.pizarra.images = images.map(i => ({
          src: i.element.src, x: i.element.style.left, y: i.element.style.top,
          w: i.element.style.width, h: i.element.style.height
        }));
        scheduleSave();
      });
      imgEl.appendChild(deleteH);

      // Click para seleccionar
      imgEl.addEventListener('mousedown', (e) => {
        if (e.target === deleteH || e.target === resizeH) return;
        selectImage({ element: imgEl });
        dragMode = 'move';
        const rect = imgEl.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        e.preventDefault();
        e.stopPropagation();
      });

      // Resize
      resizeH.addEventListener('mousedown', (e) => {
        selectImage({ element: imgEl });
        dragMode = 'resize';
        e.preventDefault();
        e.stopPropagation();
      });

      container.appendChild(imgEl);
      images.push({ element: imgEl });

      // Drag global
      function onMove(e) {
        if (!selectedImage || selectedImage.element !== imgEl) return;
        const containerRect = container.getBoundingClientRect();
        if (dragMode === 'move') {
          const newX = e.clientX - containerRect.left - dragOffsetX;
          const newY = e.clientY - containerRect.top - dragOffsetY;
          imgEl.style.left = newX + 'px';
          imgEl.style.top = newY + 'px';
        } else if (dragMode === 'resize') {
          const rect = imgEl.getBoundingClientRect();
          const newW = Math.max(40, e.clientX - rect.left);
          imgEl.style.width = newW + 'px';
          imgEl.style.height = 'auto';
        }
      }
      function onUp() {
        if (dragMode) {
          dragMode = null;
          // Guardar estado
          sharedState.pizarra.images = images.map(i => ({
            src: i.element.src,
            x: i.element.style.left,
            y: i.element.style.top,
            w: i.element.style.width,
            h: i.element.style.height
          }));
          scheduleSave();
        }
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);

      return imgEl;
    }

    // Clic fuera de imagen para deseleccionar
    canvas.addEventListener('mousedown', () => deselectImages());

    // Insertar imagen
    const addImageBtn = document.getElementById('addImageBtn');
    const imageInput = document.getElementById('imageInput');
    addImageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        createPizarraImage(ev.target.result, 100, 100, 150);
        sharedState.pizarra.images = images.map(i => ({
          src: i.element.src, x: i.element.style.left, y: i.element.style.top,
          w: i.element.style.width, h: i.element.style.height
        }));
        scheduleSave();
      };
      reader.readAsDataURL(file);
      imageInput.value = '';
    });

    // Limpiar
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (!confirm('¿Borrar todo el contenido de la pizarra?')) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      images.forEach(i => container.removeChild(i.element));
      images = [];
      sharedState.pizarra = { drawings: [], images: [], texts: [] };
      scheduleSave();
    });

    // Guardar manual
    document.getElementById('saveBtn').addEventListener('click', () => {
      saveSharedState().then(ok => {
        statusEl.textContent = ok ? '✅ Guardado en la nube' : '❌ Error al guardar';
        setTimeout(() => statusEl.textContent = '✓ Sincronizado', 2000);
      });
    });

    // Refrescar
    document.getElementById('refreshPizarra').addEventListener('click', async () => {
      statusEl.textContent = '↻ Cargando...';
      await loadSharedState();
      restorePizarra();
      statusEl.textContent = '✓ Actualizado';
    });

    // Restaurar estado compartido
    async function restorePizarra() {
      // Dibujar el último snapshot
      if (sharedState.pizarra.drawings && sharedState.pizarra.drawings.length > 0) {
        const dataURL = sharedState.pizarra.drawings[0];
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
        };
        img.src = dataURL;
      }
      // Restaurar imágenes
      images.forEach(i => container.removeChild(i.element));
      images = [];
      if (sharedState.pizarra.images) {
        sharedState.pizarra.images.forEach(imgData => {
          createPizarraImage(imgData.src, parseInt(imgData.x) || 100, parseInt(imgData.y) || 100, parseInt(imgData.w) || 150);
        });
      }
    }

    return restorePizarra;
  }

  // =====================================================
  // ============ CARTAS ============
  // =====================================================
  function initCartas() {
    const cartas = document.querySelectorAll('.carta-text');
    const savedIndicators = document.querySelectorAll('.carta-saved');

    cartas.forEach((textarea, i) => {
      // Cargar contenido
      if (sharedState.cartas[i]) {
        textarea.value = sharedState.cartas[i];
      }

      let timeout;
      textarea.addEventListener('input', () => {
        sharedState.cartas[i] = textarea.value;
        savedIndicators[i].textContent = '⏳ Guardando...';
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(async () => {
          await saveSharedState();
          savedIndicators[i].textContent = '✅ Guardado';
          setTimeout(() => savedIndicators[i].textContent = '💾 Guardado', 2000);
        }, 1500);
      });
    });
  }

  // =====================================================
  // ============ MÚSICA (Reproductor tipo MP3) ============
  // =====================================================
  let ytPlayer = null;
  let ytReady = false;
  let currentSongIndex = -1;
  let progressInterval = null;

  // Exponer callback global para YouTube API
  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('youtubePlayer', {
      height: '100%',
      width: '100%',
      videoId: '',
      playerVars: {
        autoplay: 0,
        controls: 1,           // CON controles visibles (video)
        disablekb: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3      // sin anotaciones
      },
      events: {
        onReady: () => {
          ytReady = true;
          ytPlayer.setVolume(80);
          // Hide placeholder when player is ready
          const placeholder = document.getElementById('ytPlaceholder');
          if (placeholder) placeholder.classList.add('hidden');
        },
        onStateChange: (e) => {
          const playPauseBtn = document.getElementById('mp3PlayPause');
          if (e.data === YT.PlayerState.PLAYING) {
            if (playPauseBtn) playPauseBtn.textContent = '⏸';
            startProgressTracking();
            updateDuration();
          } else if (e.data === YT.PlayerState.PAUSED) {
            if (playPauseBtn) playPauseBtn.textContent = '▶';
            stopProgressTracking();
          } else if (e.data === YT.PlayerState.ENDED) {
            if (playPauseBtn) playPauseBtn.textContent = '▶';
            stopProgressTracking();
            playNext();
          }
        }
      }
    });
  };

  function startProgressTracking() {
    stopProgressTracking();
    progressInterval = setInterval(updateProgress, 500);
  }

  function stopProgressTracking() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function updateProgress() {
    if (!ytReady || !ytPlayer || !ytPlayer.getCurrentTime) return;
    const current = ytPlayer.getCurrentTime() || 0;
    const total = ytPlayer.getDuration() || 0;
    const pct = total > 0 ? (current / total) * 100 : 0;

    const progressBar = document.getElementById('mp3ProgressBar');
    const progressHandle = document.getElementById('mp3ProgressHandle');
    const currentTimeEl = document.getElementById('mp3CurrentTime');
    const durationEl = document.getElementById('mp3Duration');

    if (progressBar) progressBar.style.width = pct + '%';
    if (progressHandle) progressHandle.style.left = pct + '%';
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
    if (durationEl) durationEl.textContent = formatTime(total);
  }

  function updateDuration() {
    if (!ytReady || !ytPlayer || !ytPlayer.getDuration) return;
    const total = ytPlayer.getDuration() || 0;
    const durationEl = document.getElementById('mp3Duration');
    if (durationEl) durationEl.textContent = formatTime(total);
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  function initMusica() {
    const input = document.getElementById('musicaInput');
    const folderSelect = document.getElementById('musicaFolderSelect');
    const addBtn = document.getElementById('musicaAddBtn');
    const folderInput = document.getElementById('musicaFolderInput');
    const folderBtn = document.getElementById('musicaFolderBtn');
    const list = document.getElementById('musicaList');
    const count = document.getElementById('musicaCount');

    // Elementos del reproductor
    const mp3Title = document.getElementById('mp3Title');
    const mp3Folder = document.getElementById('mp3Folder');
    const mp3PlayPause = document.getElementById('mp3PlayPause');
    const mp3Prev = document.getElementById('mp3Prev');
    const mp3Next = document.getElementById('mp3Next');
    const mp3Volume = document.getElementById('mp3Volume');
    const mp3Progress = document.getElementById('mp3Progress');

    function renderFolders() {
      const current = folderSelect.value;
      folderSelect.innerHTML = '<option value="">🎵 Sin carpeta</option>';
      sharedState.musica.folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = '📁 ' + f;
        folderSelect.appendChild(opt);
      });
      folderSelect.value = current;
    }

    function renderList() {
      list.innerHTML = '';
      const songs = sharedState.musica.songs;
      count.textContent = `${songs.length} canción${songs.length !== 1 ? 'es' : ''}`;

      if (songs.length === 0) {
        list.innerHTML = '<li class="musica-empty">Aún no hay canciones. ¡Agrega la primera!</li>';
        return;
      }

      songs.forEach((song, idx) => {
        const li = document.createElement('li');
        li.className = 'musica-item' + (idx === currentSongIndex ? ' playing' : '');
        li.draggable = true;
        li.dataset.index = idx;

        const thumb = document.createElement('img');
        thumb.className = 'musica-thumb';
        thumb.src = `https://img.youtube.com/vi/${song.id}/mqdefault.jpg`;
        thumb.alt = '';
        thumb.onerror = () => { thumb.style.background = '#000'; thumb.src = ''; };

        const info = document.createElement('div');
        info.className = 'musica-info';
        const title = document.createElement('div');
        title.className = 'musica-title';
        title.textContent = song.title || `Canción ${idx + 1}`;
        const folder = document.createElement('div');
        folder.className = 'musica-folder-tag';
        folder.textContent = song.folder ? '📁 ' + song.folder : '🎵 Sin carpeta';
        info.appendChild(title);
        info.appendChild(folder);

        const actions = document.createElement('div');
        actions.className = 'musica-actions';
        const upBtn = document.createElement('button');
        upBtn.className = 'musica-action-btn';
        upBtn.textContent = '↑';
        upBtn.title = 'Subir';
        upBtn.onclick = (e) => { e.stopPropagation(); moveSong(idx, -1); };
        const downBtn = document.createElement('button');
        downBtn.className = 'musica-action-btn';
        downBtn.textContent = '↓';
        downBtn.title = 'Bajar';
        downBtn.onclick = (e) => { e.stopPropagation(); moveSong(idx, 1); };
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'musica-action-btn download';
        downloadBtn.textContent = '⬇';
        downloadBtn.title = 'Descargar MP3';
        downloadBtn.onclick = (e) => {
          e.stopPropagation();
          window.open(song.downloadUrl, '_blank', 'noopener');
        };
        const delBtn = document.createElement('button');
        delBtn.className = 'musica-action-btn delete';
        delBtn.textContent = '✕';
        delBtn.title = 'Eliminar';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteSong(idx); };
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(delBtn);

        li.appendChild(thumb);
        li.appendChild(info);
        li.appendChild(actions);

        li.onclick = () => playSong(idx);
        list.appendChild(li);
      });
    }

    function playSong(idx) {
      if (!sharedState.musica.songs[idx]) return;
      const song = sharedState.musica.songs[idx];
      currentSongIndex = idx;

      // Actualizar UI del reproductor
      if (mp3Title) mp3Title.textContent = song.title || `Canción ${idx + 1}`;
      if (mp3Folder) mp3Folder.textContent = song.folder ? '📁 ' + song.folder : '🎵 Sin carpeta';

      // Ocultar placeholder del video
      const placeholder = document.getElementById('ytPlaceholder');
      if (placeholder) placeholder.classList.add('hidden');

      // Reproducir video visible
      if (ytReady && ytPlayer) {
        ytPlayer.loadVideoById(song.id);
        ytPlayer.playVideo();
      }
      renderList();
    }

    function playNext() {
      if (currentSongIndex >= 0 && currentSongIndex < sharedState.musica.songs.length - 1) {
        playSong(currentSongIndex + 1);
      } else {
        if (mp3PlayPause) mp3PlayPause.textContent = '▶';
      }
    }

    function playPrev() {
      if (currentSongIndex > 0) {
        playSong(currentSongIndex - 1);
      }
    }

    function togglePlayPause() {
      if (!ytReady || !ytPlayer || currentSongIndex === -1) {
        if (sharedState.musica.songs.length > 0) playSong(0);
        return;
      }
      const state = ytPlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    }

    // Controles del reproductor
    if (mp3PlayPause) mp3PlayPause.addEventListener('click', togglePlayPause);
    if (mp3Next) mp3Next.addEventListener('click', playNext);
    if (mp3Prev) mp3Prev.addEventListener('click', playPrev);

    // Volumen
    if (mp3Volume) {
      mp3Volume.addEventListener('input', (e) => {
        if (ytReady && ytPlayer) {
          ytPlayer.setVolume(parseInt(e.target.value));
        }
      });
    }

    // Seek (click en la barra de progreso)
    if (mp3Progress) {
      mp3Progress.addEventListener('click', (e) => {
        if (!ytReady || !ytPlayer || !ytPlayer.getDuration) return;
        const rect = mp3Progress.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const total = ytPlayer.getDuration() || 0;
        if (total > 0) {
          ytPlayer.seekTo(pct * total, true);
        }
      });
    }

    function moveSong(idx, dir) {
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= sharedState.musica.songs.length) return;
      const songs = sharedState.musica.songs;
      [songs[idx], songs[newIdx]] = [songs[newIdx], songs[idx]];
      if (currentSongIndex === idx) currentSongIndex = newIdx;
      else if (currentSongIndex === newIdx) currentSongIndex = idx;
      renderList();
      scheduleSave();
    }

    function deleteSong(idx) {
      if (!confirm('¿Eliminar esta canción de la lista?')) return;
      sharedState.musica.songs.splice(idx, 1);
      if (currentSongIndex === idx) {
        currentSongIndex = -1;
        if (ytReady && ytPlayer) ytPlayer.stopVideo();
        if (mp3PlayPause) mp3PlayPause.textContent = '▶';
        if (mp3Title) mp3Title.textContent = 'Selecciona una canción';
        if (mp3Folder) mp3Folder.textContent = '—';
        stopProgressTracking();
      } else if (currentSongIndex > idx) {
        currentSongIndex--;
      }
      renderList();
      scheduleSave();
    }

    async function addSong() {
      const url = input.value.trim();
      if (!url) return;
      const id = extractYouTubeId(url);
      if (!id) {
        alert('No se pudo reconocer el link de YouTube. Asegúrate de que sea un link válido.');
        return;
      }

      // Obtener el título vía oEmbed (gratuito, sin API key)
      let title = `Canción ${sharedState.musica.songs.length + 1}`;
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
        if (res.ok) {
          const data = await res.json();
          title = data.title;
        }
      } catch (e) {}

      // URL para descargar MP3 vía y2mate (servicio externo)
      const downloadUrl = `https://www.y2mate.com/youtube/${id}`;

      sharedState.musica.songs.push({
        id,
        title,
        url: `https://youtube.com/watch?v=${id}`,
        downloadUrl,
        folder: folderSelect.value || '',
        addedAt: Date.now()
      });
      input.value = '';
      renderList();
      scheduleSave();

      // Auto-reproducir la primera canción que se agrega
      if (sharedState.musica.songs.length === 1) {
        setTimeout(() => playSong(0), 300);
      }
    }

    addBtn.addEventListener('click', addSong);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addSong(); }
    });

    folderBtn.addEventListener('click', () => {
      const name = folderInput.value.trim();
      if (!name) return;
      if (sharedState.musica.folders.includes(name)) {
        alert('Esa carpeta ya existe.');
        return;
      }
      sharedState.musica.folders.push(name);
      folderInput.value = '';
      renderFolders();
      scheduleSave();
    });

    // Drag & drop para reorder
    let dragSrcIdx = null;
    list.addEventListener('dragstart', (e) => {
      const li = e.target.closest('.musica-item');
      if (!li) return;
      dragSrcIdx = parseInt(li.dataset.index);
      li.style.opacity = '0.4';
    });
    list.addEventListener('dragend', (e) => {
      const li = e.target.closest('.musica-item');
      if (li) li.style.opacity = '';
    });
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const li = e.target.closest('.musica-item');
      if (!li || dragSrcIdx === null) return;
      const targetIdx = parseInt(li.dataset.index);
      if (dragSrcIdx === targetIdx) return;
      const songs = sharedState.musica.songs;
      const [moved] = songs.splice(dragSrcIdx, 1);
      songs.splice(targetIdx, 0, moved);
      dragSrcIdx = null;
      renderList();
      scheduleSave();
    });

    renderFolders();
    renderList();
  }

  // =====================================================
  // ============ GUSTOS ============
  // =====================================================
  function initGustos() {
    const cards = document.querySelectorAll('.gusto-card');

    cards.forEach(card => {
      const category = card.dataset.category;
      const input = card.querySelector('.gusto-input');
      const addBtn = card.querySelector('.gusto-add-btn');
      const list = card.querySelector('.gusto-list');

      function render() {
        const items = sharedState.gustos[category] || [];
        list.innerHTML = '';
        items.forEach((item, idx) => {
          const li = document.createElement('li');
          li.className = 'gusto-item';
          const text = document.createElement('span');
          text.textContent = item;
          const delBtn = document.createElement('button');
          delBtn.className = 'gusto-delete';
          delBtn.textContent = '×';
          delBtn.title = 'Eliminar';
          delBtn.onclick = () => {
            sharedState.gustos[category].splice(idx, 1);
            render();
            scheduleSave();
          };
          li.appendChild(text);
          li.appendChild(delBtn);
          list.appendChild(li);
        });
      }

      function add() {
        const val = input.value.trim();
        if (!val) return;
        if (!sharedState.gustos[category]) sharedState.gustos[category] = [];
        sharedState.gustos[category].push(val);
        input.value = '';
        render();
        scheduleSave();
      }

      addBtn.addEventListener('click', add);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); add(); }
      });

      render();
    });
  }

  // =====================================================
  // ============ INICIALIZACIÓN ============
  // =====================================================
  async function initAll() {
    const restorePizarra = initPizarra();
    initCartas();
    initMusica();
    initGustos();

    // Cargar estado compartido y restaurar
    const loaded = await loadSharedState();
    const statusEl = document.getElementById('pizarraStatus');
    if (statusEl) {
      statusEl.textContent = loaded ? '✓ Sincronizado en la nube' : '⚠ Modo local (sin sincronización)';
    }
    if (loaded && restorePizarra) restorePizarra();

    // Re-init cartas y gustos con datos cargados
    const cartas = document.querySelectorAll('.carta-text');
    cartas.forEach((textarea, i) => {
      if (sharedState.cartas[i]) textarea.value = sharedState.cartas[i];
    });

    const gustoCards = document.querySelectorAll('.gusto-card');
    gustoCards.forEach(card => {
      const category = card.dataset.category;
      const list = card.querySelector('.gusto-list');
      const items = sharedState.gustos[category] || [];
      list.innerHTML = '';
      items.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'gusto-item';
        const text = document.createElement('span');
        text.textContent = item;
        const delBtn = document.createElement('button');
        delBtn.className = 'gusto-delete';
        delBtn.textContent = '×';
        delBtn.onclick = () => {
          sharedState.gustos[category].splice(idx, 1);
          list.removeChild(li);
          scheduleSave();
        };
        li.appendChild(text);
        li.appendChild(delBtn);
        list.appendChild(li);
      });
    });

    // Refrescar música también
    const musicaList = document.getElementById('musicaList');
    const musicaCount = document.getElementById('musicaCount');
    if (musicaList && sharedState.musica.songs.length > 0) {
      const folderSelect = document.getElementById('musicaFolderSelect');
      sharedState.musica.folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = '📁 ' + f;
        folderSelect.appendChild(opt);
      });
      musicaCount.textContent = `${sharedState.musica.songs.length} canción${sharedState.musica.songs.length !== 1 ? 'es' : ''}`;
      musicaList.innerHTML = '';
      sharedState.musica.songs.forEach((song, idx) => {
        const li = document.createElement('li');
        li.className = 'musica-item';
        li.dataset.index = idx;
        const thumb = document.createElement('img');
        thumb.className = 'musica-thumb';
        thumb.src = `https://img.youtube.com/vi/${song.id}/mqdefault.jpg`;
        const info = document.createElement('div');
        info.className = 'musica-info';
        const title = document.createElement('div');
        title.className = 'musica-title';
        title.textContent = song.title;
        const folder = document.createElement('div');
        folder.className = 'musica-folder-tag';
        folder.textContent = song.folder ? '📁 ' + song.folder : '🎵 Sin carpeta';
        info.appendChild(title);
        info.appendChild(folder);

        const actions = document.createElement('div');
        actions.className = 'musica-actions';
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'musica-action-btn download';
        downloadBtn.textContent = '⬇';
        downloadBtn.title = 'Descargar MP3';
        downloadBtn.onclick = (e) => {
          e.stopPropagation();
          window.open(song.downloadUrl || `https://www.y2mate.com/youtube/${song.id}`, '_blank', 'noopener');
        };
        actions.appendChild(downloadBtn);

        li.appendChild(thumb);
        li.appendChild(info);
        li.appendChild(actions);
        li.onclick = () => {
          if (ytReady && ytPlayer) {
            ytPlayer.loadVideoById(song.id);
            ytPlayer.playVideo();
          }
          // Actualizar UI
          const mp3Title = document.getElementById('mp3Title');
          const mp3Folder = document.getElementById('mp3Folder');
          if (mp3Title) mp3Title.textContent = song.title;
          if (mp3Folder) mp3Folder.textContent = song.folder ? '📁 ' + song.folder : '🎵 Sin carpeta';

          // Ocultar placeholder del video
          const placeholder = document.getElementById('ytPlaceholder');
          if (placeholder) placeholder.classList.add('hidden');

          // Quitar selección anterior
          musicaList.querySelectorAll('.musica-item').forEach(item => item.classList.remove('playing'));
          li.classList.add('playing');
        };
        musicaList.appendChild(li);
      });
    }
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
