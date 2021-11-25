import { FunctionComponent, useRef, useState } from 'react';
import { SimpleEditor } from './ReactSimpleEditor';

import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-markdown';
import 'prismjs/plugins/line-numbers/prism-line-numbers';

import styles from '~/styles/Editor.module.scss';

interface EditorProps {
	isNewPage?: boolean;
	pageContent?: string;
	path: string;
}

export const Editor: FunctionComponent<EditorProps> = ({ pageContent, path, ...props }) => {
	const editorRef = useRef(null);
	const [code, setCode] = useState(pageContent ?? '');

	return (
		<div className={styles.container}>
			<SimpleEditor
				textareaId="codeArea"
				className={styles.editor}
				preClassName={styles.pre}
				onValueChange={setCode}
				value={code}
				highlight={(code) => Prism.highlight(code, Prism.languages.markdown, 'markdown')}
				padding={15}
				tabSize={4}
				ref={editorRef}
			/>
		</div>
	);
};
