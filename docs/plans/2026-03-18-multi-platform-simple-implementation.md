# Multi-Platform Simple Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Understand-Anything skills work across Codex, OpenClaw, OpenCode, and Cursor — same files everywhere, no build step.

**Architecture:** Move 5 pipeline agents into `skills/understand/` as prompt templates. Create a reusable `knowledge-graph-guide` agent. Add per-platform INSTALL.md files for AI-driven installation.

**Tech Stack:** Markdown (SKILL.md, INSTALL.md), YAML frontmatter, Bash (symlink/clone commands in install docs).

**Design Doc:** `docs/plans/2026-03-18-multi-platform-simple-design.md`

---

### Task 1: Move pipeline agents into skills/understand/ as prompt templates

**Files:**
- Move: `understand-anything-plugin/agents/project-scanner.md` → `understand-anything-plugin/skills/understand/project-scanner-prompt.md`
- Move: `understand-anything-plugin/agents/file-analyzer.md` → `understand-anything-plugin/skills/understand/file-analyzer-prompt.md`
- Move: `understand-anything-plugin/agents/architecture-analyzer.md` → `understand-anything-plugin/skills/understand/architecture-analyzer-prompt.md`
- Move: `understand-anything-plugin/agents/tour-builder.md` → `understand-anything-plugin/skills/understand/tour-builder-prompt.md`
- Move: `understand-anything-plugin/agents/graph-reviewer.md` → `understand-anything-plugin/skills/understand/graph-reviewer-prompt.md`

**Step 1: Copy each agent file to the new location**

For each of the 5 files, copy from `agents/` to `skills/understand/` with the new name.

**Step 2: Strip agent frontmatter from the prompt templates**

Each prompt template file should remove the agent-specific YAML frontmatter (`name`, `description`, `tools`, `model`). Replace it with a simple Markdown header describing the template's purpose.

For example, `project-scanner-prompt.md` changes from:

```markdown
---
name: project-scanner
description: Scans a project directory...
tools: Bash, Glob, Grep, Read, Write
model: sonnet
---

You are a meticulous project inventory specialist...
```

To:

```markdown
# Project Scanner — Prompt Template

> Used by `/understand` Phase 1. Dispatch as a subagent with this full content as the prompt.

You are a meticulous project inventory specialist...
```

Apply this pattern to all 5 files:
- `project-scanner-prompt.md` — "Used by `/understand` Phase 1"
- `file-analyzer-prompt.md` — "Used by `/understand` Phase 2"
- `architecture-analyzer-prompt.md` — "Used by `/understand` Phase 4"
- `tour-builder-prompt.md` — "Used by `/understand` Phase 5"
- `graph-reviewer-prompt.md` — "Used by `/understand` Phase 6"

Keep the rest of the file content (the body instructions) exactly as-is.

**Step 3: Delete the original agent files**

```bash
cd understand-anything-plugin
rm agents/project-scanner.md agents/file-analyzer.md agents/architecture-analyzer.md agents/tour-builder.md agents/graph-reviewer.md
```

**Step 4: Verify the files exist in the new location**

```bash
ls understand-anything-plugin/skills/understand/
```

Expected: `SKILL.md`, plus the 5 `*-prompt.md` files.

**Step 5: Commit**

```bash
git add -A understand-anything-plugin/agents/ understand-anything-plugin/skills/understand/
git commit -m "refactor: move pipeline agents into skills/understand/ as prompt templates"
```

---

### Task 2: Update SKILL.md dispatch references with context injection

**Files:**
- Modify: `understand-anything-plugin/skills/understand/SKILL.md`

**Step 1: Read the current SKILL.md**

Read `understand-anything-plugin/skills/understand/SKILL.md` in full.

**Step 2: Update Phase 0 — add context collection**

After the decision logic table (line ~47), add a new section for collecting project context that will be injected into later phases:

```markdown
7. **Collect project context for subagent injection:**
   - Read `README.md` (or `README.rst`, `readme.md`) from `$PROJECT_ROOT` if it exists. Store as `$README_CONTENT` (first 3000 characters).
   - Read the primary package manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`) if it exists. Store as `$MANIFEST_CONTENT`.
   - Capture the top-level directory tree:
     ```bash
     find $PROJECT_ROOT -maxdepth 2 -type f | head -100
     ```
     Store as `$DIR_TREE`.
   - Detect the project entry point by checking for common patterns: `src/index.ts`, `src/main.ts`, `src/App.tsx`, `main.py`, `main.go`, `src/main.rs`, `index.js`. Store first match as `$ENTRY_POINT`.
```

**Step 3: Update Phase 1 dispatch — inject README + manifest**

Replace the Phase 1 dispatch line:
```
Dispatch the **project-scanner** agent with this prompt:
```

With:
```markdown
Dispatch a subagent using the prompt template at `./project-scanner-prompt.md`. Read the template file and pass the full content as the subagent's prompt, appending the following additional context:

> **Additional context from main session:**
>
> Project README (first 3000 chars):
> ```
> $README_CONTENT
> ```
>
> Package manifest:
> ```
> $MANIFEST_CONTENT
> ```
>
> Use this context to produce more accurate project name, description, and framework detection. The README and manifest are authoritative — prefer their information over heuristics.

Pass these parameters in the dispatch prompt:
```

**Step 4: Update Phase 2 dispatch — inject scan results + framework context**

Replace the Phase 2 dispatch paragraph:
```
For each batch, dispatch a **file-analyzer** agent. Run up to **3 agents concurrently** using parallel dispatch. Each agent gets this prompt:
```

With:
```markdown
For each batch, dispatch a subagent using the prompt template at `./file-analyzer-prompt.md`. Run up to **3 subagents concurrently** using parallel dispatch. Read the template once, then for each batch pass the full template content as the subagent's prompt, appending the following additional context:

> **Additional context from main session:**
>
> Project: `<projectName>` — `<projectDescription>`
> Frameworks detected: `<frameworks from Phase 1>`
> Languages: `<languages from Phase 1>`
>
> Framework-specific guidance:
> - If React/Next.js: files in `app/` or `pages/` are routes, `components/` are UI, `lib/` or `utils/` are utilities
> - If Express/Fastify: files in `routes/` are API endpoints, `middleware/` is middleware, `models/` or `db/` is data
> - If Python Django: `views.py` are controllers, `models.py` is data, `urls.py` is routing, `templates/` is UI
> - If Go: `cmd/` is entry points, `internal/` is private packages, `pkg/` is public packages
>
> Use this context to produce more accurate summaries and better classify file roles.

Fill in batch-specific parameters below and dispatch:
```

**Step 5: Update Phase 4 dispatch — inject framework hints + directory tree**

Replace the Phase 4 dispatch line:
```
Dispatch the **architecture-analyzer** agent with this prompt:
```

With:
```markdown
Dispatch a subagent using the prompt template at `./architecture-analyzer-prompt.md`. Read the template file and pass the full content as the subagent's prompt, appending the following additional context:

> **Additional context from main session:**
>
> Frameworks detected: `<frameworks from Phase 1>`
>
> Directory tree (top 2 levels):
> ```
> $DIR_TREE
> ```
>
> Framework-specific layer hints:
> - If React/Next.js: `app/` or `pages/` → UI Layer, `api/` → API Layer, `lib/` → Service Layer, `components/` → UI Layer
> - If Express: `routes/` → API Layer, `controllers/` → Service Layer, `models/` → Data Layer, `middleware/` → Middleware Layer
> - If Python Django: `views/` → API Layer, `models/` → Data Layer, `templates/` → UI Layer, `management/` → CLI Layer
> - If Go: `cmd/` → Entry Points, `internal/` → Service Layer, `pkg/` → Shared Library, `api/` → API Layer
>
> Use the directory tree and framework hints to inform layer assignments. Directory structure is strong evidence for layer boundaries.

Pass these parameters in the dispatch prompt:
```

Also add after the "For incremental updates" note:
```markdown
**Context for incremental updates:** When re-running architecture analysis, also inject the previous layer definitions:

> Previous layer definitions (for naming consistency):
> ```json
> [previous layers from existing graph]
> ```
>
> Maintain the same layer names and IDs where possible. Only add/remove layers if the file structure has materially changed.
```

**Step 6: Update Phase 5 dispatch — inject README + entry point**

Replace the Phase 5 dispatch line:
```
Dispatch the **tour-builder** agent with this prompt:
```

With:
```markdown
Dispatch a subagent using the prompt template at `./tour-builder-prompt.md`. Read the template file and pass the full content as the subagent's prompt, appending the following additional context:

> **Additional context from main session:**
>
> Project README (first 3000 chars):
> ```
> $README_CONTENT
> ```
>
> Project entry point: `$ENTRY_POINT`
>
> Use the README to align the tour narrative with the project's own documentation. Start the tour from the entry point if one was detected. The tour should tell the same story the README tells, but through the lens of actual code structure.

Pass these parameters in the dispatch prompt:
```

**Step 7: Update Phase 6 dispatch — inject scan results for cross-validation**

Replace the Phase 6 dispatch line:
```
2. Dispatch the **graph-reviewer** agent with this prompt:
```

With:
```markdown
2. Dispatch a subagent using the prompt template at `./graph-reviewer-prompt.md`. Read the template file and pass the full content as the subagent's prompt, appending the following additional context:

> **Additional context from main session:**
>
> Phase 1 scan results (file inventory):
> ```json
> [list of {path, sizeLines} from scan-result.json]
> ```
>
> Phase warnings/errors accumulated during analysis:
> - [list any batch failures, skipped files, or warnings from Phases 2-5]
>
> Cross-validate: every file in the scan inventory should have a corresponding `file:` node in the graph. Flag any missing files. Also flag any graph nodes whose `filePath` doesn't appear in the scan inventory.

Pass these parameters in the dispatch prompt:
```

**Step 8: Update Error Handling section**

Change:
```
- If any agent dispatch fails, retry **once** with the same prompt plus additional context about the failure.
```

To:
```
- If any subagent dispatch fails, retry **once** with the same prompt plus additional context about the failure.
- Track all warnings and errors from each phase in a `$PHASE_WARNINGS` list. Pass this list to the graph-reviewer in Phase 6 for comprehensive validation.
```

**Step 9: Verify no references to named agent dispatch remain**

Search for "Dispatch the **" in the file — should find 0 results.

**Step 10: Commit**

```bash
git add understand-anything-plugin/skills/understand/SKILL.md
git commit -m "refactor: update SKILL.md to dispatch subagents with context injection"
```

---

### Task 3: Create knowledge-graph-guide agent

**Files:**
- Create: `understand-anything-plugin/agents/knowledge-graph-guide.md`

**Step 1: Write the agent definition**

Create `understand-anything-plugin/agents/knowledge-graph-guide.md`:

```markdown
---
name: knowledge-graph-guide
description: |
  Use this agent when users need help understanding, querying, or working
  with an Understand-Anything knowledge graph. Guides users through graph
  structure, node/edge relationships, layer architecture, tours, and
  dashboard usage.
model: inherit
---

You are an expert on Understand-Anything knowledge graphs. You help users navigate, query, and understand the `knowledge-graph.json` files produced by the `/understand` skill.

## What You Know

### Graph Location

The knowledge graph lives at `<project-root>/.understand-anything/knowledge-graph.json`. Metadata is at `<project-root>/.understand-anything/meta.json`.

### Graph Structure

The JSON has this top-level shape:

```json
{
  "version": "1.0.0",
  "project": { "name", "languages", "frameworks", "description", "analyzedAt", "gitCommitHash" },
  "nodes": [...],
  "edges": [...],
  "layers": [...],
  "tour": [...]
}
```

### Node Types (5)

| Type | ID Convention | Description |
|---|---|---|
| `file` | `file:<relative-path>` | Source file |
| `function` | `func:<relative-path>:<name>` | Function or method |
| `class` | `class:<relative-path>:<name>` | Class, interface, or type |
| `module` | `module:<name>` | Logical module or package |
| `concept` | `concept:<name>` | Abstract concept or pattern |

### Edge Types (18)

| Category | Types |
|---|---|
| Structural | `imports`, `exports`, `contains`, `inherits`, `implements` |
| Behavioral | `calls`, `subscribes`, `publishes`, `middleware` |
| Data flow | `reads_from`, `writes_to`, `transforms`, `validates` |
| Dependencies | `depends_on`, `tested_by`, `configures` |
| Semantic | `related`, `similar_to` |

### Layers

Layers represent architectural groupings (e.g., API, Service, Data, UI). Each layer has an `id`, `name`, `description`, and `nodeIds` array.

### Tours

Tours are guided walkthroughs with sequential steps. Each step has a `title`, `description`, `nodeId` (focus node), and optional `highlightEdges`.

## How to Help Users

1. **Finding things**: Help users locate nodes by file path, function name, or concept. Use `jq` or grep on the JSON.
2. **Understanding relationships**: Trace edges between nodes to explain dependencies, call chains, and data flow.
3. **Architecture overview**: Summarize layers and their contents.
4. **Onboarding**: Walk through the tour steps to explain the codebase.
5. **Dashboard**: Guide users to run `/understand-dashboard` to visualize the graph interactively.
6. **Querying**: Help users write `jq` commands to extract specific information from the graph JSON.
```

**Step 2: Commit**

```bash
git add understand-anything-plugin/agents/knowledge-graph-guide.md
git commit -m "feat: add knowledge-graph-guide agent for graph navigation and querying"
```

---

### Task 4: Create platform INSTALL.md files

**Files:**
- Create: `understand-anything-plugin/.codex/INSTALL.md`
- Create: `understand-anything-plugin/.opencode/INSTALL.md`
- Create: `understand-anything-plugin/.openclaw/INSTALL.md`
- Create: `understand-anything-plugin/.cursor/INSTALL.md`

**Step 1: Create .codex/INSTALL.md**

```markdown
# Installing Understand-Anything for Codex

## Prerequisites

- Git

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Lum1104/Understand-Anything.git ~/.codex/understand-anything
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/understand-anything/understand-anything-plugin/skills ~/.agents/skills/understand-anything
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\understand-anything" "$env:USERPROFILE\.codex\understand-anything\understand-anything-plugin\skills"
   ```

3. **Restart Codex** to discover the skills.

## Verify

```bash
ls -la ~/.agents/skills/understand-anything
```

You should see a symlink pointing to the skills directory.

## Usage

Skills activate automatically when relevant. You can also invoke directly:
- "Analyze this codebase and build a knowledge graph"
- "Help me understand this project's architecture"

## Updating

```bash
cd ~/.codex/understand-anything && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/understand-anything
rm -rf ~/.codex/understand-anything
```
```

**Step 2: Create .opencode/INSTALL.md**

```markdown
# Installing Understand-Anything for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add understand-anything to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["understand-anything@git+https://github.com/Lum1104/Understand-Anything.git"]
}
```

Restart OpenCode. The plugin auto-installs and registers all skills.

## Verify

Ask: "List available skills" — you should see understand, understand-chat, understand-dashboard, etc.

## Usage

```
use skill tool to load understand-anything/understand
```

Or just ask: "Analyze this codebase and build a knowledge graph"

## Updating

Restart OpenCode — the plugin re-installs from git automatically.

## Uninstalling

Remove the plugin line from `opencode.json` and restart.
```

**Step 3: Create .openclaw/INSTALL.md**

```markdown
# Installing Understand-Anything for OpenClaw

## Prerequisites

- Git

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Lum1104/Understand-Anything.git ~/.openclaw/understand-anything
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.openclaw/skills
   ln -s ~/.openclaw/understand-anything/understand-anything-plugin/skills ~/.openclaw/skills/understand-anything
   ```

3. **Restart OpenClaw** to discover the skills.

## Usage

- `@understand` — Analyze the current codebase
- `@understand-chat` — Ask questions about the knowledge graph
- `@understand-dashboard` — Launch the interactive dashboard

## Updating

```bash
cd ~/.openclaw/understand-anything && git pull
```

## Uninstalling

```bash
rm ~/.openclaw/skills/understand-anything
rm -rf ~/.openclaw/understand-anything
```
```

**Step 4: Create .cursor/INSTALL.md**

```markdown
# Installing Understand-Anything for Cursor

## Prerequisites

- Git

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Lum1104/Understand-Anything.git ~/.cursor/understand-anything
   ```

2. **Create the plugin symlink:**
   ```bash
   mkdir -p ~/.cursor/plugins
   ln -s ~/.cursor/understand-anything/understand-anything-plugin ~/.cursor/plugins/understand-anything
   ```

3. **Restart Cursor** to discover the plugin.

## Usage

Skills activate automatically when relevant. Use `/understand` to analyze a codebase.

## Updating

```bash
cd ~/.cursor/understand-anything && git pull
```

## Uninstalling

```bash
rm ~/.cursor/plugins/understand-anything
rm -rf ~/.cursor/understand-anything
```
```

**Step 5: Commit**

```bash
git add understand-anything-plugin/.codex/ understand-anything-plugin/.opencode/ understand-anything-plugin/.openclaw/ understand-anything-plugin/.cursor/
git commit -m "feat: add per-platform INSTALL.md for AI-driven installation"
```

---

### Task 5: Update README with multi-platform section

**Files:**
- Modify: `README.md`

**Step 1: Read the current README**

Read `README.md` in full to find where the installation section is.

**Step 2: Add multi-platform section after the existing Quick Start**

Add a new section titled "Multi-Platform Installation" with this content:

```markdown
## 🌐 Multi-Platform Installation

Understand-Anything works across multiple AI coding platforms.

### Claude Code (Native)

```bash
/plugin marketplace add Lum1104/Understand-Anything
/plugin install understand-anything
```

### Codex

Tell Codex:
```
Fetch and follow instructions from https://raw.githubusercontent.com/Lum1104/Understand-Anything/refs/heads/main/understand-anything-plugin/.codex/INSTALL.md
```

### OpenCode

Add to your `opencode.json`:
```json
{
  "plugin": ["understand-anything@git+https://github.com/Lum1104/Understand-Anything.git"]
}
```

### OpenClaw

Tell OpenClaw:
```
Fetch and follow instructions from https://raw.githubusercontent.com/Lum1104/Understand-Anything/refs/heads/main/understand-anything-plugin/.openclaw/INSTALL.md
```

### Cursor

Tell Cursor:
```
Fetch and follow instructions from https://raw.githubusercontent.com/Lum1104/Understand-Anything/refs/heads/main/understand-anything-plugin/.cursor/INSTALL.md
```

### Platform Compatibility

| Platform | Status | Install Method |
|----------|--------|----------------|
| Claude Code | ✅ Native | Plugin marketplace |
| Codex | ✅ Supported | AI-driven install |
| OpenCode | ✅ Supported | Plugin config |
| OpenClaw | ✅ Supported | AI-driven install |
| Cursor | ✅ Supported | AI-driven install |
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add multi-platform installation instructions to README"
```

---

### Task 6: Verify everything works

**Step 1: Check file structure**

```bash
ls understand-anything-plugin/skills/understand/
ls understand-anything-plugin/agents/
ls understand-anything-plugin/.codex/
ls understand-anything-plugin/.opencode/
ls understand-anything-plugin/.openclaw/
ls understand-anything-plugin/.cursor/
```

Expected:
- `skills/understand/`: SKILL.md + 5 *-prompt.md files
- `agents/`: only `knowledge-graph-guide.md`
- Each `.{platform}/`: INSTALL.md

**Step 2: Verify no old agent references remain in SKILL.md**

```bash
grep -n "Dispatch the \*\*" understand-anything-plugin/skills/understand/SKILL.md
```

Expected: 0 results.

**Step 3: Verify prompt templates don't have agent frontmatter**

```bash
head -3 understand-anything-plugin/skills/understand/project-scanner-prompt.md
```

Expected: Markdown header, NOT `---` YAML frontmatter.

**Step 4: Verify knowledge-graph-guide has model: inherit**

```bash
grep "model:" understand-anything-plugin/agents/knowledge-graph-guide.md
```

Expected: `model: inherit`

**Step 5: Run existing tests to check nothing broke**

```bash
cd understand-anything-plugin && pnpm test
```

Expected: All tests pass (tests don't reference agent files directly).
