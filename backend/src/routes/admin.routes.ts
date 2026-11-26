import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getDashboardStats,
  getTeachers, createTeacher, updateTeacher, deleteTeacher, activateTeacher, hardDeleteTeacher,
  getStudents, createStudent, updateStudent, deleteStudent, activateStudent, hardDeleteStudent,
  resetStudentFace, resetStudentBiometrics,
  getSubjects, createSubject, updateSubject, deleteSubject, hardDeleteSubject, searchSubjects,
  getTimetables, createTimetable, updateTimetable, deleteTimetable,
  getAdminReports,
  getAuditLogs,
  getDisputes, resolveDispute,
  updateUserRoleDept,
  getAdminSettings, updateAdminSettings,
} from '../controllers/admin.controller';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/dashboard', getDashboardStats);

// Teachers
router.get('/teachers', getTeachers);
router.post('/teachers', createTeacher);
router.put('/teachers/:id', updateTeacher);
router.patch('/teachers/:id/activate', activateTeacher);
router.delete('/teachers/:id', deleteTeacher);
router.delete('/teachers/:id/permanent', hardDeleteTeacher);

// Students
router.get('/students', getStudents);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.patch('/students/:id/activate', activateStudent);
router.delete('/students/:id', deleteStudent);
router.delete('/students/:id/permanent', hardDeleteStudent);
router.post('/students/:id/reset-face', resetStudentFace);
router.post('/students/:id/reset-biometrics', resetStudentBiometrics);

// Subjects
router.get('/subjects/search', searchSubjects);
router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);
router.delete('/subjects/:id/permanent', hardDeleteSubject);

// Timetable
router.get('/timetables', getTimetables);
router.post('/timetables', createTimetable);
router.put('/timetables/:id', updateTimetable);
router.delete('/timetables/:id', deleteTimetable);

// Reports
router.get('/reports', getAdminReports);

// Audit logs
router.get('/audit-logs', getAuditLogs);

// Disputes / corrections
router.get('/disputes', getDisputes);
router.patch('/disputes/:id', resolveDispute);

// Role/Department editing
router.patch('/users/:id/role-dept', updateUserRoleDept);

// System settings
router.get('/settings', getAdminSettings);
router.put('/settings', updateAdminSettings);

export default router;
