import * as zod from "zod";

/**
 * Refinement for product min/max inventory values. Enforces:
 *   - each value is an integer (the generated schemas only enforce ≥ 0)
 *   - cross-field: when both are set, min ≤ max.
 * Use it via `.superRefine(productMinMaxRefiner)` on the body schema in API
 * route handlers.
 */
export const productMinMaxRefiner = (
  data: { minInventory?: number | null; maxInventory?: number | null },
  ctx: zod.RefinementCtx,
): void => {
  if (data.minInventory != null && !Number.isInteger(data.minInventory)) {
    ctx.addIssue({
      code: "custom",
      path: ["minInventory"],
      message: "minInventory must be a whole number.",
    });
  }
  if (data.maxInventory != null && !Number.isInteger(data.maxInventory)) {
    ctx.addIssue({
      code: "custom",
      path: ["maxInventory"],
      message: "maxInventory must be a whole number.",
    });
  }
  if (
    data.minInventory != null &&
    data.maxInventory != null &&
    Number.isInteger(data.minInventory) &&
    Number.isInteger(data.maxInventory) &&
    data.minInventory > data.maxInventory
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["maxInventory"],
      message: "maxInventory must be greater than or equal to minInventory.",
    });
  }
};
