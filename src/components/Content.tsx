import Link from 'next/link';
import { FunctionComponent, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';

import styles from '~/styles/Content.module.scss';

export const Content: FunctionComponent<{ meta: Record<string, any>; html: string, path: string }> = ({ meta, html, path }) => {
	const [canEdit, setCanEdit] = useState(false);

	useEffect(() => {
		let didUnmount = false;
		import('~/lib/client-sdk')
			.then((m) => m.auth.onAuthStateChanged((user) => {
				if (!didUnmount)
					setCanEdit(user != null);
			}));

		return () => {
			didUnmount = true;
		};
	}, []);

	return (
		<div className={styles.contentContainer}>
			<Link href={`/edit?path=${path}`}>
				<a className={styles.edit} style={{ visibility: canEdit ? 'visible' : 'hidden' }}>
					<FontAwesomeIcon icon={faEdit} />
					<span>Edit this Page</span>
				</a>
			</Link>
			<div className={styles.content} dangerouslySetInnerHTML={{ __html: html }} />
		</div>
	);
};
