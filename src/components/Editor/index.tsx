import { FunctionComponent, useCallback, useRef, useState } from 'react';
import { EditorImpl } from './EditorImpl';
import '~/lib/spell-check/prism-spell-checker';

import styles from '~/styles/Editor.module.scss';
import { uploadFile } from '~/lib/util';

interface EditorProps {
	isNewPage?: boolean;
	pageContent: string;
	path: string;
}

export const Editor: FunctionComponent<EditorProps> = ({ pageContent, path, isNewPage }) => {
	const pathRef = useRef<HTMLInputElement>(null);
	const [code, setCode] = useState(pageContent ?? '');
	const [status, setStatus] = useState('');

	const onSave = useCallback(() => {
		setStatus('Saving...');
		const filePath = pathRef.current?.value ?? path;
		uploadFile(filePath, new Blob([code], { type: 'text/plain' }))
			.then(() => {
				setStatus('');
			})
			.catch((err) => {
				setStatus(err + '');
			});
	}, [code, pathRef, path]);

	return (
		<div className={styles.container}>
			{status && <div className={styles.status}>{status}</div>}
			<label>
				Path
				<input ref={pathRef} type="text" defaultValue={path} />
			</label>
			<EditorImpl
				className={styles.editor}
				value={code}
				onValueChange={setCode}
				language="markdown"
				tabSize={4}
			/>
			<button onClick={onSave}>Save</button>
		</div>
	);
};
