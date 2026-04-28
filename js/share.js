async function loadHtml2Canvas() {
  if (typeof html2canvas !== 'undefined') return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

// ISP → verified official X handles
var ISP_HANDLES = {
  'PTCL':       '@PTCLOfficial',
  'Jazz':       '@jazzpk',
  'Zong':       '@Zongers',
  'Telenor':    '@telenorpakistan',
  'Ufone':      '@Ufone',
  'StormFiber': '@StormFiberPK',
  'Nayatel':    '@nayatelpk',
  'Transworld': '@TWA_OfficialPK',
  'Fiberlink':  '@Fiberlink'
};

function getIspHandle(ispName) {
  if (!ispName) return 'ISP';
  for (var key in ISP_HANDLES) {
    if (ispName.indexOf(key) !== -1) return ISP_HANDLES[key];
  }
  return ispName;
}

function populateResultCard(template) {
  if (!template || !window.pakspeedData) return;
  const d = window.pakspeedData;
  const isUrdu = window.currentLang !== 'en';

  // City
  var cityNameEl = template.querySelector('.rc-city-name');
  if (cityNameEl) cityNameEl.innerText = d.city || 'Pakistan';

  // Speed + color
  var speedEl = template.querySelector('.rc-speed');
  speedEl.innerText = d.download.toFixed(1);
  if (d.download >= 25) speedEl.style.color = '#00FF88';
  else if (d.download >= 10) speedEl.style.color = '#fbbf24';
  else speedEl.style.color = '#f87171';

  // Upload
  template.querySelector('.rc-upload-val').innerText = d.upload.toFixed(1) + ' Mbps';

  // ISP + Date
  template.querySelector('.rc-isp').innerText = d.isp || 'Unknown';
  var dateEl = template.querySelector('.rc-date');
  if (dateEl) {
    var now = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateEl.innerText = '\u200E' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  }

  // Percentile
  var rcPct = template.querySelector('.rc-percentile');
  if (rcPct && d.percentile) {
    rcPct.innerText = isUrdu
      ? '\u067e\u0627\u06a9\u0633\u062a\u0627\u0646 \u06a9\u06d2 ' + d.percentile + '% \u0644\u0648\u06af\u0648\u06ba \u0633\u06d2 \u062a\u06cc\u0632'
      : 'Faster than ' + d.percentile + '% of Pakistan';
    rcPct.style.display = 'block';
  } else if (rcPct) {
    rcPct.style.display = 'none';
  }

  // Bilingual labels
  if (isUrdu) {
    template.querySelector('.rc-upload-label').innerText = '\u0627\u067e \u0644\u0648\u0688';
    var dlLabel = template.querySelector('.rc-dl-label');
    if (dlLabel) dlLabel.innerText = '\u0688\u0627\u0624\u0646 \u0644\u0648\u0688';
  } else {
    template.querySelector('.rc-upload-label').innerText = 'Upload';
    var dlLabel = template.querySelector('.rc-dl-label');
    if (dlLabel) dlLabel.innerText = 'Download';
  }
}

window.updateResultPoster = function updateResultPoster() {
  var previewWrap = document.getElementById('share-poster-preview');
  var preview = document.getElementById('result-card-preview');
  if (!previewWrap || !preview) return;
  populateResultCard(preview);
  previewWrap.classList.remove('hidden');
};

async function generateResultCard() {
  const template = document.getElementById('result-card');
  const loaded = await loadHtml2Canvas();
  if (!loaded) { console.warn('html2canvas failed to load'); return null; }

  populateResultCard(template);

  template.classList.remove('result-card-hidden');

  // Wait for Naskh font to render before capture
  await document.fonts.ready;

  try {
    const canvas = await html2canvas(template, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0A1628',
      windowWidth: 600,
      windowHeight: 480
    });
    template.classList.add('result-card-hidden');
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  } catch (e) {
    console.error("html2canvas error", e);
    template.classList.add('result-card-hidden');
    return null;
  }
}

async function shareResults(platform) {
  const d = window.pakspeedData;
  const isUrdu = window.currentLang !== 'en';

  // Build tweet text (complaint vs celebration)
  var tweetText;
  if (platform === 'tw') {
    var handle = getIspHandle(d.isp);
    var pct = d.percentile || 50;
    var dl = d.download.toFixed(1);
    var city = d.city || 'Pakistan';
    var isPoor = d.download < 10;

    if (isPoor) {
      tweetText = isUrdu
        ? '\u0622\u062c ' + city + ' \u0645\u06cc\u06ba \u0645\u06cc\u0631\u06cc ' + handle + ' \u0633\u067e\u06cc\u0688 \u0635\u0631\u0641 ' + dl + ' Mbps\n\u067e\u0627\u06a9\u0633\u062a\u0627\u0646 \u06a9\u06d2 ' + (100 - pct) + '% \u0644\u0648\u06af\u0648\u06ba \u0633\u06d2 \u0633\u0633\u062a!\n@PTAofficialpk \u0646\u0648\u0679\u0633 \u0644\u06cc\u06ba\n#PakSpeed #InternetPakistan\npakspeed.com'
        : 'My ' + handle + ' speed in ' + city + ': just ' + dl + ' Mbps\nSlower than ' + (100 - pct) + '% of Pakistan!\n@PTAofficialpk please take note\n#PakSpeed #InternetPakistan\npakspeed.com';
    } else {
      tweetText = isUrdu
        ? '\u0622\u062c ' + city + ' \u0645\u06cc\u06ba \u0645\u06cc\u0631\u06cc ' + handle + ' \u0633\u067e\u06cc\u0688 ' + dl + ' Mbps\n\u067e\u0627\u06a9\u0633\u062a\u0627\u0646 \u06a9\u06d2 ' + pct + '% \u0644\u0648\u06af\u0648\u06ba \u0633\u06d2 \u062a\u06cc\u0632!\n#PakSpeed #InternetPakistan\npakspeed.com'
        : 'My ' + handle + ' speed in ' + city + ': ' + dl + ' Mbps\nFaster than ' + pct + '% of Pakistan!\n#PakSpeed #InternetPakistan\npakspeed.com';
    }
  }

  // Generic text for non-Twitter platforms
  var text = isUrdu
    ? '\u0645\u06cc\u0631\u06cc \u0627\u0646\u0679\u0631\u0646\u06cc\u0679 \u0633\u067e\u06cc\u0688 ' + d.download.toFixed(1) + ' Mbps \u06c1\u06d2 ' + d.isp + ' \u067e\u0631 ' + d.city + ' \u0645\u06cc\u06ba۔ \u0622\u067e \u0628\u06be\u06cc \u0686\u06cc\u06a9 \u06a9\u0631\u06cc\u06ba: pakspeed.com'
    : 'My internet speed is ' + d.download.toFixed(1) + ' Mbps on ' + d.isp + ' in ' + d.city + '. Check yours at pakspeed.com';

  // Loading indicator
  var btnSelector;
  if (platform === 'wa') btnSelector = '#btn-whatsapp';
  else if (platform === 'fb') btnSelector = '#btn-facebook';
  else if (platform === 'tw') btnSelector = '#btn-twitter';
  else if (platform === 'download') btnSelector = '#btn-download-card';

  var btn, originalHtml = '';
  if (btnSelector) {
    btn = document.querySelector(btnSelector);
    if (btn) {
      originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="share-btn-text">\u23F3</span>';
    }
  }

  var blob = await generateResultCard();
  if (btn) btn.innerHTML = originalHtml;

  // Download flow
  if (platform === 'download' && blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pakspeed_' + d.download.toFixed(0) + 'mbps.png';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Twitter: Web Share API with image on mobile, else intent/tweet
  if (platform === 'tw') {
    if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'pakspeed.png', { type: 'image/png' })] })) {
      try {
        var file = new File([blob], 'pakspeed.png', { type: 'image/png' });
        await navigator.share({ text: tweetText, files: [file] });
        return;
      } catch (e) { /* share cancelled */ }
    }
    // Fallback: download image + open tweet intent
    if (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'pakspeed_' + d.download.toFixed(0) + 'mbps.png';
      a.click();
      URL.revokeObjectURL(url);
    }
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText));
    return;
  }

  // Native share for WA/FB
  if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'pakspeed.png', { type: 'image/png' })] })) {
    try {
      var file = new File([blob], 'pakspeed.png', { type: 'image/png' });
      await navigator.share({ title: 'PakSpeed.com', text: text, files: [file] });
      return;
    } catch (e) { /* share cancelled */ }
  } else if (blob && platform !== 'copy') {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pakspeed_' + d.download.toFixed(0) + 'mbps.png';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (platform === 'wa') {
    window.open('https://wa.me/?text=' + encodeURIComponent(text));
  } else if (platform === 'fb') {
    window.open('https://www.facebook.com/sharer/sharer.php?u=https://pakspeed.com&quote=' + encodeURIComponent(text));
  } else if (platform === 'copy') {
    try {
      await navigator.clipboard.writeText(text);
      var copyBtn = document.querySelector('#btn-copy .share-btn-text');
      if (copyBtn) {
        var oldText = copyBtn.innerText;
        copyBtn.innerText = isUrdu ? '\u06a9\u0627\u067e\u06cc \u06c1\u0648 \u06af\u06cc\u0627!' : 'Copied!';
        setTimeout(function() { copyBtn.innerText = oldText; }, 2000);
      }
    } catch (e) { console.error('Copy failed'); }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  var waBtn = document.getElementById('btn-whatsapp');
  var fbBtn = document.getElementById('btn-facebook');
  var twBtn = document.getElementById('btn-twitter');
  var copyBtn = document.getElementById('btn-copy');
  var dlBtn = document.getElementById('btn-download-card');
  var posterWaBtn = document.getElementById('btn-poster-whatsapp');
  var posterDlBtn = document.getElementById('btn-poster-download');

  if (waBtn) waBtn.addEventListener('click', () => shareResults('wa'));
  if (fbBtn) fbBtn.addEventListener('click', () => shareResults('fb'));
  if (twBtn) twBtn.addEventListener('click', () => shareResults('tw'));
  if (copyBtn) copyBtn.addEventListener('click', () => shareResults('copy'));
  if (dlBtn) dlBtn.addEventListener('click', () => shareResults('download'));
  if (posterWaBtn) posterWaBtn.addEventListener('click', () => shareResults('wa'));
  if (posterDlBtn) posterDlBtn.addEventListener('click', () => shareResults('download'));
});
