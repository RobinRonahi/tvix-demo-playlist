"use strict";

/**
 * VOD / Series Grid Page
 * - Samsung TV (Tizen) uyumlu klavye/uzaktan kumanda navigasyonu
 * - Evrensel ok/enter fallback (37/38/39/40/13, 8, 10009)
 * - Akıcı sonsuz scroll ve batch render
 * - Emoji kaldırıldı (ikonlar korunur)
 */

var vod_series_page = (function () {

  // ------------------------------
  // CONSTANTS & KEYCODES
  // ------------------------------
  var RENDER_BATCH = 120;
  var SEARCH_DEBOUNCE_MS = 300;
  var CATEGORY_HOVER_DELAY = 300;
  var GRID_COLUMNS = 5;

  // Key fallback (tvKey yoksa)
  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACKSPACE: 8, TIZEN_BACK: 10009
  };

  // ------------------------------
  // STATE
  // ------------------------------
  var state = {
    initiated: false,
    isDrawing: false,
    currentMovieType: "movie",   // 'vod' | 'series' | 'movie'
    sortKey: "vod_sort",

    categories: [],
    categoryDoms: [],
    menuDoms: [],
    movies: [],
    currentRenderCount: 0,

    currentCategory: null,
    currentCategoryIndex: -1,
    currentCategoryName: "",

    selectedMovie: null,
    selectedMovieIndex: -1,
    lastSelectedCategory: -1,
    lastSelectedMovie: -1,
    lastWatchedSeries: null,

    prevKeyword: "",

    // key focus
    keys: {
      focused_part: "category_selection",
      category_selection: 0,
      menu_selection: 0,
      video_control: 0,
      top_menu_selection: 0,
      detail_panel_selection: 0,
      columns: GRID_COLUMNS
    },

    timers: {
      categoryHover: null,
      searchDebounce: null,
      navDelay: null,
      gridResize: null
    }
  };

  // Dış DOM referansları (tek sefer)
  var $cats = $("#vod-series-categories-container");
  var $grid = $("#vod-series-menus-container");
  var $search = $("#vod-series-search-input");
  var $stats = $(".vod-series-content-stats");
  var $title = $("#vod-series-current-category");
  var $topMenuItems = $(".vod-series-top-menu-item");

  var prevFocusDom = null;

  // ------------------------------
  // INIT - HIZLANDIRILMIŞ VERSİYON
  // ------------------------------
  function init(movie_type) {
    console.log("[VOD Series] init (optimized):", movie_type);
    
    // Hızlı UI güncellemeleri
    $("#home-mac-address-container").hide();
    $("#home-page").addClass("hide");
    $("#vod-series-page").removeClass("hide");
    $(".main-logo-container").hide();
    $("#main-menu-container").hide();
    
    // Force-hide home bottom bar
    try { 
      var el = document.getElementById('home-mac-address-container'); 
      if (el) el.style.display = 'none'; 
    } catch(_) {}
    
    // Route güncelle
    try { 
      if (typeof updateRoute === 'function') updateRoute('vod-series-page', 'category_selection'); 
    } catch(_) {}

    // Temel state güncellemesi
    state.currentMovieType = movie_type;
    
    // Asenkron yükleme ile performans artırımı
    requestAnimationFrame(function() {
      try {
        // Dependencies kontrolü
        if (typeof LanguageManager === "undefined" ||
            typeof VodModel === "undefined" ||
            typeof SeriesModel === "undefined") {
          console.error("Required dependencies missing.");
          return false;
        }

        // Kategori yükleme (optimize)
        try {
          if (movie_type === "vod") {
            state.sortKey = "vod_sort";
            state.categories = VodModel.getCategories(false, true) || [];
          } else {
            state.sortKey = "series_sort";  
            state.categories = SeriesModel.getCategories(false, true) || [];
          }
        } catch (e) {
          console.error("Kategori yükleme hatası:", e);
          state.categories = [];
        }

        console.log("[VOD Series] Loaded categories:", state.categories.length);
        
        // UI çizimi asenkron devam et
        setupStaticTexts();
        finishInit();
        
      } catch (e) {
        console.error("VOD Series init error:", e);
      }
    });
    
    return true;
  }
  
  function finishInit() {

    // “All” kategorisi + son gelenler
    var recentlyAddedMovies = [];
    try {
      var allMovies =
        state.currentMovieType === "vod" ? VodModel.getAllMovies() : SeriesModel.getAllMovies();
      allMovies = sortMoviesByTSE(allMovies);

      recentlyAddedMovies = getRecentMoviesFrom(allMovies, state.categories, 200);

      var allCategory = {
        category_id: "all",
        category_name: LanguageManager.getText("all_category"),
        movies: allMovies
      };
      state.categories.unshift(allCategory);
    } catch (e) {
      console.error("Film yükleme hatası:", e);
      state.categories = [{
        category_id: "all",
        category_name: "All",
        movies: []
      }];
      recentlyAddedMovies = [];
    }

    // Kategori yan menüsünü çiz
    drawCategories();

    // Başlangıç görünümü (son eklenenler)
    state.currentRenderCount = 0;
    state.movies = recentlyAddedMovies.slice(0, 200);
    state.currentCategoryIndex = -1;
    state.currentCategory = state.categories[0];
    state.currentCategoryName = "all";
    $title.text(LanguageManager.getText("latest_uploads") || "Latest Uploads");
    $stats.text("200 " + (LanguageManager.getText("content_count") || "items"));

    // Grid’i çiz
    try {
      renderCategoryContent();
    } catch (e) {
      console.error("İçerik çizim hatası:", e);
    }

    bindScrollEvents();

    // Dinamik kolon sayısını ekran boyutuna göre hesapla
    $(window).off('resize.vodGrid').on('resize.vodGrid', function(){
      clearTimeout(state.timers.gridResize);
      state.timers.gridResize = setTimeout(recalcGridColumns, 120);
    });

    // initiated hemen aktif (Tizen’de bazı zamanlayıcılar gecikebilir)
    state.initiated = true;

    // Seçili/odak temizliği
    hideDetailPanel();

    console.log("[VOD Series] init completed");
    return true;
  }

  // ------------------------------
  // EVENT BINDINGS
  // ------------------------------
  function bindScrollEvents() {
    // Sonsuz scroll
    $grid.off("scroll.vodScroll").on("scroll.vodScroll", function () {
      var st = $(this).scrollTop();
      var sh = this.scrollHeight;
      var ch = $(this).height();
      if (st + ch >= sh - 400) {
        if (state.currentRenderCount < state.movies.length && !state.isDrawing) {
          renderCategoryContent();
        }
      }
    });

    // Fare tekeri → sadece aktif bölümü scroll et
    $(document).off("wheel.vodWheel").on("wheel.vodWheel", function (e) {
      if ($("#vod-series-page").hasClass("hide")) return;
      var dy = e.originalEvent.deltaY;
      
      // Sadece aktif bölümün scroll olmasını sağla
      if (state.keys.focused_part === "category_selection") {
        handleCategoryScroll(dy > 0 ? 1 : -1);
      } else if (state.keys.focused_part === "menu_selection") {
        handleMovieScroll(dy > 0 ? 1 : -1);
      }
      e.preventDefault();
    });
  }

  // Dış dünyaya tek bir key handler bağla
  function HandleKey(e) {
    if (state.isDrawing) return;

    // tvKey yoksa fallback
    if (typeof tvKey === "undefined") {
      switch (e.keyCode) {
        case KEY.RIGHT: return navigateRight();
        case KEY.LEFT:  return navigateLeft();
        case KEY.DOWN:  return navigateDown();
        case KEY.UP:    return navigateUp();
        case KEY.ENTER: return pressEnter();
        case KEY.BACKSPACE:
        case KEY.TIZEN_BACK:
          if (state.keys.focused_part === "detail_panel") hideDetailPanel();
          else goBackToCategory();
          return;
      }
    }

    // tvKey mevcutsa eski harita devam
    switch (e.keyCode) {
      case 65376: // IME/OK varyantları
      case 65385:
        $("input").blur();
        break;

      case tvKey.RIGHT:
      case tvKey.RIGHT_ALT: // Some Samsung remotes send 4
        if (state.keys.focused_part === "detail_panel") handleDetailPanelNavigation(1);
        else handleMenuLeftRight(1);
        break;

      case tvKey.LEFT:
      case tvKey.LEFT_ALT: // Some Samsung remotes send 3
        if (state.keys.focused_part === "detail_panel") handleDetailPanelNavigation(-1);
        else handleMenuLeftRight(-1);
        break;

      case tvKey.DOWN:
      case tvKey.DOWN_ALT: // Some Samsung remotes send 2
        if (state.keys.focused_part !== "detail_panel") {
          // Sadece aktif bölümü scroll et
          if (state.keys.focused_part === "category_selection") {
            handleCategoryScroll(1);
          } else if (state.keys.focused_part === "menu_selection") {
            handleMovieScroll(1);
          }
        }
        break;

      case tvKey.UP:
      case tvKey.UP_ALT: // Some Samsung remotes send 1
        if (state.keys.focused_part !== "detail_panel") {
          // Sadece aktif bölümü scroll et
          if (state.keys.focused_part === "category_selection") {
            handleCategoryScroll(-1);
          } else if (state.keys.focused_part === "menu_selection") {
            handleMovieScroll(-1);
          }
        }
        break;

      case tvKey.ENTER:
        if (state.keys.focused_part === "detail_panel") handleDetailPanelClick();
        else if (state.keys.focused_part === "menu_selection" && state.menuDoms[state.keys.menu_selection]) selectMovie(state.keys.menu_selection);
        else handleMenuClick();
        break;

      case tvKey.CH_UP:   if (typeof showNextChannel === "function") showNextChannel(1); break;
      case tvKey.CH_DOWN: if (typeof showNextChannel === "function") showNextChannel(-1); break;

      case tvKey.RETURN:
        if (state.keys.focused_part === "detail_panel") hideDetailPanel();
        else goBackToCategory();
        break;

      case tvKey.YELLOW:
        addOrRemoveFav();
        break;

      case tvKey.N1: if (typeof goChannelNum === "function") goChannelNum(1); break;
      case tvKey.N2: if (typeof goChannelNum === "function") goChannelNum(2); break;
      case tvKey.N3: if (typeof goChannelNum === "function") goChannelNum(3); break;
      case tvKey.N4: if (typeof goChannelNum === "function") goChannelNum(4); break;
      case tvKey.N5: if (typeof goChannelNum === "function") goChannelNum(5); break;
      case tvKey.N6: if (typeof goChannelNum === "function") goChannelNum(6); break;
      case tvKey.N7: if (typeof goChannelNum === "function") goChannelNum(7); break;
      case tvKey.N8: if (typeof goChannelNum === "function") goChannelNum(8); break;
      case tvKey.N9: if (typeof goChannelNum === "function") goChannelNum(9); break;
      case tvKey.N0: if (typeof goChannelNum === "function") goChannelNum(0); break;

      case tvKey.PAUSE: if (typeof playOrPause === "function") playOrPause(); break;

      default: // no-op
        break;
    }
  }

  // Kısayol fonksiyonları (dıştan da çağrılabilir)
  function navigateDown() { 
    // Sadece aktif bölümü scroll et
    if (state.keys.focused_part === "category_selection") {
      handleCategoryScroll(1);
    } else if (state.keys.focused_part === "menu_selection") {
      handleMovieScroll(1);
    }
  }
  function navigateUp() { 
    // Sadece aktif bölümü scroll et
    if (state.keys.focused_part === "category_selection") {
      handleCategoryScroll(-1);
    } else if (state.keys.focused_part === "menu_selection") {
      handleMovieScroll(-1);
    }
  }
  function navigateRight() { handleMenuLeftRight(1); }
  function navigateLeft() { handleMenuLeftRight(-1); }
  function pressEnter() {
    if (state.keys.focused_part === "detail_panel") handleDetailPanelClick();
    else if (state.keys.focused_part === "menu_selection" && state.menuDoms[state.keys.menu_selection]) selectMovie(state.keys.menu_selection);
    else handleMenuClick();
  }

  // ------------------------------
  // UI SETUP
  // ------------------------------
  function setupStaticTexts() {
    var pageTitle = (state.currentMovieType === "vod")
      ? LanguageManager.getText("movies", "Movies")
      : LanguageManager.getText("series", "Series");
    $title.text(pageTitle);
    $search.attr("placeholder", LanguageManager.getText("search_placeholder"));
    if (window.LanguageManager && typeof LanguageManager.updateTexts === "function") {
      LanguageManager.updateTexts();
    }
  }

  function drawCategories() {
    var html = "";
    state.categories.forEach(function (item, index) {
      var cls = (item.category_id === "all")
        ? "vod-series-category-item bg-focus-1 all-category"
        : "vod-series-category-item bg-focus-1";
      html +=
        '<div class="' + cls + '" data-index="' + index + '"' +
        ' onmouseenter="vod_series_page.hoverCategory(this)"' +
        ' onclick="vod_series_page.handleMenuClick()">' +
        '  <span class="category-name">' + (item.category_name || "—") + "</span>" +
        '  <span class="category-movie-count">' + ((item.movies && item.movies.length) || 0) + "</span>" +
        "</div>";
    });
    $cats.html(html);
    state.categoryDoms = $(".vod-series-category-item");

    // İlk fokus
    state.keys.focused_part = "category_selection";
    state.keys.category_selection = 0;
    if (state.categoryDoms.length > 0) {
      $(state.categoryDoms[0]).addClass("active");
      prevFocusDom = state.categoryDoms[0];
    }
  }

  // Ensure category DOMs are initialized properly
  state.categoryDoms = $("#vod-series-categories-container .vod-series-category-item");
  if (!state.categoryDoms.length) {
    console.warn("No categories found in #vod-series-categories-container");
  }

  // Fallback: Display message if no categories are found
  if (!state.categories.length) {
    $cats.html('<div class="no-categories">No categories available</div>');
  } else {
    // Render categories into the container
    state.categories.forEach(function(category) {
      var categoryHtml = '<div class="vod-series-category-item">' +
                         '<span class="category-name">' + category.name + '</span>' +
                         '</div>';
      $cats.append(categoryHtml);
    });
  }

  // ------------------------------
  // NAVIGATION (CATEGORIES & GRID)
  // ------------------------------
  function handleMenusUpDown(increment) {
    var k = state.keys, cols = k.columns;
    $search.blur();

    switch (k.focused_part) {
      case "category_selection": {
        k.category_selection += increment;
        if (k.category_selection < 0) { k.category_selection = 0; return; }
        if (k.category_selection >= state.categoryDoms.length) { k.category_selection = state.categoryDoms.length - 1; return; }

        scrollCategoryIntoView(k.category_selection);
        hoverCategory(state.categoryDoms[k.category_selection]);

                // Kategoriler arası geçiş - sadece kategori scroll
        // Kategoriler arası geçiş - otomatik grid geçiş kaldırıldı
        break;
      }

      case "menu_selection": {
        var newSel = k.menu_selection + (cols * increment);

        if (increment < 0 && newSel < 0) {
          k.focused_part = "category_selection";
          hoverCategory(state.categoryDoms[k.category_selection]);
          return;
        }

        if (newSel >= state.menuDoms.length) {
          if (state.currentRenderCount < state.movies.length) {
            renderCategoryContent();
            state.menuDoms = $("#vod-series-menus-container .vod-series-menu-item-container");
          }
          newSel = Math.min(newSel, state.menuDoms.length - 1);
        }
        if (newSel < 0) newSel = 0;

        k.menu_selection = newSel;

        // Proaktif batch yükleme
        if (k.menu_selection >= state.currentRenderCount - (cols * 2) &&
            state.currentRenderCount < state.movies.length && !state.isDrawing) {
          setTimeout(renderCategoryContent, 50);
        }

        hoverMovieItem(state.menuDoms[k.menu_selection]);
        scrollMovieIntoView(k.menu_selection);
        break;
      }
    }
  }

  // Sadece kategori scroll fonksiyonu
  function handleCategoryScroll(increment) {
    var k = state.keys;
    if (k.focused_part !== "category_selection") return;
    
    k.category_selection += increment;
    if (k.category_selection < 0) { k.category_selection = 0; return; }
    if (k.category_selection >= state.categoryDoms.length) { k.category_selection = state.categoryDoms.length - 1; return; }

    scrollCategoryIntoView(k.category_selection);
    hoverCategory(state.categoryDoms[k.category_selection]);
  }

  // Sadece film scroll fonksiyonu
  function handleMovieScroll(increment) {
    var k = state.keys, cols = k.columns;
    if (k.focused_part !== "menu_selection") return;
    
    var newSel = k.menu_selection + (cols * increment);

    if (newSel >= state.menuDoms.length) {
      if (state.currentRenderCount < state.movies.length) {
        renderCategoryContent();
        state.menuDoms = $("#vod-series-menus-container .vod-series-menu-item-container");
      }
      newSel = Math.min(newSel, state.menuDoms.length - 1);
    }
    if (newSel < 0) newSel = 0;

    k.menu_selection = newSel;

    // Proaktif batch yükleme
    if (k.menu_selection >= state.currentRenderCount - (cols * 2) &&
        state.currentRenderCount < state.movies.length && !state.isDrawing) {
      setTimeout(renderCategoryContent, 50);
    }

    hoverMovieItem(state.menuDoms[k.menu_selection]);
    scrollMovieIntoView(k.menu_selection);
  }

  function handleMenuLeftRight(increment) {
    var k = state.keys, cols = k.columns;
    $search.blur();

    clearTimeout(state.timers.navDelay);
    state.timers.navDelay = setTimeout(function () {
      switch (k.focused_part) {
        case "category_selection":
          if (increment > 0 && state.movies.length > 0) {
            k.focused_part = "menu_selection";
            if (k.menu_selection >= state.menuDoms.length) k.menu_selection = 0;
            hoverMovieItem(state.menuDoms[k.menu_selection]);
            scrollMovieIntoView(k.menu_selection);
          }
          break;

        case "menu_selection": {
          if (increment < 0) {
            var current_col = k.menu_selection % cols;
            if (current_col === 0) {
              k.focused_part = "category_selection";
              hoverCategory(state.categoryDoms[k.category_selection]);
              return;
            }
          }

          var ns = k.menu_selection + increment;

          if (increment > 0 && ns >= state.menuDoms.length) {
            if (state.currentRenderCount < state.movies.length) {
              renderCategoryContent();
              state.menuDoms = $("#vod-series-menus-container .vod-series-menu-item-container");
            }
          }
          if (ns >= state.menuDoms.length) ns = state.menuDoms.length - 1;
          if (ns < 0) ns = 0;

          k.menu_selection = ns;
          hoverMovieItem(state.menuDoms[k.menu_selection]);

          if (increment > 0 &&
              k.menu_selection >= state.currentRenderCount - (cols + 3) &&
              state.currentRenderCount < state.movies.length &&
              !state.isDrawing) {
            setTimeout(renderCategoryContent, 100);
          }
          break;
        }
      }
    }, 40);
  }

  function hoverCategory(el) {
    var k = state.keys;
    var index = $(el).data("index");
    k.focused_part = "category_selection";
    k.category_selection = index;

    if (prevFocusDom) $(prevFocusDom).removeClass("active");
    $(state.categoryDoms[index]).addClass("active");
    prevFocusDom = state.categoryDoms[index];

    if (state.initiated) scrollCategoryIntoView(index);

    clearTimeout(state.timers.categoryHover);
    state.timers.categoryHover = setTimeout(function () {
      var cat = state.categories[k.category_selection];
      var is_adult = checkForAdult(cat, "category", []);
      if (is_adult) { parent_confirm_page.init("vod-series-page"); return; }
      showCategoryContent();
    }, CATEGORY_HOVER_DELAY);
  }

  function hoverMovieItem(el) {
    var index = $(el).data("index");
    var k = state.keys;
    k.focused_part = "menu_selection";
    k.menu_selection = index;

    if (prevFocusDom) $(prevFocusDom).removeClass("active");
    if (state.menuDoms[index]) {
      $(state.menuDoms[index]).addClass("active");
      prevFocusDom = state.menuDoms[index];
    }

    if (state.initiated) scrollMovieIntoView(k.menu_selection);
    updateMovieStats();
  }

  function handleMenuClick() {
    var k = state.keys;
    switch (k.focused_part) {
      case "menu_selection":
        selectMovie(k.menu_selection);
        break;

      case "top_menu_selection":
        if (k.top_menu_selection === 0) {
          if (window.show_keyboard) $search.blur();
          else searchMovie();
        }
        break;

      case "category_selection": {
        var cat = state.categories[k.category_selection];
        if (state.currentCategoryIndex === k.category_selection) return;
        var is_adult = checkForAdult(cat, "category", []);
        if (is_adult) { parent_confirm_page.init("vod-series-page"); return; }
        showCategoryContent();
        break;
      }
    }
  }

  // ------------------------------
  // CATEGORY / GRID RENDER
  // ------------------------------
  function showCategoryContent() {
    var k = state.keys;
    var category = state.categories[k.category_selection];
    if (!category) return;

    // State güncelle
    state.currentCategoryIndex = k.category_selection;
    state.currentCategory = category;
    state.currentCategoryName = category.category_id;

    state.prevKeyword = "";
    $search.val("");

    var newMovies = [], title = "", stats = "";

    if (k.category_selection === 0) {
      // All
      var all = (state.currentMovieType === "vod") ? VodModel.getAllMovies() : SeriesModel.getAllMovies();
      newMovies = sortMoviesByTSE(all);
      title = LanguageManager.getText("all_movies");
      stats = newMovies.length + " " + LanguageManager.getText("content_count");
    } else {
      newMovies = category.movies ? sortMoviesByTSE(category.movies.slice()) : [];
      title = category.category_name;
      stats = newMovies.length + " " + LanguageManager.getText("content_count");
    }

    $title.text(title);
    $stats.text(stats);

    showLoader(true);
    $grid.css("opacity", "0.3");

    setTimeout(function () {
      state.currentRenderCount = 0;
      state.movies = newMovies;
      $grid.html("");
      renderCategoryContent();
      $grid.scrollTop(0);
      setTimeout(function () {
        $grid.css("opacity", "1");
        showLoader(false);
      }, 50);
    }, 50);

    k.menu_selection = 0;
  }

  function renderCategoryContent() {
    if (state.currentRenderCount >= state.movies.length) return;

    state.isDrawing = true;
    $grid.addClass("loading");
    showLoader(true);

    setTimeout(function () {
      state.isDrawing = false;
      $grid.removeClass("loading").addClass("loaded");
      showLoader(false);
    }, 100);

    var movie_key = (state.currentMovieType === "vod") ? "stream_icon" : "cover";
    var favourite_ids, movie_id_key;
    if (state.currentMovieType === "vod" || state.currentMovieType === "movie") {
      movie_id_key = VodModel.movie_key;
      favourite_ids = VodModel.favourite_ids;
    } else {
      movie_id_key = SeriesModel.movie_key;
      favourite_ids = SeriesModel.favourite_ids;
    }

    var remaining = state.movies.length - state.currentRenderCount;
    var batch = Math.min(RENDER_BATCH, remaining);

    var html = "";
    for (var i = 0; i < batch; i++) {
      var idx = state.currentRenderCount + i;
      var m = state.movies[idx];
      var isFav = favourite_ids.includes(m[movie_id_key]);

      html +=
        '<div class="vod-series-menu-item-container" data-stream_id="' + (m.stream_id || "") + '" data-index="' + idx + '"' +
        ' onmouseenter="vod_series_page.hoverMovieItem(this)"' +
        ' onclick="vod_series_page.selectMovie(' + idx + ')">' +
        '  <div class="vod-series-menu-item">' +
        (isFav ? '<div class="favourite-badge">★</div>' : '') + // ikon (korundu)
        '    <div class="vod-series-icon" style="background-image:url(\'' + (m[movie_key] || '') + '\');">' +
        '      <img class="poster-fallback-handler" src="' + (m[movie_key] || '') + '" onerror="vod_series_page.handlePosterError(this)" style="display:none;">' +
        '    </div>' +
        '    <div class="vod-series-menu-item-title-wrapper">' +
        '      <div class="vod-series-menu-item-title">' + cleanMovieName(m.name) + '</div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    state.currentRenderCount += batch;
    $grid.append(html);
    state.menuDoms = $("#vod-series-menus-container .vod-series-menu-item-container");
    // Grid kolon sayısını güncelle
    recalcGridColumns();
    updateMovieStats();
  }

  // Dinamik kolon sayısı: ilk satırdaki eleman sayısını ölç
  function recalcGridColumns(){
    try {
      var doms = state.menuDoms;
      if (!doms || !doms.length) { state.keys.columns = GRID_COLUMNS; return; }
      var firstTop = $(doms[0]).position().top;
      var count = 0;
      for (var i=0; i<doms.length; i++) {
        if (Math.abs($(doms[i]).position().top - firstTop) < 2) count++; else break;
      }
      if (count && count > 0) {
        state.keys.columns = count;
      } else {
        // Yedek: genişlikten tahmin
        var cw = $("#vod-series-menus-container").innerWidth();
        var iw = $(doms[0]).outerWidth(true) || 200;
        var cols = Math.max(1, Math.floor(cw / iw));
        state.keys.columns = cols || GRID_COLUMNS;
      }
    } catch (e) { state.keys.columns = GRID_COLUMNS; }
  }

  // ------------------------------
  // FAVORITES
  // ------------------------------
  function addOrRemoveFav() {
    var k = state.keys;
    if (k.focused_part !== "menu_selection") return;

    var favourite_ids, movie_id_key;
    if (state.currentMovieType === "vod" || state.currentMovieType === "movie") {
      movie_id_key = VodModel.movie_key;
      favourite_ids = VodModel.favourite_ids;
    } else {
      movie_id_key = SeriesModel.movie_key;
      favourite_ids = SeriesModel.favourite_ids;
    }

    var m = state.movies[k.menu_selection];
    if (!m) return;

    var isFav = favourite_ids.includes(m[movie_id_key]);
    if (!isFav) {
      $(state.menuDoms[k.menu_selection]).find(".vod-series-menu-item").prepend('<div class="favourite-badge">★</div>');
      (state.currentMovieType === "vod" || state.currentMovieType === "movie")
        ? VodModel.addRecentOrFavouriteMovie(m, "favourite")
        : SeriesModel.addRecentOrFavouriteMovie(m, "favourite");
    } else {
      $(state.menuDoms[k.menu_selection]).find(".favourite-badge").remove();
      (state.currentMovieType === "vod" || state.currentMovieType === "movie")
        ? VodModel.removeRecentOrFavouriteMovie(m[movie_id_key], "favourite")
        : SeriesModel.removeRecentOrFavouriteMovie(m[movie_id_key], "favourite");

      var cat = state.categories[state.currentCategoryIndex];
      if (cat && cat.category_id === "favourite") {
        $(state.menuDoms[k.menu_selection]).remove();
        var doms = $("#vod-series-menus-container .vod-series-menu-item-container");
        if (doms.length > 0) {
          doms.map(function (i, it) { $(it).data("index", i); });
          state.menuDoms = doms;
          if (k.menu_selection >= state.menuDoms.length) k.menu_selection = state.menuDoms.length - 1;
          hoverMovieItem(state.menuDoms[k.menu_selection]);
        } else {
          hoverCategory(state.categoryDoms[k.category_selection]);
        }
      }
    }
  }

  // ------------------------------
  // SEARCH
  // ------------------------------
  function searchMovie() {
    state.keys.focused_part = "search_selection";
    $search.focus();
    setTimeout(function () {
      var tmp = $search.val();
      $search[0].setSelectionRange(tmp.length, tmp.length);
    }, 200);
  }

  function searchValueChange() {
    clearTimeout(state.timers.searchDebounce);

    var val = $search.val();
    if (val !== "") $("#vod-series-search-icon-wrapper").addClass("searching");
    else $("#vod-series-search-icon-wrapper").removeClass("searching");

    state.timers.searchDebounce = setTimeout(function () {
      var q = $search.val();
      if (state.prevKeyword === q) {
        $("#vod-series-search-icon-wrapper").removeClass("searching");
        return;
      }

      var allMovies = [];
      if (state.categories && state.categories.length > 0) {
        var allCat = state.categories[0];
        if (allCat && allCat.movies) allMovies = allCat.movies;
      }

      var filtered = [];
      if (q === "") {
        filtered = getRecentMoviesFrom(allMovies, state.categories, 200);
        $title.text(LanguageManager.getText("latest_uploads"));
      } else {
        var s = q.toLowerCase();
        filtered = allMovies.filter(function (m) { return ((m.name || "").toLowerCase().indexOf(s) !== -1); });
        $title.text(LanguageManager.getText("search_results") + ': "' + q + '"');
      }

      $stats.text(filtered.length + " " + LanguageManager.getText("content_count"));

      showLoader(true);
      $grid.css("opacity", "0.3");

      setTimeout(function () {
        state.movies = filtered;
        $grid.html("");
        state.currentRenderCount = 0;
        renderCategoryContent();
        state.prevKeyword = q;
        setTimeout(function () {
          $grid.css("opacity", "1");
          showLoader(false);
        }, 50);
      }, 50);

      setTimeout(function () { $("#vod-series-search-icon-wrapper").removeClass("searching"); }, 300);
    }, SEARCH_DEBOUNCE_MS);
  }

  // ------------------------------
  // MOVIE / SERIES SELECTION
  // ------------------------------
  function selectMovie(index) {
    var movie = state.movies[index];
    if (!movie) { console.error("invalid movie idx", index); return; }
    if (state.currentMovieType === "series" && !movie.series_id) movie.series_id = movie.stream_id;

    state.lastSelectedCategory = state.keys.category_selection;
    state.lastSelectedMovie = index;
    state.selectedMovie = movie;
    state.selectedMovieIndex = index;

    if (window.SamsungTVTransition) {
      if (state.currentMovieType === "vod" || state.currentMovieType === "movie") {
        window.current_movie = movie;
        if (typeof vod_summary_page !== "undefined" && vod_summary_page.init) {
          SamsungTVTransition.transitionToMovieDetail()
            .then(function () { vod_summary_page.init("vod-series-page"); })
            .catch(function () {
              $("#vod-series-page").addClass("hide");
              vod_summary_page.init("vod-series-page");
            });
        }
      } else {
        window.current_movie = movie;
        if (typeof series_summary_page !== "undefined" && series_summary_page.init) {
          SamsungTVTransition.transitionToSeriesDetail()
            .then(function () { series_summary_page.init("vod-series-page"); })
            .catch(function () {
              $("#vod-series-page").addClass("hide");
              series_summary_page.init("vod-series-page");
            });
        }
      }
    } else {
      $("#vod-series-page").addClass("hide");
      if (state.currentMovieType === "vod" || state.currentMovieType === "movie") {
        window.current_movie = movie;
        if (typeof vod_summary_page !== "undefined" && vod_summary_page.init) vod_summary_page.init("vod-series-page");
        else $("#vod-series-page").removeClass("hide");
      } else {
        window.current_movie = movie;
        if (typeof series_summary_page !== "undefined" && series_summary_page.init) series_summary_page.init("vod-series-page");
        else $("#vod-series-page").removeClass("hide");
      }
    }
  }

  // ------------------------------
  // DETAIL PANEL
  // ------------------------------
  function showDetailPanel(movie) {
    if (!movie) return;

    $("#vod-detail-title").text(movie.name || "Unknown Title");
    $("#vod-detail-year").text(movie.year || new Date().getFullYear());
    $("#vod-detail-duration").text(formatDuration(movie.duration) || "120 min");
    $("#vod-detail-rating").html("★ " + (movie.rating || "8.5")); // ikon bırakıldı

    $("#vod-detail-description").text(
      movie.description || movie.plot || "No description available for this movie."
    );

    var $img = $("#vod-detail-poster");
    var $wrap = $img.parent();
    if (movie.image && movie.image.trim() !== "") { $img.attr("src", movie.image).show(); $wrap.removeClass("no-poster"); }
    else { $img.hide(); $wrap.addClass("no-poster"); }

    var bd = $("#vod-detail-backdrop-image");
    var bUrl = movie.backdrop_image || movie.image || "";
    if (bUrl && bUrl.trim() !== "") bd.css("background-image", "url(" + bUrl + ")");
    else bd.css("background-image", "none");

    populateGenres(movie);
    populateCast(movie);
    updateFavoriteButton(movie);

    $("#vod-detail-panel").removeClass("hidden").fadeIn(300);
  }

  function hideDetailPanel() {
    $("#vod-detail-panel").addClass("hidden").fadeOut(200);

    state.keys.focused_part = "menu_selection";
    state.keys.detail_panel_selection = 0;

    state.selectedMovie = null;
    state.selectedMovieIndex = -1;

    if (state.categoryDoms && state.categoryDoms[state.keys.category_selection]) {
      hoverCategory(state.categoryDoms[state.keys.category_selection]);
    }
    if (state.menuDoms && state.menuDoms[state.keys.menu_selection]) {
      if (prevFocusDom) $(prevFocusDom).removeClass("active");
      $(state.menuDoms[state.keys.menu_selection]).addClass("active");
      prevFocusDom = state.menuDoms[state.keys.menu_selection];
    }
  }

  function handleDetailPanelNavigation(inc) {
    var btns = $("#vod-detail-panel .vod-detail-btn");
    if (!btns.length) return;
    btns.removeClass("focused");
    state.keys.detail_panel_selection += inc;
    if (state.keys.detail_panel_selection < 0) state.keys.detail_panel_selection = btns.length - 1;
    if (state.keys.detail_panel_selection >= btns.length) state.keys.detail_panel_selection = 0;
    var $b = btns.eq(state.keys.detail_panel_selection).addClass("focused");
    if ($b.length) $b[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  function handleDetailPanelClick() {
    var btns = $("#vod-detail-panel .vod-detail-btn");
    var $b = btns.eq(state.keys.detail_panel_selection);
    if ($b.length) $b.click();
  }

  // ------------------------------
  // TEXT / CAST / GENRE / FAVORITE
  // ------------------------------
  function populateGenres(movie) {
    var $c = $("#vod-detail-genre-list").empty();
    var g = [];
    if (movie.genre) {
      if (Array.isArray(movie.genre)) g = movie.genre;
      else if (typeof movie.genre === "string") g = movie.genre.split(",").map(function (s) { return s.trim(); });
    }
    if (!g.length) g = (state.currentMovieType === "vod") ? ["Movie", "Drama"] : ["Series", "Drama"];
    g.forEach(function (x) { if (x && x.trim() !== "") $c.append('<span class="vod-detail-genre">' + x.trim() + "</span>"); });
  }

  function populateCast(movie) {
    var $c = $("#vod-detail-cast-list").empty();
    var cast = [];
    if (movie.cast && Array.isArray(movie.cast)) cast = movie.cast.slice(0, 6);
    else if (movie.actors) {
      if (Array.isArray(movie.actors)) cast = movie.actors.slice(0, 6);
      else if (typeof movie.actors === "string") cast = movie.actors.split(",").map(function (n) { return ({ name: n.trim() }); }).slice(0, 6);
    }
    if (!cast.length) cast = [{ name: "Actor 1" }, { name: "Actor 2" }, { name: "Actor 3" }];

    cast.forEach(function (a) {
      // Kullanıcı emojisi kaldırıldı; yerine nötr bir placeholder div bırakıldı
      var html = '<div class="vod-detail-cast-member">';
      if (a.photo && a.photo.trim() !== "") {
        html += '<img src="' + a.photo + '" alt="' + (a.name || "Actor") + '" class="vod-detail-cast-photo" onerror="this.style.display=\'none\'">';
      } else {
        html += '<div class="vod-detail-cast-photo" style="background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:0;"></div>';
      }
      html += '<div class="vod-detail-cast-name">' + (a.name || "Unknown") + "</div></div>";
      $c.append(html);
    });
  }

  function updateFavoriteButton(movie) {
    var $t = $("#favorite-text");
    var $i = $t.prev("i");
    var isFav = isFavorite(movie);
    if (isFav) { $t.text(LanguageManager.getText("remove_from_favorites")); $i.removeClass("fas fa-heart").addClass("fas fa-heart-broken"); }
    else { $t.text(LanguageManager.getText("add_to_favorites")); $i.removeClass("fas fa-heart-broken").addClass("fas fa-heart"); }
  }

  function isFavorite(movie) {
    try {
      var favs = JSON.parse(localStorage.getItem("movie_favorites") || "[]");
      return favs.some(function (f) { return f.id === movie.id || f.name === movie.name; });
    } catch (_) { return false; }
  }

  // ------------------------------
  // VARIOUS HELPERS
  // ------------------------------
  function sortMoviesByTSE(movies) {
    if (!movies || !movies.length) return [];
    function toMs(v) {
      if (v == null) return NaN;
      if (typeof v === "string") {
        if (/^\d+$/.test(v)) { var n = parseInt(v, 10); return (v.length === 10) ? n * 1000 : n; }
        var t = Date.parse(v); return isNaN(t) ? NaN : t;
      }
      var n2 = parseInt(v, 10); if (isNaN(n2)) return NaN;
      return (n2.toString().length === 10) ? n2 * 1000 : n2;
    }
    return movies.slice().sort(function (a, b) {
      var at = toMs(a.added_timestamp || a.tse || a.added_date || a.added || a.last_modified || a.timestamp || a.created_at || a.upload_date || a.date_added || a.created);
      var bt = toMs(b.added_timestamp || b.tse || b.added_date || b.added || b.last_modified || b.timestamp || b.created_at || b.upload_date || b.date_added || b.created);
      if (!isNaN(at) && !isNaN(bt)) return bt - at;
      var aId = parseInt(a.stream_id || a.series_id || a.id || 0, 10);
      var bId = parseInt(b.stream_id || b.series_id || b.id || 0, 10);
      return bId - aId;
    });
  }

  function getRecentMoviesFrom(allMovies, categories, count) {
    if (!Array.isArray(allMovies)) allMovies = [];
    var set = new Set();
    var all = [];

    // Kategorilerdeki filmleri topla (recent/favourite hariç)
    (categories || []).forEach(function (cat) {
      if (!cat || cat.category_id === "recent" || cat.category_id === "favourite") return;
      (cat.movies || []).forEach(function (m) {
        var id = m.stream_id || m.series_id || m.id;
        if (id != null && !set.has(id)) { set.add(id); all.push(m); }
      });
    });

    // Ayrıca allMovies listesini de karışıma ekle
    (allMovies || []).forEach(function (m) {
      var id = m.stream_id || m.series_id || m.id;
      if (id != null && !set.has(id)) { set.add(id); all.push(m); }
    });

    // Zamana göre sırala
    all = sortMoviesByTSE(all);
    return all.slice(0, count);
  }

  function updateMovieStats() {
    try {
      var total = state.movies.length;
      var rendered = state.currentRenderCount;
      var pos = state.keys.menu_selection + 1;
      var loadedWord = LanguageManager.getText("loaded");
      var itemWord = LanguageManager.getText("content_count");
      var txt = pos + " / " + total + " " + itemWord;
      if (rendered < total) txt += " (" + rendered + " " + loadedWord + ")";
      $stats.text(txt);
    } catch (e) { /* noop */ }
  }

  function formatDuration(d) {
    if (!d) return "";
    var min = (typeof d === "number") ? Math.round(d / 60) : parseInt(d, 10);
    if (isNaN(min) || min <= 0) return "";
    if (min >= 60) { var h = Math.floor(min / 60), m = min % 60; return h + "h " + (m > 0 ? m + "m" : ""); }
    return min + " min";
  }

  function handlePosterError(img) {
    try {
      img.style.display = "none";
      var p = img.parentElement;
      if (p) { p.style.backgroundImage = "none"; p.classList.add("no-poster"); }
    } catch (e) { /* noop */ }
  }

  function cleanMovieName(name) {
    if (!name) return "";
    var s = name
      .replace(/^\d+[-._\s]+/g, "")
      .replace(/^[\d\s\-._]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return s.length ? s : name;
  }

  function scrollMovieIntoView(index) {
    try {
      var item = state.menuDoms[index];
      if (!item) return;
      var container = $grid;
      var itemTop = $(item).position().top;
      var containerHeight = container.height();
      var itemHeight = $(item).outerHeight();
      var scrollTop = container.scrollTop();
      
      // Samsung TV fix: ensure proper scrolling when navigating down
      var buffer = 80; // Increased buffer for better visibility
      var itemBottom = itemTop + itemHeight;
      
      // Check if item is visible
      var isVisible = itemTop >= buffer && itemBottom <= (containerHeight - buffer);
      
      if (!isVisible) {
        // Calculate target scroll position
        var targetScroll;
        if (itemTop < buffer) {
          // Item is above viewport
          targetScroll = scrollTop + itemTop - buffer;
        } else {
          // Item is below viewport - scroll to show item at top
          targetScroll = scrollTop + itemTop - buffer;
        }
        
        // Ensure target is within bounds
        var maxScroll = container[0].scrollHeight - containerHeight;
        targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
        
        // Apply scroll immediately for Samsung TV
        container[0].scrollTop = targetScroll;
        
        // Also animate for smooth visual feedback
        container.stop().animate({ scrollTop: targetScroll }, 200, "ease-out");
        
        // Samsung TV: double-check scroll is applied
        setTimeout(function() {
          if (Math.abs(container[0].scrollTop - targetScroll) > 5) {
            container[0].scrollTop = targetScroll;
          }
        }, 250);
      }
    } catch (e) { 
      console.warn("scrollMovieIntoView error:", e);
    }
  }

  function scrollCategoryIntoView(idx) {
    try {
      var el = state.categoryDoms[idx];
      if (!el) return;
      var cont = $cats;
      var itemTop = $(el).position().top;
      var containerHeight = cont.height();
      var itemHeight = $(el).outerHeight();
      var scrollTop = cont.scrollTop();
      
      // Samsung TV fix: ensure category scrolling works properly
      var buffer = 30;
      var itemBottom = itemTop + itemHeight;
      
      // Check if category is visible
      var isVisible = itemTop >= buffer && itemBottom <= (containerHeight - buffer);
      
      if (!isVisible) {
        // Calculate target scroll position
        var targetScroll;
        if (itemTop < buffer) {
          // Category is above viewport
          targetScroll = scrollTop + itemTop - buffer;
        } else {
          // Category is below viewport
          targetScroll = scrollTop + itemBottom - containerHeight + buffer;
        }
        
        // Ensure target is within bounds
        targetScroll = Math.max(0, Math.min(targetScroll, cont[0].scrollHeight - containerHeight));
        
        // Apply scroll with animation
        cont.animate({ scrollTop: targetScroll }, 250, "swing");
        
        // Samsung TV: ensure scroll is applied
        setTimeout(function() {
          cont[0].scrollTop = targetScroll;
        }, 280);
      }
    } catch (e) { /* noop */ }
  }

  // ------------------------------
  // NAV / ROUTE HELPERS
  // ------------------------------
  function goBackToCategory() {
    if (!$("#vod-series-page").length) return;
    if (state.keys.focused_part === "menu_selection") {
      state.keys.focused_part = "category_selection";
      if (state.categoryDoms && state.categoryDoms[state.keys.category_selection]) {
        hoverCategory(state.categoryDoms[state.keys.category_selection]);
      }
    } else if (state.keys.focused_part === "category_selection") {
      goBackToHome();
    } else {
      goBack();
    }
  }

  function goBack() {
    var k = state.keys;
    switch (k.focused_part) {
      case "detail_panel":
        hideDetailPanel();
        break;
      case "menu_selection":
        k.focused_part = "category_selection";
        hoverCategory(state.categoryDoms[k.category_selection]);
        break;
      case "category_selection":
        top_menu_page.hoverMenuItem(top_menu_page.keys.menu_selection);
        break;
      case "top_menu_selection":
        $search.blur();
        k.focused_part = "category_selection";
        hoverCategory(state.categoryDoms[k.category_selection]);
        break;
    }
  }

  function goBackToHome() {
    console.log('VOD Series: goBackToHome called');
    $("#vod-series-page").addClass("hide");
    
    // Clear sub-route
    if (typeof top_menu_page !== 'undefined') {
      top_menu_page.sub_route = "";
    }
    
    // Show home page
    $("#home-page").removeClass("hide");
    $("#page-container-1").addClass("active");
    
    // Show home elements
    $(".main-logo-container").show();
    $("#main-menu-container").show();
    $("#home-mac-address-container").show();
    $("#top-right-clock").show();
    
    // Initialize home page functions
    if (typeof showHomepageElements === "function") {
      showHomepageElements();
    }
    if (typeof toggleHomepageElements === "function") {
      toggleHomepageElements(true);
    }
    if (typeof ensureHomepageUIVisible === "function") {
      ensureHomepageUIVisible();
    }
    if (typeof safeRefreshHome === "function") {
      safeRefreshHome();
    }
    
    // Update route and focus
    if (typeof updateRoute === "function") {
      updateRoute("home-page", "menu_selection");
    }
    window.current_route = 'home-page';
    
    // Initialize top menu
    if (typeof top_menu_page !== 'undefined' && top_menu_page.init) {
      top_menu_page.init();
    }
    
    console.log('VOD Series: Successfully returned to home');
  }

  function hoverHomeButton() {
    // Ana sayfa butonuna hover efekti
    $('.vod-home-icon').addClass('hover-effect');
    console.log('VOD Series: Home button hovered');
  }

  // ------------------------------
  // PUBLIC API
  // ------------------------------
  return {
    // lifecycle
    init: init,

    // navigation helpers
    HandleKey: HandleKey,
    navigateDown: navigateDown,
    navigateUp: navigateUp,
    navigateRight: navigateRight,
    navigateLeft: navigateLeft,
    pressEnter: pressEnter,

    // hover/select
    hoverCategory: hoverCategory,
    hoverMovieItem: hoverMovieItem,
    handleMenuClick: handleMenuClick,

    // home navigation
    goBackToHome: goBackToHome,
    hoverHomeButton: hoverHomeButton,

    // favourites
    addOrRemoveFav: addOrRemoveFav,

    // search
    searchMovie: searchMovie,
    searchValueChange: searchValueChange,

    // select
    selectMovie: selectMovie,

    // detail panel
    showDetailPanel: showDetailPanel,
    hideDetailPanel: hideDetailPanel,
    handleDetailPanelNavigation: handleDetailPanelNavigation,
    handleDetailPanelClick: handleDetailPanelClick,

    // utils used in templates
    handlePosterError: handlePosterError,
    formatDuration: formatDuration,
    cleanMovieName: cleanMovieName
  };
})();
