"use strict";
/**
 * SAMSUNG TV MEMORY OPTIMIZER & CLEANUP UTILITY
 * - Prevents memory leaks and optimizes performance
 * - ES5 only (A6/A9 safe): no Sets, default params, or arrow functions
 */

var MemoryOptimizer = {
    // Central registries
    activeTimers: [],            // stores timer IDs
    activeDOMObservers: [],      // stores observers (e.g., IntersectionObserver)
    cleanupIntervals: [],

    // Main cleanup
    cleanup: function () {
        try {
            console.log('MemoryOptimizer: cleanup started');
            this.clearAllTimers();
            this.clearDOMObservers();
            this.clearEventListeners();
            this.cleanupChannelOperations();
            this.cleanupMediaElements();
            this.cleanupImageCache();
            this.forceGarbageCollection();
            console.log('MemoryOptimizer: cleanup completed');
        } catch (error) {
            console.error('MemoryOptimizer: cleanup error:', error);
        }
    },

    // Timers
    clearAllTimers: function () {
        try {
            // Channel page scoped timers
            if (typeof channel_page !== 'undefined') {
                if (channel_page.progressbar_timer) { clearInterval(channel_page.progressbar_timer); channel_page.progressbar_timer = null; }
                if (channel_page.full_screen_timer) { clearTimeout(channel_page.full_screen_timer); channel_page.full_screen_timer = null; }
                if (channel_page.channel_hover_timer) { clearTimeout(channel_page.channel_hover_timer); channel_page.channel_hover_timer = null; }
                if (channel_page.category_hover_timer) { clearTimeout(channel_page.category_hover_timer); channel_page.category_hover_timer = null; }
                if (channel_page.next_programme_timer) { clearTimeout(channel_page.next_programme_timer); channel_page.next_programme_timer = null; }
                if (channel_page.search_debounce_timer) { clearTimeout(channel_page.search_debounce_timer); channel_page.search_debounce_timer = null; }
            }

            // Generic timers
            for (var i = 0; i < this.activeTimers.length; i++) {
                var t = this.activeTimers[i];
                try { clearTimeout(t); } catch (_) {}
                try { clearInterval(t); } catch (_) {}
            }
            this.activeTimers = [];
            console.log('MemoryOptimizer: timers cleared');
        } catch (e) {
            console.warn('MemoryOptimizer: clearAllTimers error:', e);
        }
    },

    // DOM observers
    clearDOMObservers: function () {
        try {
            for (var i = 0; i < this.activeDOMObservers.length; i++) {
                var obs = this.activeDOMObservers[i];
                if (obs && typeof obs.disconnect === 'function') {
                    obs.disconnect();
                }
            }
            this.activeDOMObservers = [];
            console.log('MemoryOptimizer: DOM observers cleared');
        } catch (e) {
            console.warn('MemoryOptimizer: clearDOMObservers error:', e);
        }
    },

    // Event listeners
    clearEventListeners: function () {
        try {
            // Remove direct jQuery handlers on common nodes (scoped)
            $('.channel-menu-item').off();
            $('.search-item-wrapper').off();
            $('.category-menu-item').off();
            $('#modern-search-input').off();
            $('#search-value').off();

            // Remove delegated handlers installed by this module
            $(document).off('.memopt');

            console.log('MemoryOptimizer: event listeners cleared');
        } catch (error) {
            console.error('MemoryOptimizer: event listener clear error:', error);
        }
    },

    // Channel operations cleanup
    cleanupChannelOperations: function () {
        try {
            if (typeof channel_page !== 'undefined') {
                channel_page.movies = [];
                channel_page.search_items = [];
                channel_page.filtered_movies = [];
                channel_page.current_search_results = [];
                channel_page.programmes = [];

                channel_page.category_doms = [];
                channel_page.channel_doms = [];
            }
            console.log('MemoryOptimizer: channel operations cleared');
        } catch (e) {
            console.warn('MemoryOptimizer: cleanupChannelOperations error:', e);
        }
    },

    // Media elements (video/audio)
    cleanupMediaElements: function () {
        try {
            $('video').each(function () {
                try {
                    this.pause();
                } catch (_) {}
                try {
                    this.removeAttribute('src');
                } catch (_) {}
                try {
                    this.load();
                } catch (_) {}
                try {
                    $(this).remove();
                } catch (_) {}
            });

            $('audio').each(function () {
                try {
                    this.pause();
                } catch (_) {}
                try {
                    this.removeAttribute('src');
                } catch (_) {}
                try {
                    this.load();
                } catch (_) {}
                try {
                    $(this).remove();
                } catch (_) {}
            });

            // Stop Samsung AVPlay if active
            try {
                if (window.webapis && webapis.avplay) {
                    webapis.avplay.stop();
                    webapis.avplay.close();
                }
            } catch (_) {}

            console.log('MemoryOptimizer: media elements cleared');
        } catch (error) {
            console.error('MemoryOptimizer: media cleanup error:', error);
        }
    },

    // Image cache
    cleanupImageCache: function () {
        try {
            $('img').each(function () {
                var $img = $(this);
                var src = $img.attr('src');
                if (!src || src === 'undefined') {
                    try { $img.remove(); } catch (_) {}
                }
            });
            console.log('MemoryOptimizer: image cache cleaned');
        } catch (error) {
            console.error('MemoryOptimizer: image cache cleanup error:', error);
        }
    },

    // GC triggers (if available on device)
    forceGarbageCollection: function () {
        try {
            if (window.gc && typeof window.gc === 'function') {
                window.gc();
                console.log('MemoryOptimizer: GC triggered (window.gc)');
            } else if (window.webkitClearMemoryCache && typeof window.webkitClearMemoryCache === 'function') {
                window.webkitClearMemoryCache();
                console.log('MemoryOptimizer: WebKit memory cache cleared');
            }
        } catch (error) {
            console.error('MemoryOptimizer: GC error:', error);
        }
    },

    // Memory status report
    getMemoryStatus: function () {
        try {
            if (window.performance && window.performance.memory) {
                var memory = window.performance.memory;
                var status = {
                    used: Math.round(memory.usedJSHeapSize / 1048576) + 'MB',
                    total: Math.round(memory.totalJSHeapSize / 1048576) + 'MB',
                    limit: Math.round(memory.jsHeapSizeLimit / 1048576) + 'MB',
                    usage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100) + '%'
                };
                console.log('MemoryOptimizer: memory status:', status);
                return status;
            }
        } catch (error) {
            console.error('MemoryOptimizer: memory status read error:', error);
        }
        return null;
    },

    // Auto cleanup (interval in minutes)
    startAutoCleanup: function (intervalMinutes) {
        try {
            var minutes = (typeof intervalMinutes === 'number' && intervalMinutes > 0) ? intervalMinutes : 5;
            var that = this;
            var id = setInterval(function () {
                try {
                    console.log('MemoryOptimizer: auto cleanup tick');
                    that.cleanup();
                    that.getMemoryStatus();
                } catch (e) {
                    console.warn('MemoryOptimizer: auto cleanup tick error:', e);
                }
            }, minutes * 60 * 1000);
            this.cleanupIntervals.push(id);
            console.log('MemoryOptimizer: auto cleanup started every ' + minutes + ' minute(s)');
        } catch (e) {
            console.error('MemoryOptimizer: startAutoCleanup error:', e);
        }
    },

    stopAutoCleanup: function () {
        try {
            for (var i = 0; i < this.cleanupIntervals.length; i++) {
                clearInterval(this.cleanupIntervals[i]);
            }
            this.cleanupIntervals = [];
            console.log('MemoryOptimizer: auto cleanup stopped');
        } catch (e) {
            console.error('MemoryOptimizer: stopAutoCleanup error:', e);
        }
    },

    // Registrations
    registerTimer: function (timerId) {
        this.activeTimers.push(timerId);
        return timerId;
    },

    registerDOMObserver: function (observer) {
        this.activeDOMObservers.push(observer);
        return observer;
    },

    // Page/app lifecycle hooks
    onPageChange: function () {
        console.log('MemoryOptimizer: page change -> cleanup');
        this.cleanup();
    },

    onAppExit: function () {
        console.log('MemoryOptimizer: app exit -> final cleanup');
        this.stopAutoCleanup();
        this.cleanup();
    },

    // Samsung-specific optimizations
    optimizeForSamsungTV: function () {
        this.setDOMElementLimits();
        this.optimizeImageLoading();
        this.setupEventDelegation();
        console.log('MemoryOptimizer: Samsung TV optimizations applied');
    },

    setDOMElementLimits: function () {
        try {
            if (typeof channel_page !== 'undefined' && channel_page.movies && channel_page.movies.length) {
                var maxChannels = 100; // safe cap for older TVs
                if (channel_page.movies.length > maxChannels) {
                    console.warn('MemoryOptimizer: too many channels (' + channel_page.movies.length + '), limiting to ' + maxChannels);
                    channel_page.movies = channel_page.movies.slice(0, maxChannels);
                }
            }
        } catch (e) {
            console.warn('MemoryOptimizer: setDOMElementLimits error:', e);
        }
    },

    optimizeImageLoading: function () {
        try {
            if ('IntersectionObserver' in window) {
                var imageObserver = new IntersectionObserver(function (entries) {
                    for (var i = 0; i < entries.length; i++) {
                        var entry = entries[i];
                        if (entry && entry.isIntersecting) {
                            var img = entry.target;
                            if (img && img.getAttribute && img.getAttribute('data-src')) {
                                img.src = img.getAttribute('data-src');
                                img.removeAttribute('data-src');
                                try { imageObserver.unobserve(img); } catch (_) {}
                            }
                        }
                    }
                });
                this.registerDOMObserver(imageObserver);

                // Observe existing lazy images
                var lazyImgs = document.querySelectorAll ? document.querySelectorAll('img[data-src]') : [];
                for (var j = 0; j < lazyImgs.length; j++) {
                    try { imageObserver.observe(lazyImgs[j]); } catch (_) {}
                }
            } else {
                // Fallback: eager-load small set in view (basic)
                var $imgs = $('img[data-src]');
                $imgs.slice(0, 20).each(function () {
                    var $img = $(this);
                    var ds = $img.attr('data-src');
                    if (ds) {
                        $img.attr('src', ds);
                        $img.removeAttr('data-src');
                    }
                });
            }
        } catch (e) {
            console.warn('MemoryOptimizer: optimizeImageLoading error:', e);
        }
    },

    setupEventDelegation: function () {
        try {
            // Channel click
            $(document).off('click.memopt').on('click.memopt', '.channel-menu-item', function () {
                try {
                    if (typeof channel_page !== 'undefined' && channel_page.handleMenuClick) {
                        channel_page.handleMenuClick();
                    }
                } catch (_) {}
            });

            // Search with debounce
            $(document).off('input.memopt').on('input.memopt', '#modern-search-input', function () {
                try {
                    if (typeof channel_page !== 'undefined' && channel_page.performChannelSearch) {
                        var value = $(this).val();
                        if (channel_page.search_debounce_timer) {
                            clearTimeout(channel_page.search_debounce_timer);
                        }
                        channel_page.search_debounce_timer = setTimeout(function () {
                            try { channel_page.performChannelSearch(value); } catch (_) {}
                        }, 300);
                    }
                } catch (_) {}
            });

            console.log('MemoryOptimizer: delegated events set');
        } catch (e) {
            console.warn('MemoryOptimizer: setupEventDelegation error:', e);
        }
    }
};

// Auto-start on Samsung TV
$(document).ready(function () {
    try {
        console.log('MemoryOptimizer: module loaded');
        MemoryOptimizer.optimizeForSamsungTV();
        MemoryOptimizer.startAutoCleanup(5);

        $(window).on('beforeunload', function () {
            MemoryOptimizer.onAppExit();
        });

        setTimeout(function () {
            MemoryOptimizer.getMemoryStatus();
        }, 2000);
    } catch (e) {
        console.error('MemoryOptimizer: init error:', e);
    }
});

// Global access
window.MemoryOptimizer = MemoryOptimizer;
