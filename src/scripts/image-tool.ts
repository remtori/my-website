import type { ImageMetadata, ImageToolOptions, WorkerOutput, WorkerResponse } from '@/lib/image-tool-types';

type QueueStatus = 'queued' | 'processing' | 'done' | 'error';

type ClientOutput = Omit<WorkerOutput, 'buffer'> & {
	url: string;
};

type ClientResult = {
	input: ImageMetadata;
	output: ImageMetadata;
	outputs: ClientOutput[];
	previewUrl: string;
	engine: {
		vips: string;
		emscripten: string;
	};
};

type QueueEntry = {
	id: string;
	file: File;
	thumbUrl: string;
	status: QueueStatus;
	stage: string;
	progress: number;
	result?: ClientResult;
	error?: string;
};

const statusLabel = {
	queued: 'queued',
	processing: 'converting',
	done: 'done',
	error: 'failed',
} satisfies Record<QueueStatus, string>;

const statusTone = {
	queued: 'text-text-muted',
	processing: 'text-accent',
	done: 'text-success',
	error: 'text-error',
} satisfies Record<QueueStatus, string>;

const formatHints: Record<string, string> = {
	jpeg: 'works everywhere · lossy · no transparency',
	png: 'lossless · keeps transparency · larger files',
	webp: 'small files, good quality · transparency · wide support',
	avif: 'smallest files · slower to encode · modern browsers',
	heic: 'Apple ecosystem format · lossy',
	jxl: 'next-gen, lossless or lossy · limited browser support',
	tiff: 'print and archival workflows',
	gif: '256 colors · legacy animations',
	ppm: 'uncompressed portable pixmap',
	hdr: 'Radiance HDR, high dynamic range',
	uhdr: 'JPEG with an HDR gain map',
	raw: 'headerless raw pixel dump',
	csv: 'pixel values as CSV text',
};

const qualityFormats = new Set(['jpeg', 'webp', 'avif', 'heic', 'jxl', 'tiff', 'gif', 'uhdr']);
const primaryFormats = new Set(['jpeg', 'png', 'webp', 'avif']);

let entries: QueueEntry[] = [];
let worker: Worker | undefined;
let processing = false;
let zipping = false;
let activePreviewCanvas: HTMLCanvasElement | undefined;
let lastPreviewUrl: string | undefined;
let activeResolve: (() => void) | undefined;
let reprocessTimer: ReturnType<typeof setTimeout> | undefined;

function initImageTool(): void {
	const root = document.getElementById('image-tool');
	if (!root || root.dataset.ready === 'true') return;
	root.dataset.ready = 'true';

	const fileInput = byId<HTMLInputElement>('image-file-input');
	const dropZone = byId<HTMLElement>('image-drop-zone');
	const queueList = byId<HTMLElement>('image-queue');
	const processButton = byId<HTMLButtonElement>('image-process');
	const cancelButton = byId<HTMLButtonElement>('image-cancel');
	const clearButton = byId<HTMLButtonElement>('image-clear');
	const downloadAllButton = byId<HTMLButtonElement>('image-download-all');
	const engineStatus = byId<HTMLElement>('image-engine-status');
	const previewImage = byId<HTMLImageElement>('image-preview');
	const previewEmpty = byId<HTMLElement>('image-preview-empty');
	const metadataPanel = byId<HTMLElement>('image-metadata');
	const palettePanel = byId<HTMLElement>('image-palette');
	const pickedColor = byId<HTMLElement>('image-picked-color');
	const resultsSection = byId<HTMLElement>('image-results');
	const isolationWarning = byId<HTMLElement>('image-isolation-warning');

	function render(): void {
		const doneOutputs = entries.reduce((count, entry) => count + (entry.result?.outputs.length ?? 0), 0);

		processButton.disabled = processing || entries.length === 0 || !crossOriginIsolated;
		cancelButton.disabled = !processing;
		clearButton.disabled = processing;
		downloadAllButton.classList.toggle('hidden', doneOutputs === 0);
		downloadAllButton.disabled = zipping;
		downloadAllButton.textContent = zipping ? 'zipping...' : doneOutputs === 1 ? 'download' : 'download all (.zip)';

		if (entries.length === 0) {
			queueList.innerHTML =
				'<li class="border-l-2 border-border py-4 pl-4 font-mono text-xs text-text-muted">// drop images above — conversion starts automatically</li>';
			return;
		}

		queueList.innerHTML = entries.map(renderEntry).join('');
		for (const button of queueList.querySelectorAll<HTMLButtonElement>('[data-preview-entry]')) {
			button.addEventListener('click', () => {
				const entry = entries.find((item) => item.id === button.dataset.previewEntry);
				if (entry?.result) showResult(entry.result);
			});
		}
		for (const button of queueList.querySelectorAll<HTMLButtonElement>('[data-remove-entry]')) {
			button.addEventListener('click', () => removeEntry(button.dataset.removeEntry ?? ''));
		}
		for (const thumb of queueList.querySelectorAll<HTMLImageElement>('img[data-thumb]')) {
			thumb.addEventListener('error', () => thumb.remove());
		}
	}

	function showResult(result: ClientResult): void {
		resultsSection.classList.remove('hidden');
		previewImage.src = result.previewUrl;
		previewImage.classList.remove('hidden');
		previewEmpty.classList.add('hidden');
		metadataPanel.innerHTML = renderMetadata(result);
		pickedColor.textContent = '#------';
		lastPreviewUrl = result.previewUrl;
		void renderPalette(result.previewUrl, readNumber('image-palette-size', 8));
	}

	function resetPreview(): void {
		resultsSection.classList.add('hidden');
		previewImage.removeAttribute('src');
		previewImage.classList.add('hidden');
		previewEmpty.classList.remove('hidden');
		metadataPanel.innerHTML = '<p class="font-mono text-xs text-text-muted">// metadata appears after processing</p>';
		palettePanel.innerHTML = '<p class="font-mono text-xs text-text-muted">// extracting</p>';
		pickedColor.textContent = '#------';
		activePreviewCanvas = undefined;
		lastPreviewUrl = undefined;
	}

	function setEngineStatus(message: string, ok = true): void {
		engineStatus.textContent = message;
		engineStatus.classList.toggle('text-success', ok);
		engineStatus.classList.toggle('text-error', !ok);
	}

	function addFiles(files: Iterable<File>): void {
		const next = Array.from(files).filter((file) => file.size > 0);
		if (next.length === 0) return;
		entries = [
			...entries,
			...next.map((file) => ({
				id: crypto.randomUUID(),
				file,
				thumbUrl: URL.createObjectURL(file),
				status: 'queued' as const,
				stage: 'waiting',
				progress: 0,
			})),
		];
		render();
		void processQueue();
	}

	function removeEntry(id: string): void {
		const entry = entries.find((item) => item.id === id);
		if (!entry || entry.status === 'processing') return;
		revokeEntry(entry);
		entries = entries.filter((item) => item.id !== id);
		if (entries.length === 0) resetPreview();
		render();
	}

	function startWorker(): Worker {
		if (worker) return worker;
		worker = new Worker(new URL('../workers/vips-image.worker.ts', import.meta.url), { type: 'module' });
		worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
			const message = event.data;
			const entry = entries.find((item) => item.id === message.id);
			if (!entry) return;

			if (message.type === 'progress') {
				entry.status = 'processing';
				entry.stage = message.stage;
				entry.progress = message.percent;
				render();
				return;
			}

			if (message.type === 'error') {
				entry.status = 'error';
				entry.error = message.message;
				entry.stage = 'failed';
				entry.progress = 0;
				render();
				return;
			}

			const outputs = message.outputs.map((output) => {
				const blob = new Blob([output.buffer], { type: output.mime });
				return {
					name: output.name,
					format: output.format,
					mime: output.mime,
					size: output.size,
					url: URL.createObjectURL(blob),
				};
			});
			const preview = new Blob([message.preview.buffer], { type: message.preview.mime });

			if (entry.result) revokeResult(entry.result);
			entry.status = 'done';
			entry.stage = 'complete';
			entry.progress = 100;
			entry.result = {
				input: message.input,
				output: message.output,
				outputs,
				previewUrl: URL.createObjectURL(preview),
				engine: message.engine,
			};
			render();
			showResult(entry.result);
			setEngineStatus(`vips ${message.engine.vips} / emscripten ${message.engine.emscripten}`);
		});
		return worker;
	}

	async function processQueue(): Promise<void> {
		if (processing || entries.length === 0) return;
		if (!crossOriginIsolated) {
			setEngineStatus('engine unavailable', false);
			isolationWarning.classList.remove('hidden');
			return;
		}

		processing = true;
		render();
		const imageWorker = startWorker();

		while (worker) {
			const entry = entries.find((item) => item.status === 'queued');
			if (!entry) break;

			entry.status = 'processing';
			entry.stage = 'reading file';
			entry.progress = 1;
			entry.error = undefined;
			render();

			const options = readOptions();
			const buffer = await readFileBuffer(entry.file);
			await new Promise<void>((resolve) => {
				activeResolve = resolve;
				const listener = (event: MessageEvent<WorkerResponse>) => {
					if (event.data.id !== entry.id || (event.data.type !== 'result' && event.data.type !== 'error')) return;
					imageWorker.removeEventListener('message', listener);
					resolve();
				};
				imageWorker.addEventListener('message', listener);
				imageWorker.postMessage(
					{
						type: 'process',
						id: entry.id,
						fileName: entry.file.name,
						mime: entry.file.type,
						buffer,
						options,
					},
					[buffer],
				);
			});
			activeResolve = undefined;
		}

		processing = false;
		render();
	}

	function scheduleReprocess(): void {
		if (!entries.some((entry) => entry.status === 'done' || entry.status === 'error')) return;
		clearTimeout(reprocessTimer);
		reprocessTimer = setTimeout(() => {
			for (const entry of entries) {
				if (entry.status === 'done' || entry.status === 'error') {
					entry.status = 'queued';
					entry.stage = 'settings changed';
					entry.progress = 0;
					entry.error = undefined;
				}
			}
			render();
			void processQueue();
		}, 600);
	}

	function reprocessAll(): void {
		for (const entry of entries) {
			if (entry.status === 'done' || entry.status === 'error') {
				entry.status = 'queued';
				entry.stage = 'waiting';
				entry.progress = 0;
				entry.error = undefined;
			}
		}
		void processQueue();
	}

	function cancelProcessing(): void {
		worker?.postMessage({ type: 'shutdown' });
		worker?.terminate();
		worker = undefined;
		processing = false;
		for (const entry of entries) {
			if (entry.status === 'processing') {
				entry.status = 'queued';
				entry.stage = 'cancelled';
				entry.progress = 0;
			}
		}
		activeResolve?.();
		activeResolve = undefined;
		render();
	}

	function clearQueue(): void {
		for (const entry of entries) revokeEntry(entry);
		entries = [];
		resetPreview();
		render();
	}

	async function downloadAll(): Promise<void> {
		if (zipping) return;
		const outputs = entries.flatMap((entry) => entry.result?.outputs ?? []);
		if (outputs.length === 0) return;

		if (outputs.length === 1) {
			triggerDownload(outputs[0].url, outputs[0].name);
			return;
		}

		zipping = true;
		render();
		try {
			const seen = new Map<string, number>();
			const files: Array<{ name: string; data: Uint8Array<ArrayBuffer> }> = [];
			for (const output of outputs) {
				const data = new Uint8Array(await (await fetch(output.url)).arrayBuffer());
				files.push({ name: dedupeName(output.name, seen), data });
			}
			const url = URL.createObjectURL(buildZip(files));
			triggerDownload(url, `imgconv-${timestamp()}.zip`);
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} finally {
			zipping = false;
			render();
		}
	}

	if (crossOriginIsolated) {
		setEngineStatus('engine ready');
	} else {
		setEngineStatus('engine unavailable', false);
		isolationWarning.classList.remove('hidden');
	}

	fileInput.addEventListener('change', () => {
		if (fileInput.files) addFiles(fileInput.files);
		fileInput.value = '';
	});

	// The whole page accepts drops; the drop zone lights up as the target.
	let dragDepth = 0;
	document.addEventListener('dragenter', (event) => {
		if (!event.dataTransfer?.types.includes('Files')) return;
		dragDepth += 1;
		dropZone.classList.add('border-accent', 'bg-bg-surface');
	});
	document.addEventListener('dragleave', () => {
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dropZone.classList.remove('border-accent', 'bg-bg-surface');
	});
	document.addEventListener('dragover', (event) => {
		event.preventDefault();
	});
	document.addEventListener('drop', (event) => {
		event.preventDefault();
		dragDepth = 0;
		dropZone.classList.remove('border-accent', 'bg-bg-surface');
		if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
	});
	document.addEventListener('paste', (event) => {
		if (event.clipboardData?.files.length) addFiles(event.clipboardData.files);
	});

	processButton.addEventListener('click', reprocessAll);
	cancelButton.addEventListener('click', cancelProcessing);
	clearButton.addEventListener('click', clearQueue);
	downloadAllButton.addEventListener('click', () => void downloadAll());

	previewImage.addEventListener('click', (event) => {
		if (!activePreviewCanvas) return;
		const rect = previewImage.getBoundingClientRect();
		const x = Math.floor(((event.clientX - rect.left) / rect.width) * activePreviewCanvas.width);
		const y = Math.floor(((event.clientY - rect.top) / rect.height) * activePreviewCanvas.height);
		const pixel = activePreviewCanvas.getContext('2d')?.getImageData(x, y, 1, 1).data;
		if (!pixel) return;
		pickedColor.textContent = rgbToHex(pixel[0], pixel[1], pixel[2]);
	});

	const controls = Array.from(document.querySelectorAll('[data-image-control]')) as Array<HTMLInputElement | HTMLSelectElement>;
	for (const control of controls) {
		const onChange = () => {
			syncControls();
			// Palette size only affects the swatch extraction, not the encoded file.
			if (control.id === 'image-palette-size') {
				if (lastPreviewUrl) void renderPalette(lastPreviewUrl, readNumber('image-palette-size', 8));
				return;
			}
			scheduleReprocess();
		};
		control.addEventListener('input', onChange);
		control.addEventListener('change', onChange);
	}

	syncControls();
	render();
}

function byId<T>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing element #${id}`);
	return element as T;
}

function revokeResult(result: ClientResult): void {
	for (const output of result.outputs) URL.revokeObjectURL(output.url);
	URL.revokeObjectURL(result.previewUrl);
}

function revokeEntry(entry: QueueEntry): void {
	URL.revokeObjectURL(entry.thumbUrl);
	if (entry.result) revokeResult(entry.result);
}

function triggerDownload(url: string, name: string): void {
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = name;
	anchor.click();
}

function dedupeName(name: string, seen: Map<string, number>): string {
	const count = seen.get(name) ?? 0;
	seen.set(name, count + 1);
	if (count === 0) return name;
	const dot = name.lastIndexOf('.');
	return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
}

function timestamp(): string {
	const now = new Date();
	const pad = (value: number) => `${value}`.padStart(2, '0');
	return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function readFormat(): ImageToolOptions['outputFormat'] {
	const checked = document.querySelector<HTMLInputElement>('input[name="image-format"]:checked');
	return (checked?.value ?? 'jpeg') as ImageToolOptions['outputFormat'];
}

function readOptions(): ImageToolOptions {
	return {
		outputFormat: readFormat(),
		buildFavicon: readChecked('image-favicon'),
		quality: readNumber('image-quality', 82),
		effort: readNumber('image-effort', 6),
		lossless: readChecked('image-lossless'),
		keepMetadata: readChecked('image-keep-metadata'),
		progressive: readChecked('image-progressive'),
		autorotate: readChecked('image-autorotate'),
		resizeMode: readSelect('image-resize-mode') as ImageToolOptions['resizeMode'],
		width: readNumber('image-width', 0),
		height: readNumber('image-height', 0),
		scale: readNumber('image-scale', 100),
		allowUpscale: readChecked('image-upscale'),
		kernel: readSelect('image-kernel'),
		cropMode: readSelect('image-crop-mode') as ImageToolOptions['cropMode'],
		cropLeft: readNumber('image-crop-left', 0),
		cropTop: readNumber('image-crop-top', 0),
		cropWidth: readNumber('image-crop-width', 0),
		cropHeight: readNumber('image-crop-height', 0),
		interesting: readSelect('image-interesting'),
		trimThreshold: readNumber('image-trim-threshold', 10),
		rotateMode: readSelect('image-rotate-mode') as ImageToolOptions['rotateMode'],
		customAngle: readNumber('image-custom-angle', 0),
		flipHorizontal: readChecked('image-flip-horizontal'),
		flipVertical: readChecked('image-flip-vertical'),
		flatten: readChecked('image-flatten'),
		background: readInput('image-background').value,
		grayscale: readChecked('image-grayscale'),
		invert: readChecked('image-invert'),
		blur: readNumber('image-blur', 0),
		sharpen: readNumber('image-sharpen', 0),
		gamma: readNumber('image-gamma', 1),
		brightness: readNumber('image-brightness', 0),
		contrast: readNumber('image-contrast', 100),
		paletteSize: readNumber('image-palette-size', 8),
	};
}

function readInput(id: string): HTMLInputElement {
	return byId<HTMLInputElement>(id);
}

function readFileBuffer(file: File): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
		reader.onload = () => {
			if (reader.result instanceof ArrayBuffer) {
				resolve(reader.result);
				return;
			}
			reject(new Error('Could not read file as bytes'));
		};
		reader.readAsArrayBuffer(file);
	});
}

function readChecked(id: string): boolean {
	return readInput(id).checked;
}

function readNumber(id: string, fallback = 0): number {
	const value = Number(readInput(id).value);
	return Number.isFinite(value) ? value : fallback;
}

function readSelect(id: string): string {
	return byId<HTMLSelectElement>(id).value;
}

function syncControls(): void {
	setText('image-quality-value', `${readNumber('image-quality', 82)}`);
	setText('image-effort-value', `${readNumber('image-effort', 6)}`);
	setText('image-scale-value', `${readNumber('image-scale', 100)}%`);
	setText('image-trim-threshold-value', `${readNumber('image-trim-threshold', 10)}`);
	setText('image-blur-value', `${readNumber('image-blur', 0)}`);
	setText('image-sharpen-value', `${readNumber('image-sharpen', 0)}`);
	setText('image-gamma-value', readNumber('image-gamma', 1).toFixed(2));
	setText('image-brightness-value', `${readNumber('image-brightness', 0)}`);
	setText('image-contrast-value', `${readNumber('image-contrast', 100)}%`);
	setText('image-palette-size-value', `${readNumber('image-palette-size', 8)}`);

	const format = readFormat();
	setText('image-format-hint', formatHints[format] ?? '');
	togglePanel('image-quality-panel', qualityFormats.has(format));

	const checkedRadio = document.querySelector<HTMLInputElement>('input[name="image-format"]:checked');
	setText('image-more-formats-label', primaryFormats.has(format) ? 'more formats' : `more: ${checkedRadio?.dataset.label ?? format}`);

	const resizeMode = readSelect('image-resize-mode');
	togglePanel('image-dimensions-panel', resizeMode !== 'none' && resizeMode !== 'scale');
	togglePanel('image-scale-panel', resizeMode === 'scale');
	togglePanel('image-manual-crop-panel', readSelect('image-crop-mode') === 'manual');
	togglePanel('image-trim-panel', readSelect('image-crop-mode') === 'trim');
	togglePanel('image-custom-rotate-panel', readSelect('image-rotate-mode') === 'custom');

	syncSummaries(resizeMode);
}

function syncSummaries(resizeMode: string): void {
	let resizeSummary = 'off';
	if (resizeMode === 'scale') resizeSummary = `${readNumber('image-scale', 100)}%`;
	else if (resizeMode !== 'none') resizeSummary = `${resizeMode} ${readNumber('image-width', 0)}×${readNumber('image-height', 0)}`;
	setText('image-resize-summary', resizeSummary);

	const cropRotate: string[] = [];
	const cropMode = readSelect('image-crop-mode');
	if (cropMode !== 'none') cropRotate.push(cropMode === 'manual' ? 'crop' : cropMode);
	const rotateMode = readSelect('image-rotate-mode');
	if (rotateMode === 'd90') cropRotate.push('90°');
	else if (rotateMode === 'd180') cropRotate.push('180°');
	else if (rotateMode === 'd270') cropRotate.push('270°');
	else if (rotateMode === 'custom') cropRotate.push(`${readNumber('image-custom-angle', 0)}°`);
	if (readChecked('image-flip-horizontal')) cropRotate.push('flip-h');
	if (readChecked('image-flip-vertical')) cropRotate.push('flip-v');
	setText('image-croprot-summary', cropRotate.length ? cropRotate.join(' · ') : 'off');

	const color: string[] = [];
	if (readChecked('image-grayscale')) color.push('grayscale');
	if (readChecked('image-invert')) color.push('invert');
	if (readChecked('image-flatten')) color.push('flatten');
	if (readNumber('image-blur', 0) > 0) color.push(`blur ${readNumber('image-blur', 0)}`);
	if (readNumber('image-sharpen', 0) > 0) color.push(`sharpen ${readNumber('image-sharpen', 0)}`);
	if (readNumber('image-gamma', 1) !== 1) color.push(`γ ${readNumber('image-gamma', 1).toFixed(2)}`);
	if (readNumber('image-brightness', 0) !== 0) color.push(`bright ${readNumber('image-brightness', 0)}`);
	if (readNumber('image-contrast', 100) !== 100) color.push(`contrast ${readNumber('image-contrast', 100)}%`);
	setText('image-color-summary', color.length ? color.join(' · ') : 'off');

	const output: string[] = [`effort ${readNumber('image-effort', 6)}`];
	if (readChecked('image-lossless')) output.push('lossless');
	if (readChecked('image-progressive')) output.push('progressive');
	if (readChecked('image-keep-metadata')) output.push('metadata');
	if (readChecked('image-favicon')) output.push('favicon');
	setText('image-output-summary', output.join(' · '));
}

function setText(id: string, text: string): void {
	const element = document.getElementById(id);
	if (element) element.textContent = text;
}

function togglePanel(id: string, visible: boolean): void {
	const element = document.getElementById(id);
	if (element) element.classList.toggle('hidden', !visible);
}

function savingsBadge(entry: QueueEntry): string {
	const primary = entry.result?.outputs[0];
	if (!primary || entry.file.size === 0) return '';
	const delta = (primary.size - entry.file.size) / entry.file.size;
	const percent = Math.round(Math.abs(delta) * 100);
	if (percent === 0) return '<span class="font-mono text-[11px] text-text-muted">±0%</span>';
	return delta < 0
		? `<span class="border border-success/40 bg-success/10 px-1.5 py-0.5 font-mono text-[11px] text-success">-${percent}%</span>`
		: `<span class="border border-error/40 bg-error/10 px-1.5 py-0.5 font-mono text-[11px] text-error">+${percent}%</span>`;
}

function renderEntry(entry: QueueEntry): string {
	const primary = entry.result?.outputs[0];
	const extras = entry.result?.outputs.slice(1) ?? [];

	const downloads = entry.result
		? `<div class="mt-2 flex flex-wrap items-center gap-2">
				<a class="inline-flex items-center gap-1.5 bg-accent px-3 py-1.5 font-mono text-xs font-bold text-bg-base transition hover:bg-accent-light" href="${primary?.url}" download="${escapeHtml(primary?.name ?? '')}">↓ ${escapeHtml(primary?.name ?? '')} · ${formatBytes(primary?.size ?? 0)}</a>
				${extras
					.map(
						(output) =>
							`<a class="border border-border px-2 py-1.5 font-mono text-[11px] text-accent transition hover:border-accent" href="${output.url}" download="${escapeHtml(output.name)}">↓ ${escapeHtml(output.name)} · ${formatBytes(output.size)}</a>`,
					)
					.join('')}
				<button type="button" data-preview-entry="${entry.id}" class="border border-border px-2 py-1.5 font-mono text-[11px] text-text-secondary transition hover:border-accent hover:text-accent">preview</button>
			</div>`
		: '';

	const error = entry.error ? `<p class="mt-2 break-words font-mono text-xs text-error">${escapeHtml(entry.error)}</p>` : '';
	const meter =
		entry.status === 'processing'
			? `<div class="mt-2 h-1.5 bg-bg-muted"><div class="h-full bg-accent transition-all" style="width:${Math.round(entry.progress)}%"></div></div>`
			: '';
	const stage =
		entry.status === 'processing' ? `<p class="mt-1 font-mono text-[11px] text-text-muted">${escapeHtml(entry.stage)}</p>` : '';
	const removeButton =
		entry.status === 'processing'
			? ''
			: `<button type="button" data-remove-entry="${entry.id}" aria-label="Remove ${escapeHtml(entry.file.name)}" class="shrink-0 border border-transparent px-2 py-1 font-mono text-sm text-text-muted transition hover:border-error hover:text-error">✕</button>`;

	return `<li class="flex items-start gap-3 border-l-2 ${entry.status === 'error' ? 'border-error' : 'border-border'} py-4 pl-3 pr-1 transition hover:border-l-accent">
		<div class="relative h-12 w-12 shrink-0 overflow-hidden border border-border bg-bg-muted">
			<span class="grid h-full w-full place-items-center font-mono text-[9px] text-text-muted">img</span>
			<img data-thumb src="${entry.thumbUrl}" alt="" class="absolute inset-0 h-full w-full object-cover" />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span class="min-w-0 max-w-full truncate font-display text-sm font-semibold text-text-primary">${escapeHtml(entry.file.name)}</span>
				<span class="font-mono text-[11px] text-text-muted">${formatBytes(entry.file.size)}${primary ? ` → ${formatBytes(primary.size)}` : ''}</span>
				${savingsBadge(entry)}
				<span class="font-mono text-[11px] uppercase ${statusTone[entry.status]}${entry.status === 'processing' ? ' animate-pulse' : ''}">${statusLabel[entry.status]}</span>
			</div>
			${stage}
			${meter}
			${downloads}
			${error}
		</div>
		${removeButton}
	</li>`;
}

function renderMetadata(result: ClientResult): string {
	const rows = result.input.fields.length
		? result.input.fields
				.map(
					(field) =>
						`<div class="grid gap-2 border-b border-border py-2 sm:grid-cols-[180px_minmax(0,1fr)]"><dt class="truncate font-mono text-[11px] text-text-muted">${escapeHtml(field.name)}</dt><dd class="break-words font-mono text-[11px] text-text-secondary">${escapeHtml(field.value)}</dd></div>`,
				)
				.join('')
		: '<p class="font-mono text-xs text-text-muted">// no metadata fields reported</p>';

	return `<div class="space-y-4">
		<div class="grid gap-3 font-mono text-xs text-text-secondary sm:grid-cols-2">
			<div class="border border-border px-3 py-2"><span class="text-text-muted">input</span> ${result.input.width}x${result.input.height} ${escapeHtml(result.input.interpretation)}</div>
			<div class="border border-border px-3 py-2"><span class="text-text-muted">output</span> ${result.output.width}x${result.output.height} ${escapeHtml(result.output.interpretation)}</div>
		</div>
		<dl>${rows}</dl>
	</div>`;
}

async function renderPalette(url: string, count: number): Promise<void> {
	const panel = byId<HTMLElement>('image-palette');
	const image = await loadImage(url);
	const canvas = document.createElement('canvas');
	const size = 48;
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) return;
	context.drawImage(image, 0, 0, size, size);
	activePreviewCanvas = document.createElement('canvas');
	activePreviewCanvas.width = image.naturalWidth;
	activePreviewCanvas.height = image.naturalHeight;
	activePreviewCanvas.getContext('2d', { willReadFrequently: true })?.drawImage(image, 0, 0);

	const data = context.getImageData(0, 0, size, size).data;
	const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 24) continue;
		const key = `${data[i] >> 4}-${data[i + 1] >> 4}-${data[i + 2] >> 4}`;
		const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
		bucket.r += data[i];
		bucket.g += data[i + 1];
		bucket.b += data[i + 2];
		bucket.n += 1;
		buckets.set(key, bucket);
	}

	const colors = Array.from(buckets.values())
		.sort((a, b) => b.n - a.n)
		.slice(0, Math.max(1, count))
		.map((bucket) => rgbToHex(Math.round(bucket.r / bucket.n), Math.round(bucket.g / bucket.n), Math.round(bucket.b / bucket.n)));

	panel.innerHTML = colors
		.map(
			(color) =>
				`<button type="button" class="group flex items-center gap-2 border border-border px-2 py-1 font-mono text-[11px] text-text-secondary transition hover:border-accent" data-color="${color}"><span class="h-5 w-5 border border-border-strong" style="background:${color}"></span>${color}</button>`,
		)
		.join('');

	for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-color]')) {
		button.addEventListener('click', async () => {
			await navigator.clipboard?.writeText(button.dataset.color ?? '');
			byId<HTMLElement>('image-picked-color').textContent = button.dataset.color ?? '#------';
		});
	}
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Preview decode failed'));
		image.src = url;
	});
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => {
		switch (char) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#039;';
		}
	});
}

// Minimal store-only (no compression) ZIP writer for "download all".
const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[i] = c >>> 0;
	}
	return table;
})();

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: Array<{ name: string; data: Uint8Array<ArrayBuffer> }>): Blob {
	const encoder = new TextEncoder();
	const now = new Date();
	const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
	const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

	const localParts: Array<Uint8Array<ArrayBuffer>> = [];
	const centralParts: Array<Uint8Array<ArrayBuffer>> = [];
	let offset = 0;

	for (const file of files) {
		const nameBytes = encoder.encode(file.name);
		const crc = crc32(file.data);

		const local = new Uint8Array(30 + nameBytes.length);
		const localView = new DataView(local.buffer);
		localView.setUint32(0, 0x04034b50, true);
		localView.setUint16(4, 20, true);
		localView.setUint16(6, 0x0800, true); // UTF-8 names
		localView.setUint16(8, 0, true); // store
		localView.setUint16(10, dosTime, true);
		localView.setUint16(12, dosDate, true);
		localView.setUint32(14, crc, true);
		localView.setUint32(18, file.data.length, true);
		localView.setUint32(22, file.data.length, true);
		localView.setUint16(26, nameBytes.length, true);
		local.set(nameBytes, 30);
		localParts.push(local, file.data);

		const central = new Uint8Array(46 + nameBytes.length);
		const centralView = new DataView(central.buffer);
		centralView.setUint32(0, 0x02014b50, true);
		centralView.setUint16(4, 20, true);
		centralView.setUint16(6, 20, true);
		centralView.setUint16(8, 0x0800, true);
		centralView.setUint16(10, 0, true);
		centralView.setUint16(12, dosTime, true);
		centralView.setUint16(14, dosDate, true);
		centralView.setUint32(16, crc, true);
		centralView.setUint32(20, file.data.length, true);
		centralView.setUint32(24, file.data.length, true);
		centralView.setUint16(28, nameBytes.length, true);
		centralView.setUint32(42, offset, true);
		central.set(nameBytes, 46);
		centralParts.push(central);

		offset += local.length + file.data.length;
	}

	const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
	const eocd = new Uint8Array(22);
	const eocdView = new DataView(eocd.buffer);
	eocdView.setUint32(0, 0x06054b50, true);
	eocdView.setUint16(8, files.length, true);
	eocdView.setUint16(10, files.length, true);
	eocdView.setUint32(12, centralSize, true);
	eocdView.setUint32(16, offset, true);

	return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

document.addEventListener('astro:page-load', initImageTool);
initImageTool();
