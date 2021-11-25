import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebase = initializeApp({
	credential: cert({
		projectId: process.env.FIREBASE_PROJECT_ID,
		clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
		privateKey: process.env.FIREBASE_PRIVATE_KEY,
	}),
});

export const verifyAdmin = (idToken: string) =>
	getAuth(firebase)
		.verifyIdToken(idToken)
		.then((decodedIdToken) => decodedIdToken.uid === process.env.FIREBASE_ADMIN_USER_ID);
