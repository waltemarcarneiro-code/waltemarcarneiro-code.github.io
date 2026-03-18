const modal = document.getElementById('modal');
const open = document.getElementById('openModal');
const close = document.getElementById('closeModal');
const theme = document.getElementById('toggleTheme');

open.onclick = () => modal.classList.add('active');
close.onclick = () => modal.classList.remove('active');

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('active');
  }
});

/* TEMA */
theme.onclick = () => {
  document.body.classList.toggle('dark');
  updateStatusBar();
};

function updateStatusBar() {
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  
  if (document.body.classList.contains('dark')) {
    themeColor.content = '#0d0d0d';
    statusBar.content = 'black';
  } else {
    themeColor.content = '#ffffff';
    statusBar.content = 'light';
  }
};

// YouTube Iframe API
let player;
function onYouTubeIframeAPIReady() {
  // API está pronta
}

const script = document.createElement('script');
script.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(script);

// Elementos do DOM
const videoData = document.querySelector('.section-info .media-info');
const primarySection = document.querySelector('.section--primary .content');
const progressBar = document.querySelector('.progress input');
const controls = document.querySelector('.section-controls .controls');
const shuffleButton = controls.children[0];
const prevButton = controls.children[1];
const playButton = controls.children[2];
const nextButton = controls.children[3];
const repeatButton = controls.children[4];

// Modal de Playlists
const playlistIcon = document.getElementById('playlistIcon');
const playlistModal = document.getElementById('playlistModal');
const playlistOverlay = document.getElementById('playlistOverlay');
const playlistList = document.getElementById('playlistList');
const closePlaylistModalBtn = document.getElementById('closePlaylistModal');

// Modal de Favoritos
const favoritesIcon = document.getElementById('favoriteIcon');
const favoritesModal = document.getElementById('favoritesModal');
const favoritesOverlay = document.getElementById('favoritesOverlay');
const favoritesList = document.getElementById('favoritesList');
const closeFavoritesModalBtn = document.getElementById('closeFavoritesModal');

// Modal de Busca
const searchIcon = document.getElementById('searchIcon');
const searchModal = document.getElementById('searchModal');
const searchOverlay = document.getElementById('searchOverlay');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

// Estado da aplicação
let currentPlaylist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let playlistSelected = false;
let allPlaylists = [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Carregar playlists ao iniciar
fetch('playlists.json')
  .then(response => response.json())
  .then(data => {
    allPlaylists = data.playlists;
  });

// Função para fechar modais
function closePlaylistModal() {
  playlistModal.classList.remove('active');
  playlistOverlay.classList.remove('active');
}

function closeFavoritesModal() {
  favoritesModal.classList.remove('active');
  favoritesOverlay.classList.remove('active');
}

function closeSearchModal() {
  searchModal.classList.remove('active');
  searchOverlay.classList.remove('active');
  searchInput.value = '';
  searchResults.innerHTML = '';
}

// Abrir modal ao clicar no ícone de playlist
playlistIcon.addEventListener('click', () => {
  fetch('playlists.json')
    .then(response => response.json())
    .then(data => {
      allPlaylists = data.playlists;
      playlistList.innerHTML = '';
      
      data.playlists.forEach(playlist => {
        const card = document.createElement('div');
        card.classList.add('playlist-card');
        card.innerHTML = `
          <img src="covers/playlists/${playlist.cover}" alt="${playlist.name}">
          <div class="playlist-card-title">${playlist.name}</div>
        `;
        
        card.addEventListener('click', () => {
          currentPlaylist = playlist.videos;
          currentIndex = 0;
          playlistSelected = true;
          showFeedback(`Playlist "${playlist.name}" carregada`, 'success', 2000);
          loadVideo(currentIndex);
          closePlaylistModal();
        });
        
        playlistList.appendChild(card);
      });
      
      playlistModal.classList.add('active');
      playlistOverlay.classList.add('active');
    });
});

// Favoritar/Desfavoritar ao clicar no ícone do coração
favoritesIcon.addEventListener('click', () => {
  if (!playlistSelected) {
    showFeedback('Selecione uma playlist primeiro', 'warning');
    return;
  }
  
  const currentVideo = currentPlaylist[currentIndex];
  if (isFavorited(currentVideo.id)) {
    removeFavorite(currentVideo.id);
  } else {
    addFavorite(currentVideo);
  }
});

// Abrir modal de busca
searchIcon.addEventListener('click', () => {
  searchModal.classList.add('active');
  searchOverlay.classList.add('active');
  searchInput.focus();
});

// Event listener para busca em tempo real
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  searchResults.innerHTML = '';
  
  if (query.length < 2) {
    return;
  }
  
  const results = [];
  allPlaylists.forEach(playlist => {
    playlist.videos.forEach(video => {
      if (video.title.toLowerCase().includes(query) || 
          video.artist.toLowerCase().includes(query)) {
        results.push(video);
      }
    });
  });
  
  if (results.length === 0) {
    const noResults = document.createElement('div');
    noResults.style.padding = '2rem';
    noResults.style.textAlign = 'center';
    noResults.style.color = 'var(--text)';
    noResults.textContent = 'Nenhum vídeo encontrado';
    searchResults.appendChild(noResults);
  } else {
    results.forEach(video => {
      createVideoCard(video, searchResults);
    });
  }
});

// Criar card de vídeo
function createVideoCard(video, container) {
  const card = document.createElement('div');
  card.classList.add('video-card');
  
  // Validar que o vídeo tem as propriedades necessárias
  if (!video.artist) {
    console.warn('Video missing artist property:', video);
    return;
  }
  
  const artistSlug = video.artist.toLowerCase().replace(/\s+/g, '-');
  const coverPath = `covers/artists/${artistSlug}.jpg`;
  
  card.innerHTML = `
    <img src="${coverPath}" alt="${video.title}" class="video-card-img">
    <div class="video-card-info">
      <div class="video-card-title">${video.title}</div>
      <div class="video-card-artist">${video.artist}</div>
    </div>
  `;
  
  card.addEventListener('click', () => {
    // Procurar o vídeo em todas as playlists
    for (let playlist of allPlaylists) {
      const videoIndex = playlist.videos.findIndex(v => v.id === video.id);
      if (videoIndex !== -1) {
        currentPlaylist = playlist.videos;
        currentIndex = videoIndex;
        playlistSelected = true;
        loadVideo(currentIndex);
        closeSearchModal();
        closeFavoritesModal();
        return;
      }
    }
    // Se não encontrou o vídeo em nenhuma playlist, mostrar erro
    showFeedback('Vídeo não encontrado na playlist', 'error', 2000);
  });
  
  container.appendChild(card);
}

// Fechar modais
closePlaylistModalBtn.addEventListener('click', closePlaylistModal);
playlistOverlay.addEventListener('click', closePlaylistModal);

closeFavoritesModalBtn.addEventListener('click', closeFavoritesModal);
favoritesOverlay.addEventListener('click', closeFavoritesModal);

searchOverlay.addEventListener('click', closeSearchModal);

// Abrir Meus Favoritos pelo menu
const showFavoritesMenu = document.getElementById('showFavoritesMenu');

// Verificar se os elementos estão sendo encontrados
console.log('favoriteIcon:', favoritesIcon);
console.log('favoritesModal:', favoritesModal);
console.log('favoritesOverlay:', favoritesOverlay);
console.log('favoritesList:', favoritesList);
console.log('showFavoritesMenu:', showFavoritesMenu);
if (showFavoritesMenu) {
  console.log('Adding click listener to showFavoritesMenu');
  showFavoritesMenu.addEventListener('click', () => {
    console.log('showFavoritesMenu clicked');
    modal.classList.remove('active');
    showFavoritesModal();
  });
} else {
  console.log('showFavoritesMenu not found!');
}

function showFavoritesModal() {
  console.log('showFavoritesModal called');
  
  // Recarregar favoritos do localStorage
  favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  console.log('Favorites:', favorites);
  
  // Limpar container
  favoritesList.innerHTML = '';
  
  // Verificar se há favoritos
  if (favorites.length === 0) {
    console.log('No favorites, showing empty message');
    // Mostrar mensagem de vazio
    const emptyMsg = document.createElement('div');
    emptyMsg.style.padding = '2rem';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = 'var(--text)';
    emptyMsg.textContent = 'Nenhum vídeo favoritado ainda';
    favoritesList.appendChild(emptyMsg);
  } else {
    console.log('Creating cards for', favorites.length, 'videos');
    // Criar cards para cada vídeo favorito
    favorites.forEach((video, index) => {
      console.log(`Video ${index}:`, video);
      console.log(`  - id: ${video.id}`);
      console.log(`  - title: ${video.title}`);
      console.log(`  - artist: ${video.artist}`);
      createVideoCard(video, favoritesList);
    });
  }
  
  console.log('Adding active class to favoritesModal and favoritesOverlay');
  // Abrir modal
  favoritesModal.classList.add('active');
  favoritesOverlay.classList.add('active');
  console.log('Modal classes:', favoritesModal.className, favoritesOverlay.className);
}

// Funções de Favoritos
function addFavorite(video) {
  if (!favorites.find(v => v.id === video.id)) {
    favorites.push(video);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoriteIcon();
    showFeedback(`"${video.title}" adicionado aos favoritos`, 'success', 2000);
  } else {
    showFeedback(`"${video.title}" já está nos favoritos`, 'info', 2000);
  }
}

function removeFavorite(videoId) {
  favorites = favorites.filter(v => v.id !== videoId);
  localStorage.setItem('favorites', JSON.stringify(favorites));
  updateFavoriteIcon();
  showFeedback('Removido dos favoritos', 'success', 2000);
}

function isFavorited(videoId) {
  return favorites.some(v => v.id === videoId);
}

function updateFavoriteIcon() {
  if (!playlistSelected) {
    favoritesIcon.classList.remove('favorited');
    return;
  }
  
  const currentVideo = currentPlaylist[currentIndex];
  if (isFavorited(currentVideo.id)) {
    favoritesIcon.classList.add('favorited');
  } else {
    favoritesIcon.classList.remove('favorited');
  }
}

// Carregar vídeo
function loadVideo(index) {
  if (!playlistSelected) {
    showFeedback('Selecione uma playlist primeiro', 'warning');
    return;
  }

  const video = currentPlaylist[index];
  videoData.querySelector('h2').textContent = video.title;
  videoData.querySelector('p').textContent = video.artist;

  // Resetar estado do play
  isPlaying = false;
  playButton.querySelector('img').src = 'icons/play.svg';
  progressBar.value = 0;

  primarySection.innerHTML = '';
  
  const playerDiv = document.createElement('div');
  playerDiv.id = 'youtube-player';
  playerDiv.style.width = '100%';
  playerDiv.style.height = '100%';
  primarySection.appendChild(playerDiv);

  player = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: video.id,
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
  
  // Atualizar ícone de favorito
  updateFavoriteIcon();
}

function onPlayerReady(event) {
  // Atualizar barra de progresso
  updateProgressInterval = setInterval(() => {
    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
      const duration = player.getDuration();
      const currentTime = player.getCurrentTime();
      if (duration > 0) {
        progressBar.value = (currentTime / duration) * 100;
      }
    }
  }, 100);
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    playButton.querySelector('img').src = 'icons/pause.svg';
  } else if (event.data === YT.PlayerState.PAUSED) {
    isPlaying = false;
    playButton.querySelector('img').src = 'icons/play.svg';
  } else if (event.data === YT.PlayerState.ENDED) {
    if (isRepeat) {
      player.playVideo();
    } else {
      nextVideo();
    }
  }
}

let updateProgressInterval;

// Controles
function togglePlay() {
  if (!playlistSelected) {
    showFeedback('Selecione uma playlist primeiro', 'warning');
    return;
  }

  if (isPlaying) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function nextVideo() {
  if (!playlistSelected) {
    showFeedback('Selecione uma playlist primeiro', 'warning');
    return;
  }

  currentIndex = isShuffle 
    ? Math.floor(Math.random() * currentPlaylist.length) 
    : (currentIndex + 1) % currentPlaylist.length;
  loadVideo(currentIndex);
}

function prevVideo() {
  if (!playlistSelected) {
    showFeedback('Selecione uma playlist primeiro', 'warning');
    return;
  }

  currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
  loadVideo(currentIndex);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleButton.src = isShuffle ? 'icons/shuffle_on.svg' : 'icons/shuffle.svg';
  showFeedback(isShuffle ? 'Modo aleatório ativado' : 'Modo aleatório desativado', 'success', 2000);
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  repeatButton.src = isRepeat ? 'icons/repeat_one.svg' : 'icons/repeat.svg';
  showFeedback(isRepeat ? 'Repetição ativada' : 'Repetição desativada', 'success', 2000);
}

// Eventos dos botões
playButton.addEventListener('click', togglePlay);
nextButton.addEventListener('click', nextVideo);
prevButton.addEventListener('click', prevVideo);
shuffleButton.addEventListener('click', toggleShuffle);
repeatButton.addEventListener('click', toggleRepeat);

// Controlar progresso
progressBar.addEventListener('input', (e) => {
  if (player && playlistSelected) {
    const duration = player.getDuration();
    const newTime = (e.target.value / 100) * duration;
    player.seekTo(newTime);
  }
});

// Feedback Modal
const feedbackModal = document.getElementById('feedbackModal');
const feedbackIcon = document.getElementById('feedbackIcon');
const feedbackMessage = document.getElementById('feedbackMessage');
let feedbackTimeout;

function showFeedback(message, type = 'success', duration = 3000) {
  feedbackMessage.textContent = message;
  
  // Definir ícone baseado no tipo
  const iconMap = {
    'success': 'icons/play.svg',
    'error': 'icons/close.svg',
    'warning': 'icons/repeat.svg',
    'info': 'icons/playlist.svg'
  };
  
  feedbackIcon.src = iconMap[type] || iconMap['info'];
  feedbackIcon.alt = type;
  
  // Adicionar classe ativa
  feedbackModal.classList.add('active');
  
  // Limpar timeout anterior se existir
  if (feedbackTimeout) {
    clearTimeout(feedbackTimeout);
  }
  
  // Auto-fechar após duração
  feedbackTimeout = setTimeout(() => {
    feedbackModal.classList.remove('active');
  }, duration);
}

function hideFeedback() {
  feedbackModal.classList.remove('active');
  if (feedbackTimeout) {
    clearTimeout(feedbackTimeout);
  }
}