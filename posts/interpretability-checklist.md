Interpretability eval checklist
===============================

This is a placeholder checklist for deciding whether an interpretability result is useful beyond the demo.

## Core questions

1. Does the result explain a concrete behavior, or only show an interesting activation?
2. Is the claimed mechanism stable across prompts, paraphrases, and seeds?
3. Does intervention on the mechanism change the behavior in the predicted direction?
4. Is the explanation local to a toy setting, or does it survive a more realistic task?

## Failure cases to watch

- The feature is visually nice but does not support a causal claim.
- The behavior disappears as soon as prompt wording changes.
- The intervention works only because it damages the model globally.
- The explanation is post hoc and does not help prediction.

## What would make this stronger

- A clean before-and-after intervention result.
- Evidence that the same story appears in related prompts.
- A short note on what the method would help an operator do.
