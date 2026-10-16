-- modifierad_av för felrapporter: den inloggade handläggaren i stället för databaskontot.
--
-- Origoserver sätter transaktionsvariabeln report_issues.user till den inloggade användaren
-- (set_config(..., true), gäller bara transaktionen) innan ärendet uppdateras. Är den inte satt,
-- t.ex. vid redigering i QGIS, används current_user som tidigare.
--
-- Den delade funktionen intern.uppdatera_modifierad_av() (används även av LANT_kufomrade_yta)
-- lämnas orörd; LANT_report_issues får en egen funktion.
--
-- Körs som ägaren till tabellen (geodataowner).

BEGIN;

CREATE OR REPLACE FUNCTION intern."LANT_report_issues_modifierad_av"()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modifierad_av := coalesce(nullif(current_setting('report_issues.user', true), ''), current_user);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_uppdatera_modifierad_av ON intern."LANT_report_issues";

CREATE TRIGGER trigger_uppdatera_modifierad_av
  BEFORE INSERT OR UPDATE ON intern."LANT_report_issues"
  FOR EACH ROW EXECUTE FUNCTION intern."LANT_report_issues_modifierad_av"();

COMMIT;
