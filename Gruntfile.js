module.exports = function (grunt)
{

     grunt.util.linefeed = '\n';

     grunt.initConfig({

          pkg: grunt.file.readJSON('package.json'),

          copy: {

               project: {
                    files: [{
                         expand: true,
                         cwd: 'src/',
                         src: ['**/*.js'],
                         dest: 'build/',
                         ext: '.js'
                    }]
               }

          },

          coffee: {

               project: {
                    files: [{
                         expand: true,
                         cwd: 'src/',
                         src: ['**/*.coffee'],
                         dest: 'build/',
                         ext: '.js'
                    }, {
                         src: 'config.coffee',
                         dest: 'build/config.js'
                    }]
               }
          },

          watch: {

               project: {
                    files: ['src/**/*', 'config.coffee'],
                    tasks: ['copy', 'coffee']
               }

          }

     });

     grunt.loadNpmTasks('grunt-contrib-copy');
     grunt.loadNpmTasks('grunt-contrib-coffee');
     grunt.loadNpmTasks('grunt-contrib-watch');

     grunt.registerTask('default', ['copy', 'coffee']);
     grunt.registerTask('debug', ['copy', 'coffee', 'watch']);

};