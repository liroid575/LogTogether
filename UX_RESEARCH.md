# UX research notes for 0.1.1

The logging rewrite follows patterns that are already familiar in established workout trackers rather than inventing a novel interaction model.

## Observed patterns

### Strong

Strong supports both an empty workout and reusable templates. During a workout, exercises can be added, removed, or modified. Its history also supports editing past workouts.

Reference:
- https://help.strongapp.io/article/229-my-first-workout
- https://help.strongapp.io/article/249-how-do-i-edit-a-past-workout

### Hevy

Hevy supports an empty workout, adding exercises from a library, previous-performance values, set deletion, workout deletion with confirmation, rest timers, and routines.

References:
- https://help.hevyapp.com/hc/en-us/articles/35361530647959-How-to-Log-a-Workout-in-the-Hevy-App-Step-by-Step-Guide
- https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy
- https://help.hevyapp.com/hc/en-us/articles/38030200802583-How-to-Delete-Comments-Sets-Workouts-Routines-Your-Hevy-Account

## Applied usability principles

### Progressive disclosure

The app initially shows only the fields required for the selected exercise type. Weight does not appear for a plank; distance does not appear for bench press. Advanced options remain out of the default flow.

Reference:
- https://www.nngroup.com/articles/progressive-disclosure/

### Recognition rather than recall

Previous performance is displayed next to the current set, and exercise selection uses a visible categorized picker. Users do not have to remember what they did last time.

Reference:
- https://www.nngroup.com/articles/ten-usability-heuristics/

### User control and recovery

Destructive saved-record actions require confirmation. Lower-risk changes such as set removal have Undo. This is deliberate protection against accidental taps.

Reference:
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://developer.apple.com/design/human-interface-guidelines/action-sheets

### Touch sizing

Frequently used mobile controls target roughly 44x44 CSS pixels. WCAG 2.2 requires at least 24x24 CSS px (with defined exceptions) and lists 44x44 as the enhanced target-size criterion.

Reference:
- https://www.w3.org/TR/WCAG22/#target-size-minimum
- https://www.w3.org/TR/WCAG22/#target-size-enhanced
