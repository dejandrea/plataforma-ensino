/** Contracts v1/v2: authoring payloads are privileged; only ActivityContent is student-safe. */
export type LegacyActivityType = 'slides' | 'mindmap' | 'quiz' | 'online_lesson' | 'project';
export type ActivityType = LegacyActivityType | 'interactive' | 'video' | 'flashcards';
export type FlashcardImage = {resourceUrl:string;altText:string};
export type Flashcard = {id:string;front:{title:string;question:string;image?:FlashcardImage};back:{summary:string;explanation:string;impact:string;curiosity?:string;image?:FlashcardImage}};
export type FlashcardsContent = {schemaVersion:2;type:'flashcards';cards:Flashcard[]};
export type FlashcardProgress = {activity_id:string;activity_revision:number;reviewed_card_ids:string[];reviewed_count:number;total:number;completed:boolean};
export type VideoContent = { schemaVersion: 2; type: 'video'; resourceUrl: string };
export type InteractiveItem = { id: string; label: string };
export type OrderingContent = { schemaVersion: 2; type: 'interactive'; interactionType: 'ordering'; instructions: string; items: InteractiveItem[]; passingScore: number; maxAttempts: number };
export type MatchingContent = { schemaVersion: 2; type: 'interactive'; interactionType: 'matching'; instructions: string; leftItems: InteractiveItem[]; rightItems: InteractiveItem[]; passingScore: number; maxAttempts: number };
export type InteractiveContent = OrderingContent | MatchingContent;
export type InteractiveKey = { schemaVersion: 2; feedback: string } & ({ interactionType: 'ordering'; correctOrder: string[] } | { interactionType: 'matching'; pairs: { leftId: string; rightId: string }[] });
export type LearningRewardRule = 'activity_quiz' | 'activity_interactive' | 'activity_study' | 'activity_online' | 'activity_project' | 'activity_final_project';
export type ActivityGamification = { rewardRuleKey: LearningRewardRule; awardOn: 'completed' | 'teacher_confirmed' | 'approved'; achievementKeys: string[] };
export type ActivityStatus = 'not_started' | 'in_progress' | 'pending_review' | 'completed' | 'needs_revision';
export type SubmissionStatus = 'submitted' | 'in_review' | 'needs_revision' | 'approved';
export type ResourceContent<T extends 'slides' | 'mindmap' = 'slides' | 'mindmap'> = { schemaVersion: 1; type: T; resourceUrl: string; format: 'pdf' | 'image' | 'link'; altText: string };
export type QuizQuestion = { key: string; prompt: string; options: { key: string; text: string }[] };
export type QuizContent = { schemaVersion: 1; type: 'quiz'; passingScore: number; maxAttempts: number; questions: QuizQuestion[] };
export type OnlineContent = { schemaVersion: 1; type: 'online_lesson'; objective: string; preparation: string[] };
export type ProjectContent = { schemaVersion: 1; type: 'project'; instructions: string; objectives: string[]; requirements: string[]; assessmentCriteria: string[]; resources: { title: string; url: string }[] };
export type ActivityContent = ResourceContent<'slides'> | ResourceContent<'mindmap'> | QuizContent | OnlineContent | ProjectContent | InteractiveContent | VideoContent | FlashcardsContent;
export type QuizKey = { schemaVersion: 1; answers: { questionKey: string; optionKey: string; feedback: string }[] };
export type TeachingStep = {
  key: string; title: string; objective: string; durationMinutes: number; guidance: string;
  code?: { language: string; file: string; source: string; expectedResult: string };
  questions: { prompt: string; expectedAnswer: string }[];
  detailedExplanation: string; playfulExplanation: string; commonDifficulties: string[]; challenge: string;
};
export type TeachingPlan = { schemaVersion: 1; objectives: string[]; prerequisites: string[]; preparation: string[]; durationMinutes: number; steps: TeachingStep[]; assessmentCriteria: string[] };
export type ActivityDefinition = {
  key: string; title: string; description?: string; orderIndex: number; durationMinutes?: number;
  required: boolean; prerequisites: string[];
  gamification?: ActivityGamification;
} & { [K in ActivityType]: { type: K; content: Extract<ActivityContent, { type: K }> } }[ActivityType];
export type LessonImportV1 = {
  schemaVersion: 1;
  context: { courseTitle: string; moduleTitle: string; submoduleTitle: string };
  lesson: { key: string; title: string; description: string; objectives: string[]; durationMinutes: number };
  activities: { [K in LegacyActivityType]: Omit<Extract<ActivityDefinition, { type: K }>, 'gamification'> }[LegacyActivityType][];
  teacherOnly: {
    quizKeys: { activityKey: string; content: QuizKey }[];
    lessonPlans: { activityKey: string; content: TeachingPlan }[];
  };
};
export type LessonImportV2 = Omit<LessonImportV1, 'schemaVersion' | 'activities' | 'teacherOnly'> & {
  schemaVersion: 2; activities: ActivityDefinition[];
  teacherOnly: LessonImportV1['teacherOnly'] & { interactiveKeys: { activityKey: string; content: InteractiveKey }[] };
};
export type LessonImport = LessonImportV1 | LessonImportV2;
export type AssessmentPresentation = { quiz?: Record<string, string[]>; items?: string[]; left?: string[]; right?: string[] };
export type AssessmentSession = { id: string; student_id: string; activity_id: string; activity_revision: number; attempt_number: number; presentation_json: AssessmentPresentation; started_at: string; submitted_at: string | null };
export type AssessmentAnswers = Record<string, string> | { sequence: string[] } | { pairs: Record<string, string> };

/** Database rows; UUIDs/timestamps serialize as strings. Not generated from production. */
export type LessonActivityRow = {
  id: string; lesson_id: string; key: string; title: string; description: string | null;
  order_index: number; duration_minutes: number | null; is_required: boolean; is_active: boolean;
  publication_status: 'draft' | 'published'; revision: number; created_at: string; updated_at: string;
  published_at: string | null;
  gamification_json?: ActivityGamification | Record<string, never>;
} & { [K in ActivityType]: { activity_type: K; content_json: Extract<ActivityDefinition, { type: K }>['content'] } }[ActivityType];
export type ActivityPrerequisiteRow = { activity_id: string; prerequisite_activity_id: string };
export type LessonLearningMetadataRow = { lesson_id: string; schema_version: 1; objectives: string[]; updated_at: string };
export type ActivityQuizKeyRow = { activity_id: string; activity_type: 'quiz' | 'interactive'; content_json: QuizKey | InteractiveKey; updated_at: string };
export type TeacherLessonPlanRow = { id: string; activity_id: string; activity_type: 'online_lesson'; revision: number; content_json: TeachingPlan; created_at: string; updated_at: string };
export type StudentActivityProgressRow = { id: string; student_id: string; activity_id: string; activity_revision: number; status: ActivityStatus; started_at: string | null; completed_at: string | null; updated_at: string };
export type QuizFeedback = { questionKey: string; isCorrect: boolean; feedback: string };
export type QuizAttemptRow = { id: string; student_id: string; activity_id: string; activity_type: 'quiz' | 'interactive'; activity_revision: number; attempt_number: number; answers_json: AssessmentAnswers; score: number; passed: boolean; submitted_at: string; request_id: string; feedback_json: QuizFeedback[]; presentation_json?: AssessmentPresentation };
export type ProjectSubmissionRow = { id: string; student_id: string; activity_id: string; activity_type: 'project'; activity_revision: number; version: number; submission_url: string; student_notes: string; submitted_at: string; request_id?: string;project_description?:string;additional_links?:{url:string;description:string}[] };
/** Append-only reviews preserve every correction separately from the submitted version. */
export type ProjectReviewRow = { id: string; submission_id: string; reviewed_by: string; status: Exclude<SubmissionStatus, 'submitted'>; teacher_feedback: string; evaluation_json: Record<string, unknown>; created_at: string; grade?: number | null; request_id?: string };
export type PedagogicalLevel = 'needs_support' | 'developing' | 'autonomous';
export type PlanSessionRow = {
  id: string; scheduled_lesson_id: string; plan_id: string; activity_id: string; activity_type: 'online_lesson'; plan_revision: number;
  completed_step_keys: string[]; notes: string; evaluation_json: { comprehension?: PedagogicalLevel; practice?: PedagogicalLevel; autonomy?: PedagogicalLevel; difficulties?: string[]; recommendations?: string[]; revisitStepKeys?: string[] };
  updated_at: string;
};

export type LearningActivity = LessonActivityRow & { is_unlocked: boolean; prerequisite_ids: string[] };
export type LearningLesson = {
  id: string; title: string; description: string | null; duration_minutes: number | null;
  video_url: string | null; pdf_url: string | null; slides_url: string | null; meet_link: string | null;
};
export type ActivityMeeting = { activity_id: string; scheduled_lesson_id: string; title: string; starts_at: string; ends_at: string };
export type StudentLessonLearning = {
  lesson: LearningLesson; objectives: string[]; has_activity_model: boolean; can_complete: boolean; completed_at: string | null;
  activities: LearningActivity[]; progress: StudentActivityProgressRow[]; attempts: QuizAttemptRow[];
  submissions: ProjectSubmissionRow[]; reviews: ProjectReviewRow[]; meetings: ActivityMeeting[];
  attempt_sessions?: AssessmentSession[];
  gamification?: { xp: number; level: number; levels: import('../lib/gamification').PlayerLevel[]; achievements: { code: string; title: string; icon: string }[] };
};
