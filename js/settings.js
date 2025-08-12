"use strict";

/**
 * settings.js
 * - localStorage güvenli erişim
 * - type normalization (number/bool)
 * - i18n destekli sort etiketleri
 * - playlist objesini JSON olarak yükleme/kaydetme
 * - fallback ve migration desteği
 */

var settings = (function () {
  // Güvenli localStorage yardımcıları
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  // Geçerli anahtarlar / varsayılanlar
  var DEFAULTS = {
    bg_img_url: "",
    playlist_id: 0,
    playlist: {},            // JSON saklanır
    playlist_type: "",       // geleceğe hazır
    vod_sort: "number",      // "a-z", "z-a", "rating", "number", "added"
    series_sort: "number",
    live_sort: "default",    // "default" / "a-z" / ...
    language: "en",
    time_format: "24"        // "12" | "24"
  };

  // İzinli sort anahtarları
  var SORT_KEYS = ["added", "number", "rating", "a-z", "z-a", "default"];

  // i18n destekli label haritası (LanguageManager varsa onu kullan)
  function getSortLabels() {
    // LanguageManager yoksa sabit İngilizce fallback
    var t = function (k, d) {
      try {
        if (window.LanguageManager && LanguageManager.getText) {
          var val = LanguageManager.getText(k);
          return val || d;
        }
      } catch(_) {}
      return d;
    };
    return {
      added:  t("sort_added")  || "Added",
      number: t("sort_number") || "Number",
      rating: t("sort_rating") || "Rating",
      "a-z":  t("sort_a_z")    || "A-Z",
      "z-a":  t("sort_z_a")    || "Z-A",
      "default": t("sort_default") || "Default"
    };
  }

  // key adları tek yerde oluşturulsun
  function k(name) { return (window.storage_id || "") + name; }

  // JSON parse güvenli
  function tryParse(json, fallback) {
    if (!json) return fallback;
    try { return JSON.parse(json); } catch(_) { return fallback; }
  }

  // dil kodunu normalize et (tr-TR -> tr)
  function normalizeLang(code) {
    if (!code || typeof code !== "string") return "en";
    return code.toLowerCase().split("-")[0];
  }

  // sort key normalize
  function normalizeSort(val, fallback) {
    if (!val || SORT_KEYS.indexOf(val) === -1) return fallback;
    return val;
  }

  var api = {
    // Public: etiket haritası
    get sort_keys() {
      return getSortLabels();
    },

    // Aktif değerler
    bg_img_url: DEFAULTS.bg_img_url,
    playlist_id: DEFAULTS.playlist_id,
    playlist: DEFAULTS.playlist,
    playlist_type: DEFAULTS.playlist_type,

    vod_sort: DEFAULTS.vod_sort,
    series_sort: DEFAULTS.series_sort,
    live_sort: DEFAULTS.live_sort,

    language: DEFAULTS.language,
    time_format: DEFAULTS.time_format,

    /**
     * LocalStorage'dan yükle & normalize et
     */
    initFromLocal: function () {
      // Arka plan
      var temp = lsGet(k("bg_img_url"));
      if (temp) this.bg_img_url = temp;

      // playlist_id sayı olarak
      temp = lsGet(k("playlist_id"));
      if (temp !== null && temp !== undefined) {
        var pid = parseInt(temp, 10);
        this.playlist_id = Number.isFinite(pid) ? pid : DEFAULTS.playlist_id;
      } else {
        this.playlist_id = DEFAULTS.playlist_id;
      }

      // playlist (JSON)
      var plStr = lsGet(k("playlist"));
      if (plStr) {
        this.playlist = tryParse(plStr, DEFAULTS.playlist);
      }

      // playlist_type
      temp = lsGet(k("playlist_type"));
      if (temp) this.playlist_type = temp;

      // Sortlar
      var keys = ["vod_sort", "series_sort", "live_sort"];
      var self = this;
      keys.forEach(function (key) {
        var v = lsGet(k(key));
        if (v) self[key] = normalizeSort(v, DEFAULTS[key] || "number");
      });

      // Dil
      temp = lsGet(k("language"));
      if (temp) {
        this.language = normalizeLang(temp);
      } else {
        // navigator.language fallback
        if (typeof navigator !== "undefined" && navigator.language) {
          this.language = normalizeLang(navigator.language);
        } else {
          this.language = DEFAULTS.language;
        }
      }

      // Saat biçimi
      temp = lsGet(k("time_format"));
      if (temp === "12" || temp === "24") this.time_format = temp;
      else this.time_format = DEFAULTS.time_format;

      // Eski anahtarlar için ufak migration örneği (gerekirse)
      // var old = lsGet('old_playlist_id'); if (old && !lsGet(k('playlist_id'))) { lsSet(k('playlist_id'), old); }

      return this;
    },

    /**
     * Ayar kaydet (primitive/JSON)
     * @param key
     * @param value
     * @param type 'object' | 'array' | undefined
     */
    saveSettings: function (key, value, type) {
      // Hafızaya yaz
      this[key] = value;

      // LocalStorage'a yaz
      var v = value;
      if (type === "object" || type === "array") {
        v = JSON.stringify(value);
      } else if (key === "playlist_id") {
        var n = parseInt(value, 10);
        v = Number.isFinite(n) ? String(n) : String(DEFAULTS.playlist_id);
      } else if (key === "language") {
        v = normalizeLang(value);
        this[key] = v;
      } else if (key && key.endsWith && key.endsWith("_sort")) {
        v = normalizeSort(String(value), this[key] || "number");
        this[key] = v;
      } else if (key === "time_format") {
        v = value === "12" ? "12" : "24";
        this[key] = v;
      }

      lsSet(k(key), v);
    },

    /**
     * Kısa yardımcılar
     */
    setLanguage: function (code) {
      this.saveSettings("language", normalizeLang(code), "");
      if (window.LanguageManager && LanguageManager.setLanguage) {
        try { LanguageManager.setLanguage(this.language); } catch(_) {}
      }
    },

    setSort: function (scope, sortKey) {
      // scope: 'vod' | 'series' | 'live'
      var map = { vod: "vod_sort", series: "series_sort", live: "live_sort" };
      var target = map[scope] || "vod_sort";
      this.saveSettings(target, normalizeSort(sortKey, this[target] || "number"), "");
    },

    setPlaylist: function (obj) {
      if (!obj || typeof obj !== "object") return;
      if (typeof obj.id !== "undefined") this.saveSettings("playlist_id", obj.id, "");
      this.saveSettings("playlist", obj, "object");
    },

    clear: function () {
      // sadece bizim anahtarlarımızı temizle
      Object.keys(DEFAULTS).forEach(function (name) { lsRemove(k(name)); });
      // runtime değerleri sıfırla
      for (var key in DEFAULTS) {
        if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
          api[key] = DEFAULTS[key];
        }
      }
    },

    export: function () {
      // dışa aktarma için sade obje
      var out = {};
      Object.keys(DEFAULTS).forEach(function (name) {
        out[name] = api[name];
      });
      return out;
    },

    import: function (obj) {
      if (!obj || typeof obj !== "object") return;
      var self = this;
      Object.keys(DEFAULTS).forEach(function (name) {
        if (Object.prototype.hasOwnProperty.call(obj, name)) {
          self.saveSettings(name, obj[name], Array.isArray(obj[name]) || typeof obj[name] === "object" ? "object" : "");
        }
      });
    }
  };

  return api;
})();

// İsteğe bağlı: İlk yükleme
// settings.initFromLocal();