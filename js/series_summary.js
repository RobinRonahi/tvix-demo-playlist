"use strict";

var series_summary_page = {
  prev_route: "",
  current_series_info: null,
  seasons: [],
  episodes: [],
  keys: {
    focused_part: "seasons", // 'seasons', 'episodes', 'actions'
    season_selection: 0,
    episode_selection: 0,
    action_selection: 0
  },

  init: function (prevRoute) {
    console.log("[SeriesSummary] init, prev route:", prevRoute);
    this.prev_route = prevRoute || "vod-series-page";

    // Reset state
    this.seasons = [];
    this.episodes = [];
    this.keys.season_selection = 0;
    this.keys.episode_selection = 0;
    this.keys.action_selection = 0;
    this.keys.focused_part = "seasons";

    $("#series-summary-page").removeClass("hide").addClass("fade-in");
    $("#vod-series-page, #home-page").addClass("hide");

    if (typeof toggleDeviceInfoBanner === "function") {
      toggleDeviceInfoBanner(false);
    }

    this.loadSeriesData();
  },

  loadSeriesData: function () {
    if (!window.current_movie) {
      console.error("[SeriesSummary] current_movie is not set");
      this.goBack();
      return;
    }

    var series_id = current_movie.series_id || current_movie.stream_id;
    var that = this;

    // xtream-codes info endpoint
    var apiUrl =
      api_host_url +
      "/player_api.php?username=" +
      encodeURIComponent(user_name) +
      "&password=" +
      encodeURIComponent(password) +
      "&action=get_series_info&series_id=" +
      encodeURIComponent(series_id);

    $.getJSON(apiUrl)
      .done(function (response) {
        console.log("[SeriesSummary] API response", response);
        that.current_series_info = response;
        that.seasons = that.organizeSeasons(response.episodes);
        that.renderPageLayout(response.info);
        that.renderSeasons();
        that.handleSeasonSelect(0, true); // default to first season
      })
      .fail(function (jqXHR, textStatus, errorThrown) {
        console.error("[SeriesSummary] Failed to load series info:", textStatus, errorThrown);
        // Fallback to basic info
        that.renderPageLayout(current_movie);
        $("#episodes-list-container").html(
          '<div class="loading-text">' +
            (LanguageManager.getText
              ? LanguageManager.getText("could_not_load_episode_data")
              : "Could not load episode data") +
            "</div>"
        );
      });
  },

  organizeSeasons: function (episodesBySeason) {
    if (!episodesBySeason || typeof episodesBySeason !== "object") return [];

    return Object.values(episodesBySeason)
      .sort(function (a, b) {
        return (a[0].season || 0) - (b[0].season || 0);
      })
      .map(function (eps) {
        var sorted = eps.slice().sort(function (a, b) {
          return (a.episode_num || 0) - (b.episode_num || 0);
        });
        var sNo = sorted[0].season || 1;
        return {
          season_number: sNo,
          name: "Season " + sNo,
          poster: sorted[0].movie_image || current_movie.cover,
          episode_count: sorted.length,
          episodes: sorted
        };
      });
  },

  renderPageLayout: function (info) {
    info = info || {};
    $(".series-background-img").attr(
      "src",
      info.backdrop_path || info.cover || current_movie.cover || ""
    );
    $("#series-header-poster").attr(
      "src",
      info.cover || current_movie.cover || "images/default_movie.png"
    );
    $("#series-main-title").text(info.name || current_movie.name || "");
    $("#series-year").text(info.year || info.releasedate || "");
    $("#series-genre").text(info.genre || "");
    $("#series-rating-value").text(parseFloat(info.rating || 0).toFixed(1));
    $("#series-description").text(
      info.plot ||
        (LanguageManager.getText ? LanguageManager.getText("no_description_available") : "No description")
    );

    this.updateFavoriteButton();
  },

  renderSeasons: function () {
    var container = $("#seasons-list-container");
    container.empty();

    if (this.seasons.length === 0) {
      container.html(
        '<div class="loading-text">' +
          (LanguageManager.getText ? LanguageManager.getText("no_seasons_found") : "No seasons found") +
          "</div>"
      );
      return;
    }

    $("#total-seasons-count").text(this.seasons.length);

    for (var i = 0; i < this.seasons.length; i++) {
      var s = this.seasons[i];
      var html =
        '<div class="season-item" data-index="' +
        i +
        '" onclick="series_summary_page.handleSeasonSelect(' +
        i +
        ')">' +
        '<img src="' +
        (s.poster || "") +
        '" class="season-poster" onerror="this.src=\'images/default_episode.png\'">' +
        '<div class="season-info">' +
        '<div class="season-name">' +
        s.name +
        "</div>" +
        '<div class="season-episode-count">' +
        s.episode_count +
        " Episodes</div>" +
        "</div>" +
        "</div>";
      container.append(html);
    }

    // Smart return (focus last watched)
    if (window._lastSeasonIndex != null && window._lastEpisodeIndex != null) {
      var sIdx = window._lastSeasonIndex;
      var eIdx = window._lastEpisodeIndex;
      window._lastSeasonIndex = null;
      window._lastEpisodeIndex = null;
      this.handleSeasonSelect(sIdx, true);
      this.setFocus("episodes", eIdx);
    } else {
      this.setFocus("seasons", 0);
    }
  },

  renderEpisodes: function (season_index) {
    var container = $("#episodes-list-container");
    container.empty();

    var season = this.seasons[season_index];
    if (!season || !Array.isArray(season.episodes) || season.episodes.length === 0) {
      container.html(
        '<div class="no-season-selected"><i class="fas fa-video-slash"></i><p>' +
          (LanguageManager.getText ? LanguageManager.getText("no_episodes_available") : "No episodes available") +
          "</p></div>"
      );
      return;
    }

    this.episodes = season.episodes.slice();
    $("#current-season-name").text(season.name);
    $("#episodes-count").text(
      this.episodes.length +
        " " +
        (LanguageManager.getText ? LanguageManager.getText("episodes_count") : "Episodes")
    );

    for (var i = 0; i < this.episodes.length; i++) {
      var ep = this.episodes[i];
      var html =
        '<div class="episode-item" data-index="' +
        i +
        '" onclick="series_summary_page.playEpisode(' +
        i +
        ')">' +
        '<img src="' +
        (ep.movie_image || season.poster || "") +
        '" class="episode-thumbnail" onerror="this.src=\'images/default_episode.png\'">' +
        '<div class="episode-info">' +
        '<div class="episode-number">Episode ' +
        (ep.episode_num || i + 1) +
        "</div>" +
        '<div class="episode-title">' +
        (ep.title || ep.name || "") +
        "</div>" +
        '<p class="episode-description">' +
        (ep.plot || "") +
        "</p>" +
        "</div>" +
        '<div class="episode-duration">' +
        '<i class="far fa-clock"></i>' +
        "<span>" +
        (ep.duration || "N/A") +
        "</span>" +
        "</div>" +
        "</div>";
      container.append(html);
    }
  },

  handleSeasonSelect: function (index, is_initial_load) {
    if (typeof is_initial_load === "undefined") is_initial_load = false;

    this.keys.season_selection = index;
    $(".season-item").removeClass("active");
    $('.season-item[data-index="' + index + '"]').addClass("active");

    this.renderEpisodes(index);

    if (!is_initial_load) {
      this.keys.episode_selection = 0;
      this.setFocus("episodes", 0);
    }
  },

  HandleKey: function (e) {
    this.handleKeyDown(e);
  },

  handleKeyDown: function (e) {
    var key = e.keyCode;
    var focused = this.keys.focused_part;

    switch (key) {
      case tvKey.UP:
        if (focused === "actions") this.setFocus("seasons", this.keys.season_selection);
        else if (focused === "seasons") this.navigateList(-1, "seasons");
        else if (focused === "episodes") this.navigateList(-1, "episodes");
        break;

      case tvKey.DOWN:
        if (focused === "seasons") {
          if (this.keys.season_selection < this.seasons.length - 1) {
            this.navigateList(1, "seasons");
          } else {
            this.setFocus("episodes", this.keys.episode_selection);
          }
        } else if (focused === "episodes") {
          var epCount = this.episodes.length;
          if (this.keys.episode_selection < epCount - 1) {
            this.navigateList(1, "episodes");
          } else {
            this.setFocus("actions", this.keys.action_selection);
          }
        }
        break;

      case tvKey.RIGHT:
        if (focused === "seasons") this.setFocus("episodes", this.keys.episode_selection);
        else if (focused === "episodes") this.setFocus("actions", this.keys.action_selection);
        else if (focused === "actions") this.navigateList(1, "actions");
        break;

      case tvKey.LEFT:
        if (focused === "episodes") this.setFocus("seasons", this.keys.season_selection);
        else if (focused === "actions") this.navigateList(-1, "actions");
        break;

      case tvKey.ENTER:
        this.handleEnter();
        break;

      case tvKey.RETURN:
        this.goBack();
        break;
    }
  },

  navigateList: function (direction, part) {
    var selectionKey = part + "_selection";
    var items;

    if (part === "seasons") items = $(".season-item");
    else if (part === "episodes") items = $(".episode-item");
    else if (part === "actions") items = $(".action-button");
    else return;

    var newIndex = this.keys[selectionKey] + direction;
    if (newIndex >= 0 && newIndex < items.length) {
      this.keys[selectionKey] = newIndex;
      this.setFocus(part, newIndex);
    }
  },

  setFocus: function (part, index) {
    $(".focused").removeClass("focused");
    this.keys.focused_part = part;
    var $item;

    if (part === "seasons") {
      $item = $('.season-item[data-index="' + index + '"]');
      this.keys.season_selection = index;
    } else if (part === "episodes") {
      $item = $('.episode-item[data-index="' + index + '"]');
      this.keys.episode_selection = index;
    } else if (part === "actions") {
      $item = $(".action-button").eq(index);
      this.keys.action_selection = index;
    }

    if ($item && $item.length) {
      $item.addClass("focused");
      $item[0].scrollIntoView({ behavior: "auto", block: "center" });
    }
  },

  handleEnter: function () {
    var part = this.keys.focused_part;
    if (part === "seasons") {
      this.handleSeasonSelect(this.keys.season_selection);
    } else if (part === "episodes") {
      this.playEpisode(this.keys.episode_selection);
    } else if (part === "actions") {
      $(".action-button.focused").trigger("click");
    }
  },

  playEpisode: function (index) {
    var episode = this.episodes[index];
    if (!episode) {
      console.error("[SeriesSummary] Episode not found at index:", index);
      return;
    }

    console.log("[SeriesSummary] playEpisode", episode);

    // Remember last watched for smart return
    window._lastSeasonIndex = this.keys.season_selection;
    window._lastEpisodeIndex = index;

    // Keep a detailed current_episode for the player
    window.current_episode = Object.assign({}, episode, {
      season: this.keys.season_selection + 1,
      episode_num: episode.episode_num,
      title: episode.title || episode.name,
      series_name:
        (this.current_series_info && this.current_series_info.info && this.current_series_info.info.name) ||
        current_movie.name
    });

    console.log("[SeriesSummary] current_episode set:", window.current_episode);

    var episode_url = episode.added || episode.stream_url;
    if (!episode_url) {
      console.error("[SeriesSummary] Episode URL is missing");
      return;
    }

    try {
      if (typeof vod_series_player_page !== "undefined") {
        $("#series-summary-page").addClass("hide");
        $("#vod-series-page, #home-page, #vod-summary-page").addClass("hide");

        // Save return anchors for VOD page
        if (typeof vod_series_page !== "undefined") {
          vod_series_page.last_watched_series = {
            series_id: current_movie.series_id || current_movie.stream_id,
            season_index: this.keys.season_selection,
            episode_index: index,
            category_index: vod_series_page.current_category_index,
            menu_selection: vod_series_page.keys.menu_selection
          };
        }

        console.log("[SeriesSummary] Starting player (full screen) with series mode");
        vod_series_player_page.init(
          current_movie, // series metadata
          "series", // type
          "series-summary-page", // return page
          episode_url, // media URL
          true // focus
        );
      } else {
        console.error("[SeriesSummary] vod_series_player_page is not available");
        this.goBack();
      }
    } catch (err) {
      console.error("[SeriesSummary] Error starting episode:", err);
      $("#vod-series-player-page").addClass("hide");
      $("#series-summary-page").removeClass("hide");
    }
  },

  showEpisodesList: function () {
    $("#vod-series-player-page").addClass("hide");
    $("#series-summary-page").removeClass("hide");
    console.log("[SeriesSummary] Back to episodes list");
  },

  playNextEpisode: function () {
    var idx = this.keys.episode_selection + 1;

    if (idx < this.episodes.length) {
      this.playEpisode(idx);
      return;
    }

    // Move to first episode of next season if available
    var nextSeason = this.keys.season_selection + 1;
    if (nextSeason < this.seasons.length) {
      this.handleSeasonSelect(nextSeason);
      var self = this;
      setTimeout(function () {
        self.playEpisode(0);
      }, 500);
    } else {
      console.log("[SeriesSummary] Series completed");
      this.showEpisodesList();
    }
  },

  playFirstEpisode: function () {
    if (this.seasons.length > 0 && this.seasons[0].episodes && this.seasons[0].episodes.length > 0) {
      this.episodes = this.seasons[0].episodes.slice();
      this.playEpisode(0);
    } else {
      console.warn("[SeriesSummary] No episodes to play");
    }
  },

  toggleFavorite: function () {
    var id = current_movie.series_id;
    var isFav = Array.isArray(SeriesModel.favourite_ids) && SeriesModel.favourite_ids.includes(id);
    if (isFav) {
      SeriesModel.removeRecentOrFavouriteMovie(id, "favourite");
    } else {
      SeriesModel.addRecentOrFavouriteMovie(current_movie, "favourite");
    }
    this.updateFavoriteButton();
  },

  updateFavoriteButton: function () {
    var id = current_movie.series_id;
    var isFav = Array.isArray(SeriesModel.favourite_ids) && SeriesModel.favourite_ids.includes(id);
    var $txt = $("#series-favorite-text");
    var $ico = $("#series-favorite-icon");
    if (isFav) {
      $txt.text(LanguageManager.getText ? LanguageManager.getText("remove_favorite") : "Remove Favorite");
      $ico.removeClass("far").addClass("fas");
    } else {
      $txt.text(LanguageManager.getText ? LanguageManager.getText("add_to_favorites") : "Add to Favorites");
      $ico.removeClass("fas").addClass("far");
    }
  },

  showTrailer: function () {
    var trailer = (this.current_series_info && this.current_series_info.info && this.current_series_info.info.youtube_trailer) || "";
    if (trailer) {
      this.showTrailerModal(trailer);
    } else {
      $("#toast-body").html(
        "<h3>" +
          (LanguageManager.getText ? LanguageManager.getText("sorry_no_trailer") : "No trailer available") +
          "</h3>"
      );
      if ($(".toast").length && typeof $(".toast").toast === "function") {
        $(".toast").toast({ animation: true, delay: 2000 }).toast("show");
      }
    }
  },

  goBack: function () {
    console.log("[SeriesSummary] goBack ->", this.prev_route);
    this.hideTrailerModal();
    $("#series-summary-page").addClass("hide");

    if (typeof toggleDeviceInfoBanner === "function") {
      toggleDeviceInfoBanner(true);
    }

    if (this.prev_route === "vod-series-page" && typeof vod_series_page !== "undefined") {
      console.log("[SeriesSummary] Returning to vod-series-page");
      $("#vod-series-page").removeClass("hide");
      window.current_route = "vod-series-page";

      // Restore list position on VOD page (if stored)
      if (vod_series_page.last_watched_series) {
        var last = vod_series_page.last_watched_series;
        console.log("[SeriesSummary] Restoring VOD page position:", last);

        vod_series_page.current_category_index = last.category_index || 0;
        vod_series_page.keys.category_selection = last.category_index || 0;
        vod_series_page.keys.menu_selection = last.menu_selection || 0;
        vod_series_page.keys.focused_part = "menu_selection";

        setTimeout(function () {
          if (vod_series_page.category_doms && vod_series_page.category_doms[vod_series_page.keys.category_selection]) {
            vod_series_page.hoverCategory(vod_series_page.category_doms[vod_series_page.keys.category_selection]);
          }
          if (vod_series_page.menu_doms && vod_series_page.menu_doms[vod_series_page.keys.menu_selection]) {
            vod_series_page.hoverMovieItem(vod_series_page.menu_doms[vod_series_page.keys.menu_selection]);
            if (typeof vod_series_page.scrollMovieIntoView === "function") {
              vod_series_page.scrollMovieIntoView(vod_series_page.keys.menu_selection);
            }
          }
        }, 120); // wait a tick for DOM to settle
      }

      if (typeof vod_series_page.returnFromMovieDetail === "function") {
        vod_series_page.returnFromMovieDetail();
      }
    } else {
      showPage(this.prev_route || "home-page");
    }
  },

  // Placeholder trailer modal helpers (define elsewhere if you use a real modal)
  showTrailerModal: function (url) {
    // Implement as needed by your UI framework
    console.log("[SeriesSummary] showTrailerModal:", url);
  },
  hideTrailerModal: function () {
    // Implement as needed by your UI framework
  }
};