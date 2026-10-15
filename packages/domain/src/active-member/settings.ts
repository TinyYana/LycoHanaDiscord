import type { ActivityWeights } from "../activity";

/**
 * Active-member settings, declared once. `ACTIVE_MEMBER_SETTING_FIELDS` drives
 * validation here, the `/config` options, and any editor form (labels, min,
 * nullability). Human-readable text is referenced by message key only.
 */
export type ActiveMemberThresholdKey = "high" | "low";
export type ActiveMemberSettingKey = ActiveMemberThresholdKey | keyof ActivityWeights;

export type ActiveMemberSettingsWarningCode =
  | "revoke-disabled-low-zero"
  | "revoke-disabled-low-null"
  | "grant-disabled-high-null";

export type ActiveMemberSettingsIssueCode =
  | "required"
  | "not-finite"
  | "not-integer"
  | "below-min"
  | "high-below-low"
  | ActiveMemberSettingsWarningCode;

export interface ActiveMemberSettingWarning {
  code: ActiveMemberSettingsWarningCode;
  when(value: number | null): boolean;
}

export interface ActiveMemberSettingField {
  key: ActiveMemberSettingKey;
  group: "thresholds" | "weights";
  /** Message keys: short name, and one-line help (also the `/config` option text). */
  labelKey: string;
  descriptionKey: string;
  type: "integer";
  min: number;
  /** null is allowed and disables that side of the gate. */
  nullable: boolean;
  warnings: readonly ActiveMemberSettingWarning[];
}

const field = (
  key: ActiveMemberSettingKey,
  group: ActiveMemberSettingField["group"],
  extra: Partial<ActiveMemberSettingField> = {},
): ActiveMemberSettingField => ({
  key,
  group,
  labelKey: `setting.${key}.label`,
  descriptionKey: `setting.${key}.description`,
  type: "integer",
  min: 0,
  nullable: false,
  warnings: [],
  ...extra,
});

export const ACTIVE_MEMBER_SETTING_FIELDS: readonly ActiveMemberSettingField[] = [
  field("high", "thresholds", {
    nullable: true,
    warnings: [{ code: "grant-disabled-high-null", when: (v) => v === null }],
  }),
  field("low", "thresholds", {
    nullable: true,
    warnings: [
      { code: "revoke-disabled-low-null", when: (v) => v === null },
      { code: "revoke-disabled-low-zero", when: (v) => v === 0 },
    ],
  }),
  field("chat", "weights"),
  field("image", "weights"),
  field("music", "weights"),
  field("interaction", "weights"),
  field("voicePer10Min", "weights"),
];

/** Per-value checks, in order; the first failing one is reported. */
const VALUE_CHECKS: readonly {
  code: ActiveMemberSettingsIssueCode;
  fails(value: unknown, field: ActiveMemberSettingField): boolean;
}[] = [
  { code: "not-finite", fails: (v) => typeof v !== "number" || !Number.isFinite(v) },
  { code: "not-integer", fails: (v) => !Number.isInteger(v) },
  { code: "below-min", fails: (v, f) => (v as number) < f.min },
];

/** A field left `undefined` is not being changed and is skipped. */
export interface ActiveMemberSettingsInput {
  high?: number | null;
  low?: number | null;
  weights?: Partial<ActivityWeights>;
}

export interface ActiveMemberSettingsIssue {
  code: ActiveMemberSettingsIssueCode;
  field?: ActiveMemberSettingKey;
  /** Message key for the explanation; `{label}` resolves from `labelKey`. */
  messageKey: string;
  labelKey?: string;
  params?: Record<string, number>;
}

export interface ActiveMemberSettingsValidation {
  /** True when there are no errors (warnings do not block saving). */
  ok: boolean;
  errors: ActiveMemberSettingsIssue[];
  warnings: ActiveMemberSettingsIssue[];
}

const issue = (
  code: ActiveMemberSettingsIssueCode,
  spec?: ActiveMemberSettingField,
): ActiveMemberSettingsIssue => ({
  code,
  messageKey: `setting.issue.${code}`,
  ...(spec ? { field: spec.key, labelKey: spec.labelKey, params: { min: spec.min } } : {}),
});

function fieldValue(spec: ActiveMemberSettingField, input: ActiveMemberSettingsInput): unknown {
  return spec.group === "weights"
    ? input.weights?.[spec.key as keyof ActivityWeights]
    : input[spec.key as ActiveMemberThresholdKey];
}

function fieldError(spec: ActiveMemberSettingField, value: unknown) {
  if (value === null) return spec.nullable ? undefined : issue("required", spec);
  const failed = VALUE_CHECKS.find((check) => check.fails(value, spec));
  return failed && issue(failed.code, spec);
}

export function validateActiveMemberSettings(
  input: ActiveMemberSettingsInput,
): ActiveMemberSettingsValidation {
  const errors: ActiveMemberSettingsIssue[] = [];
  const warnings: ActiveMemberSettingsIssue[] = [];
  for (const spec of ACTIVE_MEMBER_SETTING_FIELDS) {
    const value = fieldValue(spec, input);
    if (value === undefined) continue;
    const error = fieldError(spec, value);
    if (error) errors.push(error);
    else {
      const hits = spec.warnings.filter((w) => w.when(value as number | null));
      warnings.push(...hits.map((w) => issue(w.code, spec)));
    }
  }
  const { high, low } = input;
  if (errors.length === 0 && high != null && low != null && high < low) {
    errors.push(issue("high-below-low"));
  }
  return { ok: errors.length === 0, errors, warnings };
}
