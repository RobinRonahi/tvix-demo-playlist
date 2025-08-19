"use strict";
var VodModel ={
    movies:[],
    category_name:'vod_categories',
    favourite_movie_count:200,
    recent_movie_count:15,
    movie_key:"stream_id",
    categories:[],
    saved_video_times:{},
    favourite_ids:[],
    stream_type:'vod',
    favourite_insert_position:'after',
    recent_insert_position:'before',
    latest_movies:[],
    adult_category_ids:[],
    latest_movie_count:50,


    init:function() {
        this.movies=[];
        this.categories=[];
        this.latest_movies=[];
        this.adult_category_ids=[];
    },
    
    // Poster kontrolü ve placeholder ayarlama fonksiyonu
    validateMoviePoster: function(movie) {
        if (!movie.stream_icon || 
            movie.stream_icon === '' || 
            movie.stream_icon === 'images/logo.png' ||
            movie.stream_icon.includes('logo.png')) {
            movie.stream_icon = default_movie_icon;
        }
        return movie;
    },
    
    // Yeni eklenen getAllMovies metodu - sistemdeki tüm filmleri getirir
    getAllMovies:function() {
        console.log('VodModel: Getting all movies for "All" category...');
        
        // Tüm kategorilerdeki filmleri topla
        var allMovies = [];
        var categories = this.categories.filter(function(category) {
            return category.category_id !== 'favourite' && category.category_id !== 'recent';
        });
        
        console.log('📂 Processing', categories.length, 'categories for all movies');
        
        for (var i=0; i < categories.length; i++) {
            if (categories[i].movies && categories[i].movies.length > 0) {
                console.log('📁 Category "' + categories[i].category_name + '" has', categories[i].movies.length, 'movies');
                allMovies = allMovies.concat(categories[i].movies);
            }
        }
        
        console.log('Total movies found:', allMovies.length);
        
        // Film tekrarlarını önlemek için film ID'lerine göre tekil hale getir
        var uniqueMovies = [];
        var uniqueIds = {};
        
        for (var i = 0; i < allMovies.length; i++) {
            var movieId = allMovies[i][this.movie_key];
            if (!uniqueIds[movieId]) {
                uniqueIds[movieId] = true;
                uniqueMovies.push(allMovies[i]);
            }
        }
        
        console.log('Unique movies after deduplication:', uniqueMovies.length);
        
        // Filmleri ekleme tarihine göre sırala (yeni eklenenler üstte)
        uniqueMovies.sort(function(a, b) {
            // Mümkün olan tüm timestamp alanlarını kontrol et
            var aDate = a.added_timestamp || a.tse || a.added_date || a.added || a.last_modified || 
                       a.timestamp || a.created_at || a.upload_date || a.date_added || a.created;
            var bDate = b.added_timestamp || b.tse || b.added_date || b.added || b.last_modified || 
                       b.timestamp || b.created_at || b.upload_date || b.date_added || b.created;
            
            if (aDate && bDate) {
                var aTime, bTime;
                
                // Timestamp'leri normalize et
                if (typeof aDate === 'string') {
                    if (/^\d+$/.test(aDate)) {
                        aTime = parseInt(aDate) * (aDate.length === 10 ? 1000 : 1);
                    } else {
                        aTime = new Date(aDate).getTime();
                    }
                } else {
                    aTime = parseInt(aDate) * (aDate.toString().length === 10 ? 1000 : 1);
                }
                
                if (typeof bDate === 'string') {
                    if (/^\d+$/.test(bDate)) {
                        bTime = parseInt(bDate) * (bDate.length === 10 ? 1000 : 1);
                    } else {
                        bTime = new Date(bDate).getTime();
                    }
                } else {
                    bTime = parseInt(bDate) * (bDate.toString().length === 10 ? 1000 : 1);
                }
                
                if (!isNaN(aTime) && !isNaN(bTime)) {
                    return bTime - aTime; // En yeni önce
                }
            }
            
            // Tarih yoksa ID'ye göre sırala (büyük ID'ler genellikle yeni içerikler)
            var aId = parseInt(a.stream_id || a.id || 0);
            var bId = parseInt(b.stream_id || b.id || 0);
            return bId - aId;
        });
        
        console.log('Movies sorted by date/ID, returning', uniqueMovies.length, 'movies');
        return uniqueMovies;
    },
    setCategories:function(categories){
        var stream_type=this.stream_type;
        var temps=localStorage.getItem(storage_id+settings.playlist.id+"_saved_"+stream_type+"_times");
        if(temps)
            this.saved_video_times=JSON.parse(temps);
        else
            this.saved_video_times={};
        var hidden_categories=localStorage.getItem(storage_id+settings.playlist.id+stream_type+"_hiddens");
        hidden_categories=hidden_categories==null ? [] : JSON.parse(hidden_categories);
        categories.map(function(category){
            category.is_hide = hidden_categories.includes(category.category_id);
        })
        this.categories=categories;
    },
    saveVideoTime:function(stream_id, time){
        var stream_type=this.stream_type;
        var saved_video_times=this.saved_video_times;
        saved_video_times[stream_id.toString()]=time;
        this.saved_video_times=saved_video_times;
        localStorage.setItem(storage_id+settings.playlist.id+"_saved_"+stream_type+"_times",JSON.stringify(saved_video_times));
    },
    removeVideoTime:function (stream_id) {
        var stream_type=this.stream_type;
        var saved_video_times=this.saved_video_times;
        delete saved_video_times[stream_id.toString()];
        this.saved_video_times=saved_video_times;
        localStorage.setItem(storage_id+settings.playlist.id+"_saved_"+stream_type+"_times",JSON.stringify(saved_video_times));
    },
    saveHiddenCategories:function(index,is_hide){
        var stream_type=this.stream_type;
        var categories=this.getCategories(true,false);
        categories[index].is_hide=is_hide;
        var category_id=categories[index].category_id;
        var hidden_category_ids=JSON.parse(localStorage.getItem(storage_id+settings.playlist.id+stream_type+"_hiddens"));
        if(hidden_category_ids==null)
            hidden_category_ids=[];
        if(is_hide && !hidden_category_ids.includes(category_id))  // if hide category,
            hidden_category_ids.push(category_id);
        else{  // if show category
            if(hidden_category_ids.includes(category_id)){
                for(var i=0;i<hidden_category_ids.length;i++){
                    if(hidden_category_ids[i]==category_id){
                        hidden_category_ids.splice(i,1);
                        break;
                    }
                }
            }
        }
        localStorage.setItem(storage_id+settings.playlist.id+stream_type+"_hiddens",JSON.stringify(hidden_category_ids))
    },
    getCategories:function(include_hide_category,include_favourite_recent){
        var categories=this.categories.filter(function(category){
            if(include_favourite_recent){
                if(!include_hide_category)
                    return !category.is_hide;
                else
                    return true;
            }
            else{
                if(!include_hide_category)
                    return !category.is_hide && (category.category_id!=="favourite" && category.category_id!=="recent");
                else
                    return category.category_id!=="favourite" && category.category_id!=="recent";
            }
        })
        return categories;
    },
    setMovies:function( movies){
        // Her film için poster kontrolü yap
        for (var i = 0; i < movies.length; i++) {
            movies[i] = this.validateMoviePoster(movies[i]);
        }
        this.movies=movies;
    },
    insertMoviesToCategories:function(){
        var stream_type=this.stream_type;
        var movies=this.movies;
        var categories=this.categories;
        var recent_category={
            category_id:'recent',
            category_name: window.LanguageManager ? window.LanguageManager.getText('recently_viewed') : 'Recently Viewed',
            parent_id:0,
            movies:[],
            is_hide:false
        }
        var favourite_category={
            category_id:'favourite',
            category_name: window.LanguageManager ? window.LanguageManager.getText('favourites') : 'Favourites',
            parent_id:0,
            movies:[],
            is_hide:false
        }
        var undefined_category={
            category_id:'undefined',
            category_name:'Uncategorized',
            parent_id:0,
            movies:[],
            is_hide:false
        }
        categories.push(undefined_category);
        var movie_id_key=this.movie_key;
        var recent_movie_ids=JSON.parse(localStorage.getItem(storage_id+settings.playlist.id+stream_type+"_recent"));
        var favourite_movie_ids=JSON.parse(localStorage.getItem(storage_id+settings.playlist.id+stream_type+"_favourite"));
        recent_movie_ids=recent_movie_ids==null ? [] : recent_movie_ids;
        favourite_movie_ids=favourite_movie_ids==null ? [] : favourite_movie_ids;
        this.favourite_ids=favourite_movie_ids;

        var recent_movies=[], favourite_movies=[];
        var that=this;
        var movies_map={};
        // movies.map(function(movie){
        for(var i=0;i<movies.length;i++){
            // for(var i=0;i<100;i++){
            var movie=movies[i];
            if(typeof movie.category_id=='undefined' || movie.category_id=='null' || movie.category_id==null)
                movie.category_id='undefined';
            var category_id=movie.category_id.toString()
            if(typeof movies_map[category_id]=="undefined"){
                movies_map[category_id]=[movie];
            }else{
                movies_map[category_id].push(movie);
            }
            movie.is_recent=false;
            if(recent_movie_ids.includes(movie[movie_id_key]))// if movie id is in recently viewed movie ids
            {
                if(that.recent_insert_position==="before")
                    recent_movies.unshift(movie);
                else
                    recent_movies.push(movie);
                movie.is_recent=true;
            }
            if(favourite_movie_ids.includes(movie[movie_id_key]))// if movie id is in recently viewed movie ids
            {
                if(that.favourite_insert_position==="before")
                    favourite_movies.unshift(movie);
                else
                    favourite_movies.push(movie);
            }
            // });
        }
        var adult_category_ids=[];
        for(var  i=0;i<categories.length;i++){ // except favourite, and recent movies
            var category_id=categories[i].category_id.toString();
            categories[i].movies=typeof movies_map[category_id]=='undefined' ? [] : movies_map[category_id];
            
            // Her kategorideki filmleri timestamp'e göre sırala (yeni eklenenler üstte)
            if(categories[i].movies && categories[i].movies.length > 0) {
                console.log('Sorting category "' + categories[i].category_name + '" with', categories[i].movies.length, 'movies');
                categories[i].movies = that.sortMoviesByTimestamp(categories[i].movies);
            }
            
            if(checkForAdult(categories[i],'category',[])){
                adult_category_ids.push(categories[i].category_id);
            }
        }
        recent_category.movies=recent_movies;
        favourite_category.movies=favourite_movies;
        categories.unshift(favourite_category);
        categories.unshift(recent_category);
        // categories.unshift(all_category);
        for(var i=0;i<categories.length;i++){
            if(categories[i].category_id==='undefined'){
                if(categories[i].movies.length==0){
                    categories.splice(i,1);
                }
                break;
            }
        }
        this.categories=categories;

        this.adult_category_ids=adult_category_ids;
        //*** Getting the latest Movies ***/
        movies=movies.sort(function(a,b){
            var a_new_key=parseFloat(a.added);
            if(isNaN(a_new_key))
                a_new_key=0;
            var b_new_key=parseFloat(b.added)
            if(isNaN(b_new_key))
                b_new_key=0;
            return (a_new_key<b_new_key ? 1
                :a_new_key>b_new_key ? -1 : 0);
        })
        var latest_movies=[];
        for(var i=0;i<movies.length;i++){
            if(latest_movies.length<this.latest_movie_count){
                if(!adult_category_ids.includes(movies[i].category_id)){
                    var movie_name=movies[i].name;
                    var adult_keywords=['xxx','sex','porn','adult','18+','+18'];
                    var is_adult=false;
                    for(var j=0;j<adult_keywords.length;j++){
                        if (movie_name.includes(adult_keywords[j])){
                            is_adult=true;
                            break;
                        }
                    }
                    if(!is_adult)
                        latest_movies.push(movies[i]);
                }
            }
            else
                break;
        }
        this.latest_movies=latest_movies;
        //****  End Getting Latst Movies ******/

        this.movies=[];
    },
    getRecentOrFavouriteCategoryPosition:function(kind){
        if(kind==='favourite')
            return 1;
        else
            return 0;
    },
    getRecentOrFavouriteCategory:function(kind){
        var category_index=this.getRecentOrFavouriteCategoryPosition(kind);
        return this.categories[category_index];
    },
    
    getCategoryMovies:function(category_id){
        for(var i = 0; i < this.categories.length; i++){
            if(this.categories[i].category_id == category_id){
                return this.categories[i].movies || [];
            }
        }
        return [];
    },
    
    setRecentOrFavouriteMovies:function(movies, kind){
        var stream_type=this.stream_type;
        var category_index=this.getRecentOrFavouriteCategoryPosition(kind);
        this.categories[category_index].movies=movies;
        var movie_id_key=this.movie_key;
        var movie_ids=movies.map(function(item){
            return item[movie_id_key];
        })
        if(kind==='favourite')
            this.favourite_ids=movie_ids;
        localStorage.setItem(storage_id+settings.playlist.id+stream_type+"_"+kind, JSON.stringify(movie_ids));
    },
    addRecentOrFavouriteMovie:function(movie, kind) {
        var category=this.getRecentOrFavouriteCategory(kind);
        var movies=category.movies;
        var exist=false;
        var movie_id_key=this.movie_key;
        var is_added=false; // if added, it will be true
        for(var i=0;i<movies.length;i++){
            if(movies[i][movie_id_key]==movie[movie_id_key]){
                exist=true;
                break;
            }
        }
        if(!exist){
            var insert_position=this[kind+"_insert_position"];
            if(insert_position==="before")
                movies.unshift(movie);
            else
                movies.push(movie);
            var max_count=this[kind+"_movie_count"];
            movies=movies.splice(0,max_count);
            this.setRecentOrFavouriteMovies(movies, kind)
            is_added=true;
        }
        return is_added;
    },
    removeRecentOrFavouriteMovie:function(movie_id, kind) {
        var movies=this.getRecentOrFavouriteCategory(kind).movies;
        var movie_id_key=this.movie_key;
        var is_removed=false;
        for(var i=0;i<movies.length;i++){
            if(movies[i][movie_id_key]==movie_id){
                movies.splice(i,1);
                is_removed=true;
                break;
            }
        }
        this.setRecentOrFavouriteMovies(movies,kind);
        return is_removed;
    },
    // Her kategorideki filmleri timestamp'e göre sıralama fonksiyonu
    sortMoviesByTimestamp: function(movies) {
        if (!movies || movies.length === 0) {
            return [];
        }
        
        return movies.slice().sort(function(a, b) {
            // Mümkün olan tüm timestamp alanlarını kontrol et
            var aTSE = a.added_timestamp || a.tse || a.added_date || a.added || a.last_modified || 
                      a.timestamp || a.created_at || a.upload_date || a.date_added || a.created;
            var bTSE = b.added_timestamp || b.tse || b.added_date || b.added || b.last_modified || 
                      b.timestamp || b.created_at || b.upload_date || b.date_added || b.created;
            
            // TSE değerleri varsa bunları kullan
            if (aTSE && bTSE) {
                var aTime, bTime;
                
                // String ise parse et, number ise direkt kullan
                if (typeof aTSE === 'string') {
                    // Unix timestamp string'i kontrol et
                    if (/^\d+$/.test(aTSE)) {
                        aTime = parseInt(aTSE) * (aTSE.length === 10 ? 1000 : 1); // 10 digit ise saniye, 13 digit ise milisaniye
                    } else {
                        aTime = new Date(aTSE).getTime();
                    }
                } else {
                    aTime = parseInt(aTSE) * (aTSE.toString().length === 10 ? 1000 : 1);
                }
                
                if (typeof bTSE === 'string') {
                    if (/^\d+$/.test(bTSE)) {
                        bTime = parseInt(bTSE) * (bTSE.length === 10 ? 1000 : 1);
                    } else {
                        bTime = new Date(bTSE).getTime();
                    }
                } else {
                    bTime = parseInt(bTSE) * (bTSE.toString().length === 10 ? 1000 : 1);
                }
                
                if (!isNaN(aTime) && !isNaN(bTime)) {
                    return bTime - aTime; // Azalan sıra (en yeni önce)
                }
            }
            
            // TSE yoksa ID'ye göre sırala (yeni içerikler genellikle büyük ID'lere sahip)
            var aId = parseInt(a.stream_id || a.id || 0);
            var bId = parseInt(b.stream_id || b.id || 0);
            return bId - aId; // Azalan sıra (en yeni ID önce)
        });
    },
}
