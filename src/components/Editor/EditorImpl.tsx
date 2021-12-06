/**
 * Fork From: https://github.com/satya164/react-simple-code-editor/tree/e5be544449a7ed0387a14236fff1c41bc6f0798f
 *
 * Original Author: Satyajit Sahoo <satyajit.happy@gmail.com> (https://github.com/satya164/)
 *
 * The MIT License (MIT)
 *
 * Copyright (C) 2018 - 2019
 *
 * Permission is hereby granted, free of charge,
 * to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import React from 'react';

import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/plugins/autoloader/prism-autoloader';

import styles from '~/styles/EditorImpl.module.scss';
import { cx } from '~/lib/api.client';

if (typeof window !== 'undefined') {
	Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.25.0/components/';
}

type Props = React.HTMLAttributes<HTMLDivElement> & {
	// Props for the component
	value: string;
	onValueChange: (value: string) => void;
	language: string;
	autoSave?: (value: string) => void;
	autoSaveInterval?: number;
	tabSize: number;
	insertSpaces: boolean;
	ignoreTabKey: boolean;
	style?: {};

	// Props for the textarea
	textareaId?: string;
	textareaClassName?: string;
	autoFocus?: boolean;
	disabled?: boolean;
	form?: string;
	maxLength?: number;
	minLength?: number;
	name?: string;
	placeholder?: string;
	readOnly?: boolean;
	required?: boolean;
	onClick?: React.MouseEventHandler;
	onFocus?: React.FocusEventHandler;
	onBlur?: React.FocusEventHandler;
	onKeyUp?: React.KeyboardEventHandler;
	onKeyDown?: React.KeyboardEventHandler;

	// Props for the hightlighted code’s pre element
	preClassName?: string;
};

type State = {
	capture: boolean;
};

type Record = {
	value: string;
	selectionStart: number;
	selectionEnd: number;
};

type History = {
	stack: Array<Record & { timestamp: number }>;
	offset: number;
};

const HISTORY_LIMIT = 100;
const HISTORY_TIME_GAP = 3000;

const isMacLike = 'navigator' in global && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);

export class EditorImpl extends React.Component<Props, State> {
	static defaultProps = {
		tabSize: 2,
		insertSpaces: true,
		ignoreTabKey: false,
		autoSaveInterval: 5000,
	};

	state = {
		capture: true,
	};

	_autoSaveIntervalId?: number;

	componentDidMount() {
		this._recordCurrentState();
		this._autoSaveIntervalId = setInterval(() => {
			if (this.props.autoSave && this._input?.value) {
				this.props.autoSave(this._input.value);
			}
		}, this.props.autoSaveInterval) as unknown as number;
	}

	componentWillUnmount() {
		clearInterval(this._autoSaveIntervalId);
	}

	_recordCurrentState = () => {
		const input = this._input;

		if (!input) return;

		// Save current state of the input
		const { value, selectionStart, selectionEnd } = input;

		this._recordChange({
			value,
			selectionStart,
			selectionEnd,
		});
	};

	_getLines = (text: string, position: number) => text.substring(0, position).split('\n');

	_recordChange = (record: Record, overwrite: boolean = false) => {
		const { stack, offset } = this._history;

		if (stack.length && offset > -1) {
			// When something updates, drop the redo operations
			this._history.stack = stack.slice(0, offset + 1);

			// Limit the number of operations to 100
			const count = this._history.stack.length;

			if (count > HISTORY_LIMIT) {
				const extras = count - HISTORY_LIMIT;

				this._history.stack = stack.slice(extras, count);
				this._history.offset = Math.max(this._history.offset - extras, 0);
			}
		}

		const timestamp = Date.now();

		if (overwrite) {
			const last = this._history.stack[this._history.offset];

			if (last && timestamp - last.timestamp < HISTORY_TIME_GAP) {
				// A previous entry exists and was in short interval

				// Match the last word in the line
				const re = /[^a-z0-9]([a-z0-9]+)$/i;

				// Get the previous line
				const previous = this._getLines(last.value, last.selectionStart).pop()!.match(re);

				// Get the current line
				const current = this._getLines(record.value, record.selectionStart).pop()!.match(re);

				if (previous && current && current[1].startsWith(previous[1])) {
					// The last word of the previous line and current line match
					// Overwrite previous entry so that undo will remove whole word
					this._history.stack[this._history.offset] = { ...record, timestamp };

					return;
				}
			}
		}

		// Add the new operation to the stack
		this._history.stack.push({ ...record, timestamp });
		this._history.offset++;
	};

	_updateInput = (record: Record) => {
		const input = this._input;

		if (!input) return;

		// Update values and selection state
		input.value = record.value;
		input.selectionStart = record.selectionStart;
		input.selectionEnd = record.selectionEnd;

		this.props.onValueChange(record.value);
	};

	_applyEdits = (record: Record) => {
		// Save last selection state
		const input = this._input;
		const last = this._history.stack[this._history.offset];

		if (last && input) {
			this._history.stack[this._history.offset] = {
				...last,
				selectionStart: input.selectionStart,
				selectionEnd: input.selectionEnd,
			};
		}

		// Save the changes
		this._recordChange(record);
		this._updateInput(record);
	};

	_undoEdit = () => {
		const { stack, offset } = this._history;

		// Get the previous edit
		const record = stack[offset - 1];

		if (record) {
			// Apply the changes and update the offset
			this._updateInput(record);
			this._history.offset = Math.max(offset - 1, 0);
		}
	};

	_redoEdit = () => {
		const { stack, offset } = this._history;

		// Get the next edit
		const record = stack[offset + 1];

		if (record) {
			// Apply the changes and update the offset
			this._updateInput(record);
			this._history.offset = Math.min(offset + 1, stack.length - 1);
		}
	};

	_handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const { tabSize, insertSpaces, ignoreTabKey, onKeyDown } = this.props;

		if (onKeyDown) {
			onKeyDown(e);

			if (e.defaultPrevented) {
				return;
			}
		}

		if (e.key === 'Escapse') {
			(e.target as HTMLTextAreaElement).blur();
		}

		const { value, selectionStart, selectionEnd } = e.target as HTMLTextAreaElement;
		const tabCharacter = (insertSpaces ? ' ' : '\t').repeat(tabSize);
		if (e.key === 'Tab' && !ignoreTabKey && this.state.capture) {
			// Prevent focus change
			e.preventDefault();

			if (e.shiftKey) {
				// Unindent selected lines
				const linesBeforeCaret = this._getLines(value, selectionStart);
				const startLine = linesBeforeCaret.length - 1;
				const endLine = this._getLines(value, selectionEnd).length - 1;
				const nextValue = value
					.split('\n')
					.map((line, i) => {
						if (i >= startLine && i <= endLine && line.startsWith(tabCharacter)) {
							return line.substring(tabCharacter.length);
						}

						return line;
					})
					.join('\n');

				if (value !== nextValue) {
					const startLineText = linesBeforeCaret[startLine];

					this._applyEdits({
						value: nextValue,
						// Move the start cursor if first line in selection was modified
						// It was modified only if it started with a tab
						selectionStart: startLineText.startsWith(tabCharacter)
							? selectionStart - tabCharacter.length
							: selectionStart,
						// Move the end cursor by total number of characters removed
						selectionEnd: selectionEnd - (value.length - nextValue.length),
					});
				}
			} else if (selectionStart !== selectionEnd) {
				// Indent selected lines
				const linesBeforeCaret = this._getLines(value, selectionStart);
				const startLine = linesBeforeCaret.length - 1;
				const endLine = this._getLines(value, selectionEnd).length - 1;
				const startLineText = linesBeforeCaret[startLine];

				this._applyEdits({
					value: value
						.split('\n')
						.map((line, i) => {
							if (i >= startLine && i <= endLine) {
								return tabCharacter + line;
							}

							return line;
						})
						.join('\n'),
					// Move the start cursor by number of characters added in first line of selection
					// Don't move it if it there was no text before cursor
					selectionStart: /\S/.test(startLineText) ? selectionStart + tabCharacter.length : selectionStart,
					// Move the end cursor by total number of characters added
					selectionEnd: selectionEnd + tabCharacter.length * (endLine - startLine + 1),
				});
			} else {
				const updatedSelection = selectionStart + tabCharacter.length;

				this._applyEdits({
					// Insert tab character at caret
					value: value.substring(0, selectionStart) + tabCharacter + value.substring(selectionEnd),
					// Update caret position
					selectionStart: updatedSelection,
					selectionEnd: updatedSelection,
				});
			}
		} else if (e.key === 'Backspace') {
			const hasSelection = selectionStart !== selectionEnd;
			const textBeforeCaret = value.substring(0, selectionStart);

			if (textBeforeCaret.endsWith(tabCharacter) && !hasSelection) {
				// Prevent default delete behaviour
				e.preventDefault();

				const updatedSelection = selectionStart - tabCharacter.length;

				this._applyEdits({
					// Remove tab character at caret
					value: value.substring(0, selectionStart - tabCharacter.length) + value.substring(selectionEnd),
					// Update caret position
					selectionStart: updatedSelection,
					selectionEnd: updatedSelection,
				});
			}
		} else if (e.key === 'Enter') {
			// Ignore selections
			if (selectionStart === selectionEnd) {
				// Get the current line
				const line = this._getLines(value, selectionStart).pop()!;
				const matches = line.match(/^\s+/);

				if (matches && matches[0]) {
					e.preventDefault();

					// Preserve indentation on inserting a new line
					const indent = '\n' + matches[0];
					const updatedSelection = selectionStart + indent.length;

					this._applyEdits({
						// Insert indentation character at caret
						value: value.substring(0, selectionStart) + indent + value.substring(selectionEnd),
						// Update caret position
						selectionStart: updatedSelection,
						selectionEnd: updatedSelection,
					});
				}
			}
		} else if (e.key === '(' || e.key === '{' || e.key === '[' || e.key === "'" || e.key === '"') {
			let chars;
			switch (e.key) {
				case '(':
					chars = ['(', ')'];
					break;
				case '{':
					chars = ['{', '}'];
					break;
				case '[':
					chars = ['[', ']'];
					break;
				case "'":
					chars = ["'", "'"];
					break;
				case '"':
					chars = ['"', '"'];
					break;
			}

			if (
				selectionStart === selectionEnd &&
				value[selectionStart] === e.key &&
				(e.key === "'" || e.key === '"')
			) {
				e.preventDefault();

				this._applyEdits({
					value,
					selectionStart: selectionStart + 1,
					selectionEnd: selectionEnd + 1,
				});
			} else if (chars) {
				e.preventDefault();

				this._applyEdits({
					value:
						value.substring(0, selectionStart) +
						chars[0] +
						value.substring(selectionStart, selectionEnd) +
						chars[1] +
						value.substring(selectionEnd),
					// Update caret position
					selectionStart: selectionStart === selectionEnd ? selectionStart + 1 : selectionStart,
					selectionEnd: selectionStart === selectionEnd ? selectionEnd + 1 : selectionEnd + 2,
				});
			}
		} else if (e.key === ')' || e.key === '}' || e.key === ']') {
			// Skip over existing closing pair
			if (selectionStart === selectionEnd && value[selectionStart] === e.key) {
				e.preventDefault();

				this._applyEdits({
					value,
					selectionStart: selectionStart + 1,
					selectionEnd: selectionEnd + 1,
				});
			}
		} else if (
			(isMacLike
				? // Trigger undo with ⌘+Z on Mac
				  e.metaKey && e.key === 'z'
				: // Trigger undo with Ctrl+Z on other platforms
				  e.ctrlKey && e.key === 'z') &&
			!e.shiftKey &&
			!e.altKey
		) {
			e.preventDefault();

			this._undoEdit();
		} else if (
			(isMacLike
				? // Trigger redo with ⌘+Shift+Z on Mac
				  e.metaKey && e.key === 'z' && e.shiftKey
				: // Trigger redo with Ctrl+Shift+Z on other platforms
				  e.ctrlKey && e.key === 'z' && e.shiftKey) &&
			!e.altKey
		) {
			e.preventDefault();

			this._redoEdit();
		} else if (e.key === 'm' && e.ctrlKey && (isMacLike ? e.shiftKey : true)) {
			e.preventDefault();

			// Toggle capturing tab key so users can focus away
			this.setState((state) => ({
				capture: !state.capture,
			}));
		}
	};

	_handleChange = (e: any) => {
		const { value, selectionStart, selectionEnd } = e.target;

		this._recordChange(
			{
				value,
				selectionStart,
				selectionEnd,
			},
			true
		);

		this.props.onValueChange(value);
	};

	_history: History = {
		stack: [],
		offset: -1,
	};

	_input: HTMLTextAreaElement | null = null;

	get session() {
		return {
			history: this._history,
		};
	}

	set session(session: { history: History }) {
		this._history = session.history;
	}

	render() {
		const {
			value,
			language,
			style,
			textareaId,
			textareaClassName,
			autoSaveInterval,
			autoFocus,
			disabled,
			form,
			maxLength,
			minLength,
			name,
			placeholder,
			readOnly,
			required,
			onClick,
			onFocus,
			onBlur,
			onKeyUp,
			/* eslint-disable no-unused-vars */
			onKeyDown,
			onValueChange,
			tabSize,
			insertSpaces,
			ignoreTabKey,
			/* eslint-enable no-unused-vars */
			preClassName,
			...rest
		} = this.props;

		const highlighted = Prism.highlight(value, Prism.languages[language], language)
			.split('\n')
			.map((text, idx) => (
				<React.Fragment key={idx}>
					<span className={styles.lineNumber}>{idx + 1}</span>
					<span dangerouslySetInnerHTML={{ __html: text + '\n' }} />
				</React.Fragment>
			));

		return (
			<div {...rest} className={styles.container} style={style}>
				<textarea
					ref={(c) => (this._input = c)}
					className={cx(textareaClassName, styles.editor)}
					id={textareaId}
					value={value}
					onChange={this._handleChange}
					onKeyDown={this._handleKeyDown}
					onClick={onClick}
					onKeyUp={onKeyUp}
					onFocus={onFocus}
					onBlur={onBlur}
					disabled={disabled}
					form={form}
					maxLength={maxLength}
					minLength={minLength}
					name={name}
					placeholder={placeholder}
					readOnly={readOnly}
					required={required}
					autoFocus={autoFocus}
					autoCapitalize="off"
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					data-gramm={false}
				/>
				<pre className={cx(preClassName, styles.editor, styles.highlight)} aria-hidden="true">
					{highlighted}
				</pre>
			</div>
		);
	}
}
