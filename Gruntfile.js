module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-jslint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Project configuration.
  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    jslint: {
      files: [ 'Gruntfile.js', 'index.js', 'test/test-*.js' ],
      directives: {
        indent: 2,
        node: true,
        todo: true,
        nomen: true,
        sloppy: true,
        plusplus: true
      }
    },

    nodeunit: {
      files: [ 'test/test-*.js' ]
    },

    watch: {
      files: '<config:jslint.files>',
      tasks: 'default'
    }

  });

  // Default task.
  grunt.registerTask('default', [ 'jslint', 'nodeunit' ]);

};
