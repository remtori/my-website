import Image from 'next/image';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import googleIcon from '@public/google.svg';
import type { User } from 'firebase/auth';
import { cx } from '~/lib/util';

import styles from '~/styles/Account.module.scss';

interface Props {
	closeModal: () => void;
}

export const Account: FunctionComponent<Props> = ({ closeModal }) => {
	const [account, setAccount] = useState<User | null>(null);

	useEffect(() => {
		let didUnmount = false;
		import('~/lib/client-sdk').then((m) => m.authUser()).then((user) => !didUnmount && setAccount(user));

		return () => {
			didUnmount = true;
		};
	}, []);

	return (
		<div className={styles.account}>
			{account ? <AccountInfo account={account} closeModal={closeModal} /> : <Login closeModal={closeModal} />}
			<button type="button" onClick={closeModal}>
				Close
			</button>
		</div>
	);
};

const Login: FunctionComponent<Props> = ({ closeModal }) => {
	const [error, setError] = useState('');

	const formRef = useRef<HTMLFormElement>(null);
	const githubRef = useRef<HTMLButtonElement>(null);
	const googleRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const clientSdk = import('~/lib/client-sdk');

		const handleForm = () => {
			setError('');
			const email = (formRef.current!.querySelector('input[type=email]') as HTMLInputElement).value;
			const password = (formRef.current!.querySelector('input[type=password]') as HTMLInputElement).value;
			clientSdk
				.then((m) => m.signIn(email, password))
				.then(closeModal)
				.catch((err) => setError(err));
		};

		const signInGithub = () => {
			setError('');
			clientSdk
				.then((m) => m.signIn('github'))
				.then(closeModal)
				.catch((err) => setError(err));
		};

		const signInGoogle = () => {
			setError('');
			clientSdk
				.then((m) => m.signIn('google'))
				.then(closeModal)
				.catch((err) => setError(err));
		};

		const formEle = formRef.current;
		const githubEle = githubRef.current;
		const googleEle = googleRef.current;
		formEle?.addEventListener('submit', handleForm);
		githubEle?.addEventListener('click', signInGithub);
		googleEle?.addEventListener('click', signInGoogle);
		return () => {
			formEle?.removeEventListener('submit', handleForm);
			githubEle?.removeEventListener('click', signInGithub);
			googleEle?.removeEventListener('click', signInGoogle);
		};
	}, [closeModal]);

	return (
		<>
			{error && <div className={styles.error}>{error}</div>}
			<button type="button" ref={githubRef} className={cx(styles.brandLogin, styles.github)}>
				<FontAwesomeIcon icon={faGithub} className={styles.icon} />
				<span className={styles.text}>Sign in with Github</span>
			</button>
			<button type="button" ref={googleRef} className={cx(styles.brandLogin, styles.google)}>
				<Image src={googleIcon} alt="Google Logo" width={24} height={24} layout="fixed" />
				<span className={styles.text}>Sign in with Google</span>
			</button>
			<form>
				<label htmlFor="loginEmail">Email</label>
				<input id="loginEmail" type="email" />
				<label htmlFor="loginPassword">Password</label>
				<input id="loginPassword" type="password" />
				<button type="submit">Login</button>
			</form>
		</>
	);
};

const AccountInfo: FunctionComponent<Props & { account: User }> = ({ account, closeModal }) => {
	const logoutRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const logout = () => {
			closeModal();
			import('~/lib/client-sdk').then((m) => m.signOut());
		};

		const logoutElement = logoutRef.current;
		logoutElement?.addEventListener('click', logout);
		return () => logoutElement?.removeEventListener('click', logout);
	}, [closeModal]);

	return (
		<>
			<img className={styles.avatar} src={account.photoURL!} alt="User Avatar" />
			<span className={styles.displayName}>{account.displayName}</span>
			<button type="button" ref={logoutRef}>
				Log out
			</button>
		</>
	);
};
