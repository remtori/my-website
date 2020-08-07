const moduleStart = 'consts:';

export default function constsPlugin(consts) {
	return {
		name: 'consts-plugin',
		resolveId(id) {
			if (!id.startsWith(moduleStart)) return;
			return id;
		},
		load(id) {
			if (!id.startsWith(moduleStart)) return;
			const key = id.slice(moduleStart.length);

			if (!(key in consts)) {
				this.error(`Cannot find const: ${key}`);
				return;
			}

			return `export default ${JSON.stringify(consts[key])}`;
		}
	};
}
