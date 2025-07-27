# Chrome Web Store Submission Checklist

## 1. Prepare Your Extension
- [ ] Complete all core features and test thoroughly
- [ ] Ensure `manifest.json` is valid and uses Manifest V3
- [ ] Include all required icons (16x16, 32x32, 48x48, 128x128)
- [ ] Remove test/debug code and sensitive data
- [ ] Build the extension (output to `dist/`)
- [ ] Verify all files are present in `dist/` (manifest, scripts, assets, etc.)

## 2. Create Store Listing Assets
- [ ] 1+ Screenshots (1280x800px, PNG/JPG, show real UI)
- [ ] (Optional) Small promo tile (440x280px)
- [ ] (Optional) Large promo tile (1400x560px)
- [ ] (Optional) Marquee promo (920x680px)
- [ ] High-quality extension icon (128x128px, PNG)

## 3. Write Store Listing Content
- [ ] Extension name and short description (132 chars max)
- [ ] Full description (up to 16,000 chars)
- [ ] Category (e.g., Productivity)
- [ ] Changelog/What's New
- [ ] Support contact (email or website)
- [ ] Privacy policy URL (hosted on GitHub or your site)

## 4. Package the Extension
- [ ] Zip the contents of the `dist/` folder (not the folder itself)
- [ ] Name the file clearly (e.g., `torrentsnag-v1.0.0.zip`)

## 5. Register as a Chrome Web Store Developer
- [ ] Go to https://chrome.google.com/webstore/devconsole/
- [ ] Pay the one-time $5 registration fee
- [ ] Complete identity verification

## 6. Submit the Extension
- [ ] Click "Add new item" in the Developer Dashboard
- [ ] Upload the ZIP file
- [ ] Fill out all listing details and upload assets
- [ ] Add privacy practices and permissions explanations
- [ ] Set distribution options (public/unlisted, regions)
- [ ] Save and submit for review

## 7. After Submission
- [ ] Monitor for review feedback or required changes
- [ ] Respond to any reviewer questions
- [ ] Once approved, announce and share your extension
- [ ] Monitor user feedback and bug reports

---

**Tip:** Test your extension by loading the `dist/` folder as an unpacked extension in Chrome before submitting.
