begin;
-- Canonical schemas are pinned with this migration, never fetched at runtime.
create table private.learning_content_schemas(version integer primary key, document jsonb not null);
alter table private.learning_content_schemas enable row level security;
revoke all on private.learning_content_schemas from public,anon,authenticated;
insert into private.learning_content_schemas values(1,'{"$schema":"http://json-schema.org/draft-07/schema#","$id":"urn:bitaria:learning-content:1","title":"Bitaria lesson authoring contract v1","type":"object","properties":{"schemaVersion":{"const":1},"context":{"type":"object","properties":{"courseTitle":{"type":"string","minLength":1,"maxLength":20000},"moduleTitle":{"type":"string","minLength":1,"maxLength":20000},"submoduleTitle":{"type":"string","minLength":1,"maxLength":20000}},"required":["courseTitle","moduleTitle","submoduleTitle"],"additionalProperties":false},"lesson":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"objectives":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440}},"required":["key","title","description","objectives","durationMinutes"],"additionalProperties":false},"activities":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"slides"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"slides"},"resourceUrl":{"type":"string","format":"uri","pattern":"^https://[^\\s]+$","maxLength":2048},"format":{"enum":["pdf","image","link"]},"altText":{"type":"string","minLength":1,"maxLength":20000}},"required":["schemaVersion","type","resourceUrl","format","altText"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"mindmap"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"mindmap"},"resourceUrl":{"type":"string","format":"uri","pattern":"^https://[^\\s]+$","maxLength":2048},"format":{"enum":["pdf","image","link"]},"altText":{"type":"string","minLength":1,"maxLength":20000}},"required":["schemaVersion","type","resourceUrl","format","altText"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"quiz"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"quiz"},"passingScore":{"type":"integer","minimum":0,"maximum":100},"maxAttempts":{"type":"integer","minimum":1,"maximum":100},"questions":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"prompt":{"type":"string","minLength":1,"maxLength":20000},"options":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"text":{"type":"string","minLength":1,"maxLength":20000}},"required":["key","text"],"additionalProperties":false},"minItems":2,"maxItems":12}},"required":["key","prompt","options"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["schemaVersion","type","passingScore","maxAttempts","questions"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"online_lesson"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"online_lesson"},"objective":{"type":"string","minLength":1,"maxLength":20000},"preparation":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200}},"required":["schemaVersion","type","objective","preparation"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"project"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"project"},"instructions":{"type":"string","minLength":1,"maxLength":20000},"objectives":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"requirements":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"assessmentCriteria":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"resources":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":20000},"url":{"type":"string","format":"uri","pattern":"^https://[^\\s]+$","maxLength":2048}},"required":["title","url"],"additionalProperties":false},"minItems":0,"maxItems":200}},"required":["schemaVersion","type","instructions","objectives","requirements","assessmentCriteria","resources"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false}]},"minItems":1,"maxItems":200},"teacherOnly":{"type":"object","properties":{"quizKeys":{"type":"array","items":{"type":"object","properties":{"activityKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"answers":{"type":"array","items":{"type":"object","properties":{"questionKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"optionKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"feedback":{"type":"string","minLength":1,"maxLength":20000}},"required":["questionKey","optionKey","feedback"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["schemaVersion","answers"],"additionalProperties":false}},"required":["activityKey","content"],"additionalProperties":false},"minItems":0,"maxItems":200},"lessonPlans":{"type":"array","items":{"type":"object","properties":{"activityKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"objectives":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"prerequisites":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200},"preparation":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"steps":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"title":{"type":"string","minLength":1,"maxLength":20000},"objective":{"type":"string","minLength":1,"maxLength":20000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"guidance":{"type":"string","minLength":1,"maxLength":20000},"code":{"type":"object","properties":{"language":{"type":"string","minLength":1,"maxLength":20000},"file":{"type":"string","minLength":1,"maxLength":20000},"source":{"type":"string","minLength":1,"maxLength":20000},"expectedResult":{"type":"string","minLength":1,"maxLength":20000}},"required":["language","file","source","expectedResult"],"additionalProperties":false},"questions":{"type":"array","items":{"type":"object","properties":{"prompt":{"type":"string","minLength":1,"maxLength":20000},"expectedAnswer":{"type":"string","minLength":1,"maxLength":20000}},"required":["prompt","expectedAnswer"],"additionalProperties":false},"minItems":0,"maxItems":200},"detailedExplanation":{"type":"string","minLength":1,"maxLength":20000},"playfulExplanation":{"type":"string","minLength":1,"maxLength":20000},"commonDifficulties":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200},"challenge":{"type":"string","minLength":1,"maxLength":20000}},"required":["key","title","objective","durationMinutes","guidance","questions","detailedExplanation","playfulExplanation","commonDifficulties","challenge"],"additionalProperties":false},"minItems":1,"maxItems":200},"assessmentCriteria":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200}},"required":["schemaVersion","objectives","prerequisites","preparation","durationMinutes","steps","assessmentCriteria"],"additionalProperties":false}},"required":["activityKey","content"],"additionalProperties":false},"minItems":0,"maxItems":200}},"required":["quizKeys","lessonPlans"],"additionalProperties":false}},"required":["schemaVersion","context","lesson","activities","teacherOnly"],"additionalProperties":false}'::jsonb);
insert into private.learning_content_schemas values(2,'{"$schema":"http://json-schema.org/draft-07/schema#","$id":"urn:bitaria:learning-content:2","title":"Bitaria lesson authoring contract v2","type":"object","properties":{"schemaVersion":{"const":2},"context":{"type":"object","properties":{"courseTitle":{"type":"string","minLength":1,"maxLength":20000},"moduleTitle":{"type":"string","minLength":1,"maxLength":20000},"submoduleTitle":{"type":"string","minLength":1,"maxLength":20000}},"required":["courseTitle","moduleTitle","submoduleTitle"],"additionalProperties":false},"lesson":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"objectives":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440}},"required":["key","title","description","objectives","durationMinutes"],"additionalProperties":false},"activities":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"slides"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"slides"},"resourceUrl":{"type":"string","format":"uri","pattern":"^https://[^\\s]+$","maxLength":2048},"format":{"enum":["pdf","image","link"]},"altText":{"type":"string","minLength":1,"maxLength":20000}},"required":["schemaVersion","type","resourceUrl","format","altText"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"mindmap"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"mindmap"},"resourceUrl":{"type":"string","format":"uri","pattern":"^https://[^\\s]+$","maxLength":2048},"format":{"enum":["pdf","image","link"]},"altText":{"type":"string","minLength":1,"maxLength":20000}},"required":["schemaVersion","type","resourceUrl","format","altText"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"quiz"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"quiz"},"passingScore":{"type":"integer","minimum":0,"maximum":100},"maxAttempts":{"type":"integer","minimum":1,"maximum":100},"questions":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"prompt":{"type":"string","minLength":1,"maxLength":20000},"options":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"text":{"type":"string","minLength":1,"maxLength":20000}},"required":["key","text"],"additionalProperties":false},"minItems":2,"maxItems":12}},"required":["key","prompt","options"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["schemaVersion","type","passingScore","maxAttempts","questions"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"online_lesson"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"online_lesson"},"objective":{"type":"string","minLength":1,"maxLength":20000},"preparation":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200}},"required":["schemaVersion","type","objective","preparation"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"project"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"type":{"const":"project"},"instructions":{"type":"string","minLength":1,"maxLength":20000},"objectives":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"requirements":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"assessmentCriteria":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"resources":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":20000},"url":{"type":"string","format":"uri","pattern":"^https://[^\\s]+$","maxLength":2048}},"required":["title","url"],"additionalProperties":false},"minItems":0,"maxItems":200}},"required":["schemaVersion","type","instructions","objectives","requirements","assessmentCriteria","resources"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"interactive"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":2},"type":{"const":"interactive"},"interactionType":{"const":"ordering"},"instructions":{"type":"string","minLength":1,"maxLength":20000},"passingScore":{"type":"integer","minimum":0,"maximum":100},"maxAttempts":{"type":"integer","minimum":1,"maximum":100},"items":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"label":{"type":"string","minLength":1,"maxLength":20000}},"required":["id","label"],"additionalProperties":false},"minItems":2,"maxItems":50}},"required":["schemaVersion","type","interactionType","instructions","passingScore","maxAttempts","items"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false},{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"interactive"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":2},"type":{"const":"interactive"},"interactionType":{"const":"matching"},"instructions":{"type":"string","minLength":1,"maxLength":20000},"passingScore":{"type":"integer","minimum":0,"maximum":100},"maxAttempts":{"type":"integer","minimum":1,"maximum":100},"leftItems":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"label":{"type":"string","minLength":1,"maxLength":20000}},"required":["id","label"],"additionalProperties":false},"minItems":2,"maxItems":50},"rightItems":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"label":{"type":"string","minLength":1,"maxLength":20000}},"required":["id","label"],"additionalProperties":false},"minItems":2,"maxItems":50}},"required":["schemaVersion","type","interactionType","instructions","passingScore","maxAttempts","leftItems","rightItems"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false}]},"minItems":1,"maxItems":200},"teacherOnly":{"type":"object","properties":{"quizKeys":{"type":"array","items":{"type":"object","properties":{"activityKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"answers":{"type":"array","items":{"type":"object","properties":{"questionKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"optionKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"feedback":{"type":"string","minLength":1,"maxLength":20000}},"required":["questionKey","optionKey","feedback"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["schemaVersion","answers"],"additionalProperties":false}},"required":["activityKey","content"],"additionalProperties":false},"minItems":0,"maxItems":200},"lessonPlans":{"type":"array","items":{"type":"object","properties":{"activityKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"content":{"type":"object","properties":{"schemaVersion":{"const":1},"objectives":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200},"prerequisites":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200},"preparation":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"steps":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"title":{"type":"string","minLength":1,"maxLength":20000},"objective":{"type":"string","minLength":1,"maxLength":20000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"guidance":{"type":"string","minLength":1,"maxLength":20000},"code":{"type":"object","properties":{"language":{"type":"string","minLength":1,"maxLength":20000},"file":{"type":"string","minLength":1,"maxLength":20000},"source":{"type":"string","minLength":1,"maxLength":20000},"expectedResult":{"type":"string","minLength":1,"maxLength":20000}},"required":["language","file","source","expectedResult"],"additionalProperties":false},"questions":{"type":"array","items":{"type":"object","properties":{"prompt":{"type":"string","minLength":1,"maxLength":20000},"expectedAnswer":{"type":"string","minLength":1,"maxLength":20000}},"required":["prompt","expectedAnswer"],"additionalProperties":false},"minItems":0,"maxItems":200},"detailedExplanation":{"type":"string","minLength":1,"maxLength":20000},"playfulExplanation":{"type":"string","minLength":1,"maxLength":20000},"commonDifficulties":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":0,"maxItems":200},"challenge":{"type":"string","minLength":1,"maxLength":20000}},"required":["key","title","objective","durationMinutes","guidance","questions","detailedExplanation","playfulExplanation","commonDifficulties","challenge"],"additionalProperties":false},"minItems":1,"maxItems":200},"assessmentCriteria":{"type":"array","items":{"type":"string","minLength":1,"maxLength":20000},"minItems":1,"maxItems":200}},"required":["schemaVersion","objectives","prerequisites","preparation","durationMinutes","steps","assessmentCriteria"],"additionalProperties":false}},"required":["activityKey","content"],"additionalProperties":false},"minItems":0,"maxItems":200},"interactiveKeys":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"activityKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"content":{"type":"object","properties":{"schemaVersion":{"const":2},"interactionType":{"const":"ordering"},"feedback":{"type":"string","minLength":1,"maxLength":20000},"correctOrder":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":2,"maxItems":50,"uniqueItems":true}},"required":["schemaVersion","interactionType","feedback","correctOrder"],"additionalProperties":false}},"required":["activityKey","content"],"additionalProperties":false},{"type":"object","properties":{"activityKey":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"content":{"type":"object","properties":{"schemaVersion":{"const":2},"interactionType":{"const":"matching"},"feedback":{"type":"string","minLength":1,"maxLength":20000},"pairs":{"type":"array","items":{"type":"object","properties":{"leftId":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"rightId":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"}},"required":["leftId","rightId"],"additionalProperties":false},"minItems":2,"maxItems":50}},"required":["schemaVersion","interactionType","feedback","pairs"],"additionalProperties":false}},"required":["activityKey","content"],"additionalProperties":false}]},"minItems":0,"maxItems":200}},"required":["quizKeys","lessonPlans","interactiveKeys"],"additionalProperties":false}},"required":["schemaVersion","context","lesson","activities","teacherOnly"],"additionalProperties":false}'::jsonb);

create function private.learning_json_matches(s jsonb,v jsonb,depth integer default 0) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare t text; k text; child jsonb; matches integer;
begin
 if depth>64 then return false; end if;
 if s ? 'oneOf' then
   select count(*) into matches from jsonb_array_elements(s->'oneOf') x where private.learning_json_matches(x,v,depth+1);
   if matches<>1 then return false; end if;
 end if;
 if s ? 'const' and v is distinct from s->'const' then return false; end if;
 if s ? 'enum' and not exists(select 1 from jsonb_array_elements(s->'enum') x where x=v) then return false; end if;
 t:=s->>'type';
 if t is not null and (v is null or (t='integer' and (jsonb_typeof(v)<>'number' or (v::text)::numeric<>trunc((v::text)::numeric)))
   or (t<>'integer' and jsonb_typeof(v)<>t)) then return false; end if;
 if jsonb_typeof(v)='string' then
   t:=v#>>'{}';
   if length(t)<coalesce((s->>'minLength')::int,0) or length(t)>coalesce((s->>'maxLength')::int,2147483647)
      or (s ? 'pattern' and t !~ (s->>'pattern'))
      or (s->>'format'='uri' and t !~ '^https://[^/?#[:space:]]+([/?#].*)?$') then return false; end if;
 elsif jsonb_typeof(v)='number' then
   if (s ? 'minimum' and (v::text)::numeric<(s->>'minimum')::numeric) or (s ? 'maximum' and (v::text)::numeric>(s->>'maximum')::numeric) then return false; end if;
 elsif jsonb_typeof(v)='array' then
   if jsonb_array_length(v)<coalesce((s->>'minItems')::int,0) or jsonb_array_length(v)>coalesce((s->>'maxItems')::int,2147483647) then return false; end if;
   if s->>'uniqueItems'='true' and (select count(distinct x) from jsonb_array_elements(v) x)<>jsonb_array_length(v) then return false; end if;
   if s ? 'items' then for child in select value from jsonb_array_elements(v) loop
     if not private.learning_json_matches(s->'items',child,depth+1) then return false; end if;
   end loop; end if;
 elsif jsonb_typeof(v)='object' then
   if exists(select 1 from jsonb_array_elements_text(coalesce(s->'required','[]')) x where not(v ? x)) then return false; end if;
   for k,child in select * from jsonb_each(v) loop
     if s->'properties' ? k then
       if not private.learning_json_matches(s->'properties'->k,child,depth+1) then return false; end if;
     elsif s->>'additionalProperties'='false' then return false; end if;
   end loop;
 end if;
 return true;
exception when others then return false;
end $$;
revoke all on function private.learning_json_matches(jsonb,jsonb,integer) from public,anon,authenticated;

create or replace function private.learning_public_content_valid(kind text,content jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare spec jsonb;
begin
 for spec in select variant->'properties'->'content' from private.learning_content_schemas s,
   jsonb_array_elements(s.document->'properties'->'activities'->'items'->'oneOf') variant
   where variant->'properties'->'type'->>'const'=kind loop
   if private.learning_json_matches(spec,content) then return true; end if;
 end loop;
 return false;
end $$;
revoke all on function private.learning_public_content_valid(text,jsonb) from public,anon;
grant execute on function private.learning_public_content_valid(text,jsonb) to authenticated,service_role;

alter table public.lesson_activities drop constraint lesson_activities_activity_type_check;
alter table public.lesson_activities add constraint lesson_activities_activity_type_check check(activity_type in ('slides','mindmap','quiz','online_lesson','project','interactive'));
alter table public.lesson_activities add column gamification_json jsonb not null default '{}';
alter table public.activity_quiz_keys drop constraint activity_quiz_keys_activity_type_check;
alter table public.activity_quiz_keys add constraint activity_quiz_keys_activity_type_check check(activity_type in ('quiz','interactive'));
alter table public.activity_quiz_keys drop constraint activity_quiz_keys_content_json_check;
alter table public.activity_quiz_keys add constraint activity_quiz_keys_content_json_check check(jsonb_typeof(content_json)='object' and content_json->>'schemaVersion' in ('1','2'));
alter table public.quiz_attempts drop constraint quiz_attempts_activity_type_check;
alter table public.quiz_attempts add constraint quiz_attempts_activity_type_check check(activity_type in ('quiz','interactive'));
alter table public.quiz_attempts add column presentation_json jsonb not null default '{}' check(jsonb_typeof(presentation_json)='object');

create function private.learning_interactive_key_valid(a jsonb,k jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare spec jsonb; ids jsonb; n integer;
begin
 if a->>'type'<>'interactive' or a->>'interactionType' is distinct from k->>'interactionType' then return false; end if;
 select document->'properties'->'teacherOnly'->'properties'->'interactiveKeys'->'items' into spec from private.learning_content_schemas where version=2;
 if not private.learning_json_matches(spec,jsonb_build_object('activityKey','activity','content',k)) then return false; end if;
 if a->>'interactionType'='ordering' then
   ids:=a->'items'; n:=jsonb_array_length(ids);
   return jsonb_array_length(k->'correctOrder')=n and n=(select count(distinct i->>'id') from jsonb_array_elements(ids) i)
     and not exists(select 1 from jsonb_array_elements_text(k->'correctOrder') x where not exists(select 1 from jsonb_array_elements(ids) i where i->>'id'=x));
 end if;
 n:=jsonb_array_length(a->'leftItems');
 return n=jsonb_array_length(a->'rightItems') and n=jsonb_array_length(k->'pairs')
   and n=(select count(distinct i->>'id') from jsonb_array_elements(a->'leftItems') i)
   and n=(select count(distinct i->>'id') from jsonb_array_elements(a->'rightItems') i)
   and n=(select count(distinct p->>'leftId') from jsonb_array_elements(k->'pairs') p)
   and n=(select count(distinct p->>'rightId') from jsonb_array_elements(k->'pairs') p)
   and not exists(select 1 from jsonb_array_elements(k->'pairs') p where
     not exists(select 1 from jsonb_array_elements(a->'leftItems') i where i->>'id'=p->>'leftId')
     or not exists(select 1 from jsonb_array_elements(a->'rightItems') i where i->>'id'=p->>'rightId'));
end $$;
revoke all on function private.learning_interactive_key_valid(jsonb,jsonb) from public,anon,authenticated;

create function private.learning_validate_reward(kind text,g jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare spec jsonb; rule text;
begin
 if g='{}' then return true; end if;
 select document->'properties'->'activities'->'items'->'oneOf'->0->'properties'->'gamification' into spec from private.learning_content_schemas where version=2;
 if not private.learning_json_matches(spec,g) then return false; end if;
 rule:=g->>'rewardRuleKey';
 return (case kind when 'quiz' then rule='activity_quiz' when 'interactive' then rule='activity_interactive'
   when 'slides' then rule='activity_study' when 'mindmap' then rule='activity_study'
   when 'online_lesson' then rule='activity_online' when 'project' then rule in ('activity_project','activity_final_project') else false end)
   and g->>'awardOn'=case kind when 'project' then 'approved' when 'online_lesson' then 'teacher_confirmed' else 'completed' end
   and exists(select 1 from public.xp_reward_rules where event_type=rule)
   and not exists(select 1 from jsonb_array_elements_text(g->'achievementKeys') codes(value)
     where not exists(select 1 from public.achievement_definitions d where d.code=codes.value and d.is_custom));
end $$;
revoke all on function private.learning_validate_reward(text,jsonb) from public,anon,authenticated;

-- Randomness comes from the random bits of UUID v4. Rejection sampling avoids
-- modulo bias; Fisher-Yates never edits the authoring JSON or the correction key.
create function private.learning_shuffle(ids text[],previous jsonb default null) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare i integer; j integer; draw bigint; lim bigint; temp text; n integer:=cardinality(ids);
begin
 if n>1 then
 for i in reverse n..2 loop
   lim:=4294967296-(4294967296%i);
   loop draw:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint; exit when draw<lim; end loop;
   j:=(draw%i)::int+1; temp:=ids[i]; ids[i]:=ids[j]; ids[j]:=temp;
 end loop;
 if to_jsonb(ids)=previous then ids:=ids[2:n]||ids[1]; end if;
 end if;
 return coalesce(to_jsonb(ids),'[]'::jsonb);
end $$;
revoke all on function private.learning_shuffle(text[],jsonb) from public,anon,authenticated;

create table public.activity_attempt_sessions(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),
 activity_id uuid not null,activity_revision integer not null,attempt_number integer not null check(attempt_number>0),
 presentation_json jsonb not null check(jsonb_typeof(presentation_json)='object'),
 started_at timestamptz not null default now(),submitted_at timestamptz,
 unique(student_id,activity_id,attempt_number),
 foreign key(activity_id,activity_revision) references public.lesson_activities(id,revision) on delete restrict
);
create index activity_attempt_sessions_activity on public.activity_attempt_sessions(activity_id,student_id);
alter table public.activity_attempt_sessions enable row level security;
revoke all on public.activity_attempt_sessions from public,anon,authenticated;
grant select on public.activity_attempt_sessions to authenticated;
grant all on public.activity_attempt_sessions to service_role;
create policy learning_attempt_sessions_read on public.activity_attempt_sessions for select to authenticated using(
 (private.learning_role()='student' and student_id=(select auth.uid())) or private.learning_manages_student(student_id));
create function private.learning_guard_attempt_session() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Tentativa imutavel.' using errcode='23514'; end if;
 if (to_jsonb(new)-'submitted_at') is distinct from (to_jsonb(old)-'submitted_at') or old.submitted_at is not null then
   raise exception 'Apresentacao da tentativa imutavel.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.learning_guard_attempt_session() from public,anon,authenticated;
create trigger learning_guard_attempt_session before update or delete on public.activity_attempt_sessions for each row execute function private.learning_guard_attempt_session();

create function private.learning_begin_assessment(p_activity_id uuid,p_requested_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; s public.activity_attempt_sessions; last_order jsonb; presentation jsonb:='{}'; q jsonb; number integer;
begin
 if auth.uid() is null or private.learning_role() is distinct from 'student' then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() and is_active and role='student' for update;
 if not found then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501'; end if;
 select * into a from public.lesson_activities where id=p_activity_id and activity_type in ('quiz','interactive') and is_active and publication_status='published' for share;
 if not found then raise exception 'Atividade indisponivel.' using errcode='42501'; end if;
 perform private.learning_require_student_lesson(a.lesson_id);
 if not private.learning_prerequisites_complete(auth.uid(),a.id) then raise exception 'Conclua os pre-requisitos desta atividade.' using errcode='23514'; end if;
 if exists(select 1 from public.student_activity_progress where student_id=auth.uid() and activity_id=a.id and status='completed') then raise exception 'Esta atividade ja foi aprovada.' using errcode='23514'; end if;
 select * into s from public.activity_attempt_sessions where student_id=auth.uid() and activity_id=a.id and submitted_at is null;
 if found then
   if p_requested_id is not null and p_requested_id<>s.id then raise exception 'Retome a tentativa em andamento.' using errcode='23514'; end if;
   return to_jsonb(s);
 end if;
 select coalesce(max(attempt_number),0)+1 into number from public.quiz_attempts where student_id=auth.uid() and activity_id=a.id;
 if number>(a.content_json->>'maxAttempts')::integer then raise exception 'Limite de tentativas atingido. Converse com sua professora.' using errcode='23514'; end if;
 select presentation_json into last_order from public.activity_attempt_sessions where student_id=auth.uid() and activity_id=a.id order by attempt_number desc limit 1;
 if a.activity_type='quiz' then
   presentation:=jsonb_build_object('quiz','{}'::jsonb);
   for q in select value from jsonb_array_elements(a.content_json->'questions') loop
     presentation:=jsonb_set(presentation,array['quiz',q->>'key'],private.learning_shuffle(array(select o->>'key' from jsonb_array_elements(q->'options') o),last_order->'quiz'->(q->>'key')));
   end loop;
 elsif a.content_json->>'interactionType'='ordering' then
   presentation:=jsonb_build_object('items',private.learning_shuffle(array(select i->>'id' from jsonb_array_elements(a.content_json->'items') i),last_order->'items'));
 else
   presentation:=jsonb_build_object('left',private.learning_shuffle(array(select i->>'id' from jsonb_array_elements(a.content_json->'leftItems') i),last_order->'left'),
     'right',private.learning_shuffle(array(select i->>'id' from jsonb_array_elements(a.content_json->'rightItems') i),last_order->'right'));
 end if;
 insert into public.activity_attempt_sessions(id,student_id,activity_id,activity_revision,attempt_number,presentation_json)
   values(coalesce(p_requested_id,gen_random_uuid()),auth.uid(),a.id,a.revision,number,presentation) returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function private.learning_begin_assessment(uuid,uuid) from public,anon;
grant execute on function private.learning_begin_assessment(uuid,uuid) to authenticated;
create function public.begin_student_assessment(p_activity_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.learning_begin_assessment(p_activity_id);$$;
revoke all on function public.begin_student_assessment(uuid) from public,anon;
grant execute on function public.begin_student_assessment(uuid) to authenticated;

create or replace function private.learning_guard_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare answers jsonb;
begin
  if tg_op='UPDATE' then
    if old.published_at is not null and
      (to_jsonb(new)-array['updated_at','is_active','publication_status']) is distinct from
      (to_jsonb(old)-array['updated_at','is_active','publication_status']) then
      raise exception 'Atividade publicada e imutavel; crie uma nova revisao.' using errcode='23514';
    end if;
    new.published_at := old.published_at;
  end if;
  if not private.learning_validate_reward(new.activity_type,new.gamification_json) then raise exception 'Regra de recompensa invalida.' using errcode='23514'; end if;
  if new.publication_status='published' then
    if new.activity_type='interactive' and not coalesce(private.learning_interactive_key_valid(new.content_json,(select content_json from public.activity_quiz_keys where activity_id=new.id)),false) then raise exception 'Gabarito interativo invalido.' using errcode='23514'; end if;
    if new.activity_type='quiz' then
      select content_json->'answers' into answers from public.activity_quiz_keys where activity_id=new.id;
      if answers is null or jsonb_typeof(answers)<>'array' then
        raise exception 'Publicacao exige gabarito valido.' using errcode='23514';
      end if;
      if jsonb_array_length(answers)<>jsonb_array_length(new.content_json->'questions')
        or (select count(distinct a->>'questionKey') from jsonb_array_elements(answers) a)<>jsonb_array_length(answers)
        or exists(select 1 from jsonb_array_elements(answers) a where not exists (
          select 1 from jsonb_array_elements(new.content_json->'questions') q,
            jsonb_array_elements(q->'options') o where q->>'key'=a->>'questionKey' and o->>'key'=a->>'optionKey')) then
        raise exception 'Publicacao exige gabarito completo e consistente.' using errcode='23514';
      end if;
    end if;
    if new.activity_type='online_lesson' and not exists(select 1 from public.teacher_lesson_plans where activity_id=new.id) then
      raise exception 'Publicacao exige plano pedagogico.' using errcode='23514';
    end if;
    new.published_at := coalesce(new.published_at,now());
  end if;
  new.updated_at := now(); return new;
end;
$$;

create function private.learning_submit_assessment(p_activity_id uuid,p_answers jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare session public.activity_attempt_sessions; a public.lesson_activities; previous public.quiz_attempts; attempt public.quiz_attempts;
  answer_key jsonb; feedback jsonb; question_count integer; correct_count integer; attempt_number integer; score numeric(5,2); passed boolean;
begin
  if auth.uid() is null or private.learning_role() is distinct from 'student' then
    raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=auth.uid() and is_active and role='student' for update;
  if not found then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501'; end if;
  select * into a from public.lesson_activities where id=p_activity_id and is_active
    and publication_status='published' and activity_type in ('quiz','interactive') for share;
  if not found then raise exception 'Questionario indisponivel.' using errcode='42501'; end if;
  perform private.learning_require_student_lesson(a.lesson_id);
  if p_request_id is null then raise exception 'Identificador da submissao obrigatorio.' using errcode='22023'; end if;
  select * into previous from public.quiz_attempts where student_id=auth.uid() and activity_id=a.id and request_id=p_request_id;
  if found then
    if previous.answers_json is distinct from p_answers then
      raise exception 'Identificador ja utilizado com outras respostas.' using errcode='22023';
    end if;
    return to_jsonb(previous);
  end if;
  if not private.learning_prerequisites_complete(auth.uid(),a.id) then
    raise exception 'Conclua os pre-requisitos desta atividade.' using errcode='23514';
  end if;
  if exists(select 1 from public.student_activity_progress where student_id=auth.uid() and activity_id=a.id and status='completed') then
    raise exception 'Este questionario ja foi aprovado.' using errcode='23514';
  end if;
  select coalesce(max(q.attempt_number),0)+1 into attempt_number from public.quiz_attempts q where q.student_id=auth.uid() and q.activity_id=a.id;
  if attempt_number>(a.content_json->>'maxAttempts')::integer then
    raise exception 'Limite de tentativas atingido. Converse com sua professora.' using errcode='23514';
  end if;
  if exists(select 1 from public.activity_attempt_sessions where id=p_request_id and (student_id<>auth.uid() or activity_id<>a.id)) then
    raise exception 'Tentativa indisponivel.' using errcode='42501'; end if;
  perform private.learning_begin_assessment(a.id,p_request_id);
  select * into session from public.activity_attempt_sessions where id=p_request_id and student_id=auth.uid() and activity_id=a.id;
  if not found or session.submitted_at is not null then raise exception 'Tentativa indisponivel.' using errcode='23514'; end if;
  if a.activity_type='quiz' then
  question_count:=jsonb_array_length(a.content_json->'questions');
  if p_answers is null or jsonb_typeof(p_answers)<>'object' then
    raise exception 'Envie uma alternativa para cada pergunta.' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_answers))<>question_count or exists(
    select 1 from jsonb_array_elements(a.content_json->'questions') q where not exists (
      select 1 from jsonb_array_elements(q->'options') o
      where jsonb_typeof(p_answers->(q->>'key'))='string' and o->>'key'=p_answers->>(q->>'key'))) then
    raise exception 'Respostas incompletas ou alternativas invalidas.' using errcode='22023';
  end if;
  select content_json->'answers' into answer_key from public.activity_quiz_keys where activity_id=a.id;
  if answer_key is null or jsonb_array_length(answer_key)<>question_count or question_count=0
    or (select count(distinct q->>'key') from jsonb_array_elements(a.content_json->'questions') q)<>question_count
    or (select count(distinct k->>'questionKey') from jsonb_array_elements(answer_key) k)<>question_count
    or exists(select 1 from jsonb_array_elements(answer_key) k where not exists (
      select 1 from jsonb_array_elements(a.content_json->'questions') q,jsonb_array_elements(q->'options') o
      where q->>'key'=k->>'questionKey' and o->>'key'=k->>'optionKey')) then
    raise exception 'Questionario com configuracao invalida. Avise sua professora.' using errcode='23514';
  end if;
  select count(*) filter(where p_answers->>(k->>'questionKey')=k->>'optionKey'),
    jsonb_agg(jsonb_build_object('questionKey',k->>'questionKey','isCorrect',p_answers->>(k->>'questionKey')=k->>'optionKey','feedback',k->>'feedback'))
    into correct_count,feedback from jsonb_array_elements(answer_key) k;
  else
    select content_json into answer_key from public.activity_quiz_keys where activity_id=a.id;
    if not coalesce(private.learning_interactive_key_valid(a.content_json,answer_key),false) then raise exception 'Configuracao interativa invalida.' using errcode='23514'; end if;
    if p_answers is null or jsonb_typeof(p_answers)<>'object' then raise exception 'Resposta invalida.' using errcode='22023'; end if;
    if a.content_json->>'interactionType'='ordering' then
      if jsonb_typeof(p_answers->'sequence') is distinct from 'array' or p_answers-array['sequence']<>'{}' then raise exception 'Envie uma sequencia de IDs.' using errcode='22023'; end if;
      question_count:=jsonb_array_length(a.content_json->'items');
      if jsonb_array_length(p_answers->'sequence')<>question_count or (select count(distinct v) from jsonb_array_elements(p_answers->'sequence') v)<>question_count
        or exists(select 1 from jsonb_array_elements(p_answers->'sequence') v where jsonb_typeof(v)<>'string' or not exists(select 1 from jsonb_array_elements(a.content_json->'items') i where i->'id'=v)) then raise exception 'Sequencia invalida.' using errcode='22023'; end if;
      correct_count:=case when p_answers->'sequence'=answer_key->'correctOrder' then question_count else 0 end;
      feedback:=jsonb_build_array(jsonb_build_object('questionKey','ordering','isCorrect',correct_count=question_count,'feedback',answer_key->>'feedback'));
    else
      if jsonb_typeof(p_answers->'pairs') is distinct from 'object' or p_answers-array['pairs']<>'{}' then raise exception 'Envie associacoes por ID.' using errcode='22023'; end if;
      question_count:=jsonb_array_length(a.content_json->'leftItems');
      if (select count(*) from jsonb_object_keys(p_answers->'pairs'))<>question_count
        or (select count(distinct v) from jsonb_each(p_answers->'pairs') e(k,v))<>question_count
        or exists(select 1 from jsonb_each(p_answers->'pairs') e(k,v) where jsonb_typeof(v)<>'string'
          or not exists(select 1 from jsonb_array_elements(a.content_json->'leftItems') i where i->>'id'=e.k)
          or not exists(select 1 from jsonb_array_elements(a.content_json->'rightItems') i where i->'id'=e.v)) then raise exception 'Associacoes invalidas.' using errcode='22023'; end if;
      select count(*) filter(where p_answers->'pairs'->>(k->>'leftId')=k->>'rightId'),
        jsonb_agg(jsonb_build_object('questionKey',k->>'leftId','isCorrect',p_answers->'pairs'->>(k->>'leftId')=k->>'rightId','feedback',answer_key->>'feedback'))
        into correct_count,feedback from jsonb_array_elements(answer_key->'pairs') k;
    end if;
  end if;
  score:=round(100.0*correct_count/question_count,2);
  passed:=score>=(a.content_json->>'passingScore')::numeric;
  insert into public.quiz_attempts(student_id,activity_id,activity_revision,attempt_number,answers_json,score,passed,request_id,feedback_json,activity_type,presentation_json)
    values(auth.uid(),a.id,a.revision,attempt_number,p_answers,score,passed,p_request_id,feedback,a.activity_type,session.presentation_json) returning * into attempt;
  insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at)
    values(auth.uid(),a.id,a.revision,case when passed then 'completed' else 'in_progress' end,now(),case when passed then now() end)
  on conflict(student_id,activity_id) do update set status=excluded.status,
    started_at=coalesce(student_activity_progress.started_at,excluded.started_at),completed_at=excluded.completed_at;
  update public.activity_attempt_sessions set submitted_at=now() where id=session.id;
  return to_jsonb(attempt);
end;
$$;

revoke all on function private.learning_submit_assessment(uuid,jsonb,uuid) from public,anon;
grant execute on function private.learning_submit_assessment(uuid,jsonb,uuid) to authenticated;
create or replace function private.learning_submit_quiz(p_activity_id uuid,p_answers jsonb,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.learning_submit_assessment(p_activity_id,p_answers,p_request_id);$$;
create function public.submit_student_assessment(p_activity_id uuid,p_answers jsonb,p_session_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.learning_submit_assessment(p_activity_id,p_answers,p_session_id);$$;
revoke all on function public.submit_student_assessment(uuid,jsonb,uuid) from public,anon;
grant execute on function public.submit_student_assessment(uuid,jsonb,uuid) to authenticated;

-- No existing reward values or level thresholds change. New rules are opt-in.
alter table public.xp_reward_rules drop constraint xp_reward_rules_event_type_check;
alter table public.xp_reward_rules add constraint xp_reward_rules_event_type_check check(event_type in(
 'welcome','lesson','scheduled_lesson','module','course','evaluation','evaluation_star',
 'activity_quiz','activity_interactive','activity_study','activity_online','activity_project','activity_final_project','submodule_completion'));
insert into public.xp_reward_rules values('activity_quiz',0),('activity_interactive',0),('activity_study',0),('activity_online',0),('activity_project',0),('activity_final_project',0),('submodule_completion',0);
alter table public.student_xp_events add column reward_context jsonb not null default '{}';

create function private.learning_guard_reward_receipt() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.event_type in ('learning_activity','learning_submodule') then
   if tg_op='DELETE' or (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active') then
     raise exception 'Recompensa auditavel e imutavel.' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function private.learning_guard_reward_receipt() from public,anon,authenticated;
create trigger learning_guard_reward_receipt before update or delete on public.student_xp_events for each row execute function private.learning_guard_reward_receipt();

-- Existing recomputation resets derived events/achievements. Restore only
-- immutable receipts; never recalculate historical XP from newly edited JSON.
alter function private.sync_student_masteries(uuid) rename to sync_student_pre_learning_masteries;
create function private.sync_student_masteries(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_student_pre_learning_masteries(p_student_id);
 insert into public.student_achievements(student_id,code)
 select distinct p_student_id,code from public.student_xp_events e
 cross join lateral jsonb_array_elements_text(coalesce(e.reward_context->'achievementKeys','[]')) code
 where e.student_id=p_student_id and e.event_type='learning_activity' and e.active
 on conflict(student_id,code) do update set active=true;
end $$;
revoke all on function private.sync_student_masteries(uuid) from public,anon,authenticated;
alter function private.sync_student_xp(uuid) rename to sync_student_pre_learning_xp;
create function private.sync_student_xp(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_student_pre_learning_xp(p_student_id);
 update public.student_xp_events set active=true where student_id=p_student_id and event_type in ('learning_activity','learning_submodule');
 update public.profiles set xp_points=(select coalesce(sum(points),0)::integer from public.student_xp_events where student_id=p_student_id and active) where id=p_student_id;
 perform private.sync_student_masteries(p_student_id);
end $$;
revoke all on function private.sync_student_xp(uuid) from public,anon,authenticated;

create function private.learning_award_activity(p_student_id uuid,p_activity_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; points integer; approved boolean;
begin
 perform 1 from public.profiles where id=p_student_id and role='student' and is_active for update;
 if not found then return; end if;
 select * into a from public.lesson_activities where id=p_activity_id;
 if not found or a.gamification_json='{}' or not exists(select 1 from public.student_activity_progress
   where student_id=p_student_id and activity_id=a.id and activity_revision=a.revision and status='completed') then return; end if;
 if a.activity_type in ('quiz','interactive') and not exists(select 1 from public.quiz_attempts where student_id=p_student_id and activity_id=a.id and passed) then return; end if;
 if a.activity_type='project' then
   select r.status='approved' and exists(select 1 from public.profiles p where p.id=r.reviewed_by and p.is_active and
     (p.role='admin' or (p.role='professor' and exists(select 1 from public.teacher_student_relations where teacher_id=p.id and student_id=p_student_id)))) into approved
   from public.project_submissions s join public.project_submission_reviews r on r.submission_id=s.id
   where s.student_id=p_student_id and s.activity_id=a.id
     and s.version=(select max(version) from public.project_submissions where student_id=p_student_id and activity_id=a.id)
   order by r.created_at desc,r.id desc limit 1;
   if approved is distinct from true then return; end if;
 end if;
 select r.points into points from public.xp_reward_rules r where r.event_type=a.gamification_json->>'rewardRuleKey';
 if points is null then return; end if;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
 values(p_student_id,'learning_activity',a.id,a.title,points,a.gamification_json||jsonb_build_object('activityRevision',a.revision))
 on conflict(student_id,event_type,source_id) do nothing;
 perform private.sync_student_xp(p_student_id);
end $$;
revoke all on function private.learning_award_activity(uuid,uuid) from public,anon,authenticated;
create function private.learning_award_activity_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='completed' and (tg_op='INSERT' or old.status is distinct from 'completed') then perform private.learning_award_activity(new.student_id,new.activity_id); end if;
 return null;
end $$;
revoke all on function private.learning_award_activity_trigger() from public,anon,authenticated;
create trigger learning_award_activity after insert or update on public.student_activity_progress for each row execute function private.learning_award_activity_trigger();
create function private.learning_award_project_review() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.project_submissions;
begin
 if new.status='approved' then select * into s from public.project_submissions where id=new.submission_id; perform private.learning_award_activity(s.student_id,s.activity_id); end if;
 return null;
end $$;
revoke all on function private.learning_award_project_review() from public,anon,authenticated;
create trigger learning_award_project_review after insert on public.project_submission_reviews for each row execute function private.learning_award_project_review();
create function private.learning_award_submodule() returns trigger language plpgsql security definer set search_path='' as $$
declare sub uuid; points integer; title text;
begin
 if new.completed_at is null or (tg_op='UPDATE' and old.completed_at is not null) then return null; end if;
 select l.submodule_id into sub from public.lessons l where l.id=new.lesson_id;
 select r.points into points from public.xp_reward_rules r where r.event_type='submodule_completion';
 if coalesce(points,0)=0 or exists(select 1 from public.lessons l where l.submodule_id=sub and not exists(
   select 1 from public.student_progress p where p.student_id=new.student_id and p.lesson_id=l.id and p.completed_at is not null)) then return null; end if;
 perform 1 from public.profiles where id=new.student_id and role='student' for update;
 select m.title into title from public.submodules s join public.modules m on m.id=s.module_id where s.id=sub and s.is_active;
 if title is null then return null; end if;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
 values(new.student_id,'learning_submodule',sub,title,points,'{"rewardRuleKey":"submodule_completion"}') on conflict(student_id,event_type,source_id) do nothing;
 perform private.sync_student_xp(new.student_id); return null;
end $$;
revoke all on function private.learning_award_submodule() from public,anon,authenticated;
create trigger learning_award_submodule after insert or update on public.student_progress for each row execute function private.learning_award_submodule();

alter function private.learning_student_lesson(uuid) rename to learning_student_lesson_before_b1;
revoke all on function private.learning_student_lesson_before_b1(uuid) from public,anon,authenticated;
create function private.learning_student_lesson(p_lesson_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.learning_student_lesson_before_b1(p_lesson_id);
 return result||jsonb_build_object('attempt_sessions',coalesce((select jsonb_agg(to_jsonb(s)) from public.activity_attempt_sessions s
   join public.lesson_activities a on a.id=s.activity_id where s.student_id=auth.uid() and a.lesson_id=p_lesson_id and a.is_active and a.publication_status='published'),'[]'::jsonb),
 'gamification',jsonb_build_object('xp',(select xp_points from public.profiles where id=auth.uid()),'level',(select level from public.profiles where id=auth.uid()),
 'levels',(select jsonb_agg(to_jsonb(l) order by l.level) from public.player_levels l),'achievements',coalesce((select jsonb_agg(jsonb_build_object('code',s.code,'title',d.title,'icon',d.icon))
   from public.student_achievements s join public.achievement_definitions d on d.code=s.code where s.student_id=auth.uid() and s.active),'[]'::jsonb)));
end $$;
revoke all on function private.learning_student_lesson(uuid) from public,anon;
grant execute on function private.learning_student_lesson(uuid) to authenticated;
create function private.learning_import_lesson(p_lesson_id uuid,p_document jsonb,p_publish boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare spec jsonb; a jsonb; entry jsonb; k jsonb; n integer; new_id uuid; ids uuid[]:='{}';
begin
 if private.learning_role() is distinct from 'admin' then raise exception 'Somente administradores ativos podem importar conteudo.' using errcode='42501'; end if;
 if length(p_document::text)>2000000 then raise exception 'Arquivo muito grande.' using errcode='22023'; end if;
 select document into spec from private.learning_content_schemas where version::text=p_document->>'schemaVersion';
 if spec is null or not private.learning_json_matches(spec,p_document) then raise exception 'JSON fora do contrato versionado.' using errcode='22023'; end if;
 perform 1 from public.lessons l join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id join public.courses c on c.id=m.course_id
   where l.id=p_lesson_id and l.title=p_document->'lesson'->>'title' and c.title=p_document->'context'->>'courseTitle'
    and m.title=p_document->'context'->>'moduleTitle' and s.title=p_document->'context'->>'submoduleTitle' for update of l;
 if not found then raise exception 'Confira a aula, curso, modulo e submodulo de destino.' using errcode='23514'; end if;
 n:=jsonb_array_length(p_document->'activities');
 if n<>(select count(distinct x->>'key') from jsonb_array_elements(p_document->'activities') x)
   or n<>(select count(distinct x->>'orderIndex') from jsonb_array_elements(p_document->'activities') x)
   or exists(select 1 from jsonb_array_elements(p_document->'activities') x join public.lesson_activities a on a.lesson_id=p_lesson_id and a.key=x->>'key') then
   raise exception 'Chaves ou posicoes repetidas; conteudo existente nao sera sobrescrito.' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_document->'activities') x,jsonb_array_elements_text(x->'prerequisites') dep
   where not exists(select 1 from jsonb_array_elements(p_document->'activities') y where y->>'key'=dep)) or exists(
   with recursive edges(src,dst) as(select x->>'key',dep from jsonb_array_elements(p_document->'activities') x,jsonb_array_elements_text(x->'prerequisites') dep),
   paths(src,dst) as(select * from edges union select p.src,e.dst from paths p join edges e on e.src=p.dst)
   select 1 from paths where src=dst) then raise exception 'Pre-requisitos invalidos ou circulares.' using errcode='23514'; end if;
 for a in select value from jsonb_array_elements(p_document->'activities') loop
   if a->>'type'='quiz' then
     select count(*),jsonb_agg(e->'content')->0 into n,k from jsonb_array_elements(p_document->'teacherOnly'->'quizKeys') e where e->>'activityKey'=a->>'key';
     if n<>1 or jsonb_array_length(k->'answers')<>jsonb_array_length(a->'content'->'questions')
       or jsonb_array_length(k->'answers')<>(select count(distinct x->>'questionKey') from jsonb_array_elements(k->'answers') x)
       or jsonb_array_length(k->'answers')<>(select count(distinct q->>'key') from jsonb_array_elements(a->'content'->'questions') q)
       or exists(select 1 from jsonb_array_elements(a->'content'->'questions') q where jsonb_array_length(q->'options')<>(select count(distinct o->>'key') from jsonb_array_elements(q->'options') o))
       or exists(select 1 from jsonb_array_elements(k->'answers') ans where not exists(select 1 from jsonb_array_elements(a->'content'->'questions') q,jsonb_array_elements(q->'options') o where q->>'key'=ans->>'questionKey' and o->>'key'=ans->>'optionKey')) then
       raise exception 'Gabarito do questionario inconsistente.' using errcode='23514'; end if;
   elsif a->>'type'='interactive' then
     select count(*),jsonb_agg(e->'content')->0 into n,k from jsonb_array_elements(p_document->'teacherOnly'->'interactiveKeys') e where e->>'activityKey'=a->>'key';
     if n<>1 or not coalesce(private.learning_interactive_key_valid(a->'content',k),false) then raise exception 'Gabarito interativo inconsistente.' using errcode='23514'; end if;
   elsif a->>'type'='online_lesson' then
     select count(*),jsonb_agg(e->'content')->0 into n,k from jsonb_array_elements(p_document->'teacherOnly'->'lessonPlans') e where e->>'activityKey'=a->>'key';
     if n<>1 or jsonb_array_length(k->'steps')<>(select count(distinct x->>'key') from jsonb_array_elements(k->'steps') x) then raise exception 'Plano pedagogico inconsistente.' using errcode='23514'; end if;
   end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'quizKeys') loop
   if not exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=entry->>'activityKey' and x->>'type'='quiz') then raise exception 'Gabarito sem questionario.' using errcode='23514'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(coalesce(p_document->'teacherOnly'->'interactiveKeys','[]')) loop
   if not exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=entry->>'activityKey' and x->>'type'='interactive') then raise exception 'Gabarito sem atividade interativa.' using errcode='23514'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'lessonPlans') loop
   if not exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=entry->>'activityKey' and x->>'type'='online_lesson') then raise exception 'Plano sem atividade online.' using errcode='23514'; end if;
 end loop;
 for a in select value from jsonb_array_elements(p_document->'activities') loop
   insert into public.lesson_activities(lesson_id,key,title,description,activity_type,order_index,duration_minutes,is_required,content_json,gamification_json)
     values(p_lesson_id,a->>'key',a->>'title',a->>'description',a->>'type',(a->>'orderIndex')::int,(a->>'durationMinutes')::int,(a->>'required')::boolean,a->'content',coalesce(a->'gamification','{}')) returning id into new_id;
   ids:=array_append(ids,new_id);
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'quizKeys') union all select value from jsonb_array_elements(coalesce(p_document->'teacherOnly'->'interactiveKeys','[]')) loop
   insert into public.activity_quiz_keys(activity_id,activity_type,content_json)
     select id,activity_type,entry->'content' from public.lesson_activities where lesson_id=p_lesson_id and key=entry->>'activityKey';
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'lessonPlans') loop
   insert into public.teacher_lesson_plans(activity_id,revision,content_json) select id,1,entry->'content' from public.lesson_activities where lesson_id=p_lesson_id and key=entry->>'activityKey';
 end loop;
 insert into public.activity_prerequisites(activity_id,prerequisite_activity_id)
 select a.id,b.id from jsonb_array_elements(p_document->'activities') x,jsonb_array_elements_text(x->'prerequisites') d,
 public.lesson_activities a,public.lesson_activities b where a.lesson_id=p_lesson_id and b.lesson_id=p_lesson_id and a.key=x->>'key' and b.key=d;
 insert into public.lesson_learning_metadata(lesson_id,objectives) values(p_lesson_id,array(select jsonb_array_elements_text(p_document->'lesson'->'objectives')))
   on conflict(lesson_id) do update set objectives=excluded.objectives;
 update public.lessons set description=p_document->'lesson'->>'description',duration_minutes=(p_document->'lesson'->>'durationMinutes')::integer where id=p_lesson_id;
 if p_publish then update public.lesson_activities set publication_status='published' where id=any(ids); end if;
 return jsonb_build_object('activityIds',to_jsonb(ids),'published',coalesce(p_publish,false));
end $$;
revoke all on function private.learning_import_lesson(uuid,jsonb,boolean) from public,anon;
grant execute on function private.learning_import_lesson(uuid,jsonb,boolean) to authenticated;
create function public.import_learning_lesson(p_lesson_id uuid,p_document jsonb,p_publish boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.learning_import_lesson(p_lesson_id,p_document,p_publish);$$;
revoke all on function public.import_learning_lesson(uuid,jsonb,boolean) from public,anon;
grant execute on function public.import_learning_lesson(uuid,jsonb,boolean) to authenticated;
create function private.learning_publish_import(p_lesson_id uuid,p_activity_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.learning_role() is distinct from 'admin' then raise exception 'Somente administradores ativos podem publicar.' using errcode='42501'; end if;
 if coalesce(cardinality(p_activity_ids),0)=0 or cardinality(p_activity_ids)<>(select count(distinct id) from public.lesson_activities where lesson_id=p_lesson_id and id=any(p_activity_ids)) then raise exception 'Selecao de atividades invalida.' using errcode='22023'; end if;
 update public.lesson_activities set publication_status='published' where id=any(p_activity_ids);
end $$;
revoke all on function private.learning_publish_import(uuid,uuid[]) from public,anon;
grant execute on function private.learning_publish_import(uuid,uuid[]) to authenticated;
create function public.publish_learning_activities(p_lesson_id uuid,p_activity_ids uuid[]) returns void language sql security invoker set search_path='' as $$select private.learning_publish_import(p_lesson_id,p_activity_ids);$$;
revoke all on function public.publish_learning_activities(uuid,uuid[]) from public,anon;
grant execute on function public.publish_learning_activities(uuid,uuid[]) to authenticated;
commit;
