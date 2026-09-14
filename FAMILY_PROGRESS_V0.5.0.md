# LogTogether v0.5.0 — family progress + personal sync

## What syncs across your own devices
- completed strength workouts (from v0.4)
- water history and water goal
- interface preferences: language, theme, simple mode, accent color, weekly goal configuration
- height and weight history
- family display name through the existing family-member record
- earned badge metadata

## What family members can see
Family members can read only a minimal daily aggregate for active family members:
- total estimated exercise calories
- total water consumed
- workout count

They can also see family-visible badge metadata. Private workout details, exercise sets, notes, body height/weight, and individual drink timestamps remain private.

The daily aggregate includes calories from all of the user's workouts (including raw workouts whose visibility is private), so the social comparison works without exposing the underlying workout record.

## Comparison UI
A family member profile now has Calories and Water tabs. The selected family member is the highlighted series; the signed-in user is grey. Water uses a blue highlighted series. The summary cards use the same visual encoding.

## Migration safety
v0.5 performs a one-time merge for existing local height/weight and hydration before treating Firestore as authoritative. This prevents a newly created empty cloud document from erasing meaningful pre-v0.5 data on another device.

## Still local-only
- raw hikes and hike routes
- saved routines
- custom profile/workout photos
- photo-story media

Photo stories need a private cloud-media backend before they can be safely shared between devices/family. The app does not put image blobs/base64 into Firestore.
