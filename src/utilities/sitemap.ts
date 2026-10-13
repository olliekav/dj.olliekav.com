import type { Mix } from '../../shared/api-types';
import { mixUrl, SITE_URL } from './seo';

interface SitemapUrl {
  loc: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: string;
}

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, char => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[char]};`);

const urlXml = ({ loc, lastmod, changefreq, priority }: SitemapUrl) =>
  [
    '\t<url>',
    `\t\t<loc>${escapeXml(loc)}</loc>`,
    lastmod && `\t\t<lastmod>${lastmod.slice(0, 10)}</lastmod>`,
    changefreq && `\t\t<changefreq>${changefreq}</changefreq>`,
    priority && `\t\t<priority>${priority}</priority>`,
    '\t</url>'
  ]
    .filter(Boolean)
    .join('\n');

const newest = (mixes: Mix[]) =>
  mixes.reduce<string | null>((latest, { published_at }) => (published_at && (!latest || published_at > latest) ? published_at : latest), null);

export const sitemapXml = (mixes: Mix[]) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlXml({ loc: `${SITE_URL}/`, lastmod: newest(mixes), changefreq: 'weekly', priority: '1.0' }),
    ...mixes.map(mix => urlXml({ loc: mixUrl(mix), lastmod: mix.published_at, priority: '0.8' })),
    urlXml({ loc: `${SITE_URL}/privacy/`, changefreq: 'yearly', priority: '0.2' }),
    '</urlset>',
    ''
  ].join('\n');
