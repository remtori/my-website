import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = initializeApp({
    apiKey: "AIzaSyDZpNEsHUILTJSJixyoGzaB04K8Kcp6CPU",
    authDomain: "remtori.firebaseapp.com",
    databaseURL: "https://remtori.firebaseio.com",
    projectId: "remtori",
    storageBucket: "remtori.appspot.com",
    messagingSenderId: "65013389724",
    appId: "1:65013389724:web:bf3e07dfb003f314"
});

export const auth = getAuth(app);
