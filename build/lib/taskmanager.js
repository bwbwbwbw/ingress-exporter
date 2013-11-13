(function() {
  var TaskManager;

  TaskManager = GLOBAL.TaskManager = {
    length: 0,
    begin: function() {
      return TaskManager.length++;
    },
    end: function(id) {
      TaskManager.length--;
      if (TaskManager.length === 0) {
        return console.log('TaskManager=0', id);
      }
    }
  };

}).call(this);
