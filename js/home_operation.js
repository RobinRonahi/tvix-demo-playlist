/* ==== home_operation.js – Clean & Structured (TIZEN/LG safe) ==== */
"use strict";

var home_page = {
  initiated: false,
  _eventsBound: false,

  /* Ensures home UI visibility and refreshed labels */
  refreshUI: function () {
    // Make primary containers visible
    $("#app").css("display", "block").show();
    $("#page-container-1").removeClass("hide").show();
    $(".main-logo-container").show();
    $("#main-menu-container").show().removeClass("hide");
    $("#home-page").removeClass("hide").show();

    // Safety: hide any overlays from other pages that may intercept clicks
    try {
      var epg = document.querySelector('.fullscreen-epg-overlay');
      if (epg) { epg.style.display = 'none'; epg.classList.remove('show'); epg.classList.remove('hide'); }
    } catch (_) {}
    try {
      var modal = document.getElementById('channel-search-modal');
      if (modal) modal.classList.remove('active');
    } catch (_) {}

    // Bottom panel + MAC area
    $("#home-mac-address-container").css("display", "flex").show();
    $("#home-info-panel, .home-bottom-bar").show();

    // Write MAC address
    try {
      var mac =
        (typeof mac_address !== "undefined" && mac_address) ||
        (window.App && window.App.device && window.App.device.mac) ||
        localStorage.getItem("gala.mac");
      if (mac) {
        $(".mac-address").text(mac);
        $("#main-mac-address").text(mac);
      }
    } catch (e) {
      console.warn("MAC update error:", e);
    }

    // Static texts via LanguageManager (if available)
    try {
      if (window.LanguageManager && typeof LanguageManager.getText === "function") {
        $("#main-playlist-label").text(LanguageManager.getText("playlist_label"));
        $("#main-playlist-count").text(LanguageManager.getText("playlist_count"));
        $(".version-text").text(LanguageManager.getText("app_version_full"));
      }
    } catch (e) {
      console.warn("Language text update error:", e);
    }

    // Apply inline translations (if any)
    try {
      if (window.LanguageManager && typeof LanguageManager.updateTranslations === "function") {
        LanguageManager.updateTranslations();
      }
    } catch (e) {
      console.warn("updateTranslations failed:", e);
    }

    // Header/device info banner
    try {
      if (typeof toggleDeviceInfoBanner === "function") toggleDeviceInfoBanner(true);
      if (typeof updateDeviceInfoBanner === "function") updateDeviceInfoBanner();
    } catch (e) {
      console.warn("Banner update failed:", e);
    }
  },

  /* Bind delegated events once (safe across DOM refreshes) */
  bindEventsOnce: function () {
    if (this._eventsBound) return;

    // Refresh list
    $(document).on("click", '[data-action="refresh"]', function (e) {
      e.preventDefault();
      try {
        if (window.playlist_page && typeof playlist_page.refresh === "function") return playlist_page.refresh();
        if (typeof refreshMainList === "function") return refreshMainList();
        $(document).trigger("gala:playlist:refresh");
      } catch (err) {
        console.warn("refresh handler error:", err);
      }
    });

    // Change playlist
    $(document).on("click", '[data-action="change-playlist"]', function (e) {
      e.preventDefault();
      try {
        if (window.setting_page && typeof setting_page.open_playlist_select === "function")
          return setting_page.open_playlist_select();
        if (window.setting_page && typeof setting_page.reEnter === "function")
          return setting_page.reEnter("playlist");
        $(document).trigger("gala:playlist:openSelect");
      } catch (err) {
        console.warn("change-playlist handler error:", err);
      }
    });

    // Open settings
    $(document).on("click", '[data-action="open-settings"]', function (e) {
      e.preventDefault();
      try {
        if (window.setting_page && typeof setting_page.init === "function") return setting_page.init();
        if (window.setting_page && typeof setting_page.reEnter === "function") return setting_page.reEnter();
        if (typeof top_menu_page !== "undefined" && typeof top_menu_page.hoverMenuItem === "function") {
          top_menu_page.hoverMenuItem(1); // focus Settings tab
        }
      } catch (err) {
        console.warn("open-settings handler error:", err);
      }
    });

    this._eventsBound = true;
  },

  init: function () {
    console.log("HOME PAGE INIT: starting main menu");

    // 1) Clear loading state
    app_loading = false;
    if (typeof login_page !== "undefined") login_page.is_loading = false;

    // 2) Route / submenu state
    turn_off_page.prev_route = "home-page";
    top_menu_page.sub_route = "home-page";
    if (typeof top_menu_page.hoverMenuItem === "function") top_menu_page.hoverMenuItem(0);
    current_route = "home-page";

    // 3) Hide loader, show app
    showLoader(false);
    $("#app").css("display", "block").show();

    // 4) Primary UI
    $("#page-container-1").removeClass("hide").show();
    $(".main-logo-container").show();
    $("#main-menu-container").show().removeClass("hide");

    // 5) Refresh UI and bind events
    this.refreshUI();
    this.bindEventsOnce();
    $("#home-mac-address-container").css("display", "flex").show();

    // 6) Ensure banners
    if (typeof toggleDeviceInfoBanner === "function") toggleDeviceInfoBanner(true);
    if (typeof updateDeviceInfoBanner === "function") updateDeviceInfoBanner();

    console.log("HOME PAGE INIT: completed");
    setting_page.playlist_initiated = false;
    this.initiated = true;
  },

  reEnter: function () {
    // Bring back into view
    $("#home-page").removeClass("hide").show();
    $("#app").css("display", "block").show();
    $("#page-container-1, #main-menu-container, .main-logo-container").show();

    // Refresh and keep events
    this.refreshUI();
    this.bindEventsOnce();
    $("#home-mac-address-container").css("display", "flex").show();
    current_route = "home-page";
  },

  goBack: function () {
    if (typeof turn_off_page !== "undefined" && typeof turn_off_page.init === "function") {
      turn_off_page.init(current_route);
    }
  },

  /* Remote control: delegate left/right/OK and others to top_menu_page */
  HandleKey: function (e) {
    if (current_route !== "home-page" && typeof updateRoute === "function") {
      updateRoute("home-page", "menu_selection");
    }

    switch (e.keyCode) {
      case tvKey.RETURN:
        this.goBack();
        break;

      // For home screen, other keys are delegated so left/right/OK work as expected
      default:
        if (typeof top_menu_page !== "undefined" && typeof top_menu_page.HandleKey === "function") {
          top_menu_page.HandleKey(e);
        }
        break;
    }
  }
};