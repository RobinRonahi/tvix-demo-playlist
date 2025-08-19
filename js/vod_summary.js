"use strict";
var vod_summary_page = {
    keys: {
        index: 0,                // action button focus
        focused_part: "action_buttons", // action_buttons | similar_movies
        similar_index: 0
    },
    min_btn_index: 0,
    favourite_action: 0,  // 0 none, 1 added, -1 removed
    action_btns: $('.vod-action-btn'),
    is_favourite: false,
    is_loading: false,
    prev_route: '',
    similar_movies: [],

    init: function (prev_route) {
        this.prev_route = prev_route || 'vod-series-page';
        this.favourite_action = 0;
        this.is_loading = false;

        if (!window.current_movie) {
            console.error('No movie data found (current_movie is null).');
            this.goBack();
            return;
        }

        // DOM reset
        $('#vod-watch-trailer-button').hide();
        $('#vod-summary-release-date').text("");
        $('#vod-summary-genre').text("");
        $('#vod-summary-duration').text("");
        $('#vod-rating-text').text("");
        $('#vod-summary-director').text("");
        $('#vod-summary-cast').text("");
        $('.vod-summary-image-wrapper img').attr('src', '');
        if (typeof hideImg === 'function') hideImg($('.vod-series-background-img'));
        $('#vod-summary-description').text("");
        this.min_btn_index = 0;
        current_movie.info = {};
        this.keys.focused_part = "action_buttons";
        this.keys.index = 1; // Play varsayılan
        this.keys.similar_index = 0;
        this.action_btns = $('.vod-action-btn'); // tazeleyelim

        // Favori durumu
        if (Array.isArray(VodModel.favourite_ids) && VodModel.favourite_ids.includes(current_movie.stream_id)) {
            this.is_favourite = true;
            $('#vod-add-favourite-button').attr('data-action', 'remove');
            $('#vod-add-favourite-button span').text((window.LanguageManager ? LanguageManager.getText('remove_from_favorites', 'Remove from Favorites') : 'Remove from Favorites'));
            $('#vod-add-favourite-button i').removeClass('far').addClass('fas');
        } else {
            this.is_favourite = false;
            $('#vod-add-favourite-button').attr('data-action', 'add');
            $('#vod-add-favourite-button span').text((window.LanguageManager ? LanguageManager.getText('add_to_favorites', 'Add to Favorites') : 'Add to Favorites'));
            $('#vod-add-favourite-button i').removeClass('fas').addClass('far');
        }

        // Rating
        var rating = 0;
        if (typeof current_movie.rating === "undefined" || current_movie.rating === "") {
            rating = Math.floor(Math.random() * 5) + 5;
        } else {
            rating = parseFloat(current_movie.rating);
        }
        if (isNaN(rating)) rating = 8.5;

        $('#vod-rating-container').find('.rating-upper').css({ width: (rating * 10) + "%" });
        $('#vod-rating-mark').text(rating.toFixed(1));

        // Başlık & görseller
        $('#vod-summary-name').text(current_movie.name || '');
        $('#vod-banner-movie-name').text(current_movie.name || '');
        $('#vod-poster-movie-name').text(current_movie.name || current_movie.title || 'Film Adı');
        var poster = current_movie.stream_icon || current_movie.cover || current_movie.poster || current_movie.image || 'images/default_movie.png';
        $('.vod-series-background-img').attr('src', poster);
        $('.vod-summary-image-wrapper img').attr('src', poster).on('error', function(){ $(this).attr('src','images/default_movie.png'); });

        // Sayfa görünürlüğü
        current_route = "vod-summary-page";
        $('#vod-series-page').addClass('hide');
        $('#vod-summary-page').removeClass('hide');

        // Ana sayfa bottom bar'ını gizle
        $("#home-mac-address-container").hide();
        try { var el = document.getElementById('home-mac-address-container'); if (el) el.style.display = 'none'; } catch(_) {}
        // Clock ve diğer homepage elementlerini gizle  
        if (typeof hideHomepageElements === "function") hideHomepageElements();
        else if (typeof toggleBottomBar === "function") toggleBottomBar(false);

        // Bilgiler
        if (settings.playlist_type === "xtreme") {
            this.loadMovieInfo();
        } else {
            this.displayBasicInfo();
        }

        // Benzer filmler
        this.loadSimilarMovies();

        // Samsung A6/A9 key handling başlat
        this.initKeyHandling();

        // Varsayılan focus
        this.hoverButton(1);

        console.log('VOD Summary page initialized for movie:', current_movie.name);
    },

    loadMovieInfo: function () {
        var that = this;
        var movie_id = current_movie.stream_id;
        if (!movie_id) {
            console.error('No movie ID found');
            this.displayBasicInfo();
            return;
        }

        var apiUrl = api_host_url + '/player_api.php?username=' + encodeURIComponent(user_name) +
                     '&password=' + encodeURIComponent(password) +
                     '&action=get_vod_info&vod_id=' + encodeURIComponent(movie_id);
        
        console.log('Samsung TV - Loading movie info from:', apiUrl);
        console.log('Movie ID:', movie_id);

        $.getJSON(apiUrl)
            .done(function (response) {
                console.log('Samsung TV - API Response:', response);
                if (response && response.info) {
                    console.log('Samsung TV - Movie info found, using TMDB data');
                    that.displayMovieInfo(response.info);
                } else if (response && response.movie_data) {
                    console.log('Samsung TV - Movie data found, using movie_data');
                    that.displayMovieInfo(response.movie_data);
                } else {
                    console.log('Samsung TV - No detailed info, using basic data');
                    that.displayBasicInfo();
                }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                console.error('Samsung TV - Failed to load movie info:', textStatus, errorThrown);
                console.error('Samsung TV - Response:', jqXHR.responseText);
                that.displayBasicInfo();
            });
    },

    displayMovieInfo: function (info) {
        console.log('TMDB/Xtream API data received:', info);
        
        // Film adını poster altına yaz
        $('#vod-poster-movie-name').text(info.name || info.title || current_movie.name || 'Film Adı');
        
        // Label'ları dil sistemi ile doldur
        $('[data-word_code="release_date"]').text('Release Date');
        $('[data-word_code="genre"]').text('Genre');
        $('[data-word_code="duration"]').text('Duration'); 
        $('[data-word_code="age"]').text('Age');
        $('[data-word_code="director"]').text('Director');
        $('[data-word_code="cast"]').text('Cast');
        
        // Xtream/TMDB API'den gelen verilerle bilgileri doldur
        var releaseDate = info.releasedate || info.release_date || info.year || '2009-04-17';
        var genre = info.genre || info.genres || 'Thriller, Krimi, Mystery';
        var duration = info.duration || info.runtime || '127 min';
        var director = info.director || 'Anna Rane';  
        var cast = info.cast || 'Russell Crowe, Ben Affleck, Rachel McAdams, Helen Mirren, Robin Wright';
        var rating = info.rating || info.tmdb_rating || info.imdb_rating || '6.8';
        var plot = info.plot || info.description || info.overview || 'Die Zukunft des Kongressabgeordneten Stephen Collins sieht vielversprechend aus...';
        
        // Samsung TV için optimized field update
        $('#vod-summary-release-date').text(releaseDate);
        $('#vod-summary-release-genre').text(genre);
        $('#vod-summary-release-length').text(duration);
        $('#vod-summary-release-age').text(rating); // Age kısmına rating koyuyoruz
        $('#vod-summary-release-director').text(director);
        $('#vod-summary-release-cast').text(cast);
        
        // Rating display
        $('#vod-rating-text').text(rating);
        $('#vod-rating-mark').text(rating);
        
        // Description
        $('#vod-summary-description').text(plot);

        // Trailer - YouTube ID'yi al
        if (info.youtube_trailer && info.youtube_trailer !== '') {
            current_movie.youtube_trailer = info.youtube_trailer;
            $('#vod-watch-trailer-button').show();
        }

        // TMDB Poster ve Backdrop
        if (info.movie_image || info.poster_url || info.poster_path) {
            var posterUrl = info.movie_image || info.poster_url || ('https://image.tmdb.org/t/p/w600_and_h900_bestv2' + info.poster_path);
            $('.vod-summary-image-wrapper img').attr('src', posterUrl);
        }
        
        if (info.backdrop_path) {
            var backdropUrl = 'https://image.tmdb.org/t/p/w1280' + info.backdrop_path;
            $('.vod-series-background-img').attr('src', backdropUrl);
        }
        
        console.log('Samsung TV - Film bilgileri güncellendi:', {
            releaseDate: releaseDate,
            genre: genre, 
            duration: duration,
            director: director,
            cast: cast,
            rating: rating
        });
    },

    displayBasicInfo: function () {
        // Film adını poster altına yaz
        $('#vod-poster-movie-name').text(current_movie.name || current_movie.title || 'Film Adı');
        
        // Debug: Movie datasını konsola yazdır
        console.log('Samsung TV - Current movie data (basic):', current_movie);
        
        // Label'ları dil sistemi ile doldur
        $('[data-word_code="release_date"]').text('Release Date');
        $('[data-word_code="genre"]').text('Genre');
        $('[data-word_code="duration"]').text('Duration');
        $('[data-word_code="age"]').text('Age');
        $('[data-word_code="director"]').text('Director');
        $('[data-word_code="cast"]').text('Cast');
        
        // Doğru ID'lerle bilgileri güncelle - fallback değerlerle (Samsung TV için)
        var releaseDate = current_movie.added || current_movie.year || current_movie.release_date || current_movie.releaseDate || '2016-09-09';
        var genre = current_movie.category_name || current_movie.genre || 'Action/Drama';
        var duration = current_movie.duration || current_movie.length || '120 min';
        var age = current_movie.age_rating || current_movie.age || current_movie.rating || 'PG-13';
        var director = current_movie.director || current_movie.directors || 'Director';
        var cast = current_movie.cast || current_movie.actors || 'Cast Members';
        
        $('#vod-summary-release-date').text(releaseDate);
        $('#vod-summary-release-genre').text(genre);
        $('#vod-summary-release-length').text(duration);
        $('#vod-summary-release-age').text(age);
        $('#vod-summary-release-director').text(director);
        $('#vod-summary-release-cast').text(cast);
        
        // Rating
        var rating = current_movie.rating || current_movie.tmdb_rating || current_movie.imdb_rating || '7.5';
        $('#vod-rating-text').text(rating);
        $('#vod-rating-mark').text(rating);
        
        // Description
        var description = current_movie.plot || current_movie.description || current_movie.overview || 'No description available.';
        $('#vod-summary-description').text(description);
        
        // Debug: Hangi verilerin yazıldığını konsola yazdır
        console.log('Samsung TV - Film bilgileri yazıldı (basic):', {
            releaseDate: releaseDate,
            genre: genre,
            duration: duration,
            age: age,
            director: director,
            cast: cast,
            rating: rating
        });
    },

    loadSimilarMovies: function () {
        if (!current_movie || !current_movie.category_id) {
            $('#similar-movies-container').hide();
            this.similar_movies = [];
            return;
        }

        // Tür belirle
        var movieType = (typeof vod_series_page !== 'undefined' && vod_series_page.current_movie_type) ? vod_series_page.current_movie_type : 'vod';

        // Aynı kategoriden filmler
        var categoryMovies = [];
        if (movieType === 'vod' || movieType === 'movie') {
            categoryMovies = (typeof VodModel !== 'undefined' && VodModel.getCategoryMovies)
                ? VodModel.getCategoryMovies(current_movie.category_id) : [];
        } else {
            categoryMovies = (typeof SeriesModel !== 'undefined' && SeriesModel.getCategoryMovies)
                ? SeriesModel.getCategoryMovies(current_movie.category_id) : [];
        }

        if (!categoryMovies || categoryMovies.length <= 1) {
            $('#similar-movies-container').hide();
            this.similar_movies = [];
            return;
        }

        // Mevcut filmi dışarı al
        var similarMovies = categoryMovies.filter(function (movie) {
            return movie.stream_id !== current_movie.stream_id;
        }).slice(0, 40);

        this.renderSimilarMovies(similarMovies);
    },

    renderSimilarMovies: function (movies) {
        var container = $('#similar-movies-container');
        if (!movies || movies.length === 0) {
            container.hide();
            this.similar_movies = [];
            return;
        }

        var html = '';
        movies.forEach(function (movie, index) {
            var posterUrl = movie.cover || movie.stream_icon || movie.poster || movie.image || 'images/default_movie.png';
            var movieName = movie.name || 'Movie';
            html +=
                '<div class="similar-movie-item" data-movie-index="' + index + '" onclick="vod_summary_page.selectSimilarMovie(' + index + ')">' +
                '  <img src="' + posterUrl + '" alt="' + movieName.replace(/"/g, '&quot;') + '" class="similar-movie-poster" onerror="this.src=\'images/default_movie.png\'">' +
                '</div>';
        });

        container.html(html).show();
        this.similar_movies = movies;
        this.keys.similar_index = 0;
        // ilk ögeyi görünür yap
        this.highlightSimilarMovie(0);
    },

    selectSimilarMovie: function (index) {
        if (!this.similar_movies || !this.similar_movies[index]) {
            console.error('Similar movie not found:', index);
            return;
        }
        current_movie = this.similar_movies[index];
        this.init(this.prev_route); // hızlı yeniden yükleme
    },

    goBack: function () {
        // Key handling temizle
        this.destroyKeyHandling();
        
        $('#vod-summary-page').addClass('hide');
        
        // Önceki sayfaya göre dönüş yapısı
        if (this.prev_route === 'home-page' || this.prev_route === 'top-menu-page') {
            // Ana sayfaya dönüyorsa bottom bar'ı göster
            $("#home-mac-address-container").css("display", "flex").show();
            if (typeof showHomepageElements === "function") showHomepageElements();
            else if (typeof toggleBottomBar === "function") toggleBottomBar(true);
            $('#home-page').removeClass('hide');
            current_route = 'home-page';
            
            if (typeof home_operation !== 'undefined' && home_operation.init) {
                home_operation.init();
            }
        } else {
            // VOD series sayfasına dönüyorsa
            $('#vod-series-page').removeClass('hide');
            current_route = this.prev_route || 'vod-series-page';
            
            if (typeof vod_series_page !== 'undefined' && typeof vod_series_page.restoreFocus === 'function') {
                vod_series_page.restoreFocus();
            }
        }
    },

    showTrailerVideo: function () {
        if (current_movie.youtube_trailer && current_movie.youtube_trailer !== '') {
            var videoId = this.extractYouTubeId(current_movie.youtube_trailer);
            if (videoId && typeof trailer_page !== 'undefined' && typeof trailer_page.init === 'function') {
                trailer_page.init(videoId, 'vod-summary-page');
            }
        } else {
            console.log('No trailer available for this movie');
        }
    },

    extractYouTubeId: function (url) {
        if (!url) return null;
        var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        var match = url.match(regExp);
        if (match && match[2] && match[2].length === 11) return match[2];
        if (url.length === 11) return url; // direkt ID verilmişse
        return null;
    },

    showMovie: function () {
        var movie_url = '';
        var movie_id = current_movie.stream_id;

        if (settings.playlist_type === "xtreme") {
            movie_url = getMovieUrl(movie_id, 'movie', 'mp4');
        } else if (settings.playlist_type === 'type1') {
            movie_url = current_movie.url || '';
        }

        if (typeof vod_series_player_page !== 'undefined' && typeof vod_series_player_page.init === 'function') {
            vod_series_player_page.init(current_movie, 'movie', 'vod-summary-page', movie_url, true);
        } else {
            console.error('vod_series_player_page not found');
        }
    },

    toggleFavourite: function () {
        var movie_id = current_movie.stream_id;

        // Standardize: obje ile ekle, id ile sil (uygulamanın diğer bölümleriyle uyumlu)
        if (!this.is_favourite) {
            if (typeof VodModel.addRecentOrFavouriteMovie === 'function') {
                VodModel.addRecentOrFavouriteMovie(current_movie, 'favourite');
            }
            this.is_favourite = true;
            this.favourite_action = 1;
            $('#vod-add-favourite-button').attr('data-action', 'remove');
            $('#vod-add-favourite-button span').text((window.LanguageManager ? LanguageManager.getText('remove_from_favorites', 'Remove from Favorites') : 'Remove from Favorites'));
            $('#vod-add-favourite-button i').removeClass('far').addClass('fas');
            console.log('Movie added to favorites:', current_movie.name);
        } else {
            if (typeof VodModel.removeRecentOrFavouriteMovie === 'function') {
                VodModel.removeRecentOrFavouriteMovie(movie_id, 'favourite');
            }
            this.is_favourite = false;
            this.favourite_action = -1;
            $('#vod-add-favourite-button').attr('data-action', 'add');
            $('#vod-add-favourite-button span').text((window.LanguageManager ? LanguageManager.getText('add_to_favorites', 'Add to Favorites') : 'Add to Favorites'));
            $('#vod-add-favourite-button i').removeClass('fas').addClass('far');
            console.log('Movie removed from favorites:', current_movie.name);
        }
    },

    hoverButton: function (index) {
        this.keys.index = index;
        $('.vod-action-btn').removeClass('active');
        var $btn = $('.vod-action-btn').eq(index);
        $btn.addClass('active');
        current_route = "vod-summary-page";
    },

    keyMove: function (increment) {
        var total = $('.vod-action-btn').length;
        if (!total) return;
        this.keys.index = (this.keys.index + increment + total) % total;
        this.hoverButton(this.keys.index);
    },

    keyClick: function () {
        var $btn = $('.vod-action-btn').eq(this.keys.index);
        if ($btn.length) $btn.click();
    },

    HandleKey: function (e) {
        if (this.is_loading) return;

        switch (e.keyCode) {
            case tvKey.RIGHT:
                if (this.keys.focused_part === "action_buttons") this.keyMove(1);
                else if (this.keys.focused_part === "similar_movies") this.moveSimilarSelection(1);
                break;

            case tvKey.LEFT:
                if (this.keys.focused_part === "action_buttons") this.keyMove(-1);
                else if (this.keys.focused_part === "similar_movies") this.moveSimilarSelection(-1);
                break;

            case tvKey.DOWN:
                if (this.keys.focused_part === "action_buttons" && this.similar_movies.length > 0) {
                    this.keys.focused_part = "similar_movies";
                    this.highlightSimilarMovie(this.keys.similar_index || 0);
                    $('.vod-action-btn').removeClass('active');
                }
                break;

            case tvKey.UP:
                if (this.keys.focused_part === "similar_movies") {
                    this.keys.focused_part = "action_buttons";
                    this.hoverButton(this.keys.index || 0);
                    $('.similar-movie-item').removeClass('focused');
                }
                break;

            case tvKey.ENTER:
                if (this.keys.focused_part === "action_buttons") this.keyClick();
                else if (this.keys.focused_part === "similar_movies") this.selectSimilarMovie(this.keys.similar_index);
                break;

            // BACK tuşu - Samsung TV için kritik
            case tvKey.RETURN:
            case tvKey.EXIT:
            case 10009:            // Samsung TV BACK key
            case 8:                // BACKSPACE (some Samsung models)
                this.goBack();
                break;

            // Samsung TV specific navigation keys
            case tvKey.CH_UP:
            case 427:              // CHANNEL_UP
            case 33:               // PAGE_UP
                if (this.keys.focused_part === "action_buttons") {
                    this.keys.focused_part = "similar_movies";
                    if (this.similar_movies.length > 0) {
                        this.highlightSimilarMovie(0);
                        $('.vod-action-btn').removeClass('active');
                    }
                }
                break;

            case tvKey.CH_DOWN:
            case 428:              // CHANNEL_DOWN  
            case 34:               // PAGE_DOWN
                if (this.keys.focused_part === "similar_movies") {
                    this.keys.focused_part = "action_buttons";
                    this.hoverButton(this.keys.index || 0);
                    $('.similar-movie-item').removeClass('focused');
                }
                break;

            // Additional Samsung A6/A9 compatibility
            case 145:              // MENU key - show action buttons
                this.keys.focused_part = "action_buttons";
                this.hoverButton(0);
                break;

            case 415:              // PLAY key - start movie
                if (this.keys.focused_part === "action_buttons") {
                    this.keys.index = 0; // Play button
                    this.keyClick();
                } else if (this.keys.focused_part === "similar_movies") {
                    this.selectSimilarMovie(this.keys.similar_index);
                }
                break;

            default:
                console.log("Unhandled key in vod_summary:", e.keyCode);
        }
    },

    moveSimilarSelection: function (increment) {
        if (!this.similar_movies.length) return;
        this.keys.similar_index = (this.keys.similar_index + increment + this.similar_movies.length) % this.similar_movies.length;
        this.highlightSimilarMovie(this.keys.similar_index);
    },

    highlightSimilarMovie: function (index) {
        var $items = $('#similar-movies-container .similar-movie-item');
        $items.removeClass('focused');
        var $selected = $items.eq(index);
        $selected.addClass('focused');

        // kaydırma: ID ile tutarlı
        var $container = $('#similar-movies-container');
        var itemLeft = $selected.position().left;
        var itemWidth = $selected.outerWidth(true);
        var containerWidth = $container.width();
        var scrollLeft = $container.scrollLeft();

        if (itemLeft < 0) {
            $container.animate({ scrollLeft: Math.max(0, scrollLeft + itemLeft - 20) }, 200);
        } else if (itemLeft + itemWidth > containerWidth) {
            var delta = (itemLeft - containerWidth + itemWidth + 20);
            $container.animate({ scrollLeft: scrollLeft + delta }, 200);
        }
    },

    // Button click handlers
    watchTrailer: function() {
        if (current_movie && current_movie.youtube_trailer) {
            console.log('Opening trailer:', current_movie.youtube_trailer);
            // Implement trailer playing logic here
            window.open(current_movie.youtube_trailer, '_blank');
        } else {
            console.log('No trailer available');
        }
    },

    watchMovie: function() {
        if (!current_movie) {
            console.error('No movie selected');
            return;
        }
        
        console.log('Starting movie:', current_movie.name);
        
        // Player'a geçiş
        try {
            if (typeof vod_series_player_page !== 'undefined' && vod_series_player_page.init) {
                vod_series_player_page.init(current_movie, 'vod-summary-page');
                // Use showPage instead of navigation
                if (typeof showPage === 'function') {
                    showPage('vod-series-player-page');
                } else {
                    // Fallback method
                    $('#vod-summary-page').addClass('hide');
                    $('#vod-series-player-page').removeClass('hide');
                    current_route = 'vod-series-player-page';
                }
            } else {
                console.error('vod_series_player_page not available');
            }
        } catch (error) {
            console.error('Error starting movie player:', error);
        }
    },

    toggleFavourite: function() {
        if (!current_movie) return;
        
        if (this.is_favourite) {
            // Remove from favourites
            this.removeFromFavourites();
        } else {
            // Add to favourites  
            this.addToFavourites();
        }
    },

    addToFavourites: function() {
        if (!current_movie || !VodModel) return;
        
        try {
            VodModel.addToFavourites(current_movie.stream_id);
            this.is_favourite = true;
            $('#vod-add-favourite-button').attr('data-action', 'remove');
            $('#vod-add-favourite-button span').text('Remove from Favorites');
            console.log('Movie added to favourites');
        } catch (error) {
            console.error('Error adding to favourites:', error);
        }
    },

    removeFromFavourites: function() {
        if (!current_movie || !VodModel) return;
        
        try {
            VodModel.removeFromFavourites(current_movie.stream_id);
            this.is_favourite = false;
            $('#vod-add-favourite-button').attr('data-action', 'add');
            $('#vod-add-favourite-button span').text('Add to Favorites');
            console.log('Movie removed from favourites');
        } catch (error) {
            console.error('Error removing from favourites:', error);
        }
    },

    goBackToCategory: function() {
        if (!current_movie) {
            this.goBack();
            return;
        }
        
        // Determine which category to go back to
        var categoryName = current_movie.category_name || 'Movies';
        
        try {
            // Go back to VOD series page with the specific category
            if (typeof vod_series_page !== 'undefined' && vod_series_page.init) {
                vod_series_page.category_name = categoryName;
                if (typeof showPage === 'function') {
                    showPage('vod-series-page');
                } else {
                    // Fallback method
                    $('#vod-summary-page').addClass('hide');
                    $('#vod-series-page').removeClass('hide');
                    current_route = 'vod-series-page';
                }
            } else {
                // Fallback to general back navigation
                this.goBack();
            }
        } catch (error) {
            console.error('Error going back to category:', error);
            this.goBack();
        }
    },

    backToCategory: function() {
        // Alias for goBackToCategory to match HTML onclick
        this.goBackToCategory();
    },

    // Samsung A6/A9 Key Navigation System
    initKeyHandling: function() {
        var self = this;
        
        // Remove existing event listener if any
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        
        this._keyHandler = function(event) {
            self.handleKeyEvent(event);
        };
        
        document.addEventListener('keydown', this._keyHandler);
        console.log('[VOD Summary] Key handling initialized for Samsung A6/A9');
    },

    destroyKeyHandling: function() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
    },

    handleKeyEvent: function(event) {
        // Only handle keys when on vod-summary-page
        if (current_route !== 'vod-summary-page') return;

        var keyCode = event.keyCode || event.which;
        console.log('[VOD Summary] Key pressed:', keyCode);

        // Use tvKey constants if available
        var tvKey = window.tvKey || {};

        switch (keyCode) {
            // LEFT - Sağ-sol navigasyon (butonlar arası)
            case tvKey.LEFT || 37:
                this.navigateLeft();
                event.preventDefault();
                break;

            // RIGHT - Sağ-sol navigasyon (butonlar arası)  
            case tvKey.RIGHT || 39:
                this.navigateRight();
                event.preventDefault();
                break;

            // DOWN - Aşağı inme (benzer filmler şeridine)
            case tvKey.DOWN || 40:
                this.navigateDown();
                event.preventDefault();
                break;

            // UP - Yukarı çıkma (butonlara geri dön)
            case tvKey.UP || 38:
                this.navigateUp();
                event.preventDefault();
                break;

            // ENTER/OK - Seçim yapma
            case tvKey.ENTER || 13:
            case tvKey.ENTER_ALT || 29443:
            case tvKey.ENTER_ALT2 || 65376:
                this.handleEnterKey();
                event.preventDefault();
                break;

            // RETURN/BACK - Geri dönme
            case tvKey.RETURN || 10009:
            case tvKey.RETURN_ALT || 65385:
            case tvKey.EXIT || 10182:
                this.goBackToCategory();
                event.preventDefault();
                break;

            // Number keys for quick actions
            case 49: // 1 - Watch Movie
                this.watchMovie();
                break;
            case 50: // 2 - Watch Trailer  
                this.watchTrailer();
                break;
            case 51: // 3 - Add to Favourites
                this.toggleFavourite();
                break;
            case 52: // 4 - Back to Category
                this.goBackToCategory();
                break;
        }
    },

    navigateLeft: function() {
        if (this.keys.focused_part === "action_buttons") {
            // Butonlar arasında sola git
            if (this.keys.index > 0) {
                this.keys.index--;
                this.updateButtonFocus();
            }
        } else if (this.keys.focused_part === "similar_movies") {
            // Benzer filmler arasında sola git
            if (this.keys.similar_index > 0) {
                this.keys.similar_index--;
                this.updateSimilarMoviesFocus();
            }
        }
    },

    navigateRight: function() {
        if (this.keys.focused_part === "action_buttons") {
            // Butonlar arasında sağa git
            var maxIndex = $('.vod-action-btn:visible').length - 1;
            if (this.keys.index < maxIndex) {
                this.keys.index++;
                this.updateButtonFocus();
            }
        } else if (this.keys.focused_part === "similar_movies") {
            // Benzer filmler arasında sağa git
            var maxSimilar = this.similar_movies.length - 1;
            if (this.keys.similar_index < maxSimilar) {
                this.keys.similar_index++;
                this.updateSimilarMoviesFocus();
            }
        }
    },

    navigateDown: function() {
        if (this.keys.focused_part === "action_buttons") {
            // Butonlardan benzer filmler şeridine in
            if (this.similar_movies && this.similar_movies.length > 0) {
                this.keys.focused_part = "similar_movies";
                this.keys.similar_index = 0;
                this.updateSimilarMoviesFocus();
                this.removeButtonFocus();
            }
        }
    },

    navigateUp: function() {
        if (this.keys.focused_part === "similar_movies") {
            // Benzer filmlerden butonlara çık
            this.keys.focused_part = "action_buttons";
            this.updateButtonFocus();
            this.removeSimilarMoviesFocus();
        }
    },

    updateButtonFocus: function() {
        // Tüm butonlardan focus'u kaldır
        $('.vod-action-btn').removeClass('focused');
        
        // Mevcut butonlara focus ekle
        var visibleButtons = $('.vod-action-btn:visible');
        if (this.keys.index < visibleButtons.length) {
            $(visibleButtons[this.keys.index]).addClass('focused').focus();
        }
    },

    removeButtonFocus: function() {
        $('.vod-action-btn').removeClass('focused').blur();
    },

    updateSimilarMoviesFocus: function() {
        // Benzer film elementlerine focus ekle
        $('.similar-movie-item').removeClass('focused');
        var similarItems = $('.similar-movie-item');
        if (this.keys.similar_index < similarItems.length) {
            $(similarItems[this.keys.similar_index]).addClass('focused').focus();
        }
    },

    removeSimilarMoviesFocus: function() {
        $('.similar-movie-item').removeClass('focused').blur();
    },

    handleEnterKey: function() {
        if (this.keys.focused_part === "action_buttons") {
            // Seçili butona tıkla
            var visibleButtons = $('.vod-action-btn:visible');
            if (this.keys.index < visibleButtons.length) {
                $(visibleButtons[this.keys.index]).click();
            }
        } else if (this.keys.focused_part === "similar_movies") {
            // Seçili benzer filme tıkla
            var similarItems = $('.similar-movie-item');
            if (this.keys.similar_index < similarItems.length) {
                $(similarItems[this.keys.similar_index]).click();
            }
        }
    }
};

// Initialize key handling when page loads
$(document).ready(function() {
    if (typeof vod_summary_page !== 'undefined') {
        vod_summary_page.initKeyHandling();
    }
});
