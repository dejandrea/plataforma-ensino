import { XpRewardSettings } from "../XpRewardSettings";
import { MissionCenter } from "../MissionCenter";
import { MasteryRuleSettings } from "../MasteryShowcase";
import {AchievementCatalog} from '../AchievementCatalog';
import { TechnologyCatalog } from "../TechnologyCatalog";
import { useState } from "react";

export const TabGamification = () => {
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [tab,setTab]=useState('Conquistas');
  return (
  <div>
    <div role="tablist" aria-label="Gestão de conquistas" className="mt-6 flex flex-wrap gap-3">{['Conquistas','Tecnologias','Missões','Maestrias'].map(label=><button key={label} id={`tab-${label}`} role="tab" aria-selected={tab===label} aria-controls="achievements-panel" className={tab===label?'btn-primary':'btn-secondary'} onClick={()=>setTab(label)}>{label}</button>)}</div>
    <section id="achievements-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
    {tab==='Conquistas'&&<><AchievementCatalog/><XpRewardSettings/></>}
    {tab==='Tecnologias'&&<TechnologyCatalog onSaved={()=>setCatalogVersion(value=>value+1)}/>}
    {tab==='Missões'&&<MissionCenter admin catalogVersion={catalogVersion}/>}
    {tab==='Maestrias'&&<><MasteryRuleSettings/><AchievementCatalog masteries/></>}
    </section>
  </div>
  );
};
