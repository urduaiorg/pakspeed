/**
 * Cloudflare Pages Functions Middleware
 * Edge-side rendering for SEO — makes JS-rendered pages crawlable
 *
 * Clean URL routing:
 *   /city/Lahore        → city page with edge-injected meta
 *   /isp/PTCL           → ISP page with edge-injected meta
 *   /compare/X-vs-Y     → comparison page with edge data
 *   /sitemap.xml        → dynamic sitemap from API
 *
 * 301 redirects from legacy URLs:
 *   /city.html?city=X      → /city/X
 *   /isp-detail.html?isp=X → /isp/X
 */

const WORKER_API = 'https://pakspeed-worker.qaisar-roonjha.workers.dev/api';
const SITE = 'https://pakspeed.com';
const OG_IMAGE = 'https://pakspeed.com/assets/og-image.jpg';
const CANONICAL_HOST = 'pakspeed.com';
const STATIC_HTML_PATHS = new Set([
  '/about',
  '/ai-reports',
  '/best-isp',
  '/blog',
  '/city',
  '/compare',
  '/complaint',
  '/guide',
  '/isp',
  '/isp-detail',
  '/leaderboard',
  '/map',
  '/my-speed',
  '/privacy',
  '/report',
  '/terms',
  '/5g',
  '/5g-auction',
  '/5g-asia',
  '/3g-4g-5g-difference',
  '/5g-launch-guide',
  '/best-isp-ranking-2026',
  '/best-wifi-router-2026',
  '/improve-internet-speed',
  '/internet-slow-at-night',
  '/internet-speed-by-province',
  '/phone-5g-support',
  '/pta-complaint-guide',
  '/ptcl-vs-stormfiber-vs-nayatel',
  '/speed-needed-streaming',
  '/why-internet-slow-pakistan'
]);
function getToday() { return new Date().toISOString().slice(0, 10); }

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  let shouldRedirect = false;

  // ── Canonical host: consolidate www/non-www in Search Console ──
  if (url.hostname === 'www.pakspeed.com') {
    url.hostname = CANONICAL_HOST;
    shouldRedirect = true;
  }

  // ── Canonical static URLs: Cloudflare redirects /about.html → /about.
  // Serve clean static paths from their HTML files to avoid redirect loops.
  const normalizedPath = url.pathname.endsWith('/') && url.pathname !== '/'
    ? url.pathname.slice(0, -1)
    : url.pathname;

  if (shouldRedirect) {
    return Response.redirect(url.toString(), 301);
  }

  if (STATIC_HTML_PATHS.has(normalizedPath)) {
    const assetUrl = new URL(context.request.url);
    assetUrl.pathname = `${normalizedPath}.html`;
    assetUrl.search = '';
    return context.env.ASSETS.fetch(new Request(assetUrl.toString(), { headers: context.request.headers }));
  }

  // ── Clean URL: /city/Lahore/PTCL (City×ISP) ── must be before /city/X
  const cityIspMatch = url.pathname.match(/^\/city\/([^\/]+)\/([^\/]+)$/);
  if (cityIspMatch) {
    return handleCityIspPage(context, decodeURIComponent(cityIspMatch[1]), decodeURIComponent(cityIspMatch[2]));
  }

  // ── Clean URL: /city/Lahore ──
  const cityMatch = url.pathname.match(/^\/city\/([^\/]+)$/);
  if (cityMatch) {
    return handleCityPage(context, decodeURIComponent(cityMatch[1]));
  }

  // ── Clean URL: /isp/PTCL ──
  const ispMatch = url.pathname.match(/^\/isp\/([^\/]+)$/);
  if (ispMatch) {
    return handleIspPage(context, decodeURIComponent(ispMatch[1]));
  }

  // ── Comparison: /compare/X-vs-Y ──
  const cmpMatch = url.pathname.match(/^\/compare\/(.+)-vs-(.+)$/i);
  if (cmpMatch) {
    return handleComparePage(context, decodeURIComponent(cmpMatch[1]), decodeURIComponent(cmpMatch[2]));
  }

  // ── Dynamic sitemap ──
  if (url.pathname === '/sitemap.xml') {
    return handleDynamicSitemap();
  }

  // ── IndexNow ping (POST /indexnow-ping to submit URLs to Bing/Yandex) ──
  if (url.pathname === '/indexnow-ping' && context.request.method === 'POST') {
    return handleIndexNowPing();
  }

  // ── 301 Redirect: legacy query-param URLs → clean URLs ──
  if ((url.pathname === '/city.html' || url.pathname === '/city') && url.searchParams.get('city')) {
    return Response.redirect(`${SITE}/city/${encodeURIComponent(url.searchParams.get('city'))}`, 301);
  }
  if ((url.pathname === '/isp-detail.html' || url.pathname === '/isp-detail') && url.searchParams.get('isp')) {
    return Response.redirect(`${SITE}/isp/${encodeURIComponent(url.searchParams.get('isp'))}`, 301);
  }

  return context.next();
}

// ═══════════════════════════════════════════════════
// CITY PAGE — /city/Lahore
// ═══════════════════════════════════════════════════
async function handleCityPage(context, city) {
  const templateUrl = new URL(context.request.url);
  templateUrl.pathname = '/city.html';
  templateUrl.search = '';
  const response = await context.env.ASSETS.fetch(new Request(templateUrl.toString(), { headers: context.request.headers }));

  const safeCity = esc(city);

  let data = null;
  try {
    const apiResp = await fetch(`${WORKER_API}/city-stats?city=${encodeURIComponent(city)}`, {
      cf: { cacheTtl: 3600 }
    });
    data = await apiResp.json();
  } catch (e) {}

  const avgDl = data?.city?.avg_download || '';

  if (!avgDl) {
    const url404 = new URL(context.request.url);
    url404.pathname = '/404.html';
    url404.search = '';
    const res404 = await context.env.ASSETS.fetch(new Request(url404.toString(), { headers: context.request.headers }));
    return new Response(res404.body, { status: 404, headers: res404.headers });
  }

  const avgUl = data?.city?.avg_upload || '';
  const avgPing = data?.city?.avg_ping || '';
  const totalTests = data?.city?.total_tests || '';
  const maxDl = data?.city?.max_download || '';

  const title = avgDl
    ? `${safeCity} Internet Speed ${avgDl} Mbps — PakSpeed | ${safeCity} انٹرنیٹ سپیڈ`
    : `${safeCity} Internet Speed Test — PakSpeed | ${safeCity} انٹرنیٹ سپیڈ ٹیسٹ`;

  const desc = avgDl
    ? `Average internet speed in ${safeCity}: ${avgDl} Mbps download, ${avgUl} Mbps upload, ${avgPing} ms ping. Based on ${totalTests} real tests. ${safeCity} میں اوسط ڈاؤن لوڈ سپیڈ ${avgDl} Mbps ہے۔`
    : `Check internet speed in ${safeCity}, Pakistan. Free speed test with real data. ${safeCity} میں انٹرنیٹ سپیڈ چیک کریں۔`;

  const pageUrl = `${SITE}/city/${encodeURIComponent(city)}`;

  let ispHtml = '';
  if (data?.isps?.length) {
    ispHtml = '<h3>Top ISPs in ' + safeCity + ' | ' + safeCity + ' کے بہترین ISPs</h3><ul>';
    data.isps.slice(0, 5).forEach(isp => {
      const ispLink = `${SITE}/isp/${encodeURIComponent(isp.isp_name)}`;
      ispHtml += `<li><a href="${ispLink}">${esc(isp.isp_name)}</a>: ${isp.avg_download} Mbps download${isp.avg_upload ? ', ' + isp.avg_upload + ' Mbps upload' : ''}</li>`;
    });
    ispHtml += '</ul>';
  }

  return new HTMLRewriter()
    .on('title#page-title', {
      element(el) { el.setInnerContent(title); }
    })
    .on('meta#page-desc', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('link[hreflang="ur"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=ur`); }
    })
    .on('link[hreflang="en"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=en`); }
    })
    .on('link[hreflang="x-default"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', pageUrl); }
    })
    .on('meta[name="twitter:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[name="twitter:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('head', {
      element(el) {
        el.append(`
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "PakSpeed", "item": "${SITE}/"},
              {"@type": "ListItem", "position": 2, "name": "City Rankings", "item": "${SITE}/leaderboard.html"},
              {"@type": "ListItem", "position": 3, "name": "${safeCity}"}
            ]
          }
          </script>
        `, { html: true });
      }
    })
    .on('main', {
      element(el) {
        const noscript = avgDl ? `
          <noscript>
            <article>
              <h2>Internet Speed in ${safeCity}, Pakistan | ${safeCity} میں انٹرنیٹ سپیڈ</h2>
              <p>Average download speed in ${safeCity} is <strong>${avgDl} Mbps</strong>. Average upload speed is <strong>${avgUl} Mbps</strong> with an average ping of <strong>${avgPing} ms</strong>. Peak download speed recorded is <strong>${maxDl} Mbps</strong>.</p>
              <p>${safeCity} میں اوسط ڈاؤن لوڈ سپیڈ <strong>${avgDl} Mbps</strong> ہے۔ اوسط اپ لوڈ سپیڈ <strong>${avgUl} Mbps</strong> اور اوسط پنگ <strong>${avgPing} ms</strong> ہے۔</p>
              <p>Based on ${totalTests} real speed tests from users in ${safeCity}.</p>
              ${ispHtml}
              <p><a href="${SITE}/">Run your own speed test on PakSpeed</a> | <a href="${SITE}/guide.html">Speed Guide</a> | <a href="${SITE}/leaderboard.html">City Rankings</a></p>
            </article>
          </noscript>
        ` : '';
        el.prepend(noscript, { html: true });
      }
    })
    .transform(response);
}

// ═══════════════════════════════════════════════════
// CITY×ISP PAGE — /city/Lahore/PTCL
// Targets: "PTCL speed in Lahore", "Jazz Lahore speed"
// ═══════════════════════════════════════════════════
async function handleCityIspPage(context, city, isp) {
  const templateUrl = new URL(context.request.url);
  templateUrl.pathname = '/city.html';
  templateUrl.search = '';
  const response = await context.env.ASSETS.fetch(new Request(templateUrl.toString(), { headers: context.request.headers }));

  const safeCity = esc(city);
  const safeIsp = esc(isp);

  let data = null;
  try {
    const apiResp = await fetch(`${WORKER_API}/city-stats?city=${encodeURIComponent(city)}`, {
      cf: { cacheTtl: 3600 }
    });
    data = await apiResp.json();
  } catch (e) {}

  // Find the specific ISP within this city's data
  const ispData = data?.isps?.find(i => i.isp_name.toLowerCase() === isp.toLowerCase());
  if (!ispData || !data?.city?.avg_download) {
    const url404 = new URL(context.request.url);
    url404.pathname = '/404.html';
    url404.search = '';
    const res404 = await context.env.ASSETS.fetch(new Request(url404.toString(), { headers: context.request.headers }));
    return new Response(res404.body, { status: 404, headers: res404.headers });
  }

  const dlIsp = ispData.avg_download || '';
  const ulIsp = ispData.avg_upload || '';
  const pingIsp = ispData.avg_ping || '';
  const testsIsp = ispData.tests || '';
  const dlCity = data.city.avg_download || '';

  const title = `${safeIsp} Speed in ${safeCity} ${dlIsp} Mbps — PakSpeed | ${safeCity} میں ${safeIsp} سپیڈ`;
  const desc = `${safeIsp} average speed in ${safeCity}: ${dlIsp} Mbps download${ulIsp ? ', ' + ulIsp + ' Mbps upload' : ''}, ${pingIsp} ms ping. City average is ${dlCity} Mbps. Based on ${testsIsp} real tests. ${safeCity} میں ${safeIsp} کی اوسط سپیڈ ${dlIsp} Mbps ہے۔`;
  const pageUrl = `${SITE}/city/${encodeURIComponent(city)}/${encodeURIComponent(isp)}`;

  // Build cross-links to other ISPs in this city
  let otherIspsHtml = '';
  if (data?.isps?.length > 1) {
    otherIspsHtml = '<h3>Other ISPs in ' + safeCity + '</h3><ul>';
    data.isps.filter(i => i.isp_name.toLowerCase() !== isp.toLowerCase()).slice(0, 5).forEach(i => {
      otherIspsHtml += `<li><a href="${SITE}/city/${encodeURIComponent(city)}/${encodeURIComponent(i.isp_name)}">${esc(i.isp_name)}: ${i.avg_download} Mbps</a></li>`;
    });
    otherIspsHtml += '</ul>';
  }

  // FAQ schema for AEO (AI answer engines + People Also Ask)
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `What is ${safeIsp} speed in ${safeCity}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${safeIsp} average download speed in ${safeCity} is ${dlIsp} Mbps${ulIsp ? ' with ' + ulIsp + ' Mbps upload' : ''} and ${pingIsp} ms ping, based on ${testsIsp} real speed tests on PakSpeed.`
        }
      },
      {
        "@type": "Question",
        "name": `Is ${safeIsp} good in ${safeCity}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": Number(dlIsp) >= Number(dlCity)
            ? `Yes, ${safeIsp} at ${dlIsp} Mbps is above the ${safeCity} city average of ${dlCity} Mbps.`
            : `${safeIsp} at ${dlIsp} Mbps is below the ${safeCity} city average of ${dlCity} Mbps. Consider comparing other ISPs.`
        }
      }
    ]
  };

  return new HTMLRewriter()
    .on('title#page-title', {
      element(el) { el.setInnerContent(title); }
    })
    .on('meta#page-desc', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('link[hreflang="ur"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=ur`); }
    })
    .on('link[hreflang="en"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=en`); }
    })
    .on('link[hreflang="x-default"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', pageUrl); }
    })
    .on('meta[name="twitter:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[name="twitter:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('head', {
      element(el) {
        el.append(`
          <script type="application/ld+json">
          ${JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "PakSpeed", "item": "${SITE}/"},
                {"@type": "ListItem", "position": 2, "name": "${safeCity}", "item": "${SITE}/city/${encodeURIComponent(city)}"},
                {"@type": "ListItem", "position": 3, "name": "${safeIsp}"}
              ]
            },
            faqSchema
          ])}
          </script>
        `, { html: true });
      }
    })
    .on('main', {
      element(el) {
        el.prepend(`
          <noscript>
            <article>
              <h2>${safeIsp} Internet Speed in ${safeCity} | ${safeCity} میں ${safeIsp} سپیڈ</h2>
              <p>${safeIsp} average download speed in ${safeCity} is <strong>${dlIsp} Mbps</strong>${ulIsp ? ', upload <strong>' + ulIsp + ' Mbps</strong>' : ''}, ping <strong>${pingIsp} ms</strong>. Based on ${testsIsp} real speed tests.</p>
              <p>The city average in ${safeCity} is <strong>${dlCity} Mbps</strong>. ${Number(dlIsp) >= Number(dlCity) ? safeIsp + ' is above average.' : safeIsp + ' is below the city average.'}</p>
              <p>${safeCity} میں ${safeIsp} کی اوسط ڈاؤن لوڈ سپیڈ <strong>${dlIsp} Mbps</strong> ہے۔</p>
              ${otherIspsHtml}
              <p><a href="${SITE}/city/${encodeURIComponent(city)}">${safeCity} all ISPs</a> | <a href="${SITE}/isp/${encodeURIComponent(isp)}">${safeIsp} all cities</a> | <a href="${SITE}/">Run speed test</a></p>
            </article>
          </noscript>
        `, { html: true });
      }
    })
    .transform(response);
}

// ═══════════════════════════════════════════════════
// ISP PAGE — /isp/PTCL
// ═══════════════════════════════════════════════════
async function handleIspPage(context, isp) {
  const templateUrl = new URL(context.request.url);
  templateUrl.pathname = '/isp-detail.html';
  templateUrl.search = '';
  const response = await context.env.ASSETS.fetch(new Request(templateUrl.toString(), { headers: context.request.headers }));

  const safeIsp = esc(isp);

  let data = null, reviews = null;
  try {
    const [statsResp, reviewResp] = await Promise.all([
      fetch(`${WORKER_API}/isp-stats?isp=${encodeURIComponent(isp)}`, { cf: { cacheTtl: 3600 } }),
      fetch(`${WORKER_API}/reviews?isp=${encodeURIComponent(isp)}`, { cf: { cacheTtl: 3600 } }).catch(() => null)
    ]);
    data = await statsResp.json();
    if (reviewResp?.ok) reviews = await reviewResp.json().catch(() => null);
  } catch (e) {}

  const avgDl = data?.isp?.avg_download || '';

  if (!avgDl) {
    const url404 = new URL(context.request.url);
    url404.pathname = '/404.html';
    url404.search = '';
    const res404 = await context.env.ASSETS.fetch(new Request(url404.toString(), { headers: context.request.headers }));
    return new Response(res404.body, { status: 404, headers: res404.headers });
  }

  const avgUl = data?.isp?.avg_upload || '';
  const avgPing = data?.isp?.avg_ping || '';
  const totalTests = data?.isp?.total_tests || '';

  // Review aggregation for AggregateRating schema
  const avgRating = reviews?.avg_rating || null;
  const reviewCount = reviews?.total_reviews || 0;

  const title = avgDl
    ? `${safeIsp} Speed Test ${avgDl} Mbps — PakSpeed | ${safeIsp} سپیڈ ٹیسٹ`
    : `${safeIsp} Speed Test Pakistan — PakSpeed | ${safeIsp} سپیڈ ٹیسٹ`;

  const desc = avgDl
    ? `${safeIsp} average speed: ${avgDl} Mbps download, ${avgUl} Mbps upload, ${avgPing} ms ping. Real data from ${totalTests} tests. ${safeIsp} کی اوسط سپیڈ ${avgDl} Mbps ہے۔`
    : `Test your ${safeIsp} internet speed in Pakistan. Free speed test with real data.`;

  const pageUrl = `${SITE}/isp/${encodeURIComponent(isp)}`;

  let citiesHtml = '';
  if (data?.cities?.length) {
    citiesHtml = '<h3>' + safeIsp + ' Speed by City</h3><ul>';
    data.cities.slice(0, 10).forEach(c => {
      const cityIspLink = `${SITE}/city/${encodeURIComponent(c.city)}/${encodeURIComponent(isp)}`;
      citiesHtml += `<li><a href="${cityIspLink}">${esc(c.city)}</a>: ${c.avg_download} Mbps download</li>`;
    });
    citiesHtml += '</ul>';
  }

  return new HTMLRewriter()
    .on('title#page-title', {
      element(el) { el.setInnerContent(title); }
    })
    .on('meta#page-desc', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('link[hreflang="ur"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=ur`); }
    })
    .on('link[hreflang="en"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=en`); }
    })
    .on('link[hreflang="x-default"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', pageUrl); }
    })
    .on('meta[name="twitter:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[name="twitter:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('head', {
      element(el) {
        const schemas = [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "PakSpeed", "item": `${SITE}/`},
              {"@type": "ListItem", "position": 2, "name": "ISP Comparison", "item": `${SITE}/isp.html`},
              {"@type": "ListItem", "position": 3, "name": safeIsp}
            ]
          }
        ];

        // AggregateRating — shows star snippets in Google SERPs
        if (avgRating && reviewCount >= 3) {
          schemas.push({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": safeIsp,
            "description": `${safeIsp} internet service provider in Pakistan. Average speed: ${avgDl} Mbps.`,
            "url": pageUrl,
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": avgRating,
              "bestRating": 5,
              "worstRating": 1,
              "ratingCount": reviewCount
            }
          });
        }

        // FAQ schema for ISP pages
        schemas.push({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": `What is ${safeIsp} average speed in Pakistan?`,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `${safeIsp} average download speed is ${avgDl} Mbps, upload ${avgUl} Mbps, ping ${avgPing} ms. Based on ${totalTests} real speed tests on PakSpeed.`
              }
            },
            {
              "@type": "Question",
              "name": `Is ${safeIsp} a good internet provider in Pakistan?`,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `${safeIsp} provides ${avgDl} Mbps average download speed across Pakistan${avgRating ? ' and has a ' + avgRating + '/5 user rating' : ''}. Run a free speed test on PakSpeed to check your actual ${safeIsp} speed.`
              }
            }
          ]
        });

        el.append(`<script type="application/ld+json">${JSON.stringify(schemas)}</script>`, { html: true });
      }
    })
    .on('main', {
      element(el) {
        const noscript = avgDl ? `
          <noscript>
            <article>
              <h2>${safeIsp} Internet Speed in Pakistan | ${safeIsp} سپیڈ ٹیسٹ پاکستان</h2>
              <p>${safeIsp} average download speed is <strong>${avgDl} Mbps</strong>, upload speed <strong>${avgUl} Mbps</strong>, ping <strong>${avgPing} ms</strong>. Based on ${totalTests} real speed tests.</p>
              ${avgRating ? `<p>User rating: <strong>${avgRating}/5</strong> (${reviewCount} reviews)</p>` : ''}
              <p>${safeIsp} کی اوسط ڈاؤن لوڈ سپیڈ <strong>${avgDl} Mbps</strong> ہے۔</p>
              ${citiesHtml}
              <p><a href="${SITE}/">Run your own ${safeIsp} speed test</a> | <a href="${SITE}/guide.html">Speed Guide</a> | <a href="${SITE}/isp.html">ISP Comparison</a></p>
            </article>
          </noscript>
        ` : '';
        el.prepend(noscript, { html: true });
      }
    })
    .transform(response);
}

// ═══════════════════════════════════════════════════
// COMPARISON PAGE — /compare/Lahore-vs-Karachi
// ═══════════════════════════════════════════════════
async function handleComparePage(context, a, b) {
  const templateUrl = new URL(context.request.url);
  templateUrl.pathname = '/compare.html';
  templateUrl.search = '';
  const response = await context.env.ASSETS.fetch(new Request(templateUrl.toString(), { headers: context.request.headers }));

  const safeA = esc(a);
  const safeB = esc(b);

  let dataA = null, dataB = null, type = 'city';
  try {
    const [respA, respB] = await Promise.all([
      fetch(`${WORKER_API}/city-stats?city=${encodeURIComponent(a)}`, { cf: { cacheTtl: 3600 } }),
      fetch(`${WORKER_API}/city-stats?city=${encodeURIComponent(b)}`, { cf: { cacheTtl: 3600 } })
    ]);
    dataA = await respA.json();
    dataB = await respB.json();

    if (!dataA?.city?.total_tests || !dataB?.city?.total_tests) {
      const [ispA, ispB] = await Promise.all([
        fetch(`${WORKER_API}/isp-stats?isp=${encodeURIComponent(a)}`, { cf: { cacheTtl: 3600 } }),
        fetch(`${WORKER_API}/isp-stats?isp=${encodeURIComponent(b)}`, { cf: { cacheTtl: 3600 } })
      ]);
      dataA = await ispA.json();
      dataB = await ispB.json();
      type = 'isp';
    }
  } catch (e) {}

  const statsA = type === 'city' ? dataA?.city : dataA?.isp;
  const statsB = type === 'city' ? dataB?.city : dataB?.isp;

  if (!statsA || !statsB || !statsA.avg_download || !statsB.avg_download) {
    const url404 = new URL(context.request.url);
    url404.pathname = '/404.html';
    url404.search = '';
    const res404 = await context.env.ASSETS.fetch(new Request(url404.toString(), { headers: context.request.headers }));
    return new Response(res404.body, { status: 404, headers: res404.headers });
  }

  const dlA = statsA?.avg_download || '—';
  const dlB = statsB?.avg_download || '—';
  const ulA = statsA?.avg_upload || '—';
  const ulB = statsB?.avg_upload || '—';
  const pingA = statsA?.avg_ping || '—';
  const pingB = statsB?.avg_ping || '—';

  const winner = Number(dlA) > Number(dlB) ? safeA : Number(dlB) > Number(dlA) ? safeB : 'tie';

  const typeLabel = type === 'city' ? 'City' : 'ISP';
  const title = type === 'isp'
    ? `${safeA} vs ${safeB}: Which ISP is Better? — PakSpeed | ${safeA} بمقابلہ ${safeB}`
    : `${safeA} vs ${safeB} Internet Speed — PakSpeed | ${safeA} بمقابلہ ${safeB}`;
  const desc = type === 'isp'
    ? `${safeA} (${dlA} Mbps) vs ${safeB} (${dlB} Mbps): compare download speed, upload, ping. Which Pakistan ISP is faster? Real data from speed tests.`
    : `Compare internet speed: ${safeA} (${dlA} Mbps) vs ${safeB} (${dlB} Mbps). Real speed test data from Pakistan.`;
  const pageUrl = `${SITE}/compare/${encodeURIComponent(a)}-vs-${encodeURIComponent(b)}`;
  const linkA = type === 'city' ? `${SITE}/city/${encodeURIComponent(a)}` : `${SITE}/isp/${encodeURIComponent(a)}`;
  const linkB = type === 'city' ? `${SITE}/city/${encodeURIComponent(b)}` : `${SITE}/isp/${encodeURIComponent(b)}`;

  // FAQ schema for comparison pages — targets People Also Ask
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": type === 'isp'
          ? `Which is better, ${safeA} or ${safeB}?`
          : `Which city has faster internet, ${safeA} or ${safeB}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": winner !== 'tie'
            ? `${winner} is faster with ${winner === safeA ? dlA : dlB} Mbps average download vs ${winner === safeA ? dlB : dlA} Mbps. ${winner} also has ${winner === safeA ? pingA : pingB} ms ping.`
            : `Both ${safeA} and ${safeB} have similar speeds at approximately ${dlA} Mbps download.`
        }
      },
      {
        "@type": "Question",
        "name": `What is ${safeA} speed vs ${safeB} speed in Pakistan?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${safeA}: ${dlA} Mbps download, ${ulA} Mbps upload, ${pingA} ms ping. ${safeB}: ${dlB} Mbps download, ${ulB} Mbps upload, ${pingB} ms ping. Based on real PakSpeed tests.`
        }
      }
    ]
  };

  return new HTMLRewriter()
    .on('title', {
      element(el) { el.setInnerContent(title); }
    })
    .on('meta[name="description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('link[hreflang="ur"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=ur`); }
    })
    .on('link[hreflang="en"]', {
      element(el) { el.setAttribute('href', `${pageUrl}?lang=en`); }
    })
    .on('link[hreflang="x-default"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', pageUrl); }
    })
    .on('meta[name="twitter:title"]', {
      element(el) { el.setAttribute('content', title); }
    })
    .on('meta[name="twitter:description"]', {
      element(el) { el.setAttribute('content', desc); }
    })
    .on('head', {
      element(el) {
        el.append(`
          <script type="application/ld+json">
          ${JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "PakSpeed", "item": "${SITE}/"},
                {"@type": "ListItem", "position": 2, "name": "${typeLabel} Comparison", "item": "${SITE}/compare.html"},
                {"@type": "ListItem", "position": 3, "name": "${safeA} vs ${safeB}"}
              ]
            },
            faqSchema
          ])}
          </script>
        `, { html: true });
      }
    })
    .on('main', {
      element(el) {
        el.prepend(`
          <noscript>
            <article>
              <h2>${safeA} vs ${safeB} Internet Speed Comparison | ${safeA} بمقابلہ ${safeB} انٹرنیٹ سپیڈ</h2>
              <table>
                <tr><th></th><th>${safeA}</th><th>${safeB}</th></tr>
                <tr><td>Download</td><td>${dlA} Mbps</td><td>${dlB} Mbps</td></tr>
                <tr><td>Upload</td><td>${ulA} Mbps</td><td>${ulB} Mbps</td></tr>
                <tr><td>Ping</td><td>${pingA} ms</td><td>${pingB} ms</td></tr>
              </table>
              ${winner !== 'tie' ? `<p><strong>${winner}</strong> has faster internet speed.</p>` : '<p>Both have similar speeds.</p>'}
              <h3>Frequently Asked Questions</h3>
              <p><strong>${type === 'isp' ? 'Which is better, ' + safeA + ' or ' + safeB + '?' : 'Which city has faster internet?'}</strong></p>
              <p>${winner !== 'tie' ? winner + ' is faster with ' + (winner === safeA ? dlA : dlB) + ' Mbps.' : 'Both have similar speeds.'}</p>
              <p><a href="${linkA}">${safeA} details</a> | <a href="${linkB}">${safeB} details</a> | <a href="${SITE}/">Run speed test</a></p>
            </article>
          </noscript>
        `, { html: true });
      }
    })
    .transform(response);
}

// ═══════════════════════════════════════════════════
// DYNAMIC SITEMAP — Auto-discovers all cities & ISPs
// ═══════════════════════════════════════════════════
async function fetchArray(url, keys = []) {
  const response = await fetch(url, { cf: { cacheTtl: 3600 } });
  if (!response.ok) return [];
  const data = await response.json();
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function buildStaticSitemap() {
  const today = getToday();
  const pages = [
    ['/', today, 'daily', '1.0'],
    ['/leaderboard.html', today, 'daily', '0.9'],
    ['/isp.html', today, 'daily', '0.9'],
    ['/guide.html', today, 'monthly', '0.9'],
    ['/5g.html', today, 'weekly', '0.9'],
    ['/5g-auction.html', '2026-03-10', 'monthly', '0.8'],
    ['/5g-asia.html', '2026-03-10', 'monthly', '0.8'],
    ['/map.html', today, 'hourly', '0.8'],
    ['/best-isp.html', today, 'daily', '0.9'],
    ['/internet-speed-by-province.html', '2026-04-23', 'monthly', '0.8'],
    ['/pta-complaint-guide.html', '2026-04-21', 'monthly', '0.8'],
    ['/speed-needed-streaming.html', '2026-04-16', 'monthly', '0.8'],
    ['/ptcl-vs-stormfiber-vs-nayatel.html', '2026-04-14', 'monthly', '0.8'],
    ['/best-wifi-router-2026.html', '2026-04-09', 'monthly', '0.8'],
    ['/improve-internet-speed.html', '2026-04-07', 'monthly', '0.8'],
    ['/internet-slow-at-night.html', '2026-04-02', 'monthly', '0.8'],
    ['/best-isp-ranking-2026.html', '2026-03-31', 'monthly', '0.8'],
    ['/why-internet-slow-pakistan.html', '2026-03-26', 'monthly', '0.8'],
    ['/3g-4g-5g-difference.html', '2026-03-24', 'monthly', '0.8'],
    ['/phone-5g-support.html', '2026-03-19', 'monthly', '0.8'],
    ['/5g-launch-guide.html', '2026-03-17', 'monthly', '0.8'],
    ['/blog.html', today, 'weekly', '0.7'],
    ['/compare.html', today, 'daily', '0.7'],
    ['/complaint.html', today, 'monthly', '0.6'],
    ['/report.html', today, 'daily', '0.7'],
    ['/about.html', today, 'monthly', '0.6'],
    ['/privacy.html', today, 'yearly', '0.4'],
    ['/terms.html', today, 'yearly', '0.4']
  ];

  const urls = pages
    .map(([path, lastmod, changefreq, priority]) =>
      `  <url><loc>${SITE}${path}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

async function handleDynamicSitemap() {
  try {
    const [cities, isps] = await Promise.all([
      fetchArray(`${WORKER_API}/leaderboard`, ['cities', 'leaderboard', 'data', 'results']),
      fetchArray(`${WORKER_API}/isp-rankings`, ['isps', 'rankings', 'data', 'results'])
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}/leaderboard.html</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE}/isp.html</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE}/guide.html</loc><lastmod>${getToday()}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE}/5g.html</loc><lastmod>${getToday()}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE}/5g-auction.html</loc><lastmod>2026-03-10</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/5g-asia.html</loc><lastmod>2026-03-10</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/map.html</loc><lastmod>${getToday()}</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/best-isp.html</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE}/internet-speed-by-province.html</loc><lastmod>2026-04-23</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/pta-complaint-guide.html</loc><lastmod>2026-04-21</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/speed-needed-streaming.html</loc><lastmod>2026-04-16</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/ptcl-vs-stormfiber-vs-nayatel.html</loc><lastmod>2026-04-14</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/best-wifi-router-2026.html</loc><lastmod>2026-04-09</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/improve-internet-speed.html</loc><lastmod>2026-04-07</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/internet-slow-at-night.html</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/best-isp-ranking-2026.html</loc><lastmod>2026-03-31</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/why-internet-slow-pakistan.html</loc><lastmod>2026-03-26</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/3g-4g-5g-difference.html</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/phone-5g-support.html</loc><lastmod>2026-03-19</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/5g-launch-guide.html</loc><lastmod>2026-03-17</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/blog.html</loc><lastmod>${getToday()}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>${SITE}/compare.html</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
  <url><loc>${SITE}/complaint.html</loc><lastmod>${getToday()}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${SITE}/report.html</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;

    if (isps.length) {
      isps.forEach(isp => {
        const name = isp.isp_name || isp.name || isp.isp;
        if (name) {
          xml += `\n  <url><loc>${SITE}/isp/${encodeURIComponent(name)}</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
        }
      });
    }

    if (cities.length) {
      cities.forEach(city => {
        const name = city.city || city.name;
        if (name) {
          xml += `\n  <url><loc>${SITE}/city/${encodeURIComponent(name)}</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
        }
      });

      // City×ISP cross-pages — major ISPs in each city
      if (isps.length) {
        const topIsps = isps.slice(0, 8);
        cities.slice(0, 20).forEach(city => {
          const cityName = city.city || city.name;
          if (!cityName) return;
          topIsps.forEach(isp => {
            const ispName = isp.isp_name || isp.name || isp.isp;
            if (ispName) {
              xml += `\n  <url><loc>${SITE}/city/${encodeURIComponent(cityName)}/${encodeURIComponent(ispName)}</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;
            }
          });
        });
      }
    }

    // ISP comparison pages
    if (isps.length >= 2) {
      const top = isps.slice(0, 6);
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          const a = top[i].isp_name || top[i].name || top[i].isp;
          const b = top[j].isp_name || top[j].name || top[j].isp;
          if (a && b) {
            xml += `\n  <url><loc>${SITE}/compare/${encodeURIComponent(a)}-vs-${encodeURIComponent(b)}</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`;
          }
        }
      }
    }

    // City comparison pages
    if (cities.length >= 2) {
      const top = cities.slice(0, 5);
      for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          const a = top[i].city || top[i].name;
          const b = top[j].city || top[j].name;
          if (a && b) {
            xml += `\n  <url><loc>${SITE}/compare/${encodeURIComponent(a)}-vs-${encodeURIComponent(b)}</loc><lastmod>${getToday()}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`;
          }
        }
      }
    }

    xml += `\n  <url><loc>${SITE}/about.html</loc><lastmod>${getToday()}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${SITE}/privacy.html</loc><lastmod>${getToday()}</lastmod><changefreq>yearly</changefreq><priority>0.4</priority></url>
  <url><loc>${SITE}/terms.html</loc><lastmod>${getToday()}</lastmod><changefreq>yearly</changefreq><priority>0.4</priority></url>
</urlset>`;

    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
    });
  } catch (e) {
    return new Response(buildStaticSitemap(), {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    });
  }
}

// ═══════════════════════════════════════════════════
// INDEXNOW — Submit URLs to Bing/Yandex instantly
// ═══════════════════════════════════════════════════
const INDEXNOW_KEY = '57fa42f08438f8f51ef13bfc366f24d2';

async function handleIndexNowPing() {
  let cities = [], isps = [];
  try {
    const [cityResp, ispResp] = await Promise.all([
      fetch(`${WORKER_API}/leaderboard`, { cf: { cacheTtl: 300 } }),
      fetch(`${WORKER_API}/isp-rankings`, { cf: { cacheTtl: 300 } })
    ]);
    cities = await cityResp.json();
    isps = await ispResp.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), { status: 500 });
  }

  const urls = [
    `${SITE}/`,
    `${SITE}/leaderboard.html`,
    `${SITE}/isp.html`,
    `${SITE}/guide.html`,
    `${SITE}/5g.html`,
    `${SITE}/5g-auction.html`,
    `${SITE}/5g-asia.html`,
    `${SITE}/about.html`
  ];

  cities.forEach(c => urls.push(`${SITE}/city/${encodeURIComponent(c.city)}`));
  isps.forEach(i => urls.push(`${SITE}/isp/${encodeURIComponent(i.isp_name)}`));

  // City×ISP cross-pages
  const topIspsForIndex = isps.slice(0, 8);
  cities.slice(0, 10).forEach(c => {
    topIspsForIndex.forEach(i => {
      urls.push(`${SITE}/city/${encodeURIComponent(c.city)}/${encodeURIComponent(i.isp_name)}`);
    });
  });

  const body = JSON.stringify({
    host: 'pakspeed.com',
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: urls
  });

  const results = await Promise.allSettled([
    fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    }),
    fetch('https://www.bing.com/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })
  ]);

  return new Response(JSON.stringify({
    submitted: urls.length,
    indexnow: results[0].status,
    bing: results[1].status
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
