/**
 * Protocol Zero — Real-Time Telegram Analytics Tracker v2
 * Fixed: bot filtering, Instagram IAB detection, session dedup,
 *        reliable delivery, session minimum time, better geo fallback
 */
(function () {
  "use strict";

  /* ─── BOT / AUTOMATION GUARD ──────────────────────────────────
     Skip Vercel deploy-preview bots, Lighthouse, Puppeteer, etc.
     Signs of a bot: webdriver flag, headless UA, 800x600 screen,
     missing language list, or a known bot UA string.
  ──────────────────────────────────────────────────────────────── */
  var ua = navigator.userAgent || "";

  if (
    navigator.webdriver === true ||
    /headless|phantomjs|puppeteer|selenium|bot|crawler|spider|lighthouse|prerender|googlebot|bingbot|facebookexternalhit/i.test(ua) ||
    (screen.width === 800 && screen.height === 600) ||
    !navigator.languages ||
    navigator.languages.length === 0
  ) { return; }

  /* ─── CONFIG ──────────────────────────────────────────────── */
  var BOT_TOKEN = "8698380996:AAGtAravHhmLEaK8aLEhAhmkryu6Oz0VlEw";
  var CHAT_ID   = "989740810";
  var API_URL   = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  var MIN_SESSION_MS = 8000; // ignore sessions shorter than 8 seconds (bots)

  /* ─── SESSION STATE ───────────────────────────────────────── */
  var session = {
    startTime    : Date.now(),
    maxScroll    : 0,
    scrollFired  : [],
    clicks       : [],
    projectClicks: {},
    visitSent    : false,
    summarySent  : false,
  };

  /* ─── DEDUPLICATION — one visit alert per browser tab session */
  // If the user opens the same tab and page re-fires (e.g., soft nav)
  // we skip duplicate visit messages using sessionStorage.
  var SESSION_KEY = "pz_tracker_v2";
  try {
    if (sessionStorage.getItem(SESSION_KEY)) {
      session.visitSent = true; // already sent for this tab session
    } else {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  } catch(e) {}

  /* ─── RELIABLE TELEGRAM SENDER ────────────────────────────────
     Always use fetch with keepalive:true — more reliable than
     sendBeacon for the Telegram Bot API (which requires JSON body).
     sendBeacon is only used as absolute last resort on page-unload.
  ──────────────────────────────────────────────────────────────── */
  function tg(text) {
    var body = JSON.stringify({
      chat_id   : CHAT_ID,
      text      : text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    var sent = false;

    // Primary: fetch with keepalive (survives page close in modern browsers)
    try {
      fetch(API_URL, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : body,
        keepalive: true,
      }).then(function() { sent = true; }).catch(function() {});
    } catch(e) {}

    // Fallback on page-unload: sendBeacon
    if (!sent && navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(API_URL, blob);
      } catch(e) {}
    }
  }

  /* ─── HELPERS ─────────────────────────────────────────────── */
  function osName(ua) {
    if (/Windows NT 10\.0|Windows 11/i.test(ua)) return "Windows 10/11";
    if (/Windows NT 6\.3/i.test(ua))             return "Windows 8.1";
    if (/Windows NT 6\.1/i.test(ua))             return "Windows 7";
    if (/iPhone/i.test(ua))                      return "iOS (iPhone)";
    if (/iPad/i.test(ua))                        return "iOS (iPad)";
    if (/Android/i.test(ua))                     return "Android";
    if (/Mac OS X/i.test(ua))                    return "macOS";
    if (/Linux/i.test(ua))                       return "Linux";
    return "Unknown OS";
  }

  function browserName(ua) {
    // Order matters — most specific checks first
    if (/Instagram/i.test(ua))        return "Instagram IAB";
    if (/FBAV|FBAN|FB_IAB/i.test(ua)) return "Facebook IAB";
    if (/LinkedInApp/i.test(ua))      return "LinkedIn IAB";
    if (/Twitter/i.test(ua))          return "Twitter IAB";
    if (/DuckDuckGo/i.test(ua))       return "DuckDuckGo";
    if (/Vivaldi/i.test(ua))          return "Vivaldi";
    if (/YaBrowser/i.test(ua))        return "Yandex Browser";
    if (/UCBrowser/i.test(ua))        return "UC Browser";
    if (/SamsungBrowser/i.test(ua))   return "Samsung Browser";
    if (/Edg\//i.test(ua))            return "Edge";
    if (/OPR\//i.test(ua))            return "Opera";
    if (/CriOS/i.test(ua))            return "Chrome (iOS)";
    if (/FxiOS/i.test(ua))            return "Firefox (iOS)";
    if (/Firefox\//i.test(ua))        return "Firefox";
    if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
    // Brave hides itself as Chrome in UA — detected via navigator.brave below
    if (/Chrome\//i.test(ua))         return "Chrome";
    return "Unknown Browser";
  }

  /* ─── ASYNC BRAVE DETECTION ────────────────────────────────────
     navigator.brave only exists in Brave Browser.
     isBrave() returns a Promise<boolean>. We fire a correction note
     if the visit notification was already sent as "Chrome".
  ──────────────────────────────────────────────────────────────── */
  var detectedBrowser = browserName(ua);

  if (window.navigator.brave && typeof window.navigator.brave.isBrave === "function") {
    window.navigator.brave.isBrave().then(function(isBrave) {
      if (isBrave) {
        detectedBrowser = "Brave Browser";
        if (session.visitSent) {
          tg("(Correction: last visitor is using Brave Browser, not Chrome)");
        }
      }
    }).catch(function() {});
  }


  function deviceType(ua) {
    if (/iPhone/i.test(ua))                       return "iPhone";
    if (/iPad/i.test(ua))                         return "iPad";
    if (/Android.*Mobile/i.test(ua))              return "Android Phone";
    if (/Android/i.test(ua))                      return "Android Tablet";
    if (/Mobile|tablet/i.test(ua))                return "Mobile";
    return "Desktop";
  }

  function referrerLabel(ref) {
    // Check in-app browser UA first — Instagram/FB strip document.referrer
    if (/Instagram/i.test(ua)) return "Instagram (In-App Browser)";
    if (/FBAV|FBAN/i.test(ua)) return "Facebook (In-App Browser)";

    if (!ref) return "Direct / None";
    try {
      var host = new URL(ref).hostname.replace("www.", "");
      if (/google/i.test(host))         return "Google Search";
      if (/bing/i.test(host))           return "Bing Search";
      if (/linkedin/i.test(host))       return "LinkedIn";
      if (/github/i.test(host))         return "GitHub";
      if (/twitter|x\.com|t\.co/i.test(host)) return "Twitter / X";
      if (/instagram/i.test(host))      return "Instagram";
      if (/facebook/i.test(host))       return "Facebook";
      if (/youtube/i.test(host))        return "YouTube";
      if (/whatsapp/i.test(host))       return "WhatsApp";
      if (/reddit/i.test(host))         return "Reddit";
      return host;
    } catch(e) { return ref; }
  }

  function utmInfo() {
    var p = new URLSearchParams(window.location.search);
    var parts = [];
    if (p.get("utm_source"))   parts.push("Source: " + p.get("utm_source"));
    if (p.get("utm_medium"))   parts.push("Medium: " + p.get("utm_medium"));
    if (p.get("utm_campaign")) parts.push("Campaign: " + p.get("utm_campaign"));
    return parts.length ? parts.join(" | ") : null;
  }

  function formatDuration(ms) {
    var s = Math.floor(ms / 1000);
    if (s < 60)   return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m " + (s % 60) + "s";
    return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
  }

  function scrolledAlready(n) {
    for (var i = 0; i < session.scrollFired.length; i++) {
      if (session.scrollFired[i] === n) return true;
    }
    return false;
  }

  /* ─── SEND VISIT NOTIFICATION ─────────────────────────────── */
  function sendVisitNotification(geo) {
    if (session.visitSent) return;
    session.visitSent = true;

    var lang     = navigator.language || "?";
    var tz       = Intl.DateTimeFormat().resolvedOptions().timeZone || "?";
    var screenSz = screen.width + "x" + screen.height;
    var viewport = window.innerWidth + "x" + window.innerHeight;
    var ref      = referrerLabel(document.referrer);
    var utm      = utmInfo();
    var now      = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    var os       = osName(ua);
    var browser  = detectedBrowser;   // uses async-correctable Brave-aware variable
    var device   = deviceType(ua);

    var locLine;
    if (geo && geo.status === "success") {
      locLine = "Location: " + geo.city + ", " + geo.regionName + ", " + geo.country
              + "\nISP: " + geo.isp
              + "\nOrg: " + (geo.org || geo.isp)
              + "\nIP: " + geo.query;

      // Add lat/lon + Google Maps link if available
      if (geo.lat && geo.lon) {
        var mapsUrl = "https://www.google.com/maps?q=" + geo.lat + "," + geo.lon;
        locLine += "\nCoords: " + geo.lat + ", " + geo.lon
                + "\nMaps: " + mapsUrl;
      }
    } else {
      locLine = "Location: Unavailable (VPN/CDN/Private IP)";
    }

    var msg = "VISITOR ALERT — Protocol Zero Portfolio\n";
    msg += "================================\n";
    msg += "Device: " + device + "\n";
    msg += "OS: " + os + "\n";
    msg += "Browser: " + browser + "\n";
    msg += "Screen: " + screenSz + "  Viewport: " + viewport + "\n";
    msg += "Lang: " + lang + "  |  TZ: " + tz + "\n";
    msg += locLine + "\n";
    msg += "================================\n";
    msg += "Referrer: " + ref + "\n";
    if (utm) msg += "UTM: " + utm + "\n";
    msg += "Time (IST): " + now + "\n";
    msg += "URL: " + window.location.href;

    tg(msg);
  }

  /* ─── GEO FETCH — with dual-API fallback ──────────────────── */
  var geoFetched = false;

  function tryGeo(url, transform) {
    return fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) { return transform(data); });
  }

  // Try ip-api.com first (includes lat/lon), fall back to ipapi.co
  tryGeo(
    "https://ip-api.com/json/?fields=status,country,regionName,city,isp,org,query,lat,lon",
    function(d) { return d; }
  ).then(function(geo) {
    if (!geo || geo.status !== "success") throw new Error("fail");
    geoFetched = true;
    sendVisitNotification(geo);
  }).catch(function() {
    // fallback — ipapi.co also returns lat/lon
    tryGeo("https://ipapi.co/json/", function(d) {
      return {
        status    : d.error ? "fail" : "success",
        city      : d.city,
        regionName: d.region,
        country   : d.country_name,
        isp       : d.org,
        org       : d.org,
        query     : d.ip,
        lat       : d.latitude,
        lon       : d.longitude,
      };
    }).then(function(geo) {
      geoFetched = true;
      sendVisitNotification(geo);
    }).catch(function() {
      geoFetched = true;
      sendVisitNotification(null);
    });
  });

  // Safety net: fire visit even if geo takes > 3s (slower networks)
  setTimeout(function() {
    if (!session.visitSent) sendVisitNotification(null);
  }, 3000);

  /* ─── SCROLL DEPTH TRACKING ───────────────────────────────── */
  var THRESHOLDS = [25, 50, 75, 100];
  var scrollTicking = false;

  function getScrollPct() {
    var scrolled = window.scrollY || document.documentElement.scrollTop;
    var total    = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) return 100;
    return Math.min(100, Math.round((scrolled / total) * 100));
  }

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function() {
      scrollTicking = false;
      var pct = getScrollPct();
      if (pct > session.maxScroll) session.maxScroll = pct;

      for (var i = 0; i < THRESHOLDS.length; i++) {
        var t = THRESHOLDS[i];
        if (pct >= t && !scrolledAlready(t)) {
          session.scrollFired.push(t);
          var icons = { 25: "eyes", 50: "zap", 75: "fire", 100: "checkered_flag" };
          var emoji = t >= 100 ? "Finished!" : t + "% explored";
          var msg = "Scroll Depth: " + t + "%\n"
                  + emoji + "\n"
                  + "Time on page: " + formatDuration(Date.now() - session.startTime);
          tg(msg);
        }
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  /* ─── CLICK TRACKING ──────────────────────────────────────── */
  document.addEventListener("click", function (e) {
    // Walk up DOM tree to find nearest anchor
    var anchor = null;
    var el = e.target;
    while (el && el.tagName !== "BODY") {
      if (el.tagName === "A") { anchor = el; break; }
      el = el.parentElement;
    }
    if (!anchor) return;

    var href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return; // skip internal anchors

    var text = (anchor.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) || href;

    // Detect project card name
    var projectName = null;
    var card = null;
    var el2 = anchor;
    while (el2 && el2.tagName !== "BODY") {
      if (el2.classList &&
          (el2.classList.contains("pc") ||
           el2.classList.contains("project-card") ||
           el2.dataset.project)) {
        card = el2; break;
      }
      el2 = el2.parentElement;
    }
    if (card) {
      var heading = card.querySelector("h3, h4, .project-title, .pc-title");
      if (heading) projectName = heading.textContent.trim();
    }

    session.clicks.push({ label: text, href: href });
    if (projectName) {
      session.projectClicks[projectName] = (session.projectClicks[projectName] || 0) + 1;
    }

    var msg = "LINK CLICKED\n";
    msg += "================================\n";
    if (projectName) msg += "Project: " + projectName + "\n";
    msg += "Text: " + text + "\n";
    msg += "URL: " + href + "\n";
    msg += "At: " + formatDuration(Date.now() - session.startTime)
         + "  |  Scroll: " + session.maxScroll + "%";
    tg(msg);
  }, true);

  /* ─── SESSION SUMMARY ON EXIT ─────────────────────────────── */
  function sendSummary() {
    if (session.summarySent) return;
    session.summarySent = true;

    var duration = Date.now() - session.startTime;

    // Skip extremely short sessions — they are almost always bots
    if (duration < MIN_SESSION_MS) return;

    var clicks     = session.clicks;
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

    if (session.scrollFired.length) {
      msg += "\nScroll milestones: " + session.scrollFired.map(function(s) { return s + "%"; }).join(" > ");
    }

    tg(msg);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendSummary();
  });
  window.addEventListener("pagehide", sendSummary, { once: true });

})();
