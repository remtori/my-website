import type { ImageMetadata, ImageToolOptions, MetadataEntry, WorkerOutput, WorkerRequest, WorkerResponse } from '@/lib/image-tool-types';

type VipsFactory = (config?: Record<string, unknown>) => Promise<VipsRuntime>;
type VipsVector<T> = Iterable<T> & {
	size?: () => number;
	get?: (index: number) => T | undefined;
	delete?: () => void;
};
type VipsTarget = {
	getBlob(): Uint8Array;
	delete?: () => void;
};
type VipsImage = {
	width: number;
	height: number;
	bands: number;
	format: string;
	coding: string;
	interpretation: string;
	xres: number;
	yres: number;
	pageHeight: number;
	onProgress: (percent: number) => void;
	autorot(): VipsImage;
	crop(left: number, top: number, width: number, height: number): VipsImage;
	smartcrop(width: number, height: number, options?: Record<string, unknown>): VipsImage;
	thumbnailImage(width: number, options?: Record<string, unknown>): VipsImage;
	resize(scale: number, options?: Record<string, unknown>): VipsImage;
	rot(angle: string): VipsImage;
	rotate(angle: number, options?: Record<string, unknown>): VipsImage;
	flip(direction: string): VipsImage;
	flatten(options?: Record<string, unknown>): VipsImage;
	colourspace(space: string): VipsImage;
	invert(): VipsImage;
	gaussblur(sigma: number): VipsImage;
	sharpen(options?: Record<string, unknown>): VipsImage;
	gamma(options?: Record<string, unknown>): VipsImage;
	linear(a: number, b: number): VipsImage;
	findTrim(options?: Record<string, unknown>): { left: number; top: number; width: number; height: number };
	hasAlpha(): boolean;
	getFields(): VipsVector<string>;
	getTypeof(name: string): number;
	getString(name: string): string;
	getInt(name: string): number;
	getDouble(name: string): number;
	getArrayInt(name: string): number[];
	getArrayDouble(name: string): number[];
	getBlob(name: string): Uint8Array;
	jpegsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	pngsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	webpsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	heifsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	jxlsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	tiffsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	gifsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	ppmsaveTarget(target: VipsTarget, options?: Record<string, unknown>): void;
	radsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	uhdrsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	rawsaveBuffer(options?: Record<string, unknown>): Uint8Array;
	csvsaveTarget(target: VipsTarget, options?: Record<string, unknown>): void;
	delete?: () => void;
};
type VipsRuntime = {
	Image: {
		newFromBuffer(blob: Blob, strOptions?: string, options?: Record<string, unknown>): VipsImage;
		svgloadBuffer?(blob: Blob, options?: Record<string, unknown>): VipsImage;
	};
	Target: {
		newToMemory(): VipsTarget;
	};
	version(flag?: number): string | number;
	emscriptenVersion(): string;
	concurrency(concurrency?: number): undefined | number;
	shutdown(): void;
};

const VIPS_BASE = '/vendor/wasm-vips/';
const PREVIEW_MAX_SIZE = 720;
const FAVICON_SIZES = [16, 32, 48] as const;
const FAVICON_PNG_SIZES = [180, 192, 512] as const;

let vipsPromise: Promise<VipsRuntime> | undefined;

function post(message: WorkerResponse, transfer?: Transferable[]): void {
	self.postMessage(message, { transfer });
}

function absoluteVendorUrl(file: string): string {
	return new URL(`${VIPS_BASE}${file}`, self.location.origin).href;
}

async function loadVips(): Promise<VipsRuntime> {
	if (!vipsPromise) {
		vipsPromise = (async () => {
			const module = (await import(/* @vite-ignore */ absoluteVendorUrl('vips-es6.js'))) as { default: VipsFactory };
			const vips = await module.default({
				dynamicLibraries: ['vips-jxl.wasm', 'vips-heif.wasm', 'vips-resvg.wasm'],
				locateFile(file: string) {
					return absoluteVendorUrl(file);
				},
				mainScriptUrlOrBlob: absoluteVendorUrl('vips-es6.js'),
				printErr(message: string) {
					console.warn(message);
				},
			});
			vips.concurrency(1);
			return vips;
		})();
	}
	return vipsPromise;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function intValue(value: number, fallback: number): number {
	return Number.isFinite(value) ? Math.round(value) : fallback;
}

function normalizeExtension(format: string): string {
	if (format === 'jpeg') return 'jpg';
	if (format === 'heic') return 'heic';
	if (format === 'hdr') return 'hdr';
	return format;
}

function baseName(fileName: string): string {
	const clean = fileName.trim().replace(/[/\\?%*:|"<>]/g, '-');
	const dot = clean.lastIndexOf('.');
	return (dot > 0 ? clean.slice(0, dot) : clean) || 'image';
}

function typedArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function hexToRgb(hex: string): [number, number, number] {
	const normalized = hex.trim().replace(/^#/, '');
	if (!/^[\da-fA-F]{6}$/.test(normalized)) {
		return [255, 255, 255];
	}
	const value = Number.parseInt(normalized, 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function saveOptions(options: ImageToolOptions): Record<string, unknown> {
	const background = hexToRgb(options.background);
	return {
		keep: options.keepMetadata ? 'all' : 'none',
		background,
	};
}

function outputMime(format: ImageToolOptions['outputFormat']): string {
	switch (format) {
		case 'jpeg':
			return 'image/jpeg';
		case 'png':
			return 'image/png';
		case 'webp':
			return 'image/webp';
		case 'avif':
			return 'image/avif';
		case 'heic':
			return 'image/heic';
		case 'jxl':
			return 'image/jxl';
		case 'tiff':
			return 'image/tiff';
		case 'gif':
			return 'image/gif';
		case 'ppm':
			return 'image/x-portable-pixmap';
		case 'hdr':
			return 'image/vnd.radiance';
		case 'uhdr':
			return 'image/jpeg';
		case 'csv':
			return 'text/csv';
		case 'raw':
			return 'application/octet-stream';
	}
}

function deleteHandle(handle: { delete?: () => void } | undefined): void {
	try {
		handle?.delete?.();
	} catch {
		// Some embind handles can already be scheduled for deletion.
	}
}

function replaceImage(handles: VipsImage[], next: VipsImage): VipsImage {
	handles.push(next);
	return next;
}

function loadImage(vips: VipsRuntime, buffer: ArrayBuffer, fileName: string, mime: string): VipsImage {
	const blob = new Blob([buffer], { type: mime || 'application/octet-stream' });
	const lowerName = fileName.toLowerCase();
	const isSvg = mime.includes('svg') || lowerName.endsWith('.svg') || lowerName.endsWith('.svgz');
	const svgloadBuffer = vips.Image.svgloadBuffer;
	if (isSvg && svgloadBuffer) {
		return svgloadBuffer(blob, { unlimited: true });
	}
	return vips.Image.newFromBuffer(blob, '', { access: 'sequential', fail_on: 'none' });
}

function metadataValue(image: VipsImage, field: string): string {
	const getters: Array<() => unknown> = [
		() => image.getString(field),
		() => image.getInt(field),
		() => image.getDouble(field),
		() => image.getArrayInt(field),
		() => image.getArrayDouble(field),
		() => image.getBlob(field),
	];

	for (const getter of getters) {
		try {
			const value = getter();
			if (value instanceof Uint8Array) {
				return `${value.byteLength.toLocaleString()} bytes`;
			}
			if (Array.isArray(value)) {
				return value.length > 12 ? `${value.slice(0, 12).join(', ')} ... (${value.length} values)` : value.join(', ');
			}
			if (value !== undefined && value !== null) {
				return String(value);
			}
		} catch {
			// Try the next metadata getter.
		}
	}

	try {
		const type = image.getTypeof(field);
		return `type ${String(type)}`;
	} catch {
		return 'unreadable';
	}
}

function vectorToArray<T>(vector: VipsVector<T>): T[] {
	try {
		return Array.from(vector);
	} catch {
		const size = vector.size?.() ?? 0;
		const values: T[] = [];
		for (let i = 0; i < size; i++) {
			const value = vector.get?.(i);
			if (value !== undefined) values.push(value);
		}
		return values;
	}
}

function readMetadata(image: VipsImage): ImageMetadata {
	let fieldsHandle: ReturnType<VipsImage['getFields']> | undefined;
	let fields: string[] = [];
	try {
		fieldsHandle = image.getFields();
		fields = vectorToArray(fieldsHandle);
	} catch {
		fields = [];
	} finally {
		deleteHandle(fieldsHandle);
	}

	const entries: MetadataEntry[] = fields.slice(0, 120).map((field) => ({
		name: field,
		value: metadataValue(image, field),
	}));

	return {
		width: image.width,
		height: image.height,
		bands: image.bands,
		format: image.format,
		coding: image.coding,
		interpretation: image.interpretation,
		hasAlpha: image.hasAlpha(),
		xres: image.xres,
		yres: image.yres,
		pageHeight: image.pageHeight,
		fields: entries,
	};
}

function normalizeForJpegLike(image: VipsImage, handles: VipsImage[], options: ImageToolOptions): VipsImage {
	if (!image.hasAlpha()) return image;
	return replaceImage(handles, image.flatten({ background: hexToRgb(options.background) }));
}

function transformImage(image: VipsImage, handles: VipsImage[], options: ImageToolOptions): VipsImage {
	let current = image;
	const background = hexToRgb(options.background);

	if (options.autorotate && 'autorot' in current) {
		current = replaceImage(handles, current.autorot());
	}

	if (options.cropMode === 'trim') {
		const trim = current.findTrim({ threshold: clamp(options.trimThreshold, 0, 100), background });
		if (trim.width > 0 && trim.height > 0 && (trim.width !== current.width || trim.height !== current.height)) {
			current = replaceImage(handles, current.crop(trim.left, trim.top, trim.width, trim.height));
		}
	}

	if (options.cropMode === 'manual') {
		const left = clamp(intValue(options.cropLeft, 0), 0, Math.max(0, current.width - 1));
		const top = clamp(intValue(options.cropTop, 0), 0, Math.max(0, current.height - 1));
		const width = clamp(intValue(options.cropWidth, current.width - left), 1, current.width - left);
		const height = clamp(intValue(options.cropHeight, current.height - top), 1, current.height - top);
		current = replaceImage(handles, current.crop(left, top, width, height));
	}

	if (options.cropMode === 'smart' && options.width > 0 && options.height > 0) {
		current = replaceImage(
			handles,
			current.smartcrop(intValue(options.width, current.width), intValue(options.height, current.height), {
				interesting: options.interesting,
			}),
		);
	}

	if (options.resizeMode !== 'none') {
		const width = intValue(options.width, current.width);
		const height = intValue(options.height, current.height);
		if ((options.resizeMode === 'fit' || options.resizeMode === 'fill') && width > 0 && height > 0) {
			current = replaceImage(
				handles,
				current.thumbnailImage(width, {
					height,
					size: options.allowUpscale ? 'both' : 'down',
					crop: options.resizeMode === 'fill' ? options.interesting : 'none',
				}),
			);
		}
		if (options.resizeMode === 'exact' && width > 0 && height > 0) {
			current = replaceImage(
				handles,
				current.resize(width / current.width, {
					kernel: options.kernel,
					vscale: height / current.height,
				}),
			);
		}
		if (options.resizeMode === 'scale' && options.scale > 0) {
			current = replaceImage(handles, current.resize(options.scale / 100, { kernel: options.kernel }));
		}
	}

	if (options.rotateMode === 'd90' || options.rotateMode === 'd180' || options.rotateMode === 'd270') {
		current = replaceImage(handles, current.rot(options.rotateMode));
	}
	if (options.rotateMode === 'custom' && options.customAngle !== 0) {
		current = replaceImage(handles, current.rotate(options.customAngle, { background }));
	}
	if (options.flipHorizontal) {
		current = replaceImage(handles, current.flip('horizontal'));
	}
	if (options.flipVertical) {
		current = replaceImage(handles, current.flip('vertical'));
	}

	if (options.flatten && current.hasAlpha()) {
		current = replaceImage(handles, current.flatten({ background }));
	}
	if (options.grayscale) {
		current = replaceImage(handles, current.colourspace('b-w'));
	}
	if (options.invert) {
		current = replaceImage(handles, current.invert());
	}
	if (options.blur > 0) {
		current = replaceImage(handles, current.gaussblur(clamp(options.blur, 0.1, 40)));
	}
	if (options.sharpen > 0) {
		current = replaceImage(handles, current.sharpen({ sigma: clamp(options.sharpen, 0.1, 20) }));
	}
	if (options.gamma > 0 && Math.abs(options.gamma - 1) > 0.01) {
		current = replaceImage(handles, current.gamma({ exponent: clamp(options.gamma, 0.1, 5) }));
	}
	if (options.brightness !== 0 || options.contrast !== 100) {
		current = replaceImage(handles, current.linear(clamp(options.contrast, 0, 300) / 100, clamp(options.brightness, -255, 255)));
	}

	return current;
}

function saveMainOutput(
	vips: VipsRuntime,
	image: VipsImage,
	handles: VipsImage[],
	fileName: string,
	options: ImageToolOptions,
): WorkerOutput {
	const base = baseName(fileName);
	const common = saveOptions(options);
	let outputImage = image;
	let bytes: Uint8Array;

	switch (options.outputFormat) {
		case 'jpeg':
			outputImage = normalizeForJpegLike(outputImage, handles, options);
			bytes = outputImage.jpegsaveBuffer({
				...common,
				Q: clamp(options.quality, 1, 100),
				interlace: options.progressive,
				optimize_coding: true,
			});
			break;
		case 'png':
			bytes = outputImage.pngsaveBuffer({
				...common,
				compression: clamp(Math.round((100 - options.quality) / 11), 0, 9),
				interlace: options.progressive,
				Q: clamp(options.quality, 1, 100),
				effort: clamp(options.effort, 1, 10),
			});
			break;
		case 'webp':
			bytes = outputImage.webpsaveBuffer({
				...common,
				Q: clamp(options.quality, 1, 100),
				lossless: options.lossless,
				effort: clamp(options.effort, 0, 9),
				smart_subsample: true,
			});
			break;
		case 'avif':
			bytes = outputImage.heifsaveBuffer({
				...common,
				Q: clamp(options.quality, 1, 100),
				lossless: options.lossless,
				compression: 'av1',
				effort: clamp(options.effort, 0, 9),
			});
			break;
		case 'heic':
			bytes = outputImage.heifsaveBuffer({
				...common,
				Q: clamp(options.quality, 1, 100),
				lossless: options.lossless,
				compression: 'hevc',
				effort: clamp(options.effort, 0, 9),
			});
			break;
		case 'jxl':
			bytes = outputImage.jxlsaveBuffer({
				...common,
				Q: clamp(options.quality, 1, 100),
				lossless: options.lossless,
				effort: clamp(options.effort, 1, 9),
			});
			break;
		case 'tiff':
			bytes = outputImage.tiffsaveBuffer({
				...common,
				compression: options.lossless ? 'deflate' : 'jpeg',
				Q: clamp(options.quality, 1, 100),
				level: clamp(options.effort, 1, 9),
				tile: false,
			});
			break;
		case 'gif':
			bytes = outputImage.gifsaveBuffer({
				...common,
				effort: clamp(options.effort, 1, 10),
				dither: 0.6,
			});
			break;
		case 'ppm': {
			const target = vips.Target.newToMemory();
			try {
				outputImage.ppmsaveTarget(target, { ...common, format: 'ppm' });
				bytes = target.getBlob();
			} finally {
				deleteHandle(target);
			}
			break;
		}
		case 'hdr':
			bytes = outputImage.radsaveBuffer(common);
			break;
		case 'uhdr':
			outputImage = normalizeForJpegLike(outputImage, handles, options);
			bytes = outputImage.uhdrsaveBuffer({
				...common,
				Q: clamp(options.quality, 1, 100),
			});
			break;
		case 'raw':
			bytes = outputImage.rawsaveBuffer();
			break;
		case 'csv': {
			const target = vips.Target.newToMemory();
			try {
				outputImage.csvsaveTarget(target, { ...common, separator: ',' });
				bytes = target.getBlob();
			} finally {
				deleteHandle(target);
			}
			break;
		}
	}

	const format = normalizeExtension(options.outputFormat);
	const buffer = typedArrayToArrayBuffer(bytes);
	return {
		name: `${base}.${format}`,
		format: options.outputFormat,
		mime: outputMime(options.outputFormat),
		size: buffer.byteLength,
		buffer,
	};
}

function thumbnailPng(image: VipsImage, handles: VipsImage[], size: number): Uint8Array {
	const thumb = image.thumbnailImage(size, {
		height: size,
		size: 'both',
		crop: 'attention',
	});
	handles.push(thumb);
	return thumb.pngsaveBuffer({ compression: 9, keep: 'none' });
}

function makeIco(pngs: Array<{ size: number; bytes: Uint8Array }>): ArrayBuffer {
	const headerSize = 6;
	const entrySize = 16;
	const imageOffset = headerSize + entrySize * pngs.length;
	const totalSize = imageOffset + pngs.reduce((sum, png) => sum + png.bytes.byteLength, 0);
	const ico = new ArrayBuffer(totalSize);
	const view = new DataView(ico);
	const out = new Uint8Array(ico);
	let offset = 0;

	view.setUint16(0, 0, true);
	view.setUint16(2, 1, true);
	view.setUint16(4, pngs.length, true);
	offset = imageOffset;

	pngs.forEach((png, index) => {
		const entry = headerSize + index * entrySize;
		view.setUint8(entry, png.size >= 256 ? 0 : png.size);
		view.setUint8(entry + 1, png.size >= 256 ? 0 : png.size);
		view.setUint8(entry + 2, 0);
		view.setUint8(entry + 3, 0);
		view.setUint16(entry + 4, 1, true);
		view.setUint16(entry + 6, 32, true);
		view.setUint32(entry + 8, png.bytes.byteLength, true);
		view.setUint32(entry + 12, offset, true);
		out.set(png.bytes, offset);
		offset += png.bytes.byteLength;
	});

	return ico;
}

function faviconOutputs(image: VipsImage, handles: VipsImage[], fileName: string): WorkerOutput[] {
	const base = `${baseName(fileName)}-favicon`;
	const icoPngs = FAVICON_SIZES.map((size) => ({ size, bytes: thumbnailPng(image, handles, size) }));
	const outputs: WorkerOutput[] = [
		{
			name: `${base}.ico`,
			format: 'ico',
			mime: 'image/x-icon',
			size: 0,
			buffer: makeIco(icoPngs),
		},
	];
	outputs[0].size = outputs[0].buffer.byteLength;

	for (const size of FAVICON_PNG_SIZES) {
		const bytes = thumbnailPng(image, handles, size);
		const buffer = typedArrayToArrayBuffer(bytes);
		outputs.push({
			name: `${base}-${size}.png`,
			format: 'png',
			mime: 'image/png',
			size: buffer.byteLength,
			buffer,
		});
	}

	return outputs;
}

function previewPng(image: VipsImage, handles: VipsImage[]): ArrayBuffer {
	const width = Math.min(PREVIEW_MAX_SIZE, Math.max(1, image.width));
	const preview = image.thumbnailImage(width, {
		height: PREVIEW_MAX_SIZE,
		size: 'down',
		crop: 'none',
	});
	handles.push(preview);
	return typedArrayToArrayBuffer(preview.pngsaveBuffer({ compression: 6, keep: 'none' }));
}

async function processImage(id: string, fileName: string, mime: string, buffer: ArrayBuffer, options: ImageToolOptions): Promise<void> {
	const handles: VipsImage[] = [];
	try {
		post({ type: 'progress', id, stage: 'loading wasm-vips', percent: 3 });
		const vips = await loadVips();
		post({ type: 'progress', id, stage: 'reading image', percent: 10 });

		const source = loadImage(vips, buffer, fileName, mime);
		handles.push(source);
		source.onProgress = (percent: number) => post({ type: 'progress', id, stage: 'decoding', percent: clamp(percent * 0.25, 10, 35) });
		const input = readMetadata(source);

		post({ type: 'progress', id, stage: 'transforming', percent: 38 });
		const transformed = transformImage(source, handles, options);
		transformed.onProgress = (percent: number) =>
			post({ type: 'progress', id, stage: 'rendering', percent: clamp(40 + percent * 0.45, 40, 85) });

		post({ type: 'progress', id, stage: 'encoding', percent: 86 });
		const outputs = [saveMainOutput(vips, transformed, handles, fileName, options)];
		if (options.buildFavicon) {
			outputs.push(...faviconOutputs(transformed, handles, fileName));
		}
		const preview = previewPng(transformed, handles);
		const output = readMetadata(transformed);

		const transfers = [...outputs.map((item) => item.buffer), preview];
		post(
			{
				type: 'result',
				id,
				input,
				output,
				outputs,
				preview: {
					mime: 'image/png',
					buffer: preview,
				},
				engine: {
					vips: String(vips.version()),
					emscripten: vips.emscriptenVersion(),
				},
			},
			transfers,
		);
	} catch (error) {
		post({
			type: 'error',
			id,
			message: error instanceof Error ? error.message : String(error),
		});
	} finally {
		for (let i = handles.length - 1; i >= 0; i--) {
			deleteHandle(handles[i]);
		}
	}
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
	const message = event.data;
	if (message.type === 'shutdown') {
		vipsPromise?.then((vips) => vips.shutdown()).catch(() => undefined);
		self.close();
		return;
	}

	void processImage(message.id, message.fileName, message.mime, message.buffer, message.options);
});
