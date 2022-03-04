import { Content } from '~/components/Content';
import content from '@content/home.md';

const Home = () => <Content meta={content.attributes} html={content.html} path={`home.md`} />;
export default Home;
