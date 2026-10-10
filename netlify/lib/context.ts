import { getStore } from '@netlify/blobs';
import { purgeCache } from '@netlify/functions';
import { createAPNs } from './apns';
import { MIXES_CACHE_TAG } from './handlers';
import type { PushStore } from './push';
import { createSoundCloud } from './soundcloud';

const required = (name: string) => {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export const soundcloudContext = () => {
  const clientId = required('SOUNDCLOUD_CLIENT_ID');
  const clientSecret = required('SOUNDCLOUD_CLIENT_SECRET');
  const store = getStore('soundcloud');
  return { store, soundcloud: createSoundCloud({ clientId, clientSecret, store }) };
};

/** Registered devices and the newest mix announced; strongly consistent, as it's read straight after writes */
export const pushStore = (): PushStore => getStore({ name: 'push', consistency: 'strong' });

export const notifyContext = () => {
  const { store: soundcloudStore, soundcloud } = soundcloudContext();
  const apns = createAPNs({
    keyId: required('APNS_KEY_ID'),
    teamId: required('APNS_TEAM_ID'),
    key: required('APNS_KEY'),
    bundleId: Netlify.env.get('APNS_BUNDLE_ID') || 'com.olliekav.oksessions',
    host: Netlify.env.get('APNS_HOST') || 'api.push.apple.com'
  });
  const purgeMixes = () => purgeCache({ tags: [MIXES_CACHE_TAG] });
  return { soundcloud, soundcloudStore, store: pushStore(), apns, purgeMixes };
};
