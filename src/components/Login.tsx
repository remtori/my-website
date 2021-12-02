import { FunctionComponent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

import styles from '~/styles/Login.module.scss';

export const Login: FunctionComponent = () => {
    return (
        <div className={styles.login}>
            <button className={styles.github}>
                <FontAwesomeIcon icon={faGithub} />
                <span>Sign in with Github</span>
            </button>
        </div>
    )
}
