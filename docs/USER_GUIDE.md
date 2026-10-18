# toodly — user guide

toodly is a desktop to-do app that keeps everything on your computer. This guide explains how to use it. (Developers: see [DEVELOPER.md](DEVELOPER.md).)

> The app interface is in Italian by default. To switch to English open **Settings → Language**. Names in this guide are the English labels.

## Contents

1. [First start](#1-first-start)
2. [The window](#2-the-window)
3. [Adding tasks](#3-adding-tasks)
4. [Working with tasks](#4-working-with-tasks)
5. [Views](#5-views)
6. [Lists, groups and filters](#6-lists-groups-and-filters)
7. [Multi-selection](#7-multi-selection)
8. [Adding many tasks at once](#8-adding-many-tasks-at-once)
9. [Windows and data sets](#9-windows-and-data-sets)
10. [Tray, Quick Add and autostart](#10-tray-quick-add-and-autostart)
11. [Backup and restore](#11-backup-and-restore)
12. [Settings](#12-settings)
13. [Keyboard shortcuts](#13-keyboard-shortcuts)
14. [Where your data is stored](#14-where-your-data-is-stored)
15. [Troubleshooting](#15-troubleshooting)

## 1. First start

When you open toodly for the first time it creates a data set called **Main data** with one list called **General**, and opens it. Type a task in the bar at the top and press **Enter**: you are ready to go.

If you already have several data sets, toodly asks which one to open in each new window (see [Windows and data sets](#9-windows-and-data-sets)).

## 2. The window

- **Sidebar (left)**: smart views (*Today*, *Next 7 days*, *Important*, *All tasks*), your **Lists**, your **Filters**, and the buttons for settings, a new window and bulk import. Drag the thin line between the sidebar and the main area to resize it (double-click to reset). Each window remembers its own sidebar width.
- **Header**: the view switcher (*List*, *Kanban*, *Calendar*, *Gantt*, *Graph*), sorting and grouping options, and the calendar navigation.
- **Main area**: your tasks in the selected view.
- **Detail panel (right)**: opens when you click a task. Click outside it, or press **Esc**, to close it.

toodly remembers where each window was, how big it was, which view it showed and which data set it had open, and restores everything the next time you start the app.

## 3. Adding tasks

Type in the "Add a task…" bar and press **Enter**. You can add shortcuts inside the text:

| Write | Effect |
|---|---|
| `!high` `!medium` `!low` | Sets the priority |
| `@today` `@tomorrow` | Sets the due date |
| `@2026-12-31` | Sets a specific due date |
| `#ListName` | Puts the task in that list (the start of the name is enough) |

Example: `Prepare the report !high @tomorrow #Work`. The Italian words (`!alta`, `@domani`…) work too.

Without `#List`, the task goes into the list you are viewing, or into the default list. Every task always belongs to a list.

You can also add a **sub-task** from the detail panel, or a task directly inside a group (see [Groups](#groups)).

## 4. Working with tasks

### Quick actions

Hover over a task in the list: on the right you can change its **due date**, **priority** and **status** from small menus, **complete** it or **delete** it. Completing and deleting ask for confirmation.

### Completing

Click the checkbox. Completed tasks move to the collapsible **Completed** section. If the task repeats, the next occurrence is created automatically.

### The detail panel

Click a task to open it. You can edit:

- **Title** and **Status** (*To Do*, *In Progress*, *Done*). Next to the title, small buttons change its capitalization (first letter only, Each Word, UPPERCASE, lowercase) or clear it. The title is required: if you leave it empty, the previous one is restored.
- **Priority**: *High*, *Medium*, *Low*, *None* (shown in red, orange, blue and gray).
- **Gantt**: a switch to show or hide the task in the Gantt view.
- **Start** (defaults to the day the task was created; it cannot be after the due date) and **Due date**. Moving the due date before the start moves the start with it.
- **Time** (start and end; the end must be after the start).
- **Repeat**: does not repeat, every day, week, month or year. When you complete the task, the next occurrence is created with the dates shifted.
- **Description**, written in Markdown with a toolbar: bold (`Ctrl+B`), italic (`Ctrl+I`), strikethrough, headings, bulleted and numbered lists, checklists (clickable in the preview), quotes, code, and ready-made **templates** (steps, pros/cons, meeting notes, code block). Lists continue automatically when you press Enter. Use **Preview** to see the result.
- **Subtasks**: add as many as you like; they can be nested and collapsed.
- **Dependencies**: choose "Depends on…" to say that this task cannot be done before others. While a prerequisite is not completed, the task is shown as **waiting** (padlock, dashed border and a "Waiting for…" badge). The panel also lists the tasks that this one unblocks. Circular dependencies are not allowed.
- **Notes**: a feed of timestamped notes. Press `Ctrl+Enter` to save a note.
- **Attachments**: add files; toodly keeps a copy and you can open it with a click.
- **List** and **Group**.

### Ordering

In the List view, choose **Sort**: *Manual (drag)*, *Priority* or *Due date*. With manual sorting, drag tasks to reorder them.

## 5. Views

### List

Tasks of the selected list, view or filter, with sub-tasks, groups and the **Completed** section.

### Kanban

Columns **by status** (To Do / In Progress / Done) or **by priority**. Drag cards between columns to change their status or priority.

### Calendar

Switch between **Week** and **Month** with the header buttons and move with *Previous* / *Next*.

- In the week view you can do **time-blocking**: drag a task from the **Unscheduled** panel into the hourly grid to set its day and time, drag blocks to move them, drag the bottom edge to resize them, and **double-click** an empty slot to create a task.
- In the month view tasks appear on their due day.

### Gantt

A timeline of your tasks. On the left you see the same hierarchy as the List (groups, sub-groups, tasks and sub-tasks; open and closed groups are the same as in the List); on the right each task with a due date is a **bar from its start date to its due date**.

- **Zoom**: *Days*, *Weeks* or *Months*; **Today** centers the timeline on the current day (the vertical line).
- **Click** a bar or a row to open the task details, exactly as in the List.
- **Drag** a bar to move it (start and due date shift together), or drag its left / right edge to change only the start or the due date. Changes snap to whole days.
- A task **without a due date** has no bar: **double-click** its row on the timeline to set the due date on that day.
- Group rows show a **summary bar** from the earliest start to the latest due date of what they contain.
- **Dependencies** are drawn as arrows from the prerequisite to the waiting task; an arrow turns red when the prerequisite ends after the dependent task starts.
- A bar is filled in proportion to the work done (completed tasks fully; tasks with sub-tasks by the share of completed sub-tasks). Completed tasks are dimmed, waiting tasks have a dashed outline. *Show completed* hides or shows completed tasks.
- **Show in Gantt**: each task has a switch in the detail panel (or use the eye button that appears on hover in the Gantt tree). A task that is not shown keeps its place in the hierarchy but becomes a **thin, faint row without a bar**; untick *Show excluded* to hide those rows completely.
- **Export to Mermaid**: the *Mermaid* button saves the whole Gantt as a Markdown file with a `mermaid` diagram, and the copy button puts the same text on the clipboard. Groups become sections, sub-tasks follow their parent, and only tasks that are shown in the Gantt and have a due date are included.
- The Gantt follows the selected list or filter; with *Today* and *Next 7 days* it shows all tasks, like the Calendar.

### Graph

Groups, sub-groups, tasks and sub-tasks drawn as a tree on a large canvas. The bar at the top is the same as in the List (new task, new task from a template, new group).

- **Move around**: drag the background, or use the scroll bars. **Zoom**: `Ctrl` + mouse wheel (or pinch on a trackpad), the *Zoom* slider, or the arrows next to the minimap (the dash fits everything in the window).
- **Minimap** (bottom left): always shows the whole graph and a box with the part you are looking at; click it to jump, or drag the box.
- **Groups** have one of 20 blue/violet tints, assigned in rotation to the top-level groups (sub-groups, tasks and arrows take the colour of their group; tones differ between the light and dark theme). Click a group to fold or unfold it (the state is shared with the List and the Gantt); hover it for *add task*, *new sub-group* and *edit*. Tasks without a group sit under a *No group* node.
- **Tasks** look like in the List: priority-coloured checkbox, red date when overdue, dashed outline when waiting for another task, dimmed when completed, number (if enabled in Settings), sub-task counter. Click to open the details panel; `Ctrl`/`Shift`+click to select several; hover for the quick actions; the arrow on the card folds its sub-tasks.
- **Drag & drop**: drag a card above or below another one to reorder it (and to make it a sibling of that task), onto a group to move it there, or to the strip at the bottom to take it out of all groups. Groups can be dragged onto other groups the same way. Positions on the canvas are always automatic: only the order is yours.
- **Dependencies** are drawn as dashed arrows, like in the Gantt (red when the prerequisite ends after the dependent task starts). *Completed* shows or hides finished tasks; the two chevron buttons fold or unfold everything.
- **Export to Mermaid**: the *Mermaid* button (top right) saves the graph as a Markdown file with a `mermaid` flowchart, and the copy button puts the same text on the clipboard. Groups and sub-groups become boxes, sub-tasks are linked to their parent with a solid arrow and dependencies with a dashed one. Everything in the view is exported, even folded groups; *Completed* is respected.

### Smart views

- **Today**: tasks due today, plus overdue ones.
- **Next 7 days**: tasks due in the coming week, plus overdue ones.
- **Important**: high-priority tasks.
- **All tasks**: everything.

## 6. Lists, groups and filters

### Lists

Use **New list** in the sidebar to create one, choose a name and a color. Hover a list to show the pencil (edit name and color, or delete it) and the **Export to .md** button. Every set must keep at least one list; when you delete a list its tasks move to another one.

### Groups

Groups are folders (and sub-folders) that organize tasks inside the List view, independently from lists.

- Create one with the **Group** button, or **New subgroup** on a group header.
- Click a header to collapse or expand it.
- Drag tasks onto a group header to move them there; drop them on the **Top level** zone that appears while dragging to take them out of any group. You can also change the group from the detail panel or from the selection bar.
- Groups are always shown, even when empty. Names must be unique.
- Open and closed groups are remembered separately for each list (or other view) of each data set, and restored when you come back to it.
- Each group header shows the number of open tasks it contains (sub-groups included), then a red badge with the high-priority ones and an orange badge with the medium-priority ones, when present.
- Deleting a group does **not** delete its tasks and sub-groups: they move up one level.

### Filters

A filter is a saved search. Create one with **New filter** in the sidebar:

1. Give it a name (for example "Urgent today").
2. Choose whether tasks must match **ALL** the rules or **AT LEAST ONE**.
3. Add rules on *Priority*, *Due date* (today, tomorrow, within 7 days, overdue, has a due date, no due date, specific date), *List*, *Status*, *Completed*, *Waiting (dependencies)* or *Title* (contains / does not contain).
4. The dialog shows how many open tasks match. Save it.

The sidebar entry **No filters** turns off the active filter and goes back to *All tasks*.

## 7. Multi-selection

- `Ctrl/Cmd + click` adds or removes a task from the selection.
- `Shift + click` selects a range.
- `Ctrl/Cmd + A` selects every visible task.
- `Esc` (or **None** in the bar) clears the selection.

A bar appears at the bottom with the number of selected tasks. Use it to set the **due date** (quick choices such as Today, Tomorrow, In a week, or a specific date), **priority**, **list**, **group** and **status** for all of them at once, or to **complete** or **delete** them.

## 8. Adding many tasks at once

Click **Add multiple tasks from text** in the sidebar (or press `Ctrl+Shift+I`) and paste or type one task per line.

- **Plain text**: each non-empty line becomes a task. List markers (`-`, `*`, `1.`) and checkboxes are ignored. The `!high @tomorrow #list` shortcuts work on every line.
- **Markdown**: lines starting with `#`, `##`, `###`… create groups and sub-groups (the number of `#` is the depth). The lines below a heading go into that group until the next heading. A heading with the name of an existing group reuses it.
- **Long titles** (over 80 characters) are shortened at the end of a sentence or word, and the rest goes into the task description.

A preview tells you how many tasks and groups will be created. The reverse is also possible: **Export to .md** on a list saves its tasks in a Markdown file that you can import again.

## 9. Windows and data sets

### Data sets

Your data is stored in independent **data sets**, for example "Work" and "Personal". A data set contains its own tasks, lists, groups, filters, notes and attachments. Closing a window never deletes a data set.

Rules:

- Each window works on **one** data set at a time.
- A data set can be open in **only one window** at a time.
- If you open a new window and there are several data sets, toodly asks you to **choose or create** one.
- Names are required and must be unique (upper/lower case does not matter).

Manage them in **Settings → Data → Manage…**: open a set here or in a new window, rename it, or delete it (deleting is permanent and asks for confirmation).

### Multiple windows

Press `Ctrl/Cmd + N` or use **New window** to open another window. Each window has its own view (for example Calendar in one and the *Work* list in another). The window title shows `toodly - <data set name>`. On the next start every window comes back where it was.

## 10. Tray, Quick Add and autostart

### Tray

toodly puts an icon in the system tray.

- **Left click**: brings back the last window you used.
- **Right click**: *Open New Window*, *New Quick Task*, *Quit*.

When you close the **last** window, toodly asks whether to **Quit** or **Stay in tray**. If it stays, it keeps running in the background and the global shortcut keeps working. *Quit* from the tray menu closes the app completely.

### Quick Add

Press `Ctrl+Shift+Space` (`Cmd+Shift+Space` on macOS) from anywhere to open a floating bar in the middle of the screen. Type a task (the `!high @tomorrow #list` shortcuts work here too) and press **Enter**: it is saved in the data set of the window you used last, and the bar disappears. Click elsewhere to dismiss it.

If the shortcut does nothing, another application may already be using it. On Linux with Wayland, global shortcuts may not be available.

### Autostart

In **Settings** you can launch toodly when the system starts. It then restores your windows, or stays quietly in the tray if none were open.

## 11. Backup and restore

In **Settings → Data**:

- **Export everything…** saves a single `.zip` with all your data sets, attachments, window layout and preferences. Keep it somewhere safe.
- **Import from zip…** reads a backup and asks what to do with your current data:
  - **Append to existing sets**: the backup's data sets are added next to the ones you have. If a name is already used, `(2)`, `(3)`… is added. Nothing is touched. Open them afterwards from *Settings → Data*.
  - **Overwrite existing data**: deletes **all** current data sets and restores the backup, including windows and preferences. This cannot be undone and asks for confirmation.

Files that are not toodly backups, or that come from a newer, unsupported version, are rejected with a message.

### Automatic backup

In **Settings → Data → Automatic backup** choose how often (daily/weekly), the folder and how many backups to keep, then *Run now* to test it. Backups are made while toodly is running (tray included), at most one at a time even with several windows open. Files are called `toodly-auto-<date>.zip`; older ones are deleted automatically (only files with that name).

### Calendar export (.ics)

**Settings → Data → External calendar → Export .ics…** creates a file you can import in Google Calendar, Outlook or Apple Calendar with the tasks of the current set that have a due date. It is a one-way snapshot: export again to refresh it.

### Templates and previews

- Open a task and click the template icon in the top bar of the panel to **save it as a template** (with its sub-tasks). In the List view the **Template** button lists your templates: pick a reference date and *Use*.
- The eye icon next to an attachment shows a preview (images, PDF, text) without leaving toodly.

### Delete all data

**Settings → Delete all data → Delete…** permanently removes every data set, task, attachment and local preference. One window with an empty "Main data" set remains. The language is kept. Export a backup first if you might need anything.

## 12. Settings

Open **Settings** from the sidebar.

- **Appearance**: *Light*, *Dark* or *System*.
- **Language**: Italian or English (shared by all windows; also changes the tray menu).
- **Number tasks in the list**: shows a progressive number (purple) between the checkbox and the title of each task, counted among the tasks of the same level; groups are not counted and sub-tasks restart from 1.
- **Launch toodly at system startup**.
- **Shortcuts**: a reminder of the main shortcuts.
- **Data**: manage data sets, export, import, delete everything.
- **About**: version and author.

## 13. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + Shift + Space` | Quick Add (works system-wide) |
| `Ctrl/Cmd + N` | New window |
| `Ctrl/Cmd + Shift + I` | Add multiple tasks from text |
| `Ctrl/Cmd + A` | Select all visible tasks |
| `Ctrl/Cmd + click` | Add or remove a task from the selection |
| `Shift + click` | Select a range of tasks |
| `?` | Show the keyboard shortcuts |
| `↑` / `↓` | Previous / next task |
| `Enter` / `Space` | Edit the title / complete or reopen the selected task |
| `Ctrl/Cmd + K` | Search tasks |
| `Ctrl/Cmd + Z` | Undo the last operation |
| `Ctrl + Y` / `Ctrl/Cmd + Shift + Z` | Redo |
| `Esc` | Clear the selection, or close the detail panel |
| `Enter` | Add the task you typed |
| `Ctrl + Enter` | Save a note |
| `Ctrl/Cmd + B` / `Ctrl/Cmd + I` | Bold / italic in the description |

### Search, undo and reminders

- **Search**: press `Ctrl+K` (or the magnifier in the header), type, narrow by list or priority, use ↑ ↓ and Enter to open a task.
- **Undo**: `Ctrl+Z` reverts the last operations, even deletions; right after deleting you can click *Undo* in the notice. `Ctrl+Y` redoes.
- **Reminders**: open a task and choose *Reminder* (it needs a due date; without a start time the default time from Settings is used). Allow notifications if the system asks. Notifications arrive while toodly is running, also in the tray.
- **Statistics**: the chart icon at the bottom of the sidebar.
- **Tour**: Settings → *Getting started* shows the welcome tour again.

### Tags and recurrence

- Type `#word` or `+word` when adding a task to give it a tag (`#word` is a list if a list starts with that word). Add or remove tags in the detail panel; click a tag in the sidebar to see its tasks.
- *Recurrence* in the detail panel offers weekdays, last day of the month and "Days of the week…" (pick the days); *Until* stops the repetition after that date.

### Gantt extras

Turn on **Milestone** in a task to show it as a diamond. *Critical path* highlights what determines the end date, *Late only* shows what is overdue or blocked by a late prerequisite. To link two tasks, drag from the round handle at the right end of a bar and drop it on another bar: the second task will depend on the first.

## 14. Where your data is stored

Everything is stored locally; toodly has no account and sends nothing to the internet.

| System | Databases (one per data set), `datasets.json` | Window layout, attachments, language |
|---|---|---|
| Windows | `%APPDATA%\app.toodly.desktop` | same folder |
| macOS | `~/Library/Application Support/app.toodly.desktop` | same folder |
| Linux | `~/.config/app.toodly.desktop` | `~/.local/share/app.toodly.desktop` |

To move your data to another computer, use **Export everything…** and **Import from zip…** rather than copying files.

## 15. Troubleshooting

- **The window opened on a screen that is no longer connected**: toodly checks that a saved position is still visible and centers the window otherwise.
- **The global shortcut does not work**: another app may use `Ctrl+Shift+Space`. Close that app or use the tray menu *New Quick Task*.
- **I closed the last window and the app disappeared**: it is still running in the tray. Click the tray icon to reopen it, or choose *Quit* to close it.
- **A data set is "open in another window"**: close that window or open the set from there; a set can only be open once.
- **Windows shows a warning when installing**: the installers are not code-signed yet. Choose *More info → Run anyway* (SmartScreen) or, on macOS, open the app from *System Settings → Privacy & Security*.
- **Found a bug?** Please open an issue at <https://github.com/atlantidezign/toodly/issues> with your system, the toodly version (*Settings → About*) and the steps to reproduce.
