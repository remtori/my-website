import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory containing this package's `package.json` (server package root). */
export function getServerPackageRoot(): string {
	return dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
}
