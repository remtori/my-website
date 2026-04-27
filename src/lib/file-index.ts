import { splitFrontmatter } from './frontmatter';
import { getEnv } from './runtime';
import { getObjectText, listObjectsWithPrefix, POSTS_PREFIX } from './s3';

const KV_KEY = 'file_index';

export type FileIndexEntry = {
	key: string;
	title?: string;
	date?: string;
};

/** Retrieve the cached file index from DATA KV. On miss, rebuild from S3. */
export async function getFileIndex(): Promise<FileIndexEntry[]> {
	const env = getEnv();
	const raw = await env.DATA.get(KV_KEY);
	if (raw) {
		try {
			return JSON.parse(raw) as FileIndexEntry[];
		} catch {
			// fall through to rebuild
		}
	}
	return rebuildFileIndex();
}

/** Rebuild the full file index by listing S3 and fetching frontmatter for posts. */
export async function rebuildFileIndex(): Promise<FileIndexEntry[]> {
	const env = getEnv();
	const keys = await listObjectsWithPrefix('mdx/');
	const entries: FileIndexEntry[] = [];

	for (const key of keys) {
		const entry: FileIndexEntry = { key };
		if (key.startsWith(POSTS_PREFIX) && key.endsWith('.mdx')) {
			try {
				const raw = await getObjectText(key);
				const { data } = splitFrontmatter(raw);
				if (data.title) entry.title = String(data.title);
				if (data.date) entry.date = String(data.date);
			} catch {
				// ignore missing/unreadable posts
			}
		}
		entries.push(entry);
	}

	await env.DATA.put(KV_KEY, JSON.stringify(entries));
	return entries;
}

/** Upsert a single entry in the cached index (used after CMS save). */
export async function upsertFileIndexEntry(key: string, content?: string): Promise<void> {
	const env = getEnv();
	try {
		const index = await getFileIndex();
		const entry: FileIndexEntry = { key };

		if (key.startsWith(POSTS_PREFIX) && key.endsWith('.mdx') && content !== undefined) {
			const { data } = splitFrontmatter(content);
			if (data.title) entry.title = String(data.title);
			if (data.date) entry.date = String(data.date);
		}

		const existing = index.findIndex((e) => e.key === key);
		if (existing >= 0) {
			index[existing] = entry;
		} else {
			index.push(entry);
		}

		await env.DATA.put(KV_KEY, JSON.stringify(index));
	} catch {
		// silently ignore KV write failures; S3 remains source of truth
	}
}

/** Remove a single entry from the cached index (used after CMS delete). */
export async function deleteFileIndexEntry(key: string): Promise<void> {
	const env = getEnv();
	try {
		const index = await getFileIndex();
		const filtered = index.filter((e) => e.key !== key);
		await env.DATA.put(KV_KEY, JSON.stringify(filtered));
	} catch {
		// silently ignore KV write failures; S3 remains source of truth
	}
}
