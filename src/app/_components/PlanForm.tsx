import {
  BUDGET_PRESETS,
  COOK_TIME_PRESETS,
  DIETARY_OPTIONS,
  DISTANCE_PRESETS,
  PANTRY_OPTIONS,
  hasAllergyText,
  perPortionCaption,
  tightBudgetHint,
  type PlanFormValues,
} from "@/lib/planForm";

import { Notice } from "./Notice";
import { SectionHead } from "./SectionHead";
import { SelectorStrip } from "./SelectorStrip";
import { Stepper } from "./Stepper";
import { TextField } from "./TextField";
import { ToggleGrid } from "./ToggleGrid";

export interface PlanFormProps {
  values: PlanFormValues;
  onChange: (values: PlanFormValues) => void;
  /** Demo mode uses the visibly-labelled Umeå default when location is empty. */
  demoLocation?: boolean;
}

function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

/**
 * The PLAN input screen (product-ux §1.2). Controlled — the page owns the
 * values so the `infeasible` decision screen can hand back a raised distance
 * without the user losing a keystroke.
 *
 * Every structured control is a rule-bounded strip or a stepper. There is not a
 * single `9999px` pill on this screen, by construction: the components that
 * could have been pills do not exist in the codebase.
 */
export function PlanForm({ values, onChange, demoLocation = false }: PlanFormProps) {
  const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const hint = tightBudgetHint(values);

  return (
    <div className="form">
      <SectionHead
        eyebrow="Steg 1"
        title="Beskriv måltiden"
        titleClass="t-h2"
        as="h2"
      />
      <p className="form__deck t-lead">
        Vi handlar och lagar. Budget, tid och avstånd är hårda villkor — vi håller
        dem eller säger tydligt att vi inte kunde.
      </p>

      {/* ---------------------------------------------------- structured */}
      <SelectorStrip
        legend="Budget (totalt)"
        name="budgetPreset"
        options={BUDGET_PRESETS.map((value) => ({ value, label: `${value} kr` }))}
        value={values.budgetSek}
        onChange={(value) => set("budgetSek", value)}
      />
      <TextField
        label="Exakt budget"
        name="budgetSek"
        value={values.budgetSek}
        onChange={(value) => set("budgetSek", value)}
        inputMode="decimal"
        suffix="kr"
        caption={perPortionCaption(values)}
      />
      {hint ? <Notice eyebrow="Tajt">{hint}</Notice> : null}

      <Stepper
        legend="Portioner"
        name="portions"
        value={values.portions}
        min={1}
        max={8}
        unit="portioner"
        onChange={(value) => set("portions", value)}
      />

      <SelectorStrip
        legend="Max tillagningstid"
        name="maxCookMinutes"
        options={COOK_TIME_PRESETS.map((value) => ({ value, label: `${value} min` }))}
        value={values.maxCookMinutes}
        onChange={(value) => set("maxCookMinutes", value)}
      />

      <SelectorStrip
        legend="Max avstånd till butik"
        name="maxDistanceKm"
        options={DISTANCE_PRESETS.map((value) => ({ value, label: `${value} km` }))}
        value={values.maxDistanceKm}
        onChange={(value) => set("maxDistanceKm", value)}
      />

      <TextField
        label="Plats (ort eller postnummer)"
        name="location"
        value={values.location}
        onChange={(value) => set("location", value)}
        placeholder="Umeå"
        caption={
          demoLocation && !values.location.trim()
            ? "Plats: Umeå (demostandard) — skriv en ort för att ändra"
            : undefined
        }
      />

      {/* --------------------------------------------------- free text */}
      <SectionHead eyebrow="Steg 2" title="Vad är du sugen på?" titleClass="t-h3" />
      <TextField
        label="Fritext-önskemål"
        name="vibe"
        value={values.vibe}
        onChange={(value) => set("vibe", value)}
        multiline
        rows={3}
        maxLength={400}
        placeholder="Något fräscht, kryddstarkt och asiatiskt-inspirerat, gärna högt protein"
        caption="Smak, humör, protein — allt vi bara tolkar, aldrig mäter."
      />
      <TextField
        label="Undvik (allergier, ogillar)"
        name="dislikes"
        value={values.dislikes}
        onChange={(value) => set("dislikes", value)}
        multiline
        rows={2}
        maxLength={200}
        placeholder="t.ex. koriander, skaldjur"
      />

      {hasAllergyText(values) ? (
        <Notice eyebrow="Allergi" tone="warning" alert>
          Vi kan inte garantera allergiinformation. Kontrollera alltid
          förpackningen. Allergier behandlas som önskemål, aldrig som en garanti.
        </Notice>
      ) : null}

      <ToggleGrid
        legend="Kost"
        options={DIETARY_OPTIONS.map(({ id, label }) => ({ id, label }))}
        selected={values.dietary}
        onToggle={(id) => set("dietary", toggle(values.dietary, id))}
      />

      <ToggleGrid
        legend="Har du redan hemma"
        options={PANTRY_OPTIONS.map(({ raw, concept }) => ({ id: concept, label: raw }))}
        selected={values.pantry}
        onToggle={(id) => set("pantry", toggle(values.pantry, id))}
        caption="Räknas inte in i priset."
      />
    </div>
  );
}
