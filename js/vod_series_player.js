"use strict";
var vod_series_player_page = {
    player: null,
    back_url: 'vod-summary-page',
    show_control: false,
    timeOut: null,
    keys: {
        focused_part: "control_bar",  // control_bar | track_modal
        control_bar: 0,
        operation_modal: 0,
        subtitle_audio_selection_modal: 0,
        audio_selection_modal: 0,
        prev_focus: '',
        track_index: 0                 // modal odak index
    },
    current_subtitle_index: -1,
    current_audio_track_index: -1,
    subtitle_audio_menus: [],
    forwardTimer: null,
    current_time: 0,
    show_subtitle: false,
    show_audio_track: false,
    video_control_doms: $('#vod-series-video-controls-container .video-control-icon img'),
    vod_info_timer: null,
    current_movie: {},
    seek_timer: null,
    seek_interval_timer: null,
    current_movie_type: '',
    video_duration: 0,
    last_key_time: 0,
    progress_timer: null,
    title_timer: null,
    nextEpisodeTimer: null,
    offlineDetectionTimer: null,

    init: function (movie, movie_type, back_url, movie_url, move_focus) {
        console.log('[Player] VOD Series Player Page initialized with:', {
            movie: movie,
            movie_type: movie_type,
            back_url: back_url,
            movie_url: movie_url,
            current_episode: window.current_episode
        });
        
        var that = this;
        this.current_movie = movie || {};
        this.current_movie_type = movie_type || 'vod';
        this.back_url = back_url || 'vod-summary-page';
        this.current_time = 0;
        this.video_duration = 0;
        this.show_control = true;
        this.keys.track_index = 0;

        // sayfaları gizle, player tam ekran
        $('.page-container, #home-page, #vod-series-page, #series-summary-page, #vod-summary-page').addClass('hide');
        $('#vod-series-player-page').removeClass('hide video-playing').css({
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#000'
        });
        current_route = 'vod-series-player-page';

        // Ana sayfa bottom bar'ını gizle
        $("#home-mac-address-container").hide();
        try { var el = document.getElementById('home-mac-address-container'); if (el) el.style.display = 'none'; } catch(_) {}
        // Clock ve diğer homepage elementlerini gizle  
        if (typeof hideHomepageElements === "function") hideHomepageElements();
        else if (typeof toggleBottomBar === "function") toggleBottomBar(false);

        // dom referanslarını yenile - Font Awesome ikonlar
        this.video_control_doms = $('#vod-series-video-controls-container .video-control-icon i');

        // Set backdrop image for series player
        that.setBackdropImage();

        setTimeout(function () {
            console.log('[Player] Starting delayed initialization...');
            that.initializePlayer(movie_url);
            that.showControlBar(move_focus);
            $('#vod-series-progress-container .rangeslider').removeClass('active');

            // İKONLARI ZORLA GÖRÜNÜR YAP
            $('#vod-series-video-controls-container').show().css({
                'display': 'block !important',
                'opacity': '1 !important',
                'visibility': 'visible !important'
            });
            
            $('#vod-series-video-controls-wrapper').show().css({
                'display': 'flex !important',
                'opacity': '1 !important',
                'visibility': 'visible !important'
            });
            
            $('.video-control-icon').show().css({
                'display': 'flex !important',
                'opacity': '1 !important',
                'visibility': 'visible !important'
            });
            
            $('#vod-series-video-meta').show().css({
                'display': 'block !important',
                'opacity': '1 !important',
                'visibility': 'visible !important'
            });

            // ikonları play/pause ile senkronla (3. ikon) - Font Awesome
            var playPauseIcon = $('#vod-series-video-controls-wrapper .video-control-icon.is-center i');
            if (playPauseIcon.length) {
                playPauseIcon.removeClass('fa-play').addClass('fa-pause').attr('title', 'Pause');
            }
            $('#vod-series-video-progress').css({ width: 0 });

            console.log('[Player] Calling updateMovieInfo...');
            that.updateMovieInfo();
            that.startProgressUpdate();
            
            console.log('[Player] Controls forced visible!');
        }, 100);

        return true;
    },

    initializePlayer: function (movie_url) {
        console.log('Initializing media player with URL:', movie_url);

        if (typeof media_player === 'undefined') {
            console.error('media_player not available, trying to initialize');
            if (typeof initMediaPlayer === 'function') initMediaPlayer();
            else if (typeof initPlayer === 'function') initPlayer();
        }

        var player_container_id = (typeof platform !== 'undefined' && platform === 'samsung')
            ? 'vod-series-player-video' : 'vod-series-player-video-lg';
        console.log('Using player container:', player_container_id);

        if (typeof media_player !== 'undefined' && media_player) {
            try {
                media_player.init(player_container_id, 'vod-series-player-page');
                this.player = media_player;

                // tam ekran display rect ve zorla fullscreen setup
                if (typeof platform !== 'undefined' && platform === 'samsung' && media_player.setDisplayArea) {
                    setTimeout(function () {
                        // Force fullscreen player element
                        that.forceFullscreenLayout();
                        
                        // Set Samsung display rect
                        if (typeof webapis !== 'undefined' &&
                            webapis.avplay && webapis.avplay.setDisplayRect) {
                            webapis.avplay.setDisplayRect(0, 0, window.innerWidth, window.innerHeight);
                            console.log('Display rect full screen:', window.innerWidth, 'x', window.innerHeight);
                        }
                    }, 200);
                } else {
                    // For non-Samsung platforms, still force fullscreen
                    setTimeout(function () {
                        that.forceFullscreenLayout();
                    }, 200);
                }

                if (movie_url) {
                    console.log('Starting video playback with URL:', movie_url);
                    var that = this;
                    
                    // Set up offline detection timer
                    this.setupOfflineDetection();
                    
                    media_player.playAsync(movie_url);
                    // Set up video event handlers for backdrop control
                    that.setupVideoEventHandlers();
                } else {
                    this.showError('No video URL available');
                }

                // Add video event listeners to hide backdrop when playing
                setTimeout(function() {
                    that.addVideoPlayingEvents();
                }, 1000);
            } catch (error) {
                console.error('Error initializing player:', error);
                this.showError('Player initialization failed');
            }
        } else {
            this.showError('Video player not available');
        }
    },

    setupVideoEventHandlers: function () {
        console.log('[Player] Setting up video event handlers');
        var that = this;
        
        // Add event listeners to hide backdrop when video starts playing
        if (media_player && media_player.videoObj) {
            var video = media_player.videoObj;
            
            // Hide backdrop when video starts playing
            $(video).on('playing loadstart canplay', function() {
                console.log('[Player] Video playing - hiding backdrop');
                $('#vod-series-player-page').addClass('video-playing');
            });
            
            // Show backdrop on error or when video stops
            $(video).on('error emptied', function() {
                console.log('[Player] Video error/stop - showing backdrop');
                $('#vod-series-player-page').removeClass('video-playing');
            });
        }
        
        // For Samsung AVPlayer, listen to webapis events if available
        if (typeof webapis !== 'undefined' && webapis.avplay) {
            try {
                webapis.avplay.setListener({
                    onbufferingstart: function() {
                        console.log('[Player] AVPlayer buffering start');
                    },
                    onbufferingprogress: function() {
                        console.log('[Player] AVPlayer buffering progress');
                    },
                    onbufferingcomplete: function() {
                        console.log('[Player] AVPlayer buffering complete - hiding backdrop');
                        $('#vod-series-player-page').addClass('video-playing');
                    },
                    onstreamcompleted: function() {
                        console.log('[Player] AVPlayer stream completed');
                    },
                    onerror: function(error) {
                        console.log('[Player] AVPlayer error - showing backdrop');
                        $('#vod-series-player-page').removeClass('video-playing');
                        that.showOfflineScreen();
                    }
                });
            } catch (e) {
                console.warn('[Player] Could not set AVPlayer listeners:', e);
            }
        }
    },

    updateMovieInfo: function () {
        console.log('[Player] Updating movie info:', {
            current_movie: this.current_movie,
            current_episode: window.current_episode,
            movie_type: this.current_movie_type
        });

        if (!this.current_movie) {
            console.warn('[Player] No current_movie available');
            return;
        }

        // Series başlığını belirle
        var seriesTitle = this.current_movie.series_title || 
                         this.current_movie.name || 
                         this.current_movie.title || 
                         'Unknown Series';

        var episodeLine = '';
        var episodeTitle = '';

        if (this.current_movie_type === 'series') {
            // Episode bilgilerini çeşitli kaynaklardan topla
            var ep = window.current_episode || this.current_movie.episode_info || this.current_movie;
            
            console.log('[Player] Episode data:', ep);

            if (ep) {
                // Season ve Episode numaralarını belirle
                var seasonNum = ep.season_number || ep.season || 
                               this.current_movie.season_number || this.current_movie.season;
                var episodeNum = ep.episode_number || ep.episode_num || 
                                this.current_movie.episode_number || this.current_movie.episode_num;

                // Episode title'ı belirle
                episodeTitle = ep.title || ep.name || this.current_movie.title || this.current_movie.name;

                // Season/Episode formatını oluştur
                var seasonText = seasonNum ? ('S' + seasonNum) : '';
                var episodeText = episodeNum ? ('E' + episodeNum) : '';
                var seText = [seasonText, episodeText].filter(Boolean).join('');

                // Episode line'ı oluştur
                if (seText && episodeTitle) {
                    episodeLine = seText + ' - ' + episodeTitle;
                } else if (seText) {
                    episodeLine = seText;
                } else if (episodeTitle) {
                    episodeLine = episodeTitle;
                }
            }
        }

        console.log('[Player] Title info prepared:', {
            seriesTitle: seriesTitle,
            episodeLine: episodeLine,
            episodeTitle: episodeTitle
        });

        // Meta bar'ı güncelle
        $('#vod-meta-title').text(seriesTitle);
        $('#vod-meta-extra').text(episodeLine);

        // Title overlay'ini göster
        this.showSimpleTitle(seriesTitle, episodeLine);

        // Global updateMovieInfo helper'ını da çağır
        if (typeof updateMovieInfo === 'function') {
            var updateData = {
                title: seriesTitle,
                name: seriesTitle,
                season_number: (window.current_episode && window.current_episode.season_number) || 
                              this.current_movie.season_number,
                episode_number: (window.current_episode && window.current_episode.episode_number) || 
                               this.current_movie.episode_number
            };
            updateMovieInfo(updateData);
        }
    },

    showSimpleTitle: function (title, episode) {
        if (!$('#simple-title-overlay').length) {
            $('body').append(
                '<div id="simple-title-overlay" class="simple-title-overlay">'+
                '  <div class="title-text"></div>'+
                '  <div class="episode-text"></div>'+
                '</div>'
            );
        }
        $('#simple-title-overlay .title-text').text(title || '');
        $('#simple-title-overlay .episode-text').text(episode || '');
        $('#simple-title-overlay').removeClass('hide');

        clearTimeout(this.title_timer);
        this.title_timer = setTimeout(function () {
            $('#simple-title-overlay').addClass('hide');
        }, 5000);
    },

    forceFullscreenLayout: function () {
        console.log('[Player] Forcing fullscreen layout');
        
        // Force main player page to fullscreen
        $('#vod-series-player-page').css({
            position: 'fixed !important',
            top: '0 !important',
            left: '0 !important', 
            right: '0 !important',
            bottom: '0 !important',
            width: '100vw !important',
            height: '100vh !important',
            zIndex: '9999 !important',
            background: '#000 !important'
        });
        
        // Force both video containers to fullscreen
        var containers = ['#vod-series-player-video', '#vod-series-player-video-lg'];
        containers.forEach(function(containerId) {
            var $container = $(containerId);
            if ($container.length) {
                $container.css({
                    position: 'fixed !important',
                    top: '0 !important',
                    left: '0 !important',
                    right: '0 !important', 
                    bottom: '0 !important',
                    width: '100vw !important',
                    height: '100vh !important',
                    zIndex: '10001 !important',
                    background: '#000 !important'
                });
                
                // Force any video/object elements inside to fullscreen
                $container.find('video, object').css({
                    position: 'fixed !important',
                    top: '0 !important',
                    left: '0 !important',
                    right: '0 !important',
                    bottom: '0 !important', 
                    width: '100vw !important',
                    height: '100vh !important',
                    objectFit: 'cover !important',
                    zIndex: '10001 !important'
                });
            }
        });
        
        // Hide other page containers
        $('.page-container, #home-page, #vod-series-page, #series-summary-page, #vod-summary-page').addClass('hide');
        
        // Force body to prevent scrolling
        $('body').css({
            overflow: 'hidden',
            margin: '0',
            padding: '0'
        });
        
        console.log('[Player] Fullscreen layout applied');
    },

    addVideoPlayingEvents: function() {
        var that = this;
        console.log('[Player] Adding video playing events');
        
        // For Samsung TV
        if (window.webapis && webapis.avplay) {
            try {
                webapis.avplay.setListener({
                    onbufferingstart: function() {
                        console.log('[Player] Samsung buffering start');
                        $('#vod-series-player-page').removeClass('video-playing');
                    },
                    onbufferingprogress: function(percent) {
                        console.log('[Player] Samsung buffering:', percent + '%');
                    },
                    onbufferingcomplete: function() {
                        console.log('[Player] Samsung buffering complete - hiding backdrop');
                        $('#vod-series-player-page').addClass('video-playing');
                        that.hideBackdrop();
                    },
                    oncurrentplaytime: function(currentTime) {
                        if (currentTime > 1000) { // After 1 second of play
                            that.hideBackdrop();
                        }
                    }
                });
            } catch(e) {
                console.log('[Player] Samsung event setup failed:', e);
            }
        }
        
        // For HTML5 video
        var video = document.querySelector('#vod-series-player-video-lg video');
        if (video) {
            video.addEventListener('canplay', function() {
                console.log('[Player] HTML5 canplay - hiding backdrop');
                that.hideBackdrop();
            });
            video.addEventListener('playing', function() {
                console.log('[Player] HTML5 playing - hiding backdrop');
                that.hideBackdrop();
            });
        }
        
        // Fallback timer
        setTimeout(function() {
            if (that.player && (that.player.state === that.player.STATES.PLAYING || 
                               (that.player.current_time && that.player.current_time > 0))) {
                console.log('[Player] Fallback timer - hiding backdrop');
                that.hideBackdrop();
            }
        }, 3000);
    },

    hideBackdrop: function() {
        console.log('[Player] Hiding backdrop');
        $('#vod-series-player-page').css('background-image', 'none');
        $('#vod-series-player-page').addClass('video-playing');
        // Also hide offline screen when video plays
        this.hideOfflineScreen();
        // Clear offline detection timer since video is now playing
        if (this.offlineDetectionTimer) {
            clearTimeout(this.offlineDetectionTimer);
            this.offlineDetectionTimer = null;
        }
    },

    setBackdropImage: function () {
        console.log('[Player] Setting backdrop image');
        
        var backdropUrl = '';
        
        // Try to get backdrop from current episode first
        if (window.current_episode) {
            backdropUrl = window.current_episode.movie_image || 
                         window.current_episode.backdrop_image || 
                         window.current_episode.cover || '';
        }
        
        // If no episode backdrop, try current movie/series
        if (!backdropUrl && this.current_movie) {
            backdropUrl = this.current_movie.backdrop_image || 
                         this.current_movie.movie_image || 
                         this.current_movie.cover || 
                         this.current_movie.image || '';
        }
        
        // Set CSS variable for backdrop
        if (backdropUrl && backdropUrl.trim() !== '') {
            console.log('[Player] Setting backdrop URL:', backdropUrl);
            // Set backdrop directly on the page element
            $('#vod-series-player-page').css('background-image', 'url(' + backdropUrl + ')');
            $('#vod-series-player-page').css('background-size', 'cover');
            $('#vod-series-player-page').css('background-position', 'center');
        } else {
            console.log('[Player] No backdrop image available, using default');
            $('#vod-series-player-page').css('background-image', 'url(images/player_bg.jpg)');
            $('#vod-series-player-page').css('background-size', 'cover');
            $('#vod-series-player-page').css('background-position', 'center');
        }
    },

    // ---- Progress ----
    startProgressUpdate: function () {
        var that = this;
        clearInterval(this.progress_timer);
        this.progress_timer = setInterval(function () {
            var p = that.player || media_player;
            if (!p) return;

            // current time
            if (p.current_time !== undefined) {
                that.current_time = p.current_time;
                that.updateProgressBar();
                that.updateTimeDisplay();
            }

            // duration
            if (that.video_duration === 0) {
                try {
                    if (p.getDuration) that.video_duration = p.getDuration();
                } catch (e) {}
                if (!that.video_duration && window.webapis && webapis.avplay && webapis.avplay.getDuration) {
                    try { that.video_duration = (webapis.avplay.getDuration() || 0) / 1000; } catch (e2) {}
                }
            }
        }, 1000);
    },

    updateProgressBar: function () {
        if (this.video_duration > 0 && this.current_time >= 0) {
            var percentage = (this.current_time / this.video_duration) * 100;
            $('#vod-series-video-progress').css('width', percentage + '%');
        }
    },

    updateTimeDisplay: function () {
        $('#vod-series-video-current-time').text(this.formatTime(this.current_time));
        $('#vod-series-video-duration').text(this.formatTime(this.video_duration));
    },

    formatTime: function (seconds) {
        if (!seconds || seconds < 0) return '00:00';
        var hh = Math.floor(seconds / 3600);
        var mm = Math.floor(seconds / 60) % 60;
        var ss = Math.floor(seconds) % 60;
        if (hh > 0) {
            return (hh < 10 ? "0" : "") + hh + ":" +
                (mm < 10 ? "0" : "") + mm + ":" +
                (ss < 10 ? "0" : "") + ss;
        }
        return (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
    },

    showError: function (message) {
        console.error('Player error:', message);
        
        // Show offline screen for connection/stream errors
        if (message && (message.includes('connection') || 
                       message.includes('network') || 
                       message.includes('failed') ||
                       message.includes('unavailable') ||
                       message.toLowerCase().includes('offline'))) {
            this.showOfflineScreen();
        } else {
            $('#vod-series-player-page .video-error').text(message).show();
        }
    },

    showOfflineScreen: function () {
        console.log('[Player] Showing offline screen');
        // Add offline class to show the satellite dish background
        $('#vod-series-player-page').removeClass('video-playing').addClass('offline');
        // Hide controls during offline state
        this.hideControlBar();
    },

    hideOfflineScreen: function () {
        console.log('[Player] Hiding offline screen');
        $('#vod-series-player-page').removeClass('offline no-signal connection-error');
    },

    setupOfflineDetection: function() {
        var that = this;
        // Clear any existing offline detection timer
        if (this.offlineDetectionTimer) {
            clearTimeout(this.offlineDetectionTimer);
        }
        
        // Set a timer to show offline screen if video doesn't start within 15 seconds
        this.offlineDetectionTimer = setTimeout(function() {
            var playerPage = $('#vod-series-player-page');
            if (!playerPage.hasClass('video-playing') && !playerPage.hasClass('offline')) {
                console.log('[Player] Video not playing after 15 seconds, showing offline screen');
                that.showOfflineScreen();
            }
        }, 15000);
    },

    Exit: function () { this.goBack(); },

    goBack: function () {
        console.log('Going back to:', this.back_url);
        clearInterval(this.progress_timer);
        clearTimeout(this.vod_info_timer);
        clearTimeout(this.timeOut);
        clearInterval(this.nextEpisodeTimer);

        var p = this.player || media_player;
        if (p) {
            try { p.stop && p.stop(); } catch (e) { console.warn(e); }
            try { p.close && p.close(); } catch (e2) { console.warn(e2); }
        }

        // overlay temizliği
        $('#simple-title-overlay').remove();
        $('#player-title-overlay').remove();
        $('#player-poster-overlay').remove();

        // player sayfasını gizle
        $('#vod-series-player-page').addClass('hide');

        // Ana sayfa bottom bar'ını geri göster (eğer ana sayfaya döneceksek)
        var isBackToHome = (this.back_url === 'home-page' || (!this.back_url && current_route === 'home-page'));
        
        if (isBackToHome || (this.back_url !== 'vod-summary-page' && this.back_url !== 'series-summary-page' && this.back_url !== 'vod-series-page')) {
            $("#home-mac-address-container").css("display", "flex").show();
            if (typeof showHomepageElements === "function") showHomepageElements();
            else if (typeof toggleBottomBar === "function") toggleBottomBar(true);
        }

        // türüne göre geri dön
        if (this.current_movie_type === 'series') {
            if (typeof vod_series_page !== 'undefined') {
                $('#vod-series-page').removeClass('hide');
                current_route = 'vod-series-page';
                this.restoreLastWatchedPosition('series');
            } else if (this.back_url === 'series-summary-page' && typeof series_summary_page !== 'undefined') {
                $('#series-summary-page').removeClass('hide');
                current_route = 'series-summary-page';
                if (window._lastSeasonIndex !== undefined && window._lastEpisodeIndex !== undefined) {
                    series_summary_page.keys.season_selection = window._lastSeasonIndex;
                    series_summary_page.keys.episode_selection = window._lastEpisodeIndex;
                    series_summary_page.keys.focused_part = 'episodes';
                }
            }
        } else {
            if (typeof vod_series_page !== 'undefined') {
                $('#vod-series-page').removeClass('hide');
                current_route = 'vod-series-page';
                this.restoreLastWatchedPosition('movie');
            } else if (this.back_url === 'vod-summary-page' && typeof vod_summary_page !== 'undefined') {
                $('#vod-summary-page').removeClass('hide');
                current_route = 'vod-summary-page';
                vod_summary_page.hoverButton && vod_summary_page.hoverButton(1);
            }
        }

        if (current_route === 'vod-series-player-page') {
            $('#home-page').removeClass('hide');
            current_route = 'home-page';
            if (typeof home_operation !== 'undefined') {
                home_operation.hoverButton && home_operation.hoverButton(this.current_movie_type === 'series' ? 2 : 1);
            }
        }
    },

    restoreLastWatchedPosition: function (contentType) {
        if (typeof vod_series_page === 'undefined' || !vod_series_page.last_watched_series) return;
        var last = vod_series_page.last_watched_series;
        console.log('Restoring last watched for', contentType, last);

        if (typeof last.category_index !== 'undefined' &&
            vod_series_page.category_doms &&
            vod_series_page.category_doms[last.category_index]) {

            vod_series_page.keys.category_selection = last.category_index;
            $(vod_series_page.category_doms).removeClass('active');
            $(vod_series_page.category_doms[last.category_index]).addClass('active');

            vod_series_page.selectCategory(last.category_index);

            setTimeout(function () {
                if (typeof last.movie_index !== 'undefined' &&
                    vod_series_page.menu_doms &&
                    vod_series_page.menu_doms[last.movie_index]) {

                    vod_series_page.keys.menu_selection = last.movie_index;
                    vod_series_page.keys.focused_part = 'menu_selection';
                    vod_series_page.hoverMovieItem(vod_series_page.menu_doms[last.movie_index]);
                } else {
                    vod_series_page.keys.focused_part = 'category_selection';
                    vod_series_page.hoverCategory(vod_series_page.category_doms[last.category_index]);
                }
            }, 500);
        } else {
            vod_series_page.keys.category_selection = 0;
            vod_series_page.keys.focused_part = 'category_selection';
            if (vod_series_page.category_doms && vod_series_page.category_doms[0]) {
                vod_series_page.hoverCategory(vod_series_page.category_doms[0]);
            }
        }
    },

    // -------- Controls --------
    playPauseVideo: function () {
        var p = this.player || media_player;
        if (!p) return;
        try {
            var playPauseIcon = $('#vod-series-video-controls-wrapper .video-control-icon.is-center i');
            if (p.state === p.STATES.PLAYING) {
                p.pause && p.pause();
                if (playPauseIcon.length) playPauseIcon.removeClass('fa-pause').addClass('fa-play').attr('title', 'Play');
                console.log("Paused");
            } else {
                p.play && p.play();
                if (playPauseIcon.length) playPauseIcon.removeClass('fa-play').addClass('fa-pause').attr('title', 'Pause');
                console.log("Resumed");
            }
        } catch (e) { console.error('play/pause error:', e); }
    },

    seekTo: function (step) {
        var p = this.player || media_player;
        if (!p || this.current_time < 0) return;

        var newTime = this.current_time + step;
        newTime = Math.max(0, Math.min(newTime, this.video_duration || newTime));

        try {
            if (p.seekTo) {
                p.seekTo(newTime);
            } else if (window.webapis && webapis.avplay && webapis.avplay.seekTo) {
                webapis.avplay.seekTo(newTime * 1000);
            }
            this.current_time = newTime;
            this.updateProgressBar();
            this.updateTimeDisplay();
            this.showSeekIndicator((step > 0 ? '+' : '') + step + 's');
        } catch (e) {
            console.error('seek error:', e);
        }
    },

    showSeekIndicator: function (text) {
        var $ind = $('#seek-indicator');
        if (!$ind.length) {
            $ind = $('<div id="seek-indicator" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 20px;border-radius:8px;font-size:18px;z-index:15000;display:none;"></div>');
            $('body').append($ind);
        }
        $ind.text(text).fadeIn(200).delay(800).fadeOut(300);
    },

    removeAllActiveClass: function () {
        $('.video-control-icon').removeClass('active');
        $(this.video_control_doms).removeClass('active').parent().removeClass('active');
    },

    hoverControlIcon: function (index) {
        var keys = this.keys;
        keys.focused_part = "control_bar";
        keys.control_bar = index;

        this.removeAllActiveClass();
        if (this.video_control_doms[index]) {
            $(this.video_control_doms[index]).addClass('active');
            $(this.video_control_doms[index]).parent().addClass('active');
        }
    },

    handleMenuClick: function () {
        var k = this.keys;
        if (k.focused_part === "control_bar") {
            switch (k.control_bar) {
                case 0: this.showNextVideo(-1); break;      // Prev (episode)
                case 1: this.seekTo(-30); break;            // Rewind
                case 2: this.playPauseVideo(); break;       // Play/Pause
                case 3: this.seekTo(30); break;             // Forward
                case 4: this.showNextVideo(1); break;       // Next (episode)
                case 5: this.showSubtitleAudioModal('subtitle'); break;
                case 6: this.showSubtitleAudioModal('audio'); break;
            }
        } else if (k.focused_part === 'track_modal') {
            this.applySelectedTrack();
        }
    },

    handleMenuLeftRight: function (inc) {
        var k = this.keys;
        if (k.focused_part === "control_bar") {
            var total = this.video_control_doms.length || 7; // Prev,RW,Play,FF,Next,Sub,Audio
            var next = (k.control_bar + inc + total) % total;
            this.hoverControlIcon(next);
        } else if (k.focused_part === 'track_modal') {
            this.trackModalFocus(this.keys.track_index + inc);
        }
        this.showControlBar(false);
    },

    handleMenuUpDown: function (inc) {
        var k = this.keys;
        // iki satır: 5 ana (0..4) ve 2 alt (5..6)
        if (k.focused_part === "control_bar") {
            if (inc > 0) { // aşağı
                if (k.control_bar <= 4) k.control_bar = 5;        // Subtitle
                else if (k.control_bar === 5) k.control_bar = 6;   // Audio
                else k.control_bar = 2;                            // geri Play/Pause
            } else { // yukarı
                if (k.control_bar >= 5) k.control_bar = 2;         // Play/Pause
                else k.control_bar = 5;                             // Subtitle
            }
            this.hoverControlIcon(k.control_bar);
        } else if (k.focused_part === 'track_modal') {
            this.trackModalFocus(this.keys.track_index + (inc > 0 ? 1 : -1));
        }
        this.showControlBar(false);
    },

    showControlBar: function (move_focus) {
        console.log('[Player] showControlBar called, move_focus:', move_focus);
        this.show_control = true;
        $('#vod-series-video-controls-container').removeClass('hide').show();
        $('#vod-series-video-meta').removeClass('hide').show();
        // Force visibility with CSS
        $('#vod-series-video-controls-container').css({
            'display': 'block !important',
            'opacity': '1 !important',
            'visibility': 'visible !important'
        });
        $('#vod-series-video-meta').css({
            'display': 'block !important', 
            'opacity': '1 !important',
            'visibility': 'visible !important'
        });
        console.log('[Player] Controls should be visible now');
        if (move_focus) this.hoverControlIcon(2);
        var that = this;
        clearTimeout(this.timeOut);
        this.timeOut = setTimeout(function () { that.hideControlBar(); }, 7000);
    },

    hideControlBar: function () {
        if (!this.show_control) return;
        this.show_control = false;
        $('#vod-series-video-controls-container').addClass('hide');
        $('#vod-series-video-meta').addClass('hide');
    },

    // ---- Tracks (subtitle/audio) ----
    showSubtitleAudioModal: function (kind) {
        var normalized = (kind || '').toLowerCase();
        if (normalized === 'text') normalized = 'subtitle';
        if (normalized !== 'audio' && normalized !== 'subtitle') normalized = 'subtitle';

        var tracks = (media_player && media_player.getSubtitleOrAudioTrack)
            ? media_player.getSubtitleOrAudioTrack()
            : { audio: [], subtitle: [] };

        var list = (normalized === 'audio') ? tracks.audio : tracks.subtitle;
        var title = (normalized === 'audio') ? 'Ses Seçimi' : 'Altyazı Seçimi';
        $('#track-modal-title').text(title);

        var html = '';
        if (!list || !list.length) {
            html = '<div class="track-item">Yok</div>';
        } else {
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                var lang = item.language || ('Track ' + i);
                html += '<div class="track-item" data-kind="' + normalized + '" data-index="' + item.index + '">' + lang + '</div>';
            }
            if (normalized === 'subtitle') {
                html += '<div class="track-item" data-kind="subtitle" data-index="-1">Kapat</div>';
            }
        }
        $('#track-items').html(html);
        $('#track-selection-modal').removeClass('hide');
        this.keys.focused_part = 'track_modal';
        this.trackModalFocus(0);
    },

    trackModalFocus: function (idx) {
        var items = $('#track-items .track-item');
        if (!items.length) return;
        idx = (idx + items.length) % items.length;
        this.keys.track_index = idx;
        items.removeClass('active');
        $(items[idx]).addClass('active');
    },

    applySelectedTrack: function () {
        var items = $('#track-items .track-item');
        if (!items.length) return;
        var el = $(items[this.keys.track_index]);
        var kind = el.data('kind');
        var index = parseInt(el.data('index'), 10);

        if (kind === 'subtitle') {
            media_player.setSubtitleOrAudioTrack && media_player.setSubtitleOrAudioTrack('subtitle', index >= 0 ? index : -1);
        } else if (kind === 'audio') {
            media_player.setSubtitleOrAudioTrack && media_player.setSubtitleOrAudioTrack('audio', index);
        }
        $('#track-selection-modal').addClass('hide');
        this.keys.focused_part = 'control_bar';
    },

    // ---- Series next/prev ----
    showNextVideo: function (direction) {
        if (this.current_movie_type !== 'series' || typeof series_summary_page === 'undefined') {
            console.log('Next/Prev only for series');
            return;
        }

        var currentEpisodeIndex = window._lastEpisodeIndex || 0;
        var newEpisodeIndex = currentEpisodeIndex + (direction > 0 ? 1 : -1);

        if (series_summary_page.episodes && series_summary_page.episodes.length) {
            newEpisodeIndex = Math.max(0, Math.min(newEpisodeIndex, series_summary_page.episodes.length - 1));
            window._lastEpisodeIndex = newEpisodeIndex;
            series_summary_page.keys.episode_selection = newEpisodeIndex;

            var p = this.player || media_player;
            try { p && p.stop && p.stop(); } catch (e) {}

            setTimeout(function () {
                series_summary_page.playEpisode(newEpisodeIndex);
            }, 300);
        } else {
            console.log('No episodes for navigation');
        }
    },

    // akış bittiğinde
    handleStreamCompleted: function () {
        console.log("Stream completed");
        var that = this;
        if (this.current_movie_type === 'series' && typeof series_summary_page !== 'undefined') {
            var nextEpisode = this.getNextEpisode();
            if (nextEpisode) {
                this.showNextEpisodePrompt(nextEpisode);
            } else {
                setTimeout(function () { that.goBack(); }, 3000);
            }
        } else {
            setTimeout(function () { that.goBack(); }, 3000);
        }
    },

    getNextEpisode: function () {
        if (typeof series_summary_page !== 'undefined' && typeof series_summary_page.getNextEpisodeData === 'function') {
            return series_summary_page.getNextEpisodeData();
        }
        return null;
    },

    showNextEpisodePrompt: function (nextEpisode) {
        if (!$('#next-episode-prompt').length) {
            var t1 = (typeof LanguageManager !== 'undefined') ? LanguageManager.getText('next_episode') : 'Sonraki Bölüm';
            var t2 = (typeof LanguageManager !== 'undefined') ? LanguageManager.getText('play_next') : 'Sonrakini Oynat';
            var t3 = (typeof LanguageManager !== 'undefined') ? LanguageManager.getText('go_back') : 'Geri Dön';
            var t4 = (typeof LanguageManager !== 'undefined') ? LanguageManager.getText('auto_play_in') : 'Otomatik oynatma';
            var t5 = (typeof LanguageManager !== 'undefined') ? LanguageManager.getText('seconds') : 'saniye';

            $('body').append(
                '<div id="next-episode-prompt" class="next-episode-prompt">'+
                ' <div class="prompt-content">'+
                '   <h3>'+t1+'</h3>'+
                '   <p class="episode-title"></p>'+
                '   <div class="prompt-buttons">'+
                '     <button class="btn-play-next">'+t2+'</button>'+
                '     <button class="btn-go-back">'+t3+'</button>'+
                '   </div>'+
                '   <div class="auto-countdown">'+t4+' <span class="countdown">10</span> '+t5+'</div>'+
                ' </div>'+
                '</div>'
            );

            $('#next-episode-prompt .btn-play-next').on('click', function () {
                vod_series_player_page.playNextEpisode(nextEpisode);
            });
            $('#next-episode-prompt .btn-go-back').on('click', function () {
                vod_series_player_page.hideNextEpisodePrompt();
                vod_series_player_page.goBack();
            });
        }

        $('#next-episode-prompt .episode-title').text(nextEpisode.title || nextEpisode.name || 'Next Episode');
        $('#next-episode-prompt').show();
        this.startNextEpisodeCountdown(nextEpisode);
    },

    hideNextEpisodePrompt: function () {
        $('#next-episode-prompt').remove();
        clearInterval(this.nextEpisodeTimer);
    },

    startNextEpisodeCountdown: function (nextEpisode) {
        var that = this, countdown = 10;
        clearInterval(this.nextEpisodeTimer);
        this.nextEpisodeTimer = setInterval(function () {
            countdown--;
            $('#next-episode-prompt .countdown').text(countdown);
            if (countdown <= 0) {
                clearInterval(that.nextEpisodeTimer);
                that.playNextEpisode(nextEpisode);
            }
        }, 1000);
    },

    playNextEpisode: function (nextEpisode) {
        this.hideNextEpisodePrompt();
        if (typeof series_summary_page !== 'undefined' && typeof series_summary_page.playEpisode === 'function') {
            series_summary_page.playEpisode(nextEpisode);
        }
    },

    // dışarıdan progress güncelle
    updateProgress: function (currentTime) {
        this.current_time = currentTime || 0;
        if (this.video_duration > 0) {
            var pct = (this.current_time / this.video_duration) * 100;
            $('#vod-series-video-progress').css('width', pct + '%');
            $('#vod-series-video-current-time').text(this.formatTime(this.current_time));
        }
    },

    HandleKey: function (e) {
        var now = Date.now();
        if (now - this.last_key_time < 100) return;   // key flood
        this.last_key_time = now;

        // Track modal açık ise, BACK tuşu modal'ı kapat
        if (this.keys.focused_part === 'track_modal' && 
            (e.keyCode === tvKey.RETURN || e.keyCode === tvKey.EXIT)) {
            $('#track-selection-modal').addClass('hide');
            this.keys.focused_part = 'control_bar';
            return;
        }

        this.showControlBar(false);

        switch (e.keyCode) {
            case tvKey.RIGHT:      this.handleMenuLeftRight(1); break;
            case tvKey.LEFT:       this.handleMenuLeftRight(-1); break;
            case tvKey.UP:         this.handleMenuUpDown(-1); break;
            case tvKey.DOWN:       this.handleMenuUpDown(1); break;
            case tvKey.ENTER:      this.handleMenuClick(); break;
            
            // BACK tuşu - Samsung TV için kritik
            case tvKey.RETURN:
            case tvKey.EXIT:
            case 10009:            // Samsung TV BACK key
            case 8:                // BACKSPACE (some Samsung models)
                this.goBack(); 
                break;
                
            // Playback control keys
            case tvKey.PLAY:
            case tvKey.PAUSE:
            case tvKey.PLAYPAUSE:  
            case 415:              // PLAY key
            case 19:               // PAUSE key  
                this.playPauseVideo(); 
                break;
                
            // Seek keys
            case tvKey.FF:
            case 228:              // FAST_FORWARD
            case 39:               // RIGHT ARROW (alternative)
                this.seekTo(30); 
                break;
                
            case tvKey.RW:
            case 227:              // REWIND  
            case 37:               // LEFT ARROW (alternative)
                this.seekTo(-30); 
                break;
                
            // Episode navigation for series
            case tvKey.CH_UP:
            case 427:              // CHANNEL_UP
            case 33:               // PAGE_UP
                if (this.current_movie_type === 'series') {
                    this.showNextVideo(1);  // Next episode
                } else {
                    this.seekTo(300);       // Skip 5 minutes for movies
                }
                break;
                
            case tvKey.CH_DOWN:
            case 428:              // CHANNEL_DOWN  
            case 34:               // PAGE_DOWN
                if (this.current_movie_type === 'series') {
                    this.showNextVideo(-1); // Previous episode
                } else {
                    this.seekTo(-300);      // Back 5 minutes for movies
                }
                break;
                
            // Samsung TV specific keys
            case 10252:            // SOURCE key
            case 145:              // MENU key
                this.showControlBar(true);
                break;
                
            // Audio/Subtitle shortcuts
            case 460:              // SUBTITLE key
                this.showSubtitleAudioModal('subtitle');
                break;
                
            case 461:              // AUDIO key  
                this.showSubtitleAudioModal('audio');
                break;
                
            // Info key - show/hide controls
            case 457:              // INFO key
            case 73:               // I key
                if (this.show_control) {
                    this.hideControlBar();
                } else {
                    this.showControlBar(true);
                }
                break;
                
            // Test offline screen - Red button
            case 403:              // RED button (for testing)
                console.log('[Player] Testing offline screen');
                if ($('#vod-series-player-page').hasClass('offline')) {
                    this.hideOfflineScreen();
                } else {
                    this.showOfflineScreen();
                }
                break;
                
            default: 
                console.log("Unhandled key in player:", e.keyCode);
                break;
        }
    }
};

// meta alanını güncelleyen yardımcı (mevcut kodunla uyumlu bırakıyorum)
function updateMovieInfo(data) {
    if (!data) return;
    try {
        var title = data.title || data.name || '';
        var episodeInfo = '';
        if (data.season_number && data.episode_number) {
            episodeInfo = 'S' + data.season_number + 'E' + data.episode_number;
        } else if (data.episode_number) {
            episodeInfo = 'E' + data.episode_number;
        }
        $('#vod-meta-title').text(title);
        $('#vod-meta-extra').text(episodeInfo);
        $('#vod-series-video-title').text('');
        $('.video-resolution').remove();
    } catch (e) {
        console.warn('updateMovieInfo error', e);
    }
}
