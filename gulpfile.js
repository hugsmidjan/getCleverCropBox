const { parallel, series } = require('gulp');
const del = require('del');
const rollupTaskFactory = require('@hugsmidjan/gulp-rollup');

const baseOpts = {
  src: 'src/',
  format: 'cjs',
  minify: false,
  sourcemaps: false,
};

const [transpile, transpileWatch] = rollupTaskFactory({
  ...baseOpts,
  name: 'bundle_module',
  glob: ['*.js', '!**/*.tests.js'],
  dist: 'dist/',
});

const [tests, testsWatch] = rollupTaskFactory({
  ...baseOpts,
  name: 'bundle_tests',
  dist: 'tests/',
  glob: ['**/*.tests.js'],
  inputOpts: {
    external: ['ospec'],
  },
});

const cleanup = () => del(['dist', 'tests']);

const build = parallel(cleanup, transpile, tests);
const watch = parallel(transpileWatch, testsWatch);

exports.dev = series(build, watch);
exports.build = build;
exports.default = build;
