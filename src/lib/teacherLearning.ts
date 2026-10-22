import { supabase } from './supabaseClient';
import type { PlanSessionRow, TeachingPlan } from '../types/learning';

export type TeacherSession = PlanSessionRow & {
  version: number; confirmed_at: string | null; confirmed_by: string | null;
  plan: TeachingPlan; activity_title: string; lesson_title: string;
  submodule_title: string; module_title: string; course_title: string;
};
export type TeacherWorkspace = {
  meeting: { id: string; status: string };
  activities: { id: string; title: string; lesson_title: string; submodule_title: string; module_title: string; course_title: string }[];
  sessions: TeacherSession[];
};
export async function teacherLearningRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const {data,error} = await supabase.rpc(name,args);
  if (error) throw new Error(error.message);
  return data as T;
}
