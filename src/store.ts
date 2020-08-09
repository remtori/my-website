import { createContext } from 'preact';
import createUnistore, { Store } from 'unistore';
import dev from 'consts/dev';

export const storeCtx = createContext<Store<StoreState>>(null as any);
export const Provider = storeCtx.Provider;

const SAVE: Array<keyof StoreState> = [ 'lang' ];

export interface StoreState {
	lang: string;
}

export function createStore(initialState: Partial<StoreState>) {
	const savedState = getSavedState();
	const state = { ...initialState, ...savedState };
	const store = createUnistore<StoreState>(state);
	store.subscribe(saveState);
	return store;
}

function saveState(state: StoreState) {
	const saved: any = {};
	for (const key of SAVE) saved[key] = state[key];

	localStorage.setItem('state', JSON.stringify(saved));

	if (dev) {
		console.log(`Saving state:`);
		console.log(saved);
	}
}

function getSavedState() {
	let state;
	try {
		state = JSON.parse(localStorage.getItem('state')!);
	}
	// tslint:disable-next-line: no-empty
	catch (e) { }

	return state || {};
}
