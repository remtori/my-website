import Prism from 'prismjs';

Prism.hooks.add('wrap', (env) => {
	// console.log(env);
	// const words = env.content.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
	// console.log(words);
});
