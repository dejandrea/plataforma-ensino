/** Session order only; never mutates content or persisted review IDs. */
export function shuffleCards(ids:readonly string[],random:()=>number=Math.random):string[] {
 const result=[...ids];
 for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 return result;
}
