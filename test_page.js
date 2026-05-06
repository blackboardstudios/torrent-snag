const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const patterns = [
  { id: 'magnet-links', regex: 'magnet:\\?xt=urn:btih:[a-fA-F0-9]{40}[^\\s]*' },
  { id: 'torrent-files', regex: 'https?://[^\\s]*\\.torrent(?:\\?[^\\s]*)?' },
  { id: 'html-torrent-downloads', regex: 'https?://[^\\s]*(?:/torrents?/download/|/download/[^\\s]*\\.html|/torrent/[^\\s]*\\.html|[?&]action=download)' }
];

const compiledPatterns = patterns.map(p => ({
  ...p,
  compiledRegex: new RegExp(p.regex, 'i')
}));

async function main() {
  const res = await fetch('https://thepiratebay.org/description.php?id=83042595');
  const html = await res.text();

  // Extract all href values from <a> tags
  const hrefMatches = [...html.matchAll(/<a[^>]+href="([^"]*)"/gi)];
  const hrefs = hrefMatches.map(m => m[1]);

  console.log(`Total <a> tags found: ${hrefs.length}`);

  // Simulate element.href resolution for relative URLs
  const resolvedHrefs = hrefs.map(href => {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('magnet:')) {
      return href;
    }
    if (href.startsWith('/')) {
      return 'https://thepiratebay.org' + href;
    }
    return href;
  });

  const matches = [];
  for (const href of resolvedHrefs) {
    for (const pattern of compiledPatterns) {
      pattern.compiledRegex.lastIndex = 0;
      if (pattern.compiledRegex.test(href)) {
        matches.push({ href, pattern: pattern.id });
      }
    }
  }

  console.log(`Total pattern matches: ${matches.length}`);
  const uniqueUrls = [...new Set(matches.map(m => m.href))];
  console.log(`Unique matching URLs: ${uniqueUrls.length}`);

  // Show what matched
  for (const m of matches.slice(0, 20)) {
    console.log(`  [${m.pattern}] ${m.href.substring(0, 120)}`);
  }
  if (matches.length > 20) {
    console.log(`  ... and ${matches.length - 20} more`);
  }
}

main().catch(console.error);
