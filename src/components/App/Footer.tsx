import { h } from 'preact';
import { useCallback, useState, useEffect } from 'preact/hooks';
import version from 'consts/version';
import Icon, { icons } from '../Icon';
import ELink from '../ExternalLink';
import useStore from '../../hooks/useStore';
import cx from '../../lib/cx';

import styles from './styles.scss';

export default function Footer() {

	return (
		<footer class={styles.footer}>
			<div>
				<span>Language: </span>
				<select>
					<option value='en'>English</option>
					<option value='vn'>Vietnamese</option>
				</select>
			</div>
			<div>
				<span>Found an issue? </span>
				<ELink href='https://github.com/remtori/my-website'>
					Help me fix it
				</ELink>
			</div>
			<div>
				<span>Created with </span>
				<Icon class={styles.icon} icon={icons.preact}   title='Preact'   />
				<Icon class={styles.icon} icon={icons.firebase} title='Firebase' />
				<Icon class={styles.icon} icon={icons.webpack}  title='Webpack'  />
				<span> by a proud fan of </span>
				<ELink href='https://rezero.fandom.com/wiki/Rem'>Rem</ELink>
			</div>
			<div>
				<ELink class={styles.social} href='https://twitter.com/lqv_vn'>
					<Icon class={cx(styles.icon, styles.iconTwitter)} icon={icons.faTwitter} title='twitter' />
					<span>@LQV_VN</span>
				</ELink>
				<ELink class={styles.social} href='https://github.com/remtori'>
					<Icon class={cx(styles.icon, styles.iconWhite)} icon={icons.faGithub} title='github' />
					<span>Remtori</span>
				</ELink>
				<ELink class={styles.social} href='mailto:lqvu99+sites@gmail.com'>
					<Icon class={cx(styles.icon, styles.iconWhite)} icon={icons.faEnvelope} title='mail' />
					<span>lqvu99+sites@gmail.com</span>
				</ELink>
			</div>
			<div class={styles.version}>{`v${version}`}</div>
		</footer>
	);
}
