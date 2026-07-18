const mongoose = require("mongoose");

const finalExamsScheduleSchema = new mongoose.Schema({
    
    periodsTime: [
        {   
            day: {
                type: String,
               
            },
            date: {
                type: Date,
                
            },
            startTime: {
            type: String,
            
        },
        endTime: {
            type: String,
            
        }
        }
    ]
});

module.exports = mongoose.model("FinalExamsSchedule", finalExamsScheduleSchema);