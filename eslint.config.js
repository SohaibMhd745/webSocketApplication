export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module'
        },
        linterOptions: {
            reportUnusedDisableDirectives: true
        },
        rules: {
            'no-unused-vars': 'off',
            'no-console': 'off'
        }
    }
]