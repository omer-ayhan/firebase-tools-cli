/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [0],
    'type-case': [0],
    'type-empty': [0],
    'scope-enum': [0],
    'scope-empty': [0],
    'subject-case': [0],
    'subject-empty': [0],
    'subject-full-stop': [0],
    'subject-max-length': [0],
  },
};
