const express = require('express');
const router = express.Router();
const finalExamsController = require('../controllers/staff/programCoordinator/finalExams.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleCheckMiddleware = require('../middlewares/role.middleware');


router.get('/schedule', finalExamsController.getFinalExamsSchedule);

router.post('/generate-final-exam-schedule', finalExamsController.generateFinalExamSchedule);

// set final exam details for a course offering
router.post('/:courseOfferingId', finalExamsController.setFinalExam);

// delete final exam details for a course offering
router.delete('/:courseOfferingId', finalExamsController.deleteFinalExamSchedule);




module.exports = router;