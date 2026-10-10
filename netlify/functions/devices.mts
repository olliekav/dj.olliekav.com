import type { Config } from '@netlify/functions';
import { pushStore } from '../lib/context';
import { handleDevices } from '../lib/push';

export default (request: Request) => handleDevices(request, { store: pushStore() });

export const config: Config = {
  path: '/api/devices',
  method: ['POST', 'DELETE'],
  // The app registers once per launch at most
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
