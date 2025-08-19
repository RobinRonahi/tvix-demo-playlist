"use strict";

var trailer_page = {
  player: null,
  back_url: "home-page",
  is_paused: false,
  is_loading: false,
  _boundDocKeyHandler: null,
  _ytReadyCheckTimer: null,
  _autoHideTimer: null,

  // Güvenli tvKey haritası
  KEY: (function () {
    var hasTvKey = typeof window !== "undefined" && typeof window.tvKey !== "undefined";
    return hasTvKey ? window.tvKey : {
      UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13, RETURN: 10009,
      ENTER_ALT: 13, ENTER_ALT2: 13, RETURN_ALT: 27
    };
  })(),

  // ID ya da URL'den videoId çıkar
  _resolveVideoId: function (input) {
    if (!input) return "";
    // ID gibi görünüyorsa direkt dön (11 karakterli, alfasayısal/alt çizgi/-)
    if (/^[\w\-]{10,}$/.test(input) && !/^https?:\/\//i.test(input)) return input;

    try {
      var u = new URL(input);
      // youtu.be/<id>
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.replace(/^\//, "");
      }
      // youtube.com/watch?v=<id>
      var v = u.searchParams.get("v");
      if (v) return v;
      // /shorts/<id> veya /embed/<id>
      var m = u.pathname.match(/\/(embed|shorts)\/([\w\-]+)/);
      if (m && m[2]) return m[2];
    } catch (_) {}
    return input; // son çare
  },

  _ensureLoader: function (show) {
    try {
      if (typeof showLoader === "function") showLoader(!!show);
      else {
        var el = document.getElementById("global-loader");
        if (el) el.style.display = show ? "" : "none";
      }
    } catch (_) {}
  },

  // Modern trailer UI başlatma fonksiyonu
  _initTrailerUI: function() {
    var self = this;
    var container = document.getElementById("trailer-player-page");
    if (!container) return;

    // Temizle önce
    var existingControls = document.getElementById("trailer-controls");
    var existingInfo = document.getElementById("trailer-info");
    var existingBack = container.querySelector(".trailer-back-button");
    
    if (existingControls) existingControls.remove();
    if (existingInfo) existingInfo.remove();
    if (existingBack) existingBack.remove();

    // Modern kontrol overlay oluştur
    var controlsOverlay = document.createElement("div");
    controlsOverlay.className = "trailer-controls-overlay";
    controlsOverlay.id = "trailer-controls";
    
    var controlButtons = document.createElement("div");
    controlButtons.className = "trailer-control-buttons";
    controlButtons.innerHTML = 
      '<div class="trailer-control-btn" onclick="trailer_page.seekTo(-10)" title="10s Geri">' +
        '<i class="fas fa-backward"></i>' +
      '</div>' +
      '<div class="trailer-control-btn play-pause" onclick="trailer_page.playOrPause()" title="Oynat/Duraklat">' +
        '<i class="fas fa-play" id="trailer-play-icon"></i>' +
      '</div>' +
      '<div class="trailer-control-btn" onclick="trailer_page.seekTo(10)" title="10s İleri">' +
        '<i class="fas fa-forward"></i>' +
      '</div>';
    
    controlsOverlay.appendChild(controlButtons);

    // Info overlay oluştur
    var infoOverlay = document.createElement("div");
    infoOverlay.className = "trailer-info-overlay";
    infoOverlay.id = "trailer-info";
    infoOverlay.innerHTML = 
      '<div class="trailer-title" id="trailer-title">Film Fragmanı</div>' +
      '<div class="trailer-subtitle" id="trailer-subtitle">Yükleniyor...</div>';

    // Geri butonu oluştur
    var backButton = document.createElement("div");
    backButton.className = "trailer-back-button";
    backButton.onclick = function() { self.goBack(); };
    backButton.innerHTML = '<i class="fas fa-times"></i>';

    // Elementleri sayfaya ekle
    container.appendChild(controlsOverlay);
    container.appendChild(infoOverlay);
    container.appendChild(backButton);

    // Auto-hide timer başlat
    this._startAutoHideTimer();
  },

  // Otomatik gizleme timer'ı
  _startAutoHideTimer: function() {
    var self = this;
    clearTimeout(this._autoHideTimer);
    this._autoHideTimer = setTimeout(function() {
      self._hideTrailerUI();
    }, 5000); // 5 saniye sonra gizle
  },

  // UI göster
  _showTrailerUI: function() {
    var controls = document.getElementById("trailer-controls");
    var info = document.getElementById("trailer-info");
    if (controls) controls.classList.remove("hide");
    if (info) info.classList.remove("hide");
    this._startAutoHideTimer();
  },

  // UI gizle
  _hideTrailerUI: function() {
    var controls = document.getElementById("trailer-controls");
    var info = document.getElementById("trailer-info");
    if (controls) controls.classList.add("hide");
    if (info) info.classList.add("hide");
  },

  init: function (urlOrId, prev_route) {
    this._ensureLoader(true);
    this.is_loading = true;
    this.back_url = prev_route || "home-page";
    this.is_paused = false;

    // Ana sayfa bottom bar'ını gizle
    $("#home-mac-address-container").hide();
    try { var el = document.getElementById('home-mac-address-container'); if (el) el.style.display = 'none'; } catch(_) {}

    // sayfa geçişleri
    try { document.getElementById("vod-summary-page")?.classList.add("hide"); } catch (_) {}
    try { document.getElementById("series-summary-page")?.classList.add("hide"); } catch (_) {}
    document.getElementById("trailer-player-page")?.classList.remove("hide");
    document.getElementById("trailer-player-page")?.setAttribute("style","display:block");
    if (typeof current_route !== "undefined") current_route = "trailer-page";

    // container'ı tazele (eski iframe kalsın istemeyiz)
    var container = document.getElementById("trailer-player-page");
    var slot = document.getElementById("trailer-player");
    if (!slot) {
      var div = document.createElement("div");
      div.id = "trailer-player";
      container && container.appendChild(div);
    } else {
      slot.innerHTML = ""; // temiz slot
    }

    // Modern trailer UI başlatma
    this._initTrailerUI();

    var videoId = this._resolveVideoId(urlOrId);

    // YT API hazır değilse bekle
    var self = this;
    var startWhenReady = function () {
      if (!window.YT || !YT.Player) return false;

      // Player oluştur
      self.player = new YT.Player("trailer-player", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,          // kontroller kapalı
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          disablekb: 1,         // YouTube iç klavye kısayollarını kapat
          playsinline: 1
        },
        events: {
          onReady: self.onPlayerReady.bind(self),
          onStateChange: self.onPlayerStateChange.bind(self),
          onError: function (e) {
            console.error("YT error:", e);
            self._ensureLoader(false);
            self.is_loading = false;
          }
        }
      });

      // Belge-level key handler (iframe focus sorunlarına karşı)
      self._bindDocumentKeys();
      return true;
    };

    // API hazırsa hemen, değilse aralıkla dene
    if (!startWhenReady()) {
      var tries = 0;
      this._ytReadyCheckTimer && clearInterval(this._ytReadyCheckTimer);
      this._ytReadyCheckTimer = setInterval(function () {
        tries++;
        if (startWhenReady() || tries > 40) { // ~8sn
          clearInterval(self._ytReadyCheckTimer);
          self._ytReadyCheckTimer = null;
          if (tries > 40) {
            console.warn("YouTube API not ready in time");
            self._ensureLoader(false);
            self.is_loading = false;
          }
        }
      }, 200);
    }
  },

  _bindDocumentKeys: function () {
    var self = this;
    if (this._boundDocKeyHandler) {
      document.removeEventListener("keydown", this._boundDocKeyHandler, true);
    }
    this._boundDocKeyHandler = function (e) {
      if (typeof current_route !== "undefined" && current_route !== "trailer-page") return;
      // bazı TV'lerde event iframe'e gider; capture=true ile yakala
      var K = self.KEY;
      var code = e.keyCode;

      // UI'yi göster
      self._showTrailerUI();

      if ([K.LEFT, K.RIGHT, K.ENTER, K.ENTER_ALT, K.ENTER_ALT2, K.RETURN, K.RETURN_ALT].includes(code)) {
        e.preventDefault(); e.stopPropagation();
      }

      if (code === K.RETURN || code === K.RETURN_ALT) self.goBack();
      else if (code === K.RIGHT) self.seekTo(10);
      else if (code === K.LEFT) self.seekTo(-10);
      else if (code === K.ENTER || code === K.ENTER_ALT || code === K.ENTER_ALT2) self.playOrPause();
    };
    document.addEventListener("keydown", this._boundDocKeyHandler, true);
  },

  _unbindDocumentKeys: function () {
    if (this._boundDocKeyHandler) {
      document.removeEventListener("keydown", this._boundDocKeyHandler, true);
      this._boundDocKeyHandler = null;
    }
  },

  goBack: function () {
    try {
      if (this.player && this.player.stopVideo) this.player.stopVideo();
    } catch (_) {}

    // player destroy + temizlik
    try {
      if (this.player && this.player.destroy) this.player.destroy();
    } catch (_) {}
    this.player = null;
    this._unbindDocumentKeys();
    if (this._ytReadyCheckTimer) {
      clearInterval(this._ytReadyCheckTimer);
      this._ytReadyCheckTimer = null;
    }
    if (this._autoHideTimer) {
      clearTimeout(this._autoHideTimer);
      this._autoHideTimer = null;
    }

    // UI restore
    var page = document.getElementById("trailer-player-page");
    if (page) {
      page.style.display = "none";
      // container'ı sıfırla
      page.innerHTML = '<div id="trailer-player"></div>';
    }

    if (typeof current_route !== "undefined") current_route = this.back_url || "home-page";

    if (this.back_url === "vod-summary-page") {
      document.getElementById("vod-summary-page")?.classList.remove("hide");
    } else if (this.back_url === "series-summary-page") {
      document.getElementById("series-summary-page")?.classList.remove("hide");
    } else if (this.back_url === "home-page") {
      // Ana sayfa elemanlarını geri getir
      try {
        if (typeof top_menu_page !== "undefined" && top_menu_page.ensureHomeRefresh) {
          top_menu_page.ensureHomeRefresh();
        }
      } catch (_) {}
    }
  },

  onPlayerReady: function (event) {
    try { event.target.playVideo(); } catch (_) {}
    this._ensureLoader(false);
    this.is_loading = false;
    this.is_paused = false;
    
    // Play icon'unu pause'a çevir
    var playIcon = document.getElementById("trailer-play-icon");
    if (playIcon) {
      playIcon.className = "fas fa-pause";
    }
  },

  onPlayerStateChange: function (event) {
    // Play/pause ikonunu güncelle
    var playIcon = document.getElementById("trailer-play-icon");
    if (playIcon && event.data !== undefined) {
      if (event.data === 1) { // playing
        playIcon.className = "fas fa-pause";
        this.is_paused = false;
      } else if (event.data === 2) { // paused
        playIcon.className = "fas fa-play";
        this.is_paused = true;
      }
    }
    
    // İstersen oynatma bittiğinde geri dön:
    // if (event.data === YT.PlayerState.ENDED) this.goBack();
  },

  seekTo: function (step) {
    if (!this.player || !this.player.getCurrentTime) return;
    var current_time = this.player.getCurrentTime() || 0;
    var duration = (this.player.getDuration && this.player.getDuration()) || 0;
    var new_time = current_time + step;
    if (new_time < 0) new_time = 0;
    if (duration && new_time > duration) new_time = duration;
    try { this.player.seekTo(new_time, true); } catch (_) {}
    
    // UI'yi göster
    this._showTrailerUI();
  },

  playOrPause: function () {
    if (!this.player) return;
    try {
      if (this.is_paused) this.player.playVideo();
      else this.player.pauseVideo();
      this.is_paused = !this.is_paused;
    } catch (_) {}
    
    // UI'yi göster
    this._showTrailerUI();
  },

  HandleKey: function (e) {
    if (this.is_loading) return;
    var K = this.KEY;
    var code = e.keyCode;

    // UI'yi göster
    this._showTrailerUI();

    if (code === K.RETURN || code === K.RETURN_ALT) {
      this.goBack();
    } else if (code === K.RIGHT) {
      this.seekTo(10);
    } else if (code === K.LEFT) {
      this.seekTo(-10);
    } else if (code === K.ENTER || code === K.ENTER_ALT || code === K.ENTER_ALT2) {
      this.playOrPause();
    }
  }
};
