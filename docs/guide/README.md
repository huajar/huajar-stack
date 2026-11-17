# The huajar-stack guide

huajar-stack works best when you stop micromanaging the agent. You describe what you want and how you'll know it's done. `/huajar-stack:huajar-mode` picks the playbook, runs the other skills as the steps need them, and shows you the evidence. This guide teaches that habit with realistic prompts.

Here's what you'll learn:

1. [Set up huajar-stack](./01-setup.md). Install the plugin and pick your models.
2. [Route work through `/huajar-stack:huajar-mode`](./02-huajar-mode.md). Give it a goal and watch it pick a playbook.
3. [Understand the code](./03-understand.md). A read-only investigation, then `/huajar-stack:how`, `/huajar-stack:why`, `/huajar-stack:teach`, and `/huajar-stack:recall` before you edit anything.
4. [Design the change](./04-design.md). `/huajar-stack:architect`, `/huajar-stack:arena`, `/huajar-stack:swarm`, `/huajar-stack:interrogate`, prototypes, and plans before code locks in a shape.
5. [Build and clean the change](./05-build-and-clean.md). The build playbooks, `/huajar-stack:tdd`, `/huajar-stack:unslop`, and `/huajar-stack:no-comments`.
6. [Verify and ship](./06-verify-and-ship.md). Prove behavior on the real app, formally verify what tests rarely reach, vet numbers with `/huajar-stack:benchmark-checklist`, then open a focused PR and drive it to merged.
7. [Run work while you sleep](./07-overnight.md). Trust before loops, an overnight contract, a decision log you can audit, and Projects and automations that scale past one agent.
8. [Steer with principle names](./08-principles.md). The 24 names that redirect an agent mid-task.
9. [Make it yours](./09-make-it-yours.md). Your own mode, `/huajar-stack:correct` for repeated mistakes, and how to test a skill change.
10. [Recipes and pitfalls](./10-recipes-and-pitfalls.md). Prompts to copy and mistakes to skip.

Read the pages in order the first time. After that, each page stands alone.

The pictures come from pstack, the plugin huajar-stack builds on. The `/poteto-mode` drawn on a board is `/huajar-stack:huajar-mode`, and a skill drawn with no prefix, such as `/how`, is typed `/huajar-stack:how`. `/loop` is Claude Code's own command, so you type it as drawn.

When you're stuck, or can't tell which skill fits, type [`/huajar-stack:huajar-help`](../../skills/huajar-help/SKILL.md) with your question:

```text
/huajar-stack:huajar-help which skill should i use to review this branch?
```

It answers, hands you a prompt to send, and links the skill or guide page the answer came from. It doesn't start the work, because a huajar-stack run spends real tokens, so you send the prompt when you're ready. It runs only when you type it.

## If you only remember one thing

Give the agent a goal and a way to check it, in your own words:

```text
/huajar-stack:huajar-mode the export writes duplicate rows when a retry lands mid-run. repro first, then fix and verify.
```

You don't need to name a playbook or list skills. "repro first" and a checkable outcome are all the routing signal `/huajar-stack:huajar-mode` needs. It matches the Bug fix playbook, copies the steps into a todo list, and calls the right skills as each step fires.

Next: [Set up huajar-stack](./01-setup.md).
