import { initializeApp } from 'firebase/app';
import {
	getAuth,
	GoogleAuthProvider,
	GithubAuthProvider,
	signInWithPopup,
	signInWithEmailAndPassword,
} from 'firebase/auth';
import path from 'path/posix';

const app = initializeApp({
	apiKey: 'AIzaSyDZpNEsHUILTJSJixyoGzaB04K8Kcp6CPU',
	authDomain: 'remtori.firebaseapp.com',
	databaseURL: 'https://remtori.firebaseio.com',
	projectId: 'remtori',
	storageBucket: 'remtori.appspot.com',
	messagingSenderId: '65013389724',
	appId: '1:65013389724:web:bf3e07dfb003f314',
});

export const auth = getAuth(app);

const githubAuthProvider = new GithubAuthProvider();
const googleAuthProvider = new GoogleAuthProvider();

export const signIn = (providerOrEmail: 'github' | 'google' | string, password?: string) => {
	switch (providerOrEmail) {
		case 'github':
			return signInWithPopup(auth, githubAuthProvider);
		case 'google':
			return signInWithPopup(auth, googleAuthProvider);
		default:
			return signInWithEmailAndPassword(auth, providerOrEmail, password!);
	}
};
