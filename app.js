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
let autoPlayNext = false

let progressTimer = null

let videoDuration = 0;

let shouldAutoPlay = false;

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

// Carrega a API JS do YouTube dinamicamente
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onload = () => {
      window.onYouTubeIframeAPIReady = () => resolve();
    };
    document.head.appendChild(script);
  });
}

// Listener para mensagens do YouTube iframe (fallback, não usado com API JS)
window.addEventListener('message', (event) => {
  // Removido, pois usamos API JS
});

async function getCoverUrl(path, fallback = '/covers/cover.svg') {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(path);
    img.onerror = () => resolve(fallback);
    img.src = path;
  });
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

  // Carrega playlist automaticamente se houver na URL
  loadFromURL()

}

/* =========================
   DEEP LINK
========================= */

function loadFromURL() {

  const urlParams = new URLSearchParams(window.location.search);
  const playlistSlug = urlParams.get('p');
  const videoId = urlParams.get('v');

  if (playlistSlug && videoId) {
    const playlist = playlists.find(p => p.slug === playlistSlug);
    if (playlist) {
      const videoIndex = playlist.videos.findIndex(v => v.id === videoId);
      if (videoIndex !== -1) {
        currentPlaylist = playlist;
        currentIndex = videoIndex;
        loadVideo();
        return;
      }
    }
  }

  // Se não houver parâmetros ou não encontrar, mostra escolha de playlist
  showChoosePlaylist();

}
  // Função mantida para compatibilidade
function showChoosePlaylist() {
  titleEl.textContent = "Escolha uma Playlist"
  artistEl.textContent = ""
  videoPlayer.innerHTML = ""
}


/* =========================
   CARREGAR VIDEO
========================= */

async function loadVideo() {

  const video = currentPlaylist.videos[currentIndex]

  titleEl.textContent = video.title
  artistEl.textContent = video.artist

  const artistSlug = video.artist.toLowerCase().replace(/\s/g, "-")
  const coverUrl = await getCoverUrl(`/covers/artists/${artistSlug}.webp`);
  bgBlur.style.backgroundImage = `url(${coverUrl})`

  const videoId = video.id

  // Carrega a API se necessário
  await loadYouTubeAPI();

  // Calcula dimensões para cobrir a área com aspect ratio 1:1
  const rect = videoPlayer.getBoundingClientRect();
  const containerWidth = rect.width;
  const containerHeight = rect.height;
  const videoAspect = 1; // 1:1 para zoom e crop
  let playerWidth, playerHeight;

  if (containerWidth / containerHeight > videoAspect) {
    playerHeight = containerHeight;
    playerWidth = containerHeight * videoAspect;
  } else {
    playerWidth = containerWidth;
    playerHeight = containerWidth / videoAspect;
  }

  // Cria o player YouTube
  if (player) {
    player.destroy();
  }
  player = new YT.Player('videoPlayer', {
    height: playerHeight,
    width: playerWidth,
    videoId: videoId,
    playerVars: {
      'playsinline': 1,
      'controls': 0,
      'disablekb': 1,
      'fs': 0,
      'iv_load_policy': 3,
      'modestbranding': 1,
      'rel': 0,
      'showinfo': 0
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });

  updateURL()

}

/* =========================
   PLAYER EVENTS
========================= */

function onPlayerReady(event) {
  startProgressLoop();
  // Se devemos tocar automaticamente
  if (shouldAutoPlay || autoPlayNext) {
    shouldAutoPlay = false;
    autoPlayNext = false;
    player.playVideo();
    playing = true;
    btnPlay.textContent = "pause_circle";
  }
}

function onPlayerStateChange(event) {
  playing = event.data === YT.PlayerState.PLAYING;
  btnPlay.textContent = playing ? "pause_circle" : "play_circle_outline";

  // Se o vídeo terminou
  if (event.data === YT.PlayerState.ENDED) {
    if (repeat) {
      // Repetir o vídeo atual
      player.playVideo();
    } else {
      // Avançar para o próximo
      autoPlayNext = true;
      btnNext.onclick();
    }
  }
}

/* =========================
   PROGRESS LOOP
========================= */

function startProgressLoop() {

  if (progressTimer) clearInterval(progressTimer)

  progressTimer = setInterval(() => {

    if (!player || !player.getCurrentTime) return

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

  if (!currentPlaylist) {
    alert("Selecione uma playlist primeiro!")
    return
  }

  if (!player) return;
  if (playing) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
  playing = !playing;
  btnPlay.textContent = playing ? "pause_circle" : "play_circle_outline";

}

btnNext.onclick = () => {

  if (!currentPlaylist) {
    alert("Selecione uma playlist primeiro!")
    return
  }

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

  if (!currentPlaylist) {
    alert("Selecione uma playlist primeiro!")
    return
  }

  currentIndex--

  if (currentIndex < 0) {
    currentIndex = currentPlaylist.videos.length - 1
  }

  loadVideo()

}

btnShuffle.onclick = () => {

  shuffle = !shuffle

  btnShuffle.style.opacity = shuffle ? 1 : 0.5
  btnShuffle.textContent = shuffle ? "shuffle_on" : "shuffle"

}

btnRepeat.onclick = () => {

  repeat = !repeat;
  btnRepeat.style.opacity = repeat ? 1 : 0.5;
  btnRepeat.textContent = repeat ? "repeat_one" : "repeat";

}

/* =========================
   SEEK NA BARRA
========================= */

bar.onclick = (e) => {

  if (!player || !player.seekTo) return;
  const rect = bar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const duration = player.getDuration();
  const seekTo = duration * percent;
  player.seekTo(seekTo, true);
  // Atualiza imediatamente a barra para feedback visual
  fill.style.width = percent * 100 + "%";
}

/* =========================
   SHARE
========================= */

btnShare.onclick = () => {

  if (!currentPlaylist) {
    alert("Selecione um vídeo primeiro")
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
    alert("Selecione um vídeo primeiro")
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
  for (let i = 0; i < playlists.length; i++) {
    const p = playlists[i];
    const cover = `/covers/playlists/${p.slug}.webp`;
    html += `<div class='playlist-option' data-index="${i}" style="display:flex;align-items:center;margin:10px 0;cursor:pointer;gap:12px;">
      <img src='${cover}' alt='cover' onerror="this.src='/covers/cover.svg'" style='width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid #333;background:#181828;'>
      <span>${p.name}</span>
    </div>`;
  }
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
    const searchInput = document.getElementById('searchInput');
    searchInput.focus();
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchInput.blur();
      }
    });
    document.getElementById('searchInput').oninput = function() {
      const query = this.value.toLowerCase();
      let results = [];
      playlists.forEach(p => {
        p.videos.forEach(v => {
          if (v.title.toLowerCase().includes(query) || v.artist.toLowerCase().includes(query)) {
            const artistSlug = v.artist.toLowerCase().replace(/\s/g, "-");
            const cover = `/covers/artists/${artistSlug}.webp`;
            results.push(`<div class='search-result' style='display:flex;align-items:center;gap:12px;margin:8px 0;cursor:pointer;'>
              <img src='${cover}' alt='cover' onerror="this.src='/covers/cover.svg'" style='width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid #333;background:#181828;'>
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
