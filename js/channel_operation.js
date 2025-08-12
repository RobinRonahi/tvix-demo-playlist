/* ==== channel_operation.js – Clean & Structured, TIZEN 6/9 SAFE ==== */
"use strict";

/* ──────────────────────────────────────────────────────────────────
   CONSTS / SELECTORS / STRINGS
   ────────────────────────────────────────────────────────────────── */
const DEV_MODE = false; // set true for in-file non-DOM tests
const BATCH_SIZE = 80;
const EPG_REFRESH_MS = 60000;
const FULLSCREEN_INFO_HIDE_MS = 5000;

const SELECTORS = {
  root:            "#channel-page",
  categoriesWrap:  "#channel-categories-wrapper",
  channelsWrap:    "#channel-page-menus-wrapper",
  playerContainer: "#channel-page .player-container",
  channelSort:     ".channel-sort",
  channelTitle:    "#channel-title",
  fsInfo:          "#full-screen-information",
  fsOverlay:       ".fullscreen-epg-overlay",
  fsChLogo:        ".fullscreen-channel-logo img",
  fsChName:        ".fullscreen-channel-name",
  fsChNumber:      ".fullscreen-channel-number",
  fsCatName:       "#full-screen-category-name",
  upcomingList:    "#upcoming-programs-list",
  currentTitle:    "#current-program-title",
  currentTime:     "#current-program-time",
  fsProgTitle:     ".fullscreen-program-title",
  fsProgTime:      ".fullscreen-program-time",
  fsProgDesc:      ".fullscreen-program-description",
  searchPanel:     "#modern-search-input-container",
  searchInput:     "#modern-search-input",
  searchResults:   "#modern-search-results",
  typedZap:        "#typed-channel-number",
  topMenuBtns:     ".action-btn",
  videoCtrlIcons:  "#channel-page .video-control-icon-wrapper"
};

const STRINGS = {
  allCategory:  () => (typeof current_words !== "undefined" && current_words.all_category) ? current_words.all_category : "All",
  sortWord:     (key) => {
    if (typeof current_words !== "undefined" && current_words[key]) return current_words[key];
    if (typeof settings !== "undefined" && settings.sort_keys && settings.sort_keys[key]) return settings.sort_keys[key];
    return key || "Default";
  },
  searchResults: () => (typeof current_words !== "undefined" && current_words.search_results) ? current_words.search_results : "Search Results",
  noProgram:    () => (typeof current_words !== "undefined" && current_words.no_program_info) ? current_words.no_program_info : "No program info",
  noChannel:    () => (typeof current_words !== "undefined" && current_words.no_channels_found) ? current_words.no_channels_found : "No channel found",
  andMore:      (n) => {
    const t = (typeof current_words !== "undefined" && current_words.and_more_results) ? current_words.and_more_results : "and %s more";
    return t.replace("%s", n);
  },
  addedToFavorites: () => (typeof current_words !== "undefined" && current_words.added_to_favorites) ? current_words.added_to_favorites : "Added to favorites",
  removedFromFavorites: () => (typeof current_words !== "undefined" && current_words.removed_from_favorites) ? current_words.removed_from_favorites : "Removed from favorites"
};

/* ──────────────────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────────────────── */
var channel_page = {
  // playback / ui state
  current_channel_id: 0,
  full_screen_video: false,

  // timers
  full_screen_timer: null,
  fullscreen_epg_timer: null,
  progressbar_timer: null,
  channel_number_timer: null,
  next_programme_timer: null,
  next_channel_timer: null,
  channel_hover_timer: null,
  category_hover_timer: null,
  search_debounce_timer: null,

  // data
  channel_num: 0,
  movies: [],
  categories: [],
  programmes: [],
  _cache: null,
  short_epg_limit_count: 30,
  
  // channel click state
  last_selected_channel_id: null,

  // dom refs (live NodeLists via jQuery)
  category_doms: [],
  channel_doms: [],
  video_control_doms: $(SELECTORS.videoCtrlIcons),
  top_menu_doms: $(SELECTORS.topMenuBtns),

  // keyboard focus model
  keys: {
    focused_part: "category_selection",
    category_selection: 0,
    channel_selection: 0,
    search_back_selection: 0,
    search_selection: -1,
    prev_focus: "",
    video_control: 0,
    top_menu_selection: 0
  },

  // search state
  prev_keyword: "",
  search_key_timer: "",
  search_key_timout: 400,
  search_channels: [],
  filtered_search_results: [],
  current_search_results: [],
  // Flag indicating whether a search UI is currently active. When true the search
  // modal or search bar should remain visible and retain focus until a channel
  // is selected or the user explicitly closes it. This helps prevent the search
  // panel from immediately disappearing when navigating with the remote.
  searchActive: false,

  /* ────────────────────────────────────────────────────────────────
     #1 LIFECYCLE
     ──────────────────────────────────────────────────────────────── */
  init: function () {
    const sortKey = (typeof settings !== "undefined" && settings.live_sort) ? settings.live_sort : "Default";
    $(SELECTORS.channelSort).text(STRINGS.sortWord(sortKey));

    $("#home-page").addClass("hide");
    $(SELECTORS.root).removeClass("hide");
    
    // Reset channel state
    this.last_selected_channel_id = null;
    this.full_screen_video = false;

    // cache categories
    if (!this._cache) this._cache = {};
    if (!this._cache.categories && typeof LiveModel !== "undefined") {
      this._cache.categories = LiveModel.getCategories(false, true) || [];
    }
    const categories = (this._cache.categories || []).slice(0);

    // prepend "All"
    const allChannels = [];
    for (let i = 0; i < categories.length; i++) {
      if (categories[i].movies && categories[i].movies.length) {
        allChannels.push.apply(allChannels, categories[i].movies);
      }
    }
    categories.unshift({ category_id: "all", category_name: STRINGS.allCategory(), movies: allChannels });
    this.categories = categories;

    // render categories
    let html = "";
    categories.forEach((item, index) => {
      const count = item.movies ? item.movies.length : 0;
      html +=
        '<div class="channel-page-category-item bg-focus-1" ' +
        ' onmouseenter="channel_page.hoverCategory(' + index + ')" ' +
        ' onclick="channel_page.handleMenuClick()">' +
        '<span class="category-name">' + (item.category_name || "") + "</span>" +
        '<span class="category-count">' + count + "</span>" +
        "</div>";
    });
    $(SELECTORS.categoriesWrap).html(html);
    this.category_doms = $(".channel-page-category-item");

    // top menu cache
    this.top_menu_doms = $(SELECTORS.topMenuBtns);

    // set default category to 4th (index 3) if exists and not empty
let defaultIndex = 3;
if (!categories[defaultIndex] || !categories[defaultIndex].movies || !categories[defaultIndex].movies.length) {
  // fallback: first non-empty category
  for (let i = 0; i < categories.length; i++) {
    if (categories[i].movies && categories[i].movies.length) { 
      defaultIndex = i; 
      break; 
    }
  }
}
this.current_category_index = -1;
this.keys.category_selection = defaultIndex;

    this.showCategoryChannels();

    if (categories[firstIndex] && categories[firstIndex].movies && categories[firstIndex].movies.length) {
      this.hoverChannel(0);
      this.showMovie(this.movies[0]);
    }
    this.full_screen_video = false;
    if (typeof top_menu_page !== "undefined") top_menu_page.sub_route = "channel-page";
  },

  Exit: function () {
    try { media_player.close(); } catch (e) {}
    this.keys.focused_part = "channel_selection";
    this.full_screen_video = false;
    this.zoomInOut();

    $(SELECTORS.root).addClass("hide");
    if (this.progressbar_timer) clearInterval(this.progressbar_timer);
    if (this.full_screen_timer) clearTimeout(this.full_screen_timer);
    if (this.next_channel_timer) clearTimeout(this.next_channel_timer);
    if (this.fullscreen_epg_timer) { clearTimeout(this.fullscreen_epg_timer); this.fullscreen_epg_timer = null; }

    // Force-hide any global overlays that could block homepage interactions
    try {
      var fs = document.querySelector(SELECTORS.fsOverlay);
      if (fs) { fs.style.display = 'none'; fs.classList.remove('show'); fs.classList.remove('hide'); }
    } catch (_) {}
    try {
      var modal = document.getElementById('channel-search-modal');
      if (modal) modal.classList.remove('active');
    } catch (_) {}
    try {
      // Also collapse inline search UI if present
      $(SELECTORS.searchPanel).removeClass('active').hide();
      $(SELECTORS.searchResults).hide().html("");
    } catch (_) {}
    
    // Clear channel state
    this.last_selected_channel_id = null;

    try {
      current_route = "home-page";
      if (typeof home_page !== "undefined" && home_page.refreshUI) home_page.refreshUI();
      if (typeof top_menu_page !== "undefined" && top_menu_page.init) top_menu_page.init();
    } catch (e) {}

    if (typeof home_page !== "undefined" && home_page.reEnter) home_page.reEnter();
  },

  /* ────────────────────────────────────────────────────────────────
     #2 RENDERING (Category & Channel List)
     ──────────────────────────────────────────────────────────────── */
  showCategoryChannels: function () {
    const keys = this.keys;
    if (keys.category_selection === this.current_category_index) return;

    this.prev_keyword = "";
    $("#channel-page-search-input").val("");

    const categories = this.categories || [];
    const category = categories[keys.category_selection] || { movies: [] };
    this.movies = category.movies || [];
    this.renderCategoryChannels();
  },

  renderCategoryChannels: function () {
    const el = document.querySelector(SELECTORS.channelsWrap);
    if (!el) return;

    const items = this.movies || [];
    el.innerHTML = "";

    let i = 0;
    const renderChunk = () => {
      const frag = document.createDocumentFragment();
      const end = Math.min(i + BATCH_SIZE, items.length);

      for (; i < end; i++) {
        const movie = items[i] || {};
        const isFav = (LiveModel.favourite_ids || []).includes(movie.stream_id);

        const div = document.createElement("div");
        div.className = "channel-menu-item bg-focus-1";
        div.dataset.channel_id = movie.stream_id || "";
        div.dataset.index = i;
        div.onclick = function(){ channel_page.handleMenuClick(); };
        div.onmouseenter = function(){ channel_page.hoverChannel(i); };

        const no = document.createElement("span");
        no.className = "channel-number";
        no.textContent = (i + 1);
        div.appendChild(no);

        const img = document.createElement("img");
        img.className = "channel-icon";
        img.loading = "lazy";
        img.src = movie.stream_icon || (typeof default_movie_icon !== "undefined" ? default_movie_icon : "");
        img.onerror = function(){ if (typeof default_movie_icon !== "undefined") this.src = default_movie_icon; };
        div.appendChild(img);

        const name = document.createElement("span");
        name.className = "channel-name";
        name.textContent = movie.name || "";
        div.appendChild(name);

        const fav = document.createElement("span");
        fav.className = "favourite-icon-wrapper" + (isFav ? " favourite" : "");
        fav.innerHTML = '<i class="fa fa-star favourite-icon"></i>';
        div.appendChild(fav);

        frag.appendChild(div);
      }

      el.appendChild(frag);

      if (i < items.length) {
        requestAnimationFrame(renderChunk);
      } else {
        this.keys.channel_selection = 0;
        this.channel_doms = $(SELECTORS.channelsWrap + " .channel-menu-item");
        if (this.channel_doms[0]) moveScrollPosition($(SELECTORS.channelsWrap), this.channel_doms[0], "vertical", true);
        this.current_category_index = this.keys.category_selection;
        this.hoverChannel(0);
      }
    };

    requestAnimationFrame(renderChunk);
  },

  /* ────────────────────────────────────────────────────────────────
     #3 PLAYBACK & FULLSCREEN
     ──────────────────────────────────────────────────────────────── */
  showMovie: function (current_movie) {
    if (!current_movie) return;

    let url;
    const movie_id = current_movie.stream_id;
    if (settings.playlist_type === "xtreme") url = getMovieUrl(movie_id, "live", "ts");
    else if (settings.playlist_type === "type1") url = current_movie.url;

    try { media_player.close(); } catch (e) {}
    media_player.init("channel-page-video", "channel-page");
    try { media_player.playAsync(url); } catch (e) {}

    $(SELECTORS.channelTitle).text(current_movie.name || "");
    this.current_channel_id = movie_id;
    this.last_selected_channel_id = movie_id; // Update last selected channel

    $(SELECTORS.fsChName).text(current_movie.name || "");
    $(".full-screen-channel-logo").attr("src", current_movie.stream_icon || "");
    const current_category = this.categories[this.current_category_index] || {};
    $(SELECTORS.fsCatName).text(current_category.category_name || "");

    // Only update EPG info if we're in fullscreen mode - don't auto-show EPG on channel change
    if (this.full_screen_video) {
      setTimeout(() => { this.updateFullscreenEPGInfo(); }, 100);
    }

    if (!checkForAdult(current_movie, "movie", LiveModel.categories)) {
      LiveModel.addRecentOrFavouriteMovie(current_movie, "recent");
    }
  },

  playOrPause: function () {
    try {
      if (media_player.state === media_player.STATES.PLAYING) media_player.pause();
      else media_player.play();
    } catch (e) {}
  },

  zoomInOut: function () {
    const fs = this.full_screen_video;

    if (!fs) {
      $(SELECTORS.playerContainer).removeClass("expanded");
      $(SELECTORS.root).removeClass("fullscreen-mode");
      document.body.classList.remove("fullscreen-active");

      setTimeout(function(){
        try { media_player.setDisplayArea(); } catch(e){}
      }, 200);

      this.keys.focused_part = "channel_selection";
      $(SELECTORS.fsInfo).slideUp();
    } else {
      $(SELECTORS.playerContainer).addClass("expanded");
      $(SELECTORS.root).addClass("fullscreen-mode");
      document.body.classList.add("fullscreen-active");

      setTimeout(() => {
        try { media_player.setDisplayArea(); } catch (e) {}
        setTimeout(() => {
          try { media_player.setDisplayArea(); this.forceFullscreenBalance(true); } catch (e) {}
        }, 300);
      }, 200);

      this.showFullScreenInfo();
      this.keys.focused_part = "full_screen";
    }
  },

  forceFullscreenBalance: function (isFullscreen) {
    if (typeof media_player !== "undefined" && media_player.parent_id === "channel-page") {
      try {
        if (isFullscreen) {
          const w = window.screen ? window.screen.width : window.innerWidth;
          const h = window.screen ? window.screen.height : window.innerHeight;
          if (typeof webapis !== "undefined" && webapis.avplay) webapis.avplay.setDisplayRect(0, 0, w, h);
        } else {
          const c = document.querySelector(SELECTORS.playerContainer);
          if (c && typeof webapis !== "undefined" && webapis.avplay) {
            const r = c.getBoundingClientRect();
            webapis.avplay.setDisplayRect(r.left, r.top, r.width, r.height);
          }
        }
      } catch (err) { console.error("forceFullscreenBalance:", err); }
    }
  },

  showNextChannel: function (inc) {
    const keys = this.keys;
    const prevSel = keys.channel_selection;

    keys.channel_selection += inc;
    if (keys.channel_selection < 0) keys.channel_selection = this.channel_doms.length - 1;
    if (keys.channel_selection >= this.channel_doms.length) keys.channel_selection = 0;
    if (prevSel === keys.channel_selection) return;

    // Show loader immediately for snappy feedback
    try { $('#channel-page .player-container .video-loader').show(); } catch (_) {}
    if (this.movies[keys.channel_selection]) {
      const movie = this.movies[keys.channel_selection];
      this.current_channel_id = movie.stream_id;
      this.showMovie(movie);
      if (this.full_screen_video) this.showFullScreenInfo();
    }

    this.hoverChannel(keys.channel_selection);
    if (this.keys.focused_part === "full_screen") this.keys.focused_part = "full_screen";
    this.showFullScreenInfo();
  },

  goChannelNum: function (n) {
    if (!this.full_screen_video) return;

    let chan = this.channel_num;
    if (chan !== 0 || (chan === 0 && n !== 0)) {
      chan = chan * 10 + n;
      this.channel_num = chan;
      clearTimeout(this.channel_number_timer);
      $(SELECTORS.typedZap).text(chan);

      this.channel_number_timer = setTimeout(() => {
        const list = this.movies || [];
        if (list[chan - 1]) {
          const idx = chan - 1;
          const cm = list[idx];
          this.showMovie(cm);
          this.current_channel_id = cm.stream_id;
          this.hoverChannel(idx);
          this.keys.focused_part = "full_screen";
          this.showFullScreenInfo();
        } else {
          showToast("Sorry", "Channel does not exist");
        }
        this.channel_num = 0;
        $(SELECTORS.typedZap).text("");
      }, 2000);
    }
  },

  showFullScreenInfo: function () {
    if (!this.full_screen_video) return;
    clearTimeout(this.full_screen_timer);

    this.showFullscreenEPGOverlay();
    this.full_screen_timer = setTimeout(() => { this.hideFullScreenInfo(); }, FULLSCREEN_INFO_HIDE_MS);
  },

  showFullscreenEPGOverlay: function () {
    const overlay = document.querySelector(SELECTORS.fsOverlay);
    if (!overlay) return;

    this.updateFullscreenEPGInfo();
    overlay.style.display = "block";
    setTimeout(() => { overlay.classList.add("show"); }, 50);

    clearTimeout(this.fullscreen_epg_timer);
    this.fullscreen_epg_timer = setTimeout(() => { this.hideFullscreenEPGOverlay(); }, FULLSCREEN_INFO_HIDE_MS);
  },

  hideFullscreenEPGOverlay: function () {
    const overlay = document.querySelector(SELECTORS.fsOverlay);
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.classList.add("hide");
    setTimeout(() => { overlay.style.display = "none"; overlay.classList.remove("hide"); }, 400);
  },

  updateFullscreenEPGInfo: function () {
    const keys = this.keys;
    if (!this.movies || !this.movies[keys.channel_selection]) return;

    const ch = this.movies[keys.channel_selection];

    const logo = document.querySelector(SELECTORS.fsChLogo);
    if (logo) { logo.src = ch.stream_icon || ""; logo.alt = ch.name || ""; }

    const name = document.querySelector(SELECTORS.fsChName);
    if (name) name.textContent = ch.name || "";

    const number = document.querySelector(SELECTORS.fsChNumber);
    if (number) number.textContent = "CH " + (keys.channel_selection + 1);

    this.updateFullscreenEPGPrograms();
  },

  updateFullscreenEPGPrograms: function () {
    if (!this.programmes || !this.programmes.length) {
      // EPG yok ise varsayılan metin göster
      const title = document.querySelector(SELECTORS.fsProgTitle);
      const time = document.querySelector(SELECTORS.fsProgTime);
      const desc = document.querySelector(SELECTORS.fsProgDesc);
      
      if (title) title.textContent = STRINGS.noProgram();
      if (time) time.textContent = "";
      if (desc) desc.textContent = "";
      return;
    }

    // Şu anki program bilgisini bul
    const now = Date.now();
    let currentProgram = null;

    function parseDateSafe(s) {
      let d = new Date(s);
      if (isNaN(d.getTime())) {
        // Safari/Tizen için güvenli parse: "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm"
        d = new Date(String(s || "").replace(" ", "T"));
      }
      return d;
    }

    for (let i = 0; i < this.programmes.length; i++) {
      const prog = this.programmes[i];
      const startTime = parseDateSafe(prog.start).getTime();
      const endTime = parseDateSafe(prog.stop).getTime();

      if (Number.isFinite(startTime) && Number.isFinite(endTime) && now >= startTime && now <= endTime) {
        currentProgram = prog;
        break;
      }
    }
    
    // Fullscreen EPG bilgilerini güncelle
    const title = document.querySelector(SELECTORS.fsProgTitle);
    const time = document.querySelector(SELECTORS.fsProgTime);
    const desc = document.querySelector(SELECTORS.fsProgDesc);
    
    if (currentProgram) {
      if (title) title.textContent = currentProgram.title || "";
      if (time) {
        const start = parseDateSafe(currentProgram.start);
        const end = parseDateSafe(currentProgram.stop);
        const is12 = (typeof settings !== "undefined" && settings.time_format === "12");
        const opts = { hour: '2-digit', minute: '2-digit', hour12: !!is12 };
        // Bölgesel saat gösterimi, 12/24 ayarına saygı
        const timeText = (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()))
          ? start.toLocaleTimeString('tr-TR', opts) + " - " + end.toLocaleTimeString('tr-TR', opts)
          : (String(currentProgram.start).substring(11) + " - " + String(currentProgram.stop).substring(11));
        time.textContent = timeText;
      }
      if (desc) desc.textContent = currentProgram.description || "";
    } else {
      if (title) title.textContent = STRINGS.noProgram();
      if (time) time.textContent = "";
      if (desc) desc.textContent = "";
    }
  },

  hideFullScreenInfo: function () {
    $(SELECTORS.fsInfo).slideUp();
    this.hideFullscreenEPGOverlay();
  },

  /* ────────────────────────────────────────────────────────────────
     #4 EPG
     ──────────────────────────────────────────────────────────────── */
  showNextProgrammes: function () {
    const tmp = LiveModel.getNextProgrammes(this.programmes || []);
    const hasCurrent = !!tmp.current_program_exist;
    const list = tmp.programmes || [];

    // mini list
    let html = "", k = 0;
    for (let i = 0; i < list.length && k < 4; i++) {
      const p = list[i];
      const t = (p.start || "").substring(11) + " - " + (p.stop || "").substring(11);
      const cls = (k === 0 && hasCurrent) ? " current" : "";
      html += '<div class="upcoming-program-item' + cls + '">' +
                '<div class="upcoming-program-time">' + t + "</div>" +
                '<div class="upcoming-program-title">' + (p.title || "") + "</div>" +
              "</div>";
      k++;
    }
    if (k) $(SELECTORS.upcomingList).html(html).show(); else $(SELECTORS.upcomingList).hide().html("");

    // current / next
    let cur = null, next = null;
    let curTitle = "No Info", curTime = "", curDesc = "No Description";

    if (hasCurrent && list.length) {
      cur = list[0];
      if (list.length > 1) next = list[1];
    } else if (list.length) {
      next = list[0];
    }

    if (cur) {
      curTitle = cur.title || "No Info";
      curTime  = (cur.start || "").substring(11) + " ~ " + (cur.stop || "").substring(11);
      curDesc  = cur.description || "No Description";
    }

    $(SELECTORS.currentTitle).text(curTitle);
    $(SELECTORS.currentTime).text(curTime);
    $(".full-screen-program-name.current").text(curTitle);
    $(".full-screen-program-time.current").text(curTime);
    $(".full-screen-program-desc.current").text(curDesc);

    if (next) {
      $(".full-screen-program-name.next").text(next.title || "");
      $(".full-screen-program-time.next").text((next.start || "").substring(11) + " ~ " + (next.stop || "").substring(11));
      $(".full-screen-program-desc.next").text(next.description || "No Description");
    }
  },

  updateNextProgrammes: function () {
    this.showNextProgrammes();
    if (this.next_programme_timer) clearInterval(this.next_programme_timer);
    this.next_programme_timer = setInterval(() => { this.showNextProgrammes(); }, EPG_REFRESH_MS);
  },

  getEpgProgrammes: function () {
    const keys = this.keys;
    this.programmes = [];
    this.showNextProgrammes();

    if (!this.movies || !this.movies.length || keys.channel_selection < 0 || keys.channel_selection >= this.movies.length) return;
    const movie = this.movies[keys.channel_selection];

    if (typeof settings === "undefined") return;

    if (settings.playlist_type === "xtreme") {
      if (typeof api_host_url === "undefined" || typeof user_name === "undefined" || typeof password === "undefined") return;

      const fmt = "Y-MM-DD HH:mm";
      const url = `${api_host_url}/player_api.php?username=${user_name}&password=${password}&action=get_short_epg&stream_id=${movie.stream_id}&limit=${this.short_epg_limit_count}`;

      $.ajax({
        method: "get",
        url,
        timeout: 10000,
        success: (data) => {
          if (data && data.epg_listings && data.epg_listings.length) {
            this.programmes = data.epg_listings.map((it) => ({
              start: getLocalChannelTime(it.start).format(fmt),
              stop:  getLocalChannelTime(it.end).format(fmt),
              title: getAtob(it.title),
              description: getAtob(it.description)
            }));
            this.updateNextProgrammes();
          }
        },
        error: function (xhr, status, error) {
          console.log("EPG load error:", error, status, xhr && xhr.responseText);
        }
      });
    }
  },

  /* ────────────────────────────────────────────────────────────────
     #5 SEARCH (Modern Modal)
     ──────────────────────────────────────────────────────────────── */
  showSearchModal: function() {
    console.log('Opening search modal');
    
    // Create search modal if it doesn't exist
    let searchModal = document.getElementById('channel-search-modal');
    if (!searchModal) {
      searchModal = document.createElement('div');
      searchModal.id = 'channel-search-modal';
      searchModal.className = 'modern-search-panel';
      searchModal.innerHTML = `
        <div class="modern-search-content">
          <h3 style="color:#74b9ff;margin-bottom:20px;text-align:center;">Kanal Arama</h3>
          <input type="text" id="channel-search-input" class="modern-search-input" placeholder="Kanal adını yazın..." autocomplete="off">
          <div id="channel-search-results" class="channel-search-results" style="display:none;"></div>
        </div>
      `;
      document.body.appendChild(searchModal);
    }
    
    // Show modal
    searchModal.classList.add('active');
    
    // Focus on input
    const searchInput = document.getElementById('channel-search-input');
    const searchResults = document.getElementById('channel-search-results');
    
    setTimeout(() => {
      searchInput.value = '';
      searchInput.focus();
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
    }, 100);
    
    // Prepare search data
    this.prepareChannelSearch();
    
    // Setup search functionality
    this.setupSearchModal(searchInput, searchResults, searchModal);
    
    // Update focus state
    this.keys.focused_part = "search_modal";
    this.keys.search_selection = -1;
    this.current_search_results = [];
    // mark the search state as active so the UI remains visible until closed
    this.searchActive = true;
  },

  setupSearchModal: function(searchInput, searchResults, searchModal) {
    // Clear previous listeners
    searchInput.onkeyup = null;
    searchInput.onkeydown = null;
    
    // Search input handler
    searchInput.onkeyup = (e) => {
      if (e.keyCode === 27 || e.keyCode === 8 || e.keyCode === 10009 || e.keyCode === 10182) {
        // ESC/Back - close modal
        this.closeSearchModal();
        return;
      }
      
      const query = searchInput.value.trim();
      this.performModalSearch(query, searchResults);
    };
    
    // Key navigation handler
    searchInput.onkeydown = (e) => {
      if (e.keyCode === 13 || e.keyCode === 29443) {
        // Enter - select first result
        if (this.current_search_results && this.current_search_results.length > 0) {
          this.selectSearchResult(0);
        }
        e.preventDefault();
      } else if (e.keyCode === 40 || e.keyCode === 2) {
        // Down arrow - navigate to results
        if (this.current_search_results && this.current_search_results.length > 0) {
          this.keys.search_selection = 0;
          this.highlightSearchResult(0);
          searchInput.blur();
        }
        e.preventDefault();
      }
    };
    
    // Click outside to close
    searchModal.onclick = (e) => {
      if (e.target === searchModal) {
        this.closeSearchModal();
      }
    };
  },

  performModalSearch: function(query, resultsContainer) {
    if (!query || query.length < 1) {
      resultsContainer.style.display = 'none';
      resultsContainer.innerHTML = '';
      this.current_search_results = [];
      return;
    }
    
    if (!this.search_channels || !this.search_channels.length) {
      this.prepareChannelSearch();
    }
    
    const term = query.toLowerCase().trim();
    const found = [];
    const list = this.search_channels || [];
    const max = 50;
    let cnt = 0;
    
    for (let i = 0; i < list.length && cnt < max; i++) {
      const ch = list[i];
      const nm = ch.name ? ch.name.toLowerCase() : "";
      if (nm.indexOf(term) !== -1) { 
        found.push(ch); 
        cnt++; 
      }
    }
    
    // Sort results - exact matches first
    found.sort((a,b) => {
      const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
      const as = an.startsWith(term), bs = bn.startsWith(term);
      if (as && !bs) return -1;
      if (!as && bs) return 1;
      return an.localeCompare(bn);
    });
    
    this.current_search_results = found;
    this.renderSearchResults(found, resultsContainer);
  },

  renderSearchResults: function(channels, container) {
    let html = "";
    
    if (!channels || !channels.length) {
      html = '<div class="search-no-results-modern">Kanal bulunamadı</div>';
    } else {
      const show = channels.slice(0, 20);
      for (let i = 0; i < show.length; i++) {
        const ch = show[i];
        html += `
          <div class="modern-search-item" onclick="channel_page.selectSearchResult(${i})" data-index="${i}">
            <div class="modern-search-channel-icon-wrapper">
              <img class="modern-search-channel-icon" src="${ch.stream_icon || ''}" 
                   onerror="this.style.display='none'">
            </div>
            <div class="modern-search-channel-info">
              <div class="modern-search-channel-name">${ch.name || ''}</div>
              <div class="modern-search-channel-category">${ch.category_name || ''}</div>
            </div>
          </div>
        `;
      }
      if (channels.length > 20) {
        html += `<div class="search-more-results">... ve ${channels.length - 20} kanal daha</div>`;
      }
    }
    
    container.innerHTML = html;
    if (html.trim() !== "") {
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
    
    this.current_search_results = (channels || []).slice(0, 20);
  },

  selectSearchResult: function(index) {
    if (!this.current_search_results || index < 0 || index >= this.current_search_results.length) return;
    const sel = this.current_search_results[index];
    
    console.log('Selected search channel:', sel.name);
    
    // Close search modal
    this.closeSearchModal();
    
    // Find and show the channel's category
    if (sel.category_index !== undefined) {
      this.keys.category_selection = sel.category_index;
      this.current_category_index = sel.category_index;
      
      // Update category UI
      this.hoverCategory(sel.category_index);
      this.showCategoryChannels();
    }
    
    // Wait for category channels to load, then select the channel
    setTimeout(() => {
      let foundIndex = -1;
      
      // Look for the channel in current movies list
      for (let i = 0; i < this.movies.length; i++) {
        if (this.movies[i].stream_id === sel.stream_id || 
            this.movies[i].name === sel.name) { 
          foundIndex = i; 
          break; 
        }
      }
      
      if (foundIndex >= 0) {
        // Channel found in current category
        this.keys.channel_selection = foundIndex;
        this.hoverChannel(foundIndex);
        this.showMovie(this.movies[foundIndex]);
        
        console.log('Channel found and selected at index:', foundIndex);
      } else {
        // Channel not in current category, show it directly
        this.showMovie(sel);
        this.current_channel_id = sel.stream_id;
        
        console.log('Channel shown directly:', sel.name);
      }
      
      // Focus on the channel
      this.keys.focused_part = "channel_selection";
      
    }, 500);
  },

  closeSearchModal: function() {
    const searchModal = document.getElementById('channel-search-modal');
    if (searchModal) {
      searchModal.classList.remove('active');
    }

    // Search is no longer active; hide any search bars or results tied to the search panel.
    // Removing the `active` class and hiding the modern search input container ensures
    // that the search bar does not linger on screen after a channel is selected.
    this.searchActive = false;
    try {
      // hide integrated modern search panel (if it exists)
      $(SELECTORS.searchPanel).removeClass('active').hide();
      // clear modern search input and results
      $(SELECTORS.searchInput).val("");
      $(SELECTORS.searchResults).hide().html("");
    } catch (e) {
      // ignore if jQuery or selectors are unavailable
    }
    
    // Return focus to channel selection
    this.keys.focused_part = "channel_selection";
    this.keys.search_selection = -1;
    this.current_search_results = [];
  },

  highlightSearchResult: function(index) {
    const items = document.querySelectorAll('.modern-search-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('highlighted');
      } else {
        item.classList.remove('highlighted');
      }
    });
  },

  toggleModernSearch: function () {
    // Redirect to proper search modal
    this.showSearchModal();
  },

  prepareChannelSearch: function () {
    const all = [];
    if (this.categories && this.categories.length) {
      for (let i = 0; i < this.categories.length; i++) {
        const cat = this.categories[i];
        if (cat.movies && cat.movies.length) {
          for (let j = 0; j < cat.movies.length; j++) {
            const ch = cat.movies[j];
            if (ch && ch.name && ch.name.trim() !== "") {
              all.push({
                name: ch.name.trim(),
                stream_id: ch.stream_id,
                stream_icon: ch.stream_icon || "",
                category_name: cat.category_name,
                category_index: i,
                channel_index: j
              });
            }
          }
        }
      }
    }
    this.search_channels = all;
    this.filtered_search_results = [];
  },

  modernSearchChannels: function (val) {
    if (this.search_debounce_timer) clearTimeout(this.search_debounce_timer);
    this.search_debounce_timer = setTimeout(() => { this.performModernSearch(val); }, 100);
  },

  searchValueChange: function () {
    const val = $(SELECTORS.searchInput).val().trim();
    this.performModernSearch(val);
  },

  performModernSearch: function (val) {
    if (!val || val.trim() === "") {
      $(SELECTORS.searchResults).html("").hide();
      this.current_search_results = [];
      // Arama temizlendiğinde normal kanal listesini geri yükle
      this.showCategoryChannels();
      return;
    }
    if (!this.search_channels || !this.search_channels.length) this.prepareChannelSearch();

    const term = val.toLowerCase().trim();
    const found = [];
    const list = this.search_channels || [];
    const max = 50;
    let cnt = 0;

    for (let i = 0; i < list.length && cnt < max; i++) {
      const ch = list[i];
      const nm = ch.name ? ch.name.toLowerCase() : "";
      if (nm.indexOf(term) !== -1) { found.push(ch); cnt++; }
    }

    found.sort((a,b) => {
      const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
      const as = an.startsWith(term), bs = bn.startsWith(term);
      if (as && !bs) return -1;
      if (!as && bs) return 1;
      return an.localeCompare(bn);
    });

    this.current_search_results = found;
    this.renderModernSearchResults(found);
  },

  renderModernSearchResults: function (channels) {
    let html = "";
    
    // Arama yapılıyorsa kanal listesi bölümünde göster
    if (!channels || !channels.length) {
      html = '<div class="search-no-results">' + STRINGS.noChannel() + "</div>";
    } else {
      // Arama sonuçlarını normal kanal listesi formatında göster
      const show = channels.slice(0, 50); // Daha fazla sonuç göster
      for (let i = 0; i < show.length; i++) {
        const ch = show[i];
        html += '<div class="channel-menu-item bg-focus-1" onclick="channel_page.selectModernSearchChannel(' + i + ')" data-index="' + i + '">' +
                  '<div class="channel-icon-wrapper">' +
                    '<img class="channel-icon" src="' + (ch.stream_icon || "") + '"' +
                    (typeof default_movie_icon !== "undefined" ? ' onerror="this.src=\'' + default_movie_icon + '\'"' : "") +
                    '>' +
                  '</div>' +
                  '<div class="channel-title-wrapper">' +
                    '<div class="channel-title">' + (ch.name || "") + '</div>' +
                    '<div class="channel-category">' + (ch.category_name || "") + '</div>' +
                  '</div>' +
                '</div>';
      }
      if (channels.length > 50) {
        html += '<div class="search-more-results">... ' + STRINGS.andMore(channels.length - 50) + "</div>";
      }
    }
    
    // Arama sonuçlarını kanal listesi bölümünde göster
    const channelListEl = $(SELECTORS.channelsWrap);
    const searchResultsEl = $(SELECTORS.searchResults);
    
    if (channels && channels.length > 0) {
      // Kanal listesini gizle ve arama sonuçlarını göster
      channelListEl.html('<div class="search-results-header"><i class="fa fa-search"></i> ' + STRINGS.searchResults() + '</div>' + html);
      searchResultsEl.hide(); // Popup'ı gizle
    } else if (html.trim() !== "") {
      // Sonuç bulunamadı mesajını kanal listesinde göster
      channelListEl.html('<div class="search-results-header"><i class="fa fa-search"></i> ' + STRINGS.searchResults() + '</div>' + html);
      searchResultsEl.hide(); // Popup'ı gizle
    } else {
      // Arama temizlendiğinde normal kanal listesini geri yükle
      searchResultsEl.hide();
      this.showCategoryChannels();
      return;
    }
    
    this.current_search_results = (channels || []).slice(0, 50);
  },

  selectModernSearchChannel: function (index) {
    if (!this.current_search_results || index < 0 || index >= this.current_search_results.length) return;
    const sel = this.current_search_results[index];

    console.log('Selected search channel:', sel.name);
    
    // Arama sonuçlarını temizle ve arama modundan çık
    $(SELECTORS.searchInput).val("");
    $(SELECTORS.searchResults).hide();
    // hide the search panel completely so it does not float on screen after selecting a channel
    try {
      $(SELECTORS.searchPanel).removeClass('active').hide();
    } catch (e) {
      // in case the element does not exist
    }
    this.current_search_results = [];
    // indicate that search is no longer active
    this.searchActive = false;
    
    // Find the category of the selected channel
    if (sel.category_index !== undefined) {
      this.keys.category_selection = sel.category_index;
      this.current_category_index = sel.category_index;
      
      // Update category UI
      this.hoverCategory(sel.category_index);
      this.showCategoryChannels();
    }

    // Wait for category channels to load, then select the channel
    setTimeout(() => {
      let foundIndex = -1;
      
      // Look for the channel in current movies list
      for (let i = 0; i < this.movies.length; i++) {
        if (this.movies[i].stream_id === sel.stream_id || 
            this.movies[i].name === sel.name) { 
          foundIndex = i; 
          break; 
        }
      }
      
      if (foundIndex >= 0) {
        // Channel found in current category
        this.keys.channel_selection = foundIndex;
        this.hoverChannel(foundIndex);
        this.showMovie(this.movies[foundIndex]);
        
        console.log('Channel found and selected at index:', foundIndex);
      } else {
        // Channel not in current category, show it directly
        this.showMovie(sel);
        this.current_channel_id = sel.stream_id;
        
        console.log('Channel shown directly:', sel.name);
      }
      
      // Focus on the channel
      this.keys.focused_part = "channel_selection";
      
    }, 500);
  },

  handleModernSearchKeydown: function (e) {
    const k = e.keyCode;
    if (k === 13 || k === 29443) { // enter
      if (this.keys.search_selection >= 0 && this.current_search_results[this.keys.search_selection]) {
        this.selectModernSearchChannel(this.keys.search_selection);
      } else if ($(".modern-search-item").first().length > 0) {
        this.selectModernSearchChannel(0);
      }
      e.preventDefault();
    } else if (k === 27 || k === 8 || k === 10009 || k === 10182) { // esc/back/return/exit
      const v = ($(SELECTORS.searchInput).val() || "").trim();
      if (v === "" || k === 27 || k === 10009 || k === 10182) { this.toggleModernSearch(); e.preventDefault(); }
    } else if (k === 40 || k === 2) { // down
      this.keys.search_selection = 0;
      this.keys.focused_part = "search_selection";
      this.highlightSearchResult(0);
      e.preventDefault();
    }
  },

  highlightSearchResult: function (index) {
    const rs = $(".modern-search-item");
    if (!rs.length) return;

    rs.removeClass("highlighted");
    if (index >= 0 && index < rs.length) {
      const item = $(rs[index]);
      item.addClass("highlighted");

      const container = $(SELECTORS.searchResults);
      const top = container.scrollTop();
      const bottom = top + container.height();
      const itTop = item.position().top + top;
      const itBottom = itTop + item.outerHeight();

      if (itTop < top) container.scrollTop(itTop);
      else if (itBottom > bottom) container.scrollTop(itBottom - container.height());
    }
  },

  /* ────────────────────────────────────────────────────────────────
     #6 FOCUS / HOVER / NAVIGATION
     ──────────────────────────────────────────────────────────────── */
  hoverCategory: function (index) {
    if (index < 0 || index >= this.category_doms.length) return;
    this.keys.focused_part = "category_selection";
    this.keys.category_selection = index;

    if (typeof prev_focus_dom !== "undefined" && prev_focus_dom) $(prev_focus_dom).removeClass("active");
    if (this.category_doms[index]) {
      $(this.category_doms[index]).addClass("active");
      current_route = "channel-page";
      prev_focus_dom = this.category_doms[index];
      try { moveScrollPosition($(SELECTORS.categoriesWrap), this.category_doms[index], "vertical", false); } catch(e){}
    }
  },

  hoverTopMenu: function (index) {
    if (index < 0 || index >= this.top_menu_doms.length) return;
    this.keys.top_menu_selection = index;
    this.keys.focused_part = "top_menu_selection";

    if (typeof prev_focus_dom !== "undefined" && prev_focus_dom) $(prev_focus_dom).removeClass("active");
    if (this.top_menu_doms[index]) {
      $(this.top_menu_doms[index]).addClass("active");
      prev_focus_dom = this.top_menu_doms[index];
      current_route = "channel-page";
    }
  },

  hoverChannel: function (index) {
    if (index < 0 || index >= this.channel_doms.length) return;
    this.keys.focused_part = "channel_selection";
    this.keys.channel_selection = index;

    if (typeof prev_focus_dom !== "undefined" && prev_focus_dom) $(prev_focus_dom).removeClass("active");
    current_route = "channel-page";

    if (this.channel_doms[index]) {
      $(this.channel_doms[index]).addClass("active");
      prev_focus_dom = this.channel_doms[index];

      clearTimeout(this.channel_hover_timer);
      try { moveScrollPosition($(SELECTORS.channelsWrap), this.channel_doms[this.keys.channel_selection], "vertical", false); } catch (e) {}

      this.channel_hover_timer = setTimeout(() => {
        if (this.movies && this.movies[this.keys.channel_selection]) this.getEpgProgrammes();
      }, 100);
      if (typeof MemoryOptimizer !== "undefined") MemoryOptimizer.registerTimer(this.channel_hover_timer);
    }
  },

  handleMenuClick: function () {
    const keys = this.keys;

    switch (keys.focused_part) {
      case "category_selection": {
        const category = this.categories[keys.category_selection];
        const isAdult = checkForAdult(category, "category", []);
        if (isAdult) { parent_confirm_page.init(current_route); return; }
        this.showCategoryChannels();
        break;
      }
      case "video_control":
        $(this.video_control_doms[keys.video_control]).trigger("click");
        break;
      case "full_screen":
        this.full_screen_video = false;
        this.zoomInOut();
        this.hideFullScreenInfo(); // Hide EPG when exiting fullscreen
        break;
      case "channel_selection": {
        if (!this.movies || !this.movies[keys.channel_selection]) return;
        
        const selectedChannel = this.movies[keys.channel_selection];
        const channelId = selectedChannel.stream_id;
        
        // Check if this is the same channel as last selected
        if (this.last_selected_channel_id === channelId && this.current_channel_id === channelId) {
          // Same channel clicked again - toggle fullscreen
          if (this.full_screen_video) {
            // Exit fullscreen
            this.full_screen_video = false;
            this.zoomInOut();
            this.hideFullScreenInfo();
          } else {
            // Enter fullscreen with EPG
            this.full_screen_video = true;
            this.zoomInOut();
            setTimeout(() => {
              this.showFullScreenInfo();
            }, 300);
          }
        } else {
          // Different channel - play in normal mode
          this.showMovie(selectedChannel);
          if (this.full_screen_video) {
            this.full_screen_video = false;
            this.zoomInOut();
          }
          this.last_selected_channel_id = channelId;
        }
        break;
      }
      case "top_menu_selection": {
        const i = keys.top_menu_selection;
        if (i === 0) this.addOrRemoveFav();
        else if (i === 1) { this.Exit(); setTimeout(() => { if (typeof home_page !== "undefined" && home_page.init) home_page.init(); }, 100); }
        else if (i === 2) { this.Exit(); setTimeout(() => { if (typeof top_menu_page !== "undefined" && top_menu_page.goToMovies) top_menu_page.goToMovies(); else if (typeof home_page !== "undefined" && home_page.init) home_page.init(); }, 100); }
        else if (i === 3) { this.Exit(); setTimeout(() => { if (typeof top_menu_page !== "undefined" && top_menu_page.goToSeries) top_menu_page.goToSeries(); else if (typeof home_page !== "undefined" && home_page.init) home_page.init(); }, 100); }
        else this.showSearchModal();
        break;
      }
      case "search_selection":
        if ($(SELECTORS.searchPanel).hasClass("active")) {
          if (keys.search_selection >= 0 && this.current_search_results && this.current_search_results[keys.search_selection]) {
            this.selectModernSearchChannel(keys.search_selection);
          }
        }
        break;
        
      case "search_modal":
        if (keys.search_selection >= 0 && this.current_search_results && this.current_search_results[keys.search_selection]) {
          this.selectSearchResult(keys.search_selection);
        }
        break;
    }
  },

  handleMenusUpDown: function (inc) {
    const keys = this.keys;
    const menus = this.channel_doms;

    switch (keys.focused_part) {
      case "category_selection":
        keys.category_selection += inc;
        if (keys.category_selection < 0) { if (this.top_menu_doms.length) return this.hoverTopMenu(0); keys.category_selection = 0; }
        if (keys.category_selection >= this.category_doms.length) { keys.category_selection = this.category_doms.length - 1; return; }
        this.hoverCategory(keys.category_selection);
        break;

      case "channel_selection":
        keys.channel_selection += inc;
        if (keys.channel_selection < 0) { if (this.top_menu_doms.length) return this.hoverTopMenu(0); keys.channel_selection = 0; }
        if (keys.channel_selection >= menus.length) { keys.channel_selection = menus.length - 1; return; }
        this.hoverChannel(keys.channel_selection);
        break;

      case "top_menu_selection":
        if (inc > 0) {
          if (this.categories && this.categories.length) this.hoverCategory(this.keys.category_selection);
          else if (this.movies && this.movies.length) this.hoverChannel(0);
        } else if (typeof top_menu_page !== "undefined" && top_menu_page.hoverMenuItem) {
          top_menu_page.hoverMenuItem(top_menu_page.keys.menu_selection);
        }
        break;

      case "full_screen":
        this.showNextChannel(-1 * inc);
        break;

      case "search_selection":
        this.handleSearchItem(inc);
        break;
        
      case "search_modal":
        this.handleSearchModalNavigation(inc);
        break;
    }
  },

  handleSearchModalNavigation: function(inc) {
    const keys = this.keys;
    
    if (!this.current_search_results || !this.current_search_results.length) return;
    
    keys.search_selection += inc;
    
    if (keys.search_selection < 0) {
      keys.search_selection = -1;
      // Return focus to search input
      const searchInput = document.getElementById('channel-search-input');
      if (searchInput) {
        searchInput.focus();
      }
      return;
    }
    
    if (keys.search_selection >= this.current_search_results.length) {
      keys.search_selection = this.current_search_results.length - 1;
    }
    
    this.highlightSearchResult(keys.search_selection);
  },

  handleMenuLeftRight: function (inc) {
    const keys = this.keys;

    switch (keys.focused_part) {
      case "category_selection":
        if (inc > 0) { if (this.movies && this.movies.length) this.hoverChannel(keys.channel_selection); }
        else {
          if (typeof top_menu_page !== "undefined" && typeof top_menu_page.hoverMenuItem === "function") {
            this.Exit();
            top_menu_page.hoverMenuItem(top_menu_page.keys.menu_selection);
          }
        }
        break;

      case "channel_selection":
        if (inc < 0) this.hoverCategory(keys.category_selection);
        else {
          if (this.top_menu_doms && this.top_menu_doms.length) this.hoverTopMenu(0);
          else {
            this.top_menu_doms = $(SELECTORS.topMenuBtns);
            if (this.top_menu_doms.length) this.hoverTopMenu(0);
          }
        }
        break;

      case "top_menu_selection":
        keys.top_menu_selection += inc;
        if (keys.top_menu_selection < 0) keys.top_menu_selection = this.top_menu_doms.length - 1;
        if (keys.top_menu_selection >= this.top_menu_doms.length) keys.top_menu_selection = 0;
        this.hoverTopMenu(keys.top_menu_selection);
        break;
    }
  },

  goBack: function () {
    const keys = this.keys;
    switch (keys.focused_part) {
      case "video_control":
        $(SELECTORS.fsInfo).slideUp(); keys.focused_part = "full_screen"; break;
      case "full_screen": {
        const disp = $(SELECTORS.fsInfo).css("display");
        if (disp === "block") { clearTimeout(this.full_screen_timer); this.hideFullScreenInfo(); }
        else { this.full_screen_video = false; this.zoomInOut(); }
        break;
      }
      case "search_selection": this.removeSearchResult(); break;
      case "channel_selection":
      case "category_selection":
      case "top_menu_selection": this.Exit(); break;
    }
  },

  showSearchModal: function () { this.toggleModernSearch(); },
  searchMovie:      function () { this.toggleModernSearch(); },

  handleSearchItem: function (inc) {
    const keys = this.keys;

    if ($(SELECTORS.searchPanel).hasClass("active")) return this.handleModernSearchNavigation(inc);

    if (!this.filtered_search_results || !this.filtered_search_results.length) return;

    keys.search_selection += inc;
    $(".search-item-wrapper").removeClass("active");

    if (keys.search_selection < 0) {
      keys.search_selection = -1;
      $("#search-value").focus();
      setTimeout(function () {
        const tmp = $("#search-value").val();
        if (tmp && $("#search-value")[0].setSelectionRange) $("#search-value")[0].setSelectionRange(tmp.length, tmp.length);
      }, 200);
      return;
    }

    $("#search-value").blur();

    if (keys.search_selection >= this.filtered_search_results.length) keys.search_selection = this.filtered_search_results.length - 1;

    if (keys.search_selection >= 0) {
      const items = $(".search-item-wrapper");
      if (items[keys.search_selection]) {
        $(items[keys.search_selection]).addClass("active");
        try { moveScrollPosition($(".search-content-container")[0], items[keys.search_selection], "vertical", false); } catch (e) {}
      }
    }
  },

  handleModernSearchNavigation: function (inc) {
    const keys = this.keys;
    if (!this.current_search_results || !this.current_search_results.length) return;

    keys.search_selection += inc;

    if (keys.search_selection < 0) {
      keys.search_selection = -1;
      keys.focused_part = "search_input";
      $(SELECTORS.searchInput).focus();
      $(".modern-search-item").removeClass("highlighted");
      return;
    }
    if (keys.search_selection >= this.current_search_results.length) keys.search_selection = this.current_search_results.length - 1;
    this.highlightSearchResult(keys.search_selection);
  },

  removeSearchResult: function () {
    $(SELECTORS.searchPanel).removeClass("active");
    $(SELECTORS.searchResults).html("");
    this.keys.focused_part = this.keys.prev_focus || "channel_selection";
    this.keys.search_selection = -1;
    this.search_channels = [];
    this.filtered_search_results = [];
    this.current_search_results = [];
  },

  /* ────────────────────────────────────────────────────────────────
     #7 KEY HANDLER (Komanda: Sağ / Sol / Orta)
     ──────────────────────────────────────────────────────────────── */
  HandleKey: function (e) {
    // Handle search modal first
    if (this.keys.focused_part === "search_modal") {
      if (e.keyCode === tvKey.RETURN || e.keyCode === 27 || e.keyCode === 8 || e.keyCode === 10009 || e.keyCode === 10182) {
        this.closeSearchModal();
        return;
      } else if (e.keyCode === tvKey.DOWN || e.keyCode === 2) {
        this.handleSearchModalNavigation(1);
        return;
      } else if (e.keyCode === tvKey.UP || e.keyCode === 1) {
        this.handleSearchModalNavigation(-1);
        return;
      } else if (e.keyCode === tvKey.ENTER || e.keyCode === 29443) {
        if (this.keys.search_selection >= 0 && this.current_search_results && this.current_search_results[this.keys.search_selection]) {
          this.selectSearchResult(this.keys.search_selection);
        }
        return;
      }
    }
    
    switch (e.keyCode) {
      case tvKey.RIGHT: this.handleMenuLeftRight(1); break;
      case tvKey.LEFT:  this.handleMenuLeftRight(-1); break;
      case tvKey.DOWN:  this.handleMenusUpDown(1); break;
      case tvKey.UP:    this.handleMenusUpDown(-1); break;
      case tvKey.ENTER: this.handleMenuClick(); break;
      case tvKey.CH_UP:   this.bulkMove(-1); break;
      case tvKey.CH_DOWN: this.bulkMove(1); break;
      case tvKey.RETURN:  this.goBack(); break;
      case tvKey.YELLOW:  this.addOrRemoveFav(); break;
      case tvKey.N1: this.goChannelNum(1); break;
      case tvKey.N2: this.goChannelNum(2); break;
      case tvKey.N3: this.goChannelNum(3); break;
      case tvKey.N4: this.goChannelNum(4); break;
      case tvKey.N5: this.goChannelNum(5); break;
      case tvKey.N6: this.goChannelNum(6); break;
      case tvKey.N7: this.goChannelNum(7); break;
      case tvKey.N8: this.goChannelNum(8); break;
      case tvKey.N9: this.goChannelNum(9); break;
      case tvKey.N0: this.goChannelNum(0); break;
      case tvKey.PAUSE:
      case tvKey.PLAY:
      case tvKey.PLAYPAUSE: this.playOrPause(); break;
      case tvKey.BLUE: this.showSearchModal(); break;
      case tvKey.RED:  this.goToSettingsPage(); break;
    }
  },

  /* ────────────────────────────────────────────────────────────────
     #8 MEMORY CLEANUP
     ──────────────────────────────────────────────────────────────── */
  cleanupMemory: function () {
    try {
      if (this.progressbar_timer)   { clearInterval(this.progressbar_timer);   this.progressbar_timer = null; }
      if (this.full_screen_timer)   { clearTimeout(this.full_screen_timer);    this.full_screen_timer = null; }
      if (this.fullscreen_epg_timer){ clearTimeout(this.fullscreen_epg_timer); this.fullscreen_epg_timer = null; }
      if (this.channel_hover_timer) { clearTimeout(this.channel_hover_timer);  this.channel_hover_timer = null; }
      if (this.category_hover_timer){ clearTimeout(this.category_hover_timer); this.category_hover_timer = null; }
      if (this.next_programme_timer){ clearInterval(this.next_programme_timer);this.next_programme_timer = null; }
      if (this.search_debounce_timer){clearTimeout(this.search_debounce_timer);this.search_debounce_timer = null; }

      this.movies = [];
      this.search_items = [];
      this.filtered_search_results = [];
      this.current_search_results = [];
      this.programmes = [];

      this.category_doms = [];
      this.channel_doms = [];

      $(".channel-menu-item").off();
      $(".search-item-wrapper").off();
      $(".category-menu-item").off();
      $(SELECTORS.searchInput).off();
      $("#search-value").off();
    } catch (err) { console.error("cleanupMemory:", err); }
  },

  onPageExit: function () {
    this.cleanupMemory();
    if (typeof MemoryOptimizer !== "undefined" && MemoryOptimizer.onPageChange) MemoryOptimizer.onPageChange();
  },

  /* ────────────────────────────────────────────────────────────────
     #9 DEV TEST HARNESS (optional – no DOM required)
     ──────────────────────────────────────────────────────────────── */
  __devTest: function () {
    if (!DEV_MODE) return;

    // stub list and categories (no DOM usage)
    this.categories = [
      { category_id: "all", category_name: "All", movies: [
        { name: "News One", stream_id: 1, stream_icon: "" },
        { name: "Movie Max", stream_id: 2, stream_icon: "" },
        { name: "Sport HD",  stream_id: 3, stream_icon: "" }
      ] }
    ];
    this.keys.category_selection = 0;
    this.movies = this.categories[0].movies.slice(0);
    this.search_channels = this.movies.map((m, j) => ({...m, category_name:"All", category_index:0, channel_index:j}));

    // search test
    this.performModernSearch("mo");
    console.log("[TEST] search results:", this.current_search_results.map(x=>x.name));

    // command (right/left/enter) test – only logical updates
    this.channel_doms = new Array(this.movies.length); // length checks
    this.hoverChannel(0);
    this.handleMenuLeftRight(1); // move to top menu if exists; otherwise kept
    this.keys.focused_part = "channel_selection";
    this.handleMenusUpDown(1);   // move down
    console.log("[TEST] focus channel index:", this.keys.channel_selection);
  },

  /* ────────────────────────────────────────────────────────────────
     NAVIGATION FUNCTIONS - Added for Action Buttons
     ──────────────────────────────────────────────────────────────── */
  
  // Navigate to Homepage
  goToHomepage: function() {
    console.log('Navigating to homepage from channel page');
    try {
      // Close channel page properly
      $(SELECTORS.root).addClass("hide");
      if (this.progressbar_timer) clearInterval(this.progressbar_timer);
      if (this.full_screen_timer) clearTimeout(this.full_screen_timer);
      if (this.next_channel_timer) clearTimeout(this.next_channel_timer);
      
      // Stop media player
      try { 
        if (typeof media_player !== 'undefined' && media_player.close) {
          media_player.close(); 
        }
      } catch (e) {}
      
      // Navigate to home page
      $("#home-page").removeClass('hide');
      current_route = "home-page";
      
      // Initialize home page
      if (typeof home_operation !== 'undefined' && home_operation.reEnter) {
        home_operation.reEnter();
      } else if (typeof home_page !== 'undefined' && home_page.reEnter) {
        home_page.reEnter();
      }
      
      // Reset focus
      this.keys.focused_part = "category_selection";
      this.full_screen_video = false;
      
    } catch (error) {
      console.error('Error navigating to homepage:', error);
    }
  },

  // Navigate to Movies Page
  goToMoviesPage: function() {
    console.log('Navigating to movies page from channel page');
    try {
      // Close channel page properly
      $(SELECTORS.root).addClass("hide");
      if (this.progressbar_timer) clearInterval(this.progressbar_timer);
      if (this.full_screen_timer) clearTimeout(this.full_screen_timer);
      if (this.next_channel_timer) clearTimeout(this.next_channel_timer);
      
      // Stop media player
      try { 
        if (typeof media_player !== 'undefined' && media_player.close) {
          media_player.close(); 
        }
      } catch (e) {}
      
      // Navigate to VOD page with movies
      $("#vod-series-page").removeClass('hide');
      current_route = "vod-series-page";
      
      // Initialize movies page
      if (typeof vod_series_page !== 'undefined' && vod_series_page.init) {
        vod_series_page.init('vod');
      } else if (typeof vod_operation !== 'undefined' && vod_operation.reEnter) {
        vod_operation.reEnter('movie');
      }
      
      // Reset focus
      this.keys.focused_part = "category_selection";
      this.full_screen_video = false;
      
    } catch (error) {
      console.error('Error navigating to movies page:', error);
    }
  },

  // Navigate to Series Page
  goToSeriesPage: function() {
    console.log('Navigating to series page from channel page');
    try {
      // Close channel page properly
      $(SELECTORS.root).addClass("hide");
      if (this.progressbar_timer) clearInterval(this.progressbar_timer);
      if (this.full_screen_timer) clearTimeout(this.full_screen_timer);
      if (this.next_channel_timer) clearTimeout(this.next_channel_timer);
      
      // Stop media player
      try { 
        if (typeof media_player !== 'undefined' && media_player.close) {
          media_player.close(); 
        }
      } catch (e) {
        console.warn('Media player close error:', e);
      }
      
      // Check if series page exists
      if ($("#vod-series-page").length === 0) {
        console.error('vod-series-page element not found in DOM');
        return;
      }
      
      // Navigate to Series page
      $("#vod-series-page").removeClass('hide');
      current_route = "vod-series-page";
      
      // Initialize series page with better error handling
      setTimeout(() => {
        try {
          if (typeof vod_series_page !== 'undefined' && vod_series_page.init) {
            console.log('Initializing vod_series_page with series type');
            vod_series_page.init('series');
          } else if (typeof vod_operation !== 'undefined' && vod_operation.reEnter) {
            console.log('Falling back to vod_operation.reEnter');
            vod_operation.reEnter('series');
          } else {
            console.error('Neither vod_series_page nor vod_operation is available');
          }
        } catch (initError) {
          console.error('Error during series page initialization:', initError);
        }
      }, 100);
      
      // Reset focus
      this.keys.focused_part = "category_selection";
      this.full_screen_video = false;
      
    } catch (error) {
      console.error('Error navigating to series page:', error);
    }
  },

  // Add or Remove from Favorites
  addOrRemoveFav: function() {
    console.log('Toggle favorite for current channel');
    try {
      const currentChannel = this.movies[this.keys.channel_selection];
      if (!currentChannel) {
        console.log('No current channel selected');
        return;
      }

      console.log('Current channel:', currentChannel.name);
      
      // Get favorites from storage
      let favorites = [];
      try {
        const storedFavorites = localStorage.getItem(storage_id + '_favorites');
        if (storedFavorites) {
          favorites = JSON.parse(storedFavorites);
        }
      } catch (e) {
        console.log('No existing favorites found');
      }

      // Check if already in favorites
      const existingIndex = favorites.findIndex(fav => 
        fav.stream_url === currentChannel.stream_url || 
        fav.name === currentChannel.name
      );

      if (existingIndex !== -1) {
        // Remove from favorites
        favorites.splice(existingIndex, 1);
        console.log('Removed from favorites:', currentChannel.name);
        
        // Update UI
        const favoriteBtn = document.querySelector('.favorite-btn');
        if (favoriteBtn) {
          favoriteBtn.classList.remove('active');
        }
        
        // Show notification
        if (typeof showToast === 'function') {
          showToast(STRINGS.removedFromFavorites(), 'info');
        }
        
      } else {
        // Add to favorites
        const favoriteChannel = {
          name: currentChannel.name,
          stream_url: currentChannel.stream_url,
          logo: currentChannel.logo || currentChannel.stream_icon,
          category_id: currentChannel.category_id,
          added_date: Date.now()
        };
        
        favorites.unshift(favoriteChannel); // Add to beginning
        console.log('Added to favorites:', currentChannel.name);
        
        // Update UI
        const favoriteBtn = document.querySelector('.favorite-btn');
        if (favoriteBtn) {
          favoriteBtn.classList.add('active');
        }
        
        // Show notification
        if (typeof showToast === 'function') {
          showToast(STRINGS.addedToFavorites(), 'success');
        }
      }

      // Save to storage
      localStorage.setItem(storage_id + '_favorites', JSON.stringify(favorites));
      
      // Update favorite button state
      this.updateFavoriteButtonState(currentChannel);
      
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  },

  // Update favorite button visual state
  updateFavoriteButtonState: function(channel) {
    try {
      const favoriteBtn = document.querySelector('.favorite-btn');
      if (!favoriteBtn || !channel) return;

      // Get favorites from storage
      let favorites = [];
      try {
        const storedFavorites = localStorage.getItem(storage_id + '_favorites');
        if (storedFavorites) {
          favorites = JSON.parse(storedFavorites);
        }
      } catch (e) {
        // No favorites
      }

      // Check if current channel is in favorites
      const isFavorite = favorites.some(fav => 
        fav.stream_url === channel.stream_url || 
        fav.name === channel.name
      );

      // Update button state
      if (isFavorite) {
        favoriteBtn.classList.add('active');
      } else {
        favoriteBtn.classList.remove('active');
      }

    } catch (error) {
      console.error('Error updating favorite button state:', error);
    }
  },

  // Hide Channel Info Modal
  hideChannelInfoModal: function() {
    console.log('Hiding channel info modal');
    try {
      const modal = document.querySelector('.channel-info-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
      }
      
      // Resume video if it was paused
      if (typeof media_player !== 'undefined' && media_player.play) {
        media_player.play();
      }
      
    } catch (error) {
      console.error('Error hiding channel info modal:', error);
    }
  }
};