TaskManager = GLOBAL.TaskManager =
    
    length: 0

    begin: ->

        TaskManager.length++

    end: (id) ->

        TaskManager.length--
        console.log('TaskManager=0', id) if TaskManager.length is 0