import { Dispatch, FunctionComponent, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';

import styles from '~/styles/CliCode.module.scss';

const TERMINAL_PREFIX = '<span style="color: #16C606">remtori@utility</span>:<span style="color: #3B78FF">~</span>$ ';

export const CliCode: FunctionComponent = () => {
	const terminalRef = useRef<HTMLElement>();
	const [history, setHistory] = useState<string[]>([]);

	// Scroll to the bottom of the terminal when window is resized
	useEffect(() => {
		const windowResizeEvent = () => {
			terminalRef.current?.scrollTo({
				top: terminalRef.current?.scrollHeight ?? 99999,
				behavior: 'smooth',
			});
		};
		window.addEventListener('resize', windowResizeEvent);

		return () => {
			window.removeEventListener('resize', windowResizeEvent);
		};
	}, [terminalRef]);

	// Scroll to the bottom of the terminal on every new history item
	useEffect(() => {
		terminalRef.current?.scrollTo({
			top: terminalRef.current?.scrollHeight ?? 99999,
			behavior: 'smooth',
		});
	}, [history, terminalRef]);

	const inputRef = useRef<HTMLInputElement>();
	const [input, setInputValue] = useState<string>('');

	useEffect(() => {
		inputRef.current?.focus();
	});

	const focusInput = useCallback(() => {
		inputRef.current?.focus();
	}, []);

	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value);
	}, []);

	const commands = useMemo(() => makeCommands(setHistory), [setHistory]);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

	const pushHistory = useCallback(
		(value: string) => setHistory(history => [...history, value]),
		[setHistory]
	);

	const executeCommand = useCallback((input: string) => {
		const inputCommand = input.trim();
		pushHistory(TERMINAL_PREFIX + inputCommand);

		if (inputCommand.length > 0) {
			const splittedInput = inputCommand.split(' ');

			try {
				const cmd = commands?.[splittedInput[0]];
				if (cmd) {
					cmd(splittedInput);
				} else {
					pushHistory(`Unknown command ${splittedInput[0]}`);
				}
			} catch (ex) {
				pushHistory(String(ex));
			}
		}

		setInputValue('');
	}, [commands, pushHistory, setInputValue]);

	const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			executeCommand(input);
		}
	}, [input, executeCommand]);

	const suggestionClicked = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		executeCommand((e.target as HTMLButtonElement).value);
	}, []);

	useEffect(() => {
	}, [])

	return (
		<>
			<div className={styles.container}>
				<div
					className={styles.shell}
					onClick={focusInput}
					// @ts-ignore
					ref={terminalRef}
				>
					<div className={styles.line}>
						Terminal contains quick, little utility program I usually use.
					</div>
					{
						history.map((line, index) => (
							<div
								className={styles.line}
								key={`tl-${index}-${line.substring(0, 8)}`}
								dangerouslySetInnerHTML={{ __html: line }}
							>
							</div>
						))
					}
					<div className={styles.prompt}>
						<div className={styles.label} dangerouslySetInnerHTML={{ __html: TERMINAL_PREFIX }}></div>
						<div className={styles.input}>
							<input
								type="text"
								value={input}
								onKeyDown={handleInputKeyDown}
								onChange={handleInputChange}
								// @ts-ignore
								ref={inputRef}
							/>
						</div>
					</div>
				</div>
				<div className={styles.suggestions}>
					{
						suggestions.map((suggestion) => (
							<button
								key={`sg-${suggestion.command}`}
								onClick={suggestionClicked}
								value={suggestion.command}
							>
								{suggestion.label ?? suggestion.command}
							</button>
						))
					}
				</div>
			</div>
		</>
	);
}

type ArgType = 'string' | 'number';

interface Suggestion {
	command: string;
	label?: string;
	args: ArgType[];
}

function makeCommands(setHistory: Dispatch<SetStateAction<string[]>>): Record<string, Dispatch<string[]>> {
	const push = (value: string) => setHistory(history => [...history, value]);

	const commands = {
		clear: () => setHistory([]),
		echo: (args: string[]) => push(args.slice(1).join(' ')),
		ls: () => push(Object.keys(commands).join('\n')),
	};
	return commands;
}
