import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import Modal from 'react-modal';
import { FunctionComponent, useState } from 'react';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faTwitter, faGithub } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope, faUser } from '@fortawesome/free-solid-svg-icons';
import { Account } from '~/components/Account';

import miniIcon from '@public/icon-minimal.png';
import styles from '~/styles/Layout.module.scss';
import { cx } from '~/lib/util';

Modal.setAppElement('#__next');

export const Layout: FunctionComponent = ({ children }) => {
	return (
		<>
			<Head>
				<title>{`Remtori's Comfy Home`}</title>
				<meta name="viewport" content="width=device-width" />
				<meta name="theme-color" content="#13294D" />
				<meta name="description" content="A comfy place with a lot of cool stuff to explore~" />
			</Head>
			<div className={styles.root}>
				<Header />
				<div className={styles.wrapper}>
					<div className={styles.container}>{children}</div>
				</div>
				<Footer />
			</div>
		</>
	);
};

const Header: FunctionComponent = () => {
	const [loginVisible, setLoginVisible] = useState(false);

	return (
		<>
			<header className={styles.header}>
				<div className={styles.nav}>
					<Link href="/">
						<a className={styles.home}>
							<Image alt="site icon" src={miniIcon} width={40} height={40} layout="fixed" />
							<span className={styles.title}>{`Remtori's Comfy Home`}</span>
						</a>
					</Link>
					<nav>
						<Link href="/about">
							<a>ABOUT</a>
						</Link>
						<Link href="/blogs">
							<a>BLOGS</a>
						</Link>
						<Link href="/">
							<a>PROJECTS</a>
						</Link>
						<a className={styles.account} onClick={() => setLoginVisible(true)}>
							<Icon icon={faUser} />
						</a>
					</nav>
				</div>
			</header>
			<Modal
				isOpen={loginVisible}
				className={styles.modalContent}
				overlayClassName={styles.modalOverlay}
				onRequestClose={() => setLoginVisible(false)}
			>
				<Account closeModal={() => setLoginVisible(false)} />
			</Modal>
		</>
	);
};

const Footer: FunctionComponent = () => {
	return (
		<footer className={styles.footer}>
			<div>
				<span>Language: </span>
				<select>
					<option value="en">English</option>
					<option value="vn">Vietnamese</option>
				</select>
			</div>
			<div>
				<span>Found an issue? </span>
				<Link href="https://github.com/remtori/my-website">
					<a>Help me fix it</a>
				</Link>
			</div>
			<div>
				<Link href="https://twitter.com/lqv_vn">
					<a className={styles.social}>
						<Icon className={cx(styles.icon, styles.iconTwitter)} icon={faTwitter} />
						<span>@LQV_VN</span>
					</a>
				</Link>
				<Link href="https://github.com/remtori">
					<a className={styles.social}>
						<Icon className={cx(styles.icon, styles.iconWhite)} icon={faGithub} />
						<span>Remtori</span>
					</a>
				</Link>
				<Link href="mailto:lqvu99+sites@gmail.com">
					<a className={styles.social}>
						<Icon className={cx(styles.icon, styles.iconWhite)} icon={faEnvelope} />
						<span>lqvu99+sites@gmail.com</span>
					</a>
				</Link>
			</div>
		</footer>
	);
};
