import type { Config } from '@netlify/functions';
import { soundcloudContext } from '../lib/context';
import { handleMixes } from '../lib/handlers';

export default () => handleMixes(soundcloudContext());

export const config: Config = { path: '/api/mixes', method: 'GET' };
