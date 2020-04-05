import { IncomingMessage, ServerResponse } from 'http';
import httpProxy from 'http-proxy';
import zlib from 'zlib';

import { AirlockController, AirlockOptions } from '../main';
import { AIRTABLE_API_BASE_URL } from '../utils/AirtableRoute';
import cache from '../utils/cache';

enum Encoding {
  GZIP = 'gzip',
  DEFLATE = 'deflate',
}

export default (options: AirlockOptions): AirlockController<{ web: {} }> => {
  const { airtableApiKey } = options;
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    ignorePath: false,
    selfHandleResponse: true,
  });

  async function handlePayload(
    buffer: Buffer,
    encoding: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (encoding === Encoding.GZIP) {
        zlib.gunzip(buffer, function(err, decoded) {
          if (err) return reject(err);
          resolve(decoded.toString());
        });
      } else if (encoding === Encoding.DEFLATE) {
        zlib.inflate(buffer, function(err, decoded) {
          if (err) return reject(err);
          resolve(decoded.toString());
        });
      } else {
        resolve(buffer.toString());
      }
    });
  }

  proxy.on('proxyReq', function(proxyReq) {
    proxyReq.setHeader('authorization', `Bearer ${airtableApiKey}`);
  });
  proxy.on('proxyRes', function(
    proxyRes: IncomingMessage,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    var body = [];
    proxyRes.on('data', function(chunk) {
      body.push(chunk);
    });
    proxyRes.on('end', async function() {
      const buffer = Buffer.concat(body);
      const proxyPayload = await handlePayload(
        buffer,
        proxyRes.headers['content-encoding'],
      );
      if (req.method === 'GET' && proxyRes.statusCode === 200) {
        cache.set(req, proxyPayload, proxyRes.headers['content-type']);
      }
      res.writeHead(proxyRes.statusCode, {
        'content-type': proxyRes.headers['content-type'],
      });
      res.write(proxyPayload);
      res.end();
    });
  });

  return {
    web(req, res) {
      if (req.method === 'GET') {
        const content = cache.get(req);
        if (content.data) {
          res.setHeader('content-type', content.contentType);
          return res.status(200).send(content.data);
        }
        return proxy.web(req, res, {
          target: AIRTABLE_API_BASE_URL,
        });
      } else {
        cache.clear(req);
        proxy.web(req, res, {
          target: AIRTABLE_API_BASE_URL,
        });
      }
    },
  };
};
