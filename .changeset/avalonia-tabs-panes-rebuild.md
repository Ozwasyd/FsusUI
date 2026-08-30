---
'element-plus': patch
---

Fix Avalonia `FsusTabs` selection reconciliation when consumers clear and
repopulate the authoritative `Panes` collection, allowing immediate `SelectKey`
without enumerating an in-flux `ItemsSource` or requiring a host workaround.
