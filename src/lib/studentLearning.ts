import { supabase } from './supabaseClient';
import { nextAvailableLesson } from './lessonNavigation';
import type { AssessmentAnswers, AssessmentSession, FlashcardProgress, LessonImport, QuizAttemptRow, StudentActivityProgressRow, StudentLessonLearning } from '../types/learning';

function rpcError(error: { message: string; code?: string }) {
  if (error.code === 'PGRST202' || error.code === '42883') return new Error('O ambiente de aprendizagem está temporariamente indisponível. Tente novamente mais tarde.');
  if (['42501', '23514', '22023'].includes(error.code ?? '')) return new Error(error.message);
  return new Error('Não foi possível acessar o ambiente de aprendizagem. Verifique sua conexão e tente novamente.');
}

export async function fetchNextStudentLesson(lessonId: string) {
  const results = await Promise.all([
    supabase.from('lessons').select('id,title,submodule_id,order_index,publication_status'),
    supabase.from('submodules').select('id,module_id,order_index').eq('is_active', true),
    supabase.from('modules').select('id,course_id,order_index').eq('is_active', true),
  ]);
  for (const result of results) if (result.error) throw rpcError(result.error);
  return nextAvailableLesson(lessonId, results[0].data ?? [], results[1].data ?? [], results[2].data ?? []);
}

export async function fetchFlashcardProgress(activityId:string):Promise<FlashcardProgress> {
 const {data,error}=await supabase.rpc('student_flashcard_progress',{p_activity_id:activityId});
 if(error)throw rpcError(error);
 return data as FlashcardProgress;
}
export async function reviewFlashcard(activityId:string,cardId:string):Promise<FlashcardProgress> {
 const {data,error}=await supabase.rpc('review_student_flashcard',{p_activity_id:activityId,p_card_id:cardId});
 if(error)throw rpcError(error);
 return data as FlashcardProgress;
}

export async function fetchStudentLesson(lessonId: string): Promise<StudentLessonLearning> {
  const { data, error } = await supabase.rpc('student_lesson_learning', { p_lesson_id: lessonId });
  if (error) throw rpcError(error);
  if (!data?.lesson) throw new Error('Aula não encontrada. Volte para sua jornada.');
  return data as StudentLessonLearning;
}

export async function startStudentActivity(activityId: string): Promise<StudentActivityProgressRow> {
  const { data, error } = await supabase.rpc('start_student_activity', { p_activity_id: activityId });
  if (error) throw rpcError(error);
  return data as StudentActivityProgressRow;
}

export async function completeStudentStudy(activityId: string): Promise<StudentActivityProgressRow> {
  const { data, error } = await supabase.rpc('complete_student_study', { p_activity_id: activityId });
  if (error) throw rpcError(error);
  return data as StudentActivityProgressRow;
}

export async function submitStudentQuiz(activityId: string, answers: Record<string, string>, requestId: string): Promise<QuizAttemptRow> {
  const { data, error } = await supabase.rpc('submit_student_quiz', { p_activity_id: activityId, p_answers: answers, p_request_id: requestId });
  if (error) throw rpcError(error);
  return data as QuizAttemptRow;
}

export async function completeStudentLesson(lessonId: string): Promise<string> {
  const { data, error } = await supabase.rpc('complete_student_lesson', { p_lesson_id: lessonId });
  if (error) throw rpcError(error);
  return data as string;
}

export async function beginStudentAssessment(activityId: string): Promise<AssessmentSession> {
  const { data, error } = await supabase.rpc('begin_student_assessment', { p_activity_id: activityId });
  if (error) throw rpcError(error);
  return data as AssessmentSession;
}

export async function submitStudentAssessment(activityId: string, answers: AssessmentAnswers, sessionId: string): Promise<QuizAttemptRow> {
  const { data, error } = await supabase.rpc('submit_student_assessment', { p_activity_id: activityId, p_answers: answers, p_session_id: sessionId });
  if (error) throw rpcError(error);
  return data as QuizAttemptRow;
}

export async function importLearningLesson(lessonId: string, document: LessonImport, publish: boolean) {
  const { data, error } = await supabase.rpc('import_learning_lesson', { p_lesson_id: lessonId, p_document: document, p_publish: publish });
  if (error) throw rpcError(error);
  return data as { activityIds: string[]; published: boolean };
}

export async function publishLearningActivities(lessonId: string, activityIds: string[]) {
  const { error } = await supabase.rpc('publish_learning_activities', { p_lesson_id: lessonId, p_activity_ids: activityIds });
  if (error) throw rpcError(error);
}
