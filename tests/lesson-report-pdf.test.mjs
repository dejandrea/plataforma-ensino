import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {createLessonReportPdf} from '../src/lib/lessonReportPdfDocument.ts';

const assets=Object.fromEntries(await Promise.all(Object.entries({
 bodyFont:'src/assets/fonts/Inter.ttf',headingFont:'src/assets/fonts/ChakraPetch-Bold.ttf',
 logo:'src/assets/logo/logo-horizontal.png',mascot:'src/assets/Mascote Bitara/mascote 1.png',
}).map(async([key,path])=>[key,new Uint8Array(await readFile(path))])));
const lessons=Array.from({length:24},(_,i)=>({title:`Aula ${i+1} - Introdução à programação, lógica e criação`,session_track:i%2?'course':'mentoring',starts_at:`2026-10-${String(i+1).padStart(2,'0')}T18:00:00-03:00`,ends_at:`2026-10-${String(i+1).padStart(2,'0')}T19:00:00-03:00`}));
const base={studentName:'João da Conceição & família',periodLabel:'outubro de 2026',hourlyRate:50,totalLessons:7,totalHours:7,totalAmount:350,grossAmount:350,discountAmount:0,lessons:lessons.slice(0,7)};
const cases=[
 ['titulo-multipagina',{...base,totalLessons:1,totalHours:1,totalAmount:50,grossAmount:50,lessons:[{...lessons[0],title:('Criação de páginas acessíveis: planejamento, testes, revisão e apresentação das escolhas do projeto. ').repeat(80)+'FIM DO ASSUNTO LONGO.'}]}],
 ['10-aulas-valores-altos',{...base,totalLessons:10,totalHours:10,hourlyRate:123456.78,grossAmount:1234567.8,discountAmount:12345.67,totalAmount:1222222.13,lessons:lessons.slice(0,10)}],
 ...[5,8,10,11].map(count=>[`${count}-aulas`,{...base,totalLessons:count,totalHours:count,totalAmount:count*50,grossAmount:count*50,lessons:lessons.slice(0,count)}]),
 ['uma-aula',{...base,totalLessons:1,totalHours:1,totalAmount:50,grossAmount:50,lessons:lessons.slice(0,1)}],
 ['sete-aulas',base],
 ['vinte-e-quatro-aulas',{...base,totalLessons:24,totalHours:24,totalAmount:1200,grossAmount:1200,lessons}],
 ['titulo-longo',{...base,lessons:[{...lessons[0],title:'Criação de aplicações acessíveis com HTML, CSS e JavaScript: organização, navegação por teclado, validação de formulários e revisão do projeto autoral. '.repeat(8)}],totalLessons:1,totalHours:1,totalAmount:50,grossAmount:50}],
 ['com-desconto',{...base,discountAmount:62.5,totalAmount:287.5}],
 ['sem-desconto',{...base,discountAmount:0}],
 ['acentos-e-caracteres',{...base,studentName:'Érica D’Ávila — João & Gonçalves',hourlyRate:null,totalAmount:0,lessons:[{...lessons[0],title:'Ação, revisão, funções e variáveis: “Olá, mundo!” <HTML> & CSS — prática nº 1.'}]}],
];
await mkdir('output/pdf',{recursive:true});
for(const [name,data] of cases)test(`PDF redesign: ${name}`,async()=>{
 const original=structuredClone(data);
 const bytes=await createLessonReportPdf(data,assets);
 assert.deepEqual(data,original,'PDF must not mutate financial data or lesson order');
 const doc=await PDFDocument.load(bytes);
 assert.equal(doc.getTitle(),`Relatório de aulas realizadas - ${data.studentName}`);
 assert.ok(doc.getPageCount()>=1);
 if(['uma-aula','sete-aulas','5-aulas','8-aulas','10-aulas','10-aulas-valores-altos','com-desconto','sem-desconto'].includes(name))assert.equal(doc.getPageCount(),1);
 if(name==='11-aulas')assert.equal(doc.getPageCount(),2);
 if(name==='titulo-multipagina')assert.ok(doc.getPageCount()>1);
 if(name==='vinte-e-quatro-aulas')assert.ok(doc.getPageCount()>1);
 for(const page of doc.getPages()){assert.equal(Math.round(page.getWidth()),595);assert.equal(Math.round(page.getHeight()),842);}
 await writeFile(`output/pdf/relatorio-${name}.pdf`,bytes);
});
