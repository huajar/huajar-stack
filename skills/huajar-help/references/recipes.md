# Prompts worth copying

Swap in the real paths, skills, and done checks. Informal wording works.

## Understand

- `/huajar-stack:huajar-mode read <thread>. restate the underlying issue in your own words, in plain english.`
- `/huajar-stack:in-your-own-words <long or messy ask>`
- `/huajar-stack:sharpen <the prompt you're about to send>`
- `/huajar-stack:huajar-mode investigate why <symptom>. give me what we know, what data you used, and your best hypotheses. don't change any code yet.`
- `use /huajar-stack:how to understand <subsystem>. then use /huajar-stack:why to find out why it broke recently.`
- `/huajar-stack:recall my work on <topic> from last week, then read <issue>.`
- `/huajar-stack:teach me why you implemented it this way and not <other way>. what did you trade off?`
- `/huajar-stack:huajar-mode take over this branch. read the decision log, find what's done, and continue. don't redo finished work.`

## Build

- Bug: `/huajar-stack:huajar-mode <symptom>. repro first, then fix and verify.`
- Bug in an app: `/huajar-stack:huajar-mode repro this with /verify-<app>. if it repros on main, fix it and show me a video as proof.`
- Bug with a cheap test: `/huajar-stack:huajar-mode repro <bug> first. if there's a cheap test path, /huajar-stack:tdd it. then fix and rerun.`
- Feature: `/huajar-stack:huajar-mode add <behavior>. <current output> stays byte-identical. verify both.`
- Refactor: `/huajar-stack:huajar-mode move <code> into one module, zero behavior change. record the current output first and prove it's unchanged after.`
- Perf: `/huajar-stack:huajar-mode <operation> takes <time> on <fixture>. trace it, fix the measured cause, show me before and after.`

## Design and plan

- `/huajar-stack:huajar-mode prototype a few options for <feature>. take screenshots or videos for me to compare.`
- `/huajar-stack:huajar-mode we need <feature>. /huajar-stack:architect it first, and answer open questions with prototypes. let me review before proceeding.`
- `/huajar-stack:huajar-mode write a tutorial for how i would use <new package> first. then /huajar-stack:teach me why it beats the current one.`
- `ask /huajar-stack:arena for a second opinion on this thread and our approach.`
- `/huajar-stack:huajar-mode turn this design into a plan. small verifiable PRs, each with its own verification steps.`
- `/huajar-stack:huajar-mode plan the migration of <library> to <target>. small verifiable PRs. the result must match the original exactly, bugs included.`

## Review and ship

- `/huajar-stack:interrogate the whole branch, but skeptically. don't change anything yet. no nitpicks unless it's a real bug or regression.` Read the Dropped list too.
- `/huajar-stack:create-formal-verification-skill prove <property> holds in <module>, even when <steps> interleave or retry.` After merges or refactors in that code: `/huajar-stack:maintain-formal-verification-skill`.
- `/huajar-stack:swarm check every package under <dir> against its check script. one worker per package. one report.`
- `/huajar-stack:huajar-mode open the pr. small ordered commits, evidence in the description.`
- `/huajar-stack:huajar-mode babysit this pr. get it green.` For status only: `/huajar-stack:huajar-mode check on pr <number>. anything outstanding?`
- `/huajar-stack:huajar-mode land the stack.`

## Away and back

- `/huajar-stack:huajar-mode im going to bed. <goal> in a fresh worktree off <base>. done means <checks>. keep a decision log. don't ask me before committing. /loop until done. if you're truly stuck after a few hours, stop and write up why.`
- `/huajar-stack:show-me-your-work catch me up on what you did last night.` Read its Attention section first.
- `/huajar-stack:ketchup` catches you up on this chat since your last message and lists every call that waits on you.
- `/huajar-stack:huajar-mode full autopilot on this queue. each item is independent.`
- `/huajar-stack:huajar-mode autopilot these changes, but don't merge. i'll land them.`
- `/huajar-stack:reflect capture what we learned so the next run doesn't repeat it.` Approve only edits that change a future decision.
- `/huajar-stack:bro` restates the last reply in plain words.
