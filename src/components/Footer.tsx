import symbol from "../assets/logo/logo-inicial.png";

export const Footer = () => {
  const year = new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    timeZone: "America/Bahia",
  }).format(new Date());

  return (
    <footer className="border-t border-white/10 bg-surface/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 py-6 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-3">
          <img
            src={symbol}
            alt="Bitaria"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl"
          />
          <div>
            <p className="font-heading text-sm font-semibold text-brand-50">
              Aprenda. Crie. Evolua.
            </p>
            <p className="mt-1 text-xs text-brand-200">
              Tecnologia e criatividade em cada descoberta.
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-brand-300">
          {"\u00a9"} {year} Bitaria.
          <span className="mt-1 block">Todos os direitos reservados.</span>
        </p>
      </div>
    </footer>
  );
};
