import { describe, expect, it } from 'vitest';
import type { Mix } from '../../../shared/api-types';
import fixture from '../../../shared/fixtures/mixes.json';
import { SITE_URL } from '../seo';
import { sitemapXml } from '../sitemap';

const mixes = fixture.mixes as Mix[];
const locs = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);

describe('sitemapXml', () => {
  it("lists the home page, every mix's page and the privacy page", () => {
    expect(locs(sitemapXml(mixes))).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/mixes/ok-sessions-1/`,
      `${SITE_URL}/mixes/ok-sessions-2/`,
      `${SITE_URL}/privacy/`
    ]);
  });

  it('dates each mix by when it was published, and the home page by the newest', () => {
    const xml = sitemapXml(mixes);
    expect(xml).toContain(`<loc>${SITE_URL}/mixes/ok-sessions-1/</loc>\n\t\t<lastmod>2019-03-10</lastmod>`);
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>\n\t\t<lastmod>2019-04-01</lastmod>`);
    expect(sitemapXml([{ ...mixes[0]!, published_at: null }])).not.toContain('<lastmod>');
  });

  it('encodes slugs in the URLs', () => {
    expect(sitemapXml([{ ...mixes[0]!, slug: 'a&b' }])).toContain(`<loc>${SITE_URL}/mixes/a%26b/</loc>`);
  });

  it('still lists the pages without mixes', () => {
    expect(locs(sitemapXml([]))).toEqual([`${SITE_URL}/`, `${SITE_URL}/privacy/`]);
  });
});
