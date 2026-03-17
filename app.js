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

// Inicializa favoritos a partir do localStorage
let favorites = [];
try {
  favorites = JSON.parse(localStorage.getItem('favorites')) || [];
} catch (e) {
  favorites = [];
}

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

  // Atualiza o ícone do botão de favoritos
  if (favorites.includes(videoId)) {
    btnFavorite.textContent = "favorite";
  } else {
    btnFavorite.textContent = "favorite_border";
  }

  // Calcula dimensões para cortar o vídeo para aspecto 1:1 (cortando laterais)
  const rect = videoPlayer.getBoundingClientRect();
  const containerWidth = rect.width;
  const containerHeight = rect.height;
  const videoAspect = 16 / 9; // Aspecto do vídeo YouTube
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
    <div class="sheet-content" style="width:100vw; position:relative;">
      <button class="sheet-close-btn" title="Fechar" aria-label="Fechar">
        <span class="material-icons-outlined">close</span>
      </button>
      ${contentHTML}
    </div>
  `;
  document.body.appendChild(sheet);
  // Fecha ao clicar fora da .sheet-content
  sheet.addEventListener('mousedown', function(e) {
    const content = sheet.querySelector('.sheet-content');
    if (content && !content.contains(e.target)) {
      closeSheet(sheet);
    }
  });
  // Cria overlay de fundo
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  document.body.appendChild(overlay);

  // Fecha ao clicar no overlay
  overlay.addEventListener('mousedown', function(e) {
    closeSheet(sheet, overlay);
  });
  // Impede propagação do clique dentro do conteúdo
  sheet.querySelector('.sheet-content').addEventListener('mousedown', function(e) {
    e.stopPropagation();
  });
  // Fecha ao clicar no botão X
  sheet.querySelector('.sheet-close-btn').onclick = () => closeSheet(sheet, overlay);
}

function closeSheet(sheet, overlay) {
  // Animação de recolher para baixo
  sheet.classList.add('sheet-hide');
  setTimeout(() => {
    if (sheet) sheet.remove();
    if (overlay) overlay.remove();
    else document.querySelectorAll('.sheet-overlay').forEach(e => e.remove());
  }, 250);

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

  if (!playlists || playlists.length === 0) {
    createBottomSheet('<div style="padding:2rem;text-align:center;font-size:1.1rem;">Aguarde, carregando playlists...</div>');
    return;
  }
  createBottomSheet(`
    <div class="more-sheet-list">
      <button class="sheet-option" data-action="favorites">
        <span class="material-icons-outlined">favorite</span>
        <span>Favoritos</span>
      </button>
      <button class="sheet-option" data-action="backup">
        <span class="material-icons-outlined">cloud_upload</span>
        <span>Fazer Backup e Restaurar</span>
      </button>
      <button class="sheet-option" data-action="login">
        <span class="material-icons-outlined">person</span>
        <span>Login</span>
      </button>
      <button class="sheet-option" data-action="share">
        <span class="material-icons-outlined">share</span>
        <span>Compartilhar LoveSongs</span>
      </button>
      <button class="sheet-option" data-action="privacy">
        <span class="material-icons-outlined">policy</span>
        <span>Política de Privacidade</span>
      </button>
      <button class="sheet-option" data-action="terms">
        <span class="material-icons-outlined">gavel</span>
        <span>Termos de Serviço</span>
      </button>
      <button class="sheet-option" data-action="about">
        <span class="material-icons-outlined">info</span>
        <span>Sobre</span>
      </button>
      <button class="sheet-option" data-action="donate">
        <span class="material-icons-outlined">volunteer_activism</span>
        <span>Doação</span>
      </button>
    </div>
  `);
  // Handlers para links externos e internos
  setTimeout(() => {
    document.querySelectorAll('.sheet-option[data-action="privacy"]').forEach(btn => {
      btn.onclick = () => {
        window.open('politica-de-privacidade.html', '_blank');
      };
    });
    document.querySelectorAll('.sheet-option[data-action="terms"]').forEach(btn => {
      btn.onclick = () => {
        window.open('termos-de-servico.html', '_blank');
      };
    });
    document.querySelectorAll('.sheet-option[data-action="about"]').forEach(btn => {
      btn.onclick = showAboutSheet;
    });
    document.querySelectorAll('.sheet-option[data-action="backup"]').forEach(btn => {
      btn.onclick = showBackupSheet;
    });
      document.querySelectorAll('.sheet-option[data-action="login"]').forEach(btn => {
        btn.onclick = showLoginSheet;
      });
      document.querySelectorAll('.sheet-option[data-action="donate"]').forEach(btn => {
        btn.onclick = showDonateSheet;
      });
      document.querySelectorAll('.sheet-option[data-action="share"]').forEach(btn => {
        btn.onclick = () => {
          if (navigator.share) {
            navigator.share({
              title: 'LoveSongs Player',
              text: 'Ouça músicas românticas no LoveSongs Player!',
              url: location.origin + location.pathname
            });
          } else {
            navigator.clipboard.writeText(location.origin + location.pathname);
            alert('Link do LoveSongs copiado! Compartilhe com quem você ama.');
          }
        };
      });
// Função para exibir o modal de Backup e Restaurar (romântico)
function showBackupSheet() {
  createBottomSheet(`
    <div class="backup-sheet" style="text-align:center;">
      <h2 style="color:#e4405f;">Backup do Amor</h2>
      <div style="font-size:1.1rem;margin-bottom:1.2rem;">Guarde e restaure suas músicas favoritas e memórias românticas.<br>O amor também merece backup! 💖</div>
      <div style="margin: 1.5rem 0;">
        <button id="exportBackupBtn" style="padding:0.7rem 1.5rem;font-size:1rem;margin-bottom:1rem;background:#e4405f;color:#fff;border:none;border-radius:8px;">Exportar Backup do Amor</button><br>
        <input type="file" id="importBackupInput" accept="application/json" style="display:none;">
        <button id="importBackupBtn" style="padding:0.7rem 1.5rem;font-size:1rem;background:#e4405f;color:#fff;border:none;border-radius:8px;">Restaurar Backup do Amor</button>
      </div>
      <div id="backupStatus" style="color:#888;font-size:0.95rem;"></div>
      <div style="margin-top:1.5rem;font-size:0.95rem;color:#e4405f;">O arquivo se chama <b>lovesongs.json</b>.<br>Guarde com carinho! 💌</div>
    </div>
  `);

  // Exportar backup
  document.getElementById('exportBackupBtn').onclick = function() {
    const data = {
      playlists,
      favorites
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lovesongs.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    document.getElementById('backupStatus').textContent = 'Backup exportado com sucesso! Que o amor nunca se perca.';
  };

  // Importar backup
  document.getElementById('importBackupBtn').onclick = function() {
    document.getElementById('importBackupInput').click();
  };
  document.getElementById('importBackupInput').onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.playlists && Array.isArray(data.playlists)) {
          playlists = data.playlists;
          localStorage.setItem('favorites', JSON.stringify(data.favorites || []));
          favorites = data.favorites || [];
          document.getElementById('backupStatus').textContent = 'Backup restaurado! Recarregue a página e continue vivendo seu romance musical.';
        } else {
          document.getElementById('backupStatus').textContent = 'Arquivo inválido. O amor não foi encontrado.';
        }
      } catch (err) {
        document.getElementById('backupStatus').textContent = 'Erro ao importar backup. O cupido se confundiu!';
      }
    };
    reader.readAsText(file);
  };
}

// Função para exibir o modal de Login (romântico)
function showLoginSheet() {
  createBottomSheet(`
    <div class="login-sheet" style="text-align:center;">
      <h2 style="color:#e4405f;">Entrar no LoveSongs</h2>
      <div style="font-size:1.1rem;margin-bottom:1.2rem;">Faça login para guardar suas playlists e eternizar seu romance musical! 💘</div>
      <input type="text" id="loginUser" placeholder="Seu nome de amor" style="padding:0.7rem 1rem;font-size:1rem;margin-bottom:1rem;border-radius:8px;border:1px solid #e4405f;width:80%;max-width:260px;"><br>
      <input type="password" id="loginPass" placeholder="Senha secreta" style="padding:0.7rem 1rem;font-size:1rem;margin-bottom:1.2rem;border-radius:8px;border:1px solid #e4405f;width:80%;max-width:260px;"><br>
      <button id="loginBtn" style="padding:0.7rem 1.5rem;font-size:1rem;background:#e4405f;color:#fff;border:none;border-radius:8px;">Entrar</button>
      <div id="loginStatus" style="color:#888;font-size:0.95rem;margin-top:1rem;"></div>
    </div>
  `);
  document.getElementById('loginBtn').onclick = function() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    if (!user || !pass) {
      document.getElementById('loginStatus').textContent = 'Preencha todos os campos para entrar no LoveSongs!';
      return;
    }
    // Apenas simulação
    document.getElementById('loginStatus').textContent = `Bem-vindo(a), ${user}! Que o amor toque sua playlist! ❤️`;
  };
}

// Função para exibir o modal de Doação (romântico)
function showDonateSheet() {
  createBottomSheet(`
    <div class="donate-sheet" style="text-align:center;">
      <h2 style="color:#e4405f;">Doe Amor 💝</h2>
      <div style="font-size:1.1rem;margin-bottom:1.2rem;">Ajude o LoveSongs a espalhar mais músicas e sentimentos!<br>Qualquer valor é um gesto de carinho. Obrigado! 💞</div>
      <div style="margin:1.5rem 0;">
        <button id="donatePixBtn" style="padding:0.7rem 1.5rem;font-size:1rem;background:#e4405f;color:#fff;border:none;border-radius:8px;margin-bottom:1rem;">Doar via Pix</button><br>
        <button id="donateCoffeeBtn" style="padding:0.7rem 1.5rem;font-size:1rem;background:#e4405f;color:#fff;border:none;border-radius:8px;">Me pague um café ☕</button>
      </div>
      <div id="donateStatus" style="color:#888;font-size:0.95rem;"></div>
    </div>
  `);
  document.getElementById('donatePixBtn').onclick = function() {
    document.getElementById('donateStatus').textContent = 'Chave Pix: seuemail@provedor.com (copiado!)';
    navigator.clipboard.writeText('seuemail@provedor.com');
  };
  document.getElementById('donateCoffeeBtn').onclick = function() {
    window.open('https://www.buymeacoffee.com/', '_blank');
  };
}
    document.querySelectorAll('.sheet-option[data-action="favorites"]').forEach(btn => {
      btn.onclick = () => {
        // Monta os cards dos favoritos
        let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
        let allVideos = [];
        playlists.forEach(pl => allVideos.push(...pl.videos.map(v => ({...v, playlist: pl}))));
        let favVideos = favs.map(id => allVideos.find(v => v.id === id)).filter(Boolean);
        let html = `<h2 class='fav-title'>Favoritos</h2>`;
        if (favVideos.length === 0) {
          html += `<div class='fav-empty'>Nenhum vídeo favoritado ainda.</div>`;
        } else {
          html += `<div class='fav-cards'>`;
          favVideos.forEach(video => {
            html += `
              <div class='fav-card' data-id='${video.id}'>
                <img src='/covers/artists/${video.artist.toLowerCase().replace(/\s/g, '-')}.webp' onerror="this.src='/covers/cover.svg'" alt='${video.artist}' />
                <div class='fav-info'>
                  <div class='fav-title-main'>${video.title}</div>
                  <div class='fav-artist'>${video.artist}</div>
                </div>
              </div>
            `;
          });
          html += `</div>`;
        }
        createBottomSheet(html);
        setTimeout(() => {
          document.querySelectorAll('.fav-card').forEach(card => {
            card.onclick = () => {
              const id = card.getAttribute('data-id');
              // Fecha o bottom-sheet corretamente usando closeSheet
              const sheet = document.querySelector('.modern-bottom-sheet');
              const overlay = document.querySelector('.sheet-overlay');
              if (sheet) closeSheet(sheet, overlay);
              // Busca o vídeo e playlist
              let v = allVideos.find(v => v.id === id);
              if (v) {
                currentPlaylist = v.playlist;
                currentIndex = currentPlaylist.videos.findIndex(vid => vid.id === id);
                loadVideo();
              }
            };
          });
        }, 100);
      };
    });
  }, 100);

// Função para exibir o modal "Sobre"
function showAboutSheet() {
  createBottomSheet(`
    <div class="about-sheet">
      <div class="about-header">
        <img src="/icons/icon-192.png" alt="Logo" class="about-logo" style="width:64px;height:64px;border-radius:16px;">
        <div>
          <div class="about-appname">LoveSongs Player</div>
          <div class="about-version">Versão 1.0</div>
        </div>
      </div>
      <div class="about-author">Desenvolvido por <span>Seu Nome</span></div>
      <div class="about-contact">
        <span class="material-icons-outlined">email</span>
        <a href="mailto:contato@email.com">contato@email.com</a>
      </div>
      <div class="about-socials">
        <a class="about-social whatsapp" href="#" title="WhatsApp"><span class="material-icons-outlined">whatsapp</span></a>
        <a class="about-social instagram" href="#" title="Instagram"><span class="material-icons-outlined">instagram</span></a>
        <a class="about-social facebook" href="#" title="Facebook"><span class="material-icons-outlined">facebook</span></a>
        <a class="about-social telegram" href="#" title="Telegram"><span class="material-icons-outlined">telegram</span></a>
      </div>
      <div class="about-desc" style="margin-top:1.5rem;">Este app foi criado para tocar suas músicas favoritas de forma simples e elegante.</div>
    </div>
  `);
}

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
