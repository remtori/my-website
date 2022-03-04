import Link from 'next/link';
import { FunctionComponent } from 'react';

import styles from '~/styles/Listing.module.scss';

type ListItem = { attributes: ContentMeta; html: string; slug: string };

export const Listing: FunctionComponent<{ list: ListItem[] }> = ({ list }) => {
	console.log('Listing length', list.length);
	return (
		<div className={styles.container}>
			<div className={styles.listing}>
				{list.map((item, i) => (
					<div key={item.attributes.title + i} className={styles.item}>
						<div className={styles.left}>
							<Link href={`/blog/${item.slug}`}>
								<a className={styles.thumbnail}><img src={item.attributes.thumbnail || '/404.png'} /></a>
							</Link>
						</div>
						<div className={styles.right}>
							<div className={styles.title}>
								<Link href={`/blog/${item.slug}`}>
									<a>{item.attributes.title}</a>
								</Link>
							</div>
							<div className={styles.desc}>
								{item.attributes.description}
							</div>
							<div className={styles.date}>
								{new Date(item.attributes.date).toDateString()}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
