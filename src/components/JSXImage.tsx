import { h } from 'preact';
import { useCallback, useState, useEffect } from 'preact/hooks';
import cx from '../lib/cx';

export type JSXImageProps = {
	src: string,
	width?: number | undefined,
	height?: number | undefined
} & h.JSX.HTMLAttributes<HTMLImageElement>;

export default function JSXImage({ src, width, height, ...props }: JSXImageProps) {

	const [isError, setIsError] = useState(false);

	useEffect(() => {
		setIsError(false);
	}, [ src ]);

	const onError = useCallback(() => {
		setIsError(true);
	}, [ src ]);

	props.style = Object.assign({}, props.style, { width, height });

	return (
		<img
			{...props}
			src={src}
			loading={'lazy'}
			class={cx(isError ? 'error-image' : 'loading-image', props.class)}
			onError={onError}
		/>
	);

}
