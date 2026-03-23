Reasoning trace log
===================

This is a placeholder lab log for rough observations and next checks.

## March 18

- Looked at a small set of reasoning traces where the model answered correctly for the wrong reason.
- The visible chain looked coherent, but token-level evidence suggested the answer was fixed early.

## March 21

- Tried grouping examples by whether the final answer changed under paraphrase.
- Stable answers did not always correspond to stable intermediate reasoning.

## Next things to test

1. Compare traces before and after a targeted intervention.
2. Separate cases where the model is wrong confidently from cases where it self-corrects late.
3. Check whether explanation quality tracks any internal signal we can measure reliably.
