// TizenBrew service: the CORS proxy the app needs to reach YouTube from the TV.
// TizenBrew runs this file in its own Node.js, an old one (v4), so it is plain ES5 and uses only
// built-in modules. The app calls http://127.0.0.1:8082/__proxy?url=<encoded url>.
var http = require('http')
var https = require('https')
var url = require('url')

var PORT = 8082
var ALLOWED = /^([\w-]+\.)*(youtube\.com|googlevideo\.com|ytimg\.com|sponsor\.ajay\.app)$/
// Same filtering as fromProxyHeaders in the app: x-ua / x-referer carry the headers browsers will not let a page set.
var DROPPED = ['host', 'origin', 'referer', 'cookie', 'connection']

function cors(res, req) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS')
  res.setHeader('Access-Control-Expose-Headers', 'content-length, content-range, content-type, accept-ranges')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function fail(res, req, status, message) {
  cors(res, req)
  res.statusCode = status
  res.end(message)
}

function upstreamHeaders(incoming) {
  var out = {}
  Object.keys(incoming).forEach(function (k) {
    if (DROPPED.indexOf(k) >= 0 || k.indexOf('sec-') === 0) return
    out[k] = incoming[k]
  })
  if (out['x-ua']) out['user-agent'] = out['x-ua']
  delete out['x-ua']
  if (out['x-referer']) out.referer = out['x-referer']
  delete out['x-referer']
  return out
}

var server = http.createServer(function (req, res) {
  if (req.method === 'OPTIONS') {
    cors(res, req)
    res.statusCode = 204
    return res.end()
  }
  if (req.url.indexOf('/__proxy') !== 0) return fail(res, req, 404, 'not found')

  var target = url.parse(req.url, true).query.url
  var parsed = target && url.parse(target)
  if (!parsed || parsed.protocol !== 'https:' || !ALLOWED.test(parsed.hostname)) return fail(res, req, 400, 'bad url')

  var upstream = https.request(
    {
      protocol: 'https:',
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.path,
      method: req.method,
      headers: upstreamHeaders(req.headers),
    },
    function (up) {
      cors(res, req)
      res.statusCode = up.statusCode
      Object.keys(up.headers).forEach(function (k) {
        if (k.indexOf('access-control-') !== 0 && k !== 'connection' && k !== 'transfer-encoding') res.setHeader(k, up.headers[k])
      })
      up.pipe(res)
    },
  )
  upstream.on('error', function (e) {
    if (res.headersSent) return res.end()
    fail(res, req, 502, String(e))
  })
  // A video seek aborts the request; stop pulling from YouTube too.
  res.on('close', function () {
    upstream.abort()
  })
  req.pipe(upstream)
})

// TizenBrew starts this service again on every launch; the copy already listening keeps serving.
server.on('error', function (e) {
  console.log('youtube-couch proxy: ' + e.message)
})
server.listen(PORT, '127.0.0.1')
