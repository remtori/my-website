# Tools Roadmap

This site should become a privacy-first collection of common web utilities. The default expectation is that tools run entirely in the browser: files stay on the user's device, there are no ads, no accounts, and no upload/download loop through a third-party service.

If a tool genuinely needs server-side work, the page should say that clearly before the user provides input. Server-side tools still follow the same product rule: no ads, no tracking-heavy flow, and no unnecessary storage.

## Capability Labels

Use these labels consistently when adding tools to the product list.

- `Browser-only`: implemented with browser APIs, WebAssembly, or client-side libraries.
- `Server-assisted`: requires a server because browser APIs cannot perform the task reliably or because remote network access is the point of the tool.
- `Heavy browser`: possible locally, but may be slow, memory-heavy, or unreliable on mobile.
- `Planned`: tool is listed but not built yet.

## First Build Pass

These should be the initial focus because they are common, useful, and realistic to run locally.

### Image Tools

- JPG to PNG
- PNG to JPG
- JPG/PNG to WebP
- JPG/PNG/WebP to AVIF
- Resize image
- Crop image
- Rotate and flip image
- Compress image with a quality slider
- Remove image metadata / EXIF
- View image metadata / EXIF
- SVG to PNG
- SVG optimizer
- Favicon generator
- Color picker from image
- Palette extractor

Likely implementation: Canvas, `createImageBitmap`, browser encoders where available, and small client-side libraries for formats the browser does not encode natively.

#### Image WASM Library Research

Decision: use `wasm-vips` as the first image engine. The product priority for the first image route is fast local transform pipelines,
metadata handling, and practical modern-format coverage rather than maximum historical/archive format coverage.

Why this choice:

- `wasm-vips` exposes libvips' pipeline model in the browser and Node. That maps well to a browser-only utility that can chain decode,
  autorotate, crop, resize, color operations, metadata stripping, and encode without uploading files.
- The current browser package includes the base runtime plus dynamic WASM modules for HEIF/AVIF, JPEG XL, and resvg. The implemented
  `/tools/imgconv` route exposes JPEG, PNG, WebP, AVIF/HEIC, JXL, TIFF, GIF, PPM, Radiance HDR, Ultra HDR, raw pixels, and CSV outputs,
  plus SVG raster input through resvg.
- Browser usage requires cross-origin isolation because wasm-vips uses `SharedArrayBuffer`. The route and wasm-vips runtime assets must
  be served with COEP/COOP-compatible headers before the engine can start.
- The Emscripten browser runtime expects `vips-es6.js` and the related `.wasm` files to live together. Keep `wasm-vips` as the package
  source of truth and use the Vite plugin in `astro.config.mjs` to serve `/vendor/wasm-vips/*` from `node_modules` during dev and copy
  the same files into `dist/client/vendor/wasm-vips/` during build.
- Run all vips work in a dedicated Web Worker. Batch processing should remain sequential by default to keep memory pressure predictable.

Implemented first route:

1. `/tools/imgconv`: drag/drop/paste batch queue, local Web Worker processing, output previews, metadata viewer, palette extraction, color
   picker, and downloadable outputs.
2. Transform controls: autorotate, resize fit/fill/exact/scale, manual crop, smart crop, trim, fixed/custom rotate, flip, flatten alpha,
   grayscale, invert, blur, sharpen, gamma, brightness, and contrast.
3. Encode controls: quality, effort, lossless, progressive/interlaced, metadata keep/remove, and optional favicon set generation.
4. Keep image tools `Browser-only`; do not route files through the Cloudflare Worker for conversion.

Still not covered by wasm-vips alone:

- SVG optimizer: this should use a dedicated SVG optimizer rather than rasterizing through resvg.
- Full ZIP packaging for multi-output favicon sets: add only when a small browser-only ZIP implementation is selected.

Research sources:

- `wasm-vips`: https://github.com/kleisauke/wasm-vips
- libvips WASM notes: https://www.libvips.org/2020/09/01/libvips-for-webassembly.html
- `wasm-image-optimization`: https://github.com/node-libraries/wasm-image-optimization
- `jSquash`: https://github.com/jamsinclair/jSquash

### PDF Tools

- Merge PDFs
- Split PDF
- Extract selected pages
- Reorder pages
- Rotate pages
- Images to PDF
- PDF to images
- PDF metadata viewer
- Remove PDF metadata
- Add page numbers

Likely implementation: `pdf-lib`, `pdfjs-dist`, and ZIP download support for multi-file outputs.

### Developer Tools

- JSON formatter and validator
- YAML formatter and validator
- XML formatter and validator
- HTML formatter
- CSS formatter
- SQL formatter
- Base64 encode/decode
- Image to Base64
- Base64 to image
- URL encode/decode
- HTML entity encode/decode
- JWT decoder
- UUID generator
- ULID generator
- Hash generator: MD5, SHA-1, SHA-256
- Regex tester
- Cron expression explainer

Likely implementation: browser-native crypto APIs where possible, plus focused parser/formatter packages for structured formats.

### Text Tools

- Text diff
- Case converter: camel, snake, kebab, title, sentence
- Slug generator
- Word counter
- Character counter
- Remove duplicate lines
- Sort lines
- Trim lines
- Add/remove line numbers
- Lorem ipsum generator
- Password generator

Likely implementation: plain browser JavaScript. These should be small, fast, and easy to ship early.

### QR And Small Media Tools

- QR code generator
- QR code reader from uploaded image
- Barcode generator
- Barcode reader from uploaded image

Likely implementation: client-side QR/barcode libraries and browser image APIs.

## Later Browser-Only Candidates

These are still good fits for the privacy-first model, but they are more complex or may need heavier dependencies.

- PDF compression
- PDF form flattening
- PDF annotation removal
- Redact PDF
- ZIP files
- Unzip files
- OCR from image
- OCR from PDF
- Audio trim
- Audio converter
- Video trim
- Video converter
- GIF maker from images or video
- EPUB metadata viewer/editor
- DOCX text extractor

Likely implementation: WebAssembly libraries such as `ffmpeg.wasm`, OCR libraries such as `tesseract.js`, and careful file-size warnings.

## Server-Assisted Candidates

These are useful, but should not be promised as browser-only unless there is a proven local implementation.

- HTML to PDF with high visual fidelity
- URL/webpage to PDF
- Website screenshot
- DOCX/PPTX/XLSX to PDF
- DNS lookup
- WHOIS lookup
- SSL certificate checker
- HTTP header checker for arbitrary URLs
- Broken link checker
- Page speed audit
- Background removal, unless using a local model
- AI summarizer
- AI translator

Server-assisted tools should expose the privacy tradeoff directly in the UI. For file-based server tools, prefer temporary processing, no persistent storage, and a clear deletion policy.

## Suggested Iteration Order

1. Expand the `/tools` index with categories and capability labels.
2. Build the smallest text/developer tools first: UUID, hash, Base64, URL encode/decode, JSON formatter.
3. Add image conversion/compression tools.
4. Add PDF merge/split/reorder.
5. Add heavier browser tools only after the first tools share a stable UI pattern.
6. Revisit server-assisted tools last, with explicit privacy copy and operational limits.

## Product Rules

- Prefer local processing even if it takes more implementation work.
- Never upload files unless the tool is explicitly labeled `Server-assisted`.
- Avoid ads, dark patterns, forced accounts, or watermarks.
- Show file size and output size when relevant.
- Support drag-and-drop and paste where it makes sense.
- Make batch operations first-class for image and PDF tools.
- Keep each tool usable on mobile, but warn when a task is likely too heavy for mobile browsers.
- Keep outputs downloadable without sending files through the server.
- For sensitive formats, include a short statement that processing happens on the device.
