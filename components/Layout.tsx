import Head from 'next/head';
import Link from 'next/link';
import { FunctionComponent, useState } from 'react';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faTwitter, faGithub } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';

import styles from '~/styles/Layout.module.scss';

const miniIcon = `/icon-minimal.png`;

export const Layout: FunctionComponent<{ children: any[] }> = ({ children }) => {
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
					<Link href="/" className={styles.home}>
						<img alt="site icon" src={miniIcon} width={40} height={40} />
						<span className={styles.title}>{`Remtori's Comfy Home`}</span>
					</Link>
					<nav>
						<Link href="/about">ABOUT</Link>
						<Link href="/blog">BLOGS</Link>
						<Link href="/tool">TOOLS</Link>
					</nav>
				</div>
			</header>
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
				</select>
			</div>
			<div>
				<span>Found an issue? </span>
				<Link href="https://github.com/remtori/my-website">
					Help me fix it
				</Link>
			</div>
			<div>
				<Link href="https://twitter.com/lqv_vn" className={styles.social}>
					<Icon className={cx(styles.icon, styles.iconTwitter)} icon={faTwitter as any} />
					<span>@LQV_VN</span>
				</Link>
				<Link href="https://github.com/remtori" className={styles.social}>
					<Icon className={cx(styles.icon, styles.iconWhite)} icon={faGithub as any} />
					<span>Remtori</span>
				</Link>
				<Link href="mailto:lqvu99+sites@gmail.com" className={styles.social}>
					<Icon className={cx(styles.icon, styles.iconWhite)} icon={faEnvelope as any} />
					<span>lqvu99+sites@gmail.com</span>
				</Link>
			</div>
		</footer>
	);
};

function cx(...args: string[]) {
	return args.join(' ');
}
