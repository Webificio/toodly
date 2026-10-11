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
- **Header**: the view switcher (*List*, *Kanban*, *Calendar*), sorting and grouping options, and the calendar navigation.
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

- **Title** and **Status** (*To Do*, *In Progress*, *Done*).
- **Priority**: *High*, *Medium*, *Low*, *None* (shown in red, orange, blue and gray).
- **Due date** and **Time** (start and end; the end must be after the start).
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

### Delete all data

**Settings → Delete all data → Delete…** permanently removes every data set, task, attachment and local preference. One window with an empty "Main data" set remains. The language is kept. Export a backup first if you might need anything.

## 12. Settings

Open **Settings** from the sidebar.

- **Appearance**: *Light*, *Dark* or *System*.
- **Language**: Italian or English (shared by all windows; also changes the tray menu).
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
| `Esc` | Clear the selection, or close the detail panel |
| `Enter` | Add the task you typed |
| `Ctrl + Enter` | Save a note |
| `Ctrl/Cmd + B` / `Ctrl/Cmd + I` | Bold / italic in the description |

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
