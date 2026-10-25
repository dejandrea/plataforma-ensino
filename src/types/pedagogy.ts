import type {ActivityStatus,ActivityType} from './learning';
import type {CurriculumModule} from '../lib/studentCourses';

export type CourseStatus='not_started'|'in_progress'|'completed'|'no_course';
export type PedagogyPage<T>={items:T[];total:number;page:number;page_size:number};
export type PedagogyCourse={course_id:string;course_title:string;total_lessons:number;completed_lessons:number;percent:number;status:Exclude<CourseStatus,'no_course'>;last_activity_at:string|null;xp:number};
export type PedagogyStudentCourse=Omit<PedagogyCourse,'course_id'|'course_title'|'percent'|'xp'|'status'>&{student_id:string;student_name:string;nickname:string|null;course_id:string|null;course_title:string|null;percent:number|null;xp:number|null;status:CourseStatus;pending_projects:number};
export type PedagogyDashboard=PedagogyPage<PedagogyStudentCourse>&{
 summary:{active_students:number;students_in_progress:number;completed_courses:number;pending_projects:number;completed_activities:number};
 courses:{id:string;title:string}[];teachers:{id:string;name:string}[];
};
export type PedagogyLesson={id:string;title:string;submodule_id:string;order_index:number;completed_at:string|null;status:Exclude<CourseStatus,'no_course'>;required_total:number;required_completed:number;last_activity_at:string|null};
export type PedagogyJourney={student:{id:string;name:string;nickname:string|null};courses:PedagogyCourse[];selected_course_id:string|null;modules:CurriculumModule[];submodules:{id:string;title:string;module_id:string;order_index:number;total_lessons:number;completed_lessons:number}[];lessons:PedagogyLesson[]};
export type PedagogyActivity={id:string;title:string;activity_type:ActivityType;interaction_type:'ordering'|'matching'|null;is_required:boolean;revision:number;order_index:number;status:ActivityStatus;completed_at:string|null;updated_at:string|null;is_unlocked:boolean;xp:number;question_count:number|null;max_attempts:number|null;attempts_total:number;latest_attempt:{score:number;passed:boolean;submitted_at:string}|null};
export type PedagogyAttempt={id:string;attempt_number:number;score:number;passed:boolean;submitted_at:string;activity_revision:number};
export type PedagogyProject={submission_id:string;student_id:string;student_name:string;activity_id:string;title:string;course_id:string;course_title:string;module_title:string;lesson_title:string;project_kind:'mini_project'|'project';submitted_at:string;status:'submitted'|'in_review'|'needs_revision'|'approved';grade:number|null};
