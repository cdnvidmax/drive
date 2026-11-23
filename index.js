export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==========================================
    // 🔑 PASSWORD RAHASIA KHUSUS HAPUS VIDEO
    // ==========================================
    const ADMIN_SECRET_KEY = "rahasia123"; 

    // ==========================================
    // 🛡️ PENGATURAN DAFTAR DOMAIN JEMBATAN (BISA BANYAK)
    // ==========================================
    // Masukkan semua domain/subdomain jembatan tempat tombol diklik (huruf kecil, tanpa https://)
    const ALLOWED_BRIDGE_DOMAINS = [
      "cdn.vdey.app",
      "a.4lif.shop",
      "b.ivid.my",
      "c.tcov.website",
      "d.onlystream.space",
      "e.onlystream.xyz"
    ];

    // ==========================================
    // 🔗 DIRECT LINKS UNTUK IKLAN (TOMBOL)
    // ==========================================
    const ADSTERRA_DIRECT_LINK_1 = "https://t.co/biSIUVAk5E"; 
    const ADSTERRA_DIRECT_LINK_2 = "https://t.co/uzX4Wxy1sc"; 

    // ==========================================
    // 🛡️ REDIRECT AMAN UNTUK HALAMAN UTAMA (ROOT)
    // ==========================================
    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect('https://www.google.com', 302);
    }

    // 1. API Endpoint to Get List of All Videos
    if (url.pathname === '/api/videos' && request.method === 'GET') {
      try {
        const list = await env.VIDEOS_KV.list({ prefix: 'video:' });
        const videos = [];

        for (const key of list.keys) {
          const videoId = key.name.replace('video:', '');
          const metadata = key.metadata || {};
          videos.push({
            id: videoId,
            title: metadata.title || `Video ${videoId}`,
            mimeType: metadata.mimeType || 'video/mp4',
            size: metadata.size || 0,
            uploadedAt: metadata.uploadedAt || new Date().toISOString(),
            isExternal: metadata.isExternal || false,
            watchUrl: `${url.origin}/v/${videoId}`,
            embedUrl: `${url.origin}/embed/${videoId}`,
            streamUrl: `${url.origin}/stream/${videoId}`
          });
        }

        videos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        return new Response(JSON.stringify({ success: true, videos }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: { 'Access-Control-Allow-Origin': '*' } 
        });
      }
    }

    // 2. API Endpoint to Upload (TANPA PASSWORD)
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const videoFile = formData.get('video');
        const externalUrl = formData.get('external_url');
        const customTitle = formData.get('title');

        const videoId = Math.random().toString(36).substring(2, 10);

        if (externalUrl && externalUrl.trim() !== '') {
          const videoTitle = (customTitle && customTitle.trim() !== '') ? customTitle.trim() : 'External Stream Video';
          
          await env.VIDEOS_KV.put(`video:${videoId}`, 'EXTERNAL_LINK', {
            metadata: {
              title: videoTitle,
              externalUrl: externalUrl.trim(),
              isExternal: true,
              uploadedAt: new Date().toISOString()
            }
          });

          return new Response(JSON.stringify({
            success: true,
            videoId: videoId,
            title: videoTitle,
            watchUrl: `${url.origin}/v/${videoId}`,
            embedUrl: `${url.origin}/embed/${videoId}`,
            streamUrl: `${url.origin}/stream/${videoId}`
          }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (!videoFile) {
          return new Response(JSON.stringify({ error: 'Harap pilih file video ATAU masukkan URL video.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const videoTitle = (customTitle && customTitle.trim() !== '') ? customTitle.trim() : videoFile.name;
        const arrayBuffer = await videoFile.arrayBuffer();

        await env.VIDEOS_KV.put(`video:${videoId}`, arrayBuffer, {
          metadata: {
            title: videoTitle,
            mimeType: videoFile.type || 'video/mp4',
            size: videoFile.size,
            isExternal: false,
            uploadedAt: new Date().toISOString()
          }
        });

        return new Response(JSON.stringify({
          success: true,
          videoId: videoId,
          title: videoTitle,
          watchUrl: `${url.origin}/v/${videoId}`,
          embedUrl: `${url.origin}/embed/${videoId}`,
          streamUrl: `${url.origin}/stream/${videoId}`
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: { 'Access-Control-Allow-Origin': '*' } 
        });
      }
    }

    // 3. API Endpoint to Delete Video
    if (url.pathname === '/api/delete' && request.method === 'DELETE') {
      try {
        const authKey = request.headers.get('x-secret-key');

        if (authKey !== ADMIN_SECRET_KEY) {
          return new Response(JSON.stringify({ error: 'Akses Ditolak: Password Admin Salah!' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const videoId = url.searchParams.get('id');
        if (!videoId) {
          return new Response(JSON.stringify({ error: 'Video ID diperlukan.' }), { 
            status: 400, 
            headers: { 'Access-Control-Allow-Origin': '*' } 
          });
        }

        await env.VIDEOS_KV.delete(`video:${videoId}`);
        return new Response(JSON.stringify({ success: true, message: 'Video berhasil dihapus.' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: { 'Access-Control-Allow-Origin': '*' } 
        });
      }
    }

    // 4. Raw Stream Video Endpoint
    if (url.pathname.startsWith('/stream/')) {
      const referer = request.headers.get('referer') || '';
      const secFetchMode = request.headers.get('sec-fetch-mode') || '';

      if (secFetchMode === 'navigate' && !referer.includes(url.origin)) {
        return new Response('Akses Langsung Ditolak! Silakan tonton melalui halaman resmi.', { 
          status: 403,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      const videoId = url.pathname.split('/stream/')[1];
      const videoData = await env.VIDEOS_KV.getWithMetadata(`video:${videoId}`, { type: 'arrayBuffer' });

      if (!videoData.metadata) {
        return new Response('Video not found or has been deleted.', { status: 404 });
      }

      if (videoData.metadata.isExternal && videoData.metadata.externalUrl) {
        return Response.redirect(videoData.metadata.externalUrl, 302);
      }

      return new Response(videoData.value, {
        headers: {
          'Content-Type': videoData.metadata?.mimeType || 'video/mp4',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    }

    // 5. Watch Page Endpoint (/v/videoId) WITH MULTI-BRIDGE REFERER LOCK & RANDOM SAFE PAGE
    if (url.pathname.startsWith('/v/')) {
      const videoId = url.pathname.split('/v/')[1];
      const videoData = await env.VIDEOS_KV.getWithMetadata(`video:${videoId}`);

      if (!videoData.metadata) {
        return new Response('Video not found.', { status: 404 });
      }

      // ==========================================================
      // 🕵️ LAPISAN 1: DETEKSI CRAWLER BOT FACEBOOK/META
      // ==========================================================
      const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
      const botKeywords = [
        'facebookexternalhit',
        'facebot',
        'meta-externalagent',
        'meta-externalhit'
      ];

      let isBot = botKeywords.some(keyword => userAgent.includes(keyword));

      // ==========================================================
      // 🔒 LAPISAN 2: KUNCI REFERER (WAJIB LEWAT SALAH SATU JEMBATAN / ADMIN)
      // ==========================================================
      const referer = (request.headers.get('referer') || '').toLowerCase();
      const isFromBridge = ALLOWED_BRIDGE_DOMAINS.some(domain => referer.includes(domain.toLowerCase()));
      const isFromAdmin = referer.includes(url.hostname.toLowerCase());

      if (!isFromBridge && !isFromAdmin) {
        isBot = true;
      }

      // ----------------------------------------------------------
      // A. TAMPILAN ARTIKEL RANDOM AMAN (UNTUK BOT & AKSES LANGSUNG)
      // ----------------------------------------------------------
      if (isBot) {
        const safeArticles = [
          {
            category: "Daily Wellness & Health",
            siteName: "Wellness Today",
            title: "5 Simple Morning Habits for Better Energy and Focus",
            description: "Discover how small changes in your first hour after waking up can boost productivity and lower stress all day.",
            image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800",
            paragraphs: [
              "How you spend the first hour of your morning sets the tone for the rest of your day. Instead of immediately checking notifications, taking ten minutes to hydrate and stretch can significantly improve mental clarity.",
              "Health researchers note that natural morning sunlight helps regulate your circadian rhythm, leading to better energy levels during the afternoon and deeper sleep at night.",
              "Finally, writing down your top three priorities before opening your inbox reduces decision fatigue and keeps your workflow focused."
            ]
          },
          {
            category: "Home & Garden Tips",
            siteName: "Modern Living Digest",
            title: "7 Low-Maintenance Indoor Plants That Purify Your Home Air",
            description: "Looking to refresh your living space? These hardy houseplants thrive in low light and require minimal watering.",
            image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800",
            paragraphs: [
              "Bringing greenery indoors does more than enhance room aesthetics—it creates a calmer environment and improves indoor air quality throughout the year.",
              "Plants like the Snake Plant, ZZ Plant, and Pothos are ideal for busy homeowners because they tolerate indirect sunlight and only need watering every couple of weeks.",
              "Placing a few of these resilient plants near your workspace can also help reduce eye strain and promote a more relaxing atmosphere."
            ]
          },
          {
            category: "Personal Finance & Budgeting",
            siteName: "Smart Money Guide",
            title: "How the 50/30/20 Rule Simplifies Monthly Household Budgeting",
            description: "A practical breakdown of how to balance essential bills, personal spending, and long-term savings without complex spreadsheets.",
            image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
            paragraphs: [
              "Managing monthly expenses does not require tracking every single penny. The 50/30/20 framework divides after-tax income into three clear buckets: needs, wants, and savings.",
              "Allocating half of your budget to housing, utilities, and groceries ensures core obligations are always covered before discretionary purchases.",
              "Automating transfers into a dedicated emergency fund at the start of each month makes consistent saving effortless over time."
            ]
          },
          {
            category: "Travel & Exploration",
            siteName: "Scenic Routes Journal",
            title: "Top Coastal Road Trips to Plan for Your Next Weekend Getaway",
            description: "Explore scenic oceanfront highways, charming small towns, and hidden overlooks worth adding to your travel list.",
            image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800",
            paragraphs: [
              "A weekend road trip along the coast offers the perfect reset without needing weeks of vacation time or complicated flight itineraries.",
              "Starting early in the morning lets you enjoy quiet coastal viewpoints, local bakeries, and historic lighthouses before midday crowds arrive.",
              "Packing a simple cooler and leaving room in your schedule for spontaneous detours turns an ordinary drive into a memorable adventure."
            ]
          },
          {
            category: "Culinary & Nutrition",
            siteName: "Everyday Kitchen",
            title: "Quick 15-Minute Mediterranean Dinner Ideas for Busy Weeknights",
            description: "Healthy, flavorful recipes using pantry staples like olive oil, garlic, fresh herbs, and seasonal vegetables.",
            image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
            paragraphs: [
              "Cooking a nutritious dinner after a long workday is much easier when you rely on simple Mediterranean ingredients that pack bold natural flavor.",
              "Combining roasted vegetables, chickpeas, lemon juice, and extra-virgin olive oil creates a balanced meal in under fifteen minutes with minimal cleanup.",
              "Preparing a batch of grains like quinoa or farro at the beginning of the week makes assembling fresh bowls fast and convenient."
            ]
          }
        ];

        // Pilih 1 artikel secara acak setiap kali halaman diakses
        const randomArticle = safeArticles[Math.floor(Math.random() * safeArticles.length)];
        const paragraphsHtml = randomArticle.paragraphs.map(p => `<p>${p}</p>`).join('\n  ');

        const fakeArticleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <meta property="og:title" content="${randomArticle.title}" />
  <meta property="og:description" content="${randomArticle.description}" />
  <meta property="og:image" content="${randomArticle.image}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${randomArticle.siteName}" />

  <title>${randomArticle.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; padding: 24px; max-width: 720px; margin: 0 auto; color: #2d3748; background: #fff; }
    h1 { color: #1a202c; border-bottom: 2px solid #edf2f7; padding-bottom: 12px; font-size: 26px; margin-top: 8px; }
    .meta { color: #718096; font-size: 0.9em; margin-bottom: 20px; }
    .hero-img { width: 100%; max-height: 360px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; }
    p { margin-bottom: 16px; text-align: justify; }
    small { text-transform: uppercase; letter-spacing: 1px; color: #2b6cb0; font-weight: bold; }
  </style>
</head>
<body>
  <small>${randomArticle.category}</small>
  <h1>${randomArticle.title}</h1>
  <div class="meta">Published by ${randomArticle.siteName} Editorial Team</div>
  <img src="${randomArticle.image}" alt="${randomArticle.title}" class="hero-img">
  ${paragraphsHtml}
</body>
</html>`;

        return new Response(fakeArticleHtml, {
          headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        });
      }

      // ----------------------------------------------------------
      // B. TAMPILAN PEMUTAR VIDEO + IKLAN (PENGUNJUNG VALID DARI JEMBATAN)
      // ----------------------------------------------------------
      const streamUrl = videoData.metadata.isExternal ? videoData.metadata.externalUrl : `${url.origin}/stream/${videoId}`;
      const title = videoData.metadata.title || `Video ${videoId}`;

      const watchHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - StreamMax</title>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    body { background-color: #0d1117; color: #c9d1d9; font-family: system-ui, -apple-system, sans-serif; user-select: none; }
    .navbar { background-color: #161b22; border-bottom: 1px solid #30363d; }
    .video-container { background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative; }
    video { width: 100%; max-height: 75vh; object-fit: contain; background: #000; }
    
    .btn-ad-download { background: linear-gradient(45deg, #28a745, #20c997); color: #fff; border: none; font-weight: bold; text-decoration: none; }
    .btn-ad-download:hover { background: linear-gradient(45deg, #218838, #1baa80); color: #fff; }
    .btn-ad-stream { background: linear-gradient(45deg, #dc3545, #fd7e14); color: #fff; border: none; font-weight: bold; text-decoration: none; }
    .btn-ad-stream:hover { background: linear-gradient(45deg, #c82333, #e06d12); color: #fff; }
  </style>

  <script>
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.onkeydown = function (e) {
      if (e.keyCode === 123) return false;
      if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) return false;
      if (e.ctrlKey && e.keyCode === 85) return false;
      if (e.ctrlKey && e.keyCode === 83) return false;
    };
  </script>
</head>
<body oncontextmenu="return false;">
  <nav class="navbar navbar-dark mb-4">
    <div class="container">
      <span class="navbar-brand fw-bold text-primary mb-0 h1" style="cursor: default;"><i class="fa-solid fa-play me-2"></i>StreamMax</span>
    </div>
  </nav>

  <div class="container my-3">
    <div class="row justify-content-center">
      <div class="col-lg-10">
        <div class="video-container mb-3">
          <video controls autoplay playsinline preload="metadata" controlsList="nodownload" disablePictureInPicture oncontextmenu="return false;">
            <source src="${streamUrl}" type="video/mp4">
            Your browser does not support video playback.
          </video>
        </div>

        <!-- 🔻 KODE IKLAN NATIVE ADSTERRA 🔻 -->
        <div class="my-3 text-center">
<script async="async" data-cfasync="false" src="https://bancadeltempoidea.org/21/c91a1cc30afde3875e10c8c4faa28965"></script>
<div id="container-c91a1cc30afde3875e10c8c4faa28965"></div>
        </div>

        <!-- HIGH CTR BUTTONS -->
        <div class="d-grid gap-2 d-md-flex justify-content-md-between">
          <a href="${ADSTERRA_DIRECT_LINK_1}" target="_blank" rel="noopener noreferrer" class="btn btn-ad-download py-2 px-4 shadow-sm w-100">
            <i class="fa-solid fa-circle-play me-2"></i>WATCH FULL LENGTH VIDEO
          </a>
          <a href="${ADSTERRA_DIRECT_LINK_2}" target="_blank" rel="noopener noreferrer" class="btn btn-ad-stream py-2 px-4 shadow-sm w-100">
            <i class="fa-solid fa-forward me-2"></i>NEXT EPISODE / PART 2
          </a>
        </div>
      </div>
    </div>
  </div>

  <!-- KODE HISTATS (GANTI ID HISTATS ANDA DI BAWAH INI JIKA PERLU) -->
  <script type="text/javascript">var _Hasync= _Hasync|| [];
_Hasync.push(['Histats.start', '1,5057939,4,511,95,18,00000000']);
_Hasync.push(['Histats.fasi', '1']);
_Hasync.push(['Histats.track_hits', '']);
(function() {
var hs = document.createElement('script'); hs.type = 'text/javascript'; hs.async = true;
hs.src = ('//s10.histats.com/js15_as.js');
(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(hs);
})();</script>
<noscript><a href="/" target="_blank"><img  src="//sstatic1.histats.com/0.gif?5057939&101" alt="" border="0"></a></noscript>
</body>
</html>`;

      return new Response(watchHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 6. Embed Player Endpoint
    if (url.pathname.startsWith('/embed/')) {
      const videoId = url.pathname.split('/embed/')[1];
      const videoData = await env.VIDEOS_KV.getWithMetadata(`video:${videoId}`);

      if (!videoData.metadata) {
        return new Response('Video not found.', { status: 404 });
      }

      const streamUrl = videoData.metadata.isExternal ? videoData.metadata.externalUrl : `${url.origin}/stream/${videoId}`;

      const embedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Embed Video</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
    body, html { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; }
    .video-wrapper { flex: 1; display: flex; align-items: center; justify-content: center; background: #000; overflow: hidden; }
    video { width: 100%; height: 100%; object-fit: contain; }
    .buttons-container { display: flex; gap: 8px; padding: 10px; background: #0d1117; border-top: 1px solid #21262d; }
    .btn-ad { flex: 1; padding: 10px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; text-decoration: none; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; transition: 0.2s; }
    .btn-green { background: #2ea44f; color: #fff; }
    .btn-green:hover { background: #2c974b; }
    .btn-red { background: #da3633; color: #fff; }
    .btn-red:hover { background: #b62324; }
  </style>

  <script>
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.onkeydown = function (e) {
      if (e.keyCode === 123) return false;
      if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) return false;
      if (e.ctrlKey && e.keyCode === 85) return false;
      if (e.ctrlKey && e.keyCode === 83) return false;
    };
  </script>
</head>
<body oncontextmenu="return false;">
  <div class="video-wrapper">
    <video controls autoplay playsinline preload="metadata" controlsList="nodownload" disablePictureInPicture oncontextmenu="return false;">
      <source src="${streamUrl}" type="video/mp4">
    </video>
  </div>

  <div class="buttons-container">
    <a href="${ADSTERRA_DIRECT_LINK_1}" target="_blank" rel="noopener noreferrer" class="btn-ad btn-green">
      <i class="fa-solid fa-circle-play"></i> WATCH FULL LENGTH VIDEO
    </a>
    <a href="${ADSTERRA_DIRECT_LINK_2}" target="_blank" rel="noopener noreferrer" class="btn-ad btn-red">
      <i class="fa-solid fa-forward"></i> NEXT EPISODE / PART 2
    </a>
  </div>
</body>
</html>`;

      return new Response(embedHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
