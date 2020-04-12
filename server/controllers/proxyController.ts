import { Record } from 'airtable';
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
        zlib.gunzip(buffer, function (err, decoded) {
          if (err) return reject(err);
          resolve(decoded.toString());
        });
      } else if (encoding === Encoding.DEFLATE) {
        zlib.inflate(buffer, function (err, decoded) {
          if (err) return reject(err);
          resolve(decoded.toString());
        });
      } else {
        resolve(buffer.toString());
      }
    });
  }

  proxy.on('proxyReq', function (proxyReq) {
    proxyReq.setHeader('authorization', `Bearer ${airtableApiKey}`);
  });
  proxy.on('proxyRes', function (
    proxyRes: IncomingMessage,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    var body = [];
    proxyRes.on('data', function (chunk) {
      body.push(chunk);
    });
    proxyRes.on('end', async function () {
      const buffer = Buffer.concat(body);
      const proxyPayload = await handlePayload(
        buffer,
        proxyRes.headers['content-encoding'],
      );
      if (req.method === 'GET' && proxyRes.statusCode === 200) {
        cache.set(req, proxyPayload, proxyRes.headers['content-type']);
      }

      res.setHeader('content-type', proxyRes.headers['content-type']);
      if (proxyRes.statusCode !== 200) {
        req.emit('payloadError', proxyPayload);
      } else {
        req.emit('payloadReady', proxyPayload);
      }
    });
  });

  return {
    web(req, res, next) {
      // Setup forwarding to next controller, if proxy passes
      req.on('payloadError', (err: string) => {
        next(err);
      });
      req.on('payloadReady', (payload: string) => {
        req.context = JSON.parse(payload) as
          | Record<any>
          | { records: Record<any>[] };
        next();
      });

      if (req.method === 'GET') {
        const content = cache.get(req);
        if (content.data) {
          res.setHeader('content-type', content.contentType);
          req.emit('payloadReady', content.data);
          return;
        }

        proxy.web(req, res, {
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
