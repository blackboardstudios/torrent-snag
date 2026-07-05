const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProd = process.argv.includes('--prod');
const BUNDLED_ENTRIES = new Set([
  'background/background.js',
  'popup/popup.js',
  'options/options.js'
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

async function build() {
  console.log('Building Torrent Snag...');

  const srcDir = path.join(__dirname, 'src');
  const distDir = path.join(__dirname, 'dist');

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  function shouldSkipBundledCopy(relativePath) {
    return BUNDLED_ENTRIES.has(toPosix(relativePath));
  }

  function copyDir(src, dest, relativePath = '') {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      const nextRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath, nextRelativePath);
      } else if (!entry.name.endsWith('.js') || !shouldSkipBundledCopy(nextRelativePath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  function assertFileExists(relativePath) {
    const target = path.join(distDir, relativePath);
    if (!fs.existsSync(target)) {
      throw new Error(`Missing build artifact: ${relativePath}`);
    }
  }

  function assertNotSourceCopy(relativePath) {
    const srcPath = path.join(srcDir, relativePath);
    const distPath = path.join(distDir, relativePath);

    const srcContents = fs.readFileSync(srcPath);
    const distContents = fs.readFileSync(distPath);

    if (Buffer.compare(srcContents, distContents) === 0) {
      throw new Error(`Bundled output was overwritten by copy pass: ${relativePath}`);
    }
  }

  function collectIconPaths(definition, collector) {
    if (typeof definition === 'string') {
      collector.push(definition);
      return;
    }
    if (!definition || typeof definition !== 'object') {
      return;
    }
    for (const value of Object.values(definition)) {
      if (typeof value === 'string') {
        collector.push(value);
      }
    }
  }

  async function validateBuildOutput() {
    const manifestPath = path.join(distDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Missing build artifact: manifest.json');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const missing = [];

    const serviceWorker = manifest?.background?.service_worker;
    if (typeof serviceWorker !== 'string' || !serviceWorker.length) {
      throw new Error('manifest.json is missing background.service_worker');
    }
    if (!fs.existsSync(path.join(distDir, serviceWorker))) {
      missing.push(`manifest background.service_worker -> ${serviceWorker}`);
    }

    const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
    for (let i = 0; i < contentScripts.length; i++) {
      const scripts = Array.isArray(contentScripts[i]?.js) ? contentScripts[i].js : [];
      for (const scriptPath of scripts) {
        if (typeof scriptPath !== 'string' || !scriptPath.length) {
          missing.push(`manifest content_scripts[${i}].js entry`);
          continue;
        }
        if (!fs.existsSync(path.join(distDir, scriptPath))) {
          missing.push(`manifest content_scripts[${i}].js -> ${scriptPath}`);
        }
      }
    }

    const optionsPage = manifest.options_page;
    if (typeof optionsPage !== 'string' || !optionsPage.length) {
      throw new Error('manifest.json is missing options_page');
    }
    if (!fs.existsSync(path.join(distDir, optionsPage))) {
      missing.push(`manifest options_page -> ${optionsPage}`);
    }

    const iconPaths = [];
    collectIconPaths(manifest?.action?.default_icon, iconPaths);
    collectIconPaths(manifest?.icons, iconPaths);
    for (const iconPath of iconPaths) {
      if (!fs.existsSync(path.join(distDir, iconPath))) {
        missing.push(`manifest icon -> ${iconPath}`);
      }
    }

    const srcLocalesDir = path.join(srcDir, '_locales');
    if (fs.existsSync(srcLocalesDir)) {
      for (const localeDir of fs.readdirSync(srcLocalesDir, { withFileTypes: true })) {
        if (!localeDir.isDirectory()) {
          continue;
        }
        const localeRelativePath = `_locales/${localeDir.name}`;
        const distLocalePath = path.join(distDir, localeRelativePath);
        if (!fs.existsSync(distLocalePath)) {
          missing.push(`locale directory -> ${localeRelativePath}`);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(`Build artifact validation failed:\n${missing.map((item) => ` - ${item}`).join('\n')}`);
    }

    for (const entry of BUNDLED_ENTRIES) {
      assertFileExists(entry);
      assertNotSourceCopy(entry);
    }
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
  await validateBuildOutput();

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
