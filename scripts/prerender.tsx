/**
 * Post-build script: SSR prerender using React's renderToString.
 *
 * Renders the actual App component to HTML so the pre-rendered content
 * matches exactly what React produces. This enables hydrateRoot() on the
 * client to adopt the existing DOM without replacing it (zero CLS).
 *
 * Articles are loaded from the article registry. Only articles whose
 * component files exist will be prerendered (new case studies added to the
 * registry but not yet created will be skipped gracefully).
 *
 * Usage: npx tsx scripts/prerender.tsx  (runs automatically via "npm run build")
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { Suspense, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import Critters from 'critters';
import App from '../src/App.tsx';
import GlobalNav from '../src/GlobalNav.tsx';
import { articleRegistry, type ArticleConfig } from '../src/articles/registry.ts';
import AboutPage from '../src/AboutPage.tsx';
import { aboutContent } from '../src/about-i18n.ts';
import PrivacyPolicy from '../src/PrivacyPolicy.tsx';
import { seo } from '../src/i18n.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** Strip React 19 SSR-injected <link> tags from inside #root to prevent hydration mismatch */
function stripReactSSRTags(html: string): string {
  return html.replace(/<link[^>]*>/g, '');
}

// ---------------------------------------------------------------------------
// SSR render per language (home page)
// ---------------------------------------------------------------------------
function renderApp(lang: 'es' | 'en'): string {
  const path = lang === 'en' ? '/en' : '/';
  return stripReactSSRTags(renderToString(
    <StaticRouter location={path}>
      <div>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/en" element={<App />} />
          </Routes>
        </Suspense>
      </div>
    </StaticRouter>
  ));
}

function renderArticlePage(slug: string, ArticleComponent: ComponentType<{ lang: 'es' | 'en' }>, lang: 'es' | 'en'): string {
  return stripReactSSRTags(renderToString(
    <StaticRouter location={`/${slug}`}>
      <GlobalNav />
      <div>
        <Suspense fallback={null}>
          <Routes>
            <Route path={`/${slug}`} element={<ArticleComponent lang={lang} />} />
          </Routes>
        </Suspense>
      </div>
    </StaticRouter>
  ));
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Inject into built HTML
// ---------------------------------------------------------------------------
const distDir = resolve(root, 'dist');
const indexPath = resolve(distDir, 'index.html');

let indexHtml: string;
try {
  indexHtml = readFileSync(indexPath, 'utf-8');
} catch {
  console.error('Error: dist/index.html not found. Run "vite build" first.');
  process.exit(1);
}

// --- ES version (inject into existing index.html) ---
let esHtml: string;
try {
  esHtml = renderApp('es');
} catch (err) {
  console.error('[prerender] SSR failed for ES, falling back to empty root:', err);
  esHtml = '';
}

const esSeo = seo.es;

const injectedEs = indexHtml
  .replace('<div id="root"></div>', `<div id="root">${esHtml}</div>`)
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(esSeo.title)}</title>`)
  .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(esSeo.title)}" />`)
  .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(esSeo.description)}" />`)
  .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(esSeo.title)}" />`)
  .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(esSeo.description)}" />`)
  .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(esSeo.title)}" />`)
  .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(esSeo.description)}" />`);

// --- EN version ---
let enHtml: string;
try {
  enHtml = renderApp('en');
} catch (err) {
  console.error('[prerender] SSR failed for EN, falling back to empty root:', err);
  enHtml = '';
}

const enSeo = seo.en;

let enPage = indexHtml
  .replace('<div id="root"></div>', `<div id="root">${enHtml}</div>`)
  .replace('<html lang="es" class="dark">', '<html lang="en" class="dark">')
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(enSeo.title)}</title>`)
  .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(enSeo.title)}" />`)
  .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(enSeo.description)}" />`)
  .replace(/<link rel="canonical" href="[^"]*" \/>/, '<link rel="canonical" href="https://vikas-portfolio-zeta.vercel.app/en" />')
  .replace(/<meta property="og:url" content="[^"]*" \/>/, '<meta property="og:url" content="https://vikas-portfolio-zeta.vercel.app/en" />')
  .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(enSeo.title)}" />`)
  .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(enSeo.description)}" />`)
  .replace(/<meta property="og:locale" content="es_ES" \/>/, '<meta property="og:locale" content="en_US" />')
  .replace(/<meta property="og:locale:alternate" content="en_US" \/>/, '<meta property="og:locale:alternate" content="es_ES" />')
  .replace(/<meta name="twitter:url" content="[^"]*" \/>/, '<meta name="twitter:url" content="https://vikas-portfolio-zeta.vercel.app/en" />')
  .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(enSeo.title)}" />`)
  .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(enSeo.description)}" />`);

// ---------------------------------------------------------------------------
// About / Entity Home — ES (/sobre-mi) + EN (/about)
// ---------------------------------------------------------------------------

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  dateModified: '2026-04-18',
  mainEntity: {
    '@type': 'Person',
    '@id': 'https://vikas-portfolio-zeta.vercel.app/#person',
    name: 'Vikas Chowdary',
    alternateName: 'Vikas Meka Chowdary',
    url: 'https://vikas-portfolio-zeta.vercel.app',
    image: 'https://vikas-portfolio-zeta.vercel.app/foto-avatar.png',
    email: 'vikas.mchowdary@gmail.com',
    jobTitle: 'Senior Member of Technical Staff',
    worksFor: { '@type': 'Organization', name: 'Salesforce', url: 'https://www.salesforce.com' },
    knowsAbout: [
      { '@type': 'Thing', name: 'Distributed Systems', url: 'https://en.wikipedia.org/wiki/Distributed_computing' },
      { '@type': 'Thing', name: 'Apache Kafka', url: 'https://en.wikipedia.org/wiki/Apache_Kafka' },
      { '@type': 'Thing', name: 'Apache HBase', url: 'https://en.wikipedia.org/wiki/Apache_HBase' },
      { '@type': 'Thing', name: 'Observability' },
      { '@type': 'Thing', name: 'Reliability Engineering' },
    ],
    sameAs: [
      'https://www.linkedin.com/in/vikas-mchowdary-75b20b149/',
      'https://github.com/vmeka2020',
    ],
  },
};

const aboutJsonLdScript = `<script type="application/ld+json">\n${JSON.stringify(aboutJsonLd, null, 2)}\n</script>`;

interface AboutPageData {
  slug: string;
  html: string;
}

const aboutPages: AboutPageData[] = [];

for (const lang of ['es', 'en'] as const) {
  const t = aboutContent[lang];
  const slug = t.slug;
  const altSlug = t.altSlug;
  const url = `https://vikas-portfolio-zeta.vercel.app/${slug}`;
  const altUrl = `https://vikas-portfolio-zeta.vercel.app/${altSlug}`;
  const altLang = lang === 'es' ? 'en' : 'es';
  const ogLocale = lang === 'es' ? 'es_ES' : 'en_US';
  const ogLocaleAlt = lang === 'es' ? 'en_US' : 'es_ES';

  let renderedHtml: string;
  try {
    renderedHtml = stripReactSSRTags(renderToString(
      <StaticRouter location={`/${slug}`}>
        <GlobalNav />
        <div>
          <Suspense fallback={null}>
            <Routes>
              <Route path={`/${slug}`} element={<AboutPage lang={lang} />} />
            </Routes>
          </Suspense>
        </div>
      </StaticRouter>
    ));
  } catch (err) {
    console.error(`[prerender] SSR failed for ${slug}, falling back to empty root:`, err);
    renderedHtml = '';
  }

  const hreflangLinks = `<link rel="alternate" hreflang="${lang}" href="${url}" /><link rel="alternate" hreflang="${altLang}" href="${altUrl}" /><link rel="alternate" hreflang="x-default" href="https://vikas-portfolio-zeta.vercel.app/sobre-mi" />`;

  let result = indexHtml
    .replace('<div id="root"></div>', `<div id="root">${renderedHtml}</div>`)
    .replace('<html lang="es" class="dark">', `<html lang="${lang}" class="dark">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(t.seo.title)}</title>`)
    .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(t.seo.title)}" />`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(t.seo.description)}" />`)
    .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\s*/g, '')
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />${hreflangLinks}`)
    .replace(/<meta property="og:type" content="[^"]*" \/>/, '<meta property="og:type" content="profile" />')
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(t.seo.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(t.seo.description)}" />`)
    .replace(/<meta property="og:locale" content="es_ES" \/>/, `<meta property="og:locale" content="${ogLocale}" />`)
    .replace(/<meta property="og:locale:alternate" content="en_US" \/>/, `<meta property="og:locale:alternate" content="${ogLocaleAlt}" />`)
    .replace(/<meta name="twitter:url" content="[^"]*" \/>/, `<meta name="twitter:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(t.seo.title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(t.seo.description)}" />`);

  // Replace homepage JSON-LD with ProfilePage JSON-LD
  result = result.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    aboutJsonLdScript,
  );

  aboutPages.push({ slug, html: result });
}

// ---------------------------------------------------------------------------
// Article pages — build from registry
// ---------------------------------------------------------------------------
interface ArticlePage {
  slug: string;
  html: string;
}

function buildArticlePage(
  config: ArticleConfig,
  lang: 'es' | 'en',
  ArticleComponent: ComponentType<{ lang: 'es' | 'en' }>,
): string {
  const slug = config.slugs[lang];
  const altSlug = config.slugs[lang === 'es' ? 'en' : 'es'];
  const url = `https://vikas-portfolio-zeta.vercel.app/${slug}`;
  const altUrl = `https://vikas-portfolio-zeta.vercel.app/${altSlug}`;
  const altLang = lang === 'es' ? 'en' : 'es';
  const htmlLang = lang;
  const ogLocale = lang === 'es' ? 'es_ES' : 'en_US';
  const ogLocaleAlt = lang === 'es' ? 'en_US' : 'es_ES';
  const articleSeo = config.seo[lang];
  const xDefaultHref = `https://vikas-portfolio-zeta.vercel.app/${config.xDefaultSlug || config.slugs.es}`;

  let renderedHtml: string;
  try {
    renderedHtml = renderArticlePage(slug, ArticleComponent, lang);
  } catch (err) {
    console.error(`[prerender] SSR failed for ${slug}, falling back to empty root:`, err);
    renderedHtml = '';
  }

  const hreflangLinks = `<link rel="alternate" hreflang="${lang}" href="${url}" /><link rel="alternate" hreflang="${altLang}" href="${altUrl}" /><link rel="alternate" hreflang="x-default" href="${xDefaultHref}" />`;

  let result = indexHtml
    .replace('<div id="root"></div>', `<div id="root">${renderedHtml}</div>`)
    .replace('<html lang="es" class="dark">', `<html lang="${htmlLang}" class="dark">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(articleSeo.title)}</title>`)
    .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(articleSeo.description)}" />`)
    // Remove home hreflang tags before injecting article-specific ones
    .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\s*/g, '')
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />${hreflangLinks}`)
    .replace(/<meta property="og:type" content="[^"]*" \/>/, '<meta property="og:type" content="article" />')
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(articleSeo.description)}" />`)
    .replace(/<meta property="og:locale" content="es_ES" \/>/, `<meta property="og:locale" content="${ogLocale}" />`)
    .replace(/<meta property="og:locale:alternate" content="en_US" \/>/, `<meta property="og:locale:alternate" content="${ogLocaleAlt}" />`)
    .replace(/<meta name="twitter:url" content="[^"]*" \/>/, `<meta name="twitter:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(articleSeo.description)}" />`)
    // OG image — replace with article-specific image if configured
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${esc(config.ogImage || 'https://vikas-portfolio-zeta.vercel.app/foto-avatar.webp')}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, config.ogImage ? `<meta name="twitter:image" content="${esc(config.ogImage)}" />` : '');

  // Inject article:published_time + article:modified_time + article:tag
  const seoMeta = config.seoMeta;
  if (seoMeta) {
    const articleMetaTags = [
      `<meta property="article:published_time" content="${seoMeta.datePublished}" />`,
      `<meta property="article:modified_time" content="${seoMeta.dateModified}" />`,
      `<meta property="article:author" content="https://www.linkedin.com/in/vikas-mchowdary-75b20b149/" />`,
      `<meta property="article:tag" content="${esc(seoMeta.articleTags)}" />`,
    ].join('\n    ');
    result = result.replace('</head>', `    ${articleMetaTags}\n  </head>`);
  }

  // Article registry is empty — no article JSON-LD to inject

  return result;
}

// Load article components and build pages
const articlePages: ArticlePage[] = [];

for (const config of articleRegistry) {
  let ArticleComponent: ComponentType<{ lang: 'es' | 'en' }>;
  try {
    const mod = await config.component();
    ArticleComponent = mod.default;
  } catch {
    console.log(`[prerender] Skipping ${config.id} — component not found yet`);
    continue;
  }

  const seen = new Set<string>();
  for (const lang of ['es', 'en'] as const) {
    const slug = config.slugs[lang];
    if (seen.has(slug)) continue; // same slug for both languages
    seen.add(slug);
    const html = buildArticlePage(config, lang, ArticleComponent);
    articlePages.push({ slug, html });
  }
}

// ---------------------------------------------------------------------------
// Critical CSS inlining with Critters
// ---------------------------------------------------------------------------
const critters = new Critters({
  path: distDir,
  publicPath: '/',
  inlineFonts: false,
  preload: 'media',
  compress: true,
  reduceInlineStyles: true,
});

function dedupePreloads(html: string): string {
  return html.replace(/<link rel="preload" as="image" href="\/foto-avatar\.webp">/g, '');
}

/**
 * Swap the base <link rel="preload"> for the avatar (home LCP) to the
 * article's hero image (article LCP). Detects `<img ... fetchpriority="high" ...>`
 * in the rendered content and rewrites the preload to match, preserving srcset
 * and sizes where available. If no high-priority image found, leave as-is.
 */
function swapLcpPreload(html: string, isArticle: boolean): string {
  if (!isArticle) return html;
  const imgMatch = html.match(/<img[^>]*fetchpriority="high"[^>]*>/i);
  if (!imgMatch) return html;
  const img = imgMatch[0];
  const src = img.match(/\bsrc="([^"]+)"/)?.[1];
  if (!src) return html;
  const srcset = img.match(/\bsrcset="([^"]+)"/)?.[1];
  const sizes = img.match(/\bsizes="([^"]+)"/)?.[1];
  const attrs = [
    `rel="preload"`,
    `as="image"`,
    `href="${src}"`,
    `type="image/webp"`,
    srcset ? `imagesrcset="${srcset}"` : '',
    sizes ? `imagesizes="${sizes}"` : '',
    `fetchpriority="high"`,
  ].filter(Boolean).join(' ');
  const newPreload = `<link ${attrs} />`;
  return html.replace(
    /<link rel="preload" href="\/foto-avatar-sm\.webp"[^>]*>/,
    newPreload,
  );
}

async function writePage(html: string, outputPath: string, label: string) {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });
  // Article pages live in dist/<slug>/index.html, NOT dist/index.html or dist/en/index.html
  const isArticle = /\/dist\/[^/]+\/index\.html$/.test(outputPath)
    && !/\/dist\/(en|privacy|privacidad)\/index\.html$/.test(outputPath);
  const pre = swapLcpPreload(html, isArticle);
  try {
    const processed = dedupePreloads(await critters.process(pre));
    writeFileSync(outputPath, processed, 'utf-8');
    console.log(`[prerender] ${label} (with critical CSS)`);
  } catch {
    writeFileSync(outputPath, pre, 'utf-8');
    console.log(`[prerender] ${label} (no critical CSS)`);
  }
}

// ---------------------------------------------------------------------------
// Privacy pages — /privacidad (ES) + /privacy (EN)
// ---------------------------------------------------------------------------
const privacyPages: { slug: string; html: string }[] = [];

for (const [lang, slug, altSlug] of [['es', 'privacidad', 'privacy'], ['en', 'privacy', 'privacidad']] as const) {
  const url = `https://vikas-portfolio-zeta.vercel.app/${slug}`;
  const altUrl = `https://vikas-portfolio-zeta.vercel.app/${altSlug}`;
  const altLang = lang === 'es' ? 'en' : 'es';
  const title = lang === 'es' ? 'Política de Privacidad | vikas-portfolio-zeta.vercel.app' : 'Privacy Policy | vikas-portfolio-zeta.vercel.app';
  const description = lang === 'es'
    ? 'Política de privacidad de vikas-portfolio-zeta.vercel.app. Cómo se recopilan y utilizan los datos del chatbot y la web.'
    : 'Privacy policy for vikas-portfolio-zeta.vercel.app. How chatbot and website data is collected and used.';

  let renderedHtml: string;
  try {
    renderedHtml = stripReactSSRTags(renderToString(
      <StaticRouter location={`/${slug}`}>
        <GlobalNav />
        <div>
          <Suspense fallback={null}>
            <Routes>
              <Route path={`/${slug}`} element={<PrivacyPolicy lang={lang} />} />
            </Routes>
          </Suspense>
        </div>
      </StaticRouter>
    ));
  } catch (err) {
    console.error(`[prerender] SSR failed for ${slug}:`, err);
    renderedHtml = '';
  }

  const hreflangLinks = `<link rel="alternate" hreflang="${lang}" href="${url}" /><link rel="alternate" hreflang="${altLang}" href="${altUrl}" /><link rel="alternate" hreflang="x-default" href="https://vikas-portfolio-zeta.vercel.app/privacidad" />`;

  let result = indexHtml
    .replace('<div id="root"></div>', `<div id="root">${renderedHtml}</div>`)
    .replace('<html lang="es" class="dark">', `<html lang="${lang}" class="dark">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(title)}" />`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />')
    .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\s*/g, '')
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />${hreflangLinks}`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="og:locale" content="es_ES" \/>/, `<meta property="og:locale" content="${lang === 'es' ? 'es_ES' : 'en_US'}" />`)
    .replace(/<meta property="og:locale:alternate" content="en_US" \/>/, `<meta property="og:locale:alternate" content="${lang === 'es' ? 'en_US' : 'es_ES'}" />`)
    .replace(/<meta name="twitter:url" content="[^"]*" \/>/, `<meta name="twitter:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`);

  // Remove homepage JSON-LD (privacy pages don't need structured data)
  result = result.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');

  privacyPages.push({ slug, html: result });
}

async function inlineCriticalCSS() {
  // Home pages
  await writePage(injectedEs, indexPath, 'ES: dist/index.html updated');
  await writePage(enPage, resolve(distDir, 'en', 'index.html'), 'EN: dist/en/index.html created');

  // About pages
  for (const { slug, html } of aboutPages) {
    await writePage(html, resolve(distDir, slug, 'index.html'), `${slug}: dist/${slug}/index.html created`);
  }

  // Article pages
  for (const { slug, html } of articlePages) {
    await writePage(html, resolve(distDir, slug, 'index.html'), `${slug}: dist/${slug}/index.html created`);
  }

  // Privacy pages
  for (const { slug, html } of privacyPages) {
    await writePage(html, resolve(distDir, slug, 'index.html'), `${slug}: dist/${slug}/index.html created`);
  }
}

await inlineCriticalCSS();

// ---------------------------------------------------------------------------
// 404 page — Vercel serves this with HTTP 404 status automatically
// ---------------------------------------------------------------------------
const notFoundHtml = indexHtml
  .replace('<div id="root"></div>', `<div id="root"><div style="min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 1.5rem"><p style="font-size:6rem;font-weight:bold;color:var(--primary);margin-bottom:1rem;font-family:var(--font-display)">404</p><h1 style="font-size:1.5rem;font-weight:600;color:var(--foreground);margin-bottom:0.5rem">Page not found</h1><p style="color:var(--muted-foreground);margin-bottom:2rem;max-width:28rem">The page you're looking for doesn't exist or has been moved.</p><a href="/" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.5rem;border-radius:0.75rem;background:var(--primary);color:var(--primary-foreground);font-weight:500;text-decoration:none">← Back to home</a></div></div>`)
  .replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />')
  .replace(/<title>[^<]*<\/title>/, '<title>404 — Page not found | vikas-portfolio-zeta.vercel.app</title>');

// Add noindex if no robots meta exists
if (!notFoundHtml.includes('name="robots"')) {
  const withNoindex = notFoundHtml.replace('</head>', '<meta name="robots" content="noindex, nofollow" /></head>');
  writeFileSync(resolve(distDir, '404.html'), withNoindex, 'utf-8');
} else {
  writeFileSync(resolve(distDir, '404.html'), notFoundHtml, 'utf-8');
}
console.log('[prerender] 404: dist/404.html created');

// ---------------------------------------------------------------------------
// Hydration structure validation
// ---------------------------------------------------------------------------
function validateHydrationStructure(html: string, label: string) {
  const rootMatch = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script/);
  if (!rootMatch || !rootMatch[1].trim()) return; // empty root = OK (fallback)
  const content = rootMatch[1];

  // Must NOT contain <link> tags (React 19 SSR artifacts)
  if (/<link\s/.test(content)) {
    console.error(`[hydration-check] FAIL ${label}: <link> tags found inside #root — will cause hydration mismatch`);
    process.exit(1);
  }

  // Must have <div> wrapper (PageTransition)
  if (!content.includes('<div')) {
    console.error(`[hydration-check] FAIL ${label}: missing <div> wrapper (PageTransition) inside #root`);
    process.exit(1);
  }
}

// Validate home pages
validateHydrationStructure(injectedEs, 'home-es');
validateHydrationStructure(enPage, 'home-en');

// Validate about pages
for (const { slug, html } of aboutPages) {
  validateHydrationStructure(html, slug);
}

// Validate article pages
for (const { slug, html } of articlePages) {
  validateHydrationStructure(html, slug);
}

// Validate privacy pages
for (const { slug, html } of privacyPages) {
  validateHydrationStructure(html, slug);
}

console.log('[hydration-check] All pages pass structural validation');
console.log('[prerender] Done.');
