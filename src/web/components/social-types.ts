import type { useNotifications, useProfileSettings, useSocial } from "../hooks/social";

export type ReturnTypeOfUseSocial = ReturnType<typeof useSocial>;
export type ReturnTypeOfNotifications = ReturnType<typeof useNotifications>;
export type ReturnTypeOfProfileSettings = ReturnType<typeof useProfileSettings>;
