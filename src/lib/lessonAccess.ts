export const lessonReleaseTime=(startsAt:string)=>new Date(startsAt).getTime()-5*60_000;
export const lessonAccessDeadline=(startsAt:string)=>new Date(startsAt).getTime()+15*60_000;
export const isUpcomingLesson=(startsAt:string,now=Date.now())=>now<=lessonAccessDeadline(startsAt);
export const canEnterLesson=(lesson:{meet_link?:string|null;starts_at:string},now=Date.now())=>Boolean(lesson.meet_link)&&now>=lessonReleaseTime(lesson.starts_at)&&now<=lessonAccessDeadline(lesson.starts_at);
