# Settings primitives

Generic settings primitives compose section navigation, form sections, resource
rows, metadata, inline actions, and destructive areas. They are copy-agnostic:
downstream apps own labels, routes, security policy, data, and API calls.

Do not create product-specific profile/account templates in FsusUI. Do not
hard-code username, password, MFA, passkey, session, device, or deletion
semantics in these primitives.

## Section Navigation

```vue
<FsusSectionNav
  aria-label="Section navigation"
  :items="[
    { label: 'Overview', href: '#overview', current: true },
    { label: 'Resources', href: '#resources' },
  ]"
/>
```

## Settings Sections

```vue
<FsusSettingsSection
  title="Section title"
  description="Short supporting description."
>
  <template #actions>
    <el-button>Save</el-button>
  </template>

  <FsusFormSection title="Form section">
    <slot />
  </FsusFormSection>
</FsusSettingsSection>
```

Use `FsusSectionHeader` when a page needs only the title, description, and
actions grammar without the surrounding section body.

```vue
<FsusSectionHeader
  title="Section title"
  description="Short supporting description."
  title-tag="h3"
>
  <template #actions>
    <el-button>Action</el-button>
  </template>
</FsusSectionHeader>
```

Two-column settings layouts should be composed by the consuming page with CSS
grid. The primitives keep their internal source order intact so mobile stacking
can collapse to a single column.

## Resource List

```vue
<FsusResourceList>
  <FsusResourceListItem title="Resource name" description="Supporting meta">
    <template #badge>
      <el-tag>State</el-tag>
    </template>

    <FsusMetadataRow>
      <FsusMetadataItem label="Created" value="2026-01-01" />
      <FsusMetadataItem label="Fingerprint" value="A1B2" monospace />
    </FsusMetadataRow>

    <template #actions>
      <FsusInlineActions aria-label="Resource actions">
        <el-button text>Update</el-button>
      </FsusInlineActions>
    </template>
  </FsusResourceListItem>
</FsusResourceList>
```

Use `FsusEmptyState size="inline"` from the empty-state primitive inside empty
resource sections. Full/page empty states should not be placed inside compact
list bodies.

## Danger Areas

```vue
<FsusDangerZone title="Danger zone">
  <FsusRiskNotice title="Review" role="note">
    Explain consequences with product-owned copy.
  </FsusRiskNotice>

  <FsusDestructiveActionPanel title="Remove resource">
    <template #description>
      Product copy explains the action and rollback policy.
    </template>
    <template #actions>
      <el-button type="danger">Continue</el-button>
    </template>
  </FsusDestructiveActionPanel>
</FsusDangerZone>
```

## Typed Confirmation

```vue
<FsusTypedConfirmField
  v-model="confirmation"
  phrase="CONFIRM"
  label="Confirmation phrase"
  description="Type the exact phrase to continue."
/>
```

The field exposes the phrase, labels the input, sets `aria-invalid` while a
partial value does not match, and leaves submit behavior to the consuming app.

## Accessibility Notes

- Give `FsusSectionNav` an accessible label or labelledby target.
- Pick `title-tag` values that preserve the page heading order.
- Keep form labels and inputs owned by the consuming form.
- Keep row actions keyboard reachable and in logical source order.
- Do not rely only on color for danger content; supply explicit risk copy.
- Mobile stacking preserves DOM order; actions move below content visually.
- Dark mode uses existing Element Plus and FsusUI tokens; do not hard-code
  product palette values inside settings primitives.
