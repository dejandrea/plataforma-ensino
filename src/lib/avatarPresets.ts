import avatar1 from "../assets/1.png";
import avatar2 from "../assets/2.png";
import avatar3 from "../assets/3.png";
import avatar4 from "../assets/4.png";
import avatar5 from "../assets/5.png";
import avatar6 from "../assets/6.png";
import avatar7 from "../assets/7.png";
import avatar8 from "../assets/8.png";

export type AvatarPreset = {
  id: string;
  label: string;
  src: string;
};

export const avatarPresets: AvatarPreset[] = [
  {
    id: "avatar-1",
    label: "Avatar 1",
    src: avatar1,
  },
  {
    id: "avatar-2",
    label: "Avatar 2",
    src: avatar2,
  },
  {
    id: "avatar-3",
    label: "Avatar 3",
    src: avatar3,
  },
  {
    id: "avatar-4",
    label: "Avatar 4",
    src: avatar4,
  },
  {
    id: "avatar-5",
    label: "Avatar 5",
    src: avatar5,
  },
  {
    id: "avatar-6",
    label: "Avatar 6",
    src: avatar6,
  },
  {
    id: "avatar-7",
    label: "Avatar 7",
    src: avatar7,
  },
  {
    id: "avatar-8",
    label: "Avatar 8",
    src: avatar8,
  },
];

export const getAvatarPreset = (presetId?: string | null) =>
  avatarPresets.find((preset) => preset.id === presetId) || avatarPresets[0];
