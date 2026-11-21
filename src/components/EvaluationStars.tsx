/** A saved score, never an average or an inferred achievement. */
export function EvaluationStars({value}: {value: unknown}) {
  const score = typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  if (score === null) return <span className="evaluation-unrated">Não registrado</span>;
  return <span className="evaluation-stars" role="img" aria-label={`${score} de 5 estrelas`}>
    {Array.from({length: 5}, (_, index) => <svg key={index} viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z" fill={index < score ? '#A735A4' : 'none'} stroke="#813584" strokeWidth="1.5" />
    </svg>)}
  </span>;
}
