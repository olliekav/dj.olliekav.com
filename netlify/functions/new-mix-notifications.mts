import type { Config } from '@netlify/functions';
import { notifyContext } from '../lib/context';
import { notifyNewMixes } from '../lib/push';

export default async () => {
  const context = notifyContext();
  try {
    console.log(JSON.stringify(await notifyNewMixes(context)));
  } finally {
    context.apns.close();
  }
};

// Checks the playlist for new mixes and notifies registered devices
export const config: Config = { schedule: '@hourly' };
