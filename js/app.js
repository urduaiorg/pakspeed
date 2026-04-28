document.addEventListener('DOMContentLoaded', () => {

  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const gaugeTextOverlay = document.querySelector('.gauge-text-overlay');

  // Sections
  const sectionIdle = document.getElementById('section-idle');
  const sectionTesting = document.getElementById('section-testing');
  const sectionResults = document.getElementById('section-results');
  const sectionFeedback = document.getElementById('section-feedback');
  const sectionShare = document.getElementById('section-share');

  // Gauge Elements
  const gaugeArc = document.getElementById('gauge-arc');
  const gaugeValue = document.getElementById('gauge-value');
  const gaugeLabel = document.getElementById('gauge-label');
  const gaugeUnit = document.getElementById('gauge-unit');
  const testPhase = document.getElementById('test-phase');
  const gaugeTip = document.getElementById('gauge-tip');
  const gaugeGlow = document.getElementById('gauge-glow');
  const gaugeSpeedText = document.querySelector('.gauge-speed-text');

  // Result Elements
  const resDlVal = document.getElementById('res-download-value');
  const resUlVal = document.getElementById('res-upload-value');
  const resPingVal = document.getElementById('res-ping-value');
  const resJitVal = document.getElementById('res-jitter-value');

  const resDlQual = document.getElementById('res-download-quality');
  const resUlQual = document.getElementById('res-upload-quality');
  const resPingQual = document.getElementById('res-ping-quality');
  const resJitQual = document.getElementById('res-jitter-quality');

  // ISP Results
  const resIspName = document.getElementById('res-isp-name');
  const resIspCity = document.getElementById('res-isp-city');
  const resIspType = document.getElementById('res-isp-type');

  // Store last test results for language toggle refresh
  let testResults = null;

  // Animated counter (count up from 0 with ease-out)
  function animateValue(element, start, end, duration, decimals, onComplete) {
    const startTime = performance.now();
    const diff = end - start;
    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.innerText = (start + diff * eased).toFixed(decimals);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else if (onComplete) {
        onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  function valueLanded(element) {
    element.classList.add('value-landed');
    setTimeout(() => element.classList.remove('value-landed'), 400);
  }

  // Constants for gauge
  const ARC_LEN = 691.15; // Circumference of the gauge arc
  const GAUGE_R = 110;    // Gauge arc radius
  const GAUGE_CX = 140;   // Center X
  const GAUGE_CY = 140;   // Center Y
  const START_ANGLE = 135; // degrees (SVG rotation)

  // Phase color map for gauge glow
  const PHASE_COLORS = {
    ping:     { css: 'var(--gold)',       rgb: '255,179,0',   hex: '#FFB300' },
    download: { css: 'var(--neon-green)', rgb: '22,242,166',  hex: '#16F2A6' },
    upload:   { css: 'var(--neon-blue)',  rgb: '56,189,248',  hex: '#38BDF8' }
  };

  // Generate tick marks on gauge
  (function buildTicks() {
    const minorG = document.querySelector('.gauge-ticks-minor');
    const majorG = document.querySelector('.gauge-ticks-major');
    if (!minorG || !majorG) return;
    const totalTicks = 40; // 0–100 in steps of 2.5
    for (let i = 0; i <= totalTicks; i++) {
      const frac = i / totalTicks;
      const angleDeg = START_ANGLE + frac * 270;
      const angleRad = angleDeg * Math.PI / 180;
      const isMajor = (i % 10 === 0); // every 25 units
      const isMinor5 = (i % 2 === 0); // every 5 units
      if (!isMajor && !isMinor5) continue;
      const innerR = isMajor ? 95 : 99;
      const outerR = 105;
      const x1 = Math.cos(angleRad) * innerR;
      const y1 = Math.sin(angleRad) * innerR;
      const x2 = Math.cos(angleRad) * outerR;
      const y2 = Math.sin(angleRad) * outerR;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      (isMajor ? majorG : minorG).appendChild(line);
    }
  })();

  // Move the tip dot along the arc based on progress 0–1
  function updateGaugeTip(progress) {
    if (!gaugeTip) return;
    if (progress <= 0) {
      gaugeTip.classList.remove('visible');
      return;
    }
    gaugeTip.classList.add('visible');
    const angleDeg = START_ANGLE + progress * 270;
    const angleRad = angleDeg * Math.PI / 180;
    const x = GAUGE_CX + Math.cos(angleRad) * GAUGE_R;
    const y = GAUGE_CY + Math.sin(angleRad) * GAUGE_R;
    gaugeTip.setAttribute('cx', x);
    gaugeTip.setAttribute('cy', y);
  }

  // Set gauge ambient glow & text-shadow color per phase
  function setGaugePhaseColor(phase) {
    const c = PHASE_COLORS[phase];
    if (!c) return;
    if (gaugeGlow) {
      gaugeGlow.style.background = 'radial-gradient(circle, rgba(' + c.rgb + ',0.18) 0%, transparent 70%)';
    }
    if (gaugeSpeedText) {
      gaugeSpeedText.style.textShadow = '0 18px 48px rgba(0,0,0,0.42), 0 0 34px rgba(' + c.rgb + ',0.18)';
    }
    if (gaugeTip) {
      gaugeTip.style.fill = c.css;
    }
  }

  // ============================================
  // LIBRESPEED WORKER INTEGRATION
  // ============================================

  const BACKEND_URL = 'https://pakspeed-worker.qaisar-roonjha.workers.dev/api/speedtest';
  const TELEMETRY_URL = 'https://pakspeed-worker.qaisar-roonjha.workers.dev/api/telemetry';
  const STATS_URL = 'https://pakspeed-worker.qaisar-roonjha.workers.dev/api/stats';

  // ============================================
  // COMMUNITY COUNTER
  // ============================================
  function animateCounter(el, target, duration) {
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(target * eased).toLocaleString('en-US');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderCounter(totalTests, totalLocations) {
    const counterLine = document.getElementById('counter-line');
    const counterCta = document.getElementById('counter-cta');
    if (!counterLine || !counterCta) return;

    const isUrdu = window.currentLang !== 'en';

    if (isUrdu) {
      counterLine.innerHTML = 'پاکستان کے <span id="cn-locations" class="counter-number">0</span> مقامات سے <span id="cn-tests" class="counter-number">0</span> دوستوں نے اپنی سپیڈ چیک کی';
      counterCta.textContent = 'آپ بھی چیک کریں۔';
    } else {
      counterLine.innerHTML = '<span id="cn-tests" class="counter-number">0</span> friends from <span id="cn-locations" class="counter-number">0</span> locations across Pakistan checked their speed';
      counterCta.textContent = 'Check yours too.';
    }

    const cnTests = document.getElementById('cn-tests');
    const cnLocations = document.getElementById('cn-locations');
    if (cnTests) animateCounter(cnTests, totalTests, 1500);
    if (cnLocations) animateCounter(cnLocations, totalLocations, 1200);
  }

  // Store stats globally for language toggle re-render
  let cachedStats = null;

  function fetchStats() {
    fetch(STATS_URL)
      .then(r => r.json())
      .then(data => {
        if (data.total_tests) {
          cachedStats = data;
          renderCounter(data.total_tests, data.total_locations);
        }
      })
      .catch(() => {});
  }

  // Re-render counter on language toggle
  window.refreshCounter = () => {
    if (cachedStats) renderCounter(cachedStats.total_tests, cachedStats.total_locations);
  };

  fetchStats();

  // ============================================
  // VERDICT SYSTEM
  // ============================================
  function showVerdict(dl) {
    const el = document.getElementById('verdict-line');
    if (!el) return;

    const isUrdu = window.currentLang !== 'en';
    const t = window.translations[window.currentLang] || {};
    let key, cls;

    if (dl >= 50) { key = 'verdict.fast'; cls = 'verdict-fast'; }
    else if (dl >= 25) { key = 'verdict.good'; cls = 'verdict-good'; }
    else if (dl >= 10) { key = 'verdict.ok'; cls = 'verdict-ok'; }
    else if (dl >= 5) { key = 'verdict.slow'; cls = 'verdict-slow'; }
    else { key = 'verdict.bad'; cls = 'verdict-bad'; }

    el.textContent = t[key] || '';
    el.className = 'verdict-line ' + cls;
    el.classList.remove('hidden');
  }

  // ============================================
  // ISP COMPARISON
  // ============================================
  function fetchIspComparison(dl) {
    const ispName = window.pakspeedData.isp;
    if (!ispName || ispName === 'Unknown') return;

    fetch(STATS_URL + '?isp=' + encodeURIComponent(ispName))
      .then(r => r.json())
      .then(data => {
        if (data.comparison && data.comparison.isp_avg_download) {
          showIspComparison(dl, data.comparison.isp_avg_download, ispName);
        }
      })
      .catch(() => {});
  }

  function showIspComparison(userDl, avgDl, ispName) {
    const el = document.getElementById('isp-comparison');
    if (!el) return;

    const isUrdu = window.currentLang !== 'en';
    const diff = userDl - avgDl;
    const isBetter = diff >= 0;
    const cls = isBetter ? 'compare-better' : 'compare-worse';

    if (isUrdu) {
      el.innerHTML = ispName + ' کی اوسط ڈاؤن لوڈ سپیڈ <span class="compare-value">' + avgDl + ' Mbps</span> ہے۔ آپ کی سپیڈ اس سے <span class="' + cls + '">' + (isBetter ? 'بہتر' : 'کم') + '</span> ہے';
    } else {
      el.innerHTML = ispName + ' average download is <span class="compare-value">' + avgDl + ' Mbps</span>. Your speed is <span class="' + cls + '">' + (isBetter ? 'above' : 'below') + ' average</span>';
    }

    el.classList.remove('hidden');
  }

  // ============================================
  // APP DETECTION (TWA / WebView / PWA)
  // ============================================
  function isInApp() {
    var ua = navigator.userAgent;
    return /wv|WebView/i.test(ua)
      || (/\bVersion\/\d+\.\d+\b/.test(ua) && /Chrome\/\d+/.test(ua))
      || /pakspeed/i.test(ua)
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
  }

  // ============================================
  // HISTORY COMPARISON (localStorage)
  // ============================================
  const HISTORY_KEY = 'pakspeed_last_result';

  function saveTestHistory(dl, ul, ping, jitter) {
    const data = {
      download: dl,
      upload: ul,
      ping: ping,
      jitter: jitter,
      isp: window.pakspeedData.isp || 'Unknown',
      city: window.pakspeedData.city || 'Unknown',
      timestamp: Date.now()
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data));

    // Save full history (app only — persistent in TWA/WebView)
    if (isInApp()) {
      var hist = [];
      try { hist = JSON.parse(localStorage.getItem('pakspeed_history')) || []; } catch(e) {}
      hist.push(data);
      if (hist.length > 100) hist = hist.slice(-100);
      localStorage.setItem('pakspeed_history', JSON.stringify(hist));
    }
  }

  function showHistoryComparison(dl) {
    const el = document.getElementById('history-comparison');
    if (!el) return;

    const prev = localStorage.getItem(HISTORY_KEY);
    if (!prev) return;

    try {
      const data = JSON.parse(prev);
      if (!data.download) return;

      const diff = dl - data.download;
      const absDiff = Math.abs(diff).toFixed(1);
      const isUrdu = window.currentLang !== 'en';
      const t = window.translations[window.currentLang] || {};
      let cls, arrow, text;

      if (diff > 0.5) {
        cls = 'history-improved';
        arrow = '\u2191';
        text = isUrdu
          ? arrow + ' ' + absDiff + ' Mbps ' + t['history.improved']
          : arrow + ' ' + absDiff + ' Mbps ' + t['history.improved'];
      } else if (diff < -0.5) {
        cls = 'history-declined';
        arrow = '\u2193';
        text = isUrdu
          ? arrow + ' ' + absDiff + ' Mbps ' + t['history.declined']
          : arrow + ' ' + absDiff + ' Mbps ' + t['history.declined'];
      } else {
        cls = 'history-same';
        text = t['history.same'] || 'Same speed as before';
      }

      el.textContent = text;
      el.className = 'history-comparison ' + cls;
      el.classList.remove('hidden');
    } catch (e) {}
  }

  // ============================================
  // QUICK WHATSAPP SHARE
  // ============================================
  function setupQuickShare() {
    const btn = document.getElementById('btn-quick-share');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const d = window.pakspeedData;
      const isUrdu = window.currentLang !== 'en';
      const text = isUrdu
        ? '\u0645\u06cc\u0631\u06cc \u0627\u0646\u0679\u0631\u0646\u06cc\u0679 \u0633\u067e\u06cc\u0688 ' + d.download.toFixed(1) + ' Mbps \u06c1\u06d2 ' + d.isp + ' \u067e\u0631 ' + d.city + ' \u0645\u06cc\u06ba۔ \u0622\u067e \u0628\u06be\u06cc \u0686\u06cc\u06a9 \u06a9\u0631\u06cc\u06ba: pakspeed.com'
        : 'My internet speed is ' + d.download.toFixed(1) + ' Mbps on ' + d.isp + ' in ' + d.city + '. Check yours at pakspeed.com';
      window.open('https://wa.me/?text=' + encodeURIComponent(text));
    });
  }
  setupQuickShare();

  let testWorker = null;
  let workerTimer = null;
  let currentPhase = 'idle'; // idle, ping, download, upload, done
  let pingBegan = false;
  let dlBegan = false;
  let ulBegan = false;
  let gaugeSweepTimer = null;

  // Pre-create Web Worker on page load so click doesn't pay creation cost
  let preloadedWorker = null;
  try { preloadedWorker = new Worker('js/speedtest_worker.js'); } catch(e) {}

  // UI Labels for localization
  const UI_LABELS = {
    en: {
      ping: 'Ping',
      download: 'Download',
      upload: 'Upload',
      testing: 'Testing...'
    },
    ur: {
      ping: 'پنگ',
      download: 'ڈاؤن لوڈ',
      upload: 'اپ لوڈ',
      testing: 'ٹیسٹ ہو رہا ہے...'
    }
  };

  function initWorker() {
    if (testWorker) {
      testWorker.terminate();
    }
    // Use pre-created worker if available (avoids ~200ms creation cost on click)
    if (preloadedWorker) {
      testWorker = preloadedWorker;
      preloadedWorker = null;
    } else {
      testWorker = new Worker('js/speedtest_worker.js');
    }

    // Configure worker endpoints to our Cloudflare Worker
    testWorker.postMessage('start {"telemetry_level":"none","url_dl":"' + BACKEND_URL + '","url_ul":"' + BACKEND_URL + '","url_ping":"' + BACKEND_URL + '","test_order":"P_D_U"}');

    // Poll worker for status
    if (workerTimer) clearInterval(workerTimer);
    workerTimer = setInterval(() => {
      if (testWorker) testWorker.postMessage('status');
    }, 200);

    testWorker.onmessage = function (e) {
      let data;
      try { data = JSON.parse(e.data); } catch (err) { return; }

      let status = Number(data.testState); // 1=download, 2=ping, 3=upload, 4=finished, 5=abort
      const isUrdu = window.currentLang !== 'en';

      if (status >= 1 && status <= 4) {
        let ping = Number(data.pingStatus) || 0;
        let jitter = Number(data.jitterStatus) || 0;
        let dl = Number(data.dlStatus) || 0;
        let ul = Number(data.ulStatus) || 0;

        // Phase Flags & UI Labeling
        if (status === 2 && !pingBegan) {
          stopGaugeSweep();
          currentPhase = 'ping';
          pingBegan = true;
          testPhase.innerText = isUrdu ? UI_LABELS.ur.ping : UI_LABELS.en.ping;
          gaugeLabel.innerText = isUrdu ? 'پنگ' : 'Ping';
          gaugeUnit.innerText = 'ms';
        } else if (status === 1 && !dlBegan) {
          stopGaugeSweep();
          currentPhase = 'download';
          dlBegan = true;
          testPhase.innerText = isUrdu ? UI_LABELS.ur.download : UI_LABELS.en.download;
          gaugeLabel.innerText = isUrdu ? 'ڈاؤن لوڈ' : 'Download';
          gaugeUnit.innerText = 'Mbps';

          // Lock in ping results
          resPingVal.innerText = ping.toFixed(0);
          resJitVal.innerText = jitter.toFixed(1);
          setQuality(resPingQual, ping, 'ping');
          setQuality(resJitQual, jitter, 'jitter');
          resPingQual.classList.remove('hidden');
          resJitQual.classList.remove('hidden');
        } else if (status === 3 && !ulBegan) {
          stopGaugeSweep();
          currentPhase = 'upload';
          ulBegan = true;
          testPhase.innerText = isUrdu ? UI_LABELS.ur.upload : UI_LABELS.en.upload;
          gaugeLabel.innerText = isUrdu ? 'اپ لوڈ' : 'Upload';

          // Lock in dl results
          resDlVal.innerText = dl.toFixed(1);
          setQuality(resDlQual, dl, 'dl');
          resDlQual.classList.remove('hidden');
        } else if (status === 4) {
          currentPhase = 'done';
          resUlVal.innerText = ul.toFixed(1);
          setQuality(resUlQual, ul, 'ul');
          resUlQual.classList.remove('hidden');

          if (workerTimer) clearInterval(workerTimer);
          finishTest(ping, jitter, dl, ul);
          return;
        }

        // Drive the UI based on current phase
        if (currentPhase === 'ping') {
          updateGaugeUI(ping, 100);
          gaugeValue.innerText = ping.toFixed(0);
          resPingVal.innerText = ping.toFixed(0);
          if (jitter > 0) resJitVal.innerText = jitter.toFixed(1);
        } else if (currentPhase === 'download') {
          updateGaugeUI(dl, 100);
          gaugeValue.innerText = dl.toFixed(1);
          resDlVal.innerText = dl.toFixed(1);
        } else if (currentPhase === 'upload') {
          updateGaugeUI(ul, 100);
          gaugeValue.innerText = ul.toFixed(1);
          resUlVal.innerText = ul.toFixed(1);
        }
      }
    };
  }

  function updateGaugeUI(val, maxVal) {
    const effectiveMax = val > maxVal ? 1000 : maxVal;
    let p = Math.min(Math.sqrt(Math.max(val, 0) / effectiveMax), 1);
    let offset = ARC_LEN * (1 - p);
    gaugeArc.style.strokeDashoffset = offset;

    // Move tip dot
    updateGaugeTip(p);

    // Color logic + ambient glow
    const c = PHASE_COLORS[currentPhase];
    if (c) {
      gaugeArc.style.stroke = c.css;
      setGaugePhaseColor(currentPhase);
    }
  }

  function startGaugeSweep() {
    stopGaugeSweep();
    let progress = 0.08;
    let direction = 1;
    gaugeSweepTimer = setInterval(() => {
      if (currentPhase !== 'starting') return;
      progress += direction * 0.025;
      if (progress >= 0.82) direction = -1;
      if (progress <= 0.08) direction = 1;
      gaugeArc.style.strokeDashoffset = ARC_LEN * (1 - progress);
      updateGaugeTip(progress);
    }, 80);
  }

  function stopGaugeSweep() {
    if (gaugeSweepTimer) {
      clearInterval(gaugeSweepTimer);
      gaugeSweepTimer = null;
    }
  }

  function runTest() {
    sectionIdle.classList.add('hidden');
    sectionTesting.classList.remove('hidden');
    if (gaugeTextOverlay) gaugeTextOverlay.classList.remove('hidden');
    sectionResults.classList.add('hidden');
    sectionFeedback.classList.add('hidden');
    sectionShare.classList.add('hidden');

    // Reset UI
    resDlVal.innerText = '0.0';
    resUlVal.innerText = '0.0';
    resPingVal.innerText = '0';
    resJitVal.innerText = '0.0';
    resDlQual.className = "result-quality hidden";
    resUlQual.className = "result-quality hidden";
    resPingQual.className = "result-quality hidden";
    resJitQual.className = "result-quality hidden";

    // Reset verdict, comparison, history, quick share
    const verdictEl = document.getElementById('verdict-line');
    const compareEl = document.getElementById('isp-comparison');
    const historyEl = document.getElementById('history-comparison');
    const quickShareEl = document.getElementById('btn-quick-share');
    const posterPreviewEl = document.getElementById('share-poster-preview');
    if (verdictEl) { verdictEl.classList.add('hidden'); verdictEl.className = 'verdict-line hidden'; }
    if (compareEl) { compareEl.classList.add('hidden'); compareEl.innerHTML = ''; }
    if (historyEl) { historyEl.classList.add('hidden'); historyEl.className = 'history-comparison hidden'; }
    if (quickShareEl) { quickShareEl.classList.add('hidden'); }
    if (posterPreviewEl) { posterPreviewEl.classList.add('hidden'); }

    gaugeArc.style.strokeDashoffset = ARC_LEN;
    gaugeValue.innerText = '0.0';
    if (gaugeUnit) gaugeUnit.innerText = 'Mbps';
    testPhase.innerText = (window.currentLang === 'ur' ? UI_LABELS.ur.testing : UI_LABELS.en.testing);
    gaugeLabel.innerText = window.currentLang === 'ur' ? 'رفتار ناپی جا رہی ہے' : 'Measuring speed';

    // Activate gauge ambient glow pulse
    if (gaugeGlow) gaugeGlow.classList.add('active');
    updateGaugeTip(0);
    // Reset speed text glow to green
    setGaugePhaseColor('download');

    // Reset Flags
    pingBegan = false;
    dlBegan = false;
    ulBegan = false;
    currentPhase = 'starting';
    startGaugeSweep();

    // Start Web Worker
    initWorker();
  }

  function finishTest(ping, jitter, dl, ul) {
    // Stop gauge ambient glow pulse
    if (gaugeGlow) gaugeGlow.classList.remove('active');
    stopGaugeSweep();

    sectionTesting.classList.add('hidden');
    sectionResults.classList.remove('hidden');
    sectionFeedback.classList.remove('hidden');
    sectionShare.classList.remove('hidden');

    // Store in global object
    window.pakspeedData.ping = ping;
    window.pakspeedData.jitter = jitter;
    window.pakspeedData.download = dl;
    window.pakspeedData.upload = ul;

    testResults = {
      download: dl,
      upload: ul,
      ping: ping,
      jitter: jitter
    };

    // Animate final values from 0 with glow pulse
    animateValue(resDlVal, 0, dl, 800, 1, () => valueLanded(resDlVal));
    animateValue(resUlVal, 0, ul, 800, 1, () => valueLanded(resUlVal));
    animateValue(resPingVal, 0, ping, 600, 0, () => valueLanded(resPingVal));
    animateValue(resJitVal, 0, jitter, 600, 1, () => valueLanded(resJitVal));

    // Update quality badges for final results
    setQuality(resDlQual, dl, 'dl');
    setQuality(resUlQual, ul, 'ul');
    setQuality(resPingQual, ping, 'ping');
    setQuality(resJitQual, jitter, 'jitter');

    if (typeof window.updateResultPoster === 'function') {
      window.updateResultPoster();
    }

    // Haptic vibration on mobile
    if (navigator.vibrate) navigator.vibrate(50);

    // Show verdict based on download speed
    showVerdict(dl);

    // Show history comparison (before saving new result)
    showHistoryComparison(dl);

    // Save this test for next time
    saveTestHistory(dl, ul, ping, jitter);

    // Show quick WhatsApp share button
    const quickShareBtn = document.getElementById('btn-quick-share');
    if (quickShareBtn) quickShareBtn.classList.remove('hidden');

    // Update daily streak
    updateStreak();

    // Fetch ISP comparison
    fetchIspComparison(dl);

    // Fetch percentile ranking
    fetchPercentile(dl);

    // Send Telemetry to Cloudflare DB
    fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isp_name: window.pakspeedData.isp || 'Unknown',
        city: window.pakspeedData.city || 'Unknown',
        latitude: window.pakspeedData.latitude || null,
        longitude: window.pakspeedData.longitude || null,
        ping_ms: ping,
        download_mbps: dl,
        upload_mbps: ul,
        language: window.currentLang
      })
    }).catch(e => console.error("Telemetry error:", e));

    if (typeof renderFeedback === 'function') {
      renderFeedback(dl, ul, ping);
    }

    // Show ISP review widget after a short delay (non-intrusive)
    if (typeof showReviewWidget === 'function') {
      setTimeout(() => {
        showReviewWidget(window.pakspeedData.isp, dl);
      }, 2000);
    }

    // Small delay to allow layout recalculation before scroll
    setTimeout(() => {
      sectionResults.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function getQualityData(value, type) {
    const isUrdu = window.currentLang !== 'en';
    let fast, avg;

    switch (type) {
      case 'dl': fast = 50; avg = 15; break;
      case 'ul': fast = 25; avg = 8; break;
      case 'ping': fast = 30; avg = 100; break;
      case 'jitter': fast = 10; avg = 30; break;
    }

    let label = "", cls = "";

    if (type === 'ping' || type === 'jitter') {
      if (value < fast) { label = isUrdu ? 'بہترین' : 'Excellent'; cls = 'qual-green'; }
      else if (value <= avg) { label = isUrdu ? 'مناسب' : 'Fair'; cls = 'qual-yellow'; }
      else { label = isUrdu ? 'زیادہ' : 'High'; cls = 'qual-red'; }
    } else {
      if (value >= fast) { label = isUrdu ? 'بہترین' : 'Excellent'; cls = 'qual-green'; }
      else if (value >= avg) { label = isUrdu ? 'مناسب' : 'Fair'; cls = 'qual-yellow'; }
      else { label = isUrdu ? 'کم' : 'Low'; cls = 'qual-red'; }
    }

    return { label, cls };
  }

  const QUAL_ICONS = {
    'qual-green': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    'qual-yellow': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    'qual-red': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  function setQuality(el, val, type) {
    const data = getQualityData(val, type);
    const icon = QUAL_ICONS[data.cls] || '';
    el.innerHTML = '<span class="qual-icon">' + icon + '</span> ' + data.label;
    el.className = 'result-quality ' + data.cls;
  }

  function showResults(results) {
    // This function is now largely redundant as results are updated live
    // and finalized in finishTest. Keeping for ISP info.
    resIspName.innerText = window.pakspeedData.isp || '—';
    resIspCity.innerText = window.pakspeedData.city || '—';

    let ispType = window.currentLang === 'ur' ? 'معلوم نہیں' : 'Unknown';
    if (typeof ISP_MAP !== 'undefined') {
      for (const key of Object.keys(ISP_MAP)) {
        if (ISP_MAP[key].name === window.pakspeedData.isp) {
          ispType = ISP_MAP[key].type;
          break;
        }
      }
    }
    resIspType.innerText = ispType;
    resIspType.className = 'isp-type-badge';
    const typeStr = ispType.toLowerCase();
    if (typeStr.includes('fiber') || typeStr.includes('فائبر')) resIspType.classList.add('isp-type-fiber');
    else if (typeStr.includes('mobile') || typeStr.includes('موبائل') || typeStr.includes('4g') || typeStr.includes('5g')) resIspType.classList.add('isp-type-mobile');
    else if (typeStr.includes('dsl')) resIspType.classList.add('isp-type-dsl');
    else if (typeStr.includes('wireless') || typeStr.includes('وائرلیس')) resIspType.classList.add('isp-type-wireless');
  }

  // Exposed for i18n.js to call on language toggle
  window.refreshQualityBadges = () => {
    if (!testResults) return;
    setQuality(resDlQual, testResults.download, 'dl');
    setQuality(resUlQual, testResults.upload, 'ul');
    setQuality(resPingQual, testResults.ping, 'ping');
    setQuality(resJitQual, testResults.jitter, 'jitter');

    // Also refresh ISP type label
    let ispType = window.currentLang === 'ur' ? 'معلوم نہیں' : 'Unknown';
    if (typeof ISP_MAP !== 'undefined') {
      for (const key of Object.keys(ISP_MAP)) {
        if (ISP_MAP[key].name === window.pakspeedData.isp) {
          ispType = ISP_MAP[key].type;
          break;
        }
      }
    }
    resIspType.innerText = ispType;
    resIspType.className = 'isp-type-badge';
    const typeStr2 = ispType.toLowerCase();
    if (typeStr2.includes('fiber') || typeStr2.includes('فائبر')) resIspType.classList.add('isp-type-fiber');
    else if (typeStr2.includes('mobile') || typeStr2.includes('موبائل') || typeStr2.includes('4g') || typeStr2.includes('5g')) resIspType.classList.add('isp-type-mobile');
    else if (typeStr2.includes('dsl')) resIspType.classList.add('isp-type-dsl');
    else if (typeStr2.includes('wireless') || typeStr2.includes('وائرلیس')) resIspType.classList.add('isp-type-wireless');

    // Re-render feedback in new language
    if (typeof renderFeedback === 'function' && !sectionFeedback.classList.contains('hidden')) {
      renderFeedback(testResults.download, testResults.upload, testResults.ping);
    }
  };

  // Preload the speed test worker on pointerdown for faster INP
  if (btnStart) {
    btnStart.addEventListener('pointerdown', () => {
      // Instant visual feedback on pointer contact (before click fires)
      btnStart.style.transform = 'scale(0.95)';
      btnStart.style.opacity = '0.7';
    }, { passive: true });

    btnStart.addEventListener('click', () => {
      // Immediate visual state change — this is what INP measures.
      // Keep it minimal so the browser can paint fast.
      btnStart.disabled = true;
      btnStart.style.opacity = '0.6';

      // Use setTimeout(0) to yield to browser for paint, then do heavy work.
      // This breaks the long task so INP captures only the visual change above.
      setTimeout(() => {
        runTest();
        btnStart.disabled = false;
        btnStart.style.opacity = '';
        btnStart.style.transform = '';
        btnStart.textContent = '';
        const span = document.createElement('span');
        span.setAttribute('data-i18n', 'button.start');
        span.textContent = window.currentLang === 'ur' ? 'شروع کریں' : 'Start';
        btnStart.appendChild(span);
      }, 0);
    });
  }
  if (btnRestart) btnRestart.addEventListener('click', () => {
    if (testWorker) {
      testWorker.postMessage('abort');
      testWorker = null;
    }
    runTest();
  });
  const btnPosterRetry = document.getElementById('btn-poster-retry');
  if (btnPosterRetry) btnPosterRetry.addEventListener('click', () => {
    if (btnRestart) {
      btnRestart.click();
    } else {
      runTest();
    }
  });

  // ============================================
  // DAILY SPEED STREAK
  // ============================================
  function updateStreak() {
    var STREAK_KEY = 'pakspeed_streak';
    var now = new Date();
    var todayStr = now.toISOString().slice(0, 10);
    var streakData = null;
    try { streakData = JSON.parse(localStorage.getItem(STREAK_KEY)); } catch (e) {}
    if (!streakData) {
      streakData = { count: 1, lastDate: todayStr };
    } else if (streakData.lastDate !== todayStr) {
      var diffDays = Math.floor((now - new Date(streakData.lastDate)) / 86400000);
      streakData.count = diffDays === 1 ? streakData.count + 1 : 1;
      streakData.lastDate = todayStr;
    }
    localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
    if (streakData.count >= 2) {
      var el = document.getElementById('streak-badge');
      if (el) {
        var isUrdu = window.currentLang !== 'en';
        el.textContent = isUrdu
          ? '\uD83D\uDD25 ' + streakData.count + ' دن کی سٹریک!'
          : '\uD83D\uDD25 ' + streakData.count + ' day streak!';
        el.classList.remove('hidden');
      }
    }
  }

  // ============================================
  // PERCENTILE CALCULATION
  // ============================================
  function fetchPercentile(dl) {
    fetch('https://pakspeed-worker.qaisar-roonjha.workers.dev/api/leaderboard')
      .then(function (r) { return r.json(); })
      .then(function (cities) {
        if (!Array.isArray(cities) || cities.length === 0) return;
        var below = 0, total = 0;
        cities.forEach(function (c) {
          var tests = c.total_tests || 1;
          total += tests;
          if (c.avg_download < dl) below += tests;
          else if (Math.abs(c.avg_download - dl) < 0.5) below += tests * 0.5;
        });
        var pct = Math.min(99, Math.max(1, Math.round((below / total) * 100)));
        showPercentile(pct);
      })
      .catch(function () {});
  }

  function showPercentile(pct) {
    var el = document.getElementById('percentile-line');
    if (!el) return;
    window.pakspeedData.percentile = pct;
    var isUrdu = window.currentLang !== 'en';
    el.classList.remove('hidden');
    var current = 0;
    function step() {
      current += Math.max(1, Math.floor((pct - current) / 6));
      if (current >= pct) current = pct;
      el.textContent = isUrdu
        ? '\u0622\u067e \u067e\u0627\u06a9\u0633\u062a\u0627\u0646 \u06a9\u06d2 ' + current + '% \u0644\u0648\u06af\u0648\u06ba \u0633\u06d2 \u062a\u06cc\u0632 \u06c1\u06cc\u06ba'
        : "You're faster than " + current + "% of Pakistan";
      if (current < pct) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ============================================
  // LIVE ACTIVITY TOAST
  // ============================================
  (function initActivityToast() {
    var toastEl = document.getElementById('activity-toast');
    var toastText = document.getElementById('toast-text');
    var toastDismiss = document.getElementById('toast-dismiss');
    if (!toastEl || !toastText) return;

    var CITY_UR = {
      'Karachi':'\u06a9\u0631\u0627\u0686\u06cc','Lahore':'\u0644\u0627\u06c1\u0648\u0631','Islamabad':'\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062f',
      'Rawalpindi':'\u0631\u0627\u0648\u0644\u067e\u0646\u0688\u06cc','Faisalabad':'\u0641\u06cc\u0635\u0644 \u0622\u0628\u0627\u062f','Multan':'\u0645\u0644\u062a\u0627\u0646',
      'Peshawar':'\u067e\u0634\u0627\u0648\u0631','Quetta':'\u06a9\u0648\u0626\u0679\u06c1','Sialkot':'\u0633\u06cc\u0627\u0644\u06a9\u0648\u0679',
      'Gujranwala':'\u06af\u0648\u062c\u0631\u0627\u0646\u0648\u0627\u0644\u06c1','Hyderabad':'\u062d\u06cc\u062f\u0631\u0622\u0628\u0627\u062f','Abbottabad':'\u0627\u06cc\u0628\u0679 \u0622\u0628\u0627\u062f',
      'Bahawalpur':'\u0628\u06c1\u0627\u0648\u0644\u067e\u0648\u0631','Sargodha':'\u0633\u0631\u06af\u0648\u062f\u06be\u0627','Sukkur':'\u0633\u06a9\u06be\u0631',
      'Larkana':'\u0644\u0627\u0691\u06a9\u0627\u0646\u06c1','Mardan':'\u0645\u0631\u062f\u0627\u0646','Gujrat':'\u06af\u062c\u0631\u0627\u062a',
      'Sahiwal':'\u0633\u0627\u06c1\u06cc\u0648\u0627\u0644','Jhelum':'\u062c\u06c1\u0644\u0645','Rahim Yar Khan':'\u0631\u062d\u06cc\u0645 \u06cc\u0627\u0631 \u062e\u0627\u0646',
      'Muzaffarabad':'\u0645\u0638\u0641\u0631 \u0622\u0628\u0627\u062f','Mirpur':'\u0645\u06cc\u0631\u067e\u0648\u0631','Okara':'\u0627\u0648\u06a9\u0627\u0691\u06c1',
      'Dera Ghazi Khan':'\u0688\u06cc\u0631\u06c1 \u063a\u0627\u0632\u06cc \u062e\u0627\u0646','Chiniot':'\u0686\u0646\u06cc\u0648\u0679','Kasur':'\u0642\u0635\u0648\u0631',
      'Wah':'\u0648\u0627\u06c1','Taxila':'\u0679\u06cc\u06a9\u0633\u0644\u0627','Bannu':'\u0628\u0646\u0648\u06ba',
      'Swat':'\u0633\u0648\u0627\u062a','Mansehra':'\u0645\u0627\u0646\u0633\u06c1\u0631\u06c1','Nowshera':'\u0646\u0648\u0634\u06c1\u0631\u06c1',
      'Kohat':'\u06a9\u0648\u06c1\u0627\u0679','Mingora':'\u0645\u06cc\u0646\u06af\u0648\u0631\u06c1','Turbat':'\u062a\u0631\u0628\u062a',
      'Gilgit':'\u06af\u0644\u06af\u062a','Skardu':'\u0633\u06a9\u0631\u062f\u0648','Muzaffargarh':'\u0645\u0638\u0641\u0631\u06af\u0691\u06be',
      'Nawabshah':'\u0646\u0648\u0627\u0628 \u0634\u0627\u06c1','Jacobabad':'\u062c\u06cc\u06a9\u0628 \u0622\u0628\u0627\u062f','Khuzdar':'\u062e\u0636\u062f\u0627\u0631',
      'Mianwali':'\u0645\u06cc\u0627\u0646\u0648\u0627\u0644\u06cc','Jhang':'\u062c\u06be\u0646\u06af','Sheikhupura':'\u0634\u06cc\u062e\u0648\u067e\u0648\u0631\u06c1',
      'Vehari':'\u0648\u06c1\u0627\u0631\u06cc','Khanewal':'\u062e\u0627\u0646\u06cc\u0648\u0627\u0644','Jampur':'\u062c\u0627\u0645\u067e\u0648\u0631',
      'Attock':'\u0627\u0679\u06a9','Hafizabad':'\u062d\u0627\u0641\u0638 \u0622\u0628\u0627\u062f','Toba Tek Singh':'\u0679\u0648\u0628\u06c1 \u0679\u06cc\u06a9 \u0633\u0646\u06af\u06be',
      'Bhakkar':'\u0628\u06be\u06a9\u0631','Lodhran':'\u0644\u0648\u062f\u06be\u0631\u0627\u06ba','Layyah':'\u0644\u06cc\u06c1',
      'Pakpattan':'\u067e\u0627\u06a9\u067e\u062a\u0646','Narowal':'\u0646\u0627\u0631\u0648\u0648\u0627\u0644','Chakwal':'\u0686\u06a9\u0648\u0627\u0644',
      'Haripur':'\u06c1\u0631\u06cc\u067e\u0648\u0631','Charsadda':'\u0686\u0627\u0631\u0633\u062f\u06c1','Swabi':'\u0635\u0648\u0627\u0628\u06cc',
      'Chitral':'\u0686\u062a\u0631\u0627\u0644','Dir':'\u062f\u06cc\u0631','Hangu':'\u06c1\u0646\u06af\u0648',
      'Tank':'\u0679\u06cc\u0646\u06a9','Ziarat':'\u0632\u06cc\u0627\u0631\u062a','Gwadar':'\u06af\u0648\u0627\u062f\u0631',
      'Hub':'\u06c1\u0628','Zhob':'\u0698\u0648\u0628','Thatta':'\u0679\u06be\u0679\u06c1',
      'Mirpur Khas':'\u0645\u06cc\u0631\u067e\u0648\u0631 \u062e\u0627\u0635','Dadu':'\u062f\u0627\u062f\u0648','Khairpur':'\u062e\u06cc\u0631\u067e\u0648\u0631'
    };
    function cityUr(name) { return CITY_UR[name] || name; }

    var dismissed = false;
    var toastTimer = null;
    var cityData = []; // populated from real leaderboard API
    var cityIdx = 0;

    function showToast() {
      if (dismissed || !sectionIdle || sectionIdle.classList.contains('hidden')) return;
      if (cityData.length === 0) return;
      var city = cityData[cityIdx % cityData.length];
      cityIdx++;
      var isUrdu = window.currentLang !== 'en';
      toastText.dir = isUrdu ? 'rtl' : 'ltr';
      toastText.innerHTML = isUrdu
        ? cityUr(city.city) + ' \u0645\u06cc\u06ba \u0622\u062c \u06a9\u06cc \u0627\u0648\u0633\u0637 \u0627\u0646\u0679\u0631\u0646\u06cc\u0679 \u0633\u067e\u06cc\u0688 \u06c1\u06d2 <bdi>' + city.avg_download + ' Mbps</bdi>'
        : 'Avg speed in ' + city.city + ': ' + city.avg_download + ' Mbps &mdash; ' + city.total_tests + ' tests';
      toastEl.classList.remove('hidden', 'toast-out');
      setTimeout(function () {
        if (!dismissed) {
          toastEl.classList.add('toast-out');
          setTimeout(function () { toastEl.classList.add('hidden'); }, 300);
        }
      }, 4000);
    }

    if (toastDismiss) {
      toastDismiss.addEventListener('click', function () {
        dismissed = true;
        toastEl.classList.add('hidden');
        if (toastTimer) clearInterval(toastTimer);
      });
    }

    // Fetch real community data then start cycling
    fetch('https://pakspeed-worker.qaisar-roonjha.workers.dev/api/leaderboard')
      .then(function (r) { return r.json(); })
      .then(function (cities) {
        if (!Array.isArray(cities) || cities.length === 0) return;
        // Shuffle and pick top cities with most tests for relevance
        cityData = cities
          .filter(function (c) { return c.total_tests >= 3; })
          .sort(function () { return Math.random() - 0.5; });
        if (cityData.length === 0) return;
        setTimeout(function () {
          showToast();
          toastTimer = setInterval(showToast, 6000);
        }, 3000);
      })
      .catch(function () {}); // silent fail — toast just won't show
  })();

  // ============================================
  // APP RATING AUTO-UPDATE
  // ============================================
  setTimeout(function () {
    fetch('/api/app-rating').then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.rating) return;
      if (!data.visible) {
        var badge = document.getElementById('app-rating-badge');
        if (badge) badge.style.display = 'none';
        var schema = document.getElementById('schema-app-rating');
        if (schema) schema.remove();
        return;
      }
      var ratingEl = document.getElementById('app-rating-value');
      if (ratingEl) ratingEl.textContent = data.rating.toFixed(1);
      var schema = document.getElementById('schema-app-rating');
      if (schema) {
        try {
          var ld = JSON.parse(schema.textContent);
          ld.aggregateRating.ratingValue = String(data.rating);
          if (data.count) ld.aggregateRating.ratingCount = String(data.count);
          schema.textContent = JSON.stringify(ld);
        } catch (e) {}
      }
    }).catch(function () {});
  }, 2000);
});
