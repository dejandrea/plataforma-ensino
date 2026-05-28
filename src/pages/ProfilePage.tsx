import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { avatarPresets } from "../lib/avatarPresets";
import { supabase } from "../lib/supabaseClient";

const fieldClass =
  "w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/15 outline-none transition placeholder:text-white/30 focus:ring-2 focus:ring-brand-lavender";

type ProfileForm = {
  full_name: string;
  nickname: string;
  avatar_url: string;
  avatar_mode: string;
  avatar_preset: string;
  secondary_email: string;
  address: string;
  zip_code: string;
  state: string;
  city: string;
  country: string;
  github_url: string;
  linkedin_url: string;
  instagram_url: string;
  whatsapp: string;
  phone: string;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  estado?: string;
};

type GithubUserResponse = {
  login?: string;
  html_url?: string;
};

const emptyProfile: ProfileForm = {
  full_name: "",
  nickname: "",
  avatar_url: "",
  avatar_mode: "preset",
  avatar_preset: "avatar-1",
  secondary_email: "",
  address: "",
  zip_code: "",
  state: "",
  city: "",
  country: "",
  github_url: "",
  linkedin_url: "",
  instagram_url: "",
  whatsapp: "",
  phone: "",
};

const normalizeZipCode = (value: string) => value.replace(/\D/g, "").slice(0, 8);

const formatZipCode = (value: string) => {
  const digits = normalizeZipCode(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const buildAddressFromZipLookup = (data: ViaCepResponse) =>
  [data.logradouro, data.complemento, data.bairro].filter(Boolean).join(", ");

const normalizeExternalUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue;
  return `https://${trimmedValue}`;
};

const extractGithubUsername = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  const normalizedValue = trimmedValue
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();

  return normalizedValue;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Nao foi possivel ler a imagem."));
        return;
      }

      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel processar a imagem."));
    image.src = src;
  });

const optimizeAvatarImage = async (file: File) => {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel preparar a imagem para salvar.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
};

export const ProfilePage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [zipLookupStatus, setZipLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [zipLookupMessage, setZipLookupMessage] = useState("");
  const [githubLookupStatus, setGithubLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [githubLookupMessage, setGithubLookupMessage] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);

  useEffect(() => {
    void loadProfile();
  }, [location.key]);

  const loadProfile = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setPrimaryEmail(user.email || "");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "full_name, nickname, role, avatar_url, avatar_mode, avatar_preset, secondary_email, address, zip_code, state, city, country, github_url, linkedin_url, instagram_url, whatsapp, phone",
      )
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Erro ao carregar perfil:", error.message);
    } else if (data) {
      setUserRole(data.role || "");
      setProfile({
        full_name: data.full_name || "",
        nickname: data.nickname || "",
        avatar_url: data.avatar_url || "",
        avatar_mode: data.avatar_mode || "preset",
        avatar_preset: data.avatar_preset || "avatar-1",
        secondary_email: data.secondary_email || "",
        address: data.address || "",
        zip_code: data.zip_code || "",
        state: data.state || "",
        city: data.city || "",
        country: data.country || "",
        github_url: data.github_url || "",
        linkedin_url: data.linkedin_url || "",
        instagram_url: data.instagram_url || "",
        whatsapp: data.whatsapp || "",
        phone: data.phone || "",
      });
    }

    setLoading(false);
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Escolha uma imagem valida para a foto de perfil.");
      return;
    }

    setAvatarProcessing(true);

    try {
      const imageData = await optimizeAvatarImage(file);
      setProfile((current) => ({
        ...current,
        avatar_mode: "photo",
        avatar_url: imageData,
      }));
    } catch (error) {
      console.error("Erro ao processar foto de perfil:", error);
      alert("Nao foi possivel preparar a foto de perfil. Tente outra imagem.");
    } finally {
      setAvatarProcessing(false);
    }
  };

  const openExternalProfile = (value: string, fallbackUrl: string) => {
    const targetUrl = normalizeExternalUrl(value) || fallbackUrl;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const lookupGithubProfile = async () => {
    const username = extractGithubUsername(profile.github_url);

    if (!username) {
      setGithubLookupStatus("error");
      setGithubLookupMessage("Informe um username ou link do GitHub para buscar automaticamente.");
      return;
    }

    setGithubLookupStatus("loading");
    setGithubLookupMessage("Buscando perfil no GitHub...");

    try {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (response.status === 404) {
        setGithubLookupStatus("error");
        setGithubLookupMessage("Usuario do GitHub nao encontrado.");
        return;
      }

      if (!response.ok) {
        throw new Error("Nao foi possivel consultar o GitHub agora.");
      }

      const data = (await response.json()) as GithubUserResponse;
      const nextUrl = data.html_url || `https://github.com/${data.login || username}`;

      setProfile((current) => ({
        ...current,
        github_url: nextUrl,
      }));

      setGithubLookupStatus("success");
      setGithubLookupMessage("Perfil encontrado e link preenchido automaticamente.");
    } catch (error) {
      console.error("Erro ao consultar GitHub:", error);
      setGithubLookupStatus("error");
      setGithubLookupMessage("Nao foi possivel buscar o perfil do GitHub agora.");
    }
  };

  const lookupZipCode = async (value: string) => {
    const zipCode = normalizeZipCode(value);

    if (!zipCode) {
      setZipLookupStatus("idle");
      setZipLookupMessage("");
      return;
    }

    if (zipCode.length !== 8) {
      setZipLookupStatus("error");
      setZipLookupMessage("Informe um CEP com 8 digitos para completar o endereco.");
      return;
    }

    setZipLookupStatus("loading");
    setZipLookupMessage("Buscando endereco pelo CEP...");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
      if (!response.ok) {
        throw new Error("Nao foi possivel consultar o CEP agora.");
      }

      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) {
        setZipLookupStatus("error");
        setZipLookupMessage("CEP nao encontrado. Voce ainda pode preencher manualmente.");
        return;
      }

      const nextAddress = buildAddressFromZipLookup(data);

      setProfile((current) => ({
        ...current,
        zip_code: formatZipCode(zipCode),
        address: nextAddress || current.address,
        city: data.localidade || current.city,
        state: data.estado || data.uf || current.state,
        country: "Brasil",
      }));

      setZipLookupStatus("success");
      setZipLookupMessage(
        "Endereco preenchido automaticamente. Se precisar, voce pode editar os campos.",
      );
    } catch (error) {
      console.error("Erro ao consultar CEP:", error);
      setZipLookupStatus("error");
      setZipLookupMessage("Nao foi possivel completar o endereco pelo CEP agora.");
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (avatarProcessing) {
      alert("Aguarde a foto de perfil terminar de ser processada antes de salvar.");
      return;
    }

    if (profile.avatar_mode === "photo" && !profile.avatar_url) {
      alert("Selecione uma foto valida antes de salvar o perfil.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        nickname: profile.nickname || null,
        avatar_url: profile.avatar_mode === "photo" ? profile.avatar_url || null : null,
        avatar_mode: profile.avatar_mode,
        avatar_preset: profile.avatar_preset,
        secondary_email: profile.secondary_email || null,
        address: profile.address || null,
        zip_code: profile.zip_code || null,
        state: profile.state || null,
        city: profile.city || null,
        country: profile.country || null,
        github_url: profile.github_url || null,
        linkedin_url: profile.linkedin_url || null,
        instagram_url: profile.instagram_url || null,
        whatsapp: profile.whatsapp || null,
        phone: profile.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id");

    if (error) {
      alert("Erro ao salvar perfil: " + error.message);
    } else if (!data || data.length === 0) {
      alert(
        "Erro ao salvar perfil: nenhuma alteracao foi autorizada para este usuario.",
      );
    } else {
      window.dispatchEvent(new CustomEvent("profile-updated"));
      alert("Perfil atualizado com sucesso.");
      await loadProfile();
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="app-bg min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl bg-white/5 p-10 text-center text-white/70 ring-1 ring-white/10">
            Carregando perfil...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="rounded-3xl bg-white/5 p-6 shadow-soft ring-1 ring-white/10 backdrop-blur md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
            Meu perfil
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Dados pessoais e canais de contato
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
            Edite apenas informacoes nao sensiveis que ajudam na identificacao,
            no contato e na experiencia dentro da plataforma.
          </p>
        </header>

        <form onSubmit={saveProfile} className="mt-8 grid gap-8 lg:grid-cols-[320px,1fr]">
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
              Avatar
            </p>

            <div className="mt-5 flex flex-col items-center gap-4 text-center">
              <ProfileAvatar
                fullName={profile.nickname || profile.full_name}
                avatarMode={profile.avatar_mode}
                avatarUrl={profile.avatar_url}
                avatarPreset={profile.avatar_preset}
                size="xl"
              />

              <div>
                <p className="text-lg font-bold text-white">
                  {profile.nickname || profile.full_name}
                </p>
                <p className="text-sm text-white/55">
                  {userRole === "student"
                    ? "Aluno(a)"
                    : userRole === "professor"
                      ? "Professor(a)"
                      : "Administrador(a)"}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() =>
                  setProfile((current) => ({
                    ...current,
                    avatar_mode: "preset",
                  }))
                }
                className={`w-full rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  profile.avatar_mode === "preset"
                    ? "bg-white text-brand-900"
                    : "bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                Usar avatar da plataforma
              </button>

              <label className="block">
                <span className="mb-2 block text-left text-xs font-black uppercase tracking-[0.18em] text-white/35">
                  Foto de perfil
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className={fieldClass}
                  disabled={avatarProcessing}
                  onChange={(event) =>
                    void handleAvatarUpload(event.target.files?.[0] || null)
                  }
                />
                <p className="mt-2 text-xs text-white/45">
                  {avatarProcessing
                    ? "Processando foto para salvar com mais estabilidade..."
                    : "A foto sera otimizada antes do salvamento para carregar melhor na plataforma."}
                </p>
              </label>

              {profile.avatar_mode === "photo" && (
                <button
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      avatar_mode: "preset",
                      avatar_url: "",
                    }))
                  }
                  className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  Remover foto e voltar ao avatar
                </button>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {avatarPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      avatar_mode: "preset",
                      avatar_preset: preset.id,
                    }))
                  }
                  className={`rounded-2xl p-3 ring-1 transition ${
                    profile.avatar_preset === preset.id && profile.avatar_mode === "preset"
                      ? "bg-white/10 ring-white/30"
                      : "bg-white/5 ring-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="mx-auto">
                    <ProfileAvatar
                      fullName={profile.nickname || profile.full_name}
                      avatarMode="preset"
                      avatarPreset={preset.id}
                      size="md"
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-white/65">{preset.label}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur md:p-8">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo">
                <input className={fieldClass} value={profile.full_name} disabled />
              </Field>

              <Field label="E-mail principal">
                <input className={fieldClass} value={primaryEmail} disabled />
              </Field>

              <Field label="Apelido">
                <input
                  className={fieldClass}
                  value={profile.nickname}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      nickname: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="E-mail secundario">
                <input
                  type="email"
                  className={fieldClass}
                  value={profile.secondary_email}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      secondary_email: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Endereco">
                  <input
                    className={fieldClass}
                    value={profile.address}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <Field label="CEP">
                <>
                  <input
                    className={fieldClass}
                    value={profile.zip_code}
                    onBlur={() => void lookupZipCode(profile.zip_code)}
                    onChange={(event) => {
                      const formattedValue = formatZipCode(event.target.value);

                      setProfile((current) => ({
                        ...current,
                        zip_code: formattedValue,
                      }));

                      if (normalizeZipCode(formattedValue).length === 8) {
                        void lookupZipCode(formattedValue);
                        return;
                      }

                      setZipLookupStatus("idle");
                      setZipLookupMessage("");
                    }}
                  />
                  <p
                    className={`mt-2 text-xs ${
                      zipLookupStatus === "error"
                        ? "text-rose-300"
                        : zipLookupStatus === "success"
                          ? "text-emerald-300"
                          : "text-white/45"
                    }`}
                  >
                    {zipLookupStatus === "idle"
                      ? "Ao informar o CEP, buscamos endereco, cidade, estado e pais automaticamente."
                      : zipLookupMessage}
                  </p>
                </>
              </Field>

              <Field label="Cidade">
                <input
                  className={fieldClass}
                  value={profile.city}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Estado">
                <input
                  className={fieldClass}
                  value={profile.state}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Pais">
                <input
                  className={fieldClass}
                  value={profile.country}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      country: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="WhatsApp">
                <input
                  className={fieldClass}
                  value={profile.whatsapp}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      whatsapp: event.target.value,
                    }))
                  }
                />
              </Field>

              <label className="block">
                <div className="ml-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Telefone
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setProfile((current) => ({
                        ...current,
                        phone: current.whatsapp,
                      }))
                    }
                    disabled={!profile.whatsapp || profile.phone === profile.whatsapp}
                    className="rounded-xl bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Copiar do WhatsApp
                  </button>
                </div>
                <div className="mt-2">
                  <input
                    className={fieldClass}
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>

              <label className="block">
                <div className="ml-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    GitHub
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void lookupGithubProfile()}
                      disabled={githubLookupStatus === "loading"}
                      className="rounded-xl bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {githubLookupStatus === "loading"
                        ? "Buscando..."
                        : "Buscar username"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openExternalProfile(profile.github_url, "https://github.com")
                      }
                      className="rounded-xl bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                    >
                      Abrir GitHub
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    className={fieldClass}
                    value={profile.github_url}
                    onChange={(event) => {
                      setProfile((current) => ({
                        ...current,
                        github_url: event.target.value,
                      }));
                      setGithubLookupStatus("idle");
                      setGithubLookupMessage("");
                    }}
                  />
                  <p
                    className={`mt-2 text-xs ${
                      githubLookupStatus === "error"
                        ? "text-rose-300"
                        : githubLookupStatus === "success"
                          ? "text-emerald-300"
                          : "text-white/45"
                    }`}
                  >
                    {githubLookupStatus === "idle"
                      ? "Voce pode informar so o username que buscamos e completamos o link."
                      : githubLookupMessage}
                  </p>
                </div>
              </label>

              <Field
                label="LinkedIn"
                actionLabel="Abrir LinkedIn"
                onAction={() =>
                  openExternalProfile(profile.linkedin_url, "https://www.linkedin.com")
                }
              >
                <input
                  className={fieldClass}
                  value={profile.linkedin_url}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      linkedin_url: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field
                label="Instagram"
                actionLabel="Abrir Instagram"
                onAction={() =>
                  openExternalProfile(profile.instagram_url, "https://www.instagram.com")
                }
              >
                <input
                  className={fieldClass}
                  value={profile.instagram_url}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      instagram_url: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadProfile()}
                className="rounded-2xl bg-white/5 px-4 py-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
              >
                Recarregar
              </button>
              <button
                type="submit"
                disabled={saving || avatarProcessing}
                className="flex-1 rounded-2xl bg-gradient-to-r from-brand-magenta to-brand-pink px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
              >
                {avatarProcessing
                  ? "Processando foto..."
                  : saving
                    ? "Salvando..."
                    : "Salvar perfil"}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
};

const Field = ({
  label,
  actionLabel,
  children,
  onAction,
}: {
  label: string;
  actionLabel?: string;
  children: ReactNode;
  onAction?: () => void;
}) => (
  <label className="block">
    <div className="ml-1 flex items-center justify-between gap-3">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </span>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-xl bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
    <div className="mt-2">{children}</div>
  </label>
);
