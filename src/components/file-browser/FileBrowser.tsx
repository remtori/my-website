import { createEffect, createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';

import { fsApi } from './api';
import { filesFromDataTransfer } from './drop';
import {
	basename,
	dirname,
	formatBytes,
	formatDate,
	isImageKey,
	isTextKey,
	joinPrefix,
	parentPrefix,
	pathCrumbs,
	relativePathOf,
	unique,
} from './format';
import type { Row, S3ObjectInfo, UploadItem } from './types';
import { abortAllUploads, uploadFile } from './upload';

type PromptState = {
	title: string;
	label: string;
	value: string;
	resolve: (value: string | null) => void;
};

function writeUrl(bucket: string, prefix: string, replace: boolean) {
	const url = new URL(window.location.href);
	url.searchParams.set('bucket', bucket);
	if (prefix) url.searchParams.set('prefix', prefix);
	else url.searchParams.delete('prefix');
	history[replace ? 'replaceState' : 'pushState']({ bucket, prefix }, '', url);
}

export default function FileBrowser(props: { defaultBucket: string }) {
	const initial = (() => {
		const sp = new URLSearchParams(window.location.search);
		return { bucket: sp.get('bucket') || props.defaultBucket, prefix: sp.get('prefix') || '' };
	})();

	const [bucket, setBucket] = createSignal(initial.bucket);
	const [prefix, setPrefix] = createSignal(initial.prefix);
	const [buckets, setBuckets] = createSignal<string[]>([]);
	const [fallback, setFallback] = createSignal(false);
	const [folders, setFolders] = createSignal<string[]>([]);
	const [objects, setObjects] = createSignal<S3ObjectInfo[]>([]);
	const [nextToken, setNextToken] = createSignal<string | undefined>();
	const [loading, setLoading] = createSignal(true);
	const [loadingMore, setLoadingMore] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [selected, setSelected] = createSignal<string[]>([]);
	const [lastClicked, setLastClicked] = createSignal<string | null>(null);
	const [uploads, setUploads] = createSignal<UploadItem[]>([]);
	const [dragOver, setDragOver] = createSignal(false);
	const [busy, setBusy] = createSignal<string | null>(null);
	const [prompt, setPrompt] = createSignal<PromptState | null>(null);

	let fileInput: HTMLInputElement | undefined;
	let folderInput: HTMLInputElement | undefined;
	let promptInput: HTMLInputElement | undefined;
	let bucketSelect: HTMLSelectElement | undefined;
	let listEl: HTMLDivElement | undefined;
	let loadMoreLock = false;
	let applyingBuckets = false;

	const bucketOptions = createMemo(() => {
		const current = bucket();
		const list = buckets();
		if (!current) return list;
		if (list.includes(current)) return list;
		return [current, ...list];
	});

	const rows = createMemo<Row[]>(() => {
		const list: Row[] = [];
		if (prefix() && !loading()) {
			list.push({ id: '..', kind: 'parent', name: '..' });
		}
		const folderRows = folders()
			.slice()
			.sort((a, b) => a.localeCompare(b))
			.map((id) => ({ id, kind: 'prefix' as const, name: basename(id) || id }));
		const objectRows = objects()
			.slice()
			.sort((a, b) => a.key.localeCompare(b.key))
			.map((obj) => ({
				id: obj.key,
				kind: 'object' as const,
				name: basename(obj.key) || obj.key,
				size: obj.size,
				lastModified: obj.lastModified,
			}));
		return [...list, ...folderRows, ...objectRows];
	});

	const selectableIds = createMemo(() =>
		rows()
			.filter((r) => r.kind !== 'parent')
			.map((r) => r.id),
	);

	const single = createMemo(() => {
		const sel = selected();
		if (sel.length !== 1) return undefined;
		const id = sel[0];
		if (id.endsWith('/')) return { kind: 'folder' as const, id };
		const obj = objects().find((o) => o.key === id);
		return { kind: 'file' as const, id, obj };
	});
	const fileSel = createMemo(() => {
		const s = single();
		return s?.kind === 'file' ? s : undefined;
	});
	const folderSel = createMemo(() => {
		const s = single();
		return s?.kind === 'folder' ? s : undefined;
	});

	const [textPreview] = createResource(
		() => {
			const s = single();
			if (!s || s.kind !== 'file' || !isTextKey(s.id)) return undefined;
			return { bucket: bucket(), key: s.id };
		},
		async (src) => {
			const res = await fetch(fsApi.objectUrl(src.bucket, src.key), { headers: { Range: 'bytes=0-262143' } });
			if (!res.ok && res.status !== 206) throw new Error('Preview failed');
			const bytes = new Uint8Array(await res.arrayBuffer());
			if (bytes.subarray(0, 1024).includes(0)) return { binary: true as const, text: '', truncated: false };
			return {
				binary: false as const,
				text: new TextDecoder().decode(bytes),
				truncated: res.status === 206 || bytes.length >= 262144,
			};
		},
	);

	function go(nextBucket: string, nextPrefix: string, replace = false) {
		if (nextBucket === bucket() && nextPrefix === prefix() && !replace) return;
		setSelected([]);
		setLastClicked(null);
		setBucket(nextBucket);
		setPrefix(nextPrefix);
		writeUrl(nextBucket, nextPrefix, replace);
	}

	async function loadPage() {
		const b = bucket();
		const p = prefix();
		setLoading(true);
		setLoadingMore(false);
		loadMoreLock = false;
		setError(null);
		setFolders([]);
		setObjects([]);
		setNextToken(undefined);
		try {
			const page = await fsApi.list(b, p);
			if (bucket() !== b || prefix() !== p) return;
			setFolders(page.prefixes);
			setObjects(page.objects);
			setNextToken(page.nextToken);
		} catch (err) {
			if (bucket() !== b || prefix() !== p) return;
			setError(err instanceof Error ? err.message : 'List failed');
		} finally {
			if (bucket() === b && prefix() === p) setLoading(false);
			queueMicrotask(() => onListScroll());
		}
	}

	createEffect(() => {
		bucket();
		prefix();
		void loadPage();
	});

	createEffect(() => {
		const current = bucket();
		bucketOptions();
		if (bucketSelect && current) bucketSelect.value = current;
	});

	onMount(() => {
		writeUrl(bucket(), prefix(), true);
		void fsApi.buckets().then((data) => {
			applyingBuckets = true;
			setBuckets(data.buckets);
			setFallback(data.fallback);
			requestAnimationFrame(() => {
				if (bucketSelect && bucket()) bucketSelect.value = bucket();
				applyingBuckets = false;
			});
		});
		const onPop = () => {
			const sp = new URLSearchParams(window.location.search);
			setSelected([]);
			setBucket(sp.get('bucket') || props.defaultBucket);
			setPrefix(sp.get('prefix') || '');
		};
		const onKey = (event: KeyboardEvent) => {
			const tag = (event.target as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;
			if (event.key === 'Escape') {
				setSelected([]);
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
				event.preventDefault();
				setSelected(selectableIds());
			}
		};
		window.addEventListener('popstate', onPop);
		window.addEventListener('keydown', onKey);
		onCleanup(() => {
			window.removeEventListener('popstate', onPop);
			window.removeEventListener('keydown', onKey);
			abortAllUploads();
		});
	});

	async function loadMore() {
		const token = nextToken();
		if (!token || loadMoreLock || loading()) return;
		const b = bucket();
		const p = prefix();
		loadMoreLock = true;
		setLoadingMore(true);
		try {
			const page = await fsApi.list(b, p, token);
			if (bucket() !== b || prefix() !== p) return;
			setFolders((f) => [...f, ...page.prefixes]);
			setObjects((o) => [...o, ...page.objects]);
			setNextToken(page.nextToken);
		} catch (err) {
			if (bucket() !== b || prefix() !== p) return;
			setError(err instanceof Error ? err.message : 'Load more failed');
		} finally {
			loadMoreLock = false;
			if (bucket() === b && prefix() === p) setLoadingMore(false);
			queueMicrotask(() => onListScroll());
		}
	}

	function onListScroll() {
		const el = listEl;
		if (!el || !nextToken() || loading() || loadingMore()) return;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
			void loadMore();
		}
	}

	function onRowClick(event: MouseEvent, id: string) {
		const ids = selectableIds();
		if (event.shiftKey && lastClicked()) {
			const a = ids.indexOf(lastClicked() ?? '');
			const b = ids.indexOf(id);
			if (a >= 0 && b >= 0) {
				const [lo, hi] = a < b ? [a, b] : [b, a];
				setSelected(ids.slice(lo, hi + 1));
				return;
			}
		}
		if (event.metaKey || event.ctrlKey) {
			setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
			setLastClicked(id);
			return;
		}
		setSelected([id]);
		setLastClicked(id);
	}

	async function downloadSelection(keys: string[], prefixes: string[]) {
		if (keys.length === 1 && prefixes.length === 0) {
			const key = keys[0];
			const signed = await fsApi.presign(bucket(), 'GET', [{ key, filename: basename(key) }]);
			const a = document.createElement('a');
			a.href = signed[0].url;
			a.rel = 'noopener';
			a.target = '_blank';
			document.body.appendChild(a);
			a.click();
			a.remove();
			return;
		}
		fsApi.downloadZip(bucket(), keys, prefixes);
	}

	function downloadCurrent() {
		const sel = selected();
		if (sel.length === 0) return;
		void downloadSelection(
			sel.filter((id) => !id.endsWith('/')),
			sel.filter((id) => id.endsWith('/')),
		);
	}

	function ask(title: string, label: string, value: string): Promise<string | null> {
		return new Promise((resolve) => {
			setPrompt({ title, label, value, resolve });
			queueMicrotask(() => promptInput?.focus());
		});
	}

	async function withBusy(label: string, fn: () => Promise<void>) {
		setBusy(label);
		setError(null);
		try {
			await fn();
			await loadPage();
		} catch (err) {
			setError(err instanceof Error ? err.message : label);
		} finally {
			setBusy(null);
		}
	}

	async function expandSelectedKeys(): Promise<string[]> {
		const sel = selected();
		const keys: string[] = sel.filter((id) => !id.endsWith('/'));
		for (const folder of sel.filter((id) => id.endsWith('/'))) {
			keys.push(...(await fsApi.listAllKeys(bucket(), folder)));
		}
		return unique(keys);
	}

	async function onDelete() {
		const sel = selected();
		if (sel.length === 0) return;
		const foldersN = sel.filter((id) => id.endsWith('/')).length;
		const msg =
			foldersN > 0
				? `Delete ${sel.length} item(s), including ${foldersN} folder(s) and everything under them?`
				: `Delete ${sel.length} object(s)? This cannot be undone.`;
		if (!window.confirm(msg)) return;
		await withBusy('Deleting…', async () => {
			const keys = await expandSelectedKeys();
			if (keys.length === 0) {
				// empty folder marker only
				await fsApi.deleteKeys(
					bucket(),
					sel.filter((id) => id.endsWith('/')),
				);
				return;
			}
			await fsApi.deleteKeys(bucket(), keys);
			setSelected([]);
		});
	}

	async function onMkdir() {
		const name = await ask('New folder', 'Folder name', '');
		if (!name) return;
		const safe = name.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
		if (!safe || safe.includes('/') || safe === '.' || safe === '..') {
			setError('Folder name cannot contain slashes');
			return;
		}
		await withBusy('Creating folder…', () => fsApi.mkdir(bucket(), `${prefix()}${safe}/`));
	}

	async function onRename() {
		const sel = selected();
		if (sel.length !== 1) return;
		const id = sel[0];
		const current = basename(id);
		const next = await ask('Rename', 'New name', current);
		if (!next || next === current) return;
		if (next.includes('/') || next === '.' || next === '..') {
			setError('Name cannot contain slashes');
			return;
		}
		await withBusy('Renaming…', async () => {
			const parent = dirname(id);
			if (id.endsWith('/')) {
				const destPrefix = `${parent}${next}/`;
				if (destPrefix.startsWith(id)) throw new Error('Cannot rename a folder into itself');
				const keys = await fsApi.listAllKeys(bucket(), id);
				const items = keys.map((key) => ({ from: key, to: destPrefix + key.slice(id.length) }));
				if (items.length === 0) {
					await fsApi.mkdir(bucket(), destPrefix);
					await fsApi.deleteKeys(bucket(), [id]);
				} else {
					await fsApi.move(bucket(), items);
				}
				setSelected([destPrefix]);
			} else {
				const dest = `${parent}${next}`;
				await fsApi.move(bucket(), [{ from: id, to: dest }]);
				setSelected([dest]);
			}
		});
	}

	async function onMove() {
		const sel = selected();
		if (sel.length === 0) return;
		const destRaw = await ask('Move', 'Destination prefix', prefix());
		if (destRaw === null) return;
		const destPrefix = destRaw && !destRaw.endsWith('/') ? `${destRaw}/` : destRaw;
		if (destPrefix.startsWith('/')) {
			setError('Destination cannot start with /');
			return;
		}
		await withBusy('Moving…', async () => {
			const items: { from: string; to: string }[] = [];
			for (const id of sel) {
				if (id.endsWith('/')) {
					if (destPrefix.startsWith(id)) throw new Error(`Cannot move ${id} into itself`);
					const keys = await fsApi.listAllKeys(bucket(), id);
					const name = basename(id);
					const destFolder = `${destPrefix}${name}/`;
					if (keys.length === 0) {
						await fsApi.mkdir(bucket(), destFolder);
						await fsApi.deleteKeys(bucket(), [id]);
					} else {
						items.push(...keys.map((key) => ({ from: key, to: destFolder + key.slice(id.length) })));
					}
				} else {
					items.push({ from: id, to: `${destPrefix}${basename(id)}` });
				}
			}
			const destKeys = items.map((i) => i.to);
			const existing = destKeys.length ? await fsApi.exists(bucket(), destKeys) : [];
			if (existing.length > 0 && !window.confirm(`Overwrite ${existing.length} existing file(s) at the destination?`)) {
				return;
			}
			if (items.length) await fsApi.move(bucket(), items);
			setSelected([]);
		});
	}

	async function startUploads(files: File[]) {
		if (files.length === 0) return;
		let items: UploadItem[];
		try {
			items = files.map((file) => ({
				id: crypto.randomUUID(),
				file,
				key: joinPrefix(prefix(), relativePathOf(file)),
				status: 'pending' as const,
				progress: 0,
			}));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Invalid path');
			return;
		}
		try {
			const existing = await fsApi.exists(
				bucket(),
				items.map((i) => i.key),
			);
			if (existing.length > 0 && !window.confirm(`Overwrite ${existing.length} existing file(s)?`)) return;
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not check existing files');
			return;
		}
		setUploads((cur) => [...cur, ...items]);
		void runUploads(items);
	}

	async function runUploads(items: UploadItem[]) {
		let i = 0;
		const workers = Array.from({ length: Math.min(4, items.length) }, async () => {
			while (i < items.length) {
				const item = items[i];
				i += 1;
				await uploadOne(item);
			}
		});
		await Promise.all(workers);
		await loadPage();
	}

	function patchUpload(id: string, patch: Partial<UploadItem>) {
		setUploads((cur) => cur.map((u) => (u.id === id ? { ...u, ...patch } : u)));
	}

	async function uploadOne(item: UploadItem) {
		patchUpload(item.id, { status: 'uploading', progress: 0, error: undefined });
		try {
			await uploadFile({
				bucket: bucket(),
				key: item.key,
				file: item.file,
				onProgress: (ratio) => patchUpload(item.id, { progress: ratio }),
			});
			patchUpload(item.id, { status: 'done', progress: 1 });
		} catch (err) {
			patchUpload(item.id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
		}
	}

	async function retryFailed() {
		const failed = uploads().filter((u) => u.status === 'error');
		if (failed.length === 0) return;
		await runUploads(failed);
	}

	async function onDrop(event: DragEvent) {
		event.preventDefault();
		setDragOver(false);
		const dt = event.dataTransfer;
		if (!dt) return;
		const files = await filesFromDataTransfer(dt);
		await startUploads(files);
	}

	const canAct = () => selected().length > 0 && !busy();
	const canRename = () => selected().length === 1 && !busy();
	const editorHref = () => {
		const s = single();
		if (!s || s.kind !== 'file') return null;
		if (bucket() !== props.defaultBucket || !s.id.startsWith('mdx/') || !s.id.endsWith('.mdx')) return null;
		return `/admin/edit?key=${encodeURIComponent(s.id)}`;
	};

	const btn = 'btn btn-sm';

	return (
		<div class="flex h-[calc(100dvh-11rem)] min-h-[34rem] flex-col border border-border bg-bg-muted">
			{/* Location: bucket + path */}
			<div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-bg-surface/40 px-4 py-2.5">
				<select
					ref={bucketSelect}
					class="max-w-[13rem] shrink-0 border border-border bg-bg-muted px-2.5 py-1.5 font-mono text-xs text-text-primary outline-none transition focus:border-accent"
					value={bucket()}
					title={fallback() ? 'Key cannot list buckets; showing configured default' : undefined}
					onChange={(e) => {
						const next = e.currentTarget.value;
						if (applyingBuckets || !next || next === bucket()) return;
						go(next, '');
					}}
				>
					<For each={bucketOptions()}>{(name) => <option value={name}>{name}</option>}</For>
				</select>

				<nav class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1 font-mono text-xs">
					<button
						type="button"
						class="cursor-pointer px-1 text-text-muted transition hover:text-accent"
						onClick={() => go(bucket(), '')}
					>
						root
					</button>
					<For each={pathCrumbs(prefix())}>
						{(c, i) => (
							<>
								<span class="text-border-strong">/</span>
								<button
									type="button"
									class="cursor-pointer px-1 text-accent transition hover:text-accent-light"
									classList={{ 'text-text-primary': i() === pathCrumbs(prefix()).length - 1 }}
									onClick={() => go(bucket(), c.prefix)}
								>
									{c.label}
								</button>
							</>
						)}
					</For>
					<Show when={loading()}>
						<span class="ml-2 text-text-muted">loading…</span>
					</Show>
				</nav>

				<span class="eyebrow shrink-0">{rows().filter((r) => r.kind !== 'parent').length} items</span>
			</div>

			{/* Actions */}
			<div class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
				<button type="button" class={`${btn} btn-primary`} disabled={!!busy()} onClick={() => fileInput?.click()}>
					Upload
				</button>
				<button type="button" class={btn} disabled={!!busy()} onClick={() => folderInput?.click()}>
					Upload folder
				</button>
				<button type="button" class={btn} disabled={!!busy()} onClick={() => void onMkdir()}>
					New folder
				</button>

				<span class="mx-1 h-5 w-px bg-border" />

				<button type="button" class={btn} disabled={!canAct()} onClick={downloadCurrent}>
					Download
				</button>
				<button type="button" class={btn} disabled={!canRename()} onClick={() => void onRename()}>
					Rename
				</button>
				<button type="button" class={btn} disabled={!canAct()} onClick={() => void onMove()}>
					Move
				</button>
				<button type="button" class={`${btn} btn-danger`} disabled={!canAct()} onClick={() => void onDelete()}>
					Delete
				</button>

				<Show when={selected().length > 0}>
					<span class="eyebrow eyebrow-accent ml-auto">{selected().length} selected</span>
				</Show>

				<input
					ref={fileInput}
					type="file"
					multiple
					class="hidden"
					onChange={(e) => {
						const list = e.currentTarget.files;
						if (list) void startUploads([...list]);
						e.currentTarget.value = '';
					}}
				/>
				<input
					ref={folderInput}
					type="file"
					multiple
					class="hidden"
					{...({ webkitdirectory: true } as Record<string, unknown>)}
					onChange={(e) => {
						const list = (e.currentTarget as HTMLInputElement).files;
						if (list) void startUploads([...list]);
						(e.currentTarget as HTMLInputElement).value = '';
					}}
				/>
			</div>

			<Show when={error()}>
				<p class="note note-bad rounded-none border-b border-border px-4 py-2.5 text-sm">{error()}</p>
			</Show>
			<Show when={busy()}>
				<p class="note note-busy rounded-none border-b border-border px-4 py-2.5 text-sm">{busy()}</p>
			</Show>

			{/* biome-ignore lint/a11y/noStaticElementInteractions: native file drop target */}
			<div
				class="relative flex min-h-0 flex-1"
				onDragEnter={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={(e) => {
					if (e.currentTarget.contains(e.relatedTarget as Node)) return;
					setDragOver(false);
				}}
				onDrop={(e) => void onDrop(e)}
			>
				<div class="min-w-0 flex-1 overflow-auto" ref={listEl} onScroll={onListScroll}>
					<div class="sticky top-0 z-10 grid grid-cols-[2.25rem_minmax(0,1fr)_6rem_10rem] items-center gap-2 border-b border-border bg-bg-muted px-4 py-2">
						<label class="flex cursor-pointer items-center justify-center">
							<input
								type="checkbox"
								class="cursor-pointer"
								checked={selectableIds().length > 0 && selected().length === selectableIds().length}
								onChange={(e) => setSelected(e.currentTarget.checked ? selectableIds() : [])}
							/>
						</label>
						<span class="eyebrow">Name</span>
						<span class="eyebrow text-right">Size</span>
						<span class="eyebrow text-right">Modified</span>
					</div>

					<Show when={loading()}>
						<p class="px-4 py-10 text-center text-text-muted">Listing objects…</p>
					</Show>
					<Show when={!loading() && rows().length === 0}>
						<p class="px-4 py-10 text-center text-text-muted">This folder is empty. Drop files here to upload.</p>
					</Show>

					<ul>
						<For each={rows()}>
							{(row) => {
								const active = () => row.kind !== 'parent' && selected().includes(row.id);
								return (
									<li
										class="grid grid-cols-[2.25rem_minmax(0,1fr)_6rem_10rem] items-center gap-2 border-b border-border px-4 py-2 transition hover:bg-bg-surface"
										classList={{
											'bg-accent/10': active(),
											'shadow-[inset_2px_0_0_0_#2547cc]': active(),
										}}
									>
										<span class="flex justify-center">
											<Show when={row.kind !== 'parent'}>
												<input
													type="checkbox"
													class="cursor-pointer"
													checked={active()}
													onChange={(e) => {
														const on = e.currentTarget.checked;
														setSelected((cur) =>
															on ? unique([...cur, row.id]) : cur.filter((x) => x !== row.id),
														);
														setLastClicked(row.id);
													}}
												/>
											</Show>
										</span>
										<button
											type="button"
											class="col-span-3 grid cursor-pointer grid-cols-[minmax(0,1fr)_6rem_10rem] items-center gap-2 text-left"
											onClick={(e) => {
												if (row.kind === 'parent') {
													go(bucket(), parentPrefix(prefix()));
													return;
												}
												if (row.kind === 'prefix') {
													go(bucket(), row.id);
													return;
												}
												onRowClick(e, row.id);
											}}
											onDblClick={() => {
												if (row.kind === 'object') void downloadSelection([row.id], []);
											}}
										>
											<span class="flex min-w-0 items-center gap-2.5 font-mono text-sm">
												<Show
													when={row.kind === 'object'}
													fallback={
														<svg
															class="h-4 w-4 shrink-0 text-accent"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="1.75"
															aria-hidden="true"
														>
															<path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
														</svg>
													}
												>
													<svg
														class="h-4 w-4 shrink-0 text-text-muted"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="1.75"
														aria-hidden="true"
													>
														<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
														<path d="M14 3v4h4" />
													</svg>
												</Show>
												<span
													class="truncate"
													classList={{
														'text-accent': row.kind !== 'object',
														'text-text-primary': row.kind === 'object',
													}}
												>
													{row.name}
												</span>
											</span>
											<span class="text-right font-mono text-[11px] tabular-nums text-text-muted">
												{row.kind === 'object' ? formatBytes(row.size ?? 0) : '—'}
											</span>
											<span class="text-right font-mono text-[11px] tabular-nums text-text-muted">
												{row.lastModified ? formatDate(row.lastModified) : '—'}
											</span>
										</button>
									</li>
								);
							}}
						</For>
					</ul>

					<Show when={loadingMore()}>
						<p class="px-4 py-4 text-center text-sm text-text-muted">Loading more…</p>
					</Show>
				</div>

				{/* Preview */}
				<aside class="hidden w-80 shrink-0 overflow-auto border-l border-border bg-bg-base lg:block">
					<div class="border-b border-border px-4 py-2">
						<span class="eyebrow">Preview</span>
					</div>
					<div class="space-y-4 px-4 py-4">
						<Show when={selected().length === 0}>
							<p class="text-sm leading-relaxed text-text-muted">Check a file to preview it. Click a folder to open it.</p>
						</Show>

						<Show when={selected().length > 1}>
							<p class="u-wide text-base text-text-primary">{selected().length} selected</p>
							<p class="text-sm text-text-muted">Download, move, or delete from the toolbar.</p>
						</Show>

						<Show when={folderSel()}>
							{(folder) => (
								<>
									<p class="break-all font-mono text-sm text-accent">{basename(folder().id)}/</p>
									<span class="eyebrow">Folder prefix</span>
								</>
							)}
						</Show>

						<Show when={fileSel()}>
							{(file) => (
								<>
									<p class="break-all font-mono text-sm text-text-primary">{file().id}</p>

									<dl class="space-y-2 border-y border-border py-3 font-mono text-[11px]">
										<div class="flex justify-between gap-3">
											<dt class="text-text-muted">Size</dt>
											<dd class="tabular-nums text-text-secondary">{formatBytes(file().obj?.size ?? 0)}</dd>
										</div>
										<div class="flex justify-between gap-3">
											<dt class="text-text-muted">Modified</dt>
											<dd class="tabular-nums text-text-secondary">
												{file().obj?.lastModified ? formatDate(file().obj?.lastModified ?? '') : '—'}
											</dd>
										</div>
									</dl>

									<Show when={editorHref()}>
										{(href) => (
											<a href={href()} class="link inline-block font-mono text-xs">
												Open in editor &rarr;
											</a>
										)}
									</Show>

									<Show when={isImageKey(file().id)}>
										<img
											src={fsApi.objectUrl(bucket(), file().id)}
											alt={basename(file().id)}
											class="max-h-64 w-full border border-border bg-bg-muted object-contain"
										/>
									</Show>

									<Show when={isTextKey(file().id)}>
										<Show when={textPreview.loading}>
											<p class="text-sm text-text-muted">Reading…</p>
										</Show>
										<Show when={textPreview.error}>
											<p class="text-sm text-error">Could not load preview.</p>
										</Show>
										<Show when={textPreview()?.binary}>
											<p class="text-sm text-text-muted">Binary file — no text preview.</p>
										</Show>
										<Show when={textPreview() && !textPreview()?.binary}>
											<pre class="max-h-80 overflow-auto whitespace-pre-wrap break-all border border-border bg-bg-muted p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
												{textPreview()?.text}
											</pre>
											<Show when={textPreview()?.truncated}>
												<p class="text-[11px] text-text-muted">Truncated to 256 KB.</p>
											</Show>
										</Show>
									</Show>
								</>
							)}
						</Show>
					</div>
				</aside>

				<Show when={dragOver()}>
					<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-accent bg-bg-base/90">
						<div class="text-center">
							<p class="u-wide text-lg text-accent">Drop to upload</p>
							<p class="mt-2 font-mono text-xs text-text-muted">{prefix() ? `into ${prefix()}` : 'into the bucket root'}</p>
						</div>
					</div>
				</Show>
			</div>

			{/* Uploads */}
			<Show when={uploads().length > 0}>
				<div class="max-h-40 overflow-auto border-t border-border bg-bg-base px-4 py-3">
					<div class="mb-2.5 flex items-center justify-between gap-3">
						<span class="eyebrow">
							Uploads {uploads().filter((u) => u.status === 'done').length}/{uploads().length}
						</span>
						<div class="flex gap-2">
							<Show when={uploads().some((u) => u.status === 'error')}>
								<button type="button" class={btn} onClick={() => void retryFailed()}>
									Retry failed
								</button>
							</Show>
							<button
								type="button"
								class={btn}
								onClick={() => setUploads((u) => u.filter((x) => x.status === 'uploading' || x.status === 'pending'))}
							>
								Clear
							</button>
						</div>
					</div>
					<ul class="space-y-2">
						<For each={uploads()}>
							{(u) => (
								<li class="font-mono text-[11px]">
									<div class="flex items-center justify-between gap-3">
										<span class="truncate text-text-secondary">{u.key}</span>
										<span
											class="shrink-0 tabular-nums"
											classList={{
												'text-success': u.status === 'done',
												'text-error': u.status === 'error',
												'text-accent': u.status === 'uploading',
												'text-text-muted': u.status === 'pending',
											}}
										>
											{u.status === 'uploading' ? `${Math.round(u.progress * 100)}%` : u.status}
										</span>
									</div>
									<div class="mt-1 h-0.5 bg-bg-subtle">
										<div
											class="h-full bg-accent transition-all"
											style={{ width: `${Math.round(u.progress * 100)}%` }}
										/>
									</div>
									<Show when={u.error}>
										<p class="mt-1 text-error">{u.error}</p>
									</Show>
								</li>
							)}
						</For>
					</ul>
				</div>
			</Show>

			{/* Prompt */}
			<Show when={prompt()}>
				{(p) => (
					<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
						<button
							type="button"
							class="absolute inset-0 bg-text-primary/35 backdrop-blur-[2px]"
							aria-label="Close dialog"
							onClick={() => {
								p().resolve(null);
								setPrompt(null);
							}}
						/>
						<form
							class="relative z-10 w-full max-w-md border border-border-strong bg-bg-base p-6 rounded-lg shadow-[0_18px_50px_-12px_rgba(21,24,31,0.28)]"
							onSubmit={(e) => {
								e.preventDefault();
								p().resolve(promptInput?.value.trim() ?? '');
								setPrompt(null);
							}}
						>
							<h2 class="u-wide text-lg text-text-primary">{p().title}</h2>
							<div class="mt-5">
								<span class="label">{p().label}</span>
								<input ref={promptInput} value={p().value} class="field" />
							</div>
							<div class="mt-6 flex justify-end gap-3">
								<button
									type="button"
									class={btn}
									onClick={() => {
										p().resolve(null);
										setPrompt(null);
									}}
								>
									Cancel
								</button>
								<button type="submit" class={`${btn} btn-primary`}>
									Confirm
								</button>
							</div>
						</form>
					</div>
				)}
			</Show>
		</div>
	);
}
