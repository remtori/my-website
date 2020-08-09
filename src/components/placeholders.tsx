import { h } from 'preact';
import cx from '../lib/cx';

export interface PHProps {
	width?: number;
	height?: number;
	[key: string]: any;
}

export const LoadingDot = ({ width = 128, height = 128, ...props}: PHProps) => (
	<div {...props} style={{ width, height }} class={cx('loading-image', props.class)} />
);

export const NotFound = ({ width = 256, height = 256, ...props }: PHProps) => (
	<div {...props} style={{ width, height }} class={cx('error-image', props.class)} />
);
