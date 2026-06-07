import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type CommercialTab = "rates" | "packages" | "rules";
type SessionTrack = "mentoring" | "course";

type RateRow = {
  id: string;
  session_track: SessionTrack;
  hourly_rate: number | string;
  notes?: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  session_track: SessionTrack;
  lesson_quantity: number;
  package_price: number | string;
  validity_days: number | null;
  description?: string | null;
  is_active: boolean;
};

const initialPackageForm = {
  id: "",
  name: "",
  sessionTrack: "mentoring" as SessionTrack,
  lessonQuantity: "4",
  packagePrice: "",
  validityDays: "30",
  description: "",
  isActive: true,
};

const fieldClassName =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-brand-pink/50";

const selectStyle = {
  backgroundColor: "#241d33",
  color: "#ffffff",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const getTrackLabel = (track: SessionTrack) =>
  track === "course" ? "Curso" : "Mentoria";

export const CommercialManagement = () => {
  const [loading, setLoading] = useState(true);
  const [savingRates, setSavingRates] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [activeTab, setActiveTab] = useState<CommercialTab>("rates");
  const [rates, setRates] = useState<RateRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [rateForm, setRateForm] = useState({
    mentoring: "",
    course: "",
  });
  const [packageForm, setPackageForm] = useState(initialPackageForm);

  useEffect(() => {
    void fetchCommercialData();
  }, []);

  const fetchCommercialData = async () => {
    setLoading(true);

    const [{ data: rateRows, error: ratesError }, { data: packageRows, error: packagesError }] =
      await Promise.all([
        supabase.from("commercial_rate_settings").select("*").order("session_track"),
        supabase.from("commercial_packages").select("*").order("created_at", { ascending: false }),
      ]);

    if (ratesError) {
      console.error("Erro ao buscar precos comerciais:", ratesError.message);
      setRates([]);
    } else {
      const normalizedRates = (rateRows || []) as RateRow[];
      setRates(normalizedRates);
      setRateForm({
        mentoring: String(
          normalizedRates.find((item) => item.session_track === "mentoring")?.hourly_rate || "",
        ),
        course: String(
          normalizedRates.find((item) => item.session_track === "course")?.hourly_rate || "",
        ),
      });
    }

    if (packagesError) {
      console.error("Erro ao buscar pacotes comerciais:", packagesError.message);
      setPackages([]);
    } else {
      setPackages((packageRows || []) as PackageRow[]);
    }

    setLoading(false);
  };

  const activePackages = useMemo(
    () => packages.filter((item) => item.is_active),
    [packages],
  );

  const configuredRateCount = useMemo(
    () =>
      rates.filter((item) => Number(item.hourly_rate || 0) > 0).length,
    [rates],
  );

  const handleSaveRates = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingRates(true);

    const payload = (["mentoring", "course"] as SessionTrack[]).map((track) => ({
      session_track: track,
      hourly_rate: Number(rateForm[track]),
    }));

    const { error } = await supabase
      .from("commercial_rate_settings")
      .upsert(payload, { onConflict: "session_track" });

    if (error) {
      alert(`Erro ao salvar precos: ${error.message}`);
    } else {
      await fetchCommercialData();
      alert("Precos hora/aula atualizados com sucesso.");
    }

    setSavingRates(false);
  };

  const resetPackageForm = () => {
    setPackageForm(initialPackageForm);
  };

  const handleEditPackage = (item: PackageRow) => {
    setPackageForm({
      id: item.id,
      name: item.name,
      sessionTrack: item.session_track,
      lessonQuantity: String(item.lesson_quantity),
      packagePrice: String(item.package_price),
      validityDays: item.validity_days != null ? String(item.validity_days) : "",
      description: item.description || "",
      isActive: item.is_active,
    });
    setActiveTab("packages");
  };

  const handleSavePackage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!packageForm.name.trim()) {
      alert("Informe o nome do pacote.");
      return;
    }

    setSavingPackage(true);

    const payload = {
      name: packageForm.name.trim(),
      session_track: packageForm.sessionTrack,
      lesson_quantity: Number(packageForm.lessonQuantity || 0),
      package_price: Number(packageForm.packagePrice || 0),
      validity_days: packageForm.validityDays ? Number(packageForm.validityDays) : null,
      description: packageForm.description.trim() || null,
      is_active: packageForm.isActive,
    };

    const { error } = packageForm.id
      ? await supabase.from("commercial_packages").update(payload).eq("id", packageForm.id)
      : await supabase.from("commercial_packages").insert(payload);

    if (error) {
      alert(`Erro ao salvar pacote: ${error.message}`);
    } else {
      await fetchCommercialData();
      resetPackageForm();
      alert(packageForm.id ? "Pacote atualizado com sucesso." : "Pacote criado com sucesso.");
    }

    setSavingPackage(false);
  };

  const togglePackageStatus = async (item: PackageRow) => {
    const { error } = await supabase
      .from("commercial_packages")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      alert(`Erro ao atualizar pacote: ${error.message}`);
    } else {
      await fetchCommercialData();
    }
  };

  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Carregando configuracoes comerciais...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
                Comercial
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                Pacotes, precos e regras
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
                Centralize aqui os valores da plataforma, os pacotes oferecidos e as
                proximas regras comerciais da operacao.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <CommercialStat label="Precos configurados" value={configuredRateCount} />
              <CommercialStat label="Pacotes ativos" value={activePackages.length} />
              <CommercialStat label="Pacotes totais" value={packages.length} />
            </div>
          </div>

          <div className="mt-6">
            <div className="inline-flex rounded-[1.6rem] bg-brand-900/70 p-1.5 ring-1 ring-white/10">
              {[
                { key: "rates", label: "Precos" },
                { key: "packages", label: "Pacotes" },
                { key: "rules", label: "Regras" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as CommercialTab)}
                  className={`rounded-[1.2rem] px-5 py-2.5 text-sm font-bold transition ${
                    activeTab === tab.key
                      ? "bg-white text-brand-900"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {activeTab === "rates" && (
          <section className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Precos base
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Valor hora/aula por tipo
            </h2>

            <form onSubmit={handleSaveRates} className="mt-6 grid gap-4 xl:grid-cols-2">
              {(["mentoring", "course"] as SessionTrack[]).map((track) => (
                <article
                  key={track}
                  className="rounded-[2rem] bg-brand-900/35 p-5 ring-1 ring-white/10"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-lavender">
                    {getTrackLabel(track)}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-white">
                    Preco padrao por hora
                  </h3>

                  <div className="mt-5">
                    <label className="grid gap-2 text-sm text-white/70">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                        Valor hora/aula
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rateForm[track]}
                        onChange={(event) =>
                          setRateForm((current) => ({
                            ...current,
                            [track]: event.target.value,
                          }))
                        }
                        className={fieldClassName}
                        placeholder="0,00"
                      />
                    </label>
                  </div>
                </article>
              ))}

              <div className="xl:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingRates}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingRates ? "Salvando..." : "Salvar precos"}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "packages" && (
          <div className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                Pacotes cadastrados
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Ofertas comerciais da plataforma
              </h2>

              <div className="mt-6 grid gap-4">
                {packages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                    Nenhum pacote cadastrado ainda.
                  </div>
                ) : (
                  packages.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[2rem] bg-brand-900/35 p-5 ring-1 ring-white/10"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-lavender ring-1 ring-white/10">
                              {getTrackLabel(item.session_track)}
                            </span>
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 ring-1 ring-white/10">
                              {item.is_active ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <h3 className="mt-3 text-xl font-bold text-white">{item.name}</h3>
                          {item.description && (
                            <p className="mt-2 text-sm leading-6 text-white/60">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                          <button
                            type="button"
                            onClick={() => handleEditPackage(item)}
                            className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void togglePackageStatus(item)}
                            className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                          >
                            {item.is_active ? "Inativar" : "Reativar"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <CommercialMetric
                          label="Aulas"
                          value={String(item.lesson_quantity)}
                        />
                        <CommercialMetric
                          label="Preco do pacote"
                          value={formatCurrency(Number(item.package_price || 0))}
                        />
                        <CommercialMetric
                          label="Validade"
                          value={
                            item.validity_days != null ? `${item.validity_days} dias` : "Livre"
                          }
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
                {packageForm.id ? "Editar pacote" : "Novo pacote"}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {packageForm.id ? "Atualize a oferta" : "Cadastre um pacote"}
              </h2>

              <form onSubmit={handleSavePackage} className="mt-6 space-y-4">
                <label className="grid gap-2 text-sm text-white/70">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                    Nome do pacote
                  </span>
                  <input
                    type="text"
                    value={packageForm.name}
                    onChange={(event) =>
                      setPackageForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className={fieldClassName}
                    placeholder="Pacote mensal 4 aulas"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                      Tipo
                    </span>
                    <select
                      value={packageForm.sessionTrack}
                      onChange={(event) =>
                        setPackageForm((current) => ({
                          ...current,
                          sessionTrack: event.target.value as SessionTrack,
                        }))
                      }
                      className={fieldClassName}
                      style={selectStyle}
                    >
                      <option value="mentoring" style={selectStyle}>
                        Mentoria
                      </option>
                      <option value="course" style={selectStyle}>
                        Curso
                      </option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                      Quantidade de aulas
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={packageForm.lessonQuantity}
                      onChange={(event) =>
                        setPackageForm((current) => ({
                          ...current,
                          lessonQuantity: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                      Preco do pacote
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={packageForm.packagePrice}
                      onChange={(event) =>
                        setPackageForm((current) => ({
                          ...current,
                          packagePrice: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                      placeholder="0,00"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                      Validade em dias
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={packageForm.validityDays}
                      onChange={(event) =>
                        setPackageForm((current) => ({
                          ...current,
                          validityDays: event.target.value,
                        }))
                      }
                      className={fieldClassName}
                      placeholder="30"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm text-white/70">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                    Descricao
                  </span>
                  <textarea
                    value={packageForm.description}
                    onChange={(event) =>
                      setPackageForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className={`${fieldClassName} min-h-[110px] resize-y`}
                    placeholder="Observacoes comerciais, publico indicado, bonus do pacote..."
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl bg-brand-900/35 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10">
                  <input
                    type="checkbox"
                    checked={packageForm.isActive}
                    onChange={(event) =>
                      setPackageForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Pacote ativo para venda
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={resetPackageForm}
                    className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                  >
                    Limpar formulario
                  </button>
                  <button
                    type="submit"
                    disabled={savingPackage}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingPackage
                      ? "Salvando..."
                      : packageForm.id
                        ? "Salvar alteracoes"
                        : "Criar pacote"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {activeTab === "rules" && (
          <section className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
              Regras comerciais
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Outros gerenciamentos
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              Esta area fica pronta para receber as proximas politicas do negocio,
              como validade de pacotes, regras de cobranca, expiradao e
              observacoes operacionais.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                "Regras de cancelamento comercial",
                "Expiracao de pacotes",
                "Descontos e campanhas",
                "Limites por professora",
                "Politicas para curso e mentoria",
                "Observacoes internas do financeiro",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[2rem] border border-dashed border-white/15 bg-brand-900/35 p-5 text-sm text-white/55"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const CommercialStat = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="rounded-2xl bg-white/5 px-5 py-4 text-center ring-1 ring-white/10">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
  </div>
);

const CommercialMetric = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl bg-white/5 px-4 py-3 text-center ring-1 ring-white/10">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
      {label}
    </p>
    <p className="mt-2 text-sm font-bold text-white">{value}</p>
  </div>
);
