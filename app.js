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
    shouldPlayOnReady: false,
    viewingFavorites: false,
};

let ytPlayer = null;
let ytPlayerInitialized = false;
let updateProgressInterval = null;


// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadPlaylists();
    setupEventListeners();
    loadFavorites();
    setupMobileSearch();
    setupSidbarMobile();
    handleHashNavigation();
});

function handleHashNavigation() {
    const hash = window.location.hash;
    if (hash.includes('videoId=')) {
        const videoId = hash.split('videoId=')[1].split('&')[0];
        
        // Procura pelo videoId em todas as playlists
        player.playlistsData.forEach((playlist, playlistIndex) => {
            playlist.videos.forEach((video, videoIndex) => {
                if (video.id === videoId) {
                    player.currentPlaylist = playlist;
                    player.currentPlaylistIndex = playlistIndex;
                    player.currentVideoIndex = videoIndex;
                    player.viewingFavorites = false;
                    
                    loadPlaylistVideos();
                    loadVideo(video);
                    player.shouldPlayOnReady = true;
                    refreshPlayerUI();
                }
            });
        });
    }
}

// Listener para alterações na URL
window.addEventListener('hashchange', handleHashNavigation);

// Garantir refresh ao focar na janela (reentrar no player)
window.addEventListener('focus', () => {
    if (player.currentPlaylist) {
        refreshPlayerUI();
    }
});

// Atualiza UI completa de player sem fazer novo fetch pesado
function refreshPlayerUI() {
    updateCurrentVideoDisplay();
    updatePlayPauseButton();
    updateProgressBar();
    updateFavoriteButton();
    updateActivePlaylistItem();
    loadPlaylistVideos();
    if (ytPlayer && player.ytReady) {
        player.currentTime = ytPlayer.getCurrentTime();
        player.currentDuration = ytPlayer.getDuration();
    }
}

// ============================================================================
// CARREGAR DADOS
// ============================================================================

async function loadPlaylists() {
    try {
        const response = await fetch('playlists.json');
        const data = await response.json();
        player.playlistsData = data.playlists;
        if (player.playlistsData.length > 0) {
            const hash = window.location.hash;
            if (hash.includes('videoId=')) {
                handleHashNavigation();
            } else {
                selectPlaylist(0);
            }
            refreshPlayerUI();
        }
    } catch (error) {
        console.error('Erro ao carregar playlists:', error);
    }
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function getArtistCoverUrl(artistName) {
    // Preserva & e hífens para compatibilidade com arquivos já existentes
    const normalized = artistName.toLowerCase().trim().replace(/\s+/g, '-');
    return `covers/artists/${normalized}.jpg`;
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

// ============================================================================
// MODAL DE ARTISTAS
// ============================================================================

function openArtistsModal() {
    const modal = document.getElementById('artistsModal');
    const container = document.getElementById('artistsCardsContainer');
    
    container.innerHTML = '';
    
    // Coletar artistas únicos
    const artistsSet = new Set();
    player.playlistsData.forEach(playlist => {
        playlist.videos.forEach(video => {
            if (video.artist) {
                artistsSet.add(video.artist);
            }
        });
    });
    
    const artists = Array.from(artistsSet).sort();

    artists.forEach(artist => {
        const artistCover = getArtistCoverUrl(artist);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${artistCover}" alt="${artist}" class="card-image" onerror="this.src='covers/artists/default.jpg'">
            <div class="card-body">
                <div class="card-title">${artist}</div>
                <div class="card-subtitle">Artista</div>
            </div>
        `;
        card.addEventListener('click', () => selectArtist(artist));
        container.appendChild(card);
    });
    
    modal.classList.add('show');
}

function closeArtistsModal() {
    document.getElementById('artistsModal').classList.remove('show');
}

function selectArtist(artist) {
    // Filtrar vídeos do artista
    const artistVideos = [];
    player.playlistsData.forEach(playlist => {
        playlist.videos.forEach(video => {
            if (video.artist === artist) {
                artistVideos.push({
                    ...video,
                    playlistName: playlist.name
                });
            }
        });
    });
    
    // Criar uma playlist temporária para o artista
    player.currentPlaylist = {
        name: artist,
        videos: artistVideos
    };
    player.currentPlaylistIndex = -1; // Indica que é uma playlist temporária
    player.currentVideoIndex = 0;
    player.playOrder = [...Array(artistVideos.length).keys()];
    player.originalOrder = [...player.playOrder];
    player.shouldPlayOnReady = true;
    player.viewingFavorites = false;
    
    closeArtistsModal();
    loadPlaylistVideos();
    loadFirstVideo();
    refreshPlayerUI();
}

function selectPlaylist(index) {
    player.currentPlaylist = player.playlistsData[index];
    player.currentPlaylistIndex = index;
    player.currentVideoIndex = 0;
    player.playOrder = [...Array(player.currentPlaylist.videos.length).keys()];
    player.originalOrder = [...player.playOrder];
    player.shouldPlayOnReady = true;
    player.viewingFavorites = false;
    
    closePlaylistsModal();
    loadPlaylistVideos();
    loadFirstVideo();
    refreshPlayerUI();
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
    
    // Mostrar skeleton loading
    itemsContainer.innerHTML = '';
    for (let i = 0; i < player.currentPlaylist.videos.length; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'playlist-item skeleton-loading';
        skeleton.innerHTML = `
            <div class="thumb-mini skeleton"></div>
            <div class="playlist-info" style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
                <span class="skeleton" style="display: block; width: 70%; height: 1rem; border-radius: 4px;"></span>
                <span class="skeleton" style="display: block; width: 50%; height: 0.75rem; border-radius: 4px;"></span>
            </div>
            <span class="skeleton" style="display: block; width: 40px; height: 0.75rem; margin-left: auto; border-radius: 4px;"></span>
        `;
        itemsContainer.appendChild(skeleton);
    }
    
    // Carregar items reais depois de um pequeno delay
    setTimeout(() => {
        itemsContainer.innerHTML = '';
        player.currentPlaylist.videos.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.innerHTML = `
                <img src="${getArtistCoverUrl(video.artist)}" 
                     alt="${video.artist}" 
                     class="thumb-mini"
                     onerror="this.src='covers/artists/default.jpg'">
                <div class="playlist-info">
                    <span class="m-title">${video.title}</span>
                    <span class="m-artist">${video.artist}</span>
                </div>
                <span class="m-duration" id="duration-${index}">0:00</span>
            `;
            item.addEventListener('click', () => playVideoByIndex(index));
            itemsContainer.appendChild(item);
        });
    }, 300);
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
    // Forçar a presença do contêiner do player
    const iframeWrapper = document.querySelector('.video-wrapper');
    if (!iframeWrapper.querySelector('#player')) {
        iframeWrapper.innerHTML = '<div id="player" style="width:100%; height:100%;"></div>';
    }

    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
        ytPlayer.loadVideoById(video.id);
    } else if (window.YT && !ytPlayer && !ytPlayerInitialized) {
        onYouTubeIframeAPIReady();
    }

    updateCurrentVideoDisplay();
    updateFavoriteButton();
    
    // Ao escolher vídeo/playlist explicitamente, devemos tocar
    player.shouldPlayOnReady = true;
    if (player.ytReady && ytPlayer) {
        playerPlay();
    }
}

function onYouTubeIframeAPIReady() {
    if (ytPlayerInitialized) return;
    ytPlayerInitialized = true;

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

    if (player.currentPlaylist && player.currentPlaylist.videos.length > 0) {
        const video = player.currentPlaylist.videos[player.currentVideoIndex];
        if (video) {
            ytPlayer.loadVideoById(video.id);
            updateCurrentVideoDisplay();
            updateFavoriteButton();
            updatePlayPauseButton();
        }
    }

    if (player.shouldPlayOnReady && ytPlayer) {
        playerPlay();
        player.shouldPlayOnReady = false;
    }

    if (updateProgressInterval) {
        clearInterval(updateProgressInterval);
    }

    updateProgressInterval = setInterval(() => {
        if (!ytPlayer || !player.ytReady) return;

        const duration = ytPlayer.getDuration();
        const currentTime = ytPlayer.getCurrentTime();

        player.currentDuration = duration;
        player.currentTime = currentTime;

        updateProgressBar();
        updatePlaylistDurations();
    }, 250);
}

function updatePlaylistDurations() {
    if (!player.currentPlaylist) return;
    
    player.currentPlaylist.videos.forEach((video, index) => {
        const durationElement = document.getElementById(`duration-${index}`);
        if (durationElement && index === player.currentVideoIndex && player.ytReady && ytPlayer) {
            const duration = ytPlayer.getDuration();
            if (duration > 0) {
                durationElement.textContent = formatTime(duration);
            }
        }
    });
}

function onPlayerStateChange(event) {
    const state = event.data;

    // YT.State: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (state === YT.PlayerState.PLAYING) {
        player.isPlaying = true;
        player.currentDuration = ytPlayer.getDuration();
        player.currentTime = ytPlayer.getCurrentTime();
        updatePlayPauseButton();
        updateProgressBar();
        updateActivePlaylistItem();
    } else if (state === YT.PlayerState.PAUSED) {
        player.isPlaying = false;
        player.currentTime = ytPlayer.getCurrentTime();
        updatePlayPauseButton();
        updateProgressBar();
        updateActivePlaylistItem();
    } else if (state === YT.PlayerState.ENDED) {
        player.isPlaying = false;
        updatePlayPauseButton();
        updateProgressBar();

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
    updateProgressBar();
}

function playerPause() {
    if (player.ytReady && ytPlayer) {
        ytPlayer.pauseVideo();
    }
    player.isPlaying = false;
    updatePlayPauseButton();
    updateProgressBar();
}


function updateCurrentVideoDisplay() {
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    const blockInfo = document.querySelector('.block-info');
    
    blockInfo.innerHTML = `
        <img src="${getArtistCoverUrl(video.artist)}" 
             alt="${video.artist}" 
             class="current-thumb"
             onerror="this.src='covers/artists/default.jpg'">
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
    
    // Detectar se título precisa de marquee após renderização
    setTimeout(() => {
        const cTitle = document.querySelector('.current-details .c-title');
        checkIfTitleNeedsTruncation(cTitle);
    }, 0);
}

// ============================================================================
// CONTROLES DO PLAYER
// ============================================================================

function playVideoByIndex(index) {
    player.currentVideoIndex = index;
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    loadVideo(video);
    playerPlay();
    updateActivePlaylistItem();
}

function updateActivePlaylistItem() {
    const cTitle = document.querySelector('.current-details .c-title');
    if (!cTitle) return;

    // Detectar se o texto transborda
    checkIfTitleNeedsTruncation(cTitle);
}

function checkIfTitleNeedsTruncation(element) {
    if (!element) return;
    
    // Se não estiver tocando, remove marquee
    if (!player.isPlaying) {
        element.classList.remove('marquee');
        return;
    }

    // Força layout para calcular corretamente
    const scrollWidth = element.scrollWidth;
    const clientWidth = element.clientWidth;

    // Se o texto transborda, ativa marquee
    if (scrollWidth > clientWidth + 5) { // +5px de margem para evitar flutuações
        element.classList.add('marquee');
    } else {
        element.classList.remove('marquee');
    }
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
    updateActivePlaylistItem();
    // playerPlay() is chamado quando o estado muda via onPlayerReady ou loadVideoById
}

function previousVideo() {
    if (!player.currentPlaylist) return;
    
    player.currentVideoIndex = (player.currentVideoIndex - 1 + player.currentPlaylist.videos.length) % player.currentPlaylist.videos.length;
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    loadVideo(video);
    playerPlay();
    updateActivePlaylistItem();
}

function toggleShuffle() {
    player.isShuffle = !player.isShuffle;
    
    if (player.isShuffle) {
        player.playOrder = [...player.playOrder].sort(() => Math.random() - 0.5);
    } else {
        player.playOrder = [...player.originalOrder];
    }
}

function toggleRepeat() {
    player.repeatMode = (player.repeatMode + 1) % 3;
    updateRepeatButton();
}

function updatePlayPauseButton() {
    const btn = document.querySelector('.btn-play-pause i');
    btn.textContent = player.isPlaying ? 'pause' : 'play_arrow';
}

function updateRepeatButton() {
    const btn = document.querySelector('.block-controls button:nth-child(5)');
    if (player.repeatMode === 0) {
        btn.innerHTML = '<i class="material-icons">repeat</i>';
    } else if (player.repeatMode === 1) {
        btn.innerHTML = '<i class="material-icons">repeat</i>';
    } else {
        btn.innerHTML = `<i class="material-icons" style="position: relative;">repeat_one<span style="position: absolute; font-size: 0.7rem; font-weight: bold; bottom: -2px; right: -2px; background: var(--accent-red); color: white; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; line-height: 1;">1</span></i>`;
    }
}

// ============================================================================
// BARRA DE PROGRESSO
// ============================================================================

function updateProgressBar() {
    const duration = player.currentDuration || 0;
    const current = player.currentTime || 0;
    const percentage = duration > 0 ? (current / duration) * 100 : 0;
    const progressBar = document.getElementById('progressBar');

    if (progressBar) {
        progressBar.value = Math.min(100, Math.max(0, percentage));
        progressBar.style.backgroundSize = `${Math.min(100, Math.max(0, percentage))}% 100%`;

        // Mostrar preenchimento apenas enquanto a música estiver tocando
        if (player.isPlaying && duration > 0) {
            progressBar.classList.add('active');
        } else {
            progressBar.classList.remove('active');
        }
    }

    const timeCurrentEl = document.getElementById('timeCurrent');
    const timeDurationEl = document.getElementById('timeDuration');
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(current);
    if (timeDurationEl) timeDurationEl.textContent = formatTime(duration);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekProgress(e) {
    // O progresso agora é via range input (progressBar), então esta função pode ser mantida por compatibilidade,
    // mas aqui é apenas uma ponte para o handler do input
    const progressBar = document.getElementById('progressBar');
    if (!progressBar || player.currentDuration === 0) return;

    const rect = progressBar.getBoundingClientRect();
    let percentage = ((e.clientX - rect.left) / rect.width) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    progressBar.value = percentage;
    const seekTime = (player.currentDuration * percentage) / 100;
    player.currentTime = seekTime;

    if (player.ytReady && ytPlayer) {
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

function displayFavoritesList() {
    const container = document.querySelector('.playlist-aside');
    const itemsContainer = document.querySelector('.playlist-items');
    
    // Marcar que estamos visualizando favoritos
    player.viewingFavorites = true;
    
    // Atualizar título
    const titlePl = container.querySelector('.title-pl');
    titlePl.textContent = `Favoritos > ${player.favorites.length} músicas`;
    
    // Limpar itens
    itemsContainer.innerHTML = '';
    
    if (player.favorites.length === 0) {
        itemsContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">Nenhuma música favoritada</div>';
        return;
    }
    
    player.favorites.forEach((favorite) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.innerHTML = `
            <img src="${getArtistCoverUrl(favorite.video.artist)}" 
                 alt="${favorite.video.artist}" 
                 class="thumb-mini"
                 onerror="this.src='covers/artists/default.jpg'">
            <div class="playlist-info">
                <span class="m-title">${favorite.video.title}</span>
                <span class="m-artist">${favorite.video.artist}</span>
            </div>
            <span class="m-duration">-</span>
        `;
        item.addEventListener('click', () => {
            const playlistIndex = parseInt(favorite.id.split('-')[0]);
            const videoIndex = parseInt(favorite.id.split('-')[1]);
            
            // Encontra o video nos dados de playlists
            const targetPlaylist = player.playlistsData[playlistIndex];
            const targetVideo = targetPlaylist.videos[videoIndex];
            
            // Carrega o vídeo sem mudar a visualização de favoritos
            player.currentPlaylist = targetPlaylist;
            player.currentPlaylistIndex = playlistIndex;
            player.currentVideoIndex = videoIndex;
            loadVideo(targetVideo);
            playerPlay();
            updateActivePlaylistItem();
            
            // Mantém a visualização de favoritos
            displayFavoritesList();
        });
        itemsContainer.appendChild(item);
    });
}

// ============================================================================
// COMPARTILHAR
// ============================================================================

function shareMusic() {
    const video = player.currentPlaylist.videos[player.currentVideoIndex];
    const text = `Escutando: ${video.title} - ${video.artist} no SanPlayer`;
    const url = `${window.location.origin}${window.location.pathname}#videoId=${video.id}`;
    
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
    const headerSearch = document.querySelector('.header-search');
    const searchForm = headerSearch.querySelector('form');
    const btnSearchMobile = document.querySelector('.btn-search-mobile');
    const btnSearchBack = document.querySelector('.btn-search-back');
    let searchTimeout;
    
    btnSearchMobile.addEventListener('click', () => {
        headerSearch.classList.add('show-search');
        searchInput.focus();
    });
    
    btnSearchBack.addEventListener('click', () => {
        headerSearch.classList.remove('show-search');
        document.getElementById('searchModal').classList.remove('show');
        searchInput.value = '';
    });
    
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
    
    searchInput.addEventListener('blur', (e) => {
        if (window.innerWidth <= 1023 && e.target.value.trim().length === 0) {
            headerSearch.classList.remove('show-search');
        }
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
                <img src="${getArtistCoverUrl(result.video.artist)}" 
                     alt="${result.video.artist}" 
                     class="card-image"
                     onerror="this.src='covers/artists/default.jpg'">
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
                playerPlay();
                updateActivePlaylistItem();
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
    
    // Modal de artistas
    document.getElementById('link-artistas').addEventListener('click', (e) => {
        e.preventDefault();
        openArtistsModal();
    });
    
    document.getElementById('closeArtistsModal').addEventListener('click', closeArtistsModal);
    
    document.getElementById('artistsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeArtistsModal();
        }
    });
    
    // Favoritos na sidebar
    const favoriteLink = document.querySelector('.sidebar-nav li:nth-child(3) a');
    if (favoriteLink) {
        favoriteLink.addEventListener('click', (e) => {
            e.preventDefault();
            displayFavoritesList();
        });
    }
    
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
    
    // Barra de progresso real (range input)
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.addEventListener('input', onProgressInput);
        progressBar.addEventListener('change', onProgressChange);
    }

    // Detectar redimensionamento da janela para ajustar marquee
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const cTitle = document.querySelector('.current-details .c-title');
            checkIfTitleNeedsTruncation(cTitle);
        }, 150);
    });
}

function onProgressInput(event) {
    const value = Number(event.target.value);
    const duration = player.currentDuration || 0;
    const seconds = (duration * value) / 100;
    document.getElementById('timeCurrent').textContent = formatTime(seconds);
}

function onProgressChange(event) {
    const value = Number(event.target.value);
    const duration = player.currentDuration || 0;
    const seconds = (duration * value) / 100;

    player.currentTime = seconds;
    if (player.ytReady && ytPlayer) {
        ytPlayer.seekTo(seconds, true);
    }
    updateProgressBar();
}

