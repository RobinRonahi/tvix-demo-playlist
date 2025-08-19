"use strict";

/**
 * Playlist page controller (Samsung TV / ES5 safe)
 * - English-only logs/comments
 * - Lazy DOM capture and defensive checks
 * - No implicit globals (uses internal lastFocusedDom)
 * - Works with tvKey (A6/A9) and updateRoute() when present
 */

var playlist_page = {
    initiated: false,

    keys: {
        focused_part: "playlist_selection",
        playlist_selection: 0
    },

    playlist_doms: [],
    lastFocusedDom: null,

    init: function () {
        try {
            if (typeof setting_page !== "undefined") {
                setting_page.sub_route = "playlist-page";
            }

            // Rebuild DOM on every entry to stay fresh with settings / language
            var htmlContents = "";
            var list = (typeof playlist_urls !== "undefined" && playlist_urls) ? playlist_urls : [];
            var currentId = (typeof settings !== "undefined" && settings.playlist_id) ? settings.playlist_id : null;

            if (!list || list.length === 0) {
                htmlContents =
                    '<div class="playlist-empty">' +
                    '  <div class="playlist-empty-state">' +
                    '    <i class="fas fa-list"></i>' +
                    '    <h4>No playlists found</h4>' +
                    '    <p>Go to Settings to add a playlist.</p>' +
                    '  </div>' +
                    '</div>';
            } else {
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var isPlaying = (currentId === item.id);
                    var name = item.playlist_name || item.name || ("Playlist " + (i + 1));
                    htmlContents +=
                        '<div class="playlist-item-container" ' +
                        '     onmouseenter="playlist_page.hoverPlayListItem(' + i + ')" ' +
                        '     onclick="playlist_page.changePlaylist(' + i + ')">' +
                        '  <div class="playlist-item-wrapper">' +
                        '    <span class="playlist-name">' + this._escapeHtml(name) + '</span>' +
                        '    <div class="playlist-state ' + (isPlaying ? 'playing' : '') + '"></div>' +
                        '  </div>' +
                        '</div>';
                }
            }

            $("#playlist-items-container").html(htmlContents);
            this.playlist_doms = $(".playlist-item-container");

            if (typeof mac_address !== "undefined") {
                $("#playlist-device-id").text(mac_address);
            }

            this.keys.playlist_selection = 0;
            if (this.playlist_doms.length) {
                this.hoverPlayListItem(0);
            }

            $("#playlist-page").removeClass("hide");
            
            // Ana sayfa bottom bar'ını gizle
            $("#home-mac-address-container").hide();
            try { var el = document.getElementById('home-mac-address-container'); if (el) el.style.display = 'none'; } catch(_) {}

            // Mark once, but allow rebuilds on future init calls
            this.initiated = true;

            if (typeof updateRoute === "function") {
                updateRoute("playlist-page", "playlist_selection");
            } else {
                window.current_route = "playlist-page";
            }
        } catch (e) {
            console.error("playlist_page.init error:", e);
        }
    },

    hoverPlayListItem: function (index) {
        if (!this.playlist_doms || !this.playlist_doms.length) return;

        if (index < 0) index = 0;
        if (index > this.playlist_doms.length - 1) index = this.playlist_doms.length - 1;

        this.keys.focused_part = "playlist_selection";
        this.keys.playlist_selection = index;

        if (this.lastFocusedDom) {
            $(this.lastFocusedDom).removeClass("active");
        }
        $(this.playlist_doms[index]).addClass("active");
        this.lastFocusedDom = this.playlist_doms[index];

        if (typeof updateRoute === "function") {
            updateRoute("playlist-page", "playlist_selection");
        } else {
            window.current_route = "playlist-page";
        }

        // Keep item in view (helper provided by project)
        try {
            if (typeof moveScrollPosition === "function") {
                moveScrollPosition($("#playlist-items-container"), this.playlist_doms[index], "vertical", false);
            }
        } catch (_) {}
    },

    changePlaylist: function (index) {
        try {
            var list = (typeof playlist_urls !== "undefined" && playlist_urls) ? playlist_urls : [];
            if (!list.length || index < 0 || index >= list.length) return;

            var current = list[index];
            if (!current) return;

            if (typeof settings === "undefined") {
                console.warn("settings object not found");
                return;
            }

            // If already selected, just go back
            if (current.id === settings.playlist_id) {
                this.goBack();
                return;
            }

            // Visual update
            $(this.playlist_doms).find(".playlist-state").removeClass("playing");
            $($(this.playlist_doms[index]).find(".playlist-state")).addClass("playing");

            // Persist selection
            if (settings.saveSettings) {
                settings.saveSettings("playlist_id", current.id, "");
                settings.saveSettings("playlist", current, "array");
            } else {
                settings.playlist_id = current.id;
                settings.playlist = current;
            }

            // Transition to login flow
            if (typeof updateRoute === "function") {
                updateRoute("login", "menu_selection");
            } else {
                window.current_route = "login";
            }

            $("#playlist-page").addClass("hide");
            $("#login-container").removeClass("hide");

            // Reload playlist data
            if (typeof parseM3uUrl === "function") parseM3uUrl();
            if (typeof login_page !== "undefined" && login_page.proceed_login) {
                login_page.proceed_login();
            }
        } catch (e) {
            console.error("changePlaylist error:", e);
        }
    },

    handleMenuClick: function () {
        var keys = this.keys;
        if (keys.focused_part === "playlist_selection" && this.playlist_doms.length) {
            $(this.playlist_doms[keys.playlist_selection]).trigger("click");
        }
    },

    handleMenuLeftRight: function (increment) {
        var keys = this.keys;
        if (!this.playlist_doms || !this.playlist_doms.length) return;

        if (keys.focused_part === "playlist_selection") {
            keys.playlist_selection += increment;
            if (keys.playlist_selection < 0) keys.playlist_selection = 0;
            if (keys.playlist_selection >= this.playlist_doms.length) keys.playlist_selection = this.playlist_doms.length - 1;
            this.hoverPlayListItem(keys.playlist_selection);
        }
    },

    handleMenusUpDown: function (increment) {
        var keys = this.keys;
        if (!this.playlist_doms || !this.playlist_doms.length) return;

        if (keys.focused_part === "playlist_selection") {
            keys.playlist_selection += increment;
            if (keys.playlist_selection < 0) keys.playlist_selection = 0;
            if (keys.playlist_selection >= this.playlist_doms.length) keys.playlist_selection = this.playlist_doms.length - 1;
            this.hoverPlayListItem(keys.playlist_selection);
        }
    },

    goBack: function () {
        try {
            if (typeof setting_page !== "undefined" && setting_page.hoverSettingMenu && setting_page.keys) {
                setting_page.hoverSettingMenu(setting_page.keys.menu_selection);
                return;
            }
        } catch (_) {}

        // Fallback route
        if (typeof updateRoute === "function") {
            updateRoute("setting-page", "menu_selection");
        } else {
            window.current_route = "setting-page";
        }
        $("#playlist-page").addClass("hide");
    },

    HandleKey: function (e) {
        switch (e.keyCode) {
            case tvKey.RETURN:
            case tvKey.RETURN_ALT:
                this.goBack();
                break;
            case tvKey.LEFT:
            case tvKey.LEFT_ALT:
                this.handleMenuLeftRight(-1);
                break;
            case tvKey.RIGHT:
            case tvKey.RIGHT_ALT:
                this.handleMenuLeftRight(1);
                break;
            case tvKey.UP:
            case tvKey.UP_ALT:
                this.handleMenusUpDown(-4);
                break;
            case tvKey.DOWN:
            case tvKey.DOWN_ALT:
                this.handleMenusUpDown(4);
                break;
            case tvKey.ENTER:
            case tvKey.ENTER_ALT:
            case tvKey.ENTER_ALT2:
                this.handleMenuClick();
                break;
        }
    },

    // Small HTML escaper for names
    _escapeHtml: function (txt) {
        if (txt == null) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(String(txt)));
        return div.innerHTML;
    }
};
