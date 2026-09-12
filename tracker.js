/**
 * Protocol Zero — Real-Time Telegram Analytics Tracker
 * Fires instant Telegram notifications for:
 *   • Page Visit  (with full visitor profile + IP geolocation)
 *   • Scroll Depth milestones (25 / 50 / 75 / 100 %)
 *   • Every external link / project click
 *   • Session Summary on exit (time, max scroll, all clicks)
 */
(function () {
  "use strict";

  /* ─── CONFIG ──────────────────────────────────────────────── */
  const BOT_TOKEN = "8698380996:AAGtAravHhmLEaK8aLEhAhmkryu6Oz0VlEw";
  const CHAT_ID   = "989740810";
  const API_URL   = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  /* ─── SESSION STATE ───────────────────────────────────────── */
  const session = {
    startTime    : Date.now(),
    maxScroll    : 0,
    scrollFired  : new Set(),
    clicks       : [],
    projectClicks: {},
    geoInfo      : null,
    visitSent    : false,
    summarySent  : false,
  };

  /* ─── TELEGRAM SENDER ─────────────────────────────────────── */
  function tg(text) {
    const body = JSON.stringify({
      chat_id   : CHAT_ID,
      text      : text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(API_URL, blob);
    } else {
      fetch(API_URL, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  /* ─── HELPERS ─────────────────────────────────────────────── */
  function scrollEmoji(pct) {
    if (pct >= 100) return "\uD83C\uDFC1";
    if (pct >= 75)  return "\uD83D\uDD25";
    if (pct >= 50)  return "\u26A1";
    return "\uD83D\uDC40";
  }

  function deviceEmoji(ua) {
    if (/mobile|android|iphone|ipad/i.test(ua)) return "\uD83D\uDCF1";
    if (/tablet/i.test(ua)) return "\uD83D\uDCF2";
    return "\uD83D\uDDA5\uFE0F";
  }

  function osName(ua) {
    if (/Windows NT 10|Windows 11/i.test(ua)) return "Windows 10/11";
    if (/Windows NT 6\.3/i.test(ua))          return "Windows 8.1";
    if (/Windows NT 6\.1/i.test(ua))          return "Windows 7";
    if (/Mac OS X/i.test(ua))                 return "macOS";
    if (/Android/i.test(ua))                  return "Android";
    if (/iPhone|iPad/i.test(ua))              return "iOS";
    if (/Linux/i.test(ua))                    return "Linux";
    return "Unknown OS";
  }

  function browserName(ua) {
    if (/Edg\//i.test(ua))                            return "Edge";
    if (/OPR\//i.test(ua))                            return "Opera";
    if (/Firefox\//i.test(ua))                        return "Firefox";
    if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
    if (/Chrome\//i.test(ua))                         return "Chrome";
    return "Unknown Browser";
  }

  function referrerLabel(ref) {
    if (!ref) return "Direct / None";
    try {
      const host = new URL(ref).hostname.replace("www.", "");
      if (/google/i.test(host))         return "Google";
      if (/bing/i.test(host))           return "Bing";
      if (/linkedin/i.test(host))       return "LinkedIn";
      if (/github/i.test(host))         return "GitHub";
      if (/twitter|x\.com/i.test(host)) return "Twitter / X";
      if (/instagram/i.test(host))      return "Instagram";
      if (/facebook/i.test(host))       return "Facebook";
      if (/youtube/i.test(host))        return "YouTube";
      return host;
    } catch { return ref; }
  }

  function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)   return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m " + (s % 60) + "s";
    return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
  }

  function utmInfo() {
    const p = new URLSearchParams(window.location.search);
    const parts = [];
    if (p.get("utm_source"))   parts.push("Source: " + p.get("utm_source"));
    if (p.get("utm_medium"))   parts.push("Medium: " + p.get("utm_medium"));
    if (p.get("utm_campaign")) parts.push("Campaign: " + p.get("utm_campaign"));
    return parts.length ? parts.join(" | ") : null;
  }

  /* ─── SEND VISIT NOTIFICATION ─────────────────────────────── */
  function sendVisitNotification(geo) {
    if (session.visitSent) return;
    session.visitSent = true;

    const ua       = navigator.userAgent;
    const lang     = navigator.language || "?";
    const tz       = Intl.DateTimeFormat().resolvedOptions().timeZone || "?";
    const screenSz = screen.width + "x" + screen.height;
    const viewport = window.innerWidth + "x" + window.innerHeight;
    const ref      = referrerLabel(document.referrer);
    const utm      = utmInfo();
    const now      = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const devIcon  = deviceEmoji(ua);

    let locLine = "Location: Unknown";
    if (geo && geo.status === "success") {
      locLine = "Location: " + geo.city + ", " + geo.regionName + ", " + geo.country
              + "\nISP: " + geo.isp
              + "\nOrg: " + geo.org
              + "\nIP: " + geo.query;
    }

    let msg = "VISITOR ALERT — Protocol Zero Portfolio\n";
    msg += "================================\n";
    msg += devIcon + " OS: " + osName(ua) + " | Browser: " + browserName(ua) + "\n";
    msg += "Screen: " + screenSz + "  Viewport: " + viewport + "\n";
    msg += "Lang: " + lang + "  TZ: " + tz + "\n";
    msg += locLine + "\n";
    msg += "================================\n";
    msg += "Referrer: " + ref + "\n";
    if (utm) msg += "UTM: " + utm + "\n";
    msg += "Time (IST): " + now + "\n";
    msg += "URL: " + window.location.href;

    tg(msg);
  }

  /* ─── GEO FETCH + FIRE VISIT ──────────────────────────────── */
  fetch("https://ip-api.com/json/?fields=status,country,regionName,city,isp,org,query")
    .then(function(r) { return r.json(); })
    .then(function(geo) {
      session.geoInfo = geo;
      sendVisitNotification(geo);
    })
    .catch(function() { sendVisitNotification(null); });

  /* ─── SCROLL DEPTH TRACKING ───────────────────────────────── */
  var THRESHOLDS = [25, 50, 75, 100];

  function getScrollPct() {
    var scrolled = window.scrollY || document.documentElement.scrollTop;
    var total    = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) return 100;
    return Math.min(100, Math.round((scrolled / total) * 100));
  }

  function onScroll() {
    var pct = getScrollPct();
    if (pct > session.maxScroll) session.maxScroll = pct;

    for (var i = 0; i < THRESHOLDS.length; i++) {
      var threshold = THRESHOLDS[i];
      if (pct >= threshold && !session.scrollFired.has(threshold)) {
        session.scrollFired.add(threshold);
        var emoji = scrollEmoji(threshold);
        var msg = emoji + " Scroll Depth: " + threshold + "%\n"
                + "Page explored: " + threshold + "%\n"
                + "Time on page: " + formatDuration(Date.now() - session.startTime);
        tg(msg);
      }
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  /* ─── CLICK TRACKING ──────────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var anchor = e.target.closest ? e.target.closest("a") : null;
    if (!anchor) {
      var el = e.target;
      while (el && el !== document) {
        if (el.tagName === "A") { anchor = el; break; }
        el = el.parentElement;
      }
    }
    if (!anchor) return;

    var href = anchor.getAttribute("href") || "";
    if (href.startsWith("#")) return;   // skip internal anchors

    var text = (anchor.textContent || "").trim().slice(0, 60) || href;

    // Detect project card
    var projectName = null;
    var card = null;
    var el2 = anchor;
    while (el2 && el2 !== document) {
      if (el2.classList && (el2.classList.contains("pc") || el2.classList.contains("project-card") || el2.dataset.project)) {
        card = el2; break;
      }
      el2 = el2.parentElement;
    }
    if (card) {
      var heading = card.querySelector("h3, h4, .project-title, .pc-title");
      if (heading) projectName = heading.textContent.trim();
    }

    session.clicks.push({ label: text, href: href, ts: Date.now() });
    if (projectName) {
      session.projectClicks[projectName] = (session.projectClicks[projectName] || 0) + 1;
    }

    var msg = "LINK CLICKED\n"
            + "================================\n";
    if (projectName) msg += "Project: " + projectName + "\n";
    msg += "Text: " + text + "\n";
    msg += "URL: " + href + "\n";
    msg += "At: " + formatDuration(Date.now() - session.startTime) + " | Scroll: " + session.maxScroll + "%";
    tg(msg);
  }, true);

  /* ─── SESSION SUMMARY ON EXIT ─────────────────────────────── */
  function sendSummary() {
    if (session.summarySent) return;
    session.summarySent = true;

    var duration = Date.now() - session.startTime;
    var clicks   = session.clicks;
    var projClicks = session.projectClicks;

    var msg = "SESSION ENDED — Protocol Zero Portfolio\n";
    msg += "================================\n";
    msg += "Time on page: " + formatDuration(duration) + "\n";
    msg += "Max scroll: " + session.maxScroll + "%\n";
    msg += "Total clicks: " + clicks.length + "\n";

    if (clicks.length > 0) {
      msg += "\nLinks clicked:\n";
      var recent = clicks.slice(-10);
      for (var i = 0; i < recent.length; i++) {
        msg += "  " + (i + 1) + ". " + recent[i].label.slice(0, 50) + "\n";
      }
    }

    var projNames = Object.keys(projClicks);
    if (projNames.length > 0) {
      projNames.sort(function(a, b) { return projClicks[b] - projClicks[a]; });
      msg += "\nProject interest:\n";
      for (var j = 0; j < projNames.length; j++) {
        msg += "  - " + projNames[j] + ": " + projClicks[projNames[j]] + " click(s)\n";
      }
    }

    var scrolled = [];
    session.scrollFired.forEach(function(s) { scrolled.push(s); });
    scrolled.sort(function(a, b) { return a - b; });
    if (scrolled.length) {
      msg += "\nScroll milestones: " + scrolled.map(function(s) { return s + "%"; }).join(" -> ");
    }

    tg(msg);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendSummary();
  });
  window.addEventListener("pagehide", sendSummary, { once: true });

})();
