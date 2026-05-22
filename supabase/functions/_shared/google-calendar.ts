import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

export const getGoogleOAuthConfig = () => {
  if (!googleClientId || !googleClientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET precisam estar configurados nas secrets do Supabase.",
    );
  }

  return {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  };
};

export const buildGoogleAuthUrl = ({
  redirectTo,
  state,
}: {
  redirectTo: string;
  state: string;
}) => {
  const { clientId } = getGoogleOAuthConfig();

  const scope = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectTo);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  return url.toString();
};

export const exchangeGoogleCode = async ({
  code,
  redirectTo,
}: {
  code: string;
  redirectTo: string;
}) => {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectTo,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error_description || json?.error || "Falha no OAuth do Google.");
  }

  return json;
};

export const refreshGoogleAccessToken = async ({
  refreshToken,
}: {
  refreshToken: string;
}) => {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error_description || json?.error || "Falha ao renovar token do Google.");
  }

  return json;
};

export const getGoogleUserEmail = async (accessToken: string) => {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error("Nao foi possivel descobrir o e-mail da conta Google conectada.");
  }

  return typeof json?.email === "string" ? json.email : "";
};

export const ensureFreshGoogleAccessToken = async ({
  adminClient,
  teacherId,
}: {
  adminClient: SupabaseClient;
  teacherId: string;
}) => {
  const { data: tokenRow, error } = await adminClient
    .from("teacher_google_calendar_tokens")
    .select("*")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (error || !tokenRow) {
    throw new Error("Conta Google ainda nao conectada para esta professora.");
  }

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  const now = Date.now();

  if (tokenRow.access_token && expiresAt > now + 60_000) {
    return {
      accessToken: tokenRow.access_token as string,
      refreshToken: tokenRow.refresh_token as string,
      providerAccountEmail: tokenRow.provider_account_email as string | null,
    };
  }

  if (!tokenRow.refresh_token) {
    throw new Error("Refresh token do Google nao encontrado. Conecte a conta novamente.");
  }

  const refreshed = await refreshGoogleAccessToken({
    refreshToken: tokenRow.refresh_token,
  });

  const nextExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();

  const { error: updateError } = await adminClient
    .from("teacher_google_calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      token_type: refreshed.token_type || tokenRow.token_type,
      scope: refreshed.scope || tokenRow.scope,
      expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("teacher_id", teacherId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    accessToken: refreshed.access_token as string,
    refreshToken: tokenRow.refresh_token as string,
    providerAccountEmail: (tokenRow.provider_account_email as string | null) || null,
  };
};

export const getGoogleCalendarEvents = async ({
  accessToken,
  calendarId,
  timeMin,
  timeMax,
}: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}) => {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "true");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || "Falha ao listar eventos do Google Calendar.");
  }

  return Array.isArray(json?.items) ? json.items : [];
};

export const getGoogleCalendarFreeBusy = async ({
  accessToken,
  calendarIds,
  timeMin,
  timeMax,
  timeZone,
}: {
  accessToken: string;
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
  timeZone: string;
}) => {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone,
      items: calendarIds.map((id) => ({ id })),
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || "Falha ao consultar disponibilidade no Google.");
  }

  return json?.calendars || {};
};

export const getGoogleCalendarList = async ({
  accessToken,
}: {
  accessToken: string;
}) => {
  const url = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
  url.searchParams.set("minAccessRole", "owner");
  url.searchParams.set("showHidden", "false");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || "Falha ao listar as agendas do Google.");
  }

  return Array.isArray(json?.items) ? json.items : [];
};

export const createGoogleCalendarEvent = async ({
  accessToken,
  calendarId,
  summary,
  description,
  startDateTime,
  endDateTime,
  timezone,
  attendeeEmails = [],
  autoCreateMeet,
}: {
  accessToken: string;
  calendarId: string;
  summary: string;
  description?: string | null;
  startDateTime: string;
  endDateTime: string;
  timezone?: string | null;
  attendeeEmails?: string[];
  autoCreateMeet: boolean;
}) => {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("sendUpdates", "all");

  if (autoCreateMeet) {
    url.searchParams.set("conferenceDataVersion", "1");
  }

  const body: Record<string, unknown> = {
    summary,
    description: description || undefined,
    start: {
      dateTime: startDateTime,
      timeZone: timezone || undefined,
    },
    end: {
      dateTime: endDateTime,
      timeZone: timezone || undefined,
    },
  };

  if (attendeeEmails.length > 0) {
    body.attendees = attendeeEmails.map((email) => ({
      email,
    }));
  }

  if (autoCreateMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || "Falha ao criar evento no Google Calendar.");
  }

  return json;
};

export const extractMeetLink = (event: any) => {
  if (typeof event?.hangoutLink === "string" && event.hangoutLink) {
    return event.hangoutLink;
  }

  const entryPoints = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints
    : [];

  const videoEntry = entryPoints.find((entry: any) => entry?.entryPointType === "video");
  return typeof videoEntry?.uri === "string" ? videoEntry.uri : null;
};
