"use strict";

/* =========================================================================
   TvixPlayer Pro - main.js (Samsung TV compatible / cleaned)
   - English-only comments and logs
   - ES5 for A6/A9 compatibility (no arrow functions / optional chaining)
   - Guarded Tizen/Web API calls
   - Stable home UI visibility and refresh throttling
   ========================================================================= */

/* ----------------------------- Globals ---------------------------------- */
var lastHomeRefreshAt = 0;
var HOME_REFRESH_THROTTLE_MS = 1500;

/* ------------------------ Global Navigation Functions -------------------- */
function goBackToCategory() {
    console.log('Global goBackToCategory called, current_route:', window.current_route);
    
    try {
        if (window.current_route === 'vod-summary-page' && typeof vod_summary_page !== 'undefined') {
            vod_summary_page.goBackToCategory();
        } else if (window.current_route === 'series-summary-page' && typeof series_summary_page !== 'undefined') {
            series_summary_page.goBack();
        } else if (window.current_route === 'vod-series-page' && typeof vod_series_page !== 'undefined') {
            vod_series_page.goBackToCategory();
        } else {
            // Fallback: go to home
            goBackToHome();
        }
    } catch (error) {
        console.error('Error in global goBackToCategory:', error);
        goBackToHome();
    }
}

function goBackToHome() {
    console.log('Global goBackToHome called');
    
    try {
        // Hide all pages
        $('.page-type-1, .height-100').addClass('hide');
        
        // Show home page
        $('#home-page').removeClass('hide');
        
        // Show home elements
        $('.main-logo-container').show();
        $('#main-menu-container').show();
        
        // Bottom bar'ı zorla göster
        $('#home-mac-address-container').css({
            'display': 'flex !important',
            'visibility': 'visible !important',
            'opacity': '1 !important'
        }).show().removeClass('hide');
        
        $('#top-right-clock').show();
        
        // Update route
        if (typeof updateRoute === 'function') {
            updateRoute('home-page', 'menu_selection');
        }
        window.current_route = 'home-page';
        
        // Initialize home
        if (typeof ensureHomepageUIVisible === 'function') {
            ensureHomepageUIVisible();
        }
        if (typeof safeRefreshHome === 'function') {
            safeRefreshHome();
        }
        if (typeof top_menu_page !== 'undefined' && top_menu_page.init) {
            top_menu_page.init();
        }
        
        console.log('Successfully returned to home page');
    } catch (error) {
        console.error('Error in goBackToHome:', error);
    }
}

/* ------------------------ Player Initialization ------------------------- */
function initPlayer() {
    console.log("Player initialization started");
    try {
        if (typeof initMediaPlayer === 'function') {
            initMediaPlayer();
        }
        if (typeof TVPlayer !== 'undefined') {
            window.tvPlayer = new TVPlayer();
            console.log("TVPlayer initialized successfully");
        }
        if (typeof SeriesPlayer !== 'undefined') {
            window.seriesPlayer = new SeriesPlayer();
            console.log("SeriesPlayer initialized successfully");
        }
        if (typeof VODPlayer !== 'undefined') {
            window.vodPlayer = new VODPlayer();
            console.log("VODPlayer initialized successfully");
        }
        setupPlayerContainers();
    } catch (e) {
        console.error("Player initialization error:", e);
    }
}

function setupPlayerContainers() {
    var setupTVPlayer = function () {
        if (window.tvPlayer && document.getElementById('tv-player-container')) {
            try { window.tvPlayer.init('tv-player-container'); } catch(_) {}
            console.log("TVPlayer container setup complete");
        }
    };
    var setupSeriesPlayer = function () {
        if (window.seriesPlayer && document.getElementById('series-player-container')) {
            try { window.seriesPlayer.init('series-player-container'); } catch(_) {}
            console.log("SeriesPlayer container setup complete");
        }
    };
    var setupVODPlayer = function () {
        if (window.vodPlayer && document.getElementById('vod-player-container')) {
            try { window.vodPlayer.init('vod-player-container'); } catch(_) {}
            console.log("VODPlayer container setup complete");
        }
    };

    var runAll = function () {
        setTimeout(function () {
            setupTVPlayer();
            setupSeriesPlayer();
            setupVODPlayer();
        }, 500);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAll);
    } else {
        runAll();
    }
}

/* ------------------------ Page Transition System ------------------------ */
function initPageTransitionListeners() {
    console.log("Page transition listeners initialized");
    var pages = ['home-page', 'channel-page', 'setting-page', 'vod-series-page', 'series-summary-page', 'vod-summary-page'];

    pages.forEach(function (pageId) {
        var page = document.getElementById(pageId);
        if (!page) return;

        page.addEventListener('transitionend', function (e) {
            if (e.target !== page) return;
            console.log("Page transition completed: " + pageId);

            // On home page transition end, ensure footer/banner/clock and refresh
            if (pageId === 'home-page') {
                ensureHomepageUIVisible();
                safeRefreshHome();
            }
        });
    });
}

// Ensure footer, clock and banner are visible on home + update info
function ensureHomepageUIVisible() {
    try {
        showHomepageElements();
        toggleDeviceInfoBanner(true);
        toggleBottomBar(true);
        toggleClock(true);
        if (typeof updateDeviceInfoBanner === 'function') {
            updateDeviceInfoBanner();
        }
    } catch (e) {
        console.warn("ensureHomepageUIVisible error:", e);
    }
}

// Throttled home refresh to avoid excessive updates
function safeRefreshHome() {
    var now = Date.now();
    if (now - lastHomeRefreshAt < HOME_REFRESH_THROTTLE_MS) return;
    lastHomeRefreshAt = now;

    try {
        if (typeof refreshPlaylist === 'function') refreshPlaylist();
    } catch (e) {
        console.warn("safeRefreshHome refreshPlaylist error:", e);
    }

    try {
        if (typeof updateDeviceInfoBanner === 'function') updateDeviceInfoBanner();
    } catch (e) {
        console.warn("safeRefreshHome updateDeviceInfoBanner error:", e);
    }
}

function handlePageTransition(targetPage) {
    console.log("Handling page transition:", targetPage ? targetPage.id : "home");

    if (targetPage) {
        targetPage.style.opacity = '1';
        switch (targetPage.id) {
            case 'channel-page':
            case 'setting-page':
            case 'vod-series-page':
            case 'series-summary-page':
            case 'vod-summary-page':
                hideHomepageElements();
                break;
            case 'home-page':
                ensureHomepageUIVisible();
                safeRefreshHome();
                break;
        }
    } else {
        // null => home
        console.log("Home page transition");
        ensureHomepageUIVisible();
        safeRefreshHome();
    }
}

/* --------------------------- Document Ready ---------------------------- */
$(document).ready(function () {
    // Platform
    platform = 'samsung';

    // Samsung TV model detection (Tizen 6.5+ ~ 2022)
    try {
        var userAgent = (window.navigator.userAgent || "").toLowerCase();
        var isSamsung2022orNewer = false;
        if (userAgent.indexOf('tizen') > -1) {
            var tizenVersionMatch = userAgent.match(/tizen\/([\d\.]+)/i);
            if (tizenVersionMatch && tizenVersionMatch[1]) {
                var tizenVersion = parseFloat(tizenVersionMatch[1]);
                if (tizenVersion >= 6.5) {
                    isSamsung2022orNewer = true;
                    window.isSamsung2022 = true;
                }
            }
        }
        if (!isSamsung2022orNewer) window.isSamsung2022 = false;
    } catch (e) {
        console.log("TV model detection error: " + e);
        window.isSamsung2022 = false;
    }

    // Keys & player
    try { initKeys(); } catch (_) {}
    initPlayer();

    // MAC persistence
    ensureMacAddressPersistence();

    // Load settings
    try { settings.initFromLocal(); } catch (_) {}

    // Language system
    console.log('LanguageManager integration starting...');
    if (window.LanguageManager && window.LanguageManager.applyTranslations) {
        setTimeout(function () {
            try {
                console.log('Applying translations if available');
                window.LanguageManager.applyTranslations();
            } catch (e) {
                console.warn('Translation update failed:', e);
            }
        }, 500);
    }

    // Parental
    try {
        var saved_parent_password = localStorage.getItem(storage_id + 'parent_account_password');
        parent_account_password = saved_parent_password != null ? saved_parent_password : parent_account_password;
    } catch (_) {}

    // Theme
    loadSavedThemeOnStartup();
    loadSavedTheme();

    // Samsung-only players visible
    $('#vod-series-player-video-lg').hide();
    $('#channel-page-video-lg').hide();

    // Initial banners
    setTimeout(function () {
        try {
            if (typeof updateDeviceInfoBanner === 'function') updateDeviceInfoBanner();
            if (typeof toggleDeviceInfoBanner === 'function') toggleDeviceInfoBanner(true);
        } catch (_) {}
    }, 1000);

    // Loading flow
    console.log('MAIN.JS: Starting login and playlist loading process...');
    console.log('MAIN.JS: Current app_loading state:', typeof app_loading === 'undefined' ? null : app_loading);
    console.log('MAIN.JS: Loading page visible:', $('#loading-page').is(':visible'));
    console.log('MAIN.JS: App visible:', $('#app').is(':visible'));

    try { showLoader(true); } catch (_) {}

    console.log('MAIN.JS: After showLoader(true) - app_loading:', typeof app_loading === 'undefined' ? null : app_loading);
    console.log('MAIN.JS: After showLoader(true) - loading visible:', $('#loading-page').is(':visible'));

    // login_page
    try {
        if (typeof login_page !== 'undefined' && login_page.getPlayListDetail) {
            console.log('MAIN.JS: login_page found, calling getPlayListDetail()');
            login_page.getPlayListDetail();
        } else {
            console.error('MAIN.JS: login_page or getPlayListDetail not found!');
            try { console.log('MAIN.JS: Available login_page methods:', Object.keys(login_page || {})); } catch (_) {}
        }
    } catch (_) {}

    // Emergency: force home after 8s if still loading
    setTimeout(function () {
        try {
            if (typeof app_loading !== 'undefined' && app_loading) {
                console.warn("EMERGENCY TIMEOUT (8s) - Forcing main page");
                console.log("Emergency state:", {
                    app_loading: app_loading,
                    loading_visible: $('#loading-page').is(':visible'),
                    app_visible: $('#app').is(':visible')
                });

                app_loading = false;
                if (typeof login_page !== 'undefined' && login_page.is_loading) login_page.is_loading = false;

                try { showLoader(false); } catch (_) {}
                $('#app').show();

                if (typeof home_page !== 'undefined' && home_page.init) {
                    console.log("Emergency: Calling home_page.init()");
                    home_page.init();
                }
                console.log("Emergency transition completed");
            } else {
                console.log("Loading completed within 8 seconds");
                // Force show app if still not visible
                if (!$('#app').is(':visible')) {
                    console.log("Forcing app to show after successful loading");
                    try { showLoader(false); } catch (_) {}
                    $('#app').show();
                }
            }
        } catch (e) {
            console.warn("Emergency block error:", e);
        }
    }, 8000);

    // Visibility (Samsung)
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            try { if (window.webapis && webapis.avplay) webapis.avplay.suspend(); } catch (_) {}
        } else {
            try { if (window.webapis && webapis.avplay) webapis.avplay.restore(); } catch (e) { console.log("Player restore error: " + e); }
        }
    });

    // Tizen 6.5+ appcontrol
    try {
        if (window.isSamsung2022) {
            document.addEventListener('appcontrol', function () {
                try {
                    var requestedAppControl = tizen.application.getCurrentApplication().getRequestedAppControl();
                    console.log("App control: ", requestedAppControl);
                } catch (e) {
                    console.log("App control error: " + e);
                }
            });
        }
    } catch (e) {
        console.log("Tizen event addition error: " + e);
    }

    // Keyboard focus flags
    var input_elements = document.getElementsByTagName('input');
    for (var i = 0; i < input_elements.length; i++) {
        var element = input_elements[i];
        element.addEventListener('focus', function () {
            try { show_keyboard = true; } catch (_) {}
        });
        element.addEventListener('blur', function () {
            try { show_keyboard = false; } catch (_) {}
        });
    }

    document.addEventListener('keydown', function (e) {
        // Key validation for TV
        if (!validateAndHandleKey(e)) return;

        if (platform === 'samsung') {
            try {
                if (e.keyCode == tvKey.EXIT) tizen.application.getCurrentApplication().exit();
                switch (e.keyCode) {
                    case 65376: // Done
                    case 65385: // Cancel
                        $('input').blur();
                        return;
                }
            } catch (_) {}
        }
        try { if (typeof app_loading !== 'undefined' && app_loading) return; } catch (_) {}

        console.log('Samsung TV Key Event:', {
            keyCode: e.keyCode,
            route: current_route,
            timestamp: Date.now()
        });

        try {
            switch (current_route) {
                case "login":                     login_page.HandleKey(e); break;
                case "home-page":                 home_page.HandleKey(e); break;
                case "channel-page":              channel_page.HandleKey(e); break;
                case "vod-series-page":           vod_series_page.HandleKey(e); break;
                case "vod-summary-page":          vod_summary_page.HandleKey(e); break;
                case "vod-series-player-video":   vod_series_player_page.HandleKey(e); break;
                case "trailer-page":              trailer_page.HandleKey(e); break;
                case "seasons-page":              seasons_variable.HandleKey(e); break;
                case "episode-page":              episode_variable.HandleKey(e); break;
                case "series-summary-page":       series_summary_page.HandleKey(e); break;
                case "playlist-page":             playlist_page.HandleKey(e); break;
                case "setting-page":              setting_page.HandleKey(e); break;
                case "parent-confirm-page":       parent_confirm_page.HandleKey(e); break;
                case "top-menu-page":             top_menu_page.HandleKey(e); break;
                case "turn-off-page":             turn_off_page.HandleKey(e); break;
                default:
                    console.warn('Unknown route for key handling:', current_route);
                    updateRoute('home-page');
                    home_page.HandleKey(e);
                    break;
            }
        } catch (error) {
            console.error('HandleKey error for route ' + current_route + ':', error);
            try {
                updateRoute('home-page');
                home_page.HandleKey(e);
            } catch (recoveryError) {
                console.error('Recovery HandleKey failed:', recoveryError);
            }
        }
    });

    updateCurrentTime();
    setInterval(function () { updateCurrentTime(); }, 30000);

    // Initial device info
    try { updateDeviceInfoBanner(); } catch (_) {}

    // Route & focus manager
    initRouteAndFocusManager();

    // Expose globals for UI
    window.refreshPlaylist = refreshPlaylist;
    window.updateDeviceInfoBanner = updateDeviceInfoBanner;
    window.toggleDeviceInfoBanner = toggleDeviceInfoBanner;
    window.openPlaylistPopup = openPlaylistPopup;
    window.closePlaylistPopup = closePlaylistPopup;
    window.selectPlaylist = selectPlaylist;

    // Transitions
    initPageTransitionListeners();

    // Colored key shortcuts
    setTimeout(function () { initHomePageNavigation(); }, 1000);
});

/* --------------------------- Keyboard IME ------------------------------ */
function keyboardVisibilityChange(event) {
    var visibility = event.detail && event.detail.visibility;
    if (visibility) {
        try { show_keyboard = true; } catch (_) {}
    } else {
        try { $('input').blur(); show_keyboard = false; } catch (_) {}
    }
}

/* -------------------- Samsung TV Route & Focus Manager ------------------- */
function initRouteAndFocusManager() {
    // Route synchronization for remote navigation
    window.updateRoute = function(newRoute, focusPart) {
        console.log('Samsung TV Route Update:', {
            from: current_route,
            to: newRoute,
            focus: focusPart || 'default'
        });

        current_route = newRoute;
    try { document.body.setAttribute('data-route', newRoute); } catch (_) {}

        // Reset focus states per route
        try {
            if (typeof home_page !== 'undefined' && home_page.keys) {
                home_page.keys.focused_part = focusPart || 'menu_selection';
            }
            if (typeof setting_page !== 'undefined' && setting_page.keys) {
                if (newRoute === 'setting-page') {
                    setting_page.keys.focused_part = focusPart || 'menu_selection';
                }
            }
            if (typeof top_menu_page !== 'undefined' && top_menu_page.keys) {
                if (newRoute === 'top-menu-page') {
                    top_menu_page.keys.focused_part = focusPart || 'menu_selection';
                }
            }
        } catch (error) {
            console.warn('Focus reset error:', error);
        }
    };

    // Key validation
    window.validateAndHandleKey = function(event) {
        if (platform === 'samsung') {
            if (!isKeyRegistered(event.keyCode)) {
                console.warn('Unregistered key pressed:', event.keyCode);
                return false;
            }
        }
        if (!current_route) {
            console.warn('No current route set, defaulting to home-page');
            current_route = 'home-page';
        }
        return true;
    };

    // Registered keys
    window.isKeyRegistered = function(keyCode) {
        if (typeof tvKey === 'undefined') return true; // Dev mode
        var registeredKeys = [
            tvKey.UP, tvKey.DOWN, tvKey.LEFT, tvKey.RIGHT,
            tvKey.UP_ALT, tvKey.DOWN_ALT, tvKey.LEFT_ALT, tvKey.RIGHT_ALT,
            tvKey.ENTER, tvKey.ENTER_ALT, tvKey.ENTER_ALT2,
            tvKey.RETURN, tvKey.RETURN_ALT,
            tvKey.RED, tvKey.GREEN, tvKey.YELLOW, tvKey.BLUE,
            tvKey.MENU, tvKey.EXIT, tvKey.INFO
        ];
        return registeredKeys.indexOf(keyCode) !== -1;
    };

    console.log('Samsung TV Route & Focus Manager initialized');
    try { document.body.setAttribute('data-route', (typeof current_route !== 'undefined' && current_route) ? current_route : 'home-page'); } catch (_) {}
}

/* -------------------------------- Theme System -------------------------------- */
function loadSavedTheme() {
    try {
        var savedTheme = localStorage.getItem('tvix_theme') || 'original_iptv';
        var validThemes = ['original_iptv', 'royal_purple'];
        if (validThemes.indexOf(savedTheme) === -1) {
            console.log('Invalid theme detected:', savedTheme, '- switching to default');
            savedTheme = 'original_iptv';
            localStorage.setItem('tvix_theme', savedTheme);
        }
        console.log('Loading home theme:', savedTheme);
        applyThemeToHomePage(savedTheme);
    } catch (e) {
        console.log('Theme loading error:', e);
        applyThemeToHomePage('original_iptv');
    }
}

function applyThemeToHomePage(themeId) {
    console.log('Applying home theme:', themeId);
    $('body').removeClass(function(index, className) {
        return (className.match(/(^|\s)theme-\S+/g) || []).join(' ');
    });
    $('body').addClass('theme-' + (themeId || 'original_iptv'));
    console.log('Home theme applied:', themeId);
}

function applyBasicTheme(themeId) {
    applyThemeToHomePage(themeId);
}

/* ---------------------- Device Info / Status Banner -------------------- */
function updateDeviceInfoBanner() {
    try {
        if (typeof mac_address !== 'undefined' && mac_address) {
            $('#main-mac-address').text(mac_address);
            $('.mac-address').text(mac_address);
            $('#user-account-mac-address').text(mac_address);
            console.log("UI MAC address updated:", mac_address);
        }

        updateDeviceStatus();

        var statusBadge = $('#main-status-badge');
        var statusText = $('#main-status-text');

        if (typeof is_trial !== 'undefined') {
            switch (is_trial) {
                case 0: statusBadge.removeClass().addClass('status-badge demo');    statusText.text(LanguageManager.getText('demo')); break;
                case 1: statusBadge.removeClass().addClass('status-badge trial');   statusText.text(LanguageManager.getText('trial')); break;
                case 2:
                case 3: statusBadge.removeClass().addClass('status-badge active');  statusText.text(LanguageManager.getText('active')); break;
                case 4: statusBadge.removeClass().addClass('status-badge expired'); statusText.text(LanguageManager.getText('expired')); break;
                default: statusBadge.removeClass().addClass('status-badge active');  statusText.text(LanguageManager.getText('active'));
            }
        } else {
            statusBadge.removeClass().addClass('status-badge active');
            statusText.text(LanguageManager.getText('active'));
        }

        $('#device-info-banner').fadeIn(300);
    } catch (error) {
        console.log('Device info banner update error:', error);
    }
}

function updateDeviceStatus() {
    try {
        var statusDot = $('#device-status-dot');

        if (typeof api_server !== 'undefined' && api_server && typeof mac_address !== 'undefined' && mac_address) {
            statusDot.removeClass('active inactive').addClass('checking');
            checkDeviceStatusFromAPI();
        } else {
            statusDot.removeClass('checking inactive').addClass('active');
        }
    } catch (error) {
        console.log('Device status update error:', error);
        $('#device-status-dot').removeClass('active checking').addClass('inactive');
    }
}

function checkDeviceStatusFromAPI() {
    try {
        setTimeout(function () {
            var statusDot = $('#device-status-dot');
            if (typeof is_trial !== 'undefined') {
                switch (is_trial) {
                    case 0:
                    case 1:
                        statusDot.removeClass('active inactive').addClass('checking');
                        break;
                    case 2:
                        statusDot.removeClass('inactive checking').addClass('active');
                        break;
                    case 3:
                        statusDot.removeClass('active checking').addClass('inactive');
                        break;
                    default:
                        statusDot.removeClass('inactive checking').addClass('active');
                }
            } else {
                statusDot.removeClass('inactive checking').addClass('active');
            }
        }, 1500);
    } catch (error) {
        console.log('API device status check error:', error);
        $('#device-status-dot').removeClass('active checking').addClass('inactive');
    }
}

/* --------------------------- Playlist Refresh -------------------------- */
function refreshPlaylist() {
    try {
        console.log('Ana sayfa playlist refresh başlatılıyor...');
        
        // Ana sayfadaki bottom bar butonunu hedefle
        var refreshBtn = $('.bottom-action-btn').first();
        var refreshIcon = refreshBtn.find('.home-refresh-btn');
        var refreshText = refreshBtn.find('span[data-word_code="update_list_text"]');

        // Buton stilini güncelle
        refreshBtn.css({ 'pointer-events': 'none', 'opacity': '0.7' });
        if (refreshIcon.length > 0) {
            refreshIcon.html('⏳');
        }
        if (refreshText.length > 0) {
            refreshText.text('Güncelleniyor...');
        }

        setTimeout(function () {
            try {
                // Login page üzerinden playlist yenile
                if (typeof login_page !== 'undefined' && typeof login_page.fetchPlaylistInformation === 'function') {
                    login_page.fetchPlaylistInformation();
                } else if (typeof login_page !== 'undefined' && typeof login_page.reloadApp === 'function') {
                    login_page.reloadApp();
                } else {
                    // Fallback: Sayfayı yenile
                    location.reload();
                    return;
                }

                // Başarılı güncelleme animasyonu
                setTimeout(function () {
                    if (refreshIcon.length > 0) {
                        refreshIcon.html('[OK]');
                    }
                    if (refreshText.length > 0) {
                        refreshText.text('Güncellendi!');
                    }
                    console.log('Playlist başarıyla güncellendi!');
                    
                    // Normal duruma geri dön
                    setTimeout(function () {
                        if (refreshIcon.length > 0) {
                            refreshIcon.html('[REFRESH]');
                        }
                        if (refreshText.length > 0) {
                            refreshText.text('Liste Güncelle');
                        }
                        refreshBtn.css({ 'pointer-events': 'auto', 'opacity': '1' });
                    }, 2000);
                }, 1000);

            } catch (refreshError) {
                console.error('Playlist güncelleme hatası:', refreshError);
                if (refreshIcon.length > 0) {
                    refreshIcon.html('[ERROR]');
                }
                if (refreshText.length > 0) {
                    refreshText.text('Hata!');
                }
                refreshBtn.css({ 'pointer-events': 'auto', 'opacity': '1' });
                
                // Hata durumunda sayfayı yenile
                setTimeout(function () { 
                    location.reload(); 
                }, 1500);
            }
        }, 500);

    } catch (error) {
        console.error('Refresh playlist fonksiyon hatası:', error);
        location.reload();
    }
}

/* ------------------------ Playlist Settings Shortcut ------------------- */
function goToPlaylistSettings() {
    try {
        console.log('Going to playlist settings page...');
        var playlistBtn = $('.playlist-fab');
        var playlistContainer = playlistBtn.closest('.fab-container');
        var originalIcon = playlistBtn.find('i');
        var frontLabel = playlistContainer.find('.fab-front-label');

        originalIcon.removeClass('fa-list').addClass('fa-spinner fa-spin');
        playlistBtn.css('pointer-events', 'none').css('opacity', '0.7');

        if (frontLabel.length > 0) {
            frontLabel.attr('data-word_code', 'loading_settings');
            if (window.LanguageManager && LanguageManager.updateTexts) LanguageManager.updateTexts();
        }

        setTimeout(function () {
            try {
                if (typeof top_menu_page !== 'undefined' && top_menu_page.handleMenuClick) {
                    $('#app').show();
                    $('.page-type-1').hide();
                    $('#page-container-1').show();

                    toggleBottomBar(false);
                    top_menu_page.hoverMenuItem(3);

                    setTimeout(function () {
                        top_menu_page.handleMenuClick();
                        setTimeout(function () {
                            try {
                                if (typeof setting_page !== 'undefined' &&
                                    setting_page.hoverSettingMenu &&
                                    setting_page.handleMenuClick) {

                                    setting_page.hoverSettingMenu(6);
                                    setTimeout(function () {
                                        setting_page.handleMenuClick(6);
                                        console.log('Playlist management opened successfully');
                                    }, 500);
                                } else {
                                    console.error('setting_page object or functions not found');
                                }
                            } catch (settingError) {
                                console.error('Settings page error:', settingError);
                            }
                        }, 1200);
                    }, 600);

                } else {
                    console.log('top_menu_page not found, using fallback');
                    window.location.hash = '#settings/playlist';
                }

                setTimeout(function () {
                    originalIcon.removeClass('fa-spinner fa-spin').addClass('fa-list');
                    if (frontLabel.length > 0) {
                        frontLabel.attr('data-word_code', 'change_playlist_text');
                        if (window.LanguageManager && LanguageManager.updateTexts) LanguageManager.updateTexts();
                    }
                    playlistBtn.css('pointer-events', 'auto').css('opacity', '1');
                }, 2000);

            } catch (error) {
                console.error('Playlist settings opening error:', error);
                originalIcon.removeClass('fa-spinner fa-spin').addClass('fa-list');
                if (frontLabel.length > 0) {
                    frontLabel.attr('data-word_code', 'change_playlist_text');
                    if (window.LanguageManager && LanguageManager.updateTexts) LanguageManager.updateTexts();
                }
                playlistBtn.css('pointer-events', 'auto').css('opacity', '1');
            }
        }, 500);

    } catch (error) {
        console.error('Playlist settings function error:', error);
    }
}

/* -------------------------- Home UI Visibility ------------------------- */
function toggleDeviceInfoBanner(show) {
    var banner = $('#device-info-banner');
    var refreshBtn = $('#refresh-button');
    var playlistBtn = $('#playlist-change-button');

    if (show) {
        banner.fadeIn(300);
        refreshBtn.fadeIn(300);
        playlistBtn.fadeIn(300);
    } else {
        banner.fadeOut(200);
        refreshBtn.fadeOut(200);
        playlistBtn.fadeOut(200);
    }
}

function toggleBottomBar(show) {
    var bottomBar = document.getElementById('elegant-bottom-bar');
    if (bottomBar) {
        bottomBar.style.display = show ? 'flex' : 'none';
        console.log('Bottom bar ' + (show ? 'shown' : 'hidden'));
    }
}

function toggleClock(show) {
    var clock = document.getElementById('top-right-clock');
    if (clock) {
        clock.style.display = show ? 'block' : 'none';
        console.log('Clock ' + (show ? 'shown' : 'hidden'));
    }
}

function toggleHomepageElements(show) {
    toggleBottomBar(show);
    toggleClock(show);
    var homeBar = document.getElementById('home-mac-address-container');
    if (homeBar) {
        homeBar.style.display = show ? 'flex' : 'none';
    }
}

function showHomepageElements() {
    $('.main-logo-container').show().css({ 'opacity': '1', 'visibility': 'visible' });
    $('#main-menu-container').show().removeClass('hide').css({
        'opacity': '1',
        'visibility': 'visible',
        'transform': 'translate(-50%, -50%)'
    });
    toggleHomepageElements(true);
    toggleDeviceInfoBanner(true);
    console.log('Home page elements shown');
}

function hideHomepageElements() {
    $('.main-logo-container').hide();
    $('#main-menu-container').hide().addClass('hide');
    toggleHomepageElements(false);
    toggleDeviceInfoBanner(false);
    console.log('Home page elements hidden');
}

/* --- ALWAYS VISIBLE HOME BOTTOM BAR WATCHDOG --- */
(function ensureHomeBottomBarPersistent(){
    var CHECK_INTERVAL = 1500;
    function forceShowHomeBottomBar(){
        try {
            if (typeof current_route === 'undefined') return;
            
            var el = document.getElementById('home-mac-address-container');
            if (!el) return;
            
            // SADECE ana sayfada ve top menu'de göster
            if (current_route === 'home-page' || current_route === 'top-menu-page') {
                var style = window.getComputedStyle(el);
                if (style.display === 'none' || el.offsetParent === null) {
                    el.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important; position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 100; align-items: center; justify-content: space-between; width: 90%; max-width: 1200px; height: 60px; background: rgba(25,48,75,.9); border-radius: 8px; border: 1px solid rgba(116,185,255,.3); padding: 0 20px;";
                    el.classList.remove('hide');
                    console.log('[Watchdog] Ana sayfa bottom bar zorla gösterildi');
                }
            } else {
                // DİĞER TÜM SAYFALARDA ZORLA GİZLE
                el.style.cssText = "display: none !important; visibility: hidden !important; opacity: 0 !important;";
                el.classList.add('hide');
                console.log('[Watchdog] Diğer sayfada bottom bar zorla gizlendi:', current_route);
            }
        } catch (e) { console.warn('Home bottom bar watchdog error', e); }
    }
    setInterval(forceShowHomeBottomBar, CHECK_INTERVAL);
    // İlk çalıştır
    setTimeout(forceShowHomeBottomBar, 100);
})();

/* ----------------------------- MAC Storage ----------------------------- */
function saveMacAddress(macAddr) {
    try {
        if (macAddr && macAddr !== '' && macAddr !== 'unknown') {
            localStorage.setItem('saved_mac_address', macAddr);
            sessionStorage.setItem('saved_mac_address', macAddr);
            console.log('MAC address saved:', macAddr);
            return true;
        }
    } catch (error) {
        console.log('MAC address save error:', error);
    }
    return false;
}

function loadSavedMacAddress() {
    try {
        var savedMac = localStorage.getItem('saved_mac_address');
        if (!savedMac || savedMac === '' || savedMac === 'unknown') {
            savedMac = sessionStorage.getItem('saved_mac_address');
        }
        if (savedMac && savedMac !== '' && savedMac !== 'unknown') {
            console.log('Saved MAC address loaded:', savedMac);
            return savedMac;
        }
    } catch (error) {
        console.log('Saved MAC address load error:', error);
    }
    return null;
}

function ensureMacAddressPersistence() {
    try {
        if (typeof mac_address !== 'undefined' && mac_address && mac_address !== 'unknown') {
            var savedMac = loadSavedMacAddress();
            if (!savedMac || savedMac !== mac_address) {
                saveMacAddress(mac_address);
            }
        } else {
            var saved = loadSavedMacAddress();
            if (saved) {
                mac_address = saved;
                console.log('MAC address restored:', mac_address);
            }
        }
    } catch (error) {
        console.log('MAC address persistence check error:', error);
    }
}

/* ----------------------------- Quick Info ------------------------------ */
function showQuickInfo() {
    try {
        var appName = (LanguageManager.getText && LanguageManager.getText('tvix_player')) || 'TvixPlayer';
        var statusText = (LanguageManager.getText && LanguageManager.getText('active')) || 'Active';
        var versionText = (LanguageManager.getText && LanguageManager.getText('app_version_full')) || 'TvixPlayer Pro V2';
        var macDisplay = typeof mac_address === 'string' && mac_address ? mac_address.substring(0, 8) + '...' : 'Samsung TV';

        var toast = $('#quick-info-toast');
        toast.find('.toast-title').text(appName);
        toast.find('.toast-details').html('<span>' + versionText + '</span> • <span>' + macDisplay + '</span>');
        toast.find('.toast-status-text').text(statusText);

        toast.show().addClass('show');

        setTimeout(function () { $('.toast-progress').addClass('animate'); }, 100);
        setTimeout(function () { closeQuickInfo(); }, 4000);

    } catch (error) {
        console.log('Quick info display error:', error);
    }
}

function closeQuickInfo() {
    try {
        $('#quick-info-toast').removeClass('show');
        setTimeout(function () { $('#quick-info-toast').hide(); }, 300);
    } catch (error) {
        console.log('Quick info close error:', error);
    }
}

/* -------------------------------- Clocks ------------------------------- */
function updateClocks() {
    try {
        var now = new Date();
        var userLocale = navigator.language || 'en-US';
        var timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        var dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };

        var leftTimeElement = document.getElementById('current-time');
        var leftDateElement = document.getElementById('current-date');
        if (leftTimeElement && leftDateElement) {
            leftTimeElement.textContent = now.toLocaleTimeString(userLocale, timeOptions);
            leftDateElement.textContent = now.toLocaleDateString(userLocale, dateOptions);
        }

        var rightTimeElement = document.getElementById('current-time-right');
        if (rightTimeElement) {
            rightTimeElement.textContent = now.toLocaleTimeString(userLocale, timeOptions);
        }

        var intlTimeElement = document.getElementById('intl-time');
        var intlDateElement = document.getElementById('intl-date');
        if (intlTimeElement && intlDateElement) {
            intlTimeElement.textContent = now.toLocaleTimeString(userLocale, timeOptions);
            intlDateElement.textContent = now.toLocaleDateString(userLocale, dateOptions);
        }
    } catch (error) {
        console.error('Clock update error:', error);
    }
}

/* ------------------------------ Page Show/Hide ------------------------- */
function showHomePage() {
    hideAllPages();
    var pc1 = document.getElementById('page-container-1');
    if (pc1) pc1.style.display = 'block';
    handlePageTransition(null);
}

function hideAllPages() {
    var pages = ['channel-page', 'vod-series-page', 'setting-page', 'vod-summary-page', 'series-summary-page', 'vod-series-player-page'];
    pages.forEach(function (pageId) {
        var page = document.getElementById(pageId);
        if (!page) return;
        page.style.display = 'none';
        page.classList.remove('active');
    });
}

function showPage(pageId) {
    hideAllPages();
    var targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.classList.add('active');
        handlePageTransition(targetPage);
    }
}

/* --------------------- Initial Home Decorations/Shortcuts -------------- */
document.addEventListener('DOMContentLoaded', function () {
    updateClocks();
    setInterval(updateClocks, 1000);
    initPageTransitionListeners();
    toggleHomepageElements(true); // show footer + clock on first load
});

/* -------------------------- Playlist Selection UI ---------------------- */
window.availablePlaylists = [];

function openPlaylistPopup() {
    console.log('Playlist seçim popup\'ı açılıyor...');
    var popup = document.getElementById('playlist-selection-popup');
    if (!popup) { 
        console.error('Playlist popup elementi bulunamadı'); 
        return; 
    }
    
    popup.classList.remove('hide');
    popup.style.display = 'flex';
    
    // Playlist listesini yükle
    loadAvailablePlaylists();
    
    // Klavye olaylarını dinle
    document.addEventListener('keydown', handlePopupKeyPress);
    
    // Popup açıldığında odağı ayarla
    setTimeout(function() {
        var firstPlaylistItem = popup.querySelector('.playlist-item');
        if (firstPlaylistItem) {
            firstPlaylistItem.focus();
        }
    }, 100);
}

function closePlaylistPopup() {
    console.log('Playlist popup closing...');
    var popup = document.getElementById('playlist-selection-popup');
    if (popup) popup.classList.add('hide');
    document.removeEventListener('keydown', handlePopupKeyPress);
}

function handlePopupKeyPress(event) {
    console.log('Popup key pressed:', event.keyCode);
    var keyCode = event.keyCode || event.which;

    switch (keyCode) {
        case 27:    // ESC
        case 8:     // Backspace
        case 10009: // Samsung RETURN
        case 65385: // Samsung CANCEL
            closePlaylistPopup();
            event.preventDefault();
            break;

        case 13:    // Enter
        case 29443: // Samsung ENTER
        case 65376: // Samsung OK
            var firstItem = document.querySelector('.playlist-item');
            if (firstItem && firstItem.onclick) firstItem.click();
            event.preventDefault();
            break;

        case 38:    // UP
        case 1:     // Samsung UP
        case 40:    // DOWN
        case 2:     // Samsung DOWN
            // Navigation can be added later
            event.preventDefault();
            break;
    }
}

function loadAvailablePlaylists() {
    console.log('Mevcut playlist\'ler yükleniyor...');
    var container = document.getElementById('playlist-list-container');
    if (!container) {
        console.error('Playlist list container bulunamadı');
        return;
    }

    // Yükleme animasyonu göster
    container.innerHTML =
        '<div class="playlist-loading">' +
        '<div class="loading-spinner">⏳</div>' +
        '<h4>Playlist\'ler yükleniyor...</h4>' +
        '</div>';

    setTimeout(function () {
        // Mevcut playlist verilerini al
        var playlists = getStoredPlaylists();
        console.log('Yüklenen playlist\'ler:', playlists);
        
        if (playlists.length === 0) {
            // Playlist bulunamadı, varsayılan liste göster
            console.warn('Playlist bulunamadı, varsayılan liste gösteriliyor...');
            playlists = [
                {
                    id: 'current',
                    name: 'Mevcut Playlist',
                    url: (settings && settings.playlist && settings.playlist.url) || 'Bilinmiyor',
                    isActive: true,
                    status: 'active'
                }
            ];
        }
        
        displayPlaylistList(playlists);
    }, 300);
}

function debugPlaylistData() {
    console.log('=== PLAYLIST DEBUG ===');
    console.log('playlist_urls variable:', typeof playlist_urls, playlist_urls);
    console.log('settings.playlist_id:', settings ? settings.playlist_id : 'settings undefined');

    var storedUrls = localStorage.getItem(storage_id + 'playlist_urls');
    console.log('localStorage playlist_urls:', storedUrls);

    if (typeof PlaylistManagerIPTV !== 'undefined') {
        console.log('PlaylistManagerIPTV available');
        var manager = new PlaylistManagerIPTV();
        console.log('PlaylistManager instance:', manager);
    }

    if (typeof settings !== 'undefined' && settings.getPlaylists) {
        console.log('settings.getPlaylists():', settings.getPlaylists());
    }
    console.log('=== END PLAYLIST DEBUG ===');
}

function getSafeDisplayUrlShort(url) {
    if (!url || url === 'N/A') return 'N/A';
    try {
        if (url.length > 50) return url.substring(0, 47) + '...';
        return url;
    } catch (e) {
        return 'N/A';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function goToPlaylistSettings() {
    console.log('Navigating to playlist settings...');
    closePlaylistPopup();
    if (typeof setting_page !== 'undefined' && setting_page.init) {
        setting_page.init();
    }
}

function getStoredPlaylists() {
    try {
        console.log('Getting stored playlists...');

        if (typeof playlist_urls !== 'undefined' && playlist_urls && playlist_urls.length > 0) {
            console.log('Using playlist_urls data:', playlist_urls);
            return playlist_urls.map(function (playlist, index) {
                var isCurrentActive = (playlist.id == settings.playlist_id);
                var playlistName = playlist.name || playlist.title || playlist.playlist_name || playlist.label || ("Playlist " + (index + 1));
                var playlistUrl = playlist.url || playlist.m3u_url || playlist.playlist_url || playlist.link || 'N/A';
                return { id: playlist.id, name: playlistName, url: playlistUrl, isActive: isCurrentActive, status: 'active' };
            });
        }

        var storedUrls = localStorage.getItem(storage_id + 'playlist_urls');
        if (storedUrls) {
            try {
                var parsed = JSON.parse(storedUrls);
                if (Object.prototype.toString.call(parsed) === '[object Array]' && parsed.length > 0) {
                    console.log('Using localStorage playlist_urls data:', parsed);
                    return parsed.map(function (playlist, index) {
                        var isCurrentActive = (playlist.id == settings.playlist_id);
                        var playlistName = playlist.name || playlist.title || playlist.playlist_name || playlist.label || ("Playlist " + (index + 1));
                        var playlistUrl = playlist.url || playlist.m3u_url || playlist.playlist_url || playlist.link || 'N/A';
                        return { id: playlist.id, name: playlistName, url: playlistUrl, isActive: isCurrentActive, status: 'active' };
                    });
                }
            } catch (e) {
                console.warn('localStorage playlist_urls parse failed:', e);
            }
        }

        if (typeof settings !== 'undefined' && settings.playlist && settings.playlist.playlist_name) {
            console.log('Using single playlist from settings:', settings.playlist);
            return [{
                id: settings.playlist.id || 'current',
                name: settings.playlist.playlist_name || 'Current Playlist',
                url: settings.playlist.url || settings.playlist.m3u_url || 'N/A',
                isActive: true,
                status: 'active'
            }];
        }

        if (typeof PlaylistManagerIPTV !== 'undefined') {
            try {
                var manager = new PlaylistManagerIPTV();
                var allPlaylists = manager.getAllPlaylists();
                if (allPlaylists && allPlaylists.length > 0) {
                    console.log('Using PlaylistManagerIPTV data:', allPlaylists);
                    return allPlaylists.map(function (playlist, index) {
                        var isCurrentActive = (playlist.id == settings.playlist_id);
                        return {
                            id: playlist.id || index,
                            name: playlist.name || ("Playlist " + (index + 1)),
                            url: playlist.url || 'N/A',
                            isActive: isCurrentActive,
                            status: 'active'
                        };
                    });
                }
            } catch (e) {
                console.warn('PlaylistManagerIPTV failed:', e);
            }
        }

        console.warn('No playlist data found - returning empty array');
        return [];
    } catch (error) {
        console.error('Playlists loading error:', error);
        return [];
    }
}

function displayPlaylistList(playlists) {
    var container = document.getElementById('playlist-list-container');
    if (!container) {
        console.error('playlist-list-container not found, trying alternative selector');
        container = document.querySelector('.playlist-list-container');
        if (!container) {
            console.error('No playlist container found at all');
            return;
        }
    }

    console.log('Displaying playlists:', playlists);

    if (!playlists || playlists.length === 0) {
        container.innerHTML =
            '<div class="playlist-empty-state">' +
            '  <i class="fas fa-list"></i>' +
            '  <h4 data-word_code="no_playlists_found">No Playlists Found</h4>' +
            '  <p data-word_code="add_playlist_message">Please add a playlist in settings</p>' +
            '  <button onclick="debugPlaylistData()" style="margin-top: 10px; padding: 8px 16px; background: rgba(116, 185, 255, 0.2); border: 1px solid rgba(116, 185, 255, 0.4); border-radius: 4px; color: white; cursor: pointer;">Debug Playlist Data</button>' +
            '</div>';
        return;
    }

    var html = '';
    playlists.forEach(function (playlist) {
        var activeClass = playlist.isActive ? 'active' : '';
        var statusClass = playlist.status === 'active' ? 'active' : 'inactive';
        var statusText = playlist.status === 'active' ? 'Online' : 'Offline';
        var safeUrl = getSafeDisplayUrlShort(playlist.url);
        var displayName = escapeHtml(playlist.name || ('Playlist ' + playlist.id));

        html += '<div class="playlist-item ' + activeClass + '" onclick="selectPlaylist(\'' + playlist.id + '\')">';
        html += '  <div class="playlist-item-info">';
        html += '    <div class="playlist-item-name">' + displayName + '</div>';
        html += '    <div class="playlist-item-url" title="' + escapeHtml(safeUrl) + '">' + safeUrl + '</div>';
        html += '  </div>';
        html += '  <div class="playlist-item-status">';
        html += '    <span class="playlist-status-badge ' + statusClass + '">' + statusText + '</span>';
        if (playlist.isActive) {
            html += '    <i class="fas fa-check-circle" style="color: #2ecc71;"></i>';
        }
        html += '  </div>';
        html += '</div>';
    });

    container.innerHTML = html;
    console.log('Playlist list rendered successfully');

    if (window.LanguageManager && LanguageManager.applyTranslations) {
        LanguageManager.applyTranslations(container);
    }
}

function selectPlaylist(playlistId) {
    console.log('Selecting playlist: ' + playlistId);
    try {
        var availablePlaylists = getStoredPlaylists();
        var selectedPlaylist = null;
        for (var i = 0; i < availablePlaylists.length; i++) {
            if (availablePlaylists[i].id == playlistId) {
                selectedPlaylist = availablePlaylists[i];
                break;
            }
        }
        if (!selectedPlaylist) { console.error('Selected playlist not found:', playlistId); return; }

        var items = document.querySelectorAll('.playlist-item');
        for (var j = 0; j < items.length; j++) {
            items[j].classList.remove('active');
            var checkIcon = items[j].querySelector('.fa-check-circle');
            if (checkIcon) checkIcon.parentNode.removeChild(checkIcon);
        }

        var selectedItem = document.querySelector('[onclick="selectPlaylist(\'' + playlistId + '\')"]');
        if (selectedItem) {
            selectedItem.classList.add('active');
            var statusDiv = selectedItem.querySelector('.playlist-item-status');
            if (statusDiv && !statusDiv.querySelector('.fa-check-circle')) {
                statusDiv.insertAdjacentHTML('beforeend', '<i class="fas fa-check-circle" style="color: #2ecc71; margin-left: 8px;"></i>');
            }
        }

        if (typeof setting_page !== 'undefined' && setting_page.selectPlaylist) {
            console.log('Using real playlist switching system...');
            var playlistIndex = -1;
            if (typeof playlist_urls !== 'undefined' && playlist_urls) {
                for (var k = 0; k < playlist_urls.length; k++) {
                    if (playlist_urls[k].id == playlistId) { playlistIndex = k; break; }
                }
            }
            if (playlistIndex >= 0) {
                setTimeout(function () {
                    closePlaylistPopup();
                    showPlaylistChangeMessage(selectedPlaylist.name);
                    setting_page.selectPlaylist(playlistId);
                }, 500);
            } else {
                console.error('Playlist index not found:', playlistId);
            }
        } else {
            console.warn('setting_page.selectPlaylist not found, using fallback');
            updateActivePlaylistFallback(playlistId, selectedPlaylist);
            setTimeout(function () {
                closePlaylistPopup();
                showPlaylistChangeMessage(selectedPlaylist.name);
                setTimeout(function () { location.reload(); }, 1000);
            }, 500);
        }
    } catch (error) {
        console.error('Playlist selection error:', error);
    }
}

function updateActivePlaylistFallback(playlistId, selectedPlaylist) {
    try {
        if (typeof settings !== 'undefined') {
            settings.playlist_id = playlistId;
            settings.playlist = selectedPlaylist;
            settings.saveSettings('playlist_id', playlistId, '');
            settings.saveSettings('playlist', selectedPlaylist, 'array');
        }
        console.log('Fallback playlist updated: ' + playlistId);
    } catch (error) {
        console.error('Fallback playlist update error:', error);
    }
}

function showPlaylistChangeMessage(playlistName) {
    if (typeof showToast === 'function') {
        showToast('Playlist changed: ' + playlistName, 'success');
    } else {
        console.log('Playlist changed: ' + playlistName);
    }
}

/* ----------------------------- URL Masking ----------------------------- */
function maskUrlForSecurity(url) {
    if (!url || typeof url !== 'string') return 'N/A';
    try {
        var cleanUrl = url.replace(/^https?:\/\//, '');
        cleanUrl = cleanUrl.split(':')[0];
        cleanUrl = cleanUrl.split('/')[0];
        cleanUrl = cleanUrl.split('?')[0];
        if (cleanUrl.indexOf('@') > -1) {
            var parts = cleanUrl.split('@');
            cleanUrl = parts[parts.length - 1];
        }
        if (cleanUrl.length <= 5) {
            return cleanUrl.substring(0, 3) + '**';
        }
        var visibleLength = 3;
        if (cleanUrl.length > 10) visibleLength = 4;
        if (cleanUrl.length > 15) visibleLength = 5;
        var visiblePart = cleanUrl.substring(0, visibleLength);
        var maskedLength = cleanUrl.length - visibleLength;
        var maskedPart = new Array(Math.min(maskedLength, 10) + 1).join('*');
        return visiblePart + maskedPart;
    } catch (error) {
        console.warn('URL masking error:', error);
        return '***';
    }
}

function maskPort(port) {
    if (!port || port === '80' || port === '443') return '';
    if (port.length <= 2) return ':' + port.charAt(0) + '*';
    return ':' + port.charAt(0) + new Array(port.length).join('*');
}

function maskCredentialsInUrl(url) {
    if (!url || typeof url !== 'string') return url;
    try {
        var urlPattern = /^(https?:\/\/)([^:]+):([^@]+)@(.+)$/;
        var match = url.match(urlPattern);
        if (match) {
            var protocol = match[1], username = match[2], password = match[3], domain = match[4];
            var maskedUsername = username.length > 2 ? username.substring(0, 2) + new Array(Math.min(username.length - 1, 6)).join('*') : '***';
            var maskedPassword = new Array(Math.min(password.length, 8) + 1).join('*');
            return protocol + maskedUsername + ':' + maskedPassword + '@' + domain;
        }
        return url;
    } catch (error) {
        console.warn('Credential masking error:', error);
        return url;
    }
}

function getSafeDisplayUrl(url) {
    if (!url || typeof url !== 'string') return 'N/A';
    var maskedUrl = maskCredentialsInUrl(url);
    try {
        var urlObj = new URL(maskedUrl);
        var maskedDomain = maskUrlForSecurity(urlObj.hostname);
        var maskedPort = maskPort(urlObj.port);
        var protocol = urlObj.protocol;
        var pathInfo = urlObj.pathname && urlObj.pathname !== '/' ? '/***' : '';
        return protocol + '//' + maskedDomain + maskedPort + pathInfo;
    } catch (error) {
        return maskUrlForSecurity(maskedUrl);
    }
}

/* -------------------------- New Content Detect ------------------------- */
function detectAndUpdateNewContent() {
    console.log('Detecting new content in M3U playlist...');
    try {
        if (typeof VodModel !== 'undefined' && VodModel.categories) {
            var vodCategories = VodModel.getCategories(false, false);
            for (var i = 0; i < vodCategories.length; i++) {
                var category = vodCategories[i];
                if (category.movies && category.movies.length > 0) {
                    var recentMovies = [];
                    for (var m = 0; m < category.movies.length; m++) {
                        var movie = category.movies[m];
                        var addedDate = movie.added_timestamp || movie.tse || movie.added_date || movie.added;
                        if (!addedDate) continue;
                        var movieTime = (typeof addedDate === 'string') ? (parseInt(addedDate, 10) * (addedDate.length === 10 ? 1000 : 1)) : parseInt(addedDate, 10);
                        var oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                        if (movieTime > oneDayAgo) recentMovies.push(movie);
                    }
                    if (recentMovies.length > 0) {
                        console.log('Found ' + recentMovies.length + ' new movies in category: ' + category.category_name);
                    }
                }
            }
        }

        if (typeof SeriesModel !== 'undefined' && SeriesModel.categories) {
            var seriesCategories = SeriesModel.getCategories(false, false);
            for (var j = 0; j < seriesCategories.length; j++) {
                var sc = seriesCategories[j];
                if (sc.movies && sc.movies.length > 0) {
                    var recentSeries = [];
                    for (var s = 0; s < sc.movies.length; s++) {
                        var series = sc.movies[s];
                        var sAdded = series.added_timestamp || series.tse || series.added_date || series.added;
                        if (!sAdded) continue;
                        var seriesTime = (typeof sAdded === 'string') ? (parseInt(sAdded, 10) * (sAdded.length === 10 ? 1000 : 1)) : parseInt(sAdded, 10);
                        var oneDayAgoS = Date.now() - (24 * 60 * 60 * 1000);
                        if (seriesTime > oneDayAgoS) recentSeries.push(series);
                    }
                    if (recentSeries.length > 0) {
                        console.log('Found ' + recentSeries.length + ' new series in category: ' + sc.category_name);
                    }
                }
            }
        }

        if (typeof vod_series_page !== 'undefined') {
            if (vod_series_page.current_category &&
                (vod_series_page.current_category.category_id === 'all' ||
                 vod_series_page.current_category.category_name === 'All' ||
                 vod_series_page.current_category.category_name === 'All Movies')) {
                vod_series_page.selectCategory(vod_series_page.current_category);
            }
        }
    } catch (error) {
        console.error('Error detecting new content:', error);
    }
}

function onPlaylistRefreshComplete() {
    console.log('Playlist refresh completed, checking for new content...');
    setTimeout(function () { detectAndUpdateNewContent(); }, 1000);
}

/* ------------------- Samsung TV Home Navigation Shortcuts -------------- */
function initHomePageNavigation() {
    console.log('Samsung TV Home Page Navigation System initialized');
    if (typeof home_page === 'undefined') return;

    var originalHandleKey = home_page.HandleKey;
    home_page.HandleKey = function (e) {
        try {
            switch (e.keyCode) {
                case tvKey.RED:
                    if (typeof refreshPlaylist === 'function') refreshPlaylist();
                    break;
                case tvKey.GREEN:
                    if (typeof goToPlaylistSettings === 'function') goToPlaylistSettings();
                    break;
                case tvKey.BLUE:
                    if (typeof showQuickInfo === 'function') showQuickInfo();
                    break;
                case tvKey.YELLOW:
                    if (typeof openPlaylistPopup === 'function') openPlaylistPopup();
                    break;
                default:
                    if (originalHandleKey) originalHandleKey.call(this, e);
                    break;
            }
        } catch (err) {
            if (originalHandleKey) originalHandleKey.call(this, e);
        }
    };
    console.log('Samsung TV home page navigation enhanced');
}

/* --------------------------- Theme On Startup -------------------------- */
function loadSavedThemeOnStartup() {
    try {
        var savedTheme = localStorage.getItem(storage_id + 'selected_theme');
        if (savedTheme && savedTheme !== 'default') {
            var themeClass = savedTheme.indexOf('theme-') === 0 ? savedTheme : 'theme-' + savedTheme;
            $('body').addClass(themeClass);
            console.log('Startup theme loaded:', savedTheme, 'class:', themeClass);
        }
    } catch (e) {
        console.error('Theme loading error:', e);
    }
}

/* ---------------------------------------------------------------------- */
