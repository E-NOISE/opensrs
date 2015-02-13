var gulp = require('gulp');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');

gulp.task('lint', function () {
  return gulp.src([ 'gulpfile.js', 'index.js', 'test/*.spec.js' ])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('test', function () {
  return gulp.src('test/*.spec.js', { read: false })
    .pipe(mocha({ /*reporter: 'nyan'*/ }));
});

gulp.task('default', [ 'lint', 'test' ]);

