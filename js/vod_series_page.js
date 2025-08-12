"use strict";
var vod_series_page={
    player:null,
    channel_number_timer:null,
    channel_num:0,
    movies:[],
    initiated:false,
    categories:[],
    category_hover_timer:null,
    category_hover_timeout:300,
    navigation_timeout:null,
    last_watched_series:null,
    current_category:null,              // ✅ eklendi: aktif kategori objesi
    current_category_index:-1,          // zaten vardı, tutarlı kullanıyoruz
    current_category_name:'',           // id/anahtar
    keys:{
        focused_part:"category_selection",
        category_selection:0,
        menu_selection:0,
        video_control:0,
        top_menu_selection:0,
        detail_panel_selection:0,
        columns:5                       // ✅ tek kaynak
    },
    category_doms:[],
    menu_doms:[],
    search_input_dom:$('#vod-series-title-part'),
    current_movie_type:'movie',
    sort_key:'vod_sort',
    search_key_timer:'',
    search_key_timout:300,
    current_render_count:0,
    render_count_increment:120,
    is_drawing:false,
    detail_panel_open:false,
    selected_movie:null,
    selected_movie_index:-1,
    prev_keyword:'',
    top_menu_doms:$('.vod-series-top-menu-item'),
    // Scoped DOM handles to avoid duplicate-ID collisions
    dom: { root: null, section: null, cats: null, menus: null, title: null, stats: null, searchInput: null },

    getDomHandles:function(){
        var $root = $('#vod-series-page');
        var $section = $root.find('.stream-page-content-part').first();
        this.dom = {
            root: $root,
            section: $section,
            cats: $section.find('#vod-series-categories-container'),
            menus: $section.find('#vod-series-menus-container'),
            title: $section.find('#vod-series-current-category'),
            stats: $section.find('.vod-series-content-stats'),
            searchInput: $root.find('#vod-series-search-input')
        };
    },

    init:function (movie_type) {
        console.log('VOD Series Page init started with type:', movie_type);
        
        // Check dependencies
        if (typeof LanguageManager === 'undefined') {
            console.error('LanguageManager not available');
            return false;
        }
        
        if (typeof SeriesModel === 'undefined') {
            console.error('SeriesModel not available');
            return false;
        }
        
        if (typeof VodModel === 'undefined') {
            console.error('VodModel not available');
            return false;
        }
        
        $('#home-mac-address-container').hide();
        this.is_drawing=false;
        this.render_count_increment = 120;
        this.search_key_timout = 300;

        $('#home-page').addClass('hide');
        $("#vod-series-page").removeClass('hide');
    this.getDomHandles();
        $('.main-logo-container').hide();
        $('#main-menu-container').hide();

        if (typeof toggleDeviceInfoBanner === 'function') toggleDeviceInfoBanner(false);
        if (typeof toggleHomepageElements === 'function') toggleHomepageElements(false);
        else if (typeof toggleBottomBar === 'function') toggleBottomBar(false);

        this.current_movie_type=movie_type;
        
        try {
            if(movie_type==='vod'){
                this.sort_key='vod_sort';
                this.categories=VodModel.getCategories(false, true);
                console.log('Loaded VOD categories:', this.categories.length);
            } else {
                this.sort_key='series_sort';
                this.categories=SeriesModel.getCategories(false, true);
                console.log('Loaded Series categories:', this.categories.length);
            }
        } catch (categoryError) {
            console.error('Error loading categories:', categoryError);
            this.categories = [];
        }

        this.setupPage();

        // All (Tümü) kategorisi
        try {
            var allMovies = (movie_type==='vod') ? VodModel.getAllMovies() : SeriesModel.getAllMovies();
            allMovies = this.sortMoviesByTSE(allMovies);
            console.log('Loaded all movies:', allMovies.length);

            var allCategory = {
                category_id: 'all',
                category_name: LanguageManager.getText('all_category'),
                movies: allMovies
            };

            var recentlyAddedMovies = this.getRecentMovies(200);
            this.categories.unshift(allCategory);
        } catch (moviesError) {
            console.error('Error loading movies:', moviesError);
            var allCategory = {
                category_id: 'all',
                category_name: 'All',
                movies: []
            };
            this.categories = [allCategory];
            var recentlyAddedMovies = [];
        }

        // kategorileri çiz
        try {
            var htmlContent='';
            this.categories.map(function (item,index) {
                var cls = item.category_id === 'all' ? 'vod-series-category-item bg-focus-1 all-category' : 'vod-series-category-item bg-focus-1';
                htmlContent+=
                    '<div class="'+cls+'" data-index="'+index+'" onmouseenter="vod_series_page.hoverCategory(this)" onclick="vod_series_page.handleMenuClick()">'+
                    '  <span class="category-name">'+ (item.category_name || '—') +'</span>'+
                    '  <span class="category-movie-count">'+ (item.movies?item.movies.length:0) +'</span>'+
                    '</div>';
            });
            $('#vod-series-categories-container').html(htmlContent);
            this.category_doms=$('.vod-series-category-item');
            console.log('Categories rendered successfully:', this.category_doms.length);
        } catch (renderError) {
            console.error('Error rendering categories:', renderError);
            $('#vod-series-categories-container').html('<div class="error-message">Error loading categories</div>');
            this.category_doms = [];
        }

        // başlangıç: All
        this.keys.focused_part='category_selection';
        this.keys.category_selection=0;
        
        if (this.category_doms.length > 0) {
            $(this.category_doms[0]).addClass('active');
            prev_focus_dom = this.category_doms[0];
        }

        this.current_render_count=0;
        this.movies = recentlyAddedMovies.slice(0, 200);
        this.current_category_index = -1;          // home görünümü
        this.current_category = this.categories[0];
        this.current_category_name = 'all';

        $('#vod-series-current-category').text(LanguageManager.getText('latest_uploads') || 'Latest Uploads');
        $('.vod-series-content-stats').text('200 ' + (LanguageManager.getText('content_count') || 'items'));
        
        try {
            this.renderCategoryContent();
            console.log('Series page initialized successfully');
        } catch (contentError) {
            console.error('Error rendering content:', contentError);
        }

        current_route='vod-series-page';
        top_menu_page.sub_route='vod-series-page';
        this.bindScrollEvents();
        
        return true;

        setTimeout(() => {
            this.initiated = true;
            this.hideDetailPanel();
            this.selected_movie = null;
            this.selected_movie_index = -1;
        }, 500);
    },

    goBack:function(){
        var k=this.keys;
        switch (k.focused_part) {
            case "detail_panel":
                this.hideDetailPanel();
                break;
            case "menu_selection":
                k.focused_part="category_selection";
                this.hoverCategory(this.category_doms[k.category_selection]);
                break;
            case "category_selection":
                top_menu_page.hoverMenuItem(top_menu_page.keys.menu_selection);
                break;
            case "top_menu_selection":
                $('#vod-series-search-input').blur();
                k.focused_part="category_selection";
                this.hoverCategory(this.category_doms[k.category_selection]);
                break;
        }
    },

    goBackToHome:function(){
        $('#vod-series-page').addClass('hide');
        top_menu_page.sub_route = '';
        $('#page-container-1').addClass('active');
        if (typeof showHomepageElements === 'function') showHomepageElements();
        else {
            $('.main-logo-container').show();
            $('#main-menu-container').show();
            if (typeof toggleHomepageElements === 'function') toggleHomepageElements(true);
        }
        top_menu_page.hoverMenuItem(0);
    },

    showCategoryContent:function(){
        var k=this.keys;
        var category = this.categories[k.category_selection];
        if (!category) return;

        // state güncelle
        this.current_category_index = k.category_selection;
        this.current_category = category;
        this.current_category_name = category.category_id;

        this.prev_keyword='';
        $('#vod-series-search-input').val('');

        var newMovies=[], title='', stats='';

        if (k.category_selection === 0) {
            // All → tüm içerik TSE
            var all = (this.current_movie_type==='vod') ? VodModel.getAllMovies() : SeriesModel.getAllMovies();
            newMovies = this.sortMoviesByTSE(all);
            title = LanguageManager.getText('all_movies');
            stats = newMovies.length + ' ' + LanguageManager.getText('content_count');
        } else {
            newMovies = category.movies ? this.sortMoviesByTSE(category.movies.slice()) : [];
            title = category.category_name;
            stats = newMovies.length + ' ' + LanguageManager.getText('content_count');
        }

        $('#vod-series-current-category').text(title);
        $('.vod-series-content-stats').text(stats);

        showLoader(true);
        $('#vod-series-menus-container').css('opacity','0.3');

        setTimeout(()=>{
            this.current_render_count=0;
            this.movies = newMovies;
            $('#vod-series-menus-container').html('');
            this.renderCategoryContent();
            $('#vod-series-menus-container').scrollTop(0);
            setTimeout(()=>{
                $('#vod-series-menus-container').css('opacity','1');
                showLoader(false);
            },50);
        },50);

        k.menu_selection = 0;
    },

    renderCategoryContent:function(){
        if(this.current_render_count>=this.movies.length) return;

        this.is_drawing=true;
        $('#vod-series-menus-container').addClass('loading');
        showLoader(true);
        setTimeout(()=>{
            this.is_drawing=false;
            $('#vod-series-menus-container').removeClass('loading').addClass('loaded');
            showLoader(false);
        },100);

        var movie_key = (this.current_movie_type==='vod') ? 'stream_icon' : 'cover';
        var favourite_ids, movie_id_key;
        if(this.current_movie_type==='vod' || this.current_movie_type==='movie'){
            movie_id_key=VodModel.movie_key;
            favourite_ids=VodModel.favourite_ids;
        } else {
            movie_id_key=SeriesModel.movie_key;
            favourite_ids=SeriesModel.favourite_ids;
        }

        var remaining = this.movies.length - this.current_render_count;
        var batch = Math.min(this.render_count_increment, remaining);

        var html='';
        for (let i=0;i<batch;i++){
            var idx = this.current_render_count + i;
            var m = this.movies[idx];
            var isFav = favourite_ids.includes(m[movie_id_key]);
            html+=
            '<div class="vod-series-menu-item-container" data-stream_id="'+(m.stream_id||'')+'" data-index="'+idx+'" onmouseenter="vod_series_page.hoverMovieItem(this)" onclick="vod_series_page.selectMovie('+idx+')">'+
            '  <div class="vod-series-menu-item">'+
                 (isFav?'<div class="favourite-badge">★</div>':'')+
            '    <div class="vod-series-icon" style="background-image:url(\''+(m[movie_key]||'')+'\');">'+
            '      <img class="poster-fallback-handler" src="'+(m[movie_key]||'')+'" onerror="vod_series_page.handlePosterError(this)" style="display:none;">'+
            '    </div>'+
            '    <div class="vod-series-menu-item-title-wrapper">'+
            '      <div class="vod-series-menu-item-title">'+ this.cleanMovieName(m.name) +'</div>'+
            '    </div>'+
            '  </div>'+
            '</div>';
        }

        this.current_render_count += batch;
        $('#vod-series-menus-container').append(html);
        this.menu_doms=$('#vod-series-menus-container .vod-series-menu-item-container');
        this.updateMovieStats();
    },

    hoverMovieItem:function(el){
        var index=$(el).data('index');
        var k=this.keys;
        k.focused_part="menu_selection";
        k.menu_selection=index;

        if(prev_focus_dom) $(prev_focus_dom).removeClass('active');
        if(this.menu_doms[index]) {
            $(this.menu_doms[index]).addClass('active');
            prev_focus_dom=this.menu_doms[index];
        }
        current_route='vod-series-page';
        clearTimeout(this.channel_hover_timer);

        if(this.initiated) this.scrollMovieIntoView(k.menu_selection);
        this.updateMovieStats();
    },

    handleMenusUpDown:function(increment) {
        var k=this.keys, cols=this.keys.columns;
        $('#vod-series-search-input').blur();

        switch (k.focused_part) {
            case "category_selection":
                k.category_selection+=increment;
                if(k.category_selection<0){ k.category_selection=0; return; }
                if(k.category_selection>=this.category_doms.length){ k.category_selection=this.category_doms.length-1; return; }

                this.scrollCategoryIntoView(k.category_selection);
                this.hoverCategory(this.category_doms[k.category_selection]);

                if(increment>0 && this.movies.length>0){
                    k.focused_part='menu_selection';
                    if(k.menu_selection>=this.menu_doms.length) k.menu_selection=0;
                    this.hoverMovieItem(this.menu_doms[k.menu_selection]);
                    this.scrollMovieIntoView(k.menu_selection);
                }
                break;

            case "menu_selection":
                var newSel = k.menu_selection + (cols * increment);

                if(increment<0 && newSel<0){
                    k.focused_part='category_selection';
                    this.hoverCategory(this.category_doms[k.category_selection]);
                    return;
                }

                if(newSel >= this.menu_doms.length){
                    if(this.current_render_count < this.movies.length) {
                        this.renderCategoryContent();
                        this.menu_doms = $('#vod-series-menus-container .vod-series-menu-item-container');
                    }
                    newSel = Math.min(newSel, this.menu_doms.length-1);
                }
                if(newSel<0) newSel=0;

                k.menu_selection=newSel;

                // proactive load
                if(k.menu_selection >= this.current_render_count - (cols*2) &&
                   this.current_render_count < this.movies.length && !this.is_drawing){
                    setTimeout(()=>this.renderCategoryContent(),50);
                }

                this.hoverMovieItem(this.menu_doms[k.menu_selection]);
                break;
        }
    },

    handleMenuLeftRight:function(increment) {
        var k=this.keys, cols=this.keys.columns;
        $('#vod-series-search-input').blur();

        clearTimeout(this.navigation_timeout);
        this.navigation_timeout = setTimeout(()=>{
            switch (k.focused_part) {
                case "category_selection":
                    if(increment>0 && this.movies.length>0){
                        k.focused_part='menu_selection';
                        if(k.menu_selection>=this.menu_doms.length) k.menu_selection=0;
                        this.hoverMovieItem(this.menu_doms[k.menu_selection]);
                        this.scrollMovieIntoView(k.menu_selection);
                    }
                    break;

                case "menu_selection":
                    if(increment<0){
                        var current_col = k.menu_selection % cols;
                        if(current_col===0){
                            k.focused_part='category_selection';
                            this.hoverCategory(this.category_doms[k.category_selection]);
                            return;
                        }
                    }

                    var ns = k.menu_selection + increment;

                    if(increment>0 && ns>=this.menu_doms.length){
                        if(this.current_render_count < this.movies.length){
                            this.renderCategoryContent();
                            this.menu_doms=$('#vod-series-menus-container .vod-series-menu-item-container');
                        }
                    }
                    if(ns>=this.menu_doms.length) ns=this.menu_doms.length-1;
                    if(ns<0) ns=0;

                    k.menu_selection=ns;
                    this.hoverMovieItem(this.menu_doms[k.menu_selection]);

                    if(increment>0 && k.menu_selection >= this.current_render_count - (cols+3) &&
                       this.current_render_count < this.movies.length && !this.is_drawing){
                        setTimeout(()=>this.renderCategoryContent(),100);
                    }
                    break;
            }
        }, 40);
    },

    scrollMovieIntoView:function(index){
        try {
            var item = this.menu_doms[index];
            if (!item) return;
            var container = $('#vod-series-menus-container');
            var top = $(item).position().top;
            var h = container.height();
            var eh = $(item).outerHeight();
            var st = container.scrollTop();
            var bottom = top + eh;
            var buf = 100;
            var vis = top>=buf && bottom <= (h-buf);

            if (!vis){
                var target;
                if (top<buf) target = st + top - buf;
                else target = st + bottom - h + buf;

                container.animate({scrollTop: Math.max(0,target)}, 300, 'swing');
                setTimeout(()=>{ container[0].scrollTop = Math.max(0,target); },320);
            }
        } catch(e){ console.log("movie scroll err:",e); }
    },

    updateMovieStats:function(){
        try{
            var total = this.movies.length;
            var rendered = this.current_render_count;
            var pos = this.keys.menu_selection + 1;
            var loadedWord = LanguageManager.getText('loaded');
            var itemWord = LanguageManager.getText('content_count');
            var txt = pos+' / '+total+' '+itemWord;
            if (rendered<total) txt += ' ('+rendered+' '+loadedWord+')';
            $('.vod-series-content-stats').text(txt);
        }catch(e){ console.log("stats err:",e); }
    },

    selectCategory:function(arg){
        // arg index veya kategori objesi olabilir
        let idx = -1, cat=null;

        if (typeof arg === 'number'){
            idx = arg;
            cat = this.categories[idx];
        } else if (arg && typeof arg === 'object'){
            idx = this.categories.findIndex(c => (c.category_id===arg.category_id));
            cat = (idx>=0)? this.categories[idx] : null;
        }

        if (idx<0 || !cat){
            console.error('selectCategory: invalid', arg);
            return;
        }

        this.keys.category_selection = idx;

        if (this.category_doms && this.category_doms.length>0){
            $(this.category_doms).removeClass('active');
            if (this.category_doms[idx]) $(this.category_doms[idx]).addClass('active');
        }

        this.current_category = cat;
        this.current_category_index = idx;
        this.current_category_name = cat.category_id;

        this.current_render_count = 0;
        this.movies = cat.movies || [];

        $('#vod-series-current-category').text(cat.category_name);
        $('.vod-series-content-stats').text(this.movies.length + ' ' + LanguageManager.getText('content_count'));

        $('#vod-series-menus-container').html('');
        this.renderCategoryContent();
    },

    addOrRemoveFav:function(){
        var k=this.keys;
        if(k.focused_part!=='menu_selection') return;
        var favourite_ids,movie_id_key;
        if(this.current_movie_type==='vod' || this.current_movie_type==='movie'){
            movie_id_key=VodModel.movie_key;
            favourite_ids=VodModel.favourite_ids;
        } else {
            movie_id_key=SeriesModel.movie_key;
            favourite_ids=SeriesModel.favourite_ids;
        }
        var m=this.movies[k.menu_selection];
        if(!m) return;

        var isFav = favourite_ids.includes(m[movie_id_key]);
        if(!isFav){
            $($(this.menu_doms[k.menu_selection]).find('.vod-series-menu-item')).prepend('<div class="favourite-badge">★</div>');
            (this.current_movie_type==='vod' || this.current_movie_type==='movie')
                ? VodModel.addRecentOrFavouriteMovie(m,'favourite')
                : SeriesModel.addRecentOrFavouriteMovie(m,'favourite');
        } else {
            $($(this.menu_doms[k.menu_selection]).find('.favourite-badge')).remove();
            (this.current_movie_type==='vod' || this.current_movie_type==='movie')
                ? VodModel.removeRecentOrFavouriteMovie(m[movie_id_key],'favourite')
                : SeriesModel.removeRecentOrFavouriteMovie(m[movie_id_key],'favourite');

            var cat=this.categories[this.current_category_index];
            if(cat && cat.category_id==='favourite'){
                $(this.menu_doms[k.menu_selection]).remove();
                var doms=$('#vod-series-menus-container .vod-series-menu-item-container');
                if(doms.length>0){
                    doms.map(function (i, it) { $(it).data('index',i); });
                    this.menu_doms=doms;
                    if(k.menu_selection>=this.menu_doms.length) k.menu_selection=this.menu_doms.length-1;
                    this.hoverMovieItem(this.menu_doms[k.menu_selection]);
                } else {
                    this.hoverCategory(this.category_doms[k.category_selection]);
                }
            }
        }
    },

    searchMovie:function(){
        var k=this.keys;
        k.focused_part='search_selection';
        $('#vod-series-search-input').focus();
        setTimeout(function () {
            var tmp = $('#vod-series-search-input').val();
            $('#vod-series-search-input')[0].setSelectionRange(tmp.length, tmp.length);
        },200);
    },

    searchValueChange:function(){
        clearTimeout(this.search_key_timer);
        var that=this;

        var val=$('#vod-series-search-input').val();
        if(val!=='') $('#vod-series-search-icon-wrapper').addClass('searching');
        else $('#vod-series-search-icon-wrapper').removeClass('searching');

        this.search_key_timer=setTimeout(function () {
            var q=$('#vod-series-search-input').val();
            if(that.prev_keyword===q){
                $('#vod-series-search-icon-wrapper').removeClass('searching');
                return;
            }

            var allMovies=[];
            if(that.categories && that.categories.length>0){
                var allCat = that.categories[0];
                if (allCat && allCat.movies) allMovies = allCat.movies;
            }

            var filtered=[];
            if(q===""){
                filtered = that.getRecentMovies(200);
                $('#vod-series-current-category').text(LanguageManager.getText('latest_uploads'));
            } else {
                var s=q.toLowerCase();
                filtered = allMovies.filter(m => (m.name||'').toLowerCase().includes(s));
                $('#vod-series-current-category').text(LanguageManager.getText('search_results')+': "'+q+'"');
            }

            $('.vod-series-content-stats').text(filtered.length + ' ' + LanguageManager.getText('content_count'));

            showLoader(true);
            $('#vod-series-menus-container').css('opacity','0.3');

            setTimeout(function(){
                that.movies = filtered;
                $('#vod-series-menus-container').html('');
                that.current_render_count=0;
                that.renderCategoryContent();
                that.prev_keyword=q;
                setTimeout(function(){
                    $('#vod-series-menus-container').css('opacity','1');
                    showLoader(false);
                },50);
            },50);

            setTimeout(()=>$('#vod-series-search-icon-wrapper').removeClass('searching'),300);
        }, this.search_key_timout);
    },

    hoverTopMenu:function(index){
        var k=this.keys;
        k.top_menu_selection=index;
        k.focused_part='top_menu_selection';
        $(prev_focus_dom).removeClass('active');
        $(this.top_menu_doms[index]).addClass('active');
        prev_focus_dom=this.top_menu_doms[index];
        current_route='vod-series-page';
    },

    hoverCategory:function(el){
        var k=this.keys;
        var index=$(el).data('index');
        k.focused_part="category_selection";
        k.category_selection=index;
        current_route='vod-series-page';

        $(prev_focus_dom).removeClass('active');
        $(this.category_doms[index]).addClass('active');
        prev_focus_dom=this.category_doms[index];

        if(this.initiated) this.scrollCategoryIntoView(index);

        clearTimeout(this.category_hover_timer);
        this.category_hover_timer=setTimeout(()=>{
            var cat=this.categories[k.category_selection];
            var is_adult=checkForAdult(cat,'category',[]);
            if(is_adult){ parent_confirm_page.init(current_route); return; }
            this.showCategoryContent();
        }, this.category_hover_timeout);
    },

    handleMenuClick:function(){
        var k=this.keys;
        switch (k.focused_part) {
            case "menu_selection":
                this.selectMovie(k.menu_selection);
                break;
            case "top_menu_selection":
                if(k.top_menu_selection==0){
                    if(window.show_keyboard) $('#vod-series-search-input').blur();
                    else this.searchMovie();
                }
                break;
            case "category_selection":
                var cat=this.categories[k.category_selection];
                if(this.current_category_index==k.category_selection) return;
                var is_adult=checkForAdult(cat,'category',[]);
                if(is_adult){ parent_confirm_page.init(current_route); return; }
                this.showCategoryContent();
                break;
        }
    },

    HandleKey:function(e){
        if(this.is_drawing) return;
        switch(e.keyCode){
            case 65376:
            case 65385:
                $('input').blur();
                break;
            case tvKey.RIGHT:
                if(this.keys.focused_part==='detail_panel') this.handleDetailPanelNavigation(1);
                else this.handleMenuLeftRight(1);
                break;
            case tvKey.LEFT:
                if(this.keys.focused_part==='detail_panel') this.handleDetailPanelNavigation(-1);
                else this.handleMenuLeftRight(-1);
                break;
            case tvKey.DOWN:
                if(this.keys.focused_part!=='detail_panel') this.handleMenusUpDown(1);
                break;
            case tvKey.UP:
                if(this.keys.focused_part!=='detail_panel') this.handleMenusUpDown(-1);
                break;
            case tvKey.ENTER:
                if(this.keys.focused_part==='detail_panel') this.handleDetailPanelClick();
                else if(this.keys.focused_part==='menu_selection' && this.menu_doms[this.keys.menu_selection]) this.selectMovie(this.keys.menu_selection);
                else this.handleMenuClick();
                break;
            case tvKey.CH_UP:  this.showNextChannel && this.showNextChannel(1); break;
            case tvKey.CH_DOWN:this.showNextChannel && this.showNextChannel(-1); break;
            case tvKey.RETURN:
                if(this.keys.focused_part==='detail_panel') this.hideDetailPanel();
                else this.goBackToCategory();
                break;
            case tvKey.YELLOW:
                this.addOrRemoveFav();
                break;
            case tvKey.N1: this.goChannelNum && this.goChannelNum(1); break;
            case tvKey.N2: this.goChannelNum && this.goChannelNum(2); break;
            case tvKey.N3: this.goChannelNum && this.goChannelNum(3); break;
            case tvKey.N4: this.goChannelNum && this.goChannelNum(4); break;
            case tvKey.N5: this.goChannelNum && this.goChannelNum(5); break;
            case tvKey.N6: this.goChannelNum && this.goChannelNum(6); break;
            case tvKey.N7: this.goChannelNum && this.goChannelNum(7); break;
            case tvKey.N8: this.goChannelNum && this.goChannelNum(8); break;
            case tvKey.N9: this.goChannelNum && this.goChannelNum(9); break;
            case tvKey.N0: this.goChannelNum && this.goChannelNum(0); break;
            case tvKey.PAUSE: this.playOrPause && this.playOrPause(); break;
            default: console.log("No matching");
        }
    },

    sortMoviesByTSE:function(movies){
        if(!movies||!movies.length) return [];
        return movies.slice().sort(function(a,b){
            var aT=a.added_timestamp||a.tse||a.added_date||a.added||a.last_modified||a.timestamp||a.created_at||a.upload_date||a.date_added||a.created;
            var bT=b.added_timestamp||b.tse||b.added_date||b.added||b.last_modified||b.timestamp||b.created_at||b.upload_date||b.date_added||b.created;

            function toMs(v){
                if(v==null) return NaN;
                if(typeof v==='string'){
                    if(/^\d+$/.test(v)){ var n=parseInt(v,10); return (v.length===10)? n*1000 : n; }
                    var t=Date.parse(v); return isNaN(t)? NaN : t;
                }
                var n=parseInt(v,10); if(isNaN(n)) return NaN;
                return (n.toString().length===10)? n*1000 : n;
            }
            var at=toMs(aT), bt=toMs(bT);
            if(!isNaN(at) && !isNaN(bt)) return bt-at;

            var aId = parseInt(a.stream_id||a.series_id||a.id||0,10);
            var bId = parseInt(b.stream_id||b.series_id||b.id||0,10);
            return bId-aId;
        });
    },

    getRecentMovies:function(count){
        var all=[];
        this.categories.forEach(function(cat){
            if(!cat) return;
            if(cat.category_id==='recent' || cat.category_id==='favourite') return;
            (cat.movies||[]).forEach(m=>all.push(m));
        });
        all.sort((a,b)=>{
            var aD=a.added_timestamp||a.tse||a.added_date||a.added||a.last_modified||a.timestamp||a.created_at||a.upload_date||a.date_added||a.created;
            var bD=b.added_timestamp||b.tse||b.added_date||b.added||b.last_modified||b.timestamp||b.created_at||b.upload_date||b.date_added||b.created;
            function ms(v){
                if(v==null) return NaN;
                if(typeof v==='string'){
                    if(/^\d+$/.test(v)){ var n=parseInt(v,10); return (v.length===10)? n*1000 : n; }
                    var t=Date.parse(v); return isNaN(t)? NaN : t;
                }
                var n=parseInt(v,10); if(isNaN(n)) return NaN;
                return (n.toString().length===10)? n*1000 : n;
            }
            var at=ms(aD), bt=ms(bD);
            if(!isNaN(at)&&!isNaN(bt)) return bt-at;
            var aId = parseInt(a.stream_id||a.series_id||a.id||0,10);
            var bId = parseInt(b.stream_id||b.series_id||b.id||0,10);
            return bId-aId;
        });
        return all.slice(0, count);
    },

    selectMovie:function(index){
        var movie=this.movies[index];
        if(!movie){ console.error("invalid movie idx",index); return; }
        if (this.current_movie_type==='series' && !movie.series_id) movie.series_id = movie.stream_id;

        this.last_selected_category = this.keys.category_selection;
        this.last_selected_movie = index;
        this.selected_movie = movie;
        this.selected_movie_index = index;

        if (window.SamsungTVTransition){
            if (this.current_movie_type==='vod' || this.current_movie_type==='movie'){
                current_movie = movie;
                if (typeof vod_summary_page!=='undefined' && vod_summary_page.init){
                    SamsungTVTransition.transitionToMovieDetail()
                        .then(()=>vod_summary_page.init('vod-series-page'))
                        .catch(()=>{
                            $('#vod-series-page').addClass('hide');
                            vod_summary_page.init('vod-series-page');
                        });
                }
            } else {
                current_movie = movie;
                if (typeof series_summary_page!=='undefined' && series_summary_page.init){
                    SamsungTVTransition.transitionToSeriesDetail()
                        .then(()=>series_summary_page.init('vod-series-page'))
                        .catch(()=>{
                            $('#vod-series-page').addClass('hide');
                            series_summary_page.init('vod-series-page');
                        });
                }
            }
        } else {
            $('#vod-series-page').addClass('hide');
            if (this.current_movie_type==='vod' || this.current_movie_type==='movie'){
                current_movie = movie;
                if (typeof vod_summary_page!=='undefined' && vod_summary_page.init) vod_summary_page.init('vod-series-page');
                else $('#vod-series-page').removeClass('hide');
            } else {
                current_movie = movie;
                if (typeof series_summary_page!=='undefined' && series_summary_page.init) series_summary_page.init('vod-series-page');
                else $('#vod-series-page').removeClass('hide');
            }
        }
    },

    getCategoryDisplayName:function(){
        try{
            if (this.current_category && this.current_category.category_name) return this.current_category.category_name;
            if (this.current_category_index>=0 && this.current_category_index<this.categories.length){
                var c=this.categories[this.current_category_index];
                return c.category_name || c.name || 'Unknown Category';
            }
            return (this.current_movie_type==='vod') ? 'All Movies' : 'All Series';
        }catch(e){ return 'Movies'; }
    },

    scrollCategoryIntoView:function(idx){
        try{
            var el=this.category_doms[idx];
            if(!el) return;
            var cont=$('#vod-series-categories-container');
            var top=$(el).position().top;
            var h=cont.height();
            var eh=$(el).outerHeight();
            var st=cont.scrollTop();
            var bottom=top+eh;
            var buf=50;
            var vis = top>=buf && bottom<=(h-buf);
            if(!vis){
                var target = (top<buf) ? (st+top-buf) : (st+bottom-h+buf);
                cont.animate({scrollTop: Math.max(0,target)}, 250, 'swing');
            }
        }catch(e){ console.log("cat scroll err:",e); }
    },

    bindScrollEvents:function(){
        var that=this;
        $('#vod-series-menus-container').off('scroll.vodScroll').on('scroll.vodScroll', function(){
            var $c=$(this);
            var st=$c.scrollTop();
            var sh=$c[0].scrollHeight;
            var ch=$c.height();
            if (st+ch >= sh-400){
                if (that.current_render_count < that.movies.length && !that.is_drawing){
                    that.renderCategoryContent();
                }
            }
        });

        $(document).off('wheel.vodWheel').on('wheel.vodWheel', function(e){
            if ($('#vod-series-page').hasClass('hide')) return;
            var dy=e.originalEvent.deltaY;
            if (that.keys.focused_part==='category_selection'){
                that.handleMenusUpDown(dy>0?1:-1);
            } else if (that.keys.focused_part==='menu_selection'){
                that.handleMenusUpDown(dy>0?1:-1);
            }
            e.preventDefault();
        });
    },

    hideDetailPanel:function(){
        $('#vod-detail-panel').addClass('hidden').fadeOut(200);
        this.detail_panel_open=false;

        this.keys.focused_part='menu_selection';
        this.keys.detail_panel_selection=0;

        this.selected_movie=null;
        this.selected_movie_index=-1;

        // kategori ve film focus restore
        if (this.category_doms && this.category_doms[this.keys.category_selection]){
            this.hoverCategory(this.category_doms[this.keys.category_selection]);
        }
        if (this.menu_doms && this.menu_doms[this.keys.menu_selection]){
            $(prev_focus_dom).removeClass('active');
            $(this.menu_doms[this.keys.menu_selection]).addClass('active');
            prev_focus_dom=this.menu_doms[this.keys.menu_selection];
        }
    },

    handleDetailPanelNavigation:function(inc){
        var k=this.keys;
        var btns=$('#vod-detail-panel .vod-detail-btn');
        if(!btns.length) return;
        btns.removeClass('focused');
        k.detail_panel_selection += inc;
        if(k.detail_panel_selection<0) k.detail_panel_selection=btns.length-1;
        if(k.detail_panel_selection>=btns.length) k.detail_panel_selection=0;
        var $b=btns.eq(k.detail_panel_selection).addClass('focused');
        if($b.length) $b[0].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    },

    handleDetailPanelClick:function(){
        var btns=$('#vod-detail-panel .vod-detail-btn');
        var $b=btns.eq(this.keys.detail_panel_selection);
        if($b.length) $b.click();
    },

    handlePosterError:function(img){
        try{
            img.style.display='none';
            var p=img.parentElement;
            if(p){ p.style.backgroundImage='none'; p.classList.add('no-poster'); }
        }catch(e){ console.log('poster err',e); }
    },

    showDetailPanel:function(movie){
        if(!movie) return;
        $('#vod-detail-title').text(movie.name||'Unknown Title');
        $('#vod-detail-year').text(movie.year||new Date().getFullYear());
        $('#vod-detail-duration').text(this.formatDuration(movie.duration)||'120 min');
        $('#vod-detail-rating').html('★ '+(movie.rating||'8.5'));
        $('#vod-detail-description').text(movie.description||movie.plot||'No description available for this movie.');

        var $img=$('#vod-detail-poster'), $wrap=$img.parent();
        if(movie.image && movie.image.trim()!==''){ $img.attr('src',movie.image).show(); $wrap.removeClass('no-poster'); }
        else { $img.hide(); $wrap.addClass('no-poster'); }

        var bd=$('#vod-detail-backdrop-image');
        var bUrl=movie.backdrop_image||movie.image||'';
        if(bUrl && bUrl.trim()!=='') bd.css('background-image','url('+bUrl+')');
        else bd.css('background-image','none');

        this.populateGenres(movie);
        this.populateCast(movie);
        this.updateFavoriteButton(movie);

        this.detail_panel_open=true;
        $('#vod-detail-panel').removeClass('hidden').fadeIn(300);
    },

    formatDuration:function(d){
        if(!d) return '';
        var min = (typeof d==='number') ? Math.round(d/60) : parseInt(d,10);
        if(isNaN(min)||min<=0) return '';
        if(min>=60){ var h=Math.floor(min/60), m=min%60; return h+'h '+(m>0?m+'m':''); }
        return min+' min';
    },

    populateGenres:function(movie){
        var $c=$('#vod-detail-genre-list').empty();
        var g=[];
        if(movie.genre){
            if(Array.isArray(movie.genre)) g=movie.genre;
            else if(typeof movie.genre==='string') g=movie.genre.split(',').map(s=>s.trim());
        }
        if(!g.length) g = (this.current_movie_type==='vod')? ['Movie','Drama'] : ['Series','Drama'];
        g.forEach(function(x){ if(x&&x.trim()!=='') $c.append('<span class="vod-detail-genre">'+x.trim()+'</span>'); });
    },

    populateCast:function(movie){
        var $c=$('#vod-detail-cast-list').empty();
        var cast=[];
        if(movie.cast && Array.isArray(movie.cast)) cast = movie.cast.slice(0,6);
        else if(movie.actors){
            if(Array.isArray(movie.actors)) cast = movie.actors.slice(0,6);
            else if(typeof movie.actors==='string') cast = movie.actors.split(',').map(n=>({name:n.trim()})).slice(0,6);
        }
        if(!cast.length) cast=[{name:'Actor 1'},{name:'Actor 2'},{name:'Actor 3'}];

        cast.forEach(function(a){
            var html='<div class="vod-detail-cast-member">';
            if(a.photo && a.photo.trim()!==''){
                html+='<img src="'+a.photo+'" alt="'+(a.name||'Actor')+'" class="vod-detail-cast-photo" onerror="this.style.display=\'none\'">';
            } else {
                html+='<div class="vod-detail-cast-photo" style="background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div>';
            }
            html+='<div class="vod-detail-cast-name">'+(a.name||'Unknown')+'</div></div>';
            $c.append(html);
        });
    },

    updateFavoriteButton:function(movie){
        var $t=$('#favorite-text');
        var $i=$t.prev('i');
        var isFav=this.isFavorite(movie);
        if(isFav){ $t.text(LanguageManager.getText('remove_from_favorites')); $i.removeClass('fas fa-heart').addClass('fas fa-heart-broken'); }
        else { $t.text(LanguageManager.getText('add_to_favorites')); $i.removeClass('fas fa-heart-broken').addClass('fas fa-heart'); }
    },

    isFavorite:function(movie){
        try{
            var favs=JSON.parse(localStorage.getItem('movie_favorites')||'[]');
            return favs.some(f=> f.id===movie.id || f.name===movie.name);
        }catch(_){ return false; }
    },

    playMovie:function(){
        if(!this.selected_movie) return;
        this.hideDetailPanel();
        var movie=this.selected_movie;

        this.last_watched_series = {
            category_index: this.keys.category_selection,
            menu_selection: this.keys.menu_selection,
            movie_id: movie.id || movie._id || null
        };

        $('#vod-series-page').addClass('hide');

        if(this.current_movie_type==='vod'){
            current_movie=movie;
            var cname=this.current_category_name||'vod-series-page';
            var ctitle=this.getCategoryDisplayName();
            if (typeof setCurrentCategory==='function') setCurrentCategory(cname, ctitle);

            if(typeof vod_summary_page!=='undefined' && vod_summary_page.init){
                vod_summary_page.init('vod-series-page');
            } else if(typeof vod_series_player_page!=='undefined' && vod_series_player_page.init){
                vod_series_player_page.init(movie,'movie','vod-series-page', movie.url||'', true);
            } else {
                $('#vod-series-page').removeClass('hide');
            }
        } else {
            current_series=movie;
            var cname2=this.current_category_name||'vod-series-page';
            var ctitle2=this.getCategoryDisplayName();
            if (typeof setCurrentCategory==='function') setCurrentCategory(cname2, ctitle2);

            if(typeof series_summary_page!=='undefined' && series_summary_page.init){
                series_summary_page.init('vod-series-page');
            } else if(typeof vod_series_player_page!=='undefined' && vod_series_player_page.init){
                vod_series_player_page.init(movie,'series','vod-series-page', movie.url||'', true);
            } else {
                $('#vod-series-page').removeClass('hide');
            }
        }
    },

    toggleFavorite:function(){
        if(!this.selected_movie) return;
        var m=this.selected_movie;
        try{
            var favs=JSON.parse(localStorage.getItem('movie_favorites')||'[]');
            var i=favs.findIndex(f=> f.id===m.id || f.name===m.name);
            if(i>=0) favs.splice(i,1);
            else favs.push({id:m.id,name:m.name,image:m.image,type:this.current_movie_type,date_added:new Date().toISOString()});
            localStorage.setItem('movie_favorites', JSON.stringify(favs));
            this.updateFavoriteButton(m);
        }catch(e){ console.error('fav toggle err',e); }
    },

    shareMovie:function(){
        if(!this.selected_movie) return;
        var m=this.selected_movie;
        console.log('Sharing movie:', `Check out "${m.name}" - ${m.description || 'A great movie to watch!'}`);
        this.showNotification('Movie shared successfully!');
    },

    handleDetailPosterError:function(img){
        try{ img.style.display='none'; var p=img.parentElement; if(p) p.classList.add('no-poster'); }catch(e){}
    },

    showNotification:function(msg){
        var $n=$('<div class="movie-notification">'+msg+'</div>').css({
            position:'fixed',top:'20px',right:'20px',background:'rgba(0,120,212,0.9)',color:'#fff',
            padding:'15px 20px',borderRadius:'8px',zIndex:20000,fontSize:'16px',fontWeight:500
        });
        $('body').append($n);
        setTimeout(function(){ $n.fadeOut(300,function(){ $n.remove(); }); },3000);
    },

    restoreFocus:function(){
        this.keys.focused_part='menu_selection';
        if (this.last_selected_movie>=0 && this.menu_doms && this.menu_doms[this.last_selected_movie]){
            this.keys.menu_selection=this.last_selected_movie;
            $(prev_focus_dom).removeClass('active');
            $(this.menu_doms[this.last_selected_movie]).addClass('active');
            prev_focus_dom=this.menu_doms[this.last_selected_movie];
            if (this.menu_doms[this.last_selected_movie].scrollIntoView){
                this.menu_doms[this.last_selected_movie].scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
            }
        }
    },

    returnFromMovieDetail:function(previous_route){
        this.keys.focused_part='menu_selection';

        if (this.current_category_index>=0 && this.category_doms && this.current_category_index<this.category_doms.length){
            this.keys.category_selection=this.current_category_index;
            this.hoverCategory(this.category_doms[this.current_category_index]);
            this.showCategoryContent(); // ✅ güvenli yeniden yükle
        }

        if (this.keys.menu_selection>=0 && this.menu_doms && this.keys.menu_selection<this.menu_doms.length){
            $(prev_focus_dom).removeClass('active');
            $(this.menu_doms[this.keys.menu_selection]).addClass('active');
            prev_focus_dom=this.menu_doms[this.keys.menu_selection];
        }

        this.restoreFocus();
    },

    setupPage:function(){
        var pageTitle = (this.current_movie_type==='vod')
          ? LanguageManager.getText('movies','Movies')
          : LanguageManager.getText('series','Series');  // ✅ doğru değişken
        $('#vod-series-current-category').text(pageTitle);
        $('#vod-series-search-input').attr('placeholder', LanguageManager.getText('search_placeholder'));
        if (window.LanguageManager && typeof LanguageManager.updateTexts==='function') {
            LanguageManager.updateTexts();
        }
    },

    cleanMovieName:function(name){
        if(!name) return '';
        var s = name
          .replace(/^\d+[-._\s]+/g,'')
          .replace(/^[\d\s\-._]+/g,'')
          .replace(/\s+/g,' ')
          .trim();
        return s.length?s:name;
    },

    goBackToCategory:function(){
        if(this.detail_panel_open){ this.hideDetailPanel(); return; }
        if (this.keys.focused_part==="menu_selection"){
            this.keys.focused_part="category_selection";
            if (this.category_doms && this.category_doms[this.keys.category_selection]){
                this.hoverCategory(this.category_doms[this.keys.category_selection]);
            }
        } else if (this.keys.focused_part==="category_selection"){
            this.goBackToHome();
        } else {
            this.goBack();
        }
    },

    refreshContent:function(){
        try{
            if (this.keys && typeof this.keys.category_selection==='number'){
                this.selectCategory(this.keys.category_selection);   // ✅ index ile güvenli çağrı
            }
            if (typeof home_operation!=='undefined' && home_operation.loadLatestMovies){
                home_operation.loadLatestMovies();
            }
        }catch(e){ console.error('refresh err',e); }
    },

    checkForNewContentOnLoad:function(){
        var that=this;
        setTimeout(function(){
            var key=storage_id+'_last_content_check';
            var last=localStorage.getItem(key);
            var now=Date.now();
            if (!last || (now-parseInt(last,10)) > (60*60*1000)){
                that.detectNewContent();
                localStorage.setItem(key, now.toString());
            }
        },2000);
    },

    detectNewContent:function(){
        try{
            var has=false;
            if (this.current_movie_type==='vod' && typeof VodModel!=='undefined'){
                var all=VodModel.getAllMovies();
                var recent=all.filter(function(m){
                    var d=m.added_timestamp||m.tse||m.added_date||m.added;
                    if(!d) return false;
                    var t=(typeof d==='string' && /^\d+$/.test(d)) ? (d.length===10? parseInt(d)*1000 : parseInt(d)) : Date.parse(d);
                    var three=Date.now()-3*24*60*60*1000;
                    return t>three;
                });
                if(recent.length>0){ has=true; }
            }
            if (this.current_movie_type==='series' && typeof SeriesModel!=='undefined'){
                var allS=SeriesModel.getAllMovies();
                var recentS=allS.filter(function(m){
                    var d=m.added_timestamp||m.tse||m.added_date||m.added;
                    if(!d) return false;
                    var t=(typeof d==='string' && /^\d+$/.test(d)) ? (d.length===10? parseInt(d)*1000 : parseInt(d)) : Date.parse(d);
                    var three=Date.now()-3*24*60*60*1000;
                    return t>three;
                });
                if(recentS.length>0){ has=true; }
            }

            if (has && this.current_category && (this.current_category.category_id==='all' ||
                this.current_category.category_name==='Tümü' || this.current_category.category_name==='All Movies' ||
                this.current_category.category_name==='All Series')){
                this.selectCategory(0);
            }
        }catch(e){ console.error('detect err',e); }
    }
};