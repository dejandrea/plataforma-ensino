import {createCurriculumDb} from './curriculum-db.mjs';
import {id,learningMigration,readSql} from './learning-test-db.mjs';
export function flashcardsDocument() {
 return {
 schemaVersion:2,context:{courseTitle:'Aula antiga',moduleTitle:'Aula antiga',submoduleTitle:'Conteúdo'},
 lesson:{key:'flashcards-isolated',title:'Cartões em homologação',description:'Estudo em cartões com recuperação ativa.',objectives:['Relembrar conceitos e explicar suas aplicações.'],durationMinutes:10},
 activities:[{key:'flashcards-isolated-study',type:'flashcards',title:'Seis conceitos para explorar',orderIndex:0,required:true,prerequisites:[],gamification:{rewardRuleKey:'activity_study',awardOn:'completed',achievementKeys:[]},
 content:{schemaVersion:2,type:'flashcards',cards:[
 {id:'html',front:{title:'HTML',question:'Qual é o papel do HTML?'},back:{summary:'Estrutura e conteúdo.',explanation:'HTML organiza elementos de uma página.',impact:'Ajuda a criar páginas compreensíveis.'}},
 {id:'css',front:{title:'CSS',question:'Como definimos a apresentação?'},back:{summary:'Apresentação visual.',explanation:'CSS descreve estilos dos elementos.',impact:'Permite adaptar a página a diferentes telas.'}},
 {id:'javascript',front:{title:'JavaScript',question:'Como adicionamos comportamentos?'},back:{summary:'Comportamento e interação.',explanation:'JavaScript permite responder a ações.',impact:'Ajuda a construir experiências interativas.'}},
 {id:'browser',front:{title:'Navegador',question:'O que exibe uma página web?'},back:{summary:'Um programa para navegar.',explanation:'O navegador interpreta recursos da web.',impact:'Permite acessar informações e aplicações.'}},
 {id:'link',front:{title:'Link',question:'Como páginas se conectam?'},back:{summary:'Uma conexão entre recursos.',explanation:'Um hiperlink aponta para um endereço.',impact:'Organiza caminhos de navegação.'}},
 {id:'accessibility',front:{title:'Acessibilidade',question:'Como incluir diferentes formas de uso?'},back:{summary:'Acesso para mais pessoas.',explanation:'Texto alternativo e teclado são exemplos.',impact:'Melhora a participação de todos.',curiosity:'Boas práticas beneficiam muitas pessoas.'}}
 ]}}],
 teacherOnly:{quizKeys:[],lessonPlans:[],interactiveKeys:[]}
 };
}
export async function prepareFlashcards(d) {
 await d.login('admin','postgres');
 await d.db.exec(readSql(learningMigration('_flashcards_learning_activity.sql')));
 const document=flashcardsDocument();
 await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,9)',[id(9910),id(26),id(27),document.lesson.title]);
 await d.login('admin');const imported=await d.rpc('import_learning_lesson',[id(9910),JSON.stringify(document),true]);
 await d.login();
 return {document,activityId:imported.activityIds[0],lessonId:id(9910)};
}
export async function createFlashcardsDb(){const d=await createCurriculumDb();await d.db.exec(d.releaseSql);const fixture=await prepareFlashcards(d);return {...d,...fixture};}
