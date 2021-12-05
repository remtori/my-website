import { initializeApp } from 'firebase/app';
import {
	getAuth,
	GoogleAuthProvider,
	GithubAuthProvider,
	signInWithPopup,
	signInWithEmailAndPassword,
	User,
} from 'firebase/auth';

const app = initializeApp({
	apiKey: 'AIzaSyDZpNEsHUILTJSJixyoGzaB04K8Kcp6CPU',
	authDomain: 'remtori.firebaseapp.com',
	databaseURL: 'https://remtori.firebaseio.com',
	projectId: 'remtori',
	storageBucket: 'remtori.appspot.com',
	messagingSenderId: '65013389724',
	appId: '1:65013389724:web:bf3e07dfb003f314',
});

const auth = getAuth(app);

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

export const signOut = () => auth.signOut();

export const authUser = (): Promise<User | null> =>
	new Promise((resolve, reject) => auth.onAuthStateChanged(resolve, reject));
