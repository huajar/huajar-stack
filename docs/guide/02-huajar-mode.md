# Route work through `/huajar-stack:huajar-mode`

`/huajar-stack:huajar-mode` is the front door. You give it a goal, it matches one of twenty-two playbooks, copies that playbook's steps into the todo list, and calls the other skills as the steps need them. In this page you learn what a good prompt looks like, and how little of one you actually need.

![A dispatcher pulls a switch lever to route robots on rail handcars toward lit gates, under a /poteto-mode departure board listing BUG FIX, FEATURE, and INVESTIGATION.](./images/router.jpg)

## What happens to your prompt

```mermaid
flowchart TD
    A[Your prompt] --> B[huajar-mode]
    B --> C[Read the Principles section]
    C --> D{Match the task}
    D -->|Read-only question| E[Investigation]
    D -->|Defect| F[Bug fix]
    D -->|New behavior| G[Feature]
    D -->|Structure only| H[Refactoring]
    D -->|Measured slowness| I[Perf issue]
    D -->|Large work or no match| J[figure-it-out]
    E --> K[Verify and report]
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K
```

The diagram shows the common routes. There are also playbooks for hillclimbing a metric, diagnosing runtime symptoms and captured traces, prototypes, visual parity, authoring and evaluating skills, autonomous runs, opening a PR, babysitting a PR or stack to merge-ready, shipping a verified stack, running a PR queue or a stack on autopilot, session pickup, pausing safely, multi-phase plans, and worktree cleanup. The [playbook directory](../../skills/huajar-mode/playbooks/) has the full set.

## Say the goal, not the ceremony

You don't write a spec. You say what's wrong or what you want, plus anything you already know that saves the agent time:

```text
/huajar-stack:huajar-mode users get two notifications after a retry. repro first, then fix and verify.
```

That's a Bug fix prompt. "repro first" is a real constraint, not politeness, and the playbook honors it. Watch the todo list fill with the Bug fix steps.

## What goes in a prompt

A useful prompt carries up to five things, and each one fits in a sentence:

- **The goal.** Say what's wrong, or what you want.
- **The done check.** It must be able to pass or fail. "Make it better" and "work on it for an hour" aren't checks.
- **The proof you want to see.** Ask for the real command output, a video of the flow, the stored value, or a before-and-after number.
- **What you already know.** A symptom, a repro step, a log line, or a link saves the agent a search.
- **The real constraints.** "repro first", "don't change any code yet", "zero behavior change", and "let me review before proceeding" each change what the agent does.

Here's one prompt with all five:

```text
/huajar-stack:huajar-mode the csv export drops its last row since yesterday's deploy. failing job id is 4812. repro first, then fix. done means the 60k-row fixture exports every row. show me the row counts before and after.
```

Two things are worth leaving out:

- **The how.** Say what to achieve, and leave the agent room to find a better path than the one you'd pick. The same goes for a list of skills, covered in the pitfall below.
- **Your theory of the cause, at first.** A stated guess narrows the search to wherever you pointed. Let the agent restate the problem before you share your hunch.

For a noisy report, such as a long thread or a vague bug, make the restatement the first step:

```text
/huajar-stack:huajar-mode read this thread. restate the underlying issue in your own words, in plain english. don't change any code yet.
```

A misreading shows up in the restatement, before any code exists. Correct it there, and it costs you one message instead of one wrong fix. For the restatement alone, with no playbook, run [`/huajar-stack:in-your-own-words`](../../skills/in-your-own-words/SKILL.md). It restates what the agent thinks your goals are and what problem you're trying to solve.

When you're unsure whether a prompt is aimed right, run [`/huajar-stack:sharpen`](../../skills/sharpen/SKILL.md) on it before you send it:

```text
/huajar-stack:sharpen write a migration guide for the v2 config format.
```

The agent says what a top professional would do that you didn't ask for, the rawest material they would start from, the methods and tools they would use, and what other than you or the agent would show the result is right. Then it rewrites your prompt to ask for exactly that, deeper but not bigger. The rewrite asks the agent to prototype any choice an experiment can settle and to recommend an option from what it observed, and it leaves product and preference choices to you. It doesn't do the task. Read the rewrite, then send it, for example with `/huajar-stack:huajar-mode`.

## Follow up short

When the conversation already carries the context, the prompt shrinks to almost nothing. All of these are enough:

```text
/huajar-stack:huajar-mode do it
```

```text
continue
```

```text
keep going until done
```

Short works because the playbook holds the structure, and `/huajar-stack:huajar-mode` stays in context on later turns once you invoke it. [Set up huajar-stack](./01-setup.md#run-your-first-task) shows when to invoke it again. Your words carry the intent, and the skill carries the rigor.

## Switch tasks with "new task"

A long chat accumulates context from the last task. When you change subjects, say so:

```text
/huajar-stack:huajar-mode new task. figure out why the cache entry survives logout. don't change any code yet.
```

"new task" tells `/huajar-stack:huajar-mode` to re-match rather than continue the prior playbook. "don't change any code yet" pins this one to Investigation. Without those two phrases, a mode mid-Feature tends to treat your question as the next feature step.

## Give parallel work its own machine

If you run several agents against one repository on one computer, they will fight over the working tree, the ports, and the build output. The cleanest isolation is a Cloud worker, a [`claude --cloud` session](https://code.claude.com/docs/en/claude-code-on-the-web) with its own VM and branch, so it can install dependencies and run checks without touching your machine. Playbooks that fan out, such as `/huajar-stack:swarm` and Autopilot-full, start their workers as Cloud workers by default. Your chat stays the coordinator and starts each one from its own `hc` terminal, so open the chat in a Herdr app terminal. [The cloud workers reference](../../skills/huajar-mode/references/cloud-workers.md) holds the launch.

A Cloud worker needs two things, and both fail silently:

- The cloud environment can reach your repository on GitHub. Without that access, the session gets an uploaded copy and cannot push.
- The huajar-stack plugin is installed and enabled on claude.ai, so it loads in every cloud session.

Before the first Cloud worker of a run, the coordinator starts a short probe session that checks both, and if either fails, it names what is missing and starts the run's workers as Local workers instead. The quota cap from [setup](./01-setup.md#pick-your-models) limits how many full sessions, local and cloud, run at once. A fan-out larger than the cap still runs every worker, a few at a time. The [cloud workers reference](../../skills/huajar-mode/references/cloud-workers.md) has the steps.

When the work has to stay local, ask for a worktree up front:

```text
/huajar-stack:huajar-mode new task. branch off <base> in a fresh worktree, then port the parser change there.
```

Each task in its own branch and worktree means no agent stomps another's files. Worktrees cost disk and machine resources, so a laptop runs only a handful at once. The [Opening a PR playbook](../../skills/huajar-mode/playbooks/opening-a-pr.md) already works from a worktree for code changes, so mostly you only say this when a specific base or location matters.

Worktrees accumulate. When disk gets tight, ask:

```text
/huajar-stack:huajar-mode what's eating my disk? prune the worktrees that are safe to prune.
```

The [Worktree cleanup playbook](../../skills/huajar-mode/playbooks/worktree-cleanup.md) classifies every worktree by merge state, uncommitted work, and which chats still touch it. It deletes only what that evidence clears and pauses for your call on anything holding uncommitted work.

## Leave it running

When you step away, say what done means and go:

```text
/huajar-stack:huajar-mode im stepping away. keep going until the migration check reports zero old callers. log your decisions.
```

Work you'll review later routes through [`/huajar-stack:figure-it-out`](../../skills/figure-it-out/SKILL.md), which designs the run's phases and keeps a [`/huajar-stack:show-me-your-work`](../../skills/show-me-your-work/SKILL.md) decision log. [Run work while you sleep](./07-overnight.md) covers the full overnight contract.

**Pitfall:** don't enumerate skills in your prompt ("use /huajar-stack:architect, then /huajar-stack:arena, then /huajar-stack:interrogate..."). The playbook already sequences them, and a hand-written sequence usually reorders or drops steps the playbook would have kept. Name a skill only when you want to override a specific choice.

Read [`huajar-mode`](../../skills/huajar-mode/SKILL.md) itself for the full routing rules.

Next: [Understand the code](./03-understand.md).
