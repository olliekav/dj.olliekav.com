import type { Config } from '@netlify/functions';
import { soundcloudContext } from '../lib/context';
import { handleStream } from '../lib/handlers';

export default (request: Request) => handleStream(request, soundcloudContext());

export const config: Config = {
  path: '/api/stream',
  method: 'GET',
  // Each request spends one of SoundCloud's 15k daily stream requests
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
