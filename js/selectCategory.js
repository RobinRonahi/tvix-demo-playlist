// selectCategory.js
// Samsung TV Category Selection Utility (clean EN version)

(function () {
  'use strict';

  var CategorySelector = {
    /**
     * Select a category and keep UI/keys in sync.
     * @param {number} categoryIndex
     * @param {string} targetPage - global page object name (e.g., "channel_page", "vod_series_page")
     * @returns {boolean}
     */
    selectCategory: function (categoryIndex, targetPage) {
      console.log('[CategorySelector] selectCategory', { categoryIndex, targetPage: targetPage || 'default' });

      if (categoryIndex === undefined || categoryIndex === null || isNaN(categoryIndex)) {
        console.error('[CategorySelector] Invalid category index:', categoryIndex);
        return false;
      }

      if (typeof targetPage !== 'undefined') {
        try {
          var pageObject = window[targetPage];
          if (pageObject && pageObject.keys) {
            pageObject.keys.category_selection = categoryIndex;
            pageObject.keys.focused_part = 'category_selection';

            this.updateCategoryVisualFeedback(pageObject, categoryIndex);
            console.log('[CategorySelector] Category selection updated for', targetPage);
            return true;
          }
        } catch (err) {
          console.error('[CategorySelector] selectCategory error:', err);
        }
      }
      return false;
    },

    /**
     * Update visual feedback (active state + scroll into view).
     * @param {object} pageObject
     * @param {number} categoryIndex
     */
    updateCategoryVisualFeedback: function (pageObject, categoryIndex) {
      try {
        if (pageObject.category_doms) {
          $(pageObject.category_doms).removeClass('active focused');
        }

        if (pageObject.category_doms && pageObject.category_doms[categoryIndex]) {
          $(pageObject.category_doms[categoryIndex]).addClass('active');

          // Keep the selected item in view
          if (typeof window.moveScrollPosition === 'function') {
            var $container = $('#channel-categories-wrapper, #vod-categories-wrapper, .category-container').first();
            if ($container.length > 0) {
              window.moveScrollPosition($container, pageObject.category_doms[categoryIndex], 'vertical', false);
            }
          }
        }

        console.log('[CategorySelector] Visual feedback updated');
      } catch (err) {
        console.error('[CategorySelector] updateCategoryVisualFeedback error:', err);
      }
    },

    /**
     * Hover handler to sync keys and visual state.
     * @param {Element} targetElement
     * @param {object} pageObject
     */
    hoverCategory: function (targetElement, pageObject) {
      if (!targetElement || !pageObject) return;

      try {
        var index = $(targetElement).data('index');
        index = (typeof index === 'number') ? index : 0;

        var keys = pageObject.keys || (pageObject.keys = {});
        keys.focused_part = 'category_selection';
        keys.category_selection = index;

        if (pageObject.category_doms) {
          $(pageObject.category_doms).removeClass('active');
        }
        $(targetElement).addClass('active');

        this.scrollCategoryIntoView(targetElement, pageObject);
        console.log('[CategorySelector] Hovered index:', index);
      } catch (err) {
        console.error('[CategorySelector] hoverCategory error:', err);
      }
    },

    /**
     * Ensure hovered/selected category is visible.
     * @param {Element|jQuery} targetElement
     * @param {object} pageObject
     */
    scrollCategoryIntoView: function (targetElement, pageObject) {
      try {
        if (!targetElement) return;

        var $container = $(targetElement).closest('[id*="categories"], .category-container');
        if ($container.length > 0 && typeof window.moveScrollPosition === 'function') {
          window.moveScrollPosition($container, targetElement, 'vertical', false);
        }
      } catch (err) {
        console.error('[CategorySelector] scrollCategoryIntoView error:', err);
      }
    },

    /**
     * Load the content of the given category into the page object.
     * @param {number} categoryIndex
     * @param {object} pageObject
     * @returns {boolean}
     */
    loadCategoryContent: function (categoryIndex, pageObject) {
      try {
        if (!pageObject || !Array.isArray(pageObject.categories)) return false;

        var category = pageObject.categories[categoryIndex];
        if (!category) {
          console.error('[CategorySelector] Category not found at index:', categoryIndex);
          return false;
        }

        if (pageObject.movies !== undefined) {
          pageObject.movies = category.movies || [];
        }

        if (category.category_name) {
          $('.current-category, .category-title, #vod-series-current-category').text(category.category_name);
        }

        var count = (category.movies || []).length;
        $('.content-stats, .vod-series-content-stats').text(count + ' items');

        if (typeof pageObject.renderCategoryContent === 'function') {
          pageObject.renderCategoryContent();
        } else if (typeof pageObject.renderMovies === 'function') {
          pageObject.renderMovies();
        }

        console.log('[CategorySelector] Category loaded:', category.category_name, 'items:', count);
        return true;
      } catch (err) {
        console.error('[CategorySelector] loadCategoryContent error:', err);
        return false;
      }
    },

    /**
     * Transition from one category to another (updates UI + content).
     * @param {number} fromIndex
     * @param {number} toIndex
     * @param {object} pageObject
     * @returns {boolean}
     */
    transitionToCategory: function (fromIndex, toIndex, pageObject) {
      try {
        console.log('[CategorySelector] Transition', { fromIndex, toIndex });

        if (pageObject.category_doms) {
          if (pageObject.category_doms[fromIndex]) {
            $(pageObject.category_doms[fromIndex]).removeClass('active');
          }
          if (pageObject.category_doms[toIndex]) {
            $(pageObject.category_doms[toIndex]).addClass('active');
          }
        }

        this.loadCategoryContent(toIndex, pageObject);
        return true;
      } catch (err) {
        console.error('[CategorySelector] transitionToCategory error:', err);
        return false;
      }
    }
  };

  // Expose globally
  window.CategorySelector = CategorySelector;
})();