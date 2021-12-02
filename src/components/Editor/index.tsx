import { FunctionComponent, useState } from 'react';
import { EditorImpl } from './EditorImpl';
import '~/lib/spell-check/prism-spell-checker';

import styles from '~/styles/Editor.module.scss';
interface EditorProps {
	isNewPage?: boolean;
	pageContent?: string;
	path: string;
}

export const Editor: FunctionComponent<EditorProps> = ({ pageContent, path, ...props }) => {
	const [code, setCode] = useState(pageContent ?? '');

	return (
		<div className={styles.container}>
			<MetaEditor />
			<EditorImpl
				value={code}
				onValueChange={setCode}
				language="markdown"
				tabSize={4}
				className={styles.container}
				preClassName={styles.pre}
				textareaClassName={styles.editor}
			/>
			<MetaEditor />
		</div>
	);
};

const MetaEditor: FunctionComponent = () => {
	return <form></form>;
};
