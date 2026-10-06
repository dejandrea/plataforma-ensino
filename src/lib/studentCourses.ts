import { supabase } from "./supabaseClient";

export type CurriculumModule = {
  id: string;
  title: string;
  course_id: string;
  course_title: string;
  order_index: number;
  total_lessons: number;
  completed_lessons: number;
  is_completed: boolean;
  is_unlocked: boolean;
  course_completed: boolean;
};

export async function fetchStudentCurriculum(studentId: string): Promise<CurriculumModule[]> {
  const { data, error } = await supabase.rpc("student_curriculum_status", { p_student_id: studentId });
  if (error) throw error;
  return data || [];
}

export async function fetchStudentModules(studentId: string) {
  return (await fetchStudentCurriculum(studentId)).filter((module) => module.course_completed);
}
