# SMART AI V2 training plan

## Experiment objective

Teach SMART AI application behavior, Egyptian-Arabic interaction style, data grounding,
confirmation boundaries, secret protection, and routing boundaries without training on
customer records or Voice DNA recordings.

## Baseline

Before enabling a trained artifact, run the existing deterministic SMART AI behavior
against the same scenario categories represented by the held-out set. Keep this as the
behavior baseline.

## Training run

Default experiment:
- Base model: Qwen/Qwen3-4B
- SFT + LoRA
- 3 epochs
- learning rate 2e-4
- LoRA rank 16 / alpha 32
- max sequence length 1024
- seeded 85/15 train/eval split from the training dataset for trainer loss tracking

Qwen's current model card lists Qwen3-4B as a 4.0B-parameter causal LM with Apache-2.0
licensing and supports an explicit non-thinking mode for efficient dialogue. The
fine-tune script uses the model's conversational format and the evaluation runner turns
thinking off so generated responses can be reviewed as direct application answers.

## Held-out evaluation

The separate 22-example evaluation file is not loaded by the fine-tune script. Use
the eval:smart-ai npm script after training and manually review category coverage for:
grounding, no hallucinated records, confirmation gates, secret protection, external
routing, Egyptian Arabic style, and clarification.

## Release gate

Do not automatically activate the trained model.

A run is only eligible for runtime testing after:
1. the training command completes,
2. loss/perplexity is recorded,
3. held-out predictions are generated,
4. behavior failures are reviewed,
5. inference is started behind the existing OpenAI-compatible local adapter,
6. deterministic rules remain the first path for known SMART TIME intents.

## Data boundary

Only synthetic, repository-owned examples are allowed in this training experiment.
Do not add exports, account backups, chat transcripts, API keys, passwords, raw audio,
voice embeddings, or Voice DNA sample files to the dataset or training artifacts.
