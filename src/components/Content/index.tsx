import { h } from 'preact';
import marked from 'marked';
import { Link } from 'preact-router';
import { useState, useEffect } from 'preact/hooks';
import { highlightAuto, registerLanguage } from 'highlight.js/lib/core';

import Icon, { icons } from '../Icon';

import styles from './styles.scss';
import 'highlight.js/styles/darcula.css';

registerLanguage('markdown', require('highlight.js/lib/languages/markdown.js'));
registerLanguage('javascript', require('highlight.js/lib/languages/javascript.js'));
registerLanguage('c-like', require('highlight.js/lib/languages/c-like.js'));
registerLanguage('cpp', require('highlight.js/lib/languages/cpp.js'));

const MARKED_OPTIONS: marked.MarkedOptions = {
	gfm: true,
	highlight: (code: string) => highlightAuto(code).value,
	smartLists: true,
	smartypants: true
}

export default function Content() {

	const [ $html, setHTML ] = useState('');

	useEffect(() =>{
		fetch('/content/en/about.md')
			.then(r => r.text())
			.then(text => marked(text, MARKED_OPTIONS))
			.then(setHTML);
	}, []);

	return (
		<div class={styles.contentContainer}>
			<Link class={styles.edit} href={'/edit'}>
				<Icon icon={icons.faEdit} />
				<span>Edit this Page</span>
			</Link>
			<div dangerouslySetInnerHTML={{__html: $html}} />
		</div>
	);
}