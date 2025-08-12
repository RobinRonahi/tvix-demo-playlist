"use strict";

/**
 * top_menu.js (Samsung TV uyumlu / güçlendirilmiş)
 * - tvKey yoksa güvenli tuş şeması
 * - DOM referansları güvenli güncelleme
 * - Home UI görünürlük/yenileme garanti
 * - page_objects yoksa sayfa gizleme fallback
 * - Medya player ve timer'lar güvenli kapanış
 * - Alt butonlar (bottom bar) için focus ve tıklama mantığı
 * - Route yönetimi ve loglama
 * - 3 noktalı loading animasyonu her geçişte garanti aç/kapa
 */

(function () {

  // ----- Key Map -----
  var hasTvKey = (typeof window !== "undefined" && typeof window.tvKey !== "undefined");
  var KEY = hasTvKey ? window.tvKey : {
    UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13, RETURN: 10009,
    UP_ALT: 38, DOWN_ALT: 40, LEFT_ALT: 37, RIGHT_ALT: 39,
    ENTER_ALT: 13, ENTER_ALT2: 13, RETURN_ALT: 27
  };

  // ----- Globals -----
  if (typeof window.current_route === "undefined") window.current_route = "home-page";
  if (typeof window.prev_focus_dom === "undefined") window.prev_focus_dom = null;

  function safe$() { return (typeof window.$ === "function") ? window.$ : null; }
  var $ = safe$();

  // ----- Loading Dots -----
  function ensureLoadingDotsExists() {
    if (!document.getElementById('loading-dots-overlay')) {
      var overlay = document.createElement('div');
      overlay.id = 'loading-dots-overlay';
      overlay.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
      overlay.style.display = 'none';
      document.body.appendChild(overlay);
    }
  }
  ensureLoadingDotsExists();
  // CSS kodları loader.css dosyasına taşındı
  function showLoadingDots() {
    var ld = document.getElementById('loading-dots-overlay');
    if (ld) ld.style.display = 'flex';
  }
  function hideLoadingDots() {
    var ld = document.getElementById('loading-dots-overlay');
    if (ld) ld.style.display = 'none';
  }

  // ----- Utility -----
  function safeShow(sel) { var el = document.querySelector(sel); if (el) el.style.display = ""; }
  function safeHide(sel) { var el = document.querySelector(sel); if (el) el.style.display = "none"; }
  function toggleHomeBasics(show) {
    if (show) {
      safeShow(".main-logo-container");
      safeShow("#main-menu-container");
      safeShow("#home-mac-address-container");
      safeShow("#home-info-panel");
      safeShow(".home-bottom-bar");
      try {
        var epg = document.querySelector('.fullscreen-epg-overlay');
        if (epg) { epg.style.display = 'none'; epg.classList.remove('show'); epg.classList.remove('hide'); }
      } catch (_) {}
      try {
        var modal = document.getElementById('channel-search-modal');
        if (modal) modal.classList.remove('active');
      } catch (_) {}
      if (typeof toggleDeviceInfoBanner === "function") toggleDeviceInfoBanner(true);
      if (typeof toggleHomepageElements === "function") toggleHomepageElements(true);
    } else {
      safeHide(".main-logo-container");
      safeHide("#main-menu-container");
      safeHide("#home-mac-address-container");
      safeHide("#home-info-panel");
      safeHide(".home-bottom-bar");
      if (typeof toggleDeviceInfoBanner === "function") toggleDeviceInfoBanner(false);
      if (typeof toggleHomepageElements === "function") toggleHomepageElements(false);
    }
  }

  function hideAllKnownPages() {
    var ids = [
      "#channel-page", "#vod-series-page", "#setting-page",
      "#vod-summary-page", "#series-summary-page", "#vod-series-player-page",
      "#page-container-1"
    ];
    ids.forEach(function (sel) { safeHide(sel); });
  }

  function hideByRoute(route) {
    try {
      if (typeof window.page_objects !== "undefined" && window.page_objects[route]) {
        $(window.page_objects[route]).addClass('hide');
        return;
      }
    } catch (_) {}
    switch (route) {
      case 'channel-page':         safeHide('#channel-page'); break;
      case 'vod-series-page':      safeHide('#vod-series-page'); break;
      case 'setting-page':         safeHide('#setting-page'); break;
      case 'vod-summary-page':     safeHide('#vod-summary-page'); break;
      case 'series-summary-page':  safeHide('#series-summary-page'); break;
    }
  }

  // ----- Main Menu Object -----
  var top_menu_page = {
    keys: {
      focused_part: "menu_selection",
      menu_selection: 0,
      bottom_selection: 0
    },

    menu_doms: $ ? $('.menu-grid .menu-item-container .menu-item') : [],
    bottom_button_doms: $ ? $('.bottom-action-btn') : [],
    sub_route: '',
    is_drawing: false,

    ensureHomeRefresh: function () {
      try {
        var __prev = (typeof current_route !== 'undefined') ? current_route : undefined;
        toggleHomeBasics(true);
        if (typeof home_page !== 'undefined' && typeof home_page.reEnter === 'function') {
          home_page.reEnter();
        }
        if (typeof __prev !== 'undefined') current_route = __prev;
      } catch (e) {
        console.error('ensureHomeRefresh error:', e);
      }
    },

    init: function () {
      try {
        current_route = 'top-menu-page';
        safeHide('#loading-page');
        safeHide('#login-container');
        safeShow('#app');
        this.refreshDomReferences();
        var that = this;
        setTimeout(function () { that.hoverMenuItem(0); }, 100);
        this.showHomepageElementsSafely();
        this.ensureHomeRefresh();
        if (this.bottom_button_doms && this.bottom_button_doms.length === 0) {
          this.refreshDomReferences();
        }
      } catch (e) {
        console.error('Top menu init error:', e);
        setTimeout(function () { if (window.top_menu_page) window.top_menu_page.init(); }, 1000);
      }
    },

    showHomepageElementsSafely: function () {
      try {
        if (typeof showHomepageElements === 'function') {
          showHomepageElements();
        } else {
          toggleHomeBasics(true);
        }
        safeShow('#home-mac-address-container');
        safeShow('#home-info-panel');
        safeShow('.home-bottom-bar');
        this.ensureHomeRefresh();
      } catch (e) {
        console.error('Error showing homepage elements:', e);
      }
    },

    forceHideHomepageUI: function () {
      [
        '#main-menu-container', '#home-mac-address-container', '#home-info-panel',
        '.home-bottom-bar', '#top-right-clock', '.main-logo-container', '.top-buttons-bar'
      ].forEach(function (sel) { safeHide(sel); });
    },

    goBack: function () {
      if (this.keys.focused_part === "menu_selection") {
        try {
          if (typeof turn_off_page !== 'undefined' && typeof turn_off_page.init === 'function') {
            turn_off_page.init(current_route);
          }
        } catch (e) { console.warn('turn_off_page init failed:', e); }
      }
    },

    hoverMenuItem: function (index) {
      try {
        this.keys.focused_part = "menu_selection";
        this.keys.menu_selection = index;
        if ($ && this.menu_doms && this.menu_doms[index]) {
          if (prev_focus_dom) $(prev_focus_dom).removeClass('active');
          prev_focus_dom = this.menu_doms[index];
          $(this.menu_doms[index]).addClass('active');
        }
        current_route = 'top-menu-page';
      } catch (e) {
        console.error('Hover menu item error:', e);
        this.refreshDomReferences();
      }
    },

    refreshDomReferences: function () {
      try {
        if (!$) return;
        this.menu_doms = $('.menu-grid .menu-item-container .menu-item');
        this.bottom_button_doms = $('.bottom-action-btn');
        console.log('DOM referansları güncellendi - Ana menü:', this.menu_doms.length, 'Alt buton:', this.bottom_button_doms.length);
      } catch (e) {
        console.error('Error refreshing DOM references:', e);
      }
    },

    handleMenuClick: function () {
      showLoadingDots(); // Her zaman başlangıçta aç
      var self = this;
      var safeHideDots = function() { try { hideLoadingDots(); } catch(_){} };
      try {
        var keys = this.keys;
        var sub_route = this.sub_route;
        if (sub_route === 'channel-page' && keys.menu_selection !== 0) {
          this.safelyCloseMediaPlayer();
          this.clearChannelTimers();
        }
        if (keys.focused_part !== "menu_selection") {
          this.keys.focused_part = "menu_selection";
        }

        switch (keys.menu_selection) {
          case 0: // live tv
            if (sub_route !== 'channel-page') {
              this.hideCurrentPage(sub_route);
              this.hideHomepageElementsSafely();
              this.forceHideHomepageUI();
              this.sub_route = 'channel-page';
              safeShow('#channel-page');
              if ($) $('#channel-page .player-container .video-loader').show();
              var that = this;
              requestAnimationFrame(function () {
                try {
                  if (typeof channel_page !== 'undefined' && typeof channel_page.init === 'function') {
                    channel_page.init();
                  }
                } catch (e) {
                  safeHideDots();
                  throw e;
                } finally {
                  setTimeout(function () {
                    if ($) $('#channel-page .player-container .video-loader').hide();
                    safeHideDots();
                  }, 300);
                }
              });
            } else {
              safeHideDots();
            }
            break;

          case 1: // movies
          case 2: // series
            var movie_type = (keys.menu_selection === 1) ? 'vod' : 'series';
            var isSeries = keys.menu_selection === 2;
            if (sub_route !== 'vod-series-page' || (sub_route === 'vod-series-page' && window.vod_series_page && vod_series_page.current_movie_type !== movie_type)) {
              this.hideCurrentPage(sub_route);
            }
            if (sub_route === 'vod-summary-page' && keys.menu_selection === 1) {
              if (window.vod_summary_page && typeof vod_summary_page.goBack === 'function') {
                vod_summary_page.goBack();
              }
              safeHideDots();
              return;
            }
            if (sub_route === 'series-summary-page' && isSeries) {
              if (window.series_summary_page && typeof series_summary_page.goBack === 'function') {
                series_summary_page.goBack();
              }
              safeHideDots();
              return;
            }
            this.hideHomepageElementsSafely();
            this.sub_route = 'vod-series-page';
            // Asenkron init varsa callback ile hideDots
            if (window.vod_series_page && typeof vod_series_page.init === 'function') {
              var cb = function(){ safeHideDots(); };
              // Eğer init callback alıyorsa, ver. Yoksa sonra hideDots.
              if (vod_series_page.init.length >= 2) {
                vod_series_page.init(movie_type, null, cb);
              } else if (vod_series_page.init.length === 2) {
                vod_series_page.init(movie_type, cb);
              } else {
                vod_series_page.init(movie_type);
                setTimeout(cb, 350);
              }
            } else {
              setTimeout(safeHideDots, 350);
            }
            break;

          case 3: // settings
            if (sub_route !== 'setting-page') {
              this.hideCurrentPage(sub_route);
              this.hideHomepageElementsSafely();
              this.sub_route = 'setting-page';
              if (typeof setting_page !== 'undefined' && typeof setting_page.init === 'function') {
                setting_page.init();
                setTimeout(function () {
                  try { if (typeof setting_page.updateDomReferences === 'function') setting_page.updateDomReferences(); } catch(_) {}
                  safeHideDots();
                }, 500);
              } else {
                safeHideDots();
              }
            } else {
              safeHideDots();
            }
            break;

          case 4: // exit
            safeHideDots();
            this.goBack();
            break;

          default:
            safeHideDots();
            break;
        }
      } catch (e) {
        safeHideDots(); // Her türlü hata durumunda da hide çağrılır
        console.error('Handle menu click error:', e);
      }
    },

    onMenuItemClick: function(index) {
      try {
        if (typeof index === 'number') {
          this.hoverMenuItem(index);
        }
        this.keys.focused_part = 'menu_selection';
        this.handleMenuClick();
      } catch (e) {
        hideLoadingDots();
        console.error('onMenuItemClick error:', e);
      }
    },

    safelyCloseMediaPlayer: function () {
      try {
        if (typeof media_player !== 'undefined' && media_player && typeof media_player.close === 'function') {
          media_player.close();
        }
      } catch (e) {
        console.error('Error closing media player:', e);
      }
    },

    clearChannelTimers: function () {
      try {
        if (typeof channel_page !== 'undefined') {
          if (channel_page.progressbar_timer) clearInterval(channel_page.progressbar_timer), channel_page.progressbar_timer = null;
          if (channel_page.full_screen_timer) clearTimeout(channel_page.full_screen_timer), channel_page.full_screen_timer = null;
          if (channel_page.next_channel_timer) clearTimeout(channel_page.next_channel_timer), channel_page.next_channel_timer = null;
        }
      } catch (e) {
        console.error('Error clearing channel timers:', e);
      }
    },

    hideCurrentPage: function (sub_route) {
      try {
        if (!sub_route) { hideAllKnownPages(); return; }
        hideByRoute(sub_route);
      } catch (e) {
        console.error('Error hiding current page:', e);
      }
    },

    hideHomepageElementsSafely: function () {
      try {
        if (typeof hideHomepageElements === 'function') {
          hideHomepageElements();
        } else {
          toggleHomeBasics(false);
        }
      } catch (e) {
        console.error('Error hiding homepage elements:', e);
      }
    },

    handleMenuLeftRight: function (increment) {
      var keys = this.keys;
      if (keys.focused_part === "menu_selection") {
        if (!this.menu_doms || !this.menu_doms.length) this.refreshDomReferences();
        var len = (this.menu_doms && this.menu_doms.length) ? this.menu_doms.length : 5;
        keys.menu_selection += increment;
        if (keys.menu_selection < 0) keys.menu_selection = len - 1;
        if (keys.menu_selection >= len) keys.menu_selection = 0;
        this.hoverMenuItem(keys.menu_selection);
        console.log('Ana menü sol/sağ navigasyon, seçim:', keys.menu_selection);
      } else if (keys.focused_part === "bottom_buttons") {
        if (!this.bottom_button_doms || !this.bottom_button_doms.length) this.refreshDomReferences();
        var blen = (this.bottom_button_doms && this.bottom_button_doms.length) ? this.bottom_button_doms.length : 2;
        keys.bottom_selection += increment;
        if (keys.bottom_selection < 0) keys.bottom_selection = blen - 1;
        if (keys.bottom_selection >= blen) keys.bottom_selection = 0;
        this.hoverBottomButton(keys.bottom_selection);
        console.log('Alt buton sol/sağ navigasyon, seçim:', keys.bottom_selection);
      }
    },

    handleMenusUpDown: function (increment) {
      var keys = this.keys;
      if (keys.focused_part === "menu_selection") {
        if (increment > 0) {
          if (this.bottom_button_doms && this.bottom_button_doms.length > 0) {
            keys.focused_part = "bottom_buttons";
            keys.bottom_selection = 0;
            this.hoverBottomButton(0);
            console.log('Ana menüden alt butonlara geçiş');
          }
        }
      } else if (keys.focused_part === "bottom_buttons") {
        if (increment < 0) {
          keys.focused_part = "menu_selection";
          this.hoverMenuItem(keys.menu_selection);
          console.log('Alt butonlardan ana menüye geçiş');
        }
      }
    },

    hoverBottomButton: function (index) {
      var keys = this.keys;
      if (!this.bottom_button_doms || index < 0 || index >= this.bottom_button_doms.length) return;
      keys.focused_part = "bottom_buttons";
      keys.bottom_selection = index;
      if ($ && prev_focus_dom) $(prev_focus_dom).removeClass('active');
      if ($ && this.bottom_button_doms[index]) {
        $(this.bottom_button_doms[index]).addClass('active');
        prev_focus_dom = this.bottom_button_doms[index];
        console.log('Alt buton odağı:', index);
      }
      current_route = 'top-menu-page';
    },

    handleBottomButtonClick: function () {
      var keys = this.keys;
      if (keys.focused_part !== "bottom_buttons" || keys.bottom_selection < 0) return;
      console.log('Alt buton tıklandı, index:', keys.bottom_selection);
      switch (keys.bottom_selection) {
        case 0:
          console.log('Liste güncelleme başlatılıyor');
          if (typeof refreshPlaylist === 'function') refreshPlaylist();
          else console.log('refreshPlaylist fonksiyonu bulunamadı');
          break;
        case 1:
          console.log('Playlist popup açılıyor');
          if (typeof openPlaylistPopup === 'function') openPlaylistPopup();
          else console.log('openPlaylistPopup fonksiyonu bulunamadı');
          break;
      }
    },

    HandleKey: function (e) {
      try {
        console.log('Top Menu Key Event:', {
          keyCode: e.keyCode,
          focused_part: this.keys.focused_part,
          menu_selection: this.keys.menu_selection,
          route: current_route
        });
        if (current_route !== 'home-page' && current_route !== 'top-menu-page') {
          if (typeof updateRoute === 'function') updateRoute('home-page', 'menu_selection');
          current_route = 'top-menu-page';
        }
        if (this.is_drawing) return;
        var isUp     = (e.keyCode === KEY.UP || e.keyCode === KEY.UP_ALT);
        var isDown   = (e.keyCode === KEY.DOWN || e.keyCode === KEY.DOWN_ALT);
        var isLeft   = (e.keyCode === KEY.LEFT || e.keyCode === KEY.LEFT_ALT);
        var isRight  = (e.keyCode === KEY.RIGHT || e.keyCode === KEY.RIGHT_ALT);
        var isEnter  = (e.keyCode === KEY.ENTER || e.keyCode === KEY.ENTER_ALT || e.keyCode === KEY.ENTER_ALT2);
        var isReturn = (e.keyCode === KEY.RETURN || e.keyCode === KEY.RETURN_ALT);

        if (isRight) {
          this.handleMenuLeftRight(1);
        } else if (isLeft) {
          this.handleMenuLeftRight(-1);
        } else if (isDown) {
          this.handleMenusUpDown(1);
        } else if (isUp) {
          this.handleMenusUpDown(-1);
        } else if (isEnter) {
          if (this.keys.focused_part === "menu_selection") this.handleMenuClick();
          else if (this.keys.focused_part === "bottom_buttons") this.handleBottomButtonClick();
        } else if (isReturn) {
          this.goBack();
        }
      } catch (error) {
        hideLoadingDots();
        console.error('Top Menu HandleKey error:', error);
      }
    },

    goToMovies: function () {
      console.log('goToMovies çağrıldı');
      try {
        this.keys.menu_selection = 1;
        this.keys.focused_part = "menu_selection";
        this.hoverMenuItem(1);
        this.handleMenuClick();
      } catch (e) {
        hideLoadingDots();
        console.error('goToMovies error:', e);
      }
    },

    goToSeries: function () {
      console.log('goToSeries çağrıldı');
      try {
        this.keys.menu_selection = 2;
        this.keys.focused_part = "menu_selection";
        this.hoverMenuItem(2);
        this.handleMenuClick();
      } catch (e) {
        hideLoadingDots();
        console.error('goToSeries error:', e);
      }
    },

    autoRecovery: function () {
      try {
        this.refreshDomReferences();
        if (!this.keys || typeof this.keys.menu_selection === 'undefined') {
          this.keys = { focused_part: "menu_selection", menu_selection: 0, bottom_selection: 0 };
        }
        if (this.menu_doms && this.keys.menu_selection >= this.menu_doms.length) this.keys.menu_selection = 0;
        if (this.bottom_button_doms && this.keys.bottom_selection >= this.bottom_button_doms.length) this.keys.bottom_selection = 0;
        this.hoverMenuItem(this.keys.menu_selection);
      } catch (e) {
        hideLoadingDots();
        console.error('Auto recovery error:', e);
        setTimeout(function () {
          if (typeof top_menu_page !== 'undefined') top_menu_page.init();
        }, 2000);
      }
    }
  };

  // ----- Bootstrap & Watchdogs -----
  if (typeof document !== "undefined") {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof window.top_menu_page !== 'undefined') {
        window.top_menu_page.menu_doms = $ ? $('.menu-grid .menu-item-container .menu-item') : [];
        window.top_menu_page.bottom_button_doms = $ ? $('.bottom-action-btn') : [];
        console.log('DOMContentLoaded - Ana menü elemanları:',
          (window.top_menu_page.menu_doms ? window.top_menu_page.menu_doms.length : 0),
          'Alt butonlar:',
          (window.top_menu_page.bottom_button_doms ? window.top_menu_page.bottom_button_doms.length : 0)
        );
        setInterval(function () {
          try {
            if (typeof window.top_menu_page !== 'undefined' && current_route === 'top-menu-page') {
              if (!$ || !window.top_menu_page.menu_doms || window.top_menu_page.menu_doms.length === 0 ||
                  !window.top_menu_page.bottom_button_doms || window.top_menu_page.bottom_button_doms.length === 0) {
                window.top_menu_page.autoRecovery();
              }
            }
          } catch (_) {}
        }, 5000);
      }
    });

    window.addEventListener('beforeunload', function () {
      try {
        if (typeof window.top_menu_page !== 'undefined') {
          window.top_menu_page.clearChannelTimers();
          window.top_menu_page.safelyCloseMediaPlayer();
        }
      } catch (e) {
        hideLoadingDots();
        console.error('Cleanup error:', e);
      }
    });
  }

  window.top_menu_page = top_menu_page;
})();