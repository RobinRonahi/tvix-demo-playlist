"use strict";

/**
 * Parent confirm modal controller (Samsung TV / ES5 safe)
 * - English-only comments and logs
 * - Lazy DOM lookups to avoid nulls before the modal is rendered
 * - Safer route handling with optional updateRoute()
 * - No emojis, no ES6 features
 */

var parent_confirm_page = {
    keys: {
        focused_part: "menu_selection", // currently only menu_selection is used
        menu_selection: 0               // 0: input, 1: confirm, 2: cancel
    },

    // Will be filled in init() to avoid capturing empty jQuery sets at load time
    menu_doms: null,

    prev_route: "",
    movie: null,

    init: function (prev_route) {
        this.prev_route = prev_route || (typeof current_route !== "undefined" ? current_route : "");
        // Update route if helper exists; otherwise set directly
        if (typeof updateRoute === "function") {
            updateRoute("parent-confirm-page", "menu_selection");
        } else {
            current_route = "parent-confirm-page";
        }

        // Capture DOMs now (modal must exist in DOM)
        this.menu_doms = $(".parent-confirm-item");

        // Defensive: ensure we have at least one item with an input
        if (this.menu_doms && this.menu_doms.length > 0) {
            // Clear and focus the password input (assumed at index 0)
            var $input = $(this.menu_doms[0]).find("input");
            if ($input && $input.length) {
                $input.val("");
            }
        }

        this.hoverMenuItem(0);
        $("#parent-confirm-password-error").hide();

        // Open modal (bootstrap or custom). Guard if modal plugin not present.
        try {
            if (typeof $("#parent-confirm-modal").modal === "function") {
                $("#parent-confirm-modal").modal("show");
            } else {
                $("#parent-confirm-modal").removeClass("hide").show();
            }
        } catch (e) {
            $("#parent-confirm-modal").removeClass("hide").show();
        }
    },

    goBack: function () {
        // Close modal safely
        try {
            if (typeof $("#parent-confirm-modal").modal === "function") {
                $("#parent-confirm-modal").modal("hide");
            } else {
                $("#parent-confirm-modal").hide();
            }
        } catch (_) {
            $("#parent-confirm-modal").hide();
        }

        // Restore previous route (some routes map back to a container page)
        var target = this.prev_route || "home-page";
        if (this.prev_route === "vod-summary-page" || this.prev_route === "series-summary-page") {
            target = "vod-series-page";
        } else if (this.prev_route === "channel-category-page") {
            target = "channel-category-page";
        }

        if (typeof updateRoute === "function") {
            updateRoute(target, "menu_selection");
        } else {
            current_route = target;
        }
    },

    hoverMenuItem: function (index) {
        var keys = this.keys;
        if (!this.menu_doms || !this.menu_doms.length) return;

        if (index < 0) index = 0;
        if (index > 2) index = 2;

        keys.focused_part = "menu_selection";
        keys.menu_selection = index;

        $(this.menu_doms).removeClass("active");
        $(this.menu_doms[index]).addClass("active");
    },

    handleMenuClick: function () {
        var keys = this.keys;
        if (keys.focused_part !== "menu_selection") return;

        // Ensure DOM list exists
        if (!this.menu_doms || !this.menu_doms.length) return;

        switch (keys.menu_selection) {
            case 0: { // focus input
                var $input = $(this.menu_doms[0]).find("input");
                if ($input && $input.length) {
                    $input.focus();
                }
                break;
            }
            case 1: { // confirm
                var $pwd = $(this.menu_doms[0]).find("input");
                var password = ($pwd && $pwd.length) ? $pwd.val() : "";
                $("#parent-confirm-password-error").hide();

                if (typeof parent_account_password === "undefined" || password !== parent_account_password) {
                    $("#parent-confirm-password-error").slideDown();
                    return;
                }

                // Close modal
                try {
                    if (typeof $("#parent-confirm-modal").modal === "function") {
                        $("#parent-confirm-modal").modal("hide");
                    } else {
                        $("#parent-confirm-modal").hide();
                    }
                } catch (_) {
                    $("#parent-confirm-modal").hide();
                }

                // Restore route and continue flow
                var target = this.prev_route || "home-page";
                if (typeof updateRoute === "function") {
                    updateRoute(target, "menu_selection");
                } else {
                    current_route = target;
                }

                // Post-confirm actions by origin page
                if (this.prev_route === "channel-page" && typeof channel_page !== "undefined" && channel_page.showCategoryChannels) {
                    channel_page.showCategoryChannels();
                } else if (this.prev_route === "vod-series-page" && typeof vod_series_page !== "undefined" && vod_series_page.showCategoryContent) {
                    vod_series_page.showCategoryContent();
                } else if (this.prev_route === "stream-category-page" && typeof stream_category_page !== "undefined" && stream_category_page.showStreamPage) {
                    stream_category_page.showStreamPage();
                }
                break;
            }
            case 2: { // cancel
                this.goBack();
                break;
            }
        }
    },

    handleMenusUpDown: function (increment) {
        var keys = this.keys;
        // Only two steps: 0 (input) -> 1 (confirm). Cancel (2) is reached with LEFT/RIGHT.
        if (increment > 0) {
            if (keys.menu_selection < 1) keys.menu_selection = 1;
        } else if (increment < 0) {
            if (keys.menu_selection > 0) keys.menu_selection = 0;
        }
        this.hoverMenuItem(keys.menu_selection);
    },

    handleMenuLeftRight: function (increment) {
        var keys = this.keys;
        if (keys.focused_part !== "menu_selection") return;

        // Allow horizontal movement among confirm(1) and cancel(2), keep input(0) only via UP/DOWN
        if (keys.menu_selection >= 1) {
            keys.menu_selection += increment;
            if (keys.menu_selection < 1) keys.menu_selection = 1;
            if (keys.menu_selection > 2) keys.menu_selection = 2;
            this.hoverMenuItem(keys.menu_selection);
        }
    },

    HandleKey: function (e) {
        switch (e.keyCode) {
            case tvKey.RIGHT:
            case tvKey.RIGHT_ALT:
                this.handleMenuLeftRight(1);
                break;
            case tvKey.LEFT:
            case tvKey.LEFT_ALT:
                this.handleMenuLeftRight(-1);
                break;
            case tvKey.DOWN:
            case tvKey.DOWN_ALT:
                this.handleMenusUpDown(1);
                break;
            case tvKey.UP:
            case tvKey.UP_ALT:
                this.handleMenusUpDown(-1);
                break;
            case tvKey.ENTER:
            case tvKey.ENTER_ALT:
            case tvKey.ENTER_ALT2:
                this.handleMenuClick();
                break;
            case tvKey.RETURN:
            case tvKey.RETURN_ALT:
                this.goBack();
                break;
        }
    }
};