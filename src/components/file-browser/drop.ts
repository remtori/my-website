type FsEntry = {
	isFile: boolean;
	isDirectory: boolean;
	name: string;
};

type FsFileEntry = FsEntry & {
	file(successCallback: (file: File) => void, errorCallback?: (err: DOMException) => void): void;
};

type FsDirReader = {
	readEntries(successCallback: (entries: FsEntry[]) => void, errorCallback?: (err: DOMException) => void): void;
};

type FsDirEntry = FsEntry & {
	createReader(): FsDirReader;
};

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
	const items = [...dt.items];
	const files: File[] = [];
	const entries: FsEntry[] = [];

	for (const item of items) {
		const getter = (item as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry;
		const entry = getter?.call(item);
		if (entry) {
			entries.push(entry);
		} else {
			const file = item.getAsFile();
			if (file) files.push(file);
		}
	}

	for (const entry of entries) {
		await walkEntry(entry, '', files);
	}

	if (files.length === 0) {
		return [...dt.files];
	}
	return files;
}

async function walkEntry(entry: FsEntry, path: string, out: File[]): Promise<void> {
	if (entry.isFile) {
		const file = await new Promise<File>((resolve, reject) => {
			(entry as FsFileEntry).file(resolve, reject);
		});
		const rel = path ? `${path}${file.name}` : file.name;
		const wrapped = new File([file], file.name, { type: file.type, lastModified: file.lastModified });
		Object.defineProperty(wrapped, 'webkitRelativePath', { value: rel });
		out.push(wrapped);
		return;
	}
	if (entry.isDirectory) {
		const dir = entry as FsDirEntry;
		const reader = dir.createReader();
		const nextPath = `${path}${entry.name}/`;
		const children = await readAllEntries(reader);
		for (const child of children) {
			await walkEntry(child, nextPath, out);
		}
	}
}

function readAllEntries(reader: FsDirReader): Promise<FsEntry[]> {
	return new Promise((resolve, reject) => {
		const all: FsEntry[] = [];
		const read = () => {
			reader.readEntries((batch) => {
				if (batch.length === 0) {
					resolve(all);
					return;
				}
				all.push(...batch);
				read();
			}, reject);
		};
		read();
	});
}
