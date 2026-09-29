export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==========================================
    // 🔗 MASUKKAN URL DIRECT LINK ADSTERRA ANDA DI SINI
    // ==========================================
    const ADSTERRA_DIRECT_LINK = "https://nooseamazingbatch.com/xzs0px43?key=15b1073c21c922d059dc880ed8c33bca";

    // 1. Endpoint API untuk Mengambil Daftar Semua Video
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
            watchUrl: `${url.origin}/v/${videoId}`,
            embedUrl: `${url.origin}/embed/${videoId}`,
            streamUrl: `${url.origin}/stream/${videoId}`
          });
        }

        return new Response(JSON.stringify({ success: true, videos }), {
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*' 
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 2. Endpoint API untuk Mengunggah Video
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const videoFile = formData.get('video');
        
        if (!videoFile) {
          return new Response(JSON.stringify({ error: 'File video tidak ditemukan.' }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*' 
            }
          });
        }

        const videoId = Math.random().toString(36).substring(2, 10);
        const arrayBuffer = await videoFile.arrayBuffer();

        // Simpan video dan metadatanya ke Cloudflare KV Storage
        await env.VIDEOS_KV.put(`video:${videoId}`, arrayBuffer, {
          metadata: {
            title: videoFile.name,
            mimeType: videoFile.type || 'video/mp4',
            size: videoFile.size,
            uploadedAt: new Date().toISOString()
          }
        });

        return new Response(JSON.stringify({
          success: true,
          videoId: videoId,
          title: videoFile.name,
          watchUrl: `${url.origin}/v/${videoId}`,
          embedUrl: `${url.origin}/embed/${videoId}`,
          streamUrl: `${url.origin}/stream/${videoId}`
        }), {
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*' 
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 3. Endpoint Streaming Video
    if (url.pathname.startsWith('/stream/')) {
      const videoId = url.pathname.split('/stream/')[1];
      const videoData = await env.VIDEOS_KV.getWithMetadata(`video:${videoId}`, { type: 'arrayBuffer' });

      if (!videoData.value) {
        return new Response('Video tidak ditemukan atau telah dihapus.', { status: 404 });
      }

      return new Response(videoData.value, {
        headers: {
          'Content-Type': videoData.metadata?.mimeType || 'video/mp4',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    }

    // 4. Endpoint Halaman Nonton Khusus (/v/videoId)
    if (url.pathname.startsWith('/v/')) {
      const videoId = url.pathname.split('/v/')[1];
      const videoData = await env.VIDEOS_KV.getWithMetadata(`video:${videoId}`);

      if (!videoData.metadata) {
        return new Response('Video tidak ditemukan.', { status: 404 });
      }

      const streamUrl = `${url.origin}/stream/${videoId}`;
      const embedUrl = `${url.origin}/embed/${videoId}`;
      const embedCode = `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
      const title = videoData.metadata.title || `Video ${videoId}`;
      const uploadedAt = new Date(videoData.metadata.uploadedAt).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      const watchHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - SliceDrive</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    body { background-color: #0d1117; color: #c9d1d9; font-family: system-ui, -apple-system, sans-serif; }
    .navbar { background-color: #161b22; border-bottom: 1px solid #30363d; }
    .video-container { background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    video { width: 100%; max-height: 70vh; object-fit: contain; background: #000; }
    .card-custom { background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; }
    .btn-action { background-color: #21262d; color: #c9d1d9; border: 1px solid #363b42; text-decoration: none; display: inline-flex; align-items: center; }
    .btn-action:hover { background-color: #30363d; color: #fff; }
    
    /* Style Tombol Iklan */
    .btn-ad-download { background: linear-gradient(45deg, #28a745, #20c997); color: #fff; border: none; font-weight: bold; text-decoration: none; }
    .btn-ad-download:hover { background: linear-gradient(45deg, #218838, #1baa80); color: #fff; }
    
    .btn-ad-stream { background: linear-gradient(45deg, #dc3545, #fd7e14); color: #fff; border: none; font-weight: bold; text-decoration: none; }
    .btn-ad-stream:hover { background: linear-gradient(45deg, #c82333, #e06d12); color: #fff; }
  </style>
</head>
<body>
  <nav class="navbar navbar-dark mb-4">
    <div class="container">
      <a class="navbar-brand fw-bold text-primary" href="/"><i class="fa-solid fa-play me-2"></i>SliceDrive</a>
    </div>
  </nav>

  <div class="container my-4">
    <div class="row justify-content-center">
      <div class="col-lg-10">
        <!-- Pemutar Video -->
        <div class="video-container mb-3">
          <video controls autoplay playsinline preload="metadata">
            <source src="${streamUrl}" type="video/mp4">
            Browser Anda tidak mendukung pemutaran video ini.
          </video>
        </div>

        <!-- Tombol Promosi Iklan / Direct Link High CTR -->
        <div class="d-grid gap-2 d-md-flex justify-content-md-between mb-3">
          <a href="${ADSTERRA_DIRECT_LINK}" target="_blank" rel="noopener noreferrer" class="btn btn-ad-download py-2 px-4 shadow-sm w-100">
            <i class="fa-solid fa-bolt me-2"></i>Download HD Fast Speed (Server 1)
          </a>
          <a href="${ADSTERRA_DIRECT_LINK}" target="_blank" rel="noopener noreferrer" class="btn btn-ad-stream py-2 px-4 shadow-sm w-100">
            <i class="fa-solid fa-fire me-2"></i>Nonton Tanpa Buffering (Server 2)
          </a>
        </div>

        <!-- Detail Video & Fitur Salin -->
        <div class="card card-custom p-4 mb-4">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
            <div>
              <h4 class="fw-bold text-white mb-1">${title}</h4>
              <p class="text-muted small mb-0"><i class="fa-regular fa-clock me-1"></i> Diunggah pada ${uploadedAt}</p>
            </div>
            <a href="/" class="btn btn-sm btn-action"><i class="fa-solid fa-house me-1"></i> Dashboard</a>
          </div>
          
          <hr class="border-secondary opacity-25 my-3">

          <div class="d-flex flex-wrap gap-2 mb-3">
            <!-- Tombol Bagikan & Salin -->
            <button onclick="shareVideo()" class="btn btn-action"><i class="fa-solid fa-share-nodes me-2"></i>Bagikan</button>
            <button onclick="copyLink()" class="btn btn-action"><i class="fa-solid fa-link me-2"></i>Salin Tautan</button>
            <button onclick="copyEmbed()" class="btn btn-action"><i class="fa-solid fa-code me-2"></i>Salin Embed</button>
          </div>

          <div class="mt-2">
            <label class="form-label small text-muted">Kode Embed iFrame:</label>
            <input type="text" class="form-control bg-dark text-light border-secondary" value="${embedCode}" readonly id="embedInput">
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function copyLink() {
      navigator.clipboard.writeText(window.location.href);
      alert('Tautan video berhasil disalin!');
    }

    function copyEmbed() {
      const embedInput = document.getElementById('embedInput');
      embedInput.select();
      navigator.clipboard.writeText(embedInput.value);
      alert('Kode embed berhasil disalin!');
    }

    function shareVideo() {
      if (navigator.share) {
        navigator.share({
          title: '${title}',
          url: window.location.href
        });
      } else {
        copyLink();
      }
    }
  </script>
</body>
</html>`;

      return new Response(watchHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 5. Endpoint Pemutar Tersemat (iFrame Embed Page)
    if (url.pathname.startsWith('/embed/')) {
      const videoId = url.pathname.split('/embed/')[1];
      const streamUrl = `${url.origin}/stream/${videoId}`;
      
      const embedHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Embed Video</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <video controls autoplay playsinline preload="metadata">
    <source src="${streamUrl}" type="video/mp4">
    Browser Anda tidak mendukung pemutaran video ini.
  </video>
</body>
</html>`;

      return new Response(embedHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 6. Teruskan semua request web biasa ke Frontend (index.html)
    return env.ASSETS.fetch(request);
  }
};
