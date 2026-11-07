/* eslint-disable react-refresh/only-export-components -- Isolated browser entry. */
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {ActivityRenderer} from '../../src/components/learning/ActivityRenderer';
import type {LearningActivity} from '../../src/types/learning';
import '../../src/index.css';

// Synthetic UI only: no candidate import, database, user session or XP mutation.
const activity:LearningActivity={
  id:'00000000-0000-4000-8000-000000000001',lesson_id:'00000000-0000-4000-8000-000000000002',
  key:'synthetic-presentation-return',title:'Apresentação web',description:null,order_index:1,duration_minutes:null,
  is_required:true,is_active:true,publication_status:'published',revision:1,created_at:'2026-10-31T00:00:00Z',updated_at:'2026-10-31T00:00:00Z',published_at:null,
  activity_type:'slides',is_unlocked:true,prerequisite_ids:[],
  content_json:{schemaVersion:1,type:'slides',format:'link',altText:'Apresentação da Aula 02',resourceUrl:'https://presentation.test/apresentacoes/?deck=html-m01-s01-a02'},
};
function ReturnScenario(){
  const [confirmations,setConfirmations]=useState(0);
  return <MemoryRouter><main className="app-bg min-h-screen p-8 text-white"><h1 className="mb-6 text-2xl">Aula · cenário isolado</h1>
    <ActivityRenderer activity={activity} status={confirmations?'completed':'not_started'} disabled={false} attempts={[]} meetings={[]} submissions={[]} reviews={[]}
      onCompleteStudy={()=>setConfirmations(value=>value+1)} onQuizBusy={()=>{}} onProjectSaved={async()=>{}} onSubmitQuiz={async()=>{throw new Error('Avaliação não faz parte deste cenário.');}} />
    <p className="mt-5" data-testid="confirmations">Confirmações: {confirmations}</p>
  </main></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<ReturnScenario/>);
