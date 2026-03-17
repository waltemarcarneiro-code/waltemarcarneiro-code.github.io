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
const playlistIcon = document.querySelector('.header-actions img[alt="playlists"]');
const playlistModal = document.getElementById('playlistModal');
const playlistOverlay = document.getElementById('playlistOverlay');
const playlistList = document.getElementById('playlistList');
const closePlaylistModalBtn = document.getElementById('closePlaylistModal');

// Estado da aplicação
let currentPlaylist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let playlistSelected = false;

// Função para fechar o modal de playlists
function closePlaylistModal() {
  playlistModal.classList.remove('active');
  playlistOverlay.classList.remove('active');
}

// Abrir modal ao clicar no ícone de playlist
playlistIcon.addEventListener('click', () => {
  fetch('playlists.json')
    .then(response => response.json())
    .then(data => {
      playlistList.innerHTML = '';
      
      data.playlists.forEach(playlist => {
        const playlistItem = document.createElement('div');
        playlistItem.classList.add('modal-item');
        playlistItem.textContent = playlist.name;
        
        playlistItem.addEventListener('click', () => {
          currentPlaylist = playlist.videos;
          currentIndex = 0;
          playlistSelected = true;
          showFeedback(`Playlist "${playlist.name}" carregada`, 'success', 2000);
          loadVideo(currentIndex);
          closePlaylistModal();
        });
        
        playlistList.appendChild(playlistItem);
      });
      
      playlistModal.classList.add('active');
      playlistOverlay.classList.add('active');
    });
});

// Fechar modal
closePlaylistModalBtn.addEventListener('click', closePlaylistModal);
playlistOverlay.addEventListener('click', closePlaylistModal);

// Carregar vídeo
function loadVideo(index) {
  if (!playlistSelected) {
    showFeedback('Selecione uma playlist primeiro', 'warning');
    return;
  }

  const video = currentPlaylist[index];
  videoData.querySelector('h2').textContent = video.title;
  videoData.querySelector('p').textContent = video.artist;

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