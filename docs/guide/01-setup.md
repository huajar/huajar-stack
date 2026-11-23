# Set up huajar-stack

In this page you install the plugin, pick which models huajar-stack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

In your shell, run:

```sh
claude plugin marketplace add huajar/huajar-stack
claude plugin install huajar-stack@huajar-stack
```

Inside a session, the same commands are `/plugin marketplace add …` and `/plugin install …`, which opens the plugin in the `/plugin` panel to install it. To check it, run `claude plugin list`: it shows `huajar-stack@huajar-stack` as enabled. [Install plugins](https://code.claude.com/docs/en/plugins/install) has the details.

## Pick your models

Run:

```text
/huajar-stack:setup-huajar-stack
```

[`/huajar-stack:setup-huajar-stack`](../../skills/setup-huajar-stack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.claude/rules/huajar-stack-models.md`, a small rule every huajar-stack skill reads. It also records the Local ceiling, the most full Claude Code sessions your machine runs at once, which setup suggests from your CPUs and memory.

The defaults are the same as the `medium` budget. Every role runs a Claude model at `medium` reasoning. Code, prose, judgment, and swarm workers run on Opus 5.5. The review panels mix Fable 5.2, Opus 5.5, and Sonnet 5.5. No role runs above `xhigh`. Outside a review panel, Fable 5.2 runs only when you name it for a task or after two Opus 5.5 runs of the same brief fail their check. `large` raises every role to `xhigh` and `small` lowers it to `low`. Verification runs on the `swarm workers` model.

You only override what you care about. A role with no line in the rule keeps the skill's default. To restore a default, delete that role's line. A rerun of `/huajar-stack:setup-huajar-stack` keeps any role whose model differs from the default. When a default changes, a rule written before the change still pins the old default until you run `/huajar-stack:setup-huajar-stack` again. That run replaces the old defaults it recognizes, tells you which, and keeps your other choices. To drop a pin it does not recognize, delete that role's line or the file first.

You might be wondering what happens if you use Auto. Set a role to `inherit-parent` or `auto` and it runs on your parent chat model. Both values mean the same thing, and neither is a model slug. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/huajar-stack:swarm` worker unless a race names a model for each arm.

## Accept the verification offers, or don't

At the end of setup, `/huajar-stack:setup-huajar-stack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/huajar-stack:create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.claude/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/huajar-stack:create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to huajar-stack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/huajar-stack:create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

After setup, start a new chat. The model rule applies to new sessions.

## Keep the cost in check

huajar-stack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/huajar-stack:setup-huajar-stack` and pick a smaller reasoning budget or cheaper models. A strong model in the main chat with cheaper, faster models in the code roles is a good split.
- Set a role to `auto` or `inherit-parent` so it runs on the chat's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/huajar-stack:huajar-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/huajar-stack:huajar-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt.

From here you can type normal follow-ups. When you invoke `/huajar-stack:huajar-mode`, its `SKILL.md` enters the conversation as one message and [stays there across later turns](https://code.claude.com/docs/en/skills). After a compaction, only part of it may be re-attached, and older skills can drop, so invoke `/huajar-stack:huajar-mode` again for a new task or after a long session.

Next: [Route work through `/huajar-stack:huajar-mode`](./02-huajar-mode.md).
