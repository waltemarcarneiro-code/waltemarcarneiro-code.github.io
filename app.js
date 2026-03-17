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
};

// Funções de controle de vídeo
const videoData = document.querySelector('.section-info .media-info');
const progressBar = document.querySelector('.progress input');
const controls = document.querySelector('.section-controls .controls');
const shuffleButton = controls.children[0];
const prevButton = controls.children[1];
const playButton = controls.children[2];
const nextButton = controls.children[3];
const repeatButton = controls.children[4];

let currentPlaylist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;

// Carregar playlist
fetch('playlists.json')
  .then(response => response.json())
  .then(data => {
    currentPlaylist = data.playlists[0].videos;
    loadVideo(currentIndex);
  });

function loadVideo(index) {
  const video = currentPlaylist[index];
  videoData.querySelector('h2').textContent = video.title;
  videoData.querySelector('p').textContent = video.artist;

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.src = `https://www.youtube.com/embed/${video.id}`;
  iframe.frameBorder = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;

  primarySection.innerHTML = ''; // Limpa o conteúdo anterior
  primarySection.style.display = 'block';
  primarySection.style.width = '100%';
  primarySection.style.height = '100vh';
  primarySection.style.margin = '0';
  primarySection.style.padding = '0';
  primarySection.appendChild(iframe);
}

function togglePlay() {
  isPlaying = !isPlaying;
  playButton.querySelector('img').src = isPlaying ? 'icons/pause.svg' : 'icons/play.svg';
}

function nextVideo() {
  currentIndex = isShuffle ? Math.floor(Math.random() * currentPlaylist.length) : (currentIndex + 1) % currentPlaylist.length;
  loadVideo(currentIndex);
}

function prevVideo() {
  currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
  loadVideo(currentIndex);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleButton.src = isShuffle ? 'icons/shuffle_on.svg' : 'icons/shuffle.svg';
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  repeatButton.src = isRepeat ? 'icons/repeat_one.svg' : 'icons/repeat.svg';
}

function updateProgressBar() {
  progressBar.value = Math.random() * 100; // Simulação
}

// Eventos
playButton.addEventListener('click', togglePlay);
nextButton.addEventListener('click', nextVideo);
prevButton.addEventListener('click', prevVideo);
shuffleButton.addEventListener('click', toggleShuffle);
repeatButton.addEventListener('click', toggleRepeat);
progressBar.addEventListener('input', updateProgressBar);

// Elementos do Modal Bottom de Playlists
const playlistIcon = document.querySelector('.header-actions img[alt="playlists"]');
const playlistModal = document.getElementById('playlistModal');
const playlistOverlay = document.getElementById('playlistOverlay');
const playlistList = document.getElementById('playlistList');
const closePlaylistModalBtn = document.getElementById('closePlaylistModal');
const primarySection = document.querySelector('.section--primary .content');

// Função para fechar o modal
function closePlaylistModal() {
  playlistModal.style.display = 'none';
  playlistOverlay.style.display = 'none';
}

// Abrir modal ao clicar no ícone de playlist
playlistIcon.addEventListener('click', () => {
  fetch('playlists.json')
    .then(response => response.json())
    .then(data => {
      playlistList.innerHTML = '';
      
      data.playlists.forEach(playlist => {
        const playlistItem = document.createElement('div');
        playlistItem.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.2s;';
        playlistItem.textContent = playlist.name;
        
        playlistItem.addEventListener('mouseenter', () => {
          playlistItem.style.background = '#f5f5f5';
        });
        
        playlistItem.addEventListener('mouseleave', () => {
          playlistItem.style.background = 'transparent';
        });
        
        playlistItem.addEventListener('click', () => {
          currentPlaylist = playlist.videos;
          currentIndex = 0;
          loadVideo(currentIndex);
          closePlaylistModal();
        });
        
        playlistList.appendChild(playlistItem);
      });
      
      playlistModal.style.display = 'block';
      playlistOverlay.style.display = 'block';
    });
});

// Fechar modal ao clicar no botão X
closePlaylistModalBtn.addEventListener('click', closePlaylistModal);

// Fechar modal ao clicar no overlay
playlistOverlay.addEventListener('click', closePlaylistModal);