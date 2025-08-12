/* ==== common.js – Clean & Structured (TIZEN/LG safe) ==== */
"use strict";

/* ──────────────────────────────────────────────────────────────
   CONSTANTS / GLOBAL SELECTORS
   ────────────────────────────────────────────────────────────── */
var SYSTEM_MAC_ADDRESS = "52:54:00:12:34:58"; // TV device identifier fallback
var panel_urls = ["https://galaplayer.com/api"];
var time_difference_with_server = 0; // minutes
var default_movie_icon = "images/logo.png";
var storage_id = "PPePAN9WHl_";
var platform = "samsung"; // "samsung" or "lg"
var samsung_version = "2.0.0";
var lg_version = "1.0.0";
var client_offset = moment(new Date()).utcOffset();

/* ──────────────────────────────────────────────────────────────
   APP STATE (single-source)
   ────────────────────────────────────────────────────────────── */
var mac_address,
  user_name,
  password,
  api_host_url,
  is_trial,
  expire_date,
  app_loading = false,
  current_route = "login",
  current_movie,
  current_season,
  current_episode,
  current_series,
  parent_account_password = "0000",
  mac_valid = true,
  playlist_urls = [],
  themes = [],
  // legacy language arrays removed – use LanguageManager
  languages = [],
  notification = {},
  device_key,
  has_own_playlist,
  show_keyboard = false,
  prev_focus_dom = null;

var page_objects = {
  "channel-page": $("#channel-page"),
  "vod-series-page": $("#vod-series-page"),
  "vod-summary-page": $("#vod-summary-page"),
  "series-summary-page": $("#series-summary-page"),
  "playlist-page": $("#playlist-page"),
  "playlist-edit-page": $("#playlist-edit-page"),
  "setting-page": $("#setting-page"),
  "home-page": $("#home-page"),
};

/* ──────────────────────────────────────────────────────────────
   DEVICE / MAC HELPERS
   ────────────────────────────────────────────────────────────── */
function getAlternativeMacAddress() {
  // Attempts to derive a consistent MAC-like identifier when native APIs fail
  if (typeof webapis !== "undefined") {
    try {
      if (webapis.productinfo) {
        var productInfo = webapis.productinfo.getProductInfo();
        if (productInfo && productInfo.modelName) {
          var modelMac = generateMacFromModel(productInfo.modelName);
          return modelMac;
        }
      }
      if (webapis.network) {
        try {
          // Probe network API (info is not used directly, but ensures availability)
          webapis.network.getNetworkInfo();
        } catch (_) {}
      }
    } catch (_) {}
  }

  try {
    var storedMac = localStorage.getItem("device_mac_address");
    if (storedMac && storedMac !== "00:00:00:00:00:00") return storedMac;
  } catch (_) {}

  return null;
}

function generateMacFromModel(modelName) {
  if (!modelName) return null;
  var hash = 0;
  for (var i = 0; i < modelName.length; i++) {
    hash = ((hash << 5) - hash) + modelName.charCodeAt(i);
    hash = hash & hash; // 32-bit
  }
  var abs = Math.abs(hash);
  var mac =
    "52:54:00:" +
    ("0" + ((abs >> 16) & 0xff).toString(16)).slice(-2) + ":" +
    ("0" + ((abs >> 8) & 0xff).toString(16)).slice(-2) + ":" +
    ("0" + (abs & 0xff).toString(16)).slice(-2);
  return mac.toUpperCase();
}

/* ──────────────────────────────────────────────────────────────
   GENERIC HELPERS
   ────────────────────────────────────────────────────────────── */
function saveData(key, data) { window[key] = data; }

function getMovieUrl(stream_id, stream_type, extension) {
  return api_host_url + "/" + stream_type + "/" + user_name + "/" + password + "/" + stream_id + "." + extension;
}

function moveScrollPosition(parent_element, element, direction, to_top) {
  // Scroll container to reveal element (vertical or horizontal)
  if (direction === "vertical") {
    var padding_top = parseInt($(parent_element).css("padding-top").replace("px", ""));
    var padding_bottom = parseInt($(parent_element).css("padding-bottom").replace("px", ""));
    var parent_height = parseInt($(parent_element).css("height").replace("px", ""));
    var child_position = $(element).position();
    var element_height = parseInt($(element).css("height").replace("px", ""));
    var move_amount = 0;

    if (!to_top) {
      if (child_position.top + element_height >= parent_height - padding_bottom) {
        move_amount = child_position.top + element_height - parent_height + padding_bottom;
      }
      if (child_position.top - padding_top < 0) move_amount = child_position.top - padding_top;
      $(parent_element).animate({ scrollTop: "+=" + move_amount }, 10);
    } else {
      $(parent_element).animate({ scrollTop: child_position.top }, 10);
    }
    return move_amount;
  } else {
    var padding_left = parseInt($(parent_element).css("padding-top").replace("px", "")); // (kept as original)
    var child_position_h = $(element).position();
    var parent_width = parseInt($(parent_element).css("width").replace("px", ""));
    var element_width = parseInt($(element).css("width").replace("px", ""));
    var scroll_amount = 0;

    if (child_position_h.left + element_width >= parent_width) scroll_amount = child_position_h.left + element_width - parent_width;
    if (child_position_h.left - padding_left < 0) scroll_amount = child_position_h.left - padding_left;
    $(parent_element).animate({ scrollLeft: "+=" + scroll_amount }, 10);
    return scroll_amount;
  }
}

function showToast(title, text) {
  $("#toast-body").html("<h3>" + title + "<br>" + text + "</h3>");
  $(".toast").toast({ animation: true, delay: 2000 });
  $("#toast").toast("show");
}

function getMinute(time_string) {
  var date = new Date(time_string);
  return parseInt(date.getTime() / 60 / 1000);
}

function changeBackgroundImage() {
  var bg_img_url = settings.bg_img_url;
  $("#login-container").css({ "background-image": "url(" + bg_img_url + ")" });
  $("#app").css({ "background-image": "url(" + bg_img_url + ")" });
}

function updateCurrentTime() {
  var date = moment();
  $(".current-time").text(date.format("HH:mm"));
  $(".current-date").text(date.format("Y-MM-DD"));
}

function hideImg(targetElement) { $(targetElement).addClass("hide"); }

function exitApp() {
  if (platform === "samsung" && typeof tizen !== "undefined" && tizen.application) {
    tizen.application.getCurrentApplication().exit();
  } else {
    window.close();
  }
}

function checkVerticalMovable(items_count, h_size, current_position, increment) {
  var result = true;
  if (current_position < h_size && increment < 0) result = false;
  var quotient = Math.ceil(items_count / h_size);
  if (current_position >= (quotient - 1) * h_size && increment > 0) result = false;
  return result;
}

/* ──────────────────────────────────────────────────────────────
   LOADER
   ────────────────────────────────────────────────────────────── */
function showLoader(flag) {
  if (typeof flag === "undefined") flag = true;

  // skip global loader on summary pages
  if (
    $("#vod-summary-page").is(":visible") ||
    $("#series-summary-page").is(":visible") ||
    ($("#vod-series-page").is(":visible") && !$("#vod-series-page").hasClass("hide"))
  ) {
    // intentionally return without toggling global loader
    return;
  }

  app_loading = flag;

  if (flag) {
    $("#loading-page").css({ display: "flex", "align-items": "center", "justify-content": "center" });
    $("#loading-page").removeClass("hide");
  } else {
    $("#loading-page").hide().addClass("hide");
    $("#app").css("display", "block").show();
  }
}

/* ──────────────────────────────────────────────────────────────
   PLAYLIST PARSING / MODEL POPULATION
   ────────────────────────────────────────────────────────────── */
function parseM3uUrl() {
  // Detect playlist type
  var playlist_url = settings.playlist.url;

  if (playlist_url.includes("username=") && playlist_url.includes("password=")) {
    settings.playlist_type = "xtreme";
  } else {
    settings.playlist_type = "type1";
  }

  if (settings.playlist_type === "xtreme") {
    var p1 = playlist_url.split("?");
    var p2 = p1[1].split("&");
    p2.map(function (kv) {
      var parts = kv.split("=");
      var key = parts[0].toLowerCase();
      var val = parts[1];
      if (key === "username") user_name = val;
      if (key === "password") password = val;
    });
    api_host_url = p1[0].replace("/get.php", "");
    console.log("XTreme API detected:", api_host_url);
  } else {
    api_host_url = settings.playlist.url;
    console.log("Type1 playlist detected:", api_host_url);
  }
}

function parseM3uResponse(type, text_response) {
  var num = 0;

  if (type === "type1") {
    var live_categories = [],
      lives = [],
      vods = [],
      vod_categories = [],
      series_categories = [],
      series = [];

    text_response = text_response.replace(/['"]+/g, "");
    var rows = text_response.split(/#EXTINF:-{0,1}[0-9]{1,} {0,},{0,}/gm);
    rows.splice(0, 1);

    if (text_response.includes("tvg-")) {
      // generic M3U (tvg-* attributes)
      var live_cat_map = {},
        vod_cat_map = {},
        series_cat_map = [];

      for (var i = 0; i < rows.length; i++) {
        try {
          var tuple = rows[i].split("\n");
          num++;
          var url = tuple[1].length > 1 ? tuple[1] : "";
          if (!url.includes("http:") && !url.includes("https:")) continue;

          var dtype = "live";
          if (url.includes("/movie/") || url.includes("vod") || url.includes("=movie") || url.includes("==movie=="))
            dtype = "vod";
          if (url.includes("/series/"))
            dtype = "series";

          var meta = tuple[0].trim().split(",");
          var name = meta.length > 1 ? meta[1] : "";

          var parts = splitStrings(meta[0], ["tvg-", "channel-", "group-"]);
          var result = {
            stream_id: "",
            name: name,
            stream_icon: "",
            title: ""
          };
          var category_name = LanguageManager.getText("all_category");

          parts.map(function (pi) {
            var kv = pi.split("=");
            var key = kv[0];
            var value = kv[1];
            switch (key) {
              case "id":
                result.stream_id = value;
                break;
              case "name":
                result.name = value && value.trim() !== "" ? value : name;
                break;
              case "logo":
                result.stream_icon = value;
                break;
              case "title":
                category_name = value.split(",")[0];
                if (category_name === "") category_name = LanguageManager.getText("uncategorized");
                break;
            }
          });

          if (result.stream_id.trim() === "") result.stream_id = result.name;
          result.url = url;
          result.num = num;

          if (dtype === "live") {
            if (typeof live_cat_map[category_name] === "undefined") {
              live_cat_map[category_name] = category_name;
              live_categories.push({ category_id: category_name, category_name: category_name });
            }
            result.category_id = category_name;
            lives.push(result);
          }
          if (dtype === "vod") {
            if (typeof vod_cat_map[category_name] === "undefined") {
              vod_cat_map[category_name] = category_name;
              vod_categories.push({ category_id: category_name, category_name: category_name });
            }
            result.category_id = category_name;
            vods.push(result);
          }
          if (dtype === "series") {
            if (typeof series_cat_map[category_name] === "undefined") {
              series_cat_map[category_name] = category_name;
              series_categories.push({ category_id: category_name, category_name: category_name });
            }
            result.category_id = category_name;
            series.push(result);
          }
        } catch (e) {
          console.log("M3U parse error at row", i, e);
        }
      }
    } else {
      // minimal M3U (no tvg-* attributes)
      live_categories = [{ category_id: "all", category_name: LanguageManager.getText("all_category") }];
      vod_categories = [{ category_id: "all", category_name: LanguageManager.getText("all_category") }];
      series_categories = [{ category_id: "all", category_name: LanguageManager.getText("all_category") }];

      for (var j = 0; j < rows.length; j++) {
        var row = rows[j].split("\n");
        try {
          var name2 = row[0].trim();
          var url2 = row[1];
          var dtype2 = "live";
          if (url2.includes("/movie/")) dtype2 = "movie";
          if (url2.includes("/series/")) dtype2 = "series";

          var item = {
            stream_id: name2,
            name: name2,
            stream_icon: "",
            num: j + 1,
            category_id: "all",
            url: url2
          };
          if (dtype2 === "live") lives.push(item);
          if (dtype2 === "series") series.push(item);
          if (dtype2 === "movie") vods.push(item);
        } catch (e2) {
          console.log("M3U minimal parse error:", e2);
        }
      }
    }

    // sanitize empty category names
    [live_categories, vod_categories, series_categories].forEach(function (arr) {
      if (arr.length > 1) {
        arr.map(function (c) {
          if (c.category_name === "") c.category_name = LanguageManager.getText("uncategorized");
        });
      }
    });

    // populate models
    LiveModel.setCategories(live_categories);
    LiveModel.setMovies(lives);
    LiveModel.insertMoviesToCategories();

    VodModel.setCategories(vod_categories);
    VodModel.setMovies(vods);
    VodModel.insertMoviesToCategories();

    SeriesModel.setCategories(series_categories);
    var parsed_series = parseSeries(series);
    SeriesModel.setMovies(parsed_series);
    SeriesModel.insertMoviesToCategories();

    // update home page asynchronously after playlist load
    setTimeout(function () {
      if (typeof home_operation !== "undefined" && home_operation.loadLatestMovies) {
        home_operation.loadLatestMovies();
      }
    }, 500);
  }
}

function parseSeries(data) {
  var series = [];
  var series_map = {};
  var season_map = {}, episodes = {};

  data.map(function (item) {
    try {
      var parts = item.name.split(/ S[0-9]{2}/);
      var sname = item.name.match(/S[0-9]{2}/)[0];
      sname = sname.trim().replace("S", "");
      sname = LanguageManager.getText("season_prefix") + " " + sname;
      var series_name = parts[0].trim();
      var episode_name = parts[1].trim().replace("E", "");

      if (typeof series_map[series_name] === "undefined") {
        season_map = {};
        episodes = {};
        episodes[sname] = [{
          name: episode_name,
          url: item.url,
          id: episode_name,
          info: {},
          title: LanguageManager.getText("episode_prefix") + " " + episode_name
        }];
        season_map[sname] = { name: sname, cover: "images/series.png" };
        series_map[series_name] = {
          series_id: series_name,
          name: series_name,
          cover: item.stream_icon,
          youtube_trailer: "",
          category_id: item.category_id,
          rating: "",
          rating_5based: "",
          genre: "",
          director: "",
          cast: "",
          plot: "",
          season_map: season_map,
          episodes: episodes
        };
      } else {
        if (typeof season_map[sname] === "undefined") {
          episodes[sname] = [{
            name: episode_name,
            url: item.url,
            id: episode_name,
            info: {},
            title: LanguageManager.getText("episode_prefix") + " " + episode_name
          }];
          season_map[sname] = { name: sname, cover: "images/series.png" };
          series_map[series_name].season_map = season_map;
        } else {
          episodes[sname].push({
            name: sname,
            url: item.url,
            id: sname,
            info: {},
            title: LanguageManager.getText("episode_prefix") + " " + episode_name
          });
        }
        series_map[series_name].episodes = episodes;
      }
    } catch (_) {}
  });

  var series_num = 0;
  Object.keys(series_map).map(function (key) {
    series_num++;
    var item = series_map[key];
    var seasons = [];
    try {
      Object.keys(item.season_map).map(function (k1) { seasons.push(item.season_map[k1]); });
    } catch (_) {}
    delete item["season_map"];
    item.num = series_num;
    item.seasons = seasons;
    series.push(item);
  });

  return series;
}

function splitStrings(string, keys) {
  var out = [];
  for (var i = 0; i < keys.length; i++) {
    var temp = string.split(keys[i]);
    if (i === keys.length - 1) {
      for (var j = 0; j < temp.length; j++) {
        if (temp[j].trim() !== "") out.push(temp[j]);
      }
      return out;
    } else {
      for (var k = 0; k < temp.length; k++) {
        if (temp[k].trim() !== "") {
          var next = splitStrings(temp[k], keys.slice(i + 1));
          next.map(function (n) { if (n.trim() !== "") out.push(n); });
        }
      }
      return out;
    }
  }
}

function getAtob(text) {
  var result = text;
  try {
    return decodeURIComponent(atob(text).split("").map(function (c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
  } catch (_) {}
  return result;
}

function checkForAdult(item, item_type, categories) {
  var is_adult = false;
  var category;
  if (item_type === "movie") {
    for (var i = 0; i < categories.length; i++) {
      if (item.category_id == categories[i].category_id) { category = categories[i]; break; }
    }
  } else category = item;
  var cname = (category.category_name || "").toLowerCase();
  if (cname.includes("xxx") || cname.includes("adult") || cname.includes("porn")) is_adult = true;
  return is_adult;
}

function pickPanelUrl(exclude_indexes) {
  var picked_url, picked_index;
  var urls = [];
  panel_urls.map(function (item, index) {
    if (!exclude_indexes.includes(index)) urls.push(item);
  });
  var rand_number = Math.random();
  var step = 1 / urls.length;
  for (var i = 0; i < urls.length; i++) {
    if (rand_number >= i * step && rand_number <= step * (i + 1)) { picked_url = urls[i]; picked_index = i; break; }
  }
  return [picked_index, picked_url];
}

/* ──────────────────────────────────────────────────────────────
   PLAYLIST MANAGEMENT (UI hooks kept, text normalized)
   ────────────────────────────────────────────────────────────── */
function goToPlaylistSettings() {
  current_route = "setting-page";
  $("#page-container-1").addClass("hide");
  if (typeof setting_page !== "undefined" && setting_page.init) setting_page.init();
  if (typeof setting_page !== "undefined" && setting_page.hoverSettingMenu) setting_page.hoverSettingMenu(7);
  if (typeof setting_page !== "undefined" && setting_page.showPlaylistManagement) setting_page.showPlaylistManagement();
}

function refreshPlaylist() {
  var refreshBtn = $(".bottom-action-btn").first();
  var refreshIcon = refreshBtn.find("i");
  var refreshText = refreshBtn.find("span");

  refreshBtn.addClass("loading");
  refreshIcon.addClass("fa-spin");
  refreshText.text(LanguageManager.getText("updating") || "Updating...");

  setTimeout(function () { if (typeof login_page !== "undefined" && login_page.reloadApp) login_page.reloadApp(); }, 500);
}

function openPlaylistPopup() {
  $("#playlist-selection-popup").removeClass("hide");
  var tActive = LanguageManager.getText("active") || "Active";
  var tAvailable = LanguageManager.getText("available") || "Available";

  var playlistContainer = $("#playlist-list-container");
  playlistContainer.html(
    '<div class="playlist-item active" onclick="selectPlaylist(\'main\')">' +
      '<div class="playlist-info">' +
        '<div class="playlist-name">Main Playlist</div>' +
        '<div class="playlist-status" data-word_code="active">' + tActive + "</div>" +
      "</div>" +
    "</div>" +
    '<div class="playlist-item" onclick="selectPlaylist(\'backup1\')">' +
      '<div class="playlist-info">' +
        '<div class="playlist-name">Backup Playlist 1</div>' +
        '<div class="playlist-status" data-word_code="available">' + tAvailable + "</div>" +
      "</div>" +
    "</div>" +
    '<div class="playlist-item" onclick="selectPlaylist(\'backup2\')">' +
      '<div class="playlist-info">' +
        '<div class="playlist-name">Backup Playlist 2</div>' +
        '<div class="playlist-status">' + tAvailable + "</div>" +
      "</div>" +
    "</div>" +
    '<div class="playlist-item" onclick="selectPlaylist(\'demo\')">' +
      '<div class="playlist-info">' +
        '<div class="playlist-name">Demo Playlist</div>' +
        '<div class="playlist-status">Demo</div>' +
      "</div>" +
    "</div>"
  );
}

function closePlaylistPopup() { $("#playlist-selection-popup").addClass("hide"); }

function selectPlaylist(playlistId) {
  $(".playlist-item").removeClass("active");
  if (typeof event !== "undefined" && event.currentTarget) event.currentTarget.classList.add("active");
  setTimeout(function () {
    closePlaylistPopup();
    if (typeof login_page !== "undefined" && login_page.reloadApp) login_page.reloadApp();
  }, 300);
}

/* ──────────────────────────────────────────────────────────────
   SAMSUNG TV PERFORMANCE / TRANSITIONS
   ────────────────────────────────────────────────────────────── */
var SamsungTVOptimization = {
  isOptimized: false,
  init: function () {
    if (this.isSamsungTV()) {
      this.applyOptimizations();
      this.isOptimized = true;
      console.log("Samsung TV optimizations applied");
    }
  },
  isSamsungTV: function () {
    return navigator.userAgent.includes("Samsung") ||
      navigator.userAgent.includes("Tizen") ||
      typeof webapis !== "undefined";
  },
  applyOptimizations: function () {
    if (typeof jQuery !== "undefined") jQuery.fx.off = true;
    var style = document.createElement("style");
    style.textContent = "*{transition:none!important;animation-duration:.1s!important}.fade,.show,.collapse{transition:none!important}";
    document.head.appendChild(style);
  }
};

var SamsungTVTransition = {
  transitionToMovieDetail: function () {
    return new Promise(function (resolve) { setTimeout(resolve, 100); });
  },
  transitionToSeriesDetail: function () {
    return new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
};

/* ──────────────────────────────────────────────────────────────
   BOOT
   ────────────────────────────────────────────────────────────── */
$(document).ready(function () {
  SamsungTVOptimization.init();
});