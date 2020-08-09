import { h } from 'preact';
import { library, icon, IconName, IconLookup } from '@fortawesome/fontawesome-svg-core';
import { faEdit } from '@fortawesome/free-solid-svg-icons/faEdit';
import { faUser } from '@fortawesome/free-solid-svg-icons/faUser';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faTags } from '@fortawesome/free-solid-svg-icons/faTags';
import { faAddressCard } from '@fortawesome/free-solid-svg-icons/faAddressCard';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faTasks } from '@fortawesome/free-solid-svg-icons/faTasks';
import { faCommentAlt } from '@fortawesome/free-solid-svg-icons/faCommentAlt';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons/faEnvelope';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faTwitter } from '@fortawesome/free-brands-svg-icons/faTwitter';
import { faQuestionCircle } from '@fortawesome/free-regular-svg-icons/faQuestionCircle';

const faIcons = {
	faUser, faClock, faTags, faEdit,
	faHome, faTasks, faAddressCard,
	faCommentAlt,
	faEnvelope,
	faGithub, faTwitter,
	faQuestionCircle,
};

library.add(...Object.values(faIcons));

export const icons = {
	...faIcons,
	preact: 'icon-preact',
	firebase: 'icon-firebase',
	webpack: 'icon-webpack',
}

export interface IconProps {
	icon: IconName | IconLookup | string;
	class?: string;
	[key: string]: any;
}

export default function Icon({ icon: iconName, class: className, ...props }: IconProps) {
	if (props.title !== undefined) props.alt = props.title;

	if (typeof iconName === 'string') {
		return (
			<i
				class={`icon ${className} ${iconName}`}
				{...props}
			/>
		);
	}

	const { abstract: [ele] } = icon(
		iconName,
		{ classes: className }
	);

	return h(
		ele.tag,
		{ ...ele.attributes, ...props },
		ele.children && ele.children.map(c => h(
			c.tag,
			{ ...c.attributes }
		))
	);
}
