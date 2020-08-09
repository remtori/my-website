import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';
import AsyncRoute from 'preact-async-route';

import Header from './Header';
import Footer from './Footer';
import Content from '../Content';
import { createStore, Provider } from '../../store';

import styles from './styles.scss';

export default class App extends Component<{ url?: string }>
{
	store = createStore({

	});

	render() {
		return (
			<Provider value={this.store}>
				<Header />
				<div class={styles.wrapper}>
					<div class={styles.container}>
						<Router url={this.props.url}>
							<Route default component={Content} />
						</Router>
					</div>
				</div>
				<Footer />
			</Provider>
		);
	}
}
