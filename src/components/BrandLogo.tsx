import symbol from "../assets/logo/logo-inicial.png";
import wordmark from "../assets/logo/logo-para-fundo-escuro.png";

export const BrandLogo = () => (
  <div className="flex flex-col items-center gap-2">
    <img src={symbol} alt="" className="h-[72px] w-[72px] shrink-0 rounded-xl" width={72} height={72} />
    <div className="relative h-[72px] w-[216px] shrink-0 overflow-hidden">
      <img
        src={wordmark}
        alt="Bitaria"
        className="absolute -top-[72px] left-0 h-auto w-full"
        width={2000}
        height={2000}
      />
    </div>
  </div>
);
