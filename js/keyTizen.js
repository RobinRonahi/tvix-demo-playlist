/* ==== keyTizen.js – Tizen-safe, clean, no-localized strings ==== */
"use strict";

(function () {
  /**
   * Detect Samsung Tizen environment.
   */
  function isSamsungTizen() {
    return (
      typeof tizen !== "undefined" &&
      tizen.tvinputdevice &&
      typeof tizen.tvinputdevice.getSupportedKeys === "function"
    );
  }

  /**
   * Register supported keys (Tizen only). Volume keys are unregistered so TV handles them.
   */
  function registerTizenKeys() {
    try {
      var supported = tizen.tvinputdevice.getSupportedKeys();
      for (var i = 0; i < supported.length; i++) {
        try {
          tizen.tvinputdevice.registerKey(supported[i].name);
        } catch (_) {
          /* ignore single-key registration errors */
        }
      }

      // Let the TV handle volume keys
      try { tizen.tvinputdevice.unregisterKey("VolumeUp"); } catch (_) {}
      try { tizen.tvinputdevice.unregisterKey("VolumeDown"); } catch (_) {}
      try { tizen.tvinputdevice.unregisterKey("VolumeMute"); } catch (_) {}

      // Extra keys for newer models (best-effort)
      var extraKeys = [
        "MediaPlayPause",
        "MediaTrackPrevious",
        "MediaTrackNext",
        "ColorF0Red",
        "ColorF1Green",
        "ColorF2Yellow",
        "ColorF3Blue"
      ];
      for (var j = 0; j < extraKeys.length; j++) {
        try { tizen.tvinputdevice.registerKey(extraKeys[j]); } catch (_) {}
      }

      console.log("[Keys] Tizen key registration completed.");
    } catch (e) {
      console.log("[Keys] Tizen key registration failed:", e);
    }
  }

  /**
   * Canonical key map. Keep names stable across the app.
   */
  var tvKey = {
    // Digits
    N0: 48, N1: 49, N2: 50, N3: 51, N4: 52,
    N5: 53, N6: 54, N7: 55, N8: 56, N9: 57,

    // Navigation
    UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39,
    UP_ALT: 1, DOWN_ALT: 2, LEFT_ALT: 3, RIGHT_ALT: 4,

    // Selection / back
    ENTER: 13,
    ENTER_ALT: 29443,
    ENTER_ALT2: 65376,
    RETURN: 10009,
    RETURN_ALT: 65385,
    EXIT: 10182,

    // Channel & volume (volume is typically handled by TV)
    CH_UP: 427, CH_DOWN: 428,
    VOL_UP: 448, VOL_DOWN: 447, MUTE: 449,

    // Color keys
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,

    // Media
    RW: 412, FF: 417, REC: 416, PLAY: 415, STOP: 413, PAUSE: 19,
    PLAYPAUSE: 10252,
    MediaRewind: 412,
    MediaFastForward: 417,
    MediaRecord: 416,
    MediaPlay: 415,
    MediaStop: 413,
    MediaPause: 19,
    MediaPlayPause: 10252,
    MediaTrackPrevious: 10232,
    MediaTrackNext: 10233,

    // Info / tools / menu
    INFO: 457, TOOLS: 10135, MENU: 10133, SEARCH: 10255, PRECH: 10190,

    // Sources / guides
    GUIDE: 458,
    CHANNELLIST: 10073,
    Source: 10072,
    CAPTION: 10221,
    EXTRA: 10253,

    // Newer models
    AMBIENT: 10571,
    ART: 10572
  };

  /**
   * Public initializer.
   * - Registers Tizen keys when available.
   * - Exposes tvKey globally (backward compatible).
   */
  function initKeys() {
    if (isSamsungTizen()) {
      registerTizenKeys();
      console.log("[Keys] Platform: Samsung Tizen");
    } else {
      console.log("[Keys] Platform: Development/Browser");
    }

    // expose globally (backward compatibility)
    window.tvKey = tvKey;

    // basic self-check
    console.log("[Keys] Loaded:", {
      UP: tvKey.UP,
      DOWN: tvKey.DOWN,
      LEFT: tvKey.LEFT,
      RIGHT: tvKey.RIGHT,
      ENTER: tvKey.ENTER,
      RETURN: tvKey.RETURN
    });

    return tvKey;
  }

  // export init
  window.initKeys = initKeys;
})();