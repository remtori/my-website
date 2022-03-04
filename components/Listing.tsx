import Link from 'next/link';
import { FunctionComponent } from 'react';

type ListItem = { attributes: ContentMeta; html: string; slug: string };

export const Listing: FunctionComponent<{ list: ListItem[] }> = ({ list }) => {
	console.log('Listing length', list.length);
	return (
		<div>
			{list.map((item, i) => (
				<div key={item.attributes.title + i}>
					<div>{item.attributes.title}</div>
					<div>{item.attributes.description}</div>
					<div>{item.attributes.tags}</div>
					<div>{item.attributes.date}</div>
					<Link href={`/blog/${item.slug}`}>
						<a>{item.slug}</a>
					</Link>
				</div>
			))}
		</div>
	);
};
