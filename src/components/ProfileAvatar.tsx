import { getAvatarPreset } from "../lib/avatarPresets";

const sizeClasses = {
  sm: "h-10 w-10 rounded-xl",
  md: "h-12 w-12 rounded-2xl",
  lg: "h-16 w-16 rounded-2xl",
  xl: "h-24 w-24 rounded-[1.75rem]",
};

export const ProfileAvatar = ({
  fullName,
  avatarMode,
  avatarUrl,
  avatarPreset,
  size = "md",
}: {
  fullName?: string | null;
  avatarMode?: string | null;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
  size?: keyof typeof sizeClasses;
}) => {
  const preset = getAvatarPreset(avatarPreset);

  if (avatarMode === "photo" && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={fullName || "Avatar"}
        className={`${sizeClasses[size]} object-cover ring-1 ring-white/10 shadow-soft`}
      />
    );
  }

  return (
    <img
      src={preset.src}
      alt={fullName || preset.label}
      className={`${sizeClasses[size]} object-cover ring-1 ring-white/10 shadow-soft`}
      aria-label={preset.label}
      title={preset.label}
    />
  );
};
