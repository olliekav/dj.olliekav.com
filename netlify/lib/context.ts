import { getStore } from '@netlify/blobs';
import type {} from '@netlify/functions';
import { createSoundCloud } from './soundcloud';

export const soundcloudContext = () => {
  const clientId = Netlify.env.get('SOUNDCLOUD_CLIENT_ID');
  const clientSecret = Netlify.env.get('SOUNDCLOUD_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Missing SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_CLIENT_SECRET');
  }
  const store = getStore('soundcloud');
  return { store, soundcloud: createSoundCloud({ clientId, clientSecret, store }) };
};
