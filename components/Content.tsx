import Link from 'next/link';
import { FunctionComponent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';

import styles from '~/styles/Content.module.scss';

export const Content: FunctionComponent<{ meta: ContentMeta; html: string; path: string }> = ({ meta, html, path }) => {
	return (
		<div className={styles.contentContainer}>
			<Link href={`/admin/${path}`}>
				<a className={styles.edit}>
					<FontAwesomeIcon icon={faEdit as any} />
					<span>Edit this Page</span>
				</a>
			</Link>
			<div className={styles.content} dangerouslySetInnerHTML={{ __html: html }} />
		</div>
	);
};
