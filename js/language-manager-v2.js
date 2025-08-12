/* ============================================================
 * GalaPlayer Pro – Language Manager v2.0 (clean, no emojis)
 * - Dynamic language file loading
 * - IP-based language detection with browser fallback
 * - Safe merging with TR base keys for missing entries
 * ============================================================ */
(function () {
  "use strict";

  // Global registry for language payloads loaded from /languages/*.js
  if (!window.LANGUAGE_DATA) window.LANGUAGE_DATA = {};

  var LanguageManager = {
    currentLanguage: "tr",
    translations: {},
    currentLanguageData: {},
    loadedLanguages: [],
    languageChangeCallback: null,

    // Supported languages and file paths
    supportedLanguages: {
      tr: "languages/tr.js",
      en: "languages/en.js",
      de: "languages/de.js",
      fr: "languages/fr.js",
      es: "languages/es.js",
      it: "languages/it.js",
      ru: "languages/ru.js",
      ar: "languages/ar.js",
      pt: "languages/pt.js",
      nl: "languages/nl.js",
      sv: "languages/sv.js",
      no: "languages/no.js",
      fi: "languages/fi.js",
      el: "languages/el.js",
      sr: "languages/sr.js",
      ku: "languages/ku.js",
      ckb: "languages/ckb.js",
      pl: "languages/pl.js",
      ro: "languages/ro.js",
      uk: "languages/uk.js",
      cs: "languages/cs.js",
      hu: "languages/hu.js"
    },

    // Language metadata (no emojis)
    languageInfo: {
      tr: { name: "Turkish", native: "Türkçe", countries: ["TR"] },
      en: { name: "English", native: "English", countries: ["US","GB","AU","CA","NZ","IE","ZA"] },
      de: { name: "German", native: "Deutsch", countries: ["DE","AT","CH"] },
      fr: { name: "French", native: "Français", countries: ["FR","BE","CH","CA"] },
      es: { name: "Spanish", native: "Español", countries: ["ES","MX","AR","CO","PE","VE","CL","EC","GT","CU","BO","DO","HN","PY","SV","NI","CR","PA","UY","PR"] },
      it: { name: "Italian", native: "Italiano", countries: ["IT","CH","SM","VA"] },
      ru: { name: "Russian", native: "Русский", countries: ["RU","BY","KZ","KG","TJ","UZ"] },
      ar: { name: "Arabic", native: "العربية", countries: ["SA","AE","EG","DZ","SD","IQ","MA","YE","SY","TN","JO","LY","LB","KW","OM","QA","BH"] },
      pt: { name: "Portuguese", native: "Português", countries: ["PT","BR","AO","MZ","GW","TL","CV","ST"] },
      nl: { name: "Dutch", native: "Nederlands", countries: ["NL","BE"] },
      sv: { name: "Swedish", native: "Svenska", countries: ["SE"] },
      no: { name: "Norwegian", native: "Norsk", countries: ["NO"] },
      fi: { name: "Finnish", native: "Suomi", countries: ["FI"] },
      el: { name: "Greek", native: "Ελληνικά", countries: ["GR","CY"] },
      sr: { name: "Serbian", native: "Српски", countries: ["RS","BA","ME"] },
      ku: { name: "Kurdish", native: "Kurdî", countries: ["IQ","TR","IR","SY"] },
      ckb: { name: "Kurdish Sorani", native: "کوردی سۆرانی", countries: ["IQ","IR"] },
      pl: { name: "Polish", native: "Polski", countries: ["PL"] },
      ro: { name: "Romanian", native: "Română", countries: ["RO","MD"] },
      uk: { name: "Ukrainian", native: "Українська", countries: ["UA"] },
      cs: { name: "Czech", native: "Čeština", countries: ["CZ"] },
      hu: { name: "Hungarian", native: "Magyar", countries: ["HU"] }
    },

    /* --------------------------- Loading --------------------------- */

    loadLanguageFile: function (langCode) {
      var self = this;
      return new Promise(function (resolve, reject) {
        // Use cached payload when available
        if (
          self.loadedLanguages.indexOf(langCode) !== -1 &&
          window.LANGUAGE_DATA[langCode]
        ) {
          resolve(window.LANGUAGE_DATA[langCode]);
          return;
        }

        if (!self.supportedLanguages[langCode]) {
          console.warn("[Language] Unsupported:", langCode);
          reject("Unsupported language: " + langCode);
          return;
        }

        var scriptPath = self.supportedLanguages[langCode];
        var script = document.createElement("script");
        script.src = scriptPath;
        script.type = "text/javascript";

        script.onload = function () {
          if (window.LANGUAGE_DATA[langCode]) {
            self.loadedLanguages.push(langCode);
            resolve(window.LANGUAGE_DATA[langCode]);
          } else {
            console.error("[Language] Data missing for:", langCode);
            reject("Language data missing: " + langCode);
          }
          // Keep DOM clean
          if (script.parentNode) script.parentNode.removeChild(script);
        };

        script.onerror = function () {
          console.error("[Language] File load error:", scriptPath);
          reject("Language file load error: " + scriptPath);
          if (script.parentNode) script.parentNode.removeChild(script);
        };

        document.head.appendChild(script);
      });
    },

    /* ------------------------ Detection flow ----------------------- */

    detectUserLanguage: function () {
      var self = this;
      return new Promise(function (resolve) {
        // 1) Saved preference
        var saved = self.getSavedLanguage();
        if (saved && self.supportedLanguages[saved]) {
          console.log("[Language] Saved:", saved);
          resolve(saved);
          return;
        }

        // 2) IP → country → language
        self
          .detectCountryByIP()
          .then(function (cc) {
            var detected = self.getLanguageByCountry(cc);
            if (detected) {
              console.log("[Language] From IP:", detected, "(" + cc + ")");
              resolve(detected);
              return;
            }
            // 3) Browser fallback
            var browser = self.getBrowserLanguage();
            console.log("[Language] Browser:", browser);
            resolve(browser);
          })
          .catch(function (err) {
            console.warn("[Language] IP detection failed:", err);
            var browser = self.getBrowserLanguage();
            resolve(browser);
          });
      });
    },

    getSavedLanguage: function () {
      try {
        return (
          localStorage.getItem("galaPlayerLanguage") ||
          (window.settings ? window.settings.language : null)
        );
      } catch (e) {
        console.warn("[Language] localStorage read failed:", e);
        return null;
      }
    },

    getBrowserLanguage: function () {
      var lang =
        (navigator.language || navigator.userLanguage || "en")
          .substring(0, 2)
          .toLowerCase();
      return this.supportedLanguages[lang] ? lang : "en";
    },

    detectCountryByIP: function () {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.timeout = 5000;

        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          if (xhr.status === 200) {
            try {
              var data = JSON.parse(xhr.responseText);
              if (data && data.country_code) {
                resolve(String(data.country_code).toUpperCase());
              } else {
                reject("Country code not found");
              }
            } catch (e) {
              reject("JSON parse error: " + e.message);
            }
          } else {
            reject("HTTP error: " + xhr.status);
          }
        };

        xhr.ontimeout = function () {
          reject("Request timeout");
        };

        xhr.onerror = function () {
          reject("Network error");
        };

        xhr.open("GET", "https://ipapi.co/json/", true);
        xhr.send();
      });
    },

    getLanguageByCountry: function (countryCode) {
      var map = this.languageInfo;
      for (var code in map) {
        if (!map.hasOwnProperty(code)) continue;
        var info = map[code];
        if (info && info.countries && info.countries.indexOf(countryCode) !== -1) {
          return code;
        }
      }
      return null;
    },

    /* ----------------------- Apply & Persist ----------------------- */

    loadLanguage: function (langCode) {
      var self = this;
      return new Promise(function (resolve, reject) {
        self
          .loadLanguageFile(langCode)
          .then(function (payload) {
            // Merge with TR base (fill missing keys)
            var baseTR =
              (window.LANGUAGE_DATA && window.LANGUAGE_DATA.tr) || {};
            var missing = 0;
            for (var k in baseTR) {
              if (baseTR.hasOwnProperty(k) && payload[k] === undefined) {
                payload[k] = baseTR[k];
                missing++;
              }
            }
            if (missing) {
              console.log(
                "[Language] Filled missing keys from TR:",
                missing,
                "(" + langCode + ")"
              );
            }

            self.translations = payload;
            self.currentLanguageData = payload;
            self.currentLanguage = langCode;

            // Persist
            try {
              localStorage.setItem("galaPlayerLanguage", langCode);
              if (window.settings) {
                window.settings.language = langCode;
                if (typeof window.settings.saveSettings === "function") {
                  window.settings.saveSettings();
                }
              }
            } catch (e) {
              console.warn("[Language] Persist failed:", e);
            }

            console.log("[Language] Loaded:", langCode);
            resolve(langCode);
          })
          .catch(function (err) {
            console.error("[Language] Load failed:", err);
            reject(err);
          });
      });
    },

    setLanguage: function (langCode) {
      var self = this;
      return new Promise(function (resolve, reject) {
        self
          .loadLanguage(langCode)
          .then(function () {
            self.applyTranslations();
            self.updateLanguageSelector();

            // Dispatch event
            try {
              var evt = new CustomEvent("languageChanged", {
                detail: {
                  language: langCode,
                  languageInfo: self.languageInfo[langCode]
                }
              });
              document.dispatchEvent(evt);
            } catch (_) {}

            console.log("[Language] Changed:", langCode);
            resolve(langCode);
          })
          .catch(reject);
      });
    },

    applyTranslations: function () {
      var data = this.currentLanguageData || this.translations;
      if (!data) {
        console.error("[Language] No data to apply.");
        return;
      }

      var applied = 0;
      var missingKeys = [];

      // Apply text/placeholder/title to elements marked with data-word_code
      var nodes = document.querySelectorAll("[data-word_code]");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var key = el.getAttribute("data-word_code");
        var val = data[key];

        if (val !== undefined) {
          var tag = el.tagName.toLowerCase();
          if (tag === "input") {
            el.placeholder = val;
          } else if (tag === "title") {
            el.textContent = val;
            document.title = val;
          } else {
            el.innerHTML = val;
          }
          if (el.hasAttribute("title")) el.setAttribute("title", val);
          applied++;
        } else {
          missingKeys.push(key);
        }
      }

      console.log("[Language] Applied:", applied, "items for", this.currentLanguage);
      if (missingKeys.length) {
        console.warn("[Language] Missing keys:", missingKeys.slice(0, 10), "...");
      }
    },

    /* --------------------------- Helpers --------------------------- */

    getText: function (key, fallback) {
      if (this.translations && this.translations[key] !== undefined)
        return this.translations[key];
      if (
        window.LANGUAGE_DATA &&
        window.LANGUAGE_DATA.tr &&
        window.LANGUAGE_DATA.tr[key] !== undefined
      ) {
        return window.LANGUAGE_DATA.tr[key];
      }
      return fallback || key;
    },

    getSupportedLanguages: function () {
      var out = [];
      for (var code in this.supportedLanguages) {
        if (!this.supportedLanguages.hasOwnProperty(code)) continue;
        var info = this.languageInfo[code] || { name: code, native: code, countries: [] };
        out.push({
          code: code,
          name: info.name,
          native: info.native,
          countries: info.countries
        });
      }
      return out;
    },

    createLanguageSelector: function (containerId, onChange) {
      var container = document.getElementById(containerId);
      if (!container) {
        console.error("[Language] Container not found:", containerId);
        return;
      }

      var langs = this.getSupportedLanguages();
      var html = "";
      for (var i = 0; i < langs.length; i++) {
        var lang = langs[i];
        var active = lang.code === this.currentLanguage;
        html +=
          '<div class="setting-item-section-item language-option ' +
          (active ? "active" : "") +
          '" data-language="' +
          lang.code +
          '" onclick="LanguageManager.selectLanguageFromUI(\'' +
          lang.code +
          '\')" style="cursor:pointer;">' +
          '<div class="language-flag">' +
          '<div class="flag-icon flag-icon-' + lang.code + '"></div>' +
          '</div>' +
          '<div class="language-info">' +
          '<div class="language-name">' +
          lang.native +
          "</div>" +
          '<div class="language-english">' +
          lang.name +
          "</div>" +
          "</div>" +
          '<div class="language-status">' +
          '<i class="fas fa-check" style="color:#00d4aa;display:' +
          (active ? "block" : "none") +
          '"></i>' +
          "</div>" +
          "</div>";
      }

      container.innerHTML = html;
      this.languageChangeCallback = onChange;

      // Backward compatibility with settings_page
      if (window.settings_page && window.settings_page.language_doms) {
        window.settings_page.language_doms =
          container.querySelectorAll(".language-option");
      }

      var options = container.querySelectorAll(".language-option");
      for (var k = 0; k < options.length; k++) {
        options[k].setAttribute("data-index", String(k));
        options[k].addEventListener("click", (function (el) {
          return function () {
            var code = el.getAttribute("data-language");
            LanguageManager.selectLanguageFromUI(code);
          };
        })(options[k]));
      }

      console.log("[Language] Selector UI created.");
    },

    selectLanguageFromUI: function (langCode) {
      var self = this;
      console.log("[Language] UI selected:", langCode);
      this.setLanguage(langCode)
        .then(function () {
          if (typeof self.languageChangeCallback === "function") {
            self.languageChangeCallback(langCode);
          }
          if (window.settings_page && typeof window.settings_page.selectLanguage === "function") {
            window.settings_page.selectLanguage(langCode);
          }
        })
        .catch(function (err) {
          console.error("[Language] Change error:", err);
        });
    },

    updateLanguageSelector: function () {
      var options = document.querySelectorAll(".language-option");
      for (var i = 0; i < options.length; i++) {
        var el = options[i];
        var code = el.getAttribute("data-language");
        var active = code === this.currentLanguage;
        if (active) el.classList.add("active");
        else el.classList.remove("active");
        var check = el.querySelector(".fa-check");
        if (check) check.style.display = active ? "block" : "none";
      }
    },

    integrateApiLanguages: function (apiLanguages) {
      // left for backward compatibility
      console.log("[Language] integrateApiLanguages (noop)", apiLanguages);
    },

    initWithApi: function (apiLanguages) {
      var self = this;
      return new Promise(function (resolve) {
        console.log("[Language] initWithApi...");
        self.init().then(resolve);
      });
    },

    /* --------------------------- Startup --------------------------- */

    init: function () {
      var self = this;
      console.log("[Language] v2.0 starting...");
      return new Promise(function (resolve) {
        self
          .detectUserLanguage()
          .then(function (detected) {
            return self.loadLanguage(detected);
          })
          .then(function (loaded) {
            self.applyTranslations();
            console.log("[Language] Ready:", loaded);
            resolve(loaded);
          })
          .catch(function (err) {
            console.error("[Language] Startup error:", err);
            // Fallback to TR
            self.loadLanguage("tr").then(function () {
              self.applyTranslations();
              console.log("[Language] Fallback loaded: tr");
              resolve("tr");
            });
          });
      });
    }
  };

  // Expose globally
  window.LanguageManager = LanguageManager;

  // Auto start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      LanguageManager.init();
    });
  } else {
    LanguageManager.init();
  }
})();
console.log("LanguageManager v2.0 module loaded");