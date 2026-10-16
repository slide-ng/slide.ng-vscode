// Asks localhost:<port> whether a slide.ng dev server is there. The companion server answers `GET /__slide-ng/session`
// for local requests; we only look at the shape of the answer and never read or keep what it contains.
import { get } from 'node:http';

export type Probe = 'slide-ng' | 'other' | 'down';

export function probe(port: number, timeoutMs = 1000): Promise<Probe> {
  return new Promise((done) => {
    const req = get(
      { host: 'localhost', port, path: '/__slide-ng/session', timeout: timeoutMs, agent: false },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          if (body.length < 2048) body += chunk;
        });
        res.on('end', () => done(isSlideNg(res.statusCode ?? 0, body) ? 'slide-ng' : 'other'));
        res.on('error', () => done('other'));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      done('down');
    });
    req.on('error', (e: NodeJS.ErrnoException) =>
      done(e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' ? 'down' : 'other'),
    );
  });
}

/** The session answer is `{ token, remote }`; with `--remote=password` and no login it is a 401 `{ error: 'password required' }`. */
export function isSlideNg(status: number, body: string): boolean {
  try {
    const json = JSON.parse(body);
    if (status === 200) return typeof json?.remote === 'boolean' && typeof json?.token === 'string';
    return status === 401 && json?.error === 'password required';
  } catch {
    return false;
  }
}
