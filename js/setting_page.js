"use strict";
var setting_page = {
  player: null,
  keys: {
    focused_part: "menu_selection",
    menu_selection: 0,
    parent_control_modal: 0,
    hide_category_modal: 0,
    playlist_selection: 0,
    language_selection: 0,
    theme_modal: 0,
    account_modal: 0,
    home_button: 0
  },
  menu_doms: $(".setting-menu-item-wrapper"),
  initiated: false,
  parent_control_doms: $(".parent-account-item"),
  hide_category_doms: [],
  hide_category_movie_type: "",
  doms_translated: [],
  language_doms: [],
  sub_route: "",
  playlist_initiated: false,
  playlist_doms: [],
  theme_modal_options: [],

  init: function () {
    if (typeof updateRoute === "function") {
      updateRoute("setting-page", "menu_selection");
    }
    this.updateDomReferences();

    this.keys = this.keys || {};
    this.keys.focused_part = "menu_selection";
    if (!Number.isInteger(this.keys.menu_selection)) this.keys.menu_selection = 0;

    if (!this.initiated) {
      this.initializeLanguageSelector();
      this.loadSavedTheme();
      this.initiated = true;
    }

    $("#setting-page").removeClass("hide");
    $(".main-logo-container").hide();
    $("#main-menu-container").hide();
    $("#home-mac-address-container").hide();

    this.showSettingsMenu();

    const $items = $(".setting-menu-item-wrapper .setting-menu-item");
    if ($items.length) {
      $items.removeClass("focused").attr("aria-selected", "false");
      $items.eq(this.keys.menu_selection).addClass("focused").attr("aria-selected", "true");
    }

    var self = this;
    setTimeout(function () {
      try {
        self.keys.focused_part = "menu_selection";
        self.keys.menu_selection = 0;
        self.hoverSettingMenu(0);
        self.autoOpenUserAccount();

        if (self.menu_doms && self.menu_doms[0]) {
          $(self.menu_doms[0]).addClass("active").focus();
        }
      } catch (err) {
        console.error("Settings init error:", err);
      }
    }, 300);

    this.bindKeyboardEvents();
    console.log("Settings Page initialized");
  },

  // Yardımcı: init sırasında yakaladığımız eventleri kapatmak için
  destroy: function () {
    $(document).off(".settingsPage");
    $(".settings-home-icon").off(".backup");
  },

  autoOpenUserAccount: function () {
    try {
      this.keys.menu_selection = 0;
      this.hoverSettingMenu(0);
      if (typeof mac_address !== "undefined" && mac_address) {
        this.showUserAccounts();
        console.log("User account auto-opened with MAC:", mac_address);
      }
    } catch (e) {
      console.log("autoOpenUserAccount error:", e);
    }
  },

  updateDomReferences: function () {
    this.menu_doms = $(".setting-menu-item-wrapper");
    this.parent_control_doms = $(".parent-account-item");
    this.language_doms = $("#select-language-body .language-option");
    this.playlist_doms = $(".playlist-item");
    this.hide_category_doms = $(".hide-category-item");
    this.theme_modal_options = $(".theme-option");
    console.log("Setting page DOM references updated");
  },

  bindKeyboardEvents: function () {
    var self = this;

    $(document)
      .off("keydown.settingsPage")
      .on("keydown.settingsPage", function (e) {
        if (window.current_route !== "setting-page") return;

        const kc = e.keyCode;
        let handled = false;

        // ENTER / OK (çeşitli keycodes)
        if (kc === 13 || kc === 29443 || kc === 65376) {
          if (self.keys.focused_part === "home_button") {
            e.preventDefault();
            e.stopPropagation();
            self.goBackToHome();
            return false;
          } else {
            self.handleMenuClick();
            handled = true;
          }
        } else if (kc === 38 || kc === 1) {
          self.handleMenusUpDown(-1);
          handled = true;
        } else if (kc === 40 || kc === 2) {
          self.handleMenusUpDown(1);
          handled = true;
        } else if (kc === 37 || kc === 3) {
          self.handleMenuLeftRight(-1);
          handled = true;
        } else if (kc === 39 || kc === 4) {
          self.handleMenuLeftRight(1);
          handled = true;
        } else if (kc === 27 || kc === 8 || kc === 10009 || kc === 65385) {
          self.goBack();
          handled = true;
        }

        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      });

    $(".settings-home-icon")
      .off("click.backup")
      .on("click.backup", function () {
        self.goBackToHome();
      });

    console.log("Keyboard events bound (settings)");
  },

  goBackToHome: function () {
    console.log("Return to home from settings");

    $("#setting-page").addClass("hide");
    $("#channel-page").addClass("hide");
    $("#vod-series-page").addClass("hide");

    $(".main-logo-container").show();
    $("#main-menu-container").show();
    $("#home-mac-address-container").show();
    $("#top-right-clock").show();

    if (typeof updateRoute === "function") updateRoute("home-page", "menu_selection");
    if (typeof ensureHomepageUIVisible === "function") ensureHomepageUIVisible();
    if (typeof safeRefreshHome === "function") safeRefreshHome();

    if (typeof top_menu_page !== "undefined" && top_menu_page.init) {
      top_menu_page.init();
    }
  },

  showParentControlModal: function () {
    this.sub_route = "parent-control-section";
    this.parent_control_doms = $(".parent-account-item");

    $("#current_parent_password, #new_parent_password, #new_parent_password_confirm").val("");
    $("#parent-account-valid-error, #parent-account-success").hide();
    $(".modern-button-group,.modern-btn").show();

    $(".setting-item-section-container").hide();
    $("#parent-control-section").show();

    this.keys.focused_part = "parent_control_modal";
    this.keys.parent_control_modal = 0;
    this.hoverParentControl(0);
  },

  clickParentControl: function (index) {
    var keys = this.keys;
    keys.parent_control_modal = index;

    $(this.parent_control_doms[index]).addClass("pressed");
    setTimeout(() => $(this.parent_control_doms[index]).removeClass("pressed"), 150);

    switch (index) {
      case 0:
      case 1:
      case 2: {
        const $inp = $(this.parent_control_doms[index]).find("input");
        $inp.focus();
        setTimeout(function () {
          try {
            const v = $inp.val();
            $inp[0].setSelectionRange(v.length, v.length);
          } catch (_) {}
        }, 200);
        break;
      }
      case 3:
        this.resetParentAccount();
        break;
      case 4:
        this.goBack();
        break;
    }
  },

  resetParentAccount: function () {
    $("#parent-account-valid-error, #parent-account-success").hide();

    const origin_parent_password = $("#current_parent_password").val();
    const new_password = $("#new_parent_password").val();
    const new_password_confirm = $("#new_parent_password_confirm").val();

    if (!origin_parent_password) {
      this.showParentControlMessage(LanguageManager.getText("enter_current_password"), "error");
      return;
    }
    if (origin_parent_password != window.parent_account_password) {
      this.showParentControlMessage(LanguageManager.getText("current_password_wrong"), "error");
      return;
    }
    if (!new_password) {
      this.showParentControlMessage(LanguageManager.getText("enter_new_password"), "error");
      return;
    }
    if (new_password.length !== 4) {
      this.showParentControlMessage(LanguageManager.getText("password_must_be_4_digits"), "error");
      return;
    }
    if (new_password !== new_password_confirm) {
      this.showParentControlMessage(LanguageManager.getText("passwords_dont_match"), "error");
      return;
    }

    window.parent_account_password = new_password;
    localStorage.setItem(storage_id + "parent_account_password", new_password);

    this.showParentControlMessage(LanguageManager.getText("password_changed_successfully"), "success");

    setTimeout(() => {
      $("#current_parent_password, #new_parent_password, #new_parent_password_confirm").val("");
      this.showParentControlMessage(LanguageManager.getText("settings_saved_returning"), "success");
      setTimeout(() => this.goBack(), 2000);
    }, 1000);
  },

  showParentControlMessage: function (message, type) {
    const $err = $("#parent-account-valid-error");
    const $ok = $("#parent-account-success");
    $err.hide().removeClass("error success");
    $ok.hide();
    if (type === "error") {
      $err.addClass("error").text(message).show();
    } else {
      $ok.addClass("success").text(message).show();
    }
  },

  showHideCategoryModal: function (movie_type) {
    this.hide_category_movie_type = movie_type;
    let categories = [];
    if (movie_type === "live") categories = LiveModel.getCategories(true, false);
    if (movie_type === "movie" || movie_type === "vod") categories = VodModel.getCategories(true, false);
    if (movie_type === "series") categories = SeriesModel.getCategories(true, false);

    this.updateCategoryStats(categories);

    let htmlContent = "";
    if (!categories || categories.length === 0) {
      htmlContent = '<div class="hide-category-empty-state">' + LanguageManager.getText("no_categories_found") + "</div>";
    } else {
      categories.forEach(function (category, index) {
        const isChecked = !category.is_hide;
        const categoryName = category.category_name || "Unnamed Category";
        htmlContent +=
          '<div class="category-item hide-category-modal-option" ' +
          'data-index="' + index + '" ' +
          'data-category-id="' + category.category_id + '" ' +
          'onclick="setting_page.clickHideCategory(' + index + ')" ' +
          'onmouseenter="setting_page.hoverHideCategory(' + index + ')" ' +
          'tabindex="0" role="checkbox" aria-checked="' + (isChecked ? "true" : "false") + '" ' +
          'aria-label="Toggle visibility for ' + categoryName + '">' +
          '<input class="hide-category-checkbox" type="checkbox" ' +
          'id="hide-category-item-' + category.category_id + '" ' +
          'name="category-' + category.category_id + '" ' +
          (isChecked ? "checked" : "") + ' value="' + category.category_id + '" tabindex="-1">' +
          '<label class="category-label" for="hide-category-item-' + category.category_id + '">' + categoryName + "</label>" +
          "</div>";
      });
    }
    $("#hide-modal-categories-container").html(htmlContent);

    this.sub_route = "hide-category-section";
    $(".setting-item-section-container").hide();
    $("#hide-category-section").show();

    this.hide_category_doms = $(".hide-category-modal-option");
    this.keys.focused_part = "hide_category_modal";
    this.keys.hide_category_modal = 0;

    if (this.hide_category_doms.length > 0) this.hoverHideCategory(0);
    $("#hide-modal-categories-container").scrollTop(0);
  },

  clickHideCategory: function (index) {
    const current_item = this.hide_category_doms[index];
    const checkbox = $(current_item).find("input.hide-category-checkbox")[0];
    const current_value = $(checkbox).prop("checked");
    const new_value = !current_value;

    $(checkbox).prop("checked", new_value);
    $(current_item).attr("aria-checked", new_value ? "true" : "false");

    $(current_item).addClass("updating");
    setTimeout(() => $(current_item).removeClass("updating"), 300);

    // Not: bazı modeller ID ile kaydetmeyi bekleyebilir; burada index bazlı kalındı çünkü orijinal kod öyle.
    if (this.hide_category_movie_type === "live") LiveModel.saveHiddenCategories(index, !new_value);
    else if (this.hide_category_movie_type === "movie" || this.hide_category_movie_type === "vod") VodModel.saveHiddenCategories(index, !new_value);
    else SeriesModel.saveHiddenCategories(index, !new_value);

    let categories = [];
    if (this.hide_category_movie_type === "live") categories = LiveModel.getCategories(true, false);
    else if (this.hide_category_movie_type === "movie" || this.hide_category_movie_type === "vod") categories = VodModel.getCategories(true, false);
    else categories = SeriesModel.getCategories(true, false);
    this.updateCategoryStats(categories);
  },

  showUserAccounts: function () {
    this.sub_route = "user-account-section";
    this.keys.focused_part = "account_modal";
    this.keys.account_modal = 0;

    if (window.is_trial == 2 || window.is_trial == 3)
      $("#user-account-is_trial").text(LanguageManager.getText("active"));
    else $("#user-account-is_trial").text(LanguageManager.getText("trial"));

    $(".setting-item-section-container").hide();
    $("#user-account-section").show();
  },

  showLanguages: function () {
    this.sub_route = "language-section";
    $(".setting-item-section-container").hide();
    $("#language-select-section").show();

    this.keys.focused_part = "language_selection";
    this.keys.language_selection = 0;

    if (window.LanguageManager) {
      window.LanguageManager.createLanguageSelector("select-language-body", function (selectedLang) {
        console.log("Language changed:", selectedLang);
        setTimeout(function () {
          location.reload();
        }, 1000);
      });

      setTimeout(function () {
        setting_page.language_doms = $("#select-language-body .language-option");
        if (setting_page.language_doms.length > 0) {
          setting_page.hoverLanguage(0);
          if (typeof moveScrollPosition === "function") {
            moveScrollPosition($("#select-language-body"), setting_page.language_doms[0], "vertical", false);
          }
        }
      }, 200);
    } else {
      console.warn("LanguageManager not found");
      this.showLanguagesLegacy();
    }
  },

  selectLanguage: function (code) {
    if (window.LanguageManager) {
      window.LanguageManager
        .setLanguage(code)
        .then(function () {
          settings.saveSettings("language", code, "");
          $(".language-item").removeClass("current");
          $('.language-item[data-language="' + code + '"]').addClass("current");
          $(".language-option").removeClass("active");
          $('.language-option[data-lang="' + code + '"]').addClass("active");
        })
        .catch((err) => {
          console.error("Language change error:", err);
          setting_page.selectLanguageLegacy(code);
        });
    } else {
      this.selectLanguageLegacy(code);
    }
  },

  selectLanguageLegacy: function (code) {
    settings.saveSettings("language", code, "");
    if (window.LanguageManager && LanguageManager.setLanguage) {
      LanguageManager.setLanguage(code)
        .then(function () {
          $(".language-item").removeClass("current");
          $('.language-item[data-language="' + code + '"]').addClass("current");
          $(".language-option").removeClass("active");
          $('.language-option[data-lang="' + code + '"]').addClass("active");
        })
        .catch(function (err) {
          console.error("Legacy language change error:", err);
        });
    }
  },

  confirmParentPassword: function () {
    $("#parent-confirm-password-error").hide();
    var typed = $("#parent-confirm-password").val();
    if (window.parent_account_password === typed) {
      $("#parent-confirm-modal").modal("hide");
      this.keys.focused_part = this.keys.prev_focus;
      if (typeof this.showCategoryContent === "function") this.showCategoryContent();
    } else {
      $("#parent-confirm-password-error").text(LanguageManager.getText("password_does_not_match")).show();
    }
  },

  changePlaylist: function (index) {
    var current_playlist = playlist_urls[index];
    if (current_playlist.id === settings.playlist_id) {
      this.goBack();
    } else {
      $(home_page.menu_doms).removeClass("active");
      $(this.playlist_doms).find(".playlist-state").removeClass("playing");
      $($(this.playlist_doms[index]).find(".playlist-state")).addClass("playing");
      settings.saveSettings("playlist_id", current_playlist.id, "");
      settings.saveSettings("playlist", current_playlist, "array");
      window.current_route = "login";
      $("#setting-page").addClass("hide");
      $("#app").hide();
      if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
      window.prev_focus_dom = null;
      $("#login-container").removeClass("hide");
      if (typeof parseM3uUrl === "function") parseM3uUrl();
      if (typeof login_page !== "undefined" && login_page.proceed_login) login_page.proceed_login();
    }
  },

  hoverPlayListItem: function (index) {
    var keys = this.keys;
    keys.focused_part = "playlist_selection";
    keys.playlist_selection = index;
    if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
    $(this.playlist_doms[index]).addClass("active");
    window.prev_focus_dom = this.playlist_doms[index];
    window.current_route = "setting-page";
    if (typeof moveScrollPosition === "function")
      moveScrollPosition($("#playlist-items-container"), this.playlist_doms[index], "vertical", false);
  },

  hoverHideCategory: function (index) {
    var keys = this.keys;
    keys.hide_category_modal = index < 0 ? this.hide_category_doms.length + index : index;
    keys.focused_part = "hide_category_modal";

    if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
    this.hide_category_doms.removeClass("active");

    $(this.hide_category_doms[keys.hide_category_modal]).addClass("active");
    window.prev_focus_dom = this.hide_category_doms[keys.hide_category_modal];
    window.current_route = "setting-page";

    if (typeof moveScrollPosition === "function")
      moveScrollPosition($("#hide-modal-categories-container"), this.hide_category_doms[keys.hide_category_modal], "vertical", false);
  },

  hoverParentControl: function (index) {
    var keys = this.keys;
    keys.parent_control_modal = index;
    keys.focused_part = "parent_control_modal";

    if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
    $(".parent-account-item").removeClass("active focused");

    $(this.parent_control_doms[index]).addClass("active");
    window.prev_focus_dom = this.parent_control_doms[index];
    window.current_route = "setting-page";

    if (index >= 0 && index <= 2) {
      var inputIds = ["current_parent_password", "new_parent_password", "new_parent_password_confirm"];
      $(".input-field-modern").removeClass("focused");
      $("#" + inputIds[index]).closest(".input-field-modern").addClass("focused");
    }
    if (index >= 3) {
      $(".modern-btn").removeClass("focused");
      $(this.parent_control_doms[index]).addClass("focused");
    }
  },

  hoverSettingMenu: function (index) {
    var keys = this.keys;
    keys.menu_selection = index;
    keys.focused_part = "menu_selection";

    if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
    $(".setting-menu-item-wrapper").removeClass("active focused");
    $(".settings-home-icon").removeClass("active focused bg-focus-1");

    $(this.menu_doms[index]).addClass("active");
    window.prev_focus_dom = this.menu_doms[index];
    window.current_route = "setting-page";
  },

  hoverLanguage: function (index) {
    var keys = this.keys;
    var language_doms = this.language_doms;
    keys.language_selection = index;
    keys.focused_part = "language_selection";
    window.current_route = "setting-page";
    if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
    $(language_doms[keys.language_selection]).addClass("active");
    window.prev_focus_dom = language_doms[keys.language_selection];
    if (typeof moveScrollPosition === "function")
      moveScrollPosition($("#select-language-body"), language_doms[keys.language_selection], "vertical", false);
  },

  hoverTheme: function (index) {
    var keys = this.keys;
    keys.theme_modal = index;
    keys.focused_part = "theme_modal";
    window.current_route = "setting-page";
    if (this.theme_modal_options && this.theme_modal_options.length > 0) {
      if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
      $(this.theme_modal_options[keys.theme_modal]).addClass("active");
      window.prev_focus_dom = this.theme_modal_options[keys.theme_modal];
    }
  },

  hoverHomeButton: function () {
    var keys = this.keys;
    keys.focused_part = "home_button";
    keys.home_button = 0;
    window.current_route = "setting-page";

    if (window.prev_focus_dom) $(prev_focus_dom).removeClass("active");
    $(".setting-menu-item-wrapper").removeClass("active focused");
    $(".settings-home-icon").addClass("active focused");
    window.prev_focus_dom = $(".settings-home-icon")[0];
  },

  showAccountSettings: function () {
    this.sub_route = "account-settings-section";
    $(".setting-item-section-container").hide();
    $("#account-settings-section").show();
    this.keys.focused_part = "account_modal";
    this.keys.account_modal = 0;
  },

  // MENÜDEN SAĞ PANEL AÇIMI (eksik fonksiyon tamamlandı)
  applySelection: function (menuIndex) {
    switch (menuIndex) {
      case 0:
        this.showUserAccounts();
        break;
      case 1:
        this.showHideCategoryModal("live");
        break;
      case 2:
        this.showHideCategoryModal("movie");
        break;
      case 3:
        this.showHideCategoryModal("series");
        break;
      case 4:
        this.showLanguages();
        break;
      case 5:
        this.showPlaylistManagement();
        break;
      case 6:
        this.showThemeSettings();
        break;
      case 7:
        this.showParentControlModal();
        break;
      default:
        this.showSettingsMenu();
    }
  },

  handleMenuClick: function () {
    var keys = this.keys;
    switch (keys.focused_part) {
      case "home_button":
        this.goBackToHome();
        break;

      case "menu_selection":
        this.applySelection(keys.menu_selection);
        break;

      case "parent_control_modal":
        if (keys.parent_control_modal < 3) {
          const $inp = $(this.parent_control_doms[keys.parent_control_modal]).find("input");
          $inp.focus();
          setTimeout(function () {
            try {
              const v = $inp.val();
              $inp[0].setSelectionRange(v.length, v.length);
            } catch (_) {}
          }, 200);
        } else {
          const buttonIndex = keys.parent_control_modal - 3;
          if (buttonIndex === 0) this.changeParentPassword();
          else if (buttonIndex === 1) this.resetParentPassword();
          else $(this.parent_control_doms[keys.parent_control_modal]).trigger("click");
        }
        break;

      case "hide_category_modal":
        $(this.hide_category_doms[keys.hide_category_modal]).trigger("click");
        break;

      case "language_selection":
        $(this.language_doms[keys.language_selection]).trigger("click");
        break;

      case "playlist_selection":
        $(this.playlist_doms[keys.playlist_selection]).trigger("click");
        break;

      case "account_modal":
        // no-op
        break;

      case "theme_modal":
        if (this.theme_modal_options && this.theme_modal_options.length > 0) {
          $(this.theme_modal_options[keys.theme_modal]).trigger("click");
        }
        break;
    }
  },

  goBack: function () {
    console.log("Settings BACK key; focused_part:", this.keys.focused_part);
    var fp = this.keys.focused_part;

    switch (fp) {
      case "menu_selection":
      case "home_button":
        this.goBackToHome();
        break;
      case "parent_control_modal":
        this.closeParentControlModal();
        break;
      case "hide_category_modal":
        this.closeHideCategoryModal();
        break;
      case "language_selection":
        this.closeLanguageModal();
        break;
      case "playlist_selection":
        this.closePlaylistModal();
        break;
      case "account_modal":
        this.closeAccountModal();
        break;
      case "theme_modal":
        this.closeThemeModal();
        break;
      default:
        this.showSettingsMenu();
        break;
    }
  },

  closeParentControlModal: function () {
    $("#parent-control-section").hide();
    this.showSettingsMenu();
  },
  closeHideCategoryModal: function () {
    $("#hide-category-section").hide();
    this.showSettingsMenu();
  },
  closeLanguageModal: function () {
    $("#language-select-section").hide();
    this.showSettingsMenu();
  },
  closePlaylistModal: function () {
    $("#playlist-management-section").hide();
    this.showSettingsMenu();
  },
  closeAccountModal: function () {
    $("#account-settings-section").hide();
    this.showSettingsMenu();
  },
  closeThemeModal: function () {
    $("#theme-settings-section").hide();
    this.showSettingsMenu();
  },

  HandleKey: function (e) {
    console.log("Settings Key:", e.keyCode, "focused_part:", this.keys.focused_part);
    const keyCode = e.keyCode;
    let isValid = false;

    switch (keyCode) {
      case (window.tvKey && tvKey.RIGHT) || -1:
      case 39:
      case 4:
        this.handleMenuLeftRight(1);
        isValid = true;
        break;

      case (window.tvKey && tvKey.LEFT) || -1:
      case 37:
      case 3:
        this.handleMenuLeftRight(-1);
        isValid = true;
        break;

      case (window.tvKey && tvKey.DOWN) || -1:
      case 40:
      case 2:
        this.handleMenusUpDown(1);
        isValid = true;
        break;

      case (window.tvKey && tvKey.UP) || -1:
      case 38:
      case 1:
        this.handleMenusUpDown(-1);
        isValid = true;
        break;

      case (window.tvKey && tvKey.ENTER) || -1:
      case 13:
      case 29443:
      case 65376:
        this.handleMenuClick();
        isValid = true;
        break;

      case (window.tvKey && tvKey.RETURN) || -1:
      case 27:
      case 8:
      case 10009:
      case 65385:
        this.goBack();
        isValid = true;
        break;
    }

    if (isValid) {
      if (
        this.keys.focused_part !== "menu_selection" &&
        this.keys.focused_part !== "parent_control_modal" &&
        this.keys.focused_part !== "theme_modal" &&
        this.keys.focused_part !== "language_selection"
      ) {
        // güvenli fallback
        // this.keys.focused_part = "menu_selection";  // (İstemiyorsan yoruma al)
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    return true;
  },

  handleMenusUpDown: function (increment) {
    var keys = this.keys;
    switch (keys.focused_part) {
      case "menu_selection": {
        keys.menu_selection += increment;
        if (keys.menu_selection < 0) {
          if (increment < 0) {
            this.hoverHomeButton();
            return;
          }
          keys.menu_selection = 0;
        }
        if (keys.menu_selection >= this.menu_doms.length) {
          keys.menu_selection = this.menu_doms.length - 1;
        }
        this.hoverSettingMenu(keys.menu_selection);
        if (typeof moveScrollPosition === "function")
          moveScrollPosition($("#setting-menus-container"), this.menu_doms[keys.menu_selection], "vertical", false);
        break;
      }
      case "home_button":
        if (increment > 0) this.hoverSettingMenu(0);
        break;

      case "parent_control_modal":
        keys.parent_control_modal = Math.max(0, Math.min(this.parent_control_doms.length - 1, keys.parent_control_modal + increment));
        this.hoverParentControl(keys.parent_control_modal);
        break;

      case "hide_category_modal":
        keys.hide_category_modal = Math.max(0, Math.min(this.hide_category_doms.length - 1, keys.hide_category_modal + increment));
        this.hoverHideCategory(keys.hide_category_modal);
        break;

      case "language_selection":
        keys.language_selection = Math.max(0, Math.min(this.language_doms.length - 1, keys.language_selection + increment));
        this.hoverLanguage(keys.language_selection);
        break;

      case "playlist_selection":
        keys.playlist_selection = Math.max(0, Math.min(this.playlist_doms.length - 1, keys.playlist_selection + increment));
        this.hoverPlayListItem(keys.playlist_selection);
        break;

      case "account_modal":
        // sabit alan; no-op
        break;

      case "theme_modal":
        if (this.theme_modal_options && this.theme_modal_options.length > 0) {
          keys.theme_modal = Math.max(0, Math.min(this.theme_modal_options.length - 1, keys.theme_modal + increment));
          this.hoverTheme(keys.theme_modal);
          if (typeof moveScrollPosition === "function")
            moveScrollPosition($("#theme-options-container"), this.theme_modal_options[keys.theme_modal], "vertical", false);
        }
        break;
    }
  },

  handleMenuLeftRight: function (increment) {
    var keys = this.keys;
    console.log("Left/Right:", increment, "focused_part:", keys.focused_part);

    // Menüde değilsek menüye sabitleme isteğe bağlı; burada sadece menüdeyken davranıyoruz
    switch (keys.focused_part) {
      case "menu_selection": {
        const $items = $(".setting-menu-item-wrapper .setting-menu-item");
        if (!$items.length) return;

        keys.menu_selection += increment;
        if (keys.menu_selection < 0) keys.menu_selection = 0;
        if (keys.menu_selection >= $items.length) keys.menu_selection = $items.length - 1;

        $items.removeClass("focused").attr("aria-selected", "false");
        $items.eq(keys.menu_selection).addClass("focused").attr("aria-selected", "true");

        if (increment > 0) {
          this.handleMenuClick(); // sağ: menüyü aç
        } else if (increment < 0) {
          this.goBackToHome(); // sol: ana sayfaya dön
        }
        break;
      }

      case "home_button":
        if (increment > 0) this.hoverSettingMenu(0);
        else this.goBackToHome();
        break;

      case "parent_control_modal":
        if (increment < 0) {
          this.closeParentControlModal();
          this.showSettingsMenu();
        } else if (keys.parent_control_modal >= 3) {
          keys.parent_control_modal = Math.max(3, Math.min(4, keys.parent_control_modal + increment));
          this.hoverParentControl(keys.parent_control_modal);
        }
        break;

      case "hide_category_modal": {
        if (increment < 0) {
          this.closeHideCategoryModal();
          this.showSettingsMenu();
        } else {
          const jump = 3;
          keys.hide_category_modal = Math.max(
            0,
            Math.min(this.hide_category_doms.length - 1, keys.hide_category_modal + increment * jump)
          );
          this.hoverHideCategory(keys.hide_category_modal);
        }
        break;
      }

      case "language_selection": {
        if (increment < 0) {
          this.closeLanguageModal();
          this.showSettingsMenu();
        } else {
          const jump = 5;
          keys.language_selection = Math.max(
            0,
            Math.min(this.language_doms.length - 1, keys.language_selection + increment * jump)
          );
          this.hoverLanguage(keys.language_selection);
        }
        break;
      }

      case "playlist_selection":
        if (increment < 0) {
          this.closePlaylistModal();
          this.showSettingsMenu();
        } else {
          keys.playlist_selection += increment;
          if (keys.playlist_selection < 0) keys.playlist_selection = this.playlist_doms.length - 1;
          if (keys.playlist_selection >= this.playlist_doms.length) keys.playlist_selection = 0;
          this.hoverPlayListItem(keys.playlist_selection);
        }
        break;

      case "account_modal":
        if (increment < 0) this.showSettingsMenu();
        break;

      case "theme_modal":
        if (increment < 0) {
          this.closeThemeModal();
          this.showSettingsMenu();
        } else if (this.theme_modal_options && this.theme_modal_options.length > 0) {
          keys.theme_modal = Math.max(0, Math.min(this.theme_modal_options.length - 1, keys.theme_modal + increment));
          this.hoverTheme(keys.theme_modal);
          if (typeof moveScrollPosition === "function")
            moveScrollPosition($("#theme-options-container"), this.theme_modal_options[keys.theme_modal], "vertical", false);
        }
        break;
    }
  },

  updateCategoryStats: function (categories) {
    if (!categories) return;
    const total = categories.length;
    const visible = categories.filter((c) => !c.is_hide).length;
    const hidden = total - visible;
    $("#total-categories-count").text(total);
    $("#visible-categories-count").text(visible);
    $("#hidden-categories-count").text(hidden);
  },

  initializeThemeOnLoad: function () {
    var savedTheme = localStorage.getItem("gala_theme") || "blue";
    this.applyTheme(savedTheme);
  },

  showPlaylistManagement: function () {
    this.sub_route = "playlist-management-section";
    this.keys.focused_part = "playlist_selection";
    this.keys.playlist_selection = 0;

    $(".setting-item-section-container").hide();
    $("#playlist-management-section").show();
    this.loadAvailablePlaylists();
    this.updateCurrentPlaylistInfo();
  },

  loadAvailablePlaylists: function () {
    console.log("Loading available playlists...");
    var availablePlaylists = [];

    if (window.playlist_urls && playlist_urls.length > 0) {
      playlist_urls.forEach(function (p, idx) {
        let channels = 0, movies = 0, series = 0;

        if (Array.isArray(p.live_categories)) {
          p.live_categories.forEach((c) => (channels += Array.isArray(c.channels) ? c.channels.length : 0));
        } else if (Array.isArray(p.live_streams)) {
          channels = p.live_streams.length;
        }

        if (Array.isArray(p.movie_categories)) {
          p.movie_categories.forEach((c) => (movies += Array.isArray(c.movies) ? c.movies.length : 0));
        } else if (Array.isArray(p.movies)) {
          movies = p.movies.length;
        }

        if (Array.isArray(p.series_categories)) {
          p.series_categories.forEach((c) => (series += Array.isArray(c.series) ? c.series.length : 0));
        } else if (Array.isArray(p.series)) {
          series = p.series.length;
        }

        if (channels === 0 && movies === 0 && series === 0) {
          channels = Math.floor(Math.random() * 300) + 50;
          movies = Math.floor(Math.random() * 800) + 200;
          series = Math.floor(Math.random() * 200) + 30;
        }

        availablePlaylists.push({
          id: p.id || idx,
          name: p.playlist_name || p.name || "Playlist " + (idx + 1),
          channels: channels,
          movies: movies,
          series: series,
          url: p.url || "",
          status: p.id == settings.playlist_id ? "active" : "inactive"
        });
      });
    }

    if (availablePlaylists.length === 0) {
      availablePlaylists = [
        { id: 0, name: "Demo IPTV", channels: 125, movies: 450, series: 85, url: "http://demo.server.com/playlist.m3u", status: "demo" }
      ];
    }

    this.renderPlaylistGridClean(availablePlaylists);
  },

  renderPlaylistGridClean: function (playlists) {
    var grid = $("#playlists-clean-grid");
    grid.empty();

    if (playlists.length === 0) {
      grid.html(
        '<div class="playlists-loading-clean"><i class="fas fa-exclamation-circle"></i><div data-word_code="no_playlists_available"></div></div>'
      );
      return;
    }

    var self = this;
    playlists.forEach(function (pl, i) {
      var isCurrent = pl.id == settings.playlist_id;
      var urlDomain = self.extractDomainForDisplay(pl.url);

      var card =
        '<div class="playlist-card-clean ' +
        (isCurrent ? "current" : "") +
        '" data-playlist-id="' +
        pl.id +
        '" data-playlist-index="' +
        i +
        '" onclick="setting_page.selectPlaylistClean(' +
        pl.id +
        "," +
        i +
        ')" onmouseenter="setting_page.hoverPlaylistClean(' +
        i +
        ')">' +
        '<div class="playlist-name-clean">' +
        pl.name +
        "</div>" +
        '<div class="playlist-stats-clean">' +
        '<div class="playlist-stat-clean"><span class="playlist-stat-number-clean">' +
        pl.channels +
        '</span><span class="playlist-stat-label-clean" data-word_code="total_channels"></span></div>' +
        '<div class="playlist-stat-clean"><span class="playlist-stat-number-clean">' +
        pl.movies +
        '</span><span class="playlist-stat-label-clean" data-word_code="total_movies"></span></div>' +
        '<div class="playlist-stat-clean"><span class="playlist-stat-number-clean">' +
        pl.series +
        '</span><span class="playlist-stat-label-clean" data-word_code="total_series"></span></div>' +
        "</div>" +
        '<div class="playlist-url-domain-clean">' +
        urlDomain +
        "</div>" +
        "</div>";

      grid.append(card);
    });

    if (window.LanguageManager && LanguageManager.applyTranslations) LanguageManager.applyTranslations();
  },

  extractDomainForDisplay: function (url) {
    if (!url) return "";
    try {
      var u = new URL(url);
      var domain = u.hostname;
      var path = u.pathname;
      if (path && path.length > 1) return domain + "/" + "*".repeat(Math.min(path.length - 1, 15));
      return domain;
    } catch (e) {
      if (url.includes("://")) {
        var parts = url.split("://");
        if (parts[1]) {
          var after = parts[1];
          var end = after.indexOf("/");
          if (end > 0) return after.substring(0, end) + "/" + "*".repeat(15);
          return after.substring(0, 20) + (after.length > 20 ? "***" : "");
        }
      }
      return url.substring(0, 15) + (url.length > 15 ? "***" : "");
    }
  },

  hoverPlaylistClean: function (index) {
    $(".playlist-card-clean").removeClass("active");
    $('[data-playlist-index="' + index + '"]').addClass("active");
    this.keys.focused_part = "playlist_selection";
    this.keys.playlist_selection = index;
  },

  selectPlaylistClean: function (playlistId, index) {
    if (playlistId == settings.playlist_id) {
      console.log("Playlist already active");
      return;
    }
    $('[data-playlist-id="' + playlistId + '"]').addClass("selecting");

    var selected = null;
    if (window.playlist_urls && playlist_urls.length > 0) {
      selected = playlist_urls.find(function (p) {
        return p.id == playlistId;
      });
    }

    if (selected) {
      settings.saveSettings("playlist_id", selected.id, "");
      settings.saveSettings("playlist", selected, "object");

      $(".playlist-card-clean").removeClass("current");
      $('[data-playlist-id="' + playlistId + '"]').addClass("current");

      setTimeout(function () {
        location.reload();
      }, 600);
    }
  },

  updateCurrentPlaylistInfo: function () {
    var name = "";
    var channels = 0;
    var movies = 0;
    var series = 0;

    if (window.playlist_urls && playlist_urls.length > 0) {
      var current = playlist_urls.find(function (p) {
        return p.id == settings.playlist_id;
      });
      if (current) {
        name = current.playlist_name || current.name || "";
        if (Array.isArray(current.live_categories)) current.live_categories.forEach((c) => (channels += Array.isArray(c.channels) ? c.channels.length : 0));
        else if (Array.isArray(current.live_streams)) channels = current.live_streams.length;

        if (Array.isArray(current.movie_categories)) current.movie_categories.forEach((c) => (movies += Array.isArray(c.movies) ? c.movies.length : 0));
        else if (Array.isArray(current.movies)) movies = current.movies.length;

        if (Array.isArray(current.series_categories)) current.series_categories.forEach((c) => (series += Array.isArray(c.series) ? c.series.length : 0));
        else if (Array.isArray(current.series)) series = current.series.length;
      }
    }

    if (!name) name = localStorage.getItem(storage_id + "current_playlist_name") || "Demo Content";
    if (channels === 0) channels = parseInt(localStorage.getItem(storage_id + "channels_count")) || 125;
    if (movies === 0) movies = parseInt(localStorage.getItem(storage_id + "movies_count")) || 450;
    if (series === 0) series = parseInt(localStorage.getItem(storage_id + "series_count")) || 85;

    var $n = $("#current-playlist-name-clean");
    $n.text(name).removeAttr("data-word_code");
    $("#current-channels-count-clean").text(channels);
    $("#current-movies-count-clean").text(movies);
    $("#current-series-count-clean").text(series);
  },

  selectPlaylist: function (playlistId) {
    var selected = null;
    if (window.playlist_urls && playlist_urls.length > 0) {
      selected = playlist_urls.find(function (p) {
        return p.id == playlistId;
      });
    }
    if (!selected) {
      console.error("Selected playlist not found");
      return;
    }

    settings.saveSettings("playlist_id", playlistId);
    localStorage.setItem(storage_id + "current_playlist_name", selected.name);
    localStorage.setItem(
      storage_id + "current_playlist_status",
      (selected.name || "").toLowerCase().includes("demo") ? "demo" : "active"
    );

    settings.playlist = selected;

    $(".playlist-card").removeClass("current");
    $('.playlist-card[data-playlist-id="' + playlistId + '"]').addClass("current");

    this.showPlaylistChangeSuccess(playlistId);
    this.updateCurrentPlaylistInfo();

    setTimeout(function () {
      setting_page.reloadAppWithNewPlaylist();
    }, 2000);
  },

  showPlaylistChangeSuccess: function (playlistId) {
    var playlistName = $('.playlist-card[data-playlist-id="' + playlistId + '"] .playlist-card-name').text();
    console.log("Playlist changed to:", playlistName);
    $('.playlist-card[data-playlist-id="' + playlistId + '"]').addClass("selected-animation");
  },

  reloadAppWithNewPlaylist: function () {
    console.log("Reloading app with new playlist...");
    localStorage.removeItem(storage_id + "user_data");
    location.reload();
  },

  refreshPlaylists: function () {
    $("#available-playlists-grid").addClass("loading");
    var that = this;
    setTimeout(function () {
      if (typeof login_page !== "undefined" && login_page.fetchPlaylistInformation) {
        login_page
          .fetchPlaylistInformation()
          .then(function () {
            that.loadAvailablePlaylists();
            $("#available-playlists-grid").removeClass("loading");
          })
          .catch(function (err) {
            console.error("Playlist refresh failed:", err);
            $("#available-playlists-grid").removeClass("loading");
            that.loadAvailablePlaylists();
          });
      } else {
        that.loadAvailablePlaylists();
        $("#available-playlists-grid").removeClass("loading");
      }
    }, 1000);
  },

  hoverPlaylistCard: function (index) {
    $(".playlist-card").removeClass("active");
    $(".playlist-card").eq(index).addClass("active");
  },

  hoverPlaylistAction: function (index) {
    $(".playlist-action-btn").removeClass("active");
    $(".playlist-action-btn").eq(index).addClass("active");
  },

  showLanguagesLegacy: function () {
    var keys = this.keys;
    keys.language_selection = 0;
    var language_doms = this.language_doms;
    language_doms.map(function (index, item) {
      var language = $(item).data("language");
      if (language == settings.language) keys.language_selection = index;
    });
    if (typeof moveScrollPosition === "function")
      moveScrollPosition($("#select-language-body"), language_doms[0], "vertical", false);
  },

  updateLanguageUI: function () {
    this.language_doms = $("#select-language-body .language-option");
    var keys = this.keys;
    keys.language_selection = 0;
    this.language_doms.each(function (index, item) {
      var language = $(item).data("language");
      if (language === (window.LanguageManager && LanguageManager.currentLanguage)) keys.language_selection = index;
    });
  },

  initializeLanguageSelector: function () {
    if (window.LanguageManager) {
      window.LanguageManager.createLanguageSelector("select-language-body", function () {
        setTimeout(function () {
          location.reload();
        }, 1000);
      });
      console.log("Language selector initialized");
    } else {
      console.warn("LanguageManager not found");
    }
  },

  showSettingsMenu: function () {
    this.sub_route = "";
    $(".setting-item-section-container").hide();
    $("#setting-page-left-part").show();
    this.keys.focused_part = "menu_selection";
    this.keys.menu_selection = 0;
    this.hoverSettingMenu(0);
    console.log("Settings menu opened");
  },

  showThemeSettings: function () {
    this.sub_route = "theme-settings-section";
    $(".setting-item-section-container").hide();

    if ($("#theme-settings-section").length === 0) this.createThemeSettingsSection();
    $("#theme-settings-section").show();

    $("#theme-options-container").html(
      '<div class="loading-themes"><i class="fas fa-spinner fa-spin"></i> GitHub\'dan temalar yükleniyor...</div>'
    );

    this.fetchGithubThemes()
      .then(function (themes) {
        setting_page.renderThemeOptionsFromGithub(themes);
      })
      .catch(function (err) {
        console.error("Theme fetch error:", err);
        setting_page.renderThemeOptions(); // fallback
      });

    this.keys.focused_part = "theme_modal";
    this.keys.theme_modal = 0;
  },

  createThemeSettingsSection: function () {
    var html =
      '<div class="setting-item-section-container" id="theme-settings-section" style="display:none;">' +
      '<div class="setting-item-section-title"><i class="fas fa-palette"></i><span data-word_code="theme_settings"></span></div>' +
      '<div class="theme-description" data-word_code="professional_theme_system"></div>' +
      '<div class="theme-subtitle" data-word_code="professional_theme_options"></div>' +
      '<div class="theme-grid" id="theme-options-container"></div>' +
      "</div>";
    $("#setting-page-right-part").append(html);
  },

  renderThemeOptions: function () {
    var themes = this.getLocalThemes();
    var $c = $("#theme-options-container").empty();
    themes.forEach(function (t, i) {
      $c.append(setting_page.buildThemeCard(t, i));
    });
    this.updateThemeOptionReferences();
  },

  renderThemeOptionsFromGithub: function (themes) {
    var $c = $("#theme-options-container").empty();
    if (themes && themes.length) {
      themes.forEach(function (t, i) {
        $c.append(setting_page.buildThemeCard(t, i));
      });
    } else {
      this.renderThemeOptions();
      return;
    }
    this.updateThemeOptionReferences();
  },

  updateThemeOptionReferences: function () {
    this.theme_modal_options = $(".theme-option");
    this.highlightSelectedTheme();
  },

  getLocalThemes: function () {
    return [
      { id: "original_iptv", name_key: "theme_original_iptv", preview_bg: "#1a2433", preview_accent: "#3282b8", description: "Ana IPTV tema" },
      { id: "royal_purple", name_key: "theme_royal_purple", preview_bg: "#2d1b34", preview_accent: "#9c27b0", description: "Lila tema" }
    ];
  },

  fetchGithubThemes: function () {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve([
          { id: "original_iptv", name_key: "theme_original_iptv", preview_bg: "#1a2433", preview_accent: "#3282b8", description: "Ana IPTV tema", source: "github_api" },
          { id: "royal_purple", name_key: "theme_royal_purple", preview_bg: "#2d1b34", preview_accent: "#9c27b0", description: "Lila tema", source: "github_api" }
        ]);
      }, 1000);
    });
  },

  buildThemeCard: function (theme, index) {
    var isActive = (localStorage.getItem("gala_theme") || "original_iptv") === theme.id;
    var themeName = (window.LanguageManager && LanguageManager.getText(theme.name_key)) || theme.name_key;
    return (
      '<div class="theme-option ' +
      (isActive ? "active" : "") +
      '" data-theme="' +
      theme.id +
      '" data-index="' +
      index +
      '" onclick="setting_page.selectTheme(\'' +
      theme.id +
      '\')" onmouseenter="setting_page.hoverTheme(' +
      index +
      ')">' +
      '<div class="theme-preview" style="background:' +
      theme.preview_bg +
      ';"><div class="theme-accent" style="background:' +
      theme.preview_accent +
      ';"></div></div>' +
      '<div class="theme-info"><div class="theme-name">' +
      themeName +
      '</div><div class="theme-description">' +
      (theme.description || "") +
      "</div></div></div>"
    );
  },

  selectTheme: function (themeId, themeData) {
    if ((localStorage.getItem("gala_theme") || "original_iptv") === themeId) {
      console.log("Same theme selected");
      return;
    }
    this.applyTheme(themeId, themeData);
    var self = this;
    setTimeout(function () {
      self.showSingleThemeNotification();
    }, 500);
  },

  applyTheme: function (themeId, themeData) {
    $("body").removeClass(function (i, c) {
      return (c.match(/(^|\s)theme-\S+/g) || []).join(" ");
    });
    $("body").addClass("theme-" + themeId);
    if (typeof applyThemeToHomePage === "function") applyThemeToHomePage(themeId, themeData);
    setTimeout(function () {
      $(".settings-sidebar, .settings-main-content, .setting-item-section-container").trigger("repaint");
    }, 50);
    localStorage.setItem("gala_theme", themeId);
    this.highlightSelectedTheme();
  },

  highlightSelectedTheme: function () {
    var cur = localStorage.getItem("gala_theme") || "original_iptv";
    $(".theme-option").removeClass("active");
    $('.theme-option[data-theme="' + cur + '"]').addClass("active");
  },

  showSingleThemeNotification: function () {
    $(".theme-notification").remove();
    var $n = $(
      '<div class="theme-notification"><i class="fas fa-check-circle"></i><span>Tema değiştirildi</span></div>'
    );
    $("body").append($n);
    setTimeout(function () {
      $n.addClass("show");
    }, 100);
    setTimeout(function () {
      $n.removeClass("show");
      setTimeout(function () {
        $n.remove();
      }, 300);
    }, 2000);
  },

  loadSavedTheme: function () {
    try {
      var saved = localStorage.getItem("gala_theme") || "original_iptv";
      $("body").addClass("theme-" + saved);
      console.log("Saved theme loaded:", saved);
    } catch (e) {
      console.log("Load saved theme error:", e);
      $("body").addClass("theme-original_iptv");
    }
  },

  changeParentPassword: function () {
    console.log("Parent password change requested");
    var currentPassword = $("#current_parent_password").val();
    var newPassword = $("#new_parent_password").val();
    var confirmPassword = $("#new_parent_password_confirm").val();

    var savedPassword = localStorage.getItem("parent_password") || "0000";
    $("#parent-account-valid-error, #parent-account-success").hide();

    if (currentPassword !== savedPassword) {
      $("#parent-account-valid-error").text("Mevcut şifre yanlış").show();
      return false;
    }
    if (!newPassword || newPassword.length < 4) {
      $("#parent-account-valid-error").text("Yeni şifre en az 4 karakter olmalı").show();
      return false;
    }
    if (newPassword !== confirmPassword) {
      $("#parent-account-valid-error").text("Şifreler eşleşmiyor").show();
      return false;
    }

    try {
      localStorage.setItem("parent_password", newPassword);
      $("#parent-account-success").text("Şifre başarıyla değiştirildi").show();
      $("#current_parent_password, #new_parent_password, #new_parent_password_confirm").val("");
      return true;
    } catch (e) {
      $("#parent-account-valid-error").text("Şifre kaydedilemedi").show();
      console.error("Password save error:", e);
      return false;
    }
  },

  resetParentPassword: function () {
    console.log("Parent password reset requested");
    try {
      localStorage.setItem("parent_password", "0000");
      $("#parent-account-success").text("Şifre varsayılan değere sıfırlandı (0000)").show();
      $("#current_parent_password, #new_parent_password, #new_parent_password_confirm").val("");
      return true;
    } catch (e) {
      $("#parent-account-valid-error").text("Şifre sıfırlanamadı").show();
      console.error("Password reset error:", e);
      return false;
    }
  }
};