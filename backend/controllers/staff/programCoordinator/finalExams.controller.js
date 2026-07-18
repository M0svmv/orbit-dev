const CourseOffering = require("../../../models/CourseOffering");
const Course = require("../../../models/Course");
const Semester = require("../../../models/Semester");
const Enrollment = require("../../../models/Enrollment");
const Transcript = require("../../../models/Transcript");
const SemesterWork = require("../../../models/SemesterWork");
const FinalExamsSchedule = require("../../../models/FinalExamsSchedule");


exports.setFinalExam = async (req, res) => {
  try {
    const { courseOfferingId } = req.params;
    const { date, startTime, place } = req.body;

    const courseOffering = await CourseOffering.findById(courseOfferingId)
      .populate('courseId', 'courseName courseRegulation');
    if (!courseOffering) {
      return res.status(404).json({ message: "Course offering not found" });
    }

    const currentSemester = await Semester.findOne({ isCurrent: true });
    if (!currentSemester) {
      return res.status(404).json({ message: "Current semester not found" });
    }

    // =========================================================
    // Current course students (اللي داخلين المادة دي)
    // =========================================================
    const courseStudents = await SemesterWork.find({
      courseId: courseOffering.courseId._id,
      semesterId: currentSemester._id,
    }).select("studentId");

    // =========================================================
    // All offerings with final exam on the same date
    // =========================================================
    const courseOfferings = await CourseOffering.find({
      semesterId: currentSemester._id,
      "finalExamSchedule.date": date,
    }).populate('courseId', 'courseName courseRegulation');

    let conflictCourses = [];

    // =========================================================
    // Check conflicts (students-conflict فقط، من غير دكتور)
    // =========================================================
    for (let offering of courseOfferings) {
      // Skip same offering
      if (offering._id.toString() === courseOfferingId) continue;

      const semesterWorks = await SemesterWork.find({
        courseId: offering.courseId._id,
        semesterId: currentSemester._id,
      })
        .select("studentId")
        .populate("studentId", "studentName");

      const conflictStudents = semesterWorks.filter((sw) =>
        courseStudents.some(
          (cs) => cs.studentId.toString() === sw.studentId._id.toString(),
        ),
      );

      if (conflictStudents.length === 0) continue;

      const conflictStudentsTranscript = await Transcript.find({
        studentId: { $in: conflictStudents.map((s) => s.studentId._id) },
      })
        .select("level regulation studentId")
        .populate("studentId", "studentName");

      const conflictGraduatesNum = conflictStudentsTranscript.filter(
        (t) => t.level === "senior" || t.level === "senior-2",
      ).length;

      conflictCourses.push({
        type: "students-conflict",
        courseName: offering.courseId.courseName,
        message: `${conflictStudents.length} student(s) have a final exam conflict with this course.`,
        conflictNumber: conflictStudents.length,
        graduatesConflictNumber: conflictGraduatesNum,
        conflictStudents: conflictStudentsTranscript,
      });
    }

    // =========================================================
    // Return conflicts (بدون حفظ)
    // =========================================================
    if (conflictCourses.length > 0) {
      return res.status(400).json({
        message: "Final exam schedule conflict detected",
        conflictCourses,
      });
    }

    // =========================================================
    // Update final exam schedule
    // =========================================================
    courseOffering.finalExamSchedule.date = date;
    courseOffering.finalExamSchedule.startTime = startTime || "10 AM";
    courseOffering.finalExamSchedule.place = place || "--";

    await courseOffering.save();

    res.status(200).json({
      message: "Final exam details updated successfully",
      data: courseOffering,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getFinalExamsSchedule = async (req, res) => {
  try {
    const currentSemester = await Semester.findOne({ isCurrent: true });
    if (!currentSemester) {
      return res.status(404).json({ message: "Current semester not found" });
    }

    const courseOfferings = await CourseOffering.find({ semesterId: currentSemester._id }).select('courseId finalExamSchedule').populate('courseId', 'courseName courseRegulation');
    if (!courseOfferings) {
      return res.status(404).json({ message: "Course offering not found" });
    }

    res.status(200).json({
      message: "Final exam schedule fetched successfully",
      data: courseOfferings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.deleteFinalExamSchedule = async (req, res) => {
  try {
    const { courseOfferingId } = req.params;

    const courseOffering = await CourseOffering.findById(courseOfferingId);
    if (!courseOffering) {
      return res.status(404).json({ message: "Course offering not found" });
    }

    courseOffering.finalExamSchedule = {};

    await courseOffering.save();

    res.status(200).json({
      message: "Final exam schedule deleted successfully",
      data: courseOffering,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.generateFinalExamSchedule = async (req, res) => {
  try {
    const currentSemester = await Semester.findOne({ isCurrent: true });
    if (!currentSemester) {
      return res.status(404).json({ message: "Current semester not found" });
    }

    const maxCoursesPerDay = req.body.maxCoursesPerDay || 5;

    // =========================================================
    // كل الـ offerings في السيميستر الحالي
    // =========================================================
    const courseOfferings = await CourseOffering.find({
      semesterId: currentSemester._id,
      status: { $in: ["open", "proposed"] },
    }).populate("courseId", "courseName");

    if (courseOfferings.length === 0) {
      return res.status(400).json({ message: "No course offerings found for this semester" });
    }

    // =========================================================
    // خريطة: offeringId -> Set(studentIds)
    // =========================================================
    const enrollments = await SemesterWork.find({
      semesterId: currentSemester._id,
    }).select("courseId studentId");

    const offeringStudents = {};
    for (const e of enrollments) {
      const key = e.courseId.toString();
      if (!offeringStudents[key]) offeringStudents[key] = new Set();
      offeringStudents[key].add(e.studentId.toString());
    }

    // =========================================================
    // بناء الـ conflict graph (تعارض طلاب بس)
    // =========================================================
    const offeringIds = courseOfferings.map((o) => o._id.toString());
    const adjacency = {};
    offeringIds.forEach((id) => (adjacency[id] = new Set()));

    for (let i = 0; i < offeringIds.length; i++) {
      for (let j = i + 1; j < offeringIds.length; j++) {
        const a = offeringIds[i];
        const b = offeringIds[j];
        const sa = offeringStudents[a] || new Set();
        const sb = offeringStudents[b] || new Set();

        let conflict = false;
        for (const studentId of sa) {
          if (sb.has(studentId)) {
            conflict = true;
            break;
          }
        }
        if (conflict) {
          adjacency[a].add(b);
          adjacency[b].add(a);
        }
      }
    }

    // =========================================================
    // Greedy Coloring مع حد أقصى للمواد في اليوم
    // بنرتب المواد الأكتر تعارضًا الأول
    // =========================================================
    const sortedOfferings = [...offeringIds].sort(
      (a, b) => adjacency[b].size - adjacency[a].size,
    );

    const assignment = {}; // offeringId -> dayIndex (0-based)
    const dayCourses = []; // dayCourses[dayIndex] = [offeringId, ...]

    for (const id of sortedOfferings) {
      const conflictingDays = new Set();
      for (const neighbor of adjacency[id]) {
        if (assignment[neighbor] !== undefined) {
          conflictingDays.add(assignment[neighbor]);
        }
      }

      // دور على أول يوم: (1) مفيهوش تعارض، (2) لسه ماوصلش الحد الأقصى
      let dayIndex = 0;
      while (
        conflictingDays.has(dayIndex) ||
        (dayCourses[dayIndex] && dayCourses[dayIndex].length >= maxCoursesPerDay)
      ) {
        dayIndex++;
      }

      assignment[id] = dayIndex;
      if (!dayCourses[dayIndex]) dayCourses[dayIndex] = [];
      dayCourses[dayIndex].push(id);
    }

    // =========================================================
    // حفظ النتيجة
    // =========================================================
    const scheduled = [];

    for (const offering of courseOfferings) {
      const id = offering._id.toString();
      const dayNumber = assignment[id] + 1; // 1-based

      offering.finalExamSchedule = {
        date: dayNumber,
        startTime: "10:00 AM",
        place:"--"
      };

      scheduled.push(offering);
    }

    await Promise.all(scheduled.map((o) => o.save()));

    res.status(200).json({
      message: "Final exam schedule generated successfully",
      totalDaysUsed: dayCourses.length,
      maxCoursesPerDay,
      scheduledCount: scheduled.length,
      data: scheduled,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.setFinalExamsScheduleTimeSchema = async (req, res) => {
  try {
    const { periodsTime } = req.body;
    // مثال على الشكل المتوقع:
    // periodsTime: [
    //   { day: "1", startTime: "10:00 AM", endTime: "12:00 PM" },
    //   { day: "2", startTime: "10:00 AM", endTime: "12:00 PM" },
    //   { day: "3", startTime: "10:00 AM", endTime: "12:00 PM" }
    // ]

    if (!periodsTime || !Array.isArray(periodsTime) || periodsTime.length === 0) {
      return res.status(400).json({ message: "periodsTime is required and must be a non-empty array" });
    }

    // هات أول final exams schedule موجود
    let finalExamsSchedule = await FinalExamsSchedule.findOne();

    if (!finalExamsSchedule) {
      // أول مرة → create
      finalExamsSchedule = new FinalExamsSchedule({ periodsTime });
      await finalExamsSchedule.save();

      return res.status(201).json({
        message: "Final exams schedule created successfully",
        finalExamsSchedule,
      });
    }

    // موجود → update
    finalExamsSchedule.periodsTime = periodsTime;
    await finalExamsSchedule.save();

    res.status(200).json({
      message: "Final exams schedule updated successfully",
      finalExamsSchedule,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.updateSingleFinalExamPeriod = async (req, res) => {
  try {
    const { index, date, startTime, endTime } = req.body;

    const finalExamsSchedule = await FinalExamsSchedule.findOne();
    if (!finalExamsSchedule) {
      return res.status(404).json({ message: "Final exams schedule not found" });
    }

    // check index
    if (index < 0 || index >= finalExamsSchedule.periodsTime.length) {
      return res.status(400).json({ message: "Invalid period index" });
    }

    const period = finalExamsSchedule.periodsTime[index];

    // update specific period
    if (date) period.date = date;
    if (startTime) period.startTime = startTime;
    if (endTime) period.endTime = endTime;

    await finalExamsSchedule.save();

    // =========================================================
    // انشر التحديث على كل المواد اللي واخدة اليوم ده
    // =========================================================
    const dayNumber = index + 1;

    await CourseOffering.updateMany(
      { "finalExamSchedule.day": dayNumber },
      {
        $set: {
          ...(date && { "finalExamSchedule.date": date }),
          ...(startTime && { "finalExamSchedule.startTime": startTime }),
          ...(endTime && { "finalExamSchedule.endTime": endTime }),
        },
      },
    );

    res.status(200).json({
      message: "Final exam period updated successfully",
      period,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};