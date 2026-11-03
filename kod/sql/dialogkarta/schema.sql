-- Tabeller för Dialogkarta i PostgreSQL/PostGIS.
-- SRID ska vara samma som pluginets dataProjection (Sundsvall: EPSG:3014).
-- Byt schema "dialog" om ni vill lägga tabellerna någon annanstans, och ange det i
-- createPgStore({ schema }).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS dialog;

CREATE TABLE IF NOT EXISTS dialog.dialoger (
  id           text PRIMARY KEY,
  titel        text NOT NULL CHECK (length(trim(titel)) > 0),
  omrade       text,
  metod        text,
  status       text NOT NULL DEFAULT 'planned',
  startdatum   date,
  slutdatum    date,
  ansvarig     text,
  malgrupp     text,
  antal_deltagare integer CHECK (antal_deltagare >= 0),
  beskrivning  text,
  dialog_url   text,
  resultat     text,
  resultat_url text,
  arkiverad    boolean NOT NULL DEFAULT false,
  arkiverad_tid timestamptz,
  -- Egna fält som pluginet skickar men som inte har en egen kolumn.
  ovrigt       jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom         geometry(Geometry, 3014),
  skapad_tid   timestamptz NOT NULL DEFAULT now(),
  skapad_av    text,
  andrad_tid   timestamptz NOT NULL DEFAULT now(),
  andrad_av    text,
  CHECK (slutdatum IS NULL OR startdatum IS NULL OR slutdatum >= startdatum)
);

CREATE INDEX IF NOT EXISTS dialoger_geom_idx ON dialog.dialoger USING gist (geom);

CREATE TABLE IF NOT EXISTS dialog.bilagor (
  id         text PRIMARY KEY,
  dialog_id  text NOT NULL REFERENCES dialog.dialoger (id) ON DELETE CASCADE,
  namn       text NOT NULL,
  typ        text,
  storlek    integer NOT NULL,
  data       bytea NOT NULL,
  skapad_tid timestamptz NOT NULL DEFAULT now(),
  skapad_av  text
);

CREATE INDEX IF NOT EXISTS bilagor_dialog_idx ON dialog.bilagor (dialog_id);
