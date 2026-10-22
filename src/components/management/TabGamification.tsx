import { XpRewardSettings } from "../XpRewardSettings";
import { MissionCenter } from "../MissionCenter";
import { MasteryRuleSettings } from "../MasteryShowcase";
import { PlayerRanking } from "../PlayerRanking";
import { TechnologyCatalog } from "../TechnologyCatalog";
import { useState } from "react";

export const TabGamification = () => {
  const [catalogVersion, setCatalogVersion] = useState(0);
  return (
  <div>
    <h2 className="text-2xl font-bold text-white">Conquistas, XP e ranking</h2>
    <p className="mt-2 text-sm text-white/60">Gerencie a pontuação, as missões e as medalhas dos alunos e acompanhe a classificação geral.</p>
    <XpRewardSettings />
    <TechnologyCatalog onSaved={() => setCatalogVersion(value => value + 1)} />
    <MissionCenter admin catalogVersion={catalogVersion} />
    <MasteryRuleSettings />
    <PlayerRanking />
  </div>
  );
};
