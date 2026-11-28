<template>
  <div id="settings-visual" class="demo-section" data-testid="settings-visual-fixtures">
    <h2>Settings Composition Acceptance</h2>

    <!-- Full settings page -->
    <div class="demo-block" data-settings-fixture="full-page">
      <h3>Settings Page</h3>
      <div class="settings-fixture-row" data-settings-variant="default">
        <FsusSectionNav ariaLabel="Settings">
          <FsusSectionNavLink to="#general">General</FsusSectionNavLink>
          <FsusSectionNavLink to="#security" active>Security</FsusSectionNavLink>
          <FsusSectionNavLink to="#notifications">Notifications</FsusSectionNavLink>
          <FsusSectionNavLink to="#danger" disabled>Danger Zone</FsusSectionNavLink>
        </FsusSectionNav>
      </div>
    </div>

    <!-- FormSection -->
    <div class="demo-block" data-settings-fixture="form-section">
      <h3>FormSection</h3>
      <div class="settings-fixture-row" data-settings-variant="form-default">
        <FsusSectionHeader title="Account Settings" description="Manage your account preferences" />
        <FsusFormSection>
          <p style="margin: 0; padding: 8px;">Form content area — flat, no card surface</p>
        </FsusFormSection>
      </div>
    </div>

    <!-- ResourceList -->
    <div class="demo-block" data-settings-fixture="resource-list">
      <h3>ResourceList</h3>
      <div class="settings-fixture-row" data-settings-variant="resource-default">
        <FsusResourceList>
          <FsusResourceListItem title="API Key" description="sk-...abc123" />
          <FsusResourceListItem title="Webhook URL" description="https://hooks.example.com/callback" />
        </FsusResourceList>
      </div>
    </div>

    <!-- DangerZone -->
    <div class="demo-block" data-settings-fixture="danger-zone">
      <h3>DangerZone</h3>
      <div class="settings-fixture-row" data-settings-variant="danger-default">
        <FsusDangerZone>
          <FsusRiskNotice title="Caution" role="note">
            This action is irreversible. Please confirm below.
          </FsusRiskNotice>
          <FsusDestructiveActionPanel title="Delete Account">
            <template #description>
              Permanently delete your account and all associated data.
            </template>
          </FsusDestructiveActionPanel>
          <FsusTypedConfirmField phrase="DELETE" />
        </FsusDangerZone>
      </div>
    </div>

    <!-- TypedConfirmField -->
    <div class="demo-block" data-settings-fixture="typed-confirm">
      <h3>TypedConfirmField</h3>
      <div class="settings-fixture-row" data-settings-variant="typed-default">
        <FsusTypedConfirmField phrase="DELETE" />
      </div>
      <div class="settings-fixture-row" data-settings-variant="typed-invalid">
        <FsusTypedConfirmField phrase="DELETE" model-value="wrong-phrase" />
      </div>
    </div>

    <div data-testid="settings-gate-css" style="display:none" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import {
  FsusDangerZone,
  FsusDestructiveActionPanel,
  FsusFormSection,
  FsusResourceList,
  FsusResourceListItem,
  FsusRiskNotice,
  FsusSectionHeader,
  FsusSectionNav,
  FsusTypedConfirmField,
} from '@ozwasyd/fsusui'
</script>
