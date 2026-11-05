module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  extends: ["eslint:recommended"],
  rules: {
    "no-undef": "off",
    "no-unused-vars": "off",
    "no-useless-escape": "off",
  },
};
