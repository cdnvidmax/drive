export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Endpoint API untuk Mengunggah Video
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const videoFile = formData.get('video');
        
        if (!videoFile) {
          return new Response(JSON.stringify({ error: 'File video tidak ditemukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 2. Endpoint Streaming Video
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

    // 3. Endpoint Pemutar Tersemat (iFrame Embed Page)
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

    // 4. Teruskan semua request web biasa ke Frontend (index.html)
    return env.ASSETS.fetch(request);
  }
};
