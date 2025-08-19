/* ==== keyTizen.js – Samsung TV Enhanced Remote Control Handler ==== */
"use strict";

(function () {
  /**
   * Samsung TV Remote Control Key Codes
   */
  const SAMSUNG_TV_KEYS = {
    VK_ENTER: 13,
    VK_BACK: 8,
    VK_ESC: 27,
    VK_UP: 38,
    VK_DOWN: 40,
    VK_LEFT: 37,
    VK_RIGHT: 39,
    VK_RED: 403,
    VK_GREEN: 404,
    VK_YELLOW: 405,
    VK_BLUE: 406,
    VK_REWIND: 412,
    VK_FAST_FORWARD: 417,
    VK_PLAY: 415,
    VK_PAUSE: 19,
    VK_STOP: 413,
    VK_MENU: 18,
    VK_HOME: 36,
    VK_CHANNEL_UP: 427,
    VK_CHANNEL_DOWN: 428,
    VK_VOLUME_UP: 447,
    VK_VOLUME_DOWN: 448,
    VK_MUTE: 449,
    VK_TOOLS: 75,
    VK_INFO: 457,
    VK_EXIT: 610,
    VK_GUIDE: 458,
    VK_SOURCE: 460,
    VK_POWER: 409,
    VK_0: 48, VK_1: 49, VK_2: 50, VK_3: 51, VK_4: 52,
    VK_5: 53, VK_6: 54, VK_7: 55, VK_8: 56, VK_9: 57
  };

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
   * Register supported keys (Samsung TV Enhanced). Volume keys are unregistered so TV handles them.
   */
  function registerTizenKeys() {
    try {
      var supported = tizen.tvinputdevice.getSupportedKeys();
      for (var i = 0; i < supported.length; i++) {
        try {
          tizen.tvinputdevice.registerKey(supported[i].name);
          console.log("Samsung TV: Registered key", supported[i].name);
        } catch (_) {
          /* ignore single-key registration errors */
        }
      }

      // Let the TV handle volume keys
      try { tizen.tvinputdevice.unregisterKey("VolumeUp"); } catch (_) {}
      try { tizen.tvinputdevice.unregisterKey("VolumeDown"); } catch (_) {}
      try { tizen.tvinputdevice.unregisterKey("VolumeMute"); } catch (_) {}

      // Samsung TV specific keys for enhanced remote control
      var samsungTVKeys = [
        "MediaPlayPause",
        "MediaTrackPrevious", 
        "MediaTrackNext",
        "ColorF0Red",
        "ColorF1Green", 
        "ColorF2Yellow",
        "ColorF3Blue",
        "Tools",
        "Info", 
        "Guide",
        "Exit",
        "Source",
        "ChannelUp",
        "ChannelDown",
        "MediaPlay",
        "MediaPause",
        "MediaStop",
        "MediaRewind",
        "MediaFastForward"
      ];
      
      for (var j = 0; j < samsungTVKeys.length; j++) {
        try {
          tizen.tvinputdevice.registerKey(samsungTVKeys[j]);
          console.log("Samsung TV: Enhanced key registered", samsungTVKeys[j]);
        } catch (e) {
          console.warn("Samsung TV: Could not register", samsungTVKeys[j], e);
        }
      }

      console.log("[Keys] Samsung TV enhanced key registration completed.");
    } catch (e) {
      console.log("[Keys] Samsung TV key registration failed:", e);
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
