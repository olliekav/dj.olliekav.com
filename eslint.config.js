import preact from 'eslint-config-preact';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['dist/', 'apps/', 'scripts/', 'coverage/', '.netlify/', '.claude/'] },
	...preact,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx}'],
		rules: {
			// TypeScript checks these
			'no-undef': 'off',
			'no-unused-vars': 'off'
		}
	}
);
