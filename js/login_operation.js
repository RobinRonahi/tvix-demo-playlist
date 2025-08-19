"use strict";
/* ============================================================
 * TvixPlayer Pro – login_operation.js (cleaned)
 * - Keeps public API and behavior intact
 * - Consistent logging (English), no emojis
 * - Safer timers / fallbacks / state flags
 * - Non-blocking UI flow and loader sync with global state
 * ============================================================ */

var login_page = {
  is_loading: false,

  keys: {
    focused_part: "main_area",
    main_area: 0,
    network_issue_btn: 0,
    expired_issue_btn: 0,
    no_playlist_btn: 0,
    trial_issue_btn: 0
  },

  tried_panel_indexes: [],
  network_issue_btns: $(".network-issue-btn"),
  expired_issue_btns: $(".expired-issue-btn"),
  no_playlist_btns: $(".no-playlist-btn"),
  trial_issue_btns: $(".trial-issue-btn"),

  continue_trial: false,

  /* ---------------------------- Navigation ---------------------------- */

  goBack: function () {
    turn_off_page.init("login-page");
  },

  /* ------------------------------ UI State ---------------------------- */

  showLoadImage: function () {
    $("#loading-issue-container").hide();
    $("#loading-page").removeClass("hide");
  },

  showLoginError: function () {
    $(".loading-issue-item").addClass("hide");
    $("#loading-issue-container").show();
  },

  showNetworkErrorModal: function () {
    console.log("[Login] Showing network error modal");
    this.is_loading = false;
    app_loading = false;
    this.showLoginError();
    $("#network-issue-container").removeClass("hide");
    this.hoverNetworkIssueBtn(0);

    var that = this;

    // Auto-retry after 8s if still on the error screen
    setTimeout(function () {
      if ($("#network-issue-container").is(":visible")) {
        console.log("[Login] Auto retry after network error");
        that.reloadApp();
      }
    }, 8000);

    // Safety: after 15s, force show basic app
    setTimeout(function () {
      if ($("#loading-issue-container").is(":visible") || app_loading) {
        console.warn("[Login] Safety fallback: forcing basic app");
        that.is_loading = false;
        app_loading = false;
        showLoader(false);
        $("#app").css("display", "block").show();
        if (typeof home_page !== "undefined" && home_page.init) home_page.init();
      }
    }, 15000);
  },

  /* ---------------------------- Entry Points -------------------------- */

  reloadApp: function () {
    var stored_expire_date = localStorage.getItem(storage_id + "expire_date");
    var today = moment().format("Y-MM-DD");

    if (stored_expire_date && stored_expire_date < today) {
      this.showLoginError();
      $("#expired-issue-container").removeClass("hide");
      this.hoverExpiredIssueBtn(0);
      return;
    }

    var that = this;
    $("#loading-issue-container").hide();
    $(".loading-issue-item").addClass("hide");

    setTimeout(function () {
      that.fetchPlaylistInformation();
    }, 200);
  },

  continueDemoPlaylist: function () {
    var that = this;
    $("#loading-issue-container").hide();
    $(".loading-issue-item").addClass("hide");

    if (!playlist_urls || playlist_urls.length === 0) {
      that.showNetworkErrorModal();
      return;
    }

    settings.playlist_id = playlist_urls[0].id;
    has_own_playlist = true;
    saveData("has_own_playlist", true);

    setTimeout(function () {
      that.login();
    }, 200);
  },

  exit: function () {
    // Do not hard-exit; show network modal instead
    console.log("[Login] Exit blocked; showing network error modal");
    this.showNetworkErrorModal();
  },

  continueTrial: function () {
    this.continue_trial = true;

    if (has_own_playlist) {
      var that = this;
      $("#loading-issue-container").hide();
      $(".loading-issue-item").addClass("hide");
      setTimeout(function () {
        that.login();
      }, 200);
    } else {
      $("#trial-issue-container").addClass("hide");
      $("#no-playlist-issue-container").removeClass("hide");
      this.hoverNoPlaylistBtn(0);
    }
  },

  /* ---------------------------- App Bootstrp -------------------------- */

  loadApp: function (data) {
    console.log("[Login] loadApp started");
    console.log("[Login] API payload:", data);

    saveData("playlist_urls", data.urls);
    saveData("languages", data.languages);
    saveData("expire_date", data.expire_date);
    saveData("is_trial", data.is_trial);
    saveData("has_own_playlist", data.has_own_playlist);

    // Language integration (kept for compatibility)
    if (window.LanguageManager && data.languages) {
      window.LanguageManager.integrateApiLanguages(data.languages);

      window.LanguageManager
        .initWithApi(data.languages)
        .then(function () {
          // Apply translations after language init
          setTimeout(function () {
            if (window.LanguageManager.updateTranslations) {
              console.log("[Login] Applying translations after language init");
              window.LanguageManager.updateTranslations();
            }
          }, 100);

          window.LanguageManager.createLanguageSelector(
            "select-language-body",
            function (selectedLang) {
              if (window.settings) {
                window.settings.language = selectedLang;
                if (typeof window.settings.saveSettings === "function") {
                  window.settings.saveSettings();
                }
              }
            }
          );
        })
        .catch(function () {
          login_page.createLegacyLanguageSelector(data.languages);
        });
    } else {
      this.createLegacyLanguageSelector(data.languages);
    }

    $("#home-page").removeClass("hide");

    setting_page.language_doms = $(".language-item");
    setting_page.doms_translated = $("*").filter(function () {
      return $(this).data("word_code") !== undefined;
    });

    device_key = data.device_key;
    $(".device-key").text(device_key);
    var today = moment().format("Y-MM-DD");
    this.is_loading = false;
    app_loading = false;
    $(".expire-date").text(expire_date);

    this.updateLicenseStatusDisplay(data);

    console.log("[Login] Expiry check -> today:", today, "expire:", data.expire_date);

    if (data.expire_date < today) {
      console.log("[Login] Account expired");
      saveData("mac_valid", false);
      saveData("has_own_playlist", false);
      has_own_playlist = false;

      localStorage.removeItem(storage_id + "playlist");
      localStorage.removeItem(storage_id + "playlist_id");
      localStorage.removeItem(storage_id + "api_host_url");
      localStorage.removeItem(storage_id + "user_name");
      localStorage.removeItem(storage_id + "password");

      this.showLoginError();
      $("#expired-issue-container").removeClass("hide");
      this.hoverExpiredIssueBtn(0);
      return;
    }

    console.log(
      "[Login] Account active. trial:", is_trial,
      "continue_trial:", this.continue_trial,
      "has_playlist:", has_own_playlist
    );

    if (is_trial != 2 && !this.continue_trial) {
      console.log("[Login] Showing trial notice");
      this.showLoginError();
      $("#trial-issue-container").removeClass("hide");
      this.hoverTrialIssueBtn(0);
    } else {
      if (has_own_playlist) {
        console.log("[Login] Proceeding to login");
        this.login();
      } else {
        console.log("[Login] No playlist assigned");
        this.showLoginError();
        $("#no-playlist-issue-container").removeClass("hide");
        this.hoverNoPlaylistBtn(0);
      }
    }
  },

  updateLicenseStatusDisplay: function (data) {
    var statusBadge = $("#license-status-badge");
    var statusText = $('.device-status-text[data-word_code="license_status"]');
    var today = moment().format("Y-MM-DD");

    statusBadge.removeClass("demo-license active-license expired-license trial-license");

    if (data.expire_date < today) {
      statusBadge.addClass("expired-license");
      statusText.text(LanguageManager.getText("expired"));
    } else if (data.is_trial == 2) {
      statusBadge.addClass("active-license");
      statusText.text(LanguageManager.getText("active"));
    } else if (data.is_trial == 1) {
      statusBadge.addClass("trial-license");
      statusText.text(LanguageManager.getText("trial"));
    } else {
      statusBadge.addClass("demo-license");
      statusText.text(LanguageManager.getText("demo_version"));
    }
  },

  /* ------------------------- Playlist Discovery ----------------------- */

  fetchPlaylistInformation: function () {
    if (this.is_loading) return;

    var that = this;
    this.is_loading = true;
    app_loading = true;

    console.log("[Login] Fetching playlist information, MAC:", mac_address);
    $("#mac-address").text(mac_address);
    $(".mac-address").text(mac_address);

    var picked = pickPanelUrl(this.tried_panel_indexes);
    var url_index = picked[0];
    var url = picked[1];

    var version = platform === "samsung" ? samsung_version : lg_version;
    var payload = { mac_address: mac_address, app_type: platform, version: version };

    console.log("[Login] POST", url + "/playlist_information");
    $.ajax({
      method: "post",
      url: url + "/playlist_information",
      data: payload,
      timeout: 8000,
      success: function (data) {
        console.log("[Login] Playlist fetch success");
        localStorage.setItem(storage_id + "api_data", JSON.stringify(data));
        that.loadApp(data);
      },
      error: function (xhr, status, error) {
        console.log("[Login] Playlist fetch error:", xhr.status, status, error);
        that.is_loading = false;
        app_loading = false;
        that.tried_panel_indexes.push(url_index);

        if (that.tried_panel_indexes.length < panel_urls.length) {
          console.log("[Login] Trying next panel URL (attempt:", that.tried_panel_indexes.length + 1, ")");
          setTimeout(function () {
            that.fetchPlaylistInformation();
          }, 2000);
          return;
        }

        console.log("[Login] All panel URLs failed; checking cache");
        app_loading = false;

        var api_data = localStorage.getItem(storage_id + "api_data");
        if (api_data) {
          api_data = JSON.parse(api_data);
          var today = moment().format("Y-MM-DD");
          if (api_data.expire_date && api_data.expire_date < today) {
            console.log("[Login] Cached data expired; clearing cache");
            localStorage.removeItem(storage_id + "api_data");
            that.showNetworkErrorModal();
          } else {
            console.log("[Login] Using valid cached data");
            that.loadApp(api_data);
          }
        } else {
          console.log("[Login] No cached data; showing network error");
          that.showNetworkErrorModal();
        }

        that.tried_panel_indexes = [];
      }
    });
  },

  getPlayListDetail: function () {
    console.log("[Login] getPlayListDetail: start");
    var that = this;

    mac_address = "52:54:00:12:34:58"; // fallback
    console.log("[Login] Platform:", platform, "fallback MAC:", mac_address);

    var macDetectionTimeout = setTimeout(function () {
      console.warn("[Login] MAC detection timeout; using fallback");
      that.fetchPlaylistInformation();
    }, 5000);

    if (platform === "samsung") {
      try {
        console.log("[Login] Samsung detected; trying to detect MAC");

        try {
          if (typeof webapis !== "undefined" && webapis.productinfo) {
            var deviceInfo = webapis.productinfo.getProductInfo();
            console.log("[Login] Product info:", deviceInfo);
          }
        } catch (e) {
          console.log("[Login] Product info error:", e);
        }

        // Ethernet
        tizen.systeminfo.getPropertyValue(
          "ETHERNET_NETWORK",
          function (data) {
            if (data && data.macAddress && data.macAddress !== "00:00:00:00:00:00") {
              mac_address = String(data.macAddress).toUpperCase();
              console.log("[Login] Ethernet MAC:", mac_address);
              $("#mac-address").text(mac_address);
              $(".mac-address").text(mac_address);
              clearTimeout(macDetectionTimeout);
              that.fetchPlaylistInformation();
              return;
            }

            // Wi-Fi
            console.log("[Login] Ethernet MAC not available; trying Wi-Fi");
            try {
              tizen.systeminfo.getPropertyValue(
                "WIFI_NETWORK",
                function (wifiData) {
                  if (wifiData && wifiData.macAddress && wifiData.macAddress !== "00:00:00:00:00:00") {
                    mac_address = String(wifiData.macAddress).toUpperCase();
                    console.log("[Login] Wi-Fi MAC:", mac_address);
                    $("#mac-address").text(mac_address);
                    $(".mac-address").text(mac_address);
                    clearTimeout(macDetectionTimeout);
                    that.fetchPlaylistInformation();
                  } else {
                    // Alternative
                    var altMac = getAlternativeMacAddress();
                    if (altMac) {
                      mac_address = altMac;
                      console.log("[Login] Alternative MAC:", mac_address);
                      $("#mac-address").text(mac_address + " (Generated)");
                      $(".mac-address").text(mac_address + " (Generated)");
                      try { localStorage.setItem("device_mac_address", mac_address); } catch (_) {}
                      clearTimeout(macDetectionTimeout);
                      that.fetchPlaylistInformation();
                    } else {
                      console.log("[Login] Using fallback MAC:", mac_address);
                      $("#mac-address").text(mac_address + " (Fallback)");
                      $(".mac-address").text(mac_address + " (Fallback)");
                      clearTimeout(macDetectionTimeout);
                      that.fetchPlaylistInformation();
                    }
                  }
                },
                function () {
                  // Wi-Fi read error → alternative/fallback
                  var altMac2 = getAlternativeMacAddress();
                  if (altMac2) {
                    mac_address = altMac2;
                    console.log("[Login] Alternative MAC:", mac_address);
                    $("#mac-address").text(mac_address + " (Generated)");
                    $(".mac-address").text(mac_address + " (Generated)");
                    try { localStorage.setItem("device_mac_address", mac_address); } catch (_) {}
                    clearTimeout(macDetectionTimeout);
                    that.fetchPlaylistInformation();
                  } else {
                    console.log("[Login] Using fallback MAC:", mac_address);
                    $("#mac-address").text(mac_address + " (Fallback)");
                    $(".mac-address").text(mac_address + " (Fallback)");
                    clearTimeout(macDetectionTimeout);
                    that.fetchPlaylistInformation();
                  }
                }
              );
            } catch (e2) {
              console.log("[Login] Wi-Fi MAC exception:", e2);
              console.log("[Login] Using fallback MAC:", mac_address);
              $("#mac-address").text(mac_address + " (Fallback)");
              $(".mac-address").text(mac_address + " (Fallback)");
              clearTimeout(macDetectionTimeout);
              that.fetchPlaylistInformation();
            }
          },
          function () {
            console.log("[Login] Ethernet MAC error; using fallback");
            $("#mac-address").text(mac_address + " (Fallback)");
            $(".mac-address").text(mac_address + " (Fallback)");
            clearTimeout(macDetectionTimeout);
            that.fetchPlaylistInformation();
          }
        );
      } catch (e) {
        console.log("[Login] MAC detection exception:", e);
        console.log("[Login] Using fallback MAC:", mac_address);
        $("#mac-address").text(mac_address + " (Fallback)");
        $(".mac-address").text(mac_address + " (Fallback)");
        clearTimeout(macDetectionTimeout);
        this.fetchPlaylistInformation();
      }
    } else if (platform === "lg") {
      webOS.service.request("luna://com.webos.service.sm", {
        method: "deviceid/getIDs",
        parameters: { idType: ["LGUDID"] },
        onSuccess: function (resp) {
          if (resp && resp.idList && resp.idList[0] && resp.idList[0].idValue) {
            mac_address = "";
            var temp = resp.idList[0].idValue.replace(/['-]+/g, "");
            for (var i = 0; i <= 5; i++) {
              mac_address += temp.substr(i * 2, 2);
              if (i < 5) mac_address += ":";
            }
            clearTimeout(macDetectionTimeout);
            that.fetchPlaylistInformation();
          } else {
            clearTimeout(macDetectionTimeout);
            that.showNetworkErrorModal();
          }
        },
        onFailure: function () {
          clearTimeout(macDetectionTimeout);
          that.showNetworkErrorModal();
        }
      });
    } else {
      console.log("[Login] Non-Samsung/LG platform; showing network error");
      clearTimeout(macDetectionTimeout);
      this.showNetworkErrorModal();
    }
  },

  /* ------------------------------ Login ------------------------------ */

  login: function () {
    var playlist_id = settings.playlist_id;
    var playlist_index = 0;

    for (var i = 0; i < playlist_urls.length; i++) {
      if (playlist_urls[i].id == playlist_id) {
        playlist_index = i;
        break;
      }
    }

    settings.saveSettings("playlist_id", playlist_urls[playlist_index].id, "");
    settings.saveSettings("playlist", playlist_urls[playlist_index], "array");

    parseM3uUrl();
    this.proceed_login();
  },

  goToPlaylistPageWithError: function () {
    this.is_loading = false;
    app_loading = false;

    try {
      LiveModel.insertMoviesToCategories([]);
      VodModel.insertMoviesToCategories([]);
      SeriesModel.insertMoviesToCategories([]);
    } catch (_) {}

    $("#loading-page").addClass("hide");
    $("#playlist-error").show();

    if (typeof home_page !== "undefined" && home_page.init) home_page.init();
    if (typeof top_menu_page !== "undefined") {
      top_menu_page.hoverMenuItem(4);
      top_menu_page.handleMenuClick();
    }
    if (typeof setting_page !== "undefined") {
      setting_page.hoverSettingMenu(5);
      setting_page.handleMenuClick();
    }
  },

  proceed_login: function () {
    if (this.is_loading) return;

    $("#playlist-error").hide();
    LiveModel.init();
    VodModel.init();
    SeriesModel.init();

    var that = this;
    this.showLoadImage();

    var playlist_type = settings.playlist_type;
    this.is_loading = true;
    app_loading = true;

    console.log("[Login] proceed_login, playlist_type:", playlist_type);

    if (playlist_type === "xtreme") {
      var prefix_url =
        api_host_url +
        "/player_api.php?username=" +
        user_name +
        "&password=" +
        password +
        "&action=";

      var login_url = prefix_url.replace("&action=", "");
      console.log("[Login] Xtreme login:", login_url);

      $.ajax({
        method: "get",
        url: login_url,
        timeout: 15000,
        success: function (data) {
          console.log("[Login] Xtreme login OK");
          if (typeof data.server_info != "undefined") {
            calculateTimeDifference(data.server_info.time_now, data.server_info.timestamp_now);
          }

          if (typeof data.user_info != "undefined") {
            if (
              data.user_info.auth == 0 ||
              (typeof data.user_info.status != "undefined" &&
                (data.user_info.status === "Expired" || data.user_info.status === "Banned"))
            ) {
              that.is_loading = false;
              that.goToPlaylistPageWithError();
              return;
            }

            // Parallel fetch
            $.when(
              $.ajax({
                method: "get",
                url: prefix_url + "get_live_streams",
                timeout: 20000,
                success: function (d) {
                  console.log("[Login] Live streams:", (d && d.length) || 0);
                  LiveModel.setMovies(d);
                }
              }),
              $.ajax({
                method: "get",
                url: prefix_url + "get_live_categories",
                timeout: 10000,
                success: function (d) {
                  console.log("[Login] Live categories:", (d && d.length) || 0);
                  LiveModel.setCategories(d);
                }
              }),
              $.ajax({
                method: "get",
                url: prefix_url + "get_vod_categories",
                success: function (d) {
                  VodModel.setCategories(d);
                }
              }),
              $.ajax({
                method: "get",
                url: prefix_url + "get_series_categories",
                success: function (d) {
                  SeriesModel.setCategories(d);
                }
              }),
              $.ajax({
                method: "get",
                url: prefix_url + "get_vod_streams",
                success: function (d) {
                  VodModel.setMovies(d);
                }
              }),
              $.ajax({
                method: "get",
                url: prefix_url + "get_series",
                success: function (d) {
                  SeriesModel.setMovies(d);
                }
              })
            )
              .then(function () {
                try {
                  console.log("[Login] All endpoints OK, inserting into models");
                  LiveModel.insertMoviesToCategories();
                  VodModel.insertMoviesToCategories();
                  SeriesModel.insertMoviesToCategories();

                  that.is_loading = false;
                  app_loading = false;

                  console.log("[Login] Init home page");
                  if (typeof home_page !== "undefined" && home_page.init) home_page.init();

                  setTimeout(function () {
                    if ($("#loading-page").is(":visible")) {
                      console.warn("[Login] Loader still visible; forcing hide");
                      showLoader(false);
                      $("#app").css("display", "block").show();
                    }
                  }, 1000);
                } catch (e) {
                  console.error("[Login] Error after endpoints:", e);
                  that.goToPlaylistPageWithError();
                }
              })
              .fail(function (jqXHR, textStatus, errorThrown) {
                console.error("[Login] Endpoint(s) failed:", textStatus, errorThrown);

                // Try basic app
                that.is_loading = false;
                app_loading = false;

                try {
                  LiveModel.insertMoviesToCategories([]);
                  VodModel.insertMoviesToCategories([]);
                  SeriesModel.insertMoviesToCategories([]);
                  console.log("[Login] Basic app with empty data");
                  if (typeof home_page !== "undefined" && home_page.init) home_page.init();
                } catch (e2) {
                  console.error("[Login] Basic app init failed:", e2);
                  that.goToPlaylistPageWithError();
                }
              });
          }
        },
        error: function () {
          that.is_loading = false;
          app_loading = false;
          that.goToPlaylistPageWithError();
        }
      });
    } else {
      // M3U type1
      $.ajax({
        method: "get",
        url: api_host_url,
        success: function (data) {
          console.log("[Login] M3U fetch OK");
          parseM3uResponse("type1", data);
          $("#loading-page").addClass("hide");
          if (typeof home_page !== "undefined" && home_page.init) home_page.init();

          that.is_loading = false;
          app_loading = false;

          setTimeout(function () {
            if ($("#loading-page").is(":visible")) {
              console.warn("[Login] Loader still visible after M3U; forcing hide");
              showLoader(false);
              $("#app").css("display", "block").show();
            }
          }, 1000);
        },
        error: function () {
          that.is_loading = false;
          app_loading = false;
          that.goToPlaylistPageWithError();
        }
      });
    }
  },

  /* ---------------------------- Focus / Hover ------------------------- */

  hoverTrialIssueBtn: function (index) {
    var keys = this.keys;
    keys.focused_part = "trial_issue_btn";
    keys.trial_issue_btn = index;
    $(this.trial_issue_btns).removeClass("active");
    $(this.trial_issue_btns[index]).addClass("active");
  },

  hoverNetworkIssueBtn: function () {
    var keys = this.keys;
    keys.focused_part = "network_issue_btn";
    keys.network_issue_btn = 0;
    $(this.network_issue_btns).removeClass("active");
    $(this.network_issue_btns[0]).addClass("active");
  },

  hoverExpiredIssueBtn: function () {
    var keys = this.keys;
    keys.focused_part = "expired_issue_btn";
    keys.expired_issue_btn = 0;
    $(this.expired_issue_btns).removeClass("active");
    $(this.expired_issue_btns[0]).addClass("active");
  },

  hoverNoPlaylistBtn: function (index) {
    var keys = this.keys;
    keys.focused_part = "no_playlist_btn";
    keys.no_playlist_btn = index;
    $(this.no_playlist_btns).removeClass("active");
    $(this.no_playlist_btns[index]).addClass("active");
  },

  /* ------------------------- Click / Navigation ----------------------- */

  handleMenuClick: function () {
    var keys = this.keys;
    switch (keys.focused_part) {
      case "network_issue_btn":
        $(this.network_issue_btns[keys.network_issue_btn]).trigger("click");
        break;
      case "no_playlist_btn":
        $(this.no_playlist_btns[keys.no_playlist_btn]).trigger("click");
        break;
      case "expired_issue_btn":
        $(this.expired_issue_btns[keys.expired_issue_btn]).trigger("click");
        break;
      case "trial_issue_btn":
        $(this.trial_issue_btns[keys.trial_issue_btn]).trigger("click");
        break;
    }
  },

  handleMenuUpDown: function () {
    // No vertical groups on this screen currently
  },

  handleMenuLeftRight: function (increment) {
    var keys = this.keys;
    switch (keys.focused_part) {
      case "network_issue_btn":
      case "expired_issue_btn":
        // single buttons – no horizontal navigation
        break;

      case "no_playlist_btn":
        keys.no_playlist_btn += increment;
        if (keys.no_playlist_btn < 0) keys.no_playlist_btn = 0;
        if (keys.no_playlist_btn > 1) keys.no_playlist_btn = 1;
        this.hoverNoPlaylistBtn(keys.no_playlist_btn);
        break;

      case "trial_issue_btn":
        keys.trial_issue_btn += increment;
        if (keys.trial_issue_btn < 0) keys.trial_issue_btn = 0;
        if (keys.trial_issue_btn > 1) keys.trial_issue_btn = 1;
        this.hoverTrialIssueBtn(keys.trial_issue_btn);
        break;
    }
  },

  HandleKey: function (e) {
    if (e.keyCode === tvKey.RETURN) {
      this.goBack();
      return;
    }
    if (this.is_loading) return;

    switch (e.keyCode) {
      case tvKey.DOWN:
        this.handleMenuUpDown(1);
        break;
      case tvKey.UP:
        this.handleMenuUpDown(-1);
        break;
      case tvKey.LEFT:
        this.handleMenuLeftRight(-1);
        break;
      case tvKey.RIGHT:
        this.handleMenuLeftRight(1);
        break;
      case tvKey.ENTER:
        this.handleMenuClick();
        break;
      // tvKey.RETURN already handled above
    }
  },

  /* ------------------------ Legacy Language UI ------------------------ */

  createLegacyLanguageSelector: function (apiLanguages) {
    var html = "";
    languages.map(function (item, index) {
      var language_name = item.words[item.code] ? item.words[item.code] : item.name;
      html +=
        '<div class="modal-operation-menu-type-3 language-item bg-focus-1" ' +
        'data-sort_key="default" ' +
        'onclick="setting_page.selectLanguage(\'' + item.code + '\')" ' +
        'onmouseenter="setting_page.hoverLanguage(' + index + ')" ' +
        'data-language="' + item.code + '"' +
        ">" +
        language_name +
        "</div>";
    });
    $("#select-language-body").html(html);
  }
};
