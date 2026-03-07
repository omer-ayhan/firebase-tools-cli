/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'cli',
        'firestore',
        'rtdb',
        'remote-config',
        'auth',
        'config',
        'release',
        'docs',
        'deps',
      ],
    ],
    'scope-empty': [0],
    'subject-max-length': [2, 'always', 72],
  },
};
