/* =========================================================
   LoveSongs Player
   Mantém o HTML/CSS existentes
   ========================================================= */

/* =========================
   ELEMENTOS DOM
========================= */

const videoPlayer = document.getElementById("videoPlayer")

const titleEl = document.querySelector(".song-title")
const artistEl = document.querySelector(".song-artist")

const currentTimeEl = document.querySelector(".current-time")
const totalTimeEl = document.querySelector(".total-time")

const fill = document.querySelector(".fill")
const bar = document.querySelector(".bar")

const bgBlur = document.getElementById("bgBlur")

const controls = document.querySelectorAll(".controls .material-icons-outlined")

const btnShuffle = controls[0]
const btnPrev = controls[1]
const btnPlay = controls[2]
const btnNext = controls[3]
const btnRepeat = controls[4]

const headerIcons = document.querySelectorAll(".header-right .material-icons-outlined")

const btnSearch = headerIcons[0]
const btnShare = headerIcons[1]
const btnFavorite = headerIcons[2]
const btnPlaylist = headerIcons[3]
const btnMore = headerIcons[4]

/* =========================
   ESTADO
========================= */

let playlists = []
let currentPlaylist = null
let currentIndex = 0

let player = null
let playing = false
let repeat = false
let shuffle = false

let progressTimer = null

let favorites = JSON.parse(localStorage.getItem("favorites") || "[]")

/* =========================
   UTIL
========================= */

function formatTime(sec) {

  sec = Math.floor(sec)

  const m = Math.floor(sec / 60)
  let s = sec % 60

  if (s < 10) s = "0" + s

  return `${m}:${s}`

}

/* =========================
   YOUTUBE API
========================= */
// Removido: não usar API do YouTube

/* =========================
   PLAYLIST JSON
========================= */

async function loadPlaylists() {

  const res = await fetch("/data/playlists.json")
  const data = await res.json()

  playlists = data.playlists

  // Não carrega playlist automaticamente
  showChoosePlaylist()

}

/* =========================
   DEEP LINK
========================= */

function loadFromURL() {

  // Não carrega playlist automaticamente
  // Função mantida para compatibilidade
function showChoosePlaylist() {
  titleEl.textContent = "Escolha uma Playlist"
  artistEl.textContent = ""
  videoPlayer.innerHTML = ""
}

}

/* =========================
   CARREGAR VIDEO
========================= */

function loadVideo() {

  const video = currentPlaylist.videos[currentIndex]

  titleEl.textContent = video.title
  artistEl.textContent = video.artist

  const artistSlug = video.artist.toLowerCase().replace(/\s/g, "-")
  bgBlur.style.backgroundImage = `url(/covers/artists/${artistSlug}.webp)`

  const videoId = video.id

  // Substitui o conteúdo do videoPlayer por um iframe padrão
  videoPlayer.innerHTML = `<iframe id="ytplayer" width="100%" height="315" src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" frameborder="0" allowfullscreen></iframe>`
  setTimeout(() => {
    player = videoPlayer.querySelector('iframe').contentWindow;
    playing = false;
    btnPlay.textContent = "play_circle_outline";
  }, 500);

  updateURL()

}

/* =========================
   PLAYER EVENTS
========================= */

function onPlayerReady() {

  startProgressLoop()

}

function onStateChange(e) {

  playing = e.data === 1

  btnPlay.textContent =
    playing ? "pause_circle" : "play_circle_outline"

}

/* =========================
   PROGRESS LOOP
========================= */

function startProgressLoop() {

  if (progressTimer) clearInterval(progressTimer)

  progressTimer = setInterval(() => {

    if (!player || !player.getDuration) return

    const duration = player.getDuration()
    const current = player.getCurrentTime()

    if (!duration) return

    const percent = (current / duration) * 100

    fill.style.width = percent + "%"

    currentTimeEl.textContent = formatTime(current)
    totalTimeEl.textContent = formatTime(duration)

  }, 500)

}

/* =========================
   CONTROLES PLAYER
========================= */

btnPlay.onclick = () => {

  const iframe = document.getElementById('ytplayer');
  if (!iframe) return;
  // Envia comandos para o iframe YouTube API
  iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: playing ? 'pauseVideo' : 'playVideo', args: [] }), '*');
  // Estado será atualizado pelo evento do YouTube, mas para feedback imediato:
  playing = !playing;
  btnPlay.textContent = playing ? "pause_circle" : "play_circle_outline";

}

btnNext.onclick = () => {

  if (shuffle) {
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * currentPlaylist.videos.length);
    } while (currentPlaylist.videos.length > 1 && nextIndex === currentIndex);
    currentIndex = nextIndex;
  } else {
    currentIndex++;
    if (currentIndex >= currentPlaylist.videos.length) {
      if (repeat) {
        currentIndex = 0;
      } else {
        currentIndex = currentPlaylist.videos.length - 1;
      }
    }
  }
  loadVideo();

}

btnPrev.onclick = () => {

  currentIndex--

  if (currentIndex < 0) {
    currentIndex = currentPlaylist.videos.length - 1
  }

  loadVideo()

}

btnShuffle.onclick = () => {

  shuffle = !shuffle

  btnShuffle.style.opacity = shuffle ? 1 : 0.5

}

btnRepeat.onclick = () => {

  repeat = !repeat;
  btnRepeat.style.opacity = repeat ? 1 : 0.5;
  btnRepeat.classList.toggle('active', repeat);

}

/* =========================
   SEEK NA BARRA
========================= */

bar.onclick = (e) => {

  const iframe = document.getElementById('ytplayer');
  if (!iframe) return;
  // Envia comando de seek via postMessage
  // Precisa obter duração do vídeo via barra
  // Não temos acesso direto, então estimamos pelo fill
  // Alternativamente, podemos guardar a duração em uma variável global
  // Melhor: usar o valor mostrado em totalTimeEl
  const rect = bar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  // Extrai minutos e segundos do totalTimeEl
  const [min, sec] = totalTimeEl.textContent.split(':');
  const duration = parseInt(min) * 60 + parseInt(sec);
  const seekTo = duration * percent;
  iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [seekTo, true] }), '*');

}

/* =========================
   SHARE
========================= */

btnShare.onclick = () => {

  if (!currentPlaylist) {
    alert("Escolha uma playlist primeiro!")
    return
  }
  const video = currentPlaylist.videos[currentIndex]
  const url = `${location.origin}${location.pathname}?p=${currentPlaylist.slug}&v=${video.id}`
  if (navigator.share) {
    navigator.share({
      title: video.title,
      text: video.artist,
      url: url
    })
  } else {
    navigator.clipboard.writeText(url)
    alert("Link copiado!")
  }

}

/* =========================
   FAVORITES
========================= */

btnFavorite.onclick = () => {

  if (!currentPlaylist) {
    alert("Escolha uma playlist primeiro!")
    return
  }
  const video = currentPlaylist.videos[currentIndex]
  const key = video.id
  const index = favorites.indexOf(key)
  if (index >= 0) {
    favorites.splice(index, 1)
    btnFavorite.textContent = "favorite_border"
  } else {
    favorites.push(key)
    btnFavorite.textContent = "favorite"
  }
  localStorage.setItem("favorites", JSON.stringify(favorites))

}

/* =========================
   BOTTOM SHEETS
========================= */

function createBottomSheet(contentHTML) {

  const sheet = document.createElement("div");
  sheet.className = "modern-bottom-sheet";
  sheet.innerHTML = `
    <div class="sheet-content" style="width:100vw">
      ${contentHTML}
    </div>
  `;
  document.body.appendChild(sheet);
  // Fecha ao clicar fora da .sheet-content
  sheet.addEventListener('mousedown', function(e) {
    const content = sheet.querySelector('.sheet-content');
    if (content && !content.contains(e.target)) {
      sheet.remove();
    }
  });
  // Cria overlay de fundo
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  document.body.appendChild(overlay);

  // Fecha ao clicar no overlay
  overlay.addEventListener('mousedown', function(e) {
    overlay.remove();
    sheet.remove();
  });
  // Impede propagação do clique dentro do conteúdo
  sheet.querySelector('.sheet-content').addEventListener('mousedown', function(e) {
    e.stopPropagation();
  });

}

/* =========================
   PLAYLIST MODAL
========================= */

btnPlaylist.onclick = () => {

  let html = "<h3>Playlists</h3>"
  playlists.forEach((p, i) => {
    const cover = `/covers/playlists/${p.slug}.webp`;
    html += `<div class='playlist-option' data-index="${i}" style="display:flex;align-items:center;margin:10px 0;cursor:pointer;gap:12px;">
      <img src='${cover}' alt='cover' style='width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid #333;background:#181828;'>
      <span>${p.name}</span>
    </div>`;
  });
  createBottomSheet(html);

  setTimeout(() => {
    document.querySelectorAll('.playlist-option').forEach(el => {
      el.onclick = (e) => {
        currentPlaylist = playlists[parseInt(el.dataset.index)];
        currentIndex = 0;
        loadVideo();
        document.querySelector('.modern-bottom-sheet')?.remove();
        document.querySelector('.sheet-overlay')?.remove();
      };
    });
  }, 100);

}

/* =========================
   SEARCH MODAL
========================= */

btnSearch.onclick = () => {

  createBottomSheet(`
    <input id="searchInput" type="text" placeholder="Buscar..." style="width:100%;padding:10px">
    <div id="searchResults"></div>
  `);

  setTimeout(() => {
    document.getElementById('searchInput').oninput = function() {
      const query = this.value.toLowerCase();
      let results = [];
      playlists.forEach(p => {
        p.videos.forEach(v => {
          if (v.title.toLowerCase().includes(query) || v.artist.toLowerCase().includes(query)) {
            const artistSlug = v.artist.toLowerCase().replace(/\s/g, "-");
            const cover = `/covers/artists/${artistSlug}.webp`;
            results.push(`<div class='search-result' style='display:flex;align-items:center;gap:12px;margin:8px 0;cursor:pointer;'>
              <img src='${cover}' alt='cover' style='width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid #333;background:#181828;'>
              <span>${v.title} - ${v.artist}</span>
            </div>`);
          }
        });
      });
      document.getElementById('searchResults').innerHTML = results.join('');
      document.querySelectorAll('.search-result').forEach((el, idx) => {
        el.onclick = () => {
          const text = el.querySelector('span').textContent;
          playlists.forEach(p => {
            p.videos.forEach((v, i) => {
              if (`${v.title} - ${v.artist}` === text) {
                currentPlaylist = p;
                currentIndex = i;
                loadVideo();
                document.querySelector('.modern-bottom-sheet')?.remove();
                document.querySelector('.sheet-overlay')?.remove();
              }
            });
          });
        };
      });
    };
  }, 100)

}

/* =========================
   MORE
========================= */

btnMore.onclick = () => {

  createBottomSheet(`
    <div style='text-align:center;'>
      <p style='font-size:1.2rem;font-weight:bold;'>LoveSongs Player</p>
      <p>Autor: Waltemar</p>
      <p style='margin-top:16px;color:#00ccff;'>Projeto open-source</p>
    </div>
  `)

}

/* =========================
   URL
========================= */

function updateURL() {

  const video = currentPlaylist.videos[currentIndex]

  const url =
    `?p=${currentPlaylist.slug}&v=${video.id}`

  history.replaceState(null, "", url)

}

/* =========================
   INIT
========================= */

loadPlaylists()
