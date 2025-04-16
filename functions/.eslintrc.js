module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double"],
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
};
