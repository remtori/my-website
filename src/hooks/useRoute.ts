import { useEffect, useState } from 'preact/hooks';
import { subscribers, getCurrentUrl, route } from 'preact-router';

export function useRoute(path: string) {
	const [ url, setMatch ] = useState(getCurrentUrl());

	useEffect(() => {
		subscribers.push(setMatch);
		return () => {
			const idx = subscribers.indexOf(setMatch);
			idx >= 0 && subscribers.splice(idx, 1);
		}
	}, []);

	const match = url.replace(/\?.+$/, '');
	return {
		matches: path === match,
		url,
		path: match,
	};
}

interface RedirectProps {
	path: string;
	to: string;
	replace?: boolean;
}

export function Redirect(props: RedirectProps) {
	const { matches } = useRoute(props.path);
	if (matches) route(props.to, props.replace);
}
