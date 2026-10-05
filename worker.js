/**
 * 染舟官网 · Cloudflare Worker（只处理视频请求）
 *
 * iPhone、iPad 和 Mac 上的 Safari（以及 iPhone 上的微信、Chrome 等所有浏览器）播放视频时会发“分段请求”
 * （HTTP Range，例如先只要第 0–1 字节），服务器必须回 206 和对应的片段，否则视频根本不播放。
 * Cloudflare 的静态资源服务不支持分段请求、总是返回整个文件（200），所以这些设备上视频不会动。
 *
 * wrangler.jsonc 的 run_worker_first 列出了网站里全部视频的路径（打包时自动生成），只有这些请求会先经过这里：
 * 从静态资源取出文件，只把请求的那一段字节转发出去（206）。其他文件不经过本程序，直接由静态资源服务返回。
 */

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    return withRange(request, response);
  },
};

/**
 * Turn a full-file asset response into a byte-range response when the request asks for one.
 * Anything that is not a plain 200 (404 page, 304 Not Modified, an asset service that already answers 206…)
 * passes through untouched.
 */
async function withRange(request, response) {
  if (response.status !== 200 || response.headers.has('Content-Encoding')) return response;

  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');

  const range = parseRange(request.headers.get('Range'));
  const ifRange = request.headers.get('If-Range');
  const changed = ifRange && ifRange !== response.headers.get('ETag'); // file changed since the browser cached it
  if (request.method !== 'GET' || !range || changed || !response.body) {
    return new Response(response.body, { status: 200, headers });
  }

  // Normally the asset response announces its size, so the requested bytes can be streamed straight through.
  // Without a Content-Length the file is read into memory first (fine for web videos of a few MB).
  let size = Number(response.headers.get('Content-Length'));
  let buffer = null;
  if (!response.headers.has('Content-Length') || !Number.isSafeInteger(size) || size < 0) {
    buffer = await response.arrayBuffer();
    size = buffer.byteLength;
  }

  let start;
  let end;
  if (range.start === null) {
    // "bytes=-500": the last 500 bytes ("bytes=-0" ends up unsatisfiable below)
    start = Math.max(size - range.end, 0);
    end = size - 1;
  } else {
    start = range.start;
    end = range.end === null ? size - 1 : Math.min(range.end, size - 1);
  }
  headers.delete('Content-Length'); // set again for the part that is sent
  if (start >= size || start > end) {
    if (!buffer) response.body.cancel().catch(() => {});
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  if (buffer) return new Response(buffer.slice(start, end + 1), { status: 206, headers });
  return new Response(sliceStream(response.body, start, end - start + 1), { status: 206, headers });
}

/** Pass on `length` bytes of `stream`, starting at byte `start`, without holding the whole file in memory. */
function sliceStream(stream, start, length) {
  const reader = stream.getReader();
  let skip = start;
  let left = length;
  const part = new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        let chunk = value;
        if (skip > 0) {
          if (chunk.byteLength <= skip) {
            skip -= chunk.byteLength;
            continue;
          }
          chunk = chunk.subarray(skip);
          skip = 0;
        }
        if (chunk.byteLength >= left) {
          controller.enqueue(chunk.subarray(0, left));
          left = 0;
          controller.close();
          reader.cancel().catch(() => {});
          return;
        }
        left -= chunk.byteLength;
        controller.enqueue(chunk);
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  // On Cloudflare, FixedLengthStream lets the response carry a Content-Length header.
  if (typeof FixedLengthStream !== 'function') return part;
  const fixed = new FixedLengthStream(length);
  part.pipeTo(fixed.writable).catch(() => {});
  return fixed.readable;
}

/** "bytes=0-1" → {start: 0, end: 1}; "bytes=100-" → {start: 100, end: null}; "bytes=-500" → {start: null, end: 500}.
 *  Missing, malformed or multi-range headers return null, which serves the whole file (allowed by HTTP). */
function parseRange(value) {
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(value || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  const start = m[1] === '' ? null : Number(m[1]);
  const end = m[2] === '' ? null : Number(m[2]);
  if (start !== null && end !== null && end < start) return null;
  return { start, end };
}
