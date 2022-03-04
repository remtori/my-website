import { Content } from '~/components/Content';
import content from '@content/about.md';

const About = () => <Content meta={content.attributes} html={content.html} path={`about.md`} />;
export default About;
