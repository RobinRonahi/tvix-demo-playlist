"use strict";

var turn_off_page = (function () {
  // internal state
  var _bound = false;
  var _visible = false;

  // güvenli key haritası (tvKey yoksa fallback)
  var KEY = (function () {
    try {
      if (typeof window !== "undefined" && window.tvKey) return window.tvKey;
    } catch (_) {}
    return {
      LEFT: 37,
      RIGHT: 39,
      UP: 38,
      DOWN: 40,
      ENTER: 13,
      RETURN: 10009,
      EXIT: 10009,
      PLAYPAUSE: 10252
    };
  })();

  var api = {
    keys: {
      focused_part: "menu_selection", // yalnızca menü
      menu_selection: 0
    },
    menu_doms: null,
    prev_route: "",
    movie: null,

    // ---- lifecycle ----
    init: function (prev_route) {
      if (_visible) return; // yinelenen init'i engelle
      this.prev_route = prev_route || (typeof current_route !== "undefined" ? current_route : "home-page");
      if (typeof current_route !== "undefined") current_route = "turn-off-page";

      // Ana sayfa bottom bar'ını gizle
      $("#home-mac-address-container").hide();
      try { var el = document.getElementById('home-mac-address-container'); if (el) el.style.display = 'none'; } catch(_) {}

      // DOM referansları
      this.menu_doms = $("#turn-off-modal button");
      if (!this.menu_doms || this.menu_doms.length === 0) {
        console.warn("turn_off_page: '#turn-off-modal button' bulunamadı. Modal DOM'unuzu kontrol edin.");
      }

      // ARIA / erişilebilirlik
      $("#turn-off-modal").attr({ role: "dialog", "aria-modal": "true" });
      this.menu_doms.attr({ role: "button", tabindex: "-1", "aria-selected": "false" });

      // varsayılan seçim
      this.keys.focused_part = "menu_selection";
      this.keys.menu_selection = 0;
      this.hoverMenuItem(0);

      // modal aç
      _visible = true;
      try {
        $("#turn-off-modal").modal("show");
      } catch (_) {
        $("#turn-off-modal").show();
      }

      // bootstrap kapanışına cleanup bağla (varsa)
      try {
        $("#turn-off-modal").off("hidden.bs.modal.turnOff").on("hidden.bs.modal.turnOff", function () {
          api.destroy();
        });
      } catch (_) {
        // bootstrap yoksa sorun değil
      }

      // tıklama ile tetikleme
      $("#turn-off-modal").off("click.turnOff").on("click.turnOff", "button", function () {
        var i = api.menu_doms.index(this);
        if (i >= 0) {
          api.hoverMenuItem(i);
          api.handleMenuClick();
        }
      });

      // klavye bağla (tek sefer)
      if (!_bound) bindKeyboard();
      // debug opsiyonel
      setTimeout(function () {
        api.initializeSamsungTVModal();
      }, 100);
    },

    // tüm eventleri sök + görünürlüğü kapat
    destroy: function () {
      this.cleanup();
      try {
        $("#turn-off-modal").modal("hide");
      } catch (_) {
        $("#turn-off-modal").hide();
      }
      _visible = false;
      this.menu_doms = null;
      if (typeof current_route !== "undefined") current_route = this.prev_route || "home-page";
    },

    cleanup: function () {
      $(document).off(".turnOffModal");
      $("#turn-off-modal").off(".turnOff");
      try {
        $("#turn-off-modal").off("hidden.bs.modal.turnOff");
      } catch (_) {}
      _bound = false;
    },

    // ---- navigation ----
    goBack: function () {
      this.destroy();
    },

    hoverMenuItem: function (index) {
      if (!this.menu_doms || this.menu_doms.length === 0) return;

      // döngüsel index
      if (index < 0) index = this.menu_doms.length - 1;
      if (index >= this.menu_doms.length) index = 0;
      this.keys.menu_selection = index;
      this.keys.focused_part = "menu_selection";

      this.menu_doms.removeClass("active tv-focus samsung-tv-focused").attr("aria-selected", "false");
      var $btn = $(this.menu_doms[index]).addClass("active tv-focus samsung-tv-focused").attr("aria-selected", "true");

      // minimal css güvenliği
      this.menu_doms.css({ transform: "none", "will-change": "auto", "z-index": "1", transition: "none" });

      try { $btn.focus(); } catch (_) {}
      // görünür alan içine al
      try { $btn[0].scrollIntoView({ block: "center", inline: "center" }); } catch (_) {}
    },

    handleMenuClick: function () {
      if (!this.menu_doms || this.menu_doms.length === 0) return;
      var i = this.keys.menu_selection;

      // 0: Cancel, 1: Exit (varsayılan sıralama)
      if (i === 1) {
        // çıkış
        try {
          if (window.tizen && tizen.application) {
            tizen.application.getCurrentApplication().exit();
            return;
          }
        } catch (e) {
          console.log("Tizen exit error:", e);
        }
        // web fallback: modalı kapat
        this.destroy();
      } else {
        // Cancel
        this.goBack();
      }
    },

    handleMenusUpDown: function (_inc) { /* bu modal için gerek yok */ },

    handleMenuLeftRight: function (inc) {
      if (this.keys.focused_part !== "menu_selection") return;
      this.hoverMenuItem(this.keys.menu_selection + inc);
    },

    HandleKey: function (e) {
      // haricen çağırmak isteyen sayfalar için
      var c = e.keyCode, K = KEY;
      if (c === K.RIGHT) this.handleMenuLeftRight(1);
      else if (c === K.LEFT) this.handleMenuLeftRight(-1);
      else if (c === K.ENTER) this.handleMenuClick();
      else if (c === K.RETURN) this.goBack();
    },

    // ---- diagnostics (opsiyonel) ----
    debugSamsungTVState: function () {
      console.group("Samsung TV Debug State");
      console.log("📍 Focused Part:", this.keys.focused_part);
      console.log("Menu Selection:", this.keys.menu_selection);
      console.log("🖥️ DOM Elements:", {
        modal: document.getElementById("turn-off-modal"),
        buttons: (this.menu_doms && this.menu_doms.length) || 0,
        modalVisible: $("#turn-off-modal").is(":visible")
      });
      console.groupEnd();
    },

    monitorSamsungTVPerformance: function () {
      try {
        if (window.performance && window.performance.memory) {
          var m = window.performance.memory;
          console.log("Samsung TV Performance:", {
            usedJSHeapSize: Math.round(m.usedJSHeapSize / 1048576) + "MB",
            totalJSHeapSize: Math.round(m.totalJSHeapSize / 1048576) + "MB",
            jsHeapSizeLimit: Math.round(m.jsHeapSizeLimit / 1048576) + "MB",
            memoryUsage: Math.round((m.usedJSHeapSize / m.jsHeapSizeLimit) * 100) + "%"
          });
        }
      } catch (_) {}
    },

    testSamsungTVKeys: function () {
      var list = [37, 39, 13, 27, 4, 5, 29443, 10009];
      list.forEach(function (code) {
        console.log("Key", code, {
          isLeft: code === KEY.LEFT,
          isRight: code === KEY.RIGHT,
          isOK: code === KEY.ENTER,
          isReturn: code === KEY.RETURN
        });
      });
    },

    initializeSamsungTVModal: function () {
      this.debugSamsungTVState();
      this.testSamsungTVKeys();
      this.monitorSamsungTVPerformance();
      if (typeof this.keys.menu_selection === "undefined") {
        this.keys.menu_selection = 0;
        this.keys.focused_part = "menu_selection";
      }
      this.hoverMenuItem(this.keys.menu_selection);
      console.log("Samsung TV Modal initialization complete");
    }
  };

  // ---- private: keyboard binding ----
  function bindKeyboard() {
    $(document).off(".turnOffModal");

    $(document).on("keydown.turnOffModal", function (e) {
      if (typeof current_route === "undefined" || current_route !== "turn-off-page") return;

      var K = KEY, c = e.keyCode;
      // yalnız ilgili tuşları yakala
      if (c === K.LEFT || c === K.RIGHT || c === K.ENTER || c === K.RETURN) {
        e.preventDefault(); e.stopPropagation();
      }

      if (c === K.RIGHT) api.handleMenuLeftRight(1);
      else if (c === K.LEFT) api.handleMenuLeftRight(-1);
      else if (c === K.ENTER) api.handleMenuClick();
      else if (c === K.RETURN) api.goBack();
    });

    _bound = true;
  }

  return api;
})();
