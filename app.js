// ============================================================================
// ESTADO GLOBAL
// ============================================================================

const player = {
    playlistsData: [],
    currentPlaylist: null,
    currentPlaylistIndex: null,
    currentVideoIndex: 0,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 0, // 0: no repeat, 1: repeat all, 2: repeat one
    favorites: [],
    currentDuration: 0,
    currentTime: 0,
    playOrder: [],
    originalOrder: [],
    ytReady: false,
};

let ytPlayer = null;


// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar barra de progresso vazia
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = '0%';
    }

    loadPlaylists();
    setupEventListeners();
    loadFavorites();
    setupMobileSearch();
    setupSidbarMobile();
});

// ============================================================================
// CARREGAR DADOS
// ============================================================================

async function loadPlaylists() {
    try {
        const response = await fetch('playlists.json');
        const data = await response.json();
        player.playlistsData = data.playlists;
        if (player.playlistsData.length > 0) {
            selectPlaylist(0);
        }
    } catch (error) {
        console.error('Erro ao carregar playlists:', error);
    }
}

// ============================================================================
// MODAL DE PLAYLISTS
// ============================================================================

function openPlaylistsModal() {
    const modal = document.getElementById('playlistModal');
    const container = document.getElementById('playlistCardsContainer');
    
    container.innerHTML = '';
    
    player.playlistsData.forEach((playlist, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="covers/playlists/${playlist.cover}" alt="${playlist.name}" class="card-image" onerror="this.src='cover/cover.jpg'">
            <div class="card-body">
                <div class="card-title">${playlist.name}</div>
                <div class="card-subtitle">${playlist.videos.length} músicas</div>
            </div>
        `;
        card.addEventListener('click', () => selectPlaylist(index));
        container.appendChild(card);
    });
    
    modal.classList.add('show');
}

function closePlaylistsModal() {
    document.getElementById('playlistModal').classList.remove('show');
}

function selectPlaylist(index) {
    player.currentPlaylist = player.playlistsData[index];
    player.currentPlaylistIndex = index;
    player.currentVideoIndex = 0;
    player.playOrder = [...Array(player.currentPlaylist.videos.length).keys()];
    player.originalOrder = [...player.playOrder];
    
    closePlaylistsModal();
    loadPlaylistVideos();
    loadFirstVideo();
}

// ============================================================================
// CARREGAR VÍDEOS DA PLAYLIST
// ============================================================================

function loadPlaylistVideos() {
    const container = document.querySelector('.playlist-aside');
    const itemsContainer = document.querySelector('.playlist-items');
    
    // Atualizar título
    const titlePl = container.querySelector('.title-pl');
    titlePl.textContent = `Playlist > ${player.currentPlaylist.name}`;
    
    // Limpar itens
    itemsContainer.innerHTML = '';
    
    player.currentPlaylist.videos.forEach((video, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.innerHTML = `
            <img src="covers/artists/${video.artist.toLowerCase().replace(/\s+/g, '-')}.jpg" 
                 alt="${video.artist}" 
                 class="thumb-mini"
                 onerror="this.src='cover/cover.jpg'">
            <div class="playlist-info">
                <span class="m-title">${video.title}</span>
                <span class="m-artist">${video.artist}</span>
            </div>
            <span class="m-duration" id="duration-${index}">0:00</span>
        `;
        item.addEventListener('click', () => playVideoByIndex(index));
        itemsContainer.appendChild(item);
    });
}

function loadFirstVideo() {
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    loadVideo(video);
    updateCurrentVideoDisplay();
}

// ============================================================================
// CARREGAR VÍDEO E ATUALIZAR INTERFACE
// ============================================================================

function loadVideo(video) {
    if (player.ytReady && ytPlayer) {
        ytPlayer.loadVideoById(video.id);
    } else {
        const iframeWrapper = document.querySelector('.video-wrapper');
        iframeWrapper.innerHTML = `
            <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/${video.id}?enablejsapi=1" 
                title="${video.title}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen 
                style="border-radius: 0rem;">
            </iframe>
        `;
    }

    updateCurrentVideoDisplay();
    updateFavoriteButton();
}

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: (player.currentPlaylist && player.currentPlaylist.videos?.[player.currentVideoIndex]?.id) || 'GP9IB2ji02s',
        playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
        }
    });
}

function onPlayerReady(event) {
    player.ytReady = true;
    if (player.currentPlaylist) {
        const video = player.currentPlaylist.videos[player.currentVideoIndex];
        if (video) {
            event.target.loadVideoById(video.id);
            updateCurrentVideoDisplay();
            updateFavoriteButton();
        }
    }
}

function onPlayerStateChange(event) {
    const state = event.data;
    // YT.State: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (state === YT.PlayerState.PLAYING) {
        player.isPlaying = true;
        player.currentDuration = ytPlayer.getDuration();
        updatePlayPauseButton();
    } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
        player.isPlaying = false;
        updatePlayPauseButton();
    }

    if (state === YT.PlayerState.ENDED) {
        if (player.repeatMode === 2) {
            ytPlayer.seekTo(0);
            ytPlayer.playVideo();
        } else {
            nextVideo();
        }
    }
}

function playerPlay() {
    if (player.ytReady && ytPlayer) {
        ytPlayer.playVideo();
    }
    player.isPlaying = true;
    updatePlayPauseButton();
}

function playerPause() {
    if (player.ytReady && ytPlayer) {
        ytPlayer.pauseVideo();
    }
    player.isPlaying = false;
    updatePlayPauseButton();
}


function updateCurrentVideoDisplay() {
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    const blockInfo = document.querySelector('.block-info');
    
    blockInfo.innerHTML = `
        <img src="covers/artists/${video.artist.toLowerCase().replace(/\s+/g, '-')}.jpg" 
             alt="${video.artist}" 
             class="current-thumb"
             onerror="this.src='cover/cover.jpg'">
        <div class="current-details">
            <span class="c-title">${video.title}</span>
            <span class="c-artist">${video.artist}</span>
        </div>
        <div class="current-actions">
            <button id="favButton" aria-label="Adicionar aos favoritos">
                <i class="material-icons" id="favIcon">favorite_border</i>
            </button>
            <button id="shareButton" aria-label="Compartilhar">
                <i class="material-icons reply">reply</i>
            </button>
        </div>
    `;
    
    document.getElementById('favButton').addEventListener('click', toggleFavorite);
    document.getElementById('shareButton').addEventListener('click', shareMusic);
}

// ============================================================================
// CONTROLES DO PLAYER
// ============================================================================

function playVideoByIndex(index) {
    player.currentVideoIndex = index;
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    loadVideo(video);
    player.isPlaying = true;
    updatePlayPauseButton();
}

function togglePlayPause() {
    if (player.isPlaying) {
        playerPause();
    } else {
        playerPlay();
    }
}

function nextVideo() {
    if (!player.currentPlaylist) return;
    
    if (player.isShuffle) {
        const randomIndex = Math.floor(Math.random() * player.currentPlaylist.videos.length);
        player.currentVideoIndex = randomIndex;
    } else {
        player.currentVideoIndex = (player.currentVideoIndex + 1) % player.currentPlaylist.videos.length;
    }
    
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    loadVideo(video);
    playerPlay();
}

function previousVideo() {
    if (!player.currentPlaylist) return;
    
    player.currentVideoIndex = (player.currentVideoIndex - 1 + player.currentPlaylist.videos.length) % player.currentPlaylist.videos.length;
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    loadVideo(video);
    playerPlay();
}

function toggleShuffle() {
    player.isShuffle = !player.isShuffle;
    
    if (player.isShuffle) {
        player.playOrder = [...player.playOrder].sort(() => Math.random() - 0.5);
    } else {
        player.playOrder = [...player.originalOrder];
    }
    
    updateShuffleButton();
}

function toggleRepeat() {
    player.repeatMode = (player.repeatMode + 1) % 3;
    updateRepeatButton();
}

function updatePlayPauseButton() {
    const btn = document.querySelector('.btn-play-pause i');
    btn.textContent = player.isPlaying ? 'pause' : 'play_arrow';
}

function updateShuffleButton() {
    const btn = document.querySelector('.block-controls button:nth-child(1)');
    if (player.isShuffle) {
        btn.style.color = 'var(--accent-red)';
    } else {
        btn.style.color = 'inherit';
    }
}

function updateRepeatButton() {
    const btn = document.querySelector('.block-controls button:nth-child(5)');
    if (player.repeatMode === 0) {
        btn.style.color = 'inherit';
        btn.textContent = '';
        btn.innerHTML = '<i class="material-icons">repeat</i>';
    } else if (player.repeatMode === 1) {
        btn.style.color = 'var(--accent-red)';
        btn.textContent = '';
        btn.innerHTML = '<i class="material-icons">repeat</i>';
    } else {
        btn.style.color = 'var(--accent-red)';
        btn.textContent = '';
        btn.innerHTML = '<i class="material-icons">repeat_one</i>';
    }
}

// ============================================================================
// BARRA DE PROGRESSO
// ============================================================================

function updateProgressBar() {
    const duration = player.currentDuration || 0;
    const current = player.currentTime || 0;

    const percentage = duration > 0 ? (current / duration) * 100 : 0;
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }

    const timeCurrentEl = document.getElementById('timeCurrent');
    const timeDurationEl = document.getElementById('timeDuration');
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(current);
    if (timeDurationEl) timeDurationEl.textContent = formatTime(duration);

    if (duration === 0) {
        // evita bloquear atualização do componente quando o player ainda não retornou duração
        return;
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekProgress(e) {
    const track = document.querySelector('.progress-track');
    const rect = track.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const seekTime = percentage * player.currentDuration;

    player.currentTime = seekTime;
    if (player.ytReady && ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(seekTime, true);
    }
    updateProgressBar();
}

// ============================================================================
// FAVORITOS
// ============================================================================

function toggleFavorite() {
    if (!player.currentPlaylist) return;
    
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    const favoriteId = `${player.currentPlaylistIndex}-${player.currentVideoIndex}`;
    
    const index = player.favorites.findIndex(fav => fav.id === favoriteId);
    
    if (index > -1) {
        player.favorites.splice(index, 1);
    } else {
        player.favorites.push({
            id: favoriteId,
            video: video,
            playlist: player.currentPlaylist.name,
        });
    }
    
    saveFavorites();
    updateFavoriteButton();
}

function updateFavoriteButton() {
    const video = player.currentPlaylist?.videos[player.currentVideoIndex];
    if (!video) return;
    
    const favoriteId = `${player.currentPlaylistIndex}-${player.currentVideoIndex}`;
    const isFavorite = player.favorites.some(fav => fav.id === favoriteId);
    
    const icon = document.getElementById('favIcon');
    icon.textContent = isFavorite ? 'favorite' : 'favorite_border';
}

function saveFavorites() {
    localStorage.setItem('sanplayerFavorites', JSON.stringify(player.favorites));
}

function loadFavorites() {
    const saved = localStorage.getItem('sanplayerFavorites');
    if (saved) {
        player.favorites = JSON.parse(saved);
    }
}

// ============================================================================
// COMPARTILHAR
// ============================================================================

function shareMusic() {
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    const text = `Escutando: ${video.title} - ${video.artist} no SanPlayer`;
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'SanPlayer',
            text: text,
            url: url,
        });
    } else {
        // Fallback: copiar para clipboard
        const shareText = `${text}\n${url}`;
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Música copiada para compartilhamento!');
        });
    }
}

// ============================================================================
// BUSCA
// ============================================================================

function setupMobileSearch() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length === 0) {
            document.getElementById('searchModal').classList.remove('show');
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchMusics(query);
        }, 300);
    });
}

function searchMusics(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    player.playlistsData.forEach((playlist, playlistIndex) => {
        playlist.videos.forEach((video, videoIndex) => {
            if (
                video.title.toLowerCase().includes(lowerQuery) ||
                video.artist.toLowerCase().includes(lowerQuery)
            ) {
                results.push({
                    video: video,
                    playlistIndex: playlistIndex,
                    videoIndex: videoIndex,
                });
            }
        });
    });
    
    displaySearchResults(results, query);
}

function displaySearchResults(results, query) {
    const container = document.getElementById('searchResultsContainer');
    const modal = document.getElementById('searchModal');
    
    document.getElementById('searchTitle').textContent = `Resultados para "${query}"`;
    
    if (results.length === 0) {
        container.innerHTML = '<div class="no-results">Nenhuma música encontrada</div>';
    } else {
        container.innerHTML = '';
        results.forEach((result) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="covers/artists/${result.video.artist.toLowerCase().replace(/\s+/g, '-')}.jpg" 
                     alt="${result.video.artist}" 
                     class="card-image"
                     onerror="this.src='cover/cover.jpg'">
                <div class="card-body">
                    <div class="card-title">${result.video.title}</div>
                    <div class="card-subtitle">${result.video.artist}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                selectPlaylist(result.playlistIndex);
                player.currentVideoIndex = result.videoIndex;
                const video = player.currentPlaylist.videos[player.currentVideoIndex];
                loadVideo(video);
                player.isPlaying = true;
                updatePlayPauseButton();
                modal.classList.remove('show');
            });
            container.appendChild(card);
        });
    }
    
    modal.classList.add('show');
}

// ============================================================================
// SIDEBAR MOBILE
// ============================================================================

function setupSidbarMobile() {
    const btnSearchMobile = document.querySelector('.btn-search-mobile');
    const headerSearch = document.querySelector('.header-search');
    const searchForm = headerSearch.querySelector('form');
    
    btnSearchMobile.addEventListener('click', () => {
        headerSearch.classList.add('show-search');
        searchForm.querySelector('input').focus();
    });
    
    searchForm.querySelector('input').addEventListener('blur', (e) => {
        if (window.innerWidth <= 1023) {
            headerSearch.classList.remove('show-search');
        }
    });

    // Sidebar Mobile
    const btnHamburger = document.querySelector('.btn-hamburger');
    const sidebar = document.querySelector('.app-sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    function isMobile() { return window.innerWidth <= 1023; }
    
    btnHamburger.addEventListener('click', function() {
        if (isMobile()) {
            sidebar.classList.add('show');
        }
    });
    
    sidebarOverlay.addEventListener('click', function() {
        if (isMobile()) {
            sidebar.classList.remove('show');
        }
    });
    
    sidebar.querySelectorAll('.sidebar-nav a').forEach(function(link) {
        link.addEventListener('click', function() {
            if (isMobile()) {
                sidebar.classList.remove('show');
            }
        });
    });
    
    document.addEventListener('mousedown', function(e) {
        if (isMobile() && sidebar.classList.contains('show')) {
            const sidebarContent = sidebar.querySelector('.sidebar-content');
            if (!sidebarContent.contains(e.target) && !btnHamburger.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
    
    window.addEventListener('resize', function() {
        if (!isMobile()) {
            sidebar.classList.remove('show');
        }
    });
}

// ============================================================================
// EVENT LISTENERS PRINCIPAIS
// ============================================================================

function setupEventListeners() {
    // Modal de playlists
    document.getElementById('link-playlists').addEventListener('click', (e) => {
        e.preventDefault();
        openPlaylistsModal();
    });
    
    document.getElementById('closePlaylistModal').addEventListener('click', closePlaylistsModal);
    
    document.getElementById('playlistModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closePlaylistsModal();
        }
    });
    
    // Modal de busca
    document.getElementById('closeSearchModal').addEventListener('click', () => {
        document.getElementById('searchModal').classList.remove('show');
    });
    
    document.getElementById('searchModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('searchModal').classList.remove('show');
        }
    });
    
    // Controles do player
    const controls = document.querySelector('.block-controls');
    const btnShuffle = controls.children[0];
    const btnPrevious = controls.children[1];
    const btnPlayPause = controls.children[2];
    const btnNext = controls.children[3];
    const btnRepeat = controls.children[4];
    
    btnShuffle.addEventListener('click', toggleShuffle);
    btnPrevious.addEventListener('click', previousVideo);
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnNext.addEventListener('click', nextVideo);
    btnRepeat.addEventListener('click', toggleRepeat);
    
    // Barra de progresso
    document.querySelector('.progress-track').addEventListener('click', seekProgress);
    
    // Atualizar progresso com YouTube IFrame API
    setInterval(() => {
        if (player.ytReady && ytPlayer && ytPlayer.getCurrentTime) {
            player.currentTime = ytPlayer.getCurrentTime();
            player.currentDuration = ytPlayer.getDuration() || 0;
            updateProgressBar();
        }
    }, 200);
}
