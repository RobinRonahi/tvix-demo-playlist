"use strict";

/**
 * mediaPlayer.js
 * - ES5 only (Samsung A6/A9 safe)
 * - English logs/comments
 * - Does NOT overwrite global `platform`; uses internal fallback path
 * - Guards all Tizen/webapis calls
 * - Limits loaders/errors to the current player container
 */

var media_player;

function initMediaPlayer() {
    try { console.log('initMediaPlayer invoked; platform:', typeof platform !== 'undefined' ? platform : '(unknown)'); } catch (_) {}

    var isSamsung = (typeof platform !== 'undefined' && platform === 'samsung');
    var hasWebApis = !!(typeof window !== 'undefined' && window.webapis && webapis.avplay);
    
    // Samsung webapis simulation for development environment
    if (isSamsung && !hasWebApis && typeof window !== 'undefined') {
        console.log('🔧 Creating Samsung webapis simulation for development...');
        
        // Create webapis mock for development
        window.webapis = window.webapis || {};
        window.webapis.avplay = {
            open: function(url) { console.log('📺 Samsung AVPlay: open', url); },
            close: function() { console.log('📺 Samsung AVPlay: close'); },
            prepare: function() { console.log('📺 Samsung AVPlay: prepare'); },
            play: function() { console.log('📺 Samsung AVPlay: play'); },
            stop: function() { console.log('📺 Samsung AVPlay: stop'); },
            pause: function() { console.log('📺 Samsung AVPlay: pause'); },
            seekTo: function(time) { console.log('📺 Samsung AVPlay: seekTo', time); },
            setListener: function(listener) { console.log('📺 Samsung AVPlay: setListener'); },
            setDisplayRect: function(x, y, width, height) { 
                console.log('📺 Samsung AVPlay: setDisplayRect', x, y, width, height); 
            },
            getCurrentTime: function() { return 0; },
            getDuration: function() { return 0; },
            getState: function() { return 'IDLE'; }
        };
        hasWebApis = true;
        console.log('✅ Samsung webapis simulation created successfully!');
    }
    
    var useSamsung = isSamsung && hasWebApis;

    if (isSamsung && !hasWebApis) {
        console.warn('webapis.avplay not available; using HTML5 fallback on Samsung');
    } else if (isSamsung && hasWebApis) {
        console.log('🎯 Samsung webapis.avplay is ready!');
    }

    if (useSamsung) {
        /* ----------------------------- Samsung (AVPlay) ----------------------------- */
        media_player = {
            videoObj: null,
            parent_id: '',
            state: 0,
            current_time: 0,
            STATES: { STOPPED: 0, PLAYING: 1, PAUSED: 2, PREPARED: 4 },

            init: function (id, parent_id) {
                this.videoObj = document.getElementById(id);
                this.parent_id = parent_id;
                this.state = this.STATES.STOPPED;
                this.current_time = 0;
            },

            playAsync: function (url) {
                var $parent = $('#' + this.parent_id);
                $parent.find('.video-error').hide();
                $parent.find('.video-loader').show();

                if (!this.videoObj) {
                    console.error("Samsung: video element not found");
                    return;
                }

                try {
                    // Stop any previous
                    try { webapis.avplay.stop(); } catch (_) {}
                    try { webapis.avplay.close(); } catch (_) {}

                    console.log("Samsung AVPlay opening URL:", url);
                    webapis.avplay.open(url);

                    // Initial display area
                    this.setDisplayArea();

                    // Event listeners
                    this.setupEventListeners();

                    // Prepare async then play
                    var that = this;
                    webapis.avplay.prepareAsync(function onPrepared() {
                        that.onDeviceReady();
                    }, function onPrepareError(e) {
                        console.log("Samsung prepareAsync error:", e);
                        $parent.find('.video-error').show();
                        $parent.find('.video-loader').hide();
                    });
                } catch (e) {
                    console.log("Samsung playAsync error:", e);
                    $parent.find('.video-error').show();
                    $parent.find('.video-loader').hide();
                }
            },

            play: function () {
                this.state = this.STATES.PLAYING;
                try { webapis.avplay.play(); } catch (e) { console.log("Samsung play error:", e); }
            },

            pause: function () {
                this.state = this.STATES.PAUSED;
                try { webapis.avplay.pause(); } catch (e) { console.log("Samsung pause error:", e); }
            },

            stop: function () {
                this.state = this.STATES.STOPPED;
                try { webapis.avplay.stop(); } catch (e) { console.log("Samsung stop error:", e); }
            },

            close: function () {
                this.state = this.STATES.STOPPED;
                try { webapis.avplay.close(); } catch (e) { console.log("Samsung close error:", e); }
            },

            setDisplayArea: function () {
                try {
                    // Pick rect from element or full screen depending on UI state
                    var rect = this._computeDisplayRect();
                    webapis.avplay.setDisplayRect(rect.left, rect.top, rect.width, rect.height);
                } catch (error) {
                    console.error('Samsung setDisplayArea error:', error);
                }
            },

            _computeDisplayRect: function () {
                // Prefer getBoundingClientRect for accuracy on TVs
                var full = { left: 0, top: 0, width: (window.screen ? window.screen.width : window.innerWidth), height: (window.screen ? window.screen.height : window.innerHeight) };

                if (this.parent_id === 'vod-series-player-page') {
                    // Always fullscreen for VOD series player
                    return full;
                }

                if (this.parent_id === 'channel-page') {
                    var isExpanded = $('#channel-page .player-container').hasClass('expanded');
                    var isFs = $('#channel-page').hasClass('fullscreen-mode');
                    if (isExpanded || isFs) return full;
                }

                if (!this.videoObj) return full;

                var r = this.videoObj.getBoundingClientRect();
                // Fallback to jQuery if needed (older layouts)
                if (!r || !r.width) {
                    var $el = $(this.videoObj);
                    return {
                        left: $el.offset().left | 0,
                        top: $el.offset().top | 0,
                        width: parseInt($el.width(), 10) || full.width,
                        height: parseInt($el.height(), 10) || full.height
                    };
                }
                return {
                    left: Math.max(0, (r.left | 0)),
                    top: Math.max(0, (r.top | 0)),
                    width: Math.max(1, (r.width | 0)),
                    height: Math.max(1, (r.height | 0))
                };
            },

            formatTime: function (seconds) {
                var hh = Math.floor(seconds / 3600),
                    mm = Math.floor(seconds / 60) % 60,
                    ss = Math.floor(seconds) % 60;
                return (hh ? (hh < 10 ? "0" : "") + hh + ":" : "") +
                    ((mm < 10) ? "0" : "") + mm + ":" +
                    ((ss < 10) ? "0" : "") + ss;
            },

            setupEventListeners: function () {
                var that = this;
                try {
                    webapis.avplay.setListener({
                        onbufferingstart: function () {
                            console.log("Samsung: buffering start");
                            $('#' + that.parent_id).find('.video-loader').show();
                            if (that.parent_id === 'vod-series-player-page') that._checkPlayerHealthSoon();
                        },
                        onbufferingprogress: function (percent) {
                            if (that.parent_id === 'vod-series-player-page') {
                                var $loader = $('#' + that.parent_id).find('.video-loader');
                                if (percent > 0 && $loader.find('.buffer-progress').length === 0) {
                                    $loader.append('<div class="buffer-progress">' + percent + '%</div>');
                                } else {
                                    $loader.find('.buffer-progress').text(percent + '%');
                                }
                            }
                        },
                        onbufferingcomplete: function () {
                            var $p = $('#' + that.parent_id);
                            $p.find('.video-loader').hide();
                            $p.find('.video-loader .buffer-progress').remove();
                            // Ensure rect in case layout changed while buffering
                            that.setDisplayArea();
                        },
                        onstreamcompleted: function () {
                            console.log("Samsung: stream completed");
                            that.state = that.STATES.STOPPED;
                            if (that.parent_id === 'vod-series-player-page' && typeof vod_series_player_page !== 'undefined') {
                                try { vod_series_player_page.handleStreamCompleted(); } catch (_) {}
                            }
                        },
                        oncurrentplaytime: function (ms) {
                            that.current_time = (ms / 1000) || 0;
                            if (that.parent_id === 'vod-series-player-page' &&
                                typeof vod_series_player_page !== 'undefined' &&
                                typeof vod_series_player_page.updateProgress === 'function') {
                                vod_series_player_page.updateProgress(that.current_time);
                            }
                        },
                        onerror: function (type) {
                            console.error("Samsung: player error:", type);
                            var $c = $('#' + that.parent_id);
                            $c.find('.video-error').show();
                            $c.find('.video-loader').hide();
                            that._handlePlayerError(type);
                        }
                    });
                } catch (e) {
                    console.warn('Samsung setListener failed:', e);
                }

                // Keep rect updated on resize/orientation changes
                try {
                    window.addEventListener('resize', this._safeSetRect.bind(this));
                } catch (_) {}
            },

            _safeSetRect: function () {
                try { this.setDisplayArea(); } catch (_) {}
            },

            _checkPlayerHealthSoon: function () {
                var that = this;
                try {
                    setTimeout(function () {
                        try {
                            var state = webapis.avplay.getState();
                            console.log("Samsung: state =", state);
                            if (state === 'IDLE' || state === 'NONE') {
                                console.warn("Samsung: idle/none state; attempting recovery");
                                if (that.videoObj && that.videoObj.src) {
                                    that.playAsync(that.videoObj.src);
                                }
                            }
                        } catch (e) {
                            console.log("Samsung: getState error:", e);
                        }
                    }, 1000);
                } catch (_) {}
            },

            _handlePlayerError: function (type) {
                var map = {
                    'PLAYER_ERROR_NONE': 'No error',
                    'PLAYER_ERROR_INVALID_PARAMETER': 'Invalid parameter',
                    'PLAYER_ERROR_NO_SUCH_FILE': 'File not found',
                    'PLAYER_ERROR_INVALID_OPERATION': 'Invalid operation',
                    'PLAYER_ERROR_SEEK_FAILED': 'Seek failed',
                    'PLAYER_ERROR_INVALID_STATE': 'Invalid state',
                    'PLAYER_ERROR_NOT_SUPPORTED_FILE': 'Unsupported format',
                    'PLAYER_ERROR_INVALID_URI': 'Invalid URL',
                    'PLAYER_ERROR_CONNECTION_FAILED': 'Network connection failed',
                    'PLAYER_ERROR_BUFFER_SPACE': 'Insufficient buffer',
                    'PLAYER_ERROR_OUT_OF_MEMORY': 'Out of memory'
                };
                console.error("Samsung error detail:", map[type] || ('Unknown: ' + type));

                if (type === 'PLAYER_ERROR_CONNECTION_FAILED' || type === 'PLAYER_ERROR_INVALID_URI') {
                    var that = this;
                    setTimeout(function () {
                        if (that.videoObj && that.videoObj.src) {
                            console.log("Samsung: retrying stream after error");
                            that.playAsync(that.videoObj.src);
                        }
                    }, 3000);
                }
            },

            onDeviceReady: function () {
                console.log("Samsung: device ready");
                $('#' + this.parent_id).find('.video-loader').hide();
                this.state = this.STATES.PREPARED;
                this.play();
            },

            onPause: function () { console.log("Samsung: paused"); },
            onResume: function () { console.log("Samsung: resumed"); },

            getSubtitleOrAudioTrack: function () {
                var tracks = { audio: [], subtitle: [] };
                try {
                    var total = webapis.avplay.getTotalTrackInfo();
                    for (var i = 0; i < total; i++) {
                        var info = webapis.avplay.getTrackInfo(i);
                        if (info && info.type === 'AUDIO') {
                            tracks.audio.push({ index: i, language: info.extraLang || info.language || ('A' + i) });
                        } else if (info && info.type === 'TEXT') {
                            tracks.subtitle.push({ index: i, language: info.extraLang || info.language || ('S' + i) });
                        }
                    }
                } catch (e) {
                    console.warn('Samsung track enumeration failed', e);
                }
                return tracks;
            },

            setSubtitleOrAudioTrack: function (kind, index) {
                try {
                    if (kind === 'audio') {
                        webapis.avplay.setSelectTrack('AUDIO', index);
                    } else if (kind === 'subtitle') {
                        if (index >= 0) {
                            webapis.avplay.setSelectTrack('TEXT', index);
                        } else {
                            try { webapis.avplay.setSelectTrack('TEXT', -1); } catch (_) {}
                        }
                    }
                } catch (e) {
                    console.warn('Samsung setSubtitleOrAudioTrack error', e);
                }
            }
        };
        return;
    }

    /* ----------------------------- HTML5 Fallback (LG path reused) ----------------------------- */
    media_player = {
        id: '',
        videoObj: null,
        parent_id: '',
        current_time: 0,
        state: 0,
        STATES: { STOPPED: 0, PLAYING: 1, PAUSED: 2, PREPARED: 4 },

        init: function (id, parent_id) {
            this.id = id;
            this.videoObj = document.getElementById(id);
            this.parent_id = parent_id;
            this.current_time = 0;
            this.state = this.STATES.STOPPED;

            var that = this;
            if (!this.videoObj) return;

            this.videoObj.addEventListener("error", function (e) {
                console.log("HTML5 player error:", e);
                $('#' + that.parent_id).find('.video-error').show();
                $('#' + that.parent_id).find('.video-loader').hide();
            });
            this.videoObj.addEventListener("canplay", function () {
                console.log("HTML5 player canplay");
                $('#' + that.parent_id).find('.video-loader').hide();
            });
            this.videoObj.addEventListener('waiting', function () {
                $('#' + that.parent_id).find('.video-loader').show();
            });
            this.videoObj.addEventListener('ended', function () {
                console.log("HTML5 player ended");
                that.state = that.STATES.STOPPED;
            });
            this.videoObj.ontimeupdate = function () {
                that.current_time = that.videoObj.currentTime || 0;
            };
        },

        playAsync: function (url) {
            try { this.state = this.STATES.PREPARED; } catch (_) {}
            console.log("HTML5 player playing URL:", url);

            var that = this;
            var $p = $('#' + this.parent_id);
            $p.find('.video-error').hide();
            $p.find('.video-loader').show();

            if (!this.videoObj) return;

            // Reset sources
            while (this.videoObj.firstChild) this.videoObj.removeChild(this.videoObj.firstChild);
            this.videoObj.load();

            var source = document.createElement("source");
            source.setAttribute('src', url);
            this.videoObj.appendChild(source);

            // Autoplay
            try { this.videoObj.play(); } catch (e) { console.log("HTML5 play() error:", e); }
            $p.find('.progress-amount').css({ width: 0 });

            source.addEventListener("error", function (e) {
                console.log("HTML5 source error:", e);
                $p.find('.video-error').show();
                $p.find('.video-loader').hide();
            });
        },

        play: function () {
            this.state = this.STATES.PLAYING;
            if (this.videoObj) try { this.videoObj.play(); } catch (_) {}
        },

        pause: function () {
            this.state = this.STATES.PAUSED;
            if (this.videoObj) try { this.videoObj.pause(); } catch (_) {}
        },

        stop: function () {
            this.state = this.STATES.STOPPED;
            if (this.videoObj) {
                try { this.videoObj.pause(); } catch (_) {}
            }
        },

        close: function () {
            this.state = this.STATES.STOPPED;
            if (this.videoObj) {
                try { this.videoObj.pause(); } catch (_) {}
                try { this.videoObj.src = ''; } catch (_) {}
            }
        },

        setDisplayArea: function () {
            // Not required for HTML5 video element
        },

        formatTime: function (seconds) {
            var hh = Math.floor(seconds / 3600),
                mm = Math.floor(seconds / 60) % 60,
                ss = Math.floor(seconds) % 60;
            return (hh ? (hh < 10 ? "0" : "") + hh + ":" : "") +
                ((mm < 10) ? "0" : "") + mm + ":" +
                ((ss < 10) ? "0" : "") + ss;
        },

        seekTo: function (seekTime) {
            if (this.videoObj && seekTime >= 0) {
                try { this.videoObj.currentTime = seekTime; } catch (_) {}
            }
        },

        getSubtitleOrAudioTrack: function () { return []; },
        setSubtitleOrAudioTrack: function (kind, index) {
            console.log("HTML5 set track (noop) kind:", kind, "index:", index);
        }
    };
}

// expose
window.initMediaPlayer = initMediaPlayer;