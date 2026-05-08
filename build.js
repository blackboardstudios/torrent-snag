const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProd = process.argv.includes('--prod');

async function build() {
  console.log('Building Torrent Snag...');

  const srcDir = path.join(__dirname, 'src');
  const distDir = path.join(__dirname, 'dist');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else if (!entry.name.endsWith('.js') || shouldBundle(entry.name)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  function shouldBundle(filename) {
    const bundlable = ['background.js', 'popup.js', 'options.js'];
    return bundlable.includes(filename);
  }

  const bundles = [
    {
      entry: path.join(srcDir, 'background', 'background.js'),
      out: path.join(distDir, 'background', 'background.js'),
      format: 'iife'
    },
    {
      entry: path.join(srcDir, 'popup', 'popup.js'),
      out: path.join(distDir, 'popup', 'popup.js'),
      format: 'iife'
    },
    {
      entry: path.join(srcDir, 'options', 'options.js'),
      out: path.join(distDir, 'options', 'options.js'),
      format: 'iife'
    }
  ];

  for (const bundle of bundles) {
    const dir = path.dirname(bundle.out);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      await esbuild.build({
        entryPoints: [bundle.entry],
        bundle: true,
        outfile: bundle.out,
        format: bundle.format,
        minify: isProd,
        sourcemap: !isProd,
        target: ['chrome100'],
        define: {
          'process.env.NODE_ENV': isProd ? '"production"' : '"development"'
        }
      });
      console.log(`Bundled: ${bundle.entry} -> ${bundle.out}`);
    } catch (error) {
      console.error(`Failed to bundle ${bundle.entry}:`, error);
      process.exit(1);
    }
  }

  copyDir(srcDir, distDir);

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});