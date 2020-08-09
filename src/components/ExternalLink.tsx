import { h } from 'preact';

export type Props = { children: any } & preact.JSX.HTMLAttributes<HTMLAnchorElement>;

export default function ELink({ children, ...props }: Props) {
	return (
		<a
			target='_blank'
			rel='noopener noreferrer'
			{...props}
		>
			{children}
		</a>
	);
}
