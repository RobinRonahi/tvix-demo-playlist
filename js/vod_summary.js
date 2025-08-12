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
        $('#vod-summary-release-genre').text("");
        $('#vod-summary-release-length').text("");
        $('#vod-summary-release-age').text("");
        $('#vod-summary-release-director').text("");
        $('#vod-summary-release-cast').text("");
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
        $('#vod-summary-name-details').text(current_movie.name || '');
        $('#vod-banner-movie-name').text(current_movie.name || '');
        var poster = current_movie.stream_icon || current_movie.cover || current_movie.poster || current_movie.image || 'images/default_movie.png';
        $('.vod-series-background-img').attr('src', poster);
        $('.vod-summary-image-wrapper img').attr('src', poster).on('error', function(){ $(this).attr('src','images/default_movie.png'); });

        // Sayfa görünürlüğü
        current_route = "vod-summary-page";
        $('#vod-series-page').addClass('hide');
        $('#vod-summary-page').removeClass('hide');

        // Bilgiler
        if (settings.playlist_type === "xtreme") {
            this.loadMovieInfo();
        } else {
            this.displayBasicInfo();
        }

        // Benzer filmler
        this.loadSimilarMovies();

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

        $.getJSON(apiUrl)
            .done(function (response) {
                if (response && response.info) {
                    that.displayMovieInfo(response.info);
                } else {
                    that.displayBasicInfo();
                }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                console.error('Failed to load movie info:', textStatus, errorThrown);
                that.displayBasicInfo();
            });
    },

    displayMovieInfo: function (info) {
        $('#vod-summary-release-date').text(info.releasedate || info.year || '2023');
        $('#vod-summary-release-genre').text(info.genre || (window.LanguageManager ? LanguageManager.getText('movie', 'Movie') : 'Movie'));
        $('#vod-summary-release-length').text(info.duration || '120 min');
        $('#vod-summary-release-director').text(info.director || '');
        $('#vod-summary-release-cast').text(info.cast || '');
        $('#vod-summary-description').text(info.plot || info.description || (window.LanguageManager ? LanguageManager.getText('no_description', 'No description available.') : 'No description available.'));

        // Trailer
        if (info.youtube_trailer && info.youtube_trailer !== '') {
            current_movie.youtube_trailer = info.youtube_trailer;
            $('#vod-watch-trailer-button').show();
        }

        // Backdrop
        if (info.backdrop_path && info.backdrop_path !== '') {
            $('.vod-series-background-img').attr('src', info.backdrop_path);
        }
    },

    displayBasicInfo: function () {
        $('#vod-summary-release-date').text(current_movie.added || current_movie.year || '2023');
        $('#vod-summary-release-genre').text(current_movie.category_name || (window.LanguageManager ? LanguageManager.getText('movie', 'Movie') : 'Movie'));
        $('#vod-summary-release-length').text(current_movie.duration || '120 min');
        $('#vod-summary-description').text(current_movie.plot || current_movie.description || (window.LanguageManager ? LanguageManager.getText('no_description', 'No description available.') : 'No description available.'));
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
        $('#vod-summary-page').addClass('hide');
        $('#vod-series-page').removeClass('hide');
        current_route = this.prev_route || 'vod-series-page';

        if (typeof vod_series_page !== 'undefined' && typeof vod_series_page.restoreFocus === 'function') {
            vod_series_page.restoreFocus();
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

            case tvKey.RETURN:
                this.goBack();
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
    }
};