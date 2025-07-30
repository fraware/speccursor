module.exports = {
  '*.{js,ts,jsx,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '*.{rs}': ['rustfmt'],
  '*.{go}': ['gofmt -w', 'golangci-lint run --fix'],
  '*.{py}': ['black', 'flake8'],
};
