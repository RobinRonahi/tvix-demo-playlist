"use strict";

/**
 * time_helper.js (Samsung TV uyumlu)
 * - moment() varsa onu kullanır; yoksa hafif Date fallback
 * - client_offset & time_difference_with_server güvenli yönetim
 * - Giriş/çıkış formatları parametreleştirilebilir
 * - Eski global fonksiyon adları korunur (drop-in replacement)
 */

/* ----------------------- Safe Globals ----------------------- */
(function attachTimeGlobals () {
  if (typeof window === "undefined") return;
  if (typeof window.client_offset === "undefined" || isNaN(window.client_offset)) {
    // Dakika cinsinden: sunucu ayarı yoksa 0 kabul
    window.client_offset = 0;
  }
  if (typeof window.time_difference_with_server === "undefined" || isNaN(window.time_difference_with_server)) {
    window.time_difference_with_server = 0; // dakika
  }
})();

/* ----------------------- Helpers ---------------------------- */
var TimeHelper = (function () {
  var hasMoment = (typeof window !== "undefined" && typeof window.moment === "function");

  function toInt(n, def) {
    var x = parseInt(n, 10);
    return Number.isFinite(x) ? x : def;
  }

  function safeMoment(input, fmt) {
    if (!hasMoment) return null;
    try {
      return fmt ? window.moment(input, fmt, true) : window.moment(input);
    } catch (_) {
      return window.moment.invalid();
    }
  }

  // Basit Date fallback formatlayıcı (YYYY-MM-DD HH:mm)
  function dateFormatFallback(d, fmt) {
    // Yalnızca common kalıpları destekleyelim
    var pad = (n) => (n < 10 ? "0" + n : "" + n);
    var y = d.getFullYear();
    var M = pad(d.getMonth() + 1);
    var D = pad(d.getDate());
    var h = pad(d.getHours());
    var m = pad(d.getMinutes());

    if (!fmt || fmt === "Y-MM-DD HH:mm" || fmt === "YYYY-MM-DD HH:mm") {
      return y + "-" + M + "-" + D + " " + h + ":" + m;
    }
    if (fmt === "YYYY-MM-DD") return y + "-" + M + "-" + D;
    // Minimal fallback
    return d.toISOString ? d.toISOString() : (y + "-" + M + "-" + D + " " + h + ":" + m);
  }

  function parseProgrammeToUtc(program_time, inputFormat) {
    // Varsayılan eski format: 'YYYYMMDDHHmmss Z'
    var fmt = inputFormat || 'YYYYMMDDHHmmss Z';
    if (hasMoment) {
      var m = safeMoment(program_time, fmt);
      if (m && m.isValid()) {
        return m.utc(); // moment objesi (UTC)
      }
      return null;
    }
    // Fallback: basit parse (UTC varsay)
    var s = String(program_time || "").trim();
    // 20240131T123000Z gibi değilse kaba tahmin:
    var d = new Date(s);
    if (isNaN(d.getTime())) {
      // YYYYMMDDHHmmss + opsiyonel TZ'yi kaba böl
      var y = s.slice(0,4), mo = s.slice(4,6), da = s.slice(6,8),
          hh = s.slice(8,10), mi = s.slice(10,12), ss = s.slice(12,14);
      var dd = new Date(Date.UTC(toInt(y,1970), toInt(mo,1)-1, toInt(da,1), toInt(hh,0), toInt(mi,0), toInt(ss,0)));
      d = dd;
    }
    return d; // Date (UTC)
  }

  return {
    /**
     * Eski API ile uyumlu:
     * convertProgrammeTimeToClientTime(program_time)
     * Opsiyonel: inputFormat, outputFormat
     */
    convertProgrammeTimeToClientTime: function (program_time, inputFormat, outputFormat) {
      var outFmt = outputFormat || 'Y-MM-DD HH:mm';

      if (hasMoment) {
        var utcM = parseProgrammeToUtc(program_time, inputFormat);
        if (!utcM) return '';
        var mins = toInt(window.client_offset, 0);
        var localM = utcM.clone().add(mins, 'minute');
        return localM.format(outFmt);
      }

      // Fallback (Date)
      var d = parseProgrammeToUtc(program_time, inputFormat);
      if (!d || isNaN(d.getTime())) return '';
      var mins = toInt(window.client_offset, 0);
      var localMs = d.getTime() + mins * 60 * 1000;
      return dateFormatFallback(new Date(localMs), outFmt);
    },

    /**
     * getTodayDate(format)
     */
    getTodayDate: function (format) {
      if (hasMoment) {
        return window.moment(new Date()).format(format || 'YYYY-MM-DD');
      }
      return dateFormatFallback(new Date(), format || 'YYYY-MM-DD');
    },

    /**
     * calculateTimeDifference(server_time, time_stamp)
     * server_time: Date veya parse edilebilir string
     * time_stamp : UNIX seconds
     * Sets and returns window.time_difference_with_server (dakika)
     */
    calculateTimeDifference: function (server_time, time_stamp) {
      var serverMs;
      if (hasMoment) {
        var m = window.moment(server_time);
        serverMs = m.isValid() ? m.valueOf() : NaN;
      } else {
        var d = new Date(server_time);
        serverMs = d.getTime();
      }

      var clientMsFromStamp = toInt(time_stamp, 0) * 1000;
      if (!Number.isFinite(serverMs) || !Number.isFinite(clientMsFromStamp)) {
        window.time_difference_with_server = 0;
        return 0;
      }

      var diffMin = Math.round((clientMsFromStamp - serverMs) / (60 * 1000));
      window.time_difference_with_server = diffMin;
      return diffMin;
    },

    /**
     * getLocalChannelTime(channel_time, outputFormat?)
     * Orijinal fonksiyon moment döndürüyordu; uyumluluk için:
     * - moment varsa moment objesi döner (server diff eklenmiş)
     * - outputFormat verilirse string döndürür
     * - moment yoksa Date/string döner
     */
    getLocalChannelTime: function (channel_time, outputFormat) {
      var addMin = toInt(window.time_difference_with_server, 0);

      if (hasMoment) {
        var m = window.moment(channel_time);
        if (!m.isValid()) return outputFormat ? '' : m; // invalid moment
        var shifted = m.add(addMin, 'minute');
        return outputFormat ? shifted.format(outputFormat) : shifted;
      }

      // Fallback
      var d = new Date(channel_time);
      if (isNaN(d.getTime())) return outputFormat ? '' : d;
      var ms = d.getTime() + addMin * 60 * 1000;
      var out = new Date(ms);
      return outputFormat ? dateFormatFallback(out, outputFormat) : out;
    }
  };
})();

/* -------------------- Legacy Global Functions -------------------- */
/* Bu kısım mevcut koda dokunmadan drop-in yapabilmek için tutuldu. */
function convertProgrammeTimeToClientTime(program_time, inputFormat, outputFormat) {
  return TimeHelper.convertProgrammeTimeToClientTime(program_time, inputFormat, outputFormat);
}

function getTodayDate(format) {
  return TimeHelper.getTodayDate(format);
}

function calculateTimeDifference(server_time, time_stamp) {
  return TimeHelper.calculateTimeDifference(server_time, time_stamp);
}

function getLocalChannelTime(channel_time, outputFormat) {
  return TimeHelper.getLocalChannelTime(channel_time, outputFormat);
}

/* -------------------- Export (opsiyonel) -------------------- */
if (typeof window !== "undefined") {
  window.TimeHelper = TimeHelper;
}
